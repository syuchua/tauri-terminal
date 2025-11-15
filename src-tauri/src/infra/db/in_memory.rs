use anyhow::Result;
use once_cell::sync::Lazy;
use std::sync::Mutex;

use crate::domain::models::{AuthType, Connection, ConnectionHealth, Protocol, SessionSummary};
use crate::domain::services::connection_service::ConnectionRepository;
use crate::domain::services::session_service::SessionRepository;

static CONNECTIONS: Lazy<Mutex<Vec<Connection>>> = Lazy::new(|| Mutex::new(default_connections()));

#[derive(Default)]
pub struct InMemoryConnectionRepository;

impl ConnectionRepository for InMemoryConnectionRepository {
    fn list(&self) -> Result<Vec<Connection>> {
        Ok(CONNECTIONS.lock().unwrap().clone())
    }

    fn create(&self, connection: Connection) -> Result<Connection> {
        CONNECTIONS.lock().unwrap().insert(0, connection.clone());
        Ok(connection)
    }
}

fn default_connections() -> Vec<Connection> {
    vec![
        Connection {
            id: "conn-prod-api".into(),
            name: "Prod API".into(),
            protocol: Protocol::Ssh,
            host: "10.21.20.8".into(),
            port: 22,
            username: "deploy".into(),
            auth_type: AuthType::PrivateKey,
            group_id: Some("grp-production".into()),
            group_name: Some("Production".into()),
            tags: vec!["critical".into(), "zero-downtime".into()],
            favorite: true,
            status: ConnectionHealth::Healthy,
            last_connected_at: Some("2025-11-10T08:12:33Z".into()),
        },
        Connection {
            id: "conn-payments-edge".into(),
            name: "Payments Edge".into(),
            protocol: Protocol::Ssh,
            host: "10.21.32.4".into(),
            port: 22,
            username: "infra".into(),
            auth_type: AuthType::PrivateKey,
            group_id: Some("grp-production".into()),
            group_name: Some("Production".into()),
            tags: vec!["payments".into()],
            favorite: false,
            status: ConnectionHealth::Deploying,
            last_connected_at: None,
        },
        Connection {
            id: "conn-analytics".into(),
            name: "Analytics".into(),
            protocol: Protocol::Ssh,
            host: "10.21.44.12".into(),
            port: 22,
            username: "analytics".into(),
            auth_type: AuthType::Password,
            group_id: Some("grp-staging".into()),
            group_name: Some("Staging".into()),
            tags: vec!["etl".into()],
            favorite: false,
            status: ConnectionHealth::Idle,
            last_connected_at: Some("2025-11-14T22:31:09Z".into()),
        },
        Connection {
            id: "conn-qa-gateway".into(),
            name: "QA Gateway".into(),
            protocol: Protocol::Ssh,
            host: "10.21.77.3".into(),
            port: 22,
            username: "qa".into(),
            auth_type: AuthType::Password,
            group_id: Some("grp-qa".into()),
            group_name: Some("QA".into()),
            tags: vec![],
            favorite: false,
            status: ConnectionHealth::Connected,
            last_connected_at: Some("2025-11-15T07:05:44Z".into()),
        },
    ]
}

#[derive(Default)]
pub struct InMemorySessionRepository;

impl SessionRepository for InMemorySessionRepository {
    fn list(&self) -> Result<Vec<SessionSummary>> {
        Ok(vec![
            SessionSummary {
                id: "session-prod-api".into(),
                connection_id: "conn-prod-api".into(),
                title: "prod-api-01".into(),
                latency_ms: 42,
                status_label: "Live".into(),
                updated_at: "2025-11-15T13:35:00Z".into(),
            },
            SessionSummary {
                id: "session-payments-edge".into(),
                connection_id: "conn-payments-edge".into(),
                title: "payments-edge".into(),
                latency_ms: 51,
                status_label: "Deploying".into(),
                updated_at: "2025-11-15T13:31:00Z".into(),
            },
            SessionSummary {
                id: "session-analytics".into(),
                connection_id: "conn-analytics".into(),
                title: "analytics-pipeline".into(),
                latency_ms: 68,
                status_label: "Idle".into(),
                updated_at: "2025-11-15T13:15:00Z".into(),
            },
        ])
    }
}
