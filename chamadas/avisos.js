/*
  Avisos de chamada fora do ecrã.

  Dentro do APK o WebSocket de sinalização continua a receber enquanto a app
  está em segundo plano ou com o ecrã bloqueado — mas aí já não há ecrã para
  mostrar quem está a chamar. É esta camada que faz o telemóvel vibrar e põe o
  nome de quem liga na barra de notificações, com o ecrã bloqueado ou não.

  No navegador (site) tudo isto vira nada: a notificação do sistema já é
  tratada em chamadas.jsx e o telemóvel não vibra sem gesto.
*/

import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { IS_NATIVE } from "./plataforma";

const CANAL = "chamadas";

let canal = null;
/** A app está à frente do utilizador? */
let aFrente = true;

/** Verdadeiro quando a app está em segundo plano (ou com o ecrã bloqueado). */
export function foraDoEcra() {
  return !aFrente || document.hidden;
}

/** Identificador estável por chamada, para poder cancelar o aviso certo. */
function idDe(callId) {
  const texto = String(callId ?? "");
  let h = 7;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) % 2147483647;
  }
  return h || 1;
}

/** Cria o canal (alta prioridade, com vibração) e pede a permissão uma vez. */
function prepararCanal() {
  if (!IS_NATIVE) return Promise.resolve(false);

  if (!canal) {
    canal = (async () => {
      try {
        await LocalNotifications.createChannel({
          id: CANAL,
          name: "Chamadas",
          description: "Quem está a chamar",
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
      } catch {
        // canal já existia ou um extra não é aceite nesta versão do Android:
        // fica só o essencial (alta prioridade e vibração)
        try {
          await LocalNotifications.createChannel({
            id: CANAL,
            name: "Chamadas",
            importance: 5,
            vibration: true,
          });
        } catch {
          /* sem canal fica o das notificações normais */
        }
      }

      try {
        const estado = await LocalNotifications.checkPermissions();
        if (estado.display !== "granted") await LocalNotifications.requestPermissions();
      } catch {
        /* sem permissão a app segue a funcionar, só não avisa */
      }

      return true;
    })();
  }

  return canal;
}

/** Chamado no arranque: deixa o canal e a permissão prontos. */
export async function prepararAvisos() {
  if (IS_NATIVE) {
    try {
      App.addListener("appStateChange", ({ isActive }) => {
        aFrente = Boolean(isActive);
      });
    } catch {
      /* sem o plugin fica o document.hidden */
    }
  }

  await prepararCanal();
}

/** Aviso do sistema com quem está a chamar. */
export async function avisarChamada(invite) {
  if (!invite) return;
  if (!(await prepararCanal())) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idDe(invite.callId),
          title: `Chamada de ${invite.from.name}`,
          body:
            invite.kind === "video"
              ? "Videochamada — toque para atender"
              : "Chamada de voz — toque para atender",
          channelId: CANAL,
          ongoing: true,
          autoCancel: true,
          extra: { callId: invite.callId },
        },
      ],
    });
  } catch {
    /* o aviso é extra: a chamada em si continua */
  }
}

/** Tira o aviso quando a chamada foi atendida, recusada ou desligada. */
export async function cancelarAviso(callId) {
  if (!IS_NATIVE || !callId) return;

  try {
    await LocalNotifications.cancel({ notifications: [{ id: idDe(callId) }] });
  } catch {
    /* nada a cancelar */
  }
}
