use std::time::Duration;

const DEFAULT_CURATED_FONT_METADATA_URL: &str =
    "https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts@main/font.json";

/// 추천 폰트 저장소 또는 메타데이터 URL을 정규화합니다.
/// 1. GitHub 저장소 URL(`https://github.com/owner/repo`)이 전달되면
///    `raw.githubusercontent.com`의 `fonts/font.json` 경로로 변환합니다.
/// 2. `.json` 확장자가 없는 경로인 경우 기본 파일명인 `font.json`을 자동으로 추가합니다.
pub fn normalize_curated_font_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return DEFAULT_CURATED_FONT_METADATA_URL.to_string();
    }

    let url_without_query = trimmed.split(['?', '#']).next().unwrap_or(trimmed);
    if url_without_query.ends_with(".json") {
        return trimmed.to_string();
    }

    let trimmed_no_slash = trimmed.trim_end_matches('/');

    // GitHub 브랜치 URL 매칭: https://github.com/owner/repo/tree/branch
    if let Some(rest) = trimmed_no_slash
        .strip_prefix("https://github.com/")
        .or_else(|| trimmed_no_slash.strip_prefix("http://github.com/"))
    {
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() >= 4 && parts[2] == "tree" {
            let owner = parts[0];
            let repo = parts[1].trim_end_matches(".git");
            let branch = parts[3];
            return format!(
                "https://raw.githubusercontent.com/{}/{}/{}/fonts/font.json",
                owner, repo, branch
            );
        }

        // GitHub 저장소 URL 매칭: https://github.com/owner/repo
        if parts.len() == 2 {
            let owner = parts[0];
            let repo = parts[1].trim_end_matches(".git");
            return format!(
                "https://raw.githubusercontent.com/{}/{}/main/fonts/font.json",
                owner, repo
            );
        }
    }

    // 경로만 전달된 경우 font.json 자동 추가 (쿼리/해시 보존)
    if let Some(pos) = trimmed.find(|c| c == '?' || c == '#') {
        let (base, rest) = trimmed.split_at(pos);
        let base_clean = base.trim_end_matches('/');
        format!("{}/font.json{}", base_clean, rest)
    } else {
        format!("{}/font.json", trimmed_no_slash)
    }
}

#[tauri::command]
pub async fn fetch_curated_font_metadata(url: Option<String>) -> Result<String, String> {
    let target_url = match url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(explicit_url) => normalize_curated_font_url(explicit_url),
        None => {
            if let Ok(env_url) = std::env::var("VITE_CURATED_FONTS_URL") {
                let env_trimmed = env_url.trim();
                if !env_trimmed.is_empty() {
                    normalize_curated_font_url(env_trimmed)
                } else {
                    DEFAULT_CURATED_FONT_METADATA_URL.to_string()
                }
            } else {
                DEFAULT_CURATED_FONT_METADATA_URL.to_string()
            }
        }
    };

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .gzip(true)
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let response = client
        .get(&target_url)
        .header("User-Agent", "FontFinder-Desktop/0.9.5")
        .header("Accept", "application/json")
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(|e| format!("추천 무료 폰트 메타데이터 요청 실패 ({}): {}", target_url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "추천 무료 폰트 서버 응답 에러 (HTTP {} - {})",
            response.status(),
            target_url
        ));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("추천 무료 폰트 메타데이터 본문 읽기 실패: {}", e))?;

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_curated_font_url() {
        assert_eq!(
            normalize_curated_font_url("https://github.com/monodle/fontfinder-fonts1"),
            "https://raw.githubusercontent.com/monodle/fontfinder-fonts1/main/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://github.com/monodle/fontfinder-fonts1/"),
            "https://raw.githubusercontent.com/monodle/fontfinder-fonts1/main/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://github.com/monodle/fontfinder-fonts1.git"),
            "https://raw.githubusercontent.com/monodle/fontfinder-fonts1/main/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://github.com/monodle/fontfinder-fonts1/tree/develop"),
            "https://raw.githubusercontent.com/monodle/fontfinder-fonts1/develop/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://raw.githubusercontent.com/monodle/fontfinder-fonts1/main/fonts/font.json"),
            "https://raw.githubusercontent.com/monodle/fontfinder-fonts1/main/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts"),
            "https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts/"),
            "https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts/font.json"
        );
        assert_eq!(
            normalize_curated_font_url("https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts?v=1"),
            "https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts1@20261010-1/fonts/font.json?v=1"
        );
        assert_eq!(
            normalize_curated_font_url(""),
            DEFAULT_CURATED_FONT_METADATA_URL
        );
    }

    #[tokio::test]
    async fn test_fetch_curated_font_metadata_default() {
        let res = fetch_curated_font_metadata(None).await;
        match res {
            Ok(json) => {
                let parsed: Result<serde_json::Value, _> = serde_json::from_str(&json);
                assert!(parsed.is_ok(), "추천 무료 폰트 메타데이터가 올바른 JSON이어야 합니다");
                assert!(json.len() > 100, "추천 무료 폰트 메타데이터 내용이 비어있지 않아야 합니다");
            }
            Err(e) => panic!("fetch_curated_font_metadata 실패: {}", e),
        }
    }

    #[tokio::test]
    async fn test_fetch_curated_font_metadata_with_repo_url() {
        let res = fetch_curated_font_metadata(Some(
            "https://github.com/monodle/fontfinder-fonts1".to_string(),
        ))
        .await;
        match res {
            Ok(json) => {
                let parsed: Result<serde_json::Value, _> = serde_json::from_str(&json);
                assert!(parsed.is_ok(), "GitHub repo URL로도 정상 조회가 가능해야 합니다");
            }
            Err(e) => panic!("fetch_curated_font_metadata(repo_url) 실패: {}", e),
        }
    }
}
