export const LOCALES = [
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "en-US", label: "English (US)" },
  { id: "es-ES", label: "Español" },
  { id: "fr-FR", label: "Français" },
  { id: "de-DE", label: "Deutsch" },
  { id: "it-IT", label: "Italiano" },
];

export const DEFAULT_LOCALE = "pt-BR";

export const MESSAGES = {
  "pt-BR": {
    brand: "Chat Noir Brasil",
    navHome: "Início",
    navEpisodes: "Episódios",
    navCards: "Cards",
    navCharacters: "Personagens",
    navMore: "Mais",
    profileTitle: "Meu Perfil",
    profileSubtitle: "Veja seus episódios favoritos e personalize sua experiência.",
    settings: "Configurações",
    theme: "Tema",
    language: "Idioma",
    linksTitle: "Redes",
    footerNote: "Site criado por fãs para fãs.",
  },
  "en-US": {
    brand: "Chat Noir Brasil",
    navHome: "Home",
    navEpisodes: "Episodes",
    navCards: "Cards",
    navCharacters: "Characters",
    navMore: "More",
    profileTitle: "My Profile",
    profileSubtitle: "See your favourite episodes and customize your experience.",
    settings: "Settings",
    theme: "Theme",
    language: "Language",
    linksTitle: "Socials",
    footerNote: "A fan site made by fans.",
  },
  "es-ES": {
    brand: "Chat Noir Brasil",
    navHome: "Inicio",
    navEpisodes: "Episodios",
    navCards: "Cartas",
    navCharacters: "Personajes",
    navMore: "Más",
    profileTitle: "Mi Perfil",
    profileSubtitle: "Mira tus episodios favoritos y personaliza tu experiencia.",
    settings: "Ajustes",
    theme: "Tema",
    language: "Idioma",
    linksTitle: "Redes",
    footerNote: "Sitio creado por fans para fans.",
  },
  "fr-FR": {
    brand: "Chat Noir Brasil",
    navHome: "Accueil",
    navEpisodes: "Épisodes",
    navCards: "Cartes",
    navCharacters: "Personnages",
    navMore: "Plus",
    profileTitle: "Mon Profil",
    profileSubtitle: "Retrouvez vos épisodes favoris et personnalisez votre expérience.",
    settings: "Paramètres",
    theme: "Thème",
    language: "Langue",
    linksTitle: "Réseaux",
    footerNote: "Site créé par des fans pour des fans.",
  },
  "de-DE": {
    brand: "Chat Noir Brasil",
    navHome: "Start",
    navEpisodes: "Episoden",
    navCards: "Karten",
    navCharacters: "Charaktere",
    navMore: "Mehr",
    profileTitle: "Mein Profil",
    profileSubtitle: "Sieh deine Lieblingsfolgen und passe dein Erlebnis an.",
    settings: "Einstellungen",
    theme: "Design",
    language: "Sprache",
    linksTitle: "Netzwerke",
    footerNote: "Von Fans für Fans erstellt.",
  },
  "it-IT": {
    brand: "Chat Noir Brasil",
    navHome: "Home",
    navEpisodes: "Episodi",
    navCards: "Carte",
    navCharacters: "Personaggi",
    navMore: "Altro",
    profileTitle: "Il Mio Profilo",
    profileSubtitle: "Guarda i tuoi episodi preferiti e personalizza la tua esperienza.",
    settings: "Impostazioni",
    theme: "Tema",
    language: "Lingua",
    linksTitle: "Social",
    footerNote: "Sito creato da fan per fan.",
  },
};

/** Escolhe o idioma inicial a partir do navegador, caindo no pt-BR. */
export function detectLocale() {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const available = LOCALES.map((locale) => locale.id);
  const browserLocales = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);

  for (const browserLocale of browserLocales) {
    if (available.includes(browserLocale)) return browserLocale;

    const base = browserLocale.split("-")[0].toLowerCase();
    const match = available.find((id) => id.split("-")[0].toLowerCase() === base);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}

export function isLocaleId(value) {
  return Object.prototype.hasOwnProperty.call(MESSAGES, value);
}
