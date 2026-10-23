import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";

// Crea una base exclusiva; jamás siembra ni vacía DATABASE_URL.
const source = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(source.hostname), "Solo PostgreSQL local de pruebas");
source.pathname = "/postgres";
const admin = postgres(source.toString(), { max: 1 });
const database = `vocero_e2e_${randomBytes(6).toString("hex")}`;
await admin.unsafe(`CREATE DATABASE ${database}`);
source.pathname = `/${database}`;
const sql = postgres(source.toString(), { max: 2, connection: { TimeZone: "UTC" } });
const port = process.env.E2E_PORT ?? "3106";
const base = `http://localhost:${port}`;
const env = { ...process.env, DATABASE_URL: source.toString(), APP_BASE_URL: base,
  VOCERO_DIST_DIR: ".next-e2e", ALLOW_SIGNUP: "true", AGENDA: "", CHANNELS: "",
  BRAIN_DISPATCH_URL: "", BRAIN_HEALTH_URL: "", OPENROUTER_API_TOKEN: "", OPENROUTER_MODEL: "" };
let server;
let browser;
mkdirSync(".local", { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const generatedConfig = ["next-env.d.ts", "tsconfig.json"].map(path => [path, readFileSync(path, "utf8")]);
const credentials = { name: "Prueba local", email: "crm-review@example.test", password: "Vocero-pruebas-046!" };
let cookie = "";
async function api(path, body, method = body ? "POST" : "GET") {
  const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", origin: base, cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map(c => c.split(";")[0]).join("; ");
  return { status: res.status, data: await res.json() };
}
try {
  const migration = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"], { env, encoding: "utf8" });
  assert.equal(migration.status, 0, migration.stderr);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], { env, stdio: ["ignore", openSync(".local/e2e-server.log", "w"), openSync(".local/e2e-server-error.log", "w")] });
  for (let i = 0; i < 120; i++) {
    if (await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false)) break;
    assert(i < 119, "Servidor no arrancó"); await sleep(500);
  }
  assert.equal((await api("/api/auth/sign-up/email", credentials)).status, 200);
  const [org] = await sql`select id from organization limit 1`;
  const [stage] = await sql`select id from pipeline_stage where organization_id=${org.id} and kind='open' order by position limit 1`;
  const contacts = Array.from({ length: 235 }, (_, i) => ({ id: `ct_review_${i}`, organization_id: org.id, name: `Contacto ${String(i).padStart(3, "0")}`, phone: `3460000${String(i).padStart(4, "0")}`, wa_identity: `3460000${String(i).padStart(4, "0")}`, archived_at: i < 20 ? new Date().toISOString() : null }));
  await sql`insert into contact ${sql(contacts)}`;
  await sql`insert into lead (id, organization_id, contact_id, stage_id) values ('ld_review', ${org.id}, 'ct_review_234', ${stage.id})`;
  let result = await api("/api/contacts");
  assert.equal(result.data.total, 215); assert.equal(result.data.contacts.length, 50);
  const ids = new Set();
  for (let page = 1; page <= 5; page++) {
    result = await api(`/api/contacts?page=${page}`);
    for (const c of result.data.contacts) { assert(!c.archivedAt); ids.add(c.id); }
  }
  assert.equal(ids.size, 215);
  assert.equal((await api("/api/contacts?archived=true")).data.total, 235);
  assert.equal((await api("/api/contacts?page=0")).status, 422);
  assert.equal((await api("/api/contacts?q=Contacto%20234")).data.total, 1);
  assert.equal((await api("/api/onboarding/status")).data.guide.mode, "manual");
  await api("/api/onboarding/status", { mode: "agent" }, "PATCH");
  assert.equal((await api("/api/onboarding/status")).data.guide.mode, "agent");
  await sql`update agent_profile set enabled=true where organization_id=${org.id}`;
  await api("/api/onboarding/status", { mode: "manual" }, "PATCH");
  assert.equal((await sql`select enabled from agent_profile where organization_id=${org.id}`)[0].enabled, false);
  assert.deepEqual((await api("/api/onboarding/status")).data.guide.steps.map(s => s.key), ["whatsapp"]);
  const dueAt = new Date(Date.now() - 3600000).toISOString();
  assert.equal((await api("/api/follow-ups/ld_review", { operation: "save", title: "Llamar mañana", dueAt }, "PUT")).status, 200);
  assert.equal((await api("/api/follow-ups/ld_review", { operation: "save", title: "", dueAt }, "PUT")).status, 422);
  assert.equal((await api("/api/follow-ups")).data.followUps[0].title, "Llamar mañana");
  await sql`insert into organization (id, name) values ('org_other_review', 'Otra organización')`;
  await sql`insert into contact (id, organization_id, name, wa_identity) values ('ct_other_review', 'org_other_review', 'Ajeno', '34999999999')`;
  await sql`insert into pipeline_stage (id, organization_id, name, position) values ('stg_other_review', 'org_other_review', 'Nuevo', 0)`;
  await sql`insert into lead (id, organization_id, contact_id, stage_id) values ('ld_other_review', 'org_other_review', 'ct_other_review', 'stg_other_review')`;
  assert.equal((await api("/api/follow-ups/ld_other_review", { operation: "save", title: "No autorizado", dueAt }, "PUT")).status, 404);
  assert.equal((await api("/api/follow-ups?leadId=ld_other_review")).data.followUps.length, 0);
  const savedCookie = cookie; cookie = "";
  assert.equal((await api("/api/follow-ups")).status, 401); cookie = savedCookie;
  console.log("API: paginación >200, archivados, búsqueda, modo persistente, apagado del agente, validación y aislamiento correctos.");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ timezoneId: "Europe/Madrid", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo", { exact: true }).fill(credentials.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes("login"));
  await page.route("**/api/conversations", route => route.abort());
  await page.goto(`${base}/inbox`);
  await page.getByRole("alert").filter({ hasText: "No se pudieron cargar las conversaciones" }).waitFor();
  await page.unroute("**/api/conversations");
  await page.getByRole("button", { name: "Reintentar conversaciones", exact: true }).click();
  await page.getByText("Sin conversaciones todavía", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Abrir Contactos", exact: true }).waitFor();
  await page.goto(`${base}/contacts`);
  await page.getByText("Página 1 de 5 · 215 contactos", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByText("Página 2 de 5 · 215 contactos", { exact: true }).waitFor();
  await page.route("**/api/contacts?**", route => route.abort());
  await page.reload();
  await page.getByRole("alert").filter({ hasText: "No se pudo conectar" }).waitFor();
  await page.unroute("**/api/contacts?**");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await page.getByText("Página 1 de 5 · 215 contactos", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Editar", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Editar contacto" });
  await dialog.getByLabel("Nombre", { exact: true }).fill("Cambio conservado");
  await page.route("**/api/contacts/ct_review_*", route => route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Fallo de guardado de prueba" } }) }) : route.continue());
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByLabel("Nombre", { exact: true }).inputValue(), "Cambio conservado");
  await page.unroute("**/api/contacts/ct_review_*");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.goto(`${base}/onboarding`);
  await page.getByRole("button", { name: "Atención manual", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Vincula tu proveedor de IA" }).count(), 0);
  await page.getByRole("button", { name: "Con agente de IA", exact: true }).click();
  await page.getByRole("heading", { name: "Vincula tu proveedor de IA" }).waitFor();
  await page.getByRole("button", { name: "Atención manual", exact: true }).click();
  await page.getByRole("heading", { name: "Vincula tu proveedor de IA" }).waitFor({ state: "hidden" });
  await page.reload();
  assert.equal(await page.getByRole("button", { name: "Atención manual", exact: true }).getAttribute("aria-pressed"), "true");
  await page.goto(`${base}/pipeline`);
  await page.getByText("Contacto 234", { exact: true }).click();
  await page.getByRole("region", { name: "Próxima acción" }).waitFor();
  await page.getByLabel("Qué hay que hacer", { exact: true }).fill("Revisar presupuesto");
  await page.getByRole("button", { name: "Guardar acción", exact: true }).click();
  await page.getByRole("button", { name: "Completar acción", exact: true }).waitFor();
  await page.goto(`${base}/follow-ups`);
  await page.getByRole("heading", { name: "Revisar presupuesto", exact: true }).waitFor();
  await page.getByRole("button", { name: /^Vencidos/ }).click();
  await page.getByRole("heading", { name: "Revisar presupuesto", exact: true }).waitFor();
  await page.getByRole("button", { name: "Gestionar acción", exact: true }).click();
  await page.getByRole("button", { name: "Completar acción", exact: true }).click();
  await page.getByText("No hay acciones en esta vista.", { exact: false }).waitFor();
  await page.getByRole("button", { name: /^Completados/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed="true"]')].some(button => button.textContent?.startsWith("Completados")));
  await page.getByRole("heading", { name: "Revisar presupuesto", exact: true }).waitFor();
  await page.getByText("Completada. Puedes programar la siguiente.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.screenshot({ path: ".local/seguimientos-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "Seguimientos", exact: true }).waitFor();
  const closeMenu = page.getByRole("button", { name: "Cerrar el menú", exact: true });
  if (await closeMenu.first().isVisible()) await closeMenu.first().click();
  await page.getByRole("button", { name: /^Completados/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed="true"]')].some(button => button.textContent?.startsWith("Completados")));
  await page.getByRole("heading", { name: "Revisar presupuesto", exact: true }).waitFor();
  await page.screenshot({ path: ".local/seguimientos-mobile.png", fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Sin desbordamiento horizontal");
  console.log("Navegador: paginación, errores/reintento, formulario conservado, modo manual/IA, edición desde Pipeline y completado desde Seguimientos correctos.");
  await sql`insert into conversation (id,organization_id,contact_id,last_message_at) values
    ('cv_review',${org.id},'ct_review_234',now()),('cv_review_second',${org.id},'ct_review_233',now())`;
  await sql`insert into message (id,organization_id,conversation_id,direction,text,status) values
    ('msg_review',${org.id},'cv_review','in','Consulta de presupuesto','read'),
    ('msg_review_second',${org.id},'cv_review_second','in','Consulta de otro cliente','read')`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/conversations/cv_review/messages", route => route.abort());
  await page.goto(`${base}/inbox`);
  await page.getByRole("button", { name: /Contacto 234/ }).click();
  await page.getByRole("alert").filter({ hasText: "No se pudieron cargar los mensajes" }).waitFor();
  await page.unroute("**/api/conversations/cv_review/messages");
  await page.getByRole("button", { name: "Reintentar mensajes", exact: true }).click();
  await page.getByText("Consulta de presupuesto", { exact: true }).last().waitFor();
  const notes = page.getByRole("textbox", { name: "Notas internas", exact: true });
  await notes.fill("Llamar antes de enviar el presupuesto");
  await page.route("**/api/contacts/ct_review_234", route => route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Error de notas de prueba" } }) }) : route.continue());
  await page.getByRole("button", { name: "Guardar notas", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Error de notas de prueba" }).waitFor();
  assert.equal(await notes.inputValue(), "Llamar antes de enviar el presupuesto");
  await page.unroute("**/api/contacts/ct_review_234");
  await page.getByRole("button", { name: "Guardar notas", exact: true }).click();
  await page.getByText("Notas guardadas", { exact: true }).waitFor();
  await page.getByLabel("Qué hay que hacer", { exact: true }).fill("Preparar propuesta desde Bandeja");
  await page.getByLabel("Fecha y hora", { exact: true }).fill("2099-12-12T10:00");
  await page.getByRole("button", { name: "Guardar acción", exact: true }).click();
  await page.getByRole("button", { name: "Completar acción", exact: true }).waitFor();
  await page.getByRole("button", { name: /Contacto 233/ }).click();
  await notes.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Notas internas"]')?.disabled === false);
  assert.equal(await notes.inputValue(), "");
  assert.equal(await page.getByText("Notas guardadas", { exact: true }).count(), 0);
  await page.getByRole("button", { name: /Contacto 234/ }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Notas internas"]')?.value === "Llamar antes de enviar el presupuesto");
  await page.getByLabel("Qué hay que hacer", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Qué hay que hacer", { exact: true }).inputValue(), "Preparar propuesta desde Bandeja");
  await page.screenshot({ path: ".local/bandeja-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: /Contacto 234/ }).click();
  await page.getByRole("button", { name: "Mostrar detalles", exact: true }).click();
  await page.getByRole("region", { name: "Próxima acción", exact: true }).waitFor();
  await page.getByRole("button", { name: "Guardar acción", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Qué hay que hacer", { exact: true }).inputValue(), "Preparar propuesta desde Bandeja");
  await page.screenshot({ path: ".local/bandeja-mobile.png", fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Bandeja móvil sin desbordamiento");
  await page.goto(`${base}/follow-ups`);
  await page.getByRole("heading", { name: "Preparar propuesta desde Bandeja", exact: true }).waitFor();
  console.log("Bandeja: vacío con accesos, fallos de lista e hilo con reintento, notas conservadas y persistentes, cambio de cliente y seguimiento desde detalles correctos en escritorio y móvil.");
  if (process.env.E2E_KEEP_SERVER === "1") {
    writeFileSync(".local/e2e-review.json", JSON.stringify({ base, database, ...credentials }), { mode: 0o600 });
    console.log("Servidor de ensayo conservado para inspección visual.");
    await new Promise(() => {});
  }
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(r => server.once("exit", r)), sleep(5000)]);
  }
  await sql.end();
  await admin.unsafe(`DROP DATABASE ${database} WITH (FORCE)`);
  await admin.end();
  for (const [path, content] of generatedConfig) writeFileSync(path, content);
}
