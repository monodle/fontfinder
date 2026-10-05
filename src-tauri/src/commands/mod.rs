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
            let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&p));
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
        let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
        let path_clone = path_buf.to_string_lossy().to_string();
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
    let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
    let path_norm = path_buf.to_string_lossy().to_string();
    tokio::task::spawn_blocking(move || {
        Platform::activate_font(&path_buf)
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = state.db.record_activated_font(font_id, &path_norm);
    Ok(())
}

#[tauri::command]
pub async fn deactivate_font(
    state: State<'_, AppState>,
    path: String,
    font_id: i64,
) -> Result<(), String> {
    let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
    tokio::task::spawn_blocking(move || {
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
        .map(|it| {
            let norm = crate::protocol::to_posix_normalized_path(std::path::Path::new(&it.path))
                .to_string_lossy()
                .to_string();
            (it.font_id, norm)
        })
        .collect::<Vec<_>>();

    let (count, success_items) = tokio::task::spawn_blocking(move || {
        let mut count = 0;
        let mut success = Vec::new();
        for (id, path) in raw_items {
            let path_buf = PathBuf::from(&path);
            // 대량 활성화 시 개별 브로드캐스트를 억제하여 시스템 프리징 방어
            if Platform::activate_font_internal(&path_buf, false).is_ok() {
                count += 1;
                success.push((id, path));
            }
        }
        if count > 0 {
            Platform::notify_font_change();
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
        .map(|it| {
            let norm = crate::protocol::to_posix_normalized_path(std::path::Path::new(&it.path))
                .to_string_lossy()
                .to_string();
            (it.font_id, norm)
        })
        .collect::<Vec<_>>();

    let (count, deactivated_ids) = tokio::task::spawn_blocking(move || {
        let mut count = 0;
        let mut deactivated = Vec::new();
        for (id, path) in raw_items {
            let path_buf = PathBuf::from(&path);
            // 대량 비활성화 시 개별 브로드캐스트를 억제하여 시스템 프리징 방어
            if Platform::deactivate_font_internal(&path_buf, false).is_ok() {
                count += 1;
                deactivated.push(id);
            }
        }
        if count > 0 {
            Platform::notify_font_change();
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
        let path_buf = PathBuf::from(&path);
        let target_str = if path_buf.exists() {
            path.clone()
        } else if let Some(parent) = path_buf.parent() {
            if parent.exists() {
                parent.to_string_lossy().to_string()
            } else {
                return Err("파일 또는 폴더가 존재하지 않습니다.".to_string());
            }
        } else {
            return Err("유효하지 않은 경로입니다.".to_string());
        };

        let target_path = PathBuf::from(&target_str);
        #[cfg(target_os = "macos")]
        {
            let mut cmd = std::process::Command::new("open");
            if target_path.is_file() {
                cmd.arg("-R");
            }
            // POSIX 표준 옵션 종료 구분자로 대시(-)로 시작하는 경로의 CLI 플래그 오인식 방어
            cmd.arg("--");
            let status = cmd.arg(&target_str).status().map_err(|e| format!("Finder 실행 실패: {}", e))?;
            if !status.success() {
                return Err("Finder에서 폴더/파일을 열지 못했습니다.".to_string());
            }
        }
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let clean_target = crate::protocol::to_windows_native_path(&PathBuf::from(&target_str));
            // 큰따옴표 제거로 explorer /select 인자 주입 방어 및 경로 구분자 정규화
            let win_target = clean_target.to_string_lossy().replace('\"', "");
            let mut cmd = std::process::Command::new("explorer");
            if target_path.is_file() {
                // Windows Explorer CLI 버그 방어: 경로에 쉼표(,)가 포함된 경우 /select 파싱 오류가 발생하므로
                // 오류 팝업 대신 부모 디렉토리를 안전하게 열도록 Fallback
                if win_target.contains(',') {
                    if let Some(parent) = target_path.parent() {
                        let clean_parent = crate::protocol::to_windows_native_path(parent);
                        let win_parent = clean_parent.to_string_lossy().replace('\"', "");
                        cmd.arg(&win_parent);
                    } else {
                        cmd.arg(&win_target);
                    }
                } else {
                    // Windows Explorer CLI 규칙: /select,"경로" (스위치 자체는 인용부호 바깥에 위치해야 함)
                    cmd.raw_arg(format!("/select,\"{}\"", win_target));
                }
            } else {
                cmd.arg(&win_target);
            }
            cmd.spawn().map_err(|e| format!("탐색기 실행 실패: {}", e))?;
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            // Linux: 파일인 경우 부모 디렉토리를 열어 사용자가 파일이 위치한 폴더를 볼 수 있도록 보정
            let open_target = if target_path.is_file() {
                target_path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or(target_str)
            } else {
                target_str
            };
            let status = std::process::Command::new("xdg-open")
                .arg(&open_target)
                .status()
                .map_err(|e| format!("파일 관리자 실행 실패: {}", e))?;
            if !status.success() {
                return Err("파일 관리자 프로세스 실행 실패".to_string());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatchInstallResult {
    pub installed: Vec<String>,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatchUninstallResult {
    pub deleted_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn install_fonts(paths: Vec<String>) -> Result<BatchInstallResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut installed = Vec::new();
        let mut errors = Vec::new();

        for path in paths {
            let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
            match Platform::install_font(&path_buf) {
                Ok(target) => installed.push(target.to_string_lossy().to_string()),
                Err(err) => errors.push(format!("{}: {}", path, err)),
            }
        }

        let failed_count = errors.len();
        if installed.is_empty() && failed_count > 0 {
            return Err(errors.join("; "));
        }

        Ok(BatchInstallResult {
            installed,
            failed_count,
            errors,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn uninstall_fonts(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<BatchUninstallResult, String> {
    let (deleted_count, deleted_paths, failed_count, errors) = tokio::task::spawn_blocking(move || {
        let mut deleted_count = 0;
        let mut deleted_paths = Vec::new();
        let mut errors = Vec::new();

        for path in paths {
            let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
            let norm_path_str = path_buf.to_string_lossy().to_string();
            match Platform::uninstall_font(&path_buf) {
                Ok(_) => {
                    deleted_count += 1;
                    deleted_paths.push(norm_path_str);
                }
                Err(err) => errors.push(format!("{}: {}", path, err)),
            }
        }

        let failed_count = errors.len();
        if deleted_count == 0 && failed_count > 0 {
            return Err(errors.join("; "));
        }

        Ok::<_, String>((deleted_count, deleted_paths, failed_count, errors))
    })
    .await
    .map_err(|e| e.to_string())??;

    if !deleted_paths.is_empty() {
        let _ = state.db.remove_activated_fonts_by_paths(&deleted_paths);
        let _ = state.db.delete_cached_fonts_by_paths(&deleted_paths);
    }

    Ok(BatchUninstallResult {
        deleted_count,
        failed_count,
        errors,
    })
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
    let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    watcher.watch(&path_buf)
}

#[tauri::command]
pub fn unwatch_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path));
    let mut watcher = state.watcher.lock().map_err(|e| e.to_string())?;
    watcher.unwatch(&path_buf)
}

// --- Watched Folders IPC ---
#[tauri::command]
pub fn get_folders(state: State<'_, AppState>) -> Result<Vec<DbFolder>, String> {
    state.db.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_folder(path: String, name: String, color: Option<String>, state: State<'_, AppState>) -> Result<DbFolder, String> {
    let norm_path = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path)).to_string_lossy().to_string();
    state.db.add_folder(&norm_path, &name, color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_folder_color(folder_id: i64, color: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_folder_color(folder_id, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let norm_path = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path)).to_string_lossy().to_string();
    state.db.remove_folder(&norm_path).map_err(|e| e.to_string())
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
pub async fn check_folders_status(state: State<'_, AppState>) -> Result<Vec<FolderStatus>, String> {
    let folders = state.db.get_folders().map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let mut statuses = Vec::with_capacity(folders.len());
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
        statuses
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())
    .map(Ok)?
}

#[tauri::command]
pub async fn relink_folder(
    state: State<'_, AppState>,
    old_path: String,
    new_path: String,
    new_name: Option<String>,
) -> Result<(), String> {
    let norm_old = crate::protocol::to_posix_normalized_path(std::path::Path::new(&old_path)).to_string_lossy().to_string();
    let norm_new = crate::protocol::to_posix_normalized_path(std::path::Path::new(&new_path)).to_string_lossy().to_string();
    let new_path_buf = PathBuf::from(&norm_new);
    if !new_path_buf.exists() || !new_path_buf.is_dir() {
        return Err("Target folder does not exist or is not a directory".to_string());
    }

    let name = new_name.unwrap_or_else(|| {
        new_path_buf
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&norm_new)
            .to_string()
    });

    let old_folder_buf = PathBuf::from(&norm_old);

    // 1. 구 경로 하위의 활성화된 폰트 수집 및 OS 해제 (개별 브로드캐스트 억제)
    let mut affected_activated_relpaths = Vec::new();
    if let Ok(activated) = state.db.get_activated_fonts() {
        for rec in activated {
            let font_buf = PathBuf::from(&rec.file_path);
            if crate::protocol::is_same_or_subpath(&old_folder_buf, &font_buf) {
                let _ = Platform::deactivate_font_internal(&font_buf, false);
                if let Ok(rel) = font_buf.strip_prefix(&old_folder_buf) {
                    affected_activated_relpaths.push(rel.to_path_buf());
                } else {
                    // Windows 대소문자 불일치 시 대소문자 무시 상대 경로 폴백
                    let font_str = font_buf.to_string_lossy().replace('\\', "/");
                    let old_str = old_folder_buf.to_string_lossy().replace('\\', "/");
                    let font_lower = font_str.to_lowercase();
                    let old_lower = old_str.trim_end_matches('/').to_lowercase();
                    if font_lower.starts_with(&format!("{}/", old_lower)) {
                        let rel_str = &font_str[old_lower.len() + 1..];
                        affected_activated_relpaths.push(PathBuf::from(rel_str));
                    }
                }
            }
        }
    }

    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.unwatch(&old_folder_buf);
    }

    // 2. DB 경로 갱신
    state
        .db
        .update_folder_path(&norm_old, &norm_new, &name)
        .map_err(|e| e.to_string())?;

    // 3. 신규 경로 기준으로 활성화 폰트 OS 재등록
    let mut re_activated_any = false;
    for rel in affected_activated_relpaths {
        let new_font_buf = new_path_buf.join(rel);
        if new_font_buf.exists() && Platform::activate_font_internal(&new_font_buf, false).is_ok() {
            re_activated_any = true;
        }
    }

    if re_activated_any {
        Platform::notify_font_change();
    }

    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.watch(&new_path_buf);
    }

    Ok(())
}

#[tauri::command]
pub fn remove_folder_with_data(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let norm_path = crate::protocol::to_posix_normalized_path(std::path::Path::new(&path)).to_string_lossy().to_string();
    let folder_buf = PathBuf::from(&norm_path);

    if let Ok(mut watcher) = state.watcher.lock() {
        let _ = watcher.unwatch(&folder_buf);
    }

    // 1. 해당 폴더 하위에 속한 활성화된 폰트들을 OS 레벨에서 사전 비활성화 (대량 브로드캐스트 억제)
    if let Ok(activated) = state.db.get_activated_fonts() {
        let mut deactivated_any = false;
        for rec in activated {
            let font_buf = PathBuf::from(&rec.file_path);
            if crate::protocol::is_same_or_subpath(&folder_buf, &font_buf) {
                if Platform::deactivate_font_internal(&font_buf, false).is_ok() {
                    deactivated_any = true;
                }
            }
        }
        if deactivated_any {
            Platform::notify_font_change();
        }
    }

    // 2. DB 및 연관 데이터 일괄 정리
    state
        .db
        .remove_folder_and_associated_data(&norm_path)
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
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        let records = db.get_activated_fonts().map_err(|e| e.to_string())?;
        let mut valid_records = Vec::new();
        let mut missing_paths = Vec::new();

        for r in records {
            let path = PathBuf::from(&r.file_path);
            if path.exists() && path.is_file() {
                // 앱 재시작/재부팅 후 증발된 OS 레벨(CoreText / GDI) 활성화 세션을 복원 등록
                let _ = Platform::activate_font_internal(&path, false);
                valid_records.push(r);
            } else {
                let _ = Platform::deactivate_font_internal(&path, false);
                missing_paths.push(r.file_path);
            }
        }

        if !missing_paths.is_empty() {
            let _ = db.remove_activated_fonts_by_paths(&missing_paths);
        }

        // 부재 폰트 정리 또는 유효 폰트 OS 복원 시 시스템 브로드캐스트 1회 일괄 통지
        if !valid_records.is_empty() || !missing_paths.is_empty() {
            Platform::notify_font_change();
        }

        Ok(valid_records)
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
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
    let db = Arc::clone(&state.db);
    let watcher = Arc::clone(&state.watcher);

    tokio::task::spawn_blocking(move || {
        // 1. 활성화된 폰트 시스템 일괄 비활성화 (브로드캐스트 1회 묶음 처리로 프리징 방어)
        if let Ok(records) = db.get_activated_fonts() {
            let mut deactivated_any = false;
            for r in records {
                let path = PathBuf::from(&r.file_path);
                if Platform::deactivate_font_internal(&path, false).is_ok() {
                    deactivated_any = true;
                }
            }
            if deactivated_any {
                Platform::notify_font_change();
            }
        }

        // 2. watcher에서 감시 중인 폴더 해제
        if let Ok(folders) = db.get_folders() {
            if let Ok(mut watcher_guard) = watcher.lock() {
                for f in folders {
                    let _ = watcher_guard.unwatch(&PathBuf::from(&f.path));
                }
            }
        }

        // 3. SQLite DB 완전 초기화
        db.reset_database().map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

#[derive(Debug, serde::Serialize)]
pub struct PathTypeInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub exists: bool,
}

#[tauri::command]
pub async fn check_paths(paths: Vec<String>) -> Result<Vec<PathTypeInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut results = Vec::with_capacity(paths.len());
        for p in paths {
            let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(&p));
            let exists = path_buf.exists();
            let is_dir = exists && path_buf.is_dir();
            let name = path_buf
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or(&p)
                .to_string();
            results.push(PathTypeInfo {
                path: path_buf.to_string_lossy().to_string(),
                name,
                is_dir,
                exists,
            });
        }
        results
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())
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
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::System::Com::{
                CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
            };
            use windows_sys::Win32::UI::Shell::ShellExecuteW;
            use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

            // Tokio 비동기 스레드 풀에서 STA COM 환경 초기화 보장
            let com_init = unsafe {
                CoInitializeEx(
                    std::ptr::null_mut(),
                    (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
                )
            };

            let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
            let url_wide: Vec<u16> = OsStr::new(&url_clone).encode_wide().chain(std::iter::once(0)).collect();

            let res = unsafe {
                ShellExecuteW(
                    std::ptr::null_mut(),
                    operation.as_ptr(),
                    url_wide.as_ptr(),
                    std::ptr::null(),
                    std::ptr::null(),
                    SW_SHOWNORMAL,
                )
            };

            if com_init >= 0 {
                unsafe {
                    CoUninitialize();
                }
            }

            // ShellExecuteW 성공 기준: 반환값 (HINSTANCE) > 32
            if (res as isize) <= 32 {
                return Err(format!("브라우저 실행 실패 (ShellExecuteW 오류 코드: {})", res as isize));
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
    let parent_dir = if let Some(parent) = path_buf.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("저장 대상 폴더가 존재하지 않습니다.".to_string());
        }
        parent.to_path_buf()
    } else {
        PathBuf::from(".")
    };

    // 파일시스템 원자적 교체(Atomic Write):
    // 동일 디렉토리에 고유 임시 파일(.tmp)을 생성하여 완전히 작성한 후 rename 교체
    let file_name = path_buf
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("backup.json");
    let random_suffix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_file_path = parent_dir.join(format!("{}.{}.tmp", file_name, random_suffix));

    if let Err(e) = tokio::fs::write(&temp_file_path, &content).await {
        let _ = tokio::fs::remove_file(&temp_file_path).await;
        return Err(format!("임시 백업 파일 저장 실패: {}", e));
    }

    // Windows 및 일반 파일시스템: 대상 파일이 이미 존재할 경우 쓰기 권한/읽기 전용 속성 해제
    if path_buf.exists() {
        if let Ok(meta) = tokio::fs::metadata(&path_buf).await {
            let mut perms = meta.permissions();
            if perms.readonly() {
                perms.set_readonly(false);
                let _ = tokio::fs::set_permissions(&path_buf, perms).await;
            }
        }
    }

    // 백신 실시간 감시나 시스템 인덱서의 일시 점유에 대응하여 지수 백오프 재시도 (최대 3회)
    let mut rename_result = tokio::fs::rename(&temp_file_path, &path_buf).await;
    if rename_result.is_err() {
        for attempt in 1..=3 {
            tokio::time::sleep(tokio::time::Duration::from_millis(attempt * 50)).await;
            rename_result = tokio::fs::rename(&temp_file_path, &path_buf).await;
            if rename_result.is_ok() {
                break;
            }
        }
    }

    if let Err(e) = rename_result {
        let _ = tokio::fs::remove_file(&temp_file_path).await;
        return Err(format!("백업 파일 원자적 교체 실패: {}", e));
    }

    Ok(())
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
