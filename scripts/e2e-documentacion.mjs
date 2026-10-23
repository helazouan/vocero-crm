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
const port = process.env.E2E_PORT ?? "3109";
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
                          body: "Necesito preparar la documentación de mi vivienda",
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
        openSync(".local/e2e-docs-server.log", "w"),
        openSync(".local/e2e-docs-server-error.log", "w"),
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
  const token = encrypt("token-ficticio-para-el-mock");
  await sql`insert into meta_credentials(id,organization_id,waba_id,phone_number_id,token_cipher,token_iv,token_tag) values('cred_docs',${org.id},'waba_docs','phone_docs',${token.cipher},${token.iv},${token.tag})`;
  await webhook("34611000001", "wamid.docs.hello.a");
  await webhook("34611000002", "wamid.docs.hello.b");
  let boot = await waitFor((b) => b.clients?.length === 2);
  assert.equal(
    (
      await sql`select count(*)::int as n from estate_client where organization_id=${org.id}`
    )[0].n,
    2,
  );
  const a = boot.clients.find((c) => c.name === "Cliente Alfa"),
    b = boot.clients.find((c) => c.name === "Cliente Beta");
  assert(a && b);
  assert.equal(a.role, "sin_clasificar");
  await webhook(a.phone, "wamid.docs.a", "media_a");
  await webhook(b.phone, "wamid.docs.b", "media_b");
  boot = await waitFor(
    (b) => b.documents?.length === 2 && b.documents.every((d) => d.hasFile),
  );
  const docA = boot.documents.find((d) => d.subjectContactId === a.id),
    docB = boot.documents.find((d) => d.subjectContactId === b.id);
  assert.equal(docA.filename, docB.filename);
  assert.notEqual(docA.id, docB.id);
  assert.equal(docA.status, "pendiente");
  assert.equal(docA.documentType, "sin_clasificar");
  assert.equal(docA.uploadedBy, null);
  await webhook(a.phone, "wamid.docs.a", "media_a");
  await sleep(200);
  assert.equal((await api("/api/estate")).data.documents.length, 2);
  const download = async (id) => {
    const res = await fetch(`${base}/api/estate/documents/${id}`, {
      headers: { cookie },
    });
    return { status: res.status, body: await res.text() };
  };
  assert.equal((await download(docA.id)).body, "%PDF-1.4\nArchivo media_a");
  assert.equal((await download(docB.id)).body, "%PDF-1.4\nArchivo media_b");
  const [stored] =
    await sql`select storage_id from estate_document where id=${docA.id}`;
  assert(
    !readFileSync(
      `${env.MEDIA_DIR}/${org.id}/${stored.storage_id}`,
      "utf8",
    ).includes("Archivo media_a"),
  );
  assert(
    !readFileSync(
      `${env.MEDIA_DIR}/${org.id}/${docA.sourceMediaAssetId}`,
      "utf8",
    ).includes("Archivo media_a"),
  );
  const save = async (value) => {
    const r = await api("/api/estate", value);
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data.id;
  };
  const edit = (d, extra = {}) => ({ operation: "document", ...d, ...extra });
  const requestA = await save({
    operation: "document",
    entityType: "client",
    entityId: a.id,
    subjectContactId: a.id,
    title: "Identificación de Alfa",
    documentType: "dni_nie",
    status: "pendiente",
    visibility: "restringido",
  });
  const requestB = await save({
    operation: "document",
    entityType: "client",
    entityId: b.id,
    subjectContactId: b.id,
    title: "Identificación de Beta",
    documentType: "dni_nie",
    status: "pendiente",
    visibility: "restringido",
  });
  assert.equal(
    (await api("/api/estate", edit(docA, { status: "revisado" }))).status,
    422,
  );
  assert.equal(
    (
      await api(
        "/api/estate",
        edit(docA, { documentType: "dni_nie", fulfilsDocumentId: requestB }),
      )
    ).status,
    422,
  );
  await save(
    edit(docA, {
      documentType: "dni_nie",
      fulfilsDocumentId: requestA,
      status: "revisado",
    }),
  );
  assert.equal(
    (
      await api(
        "/api/estate",
        edit(docB, {
          subjectContactId: a.id,
          documentType: "dni_nie",
          fulfilsDocumentId: requestA,
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await api("/api/estate", edit(docB, { status: "rechazado" }))).status,
    422,
  );
  await save(
    edit(docB, {
      documentType: "dni_nie",
      status: "rechazado",
      reviewNote: "La copia no es legible",
    }),
  );
  const form = new FormData();
  form.set(
    "file",
    new Blob(["%PDF-1.4\nVersión nueva Alfa"], { type: "application/pdf" }),
    "identificacion-nueva.pdf",
  );
  const newRes = await fetch(`${base}/api/estate/documents/${docA.id}`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  assert.equal(newRes.status, 200);
  const newId = (await newRes.json()).id;
  boot = (await api("/api/estate")).data;
  const version = boot.documents.find((d) => d.id === newId);
  assert.equal(version.status, "pendiente");
  assert.equal(version.fulfilsDocumentId, requestA);
  assert.equal(version.source, "manual");
  assert.equal(version.version, 2);
  await save(
    edit(version, { subjectContactId: b.id, fulfilsDocumentId: requestB }),
  );
  let moved = (await api("/api/estate")).data.documents;
  assert.equal(moved.find((d) => d.id === docA.id).subjectContactId, b.id);
  assert.equal(moved.find((d) => d.id === newId).entityId, b.id);
  await save(
    edit(
      moved.find((d) => d.id === newId),
      { subjectContactId: a.id, fulfilsDocumentId: requestA },
    ),
  );

  assert.equal(
    (
      await api("/api/settings/team", {
        name: "Asesor sin acceso",
        email: "documentos-member@example.test",
        password: "Pruebas-051-equipo!",
      })
    ).status,
    201,
  );
  const ownerCookie = cookie;
  cookie = "";
  await api("/api/auth/sign-in/email", {
    email: "documentos-member@example.test",
    password: "Pruebas-051-equipo!",
  });
  const memberCookie = cookie;
  assert.equal((await download(docA.id)).status, 404);
  assert.equal(
    (
      await fetch(`${base}/api/media/${docA.sourceMediaAssetId}`, {
        headers: { cookie },
      })
    ).status,
    404,
  );
  assert.equal((await api("/api/estate")).data.documents.length, 0);
  cookie = ownerCookie;
  await save(
    edit(docB, {
      documentType: "dni_nie",
      status: "rechazado",
      reviewNote: "La copia no es legible",
      visibility: "equipo",
    }),
  );
  cookie = memberCookie;
  assert.equal((await download(docB.id)).status, 200);
  assert.equal(
    (
      await fetch(`${base}/api/media/${docB.sourceMediaAssetId}`, {
        headers: { cookie },
      })
    ).status,
    200,
  );
  cookie = ownerCookie;
  await webhook(a.phone, "wamid.docs.fail", "media_fail");
  boot = await waitFor((b) =>
    b.documents.some(
      (d) => d.sourceWaMessageId === "wamid.docs.fail" && d.intakeError,
    ),
  );
  const failed = boot.documents.find(
    (d) => d.sourceWaMessageId === "wamid.docs.fail",
  );
  assert(!failed.hasFile);
  recover = true;
  assert.equal(
    (await api(`/api/estate/documents/${failed.id}/retry`, null, "POST"))
      .status,
    200,
  );
  boot = (await api("/api/estate")).data;
  assert.equal(boot.documents.find((d) => d.id === failed.id).hasFile, true);
  assert.equal(
    boot.documents.filter((d) => d.sourceWaMessageId === "wamid.docs.fail")
      .length,
    1,
  );
  const metadataBefore = (await api("/api/estate")).data.documents;
  const backup = await api("/api/estate/backup");
  assert.equal(backup.status, 200);
  const decrypt = (value) => {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(env.ENCRYPTION_KEY, "base64"),
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.cipher, "base64")),
      decipher.final(),
    ]).toString();
  };
  const legacy = JSON.parse(decrypt(backup.data.payload));
  for (const d of legacy.rows.documentos) {
    for (const key of [
      "documentType",
      "subjectContactId",
      "propertyId",
      "dealId",
      "fulfilsDocumentId",
      "source",
      "sourceWaMessageId",
      "sourceMediaAssetId",
      "intakeError",
      "reviewNote",
    ])
      delete d[key];
    d.uploadedBy ??= owner.id;
  }
  for (const e of legacy.rows.actividad) e.actorId ??= owner.id;
  assert.equal(
    (
      await api("/api/estate/backup?confirm=1", {
        ...backup.data,
        payload: encrypt(JSON.stringify(legacy)),
      })
    ).status,
    200,
  );
  const restore = await api("/api/estate/backup?confirm=1", backup.data);
  assert.equal(restore.status, 200, JSON.stringify(restore));
  assert.deepEqual(
    (await api("/api/estate")).data.documents.map((d) => ({
      id: d.id,
      subject: d.subjectContactId,
      fulfils: d.fulfilsDocumentId,
      source: d.source,
      hasFile: d.hasFile,
    })),
    metadataBefore.map((d) => ({
      id: d.id,
      subject: d.subjectContactId,
      fulfils: d.fulfilsDocumentId,
      source: d.source,
      hasFile: d.hasFile,
    })),
  );
  console.log(
    "API: recepción por cliente, archivos homónimos separados, duplicados, cifrado, clasificación, solicitudes, versiones, permisos del original, reintento y copia/restauración correctos.",
  );
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    timezoneId: "Europe/Madrid",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo", { exact: true }).fill(credentials.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await page.goto(`${base}/clients?id=${a.id}`);
  await page
    .getByRole("heading", { name: "Cliente Alfa", exact: true })
    .waitFor();
  await page
    .getByText("Recibido por WhatsApp", { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Identificación de Alfa", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Añadir documento", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Añadir documento" });
  await dialog
    .getByLabel("Título del documento", { exact: false })
    .fill("Última nómina de Alfa");
  await dialog
    .getByLabel("Tipo de documento", { exact: false })
    .selectOption("nomina");
  assert.equal(
    await dialog
      .getByLabel("Cliente del documento", { exact: false })
      .inputValue(),
    a.id,
  );
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await page
    .getByRole("heading", { name: "Última nómina de Alfa", exact: true })
    .waitFor();
  await page
    .getByLabel("Archivo para Última nómina de Alfa", { exact: true })
    .setInputFiles({
      name: "nomina-alfa.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nNómina ficticia Alfa"),
    });
  await page
    .getByRole("link", { name: "nomina-alfa.pdf", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Editar documento", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: "Editar documento" });
  await dialog
    .getByLabel("Estado del documento", { exact: false })
    .selectOption("rechazado");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "Indica qué debe corregirse" })
    .waitFor();
  await dialog
    .getByLabel("Resultado de la revisión o motivo de rechazo", {
      exact: false,
    })
    .fill("Falta una página");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.screenshot({
    path: ".local/documentacion-cliente-escritorio.png",
    fullPage: true,
  });
  await page.goto(`${base}/documents`);
  await page
    .getByLabel("Buscar documento", { exact: true })
    .fill("Cliente Beta");
  await page
    .getByRole("link", { name: "Abrir expediente", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Cliente Beta", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/clients?id=${a.id}`);
  await page
    .getByRole("heading", { name: "Documentos y contratos", exact: true })
    .waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: ".local/documentacion-cliente-movil.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "UI: expediente correcto, solicitudes, carga, validación de rechazo, búsqueda por cliente, navegación y móvil correctos.",
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
