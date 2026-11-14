/*
  Atualização dentro do APK.

  O plugin nativo "Atualizador" baixa o APK novo para a cache da app e abre o
  instalador do Android. A página só pede; quem escreve e instala é o lado
  nativo — o WebView não tem permissão para nenhuma das duas coisas.
*/

import { registerPlugin } from "@capacitor/core";
import { IS_NATIVE } from "./plataforma";

const Atualizador = registerPlugin("Atualizador");

/** Baixa e instala a versão publicada. Só existe dentro do APK. */
export async function instalarNoAparelho(url) {
  if (!IS_NATIVE) throw new Error("A atualização só funciona dentro da app instalada.");

  return Atualizador.instalar({ url });
}
