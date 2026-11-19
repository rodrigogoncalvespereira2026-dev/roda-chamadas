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
import { avisarChamada, cancelarAviso, foraDoEcra, prepararAvisos } from "./avisos";
import { acordarSom, pararToque, tocarToque } from "./som";
import { createRealtime } from "./realtime";
import { readPosition } from "./geo";
import { local, sessao } from "./armazem";
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
/** Dois toques no mesmo círculo dentro deste tempo chamam os marcados. */
const DUPLO_MS = 420;

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
    /* O herói fica guardado no aparelho: na segunda vez que se abre a app
       entra-se direto, sem voltar a escolher. Só sai quando se carrega em
       "Sair" nas definições (ou quando outro aparelho toma o herói). */
    const hero = local.ler("roda:hero") ?? sessao.ler("roda:hero");
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
  /* herói tocado na roda: fica sozinho no ecrã até a chamada abrir */
  const [escolhido, setEscolhido] = useState(null);
  /* heróis marcados na roda: os que vão ser chamados juntos */
  const [selecionados, setSelecionados] = useState([]);
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

  const rtRef = useRef(null);
  if (!rtRef.current) rtRef.current = createRealtime();

  const sessionRef = useRef(null);
  const callRef = useRef(null);
  const peopleRef = useRef(people);
  const identityRef = useRef(identity);
  const iceRef = useRef([]);
  const myPlaceRef = useRef(myPlace);
  /* último círculo tocado — é o que distingue um toque de um toque duplo */
  const toqueRef = useRef(null);
  /* a lista de marcados à mão: um toque duplo depressa não espera pelo render */
  const selecionadosRef = useRef([]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  /* quem já estava ligado só nesta aba passa a ficar guardado no aparelho */
  useEffect(() => {
    if (identity?.hero) local.guardar("roda:hero", identity.hero);
  }, [identity]);
  useEffect(() => {
    myPlaceRef.current = myPlace;
  }, [myPlace]);
  useEffect(() => {
    selecionadosRef.current = selecionados;
  }, [selecionados]);

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

  /*
    A roda mostra só quem ainda não foi marcado: o herói escolhido sai dela e
    sobe para a fila de cima — é o mesmo círculo a mudar de lugar, não uma
    segunda cópia.
  */
  const wheelThemes = useMemo(
    () =>
      roster
        .filter((person) => !selecionados.includes(person.hero))
        .map((person) => ({
        id: person.hero,
        name: person.name,
        accent: themeById(person.hero).accent,
        status: person.status,
        statusLabel: STATUS_LABEL[person.status],
        unread: unread[person.hero] ?? 0,
      })),
    [roster, selecionados, unread]
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
      cancelarAviso(invite.callId);
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
      cancelarAviso(invite.callId);
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
        setEscolhido(null);
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
        setEscolhido(null);
        openSession({ callId: data.callId, kind: data.kind, members: data.members });
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

        // com a app fora do ecrã não há onde mostrar quem liga: o telemóvel
        // vibra e a notificação diz o nome de quem está a chamar
        if (foraDoEcra()) avisarChamada(data);
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
        setEscolhido(null);
        openSession({ callId: data.callId, kind: data.kind, members: data.members });

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
        cancelarAviso(callId);
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
        local.apagar("roda:hero");
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

  /* No APK, deixa o canal de avisos e a permissão prontos desde o arranque. */
  useEffect(() => {
    prepararAvisos();
  }, []);

  /* O primeiro toque no ecrã acorda o áudio: os navegadores só deixam tocar
     depois de um gesto, e o toque que abre a app já serve. */
  useEffect(() => {
    const acordar = () => acordarSom();
    window.addEventListener("pointerdown", acordar, { once: true });
    return () => window.removeEventListener("pointerdown", acordar);
  }, []);

  /* Enquanto a chamada toca há som: sinal de chamada para quem liga e toque
     do comunicador para quem recebe. */
  useEffect(() => {
    if (incoming.length) tocarToque("aReceber");
    else if (call && call.phase === "ringing") tocarToque("aChamar");
    else pararToque();
  }, [incoming, call]);

  /* ao sair da app, nada fica a tocar */
  useEffect(() => pararToque, []);

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
    /* depois de sair e voltar a entrar, não se cai nas definições outra vez */
    setDefinicoes(false);
    local.guardar("roda:hero", hero);
    sessao.guardar("roda:hero", hero);
    setIdentity({ hero });
    rtRef.current.connect();
    rtRef.current.send("join", { hero, tab: TAB_ID });
  }, []);

  const leave = useCallback(() => {
    if (callRef.current) endCall();
    /* sair é a única forma de trocar de herói: esquece o que estava guardado */
    local.apagar("roda:hero");
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

  /* se a chamada não abrir depressa (ou o herói estiver offline), a roda volta */
  useEffect(() => {
    if (!escolhido || call) return undefined;

    const offline = escolhido.status === "offline";

    const timer = setTimeout(
      () => {
        setEscolhido(null);
        setNotice(
          offline
            ? `${escolhido.name} não está online agora.`
            : "Não foi possível abrir a chamada."
        );
      },
      offline ? 1800 : 8000
    );

    return () => clearTimeout(timer);
  }, [escolhido, call]);

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

  /* ---------- roda: marcar heróis e chamar ---------- */

  const onWheelSelect = useCallback((theme) => setFocusHero(theme.id), []);

  const estadoDe = useCallback(
    (hero) => peopleRef.current.find((person) => person.hero === hero)?.status ?? "offline",
    []
  );

  /**
   * Liga aos heróis marcados. `ultimo` entra sempre: é o círculo do toque duplo,
   * mesmo que o primeiro toque o tenha acabado de marcar.
   */
  const chamarEscolhidos = useCallback(
    (ultimo) => {
      const eu = identityRef.current?.hero;

      const lista = [...new Set([...selecionadosRef.current, ultimo?.id].filter(Boolean))]
        .filter((hero) => hero !== eu)
        .slice(0, ROOM_SIZE - 1);

      if (!lista.length) {
        setNotice("Toque nos círculos para marcar quem quer chamar.");
        return;
      }

      if (callRef.current) return;

      if (lista.every((hero) => estadoDe(hero) === "offline")) {
        setNotice(
          `Ninguém dessa escolha está online agora: ${lista.map((hero) => themeById(hero).name).join(", ")}.`
        );
        return;
      }

      setNotice("");
      setSelecionados([]);

      /* um herói só: o círculo dele fica sozinho no ecrã, como sempre; a
         chamada a vários segue directa para o palco */
      setEscolhido(
        lista.length === 1
          ? { hero: lista[0], name: themeById(lista[0]).name, status: estadoDe(lista[0]) }
          : null
      );

      startCall(lista, kind);
    },
    [estadoDe, kind, startCall]
  );

  /**
   * Um toque marca ou desmarca o círculo; dois toques depressa no mesmo círculo
   * chamam os marcados — o gesto de fechar a escolha.
   */
  const onWheelToggle = useCallback(
    (theme) => {
      setFocusHero(theme.id);

      if (theme.id === identityRef.current?.hero) {
        setNotice("Este herói é você. Gire a roda até outro círculo.");
        return;
      }

      const agora = performance.now();
      const anterior = toqueRef.current;
      toqueRef.current = { id: theme.id, em: agora };

      if (anterior && anterior.id === theme.id && agora - anterior.em < DUPLO_MS) {
        toqueRef.current = null;
        chamarEscolhidos(theme);
        return;
      }

      setNotice("");

      // limites lidos do que já está marcado; a soma em si é feita sobre o
      // valor mais recente, para dois toques seguidos não se apagarem
      if (
        !selecionadosRef.current.includes(theme.id) &&
        selecionadosRef.current.length >= ROOM_SIZE - 1
      ) {
        setNotice(`A chamada leva no máximo ${ROOM_SIZE} heróis, contando com você.`);
        return;
      }

      setSelecionados((atual) =>
        atual.includes(theme.id)
          ? atual.filter((hero) => hero !== theme.id)
          : [...atual, theme.id]
      );
    },
    [chamarEscolhidos]
  );

  const cancelarEscolha = useCallback(() => {
    setEscolhido(null);
    if (callRef.current) endCall();
    else setNotice("");
  }, [endCall]);

  /* ---------- abas ---------- */

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
    if (id === "recados") return totalUnread ? String(totalUnread) : "";
    if (id === "canal") {
      return call ? (call.phase === "ringing" ? "…" : String(callMembers.length)) : "";
    }
    return "";
  };

  return (
    <main
      className={[
        "calls",
        definicoes
          ? "calls--settings"
          : !call && !escolhido && tab === "roda"
            ? "calls--roda"
            : "calls--barra",
      ].join(" ")}
      style={{ "--accent-base": accent }}
    >
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
                    Gire a roda e toque nos círculos para marcar os heróis: um toque marca, outro
                    desmarca, e dois toques no último ligam a todos. O brilho de cada círculo mostra
                    quem está disponível agora.
                  </span>
                  <span className="calls__settingsVersion">Versão {VERSAO_APP.nome}</span>
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </header>

      {!definicoes && !call && !escolhido && tab === "roda" ? (
        <section
          className="calls__panel calls__panel--roda"
          role="tabpanel"
          id="painel-roda"
          aria-labelledby="aba-roda"
          tabIndex={0}
        >
          {/* os heróis já marcados sobem para uma fila de círculos por cima da
              roda, como no comunicador da série; o lugar fica reservado para a
              roda não saltar quando o primeiro sobe */}
          <div className="calls__escolhidos" role="group" aria-label="Heróis marcados">
            {selecionados.map((hero, indice) => (
              <button
                key={hero}
                type="button"
                className="calls__escolhido"
                style={{ "--accent-base": themeById(hero).accent, "--i": indice }}
                onClick={() =>
                  setSelecionados((atual) => atual.filter((item) => item !== hero))
                }
                title={`Tirar ${themeById(hero).name}`}
                aria-label={`Tirar ${themeById(hero).name} da chamada`}
              >
                <ThemeIcon id={hero} />
              </button>
            ))}
          </div>

          <div className="calls__wheelBox">
            <ThemeWheel
              themes={wheelThemes}
              selectedTheme={focus?.hero}
              selectedIds={selecionados}
              onSelect={onWheelSelect}
              onToggle={onWheelToggle}
              label="Heróis"
            />
          </div>

          {selecionados.length ? (
            <div className="calls__escolhidosAcoes">
              <button
                type="button"
                className="calls__ghostBtn"
                onClick={() => setSelecionados([])}
              >
                Limpar
              </button>
              <button
                type="button"
                className="calls__callBtn"
                onClick={() => chamarEscolhidos(null)}
                disabled={connection !== "online"}
              >
                <PhoneIcon />
                Chamar {selecionados.length}
              </button>
            </div>
          ) : null}

          {notice ? (
            <p className="calls__aviso" role="status" aria-live="polite">
              {notice}
            </p>
          ) : null}

          <p className="calls__dica">
            Toque nos círculos para marcar os heróis. Dois toques no último — ou em Chamar — para
            ligar.
          </p>

          {connection !== "online" ? (
            <p className="calls__aviso">À procura do servidor…</p>
          ) : null}
        </section>
      ) : null}

      {escolhido && !call ? (
        <section
          className="foco"
          style={{ "--accent-base": themeById(escolhido.hero).accent }}
          aria-live="polite"
        >
          <div className="foco__palco" aria-hidden="true">
            <span className="foco__anel" />
            <span className="foco__anel foco__anel--atraso" />
            <span className="foco__bolha">
              <ThemeIcon id={escolhido.hero} />
            </span>
          </div>

          <h1 className="foco__nome">{escolhido.name}</h1>
          <p className="foco__estado">
            {escolhido.status === "offline" ? "está offline" : "a chamar…"}
          </p>

          <button type="button" className="foco__cancelar" onClick={cancelarEscolha}>
            Cancelar
          </button>
        </section>
      ) : null}

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
          unread={0}
          eu={me?.hero ?? identity?.hero}
          onMute={() => sessionRef.current?.setMuted(!(view?.muted ?? false))}
          onCamera={() => sessionRef.current?.setCamera(!(view?.camera ?? false))}
          onFlip={() => sessionRef.current?.flipCamera()}
          onFixCamera={() => sessionRef.current?.restartCamera()}
          onEnd={endCall}
        />
      ) : null}


      {!definicoes && !call && tab === "contatos" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-contatos"
          aria-labelledby="aba-contatos"
          tabIndex={0}
        >
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

      {!definicoes && !call && tab === "recados" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-recados"
          aria-labelledby="aba-recados"
          tabIndex={0}
        >
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

      {!definicoes && !call && tab === "canal" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-canal"
          aria-labelledby="aba-canal"
          tabIndex={0}
        >
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
              onClick={() => focus && startCall([focus.hero], kind)}
              disabled={!focus || focus.hero === identity.hero}
            >
              <PhoneIcon />
              Abrir canal
            </button>

            {notice ? (
              <p className="calls__notice" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!definicoes && !call && tab === "mapa" ? (
        <section
          className="calls__panel"
          role="tabpanel"
          id="painel-mapa"
          aria-labelledby="aba-mapa"
          tabIndex={0}
        >
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

      {!definicoes && !escolhido ? (
        <div
          className="calls__tabs calls__tabs--fundo"
          role="tablist"
          aria-label="Seções do comunicador"
          onKeyDown={onTabKeyDown}
        >
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

      {novaVersao ? (
        <Atualizar versao={novaVersao} onFechar={() => setNovaVersao(null)} />
      ) : null}
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
