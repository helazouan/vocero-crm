# Contrato: Canal SSE de la bandeja

Ruta: `GET /api/events` (autenticada por sesión; scope = organización y cartera del usuario).
`export const dynamic = 'force-dynamic'`.

Headers de respuesta (obligatorios, exactos):

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
Connection: keep-alive
```

- **Heartbeat**: comentario `: ping\n\n` cada ~25s (mantiene vivo el stream detrás de
  Caddy/Traefik y proxies intermedios).
- **Eventos** (`event: <tipo>`, `data: <json>`, `id: <epoch_ms>`):
  - `message.new` — `{ conversationId, message: {...} }` (nunca de conversaciones `is_test`)
  - `message.status` — `{ conversationId, messageId, status }`
  - `conversation.updated` — `{ conversation: {...} }` (handoff, unread, last_message_at)
  - `lab.run` — `{ runId, status, progress: {done, total}, score? }`
- **Catch-up**: el cliente manda `Last-Event-ID` (o el front refetch desde su último
  `last_message_at`) al reconectar; el servidor NO garantiza replay — el cliente hace
  refetch de conversaciones/mensajes con `since=<timestamp>` al evento `open` tras una
  reconexión. EventSource reconecta solo (retry por defecto).
- **Bus interno**: EventEmitter in-process por organización (`server/events`); publicar
  tras commit de BD.

## Cartera por asesor (052)

Propietario/administrador recibe los eventos del negocio. Miembros reciben solo
eventos asociados a sus clientes actualmente asignados; no reciben Laboratorio.
Se consulta la membresía y asignación actuales en cada entrega, también en streams
abiertos antes de una reasignación. Lo no autorizable se omite.

Evento aditivo `portfolio.changed` — `{}`: invalida la vista de los miembros cuando
dirección cambia una asignación. No contiene identificadores ni información del
cliente. El front recarga para retirar expedientes revocados e incorporar nuevos.
Las formas de los eventos anteriores y los headers se conservan.
