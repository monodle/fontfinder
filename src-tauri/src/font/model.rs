use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FontFormat {
    TrueType,
    OpenType,
    TrueTypeCollection,
    Woff,
    Woff2,
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
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub file_hash: String,
    pub font_index: u32,
    pub family_name: String,
    pub subfamily_name: String,
    pub full_name: String,
    pub postscript_name: String,
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
