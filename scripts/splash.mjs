/*
  Desenha o ecrã de abertura da app: a roda dos vinte heróis, em grande, sobre
  o fundo escuro. Gera assets/splash.png (2732x2732), que o @capacitor/assets
  depois recorta nas densidades todas do Android.

  Uso: node scripts/splash.mjs
*/

import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SIZE = 2732;
const CENTRO = SIZE / 2;
const RAIO = 800;
const BOLINHA = 92;

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

const pontos = CORES.map((cor, indice) => {
  const angulo = (indice / CORES.length) * Math.PI * 2 - Math.PI / 2;
  const x = CENTRO + Math.cos(angulo) * RAIO;
  const y = CENTRO + Math.sin(angulo) * RAIO;

  return `
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${BOLINHA + 26}" fill="${cor}" opacity="0.16" />
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${BOLINHA}" fill="${cor}" opacity="0.92" />`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
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
  <circle cx="${CENTRO}" cy="${CENTRO}" r="${RAIO + 220}" fill="url(#brilho)" />

  <!-- aro da roda -->
  <circle cx="${CENTRO}" cy="${CENTRO}" r="${RAIO}" fill="none" stroke="#22c55e" stroke-opacity="0.22" stroke-width="8" />
  <circle cx="${CENTRO}" cy="${CENTRO}" r="300" fill="none" stroke="#22c55e" stroke-opacity="0.18" stroke-width="6" />

  ${pontos}

  <!-- centro: a marca da roda -->
  <circle cx="${CENTRO}" cy="${CENTRO}" r="190" fill="#0a1710" stroke="#22c55e" stroke-opacity="0.5" stroke-width="6" />
  <circle cx="${CENTRO}" cy="${CENTRO - 40}" r="52" fill="#22c55e" opacity="0.9" />
  <circle cx="${CENTRO - 62}" cy="${CENTRO - 96}" r="34" fill="#22c55e" opacity="0.75" />
  <circle cx="${CENTRO + 62}" cy="${CENTRO - 96}" r="34" fill="#22c55e" opacity="0.75" />
  <ellipse cx="${CENTRO}" cy="${CENTRO + 66}" rx="96" ry="74" fill="#22c55e" opacity="0.85" />
</svg>`;

await mkdir("assets", { recursive: true });

await sharp(Buffer.from(svg)).png().toFile("assets/splash.png");

console.log("assets/splash.png gerado");
