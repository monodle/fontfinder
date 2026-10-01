pub mod model;
pub mod parser;
pub mod scanner;

pub use model::{
    FontDetailedInfo, FontFormat, FontLanguageCoverage, FontMetadata, FontMetricsRecord,
    FontNameRecord, FontOs2Record, FontSource, FontVariableAxis, FontVariableInfo, GlyphItem,
};
pub use parser::FontParser;
pub use scanner::FontScanner;
