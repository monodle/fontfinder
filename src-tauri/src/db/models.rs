use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontSet {
  pub id: i64,
  pub name: String,
  pub color: String,
  pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbFolder {
  pub id: i64,
  pub path: String,
  pub name: String,
  pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivatedFontRecord {
  pub font_id: String,
  pub file_path: String,
}
