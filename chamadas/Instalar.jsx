import { themeById } from "../carrossel/themes";
import "./instalacao.css";

/**
 * Porta de entrada do iPhone: antes de a roda abrir, a app pede para ser
 * instalada no ecrã principal.
 *
 * No iOS não há loja nem APK: uma página do Safari passa a app quando o
 * utilizador a põe no ecrã principal. Esse passo é do Safari — o JavaScript não
 * consegue abrir o menu por ninguém — por isso o ecrã ensina o caminho e deixar
 * seguir no navegador é uma escolha explícita de quem está a usar.
 */

/** Ícone de partilhar do iOS: quadrado com a seta a sair por cima. */
function ShareIcon() {
  return (
    <svg className="instalacao__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2v10.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path
        d="m8.5 6.6 3.5-3.4 3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7.4 10.2H5.8A1.8 1.8 0 0 0 4 12v7.2A1.8 1.8 0 0 0 5.8 21h12.4a1.8 1.8 0 0 0 1.8-1.8V12a1.8 1.8 0 0 0-1.8-1.8h-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Instalar({ onContinuar }) {
  return (
    <main className="calls calls--gate instalacao" style={{ "--accent-base": themeById("cat").accent }}>
      <header className="calls__head">
        <p className="calls__eyebrow">Roda de Chamadas</p>
        <h1>Instale a app no iPhone</h1>
        <p className="calls__sub">
          No iPhone a Roda de Chamadas não vem de uma loja: fica no ecrã principal, com o ícone
          da roda, e a partir daí abre em ecrã inteiro como qualquer outra app.
        </p>
      </header>

      <ol className="instalacao__passos">
        <li className="instalacao__passo">
          <span className="instalacao__numero" aria-hidden="true">
            1
          </span>
          <p>
            Toque em <strong>Partilhar</strong> na barra do Safari <ShareIcon />
          </p>
        </li>

        <li className="instalacao__passo">
          <span className="instalacao__numero" aria-hidden="true">
            2
          </span>
          <p>
            Na lista, escolha <strong>Adicionar ao Ecrã Principal</strong>
          </p>
        </li>

        <li className="instalacao__passo">
          <span className="instalacao__numero" aria-hidden="true">
            3
          </span>
          <p>
            Confirme em <strong>Adicionar</strong>
          </p>
        </li>

        <li className="instalacao__passo">
          <span className="instalacao__numero" aria-hidden="true">
            4
          </span>
          <p>
            Abra pelo ícone <strong>Roda de Chamadas</strong> — a app abre sem a barra do Safari
          </p>
        </li>
      </ol>

      <div className="instalacao__acoes">
        <button type="button" className="instalacao__btn" onClick={onContinuar}>
          Continuar no Safari
        </button>
        <p className="calls__notice">
          Enquanto não instalar, a app funciona aqui mesmo, mas sem o ícone no ecrã principal e
          sem ecrã inteiro.
        </p>
      </div>
    </main>
  );
}
