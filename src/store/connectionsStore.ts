import { create } from "zustand";

import type { Connection } from "../shared/types";

type NewConnectionInput = {
  name: string;
  host: string;
  username: string;
  protocol: Connection["protocol"];
  port?: number;
  authType?: Connection["authType"];
};

interface ConnectionsState {
  items: Connection[];
  selectedId?: string;
  setConnections: (items: Connection[]) => void;
  selectConnection: (connectionId: string) => void;
  addLocalConnection: (input: NewConnectionInput) => Connection;
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  items: [],
  selectedId: undefined,
  setConnections: (items) =>
    set((state) => ({
      items,
      selectedId: state.selectedId ?? items[0]?.id,
    })),
  selectConnection: (selectedId) => set({ selectedId }),
  addLocalConnection: (input) => {
    const connection: Connection = {
      id: generateConnectionId(),
      name: input.name,
      protocol: input.protocol,
      host: input.host,
      port: input.port ?? (input.protocol === "ftp" ? 21 : 22),
      username: input.username,
      authType: input.authType ?? "password",
      tags: [],
      favorite: false,
      status: "idle",
    };

    set((state) => ({
      items: [connection, ...state.items],
      selectedId: connection.id,
    }));

    return connection;
  },
}));

const generateConnectionId = () => `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
