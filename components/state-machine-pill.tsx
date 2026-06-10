"use client";

import { Box, Text } from "@chakra-ui/react";
import type { FSMState } from "@sara/ambient-agent-client";

const LABELS: Record<FSMState, string> = {
  idle: "Idle",
  recording: "Recording",
  transcribing: "Transcribing",
  thinking: "Thinking",
  speaking: "Speaking",
  awaiting_confirmation: "Awaiting confirmation",
  classifying_intent: "Classifying intent",
  executing_tools: "Executing tools",
  reporting: "Reporting",
  error: "Error",
};

export function StateMachinePill({ state }: { state: FSMState }) {
  return (
    <Box
      display="inline-flex"
      alignSelf="flex-start"
      px="2.5"
      py="1"
      borderRadius="full"
      fontSize="xs"
      fontWeight="semibold"
      bg={state === "error" ? "red.900" : "gray.800"}
      color={state === "error" ? "red.100" : "gray.200"}
      borderWidth="1px"
      borderColor={state === "error" ? "red.600" : "gray.600"}
    >
      <Text fontSize="xs">{LABELS[state] ?? state}</Text>
    </Box>
  );
}
