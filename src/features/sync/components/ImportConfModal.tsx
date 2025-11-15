import { Button, Group, PasswordInput, Stack, Switch, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useState } from "react";

export interface ImportConfOptions {
  useKeychain: boolean;
  masterPassword?: string;
}

interface ImportConfModalProps {
  modalId: string;
  onSubmit: (options: ImportConfOptions) => Promise<void>;
}

const ImportConfModalContent = ({ modalId, onSubmit }: ImportConfModalProps) => {
  const [useKeychain, setUseKeychain] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!useKeychain && masterPassword.length < 6) {
      setError("主密码至少 6 位");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        useKeychain,
        masterPassword: useKeychain ? undefined : masterPassword,
      });
      modals.close(modalId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Switch
        checked={useKeychain}
        disabled
        onChange={(event) => setUseKeychain(event.currentTarget.checked)}
        label="使用系统 Keychain 解锁 (即将上线)"
      />
      <PasswordInput
        label="主密码"
        placeholder="请输入主密码"
        disabled={useKeychain}
        value={masterPassword}
        onChange={(event) => setMasterPassword(event.currentTarget.value)}
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
          确认导入
        </Button>
      </Group>
    </Stack>
  );
};

export const openImportConfModal = (onSubmit: (options: ImportConfOptions) => Promise<void>) => {
  const modalId = `import-conf-${Date.now()}`;
  modals.open({
    modalId,
    title: "导入加密 conf",
    centered: true,
    withCloseButton: false,
    children: <ImportConfModalContent modalId={modalId} onSubmit={onSubmit} />,
  });
};
