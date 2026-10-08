use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FontFormat {
    TrueType,
    OpenType,
    TrueTypeCollection,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FontSource {
    System,
    User,
    External,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontMetadata {
    #[serde(default)]
    pub id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    #[serde(default)]
    pub file_hash: String,
    #[serde(default)]
    pub fast_hash: String,
    #[serde(default)]
    pub deep_hash: Option<String>,
    #[serde(default)]
    pub duplicate_count: u32,
    pub font_index: u32,
    pub family_name: String,
    pub subfamily_name: String,
    pub full_name: String,
    pub postscript_name: String,
    #[serde(default)]
    pub localized_names: Option<HashMap<String, String>>,
    pub format: FontFormat,
    pub source: FontSource,
    pub glyph_count: u16,
    pub weight: u16,
    pub is_italic: bool,
    pub is_monospace: bool,
    pub is_variable: bool,
    pub version: Option<String>,
    pub version_num: Option<f32>,
    pub designer: Option<String>,
    pub copyright: Option<String>,
    pub license: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlyphItem {
    pub unicode: u32,
    pub char_str: String,
    pub glyph_id: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontNameRecord {
    pub name_id: u16,
    pub name_key: String,
    pub value: String,
    pub language_id: u16,
    pub language_tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontMetricsRecord {
    pub units_per_em: u16,
    pub ascender: i16,
    pub descender: i16,
    pub line_gap: i16,
    pub win_ascent: Option<u16>,
    pub win_descent: Option<u16>,
    pub cap_height: Option<i16>,
    pub x_height: Option<i16>,
    pub italic_angle: f32,
    pub underline_position: i16,
    pub underline_thickness: i16,
    pub is_monospaced: bool,
    pub bbox_xmin: i16,
    pub bbox_ymin: i16,
    pub bbox_xmax: i16,
    pub bbox_ymax: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontOs2Record {
    pub version: u8,
    pub weight_class: u16,
    pub width_class: u16,
    pub fs_type: u16,
    pub fs_type_label: String,
    pub fs_selection: u16,
    pub s_family_class: i16,
    pub family_class_name: String,
    pub panose: Vec<u8>,
    pub vendor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontLanguageCoverage {
    pub total_glyph_count: u16,
    pub encoded_char_count: u32,
    pub has_latin_basic: bool,
    pub latin_basic_count: u32,
    pub has_latin_extended: bool,
    pub latin_extended_count: u32,
    pub hangul_syllable_count: u32,
    pub hangul_type: String, // "none" | "basic_ks_2350" | "full_11172" | "partial"
    pub has_hangul_jamo: bool,
    pub cjk_ideograph_count: u32,
    pub has_japanese_kana: bool,
    pub japanese_kana_count: u32,
    pub has_cyrillic: bool,
    pub has_greek: bool,
    pub has_arabic: bool,
    pub supported_scripts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontVariableAxis {
    pub tag: String,
    pub name: String,
    pub min_value: f32,
    pub default_value: f32,
    pub max_value: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontVariableInfo {
    pub is_variable: bool,
    pub axes: Vec<FontVariableAxis>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontDetailedInfo {
    #[serde(default)]
    pub id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub font_index: u32,
    pub format: FontFormat,
    pub style_classification: String,
    pub created_timestamp: Option<i64>,
    pub modified_timestamp: Option<i64>,
    pub names: Vec<FontNameRecord>,
    pub metrics: FontMetricsRecord,
    pub os2: Option<FontOs2Record>,
    pub coverage: FontLanguageCoverage,
    pub opentype_features: Vec<String>,
    pub variable: Option<FontVariableInfo>,
}
