"use client";

import {
  Box,
  Button,
  Drawer,
  HStack,
  IconButton,
  Menu,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Download, Menu as MenuIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MarqueeText } from "@/components/marquee-text";
import { NewConversationDialog } from "@/components/new-conversation-dialog";
import { listCachedConversations, saveCachedConversation } from "@/lib/conversation-cache";
import { createConversation, exportConversation, type StudyConversation } from "@/lib/study-api";

export interface ConversationDrawerProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

const ITEM_BG = "rgba(255, 255, 255, 0.08)";

function ConversationItem({
  conversation,
  selected,
  onSelect,
}: {
  conversation: StudyConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = selected || hovered;

  return (
    <Box
      as="button"
      width="100%"
      textAlign="left"
      px="3"
      py="2.5"
      borderRadius="md"
      border="none"
      outline="none"
      cursor="pointer"
      bg={highlighted ? ITEM_BG : "transparent"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <VStack align="flex-start" gap="1" width="100%" minW="0">
        <Box width="100%" minW="0">
          <MarqueeText
            style={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              textAlign: "left",
              color: highlighted ? "#f3f4f6" : "#d1d5db",
            }}
          >
            {conversation.conversation_id}
          </MarqueeText>
        </Box>
        <Text fontSize="2xs" opacity={0.6}>
          test: {conversation.test_id} · {conversation.turn_count} turns
        </Text>
      </VStack>
    </Box>
  );
}

export function ConversationDrawer({
  selectedConversationId,
  onSelectConversation,
}: ConversationDrawerProps) {
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [conversations, setConversations] = useState<StudyConversation[]>([]);

  const loadConversations = useCallback(() => {
    setConversations(listCachedConversations());
  }, []);

  useEffect(() => {
    if (open) loadConversations();
  }, [open, loadConversations]);

  const handleCreate = async (testId: string) => {
    const conv = await createConversation(testId);
    saveCachedConversation(conv);
    loadConversations();
    onSelectConversation(conv.conversation_id);
    setOpen(false);
  };

  const downloadExport = async (format: "json" | "csv" | "txt") => {
    if (!selectedConversationId) return;
    const blob = await exportConversation(selectedConversationId, format);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedConversationId}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <IconButton
        aria-label="Conversations"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MenuIcon size={18} />
      </IconButton>

      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} onSubmit={handleCreate} />

      <Drawer.Root open={open} onOpenChange={(d) => setOpen(d.open)} placement="start">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            bg="gray.900"
            color="gray.100"
            maxW="360px"
            display="flex"
            flexDirection="column"
            maxH="100dvh"
          >
            <Drawer.Header borderBottomWidth="1px" borderColor="gray.800" flexShrink={0}>
              <Drawer.Title fontSize="md">Test conversations</Drawer.Title>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body flex="1" overflowY="auto" py="4" px="4" minH="0">
              {conversations.length === 0 ? (
                <Text fontSize="sm" opacity={0.7}>
                  No test conversations yet. Start one with your Test ID.
                </Text>
              ) : (
                <VStack align="stretch" gap="0.5">
                  {conversations.map((c) => (
                    <ConversationItem
                      key={c.conversation_id}
                      conversation={c}
                      selected={selectedConversationId === c.conversation_id}
                      onSelect={() => {
                        onSelectConversation(c.conversation_id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </VStack>
              )}
            </Drawer.Body>
            <Box flexShrink={0} borderTopWidth="1px" borderColor="gray.800" px="4" py="3">
              <Button
                size="sm"
                variant="ghost"
                width="100%"
                colorPalette="teal"
                onClick={() => setNewOpen(true)}
              >
                <Plus size={14} /> New conversation
              </Button>
              {selectedConversationId ? (
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button mt="1" size="sm" variant="ghost" width="100%" colorPalette="blue">
                      <Download size={14} /> Export conversation
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content bg="gray.800" borderColor="gray.700">
                        <Menu.Item value="json" onClick={() => void downloadExport("json")}>
                          JSON
                        </Menu.Item>
                        <Menu.Item value="csv" onClick={() => void downloadExport("csv")}>
                          CSV
                        </Menu.Item>
                        <Menu.Item value="txt" onClick={() => void downloadExport("txt")}>
                          Plain text
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              ) : null}
            </Box>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
