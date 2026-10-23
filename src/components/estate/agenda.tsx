"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeGrid } from "@/components/bookings/time-grid";
import { MonthGrid } from "@/components/bookings/month-grid";
import type { Booking } from "@/components/bookings/booking-look";
import {
  datesOf,
  monthWeeks,
  rangeLabel,
  shiftRange,
  visibleRange,
  wallClock,
  type CalendarView,
} from "@/lib/time/calendar";
import { estateDateTime } from "@/lib/estate";
import { label, type EstateData, type Visit } from "@/lib/estate";
const TZ = "Europe/Madrid";
export function EstateAgenda({
  data,
  onEdit,
  onNew,
}: {
  data: EstateData;
  onEdit: (v: Visit) => void;
  onNew: (initial?: object) => void;
}) {
  const [view, setView] = useState<CalendarView>("semana");
  const [anchor, setAnchor] = useState(
    () => estateDateTime(new Date().toISOString(), TZ).date,
  );
  const [advisor, setAdvisor] = useState("");
  const today = estateDateTime(new Date().toISOString(), TZ).date;
  const range = visibleRange(view, anchor);
  const visits = data.visits.filter(
    (v) => !advisor || v.assignedUserId === advisor,
  );
  const mapped = useMemo<Booking[]>(
    () =>
      visits.map((v) => {
        const p = data.properties.find((p) => p.id === v.propertyId);
        const c = data.clients.find((c) => c.id === v.contactId);
        const parts = estateDateTime(v.startsAt, TZ);
        return {
          id: v.id,
          kind: "session",
          status:
            v.status === "cancelada"
              ? "cancelada"
              : v.status === "realizada"
                ? "realizada"
                : v.status === "no_presentado"
                  ? "no_show"
                  : "agendada",
          source: "manual",
          scheduledAtUtc: v.startsAt,
          durationMinutes: v.durationMinutes,
          ...parts,
          contact: {
            id: v.contactId,
            name: `${p?.reference ?? "Vivienda"} · ${c?.name ?? "Cliente"} · ${label(v.status)}`,
          },
          conversationId: null,
          connector: null,
          meetingLink: null,
          linkPending: false,
          isTest: false,
          notes: v.notes,
        };
      }),
    [visits, data],
  );
  const open = (b: Booking) => {
    const visit = data.visits.find((v) => v.id === b.id);
    if (visit) onEdit(visit);
  };
  const openDay = (day: string) => {
    setAnchor(day);
    setView("dia");
  };
  return (
    <section
      className="flex min-h-[650px] flex-col gap-3"
      aria-label="Calendario de visitas"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setAnchor(today)}>
          Hoy
        </Button>
        <Button
          variant="outline"
          aria-label="Periodo anterior"
          onClick={() => setAnchor(shiftRange(view, anchor, -1).anchor)}
        >
          ‹
        </Button>
        <Button
          variant="outline"
          aria-label="Periodo siguiente"
          onClick={() => setAnchor(shiftRange(view, anchor, 1).anchor)}
        >
          ›
        </Button>
        <label className="text-sm">
          Fecha{" "}
          <input
            type="date"
            value={anchor}
            onChange={(e) => {
              if (e.target.value) setAnchor(e.target.value);
            }}
            className="rounded border bg-background p-2"
          />
        </label>
        <select
          aria-label="Asesor de las visitas"
          value={advisor}
          onChange={(e) => setAdvisor(e.target.value)}
          className="rounded border bg-background p-2 text-sm"
        >
          <option value="">Todos los asesores</option>
          {data.team.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button onClick={() => onNew()}>Nueva visita</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["dia", "Día"],
            ["semana", "Semana"],
            ["mes", "Mes"],
            ["lista", "Lista"],
          ] as const
        ).map(([key, title]) => (
          <Button
            key={key}
            size="sm"
            aria-pressed={view === key}
            variant={view === key ? "default" : "outline"}
            onClick={() => setView(key)}
          >
            {title}
          </Button>
        ))}
      </div>
      <p className="text-sm font-medium">
        {rangeLabel(view, anchor)} · Europe/Madrid
      </p>
      {view === "mes" ? (
        <MonthGrid
          weeks={monthWeeks(anchor)}
          month={anchor.slice(0, 7)}
          bookings={mapped}
          timezone={TZ}
          today={today}
          selectedId={null}
          onSelect={open}
          onOpenDay={openDay}
        />
      ) : view === "lista" ? (
        <ul className="space-y-2">
          {visits
            .filter(
              (v) =>
                estateDateTime(v.startsAt, TZ).date >= range.from &&
                estateDateTime(v.startsAt, TZ).date <= range.to,
            )
            .map((v) => (
              <li key={v.id}>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  onClick={() => onEdit(v)}
                >
                  {new Date(v.startsAt).toLocaleString("es-ES", {
                    timeZone: TZ,
                  })}{" "}
                  · {data.clients.find((c) => c.id === v.contactId)?.name} ·{" "}
                  {
                    data.properties.find((p) => p.id === v.propertyId)
                      ?.reference
                  }{" "}
                  · {v.status.replaceAll("_", " ")}
                </Button>
              </li>
            ))}
          {!visits.some(
            (v) =>
              estateDateTime(v.startsAt, TZ).date >= range.from &&
              estateDateTime(v.startsAt, TZ).date <= range.to,
          ) && (
            <li>
              No hay visitas. Pulsa «Nueva visita» para concertar la primera.
            </li>
          )}
        </ul>
      ) : (
        <TimeGrid
          days={datesOf(range)}
          bookings={mapped}
          timezone={TZ}
          weeklyHours={{
            mon: [{ start: "09:00", end: "19:00" }],
            tue: [{ start: "09:00", end: "19:00" }],
            wed: [{ start: "09:00", end: "19:00" }],
            thu: [{ start: "09:00", end: "19:00" }],
            fri: [{ start: "09:00", end: "19:00" }],
            sat: [{ start: "10:00", end: "14:00" }],
          }}
          today={today}
          nowMinutes={wallClock(new Date(), TZ).minutes}
          tzLabel="Madrid"
          selectedId={null}
          ready
          onSelect={open}
          onEmptySlot={(day, time) => onNew({ startsAt: `${day}T${time}` })}
          onOpenDay={openDay}
        />
      )}
    </section>
  );
}
