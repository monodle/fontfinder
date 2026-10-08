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
  assert_eq!(user_version, 2);
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

#[test]
fn test_update_folder_path_and_bulk_delete_performance() {
  let db = Database::new_in_memory().unwrap();

  // 1. 초기 폴더 등록
  let old_folder = "/Volumes/External/Fonts";
  let new_folder = "/Volumes/External/NewFonts";
  db.add_folder(old_folder, "Fonts", None, None).unwrap();

  // 2. 1,000개의 대량 폰트 및 활성화 폰트 레코드 생성
  let count = 1000;
  let mut dummy_fonts = Vec::with_capacity(count);
  for i in 1..=count {
    let path = format!("{}/font_{}.ttf", old_folder, i);
    let hash = format!("hash_{}", i);
    let f = create_dummy_font(i as i64, &path, &format!("Family {}", i), FontSource::External, &hash);
    dummy_fonts.push((f, 1000 + i as i64));
  }
  db.save_cached_fonts(&dummy_fonts).unwrap();

  let mut activated_items = Vec::with_capacity(count);
  for i in 1..=count {
    let path = format!("{}/font_{}.ttf", old_folder, i);
    activated_items.push((i as i64, path));
  }
  db.record_activated_fonts(&activated_items).unwrap();

  // 3. update_folder_path 일괄 실행 (prepare_cached 검증)
  let start = std::time::Instant::now();
  db.update_folder_path(old_folder, new_folder, "NewFonts").unwrap();
  let elapsed = start.elapsed();
  assert!(elapsed.as_millis() < 500, "1,000 items update should finish well within 500ms");

  // 4. 경로 변경 무결성 검증
  let updated_fonts = db.get_all_cached_fonts().unwrap();
  assert_eq!(updated_fonts.len(), count);
  for f in &updated_fonts {
    assert!(f.file_path.starts_with(new_folder), "All paths should start with new folder prefix");
  }

  let updated_act = db.get_activated_fonts().unwrap();
  assert_eq!(updated_act.len(), count);
  for r in &updated_act {
    assert!(r.file_path.starts_with(new_folder), "All activated paths should start with new folder prefix");
  }

  // 5. remove_activated_fonts_by_paths 청크(200) 일괄 삭제 검증
  let paths_to_remove: Vec<String> = (1..=500)
    .map(|i| format!("{}/font_{}.ttf", new_folder, i))
    .collect();
  db.remove_activated_fonts_by_paths(&paths_to_remove).unwrap();

  let remaining_act = db.get_activated_fonts().unwrap();
  assert_eq!(remaining_act.len(), count - 500, "500 activated records should be deleted via chunks");
}

