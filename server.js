/*
  Servidor do Roda de Chamadas.

  Duas funções no mesmo processo:
    1. servir o dist/ (é o que o Render executa como Web Service);
    2. manter o WebSocket de /ws — quem está online, quem está a tocar, quem
       está em chamada — e fazer a sinalização do WebRTC (SDP e ICE).

  O servidor não vê nem guarda áudio, vídeo ou localização: a mídia vai ponto
  a ponto, e a posição só atravessa no convite, quando quem liga autoriza.

  Contas são simples: nome + herói, guardados em data/users.json. Não há senha
  nem token — é um comunicador de time, como um walkie-talkie fechado.
*/

import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { THEMES } from "./carrossel/themes.js";

const ROOT = resolve(process.cwd(), "dist");
const PORT = Number(process.env.PORT) || 10000;
const DATA_DIR = resolve(process.env.DATA_DIR || join(process.cwd(), "data"));
const USERS_FILE = join(DATA_DIR, "users.json");

/** Heróis válidos como avatar — os mesmos da roda. */
const HEROES = new Map(THEMES.map((theme) => [theme.id, theme]));

/** 2 a 20 caracteres: letras, números, espaço, ponto, hífen, sublinhado. */
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u;

/** Quem cabe numa chamada (quem liga + 5). */
const MAX_ROOM = 6;
const MAX_MESSAGE = 500;

/** STUN público: descobre o endereço de fora para o WebRTC furar o NAT. */
const ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/* ---------- contas ---------- */

/** key normalizada → { key, name, hero, hidden:Set<key>, ws, inbox } */
const users = new Map();

const keyOf = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

async function loadUsers() {
  try {
    const raw = JSON.parse(await readFile(USERS_FILE, "utf8"));
    for (const item of raw.users ?? []) {
      if (!NAME_RE.test(item.name ?? "") || !HEROES.has(item.hero)) continue;
      const key = keyOf(item.name);
      users.set(key, {
        key,
        name: item.name,
        hero: item.hero,
        hidden: new Set(item.hidden ?? []),
        ws: null,
        inbox: [],
      });
    }
    console.log(`${users.size} conta(s) carregada(s)`);
  } catch {
    /* primeira execução: sem arquivo, sem contas */
  }
}

let saveTimer = null;

/** Grava as contas em disco (debounce: chamadas seguidas viram uma escrita). */
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const list = [...users.values()].map(({ name, hero, hidden }) => ({
      name,
      hero,
      hidden: [...hidden],
    }));

    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(USERS_FILE, JSON.stringify({ users: list }, null, 2));
    } catch (error) {
      console.error("não consegui salvar as contas:", error.message);
    }
  }, 200);
}

/* ---------- presença ---------- */

/** callId → { id, from, kind, place, invited:Set, accepted:Set, createdAt } */
const calls = new Map();

/** O estado sai das chamadas: nada de contador desencontrado. */
function statusOf(user) {
  if (!user?.ws) return "offline";

  let status = "available";

  for (const call of calls.values()) {
    // quem ligou fica "a tocar" (rosa) até alguém atender; depois, "em chamada"
    if (call.accepted.has(user.key)) return "busy";
    if (call.from === user.key) {
      if (!call.accepted.size) status = "ringing";
      else return "busy";
    } else if (call.invited.has(user.key)) {
      status = "ringing";
    }
  }

  return status;
}

function personOf(user) {
  return { name: user.name, hero: user.hero, status: statusOf(user) };
}

