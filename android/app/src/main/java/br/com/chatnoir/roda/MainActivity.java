package br.com.chatnoir.roda;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

  private static final int PEDIDO_PERMISSOES = 10;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // precisa de vir antes do super: o bridge procura os plugins ao iniciar
    registerPlugin(AtualizadorPlugin.class);

    super.onCreate(savedInstanceState);
    acenderEcra();
    pedirEcraInteiro();
    pedirPermissoes();
  }

  /**
   * Android 14 em diante: uma app que não é a de telefone do telemóvel só abre a
   * chamada em ecrã inteiro se o utilizador permitir. Pede-se uma vez, na
   * abertura da app, e nunca mais se incomoda.
   */
  private void pedirEcraInteiro() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return;

    NotificationManager gestor = getSystemService(NotificationManager.class);
    if (gestor == null || gestor.canUseFullScreenIntent()) return;

    // se a app abriu por causa de uma chamada, mostrar a chamada é o que importa
    Intent origem = getIntent();
    if (origem != null && origem.getBooleanExtra("chamada", false)) return;

    try {
      startActivity(
        new Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:" + getPackageName())
        )
      );
      Toast.makeText(
        this,
        "Ligue \"Permitir notificações em ecrã inteiro\" para a chamada acender o ecrã.",
        Toast.LENGTH_LONG
      ).show();
    } catch (Exception semPagina) {
      // aparelho sem essa página: fica o aviso na barra
    }
  }

  /**
   * Quando a app abre por causa de uma chamada, o ecrã tem de acender e mostrar
   * a chamada mesmo com o telemóvel bloqueado — é o que faz parecer uma chamada
   * a sério em vez de um aviso.
   */
  private void acenderEcra() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow().addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
          | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      );
    }
  }

  /**
   * Câmera, microfone e localização: sem elas o WebView não consegue abrir a
   * chamada nem o mapa. O pedido fica aqui, na abertura da app, para não
   * interromper o utilizador no meio de uma ligação.
   */
  private void pedirPermissoes() {
    List<String> faltando = new ArrayList<>();

    String[] desejadas = {
      Manifest.permission.CAMERA,
      Manifest.permission.RECORD_AUDIO,
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    };

    for (String permissao : desejadas) {
      if (ContextCompat.checkSelfPermission(this, permissao) != PackageManager.PERMISSION_GRANTED) {
        faltando.add(permissao);
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
      faltando.add(Manifest.permission.POST_NOTIFICATIONS);
    }

    if (!faltando.isEmpty()) {
      ActivityCompat.requestPermissions(
        this,
        faltando.toArray(new String[0]),
        PEDIDO_PERMISSOES
      );
    }
  }
}
