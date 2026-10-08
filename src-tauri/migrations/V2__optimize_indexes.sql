-- =========================================================================
-- Font Finder - Database Migration V2: Index Optimization
-- =========================================================================

-- 1. 중복 및 비효율 인덱스 정리
-- idx_sets_parent_order(parent_id, sort_order ASC, id ASC)가 이미 선행 컬럼으로 parent_id를 보유하므로 중복 인덱스 제거
DROP INDEX IF EXISTS idx_sets_parent_id;

-- 카디널리티가 3개에 불과하고 단독 조회 쿼리가 없는 source 인덱스 제거 (external 부분 인덱스로 대체됨)
DROP INDEX IF EXISTS idx_font_cache_source;

-- 활성화 폰트 조회를 위한 기존 단순 인덱스 제거
DROP INDEX IF EXISTS idx_activated_fonts_activated_at;

-- 2. 서재 전체 정렬 최적화 인덱스 추가 (get_sets 실행 시 filesort 방지)
CREATE INDEX IF NOT EXISTS idx_sets_sort_order ON sets(sort_order ASC, id ASC);

-- 3. 활성화 폰트 커버링 인덱스 추가 (font_id, file_path 포함으로 테이블 스캔 제거)
CREATE INDEX IF NOT EXISTS idx_activated_fonts_covering ON activated_fonts(activated_at ASC, font_id, file_path);

-- 4. 활성화 폰트 경로 일괄 삭제 시 풀스캔 방지 (대소문자 무시 NOCASE 인덱스로 교체)
DROP INDEX IF EXISTS idx_activated_fonts_path;
CREATE INDEX IF NOT EXISTS idx_activated_fonts_path ON activated_fonts(file_path COLLATE NOCASE);

