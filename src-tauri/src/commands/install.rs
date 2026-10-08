use std::path::PathBuf;
use tauri::State;

use crate::platform::Platform;
use super::AppState;
use super::validation::{
    contains_windows_reserved_device_name, is_dangerous_windows_namespace_or_unc,
    is_protected_system_path, validate_font_file_path,
};

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
pub async fn show_in_folder(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Err("ERR_PATH_EMPTY".to_string());
        }
        if trimmed.chars().any(|c| c.is_control() || c == '\0') {
            return Err("ERR_PATH_CONTROL_CHARS".to_string());
        }

        if is_dangerous_windows_namespace_or_unc(trimmed) {
            return Err("ERR_PATH_UNC_NOT_SUPPORTED".to_string());
        }

        let path_buf = PathBuf::from(trimmed);
        for component in path_buf.components() {
            if matches!(component, std::path::Component::ParentDir) {
                return Err("ERR_PATH_TRAVERSAL".to_string());
            }
        }

        if contains_windows_reserved_device_name(&path_buf) {
            return Err("ERR_PATH_RESERVED_DEVICE".to_string());
        }

        // 민감 시스템 경로 및 자격증명 폴더 접근 차단 (사전 검증)
        if is_protected_system_path(&path_buf) {
            return Err("ERR_PATH_PROTECTED_DIR".to_string());
        }

        let canonical_target = if path_buf.exists() {
            path_buf.canonicalize().map_err(|_| "ERR_PATH_NOT_FOUND".to_string())?
        } else if let Some(parent) = path_buf.parent() {
            if parent.exists() {
                parent.canonicalize().map_err(|_| "ERR_PATH_NOT_FOUND".to_string())?
            } else {
                return Err("ERR_PATH_NOT_FOUND".to_string());
            }
        } else {
            return Err("ERR_PATH_NOT_FOUND".to_string());
        };

        // 심볼릭 링크 해소 후 실제 물리 경로 기준 2차 보호 시스템 경로 차단
        if is_protected_system_path(&canonical_target) {
            return Err("ERR_PATH_PROTECTED_DIR".to_string());
        }

        #[cfg(target_os = "macos")]
        {
            let mut cmd = std::process::Command::new("/usr/bin/open");
            // 파일/디렉토리/앱 번들 무관하게 항상 Finder Reveal(-R) 강제 (임의 애플리케이션 번들 실행(RCE) 원천 차단)
            cmd.arg("-R");
            // POSIX 표준 옵션 종료 구분자로 대시(-)로 시작하는 경로의 CLI 플래그 오인식 방어
            cmd.arg("--");
            cmd.arg(&canonical_target);
            let status = cmd.status().map_err(|e| format!("ERR_EXPLORER_LAUNCH_FAILED: {}", e))?;
            if !status.success() {
                return Err("ERR_EXPLORER_LAUNCH_FAILED".to_string());
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
            cmd.spawn().map_err(|e| format!("ERR_EXPLORER_LAUNCH_FAILED: {}", e))?;
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
                .map_err(|e| format!("ERR_EXPLORER_LAUNCH_FAILED: {}", e))?;
            if !status.success() {
                return Err("ERR_EXPLORER_LAUNCH_FAILED".to_string());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
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
                errors.push(format!("{}: ERR_FONT_NOT_A_FILE", path));
                continue;
            }

            // 파일 크기 한도 검사
            let meta = match std::fs::metadata(&path_buf) {
                Ok(m) => m,
                Err(e) => {
                    errors.push(format!("{}: ERR_FONT_NOT_FOUND ({})", path, e));
                    continue;
                }
            };
            if meta.len() > crate::protocol::MAX_FONT_FILE_SIZE {
                errors.push(format!("{}: ERR_FONT_SIZE_EXCEEDED", path));
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
                errors.push(format!("{}: ERR_FONT_UNSUPPORTED_FORMAT", path));
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
            db_errors.push(format!("ERR_DB_CLEANUP_FAILED: {}", e));
        }
        if let Err(e) = state.db.delete_cached_fonts_by_paths(&deleted_paths) {
            eprintln!("[commands] Failed to delete cached fonts from DB: {}", e);
            db_errors.push(format!("ERR_DB_CLEANUP_FAILED: {}", e));
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
