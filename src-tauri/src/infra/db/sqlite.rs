use std::path::{Path, PathBuf};

use anyhow::Result;
use rusqlite::{params, Connection};

use crate::domain::models::{AuthType, Connection as DomainConnection, ConnectionHealth, Protocol};
use crate::domain::services::connection_service::ConnectionRepository;

pub struct SqliteConnectionRepository {
    path: PathBuf,
}

impl SqliteConnectionRepository {
    pub fn new(path: &Path) -> Result<Self> {
        let repo = Self {
            path: path.to_path_buf(),
        };
        repo.connection()?.execute_batch(
            "CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                protocol TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL,
                group_id TEXT,
                group_name TEXT,
                tags TEXT DEFAULT '[]',
                favorite INTEGER DEFAULT 0,
                status TEXT DEFAULT 'idle',
                last_connected_at TEXT
            );",
        )?;
        Ok(repo)
    }

    fn connection(&self) -> Result<Connection> {
        Ok(Connection::open(&self.path)?)
    }
}

impl ConnectionRepository for SqliteConnectionRepository {
    fn list(&self) -> Result<Vec<DomainConnection>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, protocol, host, port, username, auth_type, group_id, group_name, tags, favorite, status, last_connected_at FROM connections ORDER BY rowid DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let tags: String = row.get(9)?;
            Ok(DomainConnection {
                id: row.get(0)?,
                name: row.get(1)?,
                protocol: parse_protocol(row.get::<_, String>(2)?.as_str()),
                host: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_type: parse_auth(row.get::<_, String>(6)?.as_str()),
                group_id: row.get(7)?,
                group_name: row.get(8)?,
                tags: serde_json::from_str(&tags).unwrap_or_default(),
                favorite: row.get::<_, i64>(10)? == 1,
                status: parse_status(row.get::<_, String>(11)?.as_str()),
                last_connected_at: row.get(12)?,
            })
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }

    fn create(&self, connection: DomainConnection) -> Result<DomainConnection> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO connections (id, name, protocol, host, port, username, auth_type, group_id, group_name, tags, favorite, status, last_connected_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                connection.id,
                connection.name,
                format_protocol(&connection.protocol),
                connection.host,
                connection.port,
                connection.username,
                format_auth(&connection.auth_type),
                connection.group_id,
                connection.group_name,
                serde_json::to_string(&connection.tags)?,
                if connection.favorite { 1 } else { 0 },
                format_status(&connection.status),
                connection.last_connected_at,
            ],
        )?;
        Ok(connection)
    }

    fn get(&self, id: &str) -> Result<Option<DomainConnection>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, protocol, host, port, username, auth_type, group_id, group_name, tags, favorite, status, last_connected_at FROM connections WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let tags: String = row.get(9)?;
            return Ok(Some(DomainConnection {
                id: row.get(0)?,
                name: row.get(1)?,
                protocol: parse_protocol(row.get::<_, String>(2)?.as_str()),
                host: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_type: parse_auth(row.get::<_, String>(6)?.as_str()),
                group_id: row.get(7)?,
                group_name: row.get(8)?,
                tags: serde_json::from_str(&tags).unwrap_or_default(),
                favorite: row.get::<_, i64>(10)? == 1,
                status: parse_status(row.get::<_, String>(11)?.as_str()),
                last_connected_at: row.get(12)?,
            }));
        }
        Ok(None)
    }
}

fn format_protocol(protocol: &Protocol) -> &'static str {
    match protocol {
        Protocol::Ssh => "ssh",
        Protocol::Sftp => "sftp",
        Protocol::Ftp => "ftp",
    }
}

fn parse_protocol(value: &str) -> Protocol {
    match value {
        "sftp" => Protocol::Sftp,
        "ftp" => Protocol::Ftp,
        _ => Protocol::Ssh,
    }
}

fn format_auth(auth: &AuthType) -> &'static str {
    match auth {
        AuthType::PrivateKey => "privateKey",
        AuthType::Agent => "agent",
        AuthType::Password => "password",
    }
}

fn parse_auth(value: &str) -> AuthType {
    match value {
        "privateKey" => AuthType::PrivateKey,
        "agent" => AuthType::Agent,
        _ => AuthType::Password,
    }
}

fn format_status(status: &ConnectionHealth) -> &'static str {
    match status {
        ConnectionHealth::Healthy => "healthy",
        ConnectionHealth::Deploying => "deploying",
        ConnectionHealth::Connected => "connected",
        ConnectionHealth::Idle => "idle",
    }
}

fn parse_status(value: &str) -> ConnectionHealth {
    match value {
        "healthy" => ConnectionHealth::Healthy,
        "deploying" => ConnectionHealth::Deploying,
        "connected" => ConnectionHealth::Connected,
        _ => ConnectionHealth::Idle,
    }
}
