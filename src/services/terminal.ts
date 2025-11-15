import { invoke } from "@tauri-apps/api/core";

export async function runLocalCommand(command: string, connectionId?: string): Promise<string> {
  const result = await invoke<string>("run_local_command", {
    payload: { command, connectionId },
  });
  return result;
}
