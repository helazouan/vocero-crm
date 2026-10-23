import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
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
const port = process.env.E2E_PORT ?? "3110";
const base = `http://localhost:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: source.toString(),
  APP_BASE_URL: base,
  VOCERO_DIST_DIR: ".next-e2e",
  ALLOW_SIGNUP: "true",
  AGENDA: "on",
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
let recover = false;
const fixture = createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.url.startsWith("/v25.0/")) {
    const id = req.url.split("/").at(-1);
    if (id === "media_fail" && !recover) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ error: { message: "Fallo temporal de prueba" } }),
      );
      return;
    }
    const data = Buffer.from("%PDF-1.4\nArchivo " + id);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        url: `http://127.0.0.1:${fixture.address().port}/files/${id}`,
        mime_type: "application/pdf",
        file_size: data.length,
      }),
    );
    return;
  }
  res.writeHead(200, { "content-type": "application/pdf" });
  res.end("%PDF-1.4\nArchivo " + req.url.split("/").at(-1));
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
env.META_GRAPH_BASE_URL = `http://127.0.0.1:${fixture.address().port}`;
env.META_GRAPH_API_VERSION = "v25.0";
env.META_APP_SECRET = "secreto-ficticio-051";
env.META_WEBHOOK_VERIFY_TOKEN = "pruebas-documentos-051";
env.WA_MOCK_ENABLED = "";
const encrypt = (value) => {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(env.ENCRYPTION_KEY, "base64"),
      iv,
    );
  return {
    cipher: Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]).toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
};
async function webhook(phone, id, media, name = "documento.pdf") {
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "phone_docs" },
              contacts: [
                {
                  wa_id: phone,
                  profile: {
                    name: phone.endsWith("1") ? "Cliente Alfa" : "Cliente Beta",
                  },
                },
              ],
              messages: [
                {
                  from: phone,
                  id,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: media ? "document" : "text",
                  ...(media
                    ? {
                        document: {
                          id: media,
                          mime_type: "application/pdf",
                          filename: name,
                        },
                      }
                    : {
                        text: {
                          body: "Prueba de recepción " + id,
                        },
                      }),
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const response = await fetch(
    `${base}/api/webhooks/wa/${env.META_WEBHOOK_VERIFY_TOKEN}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256":
          "sha256=" +
          createHmac("sha256", env.META_APP_SECRET).update(body).digest("hex"),
      },
      body,
    },
  );
  assert.equal(response.status, 200);
}
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    const boot = (await api("/api/estate")).data;
    if (check(boot)) return boot;
    await sleep(150);
  }
  throw new Error("No se completó la recepción documental");
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
        openSync(".local/e2e-cartera-server.log", "w"),
        openSync(".local/e2e-cartera-server-error.log", "w"),
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
  const ownerCookie = cookie;
  const token = encrypt("token-ficticio-052");
  await sql`insert into meta_credentials(id,organization_id,waba_id,phone_number_id,token_cipher,token_iv,token_tag) values('cred_docs',${org.id},'waba_docs','phone_docs',${token.cipher},${token.iv},${token.tag})`;
  const password = "Cartera-pruebas-052!";
  for (const name of ["Alba", "Bruno"]) {
    const r = await api("/api/settings/team", {
      name,
      email: `${name.toLowerCase()}@example.test`,
      password,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  const users =
    await sql`select id,name from "user" where email in ('alba@example.test','bruno@example.test')`;
  const alba = users.find((u) => u.name === "Alba").id,
    bruno = users.find((u) => u.name === "Bruno").id;
  const sessions = {};
  for (const name of ["alba", "bruno"]) {
    cookie = "";
    assert.equal(
      (
        await api("/api/auth/sign-in/email", {
          email: `${name}@example.test`,
          password,
        })
      ).status,
      200,
    );
    sessions[name] = cookie;
  }
  const as = async (auth, path, body, method) => {
    cookie = auth;
    return api(path, body, method);
  };
  const ok = async (auth, body) => {
    const r = await as(auth, "/api/estate", body);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.id;
  };
  const denied = async (auth, path, body, method, status = 404) => {
    const r = await as(auth, path, body, method);
    assert.equal(r.status, status, `${path}: ${JSON.stringify(r.data)}`);
  };
  const download = (auth, id) =>
    fetch(`${base}/api/estate/documents/${id}`, { headers: { cookie: auth } });
  const upload = (auth, id, text = "Documento ficticio") => {
    const form = new FormData();
    form.append(
      "file",
      new File([`%PDF-1.4\n${text}`], "documento.pdf", {
        type: "application/pdf",
      }),
    );
    return fetch(`${base}/api/estate/documents/${id}`, {
      method: "POST",
      headers: { cookie: auth, origin: base },
      body: form,
    });
  };
  cookie = ownerCookie;
  await webhook("34611000001", "wamid.cartera.a", "media_cartera_a");
  await webhook("34611000002", "wamid.cartera.b", "media_cartera_b");
  let boot = await waitFor(
    (b) => b.documents?.filter((d) => d.hasFile).length === 2,
  );
  const a = boot.clients.find((c) => c.name === "Cliente Alfa"),
    b = boot.clients.find((c) => c.name === "Cliente Beta");
  const assign = (c, advisor) =>
    ok(ownerCookie, {
      ...c,
      operation: "client",
      role: "comprador",
      assignedUserId: advisor,
    });
  await assign(a, alba);
  await assign(b, bruno);
  const u = await ok(ownerCookie, {
    operation: "client",
    name: "Cliente sin asignar",
    phone: "34611000009",
    role: "comprador",
  });
  const property = await ok(ownerCookie, {
    operation: "property",
    reference: "CART-01",
    title: "Vivienda compartida",
    type: "piso",
    status: "disponible",
    address: "Calle ficticia 1",
    city: "Madrid",
    priceCents: 20000000,
    area: 80,
    rooms: 3,
    bathrooms: 1,
    ownerContactId: b.id,
  });
  const dealA = await ok(ownerCookie, {
    operation: "deal",
    propertyId: property,
    contactId: a.id,
    assignedUserId: alba,
    phase: "nuevo",
  });
  const dealB = await ok(ownerCookie, {
    operation: "deal",
    propertyId: property,
    contactId: b.id,
    assignedUserId: bruno,
    phase: "nuevo",
  });
  const offerB = await ok(ownerCookie, {
    operation: "offer",
    dealId: dealB,
    kind: "oferta",
    amountCents: 19000000,
    status: "pendiente",
  });
  const startsAt = new Date(Date.now() + 10 * 86400000).toISOString();
  const visitA = await ok(ownerCookie, {
    operation: "visit",
    propertyId: property,
    contactId: a.id,
    assignedUserId: alba,
    startsAt,
    durationMinutes: 30,
    status: "pendiente",
  });
  const visitB = await ok(ownerCookie, {
    operation: "visit",
    propertyId: property,
    contactId: b.id,
    assignedUserId: bruno,
    startsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
    durationMinutes: 30,
    status: "pendiente",
  });
  await ok(ownerCookie, {
    operation: "activity",
    entityType: "client",
    entityId: b.id,
    kind: "nota",
    text: "Nota privada de Beta",
  });
  boot = (await as(ownerCookie, "/api/estate")).data;
  const docA = boot.documents.find((d) => d.subjectContactId === a.id),
    docB = boot.documents.find((d) => d.subjectContactId === b.id);
  // Un archivo cargado por Alba no sigue siendo suyo al cambiar el titular de su expediente.
  const manualB = await ok(ownerCookie, {
    operation: "document",
    entityType: "client",
    entityId: b.id,
    subjectContactId: b.id,
    title: "Contrato Beta",
    documentType: "arras",
    status: "pendiente",
    visibility: "equipo",
  });
  assert.equal((await upload(ownerCookie, manualB)).status, 200);
  await sql`update estate_document set uploaded_by=${alba} where id=${manualB}`;
  const legacyB = await ok(ownerCookie, {
    operation: "document",
    entityType: "property",
    entityId: property,
    title: "Escritura antigua",
    documentType: "escritura",
    status: "pendiente",
    visibility: "equipo",
  });
  assert.equal((await upload(ownerCookie, legacyB)).status, 200);
  const [convA] =
    await sql`select id from conversation where contact_id=${a.id}`;
  const [convB] =
    await sql`select id from conversation where contact_id=${b.id}`;
  const [leadA] = await sql`select id from lead where contact_id=${a.id}`;
  const [leadB] = await sql`select id from lead where contact_id=${b.id}`;
  const [messageB] =
    await sql`select id from message where conversation_id=${convB.id} limit 1`;
  await sql`update lead set next_action='Llamar',next_action_at=now()+interval '1 day' where id in (${leadA.id},${leadB.id})`;
  const appointmentB = "booking_cartera_b";
  await sql`insert into booking(id,organization_id,kind,status,source,contact_id,conversation_id,scheduled_at,duration_minutes,is_test) values(${appointmentB},${org.id},'session','agendada','manual',${b.id},${convB.id},now()+interval '20 days',30,false)`;

  const onlyA = (await as(sessions.alba, "/api/estate")).data;
  assert.deepEqual(
    onlyA.clients.map((c) => c.id),
    [a.id],
  );
  assert.deepEqual(
    onlyA.deals.map((d) => d.id),
    [dealA],
  );
  assert.deepEqual(
    onlyA.visits.map((v) => v.id),
    [visitA],
  );
  assert.equal(onlyA.offers.length, 0);
  assert.deepEqual(
    onlyA.documents.map((d) => d.id),
    [docA.id],
  );
  assert(!JSON.stringify(onlyA).includes("Nota privada de Beta"));
  assert.equal(onlyA.properties[0].ownerContactId, null);
  assert.equal((await as(sessions.alba, "/api/contacts?q=Beta")).data.total, 0);
  assert.equal(
    (await as(sessions.alba, "/api/contacts?archived=true")).data.total,
    1,
  );
  assert.deepEqual(
    (await as(sessions.alba, "/api/conversations")).data.conversations.map(
      (c) => c.id,
    ),
    [convA.id],
  );
  assert.deepEqual(
    (await as(sessions.alba, "/api/pipeline/board")).data.leads.map(
      (l) => l.id,
    ),
    [leadA.id],
  );
  assert.deepEqual(
    (await as(sessions.alba, "/api/follow-ups")).data.followUps.map(
      (l) => l.id,
    ),
    [leadA.id],
  );
  assert.equal(
    (await as(sessions.alba, "/api/bookings")).data.bookings.length,
    0,
  );
  assert.equal(
    (await as(sessions.bruno, "/api/bookings")).data.bookings[0].id,
    appointmentB,
  );
  for (const id of [b.id, u]) {
    await denied(sessions.alba, `/api/contacts/${id}`);
    await denied(
      sessions.alba,
      `/api/contacts/${id}`,
      { notes: "Intento ajeno" },
      "PATCH",
    );
    await denied(sessions.alba, `/api/contacts/${id}/start-conversation`, {
      templateId: "inventado",
    });
  }
  for (const suffix of [
    "/messages",
    "/messages/media",
    "/messages/template",
    "/messages/forward-image",
  ]) {
    await denied(sessions.alba, `/api/conversations/${convB.id}${suffix}`, {
      text: "No debe salir",
      templateId: "inventado",
      sourceMessageId: messageB.id,
    });
  }
  await denied(sessions.alba, `/api/conversations/${convB.id}/messages`);
  await denied(
    sessions.alba,
    `/api/conversations/${convB.id}`,
    { markRead: true },
    "PATCH",
  );
  await denied(
    sessions.alba,
    `/api/conversations/${convA.id}/messages/forward-image`,
    { sourceMessageId: messageB.id },
  );
  await denied(
    sessions.alba,
    `/api/pipeline/leads/${leadB.id}`,
    { priority: "alta" },
    "PATCH",
  );
  await denied(
    sessions.alba,
    `/api/follow-ups/${leadB.id}`,
    { operation: "save", title: "Ajena", dueAt: startsAt },
    "PUT",
  );
  await denied(
    sessions.alba,
    `/api/bookings/${appointmentB}`,
    { action: "cancel" },
    "PATCH",
  );
  for (const id of [docB.id, manualB, legacyB]) {
    assert.equal((await download(sessions.alba, id)).status, 404);
    assert.equal((await upload(sessions.alba, id)).status, 404);
    await denied(sessions.alba, `/api/estate/documents/${id}/retry`, {});
  }
  assert.equal(
    (
      await fetch(`${base}/api/media/${docB.sourceMediaAssetId}`, {
        headers: { cookie: sessions.alba },
      })
    ).status,
    404,
  );
  for (const body of [
    { ...b, operation: "client", role: "comprador", assignedUserId: alba },
    {
      ...boot.deals.find((d) => d.id === dealB),
      operation: "deal",
      contactId: a.id,
      assignedUserId: alba,
    },
    {
      operation: "offer",
      id: offerB,
      dealId: dealA,
      kind: "oferta",
      status: "pendiente",
      amountCents: 100,
    },
    {
      ...boot.visits.find((v) => v.id === visitB),
      operation: "visit",
      contactId: a.id,
      assignedUserId: alba,
    },
    { ...docB, operation: "document", subjectContactId: a.id },
    {
      operation: "activity",
      entityType: "client",
      entityId: b.id,
      kind: "nota",
      text: "Ajena",
    },
  ])
    await denied(sessions.alba, "/api/estate", body);
  await denied(
    sessions.alba,
    "/api/estate",
    { ...a, operation: "client", role: "comprador", assignedUserId: bruno },
    undefined,
    403,
  );
  for (const path of [
    "/api/analytics/sales",
    "/api/lab/runs",
    "/api/estate/backup",
  ])
    await denied(sessions.alba, path, undefined, undefined, 403);
  await denied(
    sessions.alba,
    "/api/contacts/import",
    { contacts: [{ name: "Beta", phone: b.phone }] },
    undefined,
    403,
  );
  await denied(
    sessions.alba,
    "/api/settings/team",
    { name: "No autorizado", email: "intruso@example.test", password },
    undefined,
    403,
  );
  assert.equal((await download(sessions.alba, docA.id)).status, 200);
  assert.equal(
    (
      await fetch(`${base}/api/media/${docA.sourceMediaAssetId}`, {
        headers: { cookie: sessions.alba },
      })
    ).status,
    200,
  );
  await ok(sessions.alba, {
    ...docA,
    operation: "document",
    documentType: "dni_nie",
    status: "revisado",
  });
  const version = await upload(
    sessions.alba,
    docA.id,
    "Nueva versión del asesor",
  );
  assert.equal(version.status, 200);
  const versionId = (await version.json()).id;
  assert.equal((await download(sessions.bruno, versionId)).status, 404);
  const created = await ok(sessions.alba, {
    operation: "client",
    name: "Cliente nuevo de Alba",
    phone: "34611000005",
    role: "comprador",
  });
  const direct = await as(sessions.alba, "/api/contacts", {
    name: "Alta en Contactos de Alba",
    phone: "34611000006",
  });
  assert.equal(direct.status, 201);
  assert(
    (await as(sessions.alba, "/api/estate")).data.clients
      .filter((c) => [created, direct.data.contact.id].includes(c.id))
      .every((c) => c.assignedUserId === alba),
  );
  await ok(ownerCookie, {
    ...a,
    operation: "client",
    role: "comprador",
    assignedUserId: alba,
  });
  // Otra organización no puede ganar acceso ni por una asignación manipulada.
  cookie = "";
  const foreign = await api("/api/auth/sign-up/email", {
    name: "Otra organización",
    email: "otra@example.test",
    password,
  });
  assert.equal(foreign.status, 200);
  const foreignCookie = cookie;
  const [foreignUser] =
    await sql`select id from "user" where email='otra@example.test'`;
  await sql`insert into organization(id,name,slug,created_at) values('org_cartera_otra','Otra organización','cartera-otra',now())`;
  await sql`insert into member(id,organization_id,user_id,role,created_at) values('member_otra','org_cartera_otra',${foreignUser.id},'owner',now())`;
  await denied(foreignCookie, `/api/contacts/${a.id}`);
  assert.equal((await download(foreignCookie, docA.id)).status, 404);

  const streams = [];
  async function stream(auth) {
    const abort = new AbortController(),
      parts = [];
    const r = await fetch(`${base}/api/events`, {
      headers: { cookie: auth },
      signal: abort.signal,
    });
    assert.equal(r.status, 200);
    const reader = r.body.getReader();
    const done = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parts.push(new TextDecoder().decode(value));
        }
      } catch {
        /* Se cierra al terminar el ensayo. */
      }
    })();
    const result = { parts, abort, done };
    streams.push(result);
    return result;
  }
  const eventA = await stream(sessions.alba),
    eventB = await stream(sessions.bruno);
  await webhook(a.phone, "wamid.cartera.sse.a");
  for (
    let i = 0;
    i < 80 && !eventA.parts.join("").includes("wamid.cartera.sse.a");
    i++
  )
    await sleep(100);
  assert(eventA.parts.join("").includes("wamid.cartera.sse.a"));
  assert(!eventB.parts.join("").includes("wamid.cartera.sse.a"));
  await assign(a, bruno);
  for (
    let i = 0;
    i < 80 && !eventA.parts.join("").includes("portfolio.changed");
    i++
  )
    await sleep(100);
  assert(eventA.parts.join("").includes("portfolio.changed"));
  assert(eventB.parts.join("").includes("portfolio.changed"));
  await webhook(a.phone, "wamid.cartera.sse.traspaso");
  for (
    let i = 0;
    i < 80 && !eventB.parts.join("").includes("wamid.cartera.sse.traspaso");
    i++
  )
    await sleep(100);
  assert(eventB.parts.join("").includes("wamid.cartera.sse.traspaso"));
  assert(!eventA.parts.join("").includes("wamid.cartera.sse.traspaso"));
  await denied(sessions.alba, `/api/contacts/${a.id}`);
  assert.equal((await download(sessions.alba, docA.id)).status, 404);
  assert.equal((await download(sessions.alba, versionId)).status, 404);
  assert.equal((await download(sessions.bruno, versionId)).status, 200);
  assert.equal(
    (
      await fetch(`${base}/api/media/${docA.sourceMediaAssetId}`, {
        headers: { cookie: sessions.alba },
      })
    ).status,
    404,
  );
  await ok(sessions.bruno, {
    ...(await as(sessions.bruno, "/api/estate")).data.documents.find(
      (d) => d.id === versionId,
    ),
    operation: "document",
    documentType: "dni_nie",
    status: "revisado",
  });
  await ok(sessions.bruno, {
    ...(await as(sessions.bruno, "/api/estate")).data.deals.find(
      (d) => d.id === dealA,
    ),
    operation: "deal",
    notes: "Gestionado tras reasignación",
  });
  await ok(sessions.bruno, {
    ...(await as(sessions.bruno, "/api/estate")).data.visits.find(
      (v) => v.id === visitA,
    ),
    operation: "visit",
    notes: "Seguimiento tras reasignación",
  });
  assert.equal((await download(sessions.bruno, legacyB)).status, 200);
  await denied(
    sessions.bruno,
    "/api/estate",
    { ...b, operation: "client", role: "comprador", assignedUserId: null },
    undefined,
    403,
  );
  const encoded = await fetch(`${base}/api/analytics/%73ales`, {
    headers: { cookie: sessions.alba },
  });
  assert([403, 404].includes(encoded.status));
  await denied(
    sessions.alba,
    "/api/calendar/settings",
    { timezone: "UTC" },
    "PUT",
    403,
  );
  for (const stream of streams) stream.abort.abort();
  await Promise.all(streams.map((s) => s.done));
  console.log(
    "API: cartera en listados, referencias y escritura, documentos y originales, altas propias, dirección, organización ajena, reasignación y SSE ya conectado correctos.",
  );

  browser = await chromium.launch({ headless: true });
  async function context(auth) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.addCookies(
      auth.split("; ").map((pair) => ({
        name: pair.slice(0, pair.indexOf("=")),
        value: pair.slice(pair.indexOf("=") + 1),
        url: base,
      })),
    );
    return ctx;
  }
  const ctxA = await context(sessions.alba),
    ctxB = await context(sessions.bruno),
    ctxOwner = await context(ownerCookie);
  const pageA = await ctxA.newPage(),
    pageB = await ctxB.newPage(),
    pageOwner = await ctxOwner.newPage();
  await pageA.goto(`${base}/clients`);
  await pageA.getByText("Tu cartera:", { exact: false }).waitFor();
  assert.equal(
    await pageA.getByRole("button", { name: /Cliente Alfa/ }).count(),
    0,
  );
  await pageA.goto(`${base}/clients?id=${a.id}`);
  await pageA
    .getByText("Este expediente no está disponible", { exact: false })
    .waitFor();
  assert.equal(
    await pageA
      .getByRole("heading", { name: "Cliente Alfa", exact: true })
      .count(),
    0,
  );
  await pageB.goto(`${base}/clients?id=${a.id}`);
  await pageB
    .getByRole("heading", { name: "Cliente Alfa", exact: true })
    .waitFor();
  await pageB
    .getByRole("button", { name: "Editar ficha", exact: true })
    .click();
  const dialog = pageB.getByRole("dialog");
  assert.equal(
    await dialog.getByLabel("Asesor responsable", { exact: false }).isEnabled(),
    false,
  );
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await pageB.screenshot({
    path: ".local/cartera-asesor-escritorio.png",
    fullPage: true,
  });
  await pageOwner.goto(`${base}/clients`);
  await pageOwner
    .getByRole("button", { name: /Cliente sin asignar/ })
    .waitFor();
  await pageOwner.getByRole("button", { name: /Cliente Alfa/ }).click();
  await pageOwner
    .getByRole("button", { name: "Editar ficha", exact: true })
    .click();
  const ownerDialog = pageOwner.getByRole("dialog");
  await ownerDialog
    .getByLabel("Asesor responsable", { exact: false })
    .selectOption(alba);
  await ownerDialog
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await ownerDialog.waitFor({ state: "hidden" });
  await pageB
    .getByText("Este expediente no está disponible", { exact: false })
    .waitFor();
  await pageA
    .getByRole("heading", { name: "Cliente Alfa", exact: true })
    .waitFor();
  await pageA.setViewportSize({ width: 390, height: 844 });
  assert(
    await pageA.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await pageA.screenshot({
    path: ".local/cartera-asesor-movil.png",
    fullPage: true,
  });
  await pageOwner.screenshot({
    path: ".local/cartera-propietario.png",
    fullPage: true,
  });
  console.log(
    "UI: asesor con cartera limitada, URL ajena sin datos, responsable no editable, propietario reasigna y pantallas abiertas se invalidan; escritorio y móvil correctos.",
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
  await new Promise((resolve) => fixture.close(resolve));
  for (const [path, content] of generatedConfig) writeFileSync(path, content);
  rmSync(env.MEDIA_DIR, { recursive: true, force: true });
  await sql.end();
  await admin.unsafe(`DROP DATABASE ${database} WITH (FORCE)`);
  await admin.end();
}
