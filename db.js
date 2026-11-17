/*
  MongoDB Atlas: o que a memória do processo não pode perder.

  Presença e chamadas a decorrer continuam nas `Map` do server.js — são
  sockets e temporizadores, não cabem numa base. Aqui ficam as duas coisas
  que têm de sobreviver a um reinício:

    mensagens  { de, para, texto, em, entregue }
    chamadas   { _id, de, para[], tipo, em, lugar, estado, membros[], fim,
                 duracao, motivo }

  Sem MONGODB_URI a base não é uma dependência: `temBase` fica falso, todas
  as funções devolvem vazio e a app funciona como antes (só que sem memória
  entre reinícios).
*/

import { MongoClient } from "mongodb";

const URI = String(process.env.MONGODB_URI ?? "").trim();
const NOME = String(process.env.MONGODB_DB ?? "roda-chamadas").trim() || "roda-chamadas";

/** Há base configurada? (não quer dizer que já esteja ligada) */
export const temBase = Boolean(URI);

let ligacao = null;
let cliente = null;
let base = null;

const dizer = (texto, erro) =>
  console[erro ? "error" : "log"](`[mongo] ${texto}${erro ? `: ${erro.message ?? erro}` : ""}`);

/**
 * Liga à base (uma vez só) e prepara os índices.
 * Nunca rejeita: se o Atlas estiver em baixo, a app continua a funcionar.
 */
export function ligar() {
  if (!temBase) return Promise.resolve(null);
  if (ligacao) return ligacao;

  ligacao = (async () => {
    cliente = new MongoClient(URI, {
      // em Render, não ficar pendurado à espera de um Atlas morto
      serverSelectionTimeoutMS: 6000,
    });

    await cliente.connect();
    base = cliente.db(NOME);

    await base.collection("mensagens").createIndex({ para: 1, entregue: 1, em: 1 });
    await base.collection("mensagens").createIndex({ de: 1, em: -1 });
    await base.collection("chamadas").createIndex({ em: -1 });
    await base.collection("chamadas").createIndex({ participantes: 1, em: -1 });

    dizer(`ligado à base "${NOME}"`);
    return base;
  })().catch((falha) => {
    dizer("não consegui ligar; a app segue sem memória guardada", falha);
    ligacao = null;
    return null;
  });

  return ligacao;
}

/** Coleção pronta, ou null quando não há base. */
async function colecao(nome) {
  try {
    const b = await ligar();
    return b ? b.collection(nome) : null;
  } catch {
    return null;
  }
}

/** Corre uma escrita sem deixar o erro chegar ao servidor. */
async function tentar(rotulo, trabalho) {
  try {
    return await trabalho();
  } catch (falha) {
    dizer(`${rotulo} falhou`, falha);
    return null;
  }
}

/* ---------- recados ---------- */

/**
 * Guarda um recado. Devolve o id do documento (para o marcar como entregue
 * mais tarde, quando o herói estiver fora).
 */
export async function guardarMensagem({ de, para, texto, em, entregue }) {
  const c = await colecao("mensagens");
  if (!c) return null;

  return tentar("guardar recado", async () => {
    const r = await c.insertOne({
      de,
      para,
      texto,
      em: new Date(em ?? Date.now()),
      entregue: Boolean(entregue),
    });

    return r.insertedId;
  });
}

/** Recados que ficaram por entregar a um herói (ex.: o servidor reiniciou). */
export async function mensagensPendentes(hero, limite = 50) {
  const c = await colecao("mensagens");
  if (!c) return [];

  return (
    (await tentar("ler recados pendentes", () =>
      c
        .find({ para: hero, entregue: false })
        .sort({ em: 1 })
        .limit(limite)
        .toArray()
    )) ?? []
  );
}

/** Marca como entregues os documentos indicados. */
export async function marcarEntregues(ids) {
  if (!ids?.length) return;

  const c = await colecao("mensagens");
  if (!c) return;

  await tentar("marcar recados entregues", () =>
    c.updateMany({ _id: { $in: ids } }, { $set: { entregue: true } })
  );
}

/** Marca como entregue o recado que acabou de seguir para alguém online. */
export async function marcarEntregue(id) {
  if (!id) return;

  const c = await colecao("mensagens");
  if (!c) return;

  await tentar("marcar recado entregue", () => c.updateOne({ _id: id }, { $set: { entregue: true } }));
}

/* ---------- chamadas ---------- */

/** Abre o registo de uma chamada no instante em que ela é pedida. */
export async function abrirChamada({ id, de, para, tipo, em, lugar }) {
  const c = await colecao("chamadas");
  if (!c) return;

  await tentar("guardar chamada", () =>
    c.insertOne({
      _id: id,
      de,
      para,
      tipo,
      em: new Date(em ?? Date.now()),
      lugar: lugar ?? null,
      estado: "a-tocar",
      membros: [de],
      participantes: [de, ...para],
      fim: null,
      duracao: null,
      motivo: null,
    })
  );
}

/** Alguém atendeu: a chamada passou a decorrer. */
export async function atenderChamada({ id, membros, em }) {
  const c = await colecao("chamadas");
  if (!c) return;

  await tentar("marcar chamada atendida", () =>
    c.updateOne(
      { _id: id },
      {
        $set: { estado: "a-decorrer", membros, atendida: new Date(em ?? Date.now()) },
        $addToSet: { participantes: { $each: membros } },
      }
    )
  );
}

/** Fecha o registo: quem ficou, como acabou e quanto durou. */
export async function fecharChamada({ id, membros, estado, motivo, fim }) {
  const c = await colecao("chamadas");
  if (!c) return;

  await tentar("fechar chamada", async () => {
    const quando = new Date(fim ?? Date.now());
    const atual = await c.findOne({ _id: id }, { projection: { em: 1, atendida: 1 } });
    const inicio = atual?.atendida ?? atual?.em ?? null;

    await c.updateOne(
      { _id: id },
      {
        $set: {
          estado,
          motivo: motivo ?? null,
          membros,
          fim: quando,
          duracao: inicio ? Math.max(0, Math.round((quando.getTime() - new Date(inicio).getTime()) / 1000)) : null,
        },
        $addToSet: { participantes: { $each: membros } },
      },
      { upsert: true }
    );
  });
}
