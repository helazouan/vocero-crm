import { getTableColumns, getTableName, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { SessionContext } from "@/lib/auth/session";
import { canConfigure } from "@/lib/auth/roles";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { guardarMedia, leerMedia, borrarMedia } from "@/lib/storage/medios";
import { activity, estateId, fail } from "./service";
import { overlaps } from "@/lib/estate";

const tables = {
  contactos: S.contact,
  clientes: S.estateClient,
  inmuebles: S.property,
  operaciones: S.estateDeal,
  ofertas: S.estateOffer,
  visitas: S.estateVisit,
  documentos: S.estateDocument,
  actividad: S.estateActivity,
};
const envelope = z
  .object({
    format: z.literal("vocero-estate-1"),
    organizationId: z.string(),
    payload: z.object({
      cipher: z.string().max(70_000_000),
      iv: z.string().length(16),
      tag: z.string().length(24),
    }),
  })
  .strict();
const payloadSchema = z
  .object({
    rows: z.record(z.array(z.record(z.unknown())).max(50000)),
    files: z.record(z.string().max(20_000_000)),
    createdAt: z.string().datetime(),
  })
  .strict();
const contactKeys = new Set([
  "id",
  "organizationId",
  "channel",
  "waIdentity",
  "phone",
  "name",
  "nameSource",
  "notes",
  "createdAt",
  "updatedAt",
]);
const MAX_BACKUP = 50 * 1024 * 1024;
function requireAdmin(s: SessionContext) {
  if (!canConfigure(s.role))
    fail(403, "Solo un administrador puede exportar o restaurar copias");
}
export async function exportBackup(s: SessionContext) {
  requireAdmin(s);
  const rows: Record<string, Record<string, unknown>[]> = {};
  await getDb().transaction(async (db) => {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${s.organizationId + ":estate"},0))`,
    );
    for (const [name, table] of Object.entries(tables)) {
      const values = await db
        .select()
        .from(table)
        .where(scoped(table.organizationId, s.organizationId));
      rows[name] =
        name === "contactos"
          ? values.map((row) =>
              Object.fromEntries(
                Object.entries(row).filter(([key]) => contactKeys.has(key)),
              ),
            )
          : values;
    }
  });
  const files: Record<string, string> = {};
  let bytes = 0;
  for (const doc of rows.documentos ?? []) {
    if (typeof doc.storageId !== "string" || files[doc.storageId]) continue;
    let file: Buffer;
    try {
      file = await leerMedia(s.organizationId, doc.storageId);
    } catch {
      return fail(
        409,
        "Falta un archivo. Recupera el volumen de medios antes de exportar una copia completa",
      );
    }
    bytes += file.length;
    if (bytes > 25 * 1024 * 1024)
      fail(
        413,
        "Los archivos superan el límite de esta copia. Usa la copia completa de PostgreSQL y medios",
      );
    files[doc.storageId] = file.toString("base64");
  }
  const result = {
    format: "vocero-estate-1",
    organizationId: s.organizationId,
    payload: encryptSecret(
      JSON.stringify({ rows, files, createdAt: new Date().toISOString() }),
    ),
  };
  const json = JSON.stringify(result);
  if (Buffer.byteLength(json) > MAX_BACKUP)
    fail(
      413,
      "La copia supera los 50 MiB. Usa la copia completa de PostgreSQL y medios",
    );
  return json;
}
export async function restoreBackup(
  s: SessionContext,
  raw: unknown,
  confirm: boolean,
) {
  requireAdmin(s);
  const box = envelope.safeParse(raw);
  if (!box.success) fail(422, "Formato de copia no reconocido");
  if (box.data.organizationId !== s.organizationId)
    fail(422, "La copia pertenece a otra organización");
  let decoded: unknown;
  try {
    decoded = JSON.parse(decryptSecret(box.data.payload));
  } catch {
    return fail(422, "Copia dañada o cifrada con otra clave de instalación");
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) fail(422, "La copia no contiene expedientes válidos");
  const { rows, files } = parsed.data;
  const counts: Record<string, number> = {};
  // El contenido autenticado procede del exportador; se comprueba además su forma contra el esquema actual.
  for (const [name, table] of Object.entries(tables)) {
    const values = rows[name];
    if (name === "documentos" && values)
      for (const row of values) {
        for (const key of [
          "subjectContactId",
          "propertyId",
          "dealId",
          "fulfilsDocumentId",
          "sourceWaMessageId",
          "sourceMediaAssetId",
          "intakeError",
          "reviewNote",
        ])
          row[key] ??= null;
        row.documentType ??= "sin_clasificar";
        row.source ??= "manual";
      }

    if (!values) fail(422, "La copia está incompleta");
    counts[name] = values.length;
    const columns: Record<
      string,
      { name: string; dataType: string; notNull: boolean }
    > = getTableColumns(table);
    const ids = new Set<string>();
    for (const row of values) {
      if (
        row.organizationId !== s.organizationId ||
        typeof row.id !== "string" ||
        ids.has(row.id)
      )
        fail(422, "Organización o identificadores inválidos en la copia");
      ids.add(row.id);
      for (const [key, col] of Object.entries(columns)) {
        if (name === "contactos" && !contactKeys.has(key)) continue;
        const value = row[key];
        if (value == null) {
          if (col.notNull) fail(422, "Faltan campos obligatorios en la copia");
          continue;
        }
        const valid =
          col.dataType === "date"
            ? typeof value === "string" && Number.isFinite(Date.parse(value))
            : col.dataType === "number"
              ? typeof value === "number" && Number.isFinite(value)
              : col.dataType === "boolean"
                ? typeof value === "boolean"
                : col.dataType === "string"
                  ? typeof value === "string"
                  : false;
        if (!valid) fail(422, "La copia no es compatible con el modelo actual");
      }
    }
  }
  for (const doc of rows.documentos!) {
    if (doc.storageId) {
      if (
        typeof doc.storageId !== "string" ||
        !/^file_[\w-]+$/.test(doc.storageId) ||
        !files[doc.storageId]
      )
        fail(422, "Faltan archivos en la copia");
      try {
        decryptSecret(
          JSON.parse(Buffer.from(files[doc.storageId]!, "base64").toString()),
        );
      } catch {
        return fail(422, "Un archivo de la copia está dañado");
      }
    }
  }
  const members = await getDb()
    .select({ id: S.member.userId })
    .from(S.member)
    .where(eq(S.member.organizationId, s.organizationId));
  const allowed = new Set(members.map((m) => m.id));
  for (const values of Object.values(rows))
    for (const row of values)
      for (const key of [
        "assignedUserId",
        "uploadedBy",
        "createdBy",
        "actorId",
      ])
        if (row[key] && !allowed.has(String(row[key])))
          fail(
            422,
            "La copia contiene responsables que ya no pertenecen al equipo",
          );
  const has = (table: string, id: unknown) =>
    rows[table]!.some((row) => row.id === id);
  for (const row of rows.clientes!)
    if (!has("contactos", row.id))
      fail(422, "Falta un contacto del expediente");
  for (const row of rows.inmuebles!)
    if (row.ownerContactId && !has("contactos", row.ownerContactId))
      fail(422, "Falta un propietario");
  for (const row of [...rows.operaciones!, ...rows.visitas!])
    if (!has("inmuebles", row.propertyId) || !has("contactos", row.contactId))
      fail(422, "Falta la vivienda o el cliente de una operación o visita");
  for (const row of rows.ofertas!)
    if (!has("operaciones", row.dealId))
      fail(422, "Falta una operación de las ofertas");
  for (const row of rows.documentos!)
    if (
      !has(
        row.entityType === "property"
          ? "inmuebles"
          : row.entityType === "client"
            ? "contactos"
            : "operaciones",
        row.entityId,
      ) ||
      (row.previousId && !has("documentos", row.previousId))
    )
      fail(422, "El documento no tiene expediente o versión anterior");
  for (const row of rows.documentos!) {
    if (row.subjectContactId && !has("contactos", row.subjectContactId))
      fail(422, "Falta el cliente de un documento");
    if (row.propertyId && !has("inmuebles", row.propertyId))
      fail(422, "Falta el inmueble de un documento");
    if (row.dealId && !has("operaciones", row.dealId))
      fail(422, "Falta la operación de un documento");
    if (row.fulfilsDocumentId && !has("documentos", row.fulfilsDocumentId))
      fail(422, "Falta la solicitud de un documento");
  }
  if (!confirm) return { counts };
  const written: string[] = [];
  const remap = new Map<string, string>();
  try {
    for (const doc of rows.documentos!) {
      if (typeof doc.storageId !== "string") continue;
      const old = doc.storageId;
      let id = remap.get(old);
      if (!id) {
        id = estateId("file");
        await guardarMedia(
          s.organizationId,
          id,
          Buffer.from(files[old]!, "base64"),
          "application/octet-stream",
        );
        written.push(id);
        remap.set(old, id);
      }
      doc.storageId = id;
    }
    await getDb().transaction(async (db) => {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${s.organizationId + ":estate"},0))`,
      );
      for (const [name, table] of Object.entries(tables)) {
        const columns: Record<
          string,
          { name: string; dataType: string; notNull: boolean }
        > = getTableColumns(table);
        for (const row of rows[name]!) {
          if (name === "contactos") {
            const [old] = await db
              .select({
                waIdentity: S.contact.waIdentity,
                channel: S.contact.channel,
              })
              .from(S.contact)
              .where(
                scoped(
                  S.contact.organizationId,
                  s.organizationId,
                  eq(S.contact.id, String(row.id)),
                ),
              );
            if (
              old &&
              (old.waIdentity !== row.waIdentity || old.channel !== row.channel)
            )
              fail(
                409,
                "La identidad de un contacto cambió. Revisa esa ficha antes de restaurar",
              );
          }
          const keys = Object.keys(row).filter(
            (key) =>
              key in columns && (name !== "contactos" || contactKeys.has(key)),
          );
          const assignments = keys
            .filter((key) => key !== "id" && key !== "organizationId")
            .map(
              (key) =>
                sql`${sql.identifier(columns[key]!.name)}=excluded.${sql.identifier(columns[key]!.name)}`,
            );
          const result = await db.execute(
            sql`insert into ${sql.identifier(getTableName(table))} (${sql.join(
              keys.map((key) => sql.identifier(columns[key]!.name)),
              sql`,`,
            )}) values (${sql.join(
              keys.map((key) => sql`${row[key]}`),
              sql`,`,
            )}) on conflict (id) do update set ${sql.join(assignments, sql`,`)} where ${scoped(table.organizationId, s.organizationId)} returning id`,
          );
          if (!result.length)
            fail(
              409,
              "Un identificador de la copia pertenece a otra organización",
            );
        }
      }
      const visits = await db
        .select()
        .from(S.estateVisit)
        .where(scoped(S.estateVisit.organizationId, s.organizationId));
      const active = visits.filter((v) =>
        ["pendiente", "confirmada", "realizada"].includes(v.status),
      );
      for (let i = 0; i < active.length; i++)
        for (const b of active.slice(i + 1)) {
          const a = active[i]!;
          if (
            (a.propertyId === b.propertyId ||
              a.assignedUserId === b.assignedUserId) &&
            overlaps(
              { ...a, startsAt: a.startsAt.toISOString() },
              { ...b, startsAt: b.startsAt.toISOString() },
            )
          )
            fail(
              409,
              "La copia solapa visitas posteriores. Reprograma esas visitas antes de restaurar",
            );
        }
      const deals = await db
        .select()
        .from(S.estateDeal)
        .where(scoped(S.estateDeal.organizationId, s.organizationId));
      const exclusive = new Set<string>();
      for (const d of deals)
        if (["reserva", "contrato", "cerrada"].includes(d.phase)) {
          if (exclusive.has(d.propertyId))
            fail(409, "La copia entra en conflicto con una reserva posterior");
          exclusive.add(d.propertyId);
          await db
            .update(S.property)
            .set({ status: d.phase === "cerrada" ? "vendido" : "reservado" })
            .where(
              scoped(
                S.property.organizationId,
                s.organizationId,
                eq(S.property.id, d.propertyId),
              ),
            );
        }
      await activity(
        db,
        s,
        "backup",
        s.organizationId,
        "restauración",
        "Copia de expedientes restaurada por un administrador",
      );
    });
    return { counts };
  } catch (err) {
    await Promise.all(written.map((id) => borrarMedia(s.organizationId, id)));
    throw err;
  }
}
