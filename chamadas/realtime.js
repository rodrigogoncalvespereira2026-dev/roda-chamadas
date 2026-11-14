/*
  Cliente do WebSocket de sinalização.

  Cuida de: reconectar sozinho (com espera crescente), enfileirar o que foi
  pedido antes da conexão abrir e avisar quem escuta por cada tipo de recado.
  O protocolo é só JSON com um campo `t`.
*/

import { WS_URL } from "./plataforma";

export function createRealtime() {
  const handlers = new Map();

  let socket = null;
  let status = "offline";
  let tries = 0;
  let timer = null;
  let stopped = false;
  /** Recados pedidos antes do socket abrir (ex.: o join do primeiro carregamento). */
  const queue = [];

  const emit = (type, payload) => {
    for (const handler of handlers.get(type) ?? []) handler(payload);
  };

  const setStatus = (next) => {
    if (next === status) return;
    status = next;
    emit("status", next);
  };

  /** No navegador é a mesma origem; no APK é o servidor fixo do build. */
  const address = () => WS_URL;

  function scheduleReconnect() {
    clearTimeout(timer);
    tries += 1;
    timer = setTimeout(open, Math.min(8000, 400 * 2 ** Math.min(tries, 4)));
  }

  function open() {
    if (stopped) return;

    setStatus(tries ? "reconnecting" : "connecting");

    let next;
    try {
      next = new WebSocket(address());
    } catch {
      scheduleReconnect();
      return;
    }

    socket = next;

    next.addEventListener("open", () => {
      tries = 0;
      setStatus("online");
      while (queue.length) next.send(queue.shift());
      emit("open");
    });

    next.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data && typeof data.t === "string") emit(data.t, data);
    });

    next.addEventListener("close", () => {
      if (socket === next) socket = null;
      setStatus("offline");
      if (!stopped) scheduleReconnect();
    });

    next.addEventListener("error", () => {
      /* o close vem logo depois e agenda a reconexão */
    });
  }

  return {
    /** Escuta um tipo de recado; devolve a função para parar de escutar. */
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
      return () => handlers.get(type)?.delete(handler);
    },

    send(type, payload = {}) {
      const text = JSON.stringify({ t: type, ...payload });

      if (socket && socket.readyState === WebSocket.OPEN) socket.send(text);
      else if (!stopped) queue.push(text);
    },

    connect() {
      stopped = false;
      if (!socket) open();
    },

    disconnect() {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
      socket = null;
      setStatus("offline");
    },

    get status() {
      return status;
    },
  };
}
