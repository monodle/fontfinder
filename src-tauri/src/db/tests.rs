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

  let user_version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
  assert_eq!(user_version, 1);
}

#[test]
fn test_sets_schema_and_duplicate_names() {
  let mut conn = rusqlite::Connection::open_in_memory().unwrap();
  initialize_schema(&mut conn).expect("Schema initialization should succeed");

  // parent_id 및 sort_order 컬럼 확인
  let mut stmt = conn.prepare("PRAGMA table_info(sets)").unwrap();
  let col_names: Vec<String> = stmt
    .query_map([], |row| row.get(1))
    .unwrap()
    .map(|r| r.unwrap())
    .collect();
  assert!(col_names.contains(&"parent_id".to_string()));
  assert!(col_names.contains(&"sort_order".to_string()));

  // 1depth 세트 생성
  conn.execute("INSERT INTO sets (name, color, sort_order) VALUES ('My Set', '#123456', 'a0')", []).unwrap();

  // 2depth 세트 생성 (동일한 이름 'My Set' 허용 확인)
  conn
    .execute("INSERT INTO sets (name, color, parent_id, sort_order) VALUES ('My Set', '#abcdef', 1, 'a0')", [])
    .expect("Duplicate set name should be allowed in tree hierarchy");

  let count: i64 = conn
    .query_row("SELECT count(*) FROM sets WHERE name = 'My Set'", [], |r| r.get(0))
    .unwrap();
  assert_eq!(count, 2);
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

  let set = db.create_set("Design Fonts", Some("#123456"), None, None).unwrap();
  assert_eq!(set.name, "Design Fonts");
  assert_eq!(set.count, 0);
  assert_eq!(set.parent_id, None);

  // 2depth 하위 세트 생성 테스트
  let child_set = db.create_set("Sub Fonts", Some("#abcdef"), Some(set.id), None).unwrap();
  assert_eq!(child_set.name, "Sub Fonts");
  assert_eq!(child_set.parent_id, Some(set.id));

  db.add_font_to_set(set.id, id_a).unwrap();
  db.add_font_to_set(set.id, id_b).unwrap();
  db.add_font_to_set(child_set.id, id_c).unwrap();

  // 동일한 이름의 세트 중복 생성 허용 테스트
  let dup_set = db.create_set("Design Fonts", Some("#778899"), None, None).unwrap();
  assert_eq!(dup_set.name, "Design Fonts");
  assert_ne!(dup_set.id, set.id);

  let sets = db.get_sets().unwrap();
  assert_eq!(sets.len(), 3);
  let same_name_sets: Vec<_> = sets.iter().filter(|s| s.name == "Design Fonts").collect();
  assert_eq!(same_name_sets.len(), 2);

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

  // 중복 세트 삭제
  db.delete_set(dup_set.id).unwrap();

  // 부모 세트 삭제 시 자식 세트도 CASCADE 삭제되는지 확인
  db.delete_set(set.id).unwrap();
  assert!(db.get_sets().unwrap().is_empty());
}

