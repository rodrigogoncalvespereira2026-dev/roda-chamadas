import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

/**
 * Versão do APK, lida do build.gradle: é a mesma que o instalador mostra e a
 * que fica gravada no bundle, para a app saber que versão está a correr.
 */
function versaoDoApk() {
  try {
    const gradle = readFileSync(new URL("./android/app/build.gradle", import.meta.url), "utf8");

    return {
      nome: gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0.0",
      codigo: Number(gradle.match(/versionCode\s+(\d+)/)?.[1]) || 0,
    };
  } catch {
    return { nome: "0.0", codigo: 0 };
  }
}

const versao = versaoDoApk();

export default defineConfig({
  plugins: [react()],
  define: {
    __VERSAO_APP__: JSON.stringify(versao.nome),
    __CODIGO_APP__: JSON.stringify(versao.codigo),
  },
  server: {
    port: 5173,
    strictPort: true,
    // no dev o Node da sinalização roda à parte (npm start com PORT=3001);
    // o Vite empresta o mesmo endereço /ws para o navegador.
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  build: {
    /* WebView antigo de Android não entende sintaxe de 2020: `?.` e `??`
       davam erro de sintaxe e a app abria em branco. Baixar o alvo custa
       alguns bytes e garante que o bundle é lido. */
    target: "es2017",
    rollupOptions: {
      // Duas páginas: a roda de chamadas na raiz (index.html) e o perfil do
      // site (perfil.html), que fica fora do caminho da app.
      input: {
        main: page("index.html"),
        perfil: page("perfil.html"),
      },
    },
  },
});
