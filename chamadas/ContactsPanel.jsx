import { useMemo, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { AddHeroIcon, CloseIcon, PhoneIcon, SearchIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Contatos: quem está na roda e quem ainda está de fora.
 * Adicionar/remover mudam a roda de verdade — o servidor guarda a escolha.
 */

const normalize = (value) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ContactsPanel({ people, onFocus, onToggleContact, onCall, busy }) {
  const [query, setQuery] = useState("");

  const searched = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return people;
    return people.filter((person) => normalize(person.name).includes(term));
  }, [people, query]);

  const contacts = searched.filter((person) => person.contact);
  const others = searched.filter((person) => !person.contact);

  const card = (person) => {
    const accent = themeById(person.hero).accent;

    return (
      <li key={person.name} className="contactRow">
        <button
          type="button"
          className="calls__contact"
          style={{ "--accent-base": accent }}
          onClick={() => onFocus(person.name)}
          title={`${person.name} · ${statusLabel(person.status)}`}
        >
          <span className="calls__avatar" aria-hidden="true">
            <ThemeIcon id={person.hero} />
          </span>
          <span>{person.name}</span>
          <span className={`statusDot is-${person.status}`} aria-label={statusLabel(person.status)} />
        </button>

        <span className="contactRow__side">
          <button
            type="button"
            className="contactRow__btn"
            onClick={() => onCall(person.name)}
            disabled={busy || person.status === "offline"}
            aria-label={`Ligar para ${person.name}`}
            title={busy ? "Você já está numa chamada" : "Ligar"}
          >
            <PhoneIcon />
          </button>

          <button
            type="button"
            className="contactRow__btn"
            onClick={() => onToggleContact(person)}
            aria-label={
              person.contact ? `Tirar ${person.name} da roda` : `Pôr ${person.name} na roda`
            }
            title={person.contact ? "Tirar da roda" : "Pôr na roda"}
          >
            {person.contact ? <CloseIcon /> : <AddHeroIcon />}
          </button>
        </span>
      </li>
    );
  };

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
            placeholder="Procurar contato"
            aria-label="Procurar contato"
          />
        </label>
      </div>

      <p className="calls__hint">
        Toque num contato para trazê-lo à frente da roda. O × tira da roda; o + põe de volta.
      </p>

      {contacts.length ? (
        <ul className="calls__grid">{contacts.map(card)}</ul>
      ) : (
        <p className="calls__empty">
          {people.length
            ? "Nenhum contato na roda. Adicione alguém da lista abaixo."
            : "Ainda não há outra conta no servidor. Abra o site em outra aba e entre com outro nome."}
        </p>
      )}

      {others.length ? (
        <>
          <div className="calls__listHead calls__listHead--sub">
            <h2>Fora da roda</h2>
            <span className="calls__count">{others.length}</span>
          </div>

          <ul className="calls__grid">{others.map(card)}</ul>
        </>
      ) : null}
    </>
  );
}
