import { useEffect, useState } from "react";
import { themeById } from "../carrossel/themes";
import "./instalacao.css";

/**
 * Porta de entrada do iPhone: um botão para instalar a app antes de a roda
 * abrir.
 *
 * Onde o navegador permite (Chrome, Edge, Android), o botão abre o pedido de
 * instalação do próprio sistema. No Safari do iPhone não existe esse pedido:
 * a única forma é "Adicionar ao Ecrã Principal", que é um menu do sistema. Aí
 * o botão não pode instalar sozinho, então mostra o caminho exato a seguir.
 */

/** Seta para dentro de uma caixa: o desenho de "baixar/instalar". */
function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5v10.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      <path
        d="m7.7 9.9 4.3 4.3 4.3-4.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4.5 16.6v2.3A1.8 1.8 0 0 0 6.3 20.7h11.4a1.8 1.8 0 0 0 1.8-1.8v-2.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

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
  const [pedido, setPedido] = useState(null);
  const [passos, setPassos] = useState(false);

  /* O Chrome/Edge guardam o pedido de instalação num evento; o botão dispara-o. */
  useEffect(() => {
    const guardar = (event) => {
      event.preventDefault();
      setPedido(event);
    };

    window.addEventListener("beforeinstallprompt", guardar);
    return () => window.removeEventListener("beforeinstallprompt", guardar);
  }, []);

  const instalar = async () => {
    if (pedido) {
      await pedido.prompt();
      setPedido(null);
      return;
    }

    setPassos(true);
  };

  return (
    <main className="calls calls--gate instalacao" style={{ "--accent-base": themeById("cat").accent }}>
      <div className="instalacao__capa">
        <img className="instalacao__icone" src="/icons/icon-192.png" alt="" width="104" height="104" />

        <h1 className="instalacao__titulo">Roda de Chamadas</h1>
        <p className="calls__sub instalacao__sub">
          Instale a app para girar a roda e chamar o time direto do ecrã principal, em ecrã
          inteiro.
        </p>

        <button type="button" className="instalacao__instalar" onClick={instalar}>
          <InstallIcon />
          Instalar
        </button>

        {passos ? (
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
                Escolha <strong>Adicionar ao Ecrã Principal</strong>
              </p>
            </li>

            <li className="instalacao__passo">
              <span className="instalacao__numero" aria-hidden="true">
                3
              </span>
              <p>
                Confirme em <strong>Adicionar</strong> e abra pelo ícone
              </p>
            </li>
          </ol>
        ) : null}

        <button type="button" className="instalacao__depois" onClick={onContinuar}>
          Continuar no Safari
        </button>
      </div>
    </main>
  );
}
