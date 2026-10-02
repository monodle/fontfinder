use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use rusqlite::Connection;

use crate::error::{AppError, AppResult};

pub mod models;
pub mod schema;
mod sets;
mod favorites;
mod folders;
mod activated_fonts;
mod settings;
mod font_cache;

#[cfg(test)]
mod tests;

pub use models::*;
pub use font_cache::FontCacheEntry;

pub struct Database {
  conn: Mutex<Connection>,
}

impl Database {
  pub fn new(db_path: PathBuf) -> AppResult<Self> {
    if let Some(parent) = db_path.parent() {
      fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path)?;
    schema::initialize_schema(&conn)?;

    Ok(Self {
      conn: Mutex::new(conn),
    })
  }

  #[cfg(test)]
  pub fn new_in_memory() -> AppResult<Self> {
    let conn = Connection::open_in_memory()?;
    schema::initialize_schema(&conn)?;

    Ok(Self {
      conn: Mutex::new(conn),
    })
  }

  #[inline]
  pub(crate) fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
    self.conn.lock().map_err(|e| AppError::Platform(e.to_string()))
  }

  pub fn reset_database(&self) -> AppResult<()> {
    let mut conn = self.conn()?;
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM set_fonts", [])?;
    tx.execute("DELETE FROM sets", [])?;
    tx.execute("DELETE FROM tag_fonts", [])?;
    tx.execute("DELETE FROM tags", [])?;
    tx.execute("DELETE FROM favorites", [])?;
    tx.execute("DELETE FROM watched_folders", [])?;
    tx.execute("DELETE FROM activated_fonts", [])?;
    tx.execute("DELETE FROM settings", [])?;
    tx.execute("DELETE FROM font_cache", [])?;
    let _ = tx.execute("DELETE FROM sqlite_sequence WHERE name IN ('sets', 'tags', 'watched_folders')", []);
    tx.commit()?;
    let _ = conn.execute("VACUUM", []);
    Ok(())
  }
}
