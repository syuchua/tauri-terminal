import { invoke } from "@tauri-apps/api/core";

import { invokeOrFallback, isTauri } from "./tauriBridge";
import type { Connection, NewConnectionPayload, UpdateConnectionPayload } from "../shared/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectionFixtures: Connection[] = [
  {
    id: "conn-prod-api",
    name: "Prod API",
    protocol: "ssh",
    host: "10.21.20.8",
    port: 22,
    username: "deploy",
    authType: "privateKey",
    groupId: "grp-production",
    groupName: "Production",
    tags: ["critical", "zero-downtime"],
    favorite: true,
    status: "healthy",
    lastConnectedAt: new Date().toISOString(),
  },
  {
    id: "conn-payments-edge",
    name: "Payments Edge",
    protocol: "ssh",
    host: "10.21.32.4",
    port: 22,
    username: "infra",
    authType: "privateKey",
    groupId: "grp-production",
    groupName: "Production",
    tags: ["payments"],
    favorite: false,
    status: "deploying",
  },
  {
    id: "conn-analytics",
    name: "Analytics",
    protocol: "ssh",
    host: "10.21.44.12",
    port: 22,
    username: "analytics",
    authType: "password",
    groupId: "grp-staging",
    groupName: "Staging",
    tags: ["etl"],
    favorite: false,
    status: "idle",
  },
  {
    id: "conn-qa-gateway",
    name: "QA Gateway",
    protocol: "ssh",
    host: "10.21.77.3",
    port: 22,
    username: "qa",
    authType: "password",
    groupId: "grp-qa",
    groupName: "QA",
    tags: [],
    favorite: false,
    status: "connected",
  },
];

export async function listConnections(): Promise<Connection[]> {
  return invokeOrFallback("list_connections", async () => {
    await delay(120);
    return connectionFixtures;
  });
}

export async function createConnection(payload: NewConnectionPayload): Promise<Connection> {
  if (isTauri) {
    return invoke<Connection>("create_connection", { payload });
  }

  const fallback: Connection = {
    id: `conn-local-${Date.now()}`,
    name: payload.name,
    host: payload.host,
    port: payload.port,
    protocol: payload.protocol,
    username: payload.username,
    authType: "password",
    tags: [],
    favorite: false,
    status: "idle",
  };
  connectionFixtures.unshift(fallback);
  return fallback;
}

export async function updateConnection(payload: UpdateConnectionPayload): Promise<Connection> {
  if (isTauri) {
    return invoke<Connection>("update_connection", { payload });
  }
  const idx = connectionFixtures.findIndex((item) => item.id === payload.id);
  if (idx >= 0) {
    connectionFixtures[idx] = { ...connectionFixtures[idx], ...payload };
    return connectionFixtures[idx];
  }
  throw new Error("连接不存在（mock 环境）");
}

export async function deleteConnection(id: string): Promise<void> {
  if (isTauri) {
    await invoke("delete_connection", { id });
    return;
  }
  const idx = connectionFixtures.findIndex((item) => item.id === id);
  if (idx >= 0) {
    connectionFixtures.splice(idx, 1);
  }
}
