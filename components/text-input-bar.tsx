"use client";

import { Box, HStack, Kbd, Stack, Text, Textarea } from "@chakra-ui/react";
import type { FSMState } from "@sara/ambient-agent-client";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { LuSend } from "react-icons/lu";

export interface TextInputBarProps {
  /** Submit the typed text. Caller is responsible for clearing/bundling images. */
  onSubmit: (text: string) => Promise<void> | void;
  busy: boolean;
  state: FSMState;
  awaitingConfirmation: boolean;
  /** Optional ref to imperatively focus the textarea (e.g. when toggling into text mode). */
  autoFocus?: boolean;
}

/**
 * ChatGPT-style text input: multi-line textarea + send button.
 *
 *  - Enter submits (when non-empty and not busy).
 *  - Shift+Enter inserts a newline.
 *  - Auto-grows up to a max height.
 */
export function TextInputBar({
  onSubmit,
  busy,
  state,
  awaitingConfirmation,
  autoFocus,
}: TextInputBarProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus once on mount when requested
  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the user's text changes
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = !busy && value.trim().length > 0;

  const submit = useCallback(async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    try {
      await onSubmit(text);
    } catch {
      setValue(text);
    }
  }, [canSend, value, onSubmit]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const helper = awaitingConfirmation
    ? "Confirm by typing 'yes', 'go ahead', etc. — or 'no' with an alternative."
    : busy
      ? "Working…"
      : state === "error"
        ? "Something went wrong. Try again."
        : "Type a message. Enter to send, Shift+Enter for a new line.";

  return (
    <Stack gap="2">
      <HStack
        align="flex-end"
        gap="2"
        bg="gray.900"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.700"
        px="3"
        py="2"
        _focusWithin={{ borderColor: "blue.400" }}
      >
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            awaitingConfirmation ? "Confirm or propose a change…" : "Message SARA — Enter to send"
          }
          resize="none"
          minH="2.25rem"
          maxH="200px"
          border="0"
          outline="0"
          shadow="none"
          px="0"
          py="1"
          fontSize="sm"
          bg="transparent"
          _focus={{ boxShadow: "none", outline: "none" }}
          _focusVisible={{ boxShadow: "none", outline: "none" }}
          disabled={busy}
          aria-label="Message SARA"
        />
        <Box
          as="button"
          onClick={() => {
            if (canSend) void submit();
          }}
          aria-label="Send message"
          aria-disabled={!canSend}
          w="8"
          h="8"
          borderRadius="md"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          bg={canSend ? "blue.500" : "gray.800"}
          color={canSend ? "white" : "gray.500"}
          cursor={canSend ? "pointer" : "not-allowed"}
          _hover={canSend ? { bg: "blue.400" } : undefined}
          transition="background-color 0.12s ease"
        >
          <LuSend size={16} />
        </Box>
      </HStack>
      <HStack justify="space-between" wrap="wrap" gap="2">
        <Text fontSize="xs" opacity={0.65}>
          {helper}
        </Text>
        <HStack gap="1.5" opacity={0.55} fontSize="2xs">
          <Kbd fontSize="0.65em" px="1.5">
            Enter
          </Kbd>
          <Text>send</Text>
          <Text>·</Text>
          <Kbd fontSize="0.65em" px="1.5">
            Shift
          </Kbd>
          <Text>+</Text>
          <Kbd fontSize="0.65em" px="1.5">
            Enter
          </Kbd>
          <Text>newline</Text>
        </HStack>
      </HStack>
    </Stack>
  );
}
