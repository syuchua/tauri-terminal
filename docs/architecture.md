# tauri-terminal 架构与工程蓝图

最后更新：2025-11-15

---

## 1. 项目目标

`tauri-terminal` 是一个基于 **Tauri + React + TypeScript** 的跨平台桌面终端与远程资产管理工具，目标能力：

1. **协议覆盖**：首批支持 SSH / SFTP / FTP，后续扩展 RDP、Telnet 等。
2. **连接管理**：连接配置、分组（树形/标签）、收藏、搜索、批量操作。
3. **会话体验**：多标签终端、分屏、命令片段、常用脚本、会话留存。
4. **文件与同步**：SFTP/FTP 文件管理器，核心连接数据可导出为本地加密 `conf`，由用户自选网盘/版本库同步。
5. **美观安全**：支持浅/深色主题与自定义配色，终端采用半透明亚克力（Acrylic）效果；密码、私钥等安全存储。

---

## 2. 分层架构概览

```
┌──────────────────────────────────────────────┐
│ 前端 UI 层（React + Mantine + Vite）         │
│  - UI/交互、状态管理、全局主题               │
│  - 通过 Tauri API 调度 Rust 命令与事件       │
├──────────────────────────────────────────────┤
│ 应用/领域层（TS & Rust 共用模型 + 服务）    │
│  - Connection/Session/Sync 领域模型         │
│  - ConnectionService / SessionService 等    │
│  - DTO/事件模型保持前后端一致               │
├──────────────────────────────────────────────┤
│ 基础设施层（Rust + SQLite + Keychain + 存储适配器） │
│  - 协议客户端（SSH/SFTP/FTP）                     │
│  - 本地存储、凭据、日志                           │
│  - 可插拔同步适配器（本地文件/网盘/WebDAV 等）     │
└──────────────────────────────────────────────┘
```

---

## 3. 技术栈决策

| 层级 | 技术 | 说明 |
| ---- | ---- | ---- |
| 前端 UI | **React 18 + Vite + TypeScript** | 熟悉生态、组合式组件、Hooks 模式；Vite 提供极速 HMR。 |
| UI & 主题 | **Mantine 7 + Mantine Notifications + Tabler Icons** | 快速搭建现代 UI，并内置暗/亮主题、AppShell、ScrollArea 等组件。 |
| 样式 | Mantine CSS + 全局 `global.css` + 局部 `App.css` | 通过 CSS 变量和 `backdrop-filter` 实现半透明亚克力终端。 |
| 状态管理 | 计划使用 Zustand + TanStack Query（稍后引入） | Store 管理 UI/Session 状态，Query 管理异步数据和缓存。 |
| 桌面壳 | Tauri 2.x | 轻量跨平台，Rust 提供系统能力。 |
| 后端 | Rust 1.80+，Tokio，Serde，sqlx/rusqlite，ssh2/async-ftp | 对接协议与本地存储。 |
| 同步 | 本地加密 `conf` + 可插拔存储适配器 | 默认离线存储；可让用户自选 Google Drive/Dropbox/WebDAV 等目标，仅传输密文。 |

---

## 4. 领域模型（简版）

```ts
type Protocol = 'ssh' | 'sftp' | 'ftp';

type AuthType = 'password' | 'privateKey' | 'agent';

interface Connection {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  credentialId?: string;
  groupId?: string;
  tags: string[];
  favorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

interface Group {
  id: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Credential {
  id: string;
  type: 'password' | 'privateKey';
  displayName: string;
  keychainRef?: string;
  encryptedPayload?: string; // AES-GCM + 主密码
  createdAt: string;
  updatedAt: string;
}

interface Session {
  id: string;
  connectionId: string;
  title: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  createdAt: string;
  closedAt?: string;
}

interface SyncState {
  userId?: string;
  lastFullSyncAt?: string;
  lastDeltaSyncAt?: string;
  pendingChanges: SyncChange[];
}

interface SyncChange {
  id: string;
  entityType: 'connection' | 'group' | 'credential' | 'setting';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  updatedAt: string;
}
```

以上类型会通过 `serde` + `ts-rs`（可选）保持前后端一致。

---

## 5. 前端架构（React + Mantine）

### 5.1 目录规划（进行中）

