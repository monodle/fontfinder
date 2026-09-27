use rusqlite::params;
use crate::error::AppResult;
use super::Database;

impl Database {
  pub fn toggle_favorite(&self, font_id: &str) -> AppResult<bool> {
    let conn = self.conn()?;
    let exists: bool = conn.query_row(
      "SELECT EXISTS(SELECT 1 FROM favorites WHERE font_id = ?1)",
      params![font_id],
      |row| row.get(0),
    )?;

    if exists {
      conn.execute("DELETE FROM favorites WHERE font_id = ?1", params![font_id])?;
      Ok(false)
    } else {
      conn.execute("INSERT INTO favorites (font_id) VALUES (?1)", params![font_id])?;
      Ok(true)
    }
  }

  pub fn get_favorite_font_ids(&self) -> AppResult<Vec<String>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT font_id FROM favorites ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut ids = Vec::new();
    for row in rows {
      ids.push(row?);
    }
    Ok(ids)
  }
}
