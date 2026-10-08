use std::sync::{Arc, Mutex};

use crate::db::Database;
use crate::watcher::FontFolderWatcher;

pub mod activation;
pub mod backup;
pub mod favorites;
pub mod folders;
pub mod font;
pub mod fontsource;
pub mod google_fonts;
pub mod install;
pub mod network;
pub mod sets;
pub mod settings;
pub mod validation;

pub struct AppState {
    pub db: Arc<Database>,
    pub watcher: Arc<Mutex<FontFolderWatcher>>,
}

// 기존 lib.rs 및 외부 모듈과의 100% 하위 호환성을 위한 일괄 re-export
pub use activation::*;
pub use backup::*;
pub use favorites::*;
pub use folders::*;
pub use font::*;
pub use fontsource::*;
pub use google_fonts::*;
pub use install::*;
pub use network::*;
pub use sets::*;
pub use settings::*;
pub use validation::*;
