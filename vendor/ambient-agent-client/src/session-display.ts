export type SessionBadgeTone = "teal" | "green" | "blue" | "orange" | "red" | "gray";

function titleCaseWords(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatRolePreset(role: string | undefined): string {
  if (!role?.trim()) return "Unknown";
  return titleCaseWords(role.trim());
}

export function formatSessionStatus(status: string | undefined): string {
  if (!status?.trim()) return "Unknown";
  return titleCaseWords(status.trim());
}

export function sessionStatusTone(status: string | undefined): SessionBadgeTone {
  const s = (status ?? "").toLowerCase();
  if (/(active|running|live|progress|open)/.test(s)) return "green";
  if (/(complete|done|finished|closed)/.test(s)) return "blue";
  if (/(pause|pending|waiting|draft)/.test(s)) return "orange";
  if (/(error|fail|cancel|discard)/.test(s)) return "red";
  return "gray";
}