```
src/
  app/
    providers/          # Mantine Provider、QueryClientProvider 等
    theme.ts            # 主题 & 色板
  components/           # 通用组件（ColorSchemeToggle 等）
  features/
    shell/              # AppShell / Sidebar / Terminal Surface
    connections/        # Connection 列表、表单
    sessions/           # Session tabs、终端、分屏
  store/                # Zustand stores（connections/sessions/settings）
  services/             # Tauri API 调用、数据映射
  styles/global.css     # 全局背景、噪声纹理、字体
```

### 5.2 Mantine 主题与半透明终端

- 主题：`theme.ts` 中自定义 `plasma` 色板、字体（Inter + Space Grotesk + JetBrains Mono）。
- 颜色模式：`MantineProvider` + `localStorageColorSchemeManager`，在任何组件可通过 `useMantineColorScheme` 切换。
- Acrylic 终端：在 `App.css` 中通过 `backdrop-filter: blur(26px) saturate(180%)` + 半透明背景 + 渐变 + `traffic-lights` 模拟 macOS 风格，配合 Mantine `AppShell` 在暗/亮模式都具质感。
- 背景：`global.css` 提供多层 radial gradient + SVG 线条纹理，营造“星云”氛围。

### 5.3 状态管理（后续）

- `connectionsStore`: 保存连接、分组、过滤状态，暴露 CRUD 方法（内部调用 `ConnectionService`）。
- `sessionsStore`: 管理活跃会话、标签、终端设置（字体、透明度）。
- `settingsStore`: 主题、语言、快捷键、同步偏好。
- Query 层：`useConnectionsQuery`, `useSyncStatusQuery` 等对接 Tauri 命令，缓存 + 失效策略 + 乐观更新。

### 5.4 组件/页面划分

- Shell（已初版）：Mantine `AppShell` + `Navbar` + `Header` + `Main`，已经搭出 Acrylic 终端示例。
- Connections 面板：`ScrollArea` + `Card` + `TextInput` + `Button`，未来替换为真实数据和树/标签控件。
  - 当前已支持通过 `ConnectionFormModal` 新增连接（名称/主机/协议/端口/用户名），按钮位于左侧面板的搜索框下方，创建后立刻写入 Zustand store（未来接入 SQLite/Tauri 命令）。
  - 现在表单会调用 Tauri `create_connection` 命令：在 Rust 端通过 `ConnectionService::create_connection` 写入 InMemory Repository（将来替换为 SQLite）。Web 端 fallback 则只更新本地 store，方便在浏览器环境下预览 UI。
- Terminal 区域：`Box` + `pre` 先展示伪输出，后续替换为 `xterm.js`，Acrylic 背景和 toolbar 复用 CSS。
  - Terminal 区域：现在使用 `xterm.js + fit addon` 初始化一个可交互的终端实例，默认渲染虚拟日志。下一步可以把 Tauri session 数据流映射到 `xterm.write()`，并在输入时通过命令管道发回 Rust SessionManager。
- 概览卡片：`Card` + `Badge` + `Flex` 显示 Session 数、同步状态等。

### 5.5 设计模式

- **MVVM / Container + Presentational**：Hooks/Store 负责数据，UI 组件仅接收 props。
- **Command 模式**：复杂操作封装为命令对象（准备支持 Undo/Redo）。
- **Adapter 模式**：React 端 `services/tauriAdapter.ts` 将 Tauri 命令包装为 Promise API，隔离调用细节。
- **Suspense-ready Data Hooks**：Query Hook 统一暴露 `data/status/refetch`，组件保持声明式。

---

## 6. Tauri / Rust 层

### 6.1 目录建议

```
src-tauri/src/
  main.rs                      # Tauri 启动、窗口管理
  cmd/
    connections.rs             # list/create/update/delete
    sessions.rs                # 会话建立、输入、关闭、尺寸同步
    sync.rs                    # 加密 conf 导入/导出、适配器调度
    settings.rs                # 本地设置
  domain/
    models.rs
    services/
      connection_service.rs
      session_service.rs
      sync_service.rs
  infra/
    db.rs                      # SQLite + 迁移
    keychain.rs                # 系统 Keychain 适配
    ssh_client.rs
    ftp_client.rs
    config.rs                  # App 配置
  telemetry/
    logging.rs                 # 结构化日志 + 脱敏
```

> 运行态：新增 `app_state.rs` 作为统一入口，Tauri 启动时创建 `ConnectionService` / `SessionService` 并通过 `.manage(AppState)` 注入。当前阶段 `infra/db/in_memory.rs` 暂时代替仓储，未来迁移到 SQLite + Keychain 时仅需更换实现即可。

### 6.2 Session Manager

