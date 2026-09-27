use std::path::{Path, PathBuf};
use crate::font::FontSource;

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

        dirs
    }

    #[cfg(target_os = "macos")]
    pub fn classify_font_source(path: &Path) -> FontSource {
        if path.starts_with("/System/Library/Fonts") {
            return FontSource::System;
        }

        if let Some(home) = dirs_home() {
            if path.starts_with(home.join("Library/Fonts")) {
                return FontSource::User;
            }
        }

        if path.starts_with("/Library/Fonts") {
            return FontSource::User;
        }

        FontSource::External
    }

    #[cfg(target_os = "windows")]
    pub fn get_system_font_directories() -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        let win_fonts = PathBuf::from(r"C:\Windows\Fonts");
        if win_fonts.exists() {
            dirs.push(win_fonts);
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_fonts = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
            if user_fonts.exists() {
                dirs.push(user_fonts);
            }
        }

        dirs
    }

    #[cfg(target_os = "windows")]
    pub fn classify_font_source(path: &Path) -> FontSource {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_fonts = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");
            if path.starts_with(&user_fonts) {
                return FontSource::User;
            }
        }

        let win_fonts = PathBuf::from(r"C:\Windows\Fonts");
        if path.starts_with(&win_fonts) {
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
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !path.exists() || !path.is_file() {
            return Err(format!("Font file not found: {:?}", path));
        }

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerRegisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
        }

        let cf_url = CFURL::from_path(path, false)
            .ok_or_else(|| "Failed to create CFURL from path".to_string())?;

        // scope 2: kCTFontManagerScopeUser (사용자 세션 전체), 실패 시 scope 1: kCTFontManagerScopeProcess (프로세스)
        let success_user = unsafe {
            CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut())
        };

        if success_user {
            return Ok(());
        }

        let success_process = unsafe {
            CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, std::ptr::null_mut())
        };

        if success_process {
            Ok(())
        } else {
            Err("CTFontManagerRegisterFontsForURL failed to register font".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    pub fn deactivate_font(path: &PathBuf) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !path.exists() {
            return Ok(());
        }

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerUnregisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
        }

        let cf_url = CFURL::from_path(path, false)
            .ok_or_else(|| "Failed to create CFURL from path".to_string())?;

        unsafe {
            CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
            CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, std::ptr::null_mut());
        }

        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub fn install_font(src_path: &PathBuf) -> Result<PathBuf, String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !src_path.exists() || !src_path.is_file() {
            return Err(format!("Font file not found: {:?}", src_path));
        }

        // 설치 전 원본 파일의 임시 활성화를 먼저 해제하여 충돌 방지
        let _ = Self::deactivate_font(src_path);

        let home = dirs_home().ok_or_else(|| "Failed to get home directory".to_string())?;
        let user_fonts_dir = home.join("Library/Fonts");
        if !user_fonts_dir.exists() {
            std::fs::create_dir_all(&user_fonts_dir).map_err(|e| format!("Failed to create Library/Fonts: {}", e))?;
        }

        let file_name = src_path
            .file_name()
            .ok_or_else(|| "Invalid file name".to_string())?;
        let target_path = user_fonts_dir.join(file_name);

        // 동일 파일인 경우 재설치 건너뛰기
        if src_path == &target_path {
            return Ok(target_path);
        }

        std::fs::copy(src_path, &target_path).map_err(|e| format!("Failed to copy font file: {}", e))?;

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerRegisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
        }

        // 복사된 폰트를 시스템 CoreText에 즉시 사용자 세션 등록 및 결과 검증
        if let Some(cf_url) = CFURL::from_path(&target_path, false) {
            let registered = unsafe {
                CTFontManagerRegisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut())
            };
            if !registered {
                // CoreText 등록 실패 시 복사된 파일 롤백 삭제
                let _ = std::fs::remove_file(&target_path);
                return Err("Failed to register font with CoreText".to_string());
            }
        } else {
            let _ = std::fs::remove_file(&target_path);
            return Err("Failed to create CFURL for installed font".to_string());
        }

        Ok(target_path)
    }

    #[cfg(target_os = "macos")]
    pub fn uninstall_font(font_path: &PathBuf) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::url::CFURL;

        if !font_path.exists() {
            return Err("Font file does not exist".to_string());
        }

        let home = dirs_home().ok_or_else(|| "Failed to get home directory".to_string())?;
        let user_fonts_dir = home.join("Library/Fonts");

        let canonical_font = font_path.canonicalize().unwrap_or_else(|_| font_path.clone());
        let canonical_user_dir = user_fonts_dir.canonicalize().unwrap_or_else(|_| user_fonts_dir.clone());

        // 사용자 폰트 디렉토리에 있는 폰트만 안전하게 삭제 허용 (시스템 보호 폰트 삭제 방지)
        if !canonical_font.starts_with(&canonical_user_dir) {
            return Err("Cannot uninstall system-protected or external font".to_string());
        }

        #[link(name = "CoreText", kind = "framework")]
        extern "C" {
            fn CTFontManagerUnregisterFontsForURL(
                font_url: core_foundation::url::CFURLRef,
                scope: u32,
                error: *mut std::ffi::c_void,
            ) -> bool;
        }

        // CoreText 등록 해제
        if let Some(cf_url) = CFURL::from_path(font_path, false) {
            unsafe {
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 2, std::ptr::null_mut());
                CTFontManagerUnregisterFontsForURL(cf_url.as_concrete_TypeRef(), 1, std::ptr::null_mut());
            }
        }

        std::fs::remove_file(font_path).map_err(|e| format!("Failed to delete font file: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn install_font(src_path: &PathBuf) -> Result<PathBuf, String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::AddFontResourceExW;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
        };

        if !src_path.exists() || !src_path.is_file() {
            return Err(format!("Font file not found: {:?}", src_path));
        }

        // 설치 전 원본 파일의 임시 활성화를 먼저 해제하여 충돌 방지
        let _ = Self::deactivate_font(src_path);

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

        if src_path != &target_path {
            std::fs::copy(src_path, &target_path).map_err(|e| e.to_string())?;
        }

        let mut wide: Vec<u16> = target_path.as_os_str().encode_wide().collect();
        wide.push(0);

        let res = unsafe { AddFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) };
        if res == 0 {
            let _ = std::fs::remove_file(&target_path);
            return Err("AddFontResourceExW failed to register installed font".to_string());
        }

        unsafe {
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_FONTCHANGE,
                0,
                0,
                SMTO_ABORTIFHUNG,
                1000,
                std::ptr::null_mut(),
            );
        }

        Ok(target_path)
    }

    #[cfg(target_os = "windows")]
    pub fn uninstall_font(font_path: &PathBuf) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{RemoveFontResourceExW, FR_PRIVATE};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
        };

        if !font_path.exists() {
            return Err("Font file does not exist".to_string());
        }

        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to get LOCALAPPDATA".to_string())?;
        let user_fonts_dir = PathBuf::from(local_app_data).join(r"Microsoft\Windows\Fonts");

        let canonical_font = font_path.canonicalize().unwrap_or_else(|_| font_path.clone());
        let canonical_user_dir = user_fonts_dir.canonicalize().unwrap_or_else(|_| user_fonts_dir.clone());

        if !canonical_font.starts_with(&canonical_user_dir) {
            return Err("Cannot uninstall system-protected font".to_string());
        }

        let mut wide: Vec<u16> = font_path.as_os_str().encode_wide().collect();
        wide.push(0);

        unsafe {
            RemoveFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut());
            RemoveFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut());
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_FONTCHANGE,
                0,
                0,
                SMTO_ABORTIFHUNG,
                1000,
                std::ptr::null_mut(),
            );
        }

        std::fs::remove_file(font_path).map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn install_font(_src_path: &PathBuf) -> Result<PathBuf, String> {
        Err("Unsupported platform for font installation".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn uninstall_font(_font_path: &PathBuf) -> Result<(), String> {
        Err("Unsupported platform for font uninstallation".to_string())
    }

    #[cfg(target_os = "windows")]
    pub fn activate_font(path: &PathBuf) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{AddFontResourceExW, FR_PRIVATE};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
        };

        if !path.exists() || !path.is_file() {
            return Err(format!("Font file not found: {:?}", path));
        }

        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);

        // fl = 0: 시스템 전체(타 그래픽 툴 등)에서 사용할 수 있도록 등록
        let res = unsafe { AddFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) };
        let success = if res > 0 {
            true
        } else {
            // 실패 시 FR_PRIVATE로 폴백
            unsafe { AddFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) > 0 }
        };

        if success {
            // 타 프로그램(Photoshop, Illustrator, Word 등)에 폰트 테이블 변경 브로드캐스트
            unsafe {
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_FONTCHANGE,
                    0,
                    0,
                    SMTO_ABORTIFHUNG,
                    1000,
                    std::ptr::null_mut(),
                );
            }
            Ok(())
        } else {
            Err("AddFontResourceExW failed to register font".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    pub fn deactivate_font(path: &PathBuf) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Graphics::Gdi::{RemoveFontResourceExW, FR_PRIVATE};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE,
        };

        if !path.exists() {
            return Ok(());
        }

        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);

        let res_public = unsafe { RemoveFontResourceExW(wide.as_ptr(), 0, std::ptr::null_mut()) };
        let res_private = unsafe { RemoveFontResourceExW(wide.as_ptr(), FR_PRIVATE, std::ptr::null_mut()) };

        if res_public > 0 || res_private > 0 {
            unsafe {
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_FONTCHANGE,
                    0,
                    0,
                    SMTO_ABORTIFHUNG,
                    1000,
                    std::ptr::null_mut(),
                );
            }
        }

        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn activate_font(_path: &PathBuf) -> Result<(), String> {
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    pub fn deactivate_font(_path: &PathBuf) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}


