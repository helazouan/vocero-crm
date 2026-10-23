import { describe, expect, it } from "vitest";
import { followUpInput, matchesFollowUp, type FollowUp } from "@/lib/follow-ups";

const action: FollowUp = { id: "ld_1", contactId: "ct_1", contactName: "Ana", title: "Llamar", dueAt: "2026-10-23T08:00:00Z", completedAt: null };
describe("recordatorios", () => {
  it("Hoy usa el día local, Vencidos el instante", () => {
    const now = new Date("2026-10-22T23:30:00Z");
    expect(matchesFollowUp(action, "today", now, "Europe/Madrid")).toBe(true);
    expect(matchesFollowUp(action, "today", now, "America/New_York")).toBe(false);
    expect(matchesFollowUp(action, "overdue", now, "Europe/Madrid")).toBe(false);
    expect(matchesFollowUp(action, "overdue", new Date("2026-10-23T09:00:00Z"), "Europe/Madrid")).toBe(true);
  });
  it("completadas salen de pendientes, Hoy y Vencidos", () => {
    const completed = { ...action, completedAt: "2026-10-23T08:05:00Z" };
    const now = new Date("2026-10-23T10:00:00Z");
    for (const filter of ["pending", "today", "overdue"] as const) expect(matchesFollowUp(completed, filter, now, "Europe/Madrid")).toBe(false);
    expect(matchesFollowUp(completed, "completed", now, "Europe/Madrid")).toBe(true);
  });
  it("cambio de horario de invierno conserva el día local", () => {
    expect(matchesFollowUp({ ...action, dueAt: "2026-10-25T01:30:00Z" }, "today", new Date("2026-10-24T22:30:00Z"), "Europe/Madrid")).toBe(true);
  });
  it("valida título y fecha con zona; permite reprogramar una acción vencida", () => {
    expect(followUpInput.safeParse({ operation: "save", title: "  ", dueAt: action.dueAt }).success).toBe(false);
    expect(followUpInput.safeParse({ operation: "save", title: "Llamar", dueAt: "2026-10-23T09:00" }).success).toBe(false);
    expect(followUpInput.safeParse({ operation: "save", title: "Llamar", dueAt: action.dueAt }).success).toBe(true);
  });
});