/** O que cada pessoa vê: ela mesma + todas as outras, com o contato marcado. */
function viewFor(user) {
  const people = [...users.values()]
    .filter((other) => other.key !== user.key)
    .map((other) => ({
      ...personOf(other),
      contact: !user.hidden.has(other.key),
    }));

  people.sort((a, b) => {
    if (a.contact !== b.contact) return a.contact ? -1 : 1;
    if (a.status !== b.status) return a.status === "offline" ? 1 : -1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return { you: personOf(user), people };
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sendTo(key, payload) {
  send(users.get(key)?.ws, payload);
}

function broadcastPresence() {
  for (const user of users.values()) {
    if (user.ws) send(user.ws, { t: "people", ...viewFor(user) });
  }
}

function fail(ws, message) {
  send(ws, { t: "error", message });
}

/* ---------- chamadas ---------- */

function membersOf(call) {
  return [call.from, ...call.accepted].map((key) => {
    const user = users.get(key);
    return user ? personOf(user) : { name: key, hero: "cat", status: "offline" };
  });
}

function safePlace(place) {
  if (!place || typeof place !== "object") return null;

  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const accuracy = Number(place.accuracy);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    at: Date.now(),
  };
}

function inCall(call, key) {
  return call.from === key || call.accepted.has(key);
}

/** Encerra a chamada e avisa todo mundo que estava nela ou a tocar. */
function dropCall(call, reason, by) {
  calls.delete(call.id);

  const members = membersOf(call);
  const everyone = new Set([call.from, ...call.accepted, ...call.invited]);

  for (const key of everyone) {
    sendTo(key, { t: "call-ended", callId: call.id, reason, by: by ?? null, members });
  }

  broadcastPresence();
}

/* ---------- HTTP: estáticos ---------- */

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
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, contas: users.size, chamadas: calls.size }));
    return;
  }

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

