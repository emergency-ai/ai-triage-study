"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { LuKeyboard, LuMic } from "react-icons/lu";

export type InputMode = "voice" | "text";

const STORAGE_KEY = "sara.input_mode";

const OPTIONS: { value: InputMode; label: string; icon: typeof LuMic }[] = [
  { value: "voice", label: "Voice", icon: LuMic },
  { value: "text", label: "Text", icon: LuKeyboard },
];

/**
 * Segmented toggle for which input modality is active. Voice keeps the
 * push-to-talk bar; Text shows a ChatGPT-style textarea. Persisted in
 * localStorage so the user's preference survives reloads.
 */
export function InputModeToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: InputMode;
  onChange: (m: InputMode) => void;
  disabled?: boolean;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot hydration on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as InputMode | null;
      if (saved && saved !== value && OPTIONS.some((o) => o.value === saved)) {
        onChange(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const choose = (m: InputMode) => {
    if (disabled) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
    onChange(m);
  };

  return (
    <Box>
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" mb="2" opacity={0.6}>
        Input mode
      </Text>
      <HStack
        gap="0"
        bg="gray.900"
        borderRadius="md"
        borderWidth="1px"
        borderColor="gray.700"
        p="0.5"
        role="tablist"
        aria-label="Input mode"
        opacity={disabled ? 0.55 : 1}
      >
        {OPTIONS.map((o) => {
          const active = o.value === value;
          const Icon = o.icon;
          return (
            <Box
              key={o.value}
              as="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled || undefined}
              onClick={() => choose(o.value)}
              px="2.5"
              py="1"
              borderRadius="sm"
              fontSize="xs"
              cursor={disabled ? "not-allowed" : "pointer"}
              display="flex"
              alignItems="center"
              gap="1.5"
              bg={active ? "blue.500" : "transparent"}
              color={active ? "white" : "gray.300"}
              fontWeight={active ? "semibold" : "normal"}
              _hover={disabled || active ? undefined : { color: "gray.100" }}
              transition="background-color 0.12s ease, color 0.12s ease"
            >
              <Icon size={12} />
              <Text fontSize="xs">{o.label}</Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
