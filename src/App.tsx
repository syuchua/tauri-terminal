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
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconArrowUpRight,
  IconCloudUpload,
  IconDots,
  IconEdit,
  IconMoon,
  IconPlugConnected,
  IconPlus,
  IconSearch,
  IconServer,
  IconSun,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";

import { openConnectionFormModal } from "./features/connections/components/ConnectionFormModal";
import { useConnectionsQuery } from "./features/connections/hooks/useConnectionsQuery";
import { openConnectionPasswordModal } from "./features/sessions/components/ConnectionPasswordModal";
import { useSessionsQuery } from "./features/sessions/hooks/useSessionsQuery";
import { openExportConfModal } from "./features/sync/components/ExportConfModal";
import { openImportConfModal } from "./features/sync/components/ImportConfModal";
import { TerminalView } from "./features/terminal/components/TerminalView";
import { createConnection, deleteConnection, updateConnection } from "./services/connections";
import { exportEncryptedConf, importEncryptedConf } from "./services/sync";
import { isTauri } from "./services/tauriBridge";
import type { Connection } from "./shared/types";
import { useConnectionSecretsStore } from "./store/connectionSecretsStore";
import { useConnectionsStore } from "./store/connectionsStore";
import { useSessionsStore } from "./store/sessionsStore";
import "./App.css";

const fallbackLines = [
  "tauri-terminal 当前运行在浏览器预览模式。",
  "请执行 `npm run tauri dev` 或运行打包应用以获得真实会话。",
];

