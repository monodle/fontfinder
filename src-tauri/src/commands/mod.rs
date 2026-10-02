use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::db::{ActivatedFontRecord, Database, DbFolder, FontSet};
use crate::font::{FontMetadata, FontScanner};
use crate::platform::Platform;
use crate::watcher::FontFolderWatcher;

pub struct AppState {
    pub db: Arc<Database>,
    pub watcher: Arc<Mutex<FontFolderWatcher>>,
}

#[tauri::command]
pub async fn get_cached_fonts(state: State<'_, AppState>) -> Result<Vec<FontMetadata>, String> {
    state.db.get_active_cached_fonts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_font_library(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    custom_paths: Vec<String>,
) -> Result<Vec<FontMetadata>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        let mut dirs = Platform::get_system_font_directories();
        for p in custom_paths {
            let path_buf = PathBuf::from(p);
            if path_buf.exists() && !dirs.contains(&path_buf) {
                dirs.push(path_buf);
            }
        }

        let _ = db.cleanup_orphan_cached_fonts();
        let app_handle = app.clone();
        let progress_cb = move |current: usize, total: usize| {
            use tauri::Emitter;
            let _ = app_handle.emit("font-scan-progress", serde_json::json!({
                "current": current,
                "total": total
            }));
        };

        FontScanner::sync_directories(&dirs, &db, true, Some(&progress_cb)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_directory(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<FontMetadata>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        let path_buf = PathBuf::from(&path);
        let path_clone = path.clone();
        let app_handle = app.clone();
        let progress_cb = move |current: usize, total: usize| {
            use tauri::Emitter;
            let _ = app_handle.emit(
                "folder-scan-progress",
                serde_json::json!({
                    "path": path_clone,
                    "current": current,
                    "total": total
                }),
            );
        };
        FontScanner::sync_directories(&[path_buf], &db, false, Some(&progress_cb))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, serde::Deserialize)]
pub struct BulkFontItem {
    pub font_id: i64,
    pub path: String,
}

#[tauri::command]
pub async fn activate_font(
    state: State<'_, AppState>,
    path: String,
    font_id: i64,
) -> Result<(), String> {
    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        let path_buf = PathBuf::from(&path_clone);
        Platform::activate_font(&path_buf)
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = state.db.record_activated_font(font_id, &path);
    Ok(())
}

#[tauri::command]
pub async fn deactivate_font(
    state: State<'_, AppState>,
    path: String,
    font_id: i64,
) -> Result<(), String> {
    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        let path_buf = PathBuf::from(&path_clone);
        Platform::deactivate_font(&path_buf)
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = state.db.remove_activated_font(font_id);
    Ok(())
}

#[tauri::command]
pub async fn activate_fonts(
    state: State<'_, AppState>,
    items: Vec<BulkFontItem>,
) -> Result<usize, String> {
    let raw_items = items
        .iter()
        .map(|it| (it.font_id, it.path.clone()))
        .collect::<Vec<_>>();

    let (count, success_items) = tokio::task::spawn_blocking(move || {
        let mut count = 0;
        let mut success = Vec::new();
        for (id, path) in raw_items {
            let path_buf = PathBuf::from(&path);
            if Platform::activate_font(&path_buf).is_ok() {
                count += 1;
                success.push((id, path));
            }
        }
        Ok::<_, String>((count, success))
    })
    .await
    .map_err(|e| e.to_string())??;

    if !success_items.is_empty() {
        let _ = state.db.record_activated_fonts(&success_items);
    }
    Ok(count)
}

#[tauri::command]
pub async fn deactivate_fonts(
    state: State<'_, AppState>,
    items: Vec<BulkFontItem>,
) -> Result<usize, String> {
    let raw_items = items
        .iter()
        .map(|it| (it.font_id, it.path.clone()))
        .collect::<Vec<_>>();

    let (count, deactivated_ids) = tokio::task::spawn_blocking(move || {
        let mut count = 0;
        let mut deactivated = Vec::new();
        for (id, path) in raw_items {
            let path_buf = PathBuf::from(&path);
            if Platform::deactivate_font(&path_buf).is_ok() {
                count += 1;
                deactivated.push(id);
            }
        }
        Ok::<_, String>((count, deactivated))
    })
    .await
    .map_err(|e| e.to_string())??;

    if !deactivated_ids.is_empty() {
        let _ = state.db.remove_activated_fonts(&deactivated_ids);
    }
    Ok(count)
}

#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg("-R")
                .arg(&path)
                .spawn();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg(format!("/select,{}", path))
                .spawn();
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn();
        }
        Ok(())
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

