import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import ThemeWheel from "../carrossel/ThemeWheel";
import ThemeIcon from "../carrossel/ThemeIcon";
import MapPanel from "./MapPanel";
import { DEFAULT_THEME, THEMES, themeById } from "../carrossel/themes";
import "../carrossel/roda.css";
import "./chamadas.css";

/**
 * Comunicador Miraculous, em três abas.
 *
 *  - Roda:     escolhe os heróis (vários ao mesmo tempo) girando o cilindro.
 *  - Contatos: a mesma escolha em lista, com busca.
 *  - Canal:    o comunicador aberto — projeção holográfica, kwami e time.
 *
 * A seleção é compartilhada entre as abas: marcar na roda reflete na lista e o
 * canal chama exatamente quem estiver marcado. O áudio não passa entre
 * aparelhos (isso pediria um servidor de sinalização): a conversa é simulada.
 */

/** Tempo até o contato "atender" (simulação). */
const RING_MS = 3600;
/** Quantos heróis cabem numa chamada. */
const TEAM_SIZE = 4;

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

/** O time sugerido: o contato em foco mais os próximos heróis da roda. */
function buildTeam(contact) {
  const start = THEMES.findIndex((theme) => theme.id === contact.id);
  const team = [contact];

  for (let i = 1; i < THEMES.length && team.length < TEAM_SIZE; i += 1) {
    const theme = THEMES[(start + i) % THEMES.length];
    if (theme.id !== contact.id) team.push(theme);
  }

  return team;
}

function nextTeammate(members) {
  if (members.length >= TEAM_SIZE) return members;
  const taken = new Set(members.map((member) => member.id));
  const next = THEMES.find((theme) => !taken.has(theme.id));
  return next ? [...members, next] : members;
}

/* ----- ícones (SVG inline, currentColor) ----- */

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

function AddHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.6" />
      <path d="M2 20v-1.4A4.6 4.6 0 0 1 6.6 14h4.8a4.6 4.6 0 0 1 4.6 4.6V20" />
      <path d="M19 5v6M16 8h6" />
    </svg>
  );
}

function WheelTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MapTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function ListTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

const TABS = [
  { id: "roda", label: "Roda", Icon: WheelTabIcon },
  { id: "contatos", label: "Contatos", Icon: ListTabIcon },
  { id: "canal", label: "Canal", Icon: PhoneIcon },
  { id: "mapa", label: "Mapa", Icon: MapTabIcon },
];

/* ----- tela de chamada: projeção holográfica ----- */

function CallScreen({
  members,
  phase,
  elapsed,
  muted,
  speaker,
  video,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onAddMember,
  onShowMap,
  onEnd,
}) {
  const main = members[0];
  const others = members.slice(1);
  const ringing = phase === "ringing";
  const time = formatTime(elapsed);

  const status = ringing
    ? others.length
      ? "Chamando o time…"
      : "Chamando…"
    : time;

  const kwamiLine = ringing
    ? "sintonizando o canal…"
    : others.length
      ? `mantendo ${others.length + 1} conexões abertas.`
      : "canal aberto. Pode falar.";

  return (
    <div
      className="call call--panel"
      data-phase={phase}
      data-team={others.length ? "true" : "false"}
      style={{ "--accent-base": main.accent }}
      role="region"
      aria-label={
        others.length
          ? `Chamada do time com ${members.map((member) => member.name).join(", ")}`
          : `Chamada para ${main.name}`
      }
    >
      <div className="call__glow" aria-hidden="true" />

      <p className="call__badge">Sistema Miraculous · projeção</p>

      <div className="call__projector">
        <span className="call__beam" aria-hidden="true" />
        <span className="call__base" aria-hidden="true" />

        <div className="holo">
          <span className="holo__ring" aria-hidden="true" />
          <span className="holo__ring" aria-hidden="true" />
          <span className="holo__figure">
            <ThemeIcon id={main.id} />
          </span>
        </div>
      </div>

      <h2 className="call__name">{main.name}</h2>

      <p className="call__status" role="status" aria-live="polite">
        {status}
      </p>

      {main.kwami ? (
        <p className="call__kwami">
          <strong>{main.kwami}</strong> · {kwamiLine}
        </p>
      ) : null}

      {others.length ? (
        <ul className="call__team" aria-label="Também no canal">
          {others.map((member) => (
            <li key={member.id} className="call__teammate" style={{ "--accent-base": member.accent }}>
              <span className="call__teammateIcon" aria-hidden="true">
                <ThemeIcon id={member.id} />
              </span>
              {member.name}
            </li>
          ))}
        </ul>
      ) : null}

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

            <button type="button" className="call__btn" onClick={onShowMap} aria-label="Ver o time no mapa">
              <PinIcon />
              <span>Mapa</span>
            </button>

            <button type="button" className="call__btn call__btn--end" onClick={onEnd} aria-label="Encerrar o canal">
              <PhoneOffIcon />
              <span>Encerrar</span>
            </button>
          </>
        )}

        {members.length < TEAM_SIZE ? (
          <button
            type="button"
            className="call__btn"
            onClick={onAddMember}
            aria-label="Adicionar um herói ao canal"
          >
            <AddHeroIcon />
            <span>Time</span>
          </button>
        ) : null}
      </div>

      <p className="call__note">
        Demonstração: o canal é simulado na tela, sem áudio entre aparelhos.
      </p>
    </div>
  );
}

