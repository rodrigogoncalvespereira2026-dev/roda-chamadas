import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { distanceKm, formatKm } from "./geo";
import {
  BookmarkIcon,
  CopyIcon,
  ExpandIcon,
  PinIcon,
  RouteIcon,
  RulerIcon,
  ShrinkIcon,
  TargetIcon,
} from "./icons";
import { statusLabel } from "./status";

/**
 * Mapa do time.
 *
 * Imagens de satélite da Esri (World Imagery, com Maxar e Earthstar) e ruas do
 * OpenStreetMap, servidas como tiles pelo Leaflet — nada de abrir o Google
 * Maps. O centro é você (GPS do aparelho). Só aparece o contato que
 * compartilhou a posição — no convite da chamada ou no alerta. Nada disso vai
 * para o servidor: o ponto viaja no alerta e fica só na memória das abas.
 */

const SATELITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ROTULOS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const RUAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATRIBUICAO_SATELITE =
  'Imagens &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';
const ATRIBUICAO_RUAS =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const BASES = {
  satelite: { rotulo: "Satélite", camadas: () => [[SATELITE, ATRIBUICAO_SATELITE]] },
  hibrido: {
    rotulo: "Híbrido",
    camadas: () =>
      [([SATELITE, ATRIBUICAO_SATELITE]), ([ROTULOS, ATRIBUICAO_SATELITE])],
  },
  ruas: { rotulo: "Ruas", camadas: () => [[RUAS, ATRIBUICAO_RUAS]] },
};

/* sem GPS ainda, o mapa abre em Lisboa em vez de ficar cinzento */
const CENTRO_PADRAO = [38.7223, -9.1393];

