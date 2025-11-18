mod app_state;
mod cmd;
mod domain;
mod infra;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = app_state::AppState::new(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::connections::list_connections,
            cmd::connections::create_connection,
            cmd::connections::update_connection,
            cmd::connections::delete_connection,
            cmd::sessions::list_session_summaries,
            cmd::sessions::create_shell_session,
            cmd::sessions::send_session_input,
            cmd::sessions::close_shell_session,
            cmd::settings::load_settings,
            cmd::sync::export_encrypted_conf,
            cmd::sync::import_encrypted_conf,
            cmd::terminal::run_local_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