/* ----- página ----- */

function CallsApp() {
  const [tab, setTab] = useState("roda");
  const [focusId, setFocusId] = useState(DEFAULT_THEME);
  const [selectedIds, setSelectedIds] = useState(() => [DEFAULT_THEME]);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [members, setMembers] = useState([]);
  const [connectedAt, setConnectedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [video, setVideo] = useState(true);

  const focus = themeById(focusId);
  const selectedThemes = useMemo(
    () => selectedIds.map((id) => themeById(id)).filter(Boolean),
    [selectedIds]
  );

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return THEMES;
    return THEMES.filter((theme) => normalize(theme.name).includes(term));
  }, [query]);

  /** Marca ou desmarca um herói; o cilindro gira até ele. */
  const toggleHero = useCallback(
    (theme) => {
      setFocusId(theme.id);

      if (selectedIds.includes(theme.id)) {
        setSelectedIds(selectedIds.filter((id) => id !== theme.id));
        setNotice("");
        return;
      }

      if (selectedIds.length >= TEAM_SIZE) {
        setNotice(`O canal sustenta ${TEAM_SIZE} heróis. Desmarque um para entrar outro.`);
        return;
      }

      setSelectedIds([...selectedIds, theme.id]);
      setNotice("");
    },
    [selectedIds]
  );

  /** Sugere o time da Guardiã: o herói em foco mais os três seguintes. */
  const pickSuggestedTeam = useCallback(() => {
    setSelectedIds(buildTeam(focus).map((theme) => theme.id));
    setNotice("");
  }, [focus]);

  const startCall = useCallback(() => {
    if (!selectedThemes.length) {
      setNotice("Marque pelo menos um herói para abrir o canal.");
      return;
    }

    setMembers(selectedThemes.slice(0, TEAM_SIZE));
    setPhase("ringing");
    setConnectedAt(null);
    setElapsed(0);
    setMuted(false);
    setSpeaker(false);
    setVideo(true);
    setNotice("");
    setTab("canal");
  }, [selectedThemes]);

  const endCall = useCallback(() => {
    setPhase("idle");
    setMembers([]);
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

  /** Esc encerra a chamada. */
  useEffect(() => {
    if (phase === "idle") return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") endCall();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [endCall, phase]);

  /** Setas navegam entre as abas. */
  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let next = null;

    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;

    if (next === null) return;

    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`aba-${TABS[next].id}`)?.focus();
  };

  const canalBadge =
    phase === "ringing" ? "…" : phase === "active" ? String(members.length) : "";

  return (
    <main className="calls" style={{ "--accent-base": focus.accent }}>
      <header className="calls__head">
        <p className="calls__eyebrow">Sistema Miraculous</p>
        <h1>Roda de Chamadas</h1>
        <p className="calls__sub">
          Escolha os heróis na roda ou na lista, marque quantos quiser e abra o canal. Como
          Guardiã, você fala com o time inteiro na mesma projeção.
        </p>
      </header>

      <div className="calls__tabs" role="tablist" aria-label="Seções do comunicador" onKeyDown={onTabKeyDown}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const badge =
            id === "roda" ? String(selectedThemes.length) : id === "canal" ? canalBadge : "";

          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`aba-${id}`}
              className="calls__tab"
              aria-selected={active}
              aria-controls={`painel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
            >
              <Icon />
              <span>{label}</span>
              {badge ? (
                <span className="calls__tabBadge" aria-hidden="true">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "roda" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-roda"
          aria-labelledby="aba-roda"
          tabIndex={0}
        >
          <div className="calls__wheel">
            <h2 className="calls__label">Heróis na roda</h2>

            <div className="calls__wheelBox">
              <ThemeWheel
                themes={THEMES}
                selectedTheme={focusId}
                selectedIds={selectedIds}
                onToggle={toggleHero}
                label="Contatos"
              />
            </div>

            <p className="calls__hint">
              Toque em um círculo para marcar, toque de novo para tirar. Dá para escolher até{" "}
              {TEAM_SIZE} heróis na mesma chamada.
            </p>
          </div>

          <div className="calls__selection">
            <div className="calls__selectionHead">
              <span className="calls__label">No canal</span>
              <span className="calls__count">
                {selectedThemes.length}/{TEAM_SIZE}
              </span>
            </div>

            {selectedThemes.length ? (
              <ul className="calls__picks">
                {selectedThemes.map((theme) => (
                  <li key={theme.id} style={{ "--accent-base": theme.accent }}>
                    <button
                      type="button"
                      className="calls__pick"
                      onClick={() => toggleHero(theme)}
                      title={`Tirar ${theme.name} do canal`}
                    >
                      <span className="calls__pickIcon" aria-hidden="true">
                        <ThemeIcon id={theme.id} />
                      </span>
                      {theme.name}
                      <span className="calls__pickClose" aria-hidden="true">
                        ×
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calls__picksEmpty">
                Nenhum herói marcado. Toque nos círculos da roda para montar a chamada.
              </p>
            )}

            <div className="calls__actions">
              <button type="button" className="calls__callBtn" onClick={startCall} disabled={!selectedThemes.length}>
                <PhoneIcon />
                {selectedThemes.length > 1 ? `Chamar ${selectedThemes.length}` : "Chamar"}
              </button>

              <button type="button" className="calls__teamBtn" onClick={pickSuggestedTeam}>
                <AddHeroIcon />
                Time sugerido
              </button>

              {selectedThemes.length ? (
                <button type="button" className="calls__ghostBtn" onClick={() => setSelectedIds([])}>
                  Limpar
                </button>
              ) : null}
            </div>

            {notice ? (
              <p className="calls__notice" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "contatos" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-contatos"
          aria-labelledby="aba-contatos"
          tabIndex={0}
        >
          <div className="calls__listHead">
            <h2>Contatos</h2>

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
              {filtered.map((item) => {
                const picked = selectedIds.indexOf(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="calls__contact"
                      style={{ "--accent-base": item.accent }}
                      aria-pressed={picked >= 0}
                      onClick={() => toggleHero(item)}
                      title={picked >= 0 ? `Tirar ${item.name} do canal` : `Pôr ${item.name} no canal`}
                    >
                      {picked >= 0 ? (
                        <span className="calls__pickMark" aria-hidden="true">
                          {picked + 1}
                        </span>
                      ) : null}
                      <span className="calls__avatar" aria-hidden="true">
                        <ThemeIcon id={item.id} />
                      </span>
                      <span>{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="calls__empty">Nenhum contato encontrado para “{query.trim()}”.</p>
          )}

          <p className="calls__hint">
            Os heróis marcados aparecem na aba Roda com a ordem da chamada.
          </p>
        </section>
      ) : null}

      {tab === "canal" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-canal"
          aria-labelledby="aba-canal"
          tabIndex={0}
        >
          {phase === "idle" ? (
            <div className="calls__idle">
              <span className="calls__idleIcon" aria-hidden="true">
                <PhoneIcon />
              </span>
              <h2>Nenhum canal aberto</h2>
              <p>
                {selectedThemes.length
                  ? `${selectedThemes.length} herói${selectedThemes.length > 1 ? "s" : ""} marcado${
                      selectedThemes.length > 1 ? "s" : ""
                    }: ${selectedThemes.map((theme) => theme.name).join(", ")}.`
                  : "Marque heróis na roda ou na lista de contatos para abrir o comunicador."}
              </p>

              <button type="button" className="calls__callBtn" onClick={startCall} disabled={!selectedThemes.length}>
                <PhoneIcon />
                Abrir canal
              </button>

              {notice ? (
                <p className="calls__notice" role="status">
                  {notice}
                </p>
              ) : null}
            </div>
          ) : (
            <CallScreen
              members={members}
              phase={phase}
              elapsed={elapsed}
              muted={muted}
              speaker={speaker}
              video={video}
              onToggleMute={() => setMuted((value) => !value)}
              onToggleSpeaker={() => setSpeaker((value) => !value)}
              onToggleVideo={() => setVideo((value) => !value)}
              onAddMember={() => setMembers((current) => nextTeammate(current))}
              onShowMap={() => setTab("mapa")}
              onEnd={endCall}
            />
          )}
        </section>
      ) : null}

      {tab === "mapa" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-mapa"
          aria-labelledby="aba-mapa"
          tabIndex={0}
        >
          <MapPanel selectedThemes={selectedThemes} onToggle={toggleHero} />
        </section>
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
