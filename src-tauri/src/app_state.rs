use std::sync::Arc;

use anyhow::Result;
use tauri::{AppHandle, Manager};

use crate::domain::services::connection_service::ConnectionService;
use crate::domain::services::session_service::{SessionRepository, SessionService};
use crate::domain::services::sync_service::SyncService;
use crate::infra::db::in_memory::InMemorySessionRepository;
use crate::infra::db::sqlite::SqliteConnectionRepository;
use crate::infra::session::SessionManager;
use crate::infra::storage::local::LocalFileAdapter;
use crate::infra::storage::StorageAdapter;

pub struct AppState {
    connection_service: ConnectionService,
    session_service: SessionService,
    sync_service: SyncService,
    session_manager: SessionManager,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<Self> {
        let db_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&db_dir)?;
        let db_path = db_dir.join("connections.sqlite3");

        let connection_repo = Arc::new(SqliteConnectionRepository::new(&db_path)?);
        let session_repo: Arc<dyn SessionRepository> =
            Arc::new(InMemorySessionRepository::default());
        let storage_adapter: Arc<dyn StorageAdapter> = Arc::new(LocalFileAdapter::default());
        let session_manager = SessionManager::new();

        Ok(Self {
            connection_service: ConnectionService::new(connection_repo),
            session_service: SessionService::new(session_repo),
            sync_service: SyncService::new(storage_adapter),
            session_manager,
        })
    }

    pub fn connection_service(&self) -> &ConnectionService {
        &self.connection_service
    }

    pub fn session_service(&self) -> &SessionService {
        &self.session_service
    }

    pub fn sync_service(&self) -> &SyncService {
        &self.sync_service
    }

    pub fn session_manager(&self) -> &SessionManager {
        &self.session_manager
    }
}
