"use client";

import { Box, Button, Field, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch {
      setError("Login failed. Use your MasTER account credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      minH="100dvh"
      bg="gray.950"
      color="gray.100"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="6"
    >
      <Box maxW="md" w="100%" p="8" borderWidth="1px" borderColor="gray.800" borderRadius="lg">
        <Heading size="md" mb="2">
          AI Triage Study
        </Heading>
        <Text fontSize="sm" opacity={0.7} mb="6">
          Sign in to validate SARA patient profile generation. Each input runs production
          get_ai_patient_profile directly.
        </Text>
        <form onSubmit={onSubmit}>
          <Stack gap="4">
            <Field.Root>
              <Field.Label>Email</Field.Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Password</Field.Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </Field.Root>
            {error ? (
              <Text color="red.400" fontSize="sm">
                {error}
              </Text>
            ) : null}
            <Button type="submit" colorPalette="teal" loading={busy}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}
