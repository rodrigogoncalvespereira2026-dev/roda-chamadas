import { useEffect, useRef } from "react";
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

function Stream({ stream, muted, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    node.srcObject = stream ?? null;

    // autoPlay nem sempre basta quando a faixa chega depois do elemento
    if (stream) node.play?.().catch(() => {});

    return () => {
      node.srcObject = null;
    };
  }, [stream]);

  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
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
