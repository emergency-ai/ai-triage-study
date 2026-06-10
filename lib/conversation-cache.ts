import type { StudyConversation } from "@/lib/study-api";

const STORAGE_KEY = "ai-triage-study.conversations";

export function listCachedConversations(): StudyConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudyConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedConversation(conv: StudyConversation): void {
  const existing = listCachedConversations().filter(
    (c) => c.conversation_id !== conv.conversation_id,
  );
  const next = [conv, ...existing];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function updateCachedConversation(conv: StudyConversation): void {
  const existing = listCachedConversations();
  const next = existing.map((c) => (c.conversation_id === conv.conversation_id ? conv : c));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
