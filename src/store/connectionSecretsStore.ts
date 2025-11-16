import { create } from "zustand";

type SecretsState = {
  secrets: Record<string, string>;
  setSecret: (connectionId: string, password: string) => void;
  clearSecret: (connectionId: string) => void;
};

export const useConnectionSecretsStore = create<SecretsState>((set) => ({
  secrets: {},
  setSecret: (connectionId, password) =>
    set((state) => ({
      secrets: {
        ...state.secrets,
        [connectionId]: password,
      },
    })),
  clearSecret: (connectionId) =>
    set((state) => {
      const next = { ...state.secrets };
      delete next[connectionId];
      return { secrets: next };
    }),
}));
