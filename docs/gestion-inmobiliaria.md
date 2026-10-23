# Gestión inmobiliaria

La versión 2.3.0 añade Inmuebles, Clientes, Operaciones, Agenda, Documentos y
Mi jornada. Funciona manualmente sin WhatsApp, IA ni conectores externos.

## Uso diario

1. En Clientes, completa la ficha existente o crea un comprador/propietario. Las
   preferencias cruzan municipio, tipo, habitaciones y presupuesto con viviendas
   disponibles. El teléfono conserva la identidad de la conversación.
2. Registra un inmueble con referencia única, precio EUR, superficie y asesor.
   Vincula su propietario. Añade fotografías como documentos de categoría Fotografía;
   las imágenes se muestran dentro de la ficha y en las tarjetas del catálogo.
3. Abre una operación para un comprador y una vivienda. Guarda ofertas y
   contraofertas separadas para conservar la negociación. Reserva/contrato/cierre
   actualizan el estado del inmueble y excluyen otra reserva sobre la misma casa.
   Marcar una operación como perdida exige motivo y libera su reserva.
4. Concierta visitas desde el cliente, el inmueble o Agenda. Los cuatro modos de
   calendario usan Europe/Madrid. Las visitas activas no pueden solaparse para el
   mismo asesor o vivienda. Cancelar/no presentado libera el hueco. No se envían
   confirmaciones al cliente automáticamente.
5. Solicita un documento desde un expediente, incluso antes de recibirlo. Sube
   PDF, JPG, PNG o WebP hasta 10 MiB. Cada sustitución crea una versión; las
   anteriores conservan el archivo y quedan cerradas. Para marcar Firmado hay que
   incorporar el archivo. Ese estado es manual, no una firma electrónica.
6. Registra llamadas, reuniones o notas. Consulta Mi jornada y Seguimientos para
   atender visitas, próximas acciones y documentos pendientes. Se actualizan cada
   minuto y al recuperar el foco; no hay avisos externos con la aplicación cerrada.

Cada asesor pertenece al equipo configurado en Ajustes → Equipo. Los datos se
comparten dentro de la organización; los documentos restringidos solo los ven el
autor y administradores. Los documentos de equipo son legibles por todos, pero
solo su autor o un administrador puede modificarlos. Solo administradores exportan
restauraciones. Los contactos con expediente se archivan desde Contactos: no se
eliminan desde la bandeja para evitar perder contratos e historial.

La demo inicial incluye las cuatro viviendas MAD-101 a MAD-104 y operaciones
ficticias vinculadas a las conversaciones. Completar la demo existente es
idempotente y no sustituye fichas que se hayan editado. Una demo con expedientes
no se puede recargar con `--force`.

## Copias y recuperación

Mi jornada → Copias y recuperación exporta los contactos básicos, perfiles,
inmuebles, operaciones, ofertas, visitas, documentos (incluidos sus binarios) y
actividad. El JSON completo está cifrado con la ENCRYPTION_KEY de la instalación.
No incluye cuentas, conversaciones, acciones del pipeline ni credenciales.
La exportación está limitada a 50 MiB (25 MiB de archivos cifrados antes de empaquetar).
Para conjuntos mayores, usa la copia completa descrita más abajo.

Para recuperar expedientes, selecciona la copia, pulsa Revisar copia y comprueba
los recuentos. Confirmar restaura esos registros en una transacción; conserva los
registros creados después de la copia. La identidad del contacto no se cambia y
se rechazan conflictos con visitas o reservas posteriores. Los responsables deben
seguir perteneciendo al equipo. El archivo debe proceder de la misma organización
y utilizar la misma clave. Guarda la clave por separado en un lugar seguro.

Para recuperar **toda la instalación**, guarda juntos y protegidos:

- Un volcado PostgreSQL en formato custom (`pg_dump -Fc`, usando las credenciales
  de tu despliegue sin escribirlas en el historial de comandos).
- El volumen MEDIA_DIR completo, o una copia versionada del bucket configurado.
- El archivo de entorno y ENCRYPTION_KEY, BETTER_AUTH_SECRET y los demás secretos,
  guardados fuera del repositorio. Sin ENCRYPTION_KEY los archivos no se recuperan.
- La versión/commit exacto del código y su configuración de despliegue.

Detén las escrituras antes de copiar PostgreSQL y medios para obtener un conjunto
consistente. Ensaya `pg_restore` en una base vacía y una carpeta de medios separada,
con la misma clave. Arranca esa copia en un puerto local aislado, verifica `/api/health`,
el acceso, una conversación y la descarga de un documento; comprueba recuentos.
La restauración completa sustituye una instalación: conserva una copia previa y
utiliza un entorno separado antes de moverla a servicio.

## Desarrollo y comprobación

`npm run test:e2e:inmobiliaria` crea una base PostgreSQL temporal, aplica migraciones,
arranca un servidor local separado y comprueba API, permisos, concurrencia,
documentos, recuperación y UI de escritorio/móvil. No vacía DATABASE_URL. Requiere
una cuenta local PostgreSQL con permiso para crear bases y Chromium de Playwright.

La migración es aditiva. Haz una copia antes de `npm run db:migrate`. Las nuevas
pantallas usan `/api/estate`; las APIs `/api/bookings`, `/api/bot/*`, webhooks y SSE
conservan sus contratos. La agenda anterior, cuando AGENDA=on, aparece en Otras citas.
