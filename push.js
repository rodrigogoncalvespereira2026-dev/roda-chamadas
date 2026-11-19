/*
  Avisos com a app fechada — Firebase Cloud Messaging.

  O WebSocket só existe enquanto a app está aberta: quando o herói fecha a app,
  não há como lhe bater à porta. O caminho do sistema é o FCM: o APK regista um
  token do aparelho (que sobrevive a fechar a app) e o servidor envia por lá o
  aviso de chamada ou de recado.

  Aqui não entra SDK nenhum: a API HTTP v1 usa um JWT assinado com a chave da
  conta de serviço, trocado por um token de acesso. A chave chega na variável
  FIREBASE_SERVICE_ACCOUNT (o JSON completo) e nunca é escrita em ficheiro.

  Sem essa variável tudo isto fica desligado: a app funciona como antes.
*/

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/** Conta de serviço do Firebase (só depois de ligarPush). */
let conta = null;
let projeto = null;

/** hero → Set de tokens do aparelho */
const tokens = new Map();
/** token → hero, para um aparelho não ficar em dois heróis */
const dono = new Map();

/** Token de acesso em cache, com a validade que o Google disser. */
let acesso = null;

/**
 * Onde anda a chave: a variável de ambiente ou um Secret File do Render.
 *
 * A variável é o primeiro sítio, mas um JSON de conta de serviço tem várias
 * linhas e aspas — colado à mão num campo do painel chega muitas vezes cortado
 * ou entre aspas. O Secret File entrega o ficheiro tal e qual, sem esse risco.
 */
const FICHEIROS_DA_CHAVE = [
  "/etc/secrets/firebase-service-account.json",
  "/etc/secrets/firebase.json",
  "firebase-service-account.json",
];

/** Todas as fontes da chave, pela ordem em que são tentadas. */
function fontesDaChave() {
  const fontes = [];

  const env = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (env && env.trim()) {
    fontes.push({ origem: "variável FIREBASE_SERVICE_ACCOUNT", texto: env.trim() });
  }

  for (const caminho of FICHEIROS_DA_CHAVE) {
    try {
      fontes.push({ origem: `ficheiro ${caminho}`, texto: readFileSync(caminho, "utf8").trim() });
    } catch {
      /* não existe: salta */
    }
  }

  return fontes;
}

/** Interpreta um JSON de conta de serviço, ou devolve null. */
function lerConta(texto) {
  let limpo = texto;

  // colar uma string com aspas à volta é o engano mais comum
  if (limpo.startsWith('"') && limpo.endsWith('"')) {
    try {
      limpo = JSON.parse(limpo);
    } catch {
      /* fica como está, para a mensagem de erro fazer sentido */
    }
  }

  try {
    const lida = JSON.parse(limpo);
    if (!lida?.client_email || !lida?.private_key || !lida?.project_id) return null;
    return lida;
  } catch {
    return null;
  }
}

/**
 * Lê a chave da conta de serviço. Devolve se o push ficou disponível.
 *
 * A variável de ambiente vem primeiro, mas se ela estiver estragada (colagem
 * cortada, aspas a mais) tenta-se o Secret File em vez de desistir — assim uma
 * variável mal colada não impede o ficheiro bom de funcionar.
 */
export function ligarPush() {
  const fontes = fontesDaChave();

  if (!fontes.length) {
    console.log("Sem chave do Firebase: avisos só com a app aberta.");
    return false;
  }

  for (const fonte of fontes) {
    const lida = lerConta(fonte.texto);

    if (!lida) {
      console.error(
        `[push] ${fonte.origem}: não é um JSON de conta de serviço válido ` +
          `(${fonte.texto.length} caracteres, começa em ${JSON.stringify(fonte.texto.slice(0, 12))}).`
      );
      continue;
    }

    conta = lida;
    projeto = lida.project_id;
    console.log(`[push] ligado ao projeto ${projeto} (${fonte.origem})`);
    return true;
  }

  conta = null;
  projeto = null;
  console.error(
    "[push] nenhuma chave válida. O mais seguro é um Secret File chamado " +
      "firebase-service-account.json com o JSON completo da conta de serviço."
  );
  return false;
}

