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

/** Conta de serviço do Firebase (só depois de ligarPush). */
let conta = null;
let projeto = null;

/** hero → Set de tokens do aparelho */
const tokens = new Map();
/** token → hero, para um aparelho não ficar em dois heróis */
const dono = new Map();

/** Token de acesso em cache, com a validade que o Google disser. */
let acesso = null;

/** Lê a chave da conta de serviço. Devolve se o push ficou disponível. */
export function ligarPush() {
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    console.log("Sem FIREBASE_SERVICE_ACCOUNT: avisos só com a app aberta.");
    return false;
  }

  try {
    conta = JSON.parse(bruto);
    projeto = conta.project_id;
  } catch {
    conta = null;
    projeto = null;
    console.error("[push] FIREBASE_SERVICE_ACCOUNT não é um JSON válido.");
    return false;
  }

  if (!conta?.client_email || !conta?.private_key || !projeto) {
    conta = null;
    projeto = null;
    console.error("[push] à conta de serviço falta client_email, private_key ou project_id.");
    return false;
  }

  console.log(`[push] ligado ao projeto ${projeto}`);
  return true;
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
