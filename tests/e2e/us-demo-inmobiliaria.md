# Demostración inmobiliaria en español de España

`npm run test:e2e:demo` crea y elimina una base temporal local. Comprueba ocho
contactos y 31 mensajes, euros en la configuración de marca, ausencia de textos
de ferretería, recarga sin duplicados y conservación de los contactos de otra
organización con los mismos teléfonos de demostración.

En la instalación local se adaptan solo los registros originales identificados
por sus teléfonos y mensajes `wamid.demo.*`. Se comparan los textos anteriores
antes de cambiarlos; notas o nombres personalizados se conservan. Verificar los
identificadores de contactos y las próximas acciones antes y después.

En Bandeja, comprobar la consulta de Jorge sobre una casa de cuatro habitaciones
con jardín y la respuesta sobre MAD-102 (495.000 €). Abrir otra conversación y
verificar la solicitud de visita y los formatos de fecha y hora españoles. En
Conocimiento y Agente, comprobar catálogo y perfil inmobiliarios coherentes.
