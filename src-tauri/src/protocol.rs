use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use percent_encoding::percent_decode_str;
use tauri::http::{header, Response, StatusCode};

use tauri::Manager;

/// 허용되는 폰트 파일의 최대 크기 (100MB)
/// 대형 Pan-CJK 통합 서체 컬렉션(.ttc)도 안전하게 수용하면서 메모리 고갈(DoS)을 방지합니다.
pub const MAX_FONT_FILE_SIZE: u64 = 100 * 1024 * 1024;

/// 허용된 CORS Origin 목록 검증
pub fn is_allowed_origin(origin: &str) -> bool {
    let clean = origin.trim_end_matches('/');

    // 1. 프로덕션 환경의 Tauri 및 커스텀 스키마 오리진
    if clean == "tauri://localhost"
        || clean == "http://tauri.localhost"
        || clean == "https://tauri.localhost"
        || clean == "font://localhost"
        || clean == "http://font.localhost"
        || clean == "https://font.localhost"
    {
        return true;
    }

    // 2. 로컬 개발 서버 오리진 (localhost 및 127.0.0.1)
    if clean.starts_with("http://localhost:")
        || clean.starts_with("http://127.0.0.1:")
        || clean.starts_with("https://localhost:")
        || clean.starts_with("https://127.0.0.1:")
    {
        return true;
    }

    false
}

/// 요청 헤더에서 검증된 CORS 허용 Origin 문자열을 반환합니다.
/// 인가되지 않은 외부 Origin일 경우 None을 반환하여 차단합니다.
fn resolve_allowed_origin(request: &tauri::http::Request<Vec<u8>>) -> Option<String> {
    if let Some(origin_val) = request.headers().get(header::ORIGIN) {
        if let Ok(origin_str) = origin_val.to_str() {
            if is_allowed_origin(origin_str) {
                return Some(origin_str.to_string());
            } else {
                eprintln!("[font protocol] Blocked unauthorized origin: {}", origin_str);
                return None;
            }
        }
        return None;
    }

    // Origin 헤더가 생략된 WebView 내부 요청 (예: 일부 WebKit의 @font-face 로드)
    #[cfg(target_os = "windows")]
    let default_origin = "http://tauri.localhost";
    #[cfg(not(target_os = "windows"))]
    let default_origin = "tauri://localhost";

    Some(default_origin.to_string())
}

/// 요청된 정규화 파일 경로가 안전한 폰트 디렉토리 또는 DB 카탈로그에 속하는지 검증합니다.
pub fn is_font_path_allowed<R: tauri::Runtime>(
    path: &Path,
    app_handle: Option<&tauri::AppHandle<R>>,
) -> bool {
    // 1. OS 시스템 폰트 디렉토리 검증
    for sys_dir in crate::platform::Platform::get_system_font_directories() {
        if let Ok(canonical_sys) = sys_dir.canonicalize() {
            if path.starts_with(&canonical_sys) {
                return true;
            }
        } else if path.starts_with(&sys_dir) {
            return true;
        }
    }

    // 2. 앱 핸들(DB 및 등록 감시 폴더/캐시) 검증
    if let Some(app) = app_handle {
        // 앱 데이터 디렉토리 허용
        if let Ok(app_data) = app.path().app_data_dir() {
            if let Ok(canonical_app_data) = app_data.canonicalize() {
                if path.starts_with(&canonical_app_data) {
                    return true;
                }
            } else if path.starts_with(&app_data) {
                return true;
            }
        }

        if let Some(state) = app.try_state::<crate::commands::AppState>() {
            // 2-1. 사용자가 등록한 감시 폴더(watched folders) 하위 경로인지 검증
            if let Ok(folders) = state.db.get_folders() {
                for folder in folders {
                    let folder_path = PathBuf::from(&folder.path);
                    if let Ok(canonical_folder) = folder_path.canonicalize() {
                        if path.starts_with(&canonical_folder) {
                            return true;
                        }
                    } else if path.starts_with(&folder_path) {
                        return true;
                    }
                }
            }

            // 2-2. 폰트 캐시 DB에 등록된 유효한 폰트 경로인지 검증
            let path_str = path.to_string_lossy();
            if let Ok(true) = state.db.is_font_path_cached(&path_str) {
                return true;
            }
        }
    }

    false
}

