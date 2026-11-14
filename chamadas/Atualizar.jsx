import { useState } from "react";
import { APK_URL } from "./versao";
import { instalarNoAparelho } from "./atualizarApk";
import "./atualizar.css";

/**
 * Faixa de versão nova, só dentro do APK.
 *
 * O botão baixa o APK aqui mesmo e abre o instalador do Android, sem passar
 * pelo navegador nem por procurar o link. Se o sistema recusar (por exemplo
 * falta autorizar "instalar apps desconhecidas"), a mensagem explica e deixa o
 * caminho antigo como último recurso.
 */
export default function Atualizar({ versao, onFechar }) {
  const novidades = versao.novidades ?? [];
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState("");

  const atualizar = async () => {
    if (baixando) return;

    setErro("");
    setBaixando(true);

    try {
      await instalarNoAparelho(APK_URL);
    } catch (falha) {
      setErro(falha?.message ?? "Não consegui atualizar agora.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <aside className="atualizar" role="status">
      <div className="atualizar__caixa">
        <p className="atualizar__texto">
          Versão <strong>{versao.versao}</strong> disponível
        </p>

        {novidades.length ? (
          <ul className="atualizar__novidades">
            {novidades.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {erro ? (
          <p className="atualizar__erro">
            {erro}{" "}
            <a href={APK_URL} target="_blank" rel="noreferrer">
              baixar pelo navegador
            </a>
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="atualizar__link"
        onClick={atualizar}
        disabled={baixando}
      >
        {baixando ? "Baixando…" : "Atualizar"}
      </button>

      <button
        type="button"
        className="atualizar__fechar"
        onClick={onFechar}
        aria-label="Fechar aviso de atualização"
      >
        ×
      </button>
    </aside>
  );
}
