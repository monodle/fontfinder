use rusqlite::params;
use crate::error::AppResult;
use super::Database;

impl Database {
  pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
      let val: String = row.get(0)?;
      Ok(Some(val))
    } else {
      Ok(None)
    }
  }

  pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
      params![key, value],
    )?;
    Ok(())
  }
}
