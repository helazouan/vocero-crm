import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { canConfigure } from "@/lib/auth/roles";
import type { SessionContext } from "@/lib/auth/session";
import { resolveMembership } from "@/server/auth/on-signup";
import type { SseEvent } from "@/server/events/bus";
import { hasContactAccess, contactScope } from "./access";

export async function canReceivePortfolioEvent(
  session: SessionContext,
  event: SseEvent,
) {
  // El stream sobrevive a una reasignación o retirada de membresía: no reutiliza permisos viejos.
  const membership = await resolveMembership(session.userId);
  if (!membership || membership.organizationId !== session.organizationId)
    return false;
  const s = { ...session, role: membership.role };
  if (event.type === "portfolio.changed") return !canConfigure(s.role);
  if (canConfigure(s.role)) return true;
  if (event.type === "lab.run") return false;
  if (event.type === "conversation.deleted")
    return hasContactAccess(s, event.data.contactId);
  if (event.type === "booking.updated") {
    const [row] = await getDb()
      .select({ id: S.booking.id })
      .from(S.booking)
      .where(
        scoped(
          S.booking.organizationId,
          s.organizationId,
          eq(S.booking.id, event.data.bookingId),
          contactScope(s, S.booking.contactId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  const id =
    event.type === "conversation.updated"
      ? (event.data.conversation as { id?: string } | null)?.id
      : event.data.conversationId;
  if (!id) return false;
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
  return Boolean(row);
}
