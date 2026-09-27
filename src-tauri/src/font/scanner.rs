use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::model::{FontMetadata, FontSource};
use super::parser::FontParser;
use crate::db::Database;
use crate::error::{AppError, AppResult};

pub struct FontScanner;

impl FontScanner {
    pub const FONT_EXTENSIONS: &'static [&'static str] = &["ttf", "otf", "ttc", "woff", "woff2"];

    pub fn get_file_mtime(path: &Path) -> i64 {
        std::fs::metadata(path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    pub fn scan_directory<P: AsRef<Path>>(dir_path: P) -> AppResult<Vec<FontMetadata>> {
        let path = dir_path.as_ref();
        if !path.exists() {
            return Err(AppError::InvalidPath(format!(
                "Directory does not exist: {}",
                path.display()
            )));
        }

        // 폰트 파일 경로 수집
        let font_files: Vec<PathBuf> = WalkDir::new(path)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                if !entry.file_type().is_file() {
                    return false;
                }
                let ext = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();
                Self::FONT_EXTENSIONS.contains(&ext.as_str())
            })
            .map(|entry| entry.into_path())
            .collect();

        // Rayon 병렬 파싱
        let fonts: Vec<FontMetadata> = font_files
            .into_par_iter()
            .filter_map(|file_path| {
                match FontParser::parse_file(&file_path) {
                    Ok(metadatas) => Some(metadatas),
                    Err(err) => {
                        // 손상된 폰트 파일은 경고 로그 후 건너뜀
                        eprintln!("Warning: skipping unparseable font {:?}: {}", file_path, err);
                        None
                    }
                }
            })
            .flatten()
            .collect();

        Ok(fonts)
    }

    /// 파일 시스템의 폰트 목록을 스캔하여 DB 캐시와 증분(Incremental) 동기화
    pub fn sync_directories(
        dirs: &[PathBuf],
        db: &Database,
        return_all: bool,
        progress: Option<&(dyn Fn(usize, usize) + Send + Sync)>,
    ) -> AppResult<Vec<FontMetadata>> {
        let cache_map = db.get_font_cache_entries().unwrap_or_default();

        let mut discovered_files: Vec<(PathBuf, u64, i64)> = Vec::new();
        let mut valid_root_dirs = Vec::new();

        for dir in dirs {
            if !dir.exists() {
                continue;
            }
            valid_root_dirs.push(dir.clone());

            for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();

                if Self::FONT_EXTENSIONS.contains(&ext.as_str()) {
                    if let Ok(meta) = entry.metadata() {
                        let size = meta.len();
                        let mtime = meta
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);
                        discovered_files.push((path.to_path_buf(), size, mtime));
                    }
                }
            }
        }

        let mut current_paths = HashSet::with_capacity(discovered_files.len());
        let mut to_parse: Vec<(PathBuf, i64)> = Vec::new();

        for (path, size, mtime) in &discovered_files {
            let path_str = path.to_string_lossy().to_string();
            current_paths.insert(path_str.clone());

            match cache_map.get(&path_str) {
                Some(&(cached_size, cached_mtime)) => {
                    if cached_size != *size || cached_mtime != *mtime {
                        to_parse.push((path.clone(), *mtime));
                    }
                }
                None => {
                    to_parse.push((path.clone(), *mtime));
                }
            }
        }

        // 삭제 대상 파일 식별:
        // 유효한 디렉토리(valid_root_dirs) 하위에 있던 캐시 경로이지만,
        // 현재 발견 목록에 없고 실제 파일도 존재하지 않는 경우만 안전하게 삭제
        let mut to_delete = Vec::new();
        for cached_path in cache_map.keys() {
            let path_ref = Path::new(cached_path);
            let belongs_to_valid_dir = valid_root_dirs.iter().any(|root| crate::protocol::is_same_or_subpath(root, path_ref));
            if belongs_to_valid_dir && !current_paths.contains(cached_path) && !path_ref.exists() {
                to_delete.push(cached_path.clone());
            }
        }

        let total_to_parse = to_parse.len();
        if let Some(cb) = progress {
            cb(0, total_to_parse);
        }

        // 변경되거나 새로운 파일만 병렬 파싱
        if !to_parse.is_empty() {
            use std::sync::atomic::{AtomicUsize, Ordering};
            let completed_counter = AtomicUsize::new(0);

            let parsed_items: Vec<(FontMetadata, i64)> = to_parse
                .into_par_iter()
                .filter_map(|(path_buf, mtime)| {
                    let res = match FontParser::parse_file(&path_buf) {
                        Ok(metadatas) => {
                            let items: Vec<(FontMetadata, i64)> = metadatas
                                .into_iter()
                                .map(|m| (m, mtime))
                                .collect();
                            Some(items)
                        }
                        Err(err) => {
                            eprintln!("Warning: skipping unparseable font {:?}: {}", path_buf, err);
                            None
                        }
                    };

                    if let Some(cb) = progress {
                        let cur = completed_counter.fetch_add(1, Ordering::Relaxed) + 1;
                        if cur % 15 == 0 || cur == total_to_parse {
                            cb(cur, total_to_parse);
                        }
                    }

                    res
                })
                .flatten()
                .collect();

            if !parsed_items.is_empty() {
                let _ = db.save_cached_fonts(&parsed_items);
            }
        }

        if let Some(cb) = progress {
            cb(total_to_parse, total_to_parse);
        }

        // 삭제된 파일 캐시 제거
        if !to_delete.is_empty() {
            let _ = db.delete_cached_fonts_by_paths(&to_delete);
        }

        // 최종 최신 캐시 반환:
        // dirs(시스템 폰트 디렉토리 + 현재 유효 감시 폴더)에 실제로 속하는 활성 폰트만 필터링하여 반환.
        // 이미 삭제/제거된 폴더의 세트 보존 고아 캐시는 sync_directories 반환값에서 제외되어야 함.
        if dirs.len() == 1 && !return_all {
            let prefix = dirs[0].to_string_lossy().to_string();
            db.get_cached_fonts_by_prefix(&prefix)
        } else {
            let all = db.get_all_cached_fonts()?;
            let filtered = all
                .into_iter()
                .filter(|f| {
                    if f.source == FontSource::System || f.source == FontSource::User {
                        return true;
                    }
                    let p = Path::new(&f.file_path);
                    dirs.iter().any(|d| crate::protocol::is_same_or_subpath(d, p))
                })
                .collect();
            Ok(filtered)
        }
    }

    pub fn scan_files(paths: &[PathBuf]) -> Vec<FontMetadata> {
        paths
            .par_iter()
            .filter_map(|path| FontParser::parse_file(path).ok())
            .flatten()
            .collect()
    }
}
