"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "@/lib/request-json";
import { matchesFollowUp, type FollowUp, type FollowUpFilter } from "@/lib/follow-ups";
import { Button } from "@/components/ui/button";
import { NextAction } from "./next-action";

const filters: [FollowUpFilter, string][] = [["pending", "Pendientes"], ["today", "Hoy"], ["overdue", "Vencidos"], ["completed", "Completados"]];

export function FollowUpsClient() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState<FollowUpFilter>("pending");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [timezone, setTimezone] = useState("UTC");
  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ followUps: FollowUp[] }>("/api/follow-ups");
      setItems(data.followUps); setNow(new Date()); setError("");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void load();
    const timer = setInterval(() => void load(), 60000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [load]);
  const visible = items.filter(item => matchesFollowUp(item, filter, now, timezone));

  return <div className="h-full overflow-y-auto p-4 sm:p-6">
    <h1 className="text-2xl font-semibold">Seguimientos</h1>
    <p className="mt-2 text-sm text-muted-foreground">Recordatorios de tus oportunidades. Hora de {timezone}. Programa una próxima acción desde el Pipeline.</p>
    <nav className="my-4 flex flex-wrap gap-2" aria-label="Filtrar seguimientos">
      {filters.map(([key, label]) => <Button key={key} variant={key === filter ? "default" : "outline"} aria-pressed={key === filter} onClick={() => setFilter(key)}>{label} ({items.filter(item => matchesFollowUp(item, key, now, timezone)).length})</Button>)}
    </nav>
    {error && <p role="alert" className="mb-4 text-destructive">{error} <Button variant="outline" onClick={() => void load()}>Reintentar</Button></p>}
    {loading ? <p role="status">Cargando seguimientos…</p> : !visible.length ? <p>No hay acciones en esta vista. <Link className="underline" href="/pipeline">Abrir Pipeline</Link></p> :
      <ul className="space-y-3">{visible.map(item => <li key={item.id} className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><h2 className="font-semibold">{item.title}</h2><p className="text-sm">{item.contactName} · {new Date(item.dueAt!).toLocaleString("es", { timeZone: timezone })}</p>
            {!item.completedAt && matchesFollowUp(item, "overdue", now, timezone) && <p className="text-sm text-warning-text">Vencido</p>}
          </div>
          <div className="flex gap-3"><Link className="text-sm underline" href={`/inbox?contact=${item.contactId}`}>Ver contacto</Link><Button size="sm" variant="outline" onClick={() => setEditing(editing === item.id ? null : item.id)}>{editing === item.id ? "Cerrar" : "Gestionar acción"}</Button></div>
        </div>
        {editing === item.id && <NextAction key={item.id} leadId={item.id} onSaved={() => void load()} />}
      </li>)}</ul>}
  </div>;
}
