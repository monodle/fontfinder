use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use sha2::{Digest, Sha256};
use ttf_parser::{name_id, Face};
use xxhash_rust::xxh3::Xxh3;

use super::model::{
    FontDetailedInfo, FontFormat, FontLanguageCoverage, FontMetadata, FontMetricsRecord,
    FontNameRecord, FontOs2Record, FontVariableAxis, FontVariableInfo,
};
use crate::error::{AppError, AppResult};
use crate::platform::Platform;

pub struct FontParser;

impl FontParser {
    /// 1차 초고속 지문 (Fast Fingerprint):
    /// 파일 앞 32KB 내 OpenType/TrueType Table Directory(체크섬, 길이) 및 파일 크기를 xxh3_128로 해싱
    pub fn compute_fast_hash(header_data: &[u8], file_size: u64) -> String {
        let mut hasher = Xxh3::new();

        // OpenType 헤더 검사 (최소 12바이트)
        let is_sfnt = if header_data.len() >= 12 {
            let num_tables = u16::from_be_bytes([header_data[4], header_data[5]]) as usize;
            let directory_size = 12 + num_tables * 16;
            if num_tables > 0 && num_tables <= 100 && header_data.len() >= directory_size {
                // Table Directory (각 16바이트: tag 4B, checksum 4B, offset 4B, length 4B)
                // 글리프 내용을 일일이 읽지 않아도 헤더의 32비트 체크섬과 길이 정보로 고유성 보장
                for i in 0..num_tables {
                    let entry_start = 12 + i * 16;
                    let tag = &header_data[entry_start..entry_start + 4];
                    let checksum = &header_data[entry_start + 4..entry_start + 8];
                    let length = &header_data[entry_start + 12..entry_start + 16];
                    hasher.update(tag);
                    hasher.update(checksum);
                    hasher.update(length);
                }
                true
            } else {
                false
            }
        } else {
            false
        };

        if !is_sfnt {
            // TTC/WOFF 또는 일반 바이너리 Fallback: 읽어온 버퍼 전체 슬라이스 해싱
            hasher.update(header_data);
        }

        // 파일 전체 크기 결합 (고유 시드)
        hasher.update(&file_size.to_le_bytes());

        let digest = hasher.digest128();
        format!("{:032x}", digest)
    }

    /// 2차 온디맨드 정밀 지문 (Deep Fingerprint):
    /// - 256KB 이하: 1회 일괄 읽기 (Seek 0회)
    /// - 256KB 초과: 헤더 32KB(Seek 0) + 중간 1/3(64KB, Seek 1) + 중간 2/3(64KB, Seek 2) + 테일 32KB(Seek 3)
    /// 총 3번의 Seek만으로 192KB 핵심 표본 + 파일 크기를 SHA-256 해싱하여 I/O 오버헤드를 극적으로 단축
    pub fn compute_deep_hash<P: AsRef<Path>>(path: P, file_size: u64) -> AppResult<String> {
        let mut file = File::open(path)?;
        let mut hasher = Sha256::new();
        let total_sample_threshold = 262_144; // 256KB

        if file_size <= total_sample_threshold as u64 {
            let mut buffer = Vec::with_capacity(file_size as usize);
            file.read_to_end(&mut buffer)?;
            hasher.update(&buffer);
        } else {
            // ① 시작 헤더 (32KB, 파일 오픈 직후이므로 Seek 0회 순차 읽기)
            let head_block = 32_768; // 32KB
            let mut head_chunk = vec![0u8; head_block];
            file.read_exact(&mut head_chunk)?;
            hasher.update(&head_chunk);

            // ② 중간 1지점 (파일의 약 1/3 지점, 64KB, Seek 1회)
            let mid_block = 65_536; // 64KB
            let mut mid_chunk = vec![0u8; mid_block];
            let pos1 = (file_size / 3).saturating_sub((mid_block / 2) as u64);
            file.seek(SeekFrom::Start(pos1))?;
            let n1 = file.read(&mut mid_chunk)?;
            hasher.update(&mid_chunk[..n1]);

            // ③ 중간 2지점 (파일의 약 2/3 지점, 64KB, Seek 2회)
            let pos2 = ((file_size * 2) / 3).saturating_sub((mid_block / 2) as u64);
            file.seek(SeekFrom::Start(pos2))?;
            let n2 = file.read(&mut mid_chunk)?;
            hasher.update(&mid_chunk[..n2]);

            // ④ 끝 테일 (32KB, Seek 3회)
            let tail_block = 32_768; // 32KB
            let mut tail_chunk = vec![0u8; tail_block];
            let tail_start = file_size.saturating_sub(tail_block as u64);
            file.seek(SeekFrom::Start(tail_start))?;
            let n3 = file.read(&mut tail_chunk)?;
            hasher.update(&tail_chunk[..n3]);

            // ⑤ 파일 전체 크기 바이트 일치 보장
            hasher.update(&file_size.to_le_bytes());
        }

        let result = hasher.finalize();
        let mut s = String::with_capacity(64);
        for b in result {
            use std::fmt::Write;
            let _ = write!(&mut s, "{:02x}", b);
        }
        Ok(s)
    }

