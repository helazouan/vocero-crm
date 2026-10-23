# Documentación por cliente — 051

Arnés: `npm run test:e2e:documentacion`. Utiliza una base temporal, archivos
ficticios y Meta simulado; nunca envía mensajes a clientes reales.

1. Dos clientes escriben por el webhook firmado y envían PDF con el mismo nombre.
   Cada uno obtiene su ficha y su documento pendiente, sin clasificar. Repetir el
   mensaje no duplica el archivo. Original y copia del expediente están cifrados.
2. El asesor registra una solicitud, incorpora el archivo y clasifica su tipo.
   Una solicitud de otro cliente o ya satisfecha por otro archivo se rechaza.
   Revisado exige archivo y tipo; Rechazado exige motivo.
3. Subir una sustitución conserva la versión anterior y vuelve a Pendiente.
   Corregir el cliente mueve toda la cadena de versiones al expediente correcto.
4. Un miembro sin acceso no descarga el documento ni el original del chat.
   Compartirlo explícitamente con el equipo permite ambas descargas.
5. Una descarga fallida deja una incidencia. Reintentar tras recuperar Meta
   incorpora el archivo sin duplicados. Laboratorio y salientes quedan excluidos.
6. Exportar/restaurar conserva clientes, vínculos, solicitudes y versiones.
   Restaurar una copia de 2.3.0 sigue siendo posible.
7. En escritorio y móvil, abrir el expediente correcto, registrar solicitud,
   cargar un archivo, comprobar el error de rechazo sin motivo y buscar por cliente.

Pendiente externo: recepción real desde Meta cuando se configure la conexión.
