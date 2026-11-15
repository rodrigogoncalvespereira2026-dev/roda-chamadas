import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { distanceKm, formatKm } from "./geo";
import { PinIcon, TargetIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Mapa do time.
 *
 * O mapa é de satélite de verdade: imagens da Esri (World Imagery, que junta
 * Maxar e Earthstar) com os nomes dos lugares por cima, servidas como tiles
 * pelo Leaflet — nada de abrir o Google Maps. O centro é você (GPS do
 * aparelho). Só aparece o contato que compartilhou a posição — no convite da
 * chamada ou no alerta. Nada disso vai para o servidor: o ponto viaja no
 * alerta e fica só na memória das abas.
 */

const SATELITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ROTULOS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATRIBUICAO =
  'Imagens &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';

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

export default function MapPanel({
  people,
  places = {},
  myPlace,
  onLocate,
  locating,
  geoError,
  onFocus,
}) {
  const alvo = useRef(null);
  const mapa = useRef(null);
  const camada = useRef(null);

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

  /* cria o mapa uma vez; os alfinetes são atualizados no efeito seguinte */
  useEffect(() => {
    if (!alvo.current || mapa.current) return;

    const map = L.map(alvo.current, {
      center: myPlace ? [myPlace.lat, myPlace.lng] : CENTRO_PADRAO,
      zoom: myPlace ? 15 : 12,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    L.tileLayer(SATELITE, { maxZoom: 19, attribution: ATRIBUICAO }).addTo(map);
    L.tileLayer(ROTULOS, { maxZoom: 19, opacity: 0.85 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    camada.current = L.layerGroup().addTo(map);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* alfinetes: você e quem compartilhou a posição */
  useEffect(() => {
    const map = mapa.current;
    const grupo = camada.current;
    if (!map || !grupo) return;

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

  /* quando o GPS responde, o mapa vai para lá */
  useEffect(() => {
    if (!myPlace || !mapa.current) return;

    mapa.current.setView(
      [myPlace.lat, myPlace.lng],
      Math.max(mapa.current.getZoom(), 14)
    );
  }, [myPlace]);

  return (
    <>
      <div className="calls__listHead">
        <h2>Onde está o time</h2>

        <button type="button" className="calls__teamBtn" onClick={onLocate} disabled={locating}>
          <TargetIcon />
          {known ? "Atualizar posição" : "Usar minha localização"}
        </button>
      </div>

      <p className={`map__locate${geoError ? " is-error" : ""}`} role="status" aria-live="polite">
        {locating
          ? "Lendo o GPS do aparelho…"
          : geoError
            ? geoError
            : known
              ? `Sua posição: ${myPlace.lat.toFixed(4)}, ${myPlace.lng.toFixed(4)}`
              : "Sua posição ainda não foi liberada para o comunicador."}
      </p>

      <div className="mapWrap">
        <div
          className="map"
          ref={alvo}
          role="application"
          aria-label="Mapa de satélite com você e os contatos que compartilharam a posição"
        />
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
              <button
                type="button"
                className="map__row"
                style={{ "--accent-base": themeById(person.hero).accent }}
                onClick={() => onFocus?.(person.hero)}
              >
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

                <span className="map__rowDistance">{km != null ? formatKm(km) : statusLabel(person.status)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="calls__empty">Nenhum herói na roda.</p>
      )}

      <p className="calls__hint">
        <PinIcon /> A posição do seu aparelho é lida na hora e fica só nesta aba. Quem recebe um
        alerta vê a posição de quem ligou, e nada é guardado no servidor.
      </p>
    </>
  );
}
