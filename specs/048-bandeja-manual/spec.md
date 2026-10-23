# 048 — Bandeja para el trabajo diario

Carril ligero, antes de implementar. Sin cambios de esquema ni contratos públicos.

## Comportamiento

- Un fallo al cargar conversaciones o mensajes muestra un aviso con reintento,
  separado de la ausencia de datos. Un fallo de actualización conserva lo leído.
  Respuestas antiguas no sustituyen una carga más reciente.
- La bandeja vacía permite abrir Contactos, Pipeline y Seguimientos para empezar
  a trabajar manualmente. La demo sigue siendo una opción explícita.
- Los detalles de una conversación con oportunidad permiten guardar y completar
  su próxima acción mediante el componente existente.
- Guardar notas confirma el resultado. Si falla, se conserva el borrador y se
  permite reintentar. Cambiar de conversación reinicia el panel y sus avisos.

## Aceptación

Ejercitar carga vacía, fallo y recuperación de lista e hilo. Abrir dos contactos
sin mezclar sus detalles. Fallar el guardado de notas, conservar texto, reintentar
y comprobar persistencia. Programar un seguimiento desde la bandeja y verlo en
Seguimientos. Verificar escritorio y móvil en una base temporal.

## Límites y Constitution Check

Se usan los endpoints autenticados existentes, scoped() y Zod del servidor.
Sin mensajes externos, dependencias nuevas ni cambios del bot o SSE. Se conservan
componentes y tokens visuales. Pruebas: tipos, lint, unitarias, build y navegador.

## Verificación

2026-10-23: typecheck, lint, build y 1277 pruebas unitarias correctos.
Recorrido E2E correcto sobre base temporal, con errores de carga y guardado,
persistencia de notas, cambio de cliente y próxima acción. Vistas verificadas
a 1440 y 390 px. Sin datos de prueba añadidos a la instalación del propietario.
