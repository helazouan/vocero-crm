# 050 — Gestión inmobiliaria integrada

Carril completo, escrito antes del código. El propietario autoriza el conjunto
de mejoras: inmuebles, clientes, visitas, operaciones, documentación y trabajo diario.

## Comportamiento y aceptación

1. Inmuebles: alta, edición y búsqueda por referencia, dirección, municipio, tipo,
   estado y precio; superficies, habitaciones, baños, jardín, terraza, garaje,
   descripción, propietario y asesor. Fotografía mediante el expediente documental.
2. Clientes: reutilizar contactos (sin duplicarlos) o crear uno manualmente; tipo
   comprador, propietario o ambos, correo, presupuesto, zonas, habitaciones y
   responsable. Enlazar conversación, inmuebles en propiedad, operaciones,
   documentos, visitas e historial. Cruce de preferencias con inmuebles disponibles.
3. Operaciones: comprador + inmueble + responsable, fases nuevo, contacto, visita,
   oferta, reserva, contrato, cerrada y perdida. Ofertas y contraofertas con importe
   EUR, respuesta y notas. Una reserva/contrato/cierre exclusivo por inmueble.
4. Agenda: día, semana, mes y lista, hora Europe/Madrid. Crear y reprogramar visitas
   con cliente, inmueble, asesor, duración y notas. Pendiente, confirmada, realizada,
   no presentada o cancelada. Rechazar solapamientos del mismo asesor o inmueble,
   incluidos los intentos simultáneos. Sin requisitos de WhatsApp ni de servicios
   externos. Mantener la agenda y API previas accesibles para compatibilidad.
5. Documentos: PDF, JPG, PNG y WebP hasta 10 MiB, ligados a cliente, inmueble u
   operación. Categoría, estado pendiente/revisado/pendiente de firma/firmado,
   fecha de vencimiento y versiones inmutables por sustitución. Descarga autenticada,
   cifrado en reposo, control de acceso equipo o restringido (administradores y
   autor). Listar pendientes incluso antes de subir el archivo. Contratos son
   documentos: su estado de firma se registra manualmente, sin firma electrónica.
6. Actividad: registro automático de altas, modificaciones, cambios de fase,
   ofertas, visitas y documentos; añadir notas de llamada/reunión con fecha y autor.
7. Inicio Hoy: visitas del día, llamadas/acciones próximas y vencidas, documentos
   pendientes/vencidos, operaciones por fase, filtros por asesor y accesos directos.
8. Equipo: responsables elegidos de miembros de la organización, nunca usuarios
   externos. Permisos en el servidor, con 404 para registros de otras organizaciones.
9. Copias: exportación de datos inmobiliarios y documentos cifrados por propietario
   o administrador; restauración en la misma organización, con previsualización y
   confirmación, transacción y validación de todas las referencias. La copia completa
   de PostgreSQL, medios y clave sigue documentada para recuperar una instalación.

## Supuestos y límites

Un negocio, EUR, metros cuadrados, español de España y visitas presenciales.
Documentos restringidos por defecto. Recordatorios internos con actualización cada
minuto y al recuperar foco. El cruce usa criterios explícitos, sin inferencias de IA.
Sin publicación en portales, firma electrónica, contabilidad ni generación de contratos.
Los campos y documentos son de demostración hasta que el negocio los complete.
La nueva agenda no invoca conectores ni envía mensajes al cambiar citas.

## Verificación

Migración aditiva generada con Drizzle y copia local previa. E2E en base temporal:
crear cliente e inmueble, buscar y editar, comprobar coincidencias, abrir operación,
registrar ofertas, reservar sin doble reserva, agendar/reprogramar con rechazo de
solapamientos, subir/descargar/versionar documentos, permisos y aislamiento, historial,
dashboard, exportar/restaurar y errores de red. UI escritorio y móvil, gates completos.
