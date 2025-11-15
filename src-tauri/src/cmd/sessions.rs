use tauri::State;

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
