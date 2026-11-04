/**
 * Catálogo de temas — mesmos ids e mesmas cores do cnbr.space.
 *
 * O `accent` é o `--accent-base` do CSS do site, em oklch (L% C H). Cada tema
 * define só a cor de destaque; fundo, superfícies e textos são derivados dela
 * em src/styles.css (e em ./roda.css para a roda isolada).
 */
export const THEMES = [
  { id: "cat", name: "Cat", accent: "oklch(87% 0.3 143)" },
  { id: "ladybug", name: "Ladybug", accent: "oklch(67% 0.2 25)" },
  { id: "fox", name: "Fox", accent: "oklch(79% 0.17 71)" },
  { id: "snake", name: "Snake", accent: "oklch(88% 0.17 169)" },
  { id: "bee", name: "Bee", accent: "oklch(96% 0.21 110)" },
  { id: "butterfly", name: "Butterfly", accent: "oklch(63% 0.25 307)" },
  { id: "peacock", name: "Peacock", accent: "oklch(60% 0.25 275)" },
  { id: "dog", name: "Dog", accent: "oklch(75% 0.18 40)" },
  { id: "bunny", name: "Bunny", accent: "oklch(82% 0.14 213)" },
  { id: "rooster", name: "Rooster", accent: "oklch(70% 0.2 39)" },
  { id: "pig", name: "Pig", accent: "oklch(85% 0.18 322)" },
  { id: "goat", name: "Goat", accent: "oklch(100% 0 0)" },
  { id: "ox", name: "Ox", accent: "oklch(60% 0.21 265)" },
  { id: "turtle", name: "Turtle", accent: "oklch(86% 0.21 138)" },
  { id: "dragon", name: "Dragon", accent: "oklch(67% 0.22 18)" },
  { id: "tiger", name: "Tiger", accent: "oklch(60% 0.21 341)" },
  { id: "horse", name: "Horse", accent: "oklch(52% 0.1 68)" },
  { id: "monkey", name: "Monkey", accent: "oklch(75% 0.14 68)" },
  { id: "mouse", name: "Mouse", accent: "oklch(80% 0 0)" },
  { id: "uncanny", name: "Uncanny", accent: "oklch(75% 0.14 96)" },
];

export const DEFAULT_THEME = "cat";

export function themeById(id) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function isThemeId(value) {
  return THEMES.some((theme) => theme.id === value);
}
