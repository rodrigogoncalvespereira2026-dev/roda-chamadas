/*
  Geolocalização do comunicador.

  A posição sai do aparelho só quando a pessoa pede (ou quando liga com o
  compartilhamento ligado). Nada é guardado no servidor: o convite leva a
  posição, o navegador de quem recebe mostra a distância e depois esquece.
*/

/** Distância em km entre dois pontos, pela fórmula de haversine. */
export function distanceKm(a, b) {
  if (!a || !b) return null;

  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
  Descodifica a polilinha comprimida do Valhalla (precisão 6): cada valor vem
  em passos de 5 bits e o último bit diz o sinal.
*/
function lerValor(texto, estado) {
  let valor = 0;
  let deslocamento = 0;
  let byte;

  do {
    byte = texto.charCodeAt(estado.i) - 63;
    estado.i += 1;
    valor |= (byte & 0x1f) << deslocamento;
    deslocamento += 5;
  } while (byte >= 0x20 && estado.i < texto.length);

  return valor & 1 ? ~(valor >> 1) : valor >> 1;
}

export function decodificarPolilinha(texto, precisao = 6) {
  if (!texto) return [];

  const fator = 10 ** precisao;
  const estado = { i: 0 };
  const pontos = [];
  let lat = 0;
  let lng = 0;

  while (estado.i < texto.length) {
    lat += lerValor(texto, estado);
    lng += lerValor(texto, estado);
    pontos.push([lat / fator, lng / fator]);
  }

  return pontos;
}

export function formatKm(km) {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/** Link do mapa aberto no app/site de mapas do aparelho. */
export function mapsLink(place) {
  return `https://www.google.com/maps?q=${place.lat},${place.lng}`;
}

const GEO_ERRORS = {
  1: "Permissão de localização negada. Libere o acesso nas configurações do navegador para ver onde você está.",
  2: "O aparelho não conseguiu calcular a posição agora.",
  3: "A localização demorou demais para responder. Tente de novo.",
};

/**
 * Lê a posição do aparelho. `timeout` curto deixa o alerta sair mesmo sem GPS.
 * Devolve `null` em vez de erro: localização é opcional no comunicador.
 */
export function readPosition({ timeout = 6000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ place: null, error: "Este navegador não oferece localização." });
      return;
    }

    let done = false;
    const settle = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };

    navigator.geolocation.getCurrentPosition(
      (result) =>
        settle({
          place: {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
          },
          error: "",
        }),
      (error) =>
        settle({
          place: null,
          error: GEO_ERRORS[error.code] ?? "Não foi possível ler a localização do aparelho.",
        }),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );

    setTimeout(() => settle({ place: null, error: "" }), timeout + 400);
  });
}
