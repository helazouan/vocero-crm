import { apiError, parseBody, withAuth } from "@/lib/api";
import { z } from "zod";
import { attentionMode, saveAttentionMode } from "@/server/onboarding/mode";
import { canConfigure } from "@/lib/auth/roles";
import { guideFrom } from "@/server/onboarding/guide";
import { onboardingStatus } from "@/server/onboarding/status";

export const dynamic = "force-dynamic";

/**
 * Qué le falta a la instancia para que el agente conteste (issue #86): los
 * pasos verificados y la guía que sale de ellos. Para quien puede configurar,
 * igual que la pantalla. Ver `server/onboarding/`.
 */
export const GET = withAuth(async (session) => {
  if (!canConfigure(session.role)) {
    return apiError(403, "forbidden", "Solo el propietario configura la instancia");
  }
  const status = await onboardingStatus(session.organizationId);
  return Response.json(
    { ...status, guide: guideFrom(status, await attentionMode(session.organizationId, status)) },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withAuth(async (session, req: Request) => {
  if (!canConfigure(session.role)) return apiError(403, "forbidden", "Solo el propietario o administrador cambia el modo");
  const body = await parseBody(req, z.object({ mode: z.enum(["manual", "agent"]) }));
  if (!body.ok) return body.response;
  await saveAttentionMode(session.organizationId, body.data.mode);
  return Response.json({ mode: body.data.mode });
});
