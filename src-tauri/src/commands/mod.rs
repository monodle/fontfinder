use std::path::{Path, PathBuf};
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
    let path_buf = validate_font_file_path(&path)?;
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
    let path_buf = validate_font_file_path(&path)?;
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
        .filter_map(|it| {
            validate_font_file_path(&it.path)
                .ok()
                .map(|p| (it.font_id, p.to_string_lossy().to_string()))
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
        .filter_map(|it| {
            validate_font_file_path(&it.path)
                .ok()
                .map(|p| (it.font_id, p.to_string_lossy().to_string()))
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
        let trimmed = path.trim();
        if trimmed.is_empty() || trimmed.chars().any(|c| c.is_control() || c == '\0') {
            return Err("유효하지 않은 경로 형식입니다.".to_string());
        }

        if is_dangerous_windows_namespace_or_unc(trimmed) {
            return Err("원격 네트워크(UNC) 및 디바이스 네임스페이스 경로는 지원하지 않습니다.".to_string());
        }

        let path_buf = PathBuf::from(trimmed);
        for component in path_buf.components() {
            if matches!(component, std::path::Component::ParentDir) {
                return Err("상위 디렉토리 순회 경로(`..`)는 허용되지 않습니다.".to_string());
            }
        }

        if contains_windows_reserved_device_name(&path_buf) {
            return Err("시스템 예약 장치명은 사용할 수 없습니다.".to_string());
        }

        let canonical_target = if path_buf.exists() {
            path_buf.canonicalize().map_err(|e| format!("경로 확인 실패: {}", e))?
        } else if let Some(parent) = path_buf.parent() {
            if parent.exists() {
                parent.canonicalize().map_err(|e| format!("폴더 확인 실패: {}", e))?
            } else {
                return Err("파일 또는 폴더가 존재하지 않습니다.".to_string());
            }
        } else {
            return Err("유효하지 않은 경로입니다.".to_string());
        };

        #[cfg(target_os = "macos")]
        {
            let mut cmd = std::process::Command::new("/usr/bin/open");
            if canonical_target.is_file() {
                cmd.arg("-R");
            }
            // POSIX 표준 옵션 종료 구분자로 대시(-)로 시작하는 경로의 CLI 플래그 오인식 방어
            cmd.arg("--");
            cmd.arg(&canonical_target);
            let status = cmd.status().map_err(|e| format!("Finder 실행 실패: {}", e))?;
            if !status.success() {
                return Err("Finder에서 폴더/파일을 열지 못했습니다.".to_string());
            }
        }
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;

            let clean_target = crate::protocol::to_windows_native_path(&canonical_target);
            // 큰따옴표 제거로 explorer /select 인자 주입 방어 및 경로 구분자 정규화
            let win_target = clean_target.to_string_lossy().replace('\"', "");
            let mut cmd = std::process::Command::new("explorer");
            if canonical_target.is_file() {
                // Windows Explorer CLI 버그 방어: 경로에 쉼표(,)가 포함된 경우 /select 파싱 오류가 발생하므로
                // 오류 팝업 대신 부모 디렉토리를 안전하게 열도록 Fallback
                if win_target.contains(',') {
                    if let Some(parent) = canonical_target.parent() {
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
            let open_target = if canonical_target.is_file() {
                canonical_target
                    .parent()
                    .unwrap_or(&canonical_target)
            } else {
                &canonical_target
            };
            let status = std::process::Command::new("xdg-open")
                .arg(open_target)
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
            let path_buf = match validate_font_file_path(&path) {
                Ok(p) => p,
                Err(e) => {
                    errors.push(format!("{}: {}", path, e));
                    continue;
                }
            };

            if !path_buf.exists() || !path_buf.is_file() {
                errors.push(format!("{}: 파일이 존재하지 않거나 디렉토리입니다.", path));
                continue;
            }

            // 파일 크기 한도 검사
            let meta = match std::fs::metadata(&path_buf) {
                Ok(m) => m,
                Err(e) => {
                    errors.push(format!("{}: 메타데이터 조회 실패 ({})", path, e));
                    continue;
                }
            };
            if meta.len() > crate::protocol::MAX_FONT_FILE_SIZE {
                errors.push(format!("{}: 허용 용량(100MB)을 초과했습니다.", path));
                continue;
            }

            // 매직 바이트 검증: 비-폰트 실행 파일 및 악성 스크립트 배포 차단
            let mut header = [0u8; 4];
            let is_valid_font = match std::fs::File::open(&path_buf).and_then(|mut f| std::io::Read::read_exact(&mut f, &mut header)) {
                Ok(_) => {
                    header == [0x00, 0x01, 0x00, 0x00]
                        || &header == b"OTTO"
                        || &header == b"ttcf"
                        || &header == b"true"
                        || &header == b"typ1"
                }
                Err(_) => false,
            };

            if !is_valid_font {
                errors.push(format!("{}: 유효한 폰트 바이너리가 아닙니다.", path));
                continue;
            }

            match Platform::install_font_internal(&path_buf, false) {
                Ok(target) => installed.push(target.to_string_lossy().to_string()),
                Err(err) => errors.push(format!("{}: {}", path, err)),
            }
        }

        let failed_count = errors.len();
        if installed.is_empty() && failed_count > 0 {
            return Err(errors.join("; "));
        }

        if !installed.is_empty() {
            Platform::notify_font_change();
            crate::protocol::invalidate_safe_path_cache();
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
            let path_buf = match validate_font_file_path(&path) {
                Ok(p) => p,
                Err(e) => {
                    errors.push(format!("{}: {}", path, e));
                    continue;
                }
            };
            let norm_path_str = path_buf.to_string_lossy().to_string();
            match Platform::uninstall_font_internal(&path_buf, false) {
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

        if deleted_count > 0 {
            Platform::notify_font_change();
        }

        Ok::<_, String>((deleted_count, deleted_paths, failed_count, errors))
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut db_errors = Vec::new();
    if !deleted_paths.is_empty() {
        if let Err(e) = state.db.remove_activated_fonts_by_paths(&deleted_paths) {
            eprintln!("[commands] Failed to remove activated fonts from DB: {}", e);
            db_errors.push(format!("활성화 폰트 DB 정리 실패: {}", e));
        }
        if let Err(e) = state.db.delete_cached_fonts_by_paths(&deleted_paths) {
            eprintln!("[commands] Failed to delete cached fonts from DB: {}", e);
            db_errors.push(format!("폰트 캐시 DB 정리 실패: {}", e));
        }
        crate::protocol::invalidate_safe_path_cache();
    }

    let mut final_errors = errors;
    final_errors.extend(db_errors);

    Ok(BatchUninstallResult {
        deleted_count,
        failed_count,
        errors: final_errors,
    })
}

// --- Sets IPC ---
#[tauri::command]
pub async fn create_set(
    name: String,
    color: Option<String>,
    parent_id: Option<i64>,
    sort_order: Option<String>,
    state: State<'_, AppState>,
) -> Result<FontSet, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.create_set(&name, color.as_deref(), parent_id, sort_order.as_deref()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_set_color(set_id: i64, color: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_set_color(set_id, &color).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_set(set_id: i64, name: String, color: String, parent_id: Option<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_set(set_id, &name, &color, parent_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_set_parent(set_id: i64, parent_id: Option<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_set_parent(set_id, parent_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_set_position(
    set_id: i64,
    parent_id: Option<i64>,
    sort_order: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_set_position(set_id, parent_id, &sort_order).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_sets(state: State<'_, AppState>) -> Result<Vec<FontSet>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_sets().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_set(set_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.delete_set(set_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_font_to_set(set_id: i64, font_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.add_font_to_set(set_id, font_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_font_from_set(set_id: i64, font_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.remove_font_from_set(set_id, font_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_set_font_ids(set_id: i64, state: State<'_, AppState>) -> Result<Vec<i64>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_set_font_ids(set_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_all_set_font_ids(state: State<'_, AppState>) -> Result<std::collections::HashMap<i64, Vec<i64>>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_all_set_font_ids().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_fonts_to_set_bulk(set_id: i64, font_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.add_fonts_to_set_bulk(set_id, &font_ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_fonts_from_set_bulk(set_id: i64, font_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.remove_fonts_from_set_bulk(set_id, &font_ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- Favorites IPC ---
#[tauri::command]
pub async fn toggle_favorite(font_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.toggle_favorite(font_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_favorites_bulk(font_ids: Vec<i64>, add: bool, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.set_favorites_bulk(&font_ids, add).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_favorite_font_ids(state: State<'_, AppState>) -> Result<Vec<i64>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_favorite_font_ids().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}


// --- Folder Watcher IPC ---
#[tauri::command]
pub async fn watch_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path_buf = validate_folder_path(&path)?;
    let watcher = Arc::clone(&state.watcher);
    tokio::task::spawn_blocking(move || {
        let mut w = watcher.lock().map_err(|e| e.to_string())?;
        w.watch(&path_buf)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn unwatch_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path_buf = validate_folder_path(&path)?;
    let watcher = Arc::clone(&state.watcher);
    tokio::task::spawn_blocking(move || {
        let mut w = watcher.lock().map_err(|e| e.to_string())?;
        w.unwatch(&path_buf)
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- Watched Folders IPC ---
#[tauri::command]
pub async fn get_folders(state: State<'_, AppState>) -> Result<Vec<DbFolder>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_folders().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_folder(
    path: String,
    name: String,
    color: Option<String>,
    sort_order: Option<String>,
    state: State<'_, AppState>,
) -> Result<DbFolder, String> {
    let norm_path_buf = validate_folder_path(&path)?;
    let norm_path = norm_path_buf.to_string_lossy().to_string();
    let db = Arc::clone(&state.db);
    let res = tokio::task::spawn_blocking(move || {
        db.add_folder(&norm_path, &name, color.as_deref(), sort_order.as_deref()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    crate::protocol::invalidate_safe_path_cache();
    Ok(res)
}

#[tauri::command]
pub async fn update_folder_color(folder_id: i64, color: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_folder_color(folder_id, &color).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_folder_position(
    folder_id: Option<i64>,
    path: Option<String>,
    sort_order: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let norm_path = path.map(|p| crate::protocol::to_posix_normalized_path(std::path::Path::new(&p)).to_string_lossy().to_string());
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.update_folder_position(folder_id, norm_path.as_deref(), &sort_order).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let norm_path_buf = validate_folder_path(&path)?;
    let norm_path = norm_path_buf.to_string_lossy().to_string();
    let db = Arc::clone(&state.db);
    let res = tokio::task::spawn_blocking(move || {
        db.remove_folder(&norm_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    crate::protocol::invalidate_safe_path_cache();
    Ok(res)
}

#[derive(Debug, serde::Serialize)]
pub struct FolderStatus {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub color: String,
    pub exists: bool,
    pub sort_order: String,
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
                sort_order: f.sort_order,
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
    let norm_new_buf = validate_folder_path(&new_path)?;
    let norm_new = norm_new_buf.to_string_lossy().to_string();
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

    let db = Arc::clone(&state.db);
    let watcher = Arc::clone(&state.watcher);

    tokio::task::spawn_blocking(move || {
        let old_folder_buf = PathBuf::from(&norm_old);

        // 1. 구 경로 하위의 활성화된 폰트 수집 및 OS 해제 (개별 브로드캐스트 억제)
        let mut affected_activated_relpaths = Vec::new();
        let mut affected_activated_fullpaths = Vec::new();
        if let Ok(activated) = db.get_activated_fonts() {
            for rec in activated {
                let font_buf = PathBuf::from(&rec.file_path);
                if crate::protocol::is_same_or_subpath(&old_folder_buf, &font_buf) {
                    let _ = Platform::deactivate_font_internal(&font_buf, false);
                    affected_activated_fullpaths.push(font_buf.clone());
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

        if let Ok(mut w) = watcher.lock() {
            let _ = w.unwatch(&old_folder_buf);
        }

        // 2. DB 경로 갱신 시도 및 실패 시 원자적 롤백(보상 트랜잭션)
        if let Err(err) = db.update_folder_path(&norm_old, &norm_new, &name) {
            // [롤백]: 구 경로 폰트 재활성화 및 구 와처 복원
            for old_font in affected_activated_fullpaths {
                let _ = Platform::activate_font_internal(&old_font, false);
            }
            Platform::notify_font_change();
            if let Ok(mut w) = watcher.lock() {
                let _ = w.watch(&old_folder_buf);
            }
            return Err(err.to_string());
        }

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

        if let Ok(mut w) = watcher.lock() {
            let _ = w.watch(&new_path_buf);
        }

        crate::protocol::invalidate_safe_path_cache();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_folder_with_data(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let norm_path_buf = validate_folder_path(&path)?;
    let norm_path = norm_path_buf.to_string_lossy().to_string();
    let folder_buf = PathBuf::from(&norm_path);
    let watcher = Arc::clone(&state.watcher);
    let db = Arc::clone(&state.db);

    tokio::task::spawn_blocking(move || {
        if let Ok(mut w) = watcher.lock() {
            let _ = w.unwatch(&folder_buf);
        }

        // 1. 해당 폴더 하위에 속한 활성화된 폰트들을 OS 레벨에서 사전 비활성화 (대량 브로드캐스트 억제)
        if let Ok(activated) = db.get_activated_fonts() {
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
        let res = db
            .remove_folder_and_associated_data(&norm_path)
            .map_err(|e| e.to_string());

        crate::protocol::invalidate_safe_path_cache();
        res
    })
    .await
    .map_err(|e| e.to_string())?
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
pub async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_setting(&key).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.set_setting(&key, &value).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_cached_fonts_by_hashes(
    hashes: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<FontMetadata>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_cached_fonts_by_hashes(&hashes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_cached_fonts_by_ids(
    ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<FontMetadata>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        db.get_cached_fonts_by_ids(&ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
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
        crate::protocol::invalidate_safe_path_cache();

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
            let trimmed = p.trim();
            if trimmed.is_empty()
                || trimmed.chars().any(|c| c.is_control() || c == '\0')
                || is_dangerous_windows_namespace_or_unc(trimmed)
            {
                results.push(PathTypeInfo {
                    path: p.clone(),
                    name: p,
                    is_dir: false,
                    exists: false,
                });
                continue;
            }

            let path_buf = crate::protocol::to_posix_normalized_path(std::path::Path::new(trimmed));
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

    // URL 내 제어 문자 및 CLI 인자 인젝션/쉘 조작 위험 문자 원천 차단
    if trimmed.chars().any(|c| c.is_control() || c == '\0' || c == '\"' || c == '\'' || c == ' ' || c == '<' || c == '>') {
        return Err("URL에 유효하지 않거나 위험한 문자가 포함되어 있습니다.".to_string());
    }

    // 최소 호스트 형식 검증 (http:// 또는 https:// 바로 뒤에 유효한 도메인/IP가 존재해야 함)
    let rest = if let Some(r) = trimmed.strip_prefix("https://") {
        r
    } else {
        trimmed.strip_prefix("http://").unwrap_or("")
    };
    let host_part = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host_part.is_empty() || host_part.starts_with('.') || host_part.ends_with('.') {
        return Err("유효하지 않은 URL 호스트 형식입니다.".to_string());
    }

    let url_clone = trimmed.to_string();
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        {
            let status = std::process::Command::new("open")
                .arg("--")
                .arg(&url_clone)
                .status()
                .or_else(|_| {
                    std::process::Command::new("/usr/bin/open")
                        .arg("--")
                        .arg(&url_clone)
                        .status()
                })
                .map_err(|e| format!("URL 열기 실패: {}", e))?;
            if !status.success() {
                return Err("브라우저 프로세스 실행 실패".to_string());
            }
            Ok(())
        }
        #[cfg(target_os = "windows")]
        {
            // Tokio 스레드 풀의 MTA 오염 방지를 위해 전용 STA 스레드에서 안전하게 ShellExecuteW 실행
            let (tx, rx) = std::sync::mpsc::channel();
            let url_for_thread = url_clone.clone();
            std::thread::spawn(move || {
                use std::ffi::OsStr;
                use std::os::windows::ffi::OsStrExt;
                use windows_sys::Win32::System::Com::{
                    CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
                };
                use windows_sys::Win32::UI::Shell::ShellExecuteW;
                use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

                let com_init = unsafe {
                    CoInitializeEx(
                        std::ptr::null_mut(),
                        (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
                    )
                };

                let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
                let url_wide: Vec<u16> = OsStr::new(&url_for_thread).encode_wide().chain(std::iter::once(0)).collect();

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

                if (res as usize) <= 32 {
                    let _ = tx.send(Err(format!("브라우저 실행 실패 (ShellExecuteW 오류 코드: {})", res as usize)));
                } else {
                    let _ = tx.send(Ok(()));
                }
            });
            rx.recv().unwrap_or_else(|_| Err("스레드 채널 통신 실패".to_string()))
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
            Ok(())
        }
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[inline]
pub fn is_dangerous_windows_namespace_or_unc(trimmed: &str) -> bool {
    crate::protocol::is_dangerous_windows_namespace_or_unc(trimmed)
}

fn is_protected_system_path(path: &Path) -> bool {
    let posix = crate::protocol::to_posix_normalized_path(path);
    let s = posix.to_string_lossy().to_lowercase();

    // Unix / macOS 루트 시스템 디렉터리 접근 차단
    let unix_protected = [
        "/etc", "/bin", "/sbin", "/usr", "/var", "/dev", "/proc", "/sys", "/boot", "/root",
        "/system", "/library",
    ];
    for p in unix_protected {
        if s == p || s.starts_with(&format!("{}/", p)) {
            return true;
        }
    }

    // Windows 시스템 폴더 접근 차단 (크로스 플랫폼 공통 방어)
    let win_protected = [
        "c:/windows", "c:/program files", "c:/program files (x86)",
    ];
    for wp in win_protected {
        if s == wp || s.starts_with(&format!("{}/", wp)) {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(windir) = std::env::var("SystemRoot").or_else(|_| std::env::var("WINDIR")) {
            let win_norm = crate::protocol::to_posix_normalized_path(Path::new(&windir)).to_string_lossy().to_lowercase();
            if s == win_norm || s.starts_with(&format!("{}/", win_norm)) {
                return true;
            }
        }
    }

    false
}

fn contains_windows_reserved_device_name(path: &Path) -> bool {
    for component in path.components() {
        if let std::path::Component::Normal(os_name) = component {
            let name = os_name.to_string_lossy().to_uppercase();
            let stem = name.split('.').next().unwrap_or(&name);
            if WINDOWS_RESERVED_NAMES.contains(&stem) {
                return true;
            }
        }
    }
    false
}

fn validate_folder_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("폴더 경로가 비어 있습니다.".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == '\0') {
        return Err("경로에 유효하지 않은 제어 문자가 포함되어 있습니다.".to_string());
    }

    if is_dangerous_windows_namespace_or_unc(trimmed) {
        return Err("원격 네트워크(UNC) 및 디바이스 네임스페이스 경로는 지원하지 않습니다.".to_string());
    }

    let path_buf = PathBuf::from(trimmed);
    for component in path_buf.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("상위 디렉토리 순회 경로(`..`)는 허용되지 않습니다.".to_string());
        }
    }

    if is_protected_system_path(&path_buf) {
        return Err("운영체제 시스템 보호 디렉터리는 감시 폴더로 등록할 수 없습니다.".to_string());
    }

    if contains_windows_reserved_device_name(&path_buf) {
        return Err("시스템 예약 장치명은 사용할 수 없습니다.".to_string());
    }

    let posix = crate::protocol::to_posix_normalized_path(&path_buf);
    let posix_str = posix.to_string_lossy();
    if posix_str == "/" || (posix_str.len() == 3 && posix_str.ends_with(":/")) {
        return Err("루트 드라이브 전체는 감시 폴더로 등록할 수 없습니다. 하위 폴더를 지정해주세요.".to_string());
    }

    Ok(posix)
}

fn validate_backup_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("백업 파일 경로가 비어 있습니다.".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == '\0') {
        return Err("경로에 유효하지 않은 제어 문자가 포함되어 있습니다.".to_string());
    }

    if is_dangerous_windows_namespace_or_unc(trimmed) {
        return Err("원격 네트워크(UNC) 및 디바이스 네임스페이스 경로는 지원하지 않습니다.".to_string());
    }

    let path_buf = PathBuf::from(trimmed);
    for component in path_buf.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("상위 디렉토리 순회 경로(`..`)는 허용되지 않습니다.".to_string());
        }
    }

    if is_protected_system_path(&path_buf) {
        return Err("시스템 보호 디렉터리 경로는 접근할 수 없습니다.".to_string());
    }

    if contains_windows_reserved_device_name(&path_buf) {
        return Err("시스템 예약 장치명은 사용할 수 없습니다.".to_string());
    }

    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if ext != "json" {
        return Err("백업 파일은 반드시 `.json` 확장자여야 합니다.".to_string());
    }

    Ok(path_buf)
}

pub fn validate_font_file_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("폰트 파일 경로가 비어 있습니다.".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == '\0') {
        return Err("경로에 유효하지 않은 제어 문자가 포함되어 있습니다.".to_string());
    }

    if is_dangerous_windows_namespace_or_unc(trimmed) {
        return Err("원격 네트워크(UNC) 및 디바이스 네임스페이스 경로는 지원하지 않습니다.".to_string());
    }

    let path_buf = PathBuf::from(trimmed);
    for component in path_buf.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("상위 디렉토리 순회 경로(`..`)는 허용되지 않습니다.".to_string());
        }
    }

    if contains_windows_reserved_device_name(&path_buf) {
        return Err("시스템 예약 장치명은 사용할 수 없습니다.".to_string());
    }

    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if !["ttf", "otf", "ttc", "woff", "woff2"].contains(&ext.as_str()) {
        return Err("허용되지 않은 서체 확장자입니다.".to_string());
    }

    Ok(crate::protocol::to_posix_normalized_path(&path_buf))
}

struct TempFileGuard {
    path: PathBuf,
    active: bool,
}

impl TempFileGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, active: true }
    }

    fn disarm(&mut self) {
        self.active = false;
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.active && self.path.exists() {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[tauri::command]
pub async fn save_backup_file(path: String, content: String) -> Result<(), String> {
    let path_buf = validate_backup_path(&path)?;

    if content.len() as u64 > MAX_BACKUP_SIZE_BYTES {
        return Err("백업 데이터 크기가 20MB를 초과하여 저장할 수 없습니다.".to_string());
    }

    // 백업 파일 데이터 무결성 검증: 깨진 텍스트나 비-JSON 데이터 저장 선제 차단
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("백업 데이터가 올바른 JSON 형식이 아닙니다: {}", e))?;

    let parent_dir = if let Some(parent) = path_buf.parent() {
        if !parent.as_os_str().is_empty() {
            if !parent.exists() {
                return Err("저장 대상 폴더가 존재하지 않습니다.".to_string());
            }
            parent.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
        }
    } else {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    };

    // 파일시스템 원자적 교체(Atomic Write):
    // 동일 디렉토리에 배타적 플래그(create_new)로 고유 임시 파일(.tmp)을 생성하여 TOCTOU / Symlink Race 방어
    let file_name = path_buf
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("backup.json");
    let random_suffix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_file_path = parent_dir.join(format!("{}.{}.tmp", file_name, random_suffix));

    // RAII 가드 등록 (실패/패닉/에러 시 즉시 안전 회수)
    let mut guard = TempFileGuard::new(temp_file_path.clone());

    use tokio::io::AsyncWriteExt;
    let mut temp_file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_file_path)
        .await
        .map_err(|e| format!("임시 백업 파일 배타적 생성 실패: {}", e))?;

    if let Err(e) = temp_file.write_all(content.as_bytes()).await {
        return Err(format!("임시 백업 파일 쓰기 실패: {}", e));
    }
    if let Err(e) = temp_file.flush().await {
        return Err(format!("임시 백업 파일 플러시 실패: {}", e));
    }
    drop(temp_file);

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

    // 백신 실시간 감시나 시스템 인덱서의 일시 점유에 대응하여 지수 백오프 재시도 (최대 5회)
    let mut rename_result = tokio::fs::rename(&temp_file_path, &path_buf).await;
    if rename_result.is_err() {
        for attempt in 1..=5 {
            tokio::time::sleep(tokio::time::Duration::from_millis(attempt * 60)).await;
            rename_result = tokio::fs::rename(&temp_file_path, &path_buf).await;
            if rename_result.is_ok() {
                break;
            }
        }
    }

    if let Err(e) = rename_result {
        return Err(format!("백업 파일 원자적 교체 실패: {}", e));
    }

    // 파일 교체 성공 확정 시 가드 해제
    guard.disarm();
    Ok(())
}

#[tauri::command]
pub async fn read_backup_file(path: String) -> Result<String, String> {
    let path_buf = validate_backup_path(&path)?;

    if !path_buf.exists() || !path_buf.is_file() {
        return Err("유효한 백업 파일이 존재하지 않습니다.".to_string());
    }

    let canonical_path = path_buf
        .canonicalize()
        .map_err(|e| format!("파일 경로 확인 실패: {}", e))?;

    if !canonical_path.is_file() {
        return Err("지정된 대상이 일반 파일이 아닙니다.".to_string());
    }

    let metadata = tokio::fs::metadata(&canonical_path)
        .await
        .map_err(|e| format!("파일 정보 조회 실패: {}", e))?;

    if metadata.len() > MAX_BACKUP_SIZE_BYTES {
        return Err("백업 파일 크기가 20MB를 초과하여 불러올 수 없습니다.".to_string());
    }

    tokio::fs::read_to_string(&canonical_path)
        .await
        .map_err(|e| format!("백업 파일 읽기 실패: {}", e))
}

#[tauri::command]
pub async fn get_font_details(
    app: tauri::AppHandle,
    file_path: String,
    font_index: u32,
) -> Result<crate::font::FontDetailedInfo, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("폰트 파일 경로가 비어 있습니다.".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == '\0') {
        return Err("경로에 유효하지 않은 제어 문자가 포함되어 있습니다.".to_string());
    }

    if is_dangerous_windows_namespace_or_unc(trimmed) {
        return Err("원격 네트워크(UNC) 및 디바이스 네임스페이스 경로는 지원하지 않습니다.".to_string());
    }

    let raw_path = PathBuf::from(trimmed);
    for component in raw_path.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("상위 디렉토리 순회 경로(`..`)는 허용되지 않습니다.".to_string());
        }
    }

    if contains_windows_reserved_device_name(&raw_path) {
        return Err("시스템 예약 장치명은 사용할 수 없습니다.".to_string());
    }

    let canonical_path = raw_path
        .canonicalize()
        .map_err(|e| format!("폰트 파일이 존재하지 않거나 접근할 수 없습니다: {}", e))?;

    if !canonical_path.is_file() {
        return Err("지정된 대상이 일반 파일이 아닙니다.".to_string());
    }

    // 허용된 폰트 경로(시스템 폰트, 감시 폴더, DB 캐시 등) 인가 검증
    if !crate::protocol::is_font_path_allowed(&canonical_path, Some(&app)) {
        return Err("인가되지 않은 폰트 파일 경로입니다.".to_string());
    }

    // 지원 폰트 포맷 확장자 검증
    if crate::protocol::get_allowed_font_mime_type(&canonical_path).is_none() {
        return Err("지원하지 않는 폰트 파일 형식입니다.".to_string());
    }

    let canonical_clone = canonical_path.clone();
    tokio::task::spawn_blocking(move || {
        crate::font::FontParser::parse_details(&canonical_clone, font_index)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_backup_path_valid() {
        let path = "backup.json";
        assert!(validate_backup_path(path).is_ok());

        let path_upper = "DATA.JSON";
        assert!(validate_backup_path(path_upper).is_ok());

        let sub_path = "nested/folder/export.json";
        assert!(validate_backup_path(sub_path).is_ok());
    }

    #[test]
    fn test_validate_backup_path_rejects_non_json() {
        assert!(validate_backup_path("script.sh").is_err());
        assert!(validate_backup_path("payload.bat").is_err());
        assert!(validate_backup_path("program.exe").is_err());
        assert!(validate_backup_path("backup.json.bak").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_traversal() {
        assert!(validate_backup_path("../backup.json").is_err());
        assert!(validate_backup_path("dir/../../secret.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_unc_and_namespaces() {
        assert!(validate_backup_path(r"\\attacker\share\backup.json").is_err());
        assert!(validate_backup_path("//attacker/share/backup.json").is_err());
        assert!(validate_backup_path(r"\\?\UNC\attacker\share\backup.json").is_err());
        assert!(validate_backup_path(r"\??\UNC\attacker\share\backup.json").is_err());
        assert!(validate_backup_path(r"\\?\C:\Windows\backup.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_windows_reserved() {
        assert!(validate_backup_path("CON.json").is_err());
        assert!(validate_backup_path("prn.JSON").is_err());
        assert!(validate_backup_path("folder/aux.json").is_err());
        assert!(validate_backup_path("NUL.json").is_err());
        assert!(validate_backup_path("COM1.json").is_err());
        assert!(validate_backup_path("lpt1.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_invalid_chars() {
        assert!(validate_backup_path("").is_err());
        assert!(validate_backup_path("   ").is_err());
        assert!(validate_backup_path("backup\0.json").is_err());
        assert!(validate_backup_path("backup\n.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_protected_system_paths() {
        assert!(validate_backup_path("/etc/config.json").is_err());
        assert!(validate_backup_path("/System/Library/Fonts/meta.json").is_err());
        assert!(validate_backup_path("/usr/local/bin/backup.json").is_err());
        assert!(validate_backup_path(r"C:\Windows\System32\drivers.json").is_err());
    }

    #[test]
    fn test_validate_folder_path_valid() {
        let valid1 = "/Users/username/Fonts";
        assert!(validate_folder_path(valid1).is_ok());

        let valid2 = r"D:\Creative\Fonts";
        assert!(validate_folder_path(valid2).is_ok());
    }

    #[test]
    fn test_validate_folder_path_rejects_dangerous() {
        // System and root directories
        assert!(validate_folder_path("/").is_err());
        assert!(validate_folder_path("C:/").is_err());
        assert!(validate_folder_path("c:").is_err());
        assert!(validate_folder_path("/etc").is_err());
        assert!(validate_folder_path("/usr/bin").is_err());
        assert!(validate_folder_path(r"C:\Windows").is_err());
        assert!(validate_folder_path(r"C:\Program Files").is_err());

        // Traversal and UNC
        assert!(validate_folder_path("../Fonts").is_err());
        assert!(validate_folder_path(r"\\attacker\share").is_err());
        assert!(validate_folder_path(r"\\?\C:\Fonts").is_err());

        // Control characters and empty
        assert!(validate_folder_path("").is_err());
        assert!(validate_folder_path("   ").is_err());
        assert!(validate_folder_path("Fonts\0").is_err());

        // Windows reserved devices
        assert!(validate_folder_path("CON").is_err());
        assert!(validate_folder_path("folder/NUL").is_err());
    }

    #[test]
    fn test_remove_folder_validation_rejects_root_and_traversal() {
        // remove_folder/unwatch_folder에 루트 또는 상위 경로 전달 시 validate_folder_path에 의해 선제 차단 검증
        assert!(validate_folder_path("/").is_err());
        assert!(validate_folder_path("C:/").is_err());
        assert!(validate_folder_path("../").is_err());
        assert!(validate_folder_path(r"\\attacker\share").is_err());
    }

    #[test]
    fn test_validate_font_file_path() {
        // Valid font extensions
        assert!(validate_font_file_path("/Library/Fonts/Arial.ttf").is_ok());
        assert!(validate_font_file_path(r"C:\Windows\Fonts\malgun.ttf").is_ok());
        assert!(validate_font_file_path("/path/to/font.otf").is_ok());
        assert!(validate_font_file_path("/path/to/font.ttc").is_ok());
        assert!(validate_font_file_path("/path/to/font.woff2").is_ok());

        // Dangerous or non-font paths
        assert!(validate_font_file_path("").is_err());
        assert!(validate_font_file_path(r"\\evil\share\font.ttf").is_err());
        assert!(validate_font_file_path("../font.ttf").is_err());
        assert!(validate_font_file_path("font.exe").is_err());
        assert!(validate_font_file_path("document.pdf").is_err());
        assert!(validate_font_file_path("script.sh").is_err());
        assert!(validate_font_file_path("CON.ttf").is_err());
    }
}