type ConnectionCardProps = {
  connection: Connection;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const ConnectionCard = ({ connection, isActive, onSelect, onEdit, onDelete }: ConnectionCardProps) => (
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
      <Group gap="xs">
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <IconEdit size={14} />
        </ActionIcon>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
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
  const connectionSecrets = useConnectionSecretsStore((state) => state.secrets);
  const setConnectionSecret = useConnectionSecretsStore((state) => state.setSecret);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>(() =>
    isTauri ? [] : fallbackLines,
  );
  const [commandInput, setCommandInput] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionRef = useRef<string | null>(null);
  const pendingSecretRef = useRef<string | null>(null);
  const [blockedSecretId, setBlockedSecretId] = useState<string | null>(null);

  const activeConnection = useMemo(() => {
    if (!connections.length) {
      return undefined;
    }

    const match = connections.find((connection) => connection.id === selectedId);
    return match ?? connections[0];
  }, [connections, selectedId]);

  useEffect(() => {
    if (activeConnection) {
      setBlockedSecretId(null);
    }
  }, [activeConnection, setBlockedSecretId]);

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

  const secretForActive =
    activeConnection && connectionSecrets[activeConnection.id]
      ? connectionSecrets[activeConnection.id]
      : undefined;

  useEffect(() => {
    if (!isTauri) {
      sessionRef.current = null;
      setTerminalLines(fallbackLines);
      setConnectionError(null);
      setIsConnecting(false);
      return;
    }

    if (
      activeConnection &&
      activeConnection.protocol === "ssh" &&
      !secretForActive
    ) {
      if (
        blockedSecretId === activeConnection.id ||
        pendingSecretRef.current === activeConnection.id
      ) {
        setIsConnecting(false);
        return;
      }
      pendingSecretRef.current = activeConnection.id;
      openConnectionPasswordModal(activeConnection, {
        onSubmit: (password) => {
          pendingSecretRef.current = null;
          setConnectionSecret(activeConnection.id, password);
        },
        onCancel: () => {
          pendingSecretRef.current = null;
          setBlockedSecretId(activeConnection.id);
          setTerminalLines(["已取消连接"]);
          setIsConnecting(false);
        },
      });
      return;
    }

    let aborted = false;
    const start = async () => {
      setIsConnecting(true);
      setConnectionError(null);
      if (sessionRef.current) {
        await invoke("close_shell_session", { sessionId: sessionRef.current }).catch(() => {});
        sessionRef.current = null;
      }

      if (!activeConnection) {
        setTerminalLines(["请选择左侧的连接以启动会话"]);
        setIsConnecting(false);
        return;
      }

      try {
        setTerminalLines([]);
        const newId = await invoke<string>("create_shell_session", {
          connectionId: activeConnection.id,
          secret: secretForActive ? { password: secretForActive } : null,
        });
        if (aborted) {
          await invoke("close_shell_session", { sessionId: newId }).catch(() => {});
          return;
        }
        sessionRef.current = newId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notifications.show({ color: "red", title: "会话启动失败", message });
        setConnectionError(message);
      } finally {
        if (!aborted) {
          setIsConnecting(false);
        }
      }
    };

    void start();

    return () => {
      aborted = true;
      setIsConnecting(false);
    };
  }, [
    activeConnection,
    blockedSecretId,
    secretForActive,
    setBlockedSecretId,
    setConnectionSecret,
    setTerminalLines,
    sessionAttempt,
    setConnectionError,
    setIsConnecting,
  ]);

  useEffect(() => {
    if (!isTauri) return;
    let unlistenData: UnlistenFn | undefined;
    let unlistenClose: UnlistenFn | undefined;
    const setup = async () => {
      unlistenData = await listen<{ session_id: string; stream: string; data: string }>(
        "session-data",
        ({ payload }) => {
          if (sessionRef.current && payload.session_id === sessionRef.current) {
            setTerminalLines((lines) => [...lines, payload.data]);
            if (
              payload.stream === "stderr" &&
              payload.data.startsWith("SSH 会话错误")
            ) {
              setConnectionError(payload.data);
              setIsConnecting(false);
            }
          }
        },
      );
      unlistenClose = await listen<{ session_id: string }>("session-closed", ({ payload }) => {
        if (sessionRef.current && payload.session_id === sessionRef.current) {
          setTerminalLines((lines) => [...lines, "会话已结束"]);
          sessionRef.current = null;
          setConnectionError("会话已结束");
          setIsConnecting(false);
        }
      });
    };
    void setup();
    return () => {
      if (unlistenData) {
        unlistenData();
      }
      if (unlistenClose) {
        unlistenClose();
      }
    };
  }, [setConnectionError, setIsConnecting]);

  useEffect(() => () => {
    if (sessionRef.current) {
      void invoke("close_shell_session", { sessionId: sessionRef.current }).catch(() => {});
    }
  }, []);

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

    if (isTauri && sessionRef.current) {
      await invoke("send_session_input", {
        sessionId: sessionRef.current,
        data: `${input}\n`,
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setTerminalLines((lines) => [...lines, `命令失败: ${message}`]);
      });
      return;
    }

    setTerminalLines((lines) => [
      ...lines,
      "当前为浏览器预览模式，无法执行真实命令。",
    ]);
  };

  const handleEditConnection = (connection: Connection) => {
    openConnectionFormModal(
      async (payload) => {
        try {
          await updateConnection({ id: connection.id, ...payload });
          await connectionsQuery.refetch();
          notifications.show({
            color: "teal",
            title: "连接已更新",
            message: `${payload.name} (${payload.host})`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          notifications.show({ color: "red", title: "更新失败", message });
        }
      },
      {
        initial: {
          name: connection.name,
          host: connection.host,
          username: connection.username,
          protocol: connection.protocol,
          port: connection.port,
        },
        title: "编辑连接",
        submitLabel: "保存修改",
      },
    );
  };

  const handleDeleteConnection = (connection: Connection) => {
    modals.openConfirmModal({
      title: `删除 ${connection.name}`,
      children: <Text size="sm">确定要删除此连接吗？该操作不可恢复。</Text>,
      labels: { confirm: "删除", cancel: "取消" },
      confirmProps: { color: "red" },
      centered: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteConnection(connection.id);
            await connectionsQuery.refetch();
            notifications.show({
              color: "teal",
              title: "连接已删除",
              message: connection.name,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            notifications.show({ color: "red", title: "删除失败", message });
          }
        })();
      },
    });
  };

  const handleReconnect = () => {
    if (!isTauri) return;
    setSessionAttempt((value) => value + 1);
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
                  onEdit={() => handleEditConnection(connection)}
                  onDelete={() => handleDeleteConnection(connection)}
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
                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleReconnect}
                    disabled={!isTauri || isConnecting}
                  >
                    {isConnecting ? "连接中..." : "重连"}
                  </Button>
                </Group>
              </div>
              <TerminalView lines={terminalLines} />
              {connectionError ? (
                <Text size="sm" c="red" mt="sm">
                  {connectionError}
                </Text>
              ) : null}
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
