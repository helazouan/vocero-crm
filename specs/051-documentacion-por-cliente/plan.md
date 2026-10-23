# Plan

1. Añadir campos opcionales a estate_document: tipo documental, cliente, inmueble,
   operación, solicitud cumplida, procedencia, mensaje/asset y error de incorporación.
   Autor nullable para recepción del sistema. Índice único por organización/wamid.
2. Servicio de recepción con candado por organización, idempotencia y copia cifrada.
   Crear ficha sin sobrescribir; recepción pendiente seguida de incorporación tras
   descargar el adjunto. Reintento autenticado y aislamiento de permisos del original.
3. Extender validación y expediente: tipos, asociaciones, solicitud, rechazo y estados.
   Mantener DTOs internos y versiones. Copias compatibles con registros anteriores.
4. UI cliente + documentos con solicitudes, archivos por revisar e incidencias.
5. Prueba de dos clientes, duplicados, versiones, solicitudes, fallos/permisos,
   referencias y copia/restauración; recorridos visuales y actualización local.

Constitution check: flujo conversacional, credenciales/archivos cifrados, scoped,
Zod, sin proveedores nuevos ni envíos externos. No se da autoridad a la IA para
validar documentos ni se mezclan carpetas por interpretación del contenido.
