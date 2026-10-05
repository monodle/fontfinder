use super::*;
use crate::font::{FontFormat, FontMetadata, FontSource};
use crate::db::schema::initialize_schema;

fn create_dummy_font(id: i64, file_path: &str, family: &str, source: FontSource, hash: &str) -> FontMetadata {
  FontMetadata {
    id,
    file_path: file_path.to_string(),
    file_name: "test.ttf".to_string(),
    file_size: 1024,
    file_hash: hash.to_string(),
    fast_hash: hash.to_string(),
    deep_hash: None,
    duplicate_count: 1,
    font_index: 0,
    family_name: family.to_string(),
    subfamily_name: "Regular".to_string(),
    full_name: format!("{} Regular", family),
    postscript_name: family.to_string(),
    localized_names: None,
    format: FontFormat::TrueType,
    source,
    glyph_count: 100,
    weight: 400,
    is_italic: false,
    is_monospace: false,
    is_variable: false,
    version: None,
    version_num: None,
    designer: None,
    copyright: None,
    license: None,
  }
}

#[test]
fn test_schema_initialization() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  let conn = db.conn().unwrap();
  let count: i64 = conn
    .query_row(
      "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('sets', 'watched_folders', 'font_cache')",
      [],
      |r| r.get(0),
    )
    .unwrap();
  assert_eq!(count, 3);
}

#[test]
fn test_legacy_sets_migration() {
  let conn = rusqlite::Connection::open_in_memory().unwrap();
  // 구버전 sets 테이블 생성 (parent_id 컬럼 없음)
  conn.execute(
    "CREATE TABLE sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )",
    [],
  ).unwrap();

  // 기존 데이터 삽입
  conn.execute("INSERT INTO sets (name, color) VALUES ('Legacy Set', '#123456')", []).unwrap();

  // 마이그레이션 포함된 initialize_schema 실행
  initialize_schema(&conn).expect("Legacy DB migration should succeed");

  // parent_id 컬럼 및 인덱스가 정상 생성되었는지 확인
  let mut stmt = conn.prepare("PRAGMA table_info(sets)").unwrap();
  let col_names: Vec<String> = stmt
    .query_map([], |row| row.get(1))
    .unwrap()
    .map(|r| r.unwrap())
    .collect();
  assert!(col_names.contains(&"parent_id".to_string()));

  // 기존 데이터 보존 확인
  let (_id, name, color, parent_id): (i64, String, String, Option<i64>) = conn
    .query_row("SELECT id, name, color, parent_id FROM sets WHERE id = 1", [], |r| {
      Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
    })
    .unwrap();
  assert_eq!(name, "Legacy Set");
  assert_eq!(color, "#123456");
  assert_eq!(parent_id, None);
}

#[test]
fn test_settings_crud() {
  let db = Database::new_in_memory().unwrap();

  let non_existent = db.get_setting("theme").unwrap();
  assert!(non_existent.is_none());

  db.set_setting("theme", "dark").unwrap();
  let value = db.get_setting("theme").unwrap();
  assert_eq!(value, Some("dark".to_string()));

  db.set_setting("theme", "light").unwrap();
  let updated = db.get_setting("theme").unwrap();
  assert_eq!(updated, Some("light".to_string()));
}

#[test]
fn test_favorites() {
  let db = Database::new_in_memory().unwrap();

  // 외래키 만족을 위한 더미 폰트 사전 삽입
  let fonts = vec![
    (create_dummy_font(0, "/path/f1.ttf", "Font1", FontSource::System, "h1"), 1000),
    (create_dummy_font(0, "/path/f10.ttf", "Font10", FontSource::System, "h10"), 1000),
    (create_dummy_font(0, "/path/f20.ttf", "Font20", FontSource::System, "h20"), 1000),
    (create_dummy_font(0, "/path/f30.ttf", "Font30", FontSource::System, "h30"), 1000),
  ];
  db.save_cached_fonts(&fonts).unwrap();
  let cached = db.get_all_cached_fonts().unwrap();
  let id1 = cached.iter().find(|f| f.file_path == "/path/f1.ttf").unwrap().id;
  let id10 = cached.iter().find(|f| f.file_path == "/path/f10.ttf").unwrap().id;
  let id20 = cached.iter().find(|f| f.file_path == "/path/f20.ttf").unwrap().id;
  let id30 = cached.iter().find(|f| f.file_path == "/path/f30.ttf").unwrap().id;

  let toggled_on = db.toggle_favorite(id1).unwrap();
  assert!(toggled_on);

  let favs = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs, vec![id1]);

  let toggled_off = db.toggle_favorite(id1).unwrap();
  assert!(!toggled_off);

  let favs_empty = db.get_favorite_font_ids().unwrap();
  assert!(favs_empty.is_empty());

  // Bulk 테스트
  let bulk_ids = vec![id10, id20, id30];
  db.set_favorites_bulk(&bulk_ids, true).unwrap();
  let favs_bulk = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs_bulk.len(), 3);

  db.set_favorites_bulk(&[id20], false).unwrap();
  let favs_after_del = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs_after_del.len(), 2);
}

