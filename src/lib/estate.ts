import { DOCUMENT_TYPES } from "@/lib/estate-documents";
import { wallClock, hhmm } from "@/lib/time/calendar";
import { z } from "zod";
import type * as S from "@/lib/db/schema";

export const PROPERTY_TYPES = [
  "piso",
  "chalet",
  "adosado",
  "casa",
  "ático",
  "estudio",
  "local",
  "terreno",
] as const;
export const PROPERTY_STATES = [
  "disponible",
  "reservado",
  "vendido",
  "retirado",
] as const;
export const DEAL_PHASES = [
  "nuevo",
  "contacto",
  "visita",
  "oferta",
  "reserva",
  "contrato",
  "cerrada",
  "perdida",
] as const;
export const VISIT_STATES = [
  "pendiente",
  "confirmada",
  "realizada",
  "no_presentado",
  "cancelada",
] as const;
export const DOCUMENT_STATES = [
  "pendiente",
  "revisado",
  "pendiente_firma",
  "firmado",
  "rechazado",
] as const;
export const DOCUMENT_CATEGORIES = [
  "contrato",
  "reserva",
  "identificación",
  "nota_simple",
  "certificado",
  "fotografía",
  "otro",
] as const;
export const label = (value: string) =>
  ({
    no_presentado: "No se ha presentado",
    pendiente_firma: "Pendiente de firma",
    nota_simple: "Nota simple",
    nuevo: "Nuevo interesado",
    contacto: "Contacto realizado",
    visita: "Visita",
    oferta: "Oferta",
    reserva: "Reserva",
    contrato: "Contrato",
    cerrada: "Compraventa cerrada",
    perdida: "Operación perdida",
  })[value] ?? value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const text = z.string().trim();
const optionalText = text.max(8000).nullable().default(null);
const id = text.min(1).max(80);
const money = z.number().int().min(0).max(2_000_000_000);
const nullableId = id.nullable().default(null);
export const entitySchema = z.object({
  entityType: z.enum(["property", "client", "deal"]),
  entityId: id,
});
export type EntityType = z.infer<typeof entitySchema>["entityType"];
const propertyFields = z.object({
  id: id.optional(),
  reference: text
    .min(1)
    .max(40)
    .transform((v) => v.toUpperCase()),
  title: text.min(1).max(160),
  type: z.enum(PROPERTY_TYPES),
  status: z.enum(PROPERTY_STATES),
  address: text.min(1).max(250),
  city: text.min(1).max(120),
  postalCode: text
    .regex(/^\d{5}$/, "Código postal de cinco dígitos")
    .nullable()
    .default(null),
  priceCents: money,
  area: z.number().int().min(1).max(1_000_000),
  rooms: z.number().int().min(0).max(100),
  bathrooms: z.number().int().min(0).max(100),
  garden: z.boolean().default(false),
  terrace: z.boolean().default(false),
  garage: z.boolean().default(false),
  description: optionalText,
  ownerContactId: nullableId,
  assignedUserId: nullableId,
});
const clientFields = z.object({
  id: id.optional(),
  name: text.min(1).max(120),
  phone: text
    .regex(/^\+?\d[\d\s]{6,20}$/, "Teléfono con prefijo internacional")
    .nullable()
    .default(null),
  role: z.enum(["comprador", "propietario", "ambos"]),
  email: text.email().max(250).nullable().default(null),
  budgetMin: money.nullable().default(null),
  budgetMax: money.nullable().default(null),
  preferredCity: text.max(120).nullable().default(null),
  minRooms: z.number().int().min(0).max(100).nullable().default(null),
  propertyType: z.enum(PROPERTY_TYPES).nullable().default(null),
  assignedUserId: nullableId,
});
const dealFields = z.object({
  id: id.optional(),
  propertyId: id,
  contactId: id,
  assignedUserId: nullableId,
  phase: z.enum(DEAL_PHASES),
  amountCents: money.nullable().default(null),
  notes: optionalText,
  lostReason: text.max(1000).nullable().default(null),
});
const visitFields = z.object({
  id: id.optional(),
  propertyId: id,
  contactId: id,
  assignedUserId: id,
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(480),
  status: z.enum(VISIT_STATES),
  notes: optionalText,
});
export const mutationSchema = z.discriminatedUnion("operation", [
  propertyFields.extend({ operation: z.literal("property") }),
  clientFields.extend({ operation: z.literal("client") }),
  dealFields.extend({ operation: z.literal("deal") }),
  visitFields.extend({ operation: z.literal("visit") }),
  z.object({
    operation: z.literal("offer"),
    id: id.optional(),
    dealId: id,
    kind: z.enum(["oferta", "contraoferta"]),
    amountCents: money.min(1),
    status: z.enum(["pendiente", "aceptada", "rechazada"]),
    notes: optionalText,
  }),
  entitySchema.extend({
    operation: z.literal("activity"),
    kind: z.enum(["nota", "llamada", "reunión", "correo"]),
    text: text.min(1).max(4000),
  }),
  entitySchema.extend({
    operation: z.literal("document"),
    id: id.optional(),
    title: text.min(1).max(180),
    documentType: z.enum(DOCUMENT_TYPES).default("sin_clasificar"),
    subjectContactId: nullableId,
    propertyId: nullableId,
    dealId: nullableId,
    fulfilsDocumentId: nullableId,
    reviewNote: optionalText,
    category: z.enum(DOCUMENT_CATEGORIES).default("otro"),
    status: z.enum(DOCUMENT_STATES),
    visibility: z.enum(["equipo", "restringido"]),
    dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  }),
]);
export type EstateMutation = z.infer<typeof mutationSchema>;
type JsonRow<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};
export type Property = JsonRow<typeof S.property.$inferSelect>;
export type Deal = JsonRow<typeof S.estateDeal.$inferSelect>;
export type Offer = JsonRow<typeof S.estateOffer.$inferSelect>;
export type Visit = JsonRow<typeof S.estateVisit.$inferSelect>;
export type Document = Omit<
  JsonRow<typeof S.estateDocument.$inferSelect>,
  "storageId"
