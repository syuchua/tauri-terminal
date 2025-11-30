import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlugConnected, IconTerminal2 } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { useAppLayoutContext } from "../app/layout/AppLayout";
import { useConnectionsStore } from "../store/connectionsStore";
import { useSessionsStore } from "../store/sessionsStore";

export const HomePage = () => {
  const { syncMessage, handleExportConf, handleImportConf } = useAppLayoutContext();
  const connections = useConnectionsStore((state) => state.items);
  const sessions = useSessionsStore((state) => state.items);
  const favorites = connections.filter((connection) => connection.favorite).slice(0, 4);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>欢迎回来</Title>
        <Text c="dimmed">选择一个操作或跳转到工作区以启动会话。</Text>
      </Stack>

      <Group gap="sm">
        <Button component={Link} to="/workspace" leftSection={<IconTerminal2 size={16} />}>
          进入工作区
        </Button>
        <Button
          variant="light"
          color="plasma"
          leftSection={<IconPlugConnected size={16} />}
          onClick={handleImportConf}
        >
          导入加密 conf
        </Button>
        <Button variant="light" color="gray" onClick={handleExportConf}>
          导出当前配置
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
        <Card withBorder radius="lg">
          <Text c="dimmed" size="sm">
            Connections
          </Text>
          <Title order={3}>{connections.length}</Title>
          <Text size="sm" c="dimmed">
            {connections.length ? "最近更新" : "尚未添加连接"}
          </Text>
        </Card>
        <Card withBorder radius="lg">
          <Text c="dimmed" size="sm">
            Active sessions
          </Text>
          <Title order={3}>{sessions.length}</Title>
          <Text size="sm" c="dimmed">
            {sessions.length ? "可在工作区查看详情" : "暂无活动会话"}
          </Text>
        </Card>
        <Card withBorder radius="lg">
          <Text c="dimmed" size="sm">
            Sync timeline
          </Text>
          <Title order={3}>{syncMessage ? "已完成" : "等待"}</Title>
          <Text size="sm" c="dimmed">
            {syncMessage ?? "尚未执行导入/导出操作"}
          </Text>
        </Card>
      </SimpleGrid>

      {favorites.length ? (
        <Card withBorder radius="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>收藏连接</Text>
            <Button component={Link} to="/workspace" variant="light" size="xs">
              打开工作区
            </Button>
          </Group>
          <Stack gap="sm">
            {favorites.map((connection) => (
              <Group key={connection.id} justify="space-between">
                <div>
                  <Text fw={500}>{connection.name}</Text>
                  <Text size="xs" c="dimmed">
                    {connection.host}:{connection.port} — {connection.protocol.toUpperCase()}
                  </Text>
                </div>
                <Button
                  component={Link}
                  to="/workspace"
                  variant="subtle"
                  size="xs"
                  state={{ connectionId: connection.id }}
                >
                  连接
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
};
