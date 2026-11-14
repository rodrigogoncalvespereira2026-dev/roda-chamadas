package br.com.chatnoir.roda;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

  private static final int PEDIDO_PERMISSOES = 10;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    pedirPermissoes();
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
