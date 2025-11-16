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
- [x] SessionManager 本地 shell 接入（create/send/close + session-data 事件）
- [x] rusqlite 落地 connections.sqlite3 并替换 InMemory 仓储
- [x] SessionManager 根据协议调用系统 ssh（前端 xterm 通过 session-data 渲染）
- [ ] CloudFolder/WebDAV 适配器 + 真正写入 SQLite/Keychain
- [ ] SessionManager 使用 ssh2/sftp 客户端，替换系统 ssh
- [ ] Docker 环境 `npm run tauri build`（解决 glib/webkit 依赖）
- [ ] SyncService 导入/导出真实 SQLite/Keychain 数据，而非 manifest 占位

## Terminal & Session UI
- [ ] 多 Session 标签/分屏以及 session 状态管理
- [ ] SessionManager 退出/错误事件与前端 store 同步（自动重连、提示）