const iconePin = (hero) => {
  const tema = themeById(hero);

  return L.divIcon({
    className: "mapPin",
    html: `<span class="mapPin__dot" style="--pin:${tema.accent}">${tema.name.slice(0, 1)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const ICONE_VOCE = L.divIcon({
  className: "mapPin mapPin--voce",
  html: '<span class="mapPin__voce"><span></span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const ICONE_BUSCA = L.divIcon({
  className: "mapPin mapPin--busca",
  html: '<span class="mapPin__busca"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const ICONE_LUGAR = L.divIcon({
  className: "mapPin mapPin--lugar",
  html: '<span class="mapPin__lugar"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 22],
});

/* OSRM público: rotas pelas ruas, com tempo estimado de carro */
const ROTAS = "https://router.project-osrm.org/route/v1/driving";

const CHAVE_LUGARES = "roda:lugares";

function lerLugares() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CHAVE_LUGARES) ?? "[]");

    return Array.isArray(guardados)
      ? guardados.filter((lugar) => lugar && typeof lugar.lat === "number")
      : [];
  } catch {
    return [];
  }
}

function gravarLugares(lista) {
  try {
    localStorage.setItem(CHAVE_LUGARES, JSON.stringify(lista.slice(0, 20)));
  } catch {
    /* sem armazenamento (aba privada): a lista vale só enquanto a aba viver */
  }
}

/** "12 min" ou "1 h 05". */
function formatMinutos(minutos) {
  const total = Math.max(1, Math.round(minutos));
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;

  return `${horas} h ${String(resto).padStart(2, "0")}`;
}

export default function MapPanel({
  people,
  places = {},
  myPlace,
  onLocate,
  locating,
  geoError,
}) {
  const alvo = useRef(null);
  const mapa = useRef(null);
  const camada = useRef(null);
  const baseCamadas = useRef([]);
  const reguaCamada = useRef(null);
  const buscaCamada = useRef(null);
  const rotaCamada = useRef(null);
  const lugaresCamada = useRef(null);
  const reguaLigada = useRef(false);

  const [base, setBase] = useState("satelite");
  const [regua, setRegua] = useState(false);
  const [pontos, setPontos] = useState([]);
  const [cheio, setCheio] = useState(false);
  const [procurar, setProcurar] = useState("");
  const [aProcurar, setAProcurar] = useState(false);
  const [achado, setAchado] = useState("");
  const [achadoLugar, setAchadoLugar] = useState(null);
  const [rota, setRota] = useState(null);
  const [aRotar, setARotar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [lugares, setLugares] = useState(lerLugares);
  const [guardarAberto, setGuardarAberto] = useState(false);
  const [nomeLugar, setNomeLugar] = useState("");
  const [copiado, setCopiado] = useState(false);

  const entries = useMemo(() => {
    return people
      .map((person) => {
        const place = places[person.hero] ?? null;
        const km = place && myPlace ? distanceKm(myPlace, place) : null;

        return { person, place, km };
      })
      .sort((a, b) => (a.km == null ? 1 : 0) - (b.km == null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0));
  }, [people, places, myPlace]);

  const shared = entries.filter((entry) => entry.place);
  const known = Boolean(myPlace);

  /* distância total marcada com a régua */
  const medida = useMemo(() => {
    let total = 0;

    for (let i = 1; i < pontos.length; i += 1) {
      total += distanceKm(
        { lat: pontos[i - 1][0], lng: pontos[i - 1][1] },
        { lat: pontos[i][0], lng: pontos[i][1] }
      );
    }

    return total;
  }, [pontos]);

  /* cria o mapa uma vez; o resto é atualizado nos efeitos seguintes */
  useEffect(() => {
    if (!alvo.current || mapa.current) return;

    const map = L.map(alvo.current, {
      center: myPlace ? [myPlace.lat, myPlace.lng] : CENTRO_PADRAO,
      zoom: myPlace ? 15 : 12,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 90 }).addTo(map);

    camada.current = L.layerGroup().addTo(map);
    reguaCamada.current = L.layerGroup().addTo(map);
    buscaCamada.current = L.layerGroup().addTo(map);
    lugaresCamada.current = L.layerGroup().addTo(map);
    /* a rota fica por baixo dos alfinetes, mas acima das ruas */
    rotaCamada.current = L.layerGroup().addTo(map);
    mapa.current = map;

    /* o painel pode aparecer já montado com altura 0: mede outra vez e volta
       a fixar o centro, senão o Leaflet abre com o zoom errado */
    const medir = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(myPlace ? [myPlace.lat, myPlace.lng] : CENTRO_PADRAO, myPlace ? 15 : 12);
    }, 150);

    return () => {
      window.clearTimeout(medir);
      map.remove();
      mapa.current = null;
      camada.current = null;
      reguaCamada.current = null;
      buscaCamada.current = null;
      rotaCamada.current = null;
      lugaresCamada.current = null;
      baseCamadas.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* camadas de base: satélite, híbrido ou ruas */
  useEffect(() => {
    const map = mapa.current;
    if (!map) return;

    baseCamadas.current.forEach((camadaBase) => map.removeLayer(camadaBase));
    baseCamadas.current = BASES[base].camadas().map(([url, atribuicao]) =>
      L.tileLayer(url, { maxZoom: 19, attribution: atribuicao }).addTo(map)
    );
  }, [base]);

  /* alfinetes: você e quem compartilhou a posição */
  useEffect(() => {
    const grupo = camada.current;
    if (!grupo) return;

    grupo.clearLayers();

    if (myPlace) {
      L.marker([myPlace.lat, myPlace.lng], { icon: ICONE_VOCE, zIndexOffset: 900 })
        .addTo(grupo)
        .bindTooltip("Você");
    }

    entries.forEach(({ person, place, km }) => {
      if (!place) return;

      L.marker([place.lat, place.lng], { icon: iconePin(person.hero) })
        .addTo(grupo)
        .bindTooltip(`${person.name} · ${formatKm(km)}`, {
          direction: "top",
          offset: [0, -12],
        })
        .bindPopup(`<strong>${person.name}</strong><br>${formatKm(km)} de você`);
    });
  }, [entries, myPlace]);

  /* régua: cada toque no mapa marca um ponto */
  useEffect(() => {
    reguaLigada.current = regua;
  }, [regua]);

  useEffect(() => {
    const map = mapa.current;
    if (!map) return;

    const aoClicar = (evento) => {
      if (!reguaLigada.current) return;
      setPontos((atuais) => [...atuais, [evento.latlng.lat, evento.latlng.lng]]);
    };

    map.on("click", aoClicar);
    return () => map.off("click", aoClicar);
  }, []);

  useEffect(() => {
    const grupo = reguaCamada.current;
    if (!grupo) return;

    grupo.clearLayers();
    if (!pontos.length) return;

    if (pontos.length > 1) {
      L.polyline(pontos, { color: "#22ff44", weight: 3, dashArray: "7 7" }).addTo(grupo);
    }

    pontos.forEach((ponto, indice) => {
      L.circleMarker(ponto, {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: "#22ff44",
        fillOpacity: 1,
      })
        .addTo(grupo)
        .bindTooltip(String(indice + 1));
    });
  }, [pontos]);

  /* rota desenhada pelas ruas */
  useEffect(() => {
    const grupo = rotaCamada.current;
    if (!grupo) return;

    grupo.clearLayers();
    if (!rota?.pontos?.length) return;

    L.polyline(rota.pontos, { color: "#22ff44", weight: 7, opacity: 0.3 }).addTo(grupo);
    L.polyline(rota.pontos, { color: "#22ff44", weight: 3 }).addTo(grupo);
  }, [rota]);

  /* lugares guardados no aparelho */
  useEffect(() => {
    const grupo = lugaresCamada.current;
    if (!grupo) return;

    grupo.clearLayers();

    lugares.forEach((lugar) => {
      L.marker([lugar.lat, lugar.lng], { icon: ICONE_LUGAR })
        .addTo(grupo)
        .bindTooltip(lugar.nome, { direction: "top", offset: [0, -18] });
    });
  }, [lugares]);

  /* quando o GPS responde, o mapa vai para lá */
  useEffect(() => {
    if (!myPlace || !mapa.current) return;

    mapa.current.setView([myPlace.lat, myPlace.lng], Math.max(mapa.current.getZoom(), 14));
  }, [myPlace]);

  /* ecrã inteiro: o Leaflet precisa de medir outra vez */
  useEffect(() => {
    const map = mapa.current;
    if (!map) return;

    /* o painel das abas é animado com transform, e um antepassado
       transformado prende o position: fixed dentro dele — daí a classe no body */
    document.body.classList.toggle("mapaCheio", cheio);

    const medir = window.setTimeout(() => map.invalidateSize(), 220);
    return () => {
      window.clearTimeout(medir);
      document.body.classList.remove("mapaCheio");
    };
  }, [cheio]);

  const centrarEmMim = () => {
    if (!mapa.current) return;

    if (myPlace) {
      mapa.current.setView([myPlace.lat, myPlace.lng], 16);
      return;
    }

    onLocate?.();
  };

  /* procura de lugares (Photon, sobre os dados do OpenStreetMap) */
  const buscar = async (evento) => {
    evento.preventDefault();
    const termo = procurar.trim();
    if (!termo || aProcurar) return;

    setAProcurar(true);
    setAchado("A procurar…");

    try {
      const resposta = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(termo)}&limit=1`
      );
      if (!resposta.ok) throw new Error();

      const dados = await resposta.json();
      const primeiro = dados?.features?.[0];

      if (!primeiro) {
        setAchado(`Nada encontrado para “${termo}”.`);
        return;
      }

      const [lng, lat] = primeiro.geometry.coordinates;
      const nome =
        primeiro.properties.name ?? primeiro.properties.city ?? primeiro.properties.street ?? termo;

      mapa.current?.setView([lat, lng], 16);

      buscaCamada.current?.clearLayers();
      L.marker([lat, lng], { icon: ICONE_BUSCA })
        .addTo(buscaCamada.current)
        .bindPopup(`<strong>${nome}</strong>`)
        .openPopup();

      setAchado(nome);
      setAchadoLugar({ lat, lng, nome });
    } catch {
      setAchado("Não consegui procurar agora. Verifique a ligação.");
    } finally {
      setAProcurar(false);
    }
  };

  const alternarRegua = () => {
    setRegua((ligada) => {
      if (ligada) setPontos([]);
      return !ligada;
    });
  };

  /* rota pelas ruas até um ponto (contato, lugar guardado ou procura) */
  const tracarRota = async (destino) => {
    if (!destino || aRotar) return;

    if (!myPlace) {
      setAviso("Libere sua localização para traçar a rota.");
      onLocate?.();
      return;
    }

    setAviso("");
    setARotar(true);

    try {
      const url =
        `${ROTAS}/${myPlace.lng},${myPlace.lat};${destino.lng},${destino.lat}` +
        "?overview=full&geometries=geojson";

      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error();

      const dados = await resposta.json();
      const caminho = dados?.routes?.[0];

      if (!caminho) {
        setAviso("Não encontrei uma rota pelas ruas até aí.");
        return;
      }

      const pontosRota = caminho.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      setRota({
        nome: destino.nome ?? "o destino",
        km: caminho.distance / 1000,
        min: caminho.duration / 60,
        pontos: pontosRota,
      });

      mapa.current?.fitBounds(L.latLngBounds(pontosRota), { padding: [28, 28] });
    } catch {
      setAviso("Não consegui calcular a rota agora. Verifique a ligação.");
    } finally {
      setARotar(false);
    }
  };

  /* guarda o centro do mapa como lugar, no próprio aparelho */
  const guardarLugar = (evento) => {
    evento?.preventDefault();

    const centro = mapa.current?.getCenter();
    if (!centro) return;

    const nome = nomeLugar.trim() || `Lugar ${lugares.length + 1}`;
    const novo = { id: String(Date.now()), nome, lat: centro.lat, lng: centro.lng };

    setLugares((atuais) => {
      const lista = [novo, ...atuais].slice(0, 20);
      gravarLugares(lista);

      return lista;
    });

    setNomeLugar("");
    setGuardarAberto(false);
  };

  const apagarLugar = (id) => {
    setLugares((atuais) => {
      const lista = atuais.filter((lugar) => lugar.id !== id);
      gravarLugares(lista);

      return lista;
    });
  };

  /* link do OpenStreetMap, para mandar a posição a alguém */
  const copiarPosicao = async () => {
    if (!myPlace) return;

    const lat = myPlace.lat.toFixed(6);
    const lng = myPlace.lng.toFixed(6);
    const texto = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

    try {
      /* no telemóvel abre a folha de partilha; no computador copia */
      if (navigator.share) {
        await navigator.share({ title: "A minha posição", url: texto });
      } else {
        await navigator.clipboard.writeText(texto);
      }

      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem clipboard nem partilha: mostra o link para copiar à mão */
      setAviso(`Copie este link: ${texto}`);
    }
  };

  /* tocar num contato da lista leva o mapa até ele */
  const irPara = (person) => {
    const place = places[person.hero];
    if (place && mapa.current) {
      mapa.current.setView([place.lat, place.lng], 16);
    }
  };

  return (
    <>
      <div className="calls__listHead">
        <h2>Onde está o time</h2>

        <button type="button" className="calls__teamBtn" onClick={onLocate} disabled={locating}>
          <TargetIcon />
          {known ? "Atualizar posição" : "Usar minha localização"}
        </button>
      </div>

      <div className="map__locateLinha">
        <p
          className={`map__locate${geoError ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {locating
            ? "Lendo o GPS do aparelho…"
            : geoError
              ? geoError
              : known
                ? `Sua posição: ${myPlace.lat.toFixed(4)}, ${myPlace.lng.toFixed(4)}`
                : "Sua posição ainda não foi liberada para o comunicador."}
        </p>

        {known && !locating ? (
          <button type="button" className="map__copiar" onClick={copiarPosicao}>
            <CopyIcon />
            {copiado ? "link copiado" : "copiar link"}
          </button>
        ) : null}
      </div>

      <form className="map__busca" onSubmit={buscar}>
        <input
          className="calls__search"
          type="search"
          value={procurar}
          onChange={(evento) => setProcurar(evento.target.value)}
          placeholder="Procurar rua, cidade ou lugar"
          aria-label="Procurar lugar no mapa"
        />
        <button type="submit" className="calls__teamBtn" disabled={aProcurar || !procurar.trim()}>
          {aProcurar ? "…" : "Ir"}
        </button>
      </form>

      {achado ? (
        <p className="map__achado" role="status" aria-live="polite">
          {achado}

          {achadoLugar ? (
            <button
              type="button"
              className="map__achadoRota"
              disabled={aRotar}
              onClick={() => tracarRota(achadoLugar)}
            >
              <RouteIcon /> rota até aqui
            </button>
          ) : null}
        </p>
      ) : null}

      {aviso ? (
        <p className="map__aviso" role="status" aria-live="polite">
          {aviso}
        </p>
      ) : null}

      {guardarAberto ? (
        <form className="map__guardar" onSubmit={guardarLugar}>
          <input
            className="calls__search"
            value={nomeLugar}
            onChange={(evento) => setNomeLugar(evento.target.value)}
            placeholder="Nome do lugar (guarda o centro do mapa)"
            aria-label="Nome do lugar a guardar"
          />

          <button type="submit" className="calls__teamBtn">
            Guardar
          </button>
        </form>
      ) : null}

      <div className={`mapWrap${cheio ? " mapWrap--cheio" : ""}`}>
        <div
          className="map"
          ref={alvo}
          role="application"
          aria-label="Mapa de satélite com você e os contatos que compartilharam a posição"
        />

        <div className="map__bases" role="group" aria-label="Tipo de mapa">
          {Object.entries(BASES).map(([id, opcao]) => (
            <button
              key={id}
              type="button"
              className="map__base"
              aria-pressed={base === id}
              onClick={() => setBase(id)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        <div className="map__ferramentas">
          <button
            type="button"
            className="map__ferramenta"
            title={known ? "Centrar em mim" : "Usar a minha localização"}
            aria-label={known ? "Centrar em mim" : "Usar a minha localização"}
            onClick={centrarEmMim}
          >
            <TargetIcon />
          </button>

          <button
            type="button"
            className="map__ferramenta"
            aria-pressed={guardarAberto}
            title="Guardar o centro do mapa"
            aria-label="Guardar o centro do mapa"
            onClick={() => setGuardarAberto((aberto) => !aberto)}
          >
            <BookmarkIcon />
          </button>

          <button
            type="button"
            className="map__ferramenta"
            aria-pressed={regua}
            title="Medir distância"
            aria-label="Medir distância"
            onClick={alternarRegua}
          >
            <RulerIcon />
          </button>

          <button
            type="button"
            className="map__ferramenta"
            title={cheio ? "Sair do ecrã inteiro" : "Ecrã inteiro"}
            aria-label={cheio ? "Sair do ecrã inteiro" : "Ecrã inteiro"}
            onClick={() => setCheio((aberto) => !aberto)}
          >
            {cheio ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
        </div>

        {rota ? (
          <div className="map__rota" role="status">
            <RouteIcon />
            <span>
              {formatKm(rota.km)} · {formatMinutos(rota.min)} de carro até {rota.nome}
            </span>
            <button type="button" onClick={() => setRota(null)}>
              limpar
            </button>
          </div>
        ) : null}

        {regua ? (
          <div className={`map__medida${rota ? " map__medida--acima" : ""}`} role="status">
            {pontos.length
              ? `${formatKm(medida)} · ${pontos.length} ${pontos.length === 1 ? "ponto" : "pontos"}`
              : "Toque no mapa para marcar os pontos."}
            {pontos.length ? (
              <button type="button" onClick={() => setPontos([])}>
                limpar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="calls__hint">
        {known
          ? "Cada alfinete é um contato que compartilhou a posição no último alerta. Toque para ver o nome e a distância."
          : "Libere sua localização para ver a distância até quem compartilhou."}
      </p>

      <div className="map__listHead">
        <h2 className="calls__label">Contatos</h2>
        <span className="calls__count">
          {shared.length} de {people.length} com posição
        </span>
      </div>

      {entries.length ? (
        <ul className="map__list">
          {entries.map(({ person, place, km }) => (
            <li key={person.hero}>
              <div className="map__row" style={{ "--accent-base": themeById(person.hero).accent }}>
                <button type="button" className="map__rowMain" onClick={() => irPara(person)}>
                  <span className="map__rowIcon" aria-hidden="true">
                    <ThemeIcon id={person.hero} />
                  </span>

                  <span className="map__rowWho">
                    <strong>{person.name}</strong>
                    <span>
                      {place
                        ? `posição de ${new Date(place.at ?? Date.now()).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "sem localização compartilhada"}
                    </span>
                  </span>

                  <span className="map__rowDistance">
                    {km != null ? formatKm(km) : statusLabel(person.status)}
                  </span>
                </button>

                {place ? (
                  <button
                    type="button"
                    className="map__rowRota"
                    disabled={aRotar}
                    aria-label={`Rota até ${person.name}`}
                    title={`Rota até ${person.name}`}
                    onClick={() => tracarRota({ ...place, nome: person.name })}
                  >
                    <RouteIcon />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="calls__empty">Nenhum herói na roda.</p>
      )}

      {lugares.length ? (
        <>
          <div className="map__listHead">
            <h2 className="calls__label">Lugares guardados</h2>
            <span className="calls__count">{lugares.length}</span>
          </div>

          <ul className="map__list">
            {lugares.map((lugar) => (
              <li key={lugar.id}>
                <div className="map__row map__row--lugar">
                  <button
                    type="button"
                    className="map__rowMain"
                    onClick={() => mapa.current?.setView([lugar.lat, lugar.lng], 16)}
                  >
                    <span className="map__rowIcon" aria-hidden="true">
                      <BookmarkIcon />
                    </span>

                    <span className="map__rowWho">
                      <strong>{lugar.nome}</strong>
                      <span>
                        {lugar.lat.toFixed(4)}, {lugar.lng.toFixed(4)}
                      </span>
                    </span>

                    <span className="map__rowDistance">
                      {myPlace ? formatKm(distanceKm(myPlace, lugar)) : ""}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="map__rowRota map__rowRota--apagar"
                    aria-label={`Apagar ${lugar.nome}`}
                    title={`Apagar ${lugar.nome}`}
                    onClick={() => apagarLugar(lugar.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="calls__hint">
        <PinIcon /> A posição do seu aparelho é lida na hora e fica só nesta aba. Quem recebe um
        alerta vê a posição de quem ligou, e nada é guardado no servidor.
      </p>
    </>
  );
}
