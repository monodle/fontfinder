use rusqlite::params;
use crate::error::AppResult;
use super::Database;

impl Database {
  pub fn toggle_favorite(&self, font_id: i64) -> AppResult<bool> {
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

  pub fn get_favorite_font_ids(&self) -> AppResult<Vec<i64>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT font_id FROM favorites ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
    let mut ids = Vec::new();
    for row in rows {
      ids.push(row?);
    }
    Ok(ids)
  }

  /// 단일 트랜잭션 내에서 여러 폰트의 즐겨찾기를 일괄 추가하거나 제거
  pub fn set_favorites_bulk(&self, font_ids: &[i64], add: bool) -> AppResult<()> {
    if font_ids.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      if add {
        let mut stmt = tx.prepare_cached("INSERT OR IGNORE INTO favorites (font_id) VALUES (?1)")?;
        for &font_id in font_ids {
          stmt.execute(params![font_id])?;
        }
      } else {
        let mut stmt = tx.prepare_cached("DELETE FROM favorites WHERE font_id = ?1")?;
        for &font_id in font_ids {
          stmt.execute(params![font_id])?;
        }
      }
    }
    tx.commit()?;
    Ok(())
  }
}
