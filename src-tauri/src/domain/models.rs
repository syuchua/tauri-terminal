use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Ssh,
    Sftp,
    Ftp,
}

impl Default for Protocol {
    fn default() -> Self {
        Self::Ssh
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    Password,
    PrivateKey,
    Agent,
}

impl Default for AuthType {
    fn default() -> Self {
        Self::PrivateKey
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionHealth {
    Healthy,
    Deploying,
    Connected,
    Idle,
}

impl Default for ConnectionHealth {
    fn default() -> Self {
        Self::Healthy
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub protocol: Protocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub auth_type: AuthType,
    pub group_id: Option<String>,
    pub group_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub status: ConnectionHealth,
    pub last_connected_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub connection_id: String,
    pub title: String,
    pub latency_ms: u32,
    pub status_label: String,
    pub updated_at: String,
}
