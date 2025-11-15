import { createTheme, rem } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";

const plasma: MantineColorsTuple = [
  "#f4f1ff",
  "#e1dbff",
  "#c4b7ff",
  "#a58fff",
  "#8b6cff",
  "#7b56ff",
  "#6e4cf5",
  "#5a39d1",
  "#4c32ad",
  "#3f2c8f",
];

export const theme = createTheme({
  fontFamily: "'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily: "'Space Grotesk', 'Inter', 'Segoe UI', system-ui, sans-serif",
    sizes: {
      h1: { fontSize: rem(30) },
      h2: { fontSize: rem(26) },
      h3: { fontSize: rem(22) },
    },
  },
  primaryColor: "plasma",
  colors: {
    plasma,
  },
  defaultRadius: "md",
  shadows: {
    xl: "0 40px 70px rgba(15, 15, 15, 0.45)",
  },
});
