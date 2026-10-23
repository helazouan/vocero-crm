/** Viviendas, personas e importes ficticios para recorrer el CRM. */
export const DEMO_CONTACTS = [
  {
    phone: "34600000001", name: "María López", stage: "Interesado",
    notes: "Busca un piso de tres habitaciones en Chamberí. Prefiere las visitas por la tarde.",
    thread: [
      { dir: "in", text: "Hola, he visto el piso de Chamberí, referencia MAD-101. ¿Sigue disponible?", hoursAgo: 5 },
      { dir: "out", text: "Hola, María. El piso MAD-101 tiene 90 m², tres habitaciones y dos baños. El precio anunciado es de 325.000 €. Confirmo la disponibilidad con el asesor antes de concertar la visita.", hoursAgo: 5, ai: true },
      { dir: "in", text: "¿Tiene ascensor?", hoursAgo: 4 },
      { dir: "out", text: "Sí, el edificio tiene ascensor. ¿Qué día te vendría bien visitarlo?", hoursAgo: 4, ai: true },
      { dir: "in", text: "El jueves a partir de las 17:00 me vendría bien. ¿Podemos concertar una visita?", hoursAgo: 3 },
    ],
  },
  {
    phone: "34600000002", name: "Carlos Ramírez", stage: "En conversación",
    notes: "Busca un chalet con jardín y garaje en Las Rozas. Presupuesto máximo: 480.000 €.",
    thread: [
      { dir: "in", text: "Buenos días. Estamos buscando un chalet con jardín en Las Rozas. ¿Qué tenéis a la venta?", hoursAgo: 8 },
      { dir: "out", text: "Buenos días, Carlos. En el ejemplo MAD-102 tenemos un chalet de 160 m², cuatro habitaciones, tres baños, jardín y garaje. El precio anunciado es de 495.000 €.", hoursAgo: 8, ai: true },
      { dir: "in", text: "Nuestro presupuesto máximo es de 480.000 €. ¿Se podría presentar una oferta?", hoursAgo: 7 },
      { dir: "out", text: "Podemos trasladar tu propuesta al asesor para que la consulte con la propiedad. ¿Te gustaría visitar la vivienda primero?", hoursAgo: 7, ai: true },
    ],
  },
  {
    phone: "34600000003", name: "Lucía Hernández", stage: "Cliente",
    notes: "Ha reservado la vivienda MAD-103. Pendiente de revisar la documentación con su asesora.",
    thread: [
      { dir: "in", text: "Hola, soy Lucía. Ya hemos enviado la documentación de la vivienda de Retiro.", hoursAgo: 30 },
      { dir: "out", text: "Hola, Lucía. Gracias por avisarnos. Tu asesora revisará la documentación de la vivienda MAD-103 y te confirmará los siguientes pasos.", hoursAgo: 30, ai: true },
      { dir: "in", text: "Perfecto. ¿Me podéis llamar mañana por la mañana?", hoursAgo: 29 },
      { dir: "out", text: "He dejado tu preferencia anotada para que la asesora confirme contigo la hora de la llamada.", hoursAgo: 29, ai: true },
    ],
  },
  {
    phone: "34600000004", name: "Jorge Castillo", stage: "Nuevo",
    notes: "Primera consulta sobre una vivienda de cuatro habitaciones con jardín.",
    thread: [
      { dir: "in", text: "Hola, ¿tenéis alguna casa de cuatro habitaciones con jardín?", hoursAgo: 2 },
      { dir: "out", text: "Hola, Jorge. Tenemos como ejemplo el chalet MAD-102 en Las Rozas: cuatro habitaciones, jardín y garaje, por 495.000 €. ¿En qué zona buscas y qué presupuesto tienes?", hoursAgo: 2, ai: true },
    ],
  },
  {
    phone: "34600000005", name: "Ana Torres", stage: "Interesado",
    notes: "Interesada en el adosado MAD-104 de Getafe. Quiere visitarlo con su pareja.",
    thread: [
      { dir: "in", text: "Hola, he visto vuestro anuncio del adosado de Getafe. ¿Me podéis dar más información?", hoursAgo: 12 },
      { dir: "out", text: "Hola, Ana. La referencia MAD-104 es un adosado de 130 m², cuatro habitaciones, dos baños y plaza de garaje. Su precio anunciado es de 365.000 €.", hoursAgo: 12, ai: true },
      { dir: "in", text: "¿Se podría visitar el sábado por la mañana?", hoursAgo: 11 },
      { dir: "out", text: "Podemos solicitar una visita el sábado. Dime qué horario os viene mejor y el asesor confirmará la cita con la propiedad.", hoursAgo: 11, ai: true },
      { dir: "in", text: "Lo consulto con mi pareja y os confirmo si podemos a las 11:00.", hoursAgo: 10 },
    ],
  },
  {
    phone: "34600000006", name: "Roberto Mendoza", stage: "Perdido",
    notes: "Ha elegido otra vivienda. Mantener el contacto solo si vuelve a solicitar información.",
    thread: [
      { dir: "in", text: "Hola, ¿cuál es el precio del piso MAD-101 de Chamberí?", hoursAgo: 96 },
      { dir: "out", text: "Hola, Roberto. El precio anunciado es de 325.000 €. Tiene 90 m², tres habitaciones, dos baños y ascensor. ¿Quieres que solicitemos una visita?", hoursAgo: 96, ai: true },
      { dir: "in", text: "Gracias, pero al final hemos elegido otra vivienda que encaja mejor con nuestro presupuesto.", hoursAgo: 95 },
      { dir: "out", text: "Gracias por avisarnos, Roberto. Espero que vaya muy bien la compra. Si necesitas ayuda más adelante, estaremos encantados de atenderte.", hoursAgo: 95, ai: true },
    ],
  },
  {
    phone: "34600000007", name: "Patricia Domínguez", stage: "En conversación",
    notes: "Busca una vivienda con espacio exterior. Pendiente de concretar zona y presupuesto.",
    thread: [
      { dir: "in", text: "Buenas tardes. Busco una vivienda con terraza o jardín para mudarnos con los niños.", hoursAgo: 26 },
      { dir: "out", text: "Buenas tardes, Patricia. El chalet MAD-102 tiene jardín y cuatro habitaciones. ¿Qué zonas os interesan y cuál sería vuestro presupuesto máximo?", hoursAgo: 26, ai: true },
      { dir: "in", text: "Nos interesan Las Rozas y alrededores. Necesitamos al menos tres habitaciones.", hoursAgo: 25 },
    ],
  },
  {
    phone: "34600000008", name: "Jesús Aguilar", stage: "Cliente",
    notes: "Compra en seguimiento. Prefiere recibir las confirmaciones por WhatsApp.",
    thread: [
      { dir: "in", text: "Buenos días. ¿Me podéis confirmar si habéis recibido la documentación que envié ayer?", hoursAgo: 50 },
      { dir: "out", text: "Buenos días, Jesús. Traslado la consulta a tu asesor para que compruebe la recepción y te confirme si falta algún documento.", hoursAgo: 50, ai: true },
      { dir: "in", text: "De acuerdo. Si falta algo, avisadme por aquí, por favor.", hoursAgo: 49 },
      { dir: "out", text: "Así lo haremos. Hemos anotado que prefieres recibir las confirmaciones por WhatsApp.", hoursAgo: 49, ai: true },
    ],
  },
] satisfies { phone: string; name: string; stage: string; notes: string; thread: { dir: "in" | "out"; text: string; hoursAgo: number; ai?: boolean }[] }[];

