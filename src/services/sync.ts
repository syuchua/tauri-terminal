import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { OpenDialogOptions, SaveDialogOptions } from "@tauri-apps/plugin-dialog";

import { isTauri } from "./tauriBridge";
import type { ExportConfOptions } from "../features/sync/components/ExportConfModal";
import type { ImportConfOptions } from "../features/sync/components/ImportConfModal";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const exportFilters = [{ name: "Encrypted conf", extensions: ["enc"] }];
const saveDialog = save as (options?: SaveDialogOptions) => Promise<string | null>;
const openDialog = open as (options?: OpenDialogOptions) => Promise<string | string[] | null>;

export async function exportEncryptedConf(options: ExportConfOptions): Promise<void> {
  if (!isTauri) {
    await delay(200);
    notifications.show({
      color: "yellow",
      title: "仅示范",
      message: "需要在 Tauri 桌面端执行导出动作",
    });
    return;
  }

  const fileName = `tauri-terminal-${new Date().toISOString().replace(/[:.]/g, "-")}.conf.enc`;
  const targetPath: string | null = await saveDialog({ defaultPath: fileName, filters: exportFilters });
  if (!targetPath) {
    throw new Error("用户取消");
  }

  await invoke("export_encrypted_conf", {
    targetPath,
    includeCredentials: options.includeCredentials,
    useKeychain: options.useKeychain,
    masterPassword: options.masterPassword ?? null,
  });
}

export async function importEncryptedConf(options: ImportConfOptions): Promise<void> {
  if (!isTauri) {
    await delay(200);
    notifications.show({
      color: "yellow",
      title: "仅示范",
      message: "需要在 Tauri 桌面端执行导入动作",
    });
    return;
  }

  const selected: string | string[] | null = await openDialog({ multiple: false, filters: exportFilters });
  if (!selected) {
    throw new Error("用户取消");
  }

  const sourcePath: string | undefined = Array.isArray(selected) ? selected[0] : selected;
  if (!sourcePath) {
    throw new Error("未选择文件");
  }

  await invoke("import_encrypted_conf", {
    sourcePath,
    useKeychain: options.useKeychain,
    masterPassword: options.useKeychain ? null : options.masterPassword ?? "",
  });
}
