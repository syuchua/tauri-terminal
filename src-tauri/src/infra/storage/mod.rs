use std::path::Path;

use anyhow::Result;

pub mod local;

pub trait StorageAdapter: Send + Sync {
    fn write_encrypted(&self, path: &Path, bytes: &[u8]) -> Result<()>;
    fn read_encrypted(&self, path: &Path) -> Result<Vec<u8>>;
}
