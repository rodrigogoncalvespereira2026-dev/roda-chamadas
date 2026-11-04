import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
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
