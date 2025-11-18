import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { useState } from "react";

import type { Connection, NewConnectionPayload } from "../../../shared/types";

interface ConnectionFormModalProps {
  modalId: string;
  onSubmit: (payload: NewConnectionPayload) => Promise<void> | void;
  initial?: NewConnectionPayload;
  title?: string;
  submitLabel?: string;
}

const protocolOptions: { label: string; value: Connection["protocol"]; port: number }[] = [
  { label: "SSH", value: "ssh", port: 22 },
  { label: "SFTP", value: "sftp", port: 22 },
  { label: "FTP", value: "ftp", port: 21 },
];

const ConnectionFormModalContent = ({ modalId, onSubmit, initial, submitLabel }: ConnectionFormModalProps) => {
  const [payload, setPayload] = useState<NewConnectionPayload>(
    initial ?? {
      name: "",
      host: "",
      username: "",
      protocol: "ssh",
      port: 22,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!payload.name.trim() || !payload.host.trim() || !payload.username.trim()) {
      setError("请完善名称、主机、用户名");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(payload);
      modals.close(modalId);
    } finally {
      setLoading(false);
    }
  };

  const update = <K extends keyof NewConnectionPayload>(key: K, value: NewConnectionPayload[K]) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Stack>
      <TextInput
        label="名称"
        placeholder="例如：prod-api"
        value={payload.name}
        onChange={(event) => update("name", event.currentTarget.value)}
        required
      />
      <TextInput
        label="主机"
        placeholder="10.0.0.1"
        value={payload.host}
        onChange={(event) => update("host", event.currentTarget.value)}
        required
      />
      <TextInput
        label="用户名"
        placeholder="deploy"
        value={payload.username}
        onChange={(event) => update("username", event.currentTarget.value)}
        required
      />
      <Group grow>
        <Select
          label="协议"
          data={protocolOptions.map((option) => ({ label: option.label, value: option.value }))}
          value={payload.protocol}
          onChange={(value) => {
            const option = protocolOptions.find((item) => item.value === value) ?? protocolOptions[0];
            update("protocol", option.value);
            update("port", option.port);
          }}
        />
        <NumberInput
          label="端口"
          min={1}
          max={65535}
          value={payload.port}
          onChange={(value) => update("port", Number(value) || payload.port)}
        />
      </Group>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={() => modals.close(modalId)} disabled={loading}>
          取消
        </Button>
        <Button loading={loading} onClick={() => void handleSubmit()}>
          {submitLabel ?? "保存连接"}
        </Button>
      </Group>
    </Stack>
  );
};

export const openConnectionFormModal = (
  onSubmit: (payload: NewConnectionPayload) => Promise<void> | void,
  options?: { initial?: NewConnectionPayload; title?: string; submitLabel?: string },
) => {
  const modalId = `connection-form-${Date.now()}`;
  modals.open({
    modalId,
    title: options?.title ?? "新增连接",
    centered: true,
    withCloseButton: false,
    children: (
      <ConnectionFormModalContent
        modalId={modalId}
        onSubmit={onSubmit}
        initial={options?.initial}
        title={options?.title}
        submitLabel={options?.submitLabel}
      />
    ),
  });
};
