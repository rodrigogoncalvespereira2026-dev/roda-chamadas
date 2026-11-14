/*
  Compila o APK de release e deixa-o em apk/roda-chamadas.apk.

  Existe porque `./gradlew` só funciona no bash: no Windows o comando certo é
  `gradlew.bat`. Assim o mesmo script serve nos dois ambientes.
*/

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
// escreve apk/versao.json (versão publicada e novidades) antes de compilar
import "./versao.mjs";

const windows = process.platform === "win32";
const pasta = resolve("android");
const gradlew = resolve(pasta, windows ? "gradlew.bat" : "gradlew");

const build = spawnSync(gradlew, ["assembleRelease", "--console=plain"], {
  cwd: pasta,
  stdio: "inherit",
  shell: windows,
});

if (build.status !== 0) process.exit(build.status ?? 1);

mkdirSync("apk", { recursive: true });
copyFileSync("android/app/build/outputs/apk/release/app-release.apk", "apk/roda-chamadas.apk");

console.log("APK atualizado em apk/roda-chamadas.apk");