    /// 파일 앞 64~128KB 1회 순차 읽기만으로 1차 지문 + 메타데이터 추출 동시 종결
    pub fn parse_file_fast<P: AsRef<Path>>(path: P) -> AppResult<(Vec<FontMetadata>, String)> {
        let path_ref = path.as_ref();
        if !path_ref.is_file() {
            return Err(AppError::InvalidPath(format!(
                "Path is not a regular file: {}",
                path_ref.display()
            )));
        }

        let metadata = std::fs::metadata(path_ref)?;
        let file_size = metadata.len();
        let file_name = path_ref
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let file_path = crate::protocol::to_posix_normalized_path(path_ref)
            .to_string_lossy()
            .to_string();

        let ext = path_ref
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let default_format = match ext.as_str() {
            "ttf" => FontFormat::TrueType,
            "otf" => FontFormat::OpenType,
            "ttc" => FontFormat::TrueTypeCollection,
            "woff" => FontFormat::Woff,
            "woff2" => FontFormat::Woff2,
            _ => FontFormat::Unknown,
        };

        let mut file = File::open(path_ref)?;
        // 앞 128KB 1회 순차 버퍼링
        let prefix_limit = (131_072 as u64).min(file_size) as usize;
        let mut prefix_buf = vec![0u8; prefix_limit];
        file.read_exact(&mut prefix_buf)?;

        // 1차 지문 계산 (앞 32KB 표본 + 파일 크기)
        let sample_len = prefix_buf.len().min(32_768);
        let fast_hash = Self::compute_fast_hash(&prefix_buf[..sample_len], file_size);

        // fontTools 방식 핀포인트 검사: name 테이블 위치 확인
        let name_bounds = Self::find_table_bounds(&prefix_buf, b"name");
        let raw_name_table = if let Some((offset, length)) = name_bounds {
            if offset + length > prefix_limit && length > 0 && length < 10_000_000 && (offset as u64 + length as u64) <= file_size {
                // 128KB 범위를 초과하는 대형 CJK 폰트: 전체를 읽지 않고 오직 name 테이블(수 KB)만 핀포인트 seek & read
                if file.seek(SeekFrom::Start(offset as u64)).is_ok() {
                    let mut name_buf = vec![0u8; length];
                    if file.read_exact(&mut name_buf).is_ok() {
                        Some(name_buf)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        // 128KB 버퍼 + 핀포인트 name_table로 Face 메타데이터 파싱 시도
        match Self::parse_bytes_with_hash_and_names(
            &prefix_buf,
            &file_path,
            &file_name,
            file_size,
            default_format.clone(),
            &fast_hash,
            raw_name_table.as_deref(),
        ) {
            Ok(results) => Ok((results, fast_hash)),
            Err(_) => {
                // 메타데이터 테이블이 128KB 범위를 초과하거나 손상된 특수 폰트 대상 Fallback:
                // 대용량 비-폰트 바이너리 인입으로 인한 OOM(메모리 고갈) 방어
                if file_size > crate::protocol::MAX_FONT_FILE_SIZE {
                    return Err(AppError::FontParse(format!(
                        "Font file size exceeds maximum limit ({} MB)",
                        crate::protocol::MAX_FONT_FILE_SIZE / (1024 * 1024)
                    )));
                }
                file.seek(SeekFrom::Start(0))?;
                let mut full_buf = Vec::with_capacity(file_size.min(crate::protocol::MAX_FONT_FILE_SIZE) as usize);
                file.take(crate::protocol::MAX_FONT_FILE_SIZE + 1).read_to_end(&mut full_buf)?;
                let results = Self::parse_bytes_with_hash_and_names(
                    &full_buf,
                    &file_path,
                    &file_name,
                    file_size,
                    default_format,
                    &fast_hash,
                    None,
                )?;
                Ok((results, fast_hash))
            }
        }
    }

    pub fn parse_file<P: AsRef<Path>>(path: P) -> AppResult<Vec<FontMetadata>> {
        let (fonts, _) = Self::parse_file_fast(path)?;
        Ok(fonts)
    }

    pub fn parse_bytes(
        data: &[u8],
        file_path: &str,
        file_name: &str,
        file_size: u64,
        format: FontFormat,
    ) -> AppResult<Vec<FontMetadata>> {
        let sample_len = data.len().min(32_768);
        let fast_hash = Self::compute_fast_hash(&data[..sample_len], file_size);
        Self::parse_bytes_with_hash(data, file_path, file_name, file_size, format, &fast_hash)
    }

    pub fn parse_bytes_with_hash(
        data: &[u8],
        file_path: &str,
        file_name: &str,
        file_size: u64,
        format: FontFormat,
        fast_hash: &str,
    ) -> AppResult<Vec<FontMetadata>> {
        Self::parse_bytes_with_hash_and_names(data, file_path, file_name, file_size, format, fast_hash, None)
    }

    pub fn parse_bytes_with_hash_and_names(
        data: &[u8],
        file_path: &str,
        file_name: &str,
        file_size: u64,
        format: FontFormat,
        fast_hash: &str,
        raw_name_table: Option<&[u8]>,
    ) -> AppResult<Vec<FontMetadata>> {
        let num_fonts = ttf_parser::fonts_in_collection(data).unwrap_or(1);
        let mut results = Vec::with_capacity(num_fonts as usize);

        for font_index in 0..num_fonts {
            let face = match Face::parse(data, font_index) {
                Ok(f) => f,
                Err(e) => {
                    if num_fonts == 1 {
                        return Err(AppError::FontParse(format!(
                            "Failed to parse font '{}' index {}: {:?}",
                            file_name, font_index, e
                        )));
                    }
                    continue;
                }
            };

            // 1. Face::names()에서 localized_names와 기본 이름들 추출
            let mut localized_names = Self::extract_localized_names(&face);
            let mut face_family = Self::extract_best_name(&face, name_id::TYPOGRAPHIC_FAMILY)
                .or_else(|| Self::extract_best_name(&face, name_id::FAMILY));
            let mut face_subfamily = Self::extract_best_name(&face, name_id::TYPOGRAPHIC_SUBFAMILY)
                .or_else(|| Self::extract_best_name(&face, name_id::SUBFAMILY));
            let mut face_full = Self::extract_best_name(&face, name_id::FULL_NAME);
            let mut face_ps = Self::extract_best_name(&face, name_id::POST_SCRIPT_NAME);
            let mut face_version = Self::extract_best_name(&face, name_id::VERSION);
            let mut face_designer = Self::extract_best_name(&face, name_id::DESIGNER);
            let mut face_copyright = Self::extract_best_name(&face, name_id::COPYRIGHT_NOTICE);
            let mut face_license = Self::extract_best_name(&face, name_id::LICENSE);

            // 2. 만약 raw_name_table이 제공되었거나 face_family가 없는 경우, 핀포인트 파싱 결과로 보강
            if let Some(name_bytes) = raw_name_table {
                let parsed_names = parse_raw_name_table(name_bytes);
                for (k, v) in parsed_names.localized_names {
                    localized_names.entry(k).or_insert(v);
                }
                if face_family.is_none() {
                    face_family = parsed_names.family_name;
                }
                if face_subfamily.is_none() {
                    face_subfamily = parsed_names.subfamily_name;
                }
                if face_full.is_none() {
                    face_full = parsed_names.full_name;
                }
                if face_ps.is_none() {
                    face_ps = parsed_names.postscript_name;
                }
                if face_version.is_none() {
                    face_version = parsed_names.version;
                }
                if face_designer.is_none() {
                    face_designer = parsed_names.designer;
                }
                if face_copyright.is_none() {
                    face_copyright = parsed_names.copyright;
                }
                if face_license.is_none() {
                    face_license = parsed_names.license;
                }
            }

            let family_name = face_family.unwrap_or_else(|| path_to_display_name(file_name));
            let subfamily_name = face_subfamily.unwrap_or_else(|| "Regular".to_string());
            let full_name = face_full.unwrap_or_else(|| format!("{} {}", family_name, subfamily_name));
            let postscript_name = face_ps.unwrap_or_else(|| {
                format!("{}-{}", family_name.replace(' ', ""), subfamily_name.replace(' ', ""))
            });

            let version = face_version;
            let version_num = Self::extract_version_num(&face, version.as_deref());
            let designer = face_designer;
            let copyright = face_copyright;
            let license = face_license;

            let glyph_count = face.number_of_glyphs();
            let weight = face.weight().to_number();
            let is_italic = face.is_italic();
            let is_monospace = face.is_monospaced();
            let is_variable = face.is_variable();

            let source = Platform::classify_font_source(Path::new(file_path));
            let localized_names_opt = if localized_names.is_empty() {
                None
            } else {
                Some(localized_names)
            };

            results.push(FontMetadata {
                id: 0, // DB 저장 시 auto_increment id 부여
                file_path: file_path.to_string(),
                file_name: file_name.to_string(),
                file_size,
                file_hash: fast_hash.to_string(),
                fast_hash: fast_hash.to_string(),
                deep_hash: None,
                duplicate_count: 1,
                font_index,
                family_name,
                subfamily_name,
                full_name,
                postscript_name,
                localized_names: localized_names_opt,
                format: format.clone(),
                source,
                glyph_count,
                weight,
                is_italic,
                is_monospace,
                is_variable,
                version,
                version_num,
                designer,
                copyright,
                license,
            });
        }

        if results.is_empty() {
            return Err(AppError::FontParse(format!(
                "No valid faces found in font: {}",
                file_name
            )));
        }

        Ok(results)
    }

    pub fn extract_glyphs<P: AsRef<Path>>(path: P, font_index: u32) -> AppResult<Vec<super::model::GlyphItem>> {
        let mut file = File::open(path.as_ref())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        let face = Face::parse(&buffer, font_index)
            .map_err(|e| AppError::FontParse(format!("Failed to parse font for glyphs: {:?}", e)))?;

        let mut glyphs = Vec::new();
        let mut seen = std::collections::HashSet::new();

        if let Some(cmap) = face.tables().cmap {
            for subtable in cmap.subtables {
                if !subtable.is_unicode() {
                    continue;
                }
                subtable.codepoints(|codepoint| {
                    if let Some(ch) = char::from_u32(codepoint) {
                        if seen.insert(codepoint) {
                            if let Some(glyph_id) = face.glyph_index(ch) {
                                glyphs.push(super::model::GlyphItem {
                                    unicode: codepoint,
                                    char_str: ch.to_string(),
                                    glyph_id: glyph_id.0,
                                });
                            }
                        }
                    }
                });
            }
        }

        glyphs.sort_by_key(|g| g.unicode);
        Ok(glyphs)
    }

    pub fn find_table_bounds(header_data: &[u8], tag_to_find: &[u8; 4]) -> Option<(usize, usize)> {
        if header_data.len() < 12 {
            return None;
        }

        let tag = &header_data[0..4];
        if tag == b"\x00\x01\x00\x00" || tag == b"OTTO" || tag == b"true" || tag == b"typ1" {
            let num_tables = u16::from_be_bytes([header_data[4], header_data[5]]) as usize;
            let directory_size = 12 + num_tables * 16;
            if header_data.len() >= directory_size {
                for i in 0..num_tables {
                    let entry_start = 12 + i * 16;
                    if &header_data[entry_start..entry_start + 4] == tag_to_find {
                        let offset = u32::from_be_bytes([
                            header_data[entry_start + 8],
                            header_data[entry_start + 9],
                            header_data[entry_start + 10],
                            header_data[entry_start + 11],
                        ]) as usize;
                        let length = u32::from_be_bytes([
                            header_data[entry_start + 12],
                            header_data[entry_start + 13],
                            header_data[entry_start + 14],
                            header_data[entry_start + 15],
                        ]) as usize;
                        return Some((offset, length));
                    }
                }
            }
        } else if tag == b"ttcf" && header_data.len() >= 16 {
            let first_offset = u32::from_be_bytes([
                header_data[12],
                header_data[13],
                header_data[14],
                header_data[15],
            ]) as usize;
            if header_data.len() >= first_offset + 12 {
                let sub = &header_data[first_offset..];
                let num_tables = u16::from_be_bytes([sub[4], sub[5]]) as usize;
                let directory_size = 12 + num_tables * 16;
                if sub.len() >= directory_size {
                    for i in 0..num_tables {
                        let entry_start = 12 + i * 16;
                        if &sub[entry_start..entry_start + 4] == tag_to_find {
                            let offset = u32::from_be_bytes([
                                sub[entry_start + 8],
                                sub[entry_start + 9],
                                sub[entry_start + 10],
                                sub[entry_start + 11],
                            ]) as usize;
                            let length = u32::from_be_bytes([
                                sub[entry_start + 12],
                                sub[entry_start + 13],
                                sub[entry_start + 14],
                                sub[entry_start + 15],
                            ]) as usize;
                            return Some((offset, length));
                        }
                    }
                }
            }
        }
        None
    }

    pub fn extract_localized_names(face: &Face) -> HashMap<String, String> {
        let mut map: HashMap<String, (u8, String)> = HashMap::new();
        for name in face.names() {
            if name.name_id == name_id::FAMILY || name.name_id == name_id::TYPOGRAPHIC_FAMILY {
                let plat_u16 = match name.platform_id {
                    ttf_parser::PlatformId::Unicode => 0,
                    ttf_parser::PlatformId::Macintosh => 1,
                    ttf_parser::PlatformId::Iso => 2,
                    ttf_parser::PlatformId::Windows => 3,
                    ttf_parser::PlatformId::Custom => 4,
                };
                if let Some(text) = decode_raw_name_bytes(plat_u16, name.encoding_id, name.language_id, name.name) {
                    if let Some(lang) = map_lang_id(plat_u16, name.language_id) {
                        // 우선순위: Windows(3)/Unicode(0) = 10, Macintosh(1) = 1
                        let priority: u8 = if plat_u16 == 3 || plat_u16 == 0 { 10 } else { 1 };
                        match map.get(lang) {
                            Some((curr_prio, _)) if *curr_prio >= priority => {}
                            _ => {
                                map.insert(lang.to_string(), (priority, text));
                            }
                        }
                    }
                }
            }
        }
        map.into_iter().map(|(k, (_, v))| (k, v)).collect()
    }

    fn extract_best_name(face: &Face, name_id: u16) -> Option<String> {
        let mut korean_name = None;
        let mut english_name = None;
        let mut unicode_name = None;

        for name in face.names() {
            if name.name_id != name_id {
                continue;
            }

            let plat_u16 = match name.platform_id {
                ttf_parser::PlatformId::Unicode => 0,
                ttf_parser::PlatformId::Macintosh => 1,
                ttf_parser::PlatformId::Iso => 2,
                ttf_parser::PlatformId::Windows => 3,
                ttf_parser::PlatformId::Custom => 4,
            };

            let Some(text) = decode_raw_name_bytes(plat_u16, name.encoding_id, name.language_id, name.name) else {
                continue;
            };

            // 한국어 최우선 검출
            if (plat_u16 == 3 && name.language_id == 0x0412) || (plat_u16 == 1 && name.language_id == 23) {
                if plat_u16 == 3 {
                    return Some(text);
                }
                if korean_name.is_none() {
                    korean_name = Some(text);
                }
                continue;
            }

            if plat_u16 == 3 {
                if name.language_id == 0x0409 {
                    if english_name.is_none() {
                        english_name = Some(text);
                    }
                } else if unicode_name.is_none() {
                    unicode_name = Some(text);
                }
            } else if plat_u16 == 0 {
                if unicode_name.is_none() {
                    unicode_name = Some(text);
                }
            } else if english_name.is_none() && (name.language_id == 0 || name.language_id == 0x0409) {
                english_name = Some(text);
            }
        }

        korean_name.or(unicode_name).or(english_name)
    }

    fn extract_version_num(face: &Face, version_str: Option<&str>) -> Option<f32> {
        // 1. head 테이블의 fontRevision (Fixed 16.16) 직접 읽기
        if let Some(data) = face.raw_face().table(ttf_parser::Tag::from_bytes(b"head")) {
            if data.len() >= 8 {
                let rev_raw = i32::from_be_bytes([data[4], data[5], data[6], data[7]]);
                let num = (rev_raw as f32) / 65536.0;
                if num > 0.0 {
                    return Some((num * 1000.0).round() / 1000.0);
                }
            }
        }

        // 2. Fallback: name 테이블의 버전 문자열에서 숫자 파싱 (e.g. "Version 1.002", "1.25")
        if let Some(s) = version_str {
            let mut num_str = String::new();
            let mut found_digit = false;
            for c in s.chars() {
                if c.is_ascii_digit() || (c == '.' && found_digit && !num_str.contains('.')) {
                    num_str.push(c);
                    found_digit = true;
                } else if found_digit {
                    break;
                }
            }
            if let Ok(val) = num_str.parse::<f32>() {
                return Some(val);
            }
        }

        None
    }

    pub fn parse_details<P: AsRef<Path>>(path: P, font_index: u32) -> AppResult<FontDetailedInfo> {
        let path_ref = path.as_ref();
        if !path_ref.is_file() {
            return Err(AppError::InvalidPath(format!(
                "Path is not a regular file: {}",
                path_ref.display()
            )));
        }

        let metadata = std::fs::metadata(path_ref)?;
        let file_size = metadata.len();
        if file_size > crate::protocol::MAX_FONT_FILE_SIZE {
            return Err(AppError::FontParse(format!(
                "Font file size exceeds maximum limit ({} MB)",
                crate::protocol::MAX_FONT_FILE_SIZE / (1024 * 1024)
            )));
        }

        let file_name = path_ref
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let file_path = crate::protocol::to_posix_normalized_path(path_ref)
            .to_string_lossy()
            .to_string();

        let ext = path_ref
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let format = match ext.as_str() {
            "ttf" => FontFormat::TrueType,
            "otf" => FontFormat::OpenType,
            "ttc" => FontFormat::TrueTypeCollection,
            "woff" => FontFormat::Woff,
            "woff2" => FontFormat::Woff2,
            _ => FontFormat::Unknown,
        };

        let file = File::open(path_ref)?;
        let mut buffer = Vec::with_capacity(file_size.min(crate::protocol::MAX_FONT_FILE_SIZE) as usize);
        file.take(crate::protocol::MAX_FONT_FILE_SIZE + 1).read_to_end(&mut buffer)?;

        let face = Face::parse(&buffer, font_index)
            .map_err(|e| AppError::FontParse(format!("Failed to parse font for details: {:?}", e)))?;

        // 1. Name Table 전체 추출
        let names = Self::extract_all_names(&face);

        // 2. OS/2 테이블 원시 바이너리 파싱 (사양상 오프셋 불변)
        let raw_os2 = face.raw_face().table(ttf_parser::Tag::from_bytes(b"OS/2"));
        let (win_ascent, win_descent, cap_height, x_height, os2) = if let Some(raw) = raw_os2 {
            let ver = if raw.len() >= 2 { u16::from_be_bytes([raw[0], raw[1]]) as u8 } else { 0 };
            let weight_class = if raw.len() >= 6 { u16::from_be_bytes([raw[4], raw[5]]) } else { face.weight().to_number() };
            let width_class = if raw.len() >= 8 { u16::from_be_bytes([raw[6], raw[7]]) } else { face.width().to_number() };
            let fs_type_raw = if raw.len() >= 10 { u16::from_be_bytes([raw[8], raw[9]]) } else { 0 };
            let fs_type_label = Self::interpret_fs_type(fs_type_raw);

            let raw_family_class = if raw.len() >= 32 { i16::from_be_bytes([raw[30], raw[31]]) } else { 0 };
            let class_id = (raw_family_class >> 8) as i16;
            let subclass_id = (raw_family_class & 0xFF) as i16;
            let family_class_name = Self::interpret_family_class(class_id, subclass_id);

            let panose_bytes = if raw.len() >= 42 {
                raw[32..42].to_vec()
            } else {
                Vec::new()
            };

            let vendor_id = if raw.len() >= 62 {
                String::from_utf8_lossy(&raw[58..62]).trim().to_string()
            } else {
                String::new()
            };

            let fs_selection = if raw.len() >= 64 {
                u16::from_be_bytes([raw[62], raw[63]])
            } else {
                0
            };

            let w_ascent = if raw.len() >= 76 { Some(u16::from_be_bytes([raw[74], raw[75]])) } else { None };
            let w_descent = if raw.len() >= 78 { Some(u16::from_be_bytes([raw[76], raw[77]])) } else { None };

            let (x_h, cap_h) = if ver >= 2 && raw.len() >= 90 {
                let x = i16::from_be_bytes([raw[86], raw[87]]);
                let cap = i16::from_be_bytes([raw[88], raw[89]]);
                (Some(x), Some(cap))
            } else {
                (None, None)
            };

            let os2_rec = FontOs2Record {
                version: ver,
                weight_class,
                width_class,
                fs_type: fs_type_raw,
                fs_type_label,
                fs_selection,
                s_family_class: raw_family_class,
                family_class_name,
                panose: panose_bytes,
                vendor_id,
            };

            (w_ascent, w_descent, cap_h, x_h, Some(os2_rec))
        } else {
            (None, None, None, None, None)
        };

        // 3. Metrics (head, hhea, post, OS/2)
        let bbox = face.global_bounding_box();
        let underline = face.underline_metrics();
        let metrics = FontMetricsRecord {
            units_per_em: face.units_per_em(),
            ascender: face.ascender(),
            descender: face.descender(),
            line_gap: face.line_gap(),
            win_ascent,
            win_descent,
            cap_height,
            x_height,
            italic_angle: face.italic_angle(),
            underline_position: underline.map(|u| u.position).unwrap_or(0),
            underline_thickness: underline.map(|u| u.thickness).unwrap_or(0),
            is_monospaced: face.is_monospaced(),
            bbox_xmin: bbox.x_min,
            bbox_ymin: bbox.y_min,
            bbox_xmax: bbox.x_max,
            bbox_ymax: bbox.y_max,
        };

        // 4. head 테이블 타임스탬프 (생성일, 수정일)
        let (created_timestamp, modified_timestamp) = if let Some(head_data) = face.raw_face().table(ttf_parser::Tag::from_bytes(b"head")) {
            if head_data.len() >= 36 {
                // Mac epoch (1904-01-01) seconds in 64-bit int
                let created_raw = i64::from_be_bytes([
                    head_data[20], head_data[21], head_data[22], head_data[23],
                    head_data[24], head_data[25], head_data[26], head_data[27],
                ]);
                let modified_raw = i64::from_be_bytes([
                    head_data[28], head_data[29], head_data[30], head_data[31],
                    head_data[32], head_data[33], head_data[34], head_data[35],
                ]);
                // Unix epoch conversion: subtract 2,082,844,800 seconds
                let mac_to_unix = 2_082_844_800i64;
                (
                    Some(created_raw.saturating_sub(mac_to_unix)),
                    Some(modified_raw.saturating_sub(mac_to_unix)),
                )
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        // 5. 문자 체계 & 언어 지원 분석 (cmap)
        let coverage = Self::analyze_language_coverage(&face);

        // 6. 오픈타입 기능 태그 (GSUB/GPOS)
        let opentype_features = Self::extract_opentype_features(&face);

        // 7. 가변 폰트 축 (fvar)
        let variable = if face.is_variable() {
            let axes = face.variation_axes().into_iter().map(|axis| {
                let tag_str = axis.tag.to_string();
                let name = Self::axis_tag_to_name(&tag_str);
                FontVariableAxis {
                    tag: tag_str,
                    name,
                    min_value: axis.min_value,
                    default_value: axis.def_value,
                    max_value: axis.max_value,
                }
            }).collect();

            Some(FontVariableInfo {
                is_variable: true,
                axes,
            })
        } else {
            None
        };

        // 8. 스마트 스타일 판별 (sFamilyClass + PANOSE + 이름 키워드 종합 판별)
        let style_classification = Self::detect_style_classification(
            &face,
            &names,
            os2.as_ref(),
        );

        Ok(FontDetailedInfo {
            id: 0,
            file_path,
            file_name,
            file_size,
            font_index,
            format,
            style_classification,
            created_timestamp,
            modified_timestamp,
            names,
            metrics,
            os2,
            coverage,
            opentype_features,
            variable,
        })
    }

    fn extract_all_names(face: &Face) -> Vec<FontNameRecord> {
        let mut list = Vec::new();
        let target_ids: &[(u16, &str)] = &[
            (name_id::COPYRIGHT_NOTICE, "copyright"),
            (name_id::FAMILY, "family"),
            (name_id::SUBFAMILY, "subfamily"),
            (name_id::UNIQUE_ID, "unique_id"),
            (name_id::FULL_NAME, "full_name"),
            (name_id::VERSION, "version"),
            (name_id::POST_SCRIPT_NAME, "postscript_name"),
            (name_id::TRADEMARK, "trademark"),
            (name_id::MANUFACTURER, "manufacturer"),
            (name_id::DESIGNER, "designer"),
            (name_id::DESCRIPTION, "description"),
            (name_id::VENDOR_URL, "vendor_url"),
            (name_id::DESIGNER_URL, "designer_url"),
            (name_id::LICENSE, "license"),
            (name_id::LICENSE_URL, "license_url"),
            (name_id::TYPOGRAPHIC_FAMILY, "typographic_family"),
            (name_id::TYPOGRAPHIC_SUBFAMILY, "typographic_subfamily"),
            (name_id::SAMPLE_TEXT, "sample_text"),
        ];

        let mut seen = std::collections::HashSet::new();

        for &(nid, key) in target_ids {
            for name in face.names() {
                if name.name_id != nid {
                    continue;
                }

                if let Some(text) = decode_name_record(&name) {
                    let trimmed = text.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    let lang_id = name.language_id;
                    let lang_tag = Self::language_id_to_tag(lang_id).to_string();

                    // 동일한 name_id와 언어 태그의 중복 추가 방지
                    let dedupe_key = format!("{}:{}:{}", nid, lang_tag, trimmed.len());
                    if seen.insert(dedupe_key) {
                        list.push(FontNameRecord {
                            name_id: nid,
                            name_key: key.to_string(),
                            value: trimmed.to_string(),
                            language_id: lang_id,
                            language_tag: lang_tag,
                        });
                    }
                }
            }
        }

        // 만약 특정 target_id에 대해 list에 아무것도 없다면 기존 extract_best_name으로 폴백
        for &(nid, key) in target_ids {
            if !list.iter().any(|r| r.name_id == nid) {
                if let Some(val) = Self::extract_best_name(face, nid) {
                    if !val.trim().is_empty() {
                        list.push(FontNameRecord {
                            name_id: nid,
                            name_key: key.to_string(),
                            value: val,
                            language_id: 0,
                            language_tag: "und".to_string(),
                        });
                    }
                }
            }
        }

        list
    }

    fn language_id_to_tag(lang_id: u16) -> &'static str {
        match lang_id {
            0x0412 => "ko",
            0x0409 | 0x0809 | 0x0c09 | 0x1009 | 0x1409 => "en",
            0x0411 => "ja",
            0x0804 | 0x1004 => "zh-CN",
            0x0404 | 0x0c04 | 0x1404 => "zh-TW",
            0x0407 => "de",
            0x040c => "fr",
            0x040a => "es",
            _ => "und",
        }
    }

    fn interpret_fs_type(fs_type: u16) -> String {
        if fs_type == 0 {
            return "Installable Embedding (제한 없음)".to_string();
        }
        let mut parts = Vec::new();
        if (fs_type & 0x0002) != 0 {
            parts.push("Restricted License (임베딩 제한)");
        }
        if (fs_type & 0x0004) != 0 {
            parts.push("Preview & Print (미리보기/인쇄 허용)");
        }
        if (fs_type & 0x0008) != 0 {
            parts.push("Editable (문서 내 편집 허용)");
        }
        if (fs_type & 0x0100) != 0 {
            parts.push("No Subsetting (서브셋팅 금지)");
        }
        if (fs_type & 0x0200) != 0 {
            parts.push("Bitmap Only (비트맵 전용)");
        }

        if parts.is_empty() {
            format!("0x{:04X}", fs_type)
        } else {
            parts.join(", ")
        }
    }

    fn interpret_family_class(class_id: i16, _subclass_id: i16) -> String {
        match class_id {
            1 => "Oldstyle Serifs (옛날 명조/세리프)".to_string(),
            2 => "Transitional Serifs (과도기 세리프)".to_string(),
            3 => "Modern Serifs (모던 세리프)".to_string(),
            4 => "Clarendon Serifs (클라렌던 세리프)".to_string(),
            5 => "Slab Serifs (슬랩 세리프)".to_string(),
            7 => "Freeform Serifs (자유형 세리프)".to_string(),
            8 => "Sans-serif (고딕/산세리프)".to_string(),
            9 => "Scripts (필기체/손글씨)".to_string(),
            10 => "Decorative / Display (장식/디스플레이)".to_string(),
            12 => "Symbolic (기호/심볼)".to_string(),
            _ => "No Classification (미분류)".to_string(),
        }
    }

    fn detect_style_classification(
        face: &Face,
        names: &[FontNameRecord],
        os2: Option<&FontOs2Record>,
    ) -> String {
        // 1. 고정폭 여부
        if face.is_monospaced() {
            return "monospace".to_string();
        }

        // 2. OS/2 sFamilyClass 분석 (0이 아닌 유효 값일 때)
        if let Some(o) = os2 {
            let class_id = (o.s_family_class >> 8) as i16;
            match class_id {
                1..=7 => return "serif".to_string(),
                8 => return "sans_serif".to_string(),
                9 => return "script".to_string(),
                10 => return "display".to_string(),
                12 => return "symbol".to_string(),
                _ => {}
            }

            // 3. PANOSE 분석
            if o.panose.len() >= 2 {
                let family_type = o.panose[0];
                let serif_style = o.panose[1];

                if family_type == 2 {
                    // Latin Text
                    match serif_style {
                        2..=10 => return "serif".to_string(),
                        11..=15 => return "sans_serif".to_string(),
                        _ => {}
                    }
                } else if family_type == 3 {
                    return "script".to_string();
                } else if family_type == 4 {
                    return "display".to_string();
                } else if family_type == 5 {
                    return "symbol".to_string();
                }
            }
        }

        // 4. 이름 키워드(Family, Subfamily, PostScript) 스마트 매칭
        let mut combined_names = String::new();
        for n in names {
            if ["family", "subfamily", "full_name", "postscript_name"].contains(&n.name_key.as_str()) {
                combined_names.push(' ');
                combined_names.push_str(&n.value.to_lowercase());
            }
        }

        // 고딕/산세리프 키워드
        if combined_names.contains("sans")
            || combined_names.contains("gothic")
            || combined_names.contains("고딕")
            || combined_names.contains("돋움")
            || combined_names.contains("grotesk")
            || combined_names.contains("neo")
        {
            return "sans_serif".to_string();
        }

        // 명조/세리프 키워드
        if combined_names.contains("serif")
            || combined_names.contains("명조")
            || combined_names.contains("바탕")
            || combined_names.contains("mincho")
            || combined_names.contains("roman")
            || combined_names.contains("antique")
            || combined_names.contains("didot")
            || combined_names.contains("bodoni")
        {
            return "serif".to_string();
        }

        // 필기체/스크립트 키워드
        if combined_names.contains("script")
            || combined_names.contains("hand")
            || combined_names.contains("손글씨")
            || combined_names.contains("필기")
            || combined_names.contains("calli")
            || combined_names.contains("brush")
            || combined_names.contains("cursive")
        {
            return "script".to_string();
        }

        // 장식/디스플레이 키워드
        if combined_names.contains("display")
            || combined_names.contains("headline")
            || combined_names.contains("제목")
            || combined_names.contains("stencil")
            || combined_names.contains("cartoon")
        {
            return "display".to_string();
        }

        // 기본 표준 폴백
        "sans_serif".to_string()
    }

    fn analyze_language_coverage(face: &Face) -> FontLanguageCoverage {
        let total_glyph_count = face.number_of_glyphs();
        let mut seen_codepoints = std::collections::HashSet::new();

        let mut latin_basic_count = 0u32;
        let mut latin_extended_count = 0u32;
        let mut hangul_syllable_count = 0u32;
        let mut has_hangul_jamo = false;
        let mut cjk_ideograph_count = 0u32;
        let mut japanese_kana_count = 0u32;
        let mut has_cyrillic = false;
        let mut has_greek = false;
        let mut has_arabic = false;

        if let Some(cmap) = face.tables().cmap {
            for subtable in cmap.subtables {
                if !subtable.is_unicode() {
                    continue;
                }
                subtable.codepoints(|cp| {
                    if seen_codepoints.insert(cp) {
                        // Latin Basic ASCII (0x0020 ~ 0x007E, 95 chars)
                        if (0x0020..=0x007E).contains(&cp) {
                            latin_basic_count += 1;
                        }
                        // Latin Extended (0x00A0 ~ 0x017F, 224 chars)
                        if (0x00A0..=0x017F).contains(&cp) {
                            latin_extended_count += 1;
                        }
                        // Hangul Syllables (0xAC00 ~ 0xD7A3, 현대 한글 완성형 총 11,172자)
                        if (0xAC00..=0xD7A3).contains(&cp) {
                            hangul_syllable_count += 1;
                        }
                        // Hangul Jamo (0x1100 ~ 0x11FF, 옛한글 첫가끝)
                        if (0x1100..=0x11FF).contains(&cp) {
                            has_hangul_jamo = true;
                        }
                        // CJK Unified Ideographs (0x4E00 ~ 0x9FFF, 한자)
                        if (0x4E00..=0x9FFF).contains(&cp) {
                            cjk_ideograph_count += 1;
                        }
                        // Japanese Kana (Hiragana 0x3040..=0x309F, Katakana 0x30A0..=0x30FF)
                        if (0x3040..=0x30FF).contains(&cp) {
                            japanese_kana_count += 1;
                        }
                        // Cyrillic (0x0400 ~ 0x04FF)
                        if (0x0400..=0x04FF).contains(&cp) {
                            has_cyrillic = true;
                        }
                        // Greek (0x0370 ~ 0x03FF)
                        if (0x0370..=0x03FF).contains(&cp) {
                            has_greek = true;
                        }
                        // Arabic (0x0600 ~ 0x06FF)
                        if (0x0600..=0x06FF).contains(&cp) {
                            has_arabic = true;
                        }
                    }
                });
            }
        }

        let has_latin_basic = latin_basic_count > 0;
        let has_latin_extended = latin_extended_count > 0;
        let has_japanese_kana = japanese_kana_count > 0;

        let hangul_type = if hangul_syllable_count == 11172 {
            "full_11172".to_string()
        } else if hangul_syllable_count >= 2350 {
            "basic_ks_2350".to_string()
        } else if hangul_syllable_count > 0 {
            "partial".to_string()
        } else {
            "none".to_string()
        };

        let mut supported_scripts = Vec::new();
        if has_latin_basic {
            supported_scripts.push("latin".to_string());
        }
        if hangul_syllable_count > 0 {
            supported_scripts.push("hangul".to_string());
        }
        if cjk_ideograph_count > 100 {
            supported_scripts.push("cjk".to_string());
        }
        if has_japanese_kana {
            supported_scripts.push("japanese".to_string());
        }
        if has_cyrillic {
            supported_scripts.push("cyrillic".to_string());
        }
        if has_greek {
            supported_scripts.push("greek".to_string());
        }
        if has_arabic {
            supported_scripts.push("arabic".to_string());
        }

        FontLanguageCoverage {
            total_glyph_count,
            encoded_char_count: seen_codepoints.len() as u32,
            has_latin_basic,
            latin_basic_count,
            has_latin_extended,
            latin_extended_count,
            hangul_syllable_count,
            hangul_type,
            has_hangul_jamo,
            cjk_ideograph_count,
            has_japanese_kana,
            japanese_kana_count,
            has_cyrillic,
            has_greek,
            has_arabic,
            supported_scripts,
        }
    }

    fn extract_opentype_features(face: &Face) -> Vec<String> {
        let mut features = std::collections::HashSet::new();

        // GSUB 및 GPOS 테이블 헤더에서 FeatureList 파싱
        for table_tag in &[b"GSUB", b"GPOS"] {
            if let Some(data) = face.raw_face().table(ttf_parser::Tag::from_bytes(*table_tag)) {
                if data.len() >= 10 {
                    // FeatureListOffset은 테이블 버전(Major/Minor 4bytes), ScriptListOffset(2bytes) 다음인 offset 6 또는 8
                    let feature_list_offset = u16::from_be_bytes([data[6], data[7]]) as usize;
                    if feature_list_offset + 2 <= data.len() {
                        let feature_count = u16::from_be_bytes([
                            data[feature_list_offset],
                            data[feature_list_offset + 1],
                        ]) as usize;

                        let mut cursor = feature_list_offset + 2;
                        for _ in 0..feature_count {
                            if cursor + 6 > data.len() {
                                break;
                            }
                            if let Ok(tag_str) = std::str::from_utf8(&data[cursor..cursor + 4]) {
                                let trimmed = tag_str.trim();
                                if !trimmed.is_empty() {
                                    features.insert(trimmed.to_string());
                                }
                            }
                            cursor += 6; // Tag(4) + FeatureOffset(2)
                        }
                    }
                }
            }
        }

        let mut list: Vec<String> = features.into_iter().collect();
        list.sort();
        list
    }

    fn axis_tag_to_name(tag: &str) -> String {
        match tag {
            "wght" => "Weight (굵기)".to_string(),
            "wdth" => "Width (폭/장평)".to_string(),
            "slnt" => "Slant (기울기)".to_string(),
            "ital" => "Italic (이탤릭)".to_string(),
            "opsz" => "Optical Size (시각 크기)".to_string(),
            _ => tag.to_string(),
        }
    }
}

fn path_to_display_name(file_name: &str) -> String {
    let name_without_ext = match file_name.rfind('.') {
        Some(idx) => &file_name[..idx],
        None => file_name,
    };
    name_without_ext.replace(['-', '_'], " ")
}

#[derive(Debug, Default, Clone)]
pub struct ParsedNameTable {
    pub family_name: Option<String>,
    pub subfamily_name: Option<String>,
    pub full_name: Option<String>,
    pub postscript_name: Option<String>,
    pub version: Option<String>,
    pub designer: Option<String>,
    pub copyright: Option<String>,
    pub license: Option<String>,
    pub localized_names: HashMap<String, String>,
}

fn map_lang_id(platform_id: u16, language_id: u16) -> Option<&'static str> {
    match platform_id {
        3 | 0 => match language_id {
            0x0412 => Some("ko"),
            0x0409 | 0x0809 | 0x0c09 | 0x1009 | 0x1409 | 0x1809 => Some("en"),
            0x0411 => Some("ja"),
            0x0804 | 0x1004 => Some("zh-CN"),
            0x0404 | 0x0c04 | 0x1404 => Some("zh-TW"),
            0x040c | 0x080c => Some("fr"),
            0x0407 | 0x0807 => Some("de"),
            0x040a | 0x080a => Some("es"),
            _ => None,
        },
        1 => match language_id {
            0 => Some("en"),
            23 => Some("ko"),
            11 => Some("ja"),
            33 => Some("zh-CN"),
            19 => Some("zh-TW"),
            1 => Some("fr"),
            2 => Some("de"),
            8 => Some("es"),
            _ => None,
        },
        _ => None,
    }
}

pub fn decode_raw_name_bytes(
    platform_id: u16,
    encoding_id: u16,
    language_id: u16,
    bytes: &[u8],
) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }

    match platform_id {
        // 0: Unicode, 3: Windows
        0 | 3 => {
            // Windows & Unicode는 일반적으로 UTF-16BE (2바이트 정렬)
            if bytes.len() % 2 == 0 {
                let u16_chars: Vec<u16> = bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                    .collect();
                if let Ok(s) = String::from_utf16(&u16_chars) {
                    let trimmed = s.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
            // Fallback: UTF-8 시도
            if let Ok(s) = std::str::from_utf8(bytes) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
            None
        }
        // 1: Macintosh
        1 => {
            // Korean: encoding_id == 3 또는 language_id == 23 (MacKorean)
            if encoding_id == 3 || language_id == 23 {
                let (cow, _enc, malformed) = encoding_rs::EUC_KR.decode(bytes);
                if !malformed {
                    let trimmed = cow.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
            // Japanese: encoding_id == 1 또는 language_id == 11
            if encoding_id == 1 || language_id == 11 {
                let (cow, _enc, malformed) = encoding_rs::SHIFT_JIS.decode(bytes);
                if !malformed {
                    let trimmed = cow.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
            // Traditional Chinese: encoding_id == 2 또는 language_id == 19
            if encoding_id == 2 || language_id == 19 {
                let (cow, _enc, malformed) = encoding_rs::BIG5.decode(bytes);
                if !malformed {
                    let trimmed = cow.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
            // Simplified Chinese: encoding_id == 25 또는 language_id == 33
            if encoding_id == 25 || language_id == 33 {
                let (cow, _enc, malformed) = encoding_rs::GBK.decode(bytes);
                if !malformed {
                    let trimmed = cow.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }

            // UTF-8 검사
            if let Ok(s) = std::str::from_utf8(bytes) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }

            // 순수 ASCII인 경우
            if bytes.iter().all(|&b| b < 0x80) {
                let s = String::from_utf8_lossy(bytes).trim().to_string();
                if !s.is_empty() {
                    return Some(s);
                }
            }

            // Fallback: 비-ASCII 바이트가 있다면 EUC-KR 시도 (한국어 폰트 잘못된 메타 방어)
            let (cow, _enc, malformed) = encoding_rs::EUC_KR.decode(bytes);
            if !malformed {
                let trimmed = cow.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }

            None
        }
        _ => {
            if let Ok(s) = std::str::from_utf8(bytes) {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
            None
        }
    }
}

pub fn decode_name_record(name: &ttf_parser::name::Name) -> Option<String> {
    let plat_id = match name.platform_id {
        ttf_parser::PlatformId::Unicode => 0,
        ttf_parser::PlatformId::Macintosh => 1,
        ttf_parser::PlatformId::Iso => 2,
        ttf_parser::PlatformId::Windows => 3,
        ttf_parser::PlatformId::Custom => 4,
    };
    decode_raw_name_bytes(plat_id, name.encoding_id, name.language_id, name.name)
}

pub fn parse_raw_name_table(name_data: &[u8]) -> ParsedNameTable {
    let mut result = ParsedNameTable::default();
    if name_data.len() < 6 {
        return result;
    }

    let count = u16::from_be_bytes([name_data[2], name_data[3]]) as usize;
    let string_offset = u16::from_be_bytes([name_data[4], name_data[5]]) as usize;

    if name_data.len() < 6 + count * 12 {
        return result;
    }

    let mut ko_family = None;
    let mut en_family = None;
    let mut other_family = None;

    let mut ko_subfamily = None;
    let mut en_subfamily = None;
    let mut other_subfamily = None;

    let mut ko_full_name = None;
    let mut en_full_name = None;
    let mut other_full_name = None;

    let mut postscript_name = None;
    let mut version = None;
    let mut designer = None;
    let mut copyright = None;
    let mut license = None;

    for i in 0..count {
        let entry_start = 6 + i * 12;
        let plat_id = u16::from_be_bytes([name_data[entry_start], name_data[entry_start + 1]]);
        let enc_id = u16::from_be_bytes([name_data[entry_start + 2], name_data[entry_start + 3]]);
        let lang_id = u16::from_be_bytes([name_data[entry_start + 4], name_data[entry_start + 5]]);
        let name_id = u16::from_be_bytes([name_data[entry_start + 6], name_data[entry_start + 7]]);
        let length = u16::from_be_bytes([name_data[entry_start + 8], name_data[entry_start + 9]]) as usize;
        let offset = u16::from_be_bytes([name_data[entry_start + 10], name_data[entry_start + 11]]) as usize;

        let str_start = string_offset + offset;
        let str_end = str_start + length;
        if str_end > name_data.len() {
            continue;
        }

        let raw_bytes = &name_data[str_start..str_end];
        let Some(text) = decode_raw_name_bytes(plat_id, enc_id, lang_id, raw_bytes) else {
            continue;
        };

        let lang_code = map_lang_id(plat_id, lang_id);
        let is_win_or_uni = plat_id == 3 || plat_id == 0;

        match name_id {
            1 | 16 => {
                if let Some(code) = lang_code {
                    if is_win_or_uni || !result.localized_names.contains_key(code) {
                        result.localized_names.insert(code.to_string(), text.clone());
                    }
                    if code == "ko" {
                        if is_win_or_uni || ko_family.is_none() {
                            ko_family = Some(text.clone());
                        }
                    } else if code == "en" {
                        if is_win_or_uni || en_family.is_none() {
                            en_family = Some(text.clone());
                        }
                    }
                } else if other_family.is_none() {
                    other_family = Some(text.clone());
                }
            }
            2 | 17 => {
                if let Some(code) = lang_code {
                    if code == "ko" {
                        if is_win_or_uni || ko_subfamily.is_none() {
                            ko_subfamily = Some(text.clone());
                        }
                    } else if code == "en" {
                        if is_win_or_uni || en_subfamily.is_none() {
                            en_subfamily = Some(text.clone());
                        }
                    }
                } else if other_subfamily.is_none() {
                    other_subfamily = Some(text.clone());
                }
            }
            4 => {
                if let Some(code) = lang_code {
                    if code == "ko" {
                        if is_win_or_uni || ko_full_name.is_none() {
                            ko_full_name = Some(text.clone());
                        }
                    } else if code == "en" {
                        if is_win_or_uni || en_full_name.is_none() {
                            en_full_name = Some(text.clone());
                        }
                    }
                } else if other_full_name.is_none() {
                    other_full_name = Some(text.clone());
                }
            }
            6 => {
                if is_win_or_uni || postscript_name.is_none() {
                    postscript_name = Some(text);
                }
            }
            5 => {
                if is_win_or_uni || version.is_none() {
                    version = Some(text);
                }
            }
            9 => {
                if is_win_or_uni || designer.is_none() {
                    designer = Some(text);
                }
            }
            0 => {
                if is_win_or_uni || copyright.is_none() {
                    copyright = Some(text);
                }
            }
            13 => {
                if is_win_or_uni || license.is_none() {
                    license = Some(text);
                }
            }
            _ => {}
        }
    }

    result.family_name = ko_family.or(en_family).or(other_family);
    result.subfamily_name = ko_subfamily.or(en_subfamily).or(other_subfamily);
    result.full_name = ko_full_name.or(en_full_name).or(other_full_name);
    result.postscript_name = postscript_name;
    result.version = version;
    result.designer = designer;
    result.copyright = copyright;
    result.license = license;

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_malgun_and_d2coding() {
        let home = std::env::var("HOME").unwrap_or_default();
        let malgun_path = PathBuf::from(&home).join("Library/Fonts/malgun.ttf");
        if malgun_path.exists() {
            let res = FontParser::parse_file(&malgun_path);
            assert!(res.is_ok(), "Failed to parse malgun.ttf: {:?}", res.err());
            let fonts = res.unwrap();
            assert!(!fonts.is_empty());
            let font = &fonts[0];
            println!("Malgun parsed: family_name='{}', localized_names={:?}", font.family_name, font.localized_names);
            assert_eq!(font.family_name, "맑은 고딕");
            assert!(font.localized_names.is_some());
            let loc = font.localized_names.as_ref().unwrap();
            assert_eq!(loc.get("ko").map(|s| s.as_str()), Some("맑은 고딕"));
            assert_eq!(loc.get("en").map(|s| s.as_str()), Some("Malgun Gothic"));
        }

        let d2_path = PathBuf::from(&home).join("Library/Fonts/D2Coding-Ver1.3.2-20180524.ttf");
        if d2_path.exists() {
            let res = FontParser::parse_file(&d2_path);
            assert!(res.is_ok(), "Failed to parse D2Coding: {:?}", res.err());
            let fonts = res.unwrap();
            assert!(!fonts.is_empty());
            let font = &fonts[0];
            println!("D2Coding parsed: family_name='{}', localized_names={:?}", font.family_name, font.localized_names);
            assert_eq!(font.family_name, "D2Coding");
        }

        let jalnan_path = PathBuf::from("/Users/monodoro/Documents/fontfinder/폰트/bbb1/JalnanGothicTTF.ttf");
        if jalnan_path.exists() {
            let res = FontParser::parse_file(&jalnan_path);
            assert!(res.is_ok(), "Failed to parse JalnanGothicTTF.ttf: {:?}", res.err());
            let fonts = res.unwrap();
            assert!(!fonts.is_empty());
            let font = &fonts[0];
            println!("Jalnan parsed: family_name='{}', localized_names={:?}", font.family_name, font.localized_names);
            assert!(font.family_name.contains("여기어때"), "Expected Korean name but got: {}", font.family_name);
            if let Some(loc) = &font.localized_names {
                if let Some(ko) = loc.get("ko") {
                    assert!(ko.contains("여기어때"), "Expected Korean name in localized_names['ko'] but got: {}", ko);
                }
            }
        }

        let nanum_path = PathBuf::from("/Users/monodoro/Documents/fontfinder/폰트/bbb1/NanumSquareNeo-Variable.ttf");
        if nanum_path.exists() {
            let res = FontParser::parse_file(&nanum_path);
            assert!(res.is_ok(), "Failed to parse NanumSquareNeo: {:?}", res.err());
            let fonts = res.unwrap();
            assert!(!fonts.is_empty());
            let font = &fonts[0];
            println!("Nanum parsed: family_name='{}', localized_names={:?}", font.family_name, font.localized_names);
            assert!(font.family_name.contains("나눔스퀘어"), "Expected Korean name but got: {}", font.family_name);
        }
    }
}

