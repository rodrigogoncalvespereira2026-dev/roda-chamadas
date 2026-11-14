/*
  Onde esta cópia da app está a correr.

  No navegador (dev e site) a app fala com a mesma origem: o Vite faz proxy de
  /ws em desenvolvimento e o Node atende em produção. Dentro do APK não existe
  site nenhum — as páginas vêm de dentro da app (https://localhost) — por isso a
  sinalização precisa de um endereço fixo, vindo de VITE_SERVER_URL no build.
*/

/** Servidor de sinalização, sem barra no fim (vazio = mesma origem). */
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? "").replace(/\/+$/, "");

/** Endereço do WebSocket de presença/sinalização. */
export const WS_URL = SERVER_URL
  ? `${SERVER_URL.replace(/^http/, "ws")}/ws`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

/** Verdadeiro quando a app foi aberta pelo APK (WebView do Capacitor). */
export const IS_NATIVE = Boolean(globalThis.Capacitor?.isNativePlatform?.());
