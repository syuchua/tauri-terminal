use tauri::State;
use tokio::process::Command;

use crate::app_state::AppState;

#[derive(serde::Deserialize)]
pub struct TerminalCommandPayload {
    pub command: String,
    pub connection_id: Option<String>,
}

#[tauri::command]
pub async fn run_local_command(
    _state: State<'_, AppState>,
    payload: TerminalCommandPayload,
) -> Result<String, String> {
    if payload.command.trim().is_empty() {
        return Err("命令不能为空".into());
    }

    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("cmd");

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("sh");

    #[cfg(target_os = "windows")]
    cmd.arg("/C").arg(&payload.command);

    #[cfg(not(target_os = "windows"))]
    cmd.arg("-c").arg(&payload.command);

    let output = cmd.output().await.map_err(|err| err.to_string())?;
    let mut result = String::new();
    if !output.stdout.is_empty() {
        result.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !result.is_empty() {
            result.push_str("\n");
        }
        result.push_str(&String::from_utf8_lossy(&output.stderr));
    }

    if result.trim().is_empty() {
        result.push_str("(命令执行成功，但无输出)");
    }

    Ok(result)
}