#[test]
fn test_v2_indexes_and_explain_plans() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  let conn = db.conn().unwrap();

  // 1. 제거된 인덱스가 더 이상 존재하지 않는지 확인
  let dropped_indexes = ["idx_sets_parent_id", "idx_font_cache_source", "idx_activated_fonts_activated_at"];
  for idx in &dropped_indexes {
    let exists: bool = conn
      .query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?1)",
        rusqlite::params![idx],
        |r| r.get(0),
      )
      .unwrap();
    assert!(!exists, "Index {} should be dropped in V2", idx);
  }

  // 2. 신규 최적화 인덱스가 존재하는지 확인
  let new_indexes = ["idx_sets_sort_order", "idx_activated_fonts_covering"];
  for idx in &new_indexes {
    let exists: bool = conn
      .query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?1)",
        rusqlite::params![idx],
        |r| r.get(0),
      )
      .unwrap();
    assert!(exists, "Index {} should exist in V2", idx);
  }

  // 3. sets 정렬 쿼리 실행 계획(EXPLAIN QUERY PLAN) 검증 (Temp B-Tree 제거 확인)
  let sets_plan: String = conn
    .query_row(
      "EXPLAIN QUERY PLAN SELECT s.id, s.name, s.color, COUNT(sf.font_id) as font_count, s.parent_id, s.sort_order
       FROM sets s
       LEFT JOIN set_fonts sf ON sf.set_id = s.id
       GROUP BY s.sort_order, s.id
       ORDER BY s.sort_order ASC, s.id ASC",
      [],
      |r| r.get(3),
    )
    .unwrap();
  assert!(
    sets_plan.contains("idx_sets_sort_order"),
    "sets query should utilize idx_sets_sort_order: got {}",
    sets_plan
  );
  assert!(
    !sets_plan.contains("USE TEMP B-TREE"),
    "sets query should eliminate temp b-tree filesort: got {}",
    sets_plan
  );

  // 4. activated_fonts 커버링 인덱스(EXPLAIN QUERY PLAN) 검증
  let act_plan: String = conn
    .query_row(
      "EXPLAIN QUERY PLAN SELECT font_id, file_path FROM activated_fonts ORDER BY activated_at ASC",
      [],
      |r| r.get(3),
    )
    .unwrap();
  assert!(
    act_plan.contains("idx_activated_fonts_covering"),
    "activated_fonts query should utilize idx_activated_fonts_covering: got {}",
    act_plan
  );
  assert!(
    act_plan.contains("COVERING INDEX"),
    "activated_fonts query should utilize COVERING INDEX: got {}",
    act_plan
  );

  // 5. activated_fonts 대소문자 무시 경로 삭제 인덱스 탐색(SEARCH) 검증 (SCAN 풀스캔 방지)
  let act_del_plan: String = conn
    .query_row(
      "EXPLAIN QUERY PLAN DELETE FROM activated_fonts WHERE file_path COLLATE NOCASE IN ('/test/font.ttf')",
      [],
      |r| r.get(3),
    )
    .unwrap();
  assert!(
    act_del_plan.contains("idx_activated_fonts_path"),
    "activated_fonts delete query should utilize idx_activated_fonts_path: got {}",
    act_del_plan
  );
  assert!(
    !act_del_plan.contains("SCAN activated_fonts"),
    "activated_fonts delete query should not perform table scan: got {}",
    act_del_plan
  );
}

#[test]
fn test_apply_font_cache_sync_atomic_operations() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");

  // 1. 초기 폰트 등록
  let font1 = create_dummy_font(0, "/fonts/A.ttf", "Font A", FontSource::User, "hash_a1");
  let font2 = create_dummy_font(0, "/fonts/B.ttf", "Font B", FontSource::User, "hash_b1");

  db.apply_font_cache_sync(
    &[(font1, 1_700_000_000_100), (font2, 1_700_000_000_200)],
    &[],
    &[],
  ).expect("Initial sync should succeed");

  let full_entries = db.get_font_cache_full_entries().unwrap();
  assert_eq!(full_entries.len(), 2);
  let id_a = full_entries.get(&("/fonts/A.ttf".to_string(), 0)).unwrap().id;
  let id_b = full_entries.get(&("/fonts/B.ttf".to_string(), 0)).unwrap().id;

  // 2. 단일 트랜잭션으로 복합 작업 실행:
  // - font3 신규 추가
  // - font1 딥해시 갱신
  // - font2 삭제
  let font3 = create_dummy_font(0, "/fonts/C.ttf", "Font C", FontSource::User, "hash_c1");

  db.apply_font_cache_sync(
    &[(font3, 1_700_000_000_300)],
    &[(id_a, "deep_hash_a1".to_string())],
    &[id_b],
  ).expect("Atomic composite sync should succeed");

  // 3. 상태 검증
  let updated_entries = db.get_font_cache_full_entries().unwrap();
  assert_eq!(updated_entries.len(), 2); // font2 삭제, font3 추가되어 총 2개

  // font1: 딥해시 갱신 확인
  let entry_a = updated_entries.get(&("/fonts/A.ttf".to_string(), 0)).unwrap();
  assert_eq!(entry_a.deep_hash.as_deref(), Some("deep_hash_a1"));

  // font2: 삭제 확인
  assert!(!updated_entries.contains_key(&("/fonts/B.ttf".to_string(), 0)));

  // font3: 신규 등록 확인
  assert!(updated_entries.contains_key(&("/fonts/C.ttf".to_string(), 0)));
}

