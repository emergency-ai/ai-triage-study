"use client";

import { Box } from "@chakra-ui/react";

export function LatencyBadge({
  label,
  ms,
  title,
  tone,
}: {
  label: string;
  ms: number;
  title: string;
  tone: "cyan" | "purple";
}) {
  const colors =
    tone === "cyan"
      ? { bg: "cyan.900", color: "cyan.100", border: "cyan.500" }
      : { bg: "purple.900", color: "purple.100", border: "purple.500" };

  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px="2"
      py="0.5"
      borderRadius="md"
      fontSize="xs"
      fontWeight="bold"
      fontFamily="mono"
      bg={colors.bg}
      color={colors.color}
      borderWidth="1px"
      borderColor={colors.border}
      title={title}
    >
      {label} {ms}ms
    </Box>
  );
}
