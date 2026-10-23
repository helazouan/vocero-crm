# Bandeja de trabajo manual

Automatizado en `npm run test:e2e:seguimientos`, sobre PostgreSQL temporal.

1. Interrumpir `/api/conversations`: el error sustituye la carga infinita.
   Restablecer y reintentar: aparecen el vacío y los accesos de trabajo manual.
2. Crear dos conversaciones de ensayo. Fallar la carga de mensajes de una,
   reintentar y observar el hilo correcto.
3. Editar notas, devolver 500 en PATCH y comprobar que el texto se conserva.
   Reintentar: aparece «Notas guardadas» y persiste al cambiar de contacto.
4. Pasar al segundo cliente: notas y confirmación del anterior no aparecen.
5. Guardar una próxima acción desde detalles; verla en Seguimientos.
6. Verificar el panel y el seguimiento en escritorio y móvil de 390 px sin
   desbordamiento horizontal. No se envían mensajes ni se siembra la base real.
