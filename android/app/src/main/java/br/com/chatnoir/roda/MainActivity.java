package br.com.chatnoir.roda;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

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
    pedirPermissoes();
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
