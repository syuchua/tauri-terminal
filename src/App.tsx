import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowUpRight,
  IconCloudUpload,
  IconDots,
  IconMoon,
  IconPlugConnected,
  IconPlus,
  IconSearch,
  IconServer,
  IconSun,
  IconTerminal2,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { openConnectionFormModal } from "./features/connections/components/ConnectionFormModal";
import { useConnectionsQuery } from "./features/connections/hooks/useConnectionsQuery";
import { useSessionsQuery } from "./features/sessions/hooks/useSessionsQuery";
import { openExportConfModal } from "./features/sync/components/ExportConfModal";
import { openImportConfModal } from "./features/sync/components/ImportConfModal";
import { TerminalView } from "./features/terminal/components/TerminalView";
import { createConnection } from "./services/connections";
import { exportEncryptedConf, importEncryptedConf } from "./services/sync";
import { isTauri } from "./services/tauriBridge";
import { runLocalCommand } from "./services/terminal";
import type { Connection } from "./shared/types";
import { useConnectionsStore } from "./store/connectionsStore";
import { useSessionsStore } from "./store/sessionsStore";
import "./App.css";

const sessionLog = `idriver@nebula ➜ ssh prod-api-01
Authorized keys loaded from agent ✓
Connecting to 10.21.20.8:22 ... connected
┌─ PROD / api 1.24.3
│  uptime        18 days 04:12:47
│  load average  0.83  0.92  0.78
│  cpu           47%   mem 63%
└──────────────────────────────────
$ pm2 ls
┌────┬──────────────────┬───────┬──────┬────────┬────────┬────────┐
│ id │ name             │ mode  │ ↺    │ status │ cpu    │ mem    │
├────┼──────────────────┼───────┼──────┼────────┼────────┼────────┤
│ 12 │ api-gateway      │ fork  │ 0    │ online │ 52%    │ 820 MB │
│ 14 │ websocket-entry  │ fork  │ 1    │ online │ 38%    │ 612 MB │
└────┴──────────────────┴───────┴──────┴────────┴────────┴────────┘
`;

type ConnectionCardProps = {
  connection: Connection;
  isActive: boolean;
  onSelect: () => void;
};

const ConnectionCard = ({ connection, isActive, onSelect }: ConnectionCardProps) => (
  <Card
    withBorder
    padding="md"
    radius="lg"
    className="connection-card"
    data-active={isActive}
    onClick={onSelect}
  >
    <Group justify="space-between" gap="xs">
      <Stack gap={2}>
        <Text fw={600}>{connection.name}</Text>
        <Text size="xs" c="dimmed">
          {connection.host} • {connection.groupName ?? "Ungrouped"}
        </Text>
      </Stack>
      <Badge variant="light" size="sm" color={connection.status === "healthy" ? "teal" : "grape"}>
        {connection.status}
      </Badge>
    </Group>
  </Card>
);

const ColorSchemeToggle = () => {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("dark", { getInitialValueInEffect: true });

  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      radius="md"
      aria-label="Toggle theme"
      onClick={() => setColorScheme(computed === "light" ? "dark" : "light")}
    >
      {computed === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
    </ActionIcon>
  );
};

