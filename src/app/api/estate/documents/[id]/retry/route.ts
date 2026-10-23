import { withAuth, apiError } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { documentRow, EstateError } from "@/server/estate/service";
import { ensureAssetAvailable } from "@/server/whatsapp/media";
import { incorporateIncomingDocument } from "@/server/estate/incoming-documents";
export const dynamic = "force-dynamic";
export const POST = withAuth(
  async (s, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const doc = await documentRow(s, (await ctx.params).id);
      if (!canConfigure(s.role) && doc.uploadedBy !== s.userId)
        return apiError(
          403,
          "forbidden",
          "Solo el autor o un administrador puede recuperar el archivo",
        );
      if (!doc.sourceMediaAssetId)
        return apiError(
          422,
          "source",
          "Este documento no tiene un adjunto de WhatsApp para recuperar",
        );
      if (doc.storageId) return Response.json({ id: doc.id });
      await ensureAssetAvailable(s.organizationId, doc.sourceMediaAssetId);
      await incorporateIncomingDocument(
        s.organizationId,
        doc.sourceMediaAssetId,
      );
      const current = await documentRow(s, doc.id);
      if (!current.storageId)
        return apiError(
          409,
          "intake",
          current.intakeError ??
            "El archivo aún no está disponible. Puedes incorporarlo manualmente.",
        );
      return Response.json({ id: doc.id });
    } catch (err) {
      return apiError(
        err instanceof EstateError ? err.status : 500,
        "intake",
        err instanceof EstateError
          ? err.message
          : "No se pudo recuperar el archivo. Reinténtalo.",
      );
    }
  },
);
