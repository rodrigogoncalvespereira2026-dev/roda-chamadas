/*
  Quem abre a app está num iPhone com ela já instalada? Serve para a tela de
  instalação aparecer só onde ela faz sentido: no Safari de um iPhone que ainda
  não pôs a app no ecrã principal. Dentro do APK ou da app iOS, nunca aparece.
*/

import { IS_NATIVE } from "./plataforma";

/** iPhone ou iPad, pela identificação do navegador. */
export const EH_APPLE = /iPhone|iPad|iPod/.test(navigator.userAgent);

/** A app foi aberta pelo ícone do ecrã principal? */
export const INSTALADA =
  window.navigator.standalone === true ||
  window.matchMedia?.("(display-mode: standalone)")?.matches === true;

/** ?instalar=1 mostra a tela, ?instalar=0 esconde — para ver no computador. */
const FORCADO = new URLSearchParams(window.location.search).get("instalar");

/** Falta instalar: é iPhone/iPad e não veio do ecrã principal. */
export const PRECISA_INSTALAR =
  FORCADO === "1" ? true : FORCADO === "0" ? false : EH_APPLE && !INSTALADA && !IS_NATIVE;
