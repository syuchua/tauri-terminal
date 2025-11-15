import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import type { MantineColorSchemeManager } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { theme } from "../theme";

const colorSchemeManager: MantineColorSchemeManager = localStorageColorSchemeManager({
  key: "tauri-terminal-color-scheme",
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <MantineProvider theme={theme} defaultColorScheme="dark" colorSchemeManager={colorSchemeManager}>
    <QueryClientProvider client={queryClient}>
      <ModalsProvider>
        <Notifications position="top-right" limit={3} />
        {children}
      </ModalsProvider>
    </QueryClientProvider>
  </MantineProvider>
);
