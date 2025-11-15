use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use chrono::Utc;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use tar::{Archive, Builder, Header};
use tracing::info;

use crate::infra::crypto::{self, EncryptedBlob};
use crate::infra::storage::StorageAdapter;

pub enum ExportStrategy {
    Full,
    MetadataOnly,
}

pub enum UnlockStrategy {
    MasterPassword(String),
    Keychain,
}

#[derive(thiserror::Error, Debug)]
pub enum SyncError {
    #[error("需要提供主密码或启用 Keychain")]
    MissingMasterPassword,
    #[error("Keychain 解锁尚未实现")]
    KeychainUnavailable,
    #[error("archive 缺少 manifest.json")]
    MissingManifest,
}

#[derive(Clone)]
pub struct SyncService {
    storage: Arc<dyn StorageAdapter>,
}

impl SyncService {
    pub fn new(storage: Arc<dyn StorageAdapter>) -> Self {
        Self { storage }
    }

    pub fn export_conf(
        &self,
        path: &Path,
        strategy: ExportStrategy,
        unlock: UnlockStrategy,
    ) -> Result<()> {
        let password = extract_password(&unlock)?;
        let archive = build_archive(&strategy)?;
        let blob = crypto::seal(&password, &archive)?;
        let serialized = serde_json::to_vec_pretty(&blob)?;

        self.storage.write_encrypted(path, &serialized)?;
        info!(target: "sync", ?path, strategy = strategy_label(&strategy), "导出 conf 成功");
        Ok(())
    }

    pub fn import_conf(&self, path: &Path, unlock: UnlockStrategy) -> Result<()> {
        let password = extract_password(&unlock)?;
        let bytes = self.storage.read_encrypted(path)?;
        let blob: EncryptedBlob = serde_json::from_slice(&bytes)?;
        let archive = crypto::open(&password, &blob)?;
        let manifest = extract_manifest(&archive)?;

        info!(
            target: "sync",
            ?path,
            unlock = unlock_label(&unlock),
            version = manifest.version,
            generated_at = %manifest.generated_at,
            "成功解析 conf，占位实现尚未写入 DB"
        );
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct Manifest {
    version: u32,
    generated_at: String,
    strategy: &'static str,
    include_credentials: bool,
    note: &'static str,
}

fn build_archive(strategy: &ExportStrategy) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    let encoder = GzEncoder::new(&mut buffer, Compression::default());
    let mut builder = Builder::new(encoder);

    let manifest = Manifest {
        version: 1,
        generated_at: Utc::now().to_rfc3339(),
        strategy: strategy_label(strategy),
        include_credentials: matches!(strategy, ExportStrategy::Full),
        note: "placeholder manifest; real data integration pending",
    };

    append_file(
        &mut builder,
        "manifest.json",
        serde_json::to_vec_pretty(&manifest)?.as_slice(),
    )?;
    append_file(&mut builder, "connections.json", b"[]")?;
    append_file(&mut builder, "credentials.json", b"[]")?;
    append_file(&mut builder, "pending-changes.json", b"[]")?;

    builder.finish()?;
    let encoder = builder.into_inner()?;
    encoder.finish()?; // ensure gzip finalized
    Ok(buffer)
}

fn append_file(
    builder: &mut Builder<GzEncoder<&mut Vec<u8>>>,
    name: &str,
    content: &[u8],
) -> Result<()> {
    let mut header = Header::new_gnu();
    header.set_size(content.len() as u64);
    header.set_mode(0o644);
    header.set_cksum();
    builder.append_data(&mut header, Path::new(name), content)?;
    Ok(())
}

fn extract_manifest(archive: &[u8]) -> Result<Manifest> {
    let decoder = GzDecoder::new(archive);
    let mut archive = Archive::new(decoder);
    for entry in archive.entries()? {
        let mut file = entry?;
        let path = file.path()?.to_path_buf();
        if path == PathBuf::from("manifest.json") {
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)?;
            let manifest: Manifest = serde_json::from_slice(&buf)?;
            return Ok(manifest);
        }
    }
    Err(SyncError::MissingManifest.into())
}

fn extract_password(unlock: &UnlockStrategy) -> Result<String> {
    match unlock {
        UnlockStrategy::MasterPassword(value) if !value.trim().is_empty() => Ok(value.clone()),
        UnlockStrategy::MasterPassword(_) => Err(SyncError::MissingMasterPassword.into()),
        UnlockStrategy::Keychain => Err(SyncError::KeychainUnavailable.into()),
    }
}

fn strategy_label(strategy: &ExportStrategy) -> &'static str {
    match strategy {
        ExportStrategy::Full => "full",
        ExportStrategy::MetadataOnly => "metadata_only",
    }
}

fn unlock_label(unlock: &UnlockStrategy) -> &'static str {
    match unlock {
        UnlockStrategy::MasterPassword(_) => "master_password",
        UnlockStrategy::Keychain => "keychain",
    }
}
