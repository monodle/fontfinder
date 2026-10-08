use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::platform::Platform;
use super::AppState;
use super::validation::is_dangerous_windows_namespace_or_unc;

#[derive(Debug, serde::Serialize)]
pub struct PathTypeInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub exists: bool,
}

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

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("ERR_URL_INVALID_SCHEME".to_string());
    }

    // URL 내 제어 문자 및 CLI 인자 인젝션/쉘 조작 위험 문자 원천 차단
    if trimmed.chars().any(|c| c.is_control() || c == '\0' || c == '\"' || c == '\'' || c == ' ' || c == '<' || c == '>') {
        return Err("ERR_URL_DANGEROUS_CHARS".to_string());
    }

    // 최소 호스트 형식 검증 (http:// 또는 https:// 바로 뒤에 유효한 도메인/IP가 존재해야 함)
    let rest = if let Some(r) = trimmed.strip_prefix("https://") {
        r
    } else {
        trimmed.strip_prefix("http://").unwrap_or("")
    };
    let host_part = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host_part.is_empty() || host_part.starts_with('.') || host_part.ends_with('.') {
        return Err("ERR_URL_INVALID_HOST".to_string());
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
                .map_err(|e| format!("ERR_BROWSER_LAUNCH_FAILED: {}", e))?;
            if !status.success() {
                return Err("ERR_BROWSER_LAUNCH_FAILED".to_string());
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
                    let _ = tx.send(Err(format!("ERR_BROWSER_LAUNCH_FAILED: ShellExecuteW code {}", res as usize)));
                } else {
                    let _ = tx.send(Ok(()));
                }
            });
            rx.recv().unwrap_or_else(|_| Err("ERR_BROWSER_LAUNCH_FAILED".to_string()))
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            let status = std::process::Command::new("xdg-open")
                .arg(&url_clone)
                .status()
                .map_err(|e| format!("ERR_BROWSER_LAUNCH_FAILED: {}", e))?;
            if !status.success() {
                return Err("ERR_BROWSER_LAUNCH_FAILED".to_string());
            }
            Ok(())
        }
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}
