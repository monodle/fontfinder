use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Copy)]
pub enum WatcherAction {
    Recover,
    CheckMissing,
}

pub struct FontFolderWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    /// 등록된 모든 감시 대상 폴더 (연결 끊김 상태여도 제거되지 않고 보존)
    registered_folders: HashSet<PathBuf>,
    /// 등록 경로 -> 실제 OS 와처에 등록된 감시 경로 매핑 (정규화 경로 또는 조상 경로)
    watched_targets: HashMap<PathBuf, PathBuf>,
    /// 현재 연결 끊김(Missing)으로 확인된 폴더 목록 (중복 이벤트 폭풍 방어용 상태 머신)
    known_missing: HashSet<PathBuf>,
    shared_folders: Arc<Mutex<HashSet<PathBuf>>>,
    shared_missing: Arc<Mutex<HashSet<PathBuf>>>,
    app_handle: AppHandle,
}

impl FontFolderWatcher {
    pub fn new(app_handle: AppHandle) -> Result<Arc<Mutex<Self>>, String> {
        let shared_folders = Arc::new(Mutex::new(HashSet::<PathBuf>::new()));
        let shared_folders_clone = Arc::clone(&shared_folders);
        let shared_missing = Arc::new(Mutex::new(HashSet::<PathBuf>::new()));
        let shared_missing_clone = Arc::clone(&shared_missing);
        let app_handle_for_events = app_handle.clone();

        let (action_tx, mut action_rx) = tokio::sync::mpsc::unbounded_channel::<WatcherAction>();

        #[allow(unused_mut)]
        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |events: Result<Vec<DebouncedEvent>, _>| {
                let events = match events {
                    Ok(evs) => evs,
                    Err(e) => {
                        eprintln!("[FontWatcher] Watch error (e.g. drive/network disconnection): {:?}", e);
                        let _ = action_tx.send(WatcherAction::CheckMissing);
                        return;
                    }
                };

                let current_registered = match shared_folders_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => return,
                };
                let current_known_missing = match shared_missing_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => HashSet::new(),
                };

                let mut affected_folders = HashSet::new();
                let mut has_new_missing = false;
                let mut has_recovery = false;

                // 1. 현재 디스크에 존재하지 않는 폴더 중 새로 연결 끊긴 폴더 선별
                // 이미 known_missing에 포함된 폴더는 불필요한 OS 디스크/네트워크 I/O 타임아웃 방지를 위해 사전 skip
                for watched in &current_registered {
                    if current_known_missing.contains(watched) {
                        continue;
                    }
                    if !watched.exists() || !watched.is_dir() {
                        has_new_missing = true;
                    }
                }

                // 2. 이벤트 발생 경로와 등록 폴더 간의 정확한 계층 매칭 검사
                for event in &events {
                    let path = &event.path;

                    // macOS AppleDouble 메타데이터(._*) 및 숨김 임시 파일 이벤트 무시
                    let is_hidden_or_appledouble = path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .map(|s| s.starts_with("._") || s.starts_with('.'))
                        .unwrap_or(false);
                    if is_hidden_or_appledouble {
                        continue;
                    }

                    let is_font = path
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|ext| matches!(ext.to_lowercase().as_str(), "ttf" | "otf" | "ttc" | "woff" | "woff2"))
                        .unwrap_or(false);

                    // 디스크에 존재하는 디렉토리이거나, 삭제 이벤트로 이미 존재하지 않지만 확장자가 없는 경로(하위 폴더 삭제)도 디렉토리로 판별
                    let is_dir = path.is_dir() || (!path.exists() && path.extension().is_none());

                    #[cfg(target_os = "macos")]
                    if path == Path::new("/Volumes") || path.starts_with("/Volumes") {
                        has_recovery = true;
                    }

