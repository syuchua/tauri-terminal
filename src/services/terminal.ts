import { invoke } from "@tauri-apps/api/core";

import { isTauri } from "./tauriBridge";

export async function runLocalCommand(command: string, connectionId?: string): Promise<string> {
  if (!isTauri) {
    throw new Error("当前运行在浏览器预览环境，无法调用 Tauri 命令");
  }

  const result = await invoke<string>("run_local_command", {
    payload: { command, connectionId },
  });
  return result;
}
