import { useEffect, useRef, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import {
  CameraFillIcon,
  ChatFillIcon,
  EffectsIcon,
  FlipCameraFillIcon,
  HandIcon,
  MicFillIcon,
  PhoneCallIcon,
  PinIcon,
  ShareScreenIcon,
  SpeakerFillIcon,
} from "./icons";

/**
 * Ecrã da chamada, no desenho do comunicador do desenho animado:
 *
 *  - a pessoa do outro lado aparece dentro de um círculo com aro luminoso, e as
 *    restantes em bolhas menores em arco por baixo (satélites);
 *  - o meu vídeo é um círculo pequeno a flutuar no canto;
 *  - os controlos são uma coroa de bolhas que se apaga sozinha depois de alguns
 *    segundos — no desenho não há botões à vista — e volta com um toque;
 *  - o aro do círculo respira com o nível da minha voz (Web Audio).
 */

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Nível da minha voz, escrito direto no estilo do painel (--nivel, 0 a 1).
 *
 * Não passa por estado do React de propósito: a 60 leituras por segundo um
 * setState obrigaria a redesenhar a chamada inteira sem necessidade.
 */
function useNivel(stream, ativo, alvo) {
  useEffect(() => {
    const painel = alvo.current;

    if (!ativo || !stream) {
      painel?.style.setProperty("--nivel", "0");
      return undefined;
    }

    const Contexto = window.AudioContext ?? window.webkitAudioContext;
    if (!Contexto) return undefined;

    let contexto;
    let analisador;
    let fonte;
    let pedido;

    try {
      contexto = new Contexto();
      analisador = contexto.createAnalyser();
      analisador.fftSize = 512;
      analisador.smoothingTimeConstant = 0.8;
      fonte = contexto.createMediaStreamSource(stream);
      fonte.connect(analisador);
      contexto.resume?.().catch(() => {});
    } catch {
      painel?.style.setProperty("--nivel", "0");
      contexto?.close?.().catch(() => {});
      return undefined;
    }

    const dados = new Uint8Array(analisador.frequencyBinCount);

    const medir = () => {
      analisador.getByteTimeDomainData(dados);

      let soma = 0;
      for (let i = 0; i < dados.length; i += 1) {
        const amostra = (dados[i] - 128) / 128;
        soma += amostra * amostra;
      }

      const rms = Math.sqrt(soma / dados.length);
      const nivel = Math.min(1, rms * 5.5);

      painel?.style.setProperty("--nivel", nivel.toFixed(2));
      pedido = requestAnimationFrame(medir);
    };

    medir();

    return () => {
      cancelAnimationFrame(pedido);
      try {
        fonte?.disconnect();
        contexto?.close?.().catch(() => {});
      } catch {
        /* o contexto já fechou */
      }
      painel?.style.setProperty("--nivel", "0");
    };
  }, [stream, ativo, alvo]);
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

function Stream({ stream, muted, className, onImagem }) {
  const ref = useRef(null);
  /* O iPhone começa com o vídeo parado à espera de um toque: enquanto isso,
     o círculo preto ganha um botão em vez de ficar mudo e sem explicação. */
  const [parado, setParado] = useState(true);
  const temVideo = Boolean(stream?.getVideoTracks?.().length);

  const tocar = (evento) => {
    evento?.stopPropagation?.();
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

    // "tem imagem?" é diferente de "tem faixa": um iPhone pode dar uma faixa
    // de câmera sem imagem nenhuma, e só a largura do vídeo revela isso.
    const medir = () => onImagem?.(node.videoWidth);
    node.addEventListener("loadedmetadata", medir);
    node.addEventListener("playing", medir);
    const medida = setTimeout(medir, 1500);
    const aoReproduzir = () => setParado(false);

    node.addEventListener("playing", aoReproduzir);
    node.addEventListener("pause", conferir);
    const relogio = setTimeout(conferir, 1200);

    // um toque em qualquer sítio da chamada libera o que o iOS barrou
    document.addEventListener("pointerdown", tentarDeNovo);
    document.addEventListener("touchend", tentarDeNovo);

    return () => {
      clearTimeout(relogio);
      clearTimeout(medida);
      node.removeEventListener("loadedmetadata", medir);
      node.removeEventListener("playing", medir);
      node.removeEventListener("loadedmetadata", tentarDeNovo);
      node.removeEventListener("canplay", tentarDeNovo);
      node.removeEventListener("playing", aoReproduzir);
      node.removeEventListener("pause", conferir);
      stream?.removeEventListener?.("addtrack", faixaNova);
      document.removeEventListener("pointerdown", tentarDeNovo);
      document.removeEventListener("touchend", tentarDeNovo);
      node.srcObject = null;
    };
  }, [stream, muted, onImagem]);

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

/* quantos segundos os controles ficam à vista depois do último toque */
const ESPERA_CONTROLES = 4200;

export default function CallScreen({
  call,
  peers = [],
  local,
  muted,
  camera,
  facing = "user",
  mediaError,
  ringing,
  elapsed,
  unread = 0,
  chatOpen = false,
  eu,
  onMute,
  onCamera,
  onFlip,
  onFixCamera,
  onChat,
  onMap,
  onEnd,
}) {
  const accent = themeById(call.members[0]?.hero ?? "cat").accent;
  const localVideo = Boolean(local?.getVideoTracks().some((track) => track.enabled));
  /* Largura do meu vídeo: 0 = a câmera deu faixa mas não está a enviar imagem. */
  const [larguraLocal, setLarguraLocal] = useState(null);
  /* Roda o ícone da câmera a cada toque em "Trocar". */
  const [girar, setGirar] = useState(false);
  /* Botões extra da barra: mudam de estado no aparelho. */
  const [extra, setExtra] = useState({ ecra: false, mao: false, altifalante: false, efeitos: false });
  const alternarExtra = (chave) => setExtra((atual) => ({ ...atual, [chave]: !atual[chave] }));

  const painel = useRef(null);
  /* Controlos à vista? No desenho só aparecem quando se toca no ecrã. */
  const [mostrar, setMostrar] = useState(true);
  const [toques, setToques] = useState(0);

  const acordar = () => {
    setMostrar(true);
    setToques((n) => n + 1);
  };

  useNivel(local, !ringing && !muted, painel);

  /* apaga a coroa sozinha; cada toque recomeça a contagem */
  useEffect(() => {
    if (ringing || !mostrar) return undefined;

    const tempo = setTimeout(() => setMostrar(false), ESPERA_CONTROLES);

    return () => clearTimeout(tempo);
  }, [ringing, mostrar, toques]);

  const principal = peers[0] ?? null;
  const satelites = peers.slice(1);
  const alvo = ringing
    ? (call.targets?.[0] ?? call.members.find((membro) => membro.hero !== eu) ?? null)
    : null;
  const status = ringing ? "a chamar…" : formatTime(elapsed);

  return (
    <div
      ref={painel}
      className="call"
      data-phase={ringing ? "ringing" : "active"}
      data-controls={mostrar ? "on" : "off"}
      style={{ "--accent-base": accent }}
      onPointerDown={acordar}
    >
      <div className="call__glow" aria-hidden="true" />

      <header className="chamada__topo">
        <p className="call__badge">
          {call.kind === "video" ? "Videochamada" : "Chamada de voz"} ·{" "}
          {call.members.length} no canal
        </p>

        <p className="call__status" role="status" aria-live="polite">
          {status}
        </p>
      </header>

      <div className="palco">
        {ringing ? (
          <div
            className="palco__principal palco__principal--tocar"
            style={{ "--accent-base": themeById(alvo?.hero ?? "cat").accent }}
          >
            <span className="palco__anel" aria-hidden="true" />

            <div className="palco__bolha">
              {alvo ? <ThemeIcon id={alvo.hero} /> : <PhoneCallIcon />}
            </div>

            <p className="palco__nome">{alvo?.name ?? "a chamar"}</p>
            <p className="palco__sub">
              {call.kind === "video" ? "a chamar por vídeo" : "a chamar por voz"}
            </p>
          </div>
        ) : principal ? (
          <div
            className="palco__principal"
            data-state={principal.state}
            style={{ "--accent-base": themeById(principal.hero).accent }}
          >
            <span className="palco__anel" aria-hidden="true" />

            <div className="palco__bolha">
              {principal.hasVideo ? (
                <Stream stream={principal.stream} className="palco__video" />
              ) : (
                <ThemeIcon id={principal.hero} />
              )}
            </div>

            <p className="palco__nome">{themeById(principal.hero).name}</p>

            {principal.hasVideo ? null : (
              <p className="palco__sub">{PEER_STATE[principal.state] ?? "no canal"}</p>
            )}
          </div>
        ) : (
          <div className="palco__principal palco__principal--espera">
            <span className="palco__anel" aria-hidden="true" />

            <div className="palco__bolha">
              <span className="palco__pulso" aria-hidden="true" />
            </div>

            <p className="palco__nome">{ringing ? "a chamar" : "no canal"}</p>
            <p className="palco__sub">
              {ringing ? "A tocar…" : "Esperando o outro lado entrar no canal…"}
            </p>
          </div>
        )}

        {satelites.length ? (
          <ul className="palco__satelites" aria-label="Outros participantes">
            {satelites.map((peer, indice) => {
              /* arco suave: as pontas descem, o meio fica mais alto */
              const desvio = indice - (satelites.length - 1) / 2;

              return (
                <li
                  key={peer.name}
                  className="palco__satelite"
                  data-state={peer.state}
                  style={{
                    "--accent-base": themeById(peer.hero).accent,
                    "--desvio": `${Math.abs(desvio) * 7}px`,
                  }}
                  title={`${themeById(peer.hero).name} · ${PEER_STATE[peer.state] ?? "no canal"}`}
                >
                  {peer.hasVideo ? (
                    <Stream stream={peer.stream} className="palco__video" />
                  ) : (
                    <ThemeIcon id={peer.hero} />
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {localVideo ? (
          <div className="palco__eu" aria-label="O seu vídeo">
            <Stream
              stream={local}
              muted
              className={`palco__video${facing === "user" ? " room__video--espelho" : ""}`}
              onImagem={setLarguraLocal}
            />
          </div>
        ) : null}
      </div>

      {mediaError ? <p className="calls__notice">{mediaError}</p> : null}

      {localVideo && larguraLocal === 0 && elapsed > 3 ? (
        <div className="call__aviso">
          <p className="calls__notice">
            A câmera não está a enviar imagem. Feche os outros apps que usam a câmera e tente
            reiniciá-la; se continuar, confira a permissão nas definições do site.
          </p>
          <button type="button" className="call__avisoBtn" onClick={onFixCamera}>
            Reiniciar câmera
          </button>
        </div>
      ) : null}

      <div className="coroa" data-escondida={mostrar ? "nao" : "sim"} inert={mostrar ? undefined : ""}>
        {ringing ? null : (
          <>
            <button
              type="button"
              className="call__btn"
              aria-pressed={muted}
              aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
              title={muted ? "Ativar microfone" : "Silenciar microfone"}
              onClick={onMute}
            >
              <MicFillIcon muted={muted} />
            </button>

            <button
              type="button"
              className="call__btn"
              aria-pressed={camera}
              aria-label={camera ? "Desligar câmera" : "Ligar câmera"}
              title={camera ? "Desligar câmera" : "Ligar câmera"}
              onClick={onCamera}
            >
              <CameraFillIcon on={camera} />
            </button>

            <button
              type="button"
              className="call__btn"
              onClick={() => {
                setGirar(true);
                onFlip();
              }}
              disabled={!camera}
              aria-label="Trocar entre a câmera da frente e a de trás"
              title="Trocar de câmera"
            >
              <FlipCameraFillIcon
                className={girar ? "spin" : undefined}
                onAnimationEnd={() => setGirar(false)}
              />
            </button>

            <button
              type="button"
              className="call__btn call__btn--share"
              aria-pressed={extra.ecra}
              onClick={() => alternarExtra("ecra")}
              aria-label="Partilhar o ecrã"
              title="Partilhar ecrã"
            >
              <ShareScreenIcon />
            </button>

            <button
              type="button"
              className="call__btn call__btn--hand"
              aria-pressed={extra.mao}
              onClick={() => alternarExtra("mao")}
              aria-label="Levantar a mão"
              title="Levantar a mão"
            >
              <HandIcon />
            </button>

            <button
              type="button"
              className="call__btn call__btn--speaker"
              aria-pressed={extra.altifalante}
              onClick={() => alternarExtra("altifalante")}
              aria-label="Altifalante"
              title="Altifalante"
            >
              <SpeakerFillIcon />
            </button>

            <button
              type="button"
              className="call__btn call__btn--fx"
              aria-pressed={extra.efeitos}
              onClick={() => alternarExtra("efeitos")}
              aria-label="Efeitos de câmera"
              title="Efeitos de câmera"
            >
              <EffectsIcon />
            </button>

            {onChat ? (
              <button
                type="button"
                className="call__btn call__btn--chat"
                data-aberto={chatOpen ? "true" : undefined}
                onClick={onChat}
                aria-label={unread ? `Abrir os recados (${unread} por ler)` : "Abrir os recados"}
                title="Recados"
              >
                {unread ? <i className="call__dot" aria-hidden="true" /> : null}
                <ChatFillIcon />
              </button>
            ) : null}

            {onMap ? (
              <button
                type="button"
                className="call__btn"
                onClick={onMap}
                aria-label="Ver o time no mapa"
                title="Mapa"
              >
                <PinIcon />
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* desligar nunca se esconde: é a saída da chamada */}
      <button
        type="button"
        className="call__fim"
        onClick={onEnd}
        autoFocus={ringing}
        title={ringing ? "Cancelar a chamada" : "Encerrar a chamada"}
        aria-label={ringing ? "Cancelar a chamada" : "Encerrar a chamada"}
      >
        <PhoneCallIcon down />
      </button>
    </div>
  );
}
