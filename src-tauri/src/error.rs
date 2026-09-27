use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Font parse error: {0}")]
    FontParse(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Platform error: {0}")]
    Platform(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
