use super::*;
use crate::font::{FontFormat, FontMetadata, FontSource};

fn create_dummy_font(id: &str, file_path: &str, family: &str, source: FontSource, hash: &str) -> FontMetadata {
  FontMetadata {
    id: id.to_string(),
    file_path: file_path.to_string(),
    file_name: "test.ttf".to_string(),
    file_size: 1024,
    file_hash: hash.to_string(),
    font_index: 0,
    family_name: family.to_string(),
    subfamily_name: "Regular".to_string(),
    full_name: format!("{} Regular", family),
    postscript_name: family.to_string(),
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

  let toggled_on = db.toggle_favorite("font_1").unwrap();
  assert!(toggled_on);

  let favs = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs, vec!["font_1".to_string()]);

  let toggled_off = db.toggle_favorite("font_1").unwrap();
  assert!(!toggled_off);

  let favs_empty = db.get_favorite_font_ids().unwrap();
  assert!(favs_empty.is_empty());

  // Bulk 테스트
  let bulk_ids = vec!["font_a".to_string(), "font_b".to_string(), "font_c".to_string()];
  db.set_favorites_bulk(&bulk_ids, true).unwrap();
  let favs_bulk = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs_bulk.len(), 3);

  db.set_favorites_bulk(&["font_b".to_string()], false).unwrap();
  let favs_after_del = db.get_favorite_font_ids().unwrap();
  assert_eq!(favs_after_del.len(), 2);
}

#[test]
fn test_activated_fonts() {
  let db = Database::new_in_memory().unwrap();

  db.record_activated_font("f1", "/path/to/f1.ttf").unwrap();
  let items = vec![
    ("f2".to_string(), "/path/to/f2.ttf".to_string()),
    ("f3".to_string(), "/path/to/f3.ttf".to_string()),
  ];
  db.record_activated_fonts(&items).unwrap();

  let activated = db.get_activated_fonts().unwrap();
  assert_eq!(activated.len(), 3);

  db.remove_activated_fonts(&["f1".to_string()]).unwrap();
  let activated_after_remove = db.get_activated_fonts().unwrap();
  assert_eq!(activated_after_remove.len(), 2);

  db.clear_all_activated_fonts().unwrap();
  assert!(db.get_activated_fonts().unwrap().is_empty());
}

#[test]
fn test_sets_crud_and_fonts() {
  let db = Database::new_in_memory().unwrap();

  let set = db.create_set("Design Fonts", Some("#123456")).unwrap();
  assert_eq!(set.name, "Design Fonts");
  assert_eq!(set.count, 0);

  db.add_font_to_set(set.id, "font_a").unwrap();
  db.add_font_to_set(set.id, "font_b").unwrap();

  let sets = db.get_sets().unwrap();
  assert_eq!(sets.len(), 1);
  assert_eq!(sets[0].count, 2);

  let font_ids = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids.len(), 2);

  // 일괄 매핑 테스트 (get_all_set_font_ids)
  let all_map = db.get_all_set_font_ids().unwrap();
  assert_eq!(all_map.get(&set.id).map(|v| v.len()), Some(2));

  // Bulk 추가 테스트
  let bulk_add = vec!["font_c".to_string(), "font_d".to_string()];
  db.add_fonts_to_set_bulk(set.id, &bulk_add).unwrap();
  let font_ids_after_bulk = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids_after_bulk.len(), 4);

  // Bulk 제거 테스트
  db.remove_fonts_from_set_bulk(set.id, &["font_a".to_string(), "font_c".to_string()]).unwrap();
  let font_ids_after_del = db.get_set_font_ids(set.id).unwrap();
  assert_eq!(font_ids_after_del.len(), 2);

  db.remove_font_from_set(set.id, "font_b").unwrap();
  let sets_after_remove = db.get_sets().unwrap();
  assert_eq!(sets_after_remove[0].count, 1);

  db.update_set(set.id, "Renamed Set", "#654321").unwrap();
  let sets_after_update = db.get_sets().unwrap();
  assert_eq!(sets_after_update[0].name, "Renamed Set");
  assert_eq!(sets_after_update[0].color, "#654321");

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
  // - f_sys: 시스템 폰트 (항상 active)
  let f_sys = create_dummy_font("sys_1", "/System/Library/Fonts/sys.ttf", "SysFont", FontSource::System, "hash_sys");
  // - f_watched: 감시 폴더 내부 external 폰트 (active)
  let f_watched = create_dummy_font("ext_1", "/Users/test/Fonts/ext1.ttf", "ExtWatched", FontSource::External, "hash_ext1");
  // - f_set: 감시 폴더 밖이지만 서재 세트에 속한 external 폰트 (not active, but protected from orphan cleanup)
  let f_set = create_dummy_font("ext_2", "/Users/test/Other/ext2.ttf", "ExtSet", FontSource::External, "hash_ext2");
  // - f_orphan: 감시 폴더 밖이고 세트에도 없는 고아 external 폰트
  let f_orphan = create_dummy_font("ext_orphan", "/tmp/orphan.ttf", "ExtOrphan", FontSource::External, "hash_orphan");

  let items = vec![
    (f_sys, 1000),
    (f_watched, 1000),
    (f_set, 1000),
    (f_orphan, 1000),
  ];
  db.save_cached_fonts(&items).unwrap();

  // 3. 서재 세트 생성 및 f_set 추가
  let set = db.create_set("Protected", None).unwrap();
  db.add_font_to_set(set.id, "ext_2").unwrap();

  // 4. get_active_cached_fonts 검증: 시스템 폰트와 감시 폴더 내부 폰트 총 2개만 active여야 함
  let active_fonts = db.get_active_cached_fonts().unwrap();
  assert_eq!(active_fonts.len(), 2);
  let active_ids: Vec<String> = active_fonts.into_iter().map(|f| f.id).collect();
  assert!(active_ids.contains(&"sys_1".to_string()));
  assert!(active_ids.contains(&"ext_1".to_string()));

  // 5. 고아 정리 실행: 오직 f_orphan (1개)만 정리되어야 함
  let cleaned = db.cleanup_orphan_cached_fonts().unwrap();
  assert_eq!(cleaned, 1);

  // 6. 캐시 확인: f_orphan만 제거되고 f_set(보호됨), f_sys, f_watched는 남아있어야 함
  let all_cached = db.get_all_cached_fonts().unwrap();
  assert_eq!(all_cached.len(), 3);
  let remaining_ids: Vec<String> = all_cached.into_iter().map(|f| f.id).collect();
  assert!(remaining_ids.contains(&"sys_1".to_string()));
  assert!(remaining_ids.contains(&"ext_1".to_string()));
  assert!(remaining_ids.contains(&"ext_2".to_string()));
  assert!(!remaining_ids.contains(&"ext_orphan".to_string()));
}