#[test]
fn test_folders_and_cascade() {
  let db = Database::new_in_memory().unwrap();

  let folder = db.add_folder("/Users/test/Fonts", "My Fonts", None, None).unwrap();
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
  db.add_folder("/Users/test/Fonts", "My Fonts", None, None).unwrap();

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

  let set = db.create_set("Protected", None, None, None).unwrap();
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
  db.add_folder(r"C:\Fonts", "Win Fonts", None, None).unwrap();
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

#[test]
fn test_fractional_indexing_reorder_sets_and_folders() {
  let db = Database::new_in_memory().unwrap();

  // 1. Sets 순서 생성 및 원자적 재정렬 검증
  let set_a = db.create_set("Set A", None, None, Some("a0")).unwrap();
  let set_b = db.create_set("Set B", None, None, Some("a1")).unwrap();
  let set_c = db.create_set("Set C", None, None, Some("a2")).unwrap();

  let sets = db.get_sets().unwrap();
  assert_eq!(sets[0].id, set_a.id);
  assert_eq!(sets[1].id, set_b.id);
  assert_eq!(sets[2].id, set_c.id);

  // Set C를 Set A 앞으로 이동 ("Zz" < "a0")
  db.update_set_position(set_c.id, None, "Zz").unwrap();
  let reordered = db.get_sets().unwrap();
  assert_eq!(reordered[0].id, set_c.id);
  assert_eq!(reordered[1].id, set_a.id);
  assert_eq!(reordered[2].id, set_b.id);

  // Set B를 2depth로 이동하고 새 부모를 Set A로 설정
  db.update_set_position(set_b.id, Some(set_a.id), "a0").unwrap();
  let reordered2 = db.get_sets().unwrap();
  let moved_b = reordered2.iter().find(|s| s.id == set_b.id).unwrap();
  assert_eq!(moved_b.parent_id, Some(set_a.id));
  assert_eq!(moved_b.sort_order, "a0");

  // 2. Folders 순서 생성 및 재정렬 검증
  let f1 = db.add_folder("/path/f1", "Folder 1", None, Some("a0")).unwrap();
  let f2 = db.add_folder("/path/f2", "Folder 2", None, Some("a1")).unwrap();

  let folders = db.get_folders().unwrap();
  assert_eq!(folders[0].id, f1.id);
  assert_eq!(folders[1].id, f2.id);

  // Folder 2를 Folder 1 앞으로 이동
  db.update_folder_position(Some(f2.id), None, "Zz").unwrap();
  let reordered_f = db.get_folders().unwrap();
  assert_eq!(reordered_f[0].id, f2.id);
  assert_eq!(reordered_f[1].id, f1.id);
}

#[test]
fn test_sets_cycle_prevention() {
  let db = Database::new_in_memory().unwrap();
  let set1 = db.create_set("Set 1", None, None, None).unwrap();
  let set2 = db.create_set("Set 2", None, Some(set1.id), None).unwrap();
  let set3 = db.create_set("Set 3", None, Some(set2.id), None).unwrap();

  // 1. 자기 자신을 부모로 지정 시도 차단
  assert!(db.update_set_parent(set1.id, Some(set1.id)).is_err());
  assert!(db.update_set(set1.id, "Set 1", "#ffffff", Some(set1.id)).is_err());

  // 2. 직계 자식을 부모로 지정 시도 차단 (1 -> 2 -> 1 순환)
  assert!(db.update_set_parent(set1.id, Some(set2.id)).is_err());

  // 3. 깊은 자손(3)을 부모로 지정 시도 차단 (1 -> 2 -> 3 -> 1 순환)
  assert!(db.update_set_parent(set1.id, Some(set3.id)).is_err());
  assert!(db.update_set_position(set1.id, Some(set3.id), "a0").is_err());

  // 4. 독립적인 정상 세트 간 부모 지정은 허용
  let set4 = db.create_set("Set 4", None, None, None).unwrap();
  assert!(db.update_set_parent(set4.id, Some(set3.id)).is_ok());
}

#[test]
fn test_case_insensitive_path_deletions() {
  let db = Database::new_in_memory().unwrap();
  let font = create_dummy_font(1, "C:/Windows/Fonts/Arial.ttf", "Arial", FontSource::System, "h1");
  db.save_cached_fonts(&[(font, 100)]).unwrap();

  // 대소문자가 다른 경로로 캐시 삭제 시도 ("c:/windows/fonts/arial.ttf")
  db.delete_cached_fonts_by_paths(&["c:/windows/fonts/arial.ttf".to_string()]).unwrap();
  let remaining = db.get_all_cached_fonts().unwrap();
  assert_eq!(remaining.len(), 0, "Font should be deleted despite case differences");

  // activated_fonts 테이블의 대소문자 비구분 삭제 검증 (외래키 제약 만족)
  let font2 = create_dummy_font(2, "D:/Fonts/Custom.otf", "Custom", FontSource::External, "h2");
  db.save_cached_fonts(&[(font2, 200)]).unwrap();
  let cached = db.get_all_cached_fonts().unwrap();
  let custom_id = cached.iter().find(|f| f.file_path == "D:/Fonts/Custom.otf").map(|f| f.id).unwrap();

  db.record_activated_font(custom_id, "D:/Fonts/Custom.otf").unwrap();
  db.remove_activated_fonts_by_paths(&["d:/fonts/custom.otf".to_string()]).unwrap();
  let act = db.get_activated_fonts().unwrap();
  assert_eq!(act.len(), 0, "Activated font should be removed despite case differences");
}

#[test]
fn test_like_pattern_escaping() {
  let db = Database::new_in_memory().unwrap();

  // 폴더 등록
  db.add_folder("/Fonts/Type_A", "Type_A", None, None).unwrap();
  db.add_folder("/Fonts/Type-A", "Type-A", None, None).unwrap();

  // 각각의 폴더에 속한 폰트 저장
  let font_target = create_dummy_font(1, "/Fonts/Type_A/target.ttf", "Target", FontSource::External, "h1");
  let font_sibling = create_dummy_font(2, "/Fonts/Type-A/sibling.ttf", "Sibling", FontSource::External, "h2");
  db.save_cached_fonts(&[(font_target, 100), (font_sibling, 100)]).unwrap();

  // /Fonts/Type_A 폴더 삭제
  db.remove_folder("/Fonts/Type_A").unwrap();

  // /Fonts/Type-A/sibling.ttf는 그대로 남아있어야 함 ('_'가 임의의 1문자로 취급되지 않아야 함)
  let remaining = db.get_all_cached_fonts().unwrap();
  assert_eq!(remaining.len(), 1, "Only target font should be deleted; sibling must remain intact");
  assert_eq!(remaining[0].file_path, "/Fonts/Type-A/sibling.ttf");
}
