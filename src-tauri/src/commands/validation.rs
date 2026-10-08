use std::path::{Path, PathBuf};

pub const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[inline]
pub fn is_dangerous_windows_namespace_or_unc(trimmed: &str) -> bool {
    crate::protocol::is_dangerous_windows_namespace_or_unc(trimmed)
}

pub(crate) fn is_protected_system_path(path: &Path) -> bool {
    let posix = crate::protocol::to_posix_normalized_path(path);
    let s = posix.to_string_lossy().to_lowercase();
    let trimmed = s.trim_end_matches('/');

    // 1. 보안/자격증명/시스템 특수 디렉터리 (경로 어느 위치에 있든 즉시 차단)
    for component in posix.components() {
        if let std::path::Component::Normal(c) = component {
            let name = c.to_string_lossy().to_lowercase();
            if matches!(
                name.as_str(),
                ".ssh" | ".aws" | ".gnupg" | ".trash" | "$recycle.bin" | "system volume information"
            ) {
                return true;
            }
        }
    }

    // 2. OS 핵심 시스템 디렉터리 (절대 경로 단위 차단)
    #[cfg(not(target_os = "windows"))]
    {
        let unix_special = [
            "/etc", "/bin", "/sbin", "/usr", "/var", "/dev", "/proc",
            "/sys", "/boot", "/root", "/system", "/private",
        ];
        for p in unix_special {
            if trimmed == p || trimmed.starts_with(&format!("{}/", p)) {
                return true;
            }
        }
        // macOS 가상 마운트 루트 자체만 차단 (하위 /Volumes/MyUSB 등은 통과)
        if trimmed == "/volumes" {
            return true;
        }
    }

    // 3. Windows 시스템 폴더 접근 차단 (크로스 플랫폼 공통 방어)
    let win_special = [
        "windows", "program files", "program files (x86)",
        "programdata", "recovery", "perflogs",
    ];
    for prefix in ["c:/", "d:/", "e:/", "f:/"] {
        for wp in win_special {
            let full = format!("{}{}", prefix, wp);
            if trimmed == full || trimmed.starts_with(&format!("{}/", full)) {
                return true;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // 동적 시스템 환경변수(SystemRoot, ProgramData, ProgramFiles 등) 차단
        for env_key in &["SystemRoot", "WINDIR", "ProgramData", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Ok(val) = std::env::var(env_key) {
                let norm = crate::protocol::to_posix_normalized_path(Path::new(&val)).to_string_lossy().to_lowercase();
                let clean = norm.trim_end_matches('/');
                if !clean.is_empty() && (trimmed == clean || trimmed.starts_with(&format!("{}/", clean))) {
                    return true;
                }
            }
        }
    }

    false
}

pub(crate) fn contains_windows_reserved_device_name(path: &Path) -> bool {
    for component in path.components() {
        if let std::path::Component::Normal(os_name) = component {
            let name = os_name.to_string_lossy().to_uppercase();
            let stem = name.split('.').next().unwrap_or(&name);
            if WINDOWS_RESERVED_NAMES.contains(&stem) {
                return true;
            }
        }
    }
    false
}

pub(crate) fn validate_folder_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
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

    if is_protected_system_path(&path_buf) {
        return Err("ERR_PATH_PROTECTED_DIR".to_string());
    }

    if contains_windows_reserved_device_name(&path_buf) {
        return Err("ERR_PATH_RESERVED_DEVICE".to_string());
    }

    let posix = crate::protocol::to_posix_normalized_path(&path_buf);
    let posix_str = posix.to_string_lossy();
    if posix_str == "/" || (posix_str.len() == 3 && posix_str.ends_with(":/")) {
        return Err("ERR_PATH_ROOT_DRIVE".to_string());
    }

    Ok(posix)
}

pub(crate) fn validate_backup_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("ERR_BACKUP_EMPTY_PATH".to_string());
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

    if is_protected_system_path(&path_buf) {
        return Err("ERR_PATH_PROTECTED_DIR".to_string());
    }

    if contains_windows_reserved_device_name(&path_buf) {
        return Err("ERR_PATH_RESERVED_DEVICE".to_string());
    }

    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if ext != "json" {
        return Err("ERR_BACKUP_INVALID_EXT".to_string());
    }

    Ok(path_buf)
}