#[tauri::command]
pub async fn install_fonts(paths: Vec<String>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mut installed = Vec::new();
        let mut errors = Vec::new();

        for path in paths {
            let path_buf = PathBuf::from(&path);
            match Platform::install_font(&path_buf) {
                Ok(target) => installed.push(target.to_string_lossy().to_string()),
                Err(err) => errors.push(format!("{}: {}", path, err)),
            }
        }

        if installed.is_empty() && !errors.is_empty() {
            return Err(errors.join("; "));
        }

        Ok(installed)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn uninstall_fonts(paths: Vec<String>) -> Result<usize, String> {
    tokio::task::spawn_blocking(move || {
        let mut deleted_count = 0;
        let mut errors = Vec::new();

        for path in paths {
            let path_buf = PathBuf::from(&path);
            match Platform::uninstall_font(&path_buf) {
                Ok(_) => deleted_count += 1,
                Err(err) => errors.push(format!("{}: {}", path, err)),
            }
        }

        if deleted_count == 0 && !errors.is_empty() {
            return Err(errors.join("; "));
        }

        Ok(deleted_count)
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- Sets IPC ---
#[tauri::command]
pub fn create_set(name: String, color: Option<String>, parent_id: Option<i64>, state: State<'_, AppState>) -> Result<FontSet, String> {
    state.db.create_set(&name, color.as_deref(), parent_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_set_color(set_id: i64, color: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_set_color(set_id, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_set(set_id: i64, name: String, color: String, parent_id: Option<i64>, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_set(set_id, &name, &color, parent_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_set_parent(set_id: i64, parent_id: Option<i64>, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_set_parent(set_id, parent_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sets(state: State<'_, AppState>) -> Result<Vec<FontSet>, String> {
    state.db.get_sets().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_set(set_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_set(set_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_font_to_set(set_id: i64, font_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.db.add_font_to_set(set_id, font_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_font_from_set(set_id: i64, font_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_font_from_set(set_id, font_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_set_font_ids(set_id: i64, state: State<'_, AppState>) -> Result<Vec<i64>, String> {
    state.db.get_set_font_ids(set_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_set_font_ids(state: State<'_, AppState>) -> Result<std::collections::HashMap<i64, Vec<i64>>, String> {
    state.db.get_all_set_font_ids().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_fonts_to_set_bulk(set_id: i64, font_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    state.db.add_fonts_to_set_bulk(set_id, &font_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_fonts_from_set_bulk(set_id: i64, font_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_fonts_from_set_bulk(set_id, &font_ids).map_err(|e| e.to_string())
}

// --- Favorites IPC ---
#[tauri::command]
pub fn toggle_favorite(font_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    state.db.toggle_favorite(font_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_favorites_bulk(font_ids: Vec<i64>, add: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_favorites_bulk(&font_ids, add).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_favorite_font_ids(state: State<'_, AppState>) -> Result<Vec<i64>, String> {
    state.db.get_favorite_font_ids().map_err(|e| e.to_string())
}


// --- Folder Watcher IPC ---
#[tauri::command]
pub fn watch_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    watcher.watch(&PathBuf::from(path))
}

#[tauri::command]
pub fn unwatch_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    watcher.unwatch(&PathBuf::from(path))
}

// --- Watched Folders IPC ---
#[tauri::command]
pub fn get_folders(state: State<'_, AppState>) -> Result<Vec<DbFolder>, String> {
    state.db.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_folder(path: String, name: String, color: Option<String>, state: State<'_, AppState>) -> Result<DbFolder, String> {
    state.db.add_folder(&path, &name, color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_folder_color(folder_id: i64, color: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_folder_color(folder_id, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_folder(&path).map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize)]
pub struct FolderStatus {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub color: String,
    pub exists: bool,
}

#[tauri::command]
pub fn check_folders_status(state: State<'_, AppState>) -> Result<Vec<FolderStatus>, String> {
    let folders = state.db.get_folders().map_err(|e| e.to_string())?;
    let mut statuses = Vec::new();
    for f in folders {
        let path_buf = PathBuf::from(&f.path);
        let exists = path_buf.exists() && path_buf.is_dir();
        statuses.push(FolderStatus {
            id: f.id,
            path: f.path,
            name: f.name,
            color: f.color,
            exists,
        });
    }
    Ok(statuses)
}

#[tauri::command]
pub async fn relink_folder(
    state: State<'_, AppState>,
    old_path: String,
    new_path: String,
    new_name: Option<String>,
) -> Result<(), String> {
    let new_path_buf = PathBuf::from(&new_path);
    if !new_path_buf.exists() || !new_path_buf.is_dir() {
        return Err("Target folder does not exist or is not a directory".to_string());
    }

    let name = new_name.unwrap_or_else(|| {
        new_path_buf
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&new_path)
            .to_string()
    });

    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.unwatch(&PathBuf::from(&old_path));
    }

    state
        .db
        .update_folder_path(&old_path, &new_path, &name)
        .map_err(|e| e.to_string())?;

    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.watch(&new_path_buf);
    }

    Ok(())
}

#[tauri::command]
pub fn remove_folder_with_data(path: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.unwatch(&PathBuf::from(&path));
    }

    // 1. 해당 폴더 하위에 속한 활성화된 폰트들을 OS 레벨에서 사전 비활성화
    if let Ok(activated) = state.db.get_activated_fonts() {
        let normalized_folder = if path.ends_with('/') || path.ends_with('\\') {
            path.clone()
        } else {
            format!("{}/", path)
        };

        for rec in activated {
            if rec.file_path == path || rec.file_path.starts_with(&normalized_folder) {
                let path_buf = PathBuf::from(&rec.file_path);
                let _ = Platform::deactivate_font(&path_buf);
            }
        }
    }

    // 2. DB 및 연관 데이터 일괄 정리
    state
        .db
        .remove_folder_and_associated_data(&path)
        .map_err(|e| e.to_string())
}

// --- Activated Fonts IPC ---
#[tauri::command]
pub fn get_activated_fonts(state: State<'_, AppState>) -> Result<Vec<ActivatedFontRecord>, String> {
    state.db.get_activated_fonts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_and_cleanup_activated_fonts(
    state: State<'_, AppState>,
) -> Result<Vec<ActivatedFontRecord>, String> {
    let records = state.db.get_activated_fonts().map_err(|e| e.to_string())?;
    let mut valid_records = Vec::new();
    let mut missing_paths = Vec::new();

    for r in records {
        let path = PathBuf::from(&r.file_path);
        if path.exists() && path.is_file() {
            valid_records.push(r);
        } else {
            let _ = Platform::deactivate_font(&path);
            missing_paths.push(r.file_path);
        }
    }

    if !missing_paths.is_empty() {
        let _ = state.db.remove_activated_fonts_by_paths(&missing_paths);
    }

    Ok(valid_records)
}

// --- App Settings IPC ---
#[tauri::command]
pub fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cached_fonts_by_hashes(
    hashes: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<FontMetadata>, String> {
    state.db.get_cached_fonts_by_hashes(&hashes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cached_fonts_by_ids(
    ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<FontMetadata>, String> {
    state.db.get_cached_fonts_by_ids(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_system_theme(window: tauri::Window) -> String {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Registry::{
            RegOpenKeyExW, RegQueryValueExW, RegCloseKey, HKEY_CURRENT_USER, KEY_READ, REG_DWORD,
        };
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let subkey: Vec<u16> = OsStr::new(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let value_name: Vec<u16> = OsStr::new("AppsUseLightTheme")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = std::ptr::null_mut();
        unsafe {
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_READ, &mut hkey) == 0 {
                let mut data: u32 = 0;
                let mut data_size = std::mem::size_of::<u32>() as u32;
                let mut val_type: u32 = 0;
                let res = RegQueryValueExW(
                    hkey,
                    value_name.as_ptr(),
                    std::ptr::null_mut(),
                    &mut val_type,
                    &mut data as *mut u32 as *mut u8,
                    &mut data_size,
                );
                RegCloseKey(hkey);
                if res == 0 && val_type == REG_DWORD {
                    return if data == 0 {
                        "dark".to_string()
                    } else {
                        "light".to_string()
                    };
                }
            }
        }
    }

    match window.theme() {
        Ok(tauri::Theme::Dark) => "dark".to_string(),
        Ok(tauri::Theme::Light) => "light".to_string(),
        _ => "light".to_string(),
    }
}

#[tauri::command]
pub fn set_window_theme(window: tauri::Window, theme: Option<String>) -> Result<(), String> {
    let t = match theme.as_deref() {
        Some("dark") => Some(tauri::Theme::Dark),
        Some("light") => Some(tauri::Theme::Light),
        _ => None,
    };
    window.set_theme(t).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_app_data(state: State<'_, AppState>) -> Result<(), String> {
    // 1. 활성화된 폰트 시스템 비활성화
    if let Ok(records) = state.db.get_activated_fonts() {
        for r in records {
            let path = PathBuf::from(&r.file_path);
            let _ = Platform::deactivate_font(&path);
        }
    }

    // 2. watcher에서 감시 중인 폴더 해제
    if let Ok(folders) = state.db.get_folders() {
        if let Ok(mut watcher) = state.watcher.lock() {
            for f in folders {
                let _ = watcher.unwatch(&PathBuf::from(&f.path));
            }
        }
    }

    // 3. SQLite DB 완전 초기화
    state.db.reset_database().map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct PathTypeInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub exists: bool,
}

#[tauri::command]
pub fn check_paths(paths: Vec<String>) -> Result<Vec<PathTypeInfo>, String> {
    let mut results = Vec::with_capacity(paths.len());
    for p in paths {
        let path_buf = PathBuf::from(&p);
        let exists = path_buf.exists();
        let is_dir = exists && path_buf.is_dir();
        let name = path_buf
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&p)
            .to_string();
        results.push(PathTypeInfo {
            path: p,
            name,
            is_dir,
            exists,
        });
    }
    Ok(results)
}

const MAX_BACKUP_SIZE_BYTES: u64 = 20 * 1024 * 1024; // 20 MB

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("안전하지 않은 URL 스킴입니다. http 또는 https 링크만 열 수 있습니다.".to_string());
    }

    if trimmed.contains('\n') || trimmed.contains('\r') || trimmed.contains('\0') {
        return Err("URL에 유효하지 않은 제어 문자가 포함되어 있습니다.".to_string());
    }

    let url_clone = trimmed.to_string();
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        {
            let status = std::process::Command::new("open")
                .arg(&url_clone)
                .status()
                .or_else(|_| {
                    std::process::Command::new("/usr/bin/open")
                        .arg(&url_clone)
                        .status()
                })
                .map_err(|e| format!("URL 열기 실패: {}", e))?;
            if !status.success() {
                return Err("브라우저 프로세스 실행 실패".to_string());
            }
        }
        #[cfg(target_os = "windows")]
        {
            let status = std::process::Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &url_clone])
                .status();

            let is_success = match status {
                Ok(s) => s.success(),
                Err(_) => false,
            };

            if !is_success {
                let cmd_status = std::process::Command::new("cmd")
                    .args(["/c", "start", "", &url_clone])
                    .status()
                    .map_err(|e| format!("URL 열기 실패: {}", e))?;
                if !cmd_status.success() {
                    return Err("브라우저 프로세스 실행 실패".to_string());
                }
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            let status = std::process::Command::new("xdg-open")
                .arg(&url_clone)
                .status()
                .map_err(|e| format!("URL 열기 실패: {}", e))?;
            if !status.success() {
                return Err("브라우저 프로세스 실행 실패".to_string());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

#[tauri::command]
pub async fn save_backup_file(path: String, content: String) -> Result<(), String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("저장 경로가 비어 있습니다.".to_string());
    }

    if content.len() as u64 > MAX_BACKUP_SIZE_BYTES {
        return Err("백업 데이터 크기가 20MB를 초과하여 저장할 수 없습니다.".to_string());
    }

    let path_buf = PathBuf::from(trimmed_path);
    if let Some(parent) = path_buf.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("저장 대상 폴더가 존재하지 않습니다.".to_string());
        }
    }

    tokio::fs::write(&path_buf, content)
        .await
        .map_err(|e| format!("백업 파일 저장 실패: {}", e))
}

#[tauri::command]
pub async fn read_backup_file(path: String) -> Result<String, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("파일 경로가 비어 있습니다.".to_string());
    }

    let path_buf = PathBuf::from(trimmed_path);
    if !path_buf.exists() || !path_buf.is_file() {
        return Err("유효한 백업 파일이 존재하지 않습니다.".to_string());
    }

    let metadata = tokio::fs::metadata(&path_buf)
        .await
        .map_err(|e| format!("파일 정보 조회 실패: {}", e))?;

    if metadata.len() > MAX_BACKUP_SIZE_BYTES {
        return Err("백업 파일 크기가 20MB를 초과하여 불러올 수 없습니다.".to_string());
    }

    tokio::fs::read_to_string(&path_buf)
        .await
        .map_err(|e| format!("백업 파일 읽기 실패: {}", e))
}

#[tauri::command]
pub async fn get_font_details(
    file_path: String,
    font_index: u32,
) -> Result<crate::font::FontDetailedInfo, String> {
    tokio::task::spawn_blocking(move || {
        crate::font::FontParser::parse_details(&file_path, font_index)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
