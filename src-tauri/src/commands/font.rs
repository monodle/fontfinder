use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::font::{FontDetailedInfo, FontMetadata, FontParser, FontScanner};
use crate::platform::Platform;
use super::AppState;
use super::validation::{
    contains_windows_reserved_device_name, is_dangerous_windows_namespace_or_unc,
    validate_folder_path,
};

#[tauri::command]
pub async fn get_cached_fonts(state: State<'_, AppState>) -> Result<Vec<FontMetadata>, String> {
    state.db.get_active_cached_fonts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_font_library(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    custom_paths: Vec<String>,
    force_rescan: Option<bool>,
) -> Result<Vec<FontMetadata>, String> {
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        let mut dirs = Platform::get_system_font_directories();
        for p in custom_paths {
            if let Ok(valid_path) = validate_folder_path(&p) {
                if !dirs.contains(&valid_path) {
                    dirs.push(valid_path);
                }
            } else {
                eprintln!("[security] Blocked invalid or protected custom path from sync: {}", p);
            }
        }

        db.cleanup_orphan_cached_fonts().map_err(|e| e.to_string())?;
        let app_handle = app.clone();
        let progress_cb = move |current: usize, total: usize| {
            use tauri::Emitter;
            let _ = app_handle.emit("font-scan-progress", serde_json::json!({
                "current": current,
                "total": total
            }));
        };

        FontScanner::sync_directories_with_options(
            &dirs,
            &db,
            true,
            force_rescan.unwrap_or(false),
            Some(&progress_cb),
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_directory(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
    force_rescan: Option<bool>,
) -> Result<Vec<FontMetadata>, String> {
    let valid_path = validate_folder_path(&path)?;
    let db = Arc::clone(&state.db);
    tokio::task::spawn_blocking(move || {
        let path_clone = valid_path.to_string_lossy().to_string();
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
        FontScanner::sync_directories_with_options(
            &[valid_path],
            &db,
            false,
            force_rescan.unwrap_or(false),
            Some(&progress_cb),
        )
        .map_err(|e| e.to_string())
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
pub async fn get_font_details(
    app: tauri::AppHandle,
    file_path: String,
    font_index: u32,
) -> Result<FontDetailedInfo, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("ERR_FONT_PATH_EMPTY".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == '\0') {
        return Err("ERR_PATH_CONTROL_CHARS".to_string());
    }

    if is_dangerous_windows_namespace_or_unc(trimmed) {
        return Err("ERR_PATH_UNC_NOT_SUPPORTED".to_string());
    }

    let raw_path = PathBuf::from(trimmed);
    for component in raw_path.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("ERR_PATH_TRAVERSAL".to_string());
        }
    }

    if contains_windows_reserved_device_name(&raw_path) {
        return Err("ERR_PATH_RESERVED_DEVICE".to_string());
    }

    let canonical_path = raw_path
        .canonicalize()
        .map_err(|_| "ERR_FONT_NOT_FOUND".to_string())?;

    if !canonical_path.is_file() {
        return Err("ERR_FONT_NOT_A_FILE".to_string());
    }

    // 허용된 폰트 경로(시스템 폰트, 감시 폴더, DB 캐시 등) 인가 검증
    if !crate::protocol::is_font_path_allowed(&canonical_path, Some(&app)) {
        return Err("ERR_FONT_UNAUTHORIZED_PATH".to_string());
    }

    // 지원 폰트 포맷 확장자 검증
    if crate::protocol::get_allowed_font_mime_type(&canonical_path).is_none() {
        return Err("ERR_FONT_UNSUPPORTED_FORMAT".to_string());
    }

    let canonical_clone = canonical_path.clone();
    tokio::task::spawn_blocking(move || {
        FontParser::parse_details(&canonical_clone, font_index)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
