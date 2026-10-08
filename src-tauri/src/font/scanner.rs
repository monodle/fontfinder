use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::model::{FontMetadata, FontSource};
use super::parser::FontParser;
use crate::db::{Database, FontCacheEntry};
use crate::error::{AppError, AppResult};
use crate::platform::Platform;

pub struct FontScanner;

impl FontScanner {
    pub const FONT_EXTENSIONS: &'static [&'static str] = &["ttf", "otf", "ttc"];

    pub fn get_file_mtime(path: &Path) -> i64 {
        std::fs::metadata(path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
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
                let file_type = entry.file_type();
                let path = entry.path();
                let is_regular_file = file_type.is_file() || (file_type.is_symlink() && path.is_file());
                if !is_regular_file {
                    return false;
                }
                let file_name = entry.file_name().to_string_lossy();
                if file_name.starts_with("._") || file_name.starts_with('.') {
                    return false;
                }
                let ext = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();
                if !Self::FONT_EXTENSIONS.contains(&ext.as_str()) {
                    return false;
                }
                match std::fs::metadata(path) {
                    Ok(meta) => {
                        let len = meta.len();
                        len > 0 && len <= crate::protocol::MAX_FONT_FILE_SIZE
                    }
                    Err(_) => false,
                }
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
        Self::sync_directories_with_options(dirs, db, return_all, false, progress)
    }

    /// 옵션(강제 재스캔 등)을 지정하여 파일 시스템의 폰트 목록과 DB 캐시를 원자적으로 동기화
    pub fn sync_directories_with_options(
        dirs: &[PathBuf],
        db: &Database,
        return_all: bool,
        force_rescan: bool,
        progress: Option<&(dyn Fn(usize, usize) + Send + Sync)>,
    ) -> AppResult<Vec<FontMetadata>> {
        // 1. DB 캐시 1회 전량 사전 로딩 (오류 발생 시 실패 즉시 전파)
        let full_cache = db.get_font_cache_full_entries()?;
        let mut cache_by_path: HashMap<String, Vec<FontCacheEntry>> = HashMap::with_capacity(full_cache.len());
        let mut fast_hash_to_cached: HashMap<String, Vec<FontCacheEntry>> = HashMap::new();

        for entry in full_cache.values() {
            let posix_path = crate::protocol::to_posix_normalized_path(Path::new(&entry.file_path));
            let path_key = posix_path.to_string_lossy().to_string();
            cache_by_path.entry(path_key).or_default().push(entry.clone());
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
                let file_type = entry.file_type();
                let path = entry.path();
                let is_regular_file = file_type.is_file() || (file_type.is_symlink() && path.is_file());
                if !is_regular_file {
                    continue;
                }

                let file_name = entry.file_name().to_string_lossy();
                if file_name.starts_with("._") || file_name.starts_with('.') {
                    continue;
                }

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();

                if Self::FONT_EXTENSIONS.contains(&ext.as_str()) {
                    if let Ok(meta) = std::fs::metadata(path) {
                        let size = meta.len();
                        if size > 0 && size <= crate::protocol::MAX_FONT_FILE_SIZE {
                            let mtime = meta
                                .modified()
                                .ok()
                                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                                .map(|d| d.as_millis() as i64)
                                .unwrap_or(0);
                            discovered_files.push((path.to_path_buf(), size, mtime));
                        }
                    }
                }
            }
        }

        let mut current_paths = HashSet::with_capacity(discovered_files.len());
        let mut to_parse: Vec<(PathBuf, u64, i64)> = Vec::new();

        for (path, size, mtime) in &discovered_files {
            let posix_path = crate::protocol::to_posix_normalized_path(path);
            let path_str: String = posix_path.to_string_lossy().to_string();
            current_paths.insert(path_str.clone());

            let current_source = Platform::classify_font_source(path);
            let source_str = match current_source {
                FontSource::System => "system",
                FontSource::User => "user",
                FontSource::External => "external",
            };

            if force_rescan {
                to_parse.push((path.clone(), *size, *mtime));
                continue;
            }

            match cache_by_path.get(&path_str) {
                Some(entries) => {
                    let first = &entries[0];
                    let is_size_match = first.file_size == *size;
                    let is_source_match = first.source == source_str;
                    let has_localized = entries.iter().all(|e| e.has_localized);

                    if !is_size_match || !is_source_match || !has_localized {
                        to_parse.push((path.clone(), *size, *mtime));
                    } else if first.mtime == *mtime {
                        // 완전 일치: 캐시 유효
                    } else {
                        // mtime 불일치: 초 단위 구버전 캐시이거나 파일이 수정되었으므로 최초 1회 안전하게 재파싱
                        to_parse.push((path.clone(), *size, *mtime));
                    }
                }
                None => {
                    to_parse.push((path.clone(), *size, *mtime));
                }
            }
        }

        // 삭제 대상 파일 캐시 식별 (Primary Key id 수집)
        // 방어적 정책:
        // 1) 실제로 디스크에 존재하지 않음이 확인된 파일 (ErrorKind::NotFound만 명시적 삭제)
        // 2) 디스크에 존재하지만 0바이트, 용량 초과, 비폰트 확장자로 변경되어 유효하지 않은 파일
        // ※ PermissionDenied, USB I/O 타임아웃 등 일시적 접근 에러 시에는 캐시를 안전하게 보존
        let mut to_delete_ids = Vec::new();
        for entry in full_cache.values() {
            let posix_path = crate::protocol::to_posix_normalized_path(Path::new(&entry.file_path));
            let cached_key = posix_path.to_string_lossy().to_string();
            let path_ref = Path::new(&entry.file_path);
            let belongs_to_valid_dir = valid_root_dirs.iter().any(|root| crate::protocol::is_same_or_subpath(root, path_ref));
            if belongs_to_valid_dir && !current_paths.contains(&cached_key) {
                match std::fs::metadata(path_ref) {
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                        // 파일이 실제로 디스크에 없음이 명확히 확인됨
                        to_delete_ids.push(entry.id);
                    }
                    Ok(meta) => {
                        let len = meta.len();
                        let ext = path_ref
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| e.to_lowercase())
                            .unwrap_or_default();
                        if len == 0 || len > crate::protocol::MAX_FONT_FILE_SIZE || !Self::FONT_EXTENSIONS.contains(&ext.as_str()) {
                            to_delete_ids.push(entry.id);
                        }
                    }
                    Err(_) => {
                        // 권한 거부, USB 일시 끊김 등 기타 I/O 오류: 안전을 위해 캐시 보존
                    }
                }
            }
        }

        let total_to_parse = to_parse.len();
        if let Some(cb) = progress {
            cb(0, total_to_parse);
        }

        let mut final_save_items: Vec<(FontMetadata, i64)> = Vec::new();
        let mut existing_deep_updates: Vec<(i64, String)> = Vec::new();

        // 1-Pass: 신규/수정 파일 병렬 초고속 1회 순차 읽기 (앞 64~128KB로 1차 지문 + 메타데이터 추출)
        if !to_parse.is_empty() {
            use std::sync::atomic::{AtomicUsize, Ordering};
            let completed_counter = AtomicUsize::new(0);

            let (parsed_results, failed_paths): (Vec<(Vec<FontMetadata>, u64, i64, String)>, Vec<PathBuf>) = to_parse
                .into_par_iter()
                .partition_map(|(path_buf, file_size, mtime)| {
                    let parse_res = FontParser::parse_file_fast(&path_buf);

                    if let Some(cb) = progress {
                        let cur = completed_counter.fetch_add(1, Ordering::Relaxed) + 1;
                        if cur.is_multiple_of(15) || cur == total_to_parse {
                            cb(cur, total_to_parse);
                        }
                    }

                    match parse_res {
                        Ok((metas, fast_hash)) => rayon::iter::Either::Left((metas, file_size, mtime, fast_hash)),
                        Err(err) => {
                            eprintln!("Warning: skipping font {:?}: {}", path_buf, err);
                            // 일시적 I/O 에러(권한, USB 일시 끊김 등)는 캐시를 삭제하지 않고 보존
                            // 명시적인 파싱 오류(FontParse 등 내용 손상)일 때만 삭제 후보로 수집
                            match err {
                                AppError::FontParse(_) => rayon::iter::Either::Right(path_buf),
                                _ => rayon::iter::Either::Right(PathBuf::new()),
                            }
                        }
                    }
                });

            // 포맷 손상이 확인된 파일이 기존 DB에 캐시되어 있었다면 즉시 삭제 대상에 등록
            for failed_path in failed_paths {
                if failed_path.as_os_str().is_empty() {
                    continue;
                }
                let posix_path = crate::protocol::to_posix_normalized_path(&failed_path);
                let key = posix_path.to_string_lossy().to_string();
                if let Some(entries) = cache_by_path.get(&key) {
                    for entry in entries {
                        to_delete_ids.push(entry.id);
                    }
                }
            }

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

            for (fast_hash, new_items) in groups {
                let cached_entries = fast_hash_to_cached.get(&fast_hash);
                let cached_count = cached_entries.map_or(0, Vec::len);
                let total_group_count = new_items.len() + cached_count;

                if total_group_count == 1 {
                    // 단독 폰트: 중복/충돌 없으므로 2차 지문 계산 스킵 (초고속 등록)
                    final_save_items.extend(new_items.into_iter().map(|item| (item.meta, item.mtime)));
                } else {
                    // 2개 이상 충돌 그룹: 온디맨드 2차 지문 계산
                    // 1) 기존 DB 폰트 중 2차 지문이 아직 없는 파일의 계산 (선언적 이터레이터 파이프라인)
                    if let Some(entries) = cached_entries {
                        existing_deep_updates.extend(
                            entries
                                .iter()
                                .filter(|e| e.deep_hash.as_deref().unwrap_or("").is_empty())
                                .filter_map(|e| {
                                    let path = Path::new(&e.file_path);
                                    let dh = FontParser::compute_deep_hash(path, e.file_size).ok()?;
                                    Some((e.id, dh))
                                }),
                        );
                    }

                    // 2) 신규 폰트들의 2차 지문 계산 및 반영 (move 기반 소유권 전이)
                    for mut item in new_items {
                        let path = Path::new(&item.meta.file_path);
                        if let Ok(dh) = FontParser::compute_deep_hash(path, item.file_size) {
                            item.meta.deep_hash = Some(dh.clone());
                            item.meta.file_hash = dh;
                        }
                        final_save_items.push((item.meta, item.mtime));
                    }
                }
            }
        }

        if let Some(cb) = progress {
            cb(total_to_parse, total_to_parse);
        }

        // 3. 단일 트랜잭션으로 원자적 커밋 (UPSERT + 딥해시 갱신 + 삭제)
        // 오류 발생 시 전체 롤백 및 에러 즉시 전파
        db.apply_font_cache_sync(
            &final_save_items,
            &existing_deep_updates,
            &to_delete_ids,
        )?;

        // 최종 최신 캐시 반환
        if dirs.len() == 1 && !return_all {
            let prefix = crate::protocol::to_posix_normalized_path(&dirs[0]).to_string_lossy().to_string();
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
