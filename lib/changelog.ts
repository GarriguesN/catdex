export interface ChangelogEntry {
  version: string;
  date: string; // "Julio 2026"
  items: string[];
}

// Newest first — bump `version` in app/settings/page.tsx's APP_VERSION and
// app/settings/about/page.tsx's "Versión" row alongside adding an entry here.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.1",
    date: "Agosto 2026",
    items: [
      "Mapa: ya no se bugea al entrar y salir — recuerda la zona que estabas viendo y corrige el tamaño en móvil automáticamente",
      "Mapa: vuelve al instante desde otras pestañas, sin recargar todo otra vez",
      "Logros: cada insignia explica ahora cómo desbloquearla",
      "Logros: se desbloquean al momento al poner nombre o añadir nota a un gato",
      "Nuevos logros activados: Día de suerte, Mejor amigo, Obsesionado, Día de lluvia y Embajador",
      "Amigos: al volver de ver un perfil, la lista se mantiene donde estabas (sin recargar ni subir arriba)",
    ],
  },
  {
    version: "1.4.0",
    date: "Julio 2026",
    items: [
      "Notificaciones push funcionando: recibe avisos de duelos, logros y rachas aunque tengas la app cerrada",
      "Botón de prueba de notificaciones en Ajustes para verificar que todo funciona",
      "Service worker optimizado: instalación instantánea, sin caché innecesario",
      "Fecha de captura visible en el modal del mapa al tocar un clúster",
      "Imágenes con object-cover en toda la app: miniaturas, tarjetas y carrusel",
      "Anillo naranja del thumbnail corregido: ya no se recorta arriba y abajo",
      "Fix: crear duelos ya no da error 400 por la regla de validación",
      "Fix: timeout de notificaciones aumentado y con reintento automático",
    ],
  },
  {
    version: "1.3.2",
    date: "Julio 2026",
    items: [
      "Mapa: al tocar un clúster se abre la lista de gatos en vez de solo hacer zoom",
    ],
  },
  {
    version: "1.3.0",
    date: "Agosto 2026",
    items: [
      "Nueva pestaña Competición: ranking, duelos y rachas en un solo lugar",
      "Perfiles de amigos: visita el perfil de cualquier amigo y ve su colección",
      "Descubridor visible: cada gato muestra quién lo encontró primero",
      "Feed principal rediseñado con actividad de toda la colonia",
      "Navegación inferior reorganizada con sección social dedicada",
    ],
  },
  {
    version: "1.2.0",
    date: "Agosto 2026",
    items: [
      "Gamificación completa: rachas diarias, logros instantáneos, ranking semanal entre amigos",
      "Duelos 1 contra 1: desafía a un amigo a ver quién captura más gatos en 24h",
      "Reacciones: deja un emoji en las capturas de tus amigos",
      "Compartir: genera un enlace para que cualquiera vea un gato sin tener cuenta",
      "Notificaciones push: recibe avisos de duelos, logros y rachas",
      "Colonia compartida: todos tus amigos suman al mismo mapa colaborativo",
      "Tests unitarios con Vitest: ranking, duelos, logros, reacciones, discovery",
      "Postal de descubrimiento: al atrapar un gato nuevo se genera una postal para compartir",
      "Scroll parallax en la ficha de cada gato con foto hero",
    ],
  },
  {
    version: "1.1.0",
    date: "Julio 2026",
    items: [
      "Sistema de amigos: añade amigos con un código de invitación y ve sus capturas en el mapa",
      "Perfil rediseñado con resumen de tu colección, logros y actividad reciente",
      "Los logros ahora se desbloquean de verdad, con icono y fecha real",
      "El mapa muestra solo tus capturas por defecto, con opción de sumar las de tus amigos",
      "Tarjetas de la colección y ficha de cada gato rediseñadas",
      "Detección de gatos más precisa con un nuevo motor de reconocimiento",
      "Instalación como app en Android e inicio de sesión más fiable dentro de la app instalada",
    ],
  },
  {
    version: "1.0.0",
    date: "Lanzamiento inicial",
    items: [
      "Captura y colecciona gatos callejeros con la cámara",
      "Mapa colaborativo de avistamientos",
      "Puntuación y ranking entre usuarios",
    ],
  },
];
