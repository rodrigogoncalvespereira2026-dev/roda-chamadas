import { APK_URL } from "./versao";
import "./atualizar.css";

/**
 * Faixa de versão nova, só dentro do APK.
 *
 * O Android não atualiza a app sozinho: quando o servidor publica um instalador
 * mais recente, esta faixa aparece com o botão que abre o download no navegador
 * do sistema — é o navegador que instala, o Capacitor não tem como fazer isso.
 */
export default function Atualizar({ versao, onFechar }) {
  return (
    <aside className="atualizar" role="status">
      <p className="atualizar__texto">
        Versão <strong>{versao.versao}</strong> disponível
      </p>

      <a className="atualizar__link" href={APK_URL} target="_blank" rel="noreferrer">
        Baixar
      </a>

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
