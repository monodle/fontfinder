use std::path::PathBuf;
use tokio::io::AsyncWriteExt;

use super::validation::{validate_backup_path, TempFileGuard};

pub const MAX_BACKUP_SIZE_BYTES: u64 = 20 * 1024 * 1024; // 20 MB

#[tauri::command]
pub async fn save_backup_file(path: String, content: String) -> Result<(), String> {
    let path_buf = validate_backup_path(&path)?;

    if content.len() as u64 > MAX_BACKUP_SIZE_BYTES {
        return Err("ERR_BACKUP_SIZE_EXCEEDED".to_string());
    }

    // 백업 파일 데이터 무결성 검증: 깨진 텍스트나 비-JSON 데이터 저장 선제 차단
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|_| "ERR_BACKUP_INVALID_JSON".to_string())?;

    let parent_dir = if let Some(parent) = path_buf.parent() {
        if !parent.as_os_str().is_empty() {
            if !parent.exists() {
                return Err("ERR_BACKUP_DEST_NOT_FOUND".to_string());
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

    let mut temp_file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_file_path)
        .await
        .map_err(|_| "ERR_BACKUP_WRITE_FAILED".to_string())?;

    if let Err(_) = temp_file.write_all(content.as_bytes()).await {
        return Err("ERR_BACKUP_WRITE_FAILED".to_string());
    }
    if let Err(_) = temp_file.flush().await {
        return Err("ERR_BACKUP_WRITE_FAILED".to_string());
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

    if let Err(_) = rename_result {
        return Err("ERR_BACKUP_REPLACE_FAILED".to_string());
    }

    // 파일 교체 성공 확정 시 가드 해제
    guard.disarm();
    Ok(())
}

#[tauri::command]
pub async fn read_backup_file(path: String) -> Result<String, String> {
    let path_buf = validate_backup_path(&path)?;

    if !path_buf.exists() || !path_buf.is_file() {
        return Err("ERR_BACKUP_NOT_FOUND".to_string());
    }

    let canonical_path = path_buf
        .canonicalize()
        .map_err(|_| "ERR_BACKUP_NOT_FOUND".to_string())?;

    if !canonical_path.is_file() {
        return Err("ERR_BACKUP_NOT_A_FILE".to_string());
    }

    let metadata = tokio::fs::metadata(&canonical_path)
        .await
        .map_err(|_| "ERR_BACKUP_READ_FAILED".to_string())?;

    if metadata.len() > MAX_BACKUP_SIZE_BYTES {
        return Err("ERR_BACKUP_SIZE_EXCEEDED".to_string());
    }

    tokio::fs::read_to_string(&canonical_path)
        .await
        .map_err(|_| "ERR_BACKUP_READ_FAILED".to_string())
}
