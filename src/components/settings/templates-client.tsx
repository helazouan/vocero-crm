"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Inbox,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { requestJson } from "@/lib/request-json";
import type { TemplateDto } from "@/lib/types";
import {
  countVariables,
  renderBody,
  templateWarnings,
  validateBodyVariables,
} from "@/lib/templates";
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  TEMPLATE_LANGUAGE_GROUPS,
  TEMPLATE_LANGUAGES,
  templateLanguageName,
} from "@/lib/template-languages";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = "UTILITY" | "MARKETING";

const STATUS_BADGE: Record<
  TemplateDto["status"],
  {
    label: string;
    variant: "secondary" | "warning" | "success" | "destructive";
    hint: string;
  }
> = {
  draft: {
    label: "Borrador",
    variant: "secondary",
    hint: "Guardada, todavía sin enviar a Meta.",
  },
  pending: {
    label: "En revisión",
    variant: "warning",
    hint: "Meta la está revisando. El plazo puede variar. Actualiza el estado para comprobarlo.",
  },
  approved: {
    label: "Aprobada",
    variant: "success",
    hint: "Lista para usar desde la Bandeja o desde Contactos.",
  },
  rejected: {
    label: "Rechazada",
    variant: "destructive",
    hint: "Corrígela y créala de nuevo con otro nombre.",
  },
};

const CATEGORY: Record<Category, { label: string; description: string }> = {
  UTILITY: {
    label: "Utilidad",
    description:
      "Información sobre una gestión solicitada o acordada: una visita o una operación, sin contenido promocional.",
  },
  MARKETING: {
    label: "Marketing",
    description:
      "Propuestas de viviendas, novedades comerciales o mensajes para retomar el interés de un comprador.",
  },
};

/** Puntos de partida: rellenan el formulario, el dueño los ajusta a su negocio. */
const STARTERS: {
  title: string;
  name: string;
  category: Category;
  body: string;
  examples: string[];
}[] = [
  {
    title: "Confirmación de visita",
    name: "confirmacion_visita",
    category: "UTILITY",
    body: "Hola {{1}}, te escribimos de {{2}} para confirmar la visita que has solicitado a la vivienda {{3}} el {{4}} a las {{5}}. Responde a este mensaje si necesitas cambiar la fecha o la hora.",
    examples: [
      "Ana",
      "Inmobiliaria Horizonte",
      "MAD-101",
      "27 de octubre",
      "17:30",
    ],
  },
  {
    title: "Recordatorio de visita",
    name: "recordatorio_visita",
    category: "UTILITY",
    body: "Hola {{1}}, somos {{2}}. Te recordamos la visita acordada a la vivienda {{3}} el {{4}} a las {{5}}. Si no puedes asistir, avísanos para reorganizarla.",
    examples: [
      "Carlos",
      "Inmobiliaria Horizonte",
      "MAD-102",
      "28 de octubre",
      "12:00",
    ],
  },
  {
    title: "Seguimiento de operación",
    name: "seguimiento_operacion",
    category: "UTILITY",
    body: "Hola {{1}}, te escribimos de {{2}} sobre la operación de la vivienda {{3}} que estamos gestionando contigo. La actualización que nos has solicitado es: {{4}}. Responde si necesitas alguna aclaración.",
    examples: [
      "Lucía",
      "Inmobiliaria Horizonte",
      "MAD-103",
      "La visita a notaría está pendiente de confirmar",
    ],
  },
  {
    title: "Propuesta de vivienda",
    name: "propuesta_vivienda",
    category: "MARKETING",
    body: "Hola {{1}}, somos {{2}}. La vivienda {{3}} podría encajar con lo que buscas. ¿Quieres que te enviemos más información? Si prefieres dejar de recibir propuestas, indícanoslo por aquí.",
    examples: ["María", "Inmobiliaria Horizonte", "MAD-104"],
  },
];

