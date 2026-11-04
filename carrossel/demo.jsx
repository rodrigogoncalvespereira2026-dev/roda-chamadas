import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import ThemeWheel from "./ThemeWheel";
import { DEFAULT_THEME, THEMES, isThemeId } from "./themes";
import "./roda.css";
import "./demo.css";

const KEY = "cnbr:theme";

function readStoredTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return isThemeId(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Demo: a roda sozinha, com o tema escolhido guardado no navegador. */
function Demo() {
  const [themeId, setThemeId] = useState(readStoredTheme);

  const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeId;
    // A demo tem uma paleta só: o acento vem do tema escolhido e as derivadas
    // (--accent40/60/80, --surface, --bg) acompanham via color-mix.
    root.style.setProperty("--accent-base", theme.accent);
    try {
      localStorage.setItem(KEY, themeId);
    } catch {
      /* storage bloqueado: a demo segue funcionando na sessão */
    }
  }, [theme.accent, themeId]);

  const name = theme.name;

  return (
    <main className="demo">
      <div className="demo__wheel">
        <ThemeWheel
          selectedTheme={themeId}
          onSelect={(theme) => setThemeId(theme.id)}
          label="Tema"
        />
      </div>
      <p className="demo__label">{name}</p>
      <p className="demo__hint">
        Arraste, use o scroll ou as setas do teclado. Clique para escolher.
      </p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>
);
