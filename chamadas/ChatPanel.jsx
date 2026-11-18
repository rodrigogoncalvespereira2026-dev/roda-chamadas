import { useEffect, useRef, useState } from "react";
import ThemeIcon from "../carrossel/ThemeIcon";
import { themeById } from "../carrossel/themes";
import { SendIcon } from "./icons";
import { statusLabel } from "./status";

/**
 * Recados: mensagens curtas por herói, dentro e fora da chamada.
 *
 * A coluna da esquerda é a caixa de entrada: quem tem recados por ler fica no
 * topo, depois as conversas mais recentes, e cada linha mostra o último recado
 * ("Você: …" quando foi meu) e a hora — dá para saber o que se passa sem abrir
 * conversa a conversa. O histórico vive na aba; o servidor guarda o que chega
 * com o herói offline.
 */

const dois = (numero) => String(numero).padStart(2, "0");

/** Hora no balão; na lista, data curta quando o recado não é de hoje. */
function formatAt(at, curto = false) {
  const date = new Date(at);
  const hora = `${dois(date.getHours())}:${dois(date.getMinutes())}`;

  if (!curto || new Date().toDateString() === date.toDateString()) return hora;

  return `${dois(date.getDate())}/${dois(date.getMonth() + 1)}`;
}

export default function ChatPanel({ people, threads, unread, chatHero, onOpen, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const active = people.find((person) => person.hero === chatHero) ?? null;
  const messages = active ? threads[active.hero] ?? [] : [];

  const ultimoDe = (hero) => {
    const lista = threads[hero] ?? [];
    return lista[lista.length - 1] ?? null;
  };

  /* caixa de entrada: por ler primeiro, depois conversa mais recente */
  const fila = [...people].sort((a, b) => {
    const porLer = (unread[a.hero] ?? 0) - (unread[b.hero] ?? 0);
    if (porLer !== 0) return -porLer;

    const recente = (ultimoDe(b.hero)?.at ?? 0) - (ultimoDe(a.hero)?.at ?? 0);
    if (recente !== 0) return recente;

    if (a.status !== b.status) return a.status === "available" ? -1 : 1;

    return a.name.localeCompare(b.name, "pt");
  });

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
      <ul className="chat__list" aria-label="Conversas">
        {fila.map((person) => {
          const count = unread[person.hero] ?? 0;
          const ultimo = ultimoDe(person.hero);
          const estado = statusLabel(person.status);

          return (
            <li key={person.hero} className="chat__item">
              <button
                type="button"
                className={`chat__contact${active?.hero === person.hero ? " is-on" : ""}`}
                style={{ "--accent-base": themeById(person.hero).accent }}
                onClick={() => onOpen(person.hero)}
                aria-pressed={active?.hero === person.hero}
                aria-label={`${person.name}, ${estado}${
                  count ? `, ${count} por ler` : ""
                }${ultimo ? `, último recado às ${formatAt(ultimo.at)}` : ""}`}
              >
                <span className="chat__avatar" aria-hidden="true">
                  <ThemeIcon id={person.hero} />
                </span>

                <span className="chat__texto">
                  <span className="chat__linha">
                    <strong>{person.name}</strong>
                    {/* só o ponto: o estado já vai no aria-label da linha */}
                    <span
                      className={`statusDot chat__presenca is-${person.status}`}
                      title={estado}
                      aria-hidden="true"
                    />
                    {ultimo ? (
                      <time className="chat__hora" dateTime={new Date(ultimo.at).toISOString()}>
                        {formatAt(ultimo.at, true)}
                      </time>
                    ) : null}
                  </span>

                  <span className="chat__linha">
                    <span
                      className={`chat__preview${ultimo ? "" : " chat__preview--vazio"}`}
                    >
                      {ultimo
                        ? `${ultimo.mine ? "Você: " : ""}${ultimo.text}`
                        : "Sem recados ainda"}
                    </span>

                    {count ? (
                      <span className="chat__unread" aria-hidden="true">
                        {count > 9 ? "9+" : count}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
                <li className="chat__empty">
                  Nenhum recado ainda com {active.name}. Escreva o primeiro em baixo.
                </li>
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
