/*
  Memória da aba, com rede de segurança.

  Nalguns WebViews (e em abas privadas) o sessionStorage/localStorage está
  desligado e o simples acesso atira um erro. Como um erro no topo de um
  módulo deixa a app num ecrã em branco, tudo aqui vale null quando não há
  memória: a app segue a funcionar, só não se lembra do que ficou guardado.
*/

const ler = (area, chave) => {
  try {
    return area.getItem(chave);
  } catch {
    return null;
  }
};

const guardar = (area, chave, valor) => {
  try {
    area.setItem(chave, valor);
  } catch {
    /* sem memória: o valor só vive nesta sessão */
  }
};

const apagar = (area, chave) => {
  try {
    area.removeItem(chave);
  } catch {
    /* sem memória: não havia nada a apagar */
  }
};

/** Memória da aba (some ao fechar). */
export const sessao = {
  ler: (chave) => (typeof sessionStorage === "undefined" ? null : ler(sessionStorage, chave)),
  guardar: (chave, valor) =>
    typeof sessionStorage === "undefined" ? undefined : guardar(sessionStorage, chave, valor),
  apagar: (chave) =>
    typeof sessionStorage === "undefined" ? undefined : apagar(sessionStorage, chave),
};

/** Memória do aparelho (fica entre aberturas). */
export const local = {
  ler: (chave) => (typeof localStorage === "undefined" ? null : ler(localStorage, chave)),
  guardar: (chave, valor) =>
    typeof localStorage === "undefined" ? undefined : guardar(localStorage, chave, valor),
};
