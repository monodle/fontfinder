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

static IS_FOCUS_CHECKING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

struct FocusCheckGuard;
impl Drop for FocusCheckGuard {
    fn drop(&mut self) {
        IS_FOCUS_CHECKING.store(false, std::sync::atomic::Ordering::Release);
    }
}

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
            commands::update_set_position,
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
            commands::update_folder_position,
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

            // 창 포커스 복귀 시 백그라운드에서 발생한 연결 끊김 및 복구(외장 드라이브/폴더명 변경) 즉시 양방향 점검
            // 메인 UI 스레드 블로킹 방지 및 이전 점검 태스크 진행 중일 때의 중복 spawn 방어
            if let tauri::WindowEvent::Focused(true) = event {
                if let Some(state) = window.try_state::<commands::AppState>() {
                    if IS_FOCUS_CHECKING
                        .compare_exchange(
                            false,
                            true,
                            std::sync::atomic::Ordering::AcqRel,
                            std::sync::atomic::Ordering::Relaxed,
                        )
                        .is_ok()
                    {
                        let watcher_clone = Arc::clone(&state.watcher);
                        tauri::async_runtime::spawn(async move {
                            let _guard = FocusCheckGuard;
                            let _ = tokio::task::spawn_blocking(move || {
                                watcher::FontFolderWatcher::run_missing_check_cycle(&watcher_clone);
                                watcher::FontFolderWatcher::run_recover_cycle(&watcher_clone);
                            }).await;
                        });
                    }
                }
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

            // Windows 환경: USB/외장 드라이브 마운트(WM_DEVICECHANGE)를 실시간 수신하여 끊긴 폴더 자동 복구
            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
                use windows_sys::Win32::UI::WindowsAndMessaging::{WM_DEVICECHANGE, WM_NCDESTROY};
                use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};

                unsafe extern "system" fn subclass_proc(
                    hwnd: HWND,
                    msg: u32,
                    wparam: WPARAM,
                    lparam: LPARAM,
                    _uid_subclass: usize,
                    ref_data: usize,
                ) -> LRESULT {
                    if msg == WM_DEVICECHANGE {
                        // DBT_DEVICEARRIVAL (0x8000): 새 볼륨 마운트 발생
                        // DBT_DEVICEREMOVECOMPLETE (0x8004): 볼륨 언마운트 발생
                        if wparam == 0x8000 || wparam == 0x8004 {
                            // 마우스/키보드/블루투스 등 HID 장치 무관 이벤트 차단: 볼륨(드라이브) 이벤트만 선별
                            const DBT_DEVTYP_VOLUME: u32 = 0x00000002;
                            let is_volume_event = if lparam != 0 {
                                // 64KB 이하 가짜 포인터 및 4바이트 비정렬 주소 역참조 방어 (Access Violation 0xC0000005 차단)
                                if (lparam as usize) >= 0x10000 && (lparam as usize % 4 == 0) {
                                    unsafe {
                                        let dbch_size = *(lparam as *const u32);
                                        dbch_size >= 8 && *((lparam as *const u8).add(4) as *const u32) == DBT_DEVTYP_VOLUME
                                    }
                                } else {
                                    false
                                }
                            } else {
                                true
                            };

                            if is_volume_event {
                                let watcher_ptr = ref_data as *const std::sync::Mutex<watcher::FontFolderWatcher>;
                                if !watcher_ptr.is_null() {
                                    unsafe {
                                        std::sync::Arc::increment_strong_count(watcher_ptr);
                                    }
                                    let watcher_arc = unsafe { std::sync::Arc::from_raw(watcher_ptr) };
                                    tauri::async_runtime::spawn(async move {
                                        if wparam == 0x8000 {
                                            // USB/외장 볼륨 마운트 직후 OS 파일시스템 마운트 I/O 안정화 대기 (150ms)
                                            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                                            let _ = tokio::task::spawn_blocking(move || {
                                                watcher::FontFolderWatcher::run_recover_cycle(&watcher_arc);
                                            }).await;
                                        } else {
                                            let _ = tokio::task::spawn_blocking(move || {
                                                watcher::FontFolderWatcher::run_missing_check_cycle(&watcher_arc);
                                            }).await;
                                        }
                                    });
                                }
                            }
                        }
                    } else if msg == WM_NCDESTROY {
                        // 창 소멸 시 서브클래스 먼저 해제 후 Arc 힙 메모리 안전 회수
                        RemoveWindowSubclass(hwnd, Some(subclass_proc), 1001);
                        let watcher_ptr = ref_data as *mut std::sync::Mutex<watcher::FontFolderWatcher>;
                        if !watcher_ptr.is_null() {
                            drop(unsafe { Arc::from_raw(watcher_ptr) });
                        }
                    }
                    DefSubclassProc(hwnd, msg, wparam, lparam)
                }

                if let Some(main_window) = app.get_webview_window("main") {
                    if let Ok(hwnd) = main_window.hwnd() {
                        let watcher_clone = Arc::clone(&watcher);
                        let ref_data = Arc::into_raw(watcher_clone) as *const () as usize;
                        let success = unsafe {
                            SetWindowSubclass(hwnd.0 as _, Some(subclass_proc), 1001, ref_data)
                        };
                        if success == 0 {
                            eprintln!("[platform] Failed to set window subclass for device change notifications");
                            let watcher_ptr = ref_data as *mut std::sync::Mutex<watcher::FontFolderWatcher>;
                            if !watcher_ptr.is_null() {
                                drop(unsafe { Arc::from_raw(watcher_ptr) });
                            }
                        }
                    }
                }
            }

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
                    w.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Font Finder application");
}