function App() {
  const connectionsQuery = useConnectionsQuery();
  useSessionsQuery();

  const connections = useConnectionsStore((state) => state.items);
  const selectedId = useConnectionsStore((state) => state.selectedId);
  const selectConnection = useConnectionsStore((state) => state.selectConnection);
  const sessions = useSessionsStore((state) => state.items);
  const addLocalConnection = useConnectionsStore((state) => state.addLocalConnection);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>(() => sessionLog.split("\n"));
  const [commandInput, setCommandInput] = useState("");

  const activeConnection = useMemo(() => {
    if (!connections.length) {
      return undefined;
    }

    const match = connections.find((connection) => connection.id === selectedId);
    return match ?? connections[0];
  }, [connections, selectedId]);

  useEffect(() => {
    if (!activeConnection) {
      setTerminalLines(sessionLog.split("\n"));
      return;
    }

    setTerminalLines([
      `ssh ${activeConnection.username}@${activeConnection.host}`,
      `Connected to ${activeConnection.name} (${activeConnection.protocol.toUpperCase()}):${activeConnection.port}`,
      `$ uptime`,
      `22:41:03 up 3 days, load average: 0.24, 0.35, 0.43`,
    ]);
  }, [activeConnection]);

  const handleExportConf = () => {
    openExportConfModal(async (options) => {
      try {
        setIsExporting(true);
        await exportEncryptedConf(options);
        setSyncMessage(`在 ${new Date().toLocaleTimeString()} 导出配置`);
        notifications.show({
          color: "teal",
          title: "导出成功",
          message: "加密 conf 已生成，可保存至任意位置",
        });
      } catch (error) {
        if ((error as Error).message === "用户取消") {
          return;
        }
        notifications.show({
          color: "red",
          title: "导出失败",
          message: (error as Error).message,
        });
      } finally {
        setIsExporting(false);
      }
    });
  };

  const handleImportConf = () => {
    openImportConfModal(async (options) => {
      try {
        setIsImporting(true);
        await importEncryptedConf(options);
        setSyncMessage(`在 ${new Date().toLocaleTimeString()} 导入配置`);
        notifications.show({
          color: "plasma",
          title: "导入成功",
          message: "已读取加密 conf，等待同步",
        });
      } catch (error) {
        if ((error as Error).message === "用户取消") {
          return;
        }
        notifications.show({
          color: "red",
          title: "导入失败",
          message: (error as Error).message,
        });
      } finally {
        setIsImporting(false);
      }
    });
  };

  const handleAddConnection = () => {
    openConnectionFormModal(async (payload) => {
      try {
        const connection: Connection = await createConnection(payload);
        if (isTauri) {
          await connectionsQuery.refetch();
        } else {
          addLocalConnection(payload);
        }
        notifications.show({
          color: "plasma",
          title: "连接已创建",
          message: `${connection.name} (${connection.host}) 已添加`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notifications.show({
          color: "red",
          title: "创建连接失败",
          message,
        });
      }
    });
  };

  const handleSendCommand = async () => {
    const input = commandInput.trim();
    if (!input) return;
    setCommandInput("");
    setTerminalLines((lines) => [...lines, `$ ${input}`]);

    try {
      const result = await runLocalCommand(input, activeConnection?.id);
      setTerminalLines((lines) => [...lines, result]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTerminalLines((lines) => [...lines, `命令失败: ${message}`]);
    }
  };

  return (
    <AppShell
      padding="lg"
      header={{ height: 72 }}
      navbar={{ width: 300, breakpoint: "sm" }}
      styles={{
        main: {
          background: "transparent",
        },
        navbar: {
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "transparent",
          backdropFilter: "blur(24px)",
        },
        header: {
          background: "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(18px)",
        },
      }}
    >
      <AppShell.Header>
        <Group justify="space-between" px="lg" h="100%">
          <Group gap="md">
            <ActionIcon size={42} radius="lg" variant="light" color="plasma">
              <IconTerminal2 size={20} />
            </ActionIcon>
            <div>
              <Text fw={600}>tauri-terminal</Text>
              <Text size="sm" c="dimmed">
                Unified tunnels, sessions, and sync
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Button variant="light" color="gray" leftSection={<IconSearch size={16} />}>
              Quick search
            </Button>
            <Button leftSection={<IconPlus size={16} />} radius="lg">
              New session
            </Button>
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="lg">
        <ScrollArea h="100%" type="always">
          <Stack gap="lg">
            <div>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                connections
              </Text>
              <TextInput
                mt="sm"
                size="md"
                radius="lg"
                placeholder="Search..."
                leftSection={<IconSearch size={16} stroke={1.5} />}
              />
              <Button mt="sm" fullWidth variant="light" leftSection={<IconPlus size={16} />} onClick={handleAddConnection}>
                新增连接
              </Button>
            </div>
            <Stack gap="sm">
              {connections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  isActive={connection.id === activeConnection?.id}
                  onSelect={() => selectConnection(connection.id)}
                />
              ))}
            </Stack>
            <Button variant="gradient" gradient={{ from: "plasma", to: "teal" }} leftSection={<IconPlugConnected size={16} />} onClick={handleImportConf}>
              导入 conf
            </Button>
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="lg">
          <Box>
            <Group justify="space-between" mb="sm">
              <div>
                <Text c="dimmed" size="sm">
                  Currently linked to
                </Text>
                <Group gap="xs">
                  <Title order={2}>{activeConnection?.name ?? "Select a connection"}</Title>
                  {activeConnection && (
                    <Badge size="sm" color="teal" variant="light">
                      latency 42ms
                    </Badge>
                  )}
                </Group>
              </div>
              <Group gap="xs">
                <Button variant="light" color="gray">
                  <Group gap={6}>
                    <IconCloudUpload size={16} />
                    <Text size="sm">Push dotfiles</Text>
                  </Group>
                </Button>
                <ActionIcon variant="subtle">
                  <IconDots size={18} />
                </ActionIcon>
              </Group>
            </Group>
            <Box className="terminal-surface">
              <div className="terminal-toolbar">
                <div className="traffic-lights">
                  <span />
                  <span />
                  <span />
                </div>
                <Text size="xs">
                  Session #1 — {activeConnection?.name ?? "waiting"}
                </Text>
                <Group gap="xs">
                  <Badge size="xs" variant="light" color="teal">
                    Live tail
                  </Badge>
                  <Badge size="xs" variant="light" color="plasma">
                    SFTP mounted
                  </Badge>
                </Group>
              </div>
              <TerminalView lines={terminalLines} />
              <Group mt="md" gap="sm">
                <TextInput
                  flex={1}
                  placeholder="输入命令，例如 ls -al"
                  value={commandInput}
                  onChange={(event) => setCommandInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendCommand();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    void handleSendCommand();
                  }}
                >
                  执行
                </Button>
              </Group>
            </Box>
          </Box>

          <Flex gap="lg" direction={{ base: "column", md: "row" }}>
            <Card withBorder radius="lg" className="status-card" style={{ flex: 1 }}>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Active sessions</Text>
                <Badge variant="light" color="plasma">
                  {sessions.length}
                </Badge>
              </Group>
              <Stack gap="sm">
                {sessions.map((session) => (
                  <Group key={session.id} justify="space-between">
                    <div>
                      <Text fw={500}>{session.title}</Text>
                      <Text size="xs" c="dimmed">
                        {session.statusLabel}
                      </Text>
                    </div>
                    <Badge variant="dot" color="teal">
                      {session.latencyMs} ms
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Card>

            <Card withBorder radius="lg" className="status-card" style={{ flex: 1 }}>
              <Group justify="space-between" mb="md">
                <Text fw={600}>Sync overview</Text>
                <IconArrowUpRight size={18} />
              </Group>
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge size="xs" color="teal" variant="light">
                    encrypted
                  </Badge>
                  <Badge size="xs" color="plasma" variant="light">
                    auto sync
                  </Badge>
                </Group>
                <Text size="sm">{syncMessage ?? "尚未执行导入/导出操作"}</Text>
                <Group gap="xs" mt="sm">
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<IconServer size={16} stroke={1.5} />}
                    loading={isExporting}
                    onClick={() => {
                      void handleExportConf();
                    }}
                  >
                    导出加密 conf
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    color="plasma"
                    loading={isImporting}
                    onClick={handleImportConf}
                  >
                    导入 conf
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Flex>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
