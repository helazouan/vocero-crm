import {
  decryptPrivateMedia,
  encryptPrivateMedia,
  privateMedia,
} from "@/lib/storage/private-media";
import { eq, sql, isNull } from "drizzle-orm";
import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { encryptSecret } from "@/lib/crypto";
import { guardarMedia, leerMedia, borrarMedia } from "@/lib/storage/medios";
import { estateId } from "./service";
import { MAX_DOCUMENT_BYTES, validDocument } from "./documents";

export async function ensureClientFile(org: string, contactId: string) {
  const [contact] = await getDb()
    .select({ id: S.contact.id })
    .from(S.contact)
    .where(scoped(S.contact.organizationId, org, eq(S.contact.id, contactId)))
    .limit(1);
  if (contact)
    await getDb()
      .insert(S.estateClient)
      .values({ id: contact.id, organizationId: org, role: "sin_clasificar" })
      .onConflictDoNothing();
}
export async function registerIncomingDocument(org: string, assetId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      asset: S.mediaAsset,
      message: S.message,
      conversation: S.conversation,
      contact: S.contact,
    })
    .from(S.message)
    .innerJoin(S.mediaAsset, eq(S.mediaAsset.id, S.message.mediaAssetId))
    .innerJoin(S.conversation, eq(S.conversation.id, S.message.conversationId))
    .innerJoin(S.contact, eq(S.contact.id, S.conversation.contactId))
    .where(
      scoped(
        S.message.organizationId,
        org,
        eq(S.mediaAsset.id, assetId),
        eq(S.mediaAsset.organizationId, org),
        eq(S.conversation.organizationId, org),
        eq(S.contact.organizationId, org),
      ),
    )
    .limit(1);
  if (
    !row ||
    row.message.direction !== "in" ||
    row.conversation.isTest ||
    row.contact.channel !== "whatsapp" ||
    !["document", "image"].includes(row.asset.kind) ||
    !row.message.waMessageId
  )
    return null;
  await ensureClientFile(org, row.contact.id);
  const [doc] = await db
    .insert(S.estateDocument)
    .values({
      id: estateId("doc"),
      organizationId: org,
      entityType: "client",
      entityId: row.contact.id,
      subjectContactId: row.contact.id,
      title:
        row.asset.fileName?.slice(0, 180) || "Imagen recibida por WhatsApp",
      documentType: "sin_clasificar",
      category: "otro",
      status: "pendiente",
      visibility: "restringido",
      source: "whatsapp",
      sourceWaMessageId: row.message.waMessageId,
      sourceMediaAssetId: assetId,
      filename:
        row.asset.fileName?.replace(/[\r\n/\\]/g, "_").slice(0, 180) ?? null,
      mime: row.asset.mimeType,
    })
    .onConflictDoNothing({
      target: [
        S.estateDocument.organizationId,
        S.estateDocument.sourceWaMessageId,
      ],
    })
    .returning();
  if (doc)
    await db.insert(S.estateActivity).values({
      id: estateId("act"),
      organizationId: org,
      entityType: "document",
      entityId: doc.id,
      kind: "recepción",
      text: "Documento recibido por WhatsApp. Cliente, tipo y contenido pendientes de revisión.",
      actorId: null,
    });
  const [stored] = await db
    .select()
    .from(S.estateDocument)
    .where(
      scoped(
        S.estateDocument.organizationId,
        org,
        eq(S.estateDocument.sourceWaMessageId, row.message.waMessageId),
      ),
    )
    .limit(1);
  return stored ?? null;
}
export async function incorporateIncomingDocument(
  org: string,
  assetId: string,
) {
  const doc = await registerIncomingDocument(org, assetId);
  if (!doc) return;
  const [asset] = await getDb()
    .select()
    .from(S.mediaAsset)
    .where(
      scoped(S.mediaAsset.organizationId, org, eq(S.mediaAsset.id, assetId)),
    )
    .limit(1);
  if (!asset) return;
  let bytes: Buffer;
  try {
    if (asset.fetchStatus !== "available")
      throw new Error(
        "La descarga de WhatsApp sigue pendiente. Reintenta cuando esté disponible.",
      );

    try {
      const original = await leerMedia(org, assetId);
      bytes = decryptPrivateMedia(original);
      if (!privateMedia(original))
        await guardarMedia(
          org,
          assetId,
          encryptPrivateMedia(bytes),
          "application/octet-stream",
        );
    } catch {
      throw new Error(
        "La copia del adjunto no está disponible. Reintenta la descarga o incorpora el archivo manualmente.",
      );
    }
    if (doc.storageId) return;
    if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
      throw new Error("El archivo debe ocupar entre 1 byte y 10 MiB.");
    if (!validDocument(bytes, asset.mimeType ?? ""))
      throw new Error(
        "El expediente admite PDF, JPG, PNG o WebP válidos. Solicita otro formato.",
      );
  } catch (err) {
    await getDb()
      .update(S.estateDocument)
      .set({
        intakeError:
          err instanceof Error
            ? err.message
            : "No se pudo copiar el archivo. Reintenta la incorporación.",
        updatedAt: new Date(),
      })
      .where(
        scoped(
          S.estateDocument.organizationId,
          org,
          eq(S.estateDocument.id, doc.id),
          isNull(S.estateDocument.storageId),
        ),
      );
    return;
  }
  const storageId = estateId("file");
  await guardarMedia(
    org,
    storageId,
    Buffer.from(JSON.stringify(encryptSecret(bytes.toString("base64")))),
    "application/octet-stream",
  );
  let used = false;
  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${org + ":estate"},0))`,
      );
      const [current] = await tx
        .select()
        .from(S.estateDocument)
        .where(
          scoped(
            S.estateDocument.organizationId,
            org,
            eq(S.estateDocument.id, doc.id),
          ),
        )
        .limit(1);
      if (!current || current.storageId) return;
      await tx
        .update(S.estateDocument)
        .set({
          storageId,
          mime: asset.mimeType,
          size: bytes.length,
          filename:
            current.filename ??
            (asset.mimeType === "application/pdf" ? "documento.pdf" : "imagen"),
          status: "pendiente",
          intakeError: null,
          updatedAt: new Date(),
        })
        .where(
          scoped(
            S.estateDocument.organizationId,
            org,
            eq(S.estateDocument.id, doc.id),
          ),
        );
      await tx.insert(S.estateActivity).values({
        id: estateId("act"),
        organizationId: org,
        entityType: "document",
        entityId: doc.id,
        kind: "archivo",
        text: "Archivo cifrado incorporado al expediente. Pendiente de clasificación y revisión.",
        actorId: null,
      });
      used = true;
    });
  } finally {
    if (!used) await borrarMedia(org, storageId);
  }
}
