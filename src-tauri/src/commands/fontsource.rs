use std::time::Duration;

const FONTSOURCE_METADATA_URL: &str = "https://api.fontsource.org/v1/fonts";

#[tauri::command]
pub async fn fetch_fontsource_metadata() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .gzip(true)
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let response = client
        .get(FONTSOURCE_METADATA_URL)
        .header("User-Agent", "FontFinder-Desktop/0.9.5")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Fontsource 메타데이터 요청 실패: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Fontsource 서버 응답 에러 (HTTP {})",
            response.status()
        ));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("Fontsource 메타데이터 본문 읽기 실패: {}", e))?;

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_fontsource_metadata() {
        let res = fetch_fontsource_metadata().await;
        match res {
            Ok(json) => {
                let parsed: Result<serde_json::Value, _> = serde_json::from_str(&json);
                assert!(parsed.is_ok(), "Fontsource 메타데이터가 올바른 JSON이어야 합니다");
                assert!(json.len() > 1000, "Fontsource 메타데이터 내용이 비어있지 않아야 합니다");
            }
            Err(e) => panic!("fetch_fontsource_metadata 실패: {}", e),
        }
    }
}