pub fn validate_font_file_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("ERR_FONT_PATH_EMPTY".to_string());
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

    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if !["ttf", "otf", "ttc"].contains(&ext.as_str()) {
        return Err("ERR_FONT_UNSUPPORTED_FORMAT".to_string());
    }

    Ok(crate::protocol::to_posix_normalized_path(&path_buf))
}

pub(crate) struct TempFileGuard {
    pub(crate) path: PathBuf,
    pub(crate) active: bool,
}

impl TempFileGuard {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self { path, active: true }
    }

    pub(crate) fn disarm(&mut self) {
        self.active = false;
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.active && self.path.exists() {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_backup_path_valid() {
        let path = "backup.json";
        assert!(validate_backup_path(path).is_ok());

        let path_upper = "DATA.JSON";
        assert!(validate_backup_path(path_upper).is_ok());

        let sub_path = "nested/folder/export.json";
        assert!(validate_backup_path(sub_path).is_ok());
    }

    #[test]
    fn test_validate_backup_path_rejects_non_json() {
        assert!(validate_backup_path("script.sh").is_err());
        assert!(validate_backup_path("payload.bat").is_err());
        assert!(validate_backup_path("program.exe").is_err());
        assert!(validate_backup_path("backup.json.bak").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_traversal() {
        assert!(validate_backup_path("../backup.json").is_err());
        assert!(validate_backup_path("dir/../../secret.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_unc_and_namespaces() {
        assert!(validate_backup_path(r"\\attacker\share\backup.json").is_err());
        assert!(validate_backup_path("//attacker/share/backup.json").is_err());
        assert!(validate_backup_path(r"\\?\UNC\attacker\share\backup.json").is_err());
        assert!(validate_backup_path(r"\??\UNC\attacker\share\backup.json").is_err());
        assert!(validate_backup_path(r"\\?\C:\Windows\backup.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_windows_reserved() {
        assert!(validate_backup_path("CON.json").is_err());
        assert!(validate_backup_path("prn.JSON").is_err());
        assert!(validate_backup_path("folder/aux.json").is_err());
        assert!(validate_backup_path("NUL.json").is_err());
        assert!(validate_backup_path("COM1.json").is_err());
        assert!(validate_backup_path("lpt1.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_invalid_chars() {
        assert!(validate_backup_path("").is_err());
        assert!(validate_backup_path("   ").is_err());
        assert!(validate_backup_path("backup\0.json").is_err());
        assert!(validate_backup_path("backup\n.json").is_err());
    }

    #[test]
    fn test_validate_backup_path_rejects_protected_system_paths() {
        assert!(validate_backup_path("/etc/config.json").is_err());
        assert!(validate_backup_path("/System/Library/Fonts/meta.json").is_err());
        assert!(validate_backup_path("/usr/local/bin/backup.json").is_err());
        assert!(validate_backup_path(r"C:\Windows\System32\drivers.json").is_err());
    }

    #[test]
    fn test_validate_folder_path_valid() {
        let valid1 = "/Users/username/Fonts";
        assert!(validate_folder_path(valid1).is_ok());

        let valid2 = r"D:\Creative\Fonts";
        assert!(validate_folder_path(valid2).is_ok());

        let valid_external = "/Volumes/MyExternalSSD/Fonts";
        assert!(validate_folder_path(valid_external).is_ok());
    }

    #[test]
    fn test_is_protected_system_path_targeted_blocklist() {
        // Sensitive dot/special components
        assert!(is_protected_system_path(Path::new("/Users/user/.ssh")));
        assert!(is_protected_system_path(Path::new(r"C:\Users\user\.aws")));
        assert!(is_protected_system_path(Path::new(r"D:\$Recycle.Bin")));
        assert!(is_protected_system_path(Path::new(r"E:\System Volume Information")));
        assert!(is_protected_system_path(Path::new("/Volumes")));
        assert!(is_protected_system_path(Path::new("/private/etc")));

        // Valid user and external paths must NOT be protected
        assert!(!is_protected_system_path(Path::new("/Volumes/MyExternalSSD/Fonts")));
        assert!(!is_protected_system_path(Path::new("/Users/username/Documents/Fonts")));
        assert!(!is_protected_system_path(Path::new(r"D:\Design\Fonts")));
    }

    #[test]
    fn test_validate_folder_path_rejects_dangerous() {
        // System and root directories
        assert_eq!(validate_folder_path("/").unwrap_err(), "ERR_PATH_ROOT_DRIVE");
        assert_eq!(validate_folder_path("C:/").unwrap_err(), "ERR_PATH_ROOT_DRIVE");
        assert_eq!(validate_folder_path("c:").unwrap_err(), "ERR_PATH_ROOT_DRIVE");
        assert_eq!(validate_folder_path("/etc").unwrap_err(), "ERR_PATH_PROTECTED_DIR");
        assert_eq!(validate_folder_path("/usr/bin").unwrap_err(), "ERR_PATH_PROTECTED_DIR");
        assert_eq!(validate_folder_path(r"C:\Windows").unwrap_err(), "ERR_PATH_PROTECTED_DIR");
        assert_eq!(validate_folder_path(r"C:\Program Files").unwrap_err(), "ERR_PATH_PROTECTED_DIR");

        // Traversal and UNC
        assert_eq!(validate_folder_path("../Fonts").unwrap_err(), "ERR_PATH_TRAVERSAL");
        assert_eq!(validate_folder_path(r"\\attacker\share").unwrap_err(), "ERR_PATH_UNC_NOT_SUPPORTED");
        assert_eq!(validate_folder_path(r"\\?\C:\Fonts").unwrap_err(), "ERR_PATH_UNC_NOT_SUPPORTED");

        // Control characters and empty
        assert_eq!(validate_folder_path("").unwrap_err(), "ERR_PATH_EMPTY");
        assert_eq!(validate_folder_path("   ").unwrap_err(), "ERR_PATH_EMPTY");
        assert_eq!(validate_folder_path("Fonts\0").unwrap_err(), "ERR_PATH_CONTROL_CHARS");

        // Windows reserved devices
        assert_eq!(validate_folder_path("CON").unwrap_err(), "ERR_PATH_RESERVED_DEVICE");
        assert_eq!(validate_folder_path("folder/NUL").unwrap_err(), "ERR_PATH_RESERVED_DEVICE");
    }

    #[test]
    fn test_remove_folder_validation_rejects_root_and_traversal() {
        assert_eq!(validate_folder_path("/").unwrap_err(), "ERR_PATH_ROOT_DRIVE");
        assert_eq!(validate_folder_path("C:/").unwrap_err(), "ERR_PATH_ROOT_DRIVE");
        assert_eq!(validate_folder_path("../").unwrap_err(), "ERR_PATH_TRAVERSAL");
        assert_eq!(validate_folder_path(r"\\attacker\share").unwrap_err(), "ERR_PATH_UNC_NOT_SUPPORTED");
    }

    #[test]
    fn test_validate_font_file_path() {
        // Valid font extensions
        assert!(validate_font_file_path("/Library/Fonts/Arial.ttf").is_ok());
        assert!(validate_font_file_path(r"C:\Windows\Fonts\malgun.ttf").is_ok());
        assert!(validate_font_file_path("/path/to/font.otf").is_ok());
        assert!(validate_font_file_path("/path/to/font.ttc").is_ok());
        assert!(validate_font_file_path("/path/to/font.woff").is_err());
        assert!(validate_font_file_path("/path/to/font.woff2").is_err());

        // Dangerous or non-font paths
        assert!(validate_font_file_path("").is_err());
        assert!(validate_font_file_path(r"\\evil\share\font.ttf").is_err());
        assert!(validate_font_file_path("../font.ttf").is_err());
        assert!(validate_font_file_path("font.exe").is_err());
        assert!(validate_font_file_path("document.pdf").is_err());
        assert!(validate_font_file_path("script.sh").is_err());
        assert!(validate_font_file_path("CON.ttf").is_err());
    }
}
