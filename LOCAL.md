# Desarrollo local en macOS

Esta copia usa PostgreSQL 16 de Homebrew, sin Docker. El CRM escucha en
`http://localhost:3000` y su base de datos en `127.0.0.1:5433`.

El repositorio propio es `helazouan/vocero-crm` (`origin`). El proyecto original
es `kevinrivm/vocero-crm` (`upstream`).

## Arrancar

Desde la carpeta del repositorio:

```bash
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D .local/postgres -l .local/postgres.log -o '-h 127.0.0.1 -p 5433 -k /tmp' start
npm run dev -- --hostname 127.0.0.1
```

Si PostgreSQL ya está arrancado, omite el primer comando. Para esta instalación
también hay accesos locales `.local/Iniciar.command` y `.local/Detener.command`.
El arranque de la aplicación puede tardar unos segundos.

Abre `http://localhost:3000/register` para crear tu cuenta. El primer registro
crea la organización y su propietario. La instalación deja este paso al dueño;
no crea contraseñas ni datos de ejemplo.

## Detener

Si ejecutaste `npm run dev` en primer plano, pulsa Ctrl+C. Después:

```bash
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D .local/postgres stop -m fast
```

## Datos y secretos

- `.env`: configuración y secretos generados, excluidos de Git.
- `.local/postgres/`: datos persistentes de esta instalación, excluidos de Git.
  No borres esta carpeta para reiniciar la aplicación.
- `.dev-media/`: adjuntos locales, excluidos de Git.
- `.local/app.log` y `.local/postgres.log`: registros de los accesos locales.

La instalación inicial usó `npx --yes pnpm@11.5.0 install --frozen-lockfile`,
la versión fijada por el proyecto. Los comandos `npm run ...` ejecutan las
herramientas ya instaladas sin cambiar el lockfile.

## Conectar servicios

WhatsApp se configura en la aplicación, en Configuración → WhatsApp. Recibir
webhooks reales requiere una URL HTTPS pública, por ejemplo mediante un túnel
hacia esta instancia. Esa conexión no se crea durante la instalación local.

Para un túnel de pruebas limitado al webhook, mantén `APP_BASE_URL` local y
define `WEBHOOK_BASE_URL` con el origen HTTPS que entregue el túnel. Arranca
`node --env-file=.env scripts/webhook-proxy.mjs` y apunta el túnel a
`http://127.0.0.1:3107`, nunca directamente al puerto 3000. El proxy solo admite
GET/POST en la ruta exacta del webhook de WhatsApp; mantiene la firma de Meta y
rechaza el resto de rutas. No imprime la URL secreta ni el contenido de mensajes.
Reinicia el CRM después de cambiar `WEBHOOK_BASE_URL`.

Los túneles temporales cambian de dominio al arrancar de nuevo: actualiza la
variable y vuelve a registrar el webhook en Meta. Al parar el túnel o el Mac
dejarán de entrar mensajes. El token de acceso de Meta se pega directamente en
Configuración → WhatsApp, no se añade al repositorio.

La IA se configura en Ajustes → IA con tu proveedor y su llave. La respuesta
automática requiere además un agente externo como Nea; no viene integrado en
Vocero 2.x. Sin estas conexiones puedes acceder y configurar el CRM local.

## Atención manual y seguimientos

En Guía de inicio elige **Atención manual**: no requiere proveedor de IA ni
perfil del agente. Cambiar a manual apaga la respuesta automática. Elegir
**Con agente de IA** conserva el encendido como un paso explícito.

Abre una oportunidad en Pipeline para guardar su **Próxima acción**, con fecha
y hora de tu navegador. En **Seguimientos** puedes ver Pendientes, Hoy,
Vencidos y Completados, reprogramar o completar la acción. Los recordatorios
son internos y se actualizan cada minuto y al volver a la ventana; no envían
WhatsApp, correo ni notificaciones push. Cada oportunidad conserva una acción:
programar la siguiente sustituye la anterior.

La actualización 2.2.0 añade la migración `0023_seguimiento_comercial.sql`.
Para actualizar otra copia desde el código, ejecuta `npm run db:migrate` antes
de arrancarla. En esta instalación ya está aplicada y hay una copia previa
en `.local/antes-de-046.dump`.

Para repetir el recorrido automatizado, ejecuta `npm run test:e2e:seguimientos`.
Usa una base temporal propia y el puerto 3106; no añade cuentas ni contactos
a tu base de trabajo. Requiere Chromium de Playwright y permisos para crear
bases en el PostgreSQL local.

## Trabajar en mejoras

```bash
git switch -c codex/nombre-de-la-mejora
npm run typecheck
npm run lint
npm test
npm run build
```

Consulta `AGENTS.md` antes de modificar código. Esta preparación es una tarea
de instalación y documentación, exenta de especificación funcional según el
principio VI; no modifica el comportamiento del producto.
