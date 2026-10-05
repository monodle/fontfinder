use rusqlite::Connection;
use crate::error::AppResult;

pub fn initialize_schema(conn: &Connection) -> AppResult<()> {
  // 배포 전 스키마 전환: font_cache의 id 컬럼 타입이 INTEGER인지 확인
  let mut is_id_integer = false;
  if let Ok(mut stmt) = conn.prepare("PRAGMA table_info(font_cache)") {
    let rows = stmt.query_map([], |row| {
      let name: String = row.get(1)?;
      let col_type: String = row.get(2)?;
      Ok((name, col_type))
    });
    if let Ok(rows) = rows {
      for r in rows.flatten() {
        if r.0 == "id" && r.1.to_uppercase().contains("INT") {
          is_id_integer = true;
          break;
        }
      }
    }
  }

  let table_exists: bool = conn
    .query_row(
      "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='font_cache')",
      [],
      |row| row.get(0),
    )
    .unwrap_or(false);

  // 만약 id가 TEXT인 레거시 테이블이 존재한다면, 깨끗하게 드롭 후 INTEGER PK로 재생성
  if table_exists && !is_id_integer {
    conn.execute_batch(
      "
      DROP TABLE IF EXISTS set_fonts;
      DROP TABLE IF EXISTS tag_fonts;
      DROP TABLE IF EXISTS favorites;
      DROP TABLE IF EXISTS activated_fonts;
      DROP TABLE IF EXISTS font_cache;
      ",
    )?;
  }

  conn.execute_batch(
    "
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 67108864;
    PRAGMA cache_size = -32768;
    PRAGMA foreign_keys = ON;

    -- 1. 테이블 정의
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      parent_id INTEGER REFERENCES sets(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0ea5e9',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#92400e',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS font_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      font_index INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL,
      mtime INTEGER NOT NULL,
      family_name TEXT NOT NULL,
      source TEXT NOT NULL,
      fast_hash TEXT NOT NULL,
      deep_hash TEXT,
      file_hash TEXT,
      metadata_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_font_cache_file UNIQUE(file_path, font_index)
    );

    CREATE TABLE IF NOT EXISTS set_fonts (
      set_id INTEGER NOT NULL,
      font_id INTEGER NOT NULL,
      PRIMARY KEY (set_id, font_id),
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
      FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tag_fonts (
      tag_id INTEGER NOT NULL,
      font_id INTEGER NOT NULL,
      PRIMARY KEY (tag_id, font_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      font_id INTEGER PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activated_fonts (
      font_id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
    );

    -- 2. 최적화 인덱스 정의
    CREATE INDEX IF NOT EXISTS idx_font_cache_path ON font_cache(file_path COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_font_cache_fast_hash ON font_cache(fast_hash, font_index);
    CREATE INDEX IF NOT EXISTS idx_font_cache_deep_hash ON font_cache(deep_hash) WHERE deep_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_font_cache_file_hash ON font_cache(file_hash) WHERE file_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_font_cache_family ON font_cache(family_name COLLATE NOCASE ASC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_font_cache_source ON font_cache(source);
    CREATE INDEX IF NOT EXISTS idx_font_cache_external ON font_cache(id, file_path) WHERE source = 'external';
    CREATE INDEX IF NOT EXISTS idx_set_fonts_font_id ON set_fonts(font_id);
    CREATE INDEX IF NOT EXISTS idx_tag_fonts_font_id ON tag_fonts(font_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC, font_id);
    CREATE INDEX IF NOT EXISTS idx_activated_fonts_activated_at ON activated_fonts(activated_at ASC);
    CREATE INDEX IF NOT EXISTS idx_activated_fonts_path ON activated_fonts(file_path);
    ",
  )?;

  // 1. parent_id 컬럼 확보 후 인덱스 생성
  let mut stmt = conn.prepare("PRAGMA table_info(sets)")?;
  let mut has_parent_id = false;
  let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
  for col_name in rows {
    if let Ok(name) = col_name {
      if name == "parent_id" {
        has_parent_id = true;
        break;
      }
    }
  }
  if !has_parent_id {
    let _ = conn.execute(
      "ALTER TABLE sets ADD COLUMN parent_id INTEGER REFERENCES sets(id) ON DELETE CASCADE",
      [],
    );
  }

  // 2. sets 테이블의 name UNIQUE 제약 해제 마이그레이션 (서재 이름 중복 허용)
  let sets_sql: String = conn
    .query_row(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='sets'",
      [],
      |row| row.get(0),
    )
    .unwrap_or_default();

  if sets_sql.to_uppercase().contains("UNIQUE") {
    conn.execute_batch(
      "
      PRAGMA foreign_keys = OFF;
      CREATE TABLE sets_migration_backup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6366f1',
        parent_id INTEGER REFERENCES sets(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO sets_migration_backup (id, name, color, parent_id, created_at)
        SELECT id, name, color, parent_id, created_at FROM sets;
      DROP TABLE sets;
      ALTER TABLE sets_migration_backup RENAME TO sets;
      PRAGMA foreign_keys = ON;
      ",
    )?;
  }

  // 3. 인덱스 확보
  let _ = conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_sets_parent_id ON sets(parent_id)",
    [],
  );

  Ok(())
}
