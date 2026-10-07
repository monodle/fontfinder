use rusqlite::Connection;
use crate::error::AppResult;

/// 데이터베이스 엔진 환경(PRAGMA) 초기화 및 파일 기반 마이그레이션 실행
pub fn initialize_schema(conn: &mut Connection) -> AppResult<()> {
  // 1. SQLite 엔진 런타임 최적화 PRAGMA 설정
  conn.execute_batch(
    "
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 67108864;
    PRAGMA cache_size = -32768;
    PRAGMA foreign_keys = ON;
    ",
  )?;

  // 2. migrations/ 디렉터리 기반 자동 순차 마이그레이션 실행
  super::migration::run_migrations(conn)?;

  Ok(())
}
