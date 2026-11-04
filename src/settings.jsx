import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME, isThemeId } from "../carrossel/themes";
import { DEFAULT_LOCALE, MESSAGES, detectLocale, isLocaleId } from "./locales";

const THEME_KEY = "cnbr:theme";
const LOCALE_KEY = "cnbr:locale";

const SettingsContext = createContext(null);

function readStored(key, fallback, validate) {
  try {
    const value = localStorage.getItem(key);
    return value && validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado: o app segue funcionando na sessão */
  }
}

export function SettingsProvider({ children }) {
  const [themeId, setThemeId] = useState(() => readStored(THEME_KEY, DEFAULT_THEME, isThemeId));
  const [locale, setLocale] = useState(() =>
    readStored(LOCALE_KEY, detectLocale(), isLocaleId)
  );

  // O tema vive no <html data-theme>, não em cada componente.
  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    persist(THEME_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    document.documentElement.lang = locale;
    persist(LOCALE_KEY, locale);
  }, [locale]);

  const t = useCallback(
    (key) => MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE]?.[key] ?? key,
    [locale]
  );

  const value = useMemo(
    () => ({ themeId, setThemeId, locale, setLocale, t }),
    [themeId, locale, t]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings precisa estar dentro de <SettingsProvider>.");
  }
  return context;
}
