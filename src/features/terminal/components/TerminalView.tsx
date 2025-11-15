import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

import "xterm/css/xterm.css";

interface TerminalViewProps {
  lines: string[];
}

export const TerminalView = ({ lines }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 14,
      theme: {
        background: "#05060a",
        foreground: "#f5f7fc",
      },
      allowTransparency: true,
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    if (containerRef.current) {
      terminal.open(containerRef.current);
      fitAddon.fit();
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.clear();
    lines.forEach((line) => terminalRef.current!.writeln(line));
    fitAddonRef.current?.fit();
  }, [lines]);

  return <div ref={containerRef} style={{ width: "100%", height: 360 }} />;
};
