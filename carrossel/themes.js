/**
 * Catálogo de temas — mesmos ids e mesmas cores do cnbr.space.
 *
 * O `accent` é o `--accent-base` do CSS do site, em oklch (L% C H). Cada tema
 * define só a cor de destaque; fundo, superfícies e textos são derivados dela
 * em src/styles.css (e em ./roda.css para a roda isolada).
 *
 * `kwami` é o kwami ligado ao Miraculous daquele herói — o comunicador mostra
 * o nome dele durante a chamada. Sem kwami conhecido, o campo fica ausente.
 */
export const THEMES = [
  { id: "cat", name: "Cat", accent: "oklch(87% 0.3 143)", kwami: "Plagg" },
  { id: "ladybug", name: "Ladybug", accent: "oklch(67% 0.2 25)", kwami: "Tikki" },
  { id: "fox", name: "Fox", accent: "oklch(79% 0.17 71)", kwami: "Trixx" },
  { id: "snake", name: "Snake", accent: "oklch(88% 0.17 169)", kwami: "Sass" },
  { id: "bee", name: "Bee", accent: "oklch(96% 0.21 110)", kwami: "Pollen" },
  { id: "butterfly", name: "Butterfly", accent: "oklch(63% 0.25 307)", kwami: "Nooroo" },
  { id: "peacock", name: "Peacock", accent: "oklch(60% 0.25 275)", kwami: "Duusu" },
  { id: "dog", name: "Dog", accent: "oklch(75% 0.18 40)", kwami: "Barkk" },
  { id: "bunny", name: "Bunny", accent: "oklch(82% 0.14 213)", kwami: "Fluff" },
  { id: "rooster", name: "Rooster", accent: "oklch(70% 0.2 39)", kwami: "Orikko" },
  { id: "pig", name: "Pig", accent: "oklch(85% 0.18 322)", kwami: "Daizzi" },
  { id: "goat", name: "Goat", accent: "oklch(100% 0 0)", kwami: "Ziggy" },
  { id: "ox", name: "Ox", accent: "oklch(60% 0.21 265)", kwami: "Stompp" },
  { id: "turtle", name: "Turtle", accent: "oklch(86% 0.21 138)", kwami: "Wayzz" },
  { id: "dragon", name: "Dragon", accent: "oklch(67% 0.22 18)", kwami: "Longg" },
  { id: "tiger", name: "Tiger", accent: "oklch(60% 0.21 341)", kwami: "Roaar" },
  { id: "horse", name: "Horse", accent: "oklch(52% 0.1 68)", kwami: "Kaalki" },
  { id: "monkey", name: "Monkey", accent: "oklch(75% 0.14 68)", kwami: "Xuppu" },
  { id: "mouse", name: "Mouse", accent: "oklch(80% 0 0)", kwami: "Mullo" },
  { id: "uncanny", name: "Uncanny", accent: "oklch(75% 0.14 96)" },
];

export const DEFAULT_THEME = "cat";

export function themeById(id) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function isThemeId(value) {
  return THEMES.some((theme) => theme.id === value);
}
