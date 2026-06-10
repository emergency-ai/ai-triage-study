"use client";

import { Box, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ChatTurn } from "@sara/ambient-agent-client";
import { useEffect, useRef } from "react";
import { SaraLogo } from "@/components/sara-logo";
import type { InputMode } from "@/components/input-mode-toggle";

const EMPTY_HINT: Record<InputMode, string> = {
  voice: "Hold the spacebar and talk. Release to send.",
  text: "Type a message below and press Enter to send.",
};

function isValidJson(text: string): boolean {
  const stripped = text.trim();
  if (!stripped) return false;
  try {
    JSON.parse(stripped);
    return true;
  } catch {
    return false;
  }
}

export function Conversation({
  turns,
  inputMode = "voice",
}: {
  turns: ChatTurn[];
  inputMode?: InputMode;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when transcript text changes
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, turns[turns.length - 1]?.text]);

  return (
    <Stack gap="4" px="2" py="4">
      {turns.length === 0 && (
        <Box opacity={0.55} fontSize="sm" textAlign="center" mt="20">
          {EMPTY_HINT[inputMode]}
        </Box>
      )}
      {turns.map((t) => (
        <Turn key={t.id} turn={t} />
      ))}
      <div ref={endRef} />
    </Stack>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  const isPending = !turn.text;
  const pendingLabel = isUser ? "Transcribing…" : "Generating profile…";
  const displayText = isUser ? turn.text : turn.text;
  const showJsonBadge = !isUser && turn.text && isValidJson(turn.text);

  return (
    <HStack align="flex-start" gap="3" justify={isUser ? "flex-end" : "flex-start"}>
      {!isUser && <SaraLogo size={28} />}
      <Box maxW="85%">
        <Text fontSize="xs" opacity={0.55} mb="1" textAlign={isUser ? "right" : "left"}>
          {isUser ? "You" : "Patient profile"}
          {showJsonBadge ? " · JSON" : null}
        </Text>
        {(turn.text || isPending) && (
          <Box
            bg={isUser ? "blue.700" : "gray.800"}
            color="white"
            px="3"
            py="2"
            borderRadius="lg"
            borderWidth="1px"
            borderColor={isUser ? "blue.500" : showJsonBadge ? "teal.600" : "gray.700"}
            whiteSpace="pre-wrap"
            fontSize="sm"
            fontFamily={!isUser && showJsonBadge ? "mono" : undefined}
            aria-busy={isPending || undefined}
          >
            {isPending ? (
              <HStack gap="2" opacity={0.85}>
                <Spinner size="xs" borderWidth="2px" />
                <Text fontSize="xs" opacity={0.85} fontStyle="italic">
                  {pendingLabel}
                </Text>
              </HStack>
            ) : (
              displayText
            )}
          </Box>
        )}
      </Box>
      {isUser && <Avatar label="U" />}
    </HStack>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <Box
      w="7"
      h="7"
      borderRadius="full"
      bg="gray.700"
      color="gray.200"
      fontSize="xs"
      fontWeight="bold"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      {label}
    </Box>
  );
}
