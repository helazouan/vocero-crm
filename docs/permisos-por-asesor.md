# Permisos por asesor

Desde 2.5.0 la ficha del cliente determina la cartera: el campo Asesor responsable
es la fuente de acceso. No basta con filtrar la pantalla: servidor, archivos y
acciones comprueban la organización y la asignación.

| Perfil | Acceso |
|---|---|
| Propietario / administrador | Todos los clientes, documentos y operaciones; asigna y reasigna responsables |
| Asesor / miembro | Sus clientes y documentos, conversaciones, operaciones, visitas y seguimientos |
| Cliente sin asignar | Solo visible para dirección |

El rol administrador está soportado; la pantalla Equipo crea miembros. No se añade
un editor de roles en esta versión. Solo el propietario crea cuentas del equipo.

## Asignación

Dirección abre Clientes → ficha → Editar ficha → Asesor responsable. Al guardar,
los documentos y la información vinculada siguen al cliente; no es necesario
compartir cada archivo. Un asesor no puede cambiar la cartera ni adjudicarse
clientes de otros. Sus altas nuevas se le asignan automáticamente, tanto en
Clientes como en Contactos. Los entrantes nuevos de WhatsApp quedan sin asignar
hasta que dirección los reparta.

Al cambiar el responsable, las pantallas de los asesores se recargan. La sesión
anterior deja de obtener datos, archivos o eventos del cliente. Las respuestas y los archivos requieren validar permisos de nuevo, sin caché
del navegador. Una descarga que ya se ha realizado no se puede recuperar del dispositivo de quien la recibió.

## Documentos

El asesor puede clasificar, revisar, cargar nuevas versiones y recuperar archivos
de sus clientes, incluidos los recibidos automáticamente o cargados por dirección.
El autor de la carga se conserva como dato histórico, no como permiso permanente.
Los antiguos valores de acceso Equipo/Restringido se conservan para compatibilidad
con las copias, pero ninguno permite saltarse la cartera. Dirección puede corregir
el titular; el asesor no puede trasladar documentos entre clientes.

Los documentos heredados resuelven titular por cliente explícito, operación o
propietario de la vivienda. Si no hay titular identificable, solo dirección accede.
El acceso al original del chat y al reenvío comprueba también la cartera de origen.

## Otras pantallas

Las viviendas siguen disponibles como catálogo para atender compradores; se oculta
el identificador del propietario si está fuera de la cartera. Dirección edita los
inmuebles y su historial general. Los asesores ven solo sus operaciones, ofertas,
visitas y actividad de clientes. Resultados globales, Laboratorio, configuración,
importación masiva y copias completas están reservados a dirección.

La agenda antigua, si está habilitada, filtra citas por cliente. Los bloqueos
compartidos solo los gestiona dirección. Los huecos disponibles siguen calculándose
con todos los compromisos para evitar dobles reservas, sin exponer sus titulares.

La credencial de `/api/bot/*` es de servicio del negocio, no una cuenta de asesor;
conserva su alcance organizativo y no se entrega al equipo. Esta tanda no incorpora
MFA, gestión de bajas ni una auditoría completa de todos los accesos del CRM.

## Actualización y pruebas

Hacer copia de PostgreSQL, medios y claves; reconstruir y arrancar 2.5.0 desde
código. No hay migración nueva. Revisar la asignación de clientes antiguos antes
de que los asesores entren: no se reparte automáticamente información existente.

`npm run test:e2e:cartera` crea una base temporal y usuarios ficticios; prueba listas,
acciones, identificadores ajenos, documentos y originales, reasignación, SSE abierto,
otra organización y escritorio/móvil. Meta está simulado; no envía a clientes reales.
