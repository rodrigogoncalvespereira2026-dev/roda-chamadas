# Roda de temas

Carrossel de temas em cilindro 3D (React + CSS puro, sem dependências), porte do
carrossel do cnbr.space. Esta pasta é autossuficiente: dá para copiar inteira para
outro projeto.

```
carrossel/
├── ThemeWheel.jsx   componente da roda (geometria, arrasto, inércia, teclado, ARIA)
├── ThemeIcon.jsx    os 20 ícones em SVG inline
├── themes.js        os 20 temas (id, nome, cor de destaque)
├── roda.css         CSS da roda + ponte para as variáveis do tema
├── demo.jsx/.css    página de demonstração (index.html)
└── README.md
```

## Usar em outro projeto

1. Copie a pasta (ou só `ThemeWheel.jsx`, `ThemeIcon.jsx`, `themes.js` e `roda.css`).
2. Importe o CSS uma vez e use o componente:

```jsx
import ThemeWheel from "./carrossel/ThemeWheel";
import "./carrossel/roda.css";

const [themeId, setThemeId] = useState("cat");

<ThemeWheel
  selectedTheme={themeId}
  onSelect={(theme) => setThemeId(theme.id)}
  label="Tema"
/>
```

3. Defina as variáveis do tema no `:root` (ou num `[data-theme="..."]`):

```css
:root {
  --accent-base: oklch(87% 0.3 143); /* só isto é obrigatório */
}
```

O `roda.css` deriva o resto com a fórmula do site — `--accent80/60/40/20` são
misturas com branco, `--accent120` é mistura com preto, e o fundo de cada opção
é 5% do acento sobre `#0f0f0f` (o `--bg-dark` deles).

Nada é obrigatório: sem `--accent-base` (nem o apelido `--accent`), entra o verde
do tema `cat`.

**Cada opção é multicolorida por natureza**: o componente passa
`--accent-base` do próprio tema em inline style (o equivalente às regras `#cat`,
`#ladybug`, … do site), então cada bolinha usa o acento do seu tema e a
rampa/tom de fundo são calculados localmente.

## Props

| Prop            | Padrão    | O que faz                                          |
| --------------- | --------- | -------------------------------------------------- |
| `themes`        | `THEMES`  | lista `{ id, name, accent }`                        |
| `selectedTheme` | —         | id do tema com o anel (`is-selected`); comanda a rotação |
| `onSelect`      | —         | recebe o objeto do tema clicado/confirmado          |
| `label`         | `"Temas"` | texto acessível do `role="listbox"`                 |

## Comportamento

- **Arrastar** gira a roda: 60 px = um item, com inércia (`e^(-0.0013·dt)`) e encaixe
  no múltiplo exato do ângulo.
- **Arrastar não escolhe** tema — só posiciona (igual ao site original). Quem escolhe
  é o clique, o `Enter`/`Espaço`.
- **Scroll** do mouse sobre a roda gira um item e não rola a página.
- **Teclado**: `←`/`→`, `PageUp`/`PageDown`, `Home`, `End`, `Enter`/`Espaço`.
- A rotação sempre pega o **caminho mais curto** (±180°).

## Detalhes

- Medidas saem da largura do container: raio `clamp(w × .38, 110, 160)`, item
  `clamp(w × .24, 60, 88)`, altura `clamp(raio × 1.45, 140, 240)`.
- Só `transform` e `opacity` animam. Transicionar cor pintada com `var()` de tema
  trava a repintura no Chromium — por isso a troca de cor é instantânea.
- Os ícones são desenhos próprios em SVG (`viewBox="0 0 48 48"`, `currentColor`),
  não as artes oficiais do site.
