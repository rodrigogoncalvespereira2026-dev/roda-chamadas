import { useEffect, useRef, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { SendIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Recados: mensagens curtas por herói, dentro e fora da chamada.
 * O histórico vive na aba; o servidor guarda o que chega com o herói offline.
 */

function formatAt(at) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function ChatPanel({ people, threads, unread, chatHero, onOpen, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const active = people.find((person) => person.hero === chatHero) ?? null;
  const messages = active ? threads[active.hero] ?? [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active?.hero]);

  const submit = (event) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !active) return;
    onSend(active.hero, clean);
    setText("");
  };

  return (
    <div className="chat">
      <div className="chat__list" role="list">
        {people.map((person) => {
          const count = unread[person.hero] ?? 0;

          return (
            <button
              key={person.hero}
              type="button"
              role="listitem"
              className={`chat__contact${active?.hero === person.hero ? " is-on" : ""}`}
              style={{ "--accent-base": themeById(person.hero).accent }}
              onClick={() => onOpen(person.hero)}
              aria-pressed={active?.hero === person.hero}
            >
              <span className="chat__avatar" aria-hidden="true">
                <ThemeIcon id={person.hero} />
              </span>

              <span className="chat__who">
                <strong>{person.name}</strong>
                <span className={`statusDot is-${person.status}`} aria-hidden="true">
                  {statusLabel(person.status)}
                </span>
              </span>

              {count ? <span className="chat__unread">{count > 9 ? "9+" : count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="chat__thread">
        {active ? (
          <>
            <header className="chat__head">
              <span className="chat__avatar" aria-hidden="true">
                <ThemeIcon id={active.hero} />
              </span>
              <div>
                <strong>{active.name}</strong>
                <span className="chat__state">{statusLabel(active.status)}</span>
              </div>
            </header>

            <ul className="chat__messages">
              {messages.length ? (
                messages.map((item, index) => (
                  <li key={`${item.at}-${index}`} className={`chat__msg${item.mine ? " is-mine" : ""}`}>
                    <p>{item.text}</p>
                    <span>{formatAt(item.at)}</span>
                  </li>
                ))
              ) : (
                <li className="chat__empty">Nenhum recado ainda com {active.name}.</li>
              )}
              <li ref={endRef} aria-hidden="true" />
            </ul>

            <form className="chat__form" onSubmit={submit}>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={`Recado para ${active.name}`}
                aria-label={`Recado para ${active.name}`}
                maxLength={500}
              />
              <button type="submit" className="calls__callBtn" disabled={!text.trim()}>
                <SendIcon />
                Enviar
              </button>
            </form>
          </>
        ) : (
          <p className="calls__empty">Escolha um herói para ver os recados.</p>
        )}
      </div>
    </div>
  );
}
