/*
  Servidor estático do dist/ — usado quando o site roda como Web Service
  (Render, por exemplo). Sem dependências: só node:http e fs.

  Resolve "/" e "/chamadas/" para o index.html de cada pasta, então as três
  páginas do build funcionam direto por URL.
*/

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd(), "dist");
const PORT = Number(process.env.PORT) || 10000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const NOT_FOUND = `<!doctype html>
<meta charset="utf-8" />
<title>404</title>
<p style="font-family: system-ui; padding: 2rem; color: #eee; background: #0f0f0f">
  Página não encontrada. <a style="color: #22c55e" href="/">Voltar ao início</a>
</p>`;

/** Caminho do arquivo que responde por `pathname`, ou null. */
async function resolveFile(pathname) {
  let clean;
  try {
    clean = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const target = resolve(join(ROOT, clean));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;

  const candidates = clean.endsWith("/")
    ? [join(target, "index.html")]
    : [target, `${target}.html`, join(target, "index.html")];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* tenta o próximo */
    }
  }

  return null;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const filePath = await resolveFile(url.pathname);

  if (!filePath) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(NOT_FOUND);
    return;
  }

  const body = await readFile(filePath);
  const extension = extname(filePath).toLowerCase();
  const isPage = extension === ".html";

  res.writeHead(200, {
    "content-type": TYPES[extension] ?? "application/octet-stream",
    "content-length": body.length,
    // o service worker precisa ser revalidado para pegar versões novas
    "cache-control": isPage || filePath.endsWith("sw.js") ? "no-cache" : "public, max-age=3600",
  });
  res.end(req.method === "HEAD" ? undefined : body);
});

server.listen(PORT, () => {
  console.log(`Servindo dist/ em http://localhost:${PORT}`);
});
