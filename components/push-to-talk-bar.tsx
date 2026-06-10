"use client";

import { Box, HStack, Kbd, Text } from "@chakra-ui/react";
import type { FSMState } from "@sara/ambient-agent-client";
import type { PermissionState } from "@/hooks/use-push-to-talk";

export interface PushToTalkBarProps {
  isRecording: boolean;
  level: number;
  state: FSMState;
  permission: PermissionState;
  busy: boolean;
  onRequestPermission: () => void;
  awaitingConfirmation: boolean;
}

export function PushToTalkBar(props: PushToTalkBarProps) {
  const { isRecording, level, state, permission, busy, onRequestPermission, awaitingConfirmation } =
    props;

  const dimColor = state === "error" ? "red.500" : state === "idle" ? "gray.500" : "blue.500";
  const helper =
    permission === "denied"
      ? "Microphone permission denied. Allow it in the browser address bar and reload."
      : awaitingConfirmation
        ? "Confirm by holding space and saying 'yes', 'go ahead', etc. — or say 'no' (with an alternative)."
        : isRecording
          ? "Listening… release space to send."
          : busy
            ? "Working…"
            : "Hold space and talk.";

  return (
    <Box>
      <HStack align="center" gap="4" wrap="wrap">
        <Box>
          <HStack gap="2" align="center">
            <Kbd fontSize="md" px="2.5" py="1">
              Space
            </Kbd>
            <Text fontSize="sm" opacity={0.85}>
              hold to talk
            </Text>
          </HStack>
        </Box>
        <Box
          h="3"
          flex="1"
          minW="20"
          bg="gray.800"
          borderRadius="full"
          overflow="hidden"
          borderWidth="1px"
          borderColor="gray.700"
        >
          <Box
            h="100%"
            w={`${Math.min(100, Math.round(level * 100))}%`}
            bg={isRecording ? "blue.400" : dimColor}
            transition="width 0.08s linear"
          />
        </Box>
        {permission !== "granted" && (
          <Box
            as="button"
            onClick={onRequestPermission}
            px="3"
            py="1.5"
            fontSize="sm"
            bg="blue.500"
            color="white"
            borderRadius="md"
            cursor="pointer"
            _hover={{ bg: "blue.400" }}
          >
            Enable microphone
          </Box>
        )}
      </HStack>
      <Text fontSize="xs" opacity={0.65} mt="2">
        {helper}
      </Text>
    </Box>
  );
}