#[test]
fn test_activated_fonts() {
  let db = Database::new_in_memory().unwrap();

  let fonts = vec![
    (create_dummy_font(0, "/path/to/f1.ttf", "Font1", FontSource::System, "h1"), 1000),
    (create_dummy_font(0, "/path/to/f2.ttf", "Font2", FontSource::System, "h2"), 1000),
    (create_dummy_font(0, "/path/to/f3.ttf", "Font3", FontSource::System, "h3"), 1000),
  ];
  db.save_cached_fonts(&fonts).unwrap();
  let cached = db.get_all_cached_fonts().unwrap();
  let id1 = cached.iter().find(|f| f.file_path == "/path/to/f1.ttf").unwrap().id;
  let id2 = cached.iter().find(|f| f.file_path == "/path/to/f2.ttf").unwrap().id;
  let id3 = cached.iter().find(|f| f.file_path == "/path/to/f3.ttf").unwrap().id;

  db.record_activated_font(id1, "/path/to/f1.ttf").unwrap();
  let items = vec![
    (id2, "/path/to/f2.ttf".to_string()),
    (id3, "/path/to/f3.ttf".to_string()),
  ];
  db.record_activated_fonts(&items).unwrap();

  let activated = db.get_activated_fonts().unwrap();
  assert_eq!(activated.len(), 3);

  db.remove_activated_fonts(&[id1]).unwrap();
  let activated_after_remove = db.get_activated_fonts().unwrap();
  assert_eq!(activated_after_remove.len(), 2);

  db.clear_all_activated_fonts().unwrap();
  assert!(db.get_activated_fonts().unwrap().is_empty());
}

#[test]
fn test_sets_crud_and_fonts() {
  let db = Database::new_in_memory().unwrap();

  let fonts = vec![
    (create_dummy_font(0, "/path/a.ttf", "FontA", FontSource::System, "ha"), 1000),
    (create_dummy_font(0, "/path/b.ttf", "FontB", FontSource::System, "hb"), 1000),
    (create_dummy_font(0, "/path/c.ttf", "FontC", FontSource::System, "hc"), 1000),
    (create_dummy_font(0, "/path/d.ttf", "FontD", FontSource::System, "hd"), 1000),
    (create_dummy_font(0, "/path/e.ttf", "FontE", FontSource::System, "he"), 1000),
  ];
  db.save_cached_fonts(&fonts).unwrap();
  let cached = db.get_all_cached_fonts().unwrap();
  let id_a = cached.iter().find(|f| f.file_path == "/path/a.ttf").unwrap().id;
  let id_b = cached.iter().find(|f| f.file_path == "/path/b.ttf").unwrap().id;
  let id_c = cached.iter().find(|f| f.file_path == "/path/c.ttf").unwrap().id;
  let id_d = cached.iter().find(|f| f.file_path == "/path/d.ttf").unwrap().id;
  let id_e = cached.iter().find(|f| f.file_path == "/path/e.ttf").unwrap().id;

  let set = db.create_set("Design Fonts", Some("#123456"), None).unwrap();
  assert_eq!(set.name, "Design Fonts");
  assert_eq!(set.count, 0);
  assert_eq!(set.parent_id, None);

  // 2depth 하위 세트 생성 테스트
  let child_set = db.create_set("Sub Fonts", Some("#abcdef"), Some(set.id)).unwrap();
  assert_eq!(child_set.name, "Sub Fonts");
  assert_eq!(child_set.parent_id, Some(set.id));

  db.add_font_to_set(set.id, id_a).unwrap();
  db.add_font_to_set(set.id, id_b).unwrap();
  db.add_font_to_set(child_set.id, id_c).unwrap();

  let sets = db.get_sets().unwrap();
  assert_eq!(sets.len(), 2);

  let font_ids = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids.len(), 2);

  // 일괄 매핑 테스트 (get_all_set_font_ids)
  let all_map = db.get_all_set_font_ids().unwrap();
  assert_eq!(all_map.get(&set.id).map(|v| v.len()), Some(2));
  assert_eq!(all_map.get(&child_set.id).map(|v| v.len()), Some(1));

  // Bulk 추가 테스트
  let bulk_add = vec![id_d, id_e];
  db.add_fonts_to_set_bulk(set.id, &bulk_add).unwrap();
  let font_ids_after_bulk = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids_after_bulk.len(), 4);

  // Bulk 제거 테스트
  db.remove_fonts_from_set_bulk(set.id, &[id_a, id_d]).unwrap();
  let font_ids_after_del = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids_after_del.len(), 2);

  db.remove_font_from_set(set.id, id_b).unwrap();

  db.update_set(set.id, "Renamed Set", "#654321", None).unwrap();
  let sets_after_update = db.get_sets().unwrap();
  let updated_parent = sets_after_update.iter().find(|s| s.id == set.id).unwrap();
  assert_eq!(updated_parent.name, "Renamed Set");
  assert_eq!(updated_parent.color, "#654321");

  // 부모 세트 삭제 시 자식 세트도 CASCADE 삭제되는지 확인
  db.delete_set(set.id).unwrap();
  assert!(db.get_sets().unwrap().is_empty());
}

