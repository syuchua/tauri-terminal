import { invokeOrFallback } from "./tauriBridge";
import type { SessionSummary } from "../shared/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sessionFixtures: SessionSummary[] = [
  {
    id: "session-prod-api",
    connectionId: "conn-prod-api",
    title: "prod-api-01",
    latencyMs: 42,
    statusLabel: "Live",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-payments-edge",
    connectionId: "conn-payments-edge",
    title: "payments-edge",
    latencyMs: 51,
    statusLabel: "Deploying",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-analytics",
    connectionId: "conn-analytics",
    title: "analytics-pipeline",
    latencyMs: 68,
    statusLabel: "Idle",
    updatedAt: new Date().toISOString(),
  },
];

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  return invokeOrFallback("list_session_summaries", async () => {
    await delay(150);
    return sessionFixtures;
  });
}
