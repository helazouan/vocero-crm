# Contactos, inicio manual y recordatorios

Automatización: `npm run test:e2e:seguimientos`. Requiere PostgreSQL local con
permiso de crear bases y Chromium de Playwright. Crea y elimina una base temporal,
abre la aplicación en 3106 y usa credenciales ficticias solo en esa base.

1. Sembrar 235 contactos, 20 archivados: recorrer los 215 activos sin duplicados.
2. Buscar y cambiar filtros; verificar paginación y rechazo de página inválida.
3. Cortar la carga de Contactos: aviso y reintento. Fallar PATCH: editor conserva
   el nombre y permite guardar al recuperar el servidor.
4. Elegir manual, cambiar a IA y volver; recargar conserva la selección. Manual
   no exige proveedor ni perfil, y apaga un agente previamente activo.
5. Programar y editar una acción desde Pipeline. Verla en Vencidos, completarla,
   verla en Completados y comprobar persistencia tras recarga.
6. Rechazar fecha inválida, texto vacío, usuario sin sesión y lead ajeno.
7. Verificar la pantalla a 1280 y 390 px, sin desbordamiento horizontal.

Capturas y logs quedan en `.local/`. Las unitarias cubren Hoy, cambio de día y
cambio de horario en Europe/Madrid. El recordatorio es interno: no envía mensajes.
