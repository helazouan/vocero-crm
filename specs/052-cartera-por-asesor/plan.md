# Plan

1. Política central de cartera con condición SQL y comprobaciones de entidades,
   documentos y adjuntos; se aplica explícitamente en rutas y servicios.
2. Filtrar listados y cerrar acceso directo y mutaciones en todas las superficies
   del expediente. Dirección conserva reservas/solapamientos globales al validar.
3. Filtrar SSE por pertenencia actual y añadir `portfolio.changed` sin datos de
   cliente para invalidar vistas al cambiar responsable. Mantener formas anteriores.
4. Interfaz: explicar cartera, bloquear reasignación del asesor y edición de
   inmuebles; documentos gestionables por su asesor. Documentar actualización.
5. Pruebas aisladas con dos asesores, dirección, segunda organización, ataques
   por identificador y referencias, SSE, recuperación y navegador. Gates, build,
   arranque local y publicación en el PR existente.

Constitution check antes y después del diseño: scoped por organización y cartera
en servidor, Zod, sin dependencias nuevas, sin mensajes externos, medios cifrados,
SSE aditivo y pruebas negativas. Propietario administra toda la instancia.
