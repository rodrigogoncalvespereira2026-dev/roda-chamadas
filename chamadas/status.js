/** Rótulos dos estados de presença (o servidor manda as chaves). */
export const STATUS_LABEL = {
  available: "disponível",
  ringing: "a tocar",
  busy: "em chamada",
  offline: "offline",
};

export const statusLabel = (status) => STATUS_LABEL[status] ?? status;
