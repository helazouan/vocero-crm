# Tareas

- [x] Modelo y migración
- [x] Paginación y errores de Contactos
- [x] Preferencia de atención y guía manual
- [x] Próxima acción, filtros y completado
- [x] Recorrido de navegador y API, y documentación
- [x] Gates finales y preparación de la rama para publicar

Verificado en local el 2026-10-23: typecheck, lint y build correctos;
110 archivos de pruebas, 1269 tests correctos. Recorrido de API y Chromium
correcto a 1280 y 390 px, incluyendo fallos de red y guardado. La migración
0023 se aplicó con copia previa; health devuelve versión 2.2.0.

La ampliación del CI con el recorrido E2E queda pendiente: la credencial de
publicación no tiene permiso para modificar workflows. El script se incluye
y se ha ejecutado en local; los gates del CI existente se conservan.
