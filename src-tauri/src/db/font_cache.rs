use std::collections::HashMap;
use rusqlite::params;
use crate::error::AppResult;
use crate::font::{FontMetadata, FontSource};
use super::Database;

impl Database {
  pub fn is_font_path_cached(&self, path: &str) -> AppResult<bool> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare_cached("SELECT 1 FROM font_cache WHERE file_path = ?1 COLLATE NOCASE LIMIT 1")?;
    let exists = stmt.exists(params![path])?;
    Ok(exists)
  }

  pub fn get_all_cached_fonts(&self) -> AppResult<Vec<FontMetadata>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare(
      "SELECT metadata_json FROM font_cache ORDER BY family_name COLLATE NOCASE ASC, id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
      let json: String = row.get(0)?;
      Ok(json)
    })?;

    let mut fonts = Vec::new();
    for row in rows {
      let json_str = row?;
      if let Ok(meta) = serde_json::from_str::<FontMetadata>(&json_str) {
        fonts.push(meta);
      }
    }
    Ok(fonts)
  }

  /// 현재 등록된 감시 폴더(watched_folders) 및 시스템/사용자 디렉토리에 유효한 활성 폰트만 반환
  pub fn get_active_cached_fonts(&self) -> AppResult<Vec<FontMetadata>> {
    let (watched_folders, all_fonts) = {
      let conn = self.conn()?;
      let mut stmt = conn.prepare("SELECT path FROM watched_folders")?;
      let watched: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

      let mut font_stmt = conn.prepare(
        "SELECT metadata_json FROM font_cache ORDER BY family_name COLLATE NOCASE ASC, id ASC",
      )?;
      let rows = font_stmt.query_map([], |row| {
        let json: String = row.get(0)?;
        Ok(json)
      })?;

      let mut fonts = Vec::new();
      for row in rows {
        let json_str = row?;
        if let Ok(meta) = serde_json::from_str::<FontMetadata>(&json_str) {
          fonts.push(meta);
        }
      }
      (watched, fonts)
    };

    let active_fonts = all_fonts
      .into_iter()
      .filter(|f| {
        if f.source == FontSource::System || f.source == FontSource::User {
          return true;
        }
        let f_buf = std::path::PathBuf::from(&f.file_path);
        watched_folders.iter().any(|wf| {
          let wf_buf = std::path::PathBuf::from(wf);
          crate::protocol::is_same_or_subpath(&wf_buf, &f_buf)
        })
      })
      .collect();
    Ok(active_fonts)
  }

  pub fn get_cached_fonts_by_prefix(&self, prefix: &str) -> AppResult<Vec<FontMetadata>> {
    let all = self.get_all_cached_fonts()?;
    let prefix_buf = std::path::PathBuf::from(prefix);
    let filtered = all
      .into_iter()
      .filter(|f| {
        let f_buf = std::path::PathBuf::from(&f.file_path);
        crate::protocol::is_same_or_subpath(&prefix_buf, &f_buf)
      })
      .collect();
    Ok(filtered)
  }

  pub fn get_font_cache_entries(&self) -> AppResult<HashMap<String, (u64, i64)>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT file_path, file_size, mtime FROM font_cache")?;
    let rows = stmt.query_map([], |row| {
      let path: String = row.get(0)?;
      let size: i64 = row.get(1)?;
      let mtime: i64 = row.get(2)?;
      Ok((path, (size as u64, mtime)))
    })?;

    let mut map = HashMap::new();
    for row in rows {
      let (path, (size, mtime)) = row?;
      map.insert(path, (size, mtime));
    }
    Ok(map)
  }

  pub fn save_cached_fonts(&self, items: &[(FontMetadata, i64)]) -> AppResult<()> {
    if items.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached(
        "
        INSERT INTO font_cache (id, file_path, file_size, mtime, family_name, source, file_hash, metadata_json, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          file_size = excluded.file_size,
          mtime = excluded.mtime,
          family_name = excluded.family_name,
          source = excluded.source,
          file_hash = excluded.file_hash,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP
        ",
      )?;

      for (meta, mtime) in items {
        let json = serde_json::to_string(meta).unwrap_or_default();
        let source_str = format!("{:?}", meta.source).to_lowercase();
        stmt.execute(params![
          meta.id,
          meta.file_path,
          meta.file_size as i64,
          mtime,
          meta.family_name,
          source_str,
          meta.file_hash,
          json
        ])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn get_cached_fonts_by_hashes(&self, hashes: &[String]) -> AppResult<Vec<FontMetadata>> {
    if hashes.is_empty() {
      return Ok(Vec::new());
    }
    let conn = self.conn()?;
    let mut fonts = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    let mut stmt = conn.prepare(
      "SELECT metadata_json FROM font_cache WHERE file_hash = ?1 OR id = ?1 OR file_path = ?1 OR file_hash = ?2 LIMIT 1",
    )?;
    for hash in hashes {
      let clean_hash = hash.split(':').next().unwrap_or(hash);
      let mut rows = stmt.query(params![hash, clean_hash])?;
      if let Some(row) = rows.next()? {
        let json: String = row.get(0)?;
        if let Ok(meta) = serde_json::from_str::<FontMetadata>(&json) {
          if !seen_ids.contains(&meta.id) {
            seen_ids.insert(meta.id.clone());
            fonts.push(meta);
          }
        }
      }
    }
    Ok(fonts)
  }

  pub fn delete_cached_fonts_by_paths(&self, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached("DELETE FROM font_cache WHERE file_path = ?1")?;
      for path in paths {
        stmt.execute(params![path])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  /// 감시 폴더 및 서재 세트 어디에도 속하지 않는 고아 외부 폰트 캐시 정리
  pub fn cleanup_orphan_cached_fonts(&self) -> AppResult<usize> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT path FROM watched_folders")?;
    let folders: Vec<String> = stmt
      .query_map([], |row| row.get(0))?
      .filter_map(|r| r.ok())
      .collect();

    let mut stmt = conn.prepare(
      "SELECT id, file_path, file_hash FROM font_cache WHERE source = 'external'"
    )?;
    let rows = stmt.query_map([], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?))
    })?;

    let mut to_delete = Vec::new();
    for row in rows {
      if let Ok((id, file_path, file_hash)) = row {
        let file_path_buf = std::path::PathBuf::from(&file_path);
        let belongs_to_watched = folders.iter().any(|f| {
          let folder_buf = std::path::PathBuf::from(f);
          crate::protocol::is_same_or_subpath(&folder_buf, &file_path_buf)
        });

        if !belongs_to_watched {
          let hash_key = file_hash.as_ref().map(|h| format!("{}:0", h)).unwrap_or_default();
          let in_set: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM set_fonts WHERE font_id = ?1 OR font_id = ?2)",
            params![id, hash_key],
            |r| r.get(0),
          ).unwrap_or(false);

          if !in_set {
            to_delete.push(id);
          }
        }
      }
    }

    if !to_delete.is_empty() {
      let mut del_stmt = conn.prepare("DELETE FROM font_cache WHERE id = ?1")?;
      for del_id in &to_delete {
        let _ = del_stmt.execute(params![del_id]);
      }
    }

    Ok(to_delete.len())
  }
}
