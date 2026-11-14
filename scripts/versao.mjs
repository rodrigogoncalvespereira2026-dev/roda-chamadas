/*
  Escreve apk/versao.json: a versão publicada e o que mudou nela.

  A versão vem do build.gradle — a mesma que o instalador mostra — e as
  novidades vêm de apk/novidades.json, escrito à mão e indexado pelo
  versionCode. É este ficheiro que o servidor entrega em /versao.

  Importar este módulo já escreve o ficheiro: o build do APK faz isso antes de
  compilar. Também serve sozinho (`node scripts/versao.mjs`) para atualizar a
  versão publicada sem recompilar nada.
*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const gradle = readFileSync("android/app/build.gradle", "utf8");
const versao = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0.0";
const codigo = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]) || 0;

/** As novidades desta versão, se estiverem escritas. */
function novidadesDe(codigo) {
  try {
    const todas = JSON.parse(readFileSync("apk/novidades.json", "utf8"));
    const lista = todas?.[String(codigo)];

    return Array.isArray(lista) ? lista.map(String).filter(Boolean).slice(0, 5) : [];
  } catch {
    /* sem ficheiro de novidades a faixa mostra só o número da versão */
    return [];
  }
}

const novidades = novidadesDe(codigo);

mkdirSync("apk", { recursive: true });
writeFileSync("apk/versao.json", `${JSON.stringify({ versao, codigo, novidades }, null, 2)}\n`);

console.log(`versão publicada: ${versao} (${codigo}), ${novidades.length} novidade(s)`);
