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
      // Três páginas: o site (index.html), a demo da roda (carrossel/index.html)
      // e a roda de chamadas (chamadas/index.html).
      input: {
        main: page("index.html"),
        carrossel: page("carrossel/index.html"),
        chamadas: page("chamadas/index.html"),
      },
    },
  },
});