#[test]
fn test_apply_font_cache_sync_empty_calls() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  // 빈 슬라이스 전달 시 오류 없이 즉시 Ok(()) 반환
  let res = db.apply_font_cache_sync(&[], &[], &[]);
  assert!(res.is_ok());
}

#[test]
fn test_mtime_millisecond_precision() {
  let unique_name = format!("test_font_{}.ttf", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
  let file_path = std::env::temp_dir().join(unique_name);
  std::fs::write(&file_path, b"dummy font content").unwrap();

  let mtime = crate::font::scanner::FontScanner::get_file_mtime(&file_path);
  let _ = std::fs::remove_file(&file_path);
  // 밀리초 정밀도이므로 10자리(초 단위)보다 훨씬 큰 13자리 수준 정수여야 함
  assert!(mtime > 100_000_000_000, "mtime should be in milliseconds: got {}", mtime);
}

#[test]
fn test_apply_font_cache_sync_transaction_rollback() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");

  // 1. 초기 폰트 등록
  let font_orig = create_dummy_font(0, "/fonts/Original.ttf", "Original", FontSource::User, "hash_orig");
  db.apply_font_cache_sync(
    &[(font_orig, 1_700_000_000_000)],
    &[],
    &[],
  ).expect("Initial sync should succeed");

  let orig_entries = db.get_font_cache_full_entries().unwrap();
  assert_eq!(orig_entries.len(), 1);
  let orig_id = orig_entries.get(&("/fonts/Original.ttf".to_string(), 0)).unwrap().id;

  // 2. 삭제 시 강제 에러를 발생시키는 트리거 생성 (원자성 롤백 검증용)
  {
    let conn = db.conn().unwrap();
    conn.execute(
      "CREATE TRIGGER test_force_abort BEFORE DELETE ON font_cache BEGIN SELECT RAISE(ABORT, 'forced test rollback'); END;",
      [],
    ).unwrap();
  }

  // 3. 신규 폰트 추가 + 기존 폰트 삭제를 단일 트랜잭션으로 요청
  // DELETE 단계에서 트리거로 에러가 발생하므로 전체 트랜잭션이 롤백되어야 함
  let font_new = create_dummy_font(0, "/fonts/NewFail.ttf", "NewFail", FontSource::User, "hash_new");
  let sync_result = db.apply_font_cache_sync(
    &[(font_new, 1_700_000_000_500)],
    &[],
    &[orig_id],
  );

  assert!(sync_result.is_err(), "Sync should fail and return error when delete is aborted");

  // 4. 롤백 검증: 신규 폰트는 들어가지 않았고, 기존 폰트는 삭제되지 않고 온전히 남아있어야 함
  let entries_after_rollback = db.get_font_cache_full_entries().unwrap();
  assert_eq!(entries_after_rollback.len(), 1, "Database should rollback completely to previous state");
  assert!(entries_after_rollback.contains_key(&("/fonts/Original.ttf".to_string(), 0)));
  assert!(!entries_after_rollback.contains_key(&("/fonts/NewFail.ttf".to_string(), 0)));
}

