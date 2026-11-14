import { useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { DEFAULT_THEME, THEMES } from "../carrossel/themes";
import { PhoneIcon } from "./icons";

/**
 * Porta de entrada: nome + herói.
 *
 * A conta fica na sessão da aba (sessionStorage), então duas abas podem ser
 * duas pessoas diferentes — é assim que se testa uma chamada no mesmo
 * computador. O servidor guarda nome, herói e contatos.
 */
export default function Identity({ onEnter, notice }) {
  const [name, setName] = useState(() => sessionStorage.getItem("roda:nome") ?? "");
  const [hero, setHero] = useState(() => sessionStorage.getItem("roda:hero") ?? DEFAULT_THEME);
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();

    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2) {
      setError("Escreva um nome com pelo menos 2 letras.");
      return;
    }

    sessionStorage.setItem("roda:nome", clean);
    sessionStorage.setItem("roda:hero", hero);

    onEnter({ name: clean, hero });
  };

  return (
    <main className="calls calls--gate" style={{ "--accent-base": THEMES.find((t) => t.id === hero)?.accent }}>
      <header className="calls__head">
        <p className="calls__eyebrow">Sistema Miraculous</p>
        <h1>Roda de Chamadas</h1>
        <p className="calls__sub">
          Entre com seu nome e escolha um herói. Seus contatos aparecem na roda e o canal fica
          disponível em qualquer aparelho ligado.
        </p>
      </header>

      <form className="gate" onSubmit={submit}>
        <label className="gate__field">
          <span className="calls__label">Seu nome</span>
          <input
            className="gate__input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="Como o time te chama"
            maxLength={20}
            autoComplete="nickname"
            autoFocus
          />
        </label>

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

        {error ? <p className="calls__notice">{error}</p> : null}
        {notice ? (
          <p className="calls__notice" role="status">
            {notice}
          </p>
        ) : null}

        <button type="submit" className="calls__callBtn">
          <PhoneIcon />
          Entrar no comunicador
        </button>

        <p className="calls__hint">
          Sem senha: a conta é o nome. Quem souber o seu nome consegue te chamar — como um
          walkie-talkie de time.
        </p>
      </form>
    </main>
  );
}
