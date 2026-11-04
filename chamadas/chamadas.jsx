import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import ThemeWheel from "../carrossel/ThemeWheel";
import ThemeIcon from "../carrossel/ThemeIcon";
import { DEFAULT_THEME, THEMES, themeById } from "../carrossel/themes";
import "../carrossel/roda.css";
import "./chamadas.css";

/**
 * Roda de chamadas.
 *
 * A roda dos Miraculous vira o seletor de contato: você gira, encontra o
 * contato e chama. A chamada em si é uma demonstração de tela (toca, atende
 * sozinho depois de alguns segundos, cronômetro e controles) — não há áudio
 * entre aparelhos, porque isso exigiria um servidor de sinalização.
 */

/** Tempo até o contato "atender" (simulação). */
const RING_MS = 3600;

const normalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/* ----- ícones dos controles (SVG inline, currentColor) ----- */

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.4 19.4 0 0 1-3.33-2.67" />
      <path d="M5.1 5.1A19.5 19.5 0 0 0 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function MicIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v5" />
      {muted ? <path d="M3 3l18 18" /> : null}
    </svg>
  );
}

function SpeakerIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="M16 9l5 6M21 9l-5 6" />
      )}
    </svg>
  );
}

function CameraIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10.5 22 7v10l-7-3.5" />
      {on ? null : <path d="M3 3l18 18" />}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/* ----- tela de chamada ----- */

function CallScreen({ contact, phase, elapsed, muted, speaker, video, onToggleMute, onToggleSpeaker, onToggleVideo, onEnd }) {
  const status = phase === "ringing" ? "Chamando…" : formatTime(elapsed);

  return (
    <div
      className="call"
      data-phase={phase}
      style={{ "--accent-base": contact.accent }}
      role="dialog"
      aria-modal="true"
      aria-label={`Chamada para ${contact.name}`}
    >
      <div className="call__glow" aria-hidden="true" />

      <p className="call__badge">Sistema Miraculous</p>

      <div className="call__avatar">
        <span className="call__ring" aria-hidden="true" />
        <span className="call__ring" aria-hidden="true" />
        <span className="call__icon">
          <ThemeIcon id={contact.id} />
        </span>
      </div>

      <h2 className="call__name">{contact.name}</h2>
      <p className="call__status" role="status" aria-live="polite">
        {status}
      </p>

      {phase === "ringing" ? (
        <div className="call__actions">
          <button type="button" className="call__btn call__btn--end" onClick={onEnd} autoFocus>
            <PhoneOffIcon />
            <span>Cancelar</span>
          </button>
        </div>
      ) : (
        <div className="call__actions">
          <button
            type="button"
            className="call__btn"
            aria-pressed={muted}
            aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
            onClick={onToggleMute}
          >
            <MicIcon muted={muted} />
            <span>{muted ? "Sem áudio" : "Mudo"}</span>
          </button>

          <button
            type="button"
            className="call__btn"
            aria-pressed={speaker}
            aria-label={speaker ? "Desligar viva-voz" : "Ativar viva-voz"}
            onClick={onToggleSpeaker}
          >
            <SpeakerIcon on={speaker} />
            <span>Viva-voz</span>
          </button>

          <button
            type="button"
            className="call__btn"
            aria-pressed={video}
            aria-label={video ? "Desligar câmera" : "Ligar câmera"}
            onClick={onToggleVideo}
          >
            <CameraIcon on={video} />
            <span>Câmera</span>
          </button>

          <button type="button" className="call__btn call__btn--end" onClick={onEnd} aria-label="Desligar chamada">
            <PhoneOffIcon />
            <span>Desligar</span>
          </button>
        </div>
      )}

      <p className="call__note">Demonstração: a chamada acontece na tela, sem áudio entre aparelhos.</p>
    </div>
  );
}

/* ----- página ----- */

