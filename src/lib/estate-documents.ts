export const DOCUMENT_TYPES = [
  "sin_clasificar",
  "dni_nie",
  "pasaporte",
  "nomina",
  "justificante_ingresos",
  "preaprobacion_hipoteca",
  "escritura",
  "nota_simple",
  "certificado_energetico",
  "recibo_ibi",
  "encargo_venta",
  "reserva",
  "arras",
  "compraventa",
  "fotografia",
  "otro",
] as const;
export const DOCUMENT_TYPE_LABELS: Record<
  (typeof DOCUMENT_TYPES)[number],
  string
> = {
  sin_clasificar: "Sin clasificar",
  dni_nie: "DNI / NIE",
  pasaporte: "Pasaporte",
  nomina: "Nómina",
  justificante_ingresos: "Justificante de ingresos",
  preaprobacion_hipoteca: "Preaprobación hipotecaria",
  escritura: "Escritura",
  nota_simple: "Nota simple",
  certificado_energetico: "Certificado energético",
  recibo_ibi: "Recibo del IBI",
  encargo_venta: "Encargo de venta",
  reserva: "Reserva",
  arras: "Contrato de arras",
  compraventa: "Contrato de compraventa",
  fotografia: "Fotografía",
  otro: "Otro documento",
};
export function documentTypeLabel(value: string) {
  return (
    DOCUMENT_TYPE_LABELS[value as keyof typeof DOCUMENT_TYPE_LABELS] ?? value
  );
}
type Doc = {
  id: string;
  previousId: string | null;
  entityType: string;
  entityId: string;
  subjectContactId?: string | null;
  fulfilsDocumentId?: string | null;
  hasFile?: boolean;
  storageId?: string | null;
};
export function documentSubject(
  d: Pick<Doc, "entityType" | "entityId" | "subjectContactId">,
) {
  return d.subjectContactId ?? (d.entityType === "client" ? d.entityId : null);
}
export function documentRoot(
  id: string,
  docs: Pick<Doc, "id" | "previousId">[],
) {
  const visited = new Set<string>();
  let current = id;
  while (!visited.has(current)) {
    visited.add(current);
    const prev = docs.find((d) => d.id === current)?.previousId;
    if (!prev) return current;
    current = prev;
  }
  return current;
}
export function coveredRequests(docs: Doc[]) {
  const old = new Set(docs.map((d) => d.previousId));
  return new Set(
    docs
      .filter(
        (d) =>
          !old.has(d.id) && (d.hasFile || d.storageId) && d.fulfilsDocumentId,
      )
      .map((d) => d.fulfilsDocumentId!),
  );
}
export function currentDocuments<T extends Doc>(docs: T[]) {
  const old = new Set(docs.map((d) => d.previousId)),
    covered = coveredRequests(docs);
  return docs.filter((d) => !old.has(d.id) && !covered.has(d.id));
}

export function categoryForDocumentType(type: string) {
  if (["dni_nie", "pasaporte"].includes(type)) return "identificación";
  if (type === "nota_simple") return "nota_simple";
  if (type === "fotografia") return "fotografía";
  if (type === "reserva") return "reserva";
  if (["arras", "compraventa", "encargo_venta", "escritura"].includes(type))
    return "contrato";
  if (type === "certificado_energetico") return "certificado";
  return "otro";
}
