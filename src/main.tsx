import { ColorSchemeScript } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
