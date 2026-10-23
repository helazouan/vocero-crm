import { beforeAll, describe, it, expect } from "vitest";
import {
  currentDocuments,
  documentRoot,
  documentSubject,
  categoryForDocumentType,
} from "@/lib/estate-documents";
import {
  encryptPrivateMedia,
  decryptPrivateMedia,
  privateMedia,
} from "@/lib/storage/private-media";
beforeAll(() => {
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.BETTER_AUTH_SECRET = "secreto-de-prueba-051";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-token-test";
});
describe("documentos por cliente", () => {
  const base = {
    entityType: "client",
    entityId: "a",
    subjectContactId: "a",
    previousId: null,
  };
  it("conserva el titular del documento independiente del expediente relacionado", () => {
    expect(
      documentSubject({ ...base, entityType: "deal", entityId: "operacion" }),
    ).toBe("a");
    expect(
      documentSubject({ entityType: "client", entityId: "anterior" }),
    ).toBe("anterior");
  });
  it("una solicitud cubierta no cuenta como otro archivo pendiente y conserva las versiones", () => {
    const docs = [
      { ...base, id: "solicitud", hasFile: false },
      { ...base, id: "archivo", hasFile: true, fulfilsDocumentId: "solicitud" },
      {
        ...base,
        id: "version",
        hasFile: true,
        previousId: "archivo",
        fulfilsDocumentId: "solicitud",
      },
    ];
    expect(currentDocuments(docs).map((d) => d.id)).toEqual(["version"]);
    expect(documentRoot("version", docs)).toBe("archivo");
  });
  it("los documentos homónimos de clientes distintos permanecen separados", () => {
    expect(
      currentDocuments([
        { ...base, id: "archivo-a", hasFile: true },
        {
          ...base,
          id: "archivo-b",
          subjectContactId: "b",
          entityId: "b",
          hasFile: true,
        },
      ]),
    ).toHaveLength(2);
  });
  it("conserva las categorías compatibles al clasificar un tipo documental", () => {
    expect(categoryForDocumentType("dni_nie")).toBe("identificación");
    expect(categoryForDocumentType("fotografia")).toBe("fotografía");
  });
  it("cifra el original del chat con integridad y sigue leyendo adjuntos antiguos", () => {
    const original = Buffer.from("%PDF-1.4\nDocumento ficticio"),
      encrypted = encryptPrivateMedia(original);
    expect(privateMedia(encrypted)).toBe(true);
    expect(encrypted.includes(original)).toBe(false);
    expect(decryptPrivateMedia(encrypted)).toEqual(original);
    expect(decryptPrivateMedia(original)).toEqual(original);
    const corrupt = Buffer.from(encrypted);
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    expect(() => decryptPrivateMedia(corrupt)).toThrow();
  });
});
