import { create } from "zustand";

import type { SessionSummary } from "../shared/types";

interface SessionsState {
  items: SessionSummary[];
  setSessions: (items: SessionSummary[]) => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  items: [],
  setSessions: (items) => set({ items }),
}));