#[test]
fn test_stale_deep_hash_invalidation_on_fast_hash_change() {
  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");

  // 1. 초기 폰트 등록 후 충돌로 인해 deep_hash가 부여된 상태
  let mut font = create_dummy_font(0, "/fonts/Changing.ttf", "Changing Font", FontSource::User, "fast_v1");
  font.deep_hash = Some("deep_v1".to_string());
  font.file_hash = "deep_v1".to_string();

  db.apply_font_cache_sync(&[(font.clone(), 1_700_000_000_000)], &[], &[]).unwrap();

  let entry = db.get_font_cache_full_entries().unwrap().get(&("/fonts/Changing.ttf".to_string(), 0)).unwrap().clone();
  assert_eq!(entry.fast_hash, "fast_v1");
  assert_eq!(entry.deep_hash.as_deref(), Some("deep_v1"));

  // 2. 파일 내용이 바뀌어 fast_hash가 달라졌고, 단독 폰트가 되어 deep_hash가 None인 새 메타데이터 저장
  let mut changed_font = create_dummy_font(0, "/fonts/Changing.ttf", "Changing Font", FontSource::User, "fast_v2");
  changed_font.deep_hash = None;
  changed_font.file_hash = "fast_v2".to_string();

  db.apply_font_cache_sync(&[(changed_font, 1_700_000_001_000)], &[], &[]).unwrap();

  // 3. fast_hash가 바뀌었으므로 이전 낡은 deep_hash가 반드시 NULL로 무효화되어야 함
  let updated = db.get_font_cache_full_entries().unwrap().get(&("/fonts/Changing.ttf".to_string(), 0)).unwrap().clone();
  assert_eq!(updated.fast_hash, "fast_v2");
  assert_eq!(updated.deep_hash, None, "Old deep_hash must be invalidated to None when fast_hash changes");

  // 4. fast_hash가 같은 상태에서 단순 mtime/메타데이터만 갱신될 때는 기존 deep_hash 보존 확인
  // 먼저 deep_hash를 다시 부여
  db.apply_font_cache_sync(&[], &[(updated.id, "deep_v2".to_string())], &[]).unwrap();
  let with_deep = db.get_font_cache_full_entries().unwrap().get(&("/fonts/Changing.ttf".to_string(), 0)).unwrap().clone();
  assert_eq!(with_deep.deep_hash.as_deref(), Some("deep_v2"));

  // 동일 fast_v2 상태로 deep_hash가 None인 엔트리를 UPSERT해도 기존 deep_v2가 보존됨
  let mut same_content_font = create_dummy_font(0, "/fonts/Changing.ttf", "Changing Font Updated Family", FontSource::User, "fast_v2");
  same_content_font.deep_hash = None;
  db.apply_font_cache_sync(&[(same_content_font, 1_700_000_002_000)], &[], &[]).unwrap();

  let preserved = db.get_font_cache_full_entries().unwrap().get(&("/fonts/Changing.ttf".to_string(), 0)).unwrap().clone();
  assert_eq!(preserved.deep_hash.as_deref(), Some("deep_v2"), "deep_hash should be preserved when fast_hash is unchanged");
}

