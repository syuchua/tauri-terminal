import { Button, Group, PasswordInput, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useState } from "react";

import type { Connection } from "../../../shared/types";

interface PasswordModalProps {
  modalId: string;
  connection: Connection;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

const PasswordModalContent = ({ modalId, connection, onSubmit, onCancel }: PasswordModalProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!password.trim()) {
      setError("请输入密码");
      return;
    }
    setError(null);
    setLoading(true);
    onSubmit(password);
    modals.close(modalId);
  };

  const handleCancel = () => {
    setPassword("");
    setError(null);
    onCancel();
    modals.close(modalId);
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        连接 {connection.name} 需要密码，请输入一次性凭据（仅本次会话有效）。
      </Text>
      <PasswordInput
        label="SSH 密码"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSubmit();
          }
        }}
      />
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={handleCancel} disabled={loading}>
          取消
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          确认
        </Button>
      </Group>
    </Stack>
  );
};

export const openConnectionPasswordModal = (
  connection: Connection,
  handlers: { onSubmit: (password: string) => void; onCancel: () => void },
) => {
  const modalId = `connection-password-${connection.id}`;
  modals.open({
    modalId,
    centered: true,
    withCloseButton: false,
    title: `输入 ${connection.name} 的密码`,
    children: (
      <PasswordModalContent
        modalId={modalId}
        connection={connection}
        onSubmit={handlers.onSubmit}
        onCancel={handlers.onCancel}
      />
    ),
  });
};
