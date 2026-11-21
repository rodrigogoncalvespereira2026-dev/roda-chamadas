/*
  Servidor do Roda de Chamadas.

  Duas funções no mesmo processo:
    1. entregar o instalador da app em /app.apk — o site não existe, nada da
       roda abre num navegador;
    2. manter o WebSocket de /ws — quais heróis estão disponíveis, a tocar, em
       chamada ou offline — e fazer a sinalização do WebRTC (SDP e ICE).

  A identidade é o herói da roda: quem abre o site escolhe um e fica com ele.
  Não há nome de pessoa, senha nem lista de contatos guardada — a roda é
  sempre a mesma, com os vinte heróis, e a cor de cada um diz quem está por
  trás naquele momento.

  O servidor não vê nem guarda áudio, vídeo ou localização: a mídia vai ponto
  a ponto, e a posição só atravessa no convite, quando quem liga autoriza.
*/

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { THEMES } from "./carrossel/themes.js";
import {
  abrirChamada,
  atenderChamada,
  fecharChamada,
  guardarMensagem,
  ligar,
  marcarEntregue,
  marcarEntregues,
  mensagensPendentes,
  temBase,
} from "./db.js";
import {
  avisar,
  guardarToken,
  heroesComToken,
  ligarPush,
  temPush,
  temToken,
  totalTokens,
  ultimosAvisos,
} from "./push.js";

const PORT = Number(process.env.PORT) || 10000;

/** Os vinte heróis, por id. */
const HEROES = new Map(THEMES.map((theme) => [theme.id, theme]));

/** Quem cabe numa chamada (quem liga + 15). */
const MAX_ROOM = 16;
const MAX_MESSAGE = 500;

/** STUN público: descobre o endereço de fora para o WebRTC furar o NAT. */
const ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/* ---------- presença ---------- */

/** hero id → { hero, ws, tab, inbox } — só existe para quem já entrou alguma vez. */
const users = new Map();

/** callId → { id, from, kind, place, invited:Set, accepted:Set, createdAt } */
const calls = new Map();

/** O estado sai das chamadas: nada de contador desencontrado. */
function statusOf(account) {
  if (!account) return "offline";

  /* Sem app aberta mas com o telemóvel registado, o herói continua alcançável:
     a chamada chega-lhe pelo aviso do sistema. Não é "offline" — é "atende
     pelo telefone". */
  if (!account.ws && !temToken(account.hero)) return "offline";

  let status = "available";

  for (const call of calls.values()) {
    // quem ligou fica "a tocar" (rosa) até alguém atender; depois, "em chamada"
    if (call.accepted.has(account.hero)) return "busy";
    if (call.from === account.hero) {
      if (!call.accepted.size) status = "ringing";
      else return "busy";
    } else if (call.invited.has(account.hero)) {
      status = "ringing";
    }
  }

  return status;
}

function personOf(account) {
  const theme = HEROES.get(account.hero);

  return {
    hero: account.hero,
    name: theme?.name ?? account.hero,
    status: statusOf(account),
  };
}

/*
  Um herói conhecido tem sempre conta: se o servidor reiniciou (e a memória de
  quem entrou se perdeu) mas o telemóvel dele continua registado, ele segue na
  roda como alcançável.
*/
function contaDe(hero) {
  return users.get(hero) ?? { hero, ws: null, tab: null, inbox: [] };
}

function pessoaDe(hero) {
  return personOf(contaDe(hero));
}