pub fn handle_font_protocol<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    // 1. CORS Origin 검증 (Early Return)
    let allow_origin = match resolve_allowed_origin(&request) {
        Some(origin) => origin,
        None => {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(b"Forbidden: Origin not allowed".to_vec())
                .unwrap_or_default();
        }
    };

    // 2. CORS Preflight (OPTIONS) 요청 처리
    if request.method() == tauri::http::Method::OPTIONS {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
            .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
            .body(Vec::new())
            .unwrap_or_default();
    }

    // 3. HTTP 메서드 검증 (GET, HEAD만 허용)
    if request.method() != tauri::http::Method::GET && request.method() != tauri::http::Method::HEAD {
        return Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .body(b"Method Not Allowed".to_vec())
            .unwrap_or_default();
    }

    let uri_path = request.uri().path();

    // URI Decoding
    // Tauri convertFileSrc creates URLs like:
    //   - macOS: font://localhost/%2Fpath%2Fto%2Ffont.ttf -> uri_path: "/%2Fpath%2Fto%2Ffont.ttf"
    //   - Windows: http://font.localhost/C%3A%5Cpath... -> uri_path: "/C%3A%5Cpath..." or "/C%3A%2Fpath..."
    // Stripping the leading '/' before percent-decoding restores the exact absolute path.
    let path_str = if uri_path.starts_with('/') {
        let stripped = &uri_path[1..];
        let decoded = percent_decode_str(stripped).decode_utf8_lossy().to_string();

        #[cfg(target_os = "windows")]
        {
            let is_win_abs = decoded.len() >= 2 && decoded.chars().nth(1) == Some(':');
            let is_unc = decoded.starts_with(r"\\") || decoded.starts_with("//");
            if is_win_abs || is_unc {
                decoded
            } else if decoded.starts_with('/') {
                decoded.trim_start_matches('/').to_string()
            } else {
                decoded
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if decoded.starts_with('/') {
                decoded
            } else {
                // If original uri was e.g. "/Users/..." (unencoded slash), decode full path
                percent_decode_str(uri_path).decode_utf8_lossy().to_string()
            }
        }
    } else {
        percent_decode_str(uri_path).decode_utf8_lossy().to_string()
    };

    let file_path = PathBuf::from(path_str);

    // 4. 확장자 화이트리스트 검사 (Early Return)
    let mime_type = match get_allowed_font_mime_type(&file_path) {
        Some(mime) => mime,
        None => {
            eprintln!("[font protocol] Access denied: unsupported font file extension for {:?}", file_path);
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
                .body(b"Forbidden: Only font files (.ttf, .otf, .ttc, .woff, .woff2) are allowed".to_vec())
                .unwrap_or_default();
        }
    };

    // 5. 파일 존재 여부 및 정규화(canonicalize)를 통한 심볼릭 링크 및 Path Traversal 방어
    let canonical_path = match file_path.canonicalize() {
        Ok(path) => {
            if !path.is_file() {
                eprintln!("[font protocol] Target is not a file: {:?}", path);
                return Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
                    .body(b"Font file not found".to_vec())
                    .unwrap_or_default();
            }
            path
        }
        Err(err) => {
            eprintln!("[font protocol] Font file not found or invalid path {:?}: {}", file_path, err);
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
                .body(b"Font file not found".to_vec())
                .unwrap_or_default();
        }
    };

    // 6. 허용된 경로(시스템 폰트, 감시 폴더, 캐시된 폰트 라이브러리) 검증
    if !is_font_path_allowed(&canonical_path, Some(ctx.app_handle())) {
        eprintln!("[font protocol] Access denied: unauthorized path {:?}", canonical_path);
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .body(b"Forbidden: Path is not in authorized font directories or catalog".to_vec())
            .unwrap_or_default();
    }

    // 7. 파일 오픈 및 파일 크기 사전 검사 (Memory Exhaustion / DoS 방어)
    let mut file = match File::open(&canonical_path) {
        Ok(f) => f,
        Err(err) => {
            eprintln!("[font protocol] Failed to open file {:?}: {}", canonical_path, err);
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
                .body(format!("Failed to open file: {}", err).into_bytes())
                .unwrap_or_default();
        }
    };

    let file_size = match file.metadata().map(|m| m.len()) {
        Ok(len) => len,
        Err(err) => {
            eprintln!("[font protocol] Failed to read metadata for {:?}: {}", canonical_path, err);
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
                .body(format!("Failed to read file metadata: {}", err).into_bytes())
                .unwrap_or_default();
        }
    };

    if file_size > MAX_FONT_FILE_SIZE {
        eprintln!(
            "[font protocol] File size exceeds limit ({} bytes > {} bytes): {:?}",
            file_size, MAX_FONT_FILE_SIZE, canonical_path
        );
        return Response::builder()
            .status(StatusCode::PAYLOAD_TOO_LARGE)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .body(b"Payload Too Large: Font file exceeds maximum allowed size (100MB)".to_vec())
            .unwrap_or_default();
    }

    // 8. Bounded Read를 통한 안전한 메모리 적재
    let mut buffer = Vec::with_capacity(file_size.min(MAX_FONT_FILE_SIZE) as usize);
    if let Err(err) = (&mut file).take(MAX_FONT_FILE_SIZE + 1).read_to_end(&mut buffer) {
        eprintln!("[font protocol] Failed to read file {:?}: {}", canonical_path, err);
        return Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .body(format!("Failed to read file: {}", err).into_bytes())
            .unwrap_or_default();
    }

    // 9. 웹뷰(Chromium/WebKit OTS) 파싱 오류 방지 sanitize
    sanitize_font_buffer(&mut buffer);

    // 10. HEAD 요청 처리
    if request.method() == tauri::http::Method::HEAD {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime_type)
            .header(header::CONTENT_LENGTH, buffer.len())
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, &allow_origin)
            .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
            .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .body(Vec::new())
            .unwrap_or_default();
    }

    // 11. 최종 GET 응답 반환
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::CONTENT_LENGTH, buffer.len())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, allow_origin)
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(buffer)
        .unwrap_or_default()
}

