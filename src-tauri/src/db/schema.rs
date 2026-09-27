use rusqlite::Connection;
use crate::error::AppResult;

pub fn initialize_schema(conn: &Connection) -> AppResult<()> {
  conn.execute_batch(
    "
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 268435456;
    PRAGMA cache_size = -131072;
    PRAGMA foreign_keys = ON;

    -- 1. 테이블 정의
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS set_fonts (
      set_id INTEGER NOT NULL,
      font_id TEXT NOT NULL,
      PRIMARY KEY (set_id, font_id),
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#92400e',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tag_fonts (
      tag_id INTEGER NOT NULL,
      font_id TEXT NOT NULL,
      PRIMARY KEY (tag_id, font_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      font_id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0ea5e9',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activated_fonts (
      font_id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS font_cache (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mtime INTEGER NOT NULL,
      family_name TEXT NOT NULL,
      source TEXT NOT NULL,
      file_hash TEXT,
      metadata_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. 인덱스 정의
    CREATE INDEX IF NOT EXISTS idx_set_fonts_font_id ON set_fonts(font_id);
    CREATE INDEX IF NOT EXISTS idx_tag_fonts_font_id ON tag_fonts(font_id);
    CREATE INDEX IF NOT EXISTS idx_activated_fonts_file_path ON activated_fonts(file_path);
    CREATE INDEX IF NOT EXISTS idx_activated_fonts_activated_at ON activated_fonts(activated_at ASC);
    CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_font_cache_file_path ON font_cache(file_path);
    CREATE INDEX IF NOT EXISTS idx_font_cache_file_path_nocase ON font_cache(file_path COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_font_cache_family_name ON font_cache(family_name);
    CREATE INDEX IF NOT EXISTS idx_font_cache_family_collate ON font_cache(family_name COLLATE NOCASE ASC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_font_cache_scan_meta ON font_cache(file_path, file_size, mtime);
    CREATE INDEX IF NOT EXISTS idx_font_cache_source ON font_cache(source);
    CREATE INDEX IF NOT EXISTS idx_font_cache_file_hash ON font_cache(file_hash);
    ",
  )?;

  Ok(())
}
