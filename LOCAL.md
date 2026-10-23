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
- `.local/postgres/`: datos persistentes de esta instalación, excluidos mediante
  `.git/info/exclude`. No borres esta carpeta para reiniciar la aplicación.
- `.dev-media/`: adjuntos locales, excluidos de Git.
- `.local/app.log` y `.local/postgres.log`: registros de los accesos locales.

La instalación inicial usó `npx --yes pnpm@11.5.0 install --frozen-lockfile`,
la versión fijada por el proyecto. Los comandos `npm run ...` ejecutan las
herramientas ya instaladas sin cambiar el lockfile.

## Conectar servicios

WhatsApp se configura en la aplicación, en Configuración → WhatsApp. Recibir
webhooks reales requiere una URL HTTPS pública, por ejemplo mediante un túnel
hacia esta instancia. Esa conexión no se crea durante la instalación local.

La IA se configura en Ajustes → IA con tu proveedor y su llave. La respuesta
automática requiere además un agente externo como Nea; no viene integrado en
Vocero 2.1. Sin estas conexiones puedes acceder y configurar el CRM local.

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
