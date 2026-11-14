/*
  Desenha a cara da app: o ícone (adaptativo e normal) e o ecrã de abertura.

  A ideia é a mesma nos dois: a roda dos vinte heróis, cada círculo na cor do
  seu tema, e ao centro o símbolo de chamada. O ícone adaptativo do Android
  recorta o desenho num formato qualquer, por isso tudo o que é importante fica
  dentro dos 66% centrais.

  Uso: node scripts/icones.mjs
*/

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

/** As cores de destaque dos heróis, na ordem da roda. */
const CORES = [
  "#22c55e", // cat
  "#e8453c", // ladybug
  "#e8a33d", // fox
  "#4fd6b0", // snake
  "#f5e03c", // bee
  "#a855f7", // butterfly
  "#6366f1", // peacock
  "#d97706", // dog
  "#60a5fa", // bunny
  "#f97316", // rooster
  "#f472b6", // pig
  "#f8fafc", // goat
  "#3b82f6", // ox
  "#34d399", // turtle
  "#ef4444", // dragon
  "#fb923c", // tiger
  "#a16207", // horse
  "#8b5cf6", // monkey
  "#94a3b8", // mouse
  "#84cc16", // uncanny
];

/** Símbolo de chamada (path do Material Icons "call"), num quadrado 24x24. */
const FONE =
  "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 " +
  "1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 " +
  "0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";

/**
 * A roda: aro, vinte bolinhas e o disco central com o fone.
 * Tudo em pixels de um desenho de 1024 (o splash usa os mesmos números, em
 * grande, para o desenho ser o mesmo nos dois sítios).
 */
function roda({ centro, raio, bolinha, disco, fone }) {
  const pontos = CORES.map((cor, indice) => {
    const angulo = (indice / CORES.length) * Math.PI * 2 - Math.PI / 2;
    const x = centro + Math.cos(angulo) * raio;
    const y = centro + Math.sin(angulo) * raio;

    return `
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(bolinha * 1.5).toFixed(1)}" fill="${cor}" opacity="0.16" />
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${bolinha}" fill="${cor}" />`;
  }).join("");

  const ladoFone = disco * 1.05;
  const deslocamento = centro - ladoFone / 2;

  return `
  <circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="#22c55e" stroke-opacity="0.28" stroke-width="${(raio * 0.012).toFixed(1)}" />
  ${pontos}
  <circle cx="${centro}" cy="${centro}" r="${disco}" fill="#22c55e" />
  <circle cx="${centro}" cy="${centro}" r="${disco}" fill="#ffffff" opacity="0.06" />
  <g transform="translate(${deslocamento} ${deslocamento}) scale(${(ladoFone / 24).toFixed(3)})">
    <path d="${FONE}" fill="#04120a" />
  </g>`;
}

function svgIcone() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${roda({ centro: 512, raio: 262, bolinha: 39, disco: 150, fone: true })}
  </svg>`;
}

function svgFundo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <radialGradient id="f" cx="50%" cy="42%" r="70%">
        <stop offset="0%" stop-color="#0d2317" />
        <stop offset="55%" stop-color="#07130c" />
        <stop offset="100%" stop-color="#050b07" />
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#f)" />
  </svg>`;
}

function svgSplash() {
  const SIZE = 2732;
  const centro = SIZE / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="fundo" cx="50%" cy="50%" r="62%">
        <stop offset="0%" stop-color="#0b1a12" />
        <stop offset="60%" stop-color="#06100b" />
        <stop offset="100%" stop-color="#050b07" />
      </radialGradient>
      <radialGradient id="brilho" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#22c55e" stop-opacity="0.22" />
        <stop offset="70%" stop-color="#22c55e" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#22c55e" stop-opacity="0" />
      </radialGradient>
    </defs>

    <rect width="${SIZE}" height="${SIZE}" fill="url(#fundo)" />
    <circle cx="${centro}" cy="${centro}" r="${1900}" fill="url(#brilho)" />
    ${roda({ centro, raio: 760, bolinha: 84, disco: 300, fone: true })}
  </svg>`;
}

await mkdir("assets", { recursive: true });

const icone = sharp(Buffer.from(svgIcone())).png();
const fundo = sharp(Buffer.from(svgFundo())).png();

await icone.clone().toFile("assets/icon-foreground.png");
await fundo.clone().toFile("assets/icon-background.png");

// versão "chapada": fundo + roda, para ícones antigos e para o favicon
await sharp(Buffer.from(svgFundo()))
  .composite([{ input: Buffer.from(svgIcone()) }])
  .png()
  .toFile("assets/icon-only.png");

await sharp(Buffer.from(svgSplash())).png().toFile("assets/splash.png");

/* ---------- site / PWA (é o que o iPhone usa ao pôr no ecrã principal) ---------- */

function svgFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="24" fill="#050b07" />
    ${roda({ centro: 64, raio: 42, bolinha: 6.4, disco: 24, fone: true })}
  </svg>`;
}

await mkdir("public/icons", { recursive: true });

const chapado = sharp("assets/icon-only.png");
await chapado.clone().resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await chapado.clone().resize(192, 192).png().toFile("public/icons/icon-192.png");
await chapado.clone().resize(512, 512).png().toFile("public/icons/icon-512.png");
await chapado.clone().resize(512, 512).png().toFile("public/icons/maskable-512.png");
await writeFile("public/favicon.svg", svgFavicon());

console.log("ícones, ecrã de abertura e favicon gerados");
