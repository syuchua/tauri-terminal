use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::domain::models::SessionSummary;

#[tauri::command]
pub async fn list_session_summaries(
    state: State<'_, AppState>,
) -> Result<Vec<SessionSummary>, String> {
    state
        .session_service()
        .list_sessions()
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn create_shell_session(
    app: AppHandle,
    state: State<'_, AppState>,
    connection_id: Option<String>,
) -> Result<String, String> {
    let connection = match connection_id {
        Some(id) => state
            .connection_service()
            .get_connection(&id)
            .map_err(|err| err.to_string())?,
        None => None,
    };
    state
        .session_manager()
        .create_shell_session(app, connection)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn send_session_input(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state
        .session_manager()
        .send_input(&session_id, &data)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn close_shell_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state
        .session_manager()
        .close_session(&session_id)
        .await
        .map_err(|err| err.to_string())
}
