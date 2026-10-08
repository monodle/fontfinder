use std::sync::Arc;
use tauri::State;

use super::AppState;

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
