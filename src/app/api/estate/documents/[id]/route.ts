import { apiError, withAuth } from "@/lib/api";
import { EstateError } from "@/server/estate/service";
import {
  MAX_DOCUMENT_BYTES,
  readDocument,
  uploadDocument,
} from "@/server/estate/documents";
import { contentDisposition } from "@/server/whatsapp/media-headers";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export const GET = withAuth(async (s, req: Request, ctx: Ctx) => {
  try {
    const { doc, data } = await readDocument(s, (await ctx.params).id);
    const inline =
      new URL(req.url).searchParams.get("preview") === "1" &&
      doc.mime?.startsWith("image/");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mime ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          doc.filename,
        ),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiError(
      err instanceof EstateError ? err.status : 500,
      "document_error",
      err instanceof EstateError ? err.message : "No se pudo leer el documento",
    );
  }
});
export const POST = withAuth(async (s, req: Request, ctx: Ctx) => {
  const length = Number(req.headers.get("content-length"));
  if (!length || length > MAX_DOCUMENT_BYTES + 16384)
    return apiError(
      413,
      "file_size",
      "El archivo debe ocupar como máximo 10 MiB",
    );
  try {
    const form = await req.formData();
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File))
      return apiError(422, "invalid_file", "Selecciona un único archivo");
    return Response.json(
      await uploadDocument(s, (await ctx.params).id, files[0]),
    );
  } catch (err) {
    return apiError(
      err instanceof EstateError ? err.status : 422,
      "document_error",
      err instanceof EstateError
        ? err.message
        : "No se pudo incorporar el archivo",
    );
  }
});
