import { apiError, withAuth } from "@/lib/api";
import { EstateError } from "@/server/estate/service";
import { exportBackup, restoreBackup } from "@/server/estate/backup";
export const dynamic = "force-dynamic";
function error(err: unknown) {
  return err instanceof EstateError
    ? apiError(err.status, "backup", err.message)
    : apiError(
        500,
        "backup",
        "No se pudo completar la copia. Comprueba el almacenamiento y la base de datos",
      );
}
export const GET = withAuth(async (s) => {
  try {
    return new Response(await exportBackup(s), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=expedientes-vocero.json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return error(err);
  }
});
export const POST = withAuth(async (s, req: Request) => {
  if (!["0", "1"].includes(new URL(req.url).searchParams.get("confirm") ?? ""))
    return apiError(
      422,
      "backup",
      "Indica si quieres revisar o confirmar la restauración",
    );
  const size = Number(req.headers.get("content-length"));
  if (!size || size > 50 * 1024 * 1024)
    return apiError(413, "backup", "La copia debe ocupar hasta 50 MiB");
  try {
    return Response.json(
      await restoreBackup(
        s,
        await req.json(),
        new URL(req.url).searchParams.get("confirm") === "1",
      ),
    );
  } catch (err) {
    return error(err);
  }
});
