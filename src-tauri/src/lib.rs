mod app_state;
mod cmd;
mod domain;
mod infra;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = app_state::AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            cmd::connections::list_connections,
            cmd::connections::create_connection,
            cmd::sessions::list_session_summaries,
            cmd::settings::load_settings,
            cmd::sync::export_encrypted_conf,
            cmd::sync::import_encrypted_conf,
            cmd::terminal::run_local_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
