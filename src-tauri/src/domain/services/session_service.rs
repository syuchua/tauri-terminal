use std::sync::Arc;

use anyhow::Result;

use crate::domain::models::SessionSummary;

pub trait SessionRepository: Send + Sync {
    fn list(&self) -> Result<Vec<SessionSummary>>;
}

#[derive(Clone)]
pub struct SessionService {
    repo: Arc<dyn SessionRepository>,
}

impl SessionService {
    pub fn new(repo: Arc<dyn SessionRepository>) -> Self {
        Self { repo }
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionSummary>> {
        self.repo.list()
    }
}