/** A roda inteira: todos os heróis, com o estado de quem está por trás. */
function rosterFor(self) {
  const people = [...HEROES.values()]
    .map((theme) => {
      const account = users.get(theme.id);

      return {
        hero: theme.id,
        name: theme.name,
        status: statusOf(account ?? contaDe(theme.id)),
        // a posição que cada herói partilhou (o mapa mostra todos os que têm)
        place: account?.place ?? null,
      };
    });

  people.sort((a, b) => {
    if (a.status !== b.status) return a.status === "offline" ? 1 : -1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return { you: personOf(self), people };
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sendTo(hero, payload) {
  send(users.get(hero)?.ws, payload);
}

function broadcastPresence() {
  for (const account of users.values()) {
    if (account.ws) send(account.ws, { t: "people", ...rosterFor(account) });
  }
}

function fail(ws, message) {
  send(ws, { t: "error", message });
}

/* ---------- chamadas ---------- */

function membersOf(call) {
  return [call.from, ...call.accepted].map((hero) => {
    const account = users.get(hero);
    return account
      ? personOf(account)
      : { hero, name: HEROES.get(hero)?.name ?? hero, status: "offline" };
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

function inCall(call, hero) {
  return call.from === hero || call.accepted.has(hero);
}

/** Encerra a chamada e avisa todo mundo que estava nela ou a tocar. */
function dropCall(call, reason, by) {
  calls.delete(call.id);

  const members = membersOf(call);
  const everyone = new Set([call.from, ...call.accepted, ...call.invited]);

  /* O registo da chamada fecha aqui: quem participou, como acabou e quanto
     durou. Sem base configurada isto não faz nada. */
  fecharChamada({
    id: call.id,
    membros: members.map((member) => member.hero),
    estado: call.accepted.size
      ? "terminada"
      : reason === "no-answer"
        ? "sem-resposta"
        : "cancelada",
    motivo: reason,
    fim: Date.now(),
  });

  for (const hero of everyone) {
    sendTo(hero, { t: "call-ended", callId: call.id, reason, by: by ?? null, members });
  }

  broadcastPresence();
}

/**
 * Recados que ficaram na base por entregar (o processo reiniciou, ou o herói
 * esteve fora mais tempo do que a memória aguenta). Só corre para quem este
 * processo ainda não conhecia, para não repetir o que a memória já entregou.
 */
async function entregarPendentes(ws, hero) {
  const pendentes = await mensagensPendentes(hero);
  if (!pendentes.length) return;

  const entregues = [];

  for (const doc of pendentes) {
    if (ws.readyState !== 1) break;

    const autor = users.get(doc.de);

    send(ws, {
      t: "message",
      from: autor
        ? personOf(autor)
        : { hero: doc.de, name: HEROES.get(doc.de)?.name ?? doc.de, status: "offline" },
      text: doc.texto,
      at: new Date(doc.em).getTime(),
    });

    entregues.push(doc._id);
  }

  await marcarEntregues(entregues);
}

/* ---------- HTTP: só o instalador ---------- */

/**
 * A app não tem site. As páginas viajam dentro do APK e o navegador não
 * encontra a roda em endereço nenhum: o servidor só entrega o instalador, em
 * /app.apk, e responde 404 a tudo o resto. O que a app usa de verdade é o
 * WebSocket de /ws.
 */
const APK = resolve(process.cwd(), "apk/roda-chamadas.apk");
const VERSAO = resolve(process.cwd(), "apk/versao.json");

const GONE = `<!doctype html>
<meta charset="utf-8" />
<title>Roda de Chamadas</title>
<p style="font-family: system-ui; padding: 2rem; color: #eee; background: #0f0f0f">
  A Roda de Chamadas só funciona instalada. Baixe o APK para usar a app.
</p>`;

/**
 * iPhone e iPad não instalam APK. Para eles o site serve a app, que fica no
 * ecrã principal pelo Safari ("Adicionar ao Ecrã Principal"). O resto do mundo
 * continua sem site: só o APK em /app.apk.
 */
const SITE = resolve(process.cwd(), "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  // os fundos de cada herói são WebP: sem este tipo o iPhone recebia-os como
  // octet-stream e o `background-image` não os desenhava
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** iPhone/iPad a pedir a app. */
const ehAppleMovel = (agent) => /iPhone|iPad|iPod/i.test(agent);

/** Caminho do dist que responde por `pathname`, ou null. */
async function arquivoDoSite(pathname) {
  let limpo;
  try {
    limpo = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const alvo = resolve(join(SITE, limpo));
  if (alvo !== SITE && !alvo.startsWith(SITE + sep)) return null;

  const tentativas = limpo.endsWith("/") ? [join(alvo, "index.html")] : [alvo, join(alvo, "index.html")];

  for (const ficheiro of tentativas) {
    try {
      const info = await stat(ficheiro);
      if (info.isFile()) return ficheiro;
    } catch {
      /* tenta o próximo */
    }
  }

  return null;
}

const server = createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        herois: users.size,
        chamadas: calls.size,
        // diagnóstico dos avisos: a chave está ligada? há telemóveis registados?
        push: temPush(),
        tokens: totalTokens(),
        // quem tem telemóvel registado, e o que aconteceu aos últimos avisos
        registados: heroesComToken(),
        avisos: ultimosAvisos(),
      })
    );
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/app.apk") {
    try {
      const info = await stat(APK);
      res.writeHead(200, {
        "content-type": "application/vnd.android.package-archive",
        "content-length": info.size,
        "content-disposition": 'attachment; filename="roda-chamadas.apk"',
        "cache-control": "no-cache",
      });

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      createReadStream(APK).pipe(res);
      return;
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("O APK ainda não foi gerado.");
      return;
    }
  }

  /* Versão do instalador publicado, escrita quando o APK é compilado. */
  if (url.pathname === "/versao") {
    try {
      const dados = await readFile(VERSAO, "utf8");

      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(dados),
        "cache-control": "no-store",
        // o APK chama de outra origem (https://localhost dentro da app)
        "access-control-allow-origin": "*",
      });
      res.end(req.method === "HEAD" ? undefined : dados);
    } catch {
      res.writeHead(204, { "access-control-allow-origin": "*" });
      res.end();
    }
    return;
  }

  if (ehAppleMovel(req.headers["user-agent"] ?? "")) {
    const ficheiro = await arquivoDoSite(url.pathname);

    if (!ficheiro) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(GONE);
      return;
    }

    const corpo = await readFile(ficheiro);

    res.writeHead(200, {
      "content-type": TIPOS[extname(ficheiro).toLowerCase()] ?? "application/octet-stream",
      "content-length": corpo.length,
      "cache-control":
        ficheiro.endsWith(".html") || ficheiro.endsWith("sw.js") ? "no-cache" : "public, max-age=3600",
    });

    res.end(req.method === "HEAD" ? undefined : corpo);
    return;
  }

  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(GONE);
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

    /* O primeiro recado é sempre o "join": escolhe o herói da vez. */
    if (message.t === "join") {
      const hero = String(message.hero ?? "").toLowerCase();

      if (!HEROES.has(hero)) {
        fail(ws, "Escolha um herói da roda.");
        return;
      }

      const account = users.get(hero);

      // Mesma aba recarregando = mesma sessão (troca silenciosa). Aba/aparelho
      // diferente assumindo o herói = a antiga é avisada e sai.
      if (account?.ws && account.ws !== ws) {
        if (account.tab && account.tab !== message.tab) {
          send(account.ws, {
            t: "kicked",
            message: "Este herói entrou em outra aba ou aparelho.",
          });
        }
        try {
          account.ws.close(4001, "replaced");
        } catch {
          /* já fechado */
        }
      }

      const novo = !account;
      const pessoa = account ?? { hero, ws: null, tab: null, inbox: [] };

      pessoa.ws = ws;
      pessoa.tab = typeof message.tab === "string" ? message.tab.slice(0, 40) : null;
      users.set(hero, pessoa);
      ws.userKey = hero;

      if (novo) console.log(`${HEROES.get(hero).name} entrou`);
      else console.log(`${HEROES.get(hero).name} voltou`);

      send(ws, {
        t: "welcome",
        ...rosterFor(pessoa),
        iceServers: ICE,
        limits: { room: MAX_ROOM, message: MAX_MESSAGE },
        now: Date.now(),
      });

      // recados que chegaram enquanto o herói estava fora
      for (const item of pessoa.inbox) {
        send(ws, { t: "message", from: item.from, text: item.text, at: item.at });

        // o recado já está com o dono: marca na base
        Promise.resolve(item.base).then((id) => marcarEntregue(id));
      }
      pessoa.inbox = [];

      // processo reiniciado: o que estava por entregar na base sai agora
      if (novo && temBase) entregarPendentes(ws, hero);

      /* Havia uma chamada a tocar para este herói enquanto a app estava
         fechada? Chegou aqui pelo aviso do telefone — o convite aparece agora. */
      for (const call of calls.values()) {
        if (!call.invited.has(hero)) continue;

        send(ws, {
          t: "incoming",
          callId: call.id,
          from: pessoaDe(call.from),
          kind: call.kind,
          place: call.place,
          members: membersOf(call),
        });
      }

      broadcastPresence();
      return;
    }

    if (!user) return;

    switch (message.t) {
      case "ping":
        send(ws, { t: "pong", now: Date.now() });
        return;

      case "message": {
        const text = String(message.text ?? "").trim().slice(0, MAX_MESSAGE);
        const destino = String(message.to ?? "").toLowerCase();

        if (!text || !HEROES.has(destino) || destino === user.hero) return;

        // herói nunca visto: cria a caixa para entregar quando ele entrar
        const alvo = users.get(destino) ?? { hero: destino, ws: null, tab: null, inbox: [] };
        users.set(destino, alvo);

        const at = Date.now();
        const from = personOf(user);

        send(ws, { t: "message-sent", to: destino, text, at });

        const online = Boolean(alvo.ws);

        // guarda o recado na base (se estiver configurada) logo à partida
        const naBase = guardarMensagem({
          de: user.hero,
          para: destino,
          texto: text,
          em: at,
          entregue: online,
        });

        if (alvo.ws) {
          send(alvo.ws, { t: "message", from, text, at });
        } else {
          // fica à espera na memória, com o id da base para marcar na entrega
          alvo.inbox.push({ from, text, at, base: naBase });
          alvo.inbox = alvo.inbox.slice(-50);

          // app fechada: o aviso vai pelo telefone, não pelo WebSocket
          avisar(destino, {
            titulo: `Recado de ${from.name}`,
            corpo: text.length > 120 ? `${text.slice(0, 117)}…` : text,
            canal: "recados",
            dados: { tipo: "recado", de: user.hero },
          }).catch(() => {});
        }
        return;
      }

      case "push-token": {
        // o APK manda o token do aparelho ao entrar: é por aqui que o aviso
        // chega com a app fechada
        guardarToken(user.hero, message.token);
        return;
      }

      case "place": {
        const lugar = safePlace(message.place);

        if (!lugar) {
          if (!user.place) return;
          user.place = null;
          broadcastPresence();
          return;
        }

        user.place = lugar;
        broadcastPresence();
        return;
      }

      case "call": {
        if ([...calls.values()].some((call) => inCall(call, user.hero) || call.invited.has(user.hero))) {
          fail(ws, "Você já está numa chamada. Encerre para ligar de novo.");
          return;
        }

        const queridos = [...new Set((message.targets ?? []).map((h) => String(h).toLowerCase()))]
          .filter((hero) => hero !== user.hero && HEROES.has(hero))
          .slice(0, MAX_ROOM - 1);

        if (!queridos.length) {
          fail(ws, "Escolha pelo menos um herói para chamar.");
          return;
        }

        const livres = []; // app aberta: toca já, por WebSocket
        const avisados = []; // app fechada, mas o telemóvel toca pelo aviso
        const fora = []; // sem app aberta e sem telemóvel registado

        for (const hero of queridos) {
          const outro = users.get(hero);
          const ocupado = [...calls.values()].some(
            (call) => inCall(call, hero) || call.invited.has(hero)
          );

          if (ocupado) fora.push({ hero, name: HEROES.get(hero).name, status: statusOf(outro) });
          else if (outro?.ws) livres.push(hero);
          else if (temToken(hero)) avisados.push(hero);
          else fora.push({ hero, name: HEROES.get(hero).name, status: "offline" });
        }

        /* Chamados a sério: quem está na app agora e quem tem o telemóvel
           registado. Os dois entram como convidados — a diferença é só por onde
           o convite viaja (WebSocket ou aviso do sistema). */
        const chamados = [...livres, ...avisados];

        // o id nasce já aqui: os avisos levam-no, e é ele que dá a cada chamada
        // uma notificação própria no telemóvel (sem ele, a segunda chamada só
        // atualizava a primeira e ficava em silêncio)
        const callId = randomUUID();

        if (!chamados.length) {
          // ninguém alcançável: deixa o aviso em quem tenha telemóvel, para ao
          // menos saber que alguém tentou ligar
          for (const alvo of fora) {
            avisar(alvo.hero, {
              titulo: `Chamada de ${personOf(user).name}`,
              corpo:
                message.kind === "voice"
                  ? "Tentou ligar-te no Roda de Chamadas. Abre a app para atender."
                  : "Videochamada no Roda de Chamadas. Abre a app para atender.",
              dados: { tipo: "chamada", de: user.hero, callId },
              // só dados: o APK acende o ecrã e abre a chamada
              soDados: true,
            }).catch(() => {});
          }

          fail(ws, "Os heróis marcados estão em chamada ou sem a app registada.");
          return;
        }

        // quem está com a app fechada recebe a chamada no telefone, em ecrã inteiro
        for (const hero of avisados) {
          avisar(hero, {
            titulo: `Chamada de ${personOf(user).name}`,
            corpo:
              message.kind === "voice"
                ? "Está a ligar-te agora. Toca para atender."
                : "Videochamada agora. Toca para atender.",
            dados: { tipo: "chamada", de: user.hero, callId },
            soDados: true,
          }).catch(() => {});
        }

        // quem não tem telemóvel registado também fica a saber
        for (const alvo of fora) {
          avisar(alvo.hero, {
            titulo: `Chamada de ${personOf(user).name}`,
            corpo: "Tentou ligar-te no Roda de Chamadas. Abre a app para atender.",
            dados: { tipo: "chamada", de: user.hero, callId },
            soDados: true,
          }).catch(() => {});
        }

        const call = {
          id: callId,
          from: user.hero,
          kind: message.kind === "voice" ? "voice" : "video",
          place: safePlace(message.place),
          invited: new Set(chamados),
          accepted: new Set(),
          createdAt: Date.now(),
        };

        calls.set(call.id, call);

        /*
          Rede de segurança: o aviso de ecrã inteiro pode não chegar (poupança
          de bateria de alguns telemóveis descarta mensagens só de dados). Se em
          8 segundos o herói ainda não estiver na app e a chamada continuar a
          tocar, vai o aviso normal — pelo menos vê quem está a ligar.
        */
        for (const hero of avisados) {
          const avisoDeReserva = setTimeout(() => {
            const ainda = calls.get(call.id);
            if (!ainda || !ainda.invited.has(hero) || users.get(hero)?.ws) return;

            avisar(hero, {
              titulo: `Chamada de ${personOf(user).name}`,
              corpo:
                message.kind === "voice"
                  ? "Está a ligar-te agora. Toca para atender."
                  : "Videochamada agora. Toca para atender.",
              dados: { tipo: "chamada", de: user.hero, callId },
              soDados: false,
            }).catch(() => {});
          }, 8000);

          avisoDeReserva.unref?.();
        }

        abrirChamada({
          id: call.id,
          de: call.from,
          para: livres,
          tipo: call.kind,
          em: call.createdAt,
          lugar: call.place,
        });

        send(ws, {
          t: "calling",
          callId: call.id,
          kind: call.kind,
          place: call.place,
          members: membersOf(call),
          targets: chamados.map(pessoaDe),
          skipped: fora,
        });

        for (const hero of livres) {
          sendTo(hero, {
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
        if (!call || !call.invited.has(user.hero)) return;

        call.invited.delete(user.hero);
        call.accepted.add(user.hero);

        atenderChamada({
          id: call.id,
          membros: membersOf(call).map((member) => member.hero),
        });

        const roster = {
          t: "roster",
          callId: call.id,
          kind: call.kind,
          members: membersOf(call),
        };

        for (const hero of [call.from, ...call.accepted]) sendTo(hero, roster);

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
        if (!call || !call.invited.has(user.hero)) return;

        call.invited.delete(user.hero);

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
        if (!call || (!inCall(call, user.hero) && !call.invited.has(user.hero))) return;

        dropCall(call, "ended", personOf(user));
        return;
      }

      case "signal": {
        const call = calls.get(message.callId);
        const para = String(message.to ?? "").toLowerCase();

        if (!call || !inCall(call, user.hero) || !inCall(call, para)) return;

        sendTo(para, {
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
    // sai do mapa ao sair: posição de quem não está ligado só enganava
    user.place = null;

    for (const call of [...calls.values()]) {
      if (inCall(call, user.hero) || call.invited.has(user.hero)) {
        dropCall(call, "left", personOf(user));
      }
    }

    broadcastPresence();
    console.log(`${HEROES.get(user.hero)?.name ?? user.hero} saiu`);
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

server.listen(PORT, () => {
  console.log(`Roda de Chamadas em http://localhost:${PORT} (WebSocket em /ws)`);

  if (temBase) {
    // aquece a ligação ao Atlas: se falhar, a app segue sem memória guardada
    ligar();
  } else {
    console.log("Sem MONGODB_URI: recados e chamadas ficam só em memória.");
  }

  // avisos com a app fechada (sem chave do Firebase, fica desligado)
  ligarPush();
});
