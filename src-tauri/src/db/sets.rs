use rusqlite::params;
use crate::error::AppResult;
use super::models::FontSet;
use super::Database;

impl Database {
  pub fn create_set(&self, name: &str, color: Option<&str>, parent_id: Option<i64>, sort_order: Option<&str>) -> AppResult<FontSet> {
    let conn = self.conn()?;
    let set_color = color.unwrap_or("#6366f1");
    let calculated_order = match sort_order {
      Some(o) if !o.trim().is_empty() => o.trim().to_string(),
      _ => {
        let last_order: Option<String> = match parent_id {
          Some(pid) => conn.query_row(
            "SELECT sort_order FROM sets WHERE parent_id = ?1 AND sort_order != '' ORDER BY sort_order DESC LIMIT 1",
            params![pid],
            |row| row.get(0),
          ).ok(),
          None => conn.query_row(
            "SELECT sort_order FROM sets WHERE parent_id IS NULL AND sort_order != '' ORDER BY sort_order DESC LIMIT 1",
            [],
            |row| row.get(0),
          ).ok(),
        };
        match last_order {
          Some(last) => format!("{}z", last),
          None => "a0".to_string(),
        }
      }
    };
    conn.execute(
      "INSERT INTO sets (name, color, parent_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
      params![name, set_color, parent_id, calculated_order],
    )?;
    let id = conn.last_insert_rowid();
    Ok(FontSet {
      id,
      name: name.to_string(),
      color: set_color.to_string(),
      count: 0,
      parent_id,
      sort_order: calculated_order,
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

  pub fn update_set(&self, set_id: i64, name: &str, color: &str, parent_id: Option<i64>) -> AppResult<()> {
    let conn = self.conn()?;
    if let Some(pid) = parent_id {
      if would_create_cycle(&conn, set_id, pid) {
        return Err(crate::error::AppError::Platform("Cannot set itself or descendants as parent set (circular reference prevented).".to_string()));
      }
    }
    conn.execute(
      "UPDATE sets SET name = ?1, color = ?2, parent_id = ?3 WHERE id = ?4",
      params![name, color, parent_id, set_id],
    )?;
    Ok(())
  }

  pub fn update_set_parent(&self, set_id: i64, parent_id: Option<i64>) -> AppResult<()> {
    let conn = self.conn()?;
    if let Some(pid) = parent_id {
      if would_create_cycle(&conn, set_id, pid) {
        return Err(crate::error::AppError::Platform("Cannot set itself or descendants as parent set (circular reference prevented).".to_string()));
      }
    }
    conn.execute(
      "UPDATE sets SET parent_id = ?1 WHERE id = ?2",
      params![parent_id, set_id],
    )?;
    Ok(())
  }

  pub fn update_set_position(&self, set_id: i64, parent_id: Option<i64>, sort_order: &str) -> AppResult<()> {
    let conn = self.conn()?;
    if let Some(pid) = parent_id {
      if would_create_cycle(&conn, set_id, pid) {
        return Err(crate::error::AppError::Platform("Cannot set itself or descendants as parent set (circular reference prevented).".to_string()));
      }
    }
    conn.execute(
      "UPDATE sets SET parent_id = ?1, sort_order = ?2 WHERE id = ?3",
      params![parent_id, sort_order, set_id],
    )?;
    Ok(())
  }

  pub fn get_sets(&self) -> AppResult<Vec<FontSet>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare(
      "
      SELECT s.id, s.name, s.color, COUNT(sf.font_id) as font_count, s.parent_id, s.sort_order
      FROM sets s
      LEFT JOIN set_fonts sf ON sf.set_id = s.id
      GROUP BY s.sort_order, s.id
      ORDER BY s.sort_order ASC, s.id ASC
      ",
    )?;

    let rows = stmt.query_map([], |row| {
      let id: i64 = row.get(0)?;
      let name: String = row.get(1)?;
      let color: String = row.get(2)?;
      let count: usize = row.get(3)?;
      let parent_id: Option<i64> = row.get(4)?;
      let sort_order: String = row.get(5)?;
      Ok(FontSet { id, name, color, count, parent_id, sort_order })
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

  pub fn add_font_to_set(&self, set_id: i64, font_id: i64) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "INSERT OR IGNORE INTO set_fonts (set_id, font_id) VALUES (?1, ?2)",
      params![set_id, font_id],
    )?;
    Ok(())
  }

  pub fn remove_font_from_set(&self, set_id: i64, font_id: i64) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "DELETE FROM set_fonts WHERE set_id = ?1 AND font_id = ?2",
      params![set_id, font_id],
    )?;
    Ok(())
  }

  pub fn get_set_font_ids(&self, set_id: i64) -> AppResult<Vec<i64>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT font_id FROM set_fonts WHERE set_id = ?1")?;
    let rows = stmt.query_map(params![set_id], |row| row.get::<_, i64>(0))?;
    let mut ids = Vec::new();
    for row in rows {
      ids.push(row?);
    }
    Ok(ids)
  }

  /// 모든 세트의 font_id 매핑을 1회의 쿼리로 일괄 조회하여 1+N 쿼리를 방지
  pub fn get_all_set_font_ids(&self) -> AppResult<std::collections::HashMap<i64, Vec<i64>>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT set_id, font_id FROM set_fonts ORDER BY set_id ASC")?;
    let rows = stmt.query_map([], |row| {
      let set_id: i64 = row.get(0)?;
      let font_id: i64 = row.get(1)?;
      Ok((set_id, font_id))
    })?;

    let mut map: std::collections::HashMap<i64, Vec<i64>> = std::collections::HashMap::new();
    for row in rows {
      let (set_id, font_id) = row?;
      map.entry(set_id).or_default().push(font_id);
    }
    Ok(map)
  }

  /// 단일 트랜잭션 내에서 여러 폰트를 세트에 일괄 추가
  pub fn add_fonts_to_set_bulk(&self, set_id: i64, font_ids: &[i64]) -> AppResult<()> {
    if font_ids.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached("INSERT OR IGNORE INTO set_fonts (set_id, font_id) VALUES (?1, ?2)")?;
      for &font_id in font_ids {
        stmt.execute(params![set_id, font_id])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  /// 단일 트랜잭션 내에서 여러 폰트를 세트에서 일괄 제거
  pub fn remove_fonts_from_set_bulk(&self, set_id: i64, font_ids: &[i64]) -> AppResult<()> {
    if font_ids.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached("DELETE FROM set_fonts WHERE set_id = ?1 AND font_id = ?2")?;
      for &font_id in font_ids {
        stmt.execute(params![set_id, font_id])?;
      }
    }
    tx.commit()?;
    Ok(())
  }
}

/// 계층형 세트 트리 순환 참조(Cycle Reference) 탐지 헬퍼
fn would_create_cycle(conn: &rusqlite::Connection, set_id: i64, new_parent_id: i64) -> bool {
  if set_id == new_parent_id {
    return true;
  }
  let mut current = new_parent_id;
  for _ in 0..100 {
    let parent_res: Result<Option<i64>, _> = conn.query_row(
      "SELECT parent_id FROM sets WHERE id = ?1",
      params![current],
      |row| row.get(0),
    );

    match parent_res {
      Ok(Some(pid)) if pid == set_id => return true,
      Ok(Some(pid)) => current = pid,
      _ => return false,
    }
  }
  true // 최대 깊이(100) 초과 또는 순환 구조 감지 시 안전하게 차단
}
