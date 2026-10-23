"use client";
import { currentDocuments } from "@/lib/estate-documents";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/request-json";
import { DEAL_PHASES, label, type EstateData, type Visit } from "@/lib/estate";
import { matchesFollowUp, type FollowUp } from "@/lib/follow-ups";
import { estateDateTime } from "@/lib/estate";
const linkClass = "text-sm text-brand-text underline underline-offset-2";
export function DailyWork({
  data,
  onVisit,
}: {
  data: EstateData;
  onVisit: (v: Visit) => void;
}) {
  const [actions, setActions] = useState<FollowUp[]>([]),
    [error, setError] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await requestJson<{ followUps: FollowUp[] }>(
          "/api/follow-ups",
        );
        if (active) {
          setActions(r.followUps);
          setError("");
          setNow(new Date());
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);
  const today = estateDateTime(now.toISOString(), "Europe/Madrid").date;
  const visits = data.visits.filter(
    (v) =>
      estateDateTime(v.startsAt, "Europe/Madrid").date === today &&
      v.status !== "cancelada" &&
      (!advisor || v.assignedUserId === advisor),
  );
  const work = actions.filter(
    (a) =>
      (matchesFollowUp(a, "today", now, "Europe/Madrid") ||
        matchesFollowUp(a, "overdue", now, "Europe/Madrid")) &&
      (!advisor ||
        data.clients.find((c) => c.id === a.contactId)?.assignedUserId ===
          advisor),
  );
  const earlier = new Set(data.documents.map((d) => d.previousId));
  const docs = currentDocuments(data.documents).filter(
    (d) =>
      !earlier.has(d.id) &&
      (!d.hasFile ||
        d.status === "pendiente" ||
        d.status === "pendiente_firma" ||
        d.status === "rechazado" ||
        (d.dueAt &&
          Date.parse(d.dueAt) < now.getTime() &&
          d.status !== "firmado")) &&
      (!advisor ||
        (d.entityType === "property"
          ? data.properties.find((p) => p.id === d.entityId)?.assignedUserId
          : d.entityType === "client"
            ? data.clients.find((c) => c.id === d.entityId)?.assignedUserId
            : data.deals.find((deal) => deal.id === d.entityId)
                ?.assignedUserId) === advisor),
  );
  const deals = data.deals.filter(
    (d) => !advisor || d.assignedUserId === advisor,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Madrid",
          })}{" "}
          · Europe/Madrid
        </p>
        <label className="text-sm">
          Responsable{" "}
          <select
            value={advisor}
            onChange={(e) => setAdvisor(e.target.value)}
            className="rounded border bg-background p-2"
          >
            <option value="">Todo el equipo</option>
            {data.team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Visitas de hoy", visits.length, "/agenda"],
          ["Acciones para atender", work.length, "/follow-ups"],
          ["Documentos pendientes", docs.length, "/documents"],
          [
            "Viviendas disponibles",
            data.properties.filter(
              (p) =>
                p.status === "disponible" &&
                (!advisor || p.assignedUserId === advisor),
            ).length,
            "/properties",
          ],
        ].map(([title, count, href]) => (
          <Link
            key={String(href)}
            href={String(href)}
            className="rounded-lg border bg-card p-4 hover:border-primary"
          >
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">Visitas de hoy</h2>
          <ul className="space-y-3">
            {visits.map((v) => (
              <li key={v.id}>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  onClick={() => onVisit(v)}
                >
                  {estateDateTime(v.startsAt, "Europe/Madrid").time} ·{" "}
                  {data.clients.find((c) => c.id === v.contactId)?.name} ·{" "}
                  {
                    data.properties.find((p) => p.id === v.propertyId)
                      ?.reference
                  }{" "}
                  · {label(v.status)}
                </Button>
              </li>
            ))}
            {visits.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No hay visitas previstas para hoy.{" "}
                <Link className={linkClass} href="/agenda">
                  Abrir agenda
                </Link>
              </li>
            )}
          </ul>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">
            Llamadas y seguimientos
          </h2>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <ul className="space-y-3">
            {work.map((a) => (
              <li key={a.id} className="rounded border p-3">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm">
                  {a.contactName} ·{" "}
                  {new Date(a.dueAt!).toLocaleString("es-ES", {
                    timeZone: "Europe/Madrid",
                  })}
                </p>
                <Link className={linkClass} href="/follow-ups">
                  Gestionar seguimiento
                </Link>
              </li>
            ))}
            {work.length === 0 && !error && (
              <li className="text-sm text-muted-foreground">
                No hay acciones de hoy o vencidas para esta selección.
              </li>
            )}
          </ul>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">
            Documentación por completar
          </h2>
          <ul className="space-y-3">
            {docs.map((d) => (
              <li key={d.id}>
                <Link
                  className={linkClass}
                  href={`/${d.entityType === "property" ? "properties" : d.entityType === "client" ? "clients" : "deals"}?id=${d.entityId}`}
                >
                  {d.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {label(d.status)}
                  {d.dueAt
                    ? ` · Fecha límite: ${new Date(d.dueAt).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`
                    : ""}
                </p>
              </li>
            ))}
            {docs.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No hay documentos pendientes.
              </li>
            )}
          </ul>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">Operaciones por fase</h2>
          <ul className="space-y-2">
            {DEAL_PHASES.map((phase) => (
              <li
                key={phase}
                className="flex justify-between border-b py-2 text-sm"
              >
                <span>{label(phase)}</span>
                <strong>{deals.filter((d) => d.phase === phase).length}</strong>
              </li>
            ))}
          </ul>
          <Link className={linkClass} href="/deals">
            Abrir operaciones
          </Link>
        </section>
      </div>
    </div>
  );
}
