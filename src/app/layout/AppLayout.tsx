import {
  ActionIcon,
  AppShell,
  Button,
  Group,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCloudUpload,
  IconHome,
  IconMoon,
  IconPlugConnected,
  IconSun,
  IconTerminal2,
} from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useOutletContext } from "react-router-dom";

import classes from "./AppLayout.module.css";
import { useConnectionsQuery } from "../../features/connections/hooks/useConnectionsQuery";
import { useSessionsQuery } from "../../features/sessions/hooks/useSessionsQuery";
import { openExportConfModal } from "../../features/sync/components/ExportConfModal";
import { openImportConfModal } from "../../features/sync/components/ImportConfModal";
import { exportEncryptedConf, importEncryptedConf } from "../../services/sync";

export type AppLayoutContext = {
  syncMessage: string | null;
  handleImportConf: () => void;
  handleExportConf: () => void;
};

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

export const useAppLayoutContext = () => useOutletContext<AppLayoutContext>();

export const AppLayout = () => {
  useConnectionsQuery();
  useSessionsQuery();

  const location = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleExportConf = useCallback(() => {
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
  }, []);

  const handleImportConf = useCallback(() => {
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
        notifications.show({ color: "red", title: "导入失败", message: (error as Error).message });
      } finally {
        setIsImporting(false);
      }
    });
  }, []);

  const contextValue = useMemo<AppLayoutContext>(
    () => ({ syncMessage, handleExportConf, handleImportConf }),
    [syncMessage, handleExportConf, handleImportConf],
  );

  const isHome = location.pathname === "/" || location.pathname === "";

  return (
    <AppShell header={{ height: 72 }} padding="lg" className={classes.shell}>
      <AppShell.Header>
        <Group justify="space-between" px="lg" h="100%">
          <Group gap="sm">
            <div>
              <Text fw={600}>tauri-terminal</Text>
              <Text size="sm" c="dimmed">
                Unified tunnels, sessions, and sync
              </Text>
            </div>
            <Group gap="xs">
              <Button
                component={Link}
                to="/"
                variant={isHome ? "filled" : "subtle"}
                color="plasma"
                leftSection={<IconHome size={16} />}
              >
                首页
              </Button>
              <Button
                component={Link}
                to="/workspace"
                variant={!isHome ? "filled" : "subtle"}
                color="teal"
                leftSection={<IconTerminal2 size={16} />}
              >
                工作区
              </Button>
            </Group>
          </Group>
          <Group gap="xs">
            <Button
              variant="light"
              color="plasma"
              leftSection={<IconPlugConnected size={16} />}
              loading={isImporting}
              onClick={handleImportConf}
            >
              导入 conf
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconCloudUpload size={16} />}
              loading={isExporting}
              onClick={handleExportConf}
            >
              导出 conf
            </Button>
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <div className={classes.contentWrapper}>
          <Outlet context={contextValue} />
        </div>
      </AppShell.Main>
    </AppShell>
  );
};
