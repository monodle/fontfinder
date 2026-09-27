use rusqlite::params;
use crate::error::AppResult;
use super::models::ActivatedFontRecord;
use super::Database;

impl Database {
  pub fn get_activated_fonts(&self) -> AppResult<Vec<ActivatedFontRecord>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT font_id, file_path FROM activated_fonts ORDER BY activated_at ASC")?;
    let rows = stmt.query_map([], |row| {
      Ok(ActivatedFontRecord {
        font_id: row.get(0)?,
        file_path: row.get(1)?,
      })
    })?;
    let mut records = Vec::new();
    for row in rows {
      records.push(row?);
    }
    Ok(records)
  }

  pub fn record_activated_font(&self, font_id: &str, file_path: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "INSERT OR REPLACE INTO activated_fonts (font_id, file_path) VALUES (?1, ?2)",
      params![font_id, file_path],
    )?;
    Ok(())
  }

  pub fn remove_activated_font(&self, font_id: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM activated_fonts WHERE font_id = ?1", params![font_id])?;
    Ok(())
  }

  pub fn record_activated_fonts(&self, items: &[(String, String)]) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached(
        "INSERT OR REPLACE INTO activated_fonts (font_id, file_path) VALUES (?1, ?2)",
      )?;
      for (id, path) in items {
        stmt.execute(params![id, path])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn remove_activated_fonts(&self, font_ids: &[String]) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached("DELETE FROM activated_fonts WHERE font_id = ?1")?;
      for id in font_ids {
        stmt.execute(params![id])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn clear_all_activated_fonts(&self) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM activated_fonts", [])?;
    Ok(())
  }
}
