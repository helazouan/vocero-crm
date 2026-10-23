"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Editor, type Field } from "./editor";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATES,
  label,
  type EntityType,
  type EstateData,
} from "@/lib/estate";
import { requestJson } from "@/lib/request-json";
export function documentFields(): Field[] {
  return [
    { key: "title", label: "Título del documento", required: true },
    {
      key: "category",
      label: "Categoría",
      kind: "select",
      required: true,
      options: DOCUMENT_CATEGORIES.map((value) => ({
        value,
        label: label(value),
      })),
    },
    {
      key: "status",
      label: "Estado del documento",
      kind: "select",
      required: true,
      options: DOCUMENT_STATES.map((value) => ({ value, label: label(value) })),
    },
    {
      key: "visibility",
      label: "Acceso al documento",
      kind: "select",
      required: true,
      options: [
        { value: "restringido", label: "Restringido: autor y administradores" },
        { value: "equipo", label: "Todo el equipo" },
      ],
    },
    {
      key: "dueAt",
      label: "Fecha límite o vencimiento",
      kind: "datetime",
      help: "Hora de Europe/Madrid",
    },
  ];
}
export function Dossier({
  data,
  type,
  id,
  reload,
}: {
  data: EstateData;
  type: EntityType;
  id: string;
  reload: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<{
    initial: object;
    operation: string;
    title: string;
    fields: Field[];
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  const docs = data.documents.filter(
    (d) => d.entityType === type && d.entityId === id,
  );
  const relatedDeals = data.deals
    .filter((d) =>
      type === "property"
        ? d.propertyId === id
        : type === "client"
          ? d.contactId === id
          : d.id === id,
    )
    .map((d) => d.id);
  const relatedDocs = new Set(docs.map((d) => d.id));
  const events = data.activity.filter(
    (e) =>
      (e.entityType === type && e.entityId === id) ||
      (e.entityType === "deal" && relatedDeals.includes(e.entityId)) ||
      (e.entityType === "document" && relatedDocs.has(e.entityId)),
  );
  async function upload(docId: string, file: File) {
    setBusy(docId);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      await requestJson(`/api/estate/documents/${docId}`, {
        method: "POST",
        body: form,
      });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section
        className="rounded-lg border bg-card p-4"
        aria-label="Documentos del expediente"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Documentos y contratos</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEditor({
                operation: "document",
                title: "Añadir documento",
                initial: {
                  entityType: type,
                  entityId: id,
                  category: "otro",
                  status: "pendiente",
                  visibility: "restringido",
                },
                fields: documentFields(),
              })
            }
          >
            Añadir documento
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          PDF, JPG, PNG o WebP · hasta 10 MiB · archivos cifrados. El estado de
          firma se registra manualmente.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {docs.map((d) => {
            const hasNext = data.documents.some(
              (next) => next.previousId === d.id,
            );
            return (
              <li key={d.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{d.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {label(d.category)} · v{d.version}
                      {hasNext ? " · Versión anterior" : ""} · {label(d.status)}{" "}
                      · {label(d.visibility)}
                    </p>
                  </div>
                  {!hasNext &&
                    (data.canManage || d.uploadedBy === data.userId) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditor({
                            operation: "document",
                            title: "Editar documento",
                            initial: d,
                            fields: documentFields(),
                          })
                        }
                      >
                        Editar documento
                      </Button>
                    )}
                </div>
                {d.dueAt && (
                  <p className="mt-2 text-sm">
                    Fecha límite:{" "}
                    {new Date(d.dueAt).toLocaleString("es-ES", {
                      timeZone: "Europe/Madrid",
                    })}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {d.hasFile && (
                    <a
                      className="break-all text-brand-text underline"
                      href={`/api/estate/documents/${d.id}`}
                      download
                    >
                      {d.filename ?? "Descargar archivo"}
                    </a>
                  )}
                  {!hasNext &&
                    (data.canManage || d.uploadedBy === data.userId) && (
                      <label className="cursor-pointer rounded border px-3 py-2 text-sm hover:bg-accent">
                        {busy === d.id
                          ? "Subiendo…"
                          : d.hasFile
                            ? "Subir nueva versión"
                            : "Subir archivo"}
                        <input
                          className="sr-only"
                          type="file"
                          aria-label={`Archivo para ${d.title}`}
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          disabled={busy !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void upload(d.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                </div>
              </li>
            );
          })}
          {docs.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Todavía no hay documentos. Puedes registrar los que faltan antes
              de subirlos.
            </li>
          )}
        </ul>
      </section>
      <section
        className="rounded-lg border bg-card p-4"
        aria-label="Historial del expediente"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Historial de actividad</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEditor({
                operation: "activity",
                title: "Registrar actividad",
                initial: { entityType: type, entityId: id, kind: "nota" },
                fields: [
                  {
                    key: "kind",
                    label: "Tipo de actividad",
                    kind: "select",
                    required: true,
                    options: ["nota", "llamada", "reunión", "correo"].map(
                      (value) => ({ value, label: label(value) }),
                    ),
                  },
                  {
                    key: "text",
                    label: "Detalle de la actividad",
                    kind: "textarea",
                    required: true,
                  },
                ],
              })
            }
          >
            Registrar actividad
          </Button>
        </div>
        <ol className="mt-4 space-y-4">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 pl-3">
              <p className="whitespace-pre-wrap break-words text-sm">
                {e.text}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString("es-ES", {
                  timeZone: "Europe/Madrid",
                })}{" "}
                · {data.team.find((t) => t.id === e.actorId)?.name ?? "Equipo"}{" "}
                · {e.kind}
              </p>
            </li>
          ))}
          {!events.length && (
            <li className="text-sm text-muted-foreground">
              Los cambios y las notas del equipo aparecerán aquí.
            </li>
          )}
        </ol>
      </section>
      {editor && (
        <Editor
          {...editor}
          key={editor.title}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void reload();
          }}
          fixed={{ entityType: type, entityId: id }}
          fields={editor.fields}
        />
      )}
    </div>
  );
}
