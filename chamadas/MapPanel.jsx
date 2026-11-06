import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { THEMES } from "../carrossel/themes";

/**
 * Mapa do comunicador.
 *
 * O centro é você. Os heróis têm uma posição simulada (estável por id, medida
 * a partir de você), porque são personagens — não há GPS do outro lado. Sua
 * própria posição é real quando o navegador permite: o GPS do aparelho é lido
 * aqui e fica só nesta aba, sem enviar nada para servidor nenhum.
 */

/** Quantos heróis aparecem quando nada está marcado. */
const FALLBACK_COUNT = 6;
/** Raio do mapa que corresponde a 3 km. */
const MAP_RADIUS = 42;

const DIRS = [
  "Leste",
  "Sudeste",
  "Sul",
  "Sudoeste",
  "Oeste",
  "Noroeste",
  "Norte",
  "Nordeste",
];

const GEO_ERRORS = {
  1: "Permissão de localização negada. Libere o acesso nas configurações do navegador para ver onde você está.",
  2: "O aparelho não conseguiu calcular a posição agora.",
  3: "A localização demorou demais para responder. Tente de novo.",
};

function seedOf(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Ângulo e distância fixos por herói — o mesmo pin sempre no mesmo lugar. */
function pinFor(id) {
  const seed = seedOf(id);
  const angle = ((seed % 360) * Math.PI) / 180;
  const distance = 0.35 + ((seed >>> 9) % 265) / 100;
  const ratio = distance / 3;

  return {
    angle,
    distance,
    direction: DIRS[Math.round(angle / (Math.PI / 4)) % 8],
    x: Math.cos(angle) * ratio * MAP_RADIUS,
    y: Math.sin(angle) * ratio * MAP_RADIUS,
  };
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

/** Lê a posição do aparelho quando o usuário permite. */
function useMyPosition() {
  const [state, setState] = useState({ status: "idle", coords: null, error: "" });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported", coords: null, error: "" });
      return;
    }

    setState((current) => ({ ...current, status: "loading", error: "" }));

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setState({
          status: "ready",
          coords: {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
          },
          error: "",
        });
      },
      (error) => {
        setState({
          status: "error",
          coords: null,
          error: GEO_ERRORS[error.code] ?? "Não foi possível ler a localização do aparelho.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  return { ...state, request };
}

function locateLabel(state) {
  if (state.status === "loading") return "Lendo o GPS do aparelho…";
  if (state.status === "ready" && state.coords) {
    return `Sua posição: ${state.coords.lat.toFixed(4)}, ${state.coords.lng.toFixed(
      4
    )} · precisão de ${Math.round(state.coords.accuracy)} m`;
  }
  if (state.status === "error") return state.error;
  if (state.status === "unsupported") return "Este navegador não oferece localização.";
  return "Sua posição ainda não foi liberada para o comunicador.";
}

export default function MapPanel({ selectedThemes = [], onToggle }) {
  const myPosition = useMyPosition();
  const askedRef = useRef(false);

  // Abrir o mapa já pede a posição — o navegador mostra o pedido de permissão.
  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    myPosition.request();
  }, [myPosition.request]);

  /** O time inteiro fica no mapa; quem está marcado ganha destaque. */
  const entries = useMemo(
    () =>
      THEMES.map((theme) => ({ theme, pin: pinFor(theme.id) })).sort(
        (a, b) => a.pin.distance - b.pin.distance
      ),
    []
  );

  const usingSelection = selectedThemes.length > 0;

  /** A lista mostra os marcados ou, sem marcação, os mais próximos de você. */
  const listed = useMemo(() => {
    if (!usingSelection) return entries.slice(0, FALLBACK_COUNT);
    const picked = new Set(selectedThemes.map((theme) => theme.id));
    return entries.filter(({ theme }) => picked.has(theme.id));
  }, [entries, selectedThemes, usingSelection]);

  return (
    <>
      <div className="calls__listHead">
        <h2>Onde está o time</h2>

        <button
          type="button"
          className="calls__teamBtn"
          onClick={myPosition.request}
          disabled={myPosition.status === "loading"}
        >
          <TargetIcon />
          {myPosition.status === "ready" ? "Atualizar posição" : "Usar minha localização"}
        </button>
      </div>

      <p
        className={`map__locate${myPosition.status === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {locateLabel(myPosition)}
      </p>

      <div className="mapWrap">
        <div className="map" role="img" aria-label={`Mapa com os ${entries.length} heróis ao redor de você`}>
          <span className="map__ring" aria-hidden="true" />
          <span className="map__ring" aria-hidden="true" />
          <span className="map__ring" aria-hidden="true" />

          <span className="map__you" aria-hidden="true">
            <span className="map__youDot" />
            você
          </span>

          {entries.map(({ theme, pin }) => {
            const picked = selectedThemes.some((item) => item.id === theme.id);
            return (
              <button
                key={theme.id}
                type="button"
                className={`map__pin${picked ? " is-picked" : ""}`}
                style={{
                  "--accent-base": theme.accent,
                  left: `calc(50% + ${pin.x.toFixed(2)}%)`,
                  top: `calc(50% + ${pin.y.toFixed(2)}%)`,
                }}
                onClick={() => onToggle?.(theme)}
                title={`${theme.name} · ${formatDistance(pin.distance)} a ${pin.direction.toLowerCase()}`}
                aria-label={`${theme.name}, a ${formatDistance(pin.distance)} ${
                  picked ? "· tirar do canal" : "· pôr no canal"
                }`}
                aria-pressed={picked}
              >
                <span className="map__pinIcon" aria-hidden="true">
                  <ThemeIcon id={theme.id} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="calls__hint">
        O centro é você; os anéis só ajudam a ler a distância. Toque num herói para marcar ou
        desmarcar.
      </p>

      <div className="map__listHead">
        <h2 className="calls__label">{usingSelection ? "No mapa" : "Mais perto de você"}</h2>
        <span className="calls__count">
          {listed.length} herói{listed.length > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="map__list">
        {listed.map(({ theme, pin }) => {
          const picked = selectedThemes.some((item) => item.id === theme.id);
          return (
            <li key={theme.id}>
              <button
                type="button"
                className="map__row"
                style={{ "--accent-base": theme.accent }}
                onClick={() => onToggle?.(theme)}
                aria-pressed={picked}
              >
                <span className="map__rowIcon" aria-hidden="true">
                  <ThemeIcon id={theme.id} />
                </span>

                <span className="map__rowWho">
                  <strong>{theme.name}</strong>
                  <span>
                    {theme.kwami ? `Kwami ${theme.kwami}` : "Sem kwami"} · {pin.direction}
                  </span>
                </span>

                <span className="map__rowDistance">{formatDistance(pin.distance)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="calls__hint">
        As posições dos heróis são simuladas. A do seu aparelho é real, só aparece aqui e não é
        enviada para nenhum servidor.
      </p>
    </>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
