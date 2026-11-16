import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { distanceKm, formatKm, mapsLink } from "./geo";
import { PhoneCallIcon, PinIcon } from "./icons";

/**
 * Ecrã de chamada a receber, à maneira do comunicador do desenho: sem cartão,
 * tela cheia na cor de quem liga, o emblema do herói dentro de um círculo e
 * três anéis a abrir ao ritmo do toque. Os dois botões ficam nas pontas de
 * baixo, redondos e grandes.
 *
 * Alertas que chegam enquanto este está aberto ficam na fila — o contador
 * aparece no topo.
 */
export default function IncomingCall({ invite, queued = 0, myPlace, onAccept, onReject }) {
  const accent = themeById(invite.from.hero).accent;
  const km = distanceKm(myPlace, invite.place);

  return (
    <div
      className="ring"
      style={{ "--accent-base": accent }}
      role="dialog"
      aria-modal="true"
      aria-label={`Chamada de ${invite.from.name}`}
    >
      <div className="ring__glow" aria-hidden="true" />

      <div className="ring__ondas" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="ring__centro">
        <p className="ring__kind">
          {invite.kind === "video" ? "Videochamada" : "Chamada de voz"}
          {queued > 0 ? ` · +${queued} na fila` : ""}
        </p>

        <div className="ring__avatar">
          <ThemeIcon id={invite.from.hero} />
        </div>

        <h2 className="ring__name">{invite.from.name}</h2>

        <p className="ring__status" role="status" aria-live="assertive">
          está te chamando…
        </p>

        {invite.place ? (
          <p className="ring__place">
            <PinIcon />
            {km != null ? `a ${formatKm(km)} de você` : "compartilhou a localização"}
            {" · "}
            <a href={mapsLink(invite.place)} target="_blank" rel="noreferrer noopener">
              ver no mapa
            </a>
          </p>
        ) : (
          <p className="ring__place ring__place--muted">não compartilhou a localização</p>
        )}
      </div>

      <div className="ring__actions">
        <button type="button" className="ring__btn ring__btn--recusar" onClick={onReject}>
          <span className="ring__btnIcone">
            <PhoneCallIcon down />
          </span>
          <span className="ring__btnTexto">Recusar</span>
        </button>

        <button type="button" className="ring__btn ring__btn--atender" onClick={onAccept} autoFocus>
          <span className="ring__btnIcone">
            <PhoneCallIcon />
          </span>
          <span className="ring__btnTexto">Atender</span>
        </button>
      </div>
    </div>
  );
}
