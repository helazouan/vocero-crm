import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env";

const schema = envSchema.pick({ WEBHOOK_BASE_URL: true });
describe("origen público del webhook", () => {
  it("es opcional y acepta un origen HTTPS", () => {
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ WEBHOOK_BASE_URL: "https://prueba.example.com/" }).success).toBe(true);
  });
  it.each(["no-es-url", "http://localhost:3000", "https://u:p@example.com", "https://example.com/ruta", "https://example.com/?token=secreto", "https://example.com/#fragmento"])("rechaza %s", value => {
    expect(schema.safeParse({ WEBHOOK_BASE_URL: value }).success).toBe(false);
  });
});