export const DEMO_KB: { kind: "qa" | "block"; question?: string; answer?: string; content?: string }[] = [
  { kind: "block", content: "Inmobiliaria Horizonte — negocio ficticio de demostración dedicado a la compraventa de viviendas en Madrid y alrededores. Los inmuebles, contactos e importes son ejemplos, no anuncios reales. Atendemos en español de España y trabajamos en euros. Un asesor confirma siempre disponibilidad, visitas y condiciones con la propiedad." },
  { kind: "qa", question: "¿Cuál es vuestro horario?", answer: "De lunes a viernes, de 09:00 a 14:00 y de 16:00 a 19:00. Los sábados atendemos visitas con cita previa, sujetas a confirmación." },
  { kind: "qa", question: "¿En qué zonas trabajáis?", answer: "En esta demostración trabajamos con viviendas en Chamberí, Retiro, Las Rozas y Getafe, en la Comunidad de Madrid." },
  { kind: "qa", question: "¿Cómo puedo concertar una visita?", answer: "Indica la referencia de la vivienda y qué días y horarios te vienen bien. El asesor confirmará la disponibilidad con la propiedad antes de dar la cita por cerrada." },
  { kind: "qa", question: "¿Qué viviendas hay en el catálogo de ejemplo?", answer: "MAD-101: piso en Chamberí, 90 m², tres habitaciones, dos baños y ascensor, 325.000 €. MAD-102: chalet en Las Rozas, 160 m², cuatro habitaciones, tres baños, jardín y garaje, 495.000 €. MAD-103: piso en Retiro, 105 m², tres habitaciones y dos baños, 410.000 €. MAD-104: adosado en Getafe, 130 m², cuatro habitaciones, dos baños y garaje, 365.000 €. Son referencias ficticias; confirma siempre el estado de cada operación con el asesor." },
  { kind: "qa", question: "¿El precio anunciado incluye todos los gastos?", answer: "No des por hecho que el precio anunciado incluye todos los gastos de la compra. Solicita al asesor un desglose específico de la vivienda y de las condiciones de la operación." },
  { kind: "qa", question: "¿Puedo presentar una oferta por una vivienda?", answer: "El asesor puede trasladar tu propuesta a la propiedad. La aceptación y las condiciones deben ser confirmadas por las partes; el asistente no puede comprometerse en su nombre." },
  { kind: "qa", question: "¿Puedo hablar con una persona?", answer: "Sí. Podemos trasladar la conversación a un asesor inmobiliario para revisar tu búsqueda, una visita o el estado de tu compra." },
];

