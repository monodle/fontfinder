use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

use crate::db::FontSet;
use super::AppState;

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
pub async fn get_all_set_font_ids(state: State<'_, AppState>) -> Result<HashMap<i64, Vec<i64>>, String> {
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
