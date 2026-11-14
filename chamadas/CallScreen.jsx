import { useEffect, useRef, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { CameraIcon, ChatTabIcon, MicIcon, PhoneOffIcon, PinIcon } from "./icons";

/**
 * Ecrã da chamada: vídeo de quem está do outro lado, o meu em miniatura e os
 * controles. Quem está só em voz (ou sem câmera) aparece com o avatar do herói.
 */

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/*
  Um pedaço de vídeo da chamada.

  No Safari do iPhone há três armadilhas que deixam a imagem preta sem erro
  nenhum, e nenhuma delas aparece no Chrome:
    1. o play() é ignorado até haver um toque na página, e um stream com áudio
       não começa sozinho como os mudos;
    2. uma faixa que entra depois no mesmo MediaStream (a câmera ligada no meio
       da chamada) não aparece até o srcObject ser posto outra vez;
    3. o atributo playsinline precisa de estar no elemento antes do primeiro
       play, ou o vídeo abre sozinho em ecrã inteiro.
  Por isso o elemento é montado à mão no efeito, e cada um dos três casos tem
  o seu remédio aqui.
*/
/** Seta de reproduzir, para o botão que destrava o vídeo no iPhone. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.4v13.2L19.2 12 8 5.4Z" fill="currentColor" />
    </svg>
  );
}

function Stream({ stream, muted, className }) {
  const ref = useRef(null);
  /* O iPhone começa com o vídeo parado à espera de um toque: enquanto isso,
     o quadrado preto ganha um botão em vez de ficar mudo e sem explicação. */
  const [parado, setParado] = useState(true);
  const temVideo = Boolean(stream?.getVideoTracks?.().length);

  const tocar = () => {
    ref.current?.play?.().catch(() => {});
  };

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    node.setAttribute("playsinline", "");
    node.setAttribute("webkit-playsinline", "");
    node.muted = Boolean(muted);

    const ligar = (reconstruir) => {
      if (!stream) return;

      // No Safari uma faixa nova no mesmo stream não é desenhada: é preciso
      // entregar ao elemento um stream novo, montado com as faixas de agora.
      node.srcObject = reconstruir ? new MediaStream(stream.getTracks()) : stream;
      node.play?.().catch(() => {
        /* barrado pela política do iOS: o próximo toque tenta outra vez */
      });
    };

    const tentarDeNovo = () => {
      if (node.paused) node.play?.().catch(() => {});
    };

    ligar(false);

    node.addEventListener("loadedmetadata", tentarDeNovo);
    node.addEventListener("canplay", tentarDeNovo);

    // faixa que chega depois (câmera ligada a meio, ou o vídeo depois do áudio)
    const faixaNova = () => ligar(true);
    stream?.addEventListener?.("addtrack", faixaNova);

    // o botão só aparece enquanto o elemento está mesmo parado
    const conferir = () => setParado(node.paused || node.readyState < 2);
    const aoReproduzir = () => setParado(false);

    node.addEventListener("playing", aoReproduzir);
    node.addEventListener("pause", conferir);
    const relogio = setTimeout(conferir, 1200);

    // um toque em qualquer sítio da chamada libera o que o iOS barrou
    document.addEventListener("pointerdown", tentarDeNovo);
    document.addEventListener("touchend", tentarDeNovo);

    return () => {
      clearTimeout(relogio);
      node.removeEventListener("loadedmetadata", tentarDeNovo);
      node.removeEventListener("canplay", tentarDeNovo);
      node.removeEventListener("playing", aoReproduzir);
      node.removeEventListener("pause", conferir);
      stream?.removeEventListener?.("addtrack", faixaNova);
      document.removeEventListener("pointerdown", tentarDeNovo);
      document.removeEventListener("touchend", tentarDeNovo);
      node.srcObject = null;
    };
  }, [stream, muted]);

  return (
    <>
      <video ref={ref} className={className} autoPlay playsInline muted={muted} />

      {parado && temVideo ? (
        <button type="button" className="room__play" onClick={tocar}>
          <PlayGlyph />
          Ver
        </button>
      ) : null}
    </>
  );
}

const PEER_STATE = {
  new: "conectando…",
  connecting: "conectando…",
  connected: "no canal",
  disconnected: "rede instável",
  failed: "sem conexão",
  closed: "saiu",
};

export default function CallScreen({
  call,
  peers = [],
  local,
  muted,
  camera,
  mediaError,
  ringing,
  elapsed,
  unread = 0,
  onMute,
  onCamera,
  onChat,
  onMap,
  onEnd,
}) {
  const accent = themeById(call.members[0]?.hero ?? "cat").accent;
  const localVideo = Boolean(local?.getVideoTracks().some((track) => track.enabled));
  const status = ringing ? "Chamando…" : formatTime(elapsed);

  return (
    <div className="call call--panel" data-phase={ringing ? "ringing" : "active"} style={{ "--accent-base": accent }}>
      <div className="call__glow" aria-hidden="true" />

      <p className="call__badge">
        {call.kind === "video" ? "Videochamada" : "Chamada de voz"} ·{" "}
        {call.members.length} no canal
      </p>

      <p className="call__status" role="status" aria-live="polite">
        {status}
      </p>

      <div className="room">
        {peers.map((peer) => (
          <div
            key={peer.name}
            className="room__tile"
            data-state={peer.state}
            style={{ "--accent-base": themeById(peer.hero).accent }}
          >
            {peer.hasVideo ? (
              <Stream stream={peer.stream} className="room__video" />
            ) : (
              <div className="room__avatar" aria-hidden="true">
                <ThemeIcon id={peer.hero} />
              </div>
            )}

            <span className="room__tag">
              {themeById(peer.hero).name}
              {!peer.hasVideo ? ` · ${PEER_STATE[peer.state] ?? "no canal"}` : ""}
            </span>
          </div>
        ))}

        {!peers.length ? (
          <div className="room__wait">
            <span className="room__pulse" aria-hidden="true" />
            <p>{ringing ? "A tocar…" : "Esperando o outro lado entrar no canal…"}</p>
          </div>
        ) : null}

        {localVideo ? (
          <div className="room__self">
            <Stream stream={local} muted className="room__video" />
            <span className="room__tag">você</span>
          </div>
        ) : null}
      </div>

      {mediaError ? <p className="calls__notice">{mediaError}</p> : null}

      <div className="call__actions">
        {ringing ? (
          <button type="button" className="call__btn call__btn--end" onClick={onEnd} autoFocus>
            <PhoneOffIcon />
            <span>Cancelar</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="call__btn"
              aria-pressed={muted}
              aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
              onClick={onMute}
            >
              <MicIcon muted={muted} />
              <span>{muted ? "Sem áudio" : "Mudo"}</span>
            </button>

            <button
              type="button"
              className="call__btn"
              aria-pressed={camera}
              aria-label={camera ? "Desligar câmera" : "Ligar câmera"}
              onClick={onCamera}
            >
              <CameraIcon on={camera} />
              <span>{camera ? "Câmera" : "Câmera off"}</span>
            </button>

            <button type="button" className="call__btn" onClick={onChat} aria-label="Abrir os recados">
              <ChatTabIcon />
              <span>Recados{unread ? ` (${unread})` : ""}</span>
            </button>

            <button type="button" className="call__btn" onClick={onMap} aria-label="Ver o time no mapa">
              <PinIcon />
              <span>Mapa</span>
            </button>

            <button type="button" className="call__btn call__btn--end" onClick={onEnd} aria-label="Encerrar a chamada">
              <PhoneOffIcon />
              <span>Encerrar</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
