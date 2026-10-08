use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::db::ActivatedFontRecord;
use crate::platform::Platform;
use super::AppState;
use super::validation::validate_font_file_path;

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
            let path_buf = match validate_font_file_path(&r.file_path) {
                Ok(p) => p,
                Err(_) => {
                    missing_paths.push(r.file_path);
                    continue;
                }
            };

            if !path_buf.exists() || !path_buf.is_file() {
                let _ = Platform::deactivate_font_internal(&path_buf, false);
                missing_paths.push(r.file_path);
                continue;
            }

            if let Ok(meta) = std::fs::metadata(&path_buf) {
                if meta.len() == 0 || meta.len() > crate::protocol::MAX_FONT_FILE_SIZE {
                    let _ = Platform::deactivate_font_internal(&path_buf, false);
                    missing_paths.push(r.file_path);
                    continue;
                }
            } else {
                let _ = Platform::deactivate_font_internal(&path_buf, false);
                missing_paths.push(r.file_path);
                continue;
            }

            let mut header = [0u8; 4];
            let is_font = match std::fs::File::open(&path_buf).and_then(|mut f| std::io::Read::read_exact(&mut f, &mut header)) {
                Ok(_) => {
                    header == [0x00, 0x01, 0x00, 0x00]
                        || &header == b"OTTO"
                        || &header == b"ttcf"
                        || &header == b"true"
                        || &header == b"typ1"
                }
                Err(_) => false,
            };

            if !is_font {
                let _ = Platform::deactivate_font_internal(&path_buf, false);
                missing_paths.push(r.file_path);
                continue;
            }

            // 검증 완료된 유효 폰트만 OS 세션(CoreText / GDI)에 복원 등록
            let _ = Platform::activate_font_internal(&path_buf, false);
            valid_records.push(r);
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
