-- =========================================================================
-- Font Finder - Database Migration V1: Initial Schema
-- =========================================================================

-- =========================================================================
-- 1. 핵심 테이블 정의 (Table Definitions)
-- =========================================================================

-- [sets] 서재 세트 메타데이터 테이블
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  parent_id INTEGER REFERENCES sets(id) ON DELETE CASCADE,
  sort_order TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- [watched_folders] 감시 대상 로컬 디렉토리 관리 테이블
CREATE TABLE IF NOT EXISTS watched_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0ea5e9',
  sort_order TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- [settings] 전역 Key-Value 설정 저장소
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- [tags] 사용자 정의 폰트 태그 메타데이터 테이블
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#92400e',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- [font_cache] 스캔된 폰트 파일 메타데이터 캐시 테이블
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

-- [set_fonts] 서재-폰트 매핑 테이블
CREATE TABLE IF NOT EXISTS set_fonts (
  set_id INTEGER NOT NULL,
  font_id INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (set_id, font_id),
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
  FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
);

-- [tag_fonts] 태그-폰트 매핑 테이블
CREATE TABLE IF NOT EXISTS tag_fonts (
  tag_id INTEGER NOT NULL,
  font_id INTEGER NOT NULL,
  PRIMARY KEY (tag_id, font_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
);

-- [favorites] 즐겨찾기 폰트 테이블
CREATE TABLE IF NOT EXISTS favorites (
  font_id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
);

-- [activated_fonts] 임시 활성화 폰트 추적 테이블
CREATE TABLE IF NOT EXISTS activated_fonts (
  font_id INTEGER PRIMARY KEY,
  file_path TEXT NOT NULL,
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (font_id) REFERENCES font_cache(id) ON DELETE CASCADE
);

-- =========================================================================
-- 2. 최적화 인덱스 정의 (Optimization Indexes)
-- =========================================================================

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
CREATE INDEX IF NOT EXISTS idx_sets_parent_id ON sets(parent_id);
CREATE INDEX IF NOT EXISTS idx_sets_parent_order ON sets(parent_id, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_watched_folders_order ON watched_folders(sort_order ASC, id ASC);