/** Meta solo acepta minúsculas, números y guion bajo en el nombre. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function TemplatesClient({
  whatsappConnected,
}: {
  whatsappConnected: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const data = await requestJson<{ templates: TemplateDto[] }>(
        "/api/templates",
      );
      setTemplates(data.templates);
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const data = await requestJson<{ updated: number }>(
        "/api/templates/sync",
        { method: "POST" },
      );
      setSyncMsg(
        data.updated === 0
          ? "Los estados están al día."
          : data.updated === 1
            ? "Se ha actualizado una plantilla."
            : `Se han actualizado ${data.updated} plantillas.`,
      );
      await refetch();
    } catch (err) {
      setSyncMsg((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const empty = templates !== null && templates.length === 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Plantillas de WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensajes aprobados para confirmar visitas y continuar gestiones con
          tus clientes.
        </p>
      </div>
      {!whatsappConnected && (
        <p role="status" className="rounded-lg border bg-card p-4 text-sm">
          Conecta o revisa tu número en{" "}
          <Link className="underline" href="/settings/whatsapp">
            Ajustes → WhatsApp
          </Link>{" "}
          para enviar plantillas a revisión. Puedes preparar y previsualizar los
          ejemplos; el formulario no se guarda automáticamente.
        </p>
      )}
      <HowItWorks defaultOpen={empty || templates === null} />

      <section className="space-y-3" aria-labelledby="tpl-list-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="tpl-list-title" className="text-base font-semibold">
            Tus plantillas
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncing || !whatsappConnected}
              onClick={() => void sync()}
              title="Consulta a Meta el estado de revisión"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              Actualizar estado
            </Button>
            {!creating && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva plantilla
              </Button>
            )}
          </div>
        </div>
        {syncMsg && (
          <p role="status" className="text-sm text-muted-foreground">
            {syncMsg}
          </p>
        )}
        {loadError && (
          <div role="alert" className="rounded-md border p-3 text-sm">
            <p>{loadError}</p>
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Reintentar carga
            </Button>
          </div>
        )}

        {creating && (
          <CreateForm
            whatsappConnected={whatsappConnected}
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              void refetch();
            }}
          />
        )}

        {templates === null ? (
          !loadError && (
            <p className="text-sm text-muted-foreground">
              Cargando plantillas…
            </p>
          )
        ) : empty ? (
          !creating &&
          !loadError && (
            <EmptyState
              icon={FileText}
              className="rounded-lg border border-dashed"
              title="Todavía no tienes plantillas"
              description="Prepara una confirmación de visita o un seguimiento de operación a partir de los ejemplos inmobiliarios."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Crear mi primera plantilla
                </Button>
              }
            />
          )
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-sm font-medium">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {templateLanguageName(t.language)} ·{" "}
                      {CATEGORY[t.category as Category]?.label ?? t.category}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[t.status].variant}>
                    {STATUS_BADGE[t.status].label}
                  </Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{t.body}</p>
                <p
                  className={cn(
                    "mt-3 text-xs",
                    t.status === "rejected"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {t.status === "rejected" && t.rejectionReason
                    ? `Motivo del rechazo: ${t.rejectionReason}. ${STATUS_BADGE.rejected.hint}`
                    : STATUS_BADGE[t.status].hint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** La explicación: para qué sirven, cómo se aprueban y dónde se usan. */
