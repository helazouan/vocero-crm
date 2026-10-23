"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zonedWallClockToUtc } from "@/lib/time/slots";
import { estateDateTime } from "@/lib/estate";
import { parseMoneyToCents } from "@/lib/money";
import { requestJson } from "@/lib/request-json";
export type Field = {
  key: string;
  label: string;
  kind?:
    | "text"
    | "number"
    | "money"
    | "textarea"
    | "checkbox"
    | "datetime"
    | "select";
  required?: boolean;
  readonly?: boolean;
  options?:
    | { value: string; label: string }[]
    | ((
        values: Record<string, string | boolean>,
      ) => { value: string; label: string }[]);
  help?: string;
};
export function Editor({
  title,
  operation,
  fields,
  initial = {},
  fixed = {},
  onClose,
  onSaved,
}: {
  title: string;
  operation: string;
  fields: Field[];
  initial?: object;
  fixed?: Record<string, unknown>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      Object.entries(initial).map(([key, value]) => {
        const kind = fields.find((f) => f.key === key)?.kind;
        if (
          kind === "datetime" &&
          typeof value === "string" &&
          value.endsWith("Z")
        ) {
          const p = estateDateTime(value, "Europe/Madrid");
          return [key, `${p.date}T${p.time}`];
        }
        if (kind === "money" && typeof value === "number")
          return [key, String(value / 100)];
        return [
          key,
          typeof value === "boolean"
            ? value
            : value == null
              ? ""
              : String(value),
        ];
      }),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { operation, ...fixed };
      if ("id" in initial) payload.id = (initial as { id: string }).id;
      for (const f of fields) {
        const value = values[f.key];
        if (f.kind === "checkbox") payload[f.key] = Boolean(value);
        else if (f.kind === "money") {
          payload[f.key] = value ? parseMoneyToCents(String(value)) : null;
          if (value && payload[f.key] == null)
            throw new Error(`Importe inválido: ${f.label}`);
        } else if (f.kind === "number")
          payload[f.key] = value == null || value === "" ? null : Number(value);
        else if (f.kind === "datetime") {
          if (value) {
            const [day, time] = String(value).split("T");
            const instant = zonedWallClockToUtc(day!, time!, "Europe/Madrid");
            if (!instant)
              throw new Error("La hora elegida no existe en Europe/Madrid");
            payload[f.key] = instant.toISOString();
          } else payload[f.key] = null;
        } else payload[f.key] = value == null || value === "" ? null : value;
      }
      const data = await requestJson<{ id: string }>("/api/estate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      onSaved(data.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[min(640px,94vw)] overflow-y-auto rounded-xl border bg-popover p-5 text-foreground shadow-xl backdrop:bg-overlay"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {fields.map((f) => {
          const options =
            typeof f.options === "function" ? f.options(values) : f.options;
          return (
            <label
              key={f.key}
              className={
                f.kind === "textarea"
                  ? "block text-sm sm:col-span-2"
                  : "block text-sm"
              }
            >
              <span className="mb-1 block">
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.kind === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  disabled={busy}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.checked }))
                  }
                />
              ) : f.kind === "select" ? (
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  required={f.required}
                  disabled={busy || f.readonly}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.key]: e.target.value,
                      ...(f.key === "entityType" ? { entityId: "" } : {}),
                    }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.kind === "textarea" ? (
                <Textarea
                  required={f.required}
                  rows={3}
                  maxLength={8000}
                  disabled={busy}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              ) : (
                <Input
                  required={f.required}
                  readOnly={f.readonly}
                  disabled={busy}
                  type={
                    f.kind === "datetime"
                      ? "datetime-local"
                      : f.kind === "number"
                        ? "number"
                        : "text"
                  }
                  min={f.kind === "number" ? 0 : undefined}
                  maxLength={
                    f.kind === "number" || f.kind === "datetime"
                      ? undefined
                      : 8000
                  }
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              )}
              {f.help && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {f.help}
                </span>
              )}
            </label>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
