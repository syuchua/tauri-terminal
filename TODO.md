# TODO

## Bootstrap
- [x] Initialize Tauri + React workspace (Vite + TypeScript)
- [x] Install and configure Mantine UI + global theme tokens
- [x] Add ESLint/Prettier + project scripts
- [x] Wire husky + lint-staged for pre-commit automation

## Frontend Shell
- [x] Implement core layout (sidebar + workspace + settings panel placeholder)
- [x] Add terminal workspace area with acrylic/blur effect and theme toggle
- [x] Stub stores/services for connections/sessions to unblock UI development
- [x] Add connection creation modal + store action for manual configuration
- [x] 接入 xterm + 输入框，并调用 Tauri `run_local_command`

## Documentation
- [x] Update docs/architecture.md with finalized React + Mantine stack details and acrylic terminal design

## Backend & Sync (upcoming)
- [x] Scaffold Rust modules (cmd/domain/infra) aligned with architecture
- [x] Implement Connection + Session repositories/services
- [x] 设计加密 conf 格式与主密码/Keychain 解锁流程
- [x] 前端导入/导出 UI（Sync overview + Import/Export Modal）
- [x] 实现 LocalFileAdapter + AES-GCM 加密导入导出
- [x] 新增连接表单 → Tauri create_connection 命令（暂时 InMemory）
- [ ] CloudFolder/WebDAV 适配器 + 真正写入 SQLite/Keychain
- [ ] 终端真正连接 SSH SessionManager
- [ ] 规划SessionManager 的 Rust ↔ React 事件管道，让终端换成真实连接，而不是本地 shell
- [ ] 在 Docker 环境里跑 npm run tauri build（避免 glib 版本问题）