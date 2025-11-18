use std::sync::Arc;

use anyhow::{anyhow, Result};

use uuid::Uuid;

use crate::domain::models::{AuthType, Connection, ConnectionHealth, Protocol};

pub trait ConnectionRepository: Send + Sync {
    fn list(&self) -> Result<Vec<Connection>>;
    fn create(&self, connection: Connection) -> Result<Connection>;
    fn get(&self, id: &str) -> Result<Option<Connection>>;
    fn update(&self, connection: Connection) -> Result<Connection>;
    fn delete(&self, id: &str) -> Result<()>;
}

#[derive(Clone)]
pub struct ConnectionService {
    repo: Arc<dyn ConnectionRepository>,
}

#[derive(Debug, Clone)]
pub struct NewConnection {
    pub name: String,
    pub host: String,
    pub username: String,
    pub protocol: String,
    pub port: u16,
}

#[derive(Debug, Clone)]
pub struct UpdateConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub username: String,
    pub protocol: String,
    pub port: u16,
}

impl ConnectionService {
    pub fn new(repo: Arc<dyn ConnectionRepository>) -> Self {
        Self { repo }
    }

    pub fn list_connections(&self) -> Result<Vec<Connection>> {
        self.repo.list()
    }

    pub fn create_connection(&self, payload: NewConnection) -> Result<Connection> {
        let connection = Connection {
            id: generate_id(),
            name: payload.name,
            protocol: map_protocol(&payload.protocol),
            host: payload.host,
            port: payload.port,
            username: payload.username,
            auth_type: AuthType::Password,
            group_id: None,
            group_name: None,
            tags: vec![],
            favorite: false,
            status: ConnectionHealth::Idle,
            last_connected_at: None,
        };
        self.repo.create(connection)
    }

    pub fn get_connection(&self, id: &str) -> Result<Option<Connection>> {
        self.repo.get(id)
    }

    pub fn update_connection(&self, payload: UpdateConnection) -> Result<Connection> {
        let mut existing = self
            .repo
            .get(&payload.id)?
            .ok_or_else(|| anyhow!("Connection not found"))?;
        existing.name = payload.name;
        existing.protocol = map_protocol(&payload.protocol);
        existing.host = payload.host;
        existing.port = payload.port;
        existing.username = payload.username;
        self.repo.update(existing)
    }

    pub fn delete_connection(&self, id: &str) -> Result<()> {
        self.repo.delete(id)
    }
}

fn generate_id() -> String {
    format!("conn-{}", Uuid::new_v4().simple())
}

fn map_protocol(input: &str) -> Protocol {
    match input {
        "sftp" => Protocol::Sftp,
        "ftp" => Protocol::Ftp,
        _ => Protocol::Ssh,
    }
}
