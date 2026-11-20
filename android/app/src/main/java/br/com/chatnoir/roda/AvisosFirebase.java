package br.com.chatnoir.roda;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
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

    int id = idDoAviso(de, titulo);

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

  private static String emTexto(String valor, String porOmissao) {
    return valor == null || valor.isEmpty() ? porOmissao : valor;
  }

  /** Número estável por aviso: dois avisos da mesma pessoa não se sobrepõem. */
  private static int idDoAviso(String de, String titulo) {
    String chave = (de == null ? "" : de) + "|" + titulo;
    return 900000 + Math.abs(chave.hashCode() % 90000);
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
