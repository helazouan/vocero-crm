import { apiError, parseBody, withAuth } from "@/lib/api";
import { mutationSchema } from "@/lib/estate";
import { EstateError, getEstateData, mutate } from "@/server/estate/service";
export const dynamic = "force-dynamic";
export const GET = withAuth(async (s) =>
  Response.json(await getEstateData(s), {
    headers: { "Cache-Control": "no-store" },
  }),
);
export const POST = withAuth(async (s, req: Request) => {
  const parsed = await parseBody(req, mutationSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return Response.json(await mutate(s, mutationSchema.parse(parsed.data)));
  } catch (err) {
    if (err instanceof EstateError)
      return apiError(err.status, "estate_error", err.message);
    return apiError(500, "internal", "No se pudo guardar. Reinténtalo");
  }
});
