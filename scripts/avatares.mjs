/*
  Desenha o símbolo de cada herói como imagem de notificação.

  O aviso de chamada no Android aceita uma imagem grande (largeIcon), mas só por
  nome de recurso — não aceita SVG nem URL. Por isso o símbolo de cada herói é
  redesenhado aqui, uma vez, para um PNG dentro de android/.../res/drawable.

  O desenho é o mesmo círculo que se vê na roda: disco escuro tingido com a cor
  do herói, aro nessa cor e o símbolo claro por cima, com halo. Antes era o
  contrário (disco cheio de cor com o símbolo escuro) e quem recebia a chamada
  via um símbolo diferente do que estava na roda.

  As cores vêm de carrossel/themes.js — o acento de cada tema em oklch — para o
  aviso e a roda nunca divergirem.

  Uso: node scripts/avatares.mjs
*/

import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { THEMES } from "../carrossel/themes.js";

const DESTINO = "android/app/src/main/res/drawable";
const LADO = 256;

/* O fundo por trás do disco: o mesmo quase-preto da página da app. */
const FUNDO = [11, 11, 11];

/**
 * Acento do tema (`oklch(87% 0.3 143)`) em peças soltas.
 * L fica entre 0 e 1, como no CSS.
 */
function lerAcento(texto) {
  const encontrado = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/i.exec(texto ?? "");
  if (!encontrado) return { l: 0.75, c: 0, h: 0 };

  return {
    l: Number(encontrado[1]) / 100,
    c: Number(encontrado[2]),
    h: Number(encontrado[3]),
  };
}

/** Mistura com branco, como o `color-mix(in oklch, cor X%, white)`. */
const clarear = ({ l, c, h }, quanto) => ({
  l: l * quanto + (1 - quanto),
  c: c * quanto,
  h,
});

/** OKLCH → sRGB, a mesma conta do navegador. */
function paraRgb({ l: L, c: C, h: H }) {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const canais = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return canais.map((canal) => {
    const preso = Math.min(1, Math.max(0, canal));
    const srgb = preso <= 0.0031308 ? 12.92 * preso : 1.055 * preso ** (1 / 2.4) - 0.055;

    return Math.round(srgb * 255);
  });
}

/** O acento por cima de um fundo escuro, como o véu translúcido da roda. */
const sobreOFundo = (cor, quanto) => {
  const [r, g, b] = paraRgb(cor);

  return [r, g, b].map((canal, i) => Math.round(canal * quanto + FUNDO[i] * (1 - quanto)));
};

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

/* O ThemeIcon é JSX: passa pelo esbuild para poder ser desenhado aqui. */
async function carregarIcone() {
  await mkdir(".tmp", { recursive: true });

  const resultado = await build({
    stdin: {
      contents: 'export { default as Icone } from "./carrossel/ThemeIcon.jsx";',
      resolveDir: process.cwd(),
      loader: "jsx",
    },
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "node",
    external: ["react", "react/jsx-runtime", "react-dom"],
    outfile: ".tmp/themeicon.mjs",
  });

  if (resultado.errors?.length) throw new Error(resultado.errors[0].text);

  const modulo = await import(pathToFileURL(`${process.cwd()}/.tmp/themeicon.mjs`).href);
  return modulo.Icone;
}

/** Tira o <svg> de fora e pinta o símbolo com a tinta pedida. */
function desenho(markup, tinta) {
  const dentro = markup.slice(markup.indexOf(">") + 1, markup.lastIndexOf("</svg>"));

  return dentro.replaceAll("currentColor", tinta);
}

const Icone = await carregarIcone();
await mkdir(DESTINO, { recursive: true });

for (const tema of THEMES) {
  const acento = lerAcento(tema.accent);
  const disco = rgb(sobreOFundo(acento, 0.3)); // igual ao fundo do círculo ativo
  const aro = rgb(paraRgb(clarear(acento, 0.8))); // --accent80
  const tinta = rgb(paraRgb(clarear(acento, 0.55))); // --wheel-icon

  const dentro = desenho(renderToStaticMarkup(React.createElement(Icone, { id: tema.id })), tinta);
  const escala = 0.62;
  const desvio = (LADO - LADO * escala) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="brilho" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${tinta}" stop-opacity="0.32" />
      <stop offset="70%" stop-color="${tinta}" stop-opacity="0.06" />
      <stop offset="100%" stop-color="${tinta}" stop-opacity="0" />
    </radialGradient>
    <filter id="halo" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" />
    </filter>
  </defs>

  <circle cx="128" cy="128" r="125" fill="${disco}" />
  <circle cx="128" cy="128" r="125" fill="none" stroke="${aro}" stroke-width="5" stroke-opacity="0.85" />
  <circle cx="128" cy="128" r="96" fill="url(#brilho)" />

  <g transform="translate(${desvio} ${desvio}) scale(${escala})">
    <g fill="${tinta}" filter="url(#halo)" opacity="0.85">${dentro}</g>
    <g fill="${tinta}">${dentro}</g>
  </g>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`${DESTINO}/heroi_${tema.id}.png`, png);

  console.log(`heroi_${tema.id}.png · ${(png.length / 1024).toFixed(1)} kB`);
}

await rm(".tmp", { recursive: true, force: true });
console.log(`${THEMES.length} símbolos em ${DESTINO}`);
