# Plan

1. Añadir preferencia nullable de atención en organization y próxima acción,
   fecha y fecha de completado en lead. Mantener organización como ámbito.
2. Paginar Contactos con limit/offset validados, total y orden en SQL; corregir UI.
3. Resolver guía según preferencia persistente; inferir IA en instalaciones con
   cerebro o agente activo, manual en las demás. Solo administradores la cambian.
4. API autenticada de seguimientos por lead y componente reutilizable en cajón del
   pipeline; pantalla dedicada con filtros y edición. Completado idempotente.
5. Pruebas unitarias de filtros/validación y recorrido sobre base de ensayo local;
   migrar instalación, documentar y publicar rama del fork con PR.

Decisión: recordatorios internos sin notificaciones fuera del CRM. Hora del navegador
indicada expresamente; las comparaciones usan instantes UTC. No depende de Agenda.
