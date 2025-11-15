use std::fs;
use std::path::Path;
use std::sync::Arc;

use anyhow::Result;

use super::StorageAdapter;

#[derive(Default)]
pub struct LocalFileAdapter;

impl StorageAdapter for LocalFileAdapter {
    fn write_encrypted(&self, path: &Path, bytes: &[u8]) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, bytes)?;
        Ok(())
    }

    fn read_encrypted(&self, path: &Path) -> Result<Vec<u8>> {
        let bytes = fs::read(path)?;
        Ok(bytes)
    }
}

pub type SharedStorageAdapter = Arc<dyn StorageAdapter>;
