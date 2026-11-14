import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
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
