# 051 — Documentación por cliente

Carril completo, escrito antes de implementar: cambios aditivos en el modelo y
migración generada. Usuario significa comprador/propietario/contacto del CRM.

## Comportamiento

- La primera entrada real por WhatsApp completa una ficha inmobiliaria sin
  duplicar ni sobrescribir el contacto, sus preferencias o su responsable.
- Los PDF e imágenes entrantes generan un registro en la ficha del remitente.
  Se conserva el origen, se copia el binario cifrado y queda pendiente de revisión,
  con tipo Sin clasificar. No se infiere identidad, validez, firma ni inmueble.
- Los tipos documentales distinguen identificación, ingresos, vivienda y contratos.
  Un asesor puede solicitar elementos concretos; son registros internos, no se
  envían peticiones al cliente automáticamente. No hay requisitos legales universales.
- Cada documento tiene cliente asociado y, cuando corresponda, inmueble/operación.
  Un documento recibido puede satisfacer una solicitud específica del mismo cliente.
  No se sobrescribe una solicitud por adivinar el tipo del archivo.
- Los estados son pendiente, revisado, pendiente de firma, firmado y rechazado.
  Rechazado exige motivo. Validar exige archivo y tipo concreto. Cada nueva versión
  vuelve a revisión y conserva la anterior.
- Se muestran solicitudes pendientes, archivos por revisar, rechazos, tipo, cliente,
  origen y fecha. Los archivos recibidos por WhatsApp se pueden reintentar si falló
  su copia, sin duplicar registros. Una copia de seguridad conserva estos vínculos.
- Los originales del chat respetan los permisos del documento importado. Entrantes
  restringidos por defecto a administradores hasta que se compartan explícitamente.
  Un mensaje reenviado para un tercero requiere corregir el cliente asociado antes
  de validarlo; el origen del mensaje permanece registrado.

## Límites y decisiones

Canales confirmados por el usuario: WhatsApp y carga interna del asesor en el CRM.
No se incluye un portal de acceso para clientes en esta tanda.
Sin OCR, LLM ni solicitudes automáticas de documentos sensibles. Los registros
solo se clasifican o validan mediante acción explícita del asesor. No es firma
electrónica. Se conservan los contratos públicos de webhook, bot y SSE.

Archivos PDF/JPG/PNG/WebP hasta 10 MiB. Otros adjuntos se conservan en el chat y
aparecen como incidencia de incorporación, sin afirmar que están archivados.
La descarga real de Meta depende de su conexión; los ensayos usarán archivos ficticios.

## Criterios

Dos remitentes con documentos del mismo nombre no se mezclan. Repetir un mensaje
o una descarga no duplica documentos. Una copia fallida conserva la solicitud y
permite reintento. No se importan mensajes de laboratorio ni salientes. Asignación,
solicitud y referencias se validan en la organización. Dos archivos independientes
no pueden cumplir la misma solicitud; sí sus versiones. La interfaz y el backup
incluyen los vínculos. Verificar en base temporal, navegador, tipos/lint/tests/build,
aplicar migración con copia previa y publicar en el PR existente.
