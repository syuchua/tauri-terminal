import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

import "xterm/css/xterm.css";

export type TerminalViewHandle = {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
};

interface TerminalViewProps {
  onData?: (data: string) => void;
  onReadyChange?: (ready: boolean) => void;
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  ({ onData, onReadyChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const dataHandlerRef = useRef<((data: string) => void) | undefined>(undefined);
    const readyHandlerRef = useRef<((ready: boolean) => void) | undefined>(undefined);

    useEffect(() => {
      dataHandlerRef.current = onData ?? undefined;
    }, [onData]);

    useEffect(() => {
      readyHandlerRef.current = onReadyChange ?? undefined;
    }, [onReadyChange]);

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
        terminal.focus();
      }

      const disposeData = terminal.onData((chunk) => {
        dataHandlerRef.current?.(chunk);
      });

      const handleResize = () => fitAddon.fit();
      window.addEventListener("resize", handleResize);
      readyHandlerRef.current?.(true);

      return () => {
        readyHandlerRef.current?.(false);
        window.removeEventListener("resize", handleResize);
        disposeData.dispose();
        terminal.dispose();
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => {
          terminalRef.current?.write(data);
        },
        clear: () => {
          if (!terminalRef.current) return;
          terminalRef.current.reset();
          terminalRef.current.clear();
          terminalRef.current.focus();
          fitAddonRef.current?.fit();
        },
        focus: () => {
          terminalRef.current?.focus();
        },
      }),
      [],
    );

    return <div ref={containerRef} style={{ width: "100%", height: 360 }} />;
  },
);

TerminalView.displayName = "TerminalView";
