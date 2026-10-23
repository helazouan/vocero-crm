# Plan

1. Añadir tablas org-first: perfil inmobiliario del contacto, inmueble, operación,
   oferta, visita y documento; actividad append-only. Referencias con borrado
   restrictivo y archivado de dominio. Migración de Drizzle sin modificar existentes.
2. Servicio de dominio con Zod, scoped(), validación de contactos/miembros y
   transacciones. Candado advisory por organización para solapamientos y reservas.
3. API inmobiliaria autenticada para listados filtrados, fichas, mutaciones,
   documentos y copias; DTOs explícitos sin rutas de almacenamiento ni cifrados.
4. Documentos por adaptador de medios existente, payload AES-GCM y metadatos
   privados, límites y firmas de archivo. Cada versión conserva su binario.
5. UI con componentes/tokens actuales: páginas Hoy, Clientes, Inmuebles,
   Operaciones y Agenda; editor y expediente reutilizables, calendario existente
   reutilizado para visitas, accesos desde Bandeja/Pipeline/Seguimientos.
6. Datos de ejemplo inmobiliarios vinculados a los contactos demo existentes,
   idempotentes y solo tras reconocer los mensajes demo, sin borrar personalizaciones.
7. Pruebas de API/aislamiento, concurrencia, ficheros, backup y navegador sobre base
   temporal; migrar y arrancar local, publicar en el PR abierto con alcance actualizado.

Constitution Check: utilidad ligada a convertir conversaciones en compraventas;
datos por organización, cifrado y permisos, sin terceros nuevos. No cambia la API
del bot, webhook o SSE. Adaptadores y contrato temporal anteriores conservados.
No se requieren dependencias de pago o externas. La autorización del propietario
define el enfoque inmobiliario de este fork.
