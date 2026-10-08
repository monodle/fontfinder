use std::time::Duration;

const GOOGLE_FONTS_METADATA_URL: &str = "https://fonts.google.com/metadata/fonts";

#[tauri::command]
pub async fn fetch_google_fonts_metadata() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .gzip(true)
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let response = client
        .get(GOOGLE_FONTS_METADATA_URL)
        .header("User-Agent", "FontFinder-Desktop/0.9.5")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Google Fonts 메타데이터 요청 실패: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Google Fonts 서버 응답 에러 (HTTP {})",
            response.status()
        ));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("메타데이터 본문 읽기 실패: {}", e))?;

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_google_fonts_metadata() {
        let res = fetch_google_fonts_metadata().await;
        match res {
            Ok(json) => {
                let parsed: Result<serde_json::Value, _> = serde_json::from_str(&json);
                assert!(parsed.is_ok(), "Google Fonts 메타데이터가 올바른 JSON이어야 합니다");
                assert!(json.len() > 1000, "Google Fonts 메타데이터 내용이 비어있지 않아야 합니다");
            }
            Err(e) => panic!("fetch_google_fonts_metadata 실패: {}", e),
        }
    }
}