export const DEMO_PROFILE = {
  name: "Asistente inmobiliario",
  tone: "Cercano y profesional, en español de España. Tutea al cliente y utiliza vivienda, piso, chalet, jardín, garaje y concertar una visita.",
  instructions: "Ayuda a conocer las necesidades del comprador: zona, presupuesto, habitaciones y plazo. Usa euros y referencias del catálogo. Distingue los datos de demostración de la oferta real. No inventes disponibilidad, condiciones ni citas confirmadas. Un asesor valida cada propuesta y visita.",
  escalationRules: "Deriva a un asesor las ofertas, reservas, documentación, consultas jurídicas o de financiación y cualquier petición de atención personal.",
  greeting: "Hola, soy el asistente de Inmobiliaria Horizonte. ¿Buscas una vivienda para comprar?",
};

export const DEMO_CASES = [
  { persona: "comprador_decidido", veredicto: "verde", hallazgos: [], transcript: [
    { role: "cliente", text: "Me interesa el chalet MAD-102. ¿Podemos visitarlo?" },
    { role: "agente", text: "Tiene cuatro habitaciones, jardín y garaje; el precio anunciado es de 495.000 €. Dime qué horario te viene bien y el asesor confirmará la visita." },
  ] },
  { persona: "pregunton_precios", veredicto: "verde", hallazgos: [], transcript: [
    { role: "cliente", text: "¿Cuánto cuesta el piso de Chamberí?" },
    { role: "agente", text: "La referencia MAD-101 tiene un precio anunciado de 325.000 €. ¿Quieres que te ampliemos la información?" },
  ] },
  { persona: "cliente_enojado", veredicto: "amarillo", hallazgos: [{ tipo: "tono", evidencia: "El cliente está molesto por la visita cancelada. La respuesta deriva la consulta, pero podría reconocer mejor las molestias." }], transcript: [
    { role: "cliente", text: "Me habéis cancelado la visita cuando ya estaba de camino." },
    { role: "agente", text: "Lamento lo ocurrido. Paso tu consulta a un asesor para revisar la cita contigo." },
  ] },
  { persona: "fuera_de_kb", veredicto: "rojo", hallazgos: [{ tipo: "fuera_de_kb", evidencia: "No hay información sobre las condiciones de reserva de la vivienda. El asesor debe incorporarlas tras verificarlas." }], transcript: [
    { role: "cliente", text: "¿Qué condiciones tiene la reserva de esta vivienda?" },
    { role: "agente", text: "Voy a consultarlo con el asesor para darte las condiciones de esta operación." },
  ] },
  { persona: "pide_humano", veredicto: "verde", hallazgos: [], transcript: [
    { role: "cliente", text: "Prefiero hablar directamente con un asesor inmobiliario." },
    { role: "agente", text: "De acuerdo, traslado tu consulta al equipo para que te atienda una persona." },
  ] },
  { persona: "errores_modismos", veredicto: "verde", hallazgos: [], transcript: [
    { role: "cliente", text: "hola, teneis alguna casa con jardin y 4 habitaciones?" },
    { role: "agente", text: "Hola. La referencia MAD-102 tiene jardín y cuatro habitaciones. ¿En qué zona estás buscando vivienda?" },
  ] },
] satisfies { persona: string; veredicto: "verde" | "amarillo" | "rojo"; hallazgos: unknown[]; transcript: { role: string; text: string }[] }[];