```rust
pub struct SessionHandle {
    pub id: String,
    pub connection_id: String,
    pub tx_stdin: tokio::sync::mpsc::Sender<Vec<u8>>,
    pub close_tx: tokio::sync::oneshot::Sender<()>,
}

pub struct SessionManager {
    sessions: dashmap::DashMap<String, SessionHandle>,
}
```

流程：
1. `create_session`：从 DB 读取 Connection + Credential → 根据协议创建客户端 → 启动 Tokio 任务转发 stdout/stderr 到 `window.emit("session-data", ..)`。
2. `send_input`：通过 `tx_stdin` 写入远端。
3. `close_session`：发送关闭信号、清理 `sessions` 表、推送 `session-closed` 事件。
4. 错误通过 `Result` 冒泡，UI 获得可序列化错误信息。

### 6.3 存储与迁移

- SQLite 表：`connections` / `groups` / `credentials` / `settings` / `sync_state`。
- 所有表含 `created_at`, `updated_at`, `version` 字段，为同步与冲突准备。
- 迁移方案：简单 `migrations/0001_init.sql` → CLI 启动时读取 `schema_version` 表执行补全。

### 6.4 凭据与安全

1. **Keychain 优先**：macOS Keychain、Windows Credential Manager、Linux Secret Service。
2. **主密码 fallback**：PBKDF2/Argon2 → AES-GCM，密钥派生参数存入 DB。
3. **日志脱敏**：Rust `tracing` + 自定义 `Sensitive<T>` 类型，禁止打印真实值。
4. **最小权限**：SFTP/FTP 操作时限制初始目录、可选 chroot。

---

## 7. 多端同步（本地优先策略）

### 7.1 核心理念

- **完全本地存储**：所有连接、凭据、会话设置都保存在 SQLite + Keychain 中。
- **密文同步**：真正离开本机的只有一个加密 `conf`（包含连接/分组/凭据元信息/设置/待办变更）。
- **用户自控**：用户选择把 `conf` 放到 Google Drive / Dropbox / iCloud / Git 私库 / U 盘等地方，我们不托管任何服务器。

### 7.2 `conf` 结构

- 容器：`tar.gz`（或 zip）+ `version.json` 标记 schema 版本。
- 内容：
  - `connections.json`, `groups.json`, `credentials_meta.json`, `settings.json` 等；
  - `pending_changes.json` 用于记录还未同步的变更；
- 加密：
  - 使用主密码或系统 Keychain 派生密钥（PBKDF2/Argon2 → AES-GCM）；
  - 文件头包含 `salt`, `iv`, `version`，方便未来升级算法。
  - 当前实现：Rust 端采用 `tar + gzip + AES-256-GCM`，本地适配器将 JSON + manifest 打包后再加密；Keychain 支持将在后续迭代加入。

> 详细字段与流程参考 `docs/conf_spec.md`。

### 7.3 存储适配器

- `LocalFileAdapter`：默认，导出到任意路径/自动轮换版本。
- （已实现）`LocalFileAdapter`：当前版本默认写入用户指定路径，生成占位 conf（后续接入 tar + AES）。
- `CloudFolderAdapter`：用户指向一个同步盘目录，我们只负责读写该目录下的 `tauri-terminal.conf.enc`。
- `WebDAV/HTTP Adapter`（可选）：若用户提供目标地址和凭证，就以 PUT/GET 方式上传/下载密文。
- 适配器接口：

```ts
interface SyncAdapter {
  id: string;
  label: string;
  push(payload: ArrayBuffer): Promise<void>;
  pull(): Promise<ArrayBuffer | null>;
}
```

### 7.4 操作流

1. **导出**：用户点击“生成加密 conf”，输入主密码 → Rust `SyncService` 汇总数据 → 返回密文 → 前端通过适配器写出。
2. **导入**：选择 conf 文件 → 输入主密码 → 解密校验版本 → 写入 SQLite/Keychain，生成备份点。
3. **自动同步（可选）**：用户指定一个适配器并打开“自动轮询”；应用每隔 N 分钟 `pull` 一次并提示有新版本。
4. **冲突处理**：如果 conf 的 `updatedAt` 落后于本地，可提示“覆盖/合并/取消”，默认保留本地并生成副本。

> 实际 UI：Mantine AppShell 的 Sync 概览卡提供“导入/导出”按钮。导入/导出均会弹出 Modal（`ImportConfModal` / `ExportConfModal`），让用户输入主密码；若选择 Keychain，目前会提示“即将上线”。前端将参数传给 Tauri `export_encrypted_conf` / `import_encrypted_conf` 命令，由 `SyncService` 完成 tar + AES 流程。

