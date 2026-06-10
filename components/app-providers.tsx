"use client";

import { Box, Spinner, Text } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

const PUBLIC_PATHS = ["/login"];

function AuthGate({ children }: { children: ReactNode }) {
  const { userId, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!userId && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login");
    }
    if (userId && PUBLIC_PATHS.includes(pathname)) {
      router.replace("/");
    }
  }, [userId, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <Box
        minH="100dvh"
        bg="gray.950"
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap="3"
      >
        <Spinner color="teal.400" />
        <Text color="gray.400" fontSize="sm">
          Loading…
        </Text>
      </Box>
    );
  }

  if (!userId && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <Box minH="100dvh" bg="gray.950" display="flex" alignItems="center" justifyContent="center">
        <Spinner color="teal.400" />
      </Box>
    );
  }

  return children;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
