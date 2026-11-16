import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import ThemeWheel from "../carrossel/ThemeWheel";
import ThemeIcon from "../carrossel/ThemeIcon";
import Identity from "./Identity";
import Instalar from "./Instalar";
import Atualizar from "./Atualizar";
import IncomingCall from "./IncomingCall";
import CallScreen from "./CallScreen";
import ChatPanel from "./ChatPanel";
import ContactsPanel from "./ContactsPanel";
import MapPanel from "./MapPanel";
import { CallSession } from "./calls";
import { createRealtime } from "./realtime";
import { readPosition } from "./geo";
import { sessao } from "./armazem";
import { IS_NATIVE } from "./plataforma";
import { PRECISA_INSTALAR } from "./instalacao";
import { VERSAO_APP, versaoPublicada } from "./versao";
import { THEMES, themeById } from "../carrossel/themes";
import { STATUS_LABEL } from "./status";
import {
  BackIcon,
  CameraIcon,
  ChatTabIcon,
  GearIcon,
  MapTabIcon,
  MicIcon,
  PhoneIcon,
  UsersIcon,
  WheelTabIcon,
} from "./icons";
import "../carrossel/roda.css";
import "./chamadas.css";

/**
 * Comunicador Miraculous.
 *
 * A roda é a original, com os vinte heróis sempre presentes. A cor do círculo
 * diz o estado de quem está por trás dele — disponível, a tocar, em chamada ou
 * offline — e o canal é uma chamada WebRTC de verdade (voz ou vídeo), com o
 * servidor de /ws cuidando de presença e sinalização.
 *
 * A identidade é o herói: quem entra escolhe um, sem nome de pessoa nem senha.
 */

/** Quantos heróis cabem numa chamada (o mesmo limite do servidor). */
const ROOM_SIZE = 6;
/** Toque longo no círculo central chama todos. */
const HOLD_MS = 550;

/**
 * Identidade da aba: sobrevive a recargas, mas é diferente em cada aba.
 * O servidor usa isso para saber que um reload é a mesma sessão (não é
 * "entrou em outro aparelho") e que duas abas são dois heróis.
 */
const TAB_ID = (() => {
  let id = sessao.ler("roda:aba");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessao.guardar("roda:aba", id);
  }
  return id;
})();

const offlineRoster = () =>
  THEMES.map((theme) => ({ hero: theme.id, name: theme.name, status: "offline" }));

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

const TABS = [
  { id: "roda", label: "Roda", Icon: WheelTabIcon },
  { id: "contatos", label: "Contatos", Icon: UsersIcon },
  { id: "recados", label: "Recados", Icon: ChatTabIcon },
  { id: "canal", label: "Canal", Icon: PhoneIcon },
  { id: "mapa", label: "Mapa", Icon: MapTabIcon },
];

const REASON_TEXT = {
  ended: "Chamada encerrada.",
  left: "A outra pessoa saiu da chamada.",
  "no-answer": "Ninguém atendeu.",
};