/// 허용된 폰트 확장자(화이트리스트)를 검사하고 대응하는 MIME 타입을 반환합니다.
/// 미지원 또는 허용되지 않는 확장자는 None을 반환합니다.
pub fn get_allowed_font_mime_type(path: &Path) -> Option<&'static str> {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() {
        Some("ttf") => Some("font/ttf"),
        Some("otf") => Some("font/otf"),
        Some("woff") => Some("font/woff"),
        Some("woff2") => Some("font/woff2"),
        Some("ttc") => Some("font/collection"),
        _ => None,
    }
}

/// 웹뷰(Chromium OTS)에서 불량 kern 테이블로 인한 로드 실패 방지
/// 원본 파일은 변경하지 않고, 인메모리 버퍼의 kern 테이블 태그를 OTS가 안전하게 무시하는 태그로 변경합니다.
pub fn sanitize_font_buffer(buffer: &mut [u8]) {
    if buffer.len() < 12 {
        return;
    }

    // 1. TTC (TrueType Collection) 처리
    if buffer.starts_with(b"ttcf") {
        if buffer.len() < 16 {
            return;
        }
        let num_fonts = u32::from_be_bytes([buffer[8], buffer[9], buffer[10], buffer[11]]) as usize;
        let mut offset = 12;
        for _ in 0..num_fonts {
            if offset + 4 > buffer.len() {
                break;
            }
            let font_offset = u32::from_be_bytes([
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
            ]) as usize;
            sanitize_single_face_tables(buffer, font_offset);
            offset += 4;
        }
        return;
    }

    // 2. 단일 TTF / OTF 처리
    sanitize_single_face_tables(buffer, 0);
}

