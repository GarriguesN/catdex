export interface ChangelogEntry {
  version: string;
  date: string; // "Julio 2026"
  items: string[];
}

// Newest first — bump `version` in app/settings/page.tsx's APP_VERSION and
// app/settings/about/page.tsx's "Versión" row alongside adding an entry here.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "Agosto 2026",
    items: [
      "🏆 Gamificación completa: rachas diarias, logros instantáneos, ranking semanal entre amigos",
      "⚔️ Duelos 1 contra 1: desafía a un amigo a ver quién captura más gatos en 24h",
      "💬 Reacciones: deja un emoji en las capturas de tus amigos",
      "🔗 Compartir: genera un enlace para que cualquiera vea un gato sin tener cuenta",
      "📬 Notificaciones push: recibe avisos de duelos, logros y rachas (Web Push + service worker)",
      "🌍 Colonia compartida: todos tus amigos suman al mismo mapa colaborativo",
      "🧪 Tests unitarios con Vitest: ranking, duelos, logros, reacciones, discovery",
      "📸 Postal de descubrimiento: al atrapar un gato nuevo se genera una postal para compartir",
      "🪄 Scroll parallax en la ficha de cada gato con foto hero",
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
