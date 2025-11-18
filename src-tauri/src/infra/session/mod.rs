use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use crossbeam_channel::{unbounded, Receiver, Sender, TryRecvError};
use ssh2::{Channel as SshChannel, ExtendedData, Session as SshSession};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::models::{Connection, Protocol};

#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
}

#[derive(Clone)]
pub struct SessionSecret {
    pub password: Option<String>,
}

struct SessionHandle {
    kind: SessionKind,
}

enum SessionKind {
    Local { stdin: ChildStdin },
    Ssh2 { tx: Sender<SessionInput> },
}

enum SessionInput {
    Data(String),
    Close,
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
        connection: Option<Connection>,
        secret: Option<SessionSecret>,
    ) -> Result<String> {
        match connection {
            Some(conn) if matches!(conn.protocol, Protocol::Ssh | Protocol::Sftp) => {
                self.spawn_ssh_session(app_handle, conn, secret).await
            }
            _ => self.spawn_local_shell(app_handle).await,
        }
    }

    pub async fn send_input(&self, session_id: &str, data: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        let handle = sessions
            .get_mut(session_id)
            .ok_or_else(|| anyhow!("session not found"))?;
        match &mut handle.kind {
            SessionKind::Local { stdin } => {
                stdin.write_all(data.as_bytes()).await?;
                stdin.flush().await?;
                Ok(())
            }
            SessionKind::Ssh2 { tx } => tx
                .send(SessionInput::Data(data.to_string()))
                .map_err(|err| anyhow!("发送 SSH 输入失败: {err}")),
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        if let Some(handle) = self.sessions.lock().await.remove(session_id) {
            if let SessionKind::Ssh2 { tx } = handle.kind {
                let _ = tx.send(SessionInput::Close);
            }
        }
        Ok(())
    }

    async fn spawn_local_shell(&self, app_handle: AppHandle) -> Result<String> {
        #[cfg(target_os = "windows")]
        let mut cmd = Command::new("cmd");
        #[cfg(target_os = "windows")]
        cmd.arg("/K");

        #[cfg(not(target_os = "windows"))]
        let mut cmd = Command::new("/bin/sh");
        #[cfg(not(target_os = "windows"))]
        cmd.arg("-i");

        cmd.stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or_else(|| anyhow!("缺少 stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("缺少 stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| anyhow!("缺少 stderr"))?;
        let session_id = format!("session-{}", Uuid::new_v4().simple());

        Self::spawn_async_reader(stdout, session_id.clone(), "stdout", app_handle.clone());
        Self::spawn_async_reader(stderr, session_id.clone(), "stderr", app_handle.clone());

        let header = SessionEventPayload {
            session_id: session_id.clone(),
            stream: "stdout".into(),
            data: "本地 shell 已启动".into(),
        };
        let _ = app_handle.emit("session-data", header);

        self.sessions.lock().await.insert(
            session_id.clone(),
            SessionHandle {
                kind: SessionKind::Local { stdin },
            },
        );
        Ok(session_id)
    }

    async fn spawn_ssh_session(
        &self,
        app_handle: AppHandle,
        connection: Connection,
        secret: Option<SessionSecret>,
    ) -> Result<String> {
        let session_id = format!("session-{}", Uuid::new_v4().simple());
        let (tx, rx) = unbounded();
        let connection_clone = connection.clone();
        let event_handle = app_handle.clone();
        let thread_session_id = session_id.clone();
        thread::spawn(move || {
            let result = Self::run_ssh_session(
                connection_clone,
                thread_session_id.clone(),
                event_handle.clone(),
                secret,
                rx,
            );
            if let Err(err) = result {
                let _ = event_handle.emit(
                    "session-data",
                    SessionEventPayload {
                        session_id: thread_session_id.clone(),
                        stream: "stderr".into(),
                        data: format!("SSH 会话错误: {err}"),
                    },
                );
            }
            let _ = event_handle.emit(
                "session-closed",
                serde_json::json!({ "session_id": thread_session_id }),
            );
        });

        let header = SessionEventPayload {
            session_id: session_id.clone(),
            stream: "stdout".into(),
            data: format!(
                "正在连接 {}@{}:{}",
                connection.name, connection.host, connection.port
            ),
        };
        let _ = app_handle.emit("session-data", header);

        self.sessions.lock().await.insert(
            session_id.clone(),
            SessionHandle {
                kind: SessionKind::Ssh2 { tx },
            },
        );

        Ok(session_id)
    }

    fn run_ssh_session(
        connection: Connection,
        session_id: String,
        app_handle: AppHandle,
        secret: Option<SessionSecret>,
        input_rx: Receiver<SessionInput>,
    ) -> Result<()> {
        let addr = format!("{}:{}", connection.host, connection.port);
        let tcp = TcpStream::connect(&addr).with_context(|| format!("连接 {addr} 失败"))?;
        tcp.set_nodelay(true).ok();

        let mut session = SshSession::new().context("创建 SSH Session 失败")?;
        session.set_tcp_stream(tcp);
        session.handshake()?;
        Self::emit_stream(&app_handle, &session_id, "stdout", "SSH 握手完成");
        authenticate(&mut session, &connection, secret.as_ref())?;
        Self::emit_stream(&app_handle, &session_id, "stdout", "SSH 认证成功");
        session.set_blocking(true); // 设置阶段保持阻塞，避免 EAGAIN

        let mut channel = session.channel_session()?;
        channel.handle_extended_data(ExtendedData::Merge)?;
        channel.request_pty("xterm-256color", None, Some((80, 24, 0, 0)))?;
        channel.shell()?;
        Self::emit_stream(&app_handle, &session_id, "stdout", "PTY 与 shell 已建立");
        // 建立会话后切回非阻塞，方便轮询读写
        session.set_blocking(false);

        let mut buffer = [0u8; 4096];
        let mut pending = String::new();

        let mut closed_reason: Option<String> = None;

        loop {
            match channel.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    pending.push_str(&String::from_utf8_lossy(&buffer[..size]));
                    while let Some(pos) = pending.find('\n') {
                        let line = pending[..pos].trim_end_matches('\r').to_string();
                        pending.drain(..=pos);
                        Self::emit_stream(&app_handle, &session_id, "stdout", &line);
                    }
                }
                Err(err) => {
                    if is_would_block(&err) {
                        thread::sleep(Duration::from_millis(12));
                        continue;
                    }
                    closed_reason = Some(format!("read error: {err}"));
                    break;
                }
            }

            match input_rx.try_recv() {
                Ok(SessionInput::Data(data)) => {
                    write_channel(&mut channel, &data)?;
                }
                Ok(SessionInput::Close) => {
                    let _ = channel.close();
                    closed_reason.get_or_insert_with(|| "用户主动关闭".into());
                    return Ok(());
                }
                Err(TryRecvError::Disconnected) => {
                    closed_reason.get_or_insert_with(|| "会话通道已断开".into());
                    break;
                }
                Err(TryRecvError::Empty) => {}
            }

            if channel.eof() {
                closed_reason.get_or_insert_with(|| "远端已关闭连接".into());
                break;
            }
            thread::sleep(Duration::from_millis(12));
        }

        if !pending.trim().is_empty() {
            Self::emit_stream(&app_handle, &session_id, "stdout", pending.trim_end());
        }

        let _ = channel.close();
        if let Some(reason) = closed_reason {
            Self::emit_stream(
                &app_handle,
                &session_id,
                "stderr",
                &format!("SSH 会话结束: {reason}"),
            );
        }
        Ok(())
    }

    fn emit_stream(app_handle: &AppHandle, session_id: &str, stream: &str, data: &str) {
        if data.is_empty() {
            return;
        }
        let payload = SessionEventPayload {
            session_id: session_id.to_string(),
            stream: stream.to_string(),
            data: data.to_string(),
        };
        let _ = app_handle.emit("session-data", payload);
    }

    fn spawn_async_reader(
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

fn write_channel(channel: &mut SshChannel, data: &str) -> Result<()> {
    let mut remaining = data.as_bytes();
    while !remaining.is_empty() {
        match channel.write(remaining) {
            Ok(0) => break,
            Ok(written) => {
                remaining = &remaining[written..];
            }
            Err(err) => {
                if is_would_block(&err) {
                    thread::sleep(Duration::from_millis(12));
                    continue;
                }
                return Err(anyhow!("SSH 写入失败: {err}"));
            }
        }
    }

    loop {
        match channel.flush() {
            Ok(_) => break,
            Err(err) => {
                if is_would_block(&err) {
                    thread::sleep(Duration::from_millis(12));
                    continue;
                }
                return Err(anyhow!("SSH 刷新失败: {err}"));
            }
        }
    }
    Ok(())
}

fn is_would_block(err: &std::io::Error) -> bool {
    err.kind() == std::io::ErrorKind::WouldBlock || err.to_string().contains("Would block")
}

fn authenticate(
    session: &mut SshSession,
    connection: &Connection,
    secret: Option<&SessionSecret>,
) -> Result<()> {
    if let Some(secret) = secret {
        if let Some(password) = &secret.password {
            session
                .userauth_password(&connection.username, password)
                .map_err(|err| anyhow!("密码认证失败: {err}"))?;
            if session.authenticated() {
                return Ok(());
            }
        }
    }

    if let Ok(mut agent) = session.agent() {
        agent.connect()?;
        agent.list_identities()?;
        for identity in agent.identities()? {
            if agent.userauth(&connection.username, &identity).is_ok() && session.authenticated() {
                let _ = agent.disconnect();
                return Ok(());
            }
        }
        let _ = agent.disconnect();
    }

    Err(anyhow!("SSH 认证失败：请提供密码或载入 ssh-agent 凭据"))
}
