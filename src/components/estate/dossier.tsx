"use client";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  documentSubject,
  coveredRequests,
  currentDocuments,
} from "@/lib/estate-documents";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Editor, type Field } from "./editor";
import {
  DOCUMENT_STATES,
  label,
  type EntityType,
  type EstateData,
} from "@/lib/estate";
import { requestJson } from "@/lib/request-json";
export function documentFields(data: EstateData): Field[] {
  return [
    { key: "title", label: "Título del documento", required: true },
    {
      key: "documentType",
      label: "Tipo de documento",
      kind: "select",
      required: true,
      options: DOCUMENT_TYPES.map((value) => ({
        value,
        label: documentTypeLabel(value),
      })),
    },
    {
      key: "subjectContactId",
      label: "Cliente del documento",
      kind: "select",
      options: data.clients.map((c) => ({ value: c.id, label: c.name })),
      help: "Identifica a quién corresponde el archivo. Revisa el titular si el remitente lo ha enviado para otra persona.",
    },
    {
      key: "propertyId",
      label: "Inmueble relacionado",
      kind: "select",
      options: data.properties.map((p) => ({
        value: p.id,
        label: p.reference + " · " + p.title,
      })),
    },
    {
      key: "dealId",
      label: "Operación relacionada",
      kind: "select",
      options: data.deals.map((d) => ({
        value: d.id,
        label:
          (data.properties.find((p) => p.id === d.propertyId)?.reference ??
            "Inmueble") +
          " · " +
          (data.clients.find((c) => c.id === d.contactId)?.name ?? "Cliente"),
      })),
    },
    {
      key: "fulfilsDocumentId",
      label: "Corresponde a una solicitud",
      kind: "select",
      options: (values) =>
        data.documents
          .filter(
            (d) =>
              !d.hasFile &&
              d.source === "manual" &&
              !d.fulfilsDocumentId &&
              !d.previousId &&
              documentSubject(d) === values.subjectContactId &&
              d.id !== values.id,
          )
          .map((d) => ({ value: d.id, label: d.title })),
      help: "Selecciona la solicitud concreta del mismo cliente después de incorporar el archivo.",
    },
    {
      key: "reviewNote",
      label: "Resultado de la revisión o motivo de rechazo",
      kind: "textarea",
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
      readonly: true,
      options: [
        { value: "restringido", label: "Propietario y asesor responsable" },
        { value: "equipo", label: "Propietario y asesor responsable" },
      ],
      help: "El acceso depende de la cartera del cliente. Otros asesores no pueden consultar este archivo.",
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
  const covered = coveredRequests(data.documents);
  const docs = data.documents.filter(
    (d) =>
      !covered.has(d.id) &&
      (type === "client"
        ? documentSubject(d) === id
        : (d.entityType === type && d.entityId === id) ||
          (type === "property" ? d.propertyId === id : d.dealId === id)),
  );
  const current = currentDocuments(docs);

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
  async function retry(docId: string) {
    setBusy(docId);
    setError("");
    try {
      await requestJson(`/api/estate/documents/${docId}/retry`, {
        method: "POST",
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
                  documentType: "sin_clasificar",
                  subjectContactId:
                    type === "client"
                      ? id
                      : type === "deal"
                        ? (data.deals.find((d) => d.id === id)?.contactId ??
                          null)
                        : (data.properties.find((p) => p.id === id)
                            ?.ownerContactId ?? null),
                  propertyId: type === "property" ? id : null,
                  dealId: type === "deal" ? id : null,
                  category: "otro",
                  status: "pendiente",
                  visibility: "restringido",
                },
                fields: documentFields(data),
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
        <p className="mt-3 text-sm">
          {current.filter((d) => !d.hasFile).length} solicitudes o archivos
          pendientes ·{" "}
          {current.filter((d) => d.hasFile && d.status === "pendiente").length}{" "}
          por revisar · {current.filter((d) => d.status === "rechazado").length}{" "}
          rechazados
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          «Añadir documento» registra lo que necesitas de este cliente; no envía
          un mensaje. Al recibirlo, clasifícalo y vincúlalo a su solicitud.
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
                      {documentTypeLabel(d.documentType)} · v{d.version}
                      {hasNext ? " · Versión anterior" : ""} · {label(d.status)}{" "}
                      · Propietario y asesor responsable
                    </p>
                  </div>
                  {!hasNext && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditor({
                          operation: "document",
                          title: "Editar documento",
                          initial: {
                            ...d,
                            subjectContactId: documentSubject(d),
                          },
                          fields: documentFields(data).map((f) =>
                            f.key === "subjectContactId" && !data.canManage
                              ? {
                                  ...f,
                                  readonly: true,
                                  help: "Solo dirección puede trasladar un documento a otro cliente.",
                                }
                              : f,
                          ),
                        })
                      }
                    >
                      Editar documento
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.source === "whatsapp"
                    ? "Recibido por WhatsApp"
                    : "Carga o solicitud del asesor"}{" "}
                  ·{" "}
                  {new Date(d.createdAt).toLocaleString("es-ES", {
                    timeZone: "Europe/Madrid",
                  })}
                  {documentSubject(d) && (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        className="underline"
                        href={`/clients?id=${documentSubject(d)}`}
                      >
                        {data.clients.find((c) => c.id === documentSubject(d))
                          ?.name ?? "Cliente"}
                      </Link>
                    </>
                  )}
                </p>
                {d.source === "whatsapp" && d.status === "pendiente" && (
                  <p className="mt-2 text-sm">
                    Revisa el cliente, el tipo y el contenido antes de
                    validarlo.
                  </p>
                )}
                {d.fulfilsDocumentId && (
                  <p className="mt-2 text-sm">
                    Solicitud:{" "}
                    {data.documents.find((r) => r.id === d.fulfilsDocumentId)
                      ?.title ?? "Documento solicitado"}
                  </p>
                )}
                {d.reviewNote && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    Revisión: {d.reviewNote}
                  </p>
                )}
                {d.intakeError && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {d.intakeError}
                  </p>
                )}
                {!hasNext && !d.hasFile && d.sourceMediaAssetId && (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void retry(d.id)}
                  >
                    Reintentar incorporación
                  </Button>
                )}
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
                  {!hasNext && (
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
          {(data.canManage || type !== "property") && (
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
          )}
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
                ·{" "}
                {data.team.find((t) => t.id === e.actorId)?.name ??
                  "Recepción automática"}{" "}
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
