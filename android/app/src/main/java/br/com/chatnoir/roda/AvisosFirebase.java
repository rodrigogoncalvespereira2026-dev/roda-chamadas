package br.com.chatnoir.roda;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.PowerManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Os avisos que chegam com a app fechada, tratados aqui dentro.
 *
 * O Firebase, sozinho, só sabe pôr uma linha na barra de notificações — e uma
 * chamada tem de ser tratada como chamada: o ecrã acende, por cima do bloqueio,
 * e aparece quem está a ligar. Isso chama-se "full screen intent" e só se
 * consegue com código nativo, por isso esta classe substitui o serviço do
 * plugin do Capacitor (ver AndroidManifest.xml).
 *
 * O servidor manda as chamadas como mensagem só de dados (sem `notification`),
 * para o Firebase não as mostrar sozinho e vir parar aqui; os recados continuam
 * a vir com `notification` e são mostrados pelo próprio sistema.
 */
public class AvisosFirebase extends FirebaseMessagingService {

  private static final String CANAL_CHAMADAS = "chamadas-alerta";
  private static final String CANAL_RECADOS = "recados";

  @Override
  public void onMessageReceived(RemoteMessage mensagem) {
    Map<String, String> dados = mensagem.getData();

    criarCanais();

    boolean chamada = "chamada".equals(dados.get("tipo"));
    String de = dados.get("de");
    String titulo = emTexto(dados.get("titulo"), chamada ? "Chamada" : "Roda de Chamadas");
    String corpo = emTexto(dados.get("corpo"), "");

    Intent abrir = new Intent(this, MainActivity.class);
    abrir.setFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        | Intent.FLAG_ACTIVITY_SINGLE_TOP
    );
    abrir.putExtra("chamada", chamada);
    if (de != null) abrir.putExtra("de", de);

    String callId = dados.get("callId");
    int id = idDoAviso(callId, de, titulo);

    if (chamada) limparAvisoAnterior(id);

