import { createServer, request } from "node:http";

// Puerta local para el túnel: ninguna ruta del CRM puede atravesarla.
const token = process.env.META_WEBHOOK_VERIFY_TOKEN;
if (!token || !/^[a-zA-Z0-9_-]{8,}$/.test(token)) throw new Error("Falta un verify token válido en el entorno");
const path = `/api/webhooks/wa/${token}`;
const port = Number(process.env.WEBHOOK_PROXY_PORT ?? 3107);
const upstreamPort = Number(process.env.WEBHOOK_UPSTREAM_PORT ?? 3000);
if (![port, upstreamPort].every(value => Number.isInteger(value) && value > 0 && value < 65536)) throw new Error("Puerto inválido");

const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url?.split("?")[0] !== path || !["GET", "POST"].includes(req.method)) {
    res.writeHead(404).end(); req.resume(); return;
  }
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
  } catch { if (!res.headersSent) res.writeHead(400).end(); return; }
  const body = Buffer.concat(chunks);
  const headers = { "content-length": String(body.length) };
  for (const name of ["content-type", "x-hub-signature-256"]) {
    if (typeof req.headers[name] === "string") headers[name] = req.headers[name];
  }
  const upstream = request({ hostname: "127.0.0.1", port: upstreamPort, path: req.url, method: req.method, headers }, response => {
    if (response.headers["content-type"]) res.setHeader("Content-Type", response.headers["content-type"]);
    res.writeHead(response.statusCode ?? 502);
    response.on("error", () => res.destroy());
    response.pipe(res);
  });
  upstream.setTimeout(15000, () => upstream.destroy());
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502).end(); else res.destroy(); });
  res.on("close", () => upstream.destroy());
  upstream.end(body);
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
server.listen(port, "127.0.0.1", () => console.log(`Proxy de webhook listo en 127.0.0.1:${port}; el resto de rutas devuelve 404.`));
