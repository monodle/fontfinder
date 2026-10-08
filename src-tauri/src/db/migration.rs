use rusqlite::Connection;
use crate::error::AppResult;

pub struct Migration {
  pub version: i32,
  pub name: &'static str,
  pub sql: &'static str,
}

/// 컴파일 타임에 포함되는 파일 기반 마이그레이션 레지스트리
/// 새로운 마이그레이션이 필요하면 migrations/ 폴더에 V{N}__xxx.sql 파일을 만들고 여기에 등록합니다.
pub const MIGRATIONS: &[Migration] = &[
  Migration {
    version: 1,
    name: "initial_schema",
    sql: include_str!("../../migrations/V1__initial_schema.sql"),
  },
  Migration {
    version: 2,
    name: "optimize_indexes",
    sql: include_str!("../../migrations/V2__optimize_indexes.sql"),
  },
];

/// SQLite PRAGMA user_version 기반 자동 순차 마이그레이션 실행기
pub fn run_migrations(conn: &mut Connection) -> AppResult<()> {
  let current_version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

  for migration in MIGRATIONS {
    if migration.version > current_version {
      let tx = conn.transaction()?;

      // 1) SQL 마이그레이션 배치 실행
      tx.execute_batch(migration.sql)?;

      // 2) V1 최초 적용 시 레거시 settings 정렬 데이터가 있다면 시드 보정
      if migration.version == 1 {
        migrate_initial_sort_orders(&tx)?;
      }

      // 3) user_version 갱신
      tx.pragma_update(None, "user_version", migration.version)?;

      tx.commit()?;
    }
  }

  Ok(())
}

/// Fractional Indexing 표준에 호환되는 순차 초기 키 생성 함수
/// 0..61 -> "a0".."az", 62..3905 -> "b00".."bzz"
pub fn generate_initial_key(index: usize) -> String {
  const BASE62: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  if index < 62 {
    format!("a{}", BASE62[index] as char)
  } else if index < 62 + 62 * 62 {
    let rem = index - 62;
    format!("b{}{}", BASE62[rem / 62] as char, BASE62[rem % 62] as char)
  } else {
    format!("c{:04}", index)
  }
}

/// 기존 레거시 settings.set_order 및 folder_order를 반영한 1회성 초기화 마이그레이션
fn migrate_initial_sort_orders(conn: &Connection) -> AppResult<()> {
  // A. sets 테이블 빈 sort_order 마이그레이션
  let empty_sets_count: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM sets WHERE sort_order = ''",
      [],
      |row| row.get(0),
    )
    .unwrap_or(0);

  if empty_sets_count > 0 {
    let legacy_set_order: Option<String> = conn
      .query_row(
        "SELECT value FROM settings WHERE key = 'set_order'",
        [],
        |row| row.get(0),
      )
      .ok();

    let mut ordered_set_ids = Vec::new();
    if let Some(json_str) = legacy_set_order {
      if let Ok(ids) = serde_json::from_str::<Vec<i64>>(&json_str) {
        ordered_set_ids = ids;
      }
    }

    let mut current_idx = 0;
    // 1순위: 기존 set_order 배열 순서대로 키 부여
    for set_id in ordered_set_ids {
      let key = generate_initial_key(current_idx);
      let _ = conn.execute(
        "UPDATE sets SET sort_order = ?1 WHERE id = ?2 AND sort_order = ''",
        rusqlite::params![key, set_id],
      );
      current_idx += 1;
    }

    // 2순위: set_order에 누락되었던 나머지 세트 처리 (id ASC 순)
    let mut stmt = conn.prepare("SELECT id FROM sets WHERE sort_order = '' ORDER BY id ASC")?;
    let remaining_ids: Vec<i64> = stmt
      .query_map([], |row| row.get(0))?
      .flatten()
      .collect();

    for set_id in remaining_ids {
      let key = generate_initial_key(current_idx);
      let _ = conn.execute(
        "UPDATE sets SET sort_order = ?1 WHERE id = ?2",
        rusqlite::params![key, set_id],
      );
      current_idx += 1;
    }
  }

  // B. watched_folders 테이블 빈 sort_order 마이그레이션
  let empty_folders_count: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM watched_folders WHERE sort_order = ''",
      [],
      |row| row.get(0),
    )
    .unwrap_or(0);

  if empty_folders_count > 0 {
    let legacy_folder_order: Option<String> = conn
      .query_row(
        "SELECT value FROM settings WHERE key = 'folder_order'",
        [],
        |row| row.get(0),
      )
      .ok();

    let mut ordered_paths = Vec::new();
    if let Some(json_str) = legacy_folder_order {
      if let Ok(paths) = serde_json::from_str::<Vec<String>>(&json_str) {
        ordered_paths = paths;
      }
    }

    let mut current_idx = 0;
    // 1순위: 기존 folder_order 배열 순서대로 키 부여
    for path in ordered_paths {
      let key = generate_initial_key(current_idx);
      let _ = conn.execute(
        "UPDATE watched_folders SET sort_order = ?1 WHERE path = ?2 AND sort_order = ''",
        rusqlite::params![key, path],
      );
      current_idx += 1;
    }

    // 2순위: 누락된 나머지 폴더 처리 (id ASC 순)
    let mut stmt = conn.prepare("SELECT id FROM watched_folders WHERE sort_order = '' ORDER BY id ASC")?;
    let remaining_ids: Vec<i64> = stmt
      .query_map([], |row| row.get(0))?
      .flatten()
      .collect();

    for folder_id in remaining_ids {
      let key = generate_initial_key(current_idx);
      let _ = conn.execute(
        "UPDATE watched_folders SET sort_order = ?1 WHERE id = ?2",
        rusqlite::params![key, folder_id],
      );
      current_idx += 1;
    }
  }

  Ok(())
}
