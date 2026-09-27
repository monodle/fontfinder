use rusqlite::params;
use crate::error::AppResult;
use super::models::FontSet;
use super::Database;

impl Database {
  pub fn create_set(&self, name: &str, color: Option<&str>) -> AppResult<FontSet> {
    let conn = self.conn()?;
    let set_color = color.unwrap_or("#6366f1");
    conn.execute(
      "INSERT INTO sets (name, color) VALUES (?1, ?2)",
      params![name, set_color],
    )?;
    let id = conn.last_insert_rowid();
    Ok(FontSet {
      id,
      name: name.to_string(),
      color: set_color.to_string(),
      count: 0,
    })
  }

  pub fn update_set_color(&self, set_id: i64, color: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE sets SET color = ?1 WHERE id = ?2",
      params![color, set_id],
    )?;
    Ok(())
  }

  pub fn update_set(&self, set_id: i64, name: &str, color: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE sets SET name = ?1, color = ?2 WHERE id = ?3",
      params![name, color, set_id],
    )?;
    Ok(())
  }

  pub fn get_sets(&self) -> AppResult<Vec<FontSet>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare(
      "
      SELECT s.id, s.name, s.color, (SELECT COUNT(1) FROM set_fonts sf WHERE sf.set_id = s.id) as font_count
      FROM sets s
      ORDER BY s.id DESC
      ",
    )?;

    let rows = stmt.query_map([], |row| {
      let id: i64 = row.get(0)?;
      let name: String = row.get(1)?;
      let color: String = row.get(2)?;
      let count: usize = row.get(3)?;
      Ok(FontSet { id, name, color, count })
    })?;

    let mut sets = Vec::new();
    for row in rows {
      sets.push(row?);
    }
    Ok(sets)
  }

  pub fn delete_set(&self, set_id: i64) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM sets WHERE id = ?1", params![set_id])?;
    Ok(())
  }

  pub fn add_font_to_set(&self, set_id: i64, font_id: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "INSERT OR IGNORE INTO set_fonts (set_id, font_id) VALUES (?1, ?2)",
      params![set_id, font_id],
    )?;
    Ok(())
  }

  pub fn remove_font_from_set(&self, set_id: i64, font_id: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "DELETE FROM set_fonts WHERE set_id = ?1 AND font_id = ?2",
      params![set_id, font_id],
    )?;
    Ok(())
  }

  pub fn get_set_font_ids(&self, set_id: i64) -> AppResult<Vec<String>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT font_id FROM set_fonts WHERE set_id = ?1")?;
    let rows = stmt.query_map(params![set_id], |row| row.get(0))?;
    let mut ids = Vec::new();
    for row in rows {
      ids.push(row?);
    }
    Ok(ids)
  }
}
