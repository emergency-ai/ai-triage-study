"use client";

import { Button, Dialog, Field, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { TEST_ID_PATTERN } from "@/lib/study-api";

export interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (testId: string) => Promise<void>;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewConversationDialogProps) {
  const [testId, setTestId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = TEST_ID_PATTERN.test(testId.trim());

  const handleSubmit = async () => {
    const value = testId.trim();
    if (!TEST_ID_PATTERN.test(value)) {
      setError("Test ID may only contain letters, digits, hyphens, and underscores.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
      setTestId("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(d) => onOpenChange(d.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="gray.100" maxW="md">
          <Dialog.Header>
            <Dialog.Title>New test conversation</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Text fontSize="sm" opacity={0.75}>
                Enter your participant Test ID. The conversation will be labeled{" "}
                <Text as="span" fontFamily="mono">
                  {"{test-id}-{datetime}"}
                </Text>
                .
              </Text>
              <Field.Root invalid={!!error}>
                <Field.Label>Test ID</Field.Label>
                <Input
                  value={testId}
                  onChange={(e) => {
                    setTestId(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. participant_01"
                  fontFamily="mono"
                />
                <Field.HelperText>Letters, digits, hyphens (-), underscores (_)</Field.HelperText>
                {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
              </Field.Root>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              colorPalette="teal"
              onClick={() => void handleSubmit()}
              loading={busy}
              disabled={!valid}
            >
              Start conversation
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
