import { Button, Checkbox, Group, PasswordInput, Stack, Switch, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useState } from "react";

export interface ExportConfOptions {
  includeCredentials: boolean;
  useKeychain: boolean;
  masterPassword?: string;
}

interface ExportConfModalProps {
  modalId: string;
  onSubmit: (options: ExportConfOptions) => Promise<void>;
}

const ExportConfModalContent = ({ modalId, onSubmit }: ExportConfModalProps) => {
  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [useKeychain, setUseKeychain] = useState(false);
  const [masterPassword, setMasterPassword] = useState("tauri-dev-password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!useKeychain && masterPassword.trim().length < 6) {
      setError("主密码至少 6 位");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ includeCredentials, useKeychain, masterPassword });
      modals.close(modalId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Checkbox
        label="包含凭据密文"
        checked={includeCredentials}
        onChange={(event) => setIncludeCredentials(event.currentTarget.checked)}
      />
      <Switch
        checked={useKeychain}
        disabled
        label="使用系统 Keychain (即将上线)"
        onChange={(event) => setUseKeychain(event.currentTarget.checked)}
      />
      <PasswordInput
        label="主密码"
        value={masterPassword}
        onChange={(event) => setMasterPassword(event.currentTarget.value)}
        description="导出与导入需使用同一密码"
      />
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={() => modals.close(modalId)} disabled={loading}>
          取消
        </Button>
        <Button loading={loading} onClick={() => void handleConfirm()}>
          确认导出
        </Button>
      </Group>
    </Stack>
  );
};

export const openExportConfModal = (onSubmit: (options: ExportConfOptions) => Promise<void>) => {
  const modalId = `export-conf-${Date.now()}`;
  modals.open({
    modalId,
    title: "导出加密 conf",
    centered: true,
    withCloseButton: false,
    children: <ExportConfModalContent modalId={modalId} onSubmit={onSubmit} />,
  });
};
