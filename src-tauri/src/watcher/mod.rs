use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use tauri::{AppHandle, Emitter};

pub struct FontFolderWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    watched_folders: HashSet<PathBuf>,
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

                let current_watched = match shared_folders_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => return,
                };

                let mut affected_folders = HashSet::new();
                let mut missing_folders = HashSet::new();

                for watched in &current_watched {
                    if !watched.exists() || !watched.is_dir() {
                        missing_folders.insert(watched.to_string_lossy().to_string());
                    }
                }

                for event in events {
                    let path = &event.path;
                    let is_font = path
                        .extension()
                        .and_then(|s| s.to_str())
                        .map(|ext| matches!(ext.to_lowercase().as_str(), "ttf" | "otf" | "ttc" | "woff" | "woff2"))
                        .unwrap_or(false);

                    for watched in &current_watched {
                        let watched_str = watched.to_string_lossy().to_string();
                        if missing_folders.contains(&watched_str) {
                            continue;
                        }

                        if path.starts_with(watched) && (is_font || path == watched || !path.exists()) {
                            affected_folders.insert(watched_str);
                        }
                    }
                }

                for folder in missing_folders {
                    println!("[FontWatcher] Detected folder missing/unmounted: {}", folder);
                    let _ = app_handle.emit("folder-missing", &folder);
                }

                for folder in affected_folders {
                    println!("[FontWatcher] Detected font change in folder: {}", folder);
                    let _ = app_handle.emit("folder-font-changed", &folder);
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        let instance = Self {
            debouncer,
            watched_folders: HashSet::new(),
            shared_folders,
        };

        Ok(Arc::new(Mutex::new(instance)))
    }

    pub fn watch(&mut self, path: &Path) -> Result<(), String> {
        if !path.exists() || !path.is_dir() {
            return Err(format!("Directory does not exist: {:?}", path));
        }

        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if self.watched_folders.contains(&canonical) {
            return Ok(());
        }

        self.debouncer
            .watcher()
            .watch(&canonical, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch folder {:?}: {}", path, e))?;

        self.watched_folders.insert(canonical.clone());
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.insert(canonical);
        }
        Ok(())
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<(), String> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if !self.watched_folders.contains(&canonical) {
            return Ok(());
        }

        let _ = self.debouncer.watcher().unwatch(&canonical);
        self.watched_folders.remove(&canonical);
        if let Ok(mut shared) = self.shared_folders.lock() {
            shared.remove(&canonical);
        }
        Ok(())
    }
}
