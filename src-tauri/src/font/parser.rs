use std::fs::File;
use std::io::Read;
use std::path::Path;
use sha2::{Digest, Sha256};
use ttf_parser::{name_id, Face};

use super::model::{
    FontDetailedInfo, FontFormat, FontLanguageCoverage, FontMetadata, FontMetricsRecord,
    FontNameRecord, FontOs2Record, FontVariableAxis, FontVariableInfo,
};
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

        let format = match ext.as_str() {
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

        let id = format!("{}:{}", file_path, font_index);

        Ok(FontDetailedInfo {
            id,
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

                if let Some(text) = name.to_string() {
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