#[test]
fn test_sync_directories_removes_unparseable_or_invalid_cached_font() {
  use std::io::Write;
  use crate::font::FontScanner;

  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  let temp_base = std::env::temp_dir();
  let test_dir = temp_base.join(format!("ff_sync_test_{}", std::process::id()));
  std::fs::create_dir_all(&test_dir).unwrap();

  let corrupted_file = test_dir.join("corrupted.ttf");
  let empty_file = test_dir.join("empty.ttf");

  // 1. 디스크에 파일 작성: 하나는 0바이트, 하나는 깨진 폰트 바이너리
  std::fs::File::create(&empty_file).unwrap();
  {
    let mut f = std::fs::File::create(&corrupted_file).unwrap();
    f.write_all(b"INVALID_FONT_HEADER_DATA_1234567890").unwrap();
  }

  let corrupted_posix = crate::protocol::to_posix_normalized_path(&corrupted_file)
    .to_string_lossy()
    .to_string();
  let empty_posix = crate::protocol::to_posix_normalized_path(&empty_file)
    .to_string_lossy()
    .to_string();

  // 2. 과거 정상 상태였던 것처럼 DB에 두 파일의 캐시를 사전 등록
  let corrupted_meta = create_dummy_font(0, &corrupted_posix, "Corrupted Font", FontSource::External, "hash_c1");
  let empty_meta = create_dummy_font(0, &empty_posix, "Empty Font", FontSource::External, "hash_e1");

  db.apply_font_cache_sync(
    &[
      (corrupted_meta, 1_000_000), // mtime 차이 유발하여 to_parse 대상이 되도록
      (empty_meta, 1_000_000),
    ],
    &[],
    &[],
  ).unwrap();

  let initial_cache = db.get_font_cache_full_entries().unwrap();
  assert_eq!(initial_cache.len(), 2, "Both fonts should be in initial cache");

  // 3. sync_directories_with_options 동기화 실행 (force_rescan = true)
  let sync_res = FontScanner::sync_directories_with_options(
    &[test_dir.clone()],
    &db,
    false,
    true,
    None,
  );
  assert!(sync_res.is_ok(), "Sync should succeed: {:?}", sync_res.err());

  // 4. 검증: 0바이트 파일(empty.ttf)과 파싱 실패 파일(corrupted.ttf) 모두 DB 캐시에서 깔끔히 제거되어야 함!
  let remaining_cache = db.get_font_cache_full_entries().unwrap();
  assert!(
    !remaining_cache.contains_key(&(corrupted_posix, 0)),
    "Corrupted font must be removed from cache after parse error"
  );
  assert!(
    !remaining_cache.contains_key(&(empty_posix, 0)),
    "Empty 0-byte font must be removed from cache"
  );
  assert_eq!(remaining_cache.len(), 0, "No invalid font should remain in cache");

  // 정리
  let _ = std::fs::remove_dir_all(&test_dir);
}

