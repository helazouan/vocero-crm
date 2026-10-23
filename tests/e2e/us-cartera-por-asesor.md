# Cartera por asesor — 052

Arnés: `npm run test:e2e:cartera`. Base temporal, propietario y dos asesores
ficticios, segunda organización y Meta simulado. No modifica datos reales.

1. Dirección asigna Alfa a Alba y Beta a Bruno. Un tercero queda sin asignar.
   Alba solo encuentra Alfa en Clientes, Contactos, bandeja, pipeline y seguimientos;
   solo ve sus operaciones, visitas, documentos e historial. El catálogo oculta el
   titular Beta. Dirección ve todo, incluido el cliente sin asignar.
2. Probar lectura y escritura por identificadores de Beta: ficha, mensaje, envío,
   plantilla, adjunto, reenvío desde Beta a Alfa, operación, oferta, visita, acción,
   documento, versión, reintento y cita antigua. Deben fallar sin mutar datos.
3. Alba clasifica documentos de Alfa cargados por dirección o WhatsApp y sube una
   versión. No puede consultar Beta aunque figure como autora o acceso Equipo.
   Los documentos heredados de vivienda siguen al titular. Otra organización no
   obtiene acceso por identificador.
4. Sus nuevas altas quedan asignadas a Alba. No puede asignar clientes a Bruno,
   apropiarse de Beta, importar contactos, crear usuarios ni obtener copia global.
5. Abrir SSE con ambos asesores: mensaje de Alfa llega solo a Alba. Reasignar a
   Bruno invalida vistas; sin reconectar, mensajes posteriores llegan solo a Bruno.
   Alba pierde original y todas las versiones; Bruno puede gestionarlas.
6. Navegador: URL ajena sin datos, responsable no editable por asesor, asignación
   editable por propietario y pantallas abiertas actualizadas. Sin desbordamiento
   horizontal en móvil.
