import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
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
const port = process.env.E2E_PORT ?? "3108";
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
        openSync(".local/e2e-estate-server.log", "w"),
        openSync(".local/e2e-estate-server-error.log", "w"),
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
  const estate = async (body) => api("/api/estate", body);
  const save = async (body) => {
    const r = await estate(body);
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data.id;
  };
  const clientId = await save({
    operation: "client",
    name: "Compradora de prueba",
    phone: "+34 611 000 991",
    role: "comprador",
    preferredCity: "Madrid",
    minRooms: 3,
    budgetMax: 35000000,
    assignedUserId: owner.id,
  });
  const sellerId = await save({
    operation: "client",
    name: "Propietaria de prueba",
    role: "propietario",
  });
  assert.equal(
    (
      await estate({
        operation: "client",
        name: "Duplicado",
        phone: "34611000991",
        role: "comprador",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await estate({
        operation: "client",
        name: "No",
        role: "comprador",
        budgetMin: 2,
        budgetMax: 1,
      })
    ).status,
    422,
  );
  const propertyBody = {
    operation: "property",
    reference: "PRU-101",
    title: "Piso de prueba en Madrid",
    type: "piso",
    status: "disponible",
    address: "Calle de Ejemplo, 1",
    city: "Madrid",
    postalCode: "28010",
    priceCents: 32500000,
    area: 90,
    rooms: 3,
    bathrooms: 2,
    ownerContactId: sellerId,
    assignedUserId: owner.id,
  };
  const propertyId = await save(propertyBody);
  assert.equal((await estate(propertyBody)).status, 409);
  let boot = (await estate()).data;
  assert.equal(
    boot.clients.find((c) => c.id === clientId).leadId?.startsWith("ld_"),
    true,
  );
  assert.equal(boot.properties.length, 1);
  assert.equal(boot.clients.length, 2);
  const dealBody = {
    operation: "deal",
    propertyId,
    contactId: clientId,
    phase: "oferta",
    assignedUserId: owner.id,
  };
  const dealId = await save(dealBody),
    otherDeal = await save({ ...dealBody, contactId: sellerId });
  const reservation = await Promise.all([
    estate({ ...dealBody, id: dealId, phase: "reserva" }),
    estate({
      ...dealBody,
      id: otherDeal,
      contactId: sellerId,
      phase: "reserva",
    }),
  ]);
  assert.deepEqual(reservation.map((r) => r.status).sort(), [200, 409]);
  const winning = reservation[0].status === 200 ? dealId : otherDeal;
  assert.equal(
    (await estate({ ...propertyBody, id: propertyId, status: "vendido" }))
      .status,
    409,
  );
  assert.equal(
    (await estate({ ...dealBody, id: dealId, phase: "perdida" })).status,
    422,
  );
  const offer = {
    operation: "offer",
    dealId,
    kind: "oferta",
    amountCents: 31500000,
    status: "pendiente",
  };
  const offerId = await save(offer);
  await save({ ...offer, id: offerId, status: "aceptada" });
  assert.equal(
    (await estate({ ...offer, id: offerId, amountCents: 1 })).status,
    422,
  );
  await save({ ...offer, kind: "contraoferta", amountCents: 32000000 });
  const visit = {
    operation: "visit",
    propertyId,
    contactId: clientId,
    assignedUserId: owner.id,
    startsAt: "2026-10-27T15:00:00Z",
    durationMinutes: 60,
    status: "confirmada",
  };
  const visits = await Promise.all([estate(visit), estate(visit)]);
  assert.deepEqual(visits.map((r) => r.status).sort(), [200, 409]);
  const visitId = visits.find((r) => r.status === 200).data.id;
  await save({ ...visit, startsAt: "2026-10-27T16:00:00Z" });
  assert.equal(
    (await estate({ ...visit, id: visitId, startsAt: "2026-10-27T16:30:00Z" }))
      .status,
    409,
  );
  await save({ ...visit, id: visitId, status: "cancelada" });
  await save({ ...visit, startsAt: "2026-10-27T15:00:00Z" });
  const docBody = {
    operation: "document",
    entityType: "deal",
    entityId: dealId,
    title: "Contrato de prueba",
    documentType: "compraventa",
    category: "contrato",
    status: "pendiente",
    visibility: "restringido",
  };
  assert.equal((await estate({ ...docBody, status: "firmado" })).status, 422);
  const docId = await save(docBody);
  const upload = async (id, content, mime = "application/pdf") => {
    const form = new FormData();
    form.set("file", new Blob([content], { type: mime }), "contrato.pdf");
    const res = await fetch(`${base}/api/estate/documents/${id}`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    return { status: res.status, data: await res.json() };
  };
  assert.equal((await upload(docId, "<script>fake PDF</script>")).status, 422);
  assert.equal(
    (await upload(docId, Buffer.alloc(10 * 1024 * 1024 + 1))).status,
    413,
  );
  assert.equal(
    (await upload(docId, "%PDF-1.4\nContrato de prueba versión uno")).status,
    200,
  );
  const second = await upload(docId, "%PDF-1.4\nContrato versión dos");
  assert.equal(second.status, 200);
  assert.equal((await upload(docId, "%PDF-1.4\nNo ramificar")).status, 409);
  assert.equal((await estate({ ...docBody, id: docId })).status, 409);
  const doc2 = second.data.id;
  await save({ ...docBody, id: doc2, status: "firmado" });
  let download = await fetch(`${base}/api/estate/documents/${doc2}`, {
    headers: { cookie },
  });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "%PDF-1.4\nContrato versión dos");
  assert.match(download.headers.get("content-disposition"), /attachment/);
  const stored =
    await sql`select storage_id from estate_document where id=${doc2}`;
  const mediaDir = env.MEDIA_DIR;
  const encrypted = readFileSync(
    `${mediaDir}/${org.id}/${stored[0].storage_id}`,
    "utf8",
  );
  assert(!encrypted.includes("Contrato versión dos"));
  assert.equal(
    (
      await api("/api/settings/team", {
        name: "Asesora de prueba",
        email: "estate-member@example.test",
        password: "Prueba-equipo-050!",
      })
    ).status,
    201,
  );
  const ownerCookie = cookie;
  cookie = "";
  assert.equal(
    (
      await api("/api/auth/sign-in/email", {
        email: "estate-member@example.test",
        password: "Prueba-equipo-050!",
      })
    ).status,
    200,
  );
  assert.equal((await estate()).data.documents.length, 0);
  assert.equal(
    (
      await fetch(`${base}/api/estate/documents/${doc2}`, {
        headers: { cookie },
      })
    ).status,
    404,
  );
  assert.equal((await upload(doc2, "%PDF-1.4\nNo autorizado")).status, 404);
  assert.equal((await api("/api/estate/backup")).status, 403);
  cookie = ownerCookie;
  await save({ ...docBody, id: doc2, status: "firmado", visibility: "equipo" });
  const memberCookie = await (async () => {
    cookie = "";
    await api("/api/auth/sign-in/email", {
      email: "estate-member@example.test",
      password: "Prueba-equipo-050!",
    });
    return cookie;
  })();
  assert.equal((await estate()).data.documents.length, 1);
  assert.equal(
    (
      await estate({
        ...docBody,
        id: doc2,
        status: "revisado",
        visibility: "equipo",
      })
    ).status,
    403,
  );
  cookie = ownerCookie;
  await sql`insert into organization(id,name) values('org_estate_other','Otro negocio')`;
  await sql`insert into contact(id,organization_id,name,wa_identity) values('ct_estate_other','org_estate_other','Ajeno','34999999999')`;
  assert.equal(
    (await estate({ ...dealBody, contactId: "ct_estate_other" })).status,
    404,
  );
  assert.equal(
    (
      await estate({
        ...propertyBody,
        reference: "PRU-999",
        assignedUserId: "user_ajeno",
      })
    ).status,
    422,
  );
  assert(
    !(await estate()).data.clients.some((c) => c.id === "ct_estate_other"),
  );
  await sql`insert into conversation(id,organization_id,contact_id) values('cv_estate_guard',${org.id},${clientId})`;
  assert.equal(
    (await api("/api/conversations/cv_estate_guard?contacto=1", null, "DELETE"))
      .status,
    409,
  );
  assert.equal(
    (await api("/api/conversations/cv_estate_guard", null, "DELETE")).status,
    200,
  );
  assert.equal(
    (await estate()).data.clients.some((c) => c.id === clientId),
    true,
  );
  const backup = await api("/api/estate/backup");
  assert.equal(backup.status, 200);
  assert(backup.data.payload.cipher);
  assert(!JSON.stringify(backup.data).includes("Compradora de prueba"));
  await save({
    ...propertyBody,
    id: propertyId,
    status: "reservado",
    title: "Cambio posterior",
  });
  assert.equal(
    (await api("/api/estate/backup?confirm=0", backup.data)).status,
    200,
  );
  assert.equal((await estate()).data.properties[0].title, "Cambio posterior");
  const restore = await api("/api/estate/backup?confirm=1", backup.data);
  assert.equal(restore.status, 200, JSON.stringify(restore));
  assert.equal((await estate()).data.properties[0].title, propertyBody.title);
  assert.equal(
    (
      await fetch(`${base}/api/estate/documents/${doc2}`, {
        headers: { cookie },
      })
    ).status,
    200,
  );
  const restoredBoot = (await estate()).data;
  const activeVisit = restoredBoot.visits.find(
    (v) =>
      v.startsAt === "2026-10-27T15:00:00.000Z" && v.status === "confirmada",
  );
  await save({ ...visit, id: activeVisit.id, status: "cancelada" });
  const extraVisit = await save(visit);
  assert.equal(
    (await api("/api/estate/backup?confirm=1", backup.data)).status,
    409,
  );
  assert.equal(
    (await estate()).data.visits.find((v) => v.id === activeVisit.id).status,
    "cancelada",
  );
  await save({ ...visit, id: extraVisit, status: "cancelada" });
  assert.equal(
    (await api("/api/estate/backup?confirm=1", backup.data)).status,
    200,
  );
  const broken = structuredClone(backup.data);
  broken.payload.cipher = "A" + broken.payload.cipher.slice(1);
  assert.equal((await api("/api/estate/backup?confirm=1", broken)).status, 422);
  assert.equal(
    (
      await api("/api/estate/backup?confirm=1", {
        ...backup.data,
        organizationId: "org_estate_other",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await sql`select count(*)::int as n from estate_activity where organization_id=${org.id}`
    )[0].n > 15,
    true,
  );
  cookie = "";
  assert.equal((await estate()).status, 401);
  cookie = ownerCookie;
  console.log(
    "API inmobiliaria: CRUD, identidad, reservas y visitas simultáneas, negociación, cifrado, versiones, permisos, aislamiento y restauración correctos.",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    timezoneId: "Europe/Madrid",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
    console.error("Error UI:", err.stack);
  });
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo", { exact: true }).fill(credentials.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await page.goto(`${base}/properties`);
  await page
    .getByRole("heading", { name: propertyBody.title, exact: true })
    .waitFor();
  await page
    .getByLabel("Buscar expediente", { exact: true })
    .fill("Sin coincidencias");
  await page
    .getByText(
      "No hay resultados. Ajusta los filtros o crea el primer expediente.",
      { exact: true },
    )
    .waitFor();
  await page.getByLabel("Buscar expediente", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Nuevo inmueble", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Nuevo inmueble" });
  const uiProperty = {
    Referencia: "PRU-UI",
    "Título del inmueble": "Vivienda creada desde la interfaz",
    Dirección: "Calle de la Prueba, 2",
    Municipio: "Getafe",
    "Precio de venta (€)": "365.000",
    "Superficie (m²)": "130",
    Habitaciones: "4",
    Baños: "2",
  };
  for (const [name, value] of Object.entries(uiProperty))
    await dialog.getByLabel(name, { exact: false }).fill(value);
  await page.route("**/api/estate", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Fallo controlado de guardado" },
          }),
        })
      : route.continue(),
  );
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "Fallo controlado" })
    .waitFor();
  assert.equal(
    await dialog.getByLabel("Referencia", { exact: false }).inputValue(),
    "PRU-UI",
  );
  await page.unroute("**/api/estate");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "PRU-UI · Vivienda creada desde la interfaz",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Añadir documento", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Añadir documento" });
  await dialog
    .getByLabel("Título del documento", { exact: false })
    .fill("Fotografía del inmueble");
  await dialog
    .getByLabel("Tipo de documento", { exact: false })
    .selectOption("fotografia");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await page
    .getByRole("heading", { name: "Fotografía del inmueble", exact: true })
    .waitFor();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V8AAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Archivo para Fotografía del inmueble", { exact: true })
    .setInputFiles({ name: "casa.png", mimeType: "image/png", buffer: png });
  await page.getByRole("link", { name: "casa.png", exact: true }).waitFor();
  await page.reload();
  await page
    .getByRole("img", {
      name: "Vivienda creada desde la interfaz",
      exact: true,
    })
    .waitFor();
  await page.goto(`${base}/clients?id=${clientId}`);
  await page
    .getByRole("heading", { name: "Compradora de prueba", exact: true })
    .waitFor();
  await page.getByText("Viviendas que encajan", { exact: true }).waitFor();
  await page.getByText("Próxima acción", { exact: true }).waitFor();
  await page.goto(`${base}/properties?id=${propertyId}`);
  await page
    .getByRole("button", { name: /27\/10\/2026/ })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: "Editar visita" });
  assert.match(
    await dialog
      .getByLabel("Fecha y hora de la visita", { exact: false })
      .inputValue(),
    /^2026-10-27T1[67]:00$/,
  );
  await dialog
    .getByLabel("Indicaciones para la visita", { exact: false })
    .fill("Indicaciones actualizadas desde la ficha");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.goto(`${base}/deals?id=${dealId}`);
  await page
    .getByRole("heading", { name: "Ofertas y negociación", exact: true })
    .waitFor();
  await page.goto(`${base}/agenda`);
  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await page.screenshot({ path: ".local/agenda-debug.png", fullPage: true });
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("button", { name: "Nueva visita", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Nueva visita" });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.goto(`${base}/work`);
  await page
    .getByRole("heading", { name: "Visitas de hoy", exact: true })
    .waitFor();
  await page.screenshot({
    path: ".local/inmobiliaria-escritorio.png",
    fullPage: true,
  });
  await page.route("**/api/estate", (route) => route.abort());
  await page.goto(`${base}/properties`);
  await page
    .getByRole("alert")
    .filter({ hasText: "No se pudo conectar" })
    .waitFor();
  await page.unroute("**/api/estate");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await page
    .getByRole("heading", { name: propertyBody.title, exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/work",
    "/properties",
    `/clients?id=${clientId}`,
    "/agenda",
    "/documents",
  ]) {
    await page.goto(base + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(250);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Desbordamiento móvil: ${path}`,
    );
  }
  await page.screenshot({
    path: ".local/inmobiliaria-movil.png",
    fullPage: true,
  });
  assert.deepEqual(pageErrors, []);
  console.log(
    "UI: alta y edición, filtros, carga de imagen, expedientes, acciones, calendario, recuperación de errores, escritorio y móvil correctos.",
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
