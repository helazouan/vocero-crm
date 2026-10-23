# 046 — Contactos, inicio manual y próxima acción

Carril completo: cambia el modelo de datos. Solicitado por el propietario del fork.

## Comportamiento
- Contactos permite recorrer toda la lista en páginas de 50; búsqueda, etapa,
  archivado y prioridad se aplican antes de paginar. Orden estable por id.
- Carga, error y vacío son estados distintos. Guardar con error conserva el
  formulario y permite reintentar. Búsquedas antiguas no pisan resultados nuevos.
- El propietario elige atención manual o con agente. En manual la guía exige
  WhatsApp y, si está habilitada, agenda; no exige perfil ni proveedor de IA.
  Cambiar a manual apaga el agente. Elegir IA no lo enciende automáticamente.
- Cada oportunidad admite una próxima acción con texto y fecha/hora. Se guarda
  en UTC, se captura y se muestra en la zona del navegador (indicada en pantalla).
- Una pantalla Seguimientos muestra pendientes, Hoy, Vencidos y completados.
  Hoy incluye todo el día local; Vencidos incluye toda fecha anterior al instante
  actual. Se puede editar, reprogramar y completar, sin enviar mensajes externos.
- Un recordatorio es la entrada persistente en Seguimientos. La pantalla se
  actualiza cada minuto y al recuperar el foco; no requiere permisos del navegador.

## Aceptación
Recorrer >200 contactos; archivados no ocultan activos. Probar error de red al
cargar y guardar. Completar guía manual sin IA. Crear, recargar, editar, completar
una acción; clasificar Hoy/Vencidos y comprobar aislamiento entre organizaciones.

## Límites
Una acción pendiente por oportunidad; sustituirla reemplaza la anterior. Se conserva
la última acción completada hasta programar la siguiente. Sin correo, push, WhatsApp
automático ni cambios a los contratos públicos del bot. Sin nuevas dependencias.

## Constitution Check
Consultas con scoped(), validación Zod, autenticación existente, sin secretos nuevos,
sin servicios externos. UI mantiene componentes y tokens actuales. Migración aditiva,
generada por Drizzle. Verificación: tipos, lint, unitarias, build y navegador local.
