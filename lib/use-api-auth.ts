"use client";

import { useMemo } from "react";
import type { AuthHeaders } from "@sara/ambient-agent-client";
import { useAuth } from "@/contexts/auth-context";

/** Stable auth headers for API client hooks (avoids re-bind / reload loops). */
export function useApiAuth(): AuthHeaders {
  const { userId, apiKey } = useAuth();
  return useMemo(() => ({ apiKey, userId: userId ?? "" }), [apiKey, userId]);
}
