use std::fs::File;
use std::io::Read;
use std::path::Path;
use sha2::{Digest, Sha256};
use ttf_parser::{name_id, Face};

use super::model::{FontFormat, FontMetadata};
use crate::error::{AppError, AppResult};
use crate::platform::Platform;

pub struct FontParser;

impl FontParser {
    pub fn parse_file<P: AsRef<Path>>(path: P) -> AppResult<Vec<FontMetadata>> {
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
        let file_path = path_ref.to_string_lossy().to_string();

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
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        Self::parse_bytes(&buffer, &file_path, &file_name, file_size, default_format)
    }

    pub fn parse_bytes(
        data: &[u8],
        file_path: &str,
        file_name: &str,
        file_size: u64,
        format: FontFormat,
    ) -> AppResult<Vec<FontMetadata>> {
        let num_fonts = ttf_parser::fonts_in_collection(data).unwrap_or(1);
        let mut results = Vec::with_capacity(num_fonts as usize);

        let file_hash = {
            let mut hasher = Sha256::new();
            let block = 16_384; // 16KB 초정밀 분산 블록 크기
            let total_sample_threshold = block * 16; // 256KB

            if data.len() <= total_sample_threshold {
                // 256KB 이하 파일: 파일 전체 바이트 해싱
                hasher.update(data);
            } else {
                // 256KB 초과 파일: 16개 균등 분산 지점 (약 6.25% 간격, 각 16KB) 샘플링
                let len = data.len();

                // ① 시작 (헤더 16KB)
                hasher.update(&data[..block]);

                // ② ~ ⑮ 중간 14개 균등 분할 지점 (각 16KB)
                for i in 1..=14 {
                    let center = (len * i) / 15;
                    let start = center.saturating_sub(block / 2);
                    let end = (start + block).min(len);
                    hasher.update(&data[start..end]);
                }

                // ⑯ 끝 (테일 16KB)
                hasher.update(&data[len.saturating_sub(block)..]);

                // ⑰ 파일 전체 크기 (고유 시드)
                hasher.update(&file_size.to_le_bytes());
            }

            let result = hasher.finalize();
            let mut s = String::with_capacity(64);
            for b in result {
                use std::fmt::Write;
                let _ = write!(&mut s, "{:02x}", b);
            }
            s
        };

        for font_index in 0..num_fonts {
            let face = match Face::parse(data, font_index) {
                Ok(f) => f,
                Err(e) => {
                    // 단일 폰트 파싱 실패 시 수집된 것이 있다면 반환하거나 에러 처리
                    if num_fonts == 1 {
                        return Err(AppError::FontParse(format!(
                            "Failed to parse font '{}' index {}: {:?}",
                            file_name, font_index, e
                        )));
                    }
                    continue;
                }
            };

            let family_name = Self::extract_best_name(&face, name_id::TYPOGRAPHIC_FAMILY)
                .or_else(|| Self::extract_best_name(&face, name_id::FAMILY))
                .unwrap_or_else(|| {
                    path_to_display_name(file_name)
                });

            let subfamily_name = Self::extract_best_name(&face, name_id::TYPOGRAPHIC_SUBFAMILY)
                .or_else(|| Self::extract_best_name(&face, name_id::SUBFAMILY))
                .unwrap_or_else(|| "Regular".to_string());

            let full_name = Self::extract_best_name(&face, name_id::FULL_NAME)
                .unwrap_or_else(|| format!("{} {}", family_name, subfamily_name));

            let postscript_name = Self::extract_best_name(&face, name_id::POST_SCRIPT_NAME)
                .unwrap_or_else(|| format!("{}-{}", family_name.replace(' ', ""), subfamily_name.replace(' ', "")));

            let version = Self::extract_best_name(&face, name_id::VERSION);
            let version_num = Self::extract_version_num(&face, version.as_deref());
            let designer = Self::extract_best_name(&face, name_id::DESIGNER);
            let copyright = Self::extract_best_name(&face, name_id::COPYRIGHT_NOTICE);
            let license = Self::extract_best_name(&face, name_id::LICENSE);

            let glyph_count = face.number_of_glyphs();
            let weight = face.weight().to_number();
            let is_italic = face.is_italic();
            let is_monospace = face.is_monospaced();
            let is_variable = face.is_variable();

            let id = format!("{}:{}", file_path, font_index);
            let source = Platform::classify_font_source(Path::new(file_path));

            results.push(FontMetadata {
                id,
                file_path: file_path.to_string(),
                file_name: file_name.to_string(),
                file_size,
                file_hash: file_hash.clone(),
                font_index,
                family_name,
                subfamily_name,
                full_name,
                postscript_name,
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

    fn extract_best_name(face: &Face, name_id: u16) -> Option<String> {
        let mut english_name = None;
        let mut unicode_name = None;

        for name in face.names() {
            if name.name_id != name_id {
                continue;
            }

            if let Some(text) = name.to_string() {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                // 한국어/다국어 우선 또는 Unicode 플랫폼 (0) / Windows(3) 우선
                if name.platform_id == ttf_parser::PlatformId::Windows {
                    if name.language_id == 0x0412 {
                        // 한국어 (0x0412) 발견 시 최우선 조기 반환
                        return Some(trimmed.to_string());
                    }
                    if name.language_id == 0x0409 {
                        english_name = Some(trimmed.to_string());
                    } else {
                        unicode_name = Some(trimmed.to_string());
                    }
                } else if name.platform_id == ttf_parser::PlatformId::Unicode {
                    unicode_name = Some(trimmed.to_string());
                } else if english_name.is_none() {
                    english_name = Some(trimmed.to_string());
                }
            }
        }

        unicode_name.or(english_name)
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
}

fn path_to_display_name(file_name: &str) -> String {
    let name_without_ext = match file_name.rfind('.') {
        Some(idx) => &file_name[..idx],
        None => file_name,
    };
    name_without_ext.replace(['-', '_'], " ")
}