function HowItWorks({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // Se abre sola la primera vez que la lista llega vacía.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const steps = [
    {
      title: "Créala aquí",
      text: "Elige un ejemplo inmobiliario, ajusta el mensaje y utiliza {{1}}, {{2}}… para el nombre, la vivienda o la fecha.",
    },
    {
      title: "Meta la revisa",
      text: "Envía el texto a revisión. Meta decide la categoría y la aprobación. Pulsa «Actualizar estado» para consultar el resultado; el plazo puede variar.",
    },
    {
      title: "Úsala",
      text: "En la Bandeja, elige una plantilla aprobada y completa las variables antes de enviar. Para iniciar la conversación, utiliza «Escribir primero» en Contactos.",
    },
  ];

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <Sparkles
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-primary"
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold">
            ¿Para qué sirven las plantillas?
          </span>
          <span className="block text-xs text-muted-foreground">
            Permiten iniciar o retomar una conversación cuando necesitas un
            mensaje aprobado por Meta.
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t p-4 text-sm">
          <p className="text-muted-foreground">
            WhatsApp solo te deja escribir con libertad durante las 24 horas que
            siguen al último mensaje de tu cliente. Pasado ese tiempo —o para
            escribirle a alguien que nunca te ha escrito— necesitas un mensaje
            que Meta haya aprobado antes: una plantilla.
          </p>
          <ol
            className="grid list-none gap-3 sm:grid-cols-3"
            aria-label="Pasos para utilizar una plantilla"
          >
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-2 font-medium">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  {s.title}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-md bg-subtle p-3">
            <h4 className="font-medium">Antes de enviarla a revisión</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Identifica a la inmobiliaria y el motivo del mensaje: una visita
                acordada o una actualización solicitada.
              </li>
              <li>
                Numera las variables sin saltos, sepáralas con texto y evita que
                el mensaje empiece o termine con una variable.
              </li>
              <li>
                Utiliza datos ficticios en los ejemplos para Meta y comprueba la
                vista previa antes de enviar.
              </li>
              <li>
                Elige Utilidad para gestiones concretas sin promoción. Las
                propuestas comerciales de viviendas corresponden a Marketing;
                Meta decide la categoría final.
              </li>
              <li>
                Contacta solo con personas que hayan aceptado recibir tus
                mensajes y respeta sus solicitudes de baja. Una plantilla
                aprobada no sustituye ese permiso.
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Las tarifas dependen de la categoría y del mercado del
              destinatario. Consulta las{" "}
              <a
                className="underline"
                href="https://business.whatsapp.com/products/platform-pricing"
                target="_blank"
                rel="noreferrer"
              >
                tarifas de Meta
              </a>{" "}
              y su{" "}
              <a
                className="underline"
                href="https://business.whatsapp.com/policy"
                target="_blank"
                rel="noreferrer"
              >
                política de mensajes
              </a>
              .
            </p>
          </div>
          <p className="flex flex-wrap gap-4 text-xs">
            <Link
              className="inline-flex items-center gap-1 underline"
              href="/inbox"
            >
              <Inbox aria-hidden="true" className="h-3.5 w-3.5" /> Ir a la
              Bandeja
            </Link>
            <Link
              className="inline-flex items-center gap-1 underline"
              href="/contacts"
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" /> Ir a Contactos
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

function CreateForm({
  onCreated,
  onCancel,
  whatsappConnected,
}: {
  whatsappConnected: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(DEFAULT_TEMPLATE_LANGUAGE);
  const [category, setCategory] = useState<Category>("UTILITY");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Misma validación que el servidor: avisa antes de gastar una llamada a Meta.
  const bodyError = body.trim() ? validateBodyVariables(body) : null;
  const variableCount = bodyError ? 0 : countVariables(body);
  const warnings = bodyError ? [] : templateWarnings(body);
  const preview = renderBody(
    body,
    Array.from(
      { length: variableCount },
      (_, i) => examples[i]?.trim() || `[variable ${i + 1}]`,
    ),
  );

  function applyStarter(s: (typeof STARTERS)[number]) {
    setName(s.name);
    setCategory(s.category);
    setBody(s.body);
    setExamples(s.examples);
    setError(null);
  }

  /** Inserta la siguiente variable donde está el cursor. */
  function insertVariable() {
    const next = `{{${countVariables(body) + 1}}}`;
    const el = document.getElementById(
      "tpl-body",
    ) as HTMLTextAreaElement | null;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const value = body.slice(0, start) + next + body.slice(end);
    setBody(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + next.length, start + next.length);
    });
  }

  async function create() {
    if (saving || !whatsappConnected) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          language,
          category,
          body,
          examples: examples.slice(0, variableCount),
        }),
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva plantilla</CardTitle>
        <CardDescription>
          Personaliza el ejemplo y revisa la vista previa. Al enviarla, Meta
          revisará el mensaje. No se envía a ningún cliente en este paso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Empieza con un ejemplo (opcional)
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Button
                key={s.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyStarter(s)}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nombre interno</Label>
            <Input
              id="tpl-name"
              placeholder="confirmacion_visita"
              value={name}
              onChange={(e) => setName(normalizeName(e.target.value))}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Solo minúsculas, números y guion bajo. Tus clientes no lo ven.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-lang">Idioma del mensaje</Label>
            <select
              id="tpl-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {TEMPLATE_LANGUAGE_GROUPS.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {TEMPLATE_LANGUAGES.filter((l) => l.group === g.id).map(
                    (l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">¿Para qué es?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <label
                key={c}
                className={cn(
                  "cursor-pointer rounded-md border p-3 text-sm transition-colors",
                  category === c
                    ? "border-primary bg-brand-tint"
                    : "hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="tpl-category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  className="sr-only peer"
                />
                <span className="block font-medium peer-focus-visible:underline peer-focus-visible:decoration-2">
                  {CATEGORY[c].label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {CATEGORY[c].description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="tpl-body">Mensaje</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={insertVariable}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Insertar variable {`{{${countVariables(body) + 1}}}`}
            </Button>
          </div>
          <Textarea
            id="tpl-body"
            rows={4}
            placeholder="Hola {{1}}, te escribimos de {{2}} para confirmar la visita a la vivienda {{3}}. Responde si necesitas cambiarla."
            maxLength={1024}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {bodyError ? (
            <p className="text-xs text-destructive">{bodyError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Las variables se completan al enviar: {"{{1}}"} puede ser el
              nombre del cliente, {"{{2}}"} una fecha…
            </p>
          )}
          {warnings.map((w) => (
            <p
              key={w}
              className="flex items-start gap-1.5 text-xs text-warning-text"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              {w}
            </p>
          ))}
        </div>

        {variableCount > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ejemplo de cada variable</p>
            <p className="text-xs text-muted-foreground">
              Utiliza ejemplos ficticios: Meta los usa para revisar la
              plantilla. Al enviarla a un cliente, completarás las variables con
              sus datos.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: variableCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Label
                    htmlFor={`tpl-example-${i + 1}`}
                    className="w-10 shrink-0 font-mono text-xs"
                  >
                    {`{{${i + 1}}}`}
                  </Label>
                  <Input
                    id={`tpl-example-${i + 1}`}
                    placeholder={i === 0 ? "Ana" : "p. ej. martes 14"}
                    value={examples[i] ?? ""}
                    onChange={(e) => {
                      const next = [...examples];
                      next[i] = e.target.value;
                      setExamples(next);
                    }}
                    maxLength={200}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {body.trim() && !bodyError && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Así lo verá tu cliente</p>
            <div className="rounded-lg bg-chat p-4">
              <div className="ml-auto max-w-[85%] rounded-lg border border-bubble-out-border bg-bubble-out px-3 py-2 text-sm text-bubble-out-text shadow-sm">
                <p className="whitespace-pre-wrap">{preview}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">10:30</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              saving ||
              !whatsappConnected ||
              !name.trim() ||
              !body.trim() ||
              bodyError !== null ||
              Array.from({ length: variableCount }, (_, i) =>
                examples[i]?.trim(),
              ).some((v) => !v)
            }
            onClick={() => void create()}
          >
            {saving ? "Enviando a Meta…" : "Crear y enviar a revisión"}
          </Button>
          <Button variant="outline" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          Una vez aprobada, podrá utilizarse desde la Bandeja o Contactos. Las
          plantillas las gestiona dirección; cada asesor las envía solo a sus
          clientes.
        </p>
      </CardContent>
    </Card>
  );
}
