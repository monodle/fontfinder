use crate::network;

#[tauri::command]
pub async fn check_network_connectivity() -> Result<bool, String> {
    // 논블로킹 tokio::task::spawn_blocking으로 소켓 검증 실행
    let is_connected = tokio::task::spawn_blocking(network::check_internet_connectivity)
        .await
        .map_err(|e| format!("네트워크 상태 확인 태스크 실행 실패: {}", e))?;

    Ok(is_connected)
}
