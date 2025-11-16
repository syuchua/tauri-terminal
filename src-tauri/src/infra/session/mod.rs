use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
}

struct SessionHandle {
    stdin: ChildStdin,
}

#[derive(serde::Serialize, Clone)]
pub struct SessionEventPayload {
    pub session_id: String,
    pub stream: String,
    pub data: String,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn create_shell_session(
        &self,
        app_handle: AppHandle,
        connection: Option<crate::domain::models::Connection>,
    ) -> Result<String> {
        let mut cmd = match connection {
            Some(ref conn)
                if matches!(conn.protocol, crate::domain::models::Protocol::Ssh)
                    || matches!(conn.protocol, crate::domain::models::Protocol::Sftp) =>
            {
                let mut ssh = Command::new("ssh");
                ssh.arg("-p").arg(conn.port.to_string());
                ssh.arg(format!("{}@{}", conn.username, conn.host));
                ssh
            }
            _ => {
                #[cfg(target_os = "windows")]
                let mut local = Command::new("cmd");
                #[cfg(target_os = "windows")]
                local.arg("/K");

                #[cfg(not(target_os = "windows"))]
                let mut local = Command::new("/bin/sh");
                #[cfg(not(target_os = "windows"))]
                local.arg("-i");
                local
            }
        };

        cmd.stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or_else(|| anyhow!("缺少 stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("缺少 stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| anyhow!("缺少 stderr"))?;
        let session_id = format!("session-{}", Uuid::new_v4().simple());

        Self::spawn_reader(stdout, session_id.clone(), "stdout", app_handle.clone());
        Self::spawn_reader(stderr, session_id.clone(), "stderr", app_handle.clone());

        let header = SessionEventPayload {
            session_id: session_id.clone(),
            stream: "stdout".into(),
            data: format!(
                "连接 {} 已启动",
                connection
                    .as_ref()
                    .map(|c| c.name.clone())
                    .unwrap_or_else(|| "local-shell".into())
            ),
        };
        let _ = app_handle.emit("session-data", header);

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), SessionHandle { stdin });
        Ok(session_id)
    }

    pub async fn send_input(&self, session_id: &str, data: &str) -> Result<()> {
        if let Some(handle) = self.sessions.lock().await.get_mut(session_id) {
            handle.stdin.write_all(data.as_bytes()).await?;
            handle.stdin.flush().await?;
            Ok(())
        } else {
            Err(anyhow!("session not found"))
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        self.sessions.lock().await.remove(session_id);
        Ok(())
    }

    fn spawn_reader(
        stream_handle: impl AsyncRead + Unpin + Send + 'static,
        session_id: String,
        stream: &str,
        app_handle: AppHandle,
    ) {
        let stream_name = stream.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stream_handle);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        let payload = SessionEventPayload {
                            session_id: session_id.clone(),
                            stream: stream_name.clone(),
                            data: line.trim_end_matches(['\r', '\n']).to_string(),
                        };
                        let _ = app_handle.emit("session-data", payload);
                    }
                    Err(_) => break,
                }
            }
            let _ = app_handle.emit(
                "session-closed",
                serde_json::json!({ "session_id": session_id }),
            );
        });
    }
}
