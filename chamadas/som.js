/*
  Toque de chamada, feito em código (sem ficheiros de áudio).

  Duas figuras: uma para quem está a chamar (um sinal de chamada, grave e
  espaçado) e outra para quem recebe (três notas a subir, no timbre do
  comunicador). O som só começa depois de um toque no ecrã — é o que os
  navegadores exigem — e o próprio toque que abre a app já serve para isso.
*/

const PADROES = {
  /* quem chama: um tom grave, comprido, com pausa */
  aChamar: {
    periodo: 3000,
    notas: [{ hz: 440, em: 0, dura: 1, volume: 0.07, tipo: "sine" }],
  },
  /* quem recebe: três notas a subir, o toque do comunicador */
  aReceber: {
    periodo: 2600,
    notas: [
      { hz: 523.25, em: 0, dura: 0.26, volume: 0.11, tipo: "triangle" },
      { hz: 659.25, em: 0.2, dura: 0.26, volume: 0.11, tipo: "triangle" },
      { hz: 783.99, em: 0.4, dura: 0.55, volume: 0.11, tipo: "triangle" },
    ],
  },
};

let ctx = null;
let timer = null;
let aTocar = null;

function contexto() {
  if (ctx) return ctx;

  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (!AC) return null;

  try {
    ctx = new AC();
  } catch {
    return null;
  }

  return ctx;
}

/** Chamado no primeiro toque no ecrã: os navegadores só deixam tocar depois dele. */
export function acordarSom() {
  const c = contexto();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function nota(c, base, { hz, em, dura, volume, tipo }) {
  const inicio = base + em;
  const osc = c.createOscillator();
  const ganho = c.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(hz, inicio);

  // ataque e queda curtos: evita o "clique" no princípio e no fim
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.04);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dura);

  osc.connect(ganho).connect(c.destination);
  osc.start(inicio);
  osc.stop(inicio + dura + 0.05);
}

function tocarRodada(nome) {
  const c = contexto();
  if (!c) return;

  const padrao = PADROES[nome];
  const base = c.currentTime + 0.02;

  for (const parte of padrao.notas) nota(c, base, parte);
}

/** Começa (ou troca) o toque. Repete até `pararToque()`. */
export function tocarToque(nome) {
  if (aTocar === nome) return;

  pararToque();

  const c = contexto();
  if (!c) return;

  if (c.state === "suspended") c.resume().catch(() => {});

  aTocar = nome;
  tocarRodada(nome);
  timer = setInterval(() => tocarRodada(nome), PADROES[nome].periodo);

  // no dev dá para ver da consola (e nos testes) se o toque está a correr
  if (import.meta.env.DEV) globalThis.__rodaSom = () => aTocar;
}

/** Silêncio: atender, recusar, desligar ou a chamada acabar. */
export function pararToque() {
  if (timer) clearInterval(timer);
  timer = null;
  aTocar = null;
}
