"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/request-json";
export function BackupPanel({ reload }: { reload: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Record<string, number> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function restore(confirm: boolean) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("La copia supera los 50 MiB");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const content = await file.text();
      const r = await requestJson<{ counts: Record<string, number> }>(
        `/api/estate/backup?confirm=${confirm ? "1" : "0"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: content,
        },
      );
      if (confirm) {
        setPreview(null);
        setFile(null);
        setDone(true);
        await reload();
      } else setPreview(r.counts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/estate/backup");
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "No se pudo exportar la copia");
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "expedientes-vocero.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "No se pudo conectar. Reintenta la descarga."
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-8 rounded-lg border bg-card p-4">
      <summary className="cursor-pointer font-semibold">
        Copias y recuperación de expedientes
      </summary>
      <p className="my-3 max-w-3xl text-sm text-muted-foreground">
        Exporta clientes, inmuebles, operaciones, visitas, actividad y
        documentos. La copia completa está cifrada y necesita la misma clave de
        la instalación. La restauración recupera los registros de la misma
        organización y puede sustituir cambios posteriores. Guarda también
        PostgreSQL, el volumen de medios y la clave de cifrado para recuperar la
        instalación completa.
      </p>
      <Button variant="outline" disabled={busy} onClick={() => void download()}>
        {busy ? "Procesando…" : "Descargar copia de expedientes"}
      </Button>
      <label className="mt-5 block text-sm">
        Copia que quieres restaurar (JSON, hasta 50 MiB)
        <input
          type="file"
          accept="application/json,.json"
          className="mt-2 block max-w-full"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setDone(false);
          }}
        />
      </label>
      {file && !preview && (
        <Button
          className="mt-3"
          variant="outline"
          disabled={busy}
          onClick={() => void restore(false)}
        >
          Revisar copia
        </Button>
      )}
      {preview && (
        <div className="mt-4 space-y-3 rounded border p-4">
          <p className="font-medium">Registros que se recuperarán</p>
          <p className="text-sm">
            {Object.entries(preview)
              .map(([key, n]) => `${key}: ${n}`)
              .join(" · ")}
          </p>
          <p className="text-sm">
            Confirma solo si quieres recuperar el estado de estos expedientes.
            La acción quedará registrada en el historial.
          </p>
          <Button disabled={busy} onClick={() => void restore(true)}>
            {busy ? "Restaurando…" : "Confirmar restauración"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 text-sm text-success-text">
          Copia restaurada correctamente.
        </p>
      )}
    </details>
  );
}
