import { z } from "zod";

export const followUpInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("save"), title: z.string().trim().min(1).max(240), dueAt: z.string().datetime({ offset: true }) }),
  z.object({ operation: z.literal("complete"), title: z.string().min(1), dueAt: z.string().datetime({ offset: true }) }),
]);

export type FollowUp = {
  id: string;
  contactId: string;
  contactName: string;
  title: string | null;
  dueAt: string | null;
  completedAt: string | null;
};
export type FollowUpFilter = "pending" | "today" | "overdue" | "completed";

export function matchesFollowUp(item: FollowUp, filter: FollowUpFilter, now: Date, timezone: string): boolean {
  if (!item.title || !item.dueAt) return false;
  if (filter === "completed") return Boolean(item.completedAt);
  if (item.completedAt) return false;
  if (filter === "pending") return true;
  const due = new Date(item.dueAt);
  if (filter === "overdue") return due.getTime() < now.getTime();
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  return format.format(due) === format.format(now);
}

export function localDateTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
