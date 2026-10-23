import { eq, sql } from "drizzle-orm";
import { getDb, schema as S } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { SessionContext } from "@/lib/auth/session";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { guardarMedia, leerMedia, borrarMedia } from "@/lib/storage/medios";
import { activity, documentRow, estateId, fail } from "./service";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function validDocument(bytes: Buffer, mime: string) {
  if (mime === "application/pdf")
    return bytes.subarray(0, 5).toString() === "%PDF-";
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  return false;
}
export async function uploadDocument(
  s: SessionContext,
  id: string,
  file: File,
) {
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES)
    fail(413, "El archivo debe ocupar entre 1 byte y 10 MiB");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!validDocument(bytes, file.type))
    fail(422, "El contenido debe ser un PDF, JPG, PNG o WebP válido");
  const storageId = estateId("file");
  const encrypted = encryptSecret(bytes.toString("base64"));
  await guardarMedia(
    s.organizationId,
    storageId,
    Buffer.from(JSON.stringify(encrypted)),
    "application/octet-stream",
  );
  try {
    return await getDb().transaction(async (db) => {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${s.organizationId + ":estate"},0))`,
      );
      const old = await documentRow(s, id, db);

      const [next] = await db
        .select({ id: S.estateDocument.id })
        .from(S.estateDocument)
        .where(
          scoped(
            S.estateDocument.organizationId,
            s.organizationId,
            eq(S.estateDocument.previousId, id),
          ),
        )
        .limit(1);
      if (next)
        fail(
          409,
          "Este archivo ya tiene una versión posterior. Abre la última versión",
        );
      const values = {
        storageId,
        filename: file.name.replace(/[\r\n/\\]/g, "_").slice(0, 180),
        mime: file.type,
        size: file.size,
        status: "pendiente",
        intakeError: null,
        reviewNote: null,
        uploadedBy: s.userId,
        updatedAt: new Date(),
      };
      let resultId = id;
      if (old.storageId) {
        resultId = estateId("doc");
        await db.insert(S.estateDocument).values({
          ...old,
          id: resultId,
          ...values,
          status: "pendiente",
          reviewNote: null,
          source: "manual",
          sourceWaMessageId: null,
          sourceMediaAssetId: null,
          intakeError: null,
          previousId: id,
          version: old.version + 1,
          uploadedBy: s.userId,
          createdAt: new Date(),
        });
      } else
        await db
          .update(S.estateDocument)
          .set(values)
          .where(
            scoped(
              S.estateDocument.organizationId,
              s.organizationId,
              eq(S.estateDocument.id, id),
            ),
          );
      await activity(
        db,
        s,
        "document",
        resultId,
        "archivo",
        `Archivo incorporado · versión ${old.storageId ? old.version + 1 : old.version}`,
      );
      return { id: resultId };
    });
  } catch (err) {
    await borrarMedia(s.organizationId, storageId);
    throw err;
  }
}
export async function readDocument(s: SessionContext, id: string) {
  const doc = await documentRow(s, id);
  if (!doc.storageId) fail(404, "Este documento todavía no tiene archivo");
  let data: Buffer;
  try {
    const stored = JSON.parse(
      (await leerMedia(s.organizationId, doc.storageId)).toString(),
    );
    data = Buffer.from(decryptSecret(stored), "base64");
  } catch {
    return fail(
      410,
      "El archivo no está disponible. Revisa la copia de seguridad o incorpora una versión",
    );
  }
  await activity(getDb(), s, "document", id, "descarga", "Archivo consultado");
  return { doc, data };
}
