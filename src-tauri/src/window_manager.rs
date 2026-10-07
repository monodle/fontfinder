use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{LogicalSize, PhysicalSize, Size, Window, WindowEvent};

use crate::db::Database;

pub const DEFAULT_WIDTH: f64 = 1280.0;
pub const DEFAULT_HEIGHT: f64 = 840.0;
pub const MIN_WIDTH: f64 = 960.0;
pub const MIN_HEIGHT: f64 = 640.0;

const SETTING_KEY_WINDOW_WIDTH: &str = "window_logical_width";
const SETTING_KEY_WINDOW_HEIGHT: &str = "window_logical_height";

/// 모니터 간 창 이동 시 발생하는 크기 떨림을 방지하고,
/// 사용자가 설정한 논리 창 크기를 안정적으로 유지 및 영속화하는 관리자
pub struct WindowManager {
  db: Arc<Database>,
  intended_size: Mutex<LogicalSize<f64>>,
  is_scale_transitioning: AtomicBool,
  last_transition_time: Mutex<Instant>,
  last_persisted_time: Mutex<Instant>,
}

impl WindowManager {
  pub fn new(db: Arc<Database>) -> Self {
    // DB에서 저장된 크기 불러오기 (없으면 기본 크기)
    let initial_width = db
      .get_setting(SETTING_KEY_WINDOW_WIDTH)
      .ok()
      .flatten()
      .and_then(|v| v.parse::<f64>().ok())
      .map(|w| w.max(MIN_WIDTH))
      .unwrap_or(DEFAULT_WIDTH);

    let initial_height = db
      .get_setting(SETTING_KEY_WINDOW_HEIGHT)
      .ok()
      .flatten()
      .and_then(|v| v.parse::<f64>().ok())
      .map(|h| h.max(MIN_HEIGHT))
      .unwrap_or(DEFAULT_HEIGHT);

    Self {
      db,
      intended_size: Mutex::new(LogicalSize::new(initial_width, initial_height)),
      is_scale_transitioning: AtomicBool::new(false),
      last_transition_time: Mutex::new(Instant::now() - Duration::from_secs(10)),
      last_persisted_time: Mutex::new(Instant::now() - Duration::from_secs(10)),
    }
  }

  /// 앱 시작 시 창의 초기 크기 적용 및 보정
  pub fn apply_initial_size(&self, window: &Window) {
    if let Ok(true) = window.is_maximized() {
      return;
    }
    if let Ok(true) = window.is_fullscreen() {
      return;
    }

    let size = {
      let guard = self.intended_size.lock().unwrap();
      *guard
    };

    let _ = window.set_size(Size::Logical(size));
  }

  /// 창 이벤트 처리: 리사이즈 감지 및 모니터 배율 전환(DPI 변경) 시 논리 크기 보정
  pub fn handle_window_event(&self, window: &Window, event: &WindowEvent) {
    match event {
      WindowEvent::ScaleFactorChanged { scale_factor: _, .. } => {
        // 모니터 간 이동으로 배율이 변경된 경우
        self.is_scale_transitioning.store(true, Ordering::SeqCst);
        if let Ok(mut t) = self.last_transition_time.lock() {
          *t = Instant::now();
        }

        // 최대화 또는 전체화면 상태일 때는 크기를 강제하지 않음
        if let Ok(true) = window.is_maximized() {
          return;
        }
        if let Ok(true) = window.is_fullscreen() {
          return;
        }

        // 의도된 논리 크기로 즉시 고정하여 OS 반올림 오차 및 떨림 차단
        let target_size = {
          let guard = self.intended_size.lock().unwrap();
          *guard
        };

        let _ = window.set_size(Size::Logical(target_size));
      }

      WindowEvent::Resized(physical_size) => {
        // 모니터 전환 직후(500ms 이내) 발생하는 연쇄 리사이즈 이벤트는 사용자 리사이즈로 취급하지 않음
        if self.is_scale_transitioning.load(Ordering::SeqCst) {
          if let Ok(t) = self.last_transition_time.lock() {
            if t.elapsed() < Duration::from_millis(600) {
              return;
            }
          }
          self.is_scale_transitioning.store(false, Ordering::SeqCst);
        }

        if let Ok(true) = window.is_maximized() {
          return;
        }
        if let Ok(true) = window.is_fullscreen() {
          return;
        }

        self.on_user_resized(window, *physical_size);
      }

      WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
        // 창 종료 시 마지막 크기 영속화
        self.persist_current_size();
      }

      _ => {}
    }
  }

  fn on_user_resized(&self, window: &Window, physical_size: PhysicalSize<u32>) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    if scale_factor <= 0.0 {
      return;
    }

    let logical_w = (physical_size.width as f64 / scale_factor).max(MIN_WIDTH);
    let logical_h = (physical_size.height as f64 / scale_factor).max(MIN_HEIGHT);

    let mut changed = false;
    {
      if let Ok(mut guard) = self.intended_size.lock() {
        // 1px 미만의 미세한 떨림/부동소수점 오차는 무시하고, 유의미한 변경만 기록
        if (guard.width - logical_w).abs() > 2.0 || (guard.height - logical_h).abs() > 2.0 {
          guard.width = logical_w;
          guard.height = logical_h;
          changed = true;
        }
      }
    }

    if changed {
      self.persist_current_size_throttled();
    }
  }

  fn persist_current_size_throttled(&self) {
    if let Ok(mut last_time) = self.last_persisted_time.lock() {
      if last_time.elapsed() < Duration::from_millis(600) {
        return;
      }
      *last_time = Instant::now();
    }
    self.persist_current_size();
  }

  fn persist_current_size(&self) {
    let (w, h) = {
      if let Ok(guard) = self.intended_size.lock() {
        (guard.width, guard.height)
      } else {
        (DEFAULT_WIDTH, DEFAULT_HEIGHT)
      }
    };

    let db_clone = Arc::clone(&self.db);
    tauri::async_runtime::spawn(async move {
      let _ = tokio::task::spawn_blocking(move || {
        let _ = db_clone.set_setting(SETTING_KEY_WINDOW_WIDTH, &w.round().to_string());
        let _ = db_clone.set_setting(SETTING_KEY_WINDOW_HEIGHT, &h.round().to_string());
      }).await;
    });
  }
}
