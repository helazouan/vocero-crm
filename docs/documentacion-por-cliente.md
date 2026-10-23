# Documentación por cliente

Cada comprador o propietario utiliza la misma ficha de Contactos/Clientes. No se
crea una cuenta de acceso al CRM para cada persona que escribe por WhatsApp.

## Recepción por WhatsApp

La primera entrada completa el perfil inmobiliario sin sobrescribir nombres,
preferencias o responsables. Los documentos e imágenes entrantes se incorporan a
la ficha del remitente. La descarga utiliza la conexión oficial del negocio.

El registro conserva fecha, origen y nombre del archivo, con tipo Sin clasificar
y estado Pendiente. El original del chat y la copia del expediente se cifran. Dos
clientes pueden enviar archivos homónimos sin compartir registros o archivos. Los
reintentos del mismo mensaje no duplican documentos.

Revisa el cliente al que corresponde el contenido: el remitente puede estar
enviando documentación para otra persona. «Cliente del documento» permite corregir
su asignación explícitamente. No se infiere la identidad legal por el nombre de
archivo ni se interpreta el documento con un LLM.

## Solicitar, clasificar y revisar

1. Abre Clientes → ficha → Documentos y contratos → Añadir documento.
2. Escribe qué necesitas y elige un tipo: identificación, nómina, justificante de
   ingresos, documentación de la vivienda, reserva, arras, compraventa u otro.
   Selecciona cliente y, si corresponde, inmueble y operación. Esto registra una
   solicitud interna: no envía mensajes ni exige documentación por defecto.
3. Incorpora el archivo recibido mediante Subir archivo, o abre el recibido por
   WhatsApp y selecciona la solicitud concreta en «Corresponde a una solicitud».
   El cliente y el tipo deben coincidir. Una solicitud no puede quedar satisfecha
   por dos documentos independientes; sus versiones sí conservan el vínculo.
4. Revisa el archivo. Revisado y Firmado requieren archivo y un tipo concreto.
   Rechazado exige explicar qué debe corregirse. Firmado es un estado registrado
   manualmente, no una verificación de firma ni firma electrónica.
5. Una sustitución crea una versión nueva, conserva el archivo anterior y vuelve
   a Pendiente. La solicitud vinculada no aparece como otro documento faltante.

Las solicitudes pendientes, archivos por revisar y rechazos se cuentan dentro del
expediente. Documentos permite buscar por cliente y tipo. Un documento también se
puede consultar desde su inmueble u operación relacionados, sin duplicar el archivo.

## Archivos, incidencias y permisos

El expediente admite PDF, JPG, PNG y WebP hasta 10 MiB. Un tipo no admitido, una
copia excesiva o un fallo de descarga deja una incidencia visible; no se afirma que
el documento se ha archivado. «Reintentar incorporación» recupera una descarga
fallida sin crear otra solicitud. También puede incorporarlo el asesor manualmente.

Desde 2.5.0, dirección y el asesor responsable del cliente consultan y gestionan
sus documentos, incluidos los entrantes de WhatsApp. Un asesor ajeno no obtiene
acceso aunque figure como autor de una versión antigua o el documento tuviera
visibilidad Equipo. El original del chat comprueba también la cartera. Los
archivos sin titular identificable quedan en dirección. Detalle y reasignación:
[permisos por asesor](permisos-por-asesor.md).

El Laboratorio no incorpora documentos a expedientes reales. Los mensajes salientes
no se archivan como documentos entrantes. Esta recepción no activa el agente ni
requiere proveedor de IA.

## Actualización y copias

Versión 2.4.0: hacer copia PostgreSQL + medios + claves, aplicar la migración
aditiva `0025_documentacion_por_cliente.sql` y reconstruir desde código. La clave
ENCRYPTION_KEY se necesita para ambos archivos cifrados: original y expediente.
Los adjuntos antiguos siguen siendo legibles y se protegen al incorporarlos.

Las copias de expedientes conservan cliente, tipo, vínculos, solicitudes, incidencias
y versiones. Aceptan también las copias de 2.3.0 sin esos campos. La copia completa
de medios sigue siendo necesaria para recuperar adjuntos de conversaciones.

`npm run test:e2e:documentacion` ensaya dos clientes con archivos homónimos,
recepción por webhook firmado, duplicados, cifrado, solicitud, clasificación,
versiones, permisos de archivo y original, descarga fallida, recuperación,
exportación/restauración y escritorio/móvil, en una base temporal y con Meta simulado.
La recepción externa real sigue pendiente de completar la conexión con Meta.
