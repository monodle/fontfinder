use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::db::DbFolder;
use crate::platform::Platform;
use super::AppState;
use super::validation::validate_folder_path;

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

    // 1. 이미 등록된 폴더인지 사전 확인 (불필요한 I/O 및 중복 write 차단)
    let exists = tokio::task::spawn_blocking({
        let db = Arc::clone(&db);
        let check_path = norm_path.clone();
        move || db.is_folder_exists(&check_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if exists {
        return Err("ERR_FOLDER_ALREADY_EXISTS".to_string());
    }

    // 2. 존재하지 않을 때만 신규 등록
    let res = tokio::task::spawn_blocking(move || {
        db.add_folder(&norm_path, &name, color.as_deref(), sort_order.as_deref()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    // 3. 와처 등록 및 캐시 무효화
    if let Ok(mut w) = state.watcher.lock() {
        let _ = w.watch(&norm_path_buf);
    }

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
