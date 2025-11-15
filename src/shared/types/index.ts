export type Protocol = "ssh" | "sftp" | "ftp";

export type AuthType = "password" | "privateKey" | "agent";

export type ConnectionHealth = "healthy" | "deploying" | "connected" | "idle";

export interface Connection {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  groupId?: string;
  groupName?: string;
  tags: string[];
  favorite: boolean;
  status: ConnectionHealth;
  lastConnectedAt?: string;
}

export interface SessionSummary {
  id: string;
  connectionId: string;
  title: string;
  latencyMs: number;
  statusLabel: string;
  updatedAt: string;
}

export interface NewConnectionPayload {
  name: string;
  host: string;
  username: string;
  protocol: Protocol;
  port: number;
}
