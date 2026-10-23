import { eq, sql, like } from "drizzle-orm";
import { schema as S, type getDb } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { estateId } from "./service";

/** Completa únicamente una demo reconocida; nunca sustituye fichas ya existentes. */
export async function seedEstateDemo(
  db: ReturnType<typeof getDb>,
  org: string,
) {
  const [marker] = await db
    .select({ id: S.message.id })
    .from(S.message)
    .where(
      scoped(
        S.message.organizationId,
        org,
        like(S.message.waMessageId, "wamid.demo.%"),
      ),
    )
    .limit(1);
  if (!marker) return { properties: 0 };
  const [advisor] = await db
    .select({ id: S.member.userId })
    .from(S.member)
    .where(scoped(S.member.organizationId, org))
    .limit(1);
  const contacts = await db
    .select()
    .from(S.contact)
    .where(scoped(S.contact.organizationId, org));
  const client = (suffix: number) =>
    contacts.find((c) => c.phone === `3460000000${suffix}`);
  const properties = [
    {
      reference: "MAD-101",
      title: "Piso de tres habitaciones en Chamberí",
      type: "piso",
      city: "Madrid",
      address: "Chamberí · dirección de demostración",
      priceCents: 32500000,
      area: 90,
      rooms: 3,
      bathrooms: 2,
      terrace: false,
      garden: false,
      garage: false,
    },
    {
      reference: "MAD-102",
      title: "Chalet con jardín en Las Rozas",
      type: "chalet",
      city: "Las Rozas",
      address: "Las Rozas · dirección de demostración",
      priceCents: 49500000,
      area: 160,
      rooms: 4,
      bathrooms: 3,
      terrace: true,
      garden: true,
      garage: true,
    },
    {
      reference: "MAD-103",
      title: "Piso familiar en Retiro",
      type: "piso",
      city: "Madrid",
      address: "Retiro · dirección de demostración",
      priceCents: 41000000,
      area: 105,
      rooms: 3,
      bathrooms: 2,
      terrace: false,
      garden: false,
      garage: false,
    },
    {
      reference: "MAD-104",
      title: "Adosado con garaje en Getafe",
      type: "adosado",
      city: "Getafe",
      address: "Getafe · dirección de demostración",
      priceCents: 36500000,
      area: 130,
      rooms: 4,
      bathrooms: 2,
      terrace: true,
      garden: false,
      garage: true,
    },
  ];
  let count = 0;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${org + ":estate"},0))`,
    );
    for (let i = 1; i <= 8; i++) {
      const c = client(i);
      if (!c) continue;
      await tx
        .insert(S.estateClient)
        .values({
          id: c.id,
          organizationId: org,
          role: "comprador",
          assignedUserId: advisor?.id ?? null,
          preferredCity:
            i === 2 || i === 7
              ? "Las Rozas"
              : i === 5
                ? "Getafe"
                : i === 1 || i === 3
                  ? "Madrid"
                  : null,
          budgetMax: i === 2 ? 48000000 : null,
          minRooms: i === 1 || i === 7 ? 3 : null,
        })
        .onConflictDoNothing();
    }
    for (const [index, p] of properties.entries()) {
      const existing = await tx
        .select({ id: S.property.id })
        .from(S.property)
        .where(
          scoped(
            S.property.organizationId,
            org,
            eq(S.property.reference, p.reference),
          ),
        )
        .limit(1);
      if (existing.length) continue;
      const id = estateId("prop"),
        buyer = client(index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : 5);
      await tx.insert(S.property).values({
        id,
        organizationId: org,
        ...p,
        status: index === 2 && buyer ? "reservado" : "disponible",
        assignedUserId: advisor?.id ?? null,
        description:
          "Inmueble ficticio de demostración. Completa la dirección, la propiedad y la documentación antes de utilizar una ficha real.",
      });
      count++;
      if (buyer) {
        const dealId = estateId("deal");
        await tx.insert(S.estateDeal).values({
          id: dealId,
          organizationId: org,
          propertyId: id,
          contactId: buyer.id,
          assignedUserId: advisor?.id ?? null,
          phase: index === 2 ? "reserva" : index === 1 ? "oferta" : "contacto",
          amountCents: index === 1 ? 48000000 : p.priceCents,
          notes:
            "Operación ficticia de demostración vinculada al hilo de ejemplo.",
        });
        if (index === 1 && advisor)
          await tx.insert(S.estateOffer).values({
            id: estateId("offer"),
            organizationId: org,
            dealId,
            kind: "oferta",
            amountCents: 48000000,
            status: "pendiente",
            createdBy: advisor.id,
            notes: "Propuesta ficticia que debe consultar el asesor.",
          });
        if (index === 2 && advisor)
          await tx.insert(S.estateDocument).values({
            id: estateId("doc"),
            organizationId: org,
            entityType: "deal",
            entityId: dealId,
            title: "Contrato de reserva · ejemplo pendiente",
            category: "reserva",
            status: "pendiente",
            visibility: "restringido",
            uploadedBy: advisor.id,
            dueAt: new Date(Date.now() + 7 * 86400000),
          });
      }
    }
  });
  return { properties: count };
}
