"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/request-json";
import { localDateTime, type FollowUp } from "@/lib/follow-ups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NextAction({ leadId, onSaved }: { leadId: string; onSaved?: () => void }) {
  const [item, setItem] = useState<FollowUp | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [timezone, setTimezone] = useState("");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    requestJson<{ followUps: FollowUp[] }>(`/api/follow-ups?leadId=${encodeURIComponent(leadId)}`)
      .then(data => {
        if (!active) return;
        const action = data.followUps[0];
        if (!action) throw new Error("Oportunidad no encontrada");
        setItem(action); setTitle(action.title ?? ""); setDue(action.dueAt ? localDateTime(action.dueAt) : "");
      }).catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId, revision]);

  async function save(complete = false) {
    setBusy(true); setError("");
    try {
      const body = complete ? { operation: "complete", title: item?.title, dueAt: item?.dueAt }
        : { operation: "save", title, dueAt: new Date(due).toISOString() };
      await requestJson(`/api/follow-ups/${leadId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setRevision(r => r + 1); onSaved?.();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 border-b p-4" aria-label="Próxima acción">
    <h3 className="font-semibold">Próxima acción</h3>
    {loading ? <p role="status">Cargando acción…</p> : <>
      {item?.completedAt && <p role="status" className="text-sm text-success-text">Completada. Puedes programar la siguiente.</p>}
      <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3">
        <label className="block text-sm">Qué hay que hacer<Input required maxLength={240} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Fecha y hora<Input required type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Hora de {timezone}. El recordatorio aparecerá en Seguimientos.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !item || !title.trim() || !due} type="submit">{busy ? "Guardando…" : "Guardar acción"}</Button>
          {item?.title && !item.completedAt && <Button size="sm" variant="outline" disabled={busy} type="button" onClick={() => void save(true)}>Completar acción</Button>}
        </div>
      </form>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button size="sm" variant="ghost" onClick={() => setRevision(r => r + 1)}>Recargar acción</Button></p>}
  </section>;
}
