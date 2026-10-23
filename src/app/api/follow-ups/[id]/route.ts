import { eq, isNull } from "drizzle-orm";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { followUpInput } from "@/lib/follow-ups";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export const PUT = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, followUpInput);
  if (!body.ok) return body.response;
  const data = body.data;
  const db = getDb();
  const condition = scoped(schema.lead.organizationId, session.organizationId, eq(schema.lead.id, id));
  const [existing] = await db.select().from(schema.lead).where(condition).limit(1);
  if (!existing) return apiError(404, "not_found", "Oportunidad no encontrada");
  const due = new Date(data.dueAt);
  if (data.operation === "complete") {
    if (existing.nextAction !== data.title || existing.nextActionAt?.getTime() !== due.getTime()) {
      return apiError(409, "changed", "La próxima acción cambió. Recarga antes de completarla.");
    }
    if (existing.nextActionCompletedAt) return Response.json({ ok: true });
    const updated = await db.update(schema.lead).set({ nextActionCompletedAt: new Date(), updatedAt: new Date() })
      .where(scoped(schema.lead.organizationId, session.organizationId, eq(schema.lead.id, id),
        eq(schema.lead.nextAction, data.title), eq(schema.lead.nextActionAt, due), isNull(schema.lead.nextActionCompletedAt))).returning({ id: schema.lead.id });
    if (!updated.length) return apiError(409, "changed", "La acción cambió. Recarga para ver su estado.");
  } else {
    await db.update(schema.lead).set({ nextAction: data.title, nextActionAt: due, nextActionCompletedAt: null, updatedAt: new Date() }).where(condition);
  }
  return Response.json({ ok: true });
});
