import { describe, it, expect } from "vitest";
import {
  estateDateTime,
  matchingProperties,
  overlaps,
  mutationSchema,
  type Property,
} from "@/lib/estate";
import { validDocument } from "@/server/estate/documents";
const house = {
  id: "p",
  status: "disponible",
  type: "piso",
  priceCents: 30_000_000,
  city: "Madrid",
  rooms: 3,
} as Property;
const buyer = {
  budgetMin: null,
  budgetMax: 32_000_000,
  minRooms: 3,
  propertyType: null,
  preferredCity: "Getafe, Madrid",
};
describe("gestión inmobiliaria", () => {
  it("mantiene fechas ISO para formularios y calendario durante el cambio de hora", () => {
    expect(estateDateTime("2026-10-25T00:30:00Z")).toMatchObject({
      date: "2026-10-25",
      time: "02:30",
    });
    expect(estateDateTime("2026-10-25T01:30:00Z")).toMatchObject({
      date: "2026-10-25",
      time: "02:30",
    });
    expect(estateDateTime("2026-10-23T22:15:00Z")).toMatchObject({
      date: "2026-10-24",
      time: "00:15",
    });
  });
  it("cruza preferencias sin ofrecer viviendas reservadas o fuera de presupuesto", () => {
    expect(
      matchingProperties(buyer, [
        house,
        { ...house, id: "b", status: "reservado" },
        { ...house, id: "c", priceCents: 33_000_000 },
        { ...house, id: "d", rooms: 2 },
      ]).map((p) => p.id),
    ).toEqual(["p"]);
    expect(
      matchingProperties({ ...buyer, preferredCity: "Getafe," }, [house]),
    ).toEqual([]);
  });
  it("permite visitas consecutivas y rechaza una intersección de un minuto", () => {
    const a = { startsAt: "2026-10-24T09:00:00Z", durationMinutes: 30 };
    expect(
      overlaps(a, { startsAt: "2026-10-24T09:30:00Z", durationMinutes: 30 }),
    ).toBe(false);
    expect(
      overlaps(a, { startsAt: "2026-10-24T09:29:00Z", durationMinutes: 30 }),
    ).toBe(true);
    expect(
      overlaps(a, {
        startsAt: "2026-10-24T10:00:00+01:00",
        durationMinutes: 30,
      }),
    ).toBe(true);
  });
  it("valida límites monetarios, identidades, estados y duración", () => {
    expect(
      mutationSchema.safeParse({
        operation: "visit",
        propertyId: "p",
        contactId: "c",
        assignedUserId: "u",
        startsAt: "2026-10-24T10:00:00Z",
        durationMinutes: 0,
        status: "confirmada",
      }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        operation: "client",
        name: "Ana",
        role: "propietario",
        budgetMax: -1,
      }).success,
    ).toBe(false);
  });
  it("rechaza contenido ejecutable aunque declare ser un documento", () => {
    expect(
      validDocument(
        Buffer.from("<script>alert(1)</script>"),
        "application/pdf",
      ),
    ).toBe(false);
    expect(validDocument(Buffer.from("%PDF-1.4\n"), "application/pdf")).toBe(
      true,
    );
    expect(validDocument(Buffer.from("%PDF-1.4\n"), "image/png")).toBe(false);
    expect(validDocument(Buffer.from("%PDF-1.4\n"), "text/html")).toBe(false);
  });
});