export const temPush = () => Boolean(conta);
export const tokensDe = (hero) => [...(tokens.get(hero) ?? [])];

/** Quantos aparelhos estão registados (para o /healthz). */
export const totalTokens = () => [...tokens.values()].reduce((soma, lista) => soma + lista.size, 0);

/** Um aparelho passa a receber avisos em nome deste herói. */
export function guardarToken(hero, token) {
  if (!hero || typeof token !== "string" || token.length < 20) return;

  const antes = dono.get(token);
  if (antes && antes !== hero) esquecerToken(antes, token);

  if (!tokens.has(hero)) tokens.set(hero, new Set());
  tokens.get(hero).add(token);
  dono.set(token, hero);
}

/** O aparelho deixou de valer (app desinstalada, token renovado). */
export function esquecerToken(hero, token) {
  tokens.get(hero)?.delete(token);
  if (!tokens.get(hero)?.size) tokens.delete(hero);
  dono.delete(token);
}

function base64url(valor) {
  return Buffer.from(valor).toString("base64url");
}

/** JWT assinado com a chave da conta de serviço (RS256). */
function assinarAfirmacao() {
  const agora = Math.floor(Date.now() / 1000);

  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    })
  );

  const assinatura = createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(conta.private_key)
    .toString("base64url");

  return `${cabecalho}.${corpo}.${assinatura}`;
}

/** Token de acesso OAuth, reaproveitado enquanto não expirar. */
async function tokenDeAcesso() {
  if (acesso && acesso.expira > Date.now() + 30_000) return acesso.valor;

  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assinarAfirmacao(),
    }),
  });

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok || !dados?.access_token) {
    throw new Error(
      `OAuth ${resposta.status}: ${dados?.error ?? "sem resposta"} ${dados?.error_description ?? ""}`.trim()
    );
  }

  acesso = {
    valor: dados.access_token,
    expira: Date.now() + (Number(dados.expires_in) || 3600) * 1000,
  };

  return acesso.valor;
}

/**
 * Envia um aviso para o aparelho do herói.
 *
 * `canal` é o id do canal de notificações do APK — o de chamadas toca e vibra
 * como um aviso de chamada; o de recados é discreto.
 */
export async function avisar(hero, { titulo, corpo, canal = "chamadas-alerta", dados = {} }) {
  if (!conta) return 0;

  const lista = tokensDe(hero);
  if (!lista.length) return 0;

  let acessoAtual;
  try {
    acessoAtual = await tokenDeAcesso();
  } catch (erro) {
    console.error("[push] sem token de acesso:", erro?.message ?? erro);
    return 0;
  }

  let enviados = 0;

  for (const token of lista) {
    const mensagem = {
      message: {
        token,
        notification: { title: titulo, body: corpo },
        data: Object.fromEntries(
          Object.entries(dados).map(([chave, valor]) => [chave, String(valor ?? "")])
        ),
        android: {
          priority: "HIGH",
          notification: {
            channel_id: canal,
            sound: "default",
            // abre a app já a tocar para quem atendeu no aviso
            click_action: "FCM_PLUGIN_ACTIVITY",
          },
        },
      },
    };

    try {
      const resposta = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projeto}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${acessoAtual}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(mensagem),
        }
      );

      if (resposta.ok) {
        enviados += 1;
        continue;
      }

      const dadosErro = await resposta.json().catch(() => null);
      const estado = dadosErro?.error?.status ?? resposta.status;

      // token morto: o aparelho desinstalou ou renovou o token
      if (estado === "NOT_FOUND" || estado === "UNREGISTERED" || resposta.status === 404) {
        esquecerToken(hero, token);
      } else {
        console.error("[push] falhou:", estado, dadosErro?.error?.message ?? "");
      }
    } catch (erro) {
      console.error("[push] erro de rede:", erro?.message ?? erro);
    }
  }

  return enviados;
}
