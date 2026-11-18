/*
  O som do aviso de chamada no sistema.

  O canal de notificações do Android precisa de um som; sem ele o aviso nasce
  "silencioso", e as apps que passam notificações para relógios (Smart Life,
  Da Fit, FitCloudPro…) descartam exactamente essas. O plugin só aceita um som
  vindo de res/raw, por isso o toque é gerado aqui — duas notas curtas, as
  mesmas do comunicador, sem ficheiro de áudio externo.

  Uso: node scripts/som-aviso.mjs
*/

import { mkdir, writeFile } from "node:fs/promises";

const AMOSTRAS = 22050; // Hz, mono 16 bits — chega e sobra para um toque
const DESTINO = "android/app/src/main/res/raw/chamada.wav";

/* Nota: frequência, início e duração em segundos; a cauda é um decaimento. */
const NOTAS = [
  { hz: 880, inicio: 0, duracao: 0.16 },
  { hz: 1318.5, inicio: 0.17, duracao: 0.26 },
];

const total = Math.ceil((NOTAS[NOTAS.length - 1].inicio + NOTAS[NOTAS.length - 1].duracao) * AMOSTRAS);
const pcm = Buffer.alloc(total * 2);

for (let i = 0; i < total; i += 1) {
  const tempo = i / AMOSTRAS;
  let amostra = 0;

  for (const { hz, inicio, duracao } of NOTAS) {
    if (tempo < inicio || tempo > inicio + duracao) continue;

    const dentro = tempo - inicio;
    const decaimento = Math.exp(-dentro * 9);

    // entra em 8 ms para não estalar
    const ataque = Math.min(1, dentro / 0.008);
    amostra += Math.sin(2 * Math.PI * hz * dentro) * decaimento * ataque;
  }

  const valor = Math.max(-1, Math.min(1, amostra * 0.55));
  pcm.writeInt16LE(Math.round(valor * 32767), i * 2);
}

const cabecalho = Buffer.alloc(44);
cabecalho.write("RIFF", 0);
cabecalho.writeUInt32LE(36 + pcm.length, 4);
cabecalho.write("WAVE", 8);
cabecalho.write("fmt ", 12);
cabecalho.writeUInt32LE(16, 16); // tamanho do bloco fmt
cabecalho.writeUInt16LE(1, 20); // PCM
cabecalho.writeUInt16LE(1, 22); // mono
cabecalho.writeUInt32LE(AMOSTRAS, 24);
cabecalho.writeUInt32LE(AMOSTRAS * 2, 28); // bytes por segundo
cabecalho.writeUInt16LE(2, 32); // alinhamento do bloco
cabecalho.writeUInt16LE(16, 34); // bits por amostra
cabecalho.write("data", 36);
cabecalho.writeUInt32LE(pcm.length, 40);

await mkdir("android/app/src/main/res/raw", { recursive: true });
await writeFile(DESTINO, Buffer.concat([cabecalho, pcm]));

console.log(`${DESTINO} · ${((cabecalho.length + pcm.length) / 1024).toFixed(1)} kB · ${(total / AMOSTRAS).toFixed(2)} s`);
