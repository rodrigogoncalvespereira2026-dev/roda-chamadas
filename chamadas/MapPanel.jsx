import { useMemo } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { distanceKm, formatKm, mapsLink } from "./geo";
import { PinIcon, TargetIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Mapa do time.
 *
 * O centro é você (GPS do aparelho). Só aparece o contato que compartilhou a
 * posição — no convite da chamada ou no alerta. Onde não há posição, a lista
 * mostra o estado e diz que ninguém compartilhou nada. Nada disso vai para o
 * servidor: o ponto viaja no alerta e fica só na memória das abas.
 */

/** Distância (km) que cabe da borda ao centro do mapa. */
const MAP_RADIUS_KM = 3;

export default function MapPanel({
  people,
  places = {},
  myPlace,
  onLocate,
  locating,
  geoError,
  onFocus,
}) {
  const contacts = people.filter((person) => person.contact);

  const entries = useMemo(() => {
    return contacts
      .map((person) => {
        const place = places[person.name] ?? null;
        const km = place && myPlace ? distanceKm(myPlace, place) : null;

        let x = null;
        let y = null;

        if (place && myPlace) {
          const north = (place.lat - myPlace.lat) * 110.574;
          const east =
            (place.lng - myPlace.lng) * 111.32 * Math.cos((myPlace.lat * Math.PI) / 180);
          const ratio = 42 / MAP_RADIUS_KM;

          x = Math.max(6, Math.min(94, 50 + east * ratio));
          y = Math.max(6, Math.min(94, 50 - north * ratio));
        }

        return { person, place, km, x, y };
      })
      .sort((a, b) => (a.km == null ? 1 : 0) - (b.km == null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0));
  }, [contacts, places, myPlace]);

  const shared = entries.filter((entry) => entry.place);
  const known = Boolean(myPlace);

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
        <div className="map" role="img" aria-label="Mapa dos contatos ao redor de você">
          <span className="map__ring" aria-hidden="true" />
          <span className="map__ring" aria-hidden="true" />
          <span className="map__ring" aria-hidden="true" />

          <span className="map__you" aria-hidden="true">
            <span className="map__youDot" />
            você
          </span>

          {known
            ? entries
                .filter((entry) => entry.x != null)
                .map(({ person, x, y, km, place }) => (
                  <a
                    key={person.name}
                    className="map__pin"
                    style={{
                      "--accent-base": themeById(person.hero).accent,
                      left: `${x}%`,
                      top: `${y}%`,
                    }}
                    href={mapsLink(place)}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={`${person.name} · ${formatKm(km)}`}
                    aria-label={`${person.name}, a ${formatKm(km)} de você`}
                  >
                    <span className="map__pinIcon" aria-hidden="true">
                      <ThemeIcon id={person.hero} />
                    </span>
                  </a>
                ))
            : null}
        </div>
      </div>

      <p className="calls__hint">
        {known
          ? "Cada alfinete é um contato que compartilhou a posição no último alerta. Toque para abrir no mapa."
          : "Libere sua localização para ver a distância até quem compartilhou."}
      </p>

      <div className="map__listHead">
        <h2 className="calls__label">Contatos</h2>
        <span className="calls__count">
          {shared.length} de {contacts.length} com posição
        </span>
      </div>

      {entries.length ? (
        <ul className="map__list">
          {entries.map(({ person, place, km }) => (
            <li key={person.name}>
              <button
                type="button"
                className="map__row"
                style={{ "--accent-base": themeById(person.hero).accent }}
                onClick={() => onFocus?.(person.name)}
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
        <p className="calls__empty">Nenhum contato na roda ainda.</p>
      )}

      <p className="calls__hint">
        <PinIcon /> A posição do seu aparelho é lida na hora e fica só nesta aba. Quem recebe um
        alerta vê a posição de quem ligou, e nada é guardado no servidor.
      </p>
    </>
  );
}
