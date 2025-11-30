import {
  ActionIcon,
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
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconDots,
  IconEdit,
  IconPlugConnected,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { openConnectionFormModal } from "../features/connections/components/ConnectionFormModal";
import { useConnectionsQuery } from "../features/connections/hooks/useConnectionsQuery";
import { openConnectionPasswordModal } from "../features/sessions/components/ConnectionPasswordModal";
import { TerminalView, type TerminalViewHandle } from "../features/terminal/components/TerminalView";
import { createConnection, deleteConnection, updateConnection } from "../services/connections";
import { isTauri } from "../services/tauriBridge";
import type { Connection } from "../shared/types";
import { useConnectionSecretsStore } from "../store/connectionSecretsStore";
import { useConnectionsStore } from "../store/connectionsStore";
import { useSessionsStore } from "../store/sessionsStore";

import "../App.css";

const fallbackLines = [
  "tauri-terminal 当前运行在浏览器预览模式。",
  "请执行 `npm run tauri dev` 或运行打包应用以获得真实会话。",
];

type ConnectRequest = { connectionId: string; nonce: number } | null;

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

const ensureTrailingNewline = (value: string) => {
  if (!value) return value;
  if (value.endsWith("\n")) {
    return value;
  }
  if (value.endsWith("\r")) {
    return `${value}\n`;
  }
  return `${value}\r\n`;
};

export const WorkspacePage = () => {
  const connectionsQuery = useConnectionsQuery();

  const connections = useConnectionsStore((state) => state.items);
  const selectedId = useConnectionsStore((state) => state.selectedId);
  const selectConnection = useConnectionsStore((state) => state.selectConnection);
  const addLocalConnection = useConnectionsStore((state) => state.addLocalConnection);
  const sessions = useSessionsStore((state) => state.items);
  const connectionSecrets = useConnectionSecretsStore((state) => state.secrets);
  const setConnectionSecret = useConnectionSecretsStore((state) => state.setSecret);

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectRequest, setConnectRequest] = useState<ConnectRequest>(null);
  const sessionRef = useRef<string | null>(null);
  const terminalRef = useRef<TerminalViewHandle | null>(null);
  const pendingTerminalWritesRef = useRef<string[]>([]);
  const [terminalReady, setTerminalReady] = useState(false);
  const pendingSecretRef = useRef<string | null>(null);
  const [blockedSecretId, setBlockedSecretId] = useState<string | null>(null);

  const location = useLocation();

  useEffect(() => {
    const targetId = (location.state as { connectionId?: string } | null)?.connectionId;
    if (targetId) {
      selectConnection(targetId);
      window.history.replaceState({}, "", window.location.href);
    }
  }, [location.state, selectConnection]);

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
  }, [activeConnection]);

  const appendTerminalOutput = useCallback((data: string, options?: { newline?: boolean }) => {
    if (!data) return;
    const chunk = options?.newline === false ? data : ensureTrailingNewline(data);
    if (terminalReady && terminalRef.current) {
      terminalRef.current.write(chunk);
      terminalRef.current.focus();
    } else {
      pendingTerminalWritesRef.current.push(chunk);
    }
  }, [terminalReady]);

  const resetTerminal = useCallback(
    (message?: string) => {
      pendingTerminalWritesRef.current = [];
      if (terminalRef.current) {
        terminalRef.current.clear();
      }
      if (message) {
        appendTerminalOutput(message, { newline: true });
      }
    },
    [appendTerminalOutput],
  );

  useEffect(() => {
    if (!terminalReady || !terminalRef.current) return;
    if (!pendingTerminalWritesRef.current.length) return;
    pendingTerminalWritesRef.current.forEach((chunk) => {
      terminalRef.current?.write(chunk);
    });
    pendingTerminalWritesRef.current = [];
    terminalRef.current.focus();
  }, [terminalReady]);

  useEffect(() => {
    if (!connectRequest) return;
    if (!isTauri) {
      sessionRef.current = null;
      resetTerminal(fallbackLines.join("\n"));
      setIsConnecting(false);
      setConnectRequest(null);
      return;
    }

    const connection = connections.find((item) => item.id === connectRequest.connectionId);
    if (!connection) {
      setConnectRequest(null);
      return;
    }

    if (
      connection.protocol === "ssh" &&
      !connectionSecrets[connection.id]
    ) {
      if (
        blockedSecretId === connection.id ||
        pendingSecretRef.current === connection.id
      ) {
        setIsConnecting(false);
        return;
      }
      pendingSecretRef.current = connection.id;
      openConnectionPasswordModal(connection, {
        onSubmit: (password) => {
          pendingSecretRef.current = null;
          setConnectionSecret(connection.id, password);
        },
        onCancel: () => {
          pendingSecretRef.current = null;
          setBlockedSecretId(connection.id);
          resetTerminal("已取消连接");
          setIsConnecting(false);
          setConnectRequest(null);
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

      if (!connection) {
        resetTerminal("请选择左侧的连接以启动会话");
        setIsConnecting(false);
        setConnectRequest(null);
        return;
      }

      try {
        resetTerminal();
        const secret = connectionSecrets[connection.id];
        const newId = await invoke<string>("create_shell_session", {
          connectionId: connection.id,
          secret: secret ? { password: secret } : null,
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
          setConnectRequest(null);
        }
      }
    };

    void start();

    return () => {
      aborted = true;
      setIsConnecting(false);
    };
  }, [connectRequest, connections, connectionSecrets, blockedSecretId, setConnectionSecret, resetTerminal]);

  useEffect(() => {
    if (!isTauri) return;
    let unlistenData: UnlistenFn | undefined;
    let unlistenClose: UnlistenFn | undefined;
    const setup = async () => {
      unlistenData = await listen<{ session_id: string; stream: string; data: string }>(
        "session-data",
        ({ payload }) => {
          if (sessionRef.current && payload.session_id === sessionRef.current) {
            appendTerminalOutput(payload.data, { newline: false });
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
          appendTerminalOutput("会话已结束");
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
  }, [appendTerminalOutput]);

  useEffect(() => () => {
    if (sessionRef.current) {
      void invoke("close_shell_session", { sessionId: sessionRef.current }).catch(() => {});
    }
  }, []);

  const handleAddConnection = () => {
    openConnectionFormModal(async (payload) => {
      try {
        const connection = await createConnection(payload);
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
        notifications.show({ color: "red", title: "创建连接失败", message });
      }
    });
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
      title: `删除连接 ${connection.name}`,
      centered: true,
      children: <Text size="sm">此操作无法撤销，确认要删除吗？</Text>,
      labels: { confirm: "删除", cancel: "取消" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        const run = async () => {
          try {
            await deleteConnection(connection.id);
            await connectionsQuery.refetch();
            notifications.show({ color: "teal", title: "已删除", message: connection.name });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            notifications.show({ color: "red", title: "删除失败", message });
          }
        };
        void run();
      },
    });
  };

  const handleConnect = useCallback(() => {
    if (!activeConnection) {
      notifications.show({ color: "orange", title: "无可用连接", message: "请先创建连接" });
      return;
    }
    setConnectRequest({ connectionId: activeConnection.id, nonce: Date.now() });
  }, [activeConnection]);

  const handleTerminalInput = useCallback(
    (data: string) => {
      if (!isTauri) return;
      const sessionId = sessionRef.current;
      if (!sessionId) return;
      void invoke("send_session_input", {
        sessionId,
        data,
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        appendTerminalOutput(`命令发送失败: ${message}`);
      });
    },
    [appendTerminalOutput],
  );

  return (
    <Flex gap="lg" direction={{ base: "column", lg: "row" }}>
      <Card withBorder radius="lg">
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
        <Button
          mt="sm"
          fullWidth
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={handleAddConnection}
        >
          新增连接
        </Button>
        <ScrollArea h={360} mt="lg" type="always">
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
        </ScrollArea>
      </Card>

      <Box style={{ flex: 1 }}>
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
            <Button
              size="xs"
              variant="light"
              onClick={handleConnect}
              disabled={!isTauri || isConnecting}
            >
              {isConnecting ? "连接中..." : "启动会话"}
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
              Session — {activeConnection?.name ?? "waiting"}
            </Text>
            <Group gap="xs">
              <Badge size="xs" variant="light" color="teal">
                Live tail
              </Badge>
              <Badge size="xs" variant="light" color="plasma">
                SFTP pending
              </Badge>
              <Button
                size="xs"
                variant="light"
                onClick={handleConnect}
                disabled={!isTauri || isConnecting}
              >
                {isConnecting ? "连接中..." : "重新连接"}
              </Button>
            </Group>
          </div>
          <TerminalView
            ref={terminalRef}
            onData={handleTerminalInput}
            onReadyChange={setTerminalReady}
          />
          {connectionError ? (
            <Text size="sm" c="red" mt="sm">
              {connectionError}
            </Text>
          ) : null}
        </Box>

        <Flex gap="lg" direction={{ base: "column", md: "row" }} mt="lg">
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
              <IconPlugConnected size={18} />
            </Group>
            <Stack gap="xs">
              <Group gap="xs">
                <Badge size="xs" color="teal" variant="light">
                  encrypted
                </Badge>
                <Text size="sm">导入/导出通过 App 头部按钮触发</Text>
              </Group>
            </Stack>
          </Card>
        </Flex>
      </Box>
    </Flex>
  );
};
