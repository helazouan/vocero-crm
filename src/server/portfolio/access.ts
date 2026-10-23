import { eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { SessionContext } from "@/lib/auth/session";
import { canConfigure } from "@/lib/auth/roles";

export class PortfolioError extends Error {
  readonly status = 404;
  constructor() {
    super("Registro no encontrado");
  }
}
export function contactScope(
  s: SessionContext,
  contactId: SQLWrapper,
): SQL | undefined {
  if (canConfigure(s.role)) return undefined;
  return sql`exists (select 1 from estate_client cartera where cartera.organization_id = ${s.organizationId} and cartera.id = ${contactId} and cartera.assigned_user_id = ${s.userId})`;
}
export async function hasContactAccess(
  s: SessionContext,
  id: string | null,
  db: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  if (!id) return false;
  const [row] = await db
    .select({ id: S.contact.id })
    .from(S.contact)
    .where(
      scoped(
        S.contact.organizationId,
        s.organizationId,
        eq(S.contact.id, id),
        contactScope(s, S.contact.id),
      ),
    )
    .limit(1);
  return Boolean(row);
}
export async function assertContactAccess(
  s: SessionContext,
  id: string | null,
  db?: Pick<ReturnType<typeof getDb>, "select">,
) {
  if (!(await hasContactAccess(s, id, db))) throw new PortfolioError();
}
export async function assertConversationAccess(s: SessionContext, id: string) {
  const [row] = await getDb()
    .select({ id: S.conversation.id })
    .from(S.conversation)
    .where(
      scoped(
        S.conversation.organizationId,
        s.organizationId,
        eq(S.conversation.id, id),
        contactScope(s, S.conversation.contactId),
      ),
    )
    .limit(1);
  if (!row) throw new PortfolioError();
}
export async function assertLeadAccess(s: SessionContext, id: string) {
  const [row] = await getDb()
    .select({ id: S.lead.id })
    .from(S.lead)
    .where(
      scoped(
        S.lead.organizationId,
        s.organizationId,
        eq(S.lead.id, id),
        contactScope(s, S.lead.contactId),
      ),
    )
    .limit(1);
  if (!row) throw new PortfolioError();
}
export async function assertBookingAccess(s: SessionContext, id: string) {
  const [row] = await getDb()
    .select({ id: S.booking.id })
    .from(S.booking)
    .where(
      scoped(
        S.booking.organizationId,
        s.organizationId,
        eq(S.booking.id, id),
        contactScope(s, S.booking.contactId),
      ),
    )
    .limit(1);
  if (!row) throw new PortfolioError();
}
type DocumentOwner = Pick<
  typeof S.estateDocument.$inferSelect,
  "entityType" | "entityId" | "subjectContactId" | "dealId" | "propertyId"
>;
export async function documentClientId(
  s: SessionContext,
  d: DocumentOwner,
  db: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  if (d.subjectContactId) return d.subjectContactId;
  if (d.entityType === "client") return d.entityId;
  const dealId = d.dealId ?? (d.entityType === "deal" ? d.entityId : null);
  if (dealId) {
    const [deal] = await db
      .select({ contactId: S.estateDeal.contactId })
      .from(S.estateDeal)
      .where(
        scoped(
          S.estateDeal.organizationId,
          s.organizationId,
          eq(S.estateDeal.id, dealId),
        ),
      )
      .limit(1);
    if (deal) return deal.contactId;
  }
  const propertyId =
    d.propertyId ?? (d.entityType === "property" ? d.entityId : null);
  if (propertyId) {
    const [property] = await db
      .select({ owner: S.property.ownerContactId })
      .from(S.property)
      .where(
        scoped(
          S.property.organizationId,
          s.organizationId,
          eq(S.property.id, propertyId),
        ),
      )
      .limit(1);
    return property?.owner ?? null;
  }
  return null;
}
export async function canAccessDocument(
  s: SessionContext,
  d: DocumentOwner,
  db?: Pick<ReturnType<typeof getDb>, "select">,
) {
  return (
    canConfigure(s.role) ||
    hasContactAccess(s, await documentClientId(s, d, db), db)
  );
}
export async function assertMediaAccess(s: SessionContext, assetId: string) {
  if (canConfigure(s.role)) return;
  const db = getDb();
  const docs = await db
    .select()
    .from(S.estateDocument)
    .where(
      scoped(
        S.estateDocument.organizationId,
        s.organizationId,
        eq(S.estateDocument.sourceMediaAssetId, assetId),
      ),
    );
  for (const doc of docs)
    if (!(await canAccessDocument(s, doc))) throw new PortfolioError();
  const [message] = await db
    .select({ id: S.message.id })
    .from(S.message)
    .innerJoin(S.conversation, eq(S.conversation.id, S.message.conversationId))
    .where(
      scoped(
        S.message.organizationId,
        s.organizationId,
        eq(S.conversation.organizationId, s.organizationId),
        eq(S.message.mediaAssetId, assetId),
        contactScope(s, S.conversation.contactId),
      ),
    )
    .limit(1);
  if (message) return;
  const [ad] = await db
    .select({ id: S.adAttribution.id })
    .from(S.adAttribution)
    .where(
      scoped(
        S.adAttribution.organizationId,
        s.organizationId,
        eq(S.adAttribution.imageAssetId, assetId),
        contactScope(s, S.adAttribution.contactId),
      ),
    )
    .limit(1);
  if (!ad) throw new PortfolioError();
}