fn sanitize_single_face_tables(buffer: &mut [u8], base_offset: usize) {
    if base_offset + 12 > buffer.len() {
        return;
    }

    let num_tables = u16::from_be_bytes([
        buffer[base_offset + 4],
        buffer[base_offset + 5],
    ]) as usize;

    let mut entry_offset = base_offset + 12;
    for _ in 0..num_tables {
        if entry_offset + 16 > buffer.len() {
            break;
        }

        let tag = &buffer[entry_offset..entry_offset + 4];
        if tag == b"kern" {
            // Chromium OTS는 알려지지 않은 태그를 파싱 오류 없이 조용히 DROP합니다.
            buffer[entry_offset..entry_offset + 4].copy_from_slice(b"drop");
        }

        entry_offset += 16;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_font_buffer() {
        // Mock TTF header with 'kern' and 'cmap'
        let mut data = vec![
            0x00, 0x01, 0x00, 0x00, // sfntVersion
            0x00, 0x02,             // numTables = 2
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // searchRange etc
            // Table 1: cmap
            b'c', b'm', b'a', b'p',
            0x00, 0x00, 0x00, 0x01, // checkSum
            0x00, 0x00, 0x00, 0x20, // offset
            0x00, 0x00, 0x00, 0x10, // length
            // Table 2: kern
            b'k', b'e', b'r', b'n',
            0x00, 0x00, 0x00, 0x02, // checkSum
            0x00, 0x00, 0x00, 0x30, // offset
            0x00, 0x00, 0x00, 0x10, // length
        ];

        sanitize_font_buffer(&mut data);

        assert_eq!(&data[12..16], b"cmap");
        assert_eq!(&data[28..32], b"drop"); // 'kern' should be changed to 'drop'

        // Real font test if file exists
        let real_path = "/tmp/font_test/GangwonEduModu-Bold.ttf";
        if std::path::Path::new(real_path).exists() {
            let mut font_data = std::fs::read(real_path).unwrap();
            sanitize_font_buffer(&mut font_data);
            // Verify that 'kern' table is no longer present
            let face = ttf_parser::Face::parse(&font_data, 0).unwrap();
            assert!(face.tables().kern.is_none());
        }
    }

    #[test]
    fn test_get_allowed_font_mime_type() {
        // Allowed font formats (case-insensitive)
        assert_eq!(get_allowed_font_mime_type(Path::new("font.ttf")), Some("font/ttf"));
        assert_eq!(get_allowed_font_mime_type(Path::new("FONT.TTF")), Some("font/ttf"));
        assert_eq!(get_allowed_font_mime_type(Path::new("/path/to/font.otf")), Some("font/otf"));
        assert_eq!(get_allowed_font_mime_type(Path::new("/path/to/font.woff")), Some("font/woff"));
        assert_eq!(get_allowed_font_mime_type(Path::new("/path/to/font.woff2")), Some("font/woff2"));
        assert_eq!(get_allowed_font_mime_type(Path::new("/path/to/font.ttc")), Some("font/collection"));

        // Disallowed files / security sensitive targets
        assert_eq!(get_allowed_font_mime_type(Path::new("/etc/passwd")), None);
        assert_eq!(get_allowed_font_mime_type(Path::new("/app/.env")), None);
        assert_eq!(get_allowed_font_mime_type(Path::new("script.js")), None);
        assert_eq!(get_allowed_font_mime_type(Path::new("malicious.exe")), None);
        assert_eq!(get_allowed_font_mime_type(Path::new("config.json")), None);
        assert_eq!(get_allowed_font_mime_type(Path::new("")), None);
    }

    #[test]
    fn test_is_allowed_origin() {
        // Allowed production origins
        assert!(is_allowed_origin("tauri://localhost"));
        assert!(is_allowed_origin("http://tauri.localhost"));
        assert!(is_allowed_origin("https://tauri.localhost"));
        assert!(is_allowed_origin("font://localhost"));
        assert!(is_allowed_origin("http://font.localhost"));
        assert!(is_allowed_origin("tauri://localhost/")); // trailing slash

        // Allowed dev origins
        assert!(is_allowed_origin("http://localhost:1420"));
        assert!(is_allowed_origin("http://127.0.0.1:1420"));
        assert!(is_allowed_origin("http://localhost:3000"));

        // Disallowed external / malicious origins
        assert!(!is_allowed_origin("https://evil.com"));
        assert!(!is_allowed_origin("http://attacker.org:1420"));
        assert!(!is_allowed_origin("http://evil-localhost:1420"));
        assert!(!is_allowed_origin("file://"));
        assert!(!is_allowed_origin("null"));
    }

    #[test]
    fn test_is_font_path_allowed_system_dirs() {
        // System font directory test (app_handle = None)
        let sys_dirs = crate::platform::Platform::get_system_font_directories();
        if let Some(first_dir) = sys_dirs.first() {
            let test_font = first_dir.join("test.ttf");
            assert!(is_font_path_allowed::<tauri::Wry>(&test_font, None));
        }

        // Sensitive paths outside system font directories should be rejected
        assert!(!is_font_path_allowed::<tauri::Wry>(Path::new("/etc/passwd"), None));
        assert!(!is_font_path_allowed::<tauri::Wry>(Path::new("/private/var/log/system.log"), None));
    }

    #[test]
    fn test_max_font_file_size_constant() {
        assert_eq!(MAX_FONT_FILE_SIZE, 100 * 1024 * 1024);
    }
}
