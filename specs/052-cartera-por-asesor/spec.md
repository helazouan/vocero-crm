# 052 — Cartera por asesor

Carril completo, escrito antes de implementar. No requiere migración: la ficha
ya contiene `assignedUserId`. Se amplía SSE con una invalidación sin datos.

## Comportamiento y decisiones

- Propietario y administrador conservan acceso a todo el negocio. Un miembro
  solo ve y gestiona clientes cuya ficha le asigna como asesor responsable.
  Sin asignación, el cliente queda en dirección, incluidos entrantes de WhatsApp.
- Solo dirección asigna o reasigna. Un cliente creado por un asesor se le asigna
  automáticamente. Importación masiva y copias completas quedan en dirección.
- La cartera se comprueba en servidor: Clientes, Contactos, bandeja y mensajes,
  pipeline, seguimientos, visitas, operaciones, ofertas, actividad y adjuntos.
  Un identificador ajeno devuelve 404, también en escritura y enlaces directos.
- El asesor puede consultar, clasificar, cargar y sustituir documentos de sus
  clientes, independientemente de quién los cargó. El acceso «equipo» nunca abre
  la cartera de otro asesor. Documentos sin cliente identificable son de dirección.
  Los documentos heredados resuelven cliente por operación o propietario.
- Dirección puede corregir titular y reasignar. El asesor no puede trasladar un
  documento a otro cliente, aunque ambos sean suyos, ni cambiar la cartera.
- El catálogo de viviendas sigue compartido para buscar viviendas a compradores;
  no expone titulares ajenos ni su actividad documental. Dirección edita inmuebles.
- Resultados globales, laboratorio y configuración quedan en dirección. La agenda
  antigua solo muestra citas de clientes propios; bloques generales son de dirección.
- Reasignar invalida las pantallas abiertas. SSE filtra cada evento con la cartera
  actual, sin caché de asignaciones. No puede recuperar archivos ya descargados.

## Verificación

Dos asesores y un propietario: listas, URL/API directa, lectura/escritura,
documentos de cualquier autor/visibilidad, original/reenviado, referencias cruzadas,
alta propia, asignación forzada rechazada, cliente sin asignar, reasignación,
SSE ya conectado, vistas de escritorio/móvil. No cambiar APIs públicas del bot;
su credencial es de servicio del negocio y no se entrega a asesores.
No se incorpora MFA, baja de usuarios ni nuevo sistema de auditoría en esta tanda.
