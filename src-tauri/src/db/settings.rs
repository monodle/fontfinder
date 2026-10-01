use rusqlite::{params, OptionalExtension};
use crate::error::AppResult;
use super::Database;

impl Database {
  pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
    let conn = self.conn()?;
    let val = conn
      .query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
      )
      .optional()?;
    Ok(val)
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