### 7.5 安全提示

- conf 文件永远是密文，可直接放到任何公共存储；真正密钥只在本机存在。
- 建议用户使用长主密码；若只依赖系统 Keychain，则 conf 只能在同平台导入（因为密钥留在本地）。
- 导出时生成校验指纹（SHA-256）便于验证文件完整性。
- UI 中提供“忘记主密码就无法解密”的风险提示。

---

## 8. 安全基线

- **凭据保护**：默认不将密码写入日志；Keychain/主密码加密。
- **SSH 私钥**：支持“引用外部文件 + SSH Agent”与“导入后加密保存”两种模式。
- **权限确认**：删除连接/分组/凭据、覆盖同步等危险操作必须确认。
- **诊断日志**：提供脱敏日志导出功能。
- **脚本安全**：未来的自动脚本默认在沙盒模式运行或要求显式授权。

---

## 9. 设计模式与工程实践

| 区域 | 设计模式 / 思路 | 说明 |
| ---- | ---------------- | ---- |
| TS 服务 | Repository + Service | Repository 调 Tauri 命令，Service 组合业务规则。 |
| Rust | Repository + Service + Adapter | Adapter 抽象 SSH/FTP 客户端，方便替换底层实现。 |
| 同步 | Adapter + Strategy | 适配器封装不同存储目标；策略控制导入/覆盖/合并。 |
| 事件 | Observer | Rust 向前端 emit 事件，React 侧订阅。 |
| 错误处理 | Either/Result | Rust 使用 `Result<T, E>` + `thiserror`，TS 使用 `ResultLike` 枚举错误码。 |
| UI | MVVM + Hooks | Hooks（`useConnections`、`useSessions`）即 ViewModel，AppShell/组件负责 View。 |

---

## 10. 开发模式

1. **Git 流程**：`main`（稳定） / `develop`（日常） / `feature/*`（需求） / `hotfix/*`（紧急）。
2. **任务跟踪**：根目录 `TODO.md` 实时更新，配合 issue/项目看板。
3. **代码评审**：重点关注协议安全、同步冲突、UI 状态一致性、性能（多会话并发）。
4. **测试策略**：
   - TS：Hooks/Service 单测 + React Testing Library 做主要 UI 行为测试。
   - Rust：Repository/Service 单元测试 + 协议客户端集成测试（可使用 `sshpass`/mock server）。
   - 端到端：Playwright 驱动基础流程（创建连接→打开 session→执行命令）。
5. **CI/CD**：pnpm/npm lint + test → Rust test → `tauri build`（macOS dmg、Windows NSIS、Linux AppImage）。

---

## 11. 代码规范

### 11.1 TypeScript

- 启用 `strict`、`noImplicitAny`、`noUnusedLocals`。
- 组件命名：`PascalCase`，Hooks：`useXxx`，类型：`PascalCase`，实参/变量：`camelCase`。
- ESLint：使用 `@typescript-eslint`、`eslint-plugin-react-hooks`、`eslint-plugin-jsx-a11y`；提交前运行 `npm run lint`。
- Prettier：统一格式，搭配 `lint-staged` 在 pre-commit 自动修复。

### 11.2 Rust

- `rustfmt` + `clippy --all-targets -- -D warnings`。
- 错误类型集中到 `error.rs`，统一转换为字符串/结构体返回给前端。
- 禁止在 `cmd` 层写复杂逻辑，保持薄层转发。

### 11.3 Commit 规范

- 采用 Conventional Commits，例如：
  - `feat: add acrylic terminal surface layout`
  - `fix: handle session close event`
  - `docs: update architecture with mantine stack`

---

## 12. 现状与下一步

- ✅ 已完成：Tauri + React + Mantine 工程初始化，AppShell + Acrylic Terminal 示例 UI。
- ☐ 待办：Mantine 主题细节、ESLint/Prettier 配置、状态管理（Zustand）、xterm.js 集成、Rust 模块脚手架、同步适配层。
- 后续优先级：
  1. 搭建连接/会话 Store，与 Tauri 命令衔接。
  2. Rust 端 `ConnectionService` + SQLite Schema。
  3. Tauri ↔ React 事件管道（session-data、sync-progress）。
  4. 多端同步 MVP（加密 conf 导入导出 + 存储适配器 API）。

本文档会随着 TODO 完成持续更新，可作为新成员快速上手的入口资料。
