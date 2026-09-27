use rusqlite::params;
use crate::error::AppResult;
use super::models::DbFolder;
use super::Database;

impl Database {
  pub fn get_folders(&self) -> AppResult<Vec<DbFolder>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT id, path, name, color FROM watched_folders ORDER BY id ASC")?;
    let rows = stmt.query_map([], |row| {
      Ok(DbFolder {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        color: row.get(3)?,
      })
    })?;
    let mut folders = Vec::new();
    for row in rows {
      folders.push(row?);
    }
    Ok(folders)
  }

  pub fn add_folder(&self, path: &str, name: &str, color: Option<&str>) -> AppResult<DbFolder> {
    let conn = self.conn()?;
    let folder_color = color.unwrap_or("#0ea5e9");
    conn.execute(
      "INSERT OR REPLACE INTO watched_folders (path, name, color) VALUES (?1, ?2, ?3)",
      params![path, name, folder_color],
    )?;
    let id = conn.last_insert_rowid();
    Ok(DbFolder {
      id,
      path: path.to_string(),
      name: name.to_string(),
      color: folder_color.to_string(),
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

  pub fn remove_folder(&self, path: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let normalized = if path.ends_with('/') || path.ends_with('\\') {
        path.to_string()
      } else {
        format!("{}/", path)
      };
      let like = format!("{}%", normalized);
      tx.execute("DELETE FROM watched_folders WHERE path = ?1", params![path])?;

      // 서재 세트(set_fonts)나 즐겨찾기(favorites)에 보존된 폰트는 캐시를 유지하고,
      // 어디에도 등록되지 않은 단순 외부 폰트 캐시만 정리
      tx.execute(
        "DELETE FROM font_cache
         WHERE (file_path = ?1 OR file_path LIKE ?2)
           AND NOT EXISTS (
             SELECT 1 FROM set_fonts sf
             WHERE sf.font_id = font_cache.id
                OR (font_cache.file_hash IS NOT NULL AND (
                    sf.font_id = font_cache.file_hash
                    OR sf.font_id LIKE font_cache.file_hash || ':%'
                ))
           )
           AND NOT EXISTS (
             SELECT 1 FROM favorites fv
             WHERE fv.font_id = font_cache.id
                OR (font_cache.file_hash IS NOT NULL AND (
                    fv.font_id = font_cache.file_hash
                    OR fv.font_id LIKE font_cache.file_hash || ':%'
                ))
           )",
        params![path, like],
      )?;
    }
    tx.commit()?;
    Ok(())
  }

  pub fn update_folder_path(&self, old_path: &str, new_path: &str, new_name: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      tx.execute(
        "UPDATE watched_folders SET path = ?1, name = ?2 WHERE path = ?3",
        params![new_path, new_name, old_path],
      )?;

      let old_normalized = if old_path.ends_with('/') || old_path.ends_with('\\') {
        old_path.to_string()
      } else {
        format!("{}/", old_path)
      };
      let old_like = format!("{}%", old_normalized);

      tx.execute(
        "UPDATE set_fonts SET font_id = ?2 || substr(font_id, length(?1) + 1) WHERE font_id LIKE ?3",
        params![old_path, new_path, old_like],
      )?;

      tx.execute(
        "UPDATE tag_fonts SET font_id = ?2 || substr(font_id, length(?1) + 1) WHERE font_id LIKE ?3",
        params![old_path, new_path, old_like],
      )?;

      tx.execute(
        "UPDATE favorites SET font_id = ?2 || substr(font_id, length(?1) + 1) WHERE font_id LIKE ?3",
        params![old_path, new_path, old_like],
      )?;

      tx.execute(
        "UPDATE activated_fonts
         SET font_id = ?2 || substr(font_id, length(?1) + 1),
             file_path = ?2 || substr(file_path, length(?1) + 1)
         WHERE file_path LIKE ?3",
        params![old_path, new_path, old_like],
      )?;
    }
    tx.commit()?;
    Ok(())
  }

  pub fn remove_folder_and_associated_data(&self, path: &str) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let normalized = if path.ends_with('/') || path.ends_with('\\') {
        path.to_string()
      } else {
        format!("{}/", path)
      };
      let like = format!("{}%", normalized);
      tx.execute("DELETE FROM watched_folders WHERE path = ?1", params![path])?;
      tx.execute("DELETE FROM set_fonts WHERE font_id = ?1 OR font_id LIKE ?2", params![path, like])?;
      tx.execute("DELETE FROM tag_fonts WHERE font_id = ?1 OR font_id LIKE ?2", params![path, like])?;
      tx.execute("DELETE FROM favorites WHERE font_id = ?1 OR font_id LIKE ?2", params![path, like])?;
      tx.execute("DELETE FROM activated_fonts WHERE file_path = ?1 OR file_path LIKE ?2", params![path, like])?;
      tx.execute("DELETE FROM font_cache WHERE file_path = ?1 OR file_path LIKE ?2", params![path, like])?;
    }
    tx.commit()?;
    Ok(())
  }

  pub fn remove_activated_fonts_by_paths(&self, paths: &[String]) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached("DELETE FROM activated_fonts WHERE file_path = ?1")?;
      for p in paths {
        stmt.execute(params![p])?;
      }
    }
    tx.commit()?;
    Ok(())
  }
}
