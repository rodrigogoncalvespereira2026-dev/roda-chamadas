/*
  Compila o APK de release e deixa-o em apk/roda-chamadas.apk.

  Existe porque `./gradlew` só funciona no bash: no Windows o comando certo é
  `gradlew.bat`. Assim o mesmo script serve nos dois ambientes.
*/

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

// a versão publicada, para a app que já está instalada saber que há outra
const gradle = readFileSync("android/app/build.gradle", "utf8");
const versao = {
  versao: gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0.0",
  codigo: Number(gradle.match(/versionCode\s+(\d+)/)?.[1]) || 0,
};

writeFileSync("apk/versao.json", `${JSON.stringify(versao)}\n`);
console.log(`versão publicada: ${versao.versao} (${versao.codigo})`);

console.log("APK atualizado em apk/roda-chamadas.apk");
