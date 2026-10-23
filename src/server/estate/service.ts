import { normalizeMx } from "@/lib/meta/client";
import { createLeadForContact } from "@/server/inbox/lead-activity";
import { desc, eq, sql, and } from "drizzle-orm";
import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { newId } from "@/lib/db/ids";
import { canConfigure } from "@/lib/auth/roles";
import type { SessionContext } from "@/lib/auth/session";
import { overlaps, type EntityType, type EstateMutation } from "@/lib/estate";

type Store = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update" | "execute"
>;
export const estateId = (prefix: string) =>
  `${prefix}_${newId("contact").slice(3)}`;
export class EstateError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new EstateError(status, message);
}
export async function requireEntity(
  db: Store,
  org: string,
  type: EntityType,
  id: string,
) {
  const table =
    type === "property"
      ? S.property
      : type === "client"
        ? S.contact
        : S.estateDeal;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(scoped(table.organizationId, org, eq(table.id, id)))
    .limit(1);
  if (!row) fail(404, "El registro no existe en tu organización");
}
async function member(db: Store, org: string, id: string | null) {
  if (!id) return;
  const [row] = await db
    .select({ id: S.member.id })
    .from(S.member)
    .where(and(eq(S.member.organizationId, org), eq(S.member.userId, id)))
    .limit(1);
  if (!row) fail(422, "El asesor debe pertenecer a tu organización");
}
export async function activity(
  db: Store,
  s: SessionContext,
  type: string,
  id: string,
  kind: string,
  text: string,
) {
  await db.insert(S.estateActivity).values({
    id: estateId("act"),
    organizationId: s.organizationId,
    entityType: type,
    entityId: id,
    kind,
    text,
    actorId: s.userId,
  });
}
export function canReadDocument(
  s: SessionContext,
  doc: { visibility: string; uploadedBy: string },
) {
  return (
    canConfigure(s.role) ||
    doc.visibility === "equipo" ||
    doc.uploadedBy === s.userId
  );
}
export async function documentRow(
  s: SessionContext,
  id: string,
  store: Store = getDb(),
) {
  const [doc] = await store
    .select()
    .from(S.estateDocument)
    .where(
      scoped(
        S.estateDocument.organizationId,
        s.organizationId,
        eq(S.estateDocument.id, id),
      ),
    )
    .limit(1);
  if (!doc || !canReadDocument(s, doc)) fail(404, "Documento no encontrado");
  return doc;
}
export async function getEstateData(s: SessionContext) {
  const db = getDb(),
    org = s.organizationId;
  const [
    properties,
    profiles,
    contacts,
    deals,
    offers,
    visits,
    docs,
    events,
    team,
    leads,
  ] = await Promise.all([
    db
      .select()
      .from(S.property)
      .where(scoped(S.property.organizationId, org))
      .orderBy(desc(S.property.updatedAt)),
    db
      .select()
      .from(S.estateClient)
      .where(scoped(S.estateClient.organizationId, org)),
    db
      .select()
      .from(S.contact)
      .where(scoped(S.contact.organizationId, org))
      .orderBy(S.contact.name),
    db
      .select()
      .from(S.estateDeal)
      .where(scoped(S.estateDeal.organizationId, org))
      .orderBy(desc(S.estateDeal.updatedAt)),
    db
      .select()
      .from(S.estateOffer)
      .where(scoped(S.estateOffer.organizationId, org))
      .orderBy(desc(S.estateOffer.createdAt)),
    db
      .select()
      .from(S.estateVisit)
      .where(scoped(S.estateVisit.organizationId, org))
      .orderBy(S.estateVisit.startsAt),
    db
      .select()
      .from(S.estateDocument)
      .where(scoped(S.estateDocument.organizationId, org))
      .orderBy(desc(S.estateDocument.createdAt)),
    db
      .select()
      .from(S.estateActivity)
      .where(scoped(S.estateActivity.organizationId, org))
      .orderBy(desc(S.estateActivity.createdAt)),
    db
      .select({ id: S.user.id, name: S.user.name })
      .from(S.member)
      .innerJoin(S.user, eq(S.member.userId, S.user.id))
      .where(scoped(S.member.organizationId, org)),
    db
      .select({ id: S.lead.id, contactId: S.lead.contactId })
      .from(S.lead)
      .where(scoped(S.lead.organizationId, org)),
  ]);
  const visibleDocs = docs.filter((d) => canReadDocument(s, d));
  const allowedDocIds = new Set(visibleDocs.map((d) => d.id));
  return {
    properties,
    deals,
    offers,
    visits,
    team,
    userId: s.userId,
    canManage: canConfigure(s.role),
    clients: contacts.map((c) => ({
      id: c.id,
      organizationId: org,
      role: "sin_clasificar",
      email: null,
      budgetMin: null,
      budgetMax: null,
      preferredCity: null,
      minRooms: null,
      propertyType: null,
      assignedUserId: null,
      ...profiles.find((p) => p.id === c.id),
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      archivedAt: c.archivedAt,
      leadId: leads.find((l) => l.contactId === c.id)?.id ?? null,
    })),
    documents: visibleDocs.map(({ storageId, ...d }) => ({
      ...d,
      hasFile: Boolean(storageId),
    })),
    activity: events.filter(
      (e) => e.entityType !== "document" || allowedDocIds.has(e.entityId),
    ),
  };
}

