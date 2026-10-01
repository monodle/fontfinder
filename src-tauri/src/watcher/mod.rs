use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use tauri::{AppHandle, Emitter};

pub struct FontFolderWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    /// 등록된 모든 감시 대상 폴더 (연결 끊김 상태여도 제거되지 않고 보존)
    registered_folders: HashSet<PathBuf>,
    /// 실제 OS 와처에 등록된 경로들 (폴더 자체 또는 부모 폴더)
    watched_targets: HashSet<PathBuf>,
    shared_folders: Arc<Mutex<HashSet<PathBuf>>>,
}

impl FontFolderWatcher {
    pub fn new(app_handle: AppHandle) -> Result<Arc<Mutex<Self>>, String> {
        let shared_folders = Arc::new(Mutex::new(HashSet::<PathBuf>::new()));
        let shared_folders_clone = Arc::clone(&shared_folders);

        let debouncer = new_debouncer(
            Duration::from_millis(500),
            move |events: Result<Vec<DebouncedEvent>, _>| {
                let events = match events {
                    Ok(evs) => evs,
                    Err(e) => {
                        eprintln!("[FontWatcher] Watch error: {:?}", e);
                        return;
                    }
                };

                let current_registered = match shared_folders_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => return,
                };

                let mut affected_folders = HashSet::new();
                let mut missing_folders = HashSet::new();

                // 1. 현재 디스크에 존재하지 않는 폴더 선별
                for watched in &current_registered {
                    if !watched.exists() || !watched.is_dir() {
                        missing_folders.insert(watched.to_string_lossy().to_string());
                    }
                }

                // 2. 이벤트 발생 경로와 등록 폴더 간의 매칭 검사
                for event in events {
                    let path = &event.path;
                    let is_font = path
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|ext| matches!(ext.to_lowercase().as_str(), "ttf" | "otf" | "ttc" | "woff" | "woff2"))
                        .unwrap_or(false);

                    for watched in &current_registered {
                        let watched_str = watched.to_string_lossy().to_string();
                        if missing_folders.contains(&watched_str) {
                            continue;
                        }

                        // 폴더 자체가 변경/복구되었거나, 폴더 하위에 폰트 파일이 추가/삭제/수정된 경우
                        if crate::protocol::is_same_or_subpath(watched, path)
                            || crate::protocol::is_same_or_subpath(path, watched)
                            || path == watched
                            || is_font
                        {
                            affected_folders.insert(watched_str);
                        }
                    }
                }

                // 3. 끊김 이벤트 전송
                for folder in missing_folders {
                    println!("[FontWatcher] Detected folder missing/unmounted: {}", folder);
                    let _ = app_handle.emit("folder-missing", &folder);
                }

                // 4. 변경 및 복구 이벤트 전송
                for folder in affected_folders {
                    println!("[FontWatcher] Detected font change in folder: {}", folder);
                    let _ = app_handle.emit("folder-font-changed", &folder);
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        let instance = Arc::new(Mutex::new(Self {
            debouncer,
            registered_folders: HashSet::new(),
            watched_targets: HashSet::new(),
            shared_folders,
        }));

        Ok(instance)
    }

    pub fn watch(&mut self, path: &Path) -> Result<(), String> {
        let path_buf = path.to_path_buf();
        self.registered_folders.insert(path_buf.clone());
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.insert(path_buf.clone());
        }

        if path.exists() && path.is_dir() {
            let canonical = path.canonicalize().unwrap_or_else(|_| path_buf.clone());
            if !self.watched_targets.contains(&canonical) {
                if let Err(e) = self
                    .debouncer
                    .watcher()
                    .watch(&canonical, RecursiveMode::Recursive)
                {
                    eprintln!("[FontWatcher] Failed to watch folder {:?}: {}", path, e);
                } else {
                    self.watched_targets.insert(canonical);
                    println!("[FontWatcher] Watching folder: {:?}", path_buf);
                }
            }
        } else {
            // 폴더가 현재 디스크에 없더라도 상위 부모 폴더에 와처를 등록하여 복구/이름변경 이벤트를 수신할 수 있도록 함
            let mut ancestor = path.parent();
            while let Some(parent) = ancestor {
                if parent.exists() && parent.is_dir() {
                    let canonical_parent = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
                    if !self.watched_targets.contains(&canonical_parent) {
                        if let Err(e) = self
                            .debouncer
                            .watcher()
                            .watch(&canonical_parent, RecursiveMode::Recursive)
                        {
                            eprintln!("[FontWatcher] Failed to watch parent folder {:?}: {}", parent, e);
                        } else {
                            self.watched_targets.insert(canonical_parent);
                            println!("[FontWatcher] Watching parent folder for recovery events: {:?}", parent);
                        }
                    }
                    break;
                }
                ancestor = parent.parent();
            }
        }

        Ok(())
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<(), String> {
        let path_buf = path.to_path_buf();
        self.registered_folders.remove(&path_buf);
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.remove(&path_buf);
        }

        let canonical = path.canonicalize().unwrap_or_else(|_| path_buf.clone());
        if self.watched_targets.contains(&canonical) {
            let _ = self.debouncer.watcher().unwatch(&canonical);
            self.watched_targets.remove(&canonical);
            println!("[FontWatcher] Unwatched folder: {:?}", path_buf);
        }

        Ok(())
    }
}
