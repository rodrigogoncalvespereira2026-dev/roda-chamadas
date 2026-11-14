import { useMemo, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { PhoneIcon, SearchIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Contatos: o time inteiro, na ordem que estiver. Cada linha é um herói da
 * roda — tocar traz ele para a frente, o telefone liga.
 */
const normalize = (value) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ContactsPanel({ people, onFocus, onCall, busy }) {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return people;
    return people.filter((person) => normalize(person.name).includes(term));
  }, [people, query]);

  return (
    <>
      <div className="calls__listHead">
        <h2>Contatos</h2>

        <label className="calls__search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar herói"
            aria-label="Procurar herói"
          />
        </label>
      </div>

      <p className="calls__hint">
        Toque num herói para trazê-lo à frente da roda. A luz ao lado diz o estado dele agora.
      </p>

      {list.length ? (
        <ul className="calls__grid">
          {list.map((person) => (
            <li key={person.hero} className="contactRow">
              <button
                type="button"
                className="calls__contact"
                style={{ "--accent-base": themeById(person.hero).accent }}
                onClick={() => onFocus(person.hero)}
                title={`${person.name} · ${statusLabel(person.status)}`}
              >
                <span className="calls__avatar" aria-hidden="true">
                  <ThemeIcon id={person.hero} />
                </span>
                <span>{person.name}</span>
                <span
                  className={`statusDot is-${person.status}`}
                  aria-label={statusLabel(person.status)}
                />
              </button>

              <span className="contactRow__side">
                <button
                  type="button"
                  className="contactRow__btn"
                  onClick={() => onCall(person.hero)}
                  disabled={busy || person.status === "offline"}
                  aria-label={`Ligar para ${person.name}`}
                  title={busy ? "Você já está numa chamada" : "Ligar"}
                >
                  <PhoneIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="calls__empty">Nenhum herói encontrado para “{query.trim()}”.</p>
      )}
    </>
  );
}
