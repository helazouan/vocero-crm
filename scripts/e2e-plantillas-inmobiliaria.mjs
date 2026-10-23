import assert from "node:assert/strict";
import { randomBytes, createCipheriv } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";

// Crea una base exclusiva; jamás siembra ni vacía DATABASE_URL.
const source = new URL(process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(source.hostname),
  "Solo PostgreSQL local de pruebas",
);
source.pathname = "/postgres";
const admin = postgres(source.toString(), { max: 1 });
const database = `vocero_e2e_${randomBytes(6).toString("hex")}`;
await admin.unsafe(`CREATE DATABASE ${database}`);
source.pathname = `/${database}`;
const sql = postgres(source.toString(), {
  max: 2,
  connection: { TimeZone: "UTC" },
});
const port = process.env.E2E_PORT ?? "3111";
const base = `http://localhost:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: source.toString(),
  APP_BASE_URL: base,
  VOCERO_DIST_DIR: ".next-e2e",
  ALLOW_SIGNUP: "true",
  AGENDA: "",
  CHANNELS: "",
  MEDIA_DIR: `.local/estate-media-${database}`,
  MEDIA_STORE: "",
  MEDIA_BUCKET_ENDPOINT: "",
  MEDIA_BUCKET_NAME: "",
  MEDIA_BUCKET_KEY_ID: "",
  MEDIA_BUCKET_SECRET: "",
  BRAIN_DISPATCH_URL: "",
  BRAIN_HEALTH_URL: "",
  OPENROUTER_API_TOKEN: "",
  OPENROUTER_MODEL: "",
};
env.WA_MOCK_ENABLED = "true";
env.META_GRAPH_BASE_URL = `${base}/api/dev/wa-mock/graph`;
let server;
let browser;
mkdirSync(".local", { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const generatedConfig = ["next-env.d.ts", "tsconfig.json"].map((path) => [
  path,
  readFileSync(path, "utf8"),
]);
const credentials = {
  name: "Prueba local",
  email: "crm-review@example.test",
  password: "Vocero-pruebas-046!",
};
let cookie = "";
async function api(path, body, method = body ? "POST" : "GET") {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: base, cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, data: await res.json() };
}
try {
  const migration = spawnSync(
    process.execPath,
    ["node_modules/drizzle-kit/bin.cjs", "migrate"],
    { env, encoding: "utf8" },
  );
  assert.equal(migration.status, 0, migration.stderr);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      env,
      stdio: [
        "ignore",
        openSync(".local/e2e-plantillas-server.log", "w"),
        openSync(".local/e2e-plantillas-server-error.log", "w"),
      ],
    },
  );
  for (let i = 0; i < 120; i++) {
    if (
      await fetch(`${base}/api/health`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    assert(i < 119, "Servidor no arrancó");
    await sleep(500);
  }
  assert.equal((await api("/api/auth/sign-up/email", credentials)).status, 200);
  const [org] = await sql`select id from organization limit 1`;
  const [owner] =
    await sql`select user_id as id from member where organization_id=${org.id}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(
    cookie
      .split("; ")
      .map((pair) => ({
        name: pair.slice(0, pair.indexOf("=")),
        value: pair.slice(pair.indexOf("=") + 1),
        url: base,
      })),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/templates", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Fallo controlado de carga" },
          }),
        })
      : route.continue(),
  );
  await page.goto(`${base}/settings/templates`);
  await page
    .getByRole("alert")
    .filter({ hasText: "Fallo controlado de carga" })
    .waitFor();
  assert.equal(
    await page
      .getByText("Todavía no tienes plantillas", { exact: true })
      .count(),
    0,
  );
  await page.unroute("**/api/templates");
  await page
    .getByRole("button", { name: "Reintentar carga", exact: true })
    .click();
  await page
    .getByText("Todavía no tienes plantillas", { exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Antes de enviarla a revisión", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Pasos para utilizar una plantilla" })
      .getByRole("listitem")
      .count(),
    3,
  );
  assert.equal(await page.locator("div.max-w-3xl svg:not([aria-hidden='true'])").count(), 0);
  await page
    .getByRole("button", { name: "Nueva plantilla", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Idioma del mensaje", { exact: true }).inputValue(),
    "es_ES",
  );
  for (const [title, name, count, category] of [
    ["Confirmación de visita", "confirmacion_visita", 5, "UTILITY"],
    ["Recordatorio de visita", "recordatorio_visita", 5, "UTILITY"],
    ["Seguimiento de operación", "seguimiento_operacion", 4, "UTILITY"],
    ["Propuesta de vivienda", "propuesta_vivienda", 3, "MARKETING"],
  ]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    assert.equal(
      await page.getByLabel("Nombre interno", { exact: true }).inputValue(),
      name,
    );
    assert.equal(
      await page.locator('input[name="tpl-category"]:checked').inputValue(),
      category,
    );
    for (let i = 1; i <= count; i++)
      assert(
        (await page.getByLabel(`{{${i}}}`, { exact: true }).inputValue())
          .length > 0,
      );
    assert(
      !/cotización|limpieza dental|lugares disponibles/.test(
        await page.getByLabel("Mensaje", { exact: true }).inputValue(),
      ),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Crear y enviar a revisión", exact: true })
        .isEnabled(),
      false,
    );
  }
  await page.screenshot({
    path: ".local/plantillas-sin-conexion.png",
    fullPage: true,
  });
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(env.ENCRYPTION_KEY, "base64"),
      iv,
    );
  const encrypted = Buffer.concat([
    cipher.update("token-ficticio-053", "utf8"),
    cipher.final(),
  ]).toString("base64");
  await sql`insert into meta_credentials(id,organization_id,waba_id,phone_number_id,token_cipher,token_iv,token_tag,status) values('cred_tpl',${org.id},'waba_tpl','phone_tpl',${encrypted},${iv.toString("base64")},${cipher.getAuthTag().toString("base64")},'connected')`;
  await page.reload();
  await page
    .getByRole("button", { name: "Nueva plantilla", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmación de visita", exact: true })
    .click();
  const body = await page.getByLabel("Mensaje", { exact: true }).inputValue();
  await page.getByLabel("{{1}}", { exact: true }).fill("");
  assert.equal(
    await page
      .getByRole("button", { name: "Crear y enviar a revisión", exact: true })
      .isEnabled(),
    false,
  );
  await page.getByLabel("{{1}}", { exact: true }).fill("Ana");
  await page.route("**/api/templates", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Fallo controlado de guardado" },
          }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Crear y enviar a revisión", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fallo controlado de guardado" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Mensaje", { exact: true }).inputValue(),
    body,
  );
  await page.unroute("**/api/templates");
  await page
    .getByRole("button", { name: "Crear y enviar a revisión", exact: true })
    .click();
  await page.getByText("En revisión", { exact: true }).waitFor();
  assert.equal(
    (await api("/api/templates")).data.templates[0].language,
    "es_ES",
  );
  await api("/api/dev/wa-mock/template-status", {
    wabaId: "waba_tpl",
    name: "confirmacion_visita",
    language: "es_ES",
    event: "APPROVED",
    notify: false,
  });
  await page.route("**/api/templates/sync", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "No se pudo consultar Meta (prueba)" },
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Actualizar estado", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "No se pudo consultar Meta (prueba)" })
    .waitFor();
  await page.getByText("En revisión", { exact: true }).waitFor();
  await page.unroute("**/api/templates/sync");
  await page
    .getByRole("button", { name: "Actualizar estado", exact: true })
    .click();
  await page.getByText("Aprobada", { exact: true }).waitFor();
  await page.screenshot({
    path: ".local/plantillas-inmobiliaria-escritorio.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: ".local/plantillas-inmobiliaria-movil.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  const ownerCookie = cookie;
  assert.equal(
    (
      await api("/api/settings/team", {
        name: "Asesor",
        email: "plantillas-asesor@example.test",
        password: "Prueba-053-asesor!",
      })
    ).status,
    201,
  );
  cookie = "";
  assert.equal(
    (
      await api("/api/auth/sign-in/email", {
        email: "plantillas-asesor@example.test",
        password: "Prueba-053-asesor!",
      })
    ).status,
    200,
  );
  assert.equal((await api("/api/templates")).status, 200);
  assert.equal(
    (
      await api("/api/templates", {
        name: "ajena",
        language: "es_ES",
        category: "UTILITY",
        body: "No debe crearse",
      })
    ).status,
    403,
  );
  assert.equal((await api("/api/templates/sync", {})).status, 403);
  cookie = ownerCookie;
  const templates = (await api("/api/templates")).data.templates;
  assert.equal(templates.length, 1);
  assert.equal(templates[0].status, "approved");
  console.log(
    "Plantillas: ayuda visible, cuatro ejemplos inmobiliarios y es_ES; sin conexión, error de carga/guardado/sync y recuperación; creación y aprobación con Meta simulado, roles, escritorio y móvil correctos.",
  );
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((r) => server.once("exit", r)),
      sleep(8000),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  for (const [path, content] of generatedConfig) writeFileSync(path, content);
  rmSync(env.MEDIA_DIR, { recursive: true, force: true });
  await sql.end();
  await admin.unsafe(`DROP DATABASE ${database} WITH (FORCE)`);
  await admin.end();
}
