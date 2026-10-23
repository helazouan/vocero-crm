import { contactScope } from "@/server/portfolio/access";
import { asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session, req: Request) => {
  const parsed = z.object({ leadId: z.string().min(1).optional() }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return apiError(422, "invalid_query", "Oportunidad inválida");
  const rows = await getDb().select({ id: schema.lead.id, contactId: schema.contact.id,
    contactName: schema.contact.name, title: schema.lead.nextAction,
    dueAt: schema.lead.nextActionAt, completedAt: schema.lead.nextActionCompletedAt })
    .from(schema.lead).innerJoin(schema.contact, eq(schema.contact.id, schema.lead.contactId))
    .where(scoped(schema.lead.organizationId, session.organizationId,
      contactScope(session, schema.lead.contactId),
      parsed.data.leadId ? eq(schema.lead.id, parsed.data.leadId) : isNotNull(schema.lead.nextActionAt)))
    .orderBy(asc(schema.lead.nextActionAt), asc(schema.lead.id));
  return Response.json({ followUps: rows }, { headers: { "Cache-Control": "no-store" } });
});
