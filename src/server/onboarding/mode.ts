import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { OnboardingStatus } from "./status";

export type AttentionMode = "manual" | "agent";

export async function attentionMode(organizationId: string, status: OnboardingStatus): Promise<AttentionMode> {
  const [org] = await getDb().select({ mode: schema.organization.attentionMode })
    .from(schema.organization).where(eq(schema.organization.id, organizationId)).limit(1);
  return org?.mode ?? (status.enabled || status.steps.some(s => s.key === "brain" && s.status === "ready") ? "agent" : "manual");
}

export async function saveAttentionMode(organizationId: string, mode: AttentionMode) {
  await getDb().transaction(async tx => {
    await tx.update(schema.organization).set({ attentionMode: mode }).where(eq(schema.organization.id, organizationId));
    if (mode === "manual") await tx.update(schema.agentProfile).set({ enabled: false })
      .where(scoped(schema.agentProfile.organizationId, organizationId));
  });
}
