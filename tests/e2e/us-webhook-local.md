# Webhook HTTPS con acceso local

1. Arrancar el CRM con APP_BASE_URL local. Arrancar el proxy con
   `node --env-file=.env scripts/webhook-proxy.mjs`.
2. Crear un túnel temporal a 127.0.0.1:3107, poner su origen HTTPS en
   WEBHOOK_BASE_URL y reiniciar el CRM.
3. Por el proxy y por la URL pública comprobar que `/`, `/login`,
   `/settings/whatsapp`, `/api/health`, `/api/auth/get-session`, un token de
   ruta incorrecto y un sufijo extra devuelven 404. DELETE también devuelve 404.
4. GET a la ruta exacta con hub.mode=subscribe, el verify token correcto y un
   challenge de prueba: 200 y challenge idéntico. Verify token incorrecto: 403.
5. POST de un evento vacío (entry: []), firmado si META_APP_SECRET está definido:
   recibido, sin crear contactos ni mensajes. Cuerpo mayor de 1 MiB: 413.
6. En Configuración → WhatsApp, callback HTTPS y aviso HTTP ausente. El panel
   sigue en localhost. No copiar el token ni la URL completa a logs/capturas.

Ejecutado el 2026-10-23: proxy local, túnel público y pantalla correctos.
Tipos, lint, build y 1277 pruebas unitarias correctos. No se ha conectado todavía
una cuenta de WhatsApp real: Meta exige confirmar la cuenta de desarrollador y
su paso de confirmación devuelve un error técnico.
