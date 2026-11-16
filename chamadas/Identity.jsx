import { useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { THEMES, themeById } from "../carrossel/themes";
import { DownloadIcon, PhoneIcon } from "./icons";
import { IS_NATIVE } from "./plataforma";
import { sessao } from "./armazem";
import { APK_URL, VERSAO_APP, versaoPublicada } from "./versao";
import { instalarNoAparelho } from "./atualizarApk";

/**
 * Porta de entrada: escolher o herói da vez.
 *
 * A identidade é o herói — não há nome de pessoa nem senha. A conta fica na
 * sessão da aba (sessionStorage), então duas abas podem ser dois heróis
 * diferentes, que é como se testa uma chamada no mesmo computador.
 */
export default function Identity({ onEnter, notice }) {
  const [hero, setHero] = useState(() => sessao.ler("roda:hero") ?? "cat");
  const [aAtualizar, setAAtualizar] = useState(false);
  const [estado, setEstado] = useState("");

  /* no APK baixa e instala a versão publicada; no iPhone recarrega a página,
     que é como se recebe a build nova do site */
  const atualizar = async () => {
    if (aAtualizar) return;

    setAAtualizar(true);
    setEstado("A verificar…");

    try {
      const publicada = await versaoPublicada();

      if (!publicada) {
        setEstado(`Sem ligação ao servidor. Está na versão ${VERSAO_APP.nome}.`);
        return;
      }

      if (!IS_NATIVE) {
        setEstado(`A recarregar a versão ${publicada.versao}…`);
        window.location.reload();
        return;
      }

      if (publicada.codigo <= (VERSAO_APP.codigo ?? 0)) {
        setEstado(`Já tem a ${VERSAO_APP.nome}, que é a mais recente.`);
        return;
      }

      setEstado(`A instalar a ${publicada.versao}…`);
      await instalarNoAparelho(APK_URL);
      setEstado(`Versão ${publicada.versao} baixada. Confirme a instalação.`);
    } catch (falha) {
      setEstado(falha?.message ?? "Não consegui atualizar agora.");
    } finally {
      setAAtualizar(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    sessao.guardar("roda:hero", hero);
    onEnter({ hero });
  };

  return (
    <main className="calls calls--gate" style={{ "--accent-base": themeById(hero).accent }}>
      <header className="calls__head">
        <p className="calls__eyebrow">Sistema Miraculous</p>
        <h1>Roda de Chamadas</h1>
        <p className="calls__sub">
          Escolha o seu herói e entre. A roda mostra sempre o time inteiro: o brilho de cada
          círculo diz quem está disponível, a tocar, em chamada ou offline.
        </p>
      </header>

      <form className="gate" onSubmit={submit}>
        <div className="gate__heroes">
          <span className="calls__label">Seu herói</span>

          <div className="gate__grid" role="radiogroup" aria-label="Escolha o seu herói">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={theme.id === hero}
                className={`gate__hero${theme.id === hero ? " is-on" : ""}`}
                style={{ "--accent-base": theme.accent }}
                onClick={() => setHero(theme.id)}
                title={theme.name}
              >
                <ThemeIcon id={theme.id} />
                <span>{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <p className="calls__notice" role="status">
            {notice}
          </p>
        ) : null}

        <button type="submit" className="calls__callBtn">
          <PhoneIcon />
          Entrar como {themeById(hero).name}
        </button>

        <div className="gate__update">
          <button
            type="button"
            className="calls__teamBtn"
            onClick={atualizar}
            disabled={aAtualizar}
          >
            <DownloadIcon />
            {aAtualizar ? "A verificar…" : "Atualizar app"}
          </button>

          <p className="gate__updateMsg" role="status" aria-live="polite">
            {estado || `Versão ${VERSAO_APP.nome}`}
          </p>
        </div>

        <p className="calls__hint">
          Quem abrir o site com o mesmo herói assume a vez — como chamar no mesmo canal. Sem
          cadastro e sem senha.
        </p>
      </form>
    </main>
  );
}
