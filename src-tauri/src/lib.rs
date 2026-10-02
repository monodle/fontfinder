pub mod commands;
pub mod db;
pub mod error;
pub mod font;
pub mod platform;
pub mod protocol;
pub mod watcher;
pub mod window_manager;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::SIZE,
                )
                .build(),
        )

        .register_uri_scheme_protocol("font", protocol::handle_font_protocol)
        .invoke_handler(tauri::generate_handler![
            commands::get_cached_fonts,
            commands::sync_font_library,
            commands::scan_directory,
            commands::activate_font,
            commands::deactivate_font,
            commands::activate_fonts,
            commands::deactivate_fonts,
            commands::show_in_folder,
            commands::install_fonts,
            commands::uninstall_fonts,
            commands::create_set,
            commands::update_set_color,
            commands::update_set,
            commands::update_set_parent,
            commands::get_sets,
            commands::delete_set,
            commands::add_font_to_set,
            commands::remove_font_from_set,
            commands::get_set_font_ids,
            commands::get_all_set_font_ids,
            commands::add_fonts_to_set_bulk,
            commands::remove_fonts_from_set_bulk,
            commands::toggle_favorite,
            commands::set_favorites_bulk,
            commands::get_favorite_font_ids,
            commands::watch_folder,
            commands::unwatch_folder,
            commands::get_folders,
            commands::add_folder,
            commands::update_folder_color,
            commands::remove_folder,
            commands::check_folders_status,
            commands::relink_folder,
            commands::remove_folder_with_data,
            commands::get_activated_fonts,
            commands::validate_and_cleanup_activated_fonts,
            commands::get_setting,
            commands::set_setting,
            commands::get_cached_fonts_by_hashes,
            commands::get_cached_fonts_by_ids,
            commands::get_system_theme,
            commands::set_window_theme,
            commands::reset_app_data,
            commands::check_paths,
            commands::open_external_url,
            commands::save_backup_file,
            commands::read_backup_file,
            commands::get_font_details,
        ])
        .on_window_event(|window, event| {
            if let Some(wm) = window.try_state::<Arc<window_manager::WindowManager>>() {
                wm.handle_window_event(window, event);
            }
        })
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./"));
            let db_path = app_data_dir.join("fontfinder.db");

            let database = Arc::new(
                db::Database::new(db_path).expect("Failed to initialize SQLite database"),
            );

            let watcher = watcher::FontFolderWatcher::new(app.handle().clone())
                .expect("Failed to initialize font folder watcher");

            if let Ok(folders) = database.get_folders() {
                if let Ok(mut w) = watcher.lock() {
                    for f in folders {
                        let _ = w.watch(&std::path::PathBuf::from(f.path));
                    }
                }
            }

            let window_manager = Arc::new(window_manager::WindowManager::new(Arc::clone(&database)));

            app.manage(commands::AppState {
                db: Arc::clone(&database),
                watcher,
            });
            app.manage(Arc::clone(&window_manager));

            if let Some(main_window) = app.get_webview_window("main") {
                window_manager.apply_initial_size(&main_window.as_ref().window());
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main");
                if let Some(w) = window {
                    let _ = w.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Font Finder application");
}
