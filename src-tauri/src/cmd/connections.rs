use tauri::State;

use crate::app_state::AppState;
use crate::domain::models::Connection;

#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<Vec<Connection>, String> {
    state
        .connection_service()
        .list_connections()
        .map_err(|err| err.to_string())
}

#[derive(serde::Deserialize)]
pub struct NewConnectionPayload {
    pub name: String,
    pub host: String,
    pub username: String,
    pub protocol: String,
    pub port: u16,
}

#[tauri::command]
pub async fn create_connection(
    state: State<'_, AppState>,
    payload: NewConnectionPayload,
) -> Result<Connection, String> {
    let command = crate::domain::services::connection_service::NewConnection {
        name: payload.name,
        host: payload.host,
        username: payload.username,
        protocol: payload.protocol,
        port: payload.port,
    };
    state
        .connection_service()
        .create_connection(command)
        .map_err(|err| err.to_string())
}