    int bandeiras = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) bandeiras |= PendingIntent.FLAG_IMMUTABLE;

    PendingIntent tocar = PendingIntent.getActivity(this, id, abrir, bandeiras);

    NotificationCompat.Builder construtor = new NotificationCompat.Builder(
      this,
      chamada ? CANAL_CHAMADAS : CANAL_RECADOS
    )
      .setSmallIcon(iconePequeno())
      .setContentTitle(titulo)
      .setContentText(corpo)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(corpo))
      .setAutoCancel(true)
      .setContentIntent(tocar)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(chamada ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE);

    if (chamada) {
      /* O ecrã acende e a app abre já no ecrã de chamada — é o que faz parecer
         uma chamada a sério, mesmo com o telemóvel bloqueado no bolso. */
      construtor.setFullScreenIntent(tocar, true);
      acenderEcraSePreciso();
      // uma chamada que já ninguém atende deixa de fazer sentido
      construtor.setTimeoutAfter(60000);
      construtor.setVibrate(new long[] { 0, 800, 400, 800, 400, 800 });

      Bitmap simbolo = simboloDoHeroi(de);
      if (simbolo != null) construtor.setLargeIcon(simbolo);
    }

    try {
      NotificationManagerCompat.from(this).notify(id, construtor.build());
    } catch (SecurityException semPermissao) {
      // Android 13+ sem POST_NOTIFICATIONS: a app segue, só não avisa
    }
  }

  /**
   * No Android 14 o sistema pode recusar o ecrã inteiro a apps que não são a
   * app de telefone do telemóvel. Nesse caso o aviso ficaria só na barra, com o
   * ecrã apagado — e uma chamada não pode passar despercebida. Aqui acende-se o
   * ecrã à força durante uns segundos, para o aviso ser visto.
   */
  @SuppressWarnings("deprecation")
  private void acenderEcraSePreciso() {
    try {
      NotificationManager gestor = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      boolean podeEcraInteiro =
        Build.VERSION.SDK_INT < 34 || (gestor != null && gestor.canUseFullScreenIntent());

      if (podeEcraInteiro) return; // o ecrã inteiro já trata de acender e abrir

      PowerManager energia = (PowerManager) getSystemService(POWER_SERVICE);
      if (energia == null) return;

      PowerManager.WakeLock luz = energia.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK
          | PowerManager.ACQUIRE_CAUSES_WAKEUP
          | PowerManager.ON_AFTER_RELEASE,
        "roda:chamada"
      );
      luz.acquire(15000);
    } catch (Exception semLuz) {
      // sem isto, fica o aviso na barra e o som
    }
  }

  private static String emTexto(String valor, String porOmissao) {
    return valor == null || valor.isEmpty() ? porOmissao : valor;
  }

  /**
   * Um aviso por chamada.
   *
   * O identificador vem do id da chamada, com o mesmo cálculo que o JavaScript
   * usa em chamadas/avisos.js: assim cada chamada é uma notificação nova (a que
   * chega depois não é "uma atualização" da anterior, que o Android mostraria em
   * silêncio), e quando a chamada acaba a app cancela-a pelo mesmo número.
   */
  private static int idDoAviso(String callId, String de, String titulo) {
    String chave =
      callId != null && !callId.isEmpty()
        ? callId
        : (de == null ? "" : de) + "|" + titulo;

    long h = 7;
    for (int i = 0; i < chave.length(); i++) {
      h = (h * 31 + chave.charAt(i)) % 2147483647L;
    }

    return h == 0 ? 1 : (int) h;
  }

  /** Tira o aviso da chamada anterior, para a barra não encher de avisos velhos. */
  private void limparAvisoAnterior(int id) {
    SharedPreferences guardado = getSharedPreferences("roda", MODE_PRIVATE);
    int anterior = guardado.getInt("aviso-chamada", 0);

    if (anterior != 0 && anterior != id) {
      try {
        NotificationManagerCompat.from(this).cancel(anterior);
      } catch (Exception ignorado) {
        // nada a cancelar
      }
    }

    guardado.edit().putInt("aviso-chamada", id).apply();
  }

  private int iconePequeno() {
    ApplicationInfo app = getApplicationInfo();
    return app.icon != 0 ? app.icon : android.R.drawable.sym_call_incoming;
  }

  /** O símbolo de quem liga: os PNG ficam em res/drawable como heroi_&lt;id&gt;. */
  private Bitmap simboloDoHeroi(String hero) {
    if (hero == null || hero.isEmpty()) return null;

    int id = getResources().getIdentifier(
      "heroi_" + hero.toLowerCase(),
      "drawable",
      getPackageName()
    );
    if (id == 0) return null;

    return BitmapFactory.decodeResource(getResources(), id);
  }

  private Uri som() {
    int id = getResources().getIdentifier("chamada", "raw", getPackageName());
    if (id == 0) return null;

    return Uri.parse("android.resource://" + getPackageName() + "/" + id);
  }

  /**
   * Os mesmos canais que a app cria do lado do JavaScript. Se já existirem, o
   * Android mantém as definições antigas (o utilizador pode ter mudado o som).
   */
  private void criarCanais() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationManager gestor = getSystemService(NotificationManager.class);
    if (gestor == null) return;

    if (gestor.getNotificationChannel(CANAL_CHAMADAS) == null) {
      NotificationChannel canal = new NotificationChannel(
        CANAL_CHAMADAS,
        "Chamadas",
        NotificationManager.IMPORTANCE_HIGH
      );
      canal.setDescription("Quem está a chamar");
      canal.enableVibration(true);
      canal.setVibrationPattern(new long[] { 0, 800, 400, 800, 400, 800 });
      canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

      Uri som = som();
      if (som != null) {
        canal.setSound(
          som,
          new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        );
      }

      gestor.createNotificationChannel(canal);
    }

    if (gestor.getNotificationChannel(CANAL_RECADOS) == null) {
      NotificationChannel canal = new NotificationChannel(
        CANAL_RECADOS,
        "Recados",
        NotificationManager.IMPORTANCE_DEFAULT
      );
      canal.setDescription("Mensagens que chegam com a app fechada");
      canal.enableVibration(true);
      canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

      Uri som = som();
      if (som != null) {
        canal.setSound(
          som,
          new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()
        );
      }

      gestor.createNotificationChannel(canal);
    }
  }
}
