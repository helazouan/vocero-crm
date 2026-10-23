"use client";
/* Las imágenes del expediente requieren las cookies de la sesión local. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, Plus, ArrowLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/lib/request-json";
import { formatMoneyCents } from "@/lib/money";
import {
  PROPERTY_TYPES,
  PROPERTY_STATES,
  DEAL_PHASES,
  VISIT_STATES,
  matchingProperties,
  label,
  type EstateData,
  type Visit,
  type EntityType,
} from "@/lib/estate";
import { NextAction } from "@/components/pipeline/next-action";
import { Editor, type Field } from "./editor";
import { Dossier } from "./dossier";
import { EstateAgenda } from "./agenda";
import { DailyWork } from "./today";
import { BackupPanel } from "./backup-panel";
export type EstateView =
  | "today"
  | "properties"
  | "clients"
  | "deals"
  | "agenda"
  | "documents";
const TITLES: Record<EstateView, string> = {
  today: "Mi jornada",
  properties: "Inmuebles",
  clients: "Clientes",
  deals: "Operaciones",
  agenda: "Agenda de visitas",
  documents: "Documentos",
};
const OPTIONS = (values: readonly string[]) =>
  values.map((value) => ({ value, label: label(value) }));
const euro = (amount: number | null) =>
  formatMoneyCents(amount, "EUR") ?? "Sin importe";
const linkClass = "text-sm text-brand-text underline underline-offset-2";
export function EstateWorkspace({ view }: { view: EstateView }) {
  const router = useRouter(),
    params = useSearchParams(),
    selected = params.get("id");
  const [data, setData] = useState<EstateData | null>(null),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [city, setCity] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [assignee, setAssignee] = useState("");
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editor, setEditor] = useState<{
    title: string;
    operation: string;
    initial: object;
    fields: Field[];
  } | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const result = await requestJson<EstateData>("/api/estate");
      if (seq === sequence.current) {
        setData(result);
        setError("");
      }
    } catch (err) {
      if (seq === sequence.current) setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(
    () => setPage(1),
    [query, status, type, city, min, max, assignee, view, includeArchived],
  );
  const open = (id: string) =>
    router.push(
      `/${view === "today" ? "work" : view}?id=${encodeURIComponent(id)}`,
    );
  const clear = () => router.push(`/${view === "today" ? "work" : view}`);
  if (!data)
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{TITLES[view]}</h1>
        {error ? (
          <p role="alert" className="mt-4 text-destructive">
            {error}{" "}
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </p>
        ) : (
          <p role="status" className="mt-4">
            Cargando…
          </p>
        )}
      </div>
    );
  const teamOptions = data.team.map((t) => ({ value: t.id, label: t.name }));
  const clientOptions = data.clients.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const propertyOptions = data.properties.map((p) => ({
    value: p.id,
    label: `${p.reference} · ${p.title}`,
  }));
  const advisor: Field = {
    key: "assignedUserId",
    label: "Asesor responsable",
    kind: "select",
    options: teamOptions,
  };
  const propertyFields: Field[] = [
    { key: "reference", label: "Referencia", required: true },
    { key: "title", label: "Título del inmueble", required: true },
    {
      key: "type",
      label: "Tipo de inmueble",
      kind: "select",
      required: true,
      options: OPTIONS(PROPERTY_TYPES),
    },
    {
      key: "status",
      label: "Estado",
      kind: "select",
      required: true,
      options: OPTIONS(PROPERTY_STATES),
    },
    { key: "address", label: "Dirección", required: true },
    { key: "city", label: "Municipio", required: true },
    { key: "postalCode", label: "Código postal" },
    {
      key: "priceCents",
      label: "Precio de venta (€)",
      kind: "money",
      required: true,
    },
    { key: "area", label: "Superficie (m²)", kind: "number", required: true },
    { key: "rooms", label: "Habitaciones", kind: "number", required: true },
    { key: "bathrooms", label: "Baños", kind: "number", required: true },
    {
      key: "ownerContactId",
      label: "Propietario",
      kind: "select",
      options: clientOptions,
    },
    advisor,
    { key: "garden", label: "Jardín", kind: "checkbox" },
    { key: "terrace", label: "Terraza", kind: "checkbox" },
    { key: "garage", label: "Garaje", kind: "checkbox" },
    { key: "description", label: "Descripción del inmueble", kind: "textarea" },
  ];
  const clientFields = (editing = false): Field[] => [
    { key: "name", label: "Nombre del cliente", required: true },
    {
      key: "phone",
      label: "Teléfono con prefijo",
      readonly: editing,
      help: editing
        ? "El teléfono está vinculado al hilo y no se modifica desde esta ficha."
        : "Por ejemplo: +34 600 000 000. También puedes crear la ficha sin teléfono.",
    },
    { key: "email", label: "Correo electrónico" },
    {
      key: "role",
      label: "Relación con la inmobiliaria",
      kind: "select",
      required: true,
      options: OPTIONS(["comprador", "propietario", "ambos"]),
    },
    advisor,
    { key: "budgetMin", label: "Presupuesto mínimo (€)", kind: "money" },
    { key: "budgetMax", label: "Presupuesto máximo (€)", kind: "money" },
    {
      key: "preferredCity",
      label: "Zonas de búsqueda",
      help: "Municipios separados por comas",
    },
    { key: "minRooms", label: "Mínimo de habitaciones", kind: "number" },
    {
      key: "propertyType",
      label: "Tipo de vivienda buscada",
      kind: "select",
      options: OPTIONS(PROPERTY_TYPES),
    },
  ];
  const dealFields: Field[] = [
    {
      key: "propertyId",
      label: "Inmueble de la operación",
      kind: "select",
      required: true,
      options: propertyOptions,
    },
    {
      key: "contactId",
      label: "Comprador",
      kind: "select",
      required: true,
      options: clientOptions,
    },
    advisor,
    {
      key: "phase",
      label: "Fase de la operación",
      kind: "select",
      required: true,
      options: OPTIONS(DEAL_PHASES),
    },
    { key: "amountCents", label: "Importe acordado (€)", kind: "money" },
    { key: "notes", label: "Notas de la operación", kind: "textarea" },
    {
      key: "lostReason",
      label: "Motivo de pérdida",
      help: "Obligatorio al marcar la operación como perdida",
    },
  ];
  const visitFields: Field[] = [
    {
      key: "propertyId",
      label: "Vivienda que se visita",
      kind: "select",
      required: true,
      options: propertyOptions,
    },
    {
      key: "contactId",
      label: "Cliente de la visita",
      kind: "select",
      required: true,
      options: clientOptions,
    },
    { ...advisor, required: true },
    {
      key: "startsAt",
      label: "Fecha y hora de la visita",
      kind: "datetime",
      required: true,
      help: "Europe/Madrid, con cambio de horario de verano automático",
    },
    {
      key: "durationMinutes",
      label: "Duración (minutos)",
      kind: "number",
      required: true,
    },
    {
      key: "status",
      label: "Estado de la visita",
      kind: "select",
      required: true,
      options: OPTIONS(VISIT_STATES),
    },
    { key: "notes", label: "Indicaciones para la visita", kind: "textarea" },
  ];
  function editVisit(visit?: Visit | object) {
    setEditor({
      operation: "visit",
      title: visit && "id" in visit ? "Editar visita" : "Nueva visita",
      initial: {
        durationMinutes: 30,
        status: "pendiente",
        assignedUserId: data!.userId,
        ...visit,
      },
      fields: visitFields,
    });
  }
  function newProperty() {
    setEditor({
      operation: "property",
      title: "Nuevo inmueble",
      initial: {
        type: "piso",
        status: "disponible",
        rooms: 0,
        bathrooms: 0,
        assignedUserId: data!.userId,
      },
      fields: propertyFields,
    });
  }
  function newClient() {
    setEditor({
      operation: "client",
      title: "Nuevo cliente",
      initial: { role: "comprador", assignedUserId: data!.userId },
      fields: clientFields(),
    });
  }
  function newDeal(initial?: object) {
    setEditor({
      operation: "deal",
      title: "Nueva operación",
      initial: { phase: "nuevo", assignedUserId: data!.userId, ...initial },
      fields: dealFields,
    });
  }
  const activeEntity: EntityType | undefined =
    view === "properties"
      ? "property"
      : view === "clients"
        ? "client"
        : view === "deals"
          ? "deal"
          : undefined;
  const p =
    view === "properties"
      ? data.properties.find((p) => p.id === selected)
      : undefined;
  const c =
    view === "clients"
      ? data.clients.find((c) => c.id === selected)
      : undefined;
  const deal =
    view === "deals" ? data.deals.find((d) => d.id === selected) : undefined;
  const selectedTitle = p
    ? `${p.reference} · ${p.title}`
    : c
      ? c.name
      : deal
        ? `${data.properties.find((p) => p.id === deal.propertyId)?.reference} · ${data.clients.find((c) => c.id === deal.contactId)?.name}`
        : null;
  const ownDocs = new Set(
    data.documents.filter((d) => d.previousId).map((d) => d.previousId),
  );
  const photo = (id: string) =>
    data.documents.find(
      (d) =>
        d.entityType === "property" &&
        d.entityId === id &&
        d.category === "fotografía" &&
        d.hasFile &&
        d.mime?.startsWith("image/") &&
        !ownDocs.has(d.id),
    );
  const matches = (...values: (string | null | undefined)[]) =>
    !query ||
    values
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es"));
  const filteredProperties = data.properties.filter(
    (p) =>
      matches(p.reference, p.title, p.address, p.city) &&
      (!status || p.status === status) &&
      (!type || p.type === type) &&
      (!city ||
        p.city
          .toLocaleLowerCase("es")
          .includes(city.toLocaleLowerCase("es"))) &&
      (!min || p.priceCents >= Number(min) * 100) &&
      (!max || p.priceCents <= Number(max) * 100) &&
      (!assignee || p.assignedUserId === assignee),
  );
  const filteredClients = data.clients.filter(
    (c) =>
      (!c.archivedAt || includeArchived) &&
      matches(c.name, c.phone, c.email, c.preferredCity) &&
      (!status || c.role === status || c.role === "ambos") &&
      (!assignee || c.assignedUserId === assignee),
  );
  const filteredDeals = data.deals.filter(
    (d) =>
      matches(
        data.properties.find((p) => p.id === d.propertyId)?.reference,
        data.clients.find((c) => c.id === d.contactId)?.name,
        d.notes,
      ) &&
      (!status || d.phase === status) &&
      (!assignee || d.assignedUserId === assignee),
  );
  const total =
    view === "properties"
      ? filteredProperties.length
      : view === "clients"
        ? filteredClients.length
        : filteredDeals.length;
  const empty = (text: string) => (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      {text}
    </div>
  );
  const selector = (
    name: string,
    value: string,
    set: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <label className="text-xs text-muted-foreground">
      {name}
      <select
        aria-label={name}
        className="ml-2 rounded border bg-background p-2 text-sm text-foreground"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{TITLES[view]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === "today"
              ? "Visitas, acciones y expedientes que necesitan atención."
              : view === "agenda"
                ? "Visitas presenciales vinculadas a tus viviendas y clientes."
                : "Gestiona la actividad de tu inmobiliaria y abre cada expediente."}
          </p>
        </div>
        {view === "properties" && (
          <Button onClick={newProperty}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo inmueble
          </Button>
        )}
        {view === "clients" && (
          <Button onClick={newClient}>Nuevo cliente</Button>
        )}
        {view === "deals" && (
          <Button onClick={() => newDeal()}>Nueva operación</Button>
        )}
      </header>
      {error && (
        <div role="alert" className="mb-4 text-destructive">
          {error}{" "}
          <Button variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}
      {view === "today" && (
        <>
          <DailyWork data={data} onVisit={editVisit} />
          {data.canManage && <BackupPanel reload={load} />}
        </>
      )}
      {view === "agenda" && (
        <EstateAgenda data={data} onEdit={editVisit} onNew={editVisit} />
      )}
      {selected &&
        activeEntity &&
        !selectedTitle &&
        empty("Este expediente no está disponible en tu organización.")}
      {selectedTitle && (
        <>
          <Button variant="ghost" className="mb-4" onClick={clear}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al listado
          </Button>
          <section
            className="rounded-lg border bg-card p-4 sm:p-6"
            aria-label="Ficha del expediente"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">{selectedTitle}</h2>
              <Button
                variant="outline"
                onClick={() =>
                  setEditor({
                    operation: activeEntity!,
                    title: "Editar ficha",
                    initial: p ?? c ?? deal!,
                    fields: p
                      ? propertyFields
                      : c
                        ? clientFields(true)
                        : dealFields.map((f) =>
                            f.key === "propertyId" || f.key === "contactId"
                              ? { ...f, readonly: true }
                              : f,
                          ),
                  })
                }
              >
                Editar ficha
              </Button>
            </div>
            {p && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p>
                    {p.address} · {p.postalCode} {p.city}
                  </p>
                  <p className="mt-3 text-xl font-semibold">
                    {euro(p.priceCents)}
                  </p>
                  <p className="mt-2">
                    {p.area} m² · {p.rooms} habitaciones · {p.bathrooms} baños
                  </p>
                  <p>
                    {[
                      p.garden && "Jardín",
                      p.terrace && "Terraza",
                      p.garage && "Garaje",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2">
                    {label(p.status)} ·{" "}
                    {data.team.find((t) => t.id === p.assignedUserId)?.name ??
                      "Sin asesor asignado"}
                  </p>
                  {p.ownerContactId && (
                    <Link
                      className={linkClass}
                      href={`/clients?id=${p.ownerContactId}`}
                    >
                      Propietario:{" "}
                      {
                        data.clients.find((c) => c.id === p.ownerContactId)
                          ?.name
                      }
                    </Link>
                  )}
                  <p className="mt-3 whitespace-pre-wrap">{p.description}</p>
                </div>
                {photo(p.id) && (
                  <img
                    className="max-h-64 w-full rounded-lg object-cover"
                    alt={p.title}
                    src={`/api/estate/documents/${photo(p.id)!.id}?preview=1`}
                  />
                )}
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button onClick={() => editVisit({ propertyId: p.id })}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Concertar visita
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => newDeal({ propertyId: p.id })}
                  >
                    Abrir operación
                  </Button>
                </div>
              </div>
            )}
            {c && (
              <div className="mt-4 space-y-3">
                <p>
                  {c.phone ?? "Sin teléfono"} · {c.email ?? "Sin correo"} ·{" "}
                  {label(c.role)}
                </p>
                <p>
                  Presupuesto:{" "}
                  {c.budgetMin != null ? euro(c.budgetMin) : "Sin mínimo"} —{" "}
                  {c.budgetMax != null ? euro(c.budgetMax) : "Sin máximo"} ·
                  Zonas: {c.preferredCity ?? "Por concretar"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{c.notes}</p>
                <div className="flex flex-wrap gap-3">
                  <Link className={linkClass} href={`/inbox?contact=${c.id}`}>
                    Abrir conversación
                  </Link>
                  <Link className={linkClass} href="/contacts">
                    Ver en Contactos
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => editVisit({ contactId: c.id })}
                  >
                    Concertar visita
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => newDeal({ contactId: c.id })}
                  >
                    Abrir operación
                  </Button>
                </div>
                {c.leadId && <NextAction key={c.id} leadId={c.leadId} />}
                <h3 className="pt-3 font-semibold">Viviendas que encajan</h3>
                <p className="text-xs text-muted-foreground">
                  Disponibles y dentro de las preferencias registradas. Completa
                  la ficha para afinar los resultados.
                </p>
                <div className="flex flex-wrap gap-3">
                  {matchingProperties(c, data.properties).map((p) => (
                    <Link
                      className={linkClass}
                      key={p.id}
                      href={`/properties?id=${p.id}`}
                    >
                      {p.reference} · {p.city} · {euro(p.priceCents)}
                    </Link>
                  ))}
                  {matchingProperties(c, data.properties).length === 0 && (
                    <p className="text-sm">
                      No hay coincidencias con las preferencias actuales.
                    </p>
                  )}
                </div>
                {data.properties.some((p) => p.ownerContactId === c.id) && (
                  <>
                    <h3 className="pt-3 font-semibold">
                      Inmuebles en propiedad
                    </h3>
                    {data.properties
                      .filter((p) => p.ownerContactId === c.id)
                      .map((p) => (
                        <p key={p.id}>
                          <Link
                            className={linkClass}
                            href={`/properties?id=${p.id}`}
                          >
                            {p.reference} · {p.title}
                          </Link>
                        </p>
                      ))}
                  </>
                )}
              </div>
            )}
            {deal && (
              <div className="mt-4 space-y-4">
                <p>
                  <Link
                    className={linkClass}
                    href={`/properties?id=${deal.propertyId}`}
                  >
                    Ver inmueble
                  </Link>{" "}
                  ·{" "}
                  <Link
                    className={linkClass}
                    href={`/clients?id=${deal.contactId}`}
                  >
                    Ver comprador
                  </Link>
                </p>
                <p className="font-medium">
                  {label(deal.phase)} · {euro(deal.amountCents)}
                </p>
                <p className="whitespace-pre-wrap">{deal.notes}</p>
                {deal.lostReason && <p>Motivo de pérdida: {deal.lostReason}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Ofertas y negociación</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditor({
                        operation: "offer",
                        title: "Registrar oferta",
                        initial: {
                          dealId: deal.id,
                          kind: "oferta",
                          status: "pendiente",
                        },
                        fields: [
                          {
                            key: "dealId",
                            label: "Operación",
                            kind: "select",
                            required: true,
                            readonly: true,
                            options: [
                              { value: deal.id, label: selectedTitle! },
                            ],
                          },
                          {
                            key: "kind",
                            label: "Tipo de propuesta",
                            kind: "select",
                            required: true,
                            options: OPTIONS(["oferta", "contraoferta"]),
                          },
                          {
                            key: "amountCents",
                            label: "Importe de la propuesta (€)",
                            kind: "money",
                            required: true,
                          },
                          {
                            key: "status",
                            label: "Respuesta",
                            kind: "select",
                            required: true,
                            options: OPTIONS([
                              "pendiente",
                              "aceptada",
                              "rechazada",
                            ]),
                          },
                          {
                            key: "notes",
                            label: "Notas de negociación",
                            kind: "textarea",
                          },
                        ],
                      })
                    }
                  >
                    Registrar oferta
                  </Button>
                </div>
                <ul className="space-y-2">
                  {data.offers
                    .filter((o) => o.dealId === deal.id)
                    .map((o) => (
                      <li key={o.id} className="rounded border p-3">
                        <p>
                          {label(o.kind)} · {euro(o.amountCents)} ·{" "}
                          {label(o.status)}
                        </p>
                        <p className="text-sm">{o.notes}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleString("es-ES")}
                        </p>
                        <div className="mt-2 flex gap-2">
                          {["aceptada", "rechazada"].map((state) => (
                            <Button
                              key={state}
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await requestJson("/api/estate", {
                                    method: "POST",
                                    headers: {
                                      "content-type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      operation: "offer",
                                      ...o,
                                      status: state,
                                    }),
                                  });
                                  await load();
                                } catch (err) {
                                  setError((err as Error).message);
                                }
                              }}
                            >
                              {state === "aceptada"
                                ? "Aceptar oferta"
                                : "Rechazar oferta"}
                            </Button>
                          ))}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {activeEntity !== "deal" && (
              <div className="mt-5">
                <h3 className="font-semibold">Operaciones relacionadas</h3>
                {data.deals
                  .filter((d) =>
                    p ? d.propertyId === p.id : d.contactId === c?.id,
                  )
                  .map((d) => (
                    <p key={d.id} className="mt-2">
                      <Link className={linkClass} href={`/deals?id=${d.id}`}>
                        {
                          data.properties.find((p) => p.id === d.propertyId)
                            ?.reference
                        }{" "}
                        · {data.clients.find((c) => c.id === d.contactId)?.name}{" "}
                        · {label(d.phase)}
                      </Link>
                    </p>
                  ))}
              </div>
            )}
            <div className="mt-5">
              <h3 className="font-semibold">Visitas relacionadas</h3>
              {data.visits
                .filter((v) =>
                  p
                    ? v.propertyId === p.id
                    : c
                      ? v.contactId === c.id
                      : v.propertyId === deal?.propertyId &&
                        v.contactId === deal?.contactId,
                )
                .map((v) => (
                  <p key={v.id} className="mt-2">
                    <button className={linkClass} onClick={() => editVisit(v)}>
                      {new Date(v.startsAt).toLocaleString("es-ES", {
                        timeZone: "Europe/Madrid",
                      })}{" "}
                      · {label(v.status)}
                    </button>
                  </p>
                ))}
            </div>
          </section>
          {activeEntity && selected && (
            <Dossier
              data={data}
              type={activeEntity}
              id={selected}
              reload={load}
            />
          )}
        </>
      )}
      {!selected && ["properties", "clients", "deals"].includes(view) && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar expediente"
                placeholder={
                  view === "properties"
                    ? "Referencia, vivienda, dirección o municipio…"
                    : "Buscar por cliente, referencia o datos de la ficha…"
                }
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {selector(
              view === "deals" ? "Fase" : "Estado o relación",
              status,
              setStatus,
              OPTIONS(
                view === "properties"
                  ? PROPERTY_STATES
                  : view === "clients"
                    ? ["comprador", "propietario", "ambos", "sin_clasificar"]
                    : DEAL_PHASES,
              ),
            )}
            {selector("Responsable", assignee, setAssignee, teamOptions)}
            {view === "clients" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Incluir clientes archivados
              </label>
            )}
            {view === "properties" && (
              <>
                {selector(
                  "Tipo de inmueble",
                  type,
                  setType,
                  OPTIONS(PROPERTY_TYPES),
                )}
                <Input
                  aria-label="Municipio del inmueble"
                  placeholder="Municipio"
                  className="w-40"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Precio mínimo"
                  placeholder="Desde (€)"
                  className="w-32"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Precio máximo"
                  placeholder="Hasta (€)"
                  className="w-32"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </>
            )}
          </div>
          {view === "properties" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.slice((page - 1) * 24, page * 24).map((p) => (
                <button
                  key={p.id}
                  onClick={() => open(p.id)}
                  className="overflow-hidden rounded-lg border bg-card text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {photo(p.id) ? (
                    <img
                      src={`/api/estate/documents/${photo(p.id)!.id}?preview=1`}
                      alt={p.title}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-muted">
                      <Building2 className="h-9 w-9 text-muted-foreground" />
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground">
                      {p.reference} · {label(p.status)}
                    </p>
                    <h2 className="break-words font-semibold">{p.title}</h2>
                    <p className="text-sm">
                      {p.city} · {p.area} m² · {p.rooms} hab.
                    </p>
                    <p className="font-semibold">{euro(p.priceCents)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {view === "clients" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredClients.slice((page - 1) * 24, page * 24).map((c) => (
                <button
                  key={c.id}
                  onClick={() => open(c.id)}
                  className="rounded-lg border bg-card p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <h2 className="font-semibold">{c.name}</h2>
                  <p className="mt-2 text-sm">
                    {label(c.role)} · {c.phone ?? "Sin teléfono"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.preferredCity ?? "Preferencias por completar"}
                  </p>
                </button>
              ))}
            </div>
          )}
          {view === "deals" && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {DEAL_PHASES.filter((phase) => !status || status === phase).map(
                (phase) => (
                  <section
                    key={phase}
                    className="w-64 shrink-0 rounded-lg bg-muted p-3"
                  >
                    <h2 className="mb-3 font-semibold">
                      {label(phase)} (
                      {filteredDeals.filter((d) => d.phase === phase).length})
                    </h2>
                    <ul className="space-y-3">
                      {filteredDeals
                        .filter((d) => d.phase === phase)
                        .map((d) => (
                          <li key={d.id}>
                            <button
                              className="w-full rounded border bg-card p-3 text-left hover:border-primary"
                              onClick={() => open(d.id)}
                            >
                              <h3 className="font-medium">
                                {
                                  data.properties.find(
                                    (p) => p.id === d.propertyId,
                                  )?.reference
                                }
                              </h3>
                              <p className="mt-1 text-sm">
                                {
                                  data.clients.find((c) => c.id === d.contactId)
                                    ?.name
                                }
                              </p>
                              <p className="mt-2 text-sm">
                                {euro(d.amountCents)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {data.team.find(
                                  (t) => t.id === d.assignedUserId,
                                )?.name ?? "Sin asignar"}
                              </p>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}
          {total === 0 &&
            empty(
              "No hay resultados. Ajusta los filtros o crea el primer expediente.",
            )}
          {view !== "deals" && (
            <nav
              aria-label="Paginación de expedientes"
              className="mt-5 flex items-center justify-between gap-2 text-sm"
            >
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>
                {total} registros · Página {page} de{" "}
                {Math.max(1, Math.ceil(total / 24))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 24 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}
      {view === "documents" && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              aria-label="Buscar documento"
              placeholder="Buscar documento, categoría o expediente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md"
            />
            {selector(
              "Estado del documento",
              status,
              setStatus,
              OPTIONS(["pendiente", "revisado", "pendiente_firma", "firmado"]),
            )}
          </div>
          <ul className="space-y-3">
            {data.documents
              .filter(
                (d) =>
                  !ownDocs.has(d.id) &&
                  matches(d.title, d.category, d.filename) &&
                  (!status || d.status === status),
              )
              .map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border bg-card p-4"
                >
                  <div>
                    <h2 className="font-medium">{d.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {label(d.category)} · v{d.version} · {label(d.status)} ·{" "}
                      {d.hasFile ? "Archivo incorporado" : "Archivo pendiente"}
                    </p>
                  </div>
                  <Link
                    className={linkClass}
                    href={`/${d.entityType === "property" ? "properties" : d.entityType === "client" ? "clients" : "deals"}?id=${d.entityId}`}
                  >
                    Abrir expediente
                  </Link>
                </li>
              ))}
          </ul>
          {!data.documents.length &&
            empty(
              "Añade contratos o documentos desde la ficha de un cliente, inmueble u operación.",
            )}
        </>
      )}
      {editor && (
        <Editor
          {...editor}
          key={
            editor.title +
            ("id" in editor.initial
              ? (editor.initial as { id: string }).id
              : "")
          }
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            void load();
            if (
              ["property", "client", "deal"].includes(editor.operation) &&
              editor.operation === activeEntity
            )
              open(id);
          }}
        />
      )}
    </div>
  );
}
