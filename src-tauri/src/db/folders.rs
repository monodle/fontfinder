use rusqlite::params;
use crate::error::AppResult;
use super::models::DbFolder;
use super::Database;

impl Database {
  pub fn get_folders(&self) -> AppResult<Vec<DbFolder>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT id, path, name, color, sort_order FROM watched_folders ORDER BY sort_order ASC, id ASC")?;
    let rows = stmt.query_map([], |row| {
      Ok(DbFolder {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        color: row.get(3)?,
        sort_order: row.get(4)?,
      })
    })?;
    let mut folders = Vec::new();
    for row in rows {
      folders.push(row?);
    }
    Ok(folders)
  }

  pub fn is_folder_exists(&self, path: &str) -> AppResult<bool> {
    let conn = self.conn()?;
    let count: i64 = conn.query_row(
      "SELECT COUNT(*) FROM watched_folders WHERE path = ?1 COLLATE NOCASE",
      params![path],
      |row| row.get(0),
    )?;
    Ok(count > 0)
  }

  pub fn add_folder(&self, path: &str, name: &str, color: Option<&str>, sort_order: Option<&str>) -> AppResult<DbFolder> {
    let conn = self.conn()?;
    let folder_color = color.unwrap_or("#0ea5e9");
    let calculated_order = match sort_order {
      Some(o) if !o.trim().is_empty() => o.trim().to_string(),
      _ => {
        let last_order: Option<String> = conn.query_row(
          "SELECT sort_order FROM watched_folders WHERE sort_order != '' ORDER BY sort_order DESC LIMIT 1",
          [],
          |row| row.get(0),
        ).ok();
        match last_order {
          Some(last) => format!("{}z", last),
          None => "a0".to_string(),
        }
      }
    };
    conn.execute(
      "INSERT INTO watched_folders (path, name, color, sort_order)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(path) DO UPDATE SET name = excluded.name, color = excluded.color",
      params![path, name, folder_color, calculated_order],
    )?;
    let (id, saved_sort_order) = conn.query_row(
      "SELECT id, sort_order FROM watched_folders WHERE path = ?1",
      params![path],
      |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)),
    )?;
    Ok(DbFolder {
      id,
      path: path.to_string(),
      name: name.to_string(),
      color: folder_color.to_string(),
      sort_order: saved_sort_order,
    })
  }

  pub fn update_folder_color(&self, folder_id: i64, color: &str) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE watched_folders SET color = ?1 WHERE id = ?2",
      params![color, folder_id],
    )?;
    Ok(())
  }

  pub fn update_folder_position(&self, folder_id: Option<i64>, path: Option<&str>, sort_order: &str) -> AppResult<()> {
    let conn = self.conn()?;
    if let Some(id) = folder_id {
      conn.execute(
        "UPDATE watched_folders SET sort_order = ?1 WHERE id = ?2",
        params![sort_order, id],
      )?;
    } else if let Some(p) = path {
      conn.execute(
        "UPDATE watched_folders SET sort_order = ?1 WHERE path COLLATE NOCASE = ?2",
        params![sort_order, p],
      )?;
    }
    Ok(())
  }

  fn escape_like(s: &str) -> String {
    let mut escaped = String::with_capacity(s.len() + 8);
    for c in s.chars() {
      if c == '^' || c == '%' || c == '_' {
        escaped.push('^');
      }
      escaped.push(c);
    }
    escaped
  }

  pub fn remove_folder(&self, path: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let clean_path = path.trim_end_matches(['/', '\\']);
      let escaped_prefix = Self::escape_like(clean_path);
      let like_slash = format!("{}/%", escaped_prefix);
      let like_backslash = format!("{}\\%", escaped_prefix);
      tx.execute("DELETE FROM watched_folders WHERE path COLLATE NOCASE = ?1", params![path])?;

      // 서재 세트(set_fonts)나 즐겨찾기(favorites)에 보존된 폰트는 캐시를 유지하고,
      // 어디에도 등록되지 않은 단순 외부 폰트 캐시만 정리
      // 와일드카드 문자(%, _)가 포함된 폴더 경로에 의한 타 디렉터리 연쇄 오삭제 방어
      tx.execute(
        "DELETE FROM font_cache
         WHERE (file_path COLLATE NOCASE = ?1 OR file_path COLLATE NOCASE = ?2 OR file_path LIKE ?3 ESCAPE '^' OR file_path LIKE ?4 ESCAPE '^')
           AND NOT EXISTS (
             SELECT 1 FROM set_fonts sf
             WHERE sf.font_id = font_cache.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM favorites fv
             WHERE fv.font_id = font_cache.id
           )",
        params![path, clean_path, like_slash, like_backslash],
      )?;
    }
    tx.commit()?;
    Ok(())
  }

  pub fn update_folder_path(&self, old_path: &str, new_path: &str, new_name: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let clean_old_slash = old_path.replace('\\', "/").trim_end_matches('/').to_string();
      let clean_old_backslash = old_path.replace('/', "\\").trim_end_matches('\\').to_string();
      let clean_new_slash = new_path.replace('\\', "/").trim_end_matches('/').to_string();
      let clean_new_backslash = new_path.replace('/', "\\").trim_end_matches('\\').to_string();
      let is_windows_style = new_path.contains('\\') || old_path.contains('\\');

      tx.execute(
        "UPDATE watched_folders SET path = ?1, name = ?2
         WHERE path COLLATE NOCASE = ?3 OR path COLLATE NOCASE = ?4 OR path COLLATE NOCASE = ?5 OR path COLLATE NOCASE = ?6",
        params![new_path, new_name, old_path, &clean_old_slash, &clean_old_backslash, &clean_new_slash],
      )?;

      let old_like_slash = format!("{}/%", Self::escape_like(&clean_old_slash));
      let old_like_backslash = format!("{}\\%", Self::escape_like(&clean_old_backslash));

      // 1. font_cache 대상 레코드들을 조회하여 슬래시/백슬래시 및 유니코드 손상 없이 정확하게 치환
      let mut font_cache_updates = Vec::new();
      {
        let mut stmt = tx.prepare(
          "SELECT id, file_path FROM font_cache
           WHERE file_path COLLATE NOCASE = ?1 OR file_path COLLATE NOCASE = ?2 OR file_path LIKE ?3 ESCAPE '^' OR file_path LIKE ?4 ESCAPE '^'",
        )?;
        let rows = stmt.query_map(
          params![&clean_old_slash, &clean_old_backslash, &old_like_slash, &old_like_backslash],
          |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )?;
        for r in rows {
          let (id, curr_path) = r?;
          let curr_norm = curr_path.replace('\\', "/");
          let old_norm = &clean_old_slash;

          let replaced_path = if curr_norm.eq_ignore_ascii_case(old_norm) {
            if curr_path.contains('\\') || is_windows_style {
              clean_new_backslash.clone()
            } else {
              clean_new_slash.clone()
            }
          } else {
            let old_prefix = format!("{}/", old_norm.to_lowercase());
            let curr_lower = curr_norm.to_lowercase();
            if curr_lower.starts_with(&old_prefix) {
              let rel = &curr_norm[old_norm.len() + 1..];
              let combined = format!("{}/{}", clean_new_slash, rel);
              if curr_path.contains('\\') || is_windows_style {
                combined.replace('/', "\\")
              } else {
                combined
              }
            } else {
              continue;
            }
          };

          font_cache_updates.push((id, replaced_path));
        }
      }

      if !font_cache_updates.is_empty() {
        let mut stmt = tx.prepare_cached(
          "UPDATE font_cache SET file_path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        )?;
        for (id, new_font_path) in font_cache_updates {
          stmt.execute(params![new_font_path, id])?;
        }
      }

      // 2. activated_fonts 대상 레코드들도 동일하게 안전 치환
      let mut activated_updates = Vec::new();
      {
        let mut stmt = tx.prepare(
          "SELECT font_id, file_path FROM activated_fonts
           WHERE file_path COLLATE NOCASE = ?1 OR file_path COLLATE NOCASE = ?2 OR file_path LIKE ?3 ESCAPE '^' OR file_path LIKE ?4 ESCAPE '^'",
        )?;
        let rows = stmt.query_map(
          params![&clean_old_slash, &clean_old_backslash, &old_like_slash, &old_like_backslash],
          |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )?;
        for r in rows {
          let (font_id, curr_path) = r?;
          let curr_norm = curr_path.replace('\\', "/");
          let old_norm = &clean_old_slash;

          let replaced_path = if curr_norm.eq_ignore_ascii_case(old_norm) {
            if curr_path.contains('\\') || is_windows_style {
              clean_new_backslash.clone()
            } else {
              clean_new_slash.clone()
            }
          } else {
            let old_prefix = format!("{}/", old_norm.to_lowercase());
            let curr_lower = curr_norm.to_lowercase();
            if curr_lower.starts_with(&old_prefix) {
              let rel = &curr_norm[old_norm.len() + 1..];
              let combined = format!("{}/{}", clean_new_slash, rel);
              if curr_path.contains('\\') || is_windows_style {
                combined.replace('/', "\\")
              } else {
                combined
              }
            } else {
              continue;
            }
          };

          activated_updates.push((font_id, replaced_path));
        }
      }

      if !activated_updates.is_empty() {
        let mut stmt = tx.prepare_cached(
          "UPDATE activated_fonts SET file_path = ?1 WHERE font_id = ?2",
        )?;
        for (font_id, new_font_path) in activated_updates {
          stmt.execute(params![new_font_path, font_id])?;
        }
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn remove_folder_and_associated_data(&self, path: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let clean_path = path.trim_end_matches(['/', '\\']);
      let escaped_prefix = Self::escape_like(clean_path);
      let like_slash = format!("{}/%", escaped_prefix);
      let like_backslash = format!("{}\\%", escaped_prefix);
      tx.execute("DELETE FROM watched_folders WHERE path COLLATE NOCASE = ?1", params![path])?;
      // font_cache 삭제 시 CASCADE로 set_fonts, tag_fonts, favorites, activated_fonts가 자동 정리됨
      tx.execute(
        "DELETE FROM font_cache WHERE file_path COLLATE NOCASE = ?1 OR file_path COLLATE NOCASE = ?2 OR file_path LIKE ?3 ESCAPE '^' OR file_path LIKE ?4 ESCAPE '^'",
        params![path, clean_path, like_slash, like_backslash],
      )?;
    }
    tx.commit()?;
    Ok(())
  }

  pub fn remove_activated_fonts_by_paths(&self, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      for chunk in paths.chunks(200) {
        let placeholders = (1..=chunk.len())
          .map(|i| format!("?{}", i))
          .collect::<Vec<_>>()
          .join(",");
        let sql = format!(
          "DELETE FROM activated_fonts WHERE file_path COLLATE NOCASE IN ({})",
          placeholders
        );
        let mut stmt = tx.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
        stmt.execute(params.as_slice())?;
      }
    }
    tx.commit()?;
    Ok(())
  }
}