> & { hasFile: boolean };
export type Activity = JsonRow<typeof S.estateActivity.$inferSelect>;
export type Client = Omit<
  JsonRow<typeof S.estateClient.$inferSelect>,
  "updatedAt"
> & {
  name: string;
  phone: string | null;
  notes: string | null;
  leadId: string | null;
  archivedAt: string | null;
};
export type EstateData = {
  properties: Property[];
  clients: Client[];
  deals: Deal[];
  offers: Offer[];
  visits: Visit[];
  documents: Document[];
  activity: Activity[];
  team: { id: string; name: string }[];
  canManage: boolean;
  userId: string;
};

export function matchingProperties(
  client: Pick<
    Client,
    "budgetMin" | "budgetMax" | "preferredCity" | "minRooms" | "propertyType"
  >,
  properties: Property[],
) {
  return properties.filter(
    (p) =>
      p.status === "disponible" &&
      (client.budgetMin == null || p.priceCents >= client.budgetMin) &&
      (client.budgetMax == null || p.priceCents <= client.budgetMax) &&
      (client.minRooms == null || p.rooms >= client.minRooms) &&
      (!client.propertyType || p.type === client.propertyType) &&
      (!client.preferredCity ||
        client.preferredCity
          .split(",")
          .filter((city) => city.trim())
          .some((city) =>
            p.city
              .toLocaleLowerCase("es")
              .includes(city.trim().toLocaleLowerCase("es")),
          )),
  );
}
export function overlaps(
  a: { startsAt: string; durationMinutes: number },
  b: { startsAt: string; durationMinutes: number },
) {
  return (
    Date.parse(a.startsAt) <
      Date.parse(b.startsAt) + b.durationMinutes * 60000 &&
    Date.parse(b.startsAt) < Date.parse(a.startsAt) + a.durationMinutes * 60000
  );
}

export function estateDateTime(instant: string, timezone = "Europe/Madrid") {
  const clock = wallClock(instant, timezone);
  return {
    date: clock.day,
    time: hhmm(clock.minutes),
    weekday: new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date(instant)),
  };
}