function CallsApp() {
  const [contactId, setContactId] = useState(DEFAULT_THEME);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [activeContact, setActiveContact] = useState(null);
  const [connectedAt, setConnectedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [video, setVideo] = useState(true);

  const contact = themeById(contactId);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return THEMES;
    return THEMES.filter((theme) => normalize(theme.name).includes(term));
  }, [query]);

  const startCall = useCallback(
    (target) => {
      setActiveContact(target);
      setPhase("ringing");
      setConnectedAt(null);
      setElapsed(0);
      setMuted(false);
      setSpeaker(false);
      setVideo(true);
    },
    []
  );

  const endCall = useCallback(() => {
    setPhase("idle");
    setActiveContact(null);
    setConnectedAt(null);
    setElapsed(0);
  }, []);

  /** O contato atende sozinho depois de alguns toques. */
  useEffect(() => {
    if (phase !== "ringing") return undefined;
    const timer = setTimeout(() => {
      setConnectedAt(Date.now());
      setPhase("active");
    }, RING_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  /** Cronômetro da chamada. */
  useEffect(() => {
    if (phase !== "active" || !connectedAt) return undefined;
    const tick = () => setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, connectedAt]);

  /** Esc encerra; com a chamada aberta a página atrás não rola. */
  useEffect(() => {
    if (phase === "idle") return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") endCall();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [endCall, phase]);

  return (
    <main className="calls" style={{ "--accent-base": contact.accent }}>
      <header className="calls__head">
        <p className="calls__eyebrow">Sistema Miraculous</p>
        <h1>Roda de Chamadas</h1>
        <p className="calls__sub">Gire a roda, encontre o contato que você quer e chame.</p>
      </header>

      <section className="calls__wheel" aria-labelledby="roda-titulo">
        <h2 id="roda-titulo" className="calls__label">
          Contato
        </h2>

        <div className="calls__wheelBox">
          <ThemeWheel
            themes={THEMES}
            selectedTheme={contactId}
            onSelect={(theme) => setContactId(theme.id)}
            label="Contatos"
          />
        </div>

        <div className="calls__selection">
          <span className="calls__avatar" aria-hidden="true">
            <ThemeIcon id={contact.id} />
          </span>

          <span className="calls__who">
            <strong>{contact.name}</strong>
            <span>Disponível</span>
          </span>

          <button type="button" className="calls__callBtn" onClick={() => startCall(contact)}>
            <PhoneIcon />
            Chamar
          </button>
        </div>

        <p className="calls__hint">
          Arraste, use o scroll ou as setas. Clique para escolher o contato.
        </p>
      </section>

      <section className="calls__list" aria-labelledby="lista-titulo">
        <div className="calls__listHead">
          <h2 id="lista-titulo">Contatos</h2>

          <label className="calls__search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Procurar contato"
              aria-label="Procurar contato"
            />
          </label>
        </div>

        {filtered.length ? (
          <ul className="calls__grid">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="calls__contact"
                  style={{ "--accent-base": item.accent }}
                  aria-pressed={item.id === contactId}
                  onClick={() => setContactId(item.id)}
                  onDoubleClick={() => startCall(item)}
                  title={`Chamar ${item.name}`}
                >
                  <span className="calls__avatar" aria-hidden="true">
                    <ThemeIcon id={item.id} />
                  </span>
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="calls__empty">Nenhum contato encontrado para “{query.trim()}”.</p>
        )}
      </section>

      {phase !== "idle" && activeContact ? (
        <CallScreen
          contact={activeContact}
          phase={phase}
          elapsed={elapsed}
          muted={muted}
          speaker={speaker}
          video={video}
          onToggleMute={() => setMuted((value) => !value)}
          onToggleSpeaker={() => setSpeaker((value) => !value)}
          onToggleVideo={() => setVideo((value) => !value)}
          onEnd={endCall}
        />
      ) : null}
    </main>
  );
}

/*
  Service worker: dá o "instalar na tela inicial" e o abrir sem rede.
  Só em produção — no dev ele guardaria os módulos do Vite e atrapalharia o HMR.
*/
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o app segue funcionando, só não fica instalável */
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CallsApp />
  </React.StrictMode>
);