                    for watched in &current_registered {
                        let watched_str = watched.to_string_lossy().to_string();

                        // 끊긴 폴더였는데 상위 조상 이벤트 등으로 다시 존재하게 된 경우 (복구 감지)
                        if watched.exists() && watched.is_dir() {
                            let is_sub = crate::protocol::is_same_or_subpath(watched, path);
                            let is_parent = crate::protocol::is_same_or_subpath(path, watched);

                            if (is_sub && (is_font || is_dir)) || is_parent || path == watched {
                                affected_folders.insert(watched_str);
                                if is_parent || path == watched {
                                    has_recovery = true;
                                }
                            }
                        }
                    }
                }

                // 3. 신규 끊김 이벤트 감지 시에만 와처 정리 비동기 트리거
                if has_new_missing {
                    let _ = action_tx.send(WatcherAction::CheckMissing);
                }

                // 4. 변경 및 복구 이벤트 전송 (무관한 폴더 배제)
                for folder in affected_folders {
                    println!("[FontWatcher] Detected font change/recovery in folder: {}", folder);
                    let _ = app_handle_for_events.emit("folder-font-changed", &folder);
                }

                // 5. 상위 복구 또는 마운트 감지 시 즉시 백그라운드에서 정규 와처 재부착 트리거
                if has_recovery {
                    let _ = action_tx.send(WatcherAction::Recover);
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // macOS 환경: 외장 볼륨 마운트/언마운트 감지를 위해 /Volumes를 단일(NonRecursive) 감시
        #[cfg(target_os = "macos")]
        {
            let volumes = PathBuf::from("/Volumes");
            if volumes.exists() && volumes.is_dir() {
                if let Err(e) = debouncer.watcher().watch(&volumes, RecursiveMode::NonRecursive) {
                    eprintln!("[FontWatcher] Failed to watch /Volumes: {}", e);
                } else {
                    println!("[FontWatcher] Watching /Volumes (NonRecursive) for mount events");
                }
            }
        }

        let instance = Arc::new(Mutex::new(Self {
            debouncer,
            registered_folders: HashSet::new(),
            watched_targets: HashMap::new(),
            known_missing: HashSet::new(),
            shared_folders,
            shared_missing,
            app_handle,
        }));

        // 백그라운드 액션 채널 수신기 (복구 및 끊긴 폴더 와처 자동 정리)
        let weak_instance = Arc::downgrade(&instance);
        tauri::async_runtime::spawn(async move {
            while let Some(action) = action_rx.recv().await {
                match action {
                    WatcherAction::Recover => {
                        // 파일시스템 마운트 I/O 안정화 대기 (100ms)
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        // 연속 인입된 Recover 액션 통합 (중복 연산 방어)
                        while let Ok(_) = action_rx.try_recv() {}
                        if let Some(arc) = weak_instance.upgrade() {
                            let _ = tokio::task::spawn_blocking(move || {
                                if let Ok(mut w) = arc.lock() {
                                    let _ = w.check_and_recover_missing();
                                }
                            }).await;
                        } else {
                            break;
                        }
                    }
                    WatcherAction::CheckMissing => {
                        // 네트워크/드라이브 단절 시 연속 인입되는 에러 폭풍 통합 (coalescing)
                        while let Ok(_) = action_rx.try_recv() {}
                        if let Some(arc) = weak_instance.upgrade() {
                            let _ = tokio::task::spawn_blocking(move || {
                                if let Ok(mut w) = arc.lock() {
                                    let _ = w.check_missing_folders();
                                }
                            }).await;
                        } else {
                            break;
                        }
                    }
                }
            }
        });

        Ok(instance)
    }

    /// 감시 대상 폴더 등록: 디스크에 존재하면 해당 폴더 재귀 감시,
    /// 디스크에 없으면 살아있는 가장 가까운 조상 폴더를 찾아 NonRecursive(1단계) 감시 등록
    pub fn watch(&mut self, path: &Path) -> Result<(), String> {
        let clean_path = crate::protocol::to_posix_normalized_path(path);
        self.registered_folders.insert(clean_path.clone());
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.insert(clean_path.clone());
        }

        if clean_path.exists() && clean_path.is_dir() {
            self.known_missing.remove(&clean_path);
            if let Ok(mut missing) = self.shared_missing.lock() {
                missing.remove(&clean_path);
            }

            let canonical = clean_path
                .canonicalize()
                .map(|p| crate::protocol::strip_unc_prefix(&p))
                .unwrap_or_else(|_| clean_path.clone());

            let already_watched = self.watched_targets.values().any(|t| t == &canonical);
            if !already_watched {
                if let Err(e) = self
                    .debouncer
                    .watcher()
                    .watch(&canonical, RecursiveMode::Recursive)
                {
                    eprintln!("[FontWatcher] Failed to watch folder {:?}: {}", path, e);
                } else {
                    println!("[FontWatcher] Watching folder (Recursive): {:?}", clean_path);
                }
            }
            self.watched_targets.insert(clean_path, canonical);
        } else {
            // 폴더가 현재 디스크에 없더라도, 현재 살아있는 가장 가까운 조상 폴더를 찾아
            // NonRecursive(1단계)로 감시하여 자식 생성/이름변경 이벤트를 안전하게 수신 (하위 트리 탐색 부하 0)
            self.known_missing.insert(clean_path.clone());
            if let Ok(mut missing) = self.shared_missing.lock() {
                missing.insert(clean_path.clone());
            }

            let mut ancestor = clean_path.parent();
            while let Some(parent) = ancestor {
                if parent.exists() && parent.is_dir() {
                    let canonical_parent = parent
                        .canonicalize()
                        .map(|p| crate::protocol::strip_unc_prefix(&p))
                        .unwrap_or_else(|_| parent.to_path_buf());

                    let already_watched = self.watched_targets.values().any(|t| t == &canonical_parent);
                    if !already_watched {
                        #[cfg(target_os = "macos")]
                        let is_root_volumes = canonical_parent == Path::new("/Volumes");
                        #[cfg(not(target_os = "macos"))]
                        let is_root_volumes = false;

                        if !is_root_volumes {
                            if let Err(e) = self
                                .debouncer
                                .watcher()
                                .watch(&canonical_parent, RecursiveMode::NonRecursive)
                            {
                                eprintln!("[FontWatcher] Failed to watch ancestor folder {:?}: {}", parent, e);
                            } else {
                                println!("[FontWatcher] Watching ancestor folder (NonRecursive 1-level): {:?}", parent);
                            }
                        }
                    }
                    self.watched_targets.insert(clean_path, canonical_parent);
                    break;
                }
                ancestor = parent.parent();
            }
        }

        Ok(())
    }

    /// 외장 드라이브 마운트나 복구 이벤트 발생 시, 연결 끊겼던 폴더들을 재확인하여 정규 와처로 재부착
    pub fn check_and_recover_missing(&mut self) -> Vec<PathBuf> {
        let mut recovered = Vec::new();

        for path in &self.registered_folders {
            if path.exists() && path.is_dir() {
                self.known_missing.remove(path);

                let canonical = path
                    .canonicalize()
                    .map(|p| crate::protocol::strip_unc_prefix(&p))
                    .unwrap_or_else(|_| path.clone());

                let needs_reattach = match self.watched_targets.get(path) {
                    Some(target) => !crate::protocol::is_same_or_subpath(target, &canonical) || !crate::protocol::is_same_or_subpath(&canonical, target),
                    None => true,
                };

                if needs_reattach {
                    // 이전 감시 대상이 조상 폴더 등 다른 경로였을 경우 정리
                    if let Some(old_target) = self.watched_targets.remove(path) {
                        let is_used_elsewhere = self.watched_targets.values().any(|t| t == &old_target);
                        #[cfg(target_os = "macos")]
                        let is_root_volumes = old_target == Path::new("/Volumes");
                        #[cfg(not(target_os = "macos"))]
                        let is_root_volumes = false;

                        if !is_used_elsewhere && !is_root_volumes {
                            let _ = self.debouncer.watcher().unwatch(&old_target);
                        }
                    }

                    let is_canonical_watched = self.watched_targets.values().any(|t| t == &canonical);
                    let watch_result = if !is_canonical_watched {
                        self.debouncer.watcher().watch(&canonical, RecursiveMode::Recursive)
                    } else {
                        Ok(())
                    };

                    if let Ok(_) = watch_result {
                        self.watched_targets.insert(path.clone(), canonical);
                        recovered.push(path.clone());
                        println!("[FontWatcher] Re-attached watcher for recovered folder: {:?}", path);
                        let _ = self.app_handle.emit("folder-font-changed", path.to_string_lossy().to_string());
                    }
                }
            }
        }

        if let Ok(mut shared) = self.shared_missing.lock() {
            *shared = self.known_missing.clone();
        }

        recovered
    }

    /// 외장 드라이브 분리(언마운트) 시, 연결이 끊긴 폴더를 감지하여 조상 감시로 전환 및 folder-missing 이벤트 발행
    pub fn check_missing_folders(&mut self) -> Vec<PathBuf> {
        let mut missing = Vec::new();

        for path in &self.registered_folders {
            if !path.exists() || !path.is_dir() {
                // Active -> Missing 상태 전이 시에만 이벤트 1회 발행 및 missing 목록에 추가
                let is_newly_missing = self.known_missing.insert(path.clone());
                if is_newly_missing {
                    missing.push(path.clone());
                    let path_str = path.to_string_lossy().to_string();
                    println!("[FontWatcher] Detected unmounted/missing folder: {}", path_str);
                    let _ = self.app_handle.emit("folder-missing", path_str);
                }

                // 기존 타깃이 조상 폴더가 아닌 '자기 자신'이었던 경우(Active 감시 중 언마운트됨)에만 정리하고 조상 감시로 전환
                let is_self_watched = self.watched_targets.get(path).map(|t| {
                    crate::protocol::is_same_or_subpath(t, path) && crate::protocol::is_same_or_subpath(path, t)
                }).unwrap_or(false);

                if is_self_watched {
                    if let Some(target) = self.watched_targets.remove(path) {
                        let is_used_elsewhere = self.watched_targets.values().any(|t| t == &target);
                        #[cfg(target_os = "macos")]
                        let is_root_volumes = target == Path::new("/Volumes");
                        #[cfg(not(target_os = "macos"))]
                        let is_root_volumes = false;

                        if !is_used_elsewhere && !is_root_volumes {
                            let _ = self.debouncer.watcher().unwatch(&target);
                        }
                    }

                    // 언마운트된 폴더 대신 가장 가까운 조상 폴더를 NonRecursive로 감시하도록 전환하여 향후 재마운트 감지 보장
                    let mut ancestor = path.parent();
                    while let Some(parent) = ancestor {
                        if parent.exists() && parent.is_dir() {
                            let canonical_parent = parent
                                .canonicalize()
                                .map(|p| crate::protocol::strip_unc_prefix(&p))
                                .unwrap_or_else(|_| parent.to_path_buf());

                            let already_watched = self.watched_targets.values().any(|t| t == &canonical_parent);
                            if !already_watched {
                                #[cfg(target_os = "macos")]
                                let is_root_volumes = canonical_parent == Path::new("/Volumes");
                                #[cfg(not(target_os = "macos"))]
                                let is_root_volumes = false;

                                if !is_root_volumes {
                                    let _ = self.debouncer.watcher().watch(&canonical_parent, RecursiveMode::NonRecursive);
                                }
                            }
                            self.watched_targets.insert(path.clone(), canonical_parent);
                            break;
                        }
                        ancestor = parent.parent();
                    }
                }
            }
        }

        if let Ok(mut shared) = self.shared_missing.lock() {
            *shared = self.known_missing.clone();
        }

        missing
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<(), String> {
        let clean_path = crate::protocol::to_posix_normalized_path(path);

        // Windows 대소문자 비구분 및 NFD 정규화 지원: 동일 경로로 평가되는 기존 등록 키 탐색
        let matching_registered = self.registered_folders
            .iter()
            .find(|p| crate::protocol::is_same_or_subpath(p, &clean_path) && crate::protocol::is_same_or_subpath(&clean_path, p))
            .cloned()
            .unwrap_or_else(|| clean_path.clone());

        self.registered_folders.remove(&matching_registered);
        self.known_missing.remove(&matching_registered);
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.remove(&matching_registered);
        }
        if let Ok(mut missing) = self.shared_missing.lock() {
            missing.remove(&matching_registered);
        }

        let target_key = self.watched_targets
            .keys()
            .find(|p| crate::protocol::is_same_or_subpath(p, &clean_path) && crate::protocol::is_same_or_subpath(&clean_path, p))
            .cloned()
            .unwrap_or(matching_registered);

        if let Some(target) = self.watched_targets.remove(&target_key) {
            let is_used_elsewhere = self.watched_targets.values().any(|t| t == &target);
            #[cfg(target_os = "macos")]
            let is_root_volumes = target == Path::new("/Volumes");
            #[cfg(not(target_os = "macos"))]
            let is_root_volumes = false;

            if !is_used_elsewhere && !is_root_volumes {
                let _ = self.debouncer.watcher().unwatch(&target);
            }
            println!("[FontWatcher] Unwatched folder: {:?}", clean_path);
        }

        Ok(())
    }
}