/* ---------- WebSocket: presença, sinalização e recados ---------- */

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (!message || typeof message.t !== "string") return;

    const user = users.get(ws.userKey);

    /* O primeiro recado é sempre o "join": sem conta, nada anda. */
    if (message.t === "join") {
      const name = String(message.name ?? "").trim().replace(/\s+/g, " ");
      if (!NAME_RE.test(name)) {
        fail(ws, "Use de 2 a 20 letras ou números no nome.");
        return;
      }
      if (!HEROES.has(message.hero)) {
        fail(ws, "Escolha um herói da roda.");
        return;
      }

      let account = users.get(keyOf(name));

      // Mesma aba recarregando = mesma sessão (troca silenciosa). Aba/aparelho
      // diferente assumindo a conta = a antiga é avisada e sai.
      if (account?.ws && account.ws !== ws) {
        if (account.tab && account.tab !== message.tab) {
          send(account.ws, { t: "kicked", message: "Você entrou em outra aba ou aparelho." });
        }
        try {
          account.ws.close(4001, "replaced");
        } catch {
          /* já fechado */
        }
      }

      if (!account) {
        account = {
          key: keyOf(name),
          name,
          hero: message.hero,
          hidden: new Set(),
          ws: null,
          tab: null,
          inbox: [],
        };
        users.set(account.key, account);
      }

      account.ws = ws;
      account.name = name;
      account.hero = message.hero;
      account.tab = typeof message.tab === "string" ? message.tab.slice(0, 40) : null;
      ws.userKey = account.key;
      console.log(`${account.name} entrou (aba ${account.tab ?? "?"})`);

      send(ws, {
        t: "welcome",
        ...viewFor(account),
        iceServers: ICE,
        limits: { room: MAX_ROOM, message: MAX_MESSAGE },
        now: Date.now(),
      });

      // recados que chegaram enquanto a pessoa estava fora
      for (const item of account.inbox) send(ws, { t: "message", ...item });
      account.inbox = [];

      broadcastPresence();
      persist();
      return;
    }

    if (!user) return;

    switch (message.t) {
      case "ping":
        send(ws, { t: "pong", now: Date.now() });
        return;

      case "contact": {
        const key = keyOf(message.name);
        const other = users.get(key);
        if (!other || other.key === user.key) return;

        if (message.contact === false) user.hidden.add(key);
        else user.hidden.delete(key);
        console.log(
          `${user.name} ${message.contact === false ? "tirou" : "pôs"} ${other.name} na roda`
        );

        persist();
        broadcastPresence();
        return;
      }

      case "message": {
        const text = String(message.text ?? "").trim().slice(0, MAX_MESSAGE);
        const target = users.get(keyOf(message.to));

        if (!text || !target || target.key === user.key) return;

        const at = Date.now();
        const from = personOf(user);

        send(ws, { t: "message-sent", to: target.name, text, at });

        if (target.ws) {
          send(target.ws, { t: "message", from, text, at });
        } else {
          target.inbox.push({ from, text, at });
          target.inbox = target.inbox.slice(-50);
        }
        return;
      }

      case "call": {
        if ([...calls.values()].some((call) => inCall(call, user.key) || call.invited.has(user.key))) {
          fail(ws, "Você já está numa chamada. Encerre para ligar de novo.");
          return;
        }

        const wanted = [...new Set((message.targets ?? []).map(keyOf))]
          .filter((key) => key !== user.key && users.has(key))
          .slice(0, MAX_ROOM - 1);

        if (!wanted.length) {
          fail(ws, "Escolha pelo menos um contato para chamar.");
          return;
        }

        const free = [];
        const skipped = [];

        for (const key of wanted) {
          const other = users.get(key);
          const busy = [...calls.values()].some(
            (call) => inCall(call, key) || call.invited.has(key)
          );

          if (other.ws && !busy) free.push(key);
          else skipped.push({ name: other.name, hero: other.hero, status: statusOf(other) });
        }

        if (!free.length) {
          fail(ws, "Todo mundo que você marcou está offline ou em chamada.");
          return;
        }

        const call = {
          id: randomUUID(),
          from: user.key,
          kind: message.kind === "voice" ? "voice" : "video",
          place: safePlace(message.place),
          invited: new Set(free),
          accepted: new Set(),
          createdAt: Date.now(),
        };

        calls.set(call.id, call);

        send(ws, {
          t: "calling",
          callId: call.id,
          kind: call.kind,
          place: call.place,
          members: membersOf(call),
          targets: free.map((key) => personOf(users.get(key))),
          skipped,
        });

        for (const key of free) {
          sendTo(key, {
            t: "incoming",
            callId: call.id,
            from: personOf(user),
            kind: call.kind,
            place: call.place,
            members: membersOf(call),
          });
        }

        broadcastPresence();
        return;
      }

      case "accept": {
        const call = calls.get(message.callId);
        if (!call || !call.invited.has(user.key)) return;

        call.invited.delete(user.key);
        call.accepted.add(user.key);

        const roster = {
          t: "roster",
          callId: call.id,
          kind: call.kind,
          members: membersOf(call),
        };

        for (const key of [call.from, ...call.accepted]) sendTo(key, roster);

        send(ws, {
          t: "call-joined",
          callId: call.id,
          from: personOf(users.get(call.from)),
          kind: call.kind,
          place: call.place,
          members: membersOf(call),
        });

        broadcastPresence();
        return;
      }

      case "reject": {
        const call = calls.get(message.callId);
        if (!call || !call.invited.has(user.key)) return;

        call.invited.delete(user.key);

        sendTo(call.from, {
          t: "peer-rejected",
          callId: call.id,
          by: personOf(user),
          members: membersOf(call),
        });

        if (!call.accepted.size && !call.invited.size) {
          dropCall(call, "no-answer", null);
        } else {
          broadcastPresence();
        }
        return;
      }

      case "end": {
        const call = calls.get(message.callId);
        if (!call || (!inCall(call, user.key) && !call.invited.has(user.key))) return;

        dropCall(call, "ended", personOf(user));
        return;
      }

      case "signal": {
        const call = calls.get(message.callId);
        const to = keyOf(message.to);

        if (!call || !inCall(call, user.key) || !inCall(call, to)) return;

        sendTo(to, {
          t: "signal",
          callId: call.id,
          from: personOf(user),
          data: message.data,
        });
        return;
      }

      default:
        return;
    }
  });

  ws.on("close", () => {
    const user = users.get(ws.userKey);
    if (!user || user.ws !== ws) return;

    user.ws = null;

    for (const call of [...calls.values()]) {
      if (inCall(call, user.key) || call.invited.has(user.key)) {
        dropCall(call, "left", personOf(user));
      }
    }

    broadcastPresence();
    console.log(`${user.name} saiu`);
  });

  ws.on("error", () => {
    /* o close logo abaixo limpa o estado */
  });
});

/** Fecha conexões mortas (celular que perdeu a rede sem avisar). */
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

await loadUsers();

server.listen(PORT, () => {
  console.log(`Roda de Chamadas em http://localhost:${PORT} (WebSocket em /ws)`);
});
