#[tauri::command]
pub async fn load_settings() -> Result<(), String> {
    // TODO: implement settings persistence via SQLite/JSON
    Ok(())
}
