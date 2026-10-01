use std::collections::HashMap;
use rusqlite::params;
use crate::error::AppResult;
use crate::font::FontMetadata;
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
    let conn = self.conn()?;
    let mut stmt = conn.prepare("SELECT path FROM watched_folders")?;
    let watched_folders: Vec<std::path::PathBuf> = stmt
      .query_map([], |row| {
        let path: String = row.get(0)?;
        Ok(std::path::PathBuf::from(path))
      })?
      .filter_map(|r| r.ok())
      .collect();

    let mut font_stmt = conn.prepare(
      "SELECT source, file_path, metadata_json FROM font_cache ORDER BY family_name COLLATE NOCASE ASC, id ASC",
    )?;
    let rows = font_stmt.query_map([], |row| {
      let source: String = row.get(0)?;
      let file_path: String = row.get(1)?;
      let json: String = row.get(2)?;
      Ok((source, file_path, json))
    })?;

    let mut active_fonts = Vec::new();
    for row in rows {
      let (source, file_path, json) = row?;
      let is_active = if source == "system" || source == "user" {
        true
      } else {
        let f_buf = std::path::PathBuf::from(&file_path);
        watched_folders.iter().any(|wf| crate::protocol::is_same_or_subpath(wf, &f_buf))
      };

      if is_active {
        if let Ok(meta) = serde_json::from_str::<FontMetadata>(&json) {
          active_fonts.push(meta);
        }
      }
    }

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

    // 중복 제거 및 clean_hash 추출
    let mut unique_keys = std::collections::HashSet::new();
    for hash in hashes {
      unique_keys.insert(hash.as_str());
      let clean_hash = hash.split(':').next().unwrap_or(hash);
      unique_keys.insert(clean_hash);
    }
    let key_vec: Vec<&str> = unique_keys.into_iter().collect();

    // SQLite 파라미터 한도를 고려하여 200개 단위 청크로 일괄 IN 쿼리 수행
    for chunk in key_vec.chunks(200) {
      let placeholders = (1..=chunk.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(",");
      let sql = format!(
        "SELECT metadata_json FROM font_cache WHERE file_hash IN ({0}) OR id IN ({0}) OR file_path IN ({0})",
        placeholders
      );
      let mut stmt = conn.prepare(&sql)?;
      let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
      let rows = stmt.query_map(params.as_slice(), |row| {
        let json: String = row.get(0)?;
        Ok(json)
      })?;

      for row in rows {
        let json = row?;
        if let Ok(meta) = serde_json::from_str::<FontMetadata>(&json) {
          if seen_ids.insert(meta.id.clone()) {
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
    let mut conn = self.conn()?;

    // 1. 감시 폴더 목록 조회
    let watched_folders: Vec<std::path::PathBuf> = {
      let mut stmt = conn.prepare("SELECT path FROM watched_folders")?;
      let paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
      paths.into_iter().map(std::path::PathBuf::from).collect()
    };

    // 2. set_fonts에 등록되지 않은 external 폰트 후보군만 SQL 레벨에서 1차 선별 (N+1 쿼리 제거)
    let candidate_rows: Vec<(String, String)> = {
      let mut stmt = conn.prepare(
        "
        SELECT fc.id, fc.file_path
        FROM font_cache fc
        WHERE fc.source = 'external'
          AND NOT EXISTS (
            SELECT 1 FROM set_fonts sf
            WHERE sf.font_id = fc.id
               OR (fc.file_hash IS NOT NULL AND (
                   sf.font_id = fc.file_hash
                   OR sf.font_id = fc.file_hash || ':0'
               ))
          )
        ",
      )?;
      let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
      })?;
      let mut list = Vec::new();
      for r in rows {
        if let Ok(item) = r {
          list.push(item);
        }
      }
      list
    };

    // 3. 감시 폴더 하위에도 포함되지 않는 고아 폰트 id 수집
    let to_delete: Vec<String> = candidate_rows
      .into_iter()
      .filter_map(|(id, file_path)| {
        let path_buf = std::path::PathBuf::from(&file_path);
        let belongs_to_watched = watched_folders.iter().any(|f| {
          crate::protocol::is_same_or_subpath(f, &path_buf)
        });
        if !belongs_to_watched {
          Some(id)
        } else {
          None
        }
      })
      .collect();

    if to_delete.is_empty() {
      return Ok(0);
    }

    // 4. 트랜잭션 기반 일괄 삭제 (트랜잭션 누락 수정 및 autocommit I/O 방지)
    let deleted_count = to_delete.len();
    let tx = conn.transaction()?;
    {
      let mut del_stmt = tx.prepare_cached("DELETE FROM font_cache WHERE id = ?1")?;
      for del_id in &to_delete {
        del_stmt.execute(params![del_id])?;
      }
    }
    tx.commit()?;

    Ok(deleted_count)
  }
}
