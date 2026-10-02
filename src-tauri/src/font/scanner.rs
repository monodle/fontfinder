use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::model::{FontMetadata, FontSource};
use super::parser::FontParser;
use crate::db::{Database, FontCacheEntry};
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

        let fonts: Vec<FontMetadata> = font_files
            .into_par_iter()
            .filter_map(|file_path| {
                match FontParser::parse_file(&file_path) {
                    Ok(metadatas) => Some(metadatas),
                    Err(err) => {
                        eprintln!("Warning: skipping unparseable font {:?}: {}", file_path, err);
                        None
                    }
                }
            })
            .flatten()
            .collect();

        Ok(fonts)
    }

    /// 파일 시스템의 폰트 목록을 스캔하여 DB 캐시와 2단계 계층형 증분 동기화
    pub fn sync_directories(
        dirs: &[PathBuf],
        db: &Database,
        return_all: bool,
        progress: Option<&(dyn Fn(usize, usize) + Send + Sync)>,
    ) -> AppResult<Vec<FontMetadata>> {
        // 1. DB 캐시 1회 전량 사전 로딩 (In-Memory Lookup 구성)
        let full_cache = db.get_font_cache_full_entries().unwrap_or_default();
        let mut cache_size_mtime_map: HashMap<String, (u64, i64)> = HashMap::with_capacity(full_cache.len());
        let mut fast_hash_to_cached: HashMap<String, Vec<FontCacheEntry>> = HashMap::new();

        for entry in full_cache.values() {
            cache_size_mtime_map.insert(entry.file_path.clone(), (entry.file_size, entry.mtime));
            fast_hash_to_cached.entry(entry.fast_hash.clone()).or_default().push(entry.clone());
        }

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
        let mut to_parse: Vec<(PathBuf, u64, i64)> = Vec::new();

        for (path, size, mtime) in &discovered_files {
            let path_str = path.to_string_lossy().to_string();
            current_paths.insert(path_str.clone());

            match cache_size_mtime_map.get(&path_str) {
                Some(&(cached_size, cached_mtime)) => {
                    if cached_size != *size || cached_mtime != *mtime {
                        to_parse.push((path.clone(), *size, *mtime));
                    }
                }
                None => {
                    to_parse.push((path.clone(), *size, *mtime));
                }
            }
        }

        // 삭제 대상 파일 캐시 식별
        let mut to_delete = Vec::new();
        for cached_path in cache_size_mtime_map.keys() {
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

        // 1-Pass: 신규/수정 파일 병렬 초고속 1회 순차 읽기 (앞 64~128KB로 1차 지문 + 메타데이터 추출)
        if !to_parse.is_empty() {
            use std::sync::atomic::{AtomicUsize, Ordering};
            let completed_counter = AtomicUsize::new(0);

            let parsed_results: Vec<(Vec<FontMetadata>, u64, i64, String)> = to_parse
                .into_par_iter()
                .filter_map(|(path_buf, file_size, mtime)| {
                    let res = match FontParser::parse_file_fast(&path_buf) {
                        Ok((metas, fast_hash)) => Some((metas, file_size, mtime, fast_hash)),
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
                .collect();

            // 2-Pass: fast_hash 기준 배치 그룹화 및 온디맨드 충돌 해결
            struct NewGroupItem {
                meta: FontMetadata,
                file_size: u64,
                mtime: i64,
            }

            let mut groups: HashMap<String, Vec<NewGroupItem>> = HashMap::new();
            for (metas, file_size, mtime, fast_hash) in parsed_results {
                for meta in metas {
                    groups.entry(fast_hash.clone()).or_default().push(NewGroupItem {
                        meta,
                        file_size,
                        mtime,
                    });
                }
            }

            let mut final_save_items: Vec<(FontMetadata, i64)> = Vec::new();
            let mut existing_deep_updates: Vec<(i64, String)> = Vec::new();

            for (fast_hash, mut new_items) in groups {
                let cached_entries = fast_hash_to_cached.get(&fast_hash);
                let cached_count = cached_entries.map(|v| v.len()).unwrap_or(0);
                let total_group_count = new_items.len() + cached_count;

                if total_group_count == 1 {
                    // 단독 폰트: 중복/충돌 없으므로 2차 지문 계산 절대 스킵 (초고속 등록)
                    for item in new_items {
                        final_save_items.push((item.meta, item.mtime));
                    }
                } else {
                    // 2개 이상 충돌 그룹: 온디맨드 2차 지문 계산
                    // 1) 기존 DB 폰트 중 2차 지문이 아직 없는 파일의 2차 지문 계산
                    if let Some(entries) = cached_entries {
                        for entry in entries {
                            if entry.deep_hash.is_none() || entry.deep_hash.as_ref().map(|s| s.is_empty()).unwrap_or(true) {
                                let p = Path::new(&entry.file_path);
                                if p.exists() {
                                    if let Ok(dh) = FontParser::compute_deep_hash(p, entry.file_size) {
                                        existing_deep_updates.push((entry.id, dh));
                                    }
                                }
                            }
                        }
                    }

                    // 2) 신규 폰트들의 2차 지문 계산
                    for item in &mut new_items {
                        let p = Path::new(&item.meta.file_path);
                        if let Ok(dh) = FontParser::compute_deep_hash(p, item.file_size) {
                            item.meta.deep_hash = Some(dh.clone());
                            item.meta.file_hash = dh;
                        }
                        final_save_items.push((item.meta.clone(), item.mtime));
                    }
                }
            }

            if !final_save_items.is_empty() {
                let _ = db.save_cached_fonts(&final_save_items);
            }
            if !existing_deep_updates.is_empty() {
                let _ = db.update_font_deep_hashes_bulk(&existing_deep_updates);
            }
        }

        if let Some(cb) = progress {
            cb(total_to_parse, total_to_parse);
        }

        // 삭제된 파일 캐시 제거
        if !to_delete.is_empty() {
            let _ = db.delete_cached_fonts_by_paths(&to_delete);
        }

        // 최종 최신 캐시 반환
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
