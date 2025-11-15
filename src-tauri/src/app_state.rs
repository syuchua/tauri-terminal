use std::sync::Arc;

use crate::domain::services::connection_service::{ConnectionRepository, ConnectionService};
use crate::domain::services::session_service::{SessionRepository, SessionService};
use crate::domain::services::sync_service::SyncService;
use crate::infra::db::in_memory::{InMemoryConnectionRepository, InMemorySessionRepository};
use crate::infra::storage::local::LocalFileAdapter;
use crate::infra::storage::StorageAdapter;

pub struct AppState {
    connection_service: ConnectionService,
    session_service: SessionService,
    sync_service: SyncService,
}

impl AppState {
    pub fn new() -> Self {
        let connection_repo: Arc<dyn ConnectionRepository> =
            Arc::new(InMemoryConnectionRepository::default());
        let session_repo: Arc<dyn SessionRepository> =
            Arc::new(InMemorySessionRepository::default());
        let storage_adapter: Arc<dyn StorageAdapter> = Arc::new(LocalFileAdapter::default());

        Self {
            connection_service: ConnectionService::new(connection_repo),
            session_service: SessionService::new(session_repo),
            sync_service: SyncService::new(storage_adapter),
        }
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
}