function CallsApp() {
  /* No iPhone, a app pede primeiro para ser instalada no ecrã principal. */
  const [instalando, setInstalando] = useState(
    () => PRECISA_INSTALAR && !sessao.ler("roda:safari")
  );

  /* A conta é o herói desta aba: recarregar a página não derruba ninguém. */
  const [identity, setIdentity] = useState(() => {
    const hero = sessao.ler("roda:hero");
    return hero ? { hero } : null;
  });
  /* Dentro do APK, a versão publicada no servidor pode ser mais nova que esta. */
  const [novaVersao, setNovaVersao] = useState(null);

  const [connection, setConnection] = useState("offline");
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState(() => offlineRoster());
  const [error, setError] = useState("");

  const [tab, setTab] = useState("roda");
  /* Botão das definições: fica aqui em cima, com os outros hooks, porque a
     entrada (escolher o herói) sai antes por um return — um useState depois
     desse return muda a ordem dos hooks e a app rebenta (React #310). */
  const [definicoes, setDefinicoes] = useState(false);
  const [focusHero, setFocusHero] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState([]);
  const [kind, setKind] = useState("video");
  const [sharePlace, setSharePlace] = useState(true);

  const [call, setCall] = useState(null);
  const [view, setView] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");

  const [threads, setThreads] = useState({});
  const [unread, setUnread] = useState({});
  const [chatHero, setChatHero] = useState(null);

  const [myPlace, setMyPlace] = useState(null);
  const [places, setPlaces] = useState({});
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const [exclude, setExclude] = useState(null);

  const rtRef = useRef(null);
  if (!rtRef.current) rtRef.current = createRealtime();

  const sessionRef = useRef(null);
  const callRef = useRef(null);
  const peopleRef = useRef(people);
  const identityRef = useRef(identity);
  const iceRef = useRef([]);
  const myPlaceRef = useRef(myPlace);

  useEffect(() => {
    callRef.current = call;
  }, [call]);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  useEffect(() => {
    myPlaceRef.current = myPlace;
  }, [myPlace]);

  /**
   * A roda mantém SEMPRE a ordem original dos temas — o servidor manda o time
   * com os online primeiro, mas aqui a lista volta a ser montada pelos THEMES
   * e só o estado de cada um vem do servidor.
   */
  const roster = useMemo(() => {
    const byHero = new Map(people.map((person) => [person.hero, person]));
    return THEMES.map(
      (theme) =>
        byHero.get(theme.id) ?? { hero: theme.id, name: theme.name, status: "offline" }
    );
  }, [people]);
  /** O time: todos os heróis menos o meu (ninguém liga para si mesmo). */
  const others = roster.filter((person) => person.hero !== identity?.hero);
  const focus = roster.find((person) => person.hero === focusHero) ?? roster[0] ?? null;
  const online = others.filter((person) => person.status !== "offline");
  const totalUnread = Object.values(unread).reduce((sum, count) => sum + count, 0);

  /* ---------- roda ---------- */

  const wheelThemes = useMemo(
    () =>
      roster.map((person) => ({
        id: person.hero,
        name: person.name,
        accent: themeById(person.hero).accent,
        status: person.status,
        statusLabel: STATUS_LABEL[person.status],
        unread: unread[person.hero] ?? 0,
      })),
    [roster, unread]
  );

  useEffect(() => {
    if (!roster.length) return;
    if (!roster.some((person) => person.hero === focusHero)) setFocusHero(roster[0].hero);
  }, [roster, focusHero]);

  /* ---------- vibração e notificação ---------- */

  const vibrate = useCallback((pattern) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* vibração é extra */
    }
  }, []);

  const notify = useCallback((invite) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!document.hidden) return;

    try {
      new Notification(`Chamada de ${invite.from.name}`, {
        body:
          invite.kind === "video"
            ? "Videochamada no Roda de Chamadas"
            : "Chamada de voz no Roda de Chamadas",
        tag: invite.callId,
      });
    } catch {
      /* notificação é extra */
    }
  }, []);

  /* ---------- sessão de chamada ---------- */

  const openSession = useCallback(({ callId, kind: callKind, members }) => {
    const self = identityRef.current;

    sessionRef.current?.close();

    const session = new CallSession({
      callId,
      self: self.hero,
      kind: callKind,
      iceServers: iceRef.current,
      heroOf: (hero) => hero,
      send: (type, payload) => rtRef.current.send(type, payload),
      onChange: (snapshot) => setView(snapshot),
    });

    sessionRef.current = session;
    session.setMembers(members.map((member) => member.hero));
    session.start();

    setView(session.snapshot());
    return session;
  }, []);

  const closeSession = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setView(null);
    setElapsed(0);
  }, []);

  /* ---------- ligar e atender ---------- */

  const getPlace = useCallback(async () => {
    if (!sharePlace) return null;
    if (myPlaceRef.current) return myPlaceRef.current;

    setLocating(true);
    const { place, error: geoIssue } = await readPosition({ timeout: 4000 });
    setLocating(false);

    if (place) {
      setMyPlace(place);
      setGeoError("");
      return place;
    }

    if (geoIssue) setGeoError(geoIssue);
    return null;
  }, [sharePlace]);

  const startCall = useCallback(
    async (targets, callKind = kind) => {
      const eu = identityRef.current?.hero;
      const heroes = targets.filter((hero) => Boolean(hero) && hero !== eu);
      if (!heroes.length) {
        setNotice("Escolha pelo menos um herói do time para chamar.");
        return;
      }

      setNotice("");

      const place = await getPlace();
      rtRef.current.send("call", { targets: heroes, kind: callKind, place });
    },
    [getPlace, kind]
  );

  const endCall = useCallback(() => {
    const current = callRef.current;
    if (current) rtRef.current.send("end", { callId: current.id });
    closeSession();
    setCall(null);
  }, [closeSession]);

  const acceptInvite = useCallback(
    (invite) => {
      rtRef.current.send("accept", { callId: invite.callId });
      setIncoming((current) => current.filter((item) => item.callId !== invite.callId));
      if (invite.place) {
        setPlaces((current) => ({ ...current, [invite.from.hero]: invite.place }));
      }
      vibrate(0);
    },
    [vibrate]
  );

  const rejectInvite = useCallback(
    (invite) => {
      rtRef.current.send("reject", { callId: invite.callId });
      setIncoming((current) => current.filter((item) => item.callId !== invite.callId));
      vibrate(0);
    },
    [vibrate]
  );

  /* ---------- recados ---------- */

  const appendMessage = useCallback((hero, message) => {
    setThreads((current) => {
      const list = current[hero] ?? [];
      if (list.some((item) => item.at === message.at && item.text === message.text && item.mine === message.mine)) {
        return current;
      }
      return { ...current, [hero]: [...list, message] };
    });
  }, []);

  const openChat = useCallback((hero) => {
    setChatHero(hero);
    setUnread((current) => ({ ...current, [hero]: 0 }));
    setTab("recados");
  }, []);

  const sendMessage = useCallback((hero, text) => {
    rtRef.current.send("message", { to: hero, text });
  }, []);

  /* ---------- presença e eventos do servidor ---------- */

  useEffect(() => {
    const rt = rtRef.current;
    const offs = [];

    const join = () => {
      if (identityRef.current) {
        rt.send("join", { hero: identityRef.current.hero, tab: TAB_ID });
      }
    };

    offs.push(rt.on("open", join));
    offs.push(rt.on("status", setConnection));

    offs.push(
      rt.on("welcome", (data) => {
        setMe(data.you);
        setPeople(data.people);
        iceRef.current = data.iceServers ?? [];
        setNotice("");

        // O servidor não guarda chamadas: se a página voltou (ou o servidor
        // reiniciou), o canal antigo não existe mais nesta ponta.
        closeSession();
        setCall(null);
        setIncoming([]);
      })
    );

    offs.push(
      rt.on("people", (data) => {
        setMe(data.you);
        setPeople(data.people);
      })
    );

    offs.push(
      rt.on("calling", (data) => {
        setCall({
          id: data.callId,
          kind: data.kind,
          phase: "ringing",
          members: data.members,
          /* quem está a ser chamado: é o rosto que a chamada mostra */
          targets: data.targets ?? [],
          place: data.place,
          connectedAt: null,
        });
        openSession({ callId: data.callId, kind: data.kind, members: data.members });
        setTab("canal");
        setNotice(
          data.skipped?.length
            ? `Fora agora: ${data.skipped.map((item) => item.name).join(", ")}.`
            : ""
        );
      })
    );

    offs.push(
      rt.on("incoming", (data) => {
        setIncoming((current) =>
          current.some((item) => item.callId === data.callId) ? current : [...current, data]
        );
        if (data.place) {
          setPlaces((current) => ({ ...current, [data.from.hero]: data.place }));
        }
        vibrate([320, 180, 320, 180, 320]);
        notify(data);
      })
    );

    offs.push(
      rt.on("roster", ({ callId, members }) => {
        const current = callRef.current;
        if (!current || current.id !== callId) return;

        const active = members.length > 1;

        setCall((previous) =>
          previous && previous.id === callId
            ? {
                ...previous,
                members,
                phase: active ? "active" : previous.phase,
                connectedAt: previous.connectedAt ?? (active ? Date.now() : null),
              }
            : previous
        );

        sessionRef.current?.setMembers(members.map((member) => member.hero));
      })
    );

    offs.push(
      rt.on("call-joined", (data) => {
        setCall({
          id: data.callId,
          kind: data.kind,
          phase: "active",
          members: data.members,
          place: data.place,
          connectedAt: Date.now(),
        });
        openSession({ callId: data.callId, kind: data.kind, members: data.members });
        setTab("canal");

        if (data.place) {
          setPlaces((current) => ({ ...current, [data.from.hero]: data.place }));
        }
      })
    );

    offs.push(
      rt.on("peer-rejected", ({ by }) => {
        setNotice(`${by.name} não atendeu.`);
      })
    );

    offs.push(
      rt.on("call-ended", ({ callId, reason, by }) => {
        setIncoming((current) => current.filter((item) => item.callId !== callId));

        const current = callRef.current;
        if (!current || current.id !== callId) return;

        closeSession();
        setCall(null);

        if (reason !== "ended" || by) {
          setNotice(
            reason === "ended" && by
              ? `${by.name} encerrou a chamada.`
              : REASON_TEXT[reason] ?? "Chamada encerrada."
          );
        }
      })
    );

    offs.push(
      rt.on("signal", ({ from, data }) => {
        sessionRef.current?.handleSignal(from.hero, data);
      })
    );

    offs.push(
      rt.on("message", ({ from, text, at }) => {
        appendMessage(from.hero, { text, at, mine: false });
        setUnread((current) => ({ ...current, [from.hero]: (current[from.hero] ?? 0) + 1 }));
      })
    );

    offs.push(
      rt.on("message-sent", ({ to, text, at }) => {
        appendMessage(to, { text, at, mine: true });
      })
    );

    offs.push(rt.on("error", ({ message }) => setNotice(message)));

    offs.push(
      rt.on("kicked", ({ message }) => {
        sessao.apagar("roda:hero");
        setIdentity(null);
        setMe(null);
        setPeople(offlineRoster());
        closeSession();
        setCall(null);
        setError(message ?? "Este herói entrou em outra aba.");
        rt.disconnect();
      })
    );

    rt.connect();
    // se o socket já estava aberto (volta do fundo), o join sai agora; senão o
    // handler de "open" manda quando a conexão abrir
    if (rt.status === "online") join();

    return () => offs.forEach((off) => off());
  }, [appendMessage, closeSession, notify, openSession, vibrate]);

  /* Só o APK tem versão para comparar: o site é sempre o que está no servidor. */
  useEffect(() => {
    if (!IS_NATIVE) return undefined;

    let vivo = true;

    versaoPublicada().then((publicada) => {
      if (vivo && publicada && publicada.codigo > VERSAO_APP.codigo) setNovaVersao(publicada);
    });

    return () => {
      vivo = false;
    };
  }, []);

  /* ---------- entrar ---------- */

  const enter = useCallback(({ hero }) => {
    setError("");
    setIdentity({ hero });
    rtRef.current.connect();
    rtRef.current.send("join", { hero, tab: TAB_ID });
  }, []);

  const leave = useCallback(() => {
    if (callRef.current) endCall();
    sessao.apagar("roda:hero");
    setIdentity(null);
    setMe(null);
    setPeople(offlineRoster());
    setUnread({});
    setThreads({});
    rtRef.current.disconnect();
  }, [endCall]);

  /* ---------- cronômetro ---------- */

  useEffect(() => {
    if (!call || call.phase !== "active" || !call.connectedAt) {
      setElapsed(0);
      return undefined;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - call.connectedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call]);

  /* ---------- atalho ---------- */

  useEffect(() => {
    if (!call) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") endCall();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [call, endCall]);

  /* ---------- geolocalização ---------- */

  const locate = useCallback(async () => {
    setLocating(true);
    const { place, error: geoIssue } = await readPosition();
    setLocating(false);

    if (place) {
      setMyPlace(place);
      setGeoError("");
    } else {
      setGeoError(geoIssue ?? "Não foi possível ler a localização.");
    }
  }, []);

  /* ---------- roda: marcar, ligar, chamar todos ---------- */

  const toggleSelection = useCallback((hero) => {
    if (hero === identityRef.current?.hero) return;
    setSelection((current) => {
      if (current.includes(hero)) return current.filter((item) => item !== hero);
      if (current.length >= ROOM_SIZE - 1) return current;
      return [...current, hero];
    });
    setFocusHero(hero);
  }, []);

  const onWheelSelect = useCallback((theme) => setFocusHero(theme.id), []);

  const onWheelActivate = useCallback(
    (theme) => {
      setFocusHero(theme.id);

      if (theme.id === identityRef.current?.hero) {
        setNotice("Este herói é você. Gire até outro círculo para ligar.");
        return;
      }

      startCall([theme.id], kind);
    },
    [kind, startCall]
  );

  const onWheelToggle = useCallback((theme) => toggleSelection(theme.id), [toggleSelection]);

  const holdRef = useRef(null);
  const holdStart = useRef(null);

  const beginHold = useCallback(
    (event) => {
      if (selectMode) return;
      const option = event.target.closest?.(".theme-wheel__option");
      if (!option || !option.classList.contains("is-active")) return;

      holdStart.current = { x: event.clientX, y: event.clientY };
      clearTimeout(holdRef.current);
      holdRef.current = setTimeout(() => {
        holdRef.current = null;
        if (online.length) setExclude(online.map((person) => person.hero));
      }, HOLD_MS);
    },
    [online, selectMode]
  );

  const moveHold = useCallback((event) => {
    const start = holdStart.current;
    if (!start || !holdRef.current) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const endHold = useCallback(() => {
    clearTimeout(holdRef.current);
    holdRef.current = null;
    holdStart.current = null;
  }, []);

  const confirmCallAll = useCallback(() => {
    const heroes = exclude ?? [];
    setExclude(null);
    if (heroes.length) startCall(heroes, kind);
  }, [exclude, kind, startCall]);

  /* ---------- abas ---------- */

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

  /* ---------- telas ---------- */

  if (instalando) {
    return (
      <Instalar
        onContinuar={() => {
          sessao.guardar("roda:safari", "1");
          setInstalando(false);
        }}
      />
    );
  }

  if (!identity) {
    return (
      <>
        <Identity onEnter={enter} notice={error} />
        {novaVersao ? (
          <Atualizar versao={novaVersao} onFechar={() => setNovaVersao(null)} />
        ) : null}
      </>
    );
  }

  const accent = themeById(focus?.hero ?? identity.hero).accent;
  const invite = incoming[0] ?? null;
  const callMembers = call?.members ?? [];

  const tabBadge = (id) => {
    if (id === "roda") return selection.length ? String(selection.length) : "";
    if (id === "recados") return totalUnread ? String(totalUnread) : "";
    if (id === "canal") return call ? (call.phase === "ringing" ? "…" : String(callMembers.length)) : "";
    return "";
  };

  return (
    <main className={definicoes ? "calls calls--settings" : "calls"} style={{ "--accent-base": accent }}>
      <header className="calls__head">
        {definicoes ? (
          <div className="calls__settingsTop">
            <button
              type="button"
              className="calls__settingsBack"
              aria-label="Voltar às chamadas"
              title="Voltar"
              onClick={() => setDefinicoes(false)}
            >
              <BackIcon />
            </button>
            <h1 className="calls__settingsHeadTitle">Definições</h1>
          </div>
        ) : (
          <button
            type="button"
            className="calls__settings"
            aria-label="Abrir as definições"
            title="Definições"
            onClick={() => setDefinicoes(true)}
          >
            <GearIcon />
          </button>
        )}

        {definicoes ? (
          <section className="calls__settingsPanel" aria-label="Definições">
            <div className="calls__settingsMenu">
              <div className="calls__settingsRow">
                <span className="calls__settingsLabel">Herói</span>
                <span className="calls__settingsValue">
                  <span className="calls__meAvatar" aria-hidden="true">
                    <ThemeIcon id={me?.hero ?? identity.hero} />
                  </span>
                  <strong>{me?.name ?? themeById(identity.hero).name}</strong>
                  <span className={`statusDot is-${me?.status ?? "offline"}`}>
                    {STATUS_LABEL[me?.status ?? "offline"]}
                  </span>
                </span>
              </div>

              <div className="calls__settingsRow">
                <span className="calls__settingsLabel">Servidor</span>
                <span className={`calls__settingsValue calls__link--${connection}`}>
                  {connection === "online"
                    ? "ligado"
                    : connection === "connecting"
                      ? "a ligar…"
                      : "sem servidor"}
                </span>
              </div>

              <div className="calls__settingsRow">
                <span className="calls__settingsLabel">Sessão</span>
                <span className="calls__settingsValue">
                  <button type="button" className="calls__ghostBtn" onClick={leave}>
                    Sair
                  </button>
                </span>
              </div>

              <div className="calls__settingsRow calls__settingsRow--about">
                <span className="calls__settingsLabel">Sobre</span>
                <span className="calls__settingsValue calls__settingsValue--stack">
                  <span className="calls__eyebrow">
                    Sistema Miraculous · {me ? "conectado" : connection}
                  </span>
                  <strong className="calls__settingsApp">Roda de Chamadas</strong>
                  <span className="calls__sub">
                    Gire a roda, toque no círculo central para ligar e segure para chamar todo o
                    time. O brilho de cada círculo mostra quem está disponível agora.
                  </span>
                  <span className="calls__settingsVersion">Versão {VERSAO_APP.nome}</span>
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </header>

      <div className="calls__tabs" role="tablist" aria-label="Seções do comunicador" onKeyDown={onTabKeyDown}>
        <div className="calls__tabsInner">
          <span
            className="calls__tabGlow"
            aria-hidden="true"
            style={{ "--ativo": Math.max(0, TABS.findIndex((item) => item.id === tab)) }}
          />

          {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const badge = tabBadge(id);

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
      </div>

      {tab === "roda" ? (
        <section className="calls__panel" role="tabpanel" id="painel-roda" aria-labelledby="aba-roda" tabIndex={0}>
          <div className="calls__wheel">
            <div className="calls__wheelHead">
              <h2 className="calls__label">Heróis na roda</h2>

              <button
                type="button"
                className="calls__ghostBtn"
                aria-pressed={selectMode}
                onClick={() => {
                  setSelectMode((value) => !value);
                  setSelection([]);
                }}
              >
                {selectMode ? "Selecionando" : "Selecionar"}
              </button>
            </div>

            <div
              className="calls__wheelBox"
              onPointerDown={beginHold}
              onPointerMove={moveHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
            >
              <ThemeWheel
                themes={wheelThemes}
                selectedTheme={focus?.hero}
                selectedIds={selectMode ? selection : undefined}
                onSelect={onWheelSelect}
                onActivate={selectMode ? undefined : onWheelActivate}
                onToggle={selectMode ? onWheelToggle : undefined}
                label="Heróis"
              />
            </div>

            <ul className="statusLegend" aria-label="Cores de estado">
              <li>
                <span className="statusDot is-available" aria-hidden="true" /> disponível
              </li>
              <li>
                <span className="statusDot is-ringing" aria-hidden="true" /> a tocar
              </li>
              <li>
                <span className="statusDot is-busy" aria-hidden="true" /> em chamada
              </li>
              <li>
                <span className="statusDot is-offline" aria-hidden="true" /> offline
              </li>
            </ul>

            <p className="calls__hint">
              {selectMode
                ? "Toque nos círculos para marcar quem entra na chamada."
                : "Toque no círculo da frente para ligar. Segure para chamar todos os heróis online."}
            </p>
          </div>

          <div className="calls__selection">
            <div className="segmented" role="group" aria-label="Tipo de chamada">
              <button
                type="button"
                className={`segmented__btn${kind === "voice" ? " is-on" : ""}`}
                aria-pressed={kind === "voice"}
                onClick={() => setKind("voice")}
              >
                <MicIcon /> Voz
              </button>
              <button
                type="button"
                className={`segmented__btn${kind === "video" ? " is-on" : ""}`}
                aria-pressed={kind === "video"}
                onClick={() => setKind("video")}
              >
                <CameraIcon /> Vídeo
              </button>
            </div>

            <label className="calls__check">
              <input
                type="checkbox"
                checked={sharePlace}
                onChange={(event) => setSharePlace(event.target.checked)}
              />
              Enviar minha localização no alerta
            </label>

            <div className="calls__selectionHead">
              <span className="calls__label">Na chamada</span>
              <span className="calls__count">{selection.length}/{ROOM_SIZE - 1}</span>
            </div>

            {selection.length ? (
              <ul className="calls__picks">
                {selection.map((hero) => (
                  <li key={hero} style={{ "--accent-base": themeById(hero).accent }}>
                    <button
                      type="button"
                      className="calls__pick"
                      onClick={() => toggleSelection(hero)}
                      title={`Tirar ${themeById(hero).name} da chamada`}
                    >
                      <span className="calls__pickIcon" aria-hidden="true">
                        <ThemeIcon id={hero} />
                      </span>
                      {themeById(hero).name}
                      <span className="calls__pickClose" aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="calls__picksEmpty">
                {focus
                  ? `Toque no círculo central para ligar para ${focus.name}.`
                  : "Ninguém marcado."}
              </p>
            )}

            <div className="calls__actions">
              <button
                type="button"
                className="calls__callBtn"
                onClick={() => (selection.length ? startCall(selection, kind) : focus && startCall([focus.hero], kind))}
                disabled={!focus || focus.hero === identity.hero || Boolean(call)}
              >
                <PhoneIcon />
                {selection.length > 1
                  ? `Chamar ${selection.length}`
                  : focus
                    ? `Ligar para ${focus.name}`
                    : "Ligar"}
              </button>

              <button
                type="button"
                className="calls__teamBtn"
                onClick={() => setExclude(online.map((person) => person.hero))}
                disabled={!online.length || Boolean(call)}
              >
                <UsersIcon />
                Chamar todos
              </button>
            </div>

            {notice ? (
              <p className="calls__notice" role="status" aria-live="polite">
                {notice}
              </p>
            ) : null}

            {me?.status && me.status !== "available" ? (
              <p className="calls__hint">Seu estado agora: {STATUS_LABEL[me.status]}.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "contatos" ? (
        <section className="calls__panel" role="tabpanel" id="painel-contatos" aria-labelledby="aba-contatos" tabIndex={0}>
          <ContactsPanel
            people={others}
            busy={Boolean(call)}
            onFocus={(hero) => {
              setFocusHero(hero);
              setTab("roda");
            }}
            onCall={(hero) => startCall([hero], kind)}
          />
        </section>
      ) : null}

      {tab === "recados" ? (
        <section className="calls__panel" role="tabpanel" id="painel-recados" aria-labelledby="aba-recados" tabIndex={0}>
          <ChatPanel
            people={others}
            threads={threads}
            unread={unread}
            chatHero={chatHero}
            onOpen={openChat}
            onSend={sendMessage}
          />
        </section>
      ) : null}

      {tab === "canal" ? (
        <section className="calls__panel" role="tabpanel" id="painel-canal" aria-labelledby="aba-canal" tabIndex={0}>
          {call ? (
            <CallScreen
              call={call}
              peers={view?.peers ?? []}
              local={view?.local ?? null}
              muted={view?.muted ?? false}
              camera={view?.camera ?? kind === "video"}
              facing={view?.facing ?? "user"}
              mediaError={view?.mediaError ?? ""}
              ringing={call.phase === "ringing"}
              elapsed={elapsed}
              unread={totalUnread}
              eu={me?.hero ?? identity?.hero}
              onMute={() => sessionRef.current?.setMuted(!(view?.muted ?? false))}
              onCamera={() => sessionRef.current?.setCamera(!(view?.camera ?? false))}
              onFlip={() => sessionRef.current?.flipCamera()}
              onFixCamera={() => sessionRef.current?.restartCamera()}
              onChat={() => setTab("recados")}
              onMap={() => setTab("mapa")}
              onEnd={endCall}
            />
          ) : (
            <div className="calls__idle">
              <span className="calls__idleIcon" aria-hidden="true">
                <PhoneIcon />
              </span>
              <h2>Nenhum canal aberto</h2>
              <p>
                {focus
                  ? `Na frente da roda: ${focus.name} (${STATUS_LABEL[focus.status]}).`
                  : "Gire a roda para escolher quem chamar."}
              </p>

              <button
                type="button"
                className="calls__callBtn"
                onClick={() => focus && startCall(selection.length ? selection : [focus.hero], kind)}
                disabled={!focus}
              >
                <PhoneIcon />
                Abrir canal
              </button>

              {notice ? (
                <p className="calls__notice" role="status">
                  {notice}
                </p>
              ) : null}

              <p className="calls__hint">
                Chamada de {kind === "video" ? "vídeo" : "voz"} ponto a ponto pelo WebRTC. O
                servidor só apresenta as duas pontas.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "mapa" ? (
        <section className="calls__panel" role="tabpanel" id="painel-mapa" aria-labelledby="aba-mapa" tabIndex={0}>
          <MapPanel
            people={others}
            places={places}
            myPlace={myPlace}
            locating={locating}
            geoError={geoError}
            onLocate={locate}
          />
        </section>
      ) : null}

      {invite ? (
        <IncomingCall
          invite={invite}
          queued={incoming.length - 1}
          myPlace={myPlace}
          onAccept={() => acceptInvite(invite)}
          onReject={() => rejectInvite(invite)}
        />
      ) : null}

      {exclude ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Quem entra na chamada">
          <div className="modal__card">
            <h2>Chamar todos</h2>
            <p className="calls__hint">
              Desmarque quem não deve ser incomodado. Só entram os heróis online.
            </p>

            <ul className="modal__list">
              {online.map((person) => (
                <li key={person.hero} style={{ "--accent-base": themeById(person.hero).accent }}>
                  <label className="calls__check">
                    <input
                      type="checkbox"
                      checked={exclude.includes(person.hero)}
                      onChange={(event) =>
                        setExclude((current) =>
                          event.target.checked
                            ? [...(current ?? []), person.hero]
                            : (current ?? []).filter((hero) => hero !== person.hero)
                        )
                      }
                    />
                    <span className="modal__avatar" aria-hidden="true">
                      <ThemeIcon id={person.hero} />
                    </span>
                    {person.name}
                    <span className={`statusDot is-${person.status}`} aria-hidden="true" />
                  </label>
                </li>
              ))}
            </ul>

            <div className="modal__actions">
              <button type="button" className="calls__ghostBtn" onClick={() => setExclude(null)}>
                Cancelar
              </button>
              <button type="button" className="calls__callBtn" onClick={confirmCallAll} disabled={!exclude.length}>
                <PhoneIcon />
                Chamar {exclude.length}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="calls__foot">
        <p>
          Chamada {kind === "video" ? "de vídeo" : "de voz"} com WebRTC · {formatTime(elapsed)} no canal
        </p>
      </footer>

      {novaVersao ? <Atualizar versao={novaVersao} onFechar={() => setNovaVersao(null)} /> : null}
    </main>
  );
}

/*
  Service worker: dá o "instalar na tela inicial" e o abrir sem rede.
  Só em produção — no dev ele guardaria os módulos do Vite e atrapalharia o HMR.
*/
if (!IS_NATIVE && import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o app segue funcionando, só não fica instalável */
    });
  });
}

/*
  Um root só: o Vite reexecuta este módulo quando ele muda (é a entrada da
  página), e criar root duas vezes no mesmo nó duplicaria a árvore.
*/
const container = document.getElementById("root");
const root = container.__rodaRoot ?? (container.__rodaRoot = ReactDOM.createRoot(container));

root.render(
  <React.StrictMode>
    <CallsApp />
  </React.StrictMode>
);
