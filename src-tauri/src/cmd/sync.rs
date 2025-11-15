use std::path::PathBuf;

use tauri::State;

use crate::app_state::AppState;
use crate::domain::services::sync_service::{ExportStrategy, UnlockStrategy};

#[tauri::command]
pub async fn export_encrypted_conf(
    state: State<'_, AppState>,
    target_path: String,
    include_credentials: bool,
    use_keychain: bool,
    master_password: Option<String>,
) -> Result<(), String> {
    let strategy = if include_credentials {
        ExportStrategy::Full
    } else {
        ExportStrategy::MetadataOnly
    };
    let unlock = if use_keychain {
        UnlockStrategy::Keychain
    } else {
        let password = master_password.ok_or_else(|| "需要提供主密码".to_string())?;
        UnlockStrategy::MasterPassword(password)
    };
    let path = PathBuf::from(target_path);
    state
        .sync_service()
        .export_conf(path.as_path(), strategy, unlock)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn import_encrypted_conf(
    state: State<'_, AppState>,
    source_path: String,
    use_keychain: bool,
    master_password: Option<String>,
) -> Result<(), String> {
    let unlock = if use_keychain {
        UnlockStrategy::Keychain
    } else {
        let password = master_password.ok_or_else(|| "需要提供主密码".to_string())?;
        UnlockStrategy::MasterPassword(password)
    };

    let path = PathBuf::from(source_path);
    state
        .sync_service()
        .import_conf(path.as_path(), unlock)
        .map_err(|err| err.to_string())
}