#[test]
fn test_sync_directories_preserves_valid_font_cache_on_scan_omission() {
  use std::io::Write;
  use crate::font::FontScanner;

  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  let temp_base = std::env::temp_dir();
  let test_dir = temp_base.join(format!("ff_preserve_test_{}", std::process::id()));
  std::fs::create_dir_all(&test_dir).unwrap();

  // 점(.)으로 시작하는 숨김 폰트 파일: WalkDir에서는 건너뛰어지지만 디스크에는 실존하며 크기/확장자가 정상
  let hidden_font = test_dir.join(".hidden_valid.ttf");
  {
    let mut f = std::fs::File::create(&hidden_font).unwrap();
    f.write_all(&[0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).unwrap();
  }

  let hidden_posix = crate::protocol::to_posix_normalized_path(&hidden_font)
    .to_string_lossy()
    .to_string();

  // DB에 기존 캐시로 등록
  let valid_meta = create_dummy_font(0, &hidden_posix, "Hidden Valid Font", FontSource::External, "hash_h1");
  db.apply_font_cache_sync(
    &[(valid_meta, 1_000_000)],
    &[],
    &[],
  ).unwrap();

  assert_eq!(db.get_font_cache_full_entries().unwrap().len(), 1);

  // sync_directories_with_options 실행:
  // WalkDir는 '.'으로 시작하는 파일을 건너뛰므로 current_paths에는 들어가지 않음.
  // 그러나 파일이 실존하고 정상 크기/확장자이므로 방어적 정책에 의해 캐시가 삭제되지 않고 보존되어야 함!
  let sync_res = FontScanner::sync_directories_with_options(
    &[test_dir.clone()],
    &db,
    false,
    false,
    None,
  );
  assert!(sync_res.is_ok());

  let cache_after_sync = db.get_font_cache_full_entries().unwrap();
  assert!(
    cache_after_sync.contains_key(&(hidden_posix, 0)),
    "Valid font file must be preserved in cache even if omitted during directory walk"
  );

  let _ = std::fs::remove_dir_all(&test_dir);
}

#[test]
#[cfg(unix)]
fn test_sync_directories_preserves_cache_on_temporary_io_error() {
  use std::io::Write;
  use std::os::unix::fs::PermissionsExt;
  use crate::font::FontScanner;

  let db = Database::new_in_memory().expect("Failed to initialize in-memory DB");
  let temp_base = std::env::temp_dir();
  let test_dir = temp_base.join(format!("ff_io_err_test_{}", std::process::id()));
  std::fs::create_dir_all(&test_dir).unwrap();

  let locked_font = test_dir.join("locked.ttf");
  {
    let mut f = std::fs::File::create(&locked_font).unwrap();
    f.write_all(b"SOME_RAW_FONT_BYTES_FOR_LOCK_TEST").unwrap();
  }

  let locked_posix = crate::protocol::to_posix_normalized_path(&locked_font)
    .to_string_lossy()
    .to_string();

  // 기존 캐시 등록
  let locked_meta = create_dummy_font(0, &locked_posix, "Locked Font", FontSource::External, "hash_lock1");
  db.apply_font_cache_sync(
    &[(locked_meta, 1_000_000)],
    &[],
    &[],
  ).unwrap();

  assert_eq!(db.get_font_cache_full_entries().unwrap().len(), 1);

  // 파일 권한을 0o000(읽기 금지)으로 변경하여 File::open 시 AppError::Io(PermissionDenied) 유발
  let _ = std::fs::set_permissions(&locked_font, std::fs::Permissions::from_mode(0o000));

  // 강제 재스캔 실행 (to_parse 대상 진입)
  let sync_res = FontScanner::sync_directories_with_options(
    &[test_dir.clone()],
    &db,
    false,
    true,
    None,
  );
  assert!(sync_res.is_ok());

  // AppError::Io 오류이므로 파싱 실패와 달리 캐시가 삭제되지 않고 안전하게 보존되어야 함!
  let cache_after_sync = db.get_font_cache_full_entries().unwrap();
  assert!(
    cache_after_sync.contains_key(&(locked_posix, 0)),
    "Temporary I/O error (PermissionDenied) must preserve existing font cache"
  );

  // 권한 복원 및 정리
  let _ = std::fs::set_permissions(&locked_font, std::fs::Permissions::from_mode(0o644));
  let _ = std::fs::remove_dir_all(&test_dir);
}

#[test]
fn test_is_folder_exists() {
  let db = Database::new_in_memory().unwrap();
  assert!(!db.is_folder_exists("/Users/test/Fonts").unwrap());

  db.add_folder("/Users/test/Fonts", "Fonts", None, None).unwrap();
  assert!(db.is_folder_exists("/Users/test/Fonts").unwrap());
  // 대소문자 무시(COLLATE NOCASE) 검증
  assert!(db.is_folder_exists("/USERS/TEST/FONTS").unwrap());
  assert!(!db.is_folder_exists("/Users/test/Other").unwrap());
}

#[test]
fn test_oversized_metadata_json_guard() {
  let db = Database::new_in_memory().unwrap();

  // 정상 폰트 삽입
  let normal_font = create_dummy_font(1, "/path/normal.ttf", "Normal", FontSource::External, "hash1");
  db.save_cached_fonts(&[(normal_font, 1000)]).unwrap();

  // 비정상적으로 거대한 JSON (600KB) 직접 삽입 (OOM 공격 시나리오 시뮬레이션)
  {
    let conn = db.conn().unwrap();
    let huge_json = "x".repeat(600 * 1024);
    conn.execute(
      "INSERT INTO font_cache (file_path, font_index, file_size, mtime, family_name, source, fast_hash, metadata_json)
       VALUES ('/path/huge.ttf', 0, 1000, 1000, 'Huge', 'external', 'hash_huge', ?1)",
      rusqlite::params![huge_json],
    ).unwrap();
  }

  // get_all_cached_fonts는 512KB 초과 항목을 건너뛰고 정상 폰트만 안전하게 반환해야 함
  let fonts = db.get_all_cached_fonts().unwrap();
  assert_eq!(fonts.len(), 1);
  assert_eq!(fonts[0].file_path, "/path/normal.ttf");
}




