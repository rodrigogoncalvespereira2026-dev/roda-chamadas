/*
  Desenha o símbolo de cada herói como imagem de notificação.

  O aviso de chamada no Android aceita uma imagem grande (largeIcon), mas só por
  nome de recurso — não aceita SVG nem URL. Por isso o símbolo de cada herói é
  redesenhado aqui, uma vez, para um PNG dentro de android/.../res/drawable.

  Cada imagem é o disco na cor do herói com o símbolo escuro por cima: no aviso
  do telemóvel aparece redondo, com a cara do herói que está a ligar.

  Uso: node scripts/avatares.mjs
*/

import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* As cores dos heróis em hex, na mesma ordem de carrossel/themes.js. */
const CORES = {
  cat: "#22c55e",
  ladybug: "#e8453c",
  fox: "#e8a33d",
  snake: "#4fd6b0",
  bee: "#f5e03c",
  butterfly: "#a855f7",
  peacock: "#6366f1",
  dog: "#d97706",
  bunny: "#60a5fa",
  rooster: "#f97316",
  pig: "#f472b6",
  goat: "#f8fafc",
  ox: "#3b82f6",
  turtle: "#34d399",
  dragon: "#ef4444",
  tiger: "#fb923c",
  horse: "#a16207",
  monkey: "#8b5cf6",
  mouse: "#94a3b8",
  uncanny: "#84cc16",
};

const DESTINO = "android/app/src/main/res/drawable";
const TINTA = "#08120b";
const LADO = 256;

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

/** Tira o <svg> de fora e pinta o símbolo com a tinta do disco. */
function desenho(markup) {
  const dentro = markup.slice(markup.indexOf(">") + 1, markup.lastIndexOf("</svg>"));

  return dentro.replaceAll("currentColor", TINTA);
}

const Icone = await carregarIcone();
await mkdir(DESTINO, { recursive: true });

for (const [heroi, cor] of Object.entries(CORES)) {
  const dentro = desenho(renderToStaticMarkup(React.createElement(Icone, { id: heroi })));
  const escala = 0.62;
  const desvio = (LADO - LADO * escala) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="128" fill="${cor}" />
  <g transform="translate(${desvio} ${desvio}) scale(${escala})">${dentro}</g>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`${DESTINO}/heroi_${heroi}.png`, png);

  console.log(`heroi_${heroi}.png · ${(png.length / 1024).toFixed(1)} kB`);
}

await rm(".tmp", { recursive: true, force: true });
console.log(`${Object.keys(CORES).length} símbolos em ${DESTINO}`);
