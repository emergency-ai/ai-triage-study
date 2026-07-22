"use client";

import { Box, Grid, GridItem, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useRef, useState } from "react";
import { Conversation } from "@/components/conversation";
import { ConversationDrawer } from "@/components/conversation-drawer";
import { type InputMode, InputModeToggle } from "@/components/input-mode-toggle";
import { NewConversationDialog } from "@/components/new-conversation-dialog";
import { PushToTalkBar } from "@/components/push-to-talk-bar";
import { SaraLogo } from "@/components/sara-logo";
import { TextInputBar } from "@/components/text-input-bar";
import { useStudyStream } from "@/hooks/use-study-stream";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { createConversation } from "@/lib/study-api";

export default function Page() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const stream = useStudyStream(conversationId);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const narrationStartedAtRef = useRef<number | null>(null);

  const onRecordingStart = useCallback(() => {
    narrationStartedAtRef.current = performance.now();
  }, []);

  const onRecorded = useCallback(
    async (blob: Blob) => {
      const startedAt = narrationStartedAtRef.current;
      narrationStartedAtRef.current = null;
      // capture_to_upload_ms is finalized in postUtterance (after base64, before fetch).
      await stream.sendAudio(blob, { narrationStartedAt: startedAt ?? undefined });
    },
    [stream],
  );

  const onTextSubmit = useCallback(
    async (text: string) => {
      const startedAt = performance.now();
      await stream.sendText(text, { captureToUploadMs: 0, narrationStartedAt: startedAt });
    },
    [stream],
  );

  const ptt = usePushToTalk({
    onRecorded,
    onRecordingStart,
    disabled: stream.busy || inputMode === "text" || !conversationId,
  });

  const handleCreateConversation = async (testId: string) => {
    const conv = await createConversation(testId);
    setConversationId(conv.conversation_id);
  };

  return (
    <Box minH="100dvh" bg="gray.950" color="gray.100">
      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={handleCreateConversation}
      />

      <Grid
        templateColumns="1fr"
        templateRows="auto 1fr auto"
        templateAreas={`"header" "main" "input"`}
        h="100dvh"
      >
        <GridItem area="header" px="5" py="3" borderBottomWidth="1px" borderColor="gray.800">
          <HStack justify="space-between" wrap="wrap" gap="3">
            <HStack gap="2.5">
              <ConversationDrawer
                selectedConversationId={conversationId}
                onSelectConversation={setConversationId}
              />
              <SaraLogo size={24} />
              <Heading size="sm">AI Triage Study</Heading>
              <Text fontSize="xs" opacity={0.55}>
                to validate patient profile generation using SARA AI
              </Text>
            </HStack>
            <Text fontSize="xs" opacity={0.55} fontFamily="mono">
              {conversationId ?? "no conversation selected"}
            </Text>
          </HStack>
        </GridItem>

        <GridItem area="main" overflow="hidden">
          <Box h="100%" overflowY="auto" maxW="3xl" mx="auto" w="100%">
            {!conversationId ? (
              <Stack p="8" opacity={0.75} align="center" textAlign="center" mt="16" gap="4">
                <Text>Start a new test conversation with your Test ID.</Text>
                <Box
                  as="button"
                  px="4"
                  py="2"
                  bg="teal.600"
                  color="white"
                  borderRadius="md"
                  fontSize="sm"
                  onClick={() => setNewOpen(true)}
                >
                  New conversation
                </Box>
              </Stack>
            ) : (
              <Conversation turns={stream.turns} inputMode={inputMode} />
            )}
          </Box>
        </GridItem>

        <GridItem
          area="input"
          borderTopWidth="1px"
          borderColor="gray.800"
          bg="gray.925"
          px="5"
          py="3"
        >
          <Box maxW="3xl" mx="auto" w="100%">
            <Stack gap="3">
              <InputModeToggle value={inputMode} onChange={setInputMode} disabled={stream.busy} />
              {inputMode === "voice" ? (
                <PushToTalkBar
                  isRecording={ptt.isRecording}
                  level={ptt.level}
                  state="idle"
                  permission={ptt.permission}
                  busy={stream.busy || !conversationId}
                  onRequestPermission={ptt.requestPermission}
                  awaitingConfirmation={false}
                />
              ) : (
                <TextInputBar
                  onSubmit={onTextSubmit}
                  busy={stream.busy || !conversationId}
                  state="idle"
                  awaitingConfirmation={false}
                />
              )}
              {ptt.error ? (
                <Text fontSize="xs" color="red.300">
                  {ptt.error}
                </Text>
              ) : null}
              {stream.lastError ? (
                <Text fontSize="xs" color="red.300">
                  {stream.lastError}
                </Text>
              ) : null}
              {stream.busy ? (
                <Text fontSize="xs" opacity={0.6}>
                  Generating patient profile…
                </Text>
              ) : null}
            </Stack>
          </Box>
        </GridItem>
      </Grid>
    </Box>
  );
}
