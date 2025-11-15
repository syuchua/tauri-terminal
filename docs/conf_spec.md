# tauri-terminal 加密 conf 规范草案

## 1. 背景

- 应用拒绝托管用户的 SSH 凭据与配置，所有敏感信息都应保存在本地。
- 用户需要在多设备之间同步这些配置，因此提供“导入/导出”能力，将数据封装成加密 conf 文件，由用户自行存储（Google Drive/Dropbox/WebDAV/NAS 等）。
- conf 必须具有：可验证完整性、可向前兼容（版本号）、支持选择性包含内容（如剔除历史会话）。

## 2. 文件结构

```
┌─ tauri-terminal.conf.enc (最终加密文件)
└─ (解密后)
   ├─ manifest.json          # 元数据（版本、时间戳、加密参数）
   ├─ connections.json       # 连接 & 分组
   ├─ credentials.json       # 凭据元信息（若包含密文，在此）
   ├─ app-settings.json      # 主题/语言/快捷键等
   ├─ pending-changes.json   # SyncChange 队列（离线增量）
   └─ checksums.json         # 每个文件的 SHA-256，用于快速校验
```

- 整体容器使用 `tar + gzip`（或 zip），推荐 tar.gz，方便在 Rust 中用 `tar` crate 处理。
- `manifest.json` 字段示例：

```json
{
  "version": 1,
  "createdAt": "2025-11-15T13:50:00Z",
  "appVersion": "0.1.0",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "salt": "base64-encoded-salt",
    "iv": "base64-encoded-iv",
    "kdf": {
      "name": "Argon2id",
      "iterations": 3,
      "memoryKb": 65536,
      "parallelism": 2
    }
  }
}
```

## 3. 加密流程

1. **密钥来源**：
   - 默认使用“主密码”（用户输入），通过 Argon2id 派生 256-bit key。
   - 如果系统 Keychain 可访问，可选择“Keychain 记住密钥”，conf 仅能在同平台解密。
2. **对称加密**：
   - 使用 AES-256-GCM，对 `tar.gz` 原文进行加密。
   - 输出：`salt (16B) + iv (12B) + ciphertext + tag (16B)`，整体再 base64 编码写入 `.enc` 文件，或直接二进制存储。
3. **完整性**：
   - AES-GCM 自带完整性；额外在 `checksums.json` 中记录每个文件的 SHA-256，方便用户验证。
4. **版本兼容**：
   - `manifest.version` 自增；解析时依据版本决定字段/迁移。

## 4. 解锁流程

1. 用户在 UI 触发“导入 conf”。
2. 读取 `.enc` → 解析头部（salt/iv）→ 根据主密码/Keychain 恢复密钥。
3. 解密得到 `tar.gz` → 解包 → 验证 `checksums.json`。
4. 解析 JSON 并执行写入：
   - Connections/Groups → SQLite 表。
   - Credentials → 若启用 Keychain，则写入 Keychain，`credentials.json` 只需要引用；若用户选择同步密文，则直接保存 AES+主密码加密结果。
5. 更新 `pending_changes`：导入前先备份旧数据；导入后清空或合并变更队列。

## 5. 导出流程

1. 从 SQLite 读取连接/分组/凭据元数据/设置/待同步变更。
2. 生成上述 JSON 文件。
3. 计算 SHA-256 写入 `checksums.json`。
4. 打包为 tar.gz。
5. 根据用户选择的主密码/Keychain 生成密钥，执行 AES-GCM 加密。
6. 输出 `.enc` 文件并提示校验摘要（SHA-256 或 Base64 指纹）。

## 6. UI & 交互要点

- 导入时：
  - 先校验文件格式 → 输入主密码 → 提示“此操作会覆盖当前配置，已自动备份到 `<timestamp>.bak`”。
  - 解密失败需要明确提示（区分“密码错误”和“文件损坏”）。
- 导出时：
  - 可选择“包含凭据密文”或“仅元信息”（若仅元信息，则需要用户在其他设备重新输入密码/密钥）。
  - 提供“复制校验指纹”按钮。
- 自动同步：
  - 指向某个目录后，应用定时检测 `.enc` 是否更新；若检测到新文件且用户允许，弹窗提示导入。

## 7. 后端实现建议

- 模块：`src-tauri/src/domain/services/sync_service.rs`
  - `fn export_conf(target: &Path, strategy: ExportStrategy) -> Result<()>`
  - `fn import_conf(source: &Path, unlock: UnlockStrategy) -> Result<()>`
  - 内部依赖 `ConnectionService`, `SettingsService`, `KeychainAdapter`, `StorageAdapters`。
- `infra/storage`：定义 `SyncAdapter` trait，LocalFile/WebDAV 等实现 `push/pull`。
- `infra/crypto`（后续添加）：封装 AES-GCM + Argon2 逻辑，避免散布在业务代码。

## 8. 测试策略

- 单元测试：
  - 加密+解密流程的 round-trip。
  - Manifest 版本升级解析。
  - checksum 校验。
- 集成测试：
  - 使用临时目录模拟导入/导出。
  - 与 Keychain mock（或 feature flag）结合，确保在无 Keychain 环境下仍可运行。

该规范会随着实现推进不断修订，落地后需要在文档中更新版本号及字段说明。
