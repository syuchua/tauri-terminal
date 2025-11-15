import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

export async function invokeOrFallback<T>(command: string, fallback: () => Promise<T>): Promise<T> {
  if (isTauri) {
    return invoke<T>(command);
  }
  return fallback();
}
