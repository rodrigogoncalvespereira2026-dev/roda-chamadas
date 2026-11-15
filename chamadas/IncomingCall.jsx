import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { distanceKm, formatKm, mapsLink } from "./geo";
import { PhoneCallIcon, PinIcon } from "./icons";

/**
 * Ecrã de chamada a receber.
 *
 * Fica por cima de tudo: quem está a chamar, de que tipo, onde está (se ele
 * autorizou enviar a posição) e os dois botões. Alertas que chegam enquanto
 * este está aberto ficam na fila — o contador aparece no cartão.
 */
export default function IncomingCall({ invite, queued = 0, myPlace, onAccept, onReject }) {
  const accent = themeById(invite.from.hero).accent;
  const km = distanceKm(myPlace, invite.place);

  return (
    <div className="ring" style={{ "--accent-base": accent }} role="dialog" aria-modal="true" aria-label={`Chamada de ${invite.from.name}`}>
      <div className="ring__glow" aria-hidden="true" />

      <div className="ring__card">
        <p className="ring__kind">
          {invite.kind === "video" ? "Videochamada" : "Chamada de voz"}
          {queued > 0 ? ` · +${queued} na fila` : ""}
        </p>

        <div className="ring__avatar">
          <span className="ring__pulse" aria-hidden="true" />
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

        <div className="ring__actions">
          <button type="button" className="call__btn call__btn--end" onClick={onReject}>
            <PhoneCallIcon down />
            <span>Recusar</span>
          </button>

          <button type="button" className="call__btn call__btn--answer" onClick={onAccept} autoFocus>
            <PhoneCallIcon />
            <span>Atender</span>
          </button>
        </div>
      </div>
    </div>
  );
}