#[test]
fn test_folders_and_cascade() {
  let db = Database::new_in_memory().unwrap();

  let folder = db.add_folder("/Users/test/Fonts", "My Fonts", None).unwrap();
  assert_eq!(folder.path, "/Users/test/Fonts");

  let folders = db.get_folders().unwrap();
  assert_eq!(folders.len(), 1);

  db.update_folder_color(folder.id, "#ffffff").unwrap();
  let updated = db.get_folders().unwrap();
  assert_eq!(updated[0].color, "#ffffff");

  db.remove_folder("/Users/test/Fonts").unwrap();
  assert!(db.get_folders().unwrap().is_empty());
}

#[test]
fn test_font_cache_active_filtering_and_orphan_cleanup() {
  let db = Database::new_in_memory().unwrap();

  // 1. 감시 폴더 등록
  db.add_folder("/Users/test/Fonts", "My Fonts", None).unwrap();

  // 2. 폰트 메타데이터 생성
  let f_sys = create_dummy_font(0, "/System/Library/Fonts/sys.ttf", "SysFont", FontSource::System, "hash_sys");
  let f_watched = create_dummy_font(0, "/Users/test/Fonts/ext1.ttf", "ExtWatched", FontSource::External, "hash_ext1");
  let f_set = create_dummy_font(0, "/Users/test/Other/ext2.ttf", "ExtSet", FontSource::External, "hash_ext2");
  let f_orphan = create_dummy_font(0, "/tmp/orphan.ttf", "ExtOrphan", FontSource::External, "hash_orphan");

  let items = vec![
    (f_sys, 1000),
    (f_watched, 1000),
    (f_set, 1000),
    (f_orphan, 1000),
  ];
  db.save_cached_fonts(&items).unwrap();

  // 3. 서재 세트 생성 및 f_set 추가 (DB에서 자동 부여된 id 가져오기)
  let all_initial = db.get_all_cached_fonts().unwrap();
  let set_font_id = all_initial.iter().find(|f| f.file_path == "/Users/test/Other/ext2.ttf").unwrap().id;

  let set = db.create_set("Protected", None, None).unwrap();
  db.add_font_to_set(set.id, set_font_id).unwrap();

  // 4. get_active_cached_fonts 검증: 시스템 폰트와 감시 폴더 내부 폰트 총 2개만 active여야 함
  let active_fonts = db.get_active_cached_fonts().unwrap();
  assert_eq!(active_fonts.len(), 2);
  let active_paths: Vec<String> = active_fonts.into_iter().map(|f| f.file_path).collect();
  assert!(active_paths.contains(&"/System/Library/Fonts/sys.ttf".to_string()));
  assert!(active_paths.contains(&"/Users/test/Fonts/ext1.ttf".to_string()));

  // 5. 고아 정리 실행: 오직 f_orphan (1개)만 정리되어야 함
  let cleaned = db.cleanup_orphan_cached_fonts().unwrap();
  assert_eq!(cleaned, 1);

  // 6. 캐시 확인: f_orphan만 제거되고 f_set(보호됨), f_sys, f_watched는 남아있어야 함
  let all_cached = db.get_all_cached_fonts().unwrap();
  assert_eq!(all_cached.len(), 3);
  let remaining_paths: Vec<String> = all_cached.into_iter().map(|f| f.file_path).collect();
  assert!(remaining_paths.contains(&"/System/Library/Fonts/sys.ttf".to_string()));
  assert!(remaining_paths.contains(&"/Users/test/Fonts/ext1.ttf".to_string()));
  assert!(remaining_paths.contains(&"/Users/test/Other/ext2.ttf".to_string()));
  assert!(!remaining_paths.contains(&"/tmp/orphan.ttf".to_string()));
}

#[test]
fn test_windows_backslash_folder_operations() {
  let db = Database::new_in_memory().unwrap();

  // 1. Windows 백슬래시 경로 폴더 및 폰트 등록
  db.add_folder(r"C:\Fonts", "Win Fonts", None).unwrap();
  let f_win = create_dummy_font(0, r"C:\Fonts\sub\test.ttf", "WinFont", FontSource::External, "hash_win");
  db.save_cached_fonts(&[(f_win, 1000)]).unwrap();

  let cached = db.get_all_cached_fonts().unwrap();
  assert_eq!(cached.len(), 1);
  assert_eq!(cached[0].file_path, r"C:\Fonts\sub\test.ttf");

  // 2. update_folder_path 실행 (C:\Fonts -> D:\NewFonts)
  db.update_folder_path(r"C:\Fonts", r"D:\NewFonts", "Relinked").unwrap();
  let updated_cached = db.get_all_cached_fonts().unwrap();
  assert_eq!(updated_cached.len(), 1);
  assert_eq!(updated_cached[0].file_path, r"D:\NewFonts\sub\test.ttf");

  // 3. remove_folder 실행 시 백슬래시 하위 폰트 정상 삭제 확인
  db.remove_folder(r"D:\NewFonts").unwrap();
  let after_del = db.get_all_cached_fonts().unwrap();
  assert!(after_del.is_empty(), "Windows backslash sub-fonts must be cleaned up on remove_folder");
}
