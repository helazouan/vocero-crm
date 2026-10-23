# 047 — Webhook público con CRM local

Carril ligero, escrito antes de implementar: configuración opcional, sin cambios
de modelo ni de los contratos de eventos o rutas del webhook.

## Necesidad y comportamiento

Una prueba local de WhatsApp necesita un callback HTTPS accesible por Meta, pero
el propietario quiere mantener el panel y la autenticación en localhost.
`WEBHOOK_BASE_URL`, opcional, define el origen público de los webhooks. Si no se
define, se conserva APP_BASE_URL. La pantalla y el registro automático comparten
la misma dirección. APP_BASE_URL continúa controlando la autenticación.

## Aceptación

- Sin variable nueva, URLs y rutas existentes iguales.
- Con origen HTTPS público, callback público y acceso local independientes.
- El proxy de prueba acepta solo GET/POST en la ruta exacta del webhook de
  WhatsApp; login, configuración, otras APIs y rutas incorrectas devuelven 404.
- Handshake con token correcto responde al challenge; token incorrecto rechazado.

## Límites y Constitution Check

El túnel es una herramienta opcional de desarrollo, no una dependencia de runtime.
No se exponen credenciales en logs, ni se envían mensajes durante la preparación.
No se cambia la ruta firmada, los eventos ni la validación del webhook.
Pruebas: fallback/origen en unitarias, gates y handshake HTTP local/público.
Conexión real con Meta pendiente de la sesión y credenciales del propietario.
