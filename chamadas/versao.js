/*
  Versão da app e versão publicada do instalador.

  A versão deste exemplar fica gravada no build (vem do build.gradle, pelo
  vite.config). A do servidor é pedida em /versao, que lê o apk/versao.json
  escrito quando o APK é compilado. Comparar os dois é o que permite avisar que
  saiu uma versão nova — no Android nada se atualiza sozinho.
*/

import { SERVER_URL } from "./plataforma";

/** Versão desta cópia da app. */
export const VERSAO_APP = { nome: __VERSAO_APP__, codigo: __CODIGO_APP__ };

/** Endereço direto do instalador. */
export const APK_URL = `${SERVER_URL}/app.apk`;

/** O que o servidor diz estar publicado, ou null. */
export async function versaoPublicada() {
  try {
    const resposta = await fetch(`${SERVER_URL}/versao`, { cache: "no-store" });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    const codigo = Number(dados?.codigo);

    if (!Number.isFinite(codigo)) return null;
    return { versao: String(dados.versao ?? codigo), codigo };
  } catch {
    /* sem rede: não há aviso nenhum, a app segue como está */
    return null;
  }
}