export async function mutate(s: SessionContext, input: EstateMutation) {
  const org = s.organizationId;
  const result = await getDb().transaction(async (db) => {
    // Las visitas y reservas del negocio se validan y escriben bajo el mismo candado.
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${org + ":estate"}, 0))`,
    );
    if (input.operation === "activity") {
      await requireEntity(db, org, input.entityType, input.entityId);
      await activity(
        db,
        s,
        input.entityType,
        input.entityId,
        input.kind,
        input.text,
      );
      return { id: input.entityId };
    }
    if (input.operation === "client") {
      const { operation: _op, id: provided, name, phone, ...profile } = input;
      if (
        profile.budgetMin != null &&
        profile.budgetMax != null &&
        profile.budgetMin > profile.budgetMax
      )
        fail(422, "El presupuesto mínimo supera al máximo");
      await member(db, org, profile.assignedUserId);
      const id = provided ?? newId("contact");
      const normalized = phone ? normalizeMx(phone.replace(/\D/g, "")) : null;
      if (provided) {
        await requireEntity(db, org, "client", id);
        await db
          .update(S.contact)
          .set({ name, nameSource: "manual", updatedAt: new Date() })
          .where(scoped(S.contact.organizationId, org, eq(S.contact.id, id)));
        const [old] = await db
          .select({ phone: S.contact.phone })
          .from(S.contact)
          .where(scoped(S.contact.organizationId, org, eq(S.contact.id, id)));
        if (old?.phone !== normalized)
          fail(
            422,
            "Edita el teléfono desde Contactos para conservar la identidad de la conversación",
          );
      } else {
        if (normalized) {
          const [duplicate] = await db
            .select({ id: S.contact.id })
            .from(S.contact)
            .where(
              scoped(
                S.contact.organizationId,
                org,
                eq(S.contact.phone, normalized),
              ),
            )
            .limit(1);
          if (duplicate)
            fail(
              409,
              "Ya existe ese teléfono. Abre su ficha de cliente para completarla",
            );
        }
        await db.insert(S.contact).values({
          id,
          organizationId: org,
          name,
          nameSource: "manual",
          phone: normalized,
          waIdentity: normalized ?? `manual:${id}`,
        });
      }
      await db
        .insert(S.estateClient)
        .values({ id, organizationId: org, ...profile })
        .onConflictDoUpdate({
          target: S.estateClient.id,
          set: { ...profile, updatedAt: new Date() },
        });
      await activity(
        db,
        s,
        "client",
        id,
        provided ? "modificación" : "alta",
        provided ? "Ficha del cliente actualizada" : "Cliente incorporado",
      );
      return { id };
    }
    if (input.operation === "property") {
      const { operation: _op, id: provided, ...values } = input;
      await member(db, org, values.assignedUserId);
      if (values.ownerContactId)
        await requireEntity(db, org, "client", values.ownerContactId);
      const existing = await db
        .select({ id: S.property.id })
        .from(S.property)
        .where(
          scoped(
            S.property.organizationId,
            org,
            eq(S.property.reference, values.reference),
          ),
        )
        .limit(1);
      if (existing[0] && existing[0].id !== provided)
        fail(409, "Ya existe un inmueble con esa referencia");
      const id = provided ?? estateId("prop");
      if (provided) {
        await requireEntity(db, org, "property", id);
        const exclusive = await db
          .select()
          .from(S.estateDeal)
          .where(
            scoped(
              S.estateDeal.organizationId,
              org,
              eq(S.estateDeal.propertyId, id),
            ),
          );
        const active = exclusive.find((d) =>
          ["reserva", "contrato", "cerrada"].includes(d.phase),
        );
        if (
          active &&
          values.status !==
            (active.phase === "cerrada" ? "vendido" : "reservado")
        )
          fail(
            409,
            "El estado está vinculado a una operación reservada o cerrada. Actualiza primero la operación",
          );
        await db
          .update(S.property)
          .set({ ...values, updatedAt: new Date() })
          .where(scoped(S.property.organizationId, org, eq(S.property.id, id)));
      } else
        await db
          .insert(S.property)
          .values({ id, organizationId: org, ...values });
      await activity(
        db,
        s,
        "property",
        id,
        provided ? "modificación" : "alta",
        `${provided ? "Actualizado" : "Incorporado"}: ${values.reference}`,
      );
      return { id };
    }
    if (input.operation === "deal") {
      const { operation: _op, id: provided, ...values } = input;
      await requireEntity(db, org, "property", values.propertyId);
      await requireEntity(db, org, "client", values.contactId);
      await member(db, org, values.assignedUserId);
      const id = provided ?? estateId("deal");
      const [property] = await db
        .select()
        .from(S.property)
        .where(
          scoped(
            S.property.organizationId,
            org,
            eq(S.property.id, values.propertyId),
          ),
        );
      let old: typeof S.estateDeal.$inferSelect | undefined;
      if (provided) {
        [old] = await db
          .select()
          .from(S.estateDeal)
          .where(
            scoped(S.estateDeal.organizationId, org, eq(S.estateDeal.id, id)),
          );
        if (!old) fail(404, "Operación no encontrada");
        if (
          old.propertyId !== values.propertyId ||
          old.contactId !== values.contactId
        )
          fail(
            422,
            "La vivienda y el comprador de una operación no pueden cambiarse",
          );
      }
      if (values.phase === "perdida" && !values.lostReason?.trim())
        fail(422, "Indica el motivo de pérdida");
      const peers = await db
        .select()
        .from(S.estateDeal)
        .where(
          scoped(
            S.estateDeal.organizationId,
            org,
            eq(S.estateDeal.propertyId, values.propertyId),
          ),
        );
      const exclusive = ["reserva", "contrato", "cerrada"].includes(
        values.phase,
      );
      if (
        exclusive &&
        peers.some(
          (d) =>
            d.id !== id && ["reserva", "contrato", "cerrada"].includes(d.phase),
        )
      )
        fail(409, "La vivienda ya tiene otra operación reservada o cerrada");
      if (!old && ["vendido", "retirado"].includes(property!.status))
        fail(409, "La vivienda no está en comercialización");
      if (provided)
        await db
          .update(S.estateDeal)
          .set({ ...values, updatedAt: new Date() })
          .where(
            scoped(S.estateDeal.organizationId, org, eq(S.estateDeal.id, id)),
          );
      else
        await db
          .insert(S.estateDeal)
          .values({ id, organizationId: org, ...values });
      if (
        exclusive ||
        (old && ["reserva", "contrato", "cerrada"].includes(old.phase))
      )
        await db
          .update(S.property)
          .set({
            status:
              values.phase === "cerrada"
                ? "vendido"
                : exclusive
                  ? "reservado"
                  : "disponible",
            updatedAt: new Date(),
          })
          .where(
            scoped(
              S.property.organizationId,
              org,
              eq(S.property.id, values.propertyId),
            ),
          );
      await activity(
        db,
        s,
        "deal",
        id,
        "operación",
        `${old ? "Actualizada" : "Abierta"} operación · ${values.phase}`,
      );
      return { id };
    }
    if (input.operation === "offer") {
      const { operation: _op, id: provided, ...values } = input;
      await requireEntity(db, org, "deal", values.dealId);
      const id = provided ?? estateId("offer");
      if (provided) {
        const [old] = await db
          .select()
          .from(S.estateOffer)
          .where(
            scoped(S.estateOffer.organizationId, org, eq(S.estateOffer.id, id)),
          );
        if (!old || old.dealId !== values.dealId)
          fail(404, "Oferta no encontrada");
        if (old.amountCents !== values.amountCents || old.kind !== values.kind)
          fail(
            422,
            "Registra una nueva contraoferta para conservar el importe anterior",
          );
        await db
          .update(S.estateOffer)
          .set({ status: values.status, notes: values.notes })
          .where(
            scoped(S.estateOffer.organizationId, org, eq(S.estateOffer.id, id)),
          );
      } else
        await db
          .insert(S.estateOffer)
          .values({ id, organizationId: org, createdBy: s.userId, ...values });
      await activity(
        db,
        s,
        "deal",
        values.dealId,
        "oferta",
        `${values.kind}: ${(values.amountCents / 100).toLocaleString("es-ES")} € · ${values.status}`,
      );
      return { id };
    }
    if (input.operation === "visit") {
      const { operation: _op, id: provided, startsAt, ...values } = input;
      await requireEntity(db, org, "property", values.propertyId);
      await requireEntity(db, org, "client", values.contactId);
      await member(db, org, values.assignedUserId);
      const id = provided ?? estateId("visit");
      const visits = await db
        .select()
        .from(S.estateVisit)
        .where(scoped(S.estateVisit.organizationId, org));
      if (provided && !visits.some((v) => v.id === id))
        fail(404, "Visita no encontrada");
      if (
        ["pendiente", "confirmada", "realizada"].includes(values.status) &&
        visits.some(
          (v) =>
            v.id !== id &&
            ["pendiente", "confirmada", "realizada"].includes(v.status) &&
            (v.assignedUserId === values.assignedUserId ||
              v.propertyId === values.propertyId) &&
            overlaps(
              { startsAt, durationMinutes: values.durationMinutes },
              {
                startsAt: v.startsAt.toISOString(),
                durationMinutes: v.durationMinutes,
              },
            ),
        )
      )
        fail(409, "La visita se solapa con otra del asesor o de la vivienda");
      if (provided)
        await db
          .update(S.estateVisit)
          .set({
            ...values,
            startsAt: new Date(startsAt),
            updatedAt: new Date(),
          })
          .where(
            scoped(S.estateVisit.organizationId, org, eq(S.estateVisit.id, id)),
          );
      else
        await db.insert(S.estateVisit).values({
          id,
          organizationId: org,
          ...values,
          startsAt: new Date(startsAt),
        });
      await activity(
        db,
        s,
        "property",
        values.propertyId,
        "visita",
        `${provided ? "Actualizada" : "Concertada"} visita · ${values.status} · ${new Date(startsAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`,
      );
      await activity(
        db,
        s,
        "client",
        values.contactId,
        "visita",
        `${provided ? "Actualizada" : "Concertada"} visita para ${values.propertyId} · ${values.status}`,
      );
      return { id };
    }
    if (input.operation === "document") {
      const { operation: _op, id: provided, dueAt, ...values } = input;
      await requireEntity(db, org, values.entityType, values.entityId);
      const id = provided ?? estateId("doc");
      if (values.status === "firmado" && !provided)
        fail(422, "Incorpora primero el archivo firmado");
      if (provided) {
        const old = await documentRow(s, id, db);
        const [next] = await db
          .select({ id: S.estateDocument.id })
          .from(S.estateDocument)
          .where(
            scoped(
              S.estateDocument.organizationId,
              org,
              eq(S.estateDocument.previousId, id),
            ),
          )
          .limit(1);
        if (next)
          fail(
            409,
            "Esta versión ya está cerrada. Edita la última versión del documento",
          );
        if (values.status === "firmado" && !old.storageId)
          fail(422, "Incorpora primero el archivo firmado");
        if (!canConfigure(s.role) && old.uploadedBy !== s.userId)
          fail(
            403,
            "Solo el autor o un administrador puede modificar el documento",
          );
        if (
          old.entityType !== values.entityType ||
          old.entityId !== values.entityId
        )
          fail(422, "No se puede trasladar un documento a otro expediente");
        await db
          .update(S.estateDocument)
          .set({
            ...values,
            dueAt: dueAt ? new Date(dueAt) : null,
            updatedAt: new Date(),
          })
          .where(
            scoped(
              S.estateDocument.organizationId,
              org,
              eq(S.estateDocument.id, id),
            ),
          );
      } else
        await db.insert(S.estateDocument).values({
          id,
          organizationId: org,
          uploadedBy: s.userId,
          ...values,
          dueAt: dueAt ? new Date(dueAt) : null,
        });
      await activity(
        db,
        s,
        "document",
        id,
        "documento",
        `${provided ? "Actualizado" : "Solicitado"}: ${values.title}`,
      );
      return { id };
    }
    return fail(422, "Acción desconocida");
  });
  if (input.operation === "client")
    await createLeadForContact({
      organizationId: org,
      contactId: result.id,
      source: "dueno",
      actorUserId: s.userId,
    });
  return result;
}
