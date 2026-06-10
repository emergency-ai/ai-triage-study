"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getClientApiBase } from "@/lib/api-base";

type AuthState = {
  userId: string | null;
  apiKey: string;
  apiBase: string;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiBase = getClientApiBase();
  const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? "";
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ai-triage-study-token");
    setUserId(token);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await fetch(`${apiBase}/user/signin`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Login failed");
      }
      const body = await r.json();
      const id = body.user?.user_id;
      if (!id) throw new Error("No user id");
      localStorage.setItem("ai-triage-study-token", id);
      setUserId(id);
    },
    [apiBase, apiKey],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("ai-triage-study-token");
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ userId, apiKey, apiBase, isLoading, login, logout }),
    [userId, apiKey, apiBase, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
