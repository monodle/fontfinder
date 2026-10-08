use std::path::{Path, PathBuf};
use crate::font::FontSource;

#[allow(dead_code)]
static WINDOWS_INBOX_FONTS: std::sync::LazyLock<std::collections::HashSet<&'static str>> = std::sync::LazyLock::new(|| {
    const JSON_DATA: &str = include_str!("../../../public/json/windows-font.json");
    match serde_json::from_str::<Vec<&'static str>>(JSON_DATA) {
        Ok(list) => list.into_iter().collect(),
        Err(e) => {
            eprintln!("Failed to parse windows-font.json: {}", e);
            std::collections::HashSet::new()
        }
    }
});

pub struct Platform;

impl Platform {
    #[cfg(target_os = "macos")]
    pub fn get_system_font_directories() -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        if let Some(home) = dirs_home() {
            let user_fonts = home.join("Library/Fonts");
            if user_fonts.exists() {
                dirs.push(user_fonts);
            }
        }

        let system_fonts = PathBuf::from("/System/Library/Fonts");
        if system_fonts.exists() {
            dirs.push(system_fonts);
        }

        let local_fonts = PathBuf::from("/Library/Fonts");
        if local_fonts.exists() {
            dirs.push(local_fonts);
        }

        dirs.into_iter().map(|d| crate::protocol::to_posix_normalized_path(&d)).collect()
    }

    #[cfg(target_os = "macos")]
    pub fn classify_font_source(path: &Path) -> FontSource {
        let sys_fonts = Path::new("/System/Library/Fonts");
        if crate::protocol::is_same_or_subpath(sys_fonts, path) {
            return FontSource::System;
        }
        if let Ok(canon_sys) = sys_fonts.canonicalize() {
            if crate::protocol::is_same_or_subpath(&canon_sys, path) {
                return FontSource::System;
            }
        }

        if let Some(home) = dirs_home() {
            let user_fonts = home.join("Library/Fonts");
            if crate::protocol::is_same_or_subpath(&user_fonts, path) {
                return FontSource::User;
            }
            if let Ok(canon_user) = user_fonts.canonicalize() {
                if crate::protocol::is_same_or_subpath(&canon_user, path) {
                    return FontSource::User;
                }
            }
        }

        let local_fonts = Path::new("/Library/Fonts");
        if crate::protocol::is_same_or_subpath(local_fonts, path) {
            return FontSource::System;
        }
        if let Ok(canon_local) = local_fonts.canonicalize() {
            if crate::protocol::is_same_or_subpath(&canon_local, path) {
                return FontSource::System;
            }
        }

        FontSource::External
    }

    #[cfg(target_os = "windows")]
    pub fn get_system_font_directories() -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        let win_fonts = if let Ok(windir) = std::env::var("SystemRoot").or_else(|_| std::env::var("WINDIR")) {
            PathBuf::from(windir).join("Fonts")
        } else {
            PathBuf::from(r"C:\Windows\Fonts")
        };
        if win_fonts.exists() {
            dirs.push(win_fonts);
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_fonts = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
            if user_fonts.exists() {
                dirs.push(user_fonts);
            }
        }

        dirs.into_iter().map(|d| crate::protocol::to_posix_normalized_path(&d)).collect()
    }

    #[cfg(target_os = "windows")]
    pub fn classify_font_source(path: &Path) -> FontSource {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_fonts = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
            if crate::protocol::is_same_or_subpath(&user_fonts, path) {
                return FontSource::User;
            }
            if let Ok(canon_user) = user_fonts.canonicalize() {
                if crate::protocol::is_same_or_subpath(&canon_user, path) {
                    return FontSource::User;
                }
            }
        }

        let win_fonts = if let Ok(windir) = std::env::var("SystemRoot").or_else(|_| std::env::var("WINDIR")) {
            PathBuf::from(windir).join("Fonts")
        } else {
            PathBuf::from(r"C:\Windows\Fonts")
        };
        let in_win_fonts = crate::protocol::is_same_or_subpath(&win_fonts, path)
            || win_fonts
                .canonicalize()
                .map(|canon| crate::protocol::is_same_or_subpath(&canon, path))
                .unwrap_or(false);

        if in_win_fonts {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            // 1단계: MS 공식 In-box 폰트 화이트리스트 대조 (I/O 없이 메모리 O(1) 초고속 즉시 확정)
            if !file_name.is_empty() && WINDOWS_INBOX_FONTS.contains(file_name.as_str()) {
                return FontSource::System;
            }

            // 2단계: 화이트리스트에 없는 기타 다국어/FOD 폰트는 WinSxS 컴포넌트 스토어 연동 NTFS 하드링크 검사
            if let Some(links) = get_file_hardlink_count(path) {
                if links > 1 {
                    return FontSource::System;
                } else {
                    return FontSource::User;
                }
            }
            return FontSource::System;
        }

        FontSource::External
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn get_system_font_directories() -> Vec<PathBuf> {
        Vec::new()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn classify_font_source(path: &Path) -> FontSource {
        if path.starts_with("/usr/share/fonts") || path.starts_with("/usr/local/share/fonts") {
            return FontSource::System;
        }
        if let Some(home) = dirs_home() {
            if path.starts_with(home.join(".fonts")) || path.starts_with(home.join(".local/share/fonts")) {
                return FontSource::User;
            }
        }
        FontSource::External
    }

    #[cfg(target_os = "macos")]
    pub fn activate_font(path: &PathBuf) -> Result<(), String> {
        Self::activate_font_internal(path, true)
    }

    #[cfg(target_os = "macos")]
    pub fn activate_font_internal(path: &PathBuf, _broadcast: bool) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;
        use core_foundation::error::CFError;

        if !path.exists() || !path.is_file() {
            return Err(format!("Font file not found: {:?}", path));
        }


        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerRegisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut core_foundation::error::CFErrorRef,
            ) -> bool;
        }

        let cf_url = CFURL::from_path(path, false)
            .ok_or_else(|| "Failed to create CFURL from path".to_string())?;

        // 1. scope 2: kCTFontManagerScopeUser (사용자 세션 전체 등록 시도)
        let mut error_ref: core_foundation::error::CFErrorRef = std::ptr::null_mut();
        let success_user = unsafe {
            CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, &mut error_ref)
        };

        if success_user {
            return Ok(());
        }

        if !error_ref.is_null() {
            let cf_err = unsafe { CFError::wrap_under_create_rule(error_ref) };
            // kCTFontManagerErrorAlreadyRegistered = 105
            // 이미 시스템/다른 앱에 등록된 상태는 성공으로 간주 (CFRelease 자동 수행)
            if cf_err.code() == 105 {
                return Ok(());
            }
        }

        // 2. scope 1: kCTFontManagerScopeProcess (프로세스 스코프 폴백 시도)
        let mut error_ref_proc: core_foundation::error::CFErrorRef = std::ptr::null_mut();
        let success_process = unsafe {
            CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, &mut error_ref_proc)
        };

        if success_process {
            Ok(())
        } else if !error_ref_proc.is_null() {
            let cf_err = unsafe { CFError::wrap_under_create_rule(error_ref_proc) };
            if cf_err.code() == 105 {
                Ok(())
            } else {
                Err(format!(
                    "CTFontManagerRegisterFontsForURL failed (code: {}): {}",
                    cf_err.code(),
                    cf_err.description()
                ))
            }
        } else {
            Err("CTFontManagerRegisterFontsForURL failed to register font".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    pub fn deactivate_font(path: &PathBuf) -> Result<(), String> {
        Self::deactivate_font_internal(path, true)
    }

    #[cfg(target_os = "macos")]
    pub fn deactivate_font_internal(path: &PathBuf, _broadcast: bool) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerUnregisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
        }

        // 파일이 디스크에 없더라도(삭제/언마운트) CoreText 등록 해제를 시도하여 OS 메모리 상의 고아 참조 정리
        if let Some(cf_url) = CFURL::from_path(path, false) {
            unsafe {
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, std::ptr::null_mut());
            }
        }

        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub fn install_font(src_path: &PathBuf) -> Result<PathBuf, String> {
        Self::install_font_internal(src_path, true)
    }

    #[cfg(target_os = "macos")]
    pub fn install_font_internal(src_path: &PathBuf, _broadcast: bool) -> Result<PathBuf, String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !src_path.exists() || !src_path.is_file() {
            return Err("ERR_FONT_NOT_FOUND".to_string());
        }


        let home = dirs_home().ok_or_else(|| "Failed to get home directory".to_string())?;
        let user_fonts_dir = home.join("Library/Fonts");
        if !user_fonts_dir.exists() {
            std::fs::create_dir_all(&user_fonts_dir).map_err(|e| format!("Failed to create Library/Fonts: {}", e))?;
        }

        let file_name = src_path
            .file_name()
            .ok_or_else(|| "Invalid file name".to_string())?;
        let target_path = user_fonts_dir.join(file_name);

        // 동일 물리 파일인지 정규화(canonicalize) 판별하여 원본 파일 자가 삭제 방어
        let canon_src = src_path.canonicalize().unwrap_or_else(|_| src_path.clone());
        let is_same_physical_file = if target_path.exists() {
            if let Ok(canon_target) = target_path.canonicalize() {
                canon_src == canon_target
            } else {
                src_path == &target_path
            }
        } else {
            src_path == &target_path
        };

        if is_same_physical_file {
            return Ok(target_path);
        }

        // 설치 전 원본 파일의 임시 활성화를 먼저 해제하여 충돌 방지
        let _ = Self::deactivate_font(src_path);

        // 원자적 파일 교체(Atomic Copy & Replace) 보장:
        // 기존 파일을 선제 삭제하지 않고, 먼저 고유 임시 파일에 복사하여
        // 디스크 용량 부족이나 I/O 에러 시 기존 폰트 파일이 영구 손실되는 데이터 유실(Data Loss) 원천 방어
        let random_suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let temp_path = user_fonts_dir.join(format!("{}.{}.tmp", file_name.to_string_lossy(), random_suffix));

        if let Err(e) = std::fs::copy(src_path, &temp_path) {
            let _ = std::fs::remove_file(&temp_path);
            return Err(format!("ERR_FONT_COPY_FAILED: {}", e));
        }

        // 복사된 임시 파일에 표준 사용자 쓰기 권한(0644, rw-r--r--) 보장
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&temp_path, std::fs::Permissions::from_mode(0o644));
        }

        // 대상 위치에 이전 파일 또는 깨진 심볼릭 링크가 존재하는 경우 선제 비활성화
        if target_path.exists() || target_path.symlink_metadata().is_ok() {
            let _ = Self::deactivate_font(&target_path);
        }

        // 임시 파일을 최종 목적지로 원자적 교체 (POSIX rename(2) 원자적 덮어쓰기 보장으로 기존 파일 유실 방지)
        if let Err(e) = std::fs::rename(&temp_path, &target_path) {
            let _ = std::fs::remove_file(&temp_path);
            return Err(format!("ERR_FONT_REPLACE_FAILED: {}", e));
        }

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerRegisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut core_foundation::error::CFErrorRef,
            ) -> bool;
        }

        // 복사된 폰트를 시스템 CoreText에 사용자 세션(scope 2)으로 즉시 등록
        // ~/Library/Fonts에 위치한 폰트는 macOS fontd 데몬이 자동 인식하므로,
        // 이미 등록된 상태 등으로 인한 등록 결과와 무관하게 대상 파일은 안전하게 보존합니다.
        if let Some(cf_url) = CFURL::from_path(&target_path, false) {
            unsafe {
                CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
            }
        }

        Ok(crate::protocol::to_posix_normalized_path(&target_path))
    }

    #[cfg(target_os = "macos")]
    pub fn uninstall_font(font_path: &Path) -> Result<(), String> {
        Self::uninstall_font_internal(font_path, true)
    }

    #[cfg(target_os = "macos")]
    pub fn uninstall_font_internal(font_path: &Path, _broadcast: bool) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !font_path.exists() && font_path.symlink_metadata().is_err() {
            return Err("ERR_FONT_NOT_FOUND".to_string());
        }

        // 1. 실제 물리 경로 정규화 (상대 경로, ../ 트래버설, 심볼릭 링크 완전 해소)
        let canonical_font = font_path
            .canonicalize()
            .map_err(|_| "ERR_FONT_NOT_FOUND".to_string())?;

        // 2. 디렉토리가 아닌 '파일'인지 엄격 검증 (디렉토리 자체 삭제 원천 차단)
        if !canonical_font.is_file() {
            return Err("ERR_FONT_NOT_A_FILE".to_string());
        }

        let home = dirs_home().ok_or_else(|| "Failed to get home directory".to_string())?;
        let user_fonts_dir = home.join("Library/Fonts");
        let canonical_user_dir = user_fonts_dir.canonicalize().unwrap_or_else(|_| user_fonts_dir.clone());

        // 3. 실제 물리적 부모 디렉토리가 OS 사용자 서체 디렉토리 직속인지 대소문자/자소분리 비구분 검증
        let parent_matches = canonical_font
            .parent()
            .map(|p| crate::protocol::is_same_or_subpath(p, &canonical_user_dir) && crate::protocol::is_same_or_subpath(&canonical_user_dir, p))
            .unwrap_or(false);
        if !parent_matches {
            return Err("ERR_PATH_PROTECTED_DIR".to_string());
        }

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerUnregisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
            fn CTFontManagerRegisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut core_foundation::error::CFErrorRef,
            ) -> bool;
        }

        // CoreText 등록 해제 (정규화된 물리 경로 및 전달된 경로 모두 해제)
        if let Some(cf_url) = CFURL::from_path(&canonical_font, false) {
            unsafe {
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, std::ptr::null_mut());
            }
        }

        // 시스템 휴지통으로 안전하게 이동 (데이터 유실 방지를 위해 영구 삭제 강제 폴백 제거)
        if let Err(e) = trash::delete(&canonical_font) {
            // 휴지통 이동 실패 시 CoreText 등록 상태 원자적 롤백 복원
            if let Some(cf_url) = CFURL::from_path(&canonical_font, false) {
                unsafe {
                    CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
                }
            }
            return Err(format!("ERR_FONT_TRASH_FAILED: {}", e));
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn install_font(src_path: &PathBuf) -> Result<PathBuf, String> {
        Self::install_font_internal(src_path, true)
    }

    #[cfg(target_os = "windows")]
    pub fn install_font_internal(src_path: &PathBuf, broadcast: bool) -> Result<PathBuf, String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{AddFontResourceExW, RemoveFontResourceExW, FR_PRIVATE};

        if !src_path.exists() || !src_path.is_file() {
            return Err("ERR_FONT_NOT_FOUND".to_string());
        }


        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to get LOCALAPPDATA".to_string())?;
        let user_fonts_dir = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
        if !user_fonts_dir.exists() {
            std::fs::create_dir_all(&user_fonts_dir).map_err(|e| e.to_string())?;
        }

        let file_name = src_path
            .file_name()
            .ok_or_else(|| "Invalid file name".to_string())?;
        let target_path = user_fonts_dir.join(file_name);

        // 동일 물리 파일인지 정규화(canonicalize) 판별하여 원본 파일 자가 삭제/덮어쓰기 에러 방어
        let clean_src = crate::protocol::strip_unc_prefix(src_path);
        let canon_src = clean_src.canonicalize().unwrap_or_else(|_| clean_src.clone());

        let is_same_physical_file = if target_path.exists() {
            let clean_target = crate::protocol::strip_unc_prefix(&target_path);
            if let Ok(canon_target) = clean_target.canonicalize() {
                canon_src == canon_target
            } else {
                src_path == &target_path
            }
        } else {
            src_path == &target_path
        };

        if is_same_physical_file {
            return Ok(target_path);
        }

        // 설치 전 원본 파일의 임시 활성화를 먼저 해제하여 충돌 방지
        let _ = Self::deactivate_font(src_path);

        // 원자적 파일 복사(Atomic Copy & Replace) 보장:
        // 기존 파일을 선제 삭제하지 않고, 먼저 고유 임시 파일에 복사하여
        // 디스크 용량 부족이나 I/O 에러 시 기존 폰트 파일이 영구 손실되는 데이터 유실(Data Loss) 원천 방어
        let random_suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let temp_path = user_fonts_dir.join(format!("{}.{}.tmp", file_name.to_string_lossy(), random_suffix));

        if let Err(e) = std::fs::copy(src_path, &temp_path) {
            let _ = std::fs::remove_file(&temp_path);
            let raw_os_err = e.raw_os_error();
            // Win32 32: ERROR_SHARING_VIOLATION, 5: ERROR_ACCESS_DENIED
            if raw_os_err == Some(32) || raw_os_err == Some(5) {
                return Err(format!("ERR_FONT_IN_USE: {}", e));
            }
            return Err(format!("ERR_FONT_COPY_FAILED: {}", e));
        }

        // 복사된 임시 파일의 읽기 전용 속성 해제 및 사용자 쓰기 권한 보장
        if let Ok(meta) = std::fs::metadata(&temp_path) {
            let mut perms = meta.permissions();
            if perms.readonly() {
                perms.set_readonly(false);
                let _ = std::fs::set_permissions(&temp_path, perms);
            }
        }

        // 설치 대상 경로에 파일 또는 깨진 심볼릭 링크가 이미 존재하는 경우, Windows GDI 파일 잠금(FILE_SHARE_READ) 완전 해제
        // 및 읽기 전용 속성(READONLY) 선제 해제
        if target_path.exists() || target_path.symlink_metadata().is_ok() {
            let clean_existing = crate::protocol::to_windows_native_path(&target_path);
            let mut ex_wide: Vec<u16> = clean_existing.as_os_str().encode_wide().collect();
            ex_wide.push(0);
            unsafe {
                while RemoveFontResourceExW(ex_wide.as_ptr(), 0, std::ptr::null_mut()) > 0 {}
                while RemoveFontResourceExW(ex_wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) > 0 {}
            }

            if let Ok(meta) = std::fs::metadata(&target_path) {
                let mut perms = meta.permissions();
                if perms.readonly() {
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(&target_path, perms);
                }
            }
        }

        // Win32 MoveFileExW(MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)를 통한 원자적 파일 교체
        // 기존 파일을 선제 삭제하지 않고 원자적으로 교체하므로 디스크/권한 에러 발생 시 기존 폰트 유실 차단
        let clean_temp = crate::protocol::to_windows_native_path(&temp_path);
        let clean_target = crate::protocol::to_windows_native_path(&target_path);

        let mut temp_wide: Vec<u16> = clean_temp.as_os_str().encode_wide().collect();
        temp_wide.push(0);
        let mut target_wide: Vec<u16> = clean_target.as_os_str().encode_wide().collect();
        target_wide.push(0);

        use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH};
        let move_res = unsafe {
            MoveFileExW(
                temp_wide.as_ptr(),
                target_wide.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };

        if move_res == 0 {
            let err = std::io::Error::last_os_error();
            let _ = std::fs::remove_file(&temp_path);
            return Err(format!("ERR_FONT_REPLACE_FAILED: {}", err));
        }

        let clean_target = crate::protocol::to_windows_native_path(&target_path);
        let mut wide: Vec<u16> = clean_target.as_os_str().encode_wide().collect();
        wide.push(0);

        let res = unsafe { AddFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) };
        if res == 0 {
            let _ = std::fs::remove_file(&target_path);
            return Err("AddFontResourceExW failed to register installed font".to_string());
        }

        // 폰트 표시명 파싱 후 HKCU 레지스트리 영구 등록 (관리자 권한 불필요, 재부팅 후 유지)
        let font_name = crate::font::FontParser::parse_file(&target_path)
            .ok()
            .and_then(|metas| {
                if metas.is_empty() {
                    None
                } else if metas.len() == 1 {
                    let name = if !metas[0].full_name.is_empty() {
                        metas[0].full_name.clone()
                    } else {
                        metas[0].family_name.clone()
                    };
                    Some(name)
                } else {
                    // TTC/OTC 컬렉션: 다중 서체명을 " & "로 결합 (Windows 레지스트리 표준 규격)
                    let names: Vec<String> = metas
                        .into_iter()
                        .map(|m| {
                            if !m.full_name.is_empty() {
                                m.full_name
                            } else {
                                m.family_name
                            }
                        })
                        .collect();
                    Some(names.join(" & "))
                }
            })
            .unwrap_or_else(|| {
                target_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown Font")
                    .to_string()
            });

        if let Err(e) = register_font_in_registry(&font_name, &target_path) {
            eprintln!("[platform] Failed to register font in HKCU registry: {}", e);
        }

        if broadcast {
            Self::notify_font_change();
        }
        Ok(crate::protocol::to_posix_normalized_path(&target_path))
    }

    #[cfg(target_os = "windows")]
    pub fn uninstall_font(font_path: &PathBuf) -> Result<(), String> {
        Self::uninstall_font_internal(font_path, true)
    }

    #[cfg(target_os = "windows")]
    pub fn uninstall_font_internal(font_path: &PathBuf, broadcast: bool) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{AddFontResourceExW, RemoveFontResourceExW, FR_PRIVATE};

        if !font_path.exists() && font_path.symlink_metadata().is_err() {
            return Err("ERR_FONT_NOT_FOUND".to_string());
        }

        let clean_font = crate::protocol::strip_unc_prefix(font_path);
        let canonical_font = clean_font
            .canonicalize()
            .map_err(|_| "ERR_FONT_NOT_FOUND".to_string())?;

        if !canonical_font.is_file() {
            return Err("ERR_FONT_NOT_A_FILE".to_string());
        }

        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to get LOCALAPPDATA".to_string())?;
        let user_fonts_dir = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
        let clean_user_dir = crate::protocol::strip_unc_prefix(&user_fonts_dir);
        let canonical_user_dir = clean_user_dir.canonicalize().unwrap_or_else(|_| clean_user_dir.clone());

        let win_fonts = if let Ok(windir) = std::env::var("SystemRoot").or_else(|_| std::env::var("WINDIR")) {
            PathBuf::from(windir).join("Fonts")
        } else {
            PathBuf::from(r"C:\Windows\Fonts")
        };
        let clean_win_dir = crate::protocol::strip_unc_prefix(&win_fonts);
        let canonical_win_dir = clean_win_dir.canonicalize().unwrap_or_else(|_| clean_win_dir.clone());

        let in_user_dir = canonical_font
            .parent()
            .map(|p| crate::protocol::is_same_or_subpath(p, &canonical_user_dir) && crate::protocol::is_same_or_subpath(&canonical_user_dir, p))
            .unwrap_or(false);

        let in_win_dir = canonical_font
            .parent()
            .map(|p| crate::protocol::is_same_or_subpath(p, &canonical_win_dir) && crate::protocol::is_same_or_subpath(&canonical_win_dir, p))
            .unwrap_or(false);

        if !in_user_dir && !in_win_dir {
            return Err("ERR_PATH_PROTECTED_DIR".to_string());
        }

        // C:\Windows\Fonts에 위치한 경우 순정 시스템 폰트인지 2중 방어 검증 (화이트리스트 또는 하드링크 > 1)
        if in_win_dir {
            let file_name = canonical_font
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            if !file_name.is_empty() && WINDOWS_INBOX_FONTS.contains(file_name.as_str()) {
                return Err("ERR_PATH_PROTECTED_DIR".to_string());
            }

            if let Some(links) = get_file_hardlink_count(&canonical_font) {
                if links > 1 {
                    return Err("ERR_PATH_PROTECTED_DIR".to_string());
                }
            }
        }

        // Win32 GDI 및 Shell32(휴지통) API는 \\?\ (UNC Verbatim) 접두사를 지원하지 않으므로
        // 정규화 검증 완료 후 순수 드라이브 경로(C:\...)로 변환하여 전달
        let target_file = crate::protocol::to_windows_native_path(&canonical_font);
        let mut wide: Vec<u16> = target_file.as_os_str().encode_wide().collect();
        wide.push(0);

        // 1. 파일 핸들 잠금 해제를 위해 GDI 리소스 임시 해제 (모든 누적 참조 카운트 완전 언로드)
        let mut removed_count = 0;
        unsafe {
            while RemoveFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) > 0 {
                removed_count += 1;
            }
            while RemoveFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) > 0 {
                removed_count += 1;
            }
        }

        // 2. 시스템 휴지통으로 안전하게 이동 (데이터 유실 방지를 위해 영구 삭제 강제 폴백 제거)
        let delete_res = trash::delete(&target_file);
        if let Err(err) = delete_res {
            if target_file.exists() {
                // 파일 삭제 실패(타 프로그램 점유 등) 시 GDI 등록 롤백 후 에러 반환 (레지스트리 보존)
                if removed_count > 0 {
                    unsafe {
                        AddFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut());
                    }
                }
                return Err(format!("ERR_FONT_IN_USE: {}", err));
            }
        }

        // 3. 파일 삭제 성공 시에만 HKCU 레지스트리 영구 제거 및 브로드캐스트 확정 (원자성 보장)
        let _ = unregister_font_from_registry(&target_file);
        if broadcast {
            Self::notify_font_change();
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn install_font(src_path: &PathBuf) -> Result<PathBuf, String> {
        Self::install_font_internal(src_path, true)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn install_font_internal(_src_path: &PathBuf, _broadcast: bool) -> Result<PathBuf, String> {
        Err("Unsupported platform for font installation".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn uninstall_font(font_path: &PathBuf) -> Result<(), String> {
        Self::uninstall_font_internal(font_path, true)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn uninstall_font_internal(_font_path: &PathBuf, _broadcast: bool) -> Result<(), String> {
        Err("Unsupported platform for font uninstallation".to_string())
    }

    #[cfg(target_os = "windows")]
    pub fn activate_font(path: &PathBuf) -> Result<(), String> {
        Self::activate_font_internal(path, true)
    }

    #[cfg(target_os = "windows")]
    pub fn activate_font_internal(path: &PathBuf, broadcast: bool) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{AddFontResourceExW, FR_PRIVATE};

        if !path.exists() || !path.is_file() {
            return Err("ERR_FONT_NOT_FOUND".to_string());
        }


        let clean_path = crate::protocol::to_windows_native_path(path);
        let mut wide: Vec<u16> = clean_path.as_os_str().encode_wide().collect();
        wide.push(0);

        // fl = 0: 시스템 전체에서 사용할 수 있도록 등록
        let res = unsafe { AddFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) };
        let success = if res > 0 {
            true
        } else {
            unsafe { AddFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) > 0 }
        };

        if success {
            if broadcast {
                Self::notify_font_change();
            }
            Ok(())
        } else {
            Err("AddFontResourceExW failed to register font".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    pub fn deactivate_font(path: &PathBuf) -> Result<(), String> {
        Self::deactivate_font_internal(path, true)
    }

    #[cfg(target_os = "windows")]
    pub fn deactivate_font_internal(path: &PathBuf, broadcast: bool) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{RemoveFontResourceExW, FR_PRIVATE};

        // 파일이 디스크에 존재하지 않는 경우(외부 삭제/부재 폰트 정리)에만 HKCU 레지스트리 잔존 정보를 정리
        // (정상 설치된 폰트는 단순 비활성화 시 레지스트리 영구 등록이 유지되어야 하며, uninstall_font 시에만 삭제됨)
        if !path.exists() {
            let _ = unregister_font_from_registry(path);
        }

        // 파일이 디스크에 없더라도(삭제/언마운트) GDI 테이블에서 해당 경로 리소스를 해제하여
        // OS 폰트 메모리 상의 고아 참조를 완전히 제거합니다. (모든 중복 참조 완전 언로드)
        let clean_path = crate::protocol::to_windows_native_path(path);
        let mut wide: Vec<u16> = clean_path.as_os_str().encode_wide().collect();
        wide.push(0);

        let mut removed_any = false;
        unsafe {
            while RemoveFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) > 0 {
                removed_any = true;
            }
            while RemoveFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) > 0 {
                removed_any = true;
            }
        }

        if removed_any && broadcast {
            Self::notify_font_change();
        }

        Ok(())
    }

    pub fn notify_font_change() {
        #[cfg(target_os = "windows")]
        {
            tauri::async_runtime::spawn(async move {
                tokio::task::spawn_blocking(|| {
                    use windows_sys::Win32::UI::WindowsAndMessaging::{
                        SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
                    };
                    unsafe {
                        SendMessageTimeoutW(
                            HWND_BROADCAST,
                            WM_FONTCHANGE,
                            0,
                            0,
                            SMTO_ABORTIFHUNG,
                            300,
                            std::ptr::null_mut(),
                        );
                    }
                })
                .await
                .ok();
            });
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn activate_font(_path: &PathBuf) -> Result<(), String> {
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn activate_font_internal(_path: &PathBuf, _broadcast: bool) -> Result<(), String> {
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn deactivate_font(_path: &PathBuf) -> Result<(), String> {
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn deactivate_font_internal(_path: &PathBuf, _broadcast: bool) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn register_font_in_registry(font_name: &str, font_path: &Path) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCreateKeyExW, RegSetValueExW, RegCloseKey, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_SZ, REG_OPTION_NON_VOLATILE,
    };

    let subkey: Vec<u16> = OsStr::new(r"Software\Microsoft\Windows NT\CurrentVersion\Fonts")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let suffix = match font_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("otf") => " (OpenType)",
        _ => " (TrueType)",
    };

    let has_font_type_suffix = font_name.ends_with("(TrueType)")
        || font_name.ends_with("(OpenType)")
        || font_name.ends_with("(TrueType Collection)");

    let val_name_str = if has_font_type_suffix {
        font_name.to_string()
    } else {
        format!("{}{}", font_name, suffix)
    };
    let value_name: Vec<u16> = OsStr::new(&val_name_str)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let win_path = crate::protocol::to_windows_native_path(font_path);
    let value_data: Vec<u16> = OsStr::new(win_path.as_os_str())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut hkey = std::ptr::null_mut();
    let mut disposition = 0u32;
    unsafe {
        if RegCreateKeyExW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            0,
            std::ptr::null_mut(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            std::ptr::null_mut(),
            &mut hkey,
            &mut disposition,
        ) != 0 {
            return Err("Failed to open or create HKCU Fonts registry key for writing".to_string());
        }

        let data_bytes = (value_data.len() * std::mem::size_of::<u16>()) as u32;
        let set_res = RegSetValueExW(
            hkey,
            value_name.as_ptr(),
            0,
            REG_SZ,
            value_data.as_ptr() as *const u8,
            data_bytes,
        );
        RegCloseKey(hkey);

        if set_res != 0 {
            return Err(format!("RegSetValueExW failed with code {}", set_res));
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn get_file_hardlink_count(path: &Path) -> Option<u32> {
    use std::fs::File;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Storage::FileSystem::{GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION};

    let clean_path = crate::protocol::strip_unc_prefix(path);
    let file = File::open(&clean_path).ok()?;
    let handle = file.as_raw_handle() as HANDLE;
    unsafe {
        let mut info: BY_HANDLE_FILE_INFORMATION = std::mem::zeroed();
        if GetFileInformationByHandle(handle, &mut info) != 0 {
            Some(info.nNumberOfLinks)
        } else {
            None
        }
    }
}

#[cfg(target_os = "windows")]
fn unregister_font_from_registry(font_path: &Path) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegEnumValueW, RegOpenKeyExW, HKEY_CURRENT_USER,
        KEY_READ, KEY_SET_VALUE, REG_SZ,
    };

    let subkey: Vec<u16> = OsStr::new(r"Software\Microsoft\Windows NT\CurrentVersion\Fonts")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let clean_target = crate::protocol::strip_unc_prefix(font_path);
    let target_str = clean_target.to_string_lossy().replace('/', "\\").to_lowercase();
    let target_file_name = font_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    // 사용자 수준 서체는 HKEY_CURRENT_USER에만 등록되므로 HKCU를 우선 대상으로 처리
    // (HKLM은 관리자 권한 없이 KEY_SET_VALUE 요청 시 ACCESS_DENIED로 실패함)
    for root_key in [HKEY_CURRENT_USER] {
        let mut hkey = std::ptr::null_mut();
        unsafe {
            if RegOpenKeyExW(root_key, subkey.as_ptr(), 0, KEY_READ | KEY_SET_VALUE, &mut hkey) != 0 {
                continue;
            }

            let mut index = 0;
            let mut keys_to_delete = Vec::new();

            loop {
                let mut name_buf = [0u16; 2048];
                let mut name_len = name_buf.len() as u32;
                // 메모리 정렬(2-byte alignment) 보장을 위해 u16 배열로 직접 선언 (UB 방어)
                let mut data_buf = [0u16; 2048];
                let mut data_len = (data_buf.len() * std::mem::size_of::<u16>()) as u32;
                let mut val_type = 0u32;

                let status = RegEnumValueW(
                    hkey,
                    index,
                    name_buf.as_mut_ptr(),
                    &mut name_len,
                    std::ptr::null_mut(),
                    &mut val_type,
                    data_buf.as_mut_ptr() as *mut u8,
                    &mut data_len,
                );

                if status == 234 {
                    index += 1;
                    continue;
                }

                if status != 0 {
                    break;
                }

                if val_type == REG_SZ {
                    let valid_u16_count = (data_len as usize / std::mem::size_of::<u16>()).min(data_buf.len());
                    let val_data = String::from_utf16_lossy(&data_buf[..valid_u16_count])
                        .trim_matches('\0')
                        .replace('/', "\\")
                        .to_lowercase();

                    let is_inbox_protected = WINDOWS_INBOX_FONTS.contains(target_file_name.as_str());
                    let is_exact_path_match = val_data == target_str;
                    // 파일명만 등록된 값의 경우: 대상 서체 경로가 실제 사용자 서체 디렉토리(%LOCALAPPDATA%\Microsoft\Windows\Fonts) 내에 위치하는 경우에만 안전하게 매칭 (타 디렉토리 서체 오삭제 차단)
                    let is_safe_filename_match = !target_file_name.is_empty()
                        && val_data == target_file_name
                        && !is_inbox_protected
                        && std::env::var("LOCALAPPDATA")
                            .map(|lad| {
                                let user_fonts = PathBuf::from(lad).join(r"Microsoft\Windows\Fonts");
                                crate::protocol::is_same_or_subpath(&user_fonts, &clean_target)
                            })
                            .unwrap_or(false);

                    if is_exact_path_match || is_safe_filename_match {
                        keys_to_delete.push(name_buf[..name_len as usize].to_vec());
                    }
                }

                index += 1;
            }

            for key_name in keys_to_delete {
                let mut null_terminated = key_name;
                null_terminated.push(0);
                let _ = RegDeleteValueW(hkey, null_terminated.as_ptr());
            }

            RegCloseKey(hkey);
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_inbox_fonts_whitelist() {
        assert!(WINDOWS_INBOX_FONTS.len() >= 360, "Loaded {} fonts, expected >= 360", WINDOWS_INBOX_FONTS.len());
        assert!(WINDOWS_INBOX_FONTS.contains("malgun.ttf"));
        assert!(WINDOWS_INBOX_FONTS.contains("batang.ttc"));
        assert!(WINDOWS_INBOX_FONTS.contains("gulim.ttc"));
        assert!(WINDOWS_INBOX_FONTS.contains("segoeui.ttf"));
        assert!(WINDOWS_INBOX_FONTS.contains("arial.ttf"));
        assert!(!WINDOWS_INBOX_FONTS.contains("seoulnamsanb.ttf"));
    }
}



