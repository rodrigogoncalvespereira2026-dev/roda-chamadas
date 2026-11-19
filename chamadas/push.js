/*
  Avisos com a app fechada.

  Dentro do APK, o WebSocket morre quando a app fecha — quem está fora não tem
  como ser avisado por ali. O Android tem um canal próprio para isso: o Firebase
  Cloud Messaging. Aqui pede-se a permissão, regista-se o aparelho e entrega-se o
  token ao servidor; a partir daí o aviso chega pelo sistema, com a app fechada.

  No site não há nada disto: o navegador não dá tokens do Firebase. A função
  sai logo, e o resto da app funciona como sempre.
*/

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const noApk = () => Capacitor.getPlatform() === "android";

/**
 * Pede a permissão de notificações e regista o aparelho.
 * `aoReceberToken` é chamado com o token (e outra vez sempre que o Android o
 * renovar, o que acontece de vez em quando).
 */
export async function prepararPush(aoReceberToken) {
  if (!noApk()) return;

  try {
    let permissao = await PushNotifications.checkPermissions();

    if (permissao.receive === "prompt") {
      permissao = await PushNotifications.requestPermissions();
    }

    // Recusada: a app segue sem avisos, e o utilizador pode mudar isso nas
    // definições do Android quando quiser.
    if (permissao.receive !== "granted") {
      console.log("[push] sem permissão de notificações");
      return;
    }

    await PushNotifications.addListener("registration", (token) => {
      if (token?.value) aoReceberToken(token.value);
    });

    await PushNotifications.addListener("registrationError", (erro) => {
      console.warn("[push] registo falhou:", erro?.error ?? erro);
    });

    /* Tocar no aviso abre a app: não é preciso mais nada, a app arranca normal
       e reconecta-se ao servidor. Este ouvinte existe só para o Android saber
       que tratamos o toque (senão ele fica a repetir o aviso). */
    await PushNotifications.addListener("pushNotificationActionPerformed", () => {});

    await PushNotifications.register();
  } catch (erro) {
    console.warn("[push] indisponível:", erro?.message ?? erro);
  }
}
