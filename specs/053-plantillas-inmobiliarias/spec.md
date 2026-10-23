# 053 — Revisión de plantillas inmobiliarias

Carril ligero, antes de implementar. Sin migración ni cambio de contrato público.

## Problema y comportamiento

La ayuda mezcla vocabulario latinoamericano, clínicas y pedidos con un CRM de
venta de viviendas. El texto de tarifas por conversación ha quedado obsoleto.
Los consejos plegados desaparecen de la lectura y un fallo de carga parece una
lista vacía. La creación no deja clara la conexión pendiente con WhatsApp.

- Español de España e idioma inicial es_ES sin cambiar plantillas existentes.
- Ejemplos editables de confirmación/recordatorio de visita, actualización de una
  operación solicitada y propuesta comercial de viviendas (Marketing). Se identifica
  la inmobiliaria mediante variable, sin inventar disponibilidad ni aprobación.
- Ayuda visible con pasos numerados una sola vez, iconos decorativos ocultos a
  accesibilidad y consejos completos. Variables con ejemplos ficticios, categorías
  y enlace a tarifas actuales; no garantizar plazo/aprobación de Meta ni coste fijo.
- Sin WhatsApp configurado se permite preparar y previsualizar, pero se explica
  la conexión necesaria antes de enviar a revisión. Fallo de carga y sincronización
  visibles, reintento y conservación de valores; no confundir error con lista vacía.
- Dirección crea/sincroniza plantillas; asesores consultan aprobadas para enviarlas
  solo a sus clientes. El texto explica que aprobar una plantilla no autoriza a
  contactar personas que no quieren recibir mensajes.

## Verificación y límites

Probar ayuda, los ejemplos y variables, España predeterminada, móvil, error de
carga/recuperación y guardado fallido/recuperación. En base temporal con Meta
simulado, verificar creación, aprobación/sincronización y permisos. No crear ni
enviar plantillas a Meta real. No añade envíos automáticos, campañas ni nuevas
clases de documentos sensibles. La clasificación final la decide Meta.

Constitution check: organización y roles en servidor, APIs de Meta por adaptador
existente, sin dependencias nuevas, tokens cifrados y pruebas locales con mock.

Fuentes consultadas el 23/10/2026: política de WhatsApp Business y tarifas oficiales
(business.whatsapp.com/policy y business.whatsapp.com/products/platform-pricing).

## Verificación realizada

1.288 pruebas unitarias, lint y build correctos (incluye comprobación de tipos).
El E2E de plantillas pasa ayuda, cuatro ejemplos, variables, permisos, ausencia
de conexión, errores/recuperación, creación y aprobación con mock, escritorio y
móvil. Comprobación visual de la ayuda y de la vista previa en localhost:3000.
Instalación local 2.5.1. La aprobación real depende de conectar WhatsApp y Meta.
