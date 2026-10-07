use std::collections::HashMap;
use rusqlite::params;
use crate::error::AppResult;
use crate::font::FontMetadata;
use super::Database;

#[derive(Debug, Clone)]
pub struct FontCacheEntry {
  pub id: i64,
  pub file_path: String,
  pub font_index: u32,
  pub file_size: u64,
  pub mtime: i64,
  pub fast_hash: String,
  pub deep_hash: Option<String>,
  pub source: String,
  pub has_localized: bool,
}

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
      "SELECT id, file_path, fast_hash, deep_hash, metadata_json FROM font_cache ORDER BY family_name COLLATE NOCASE ASC, id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
      let id: i64 = row.get(0)?;
      let file_path: String = row.get(1)?;
      let fast_hash: String = row.get(2)?;
      let deep_hash: Option<String> = row.get(3)?;
      let json: String = row.get(4)?;
      Ok((id, file_path, fast_hash, deep_hash, json))
    })?;

    let mut fonts = Vec::new();
    let mut deep_counts: HashMap<String, u32> = HashMap::new();

    for row in rows {
      let (id, file_path, fast_hash, deep_hash, json_str) = row?;
      if let Ok(mut meta) = serde_json::from_str::<FontMetadata>(&json_str) {
        meta.id = id;
        meta.file_path = file_path;
        meta.fast_hash = fast_hash.clone();
        meta.deep_hash = deep_hash.clone();
        meta.file_hash = deep_hash.as_ref().unwrap_or(&fast_hash).clone();

        if let Some(ref dh) = deep_hash {
          if !dh.is_empty() {
            *deep_counts.entry(dh.clone()).or_insert(0) += 1;
          }
        }
        fonts.push(meta);
      }
    }

    // 중복 폰트 카운트 O(N) 주입
    for font in &mut fonts {
      if let Some(ref dh) = font.deep_hash {
        if let Some(&cnt) = deep_counts.get(dh) {
          font.duplicate_count = cnt;
        }
      }
    }

    Ok(fonts)
  }

  /// 현재 등록된 감시 폴더(watched_folders) 및 시스템/사용자 디렉토리에 유효한 활성 폰트만 반환
  pub fn get_active_cached_fonts(&self) -> AppResult<Vec<FontMetadata>> {
    let watched_folders: Vec<std::path::PathBuf> = {
      let conn = self.conn()?;
      let mut stmt = conn.prepare("SELECT path FROM watched_folders")?;
      let paths: Vec<String> = stmt
        .query_map([], |row| {
          let path: String = row.get(0)?;
          Ok(path)
        })?
        .filter_map(|r| r.ok())
        .collect();
      paths.into_iter().map(std::path::PathBuf::from).collect()
    };

    let all_fonts = self.get_all_cached_fonts()?;
    let active_fonts = all_fonts
      .into_iter()
      .filter(|f| {
        let source_str = format!("{:?}", f.source).to_lowercase();
        if source_str == "system" || source_str == "user" {
          true
        } else {
          let f_buf = std::path::PathBuf::from(&f.file_path);
          watched_folders.iter().any(|wf| crate::protocol::is_same_or_subpath(wf, &f_buf))
        }
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

  /// 스캔 시 기존 DB 항목을 1회 전량 사전 로딩하여 메모리 해시맵 구성
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

  pub fn get_font_cache_full_entries(&self) -> AppResult<HashMap<(String, u32), FontCacheEntry>> {
    let conn = self.conn()?;
    let mut stmt = conn.prepare(
      "SELECT id, file_path, font_index, file_size, mtime, fast_hash, deep_hash, source, (metadata_json LIKE '%\"localized_names\"%') FROM font_cache",
    )?;
    let rows = stmt.query_map([], |row| {
      Ok(FontCacheEntry {
        id: row.get(0)?,
        file_path: row.get(1)?,
        font_index: row.get::<_, u32>(2)?,
        file_size: row.get::<_, i64>(3)? as u64,
        mtime: row.get(4)?,
        fast_hash: row.get(5)?,
        deep_hash: row.get(6)?,
        source: row.get(7)?,
        has_localized: row.get::<_, i32>(8)? != 0,
      })
    })?;

    let mut map = HashMap::new();
    for row in rows {
      let entry = row?;
      map.insert((entry.file_path.clone(), entry.font_index), entry);
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
        INSERT INTO font_cache (
          file_path, font_index, file_size, mtime, family_name, source,
          fast_hash, deep_hash, file_hash, metadata_json, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
        ON CONFLICT(file_path, font_index) DO UPDATE SET
          file_size = excluded.file_size,
          mtime = excluded.mtime,
          family_name = excluded.family_name,
          source = excluded.source,
          fast_hash = excluded.fast_hash,
          deep_hash = COALESCE(excluded.deep_hash, font_cache.deep_hash),
          file_hash = excluded.file_hash,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP
        ",
      )?;

      for (meta, mtime) in items {
        let json = serde_json::to_string(meta).unwrap_or_default();
        let source_str = format!("{:?}", meta.source).to_lowercase();
        stmt.execute(params![
          meta.file_path,
          meta.font_index,
          meta.file_size as i64,
          mtime,
          meta.family_name,
          source_str,
          meta.fast_hash,
          meta.deep_hash,
          meta.file_hash,
          json
        ])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  /// 폰트 경로 변경 감지 시 기존 정수 ID를 보존하며 file_path만 갱신
  pub fn update_font_path_preserving_id(&self, id: i64, new_path: &str, new_mtime: i64) -> AppResult<()> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE font_cache SET file_path = ?1, mtime = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
      params![new_path, new_mtime, id],
    )?;
    Ok(())
  }

  /// 온디맨드 2차 지문 일괄 업데이트
  pub fn update_font_deep_hashes_bulk(&self, items: &[(i64, String)]) -> AppResult<()> {
    if items.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      let mut stmt = tx.prepare_cached(
        "UPDATE font_cache SET deep_hash = ?1, file_hash = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
      )?;
      for (id, deep_hash) in items {
        stmt.execute(params![deep_hash, id])?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn get_cached_fonts_by_ids(&self, ids: &[i64]) -> AppResult<Vec<FontMetadata>> {
    if ids.is_empty() {
      return Ok(Vec::new());
    }
    let conn = self.conn()?;
    let mut fonts = Vec::new();

    for chunk in ids.chunks(200) {
      let placeholders = (1..=chunk.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(",");
      let sql = format!(
        "SELECT id, file_path, fast_hash, deep_hash, metadata_json FROM font_cache WHERE id IN ({})",
        placeholders
      );
      let mut stmt = conn.prepare(&sql)?;
      let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
      let rows = stmt.query_map(params.as_slice(), |row| {
        let id: i64 = row.get(0)?;
        let file_path: String = row.get(1)?;
        let fast_hash: String = row.get(2)?;
        let deep_hash: Option<String> = row.get(3)?;
        let json: String = row.get(4)?;
        Ok((id, file_path, fast_hash, deep_hash, json))
      })?;

      for row in rows {
        let (id, file_path, fast_hash, deep_hash, json) = row?;
        if let Ok(mut meta) = serde_json::from_str::<FontMetadata>(&json) {
          meta.id = id;
          meta.file_path = file_path;
          meta.fast_hash = fast_hash.clone();
          meta.deep_hash = deep_hash.clone();
          meta.file_hash = deep_hash.as_ref().unwrap_or(&fast_hash).clone();
          fonts.push(meta);
        }
      }
    }
    Ok(fonts)
  }

  pub fn get_cached_fonts_by_hashes(&self, hashes: &[String]) -> AppResult<Vec<FontMetadata>> {
    if hashes.is_empty() {
      return Ok(Vec::new());
    }
    let conn = self.conn()?;
    let mut fonts = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for chunk in hashes.chunks(200) {
      let placeholders = (1..=chunk.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(",");
      let sql = format!(
        "SELECT id, file_path, fast_hash, deep_hash, metadata_json FROM font_cache WHERE fast_hash IN ({0}) OR deep_hash IN ({0}) OR file_hash IN ({0})",
        placeholders
      );
      let mut stmt = conn.prepare(&sql)?;
      let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
      let rows = stmt.query_map(params.as_slice(), |row| {
        let id: i64 = row.get(0)?;
        let file_path: String = row.get(1)?;
        let fast_hash: String = row.get(2)?;
        let deep_hash: Option<String> = row.get(3)?;
        let json: String = row.get(4)?;
        Ok((id, file_path, fast_hash, deep_hash, json))
      })?;

      for row in rows {
        let (id, file_path, fast_hash, deep_hash, json) = row?;
        if seen_ids.insert(id) {
          if let Ok(mut meta) = serde_json::from_str::<FontMetadata>(&json) {
            meta.id = id;
            meta.file_path = file_path;
            meta.fast_hash = fast_hash.clone();
            meta.deep_hash = deep_hash.clone();
            meta.file_hash = deep_hash.as_ref().unwrap_or(&fast_hash).clone();
            fonts.push(meta);
          }
        }
      }
    }
    Ok(fonts)
  }

  pub fn delete_cached_fonts_by_ids(&self, ids: &[i64]) -> AppResult<()> {
    if ids.is_empty() {
      return Ok(());
    }
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    {
      for chunk in ids.chunks(200) {
        let placeholders = (1..=chunk.len())
          .map(|i| format!("?{}", i))
          .collect::<Vec<_>>()
          .join(",");
        let sql = format!("DELETE FROM font_cache WHERE id IN ({})", placeholders);
        let mut stmt = tx.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        stmt.execute(params.as_slice())?;
      }
    }
    tx.commit()?;
    Ok(())
  }

  pub fn delete_cached_fonts_by_paths(&self, paths: &[String]) -> AppResult<()> {
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
        let sql = format!("DELETE FROM font_cache WHERE file_path COLLATE NOCASE IN ({})", placeholders);
        let mut stmt = tx.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
        stmt.execute(params.as_slice())?;
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

    // 2. set_fonts에 등록되지 않은 external 폰트 후보군을 정수 외래키(sf.font_id = fc.id)로 직접 선별
    let candidate_rows: Vec<(i64, String)> = {
      let mut stmt = conn.prepare(
        "
        SELECT fc.id, fc.file_path
        FROM font_cache fc
        WHERE fc.source = 'external'
          AND NOT EXISTS (
            SELECT 1 FROM set_fonts sf
            WHERE sf.font_id = fc.id
          )
        ",
      )?;
      let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
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
    let to_delete: Vec<i64> = candidate_rows
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

    // 4. 트랜잭션 기반 청크 단위 일괄 삭제 (N+1 삭제 구문 실행 방지)
    let deleted_count = to_delete.len();
    let tx = conn.transaction()?;
    {
      for chunk in to_delete.chunks(200) {
        let placeholders = (1..=chunk.len())
          .map(|i| format!("?{}", i))
          .collect::<Vec<_>>()
          .join(",");
        let sql = format!("DELETE FROM font_cache WHERE id IN ({})", placeholders);
        let mut stmt = tx.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = chunk.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        stmt.execute(params.as_slice())?;
      }
    }
    tx.commit()?;

    Ok(deleted_count)
  }
}
