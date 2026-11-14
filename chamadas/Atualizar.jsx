import { APK_URL } from "./versao";
import "./atualizar.css";

/**
 * Faixa de versão nova, só dentro do APK.
 *
 * O Android não atualiza a app sozinho: quando o servidor publica um instalador
 * mais recente, esta faixa aparece com o que mudou e o botão que abre o
 * download no navegador do sistema — é o navegador que instala, o Capacitor não
 * tem como fazer isso.
 */
export default function Atualizar({ versao, onFechar }) {
  const novidades = versao.novidades ?? [];

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
      </div>

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
