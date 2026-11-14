package br.com.chatnoir.roda;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Baixa o APK novo e abre o instalador do Android.
 *
 * A página não consegue escrever ficheiros nem instalar nada: quem faz isso é
 * este plugin. O download corre numa thread à parte (a interface não pode
 * bloquear) e, no fim, o ficheiro é entregue ao instalador do sistema por um
 * FileProvider — o Android pede sempre uma confirmação antes de substituir a
 * app, e isso é uma proteção que se mantém.
 */
@CapacitorPlugin(name = "Atualizador")
public class AtualizadorPlugin extends Plugin {

  @PluginMethod
  public void instalar(PluginCall call) {
    String endereco = call.getString("url");

    if (endereco == null || endereco.isEmpty()) {
      call.reject("Falta o endereço do APK.");
      return;
    }

    // Android 8+: a app precisa de autorização para instalar apps fora da loja.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent ajustes = new Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + getContext().getPackageName())
      );
      ajustes.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(ajustes);

      call.reject("Autorize a instalação de apps desconhecidas e toque em atualizar outra vez.");
      return;
    }

    new Thread(() -> {
      try {
        File apk = baixar(endereco);
        abrirInstalador(apk);

        JSObject resultado = new JSObject();
        resultado.put("caminho", apk.getAbsolutePath());

        responder(call, resultado, null);
      } catch (Exception erro) {
        responder(call, null, "Não consegui baixar a atualização: " + erro.getMessage());
      }
    }).start();
  }

  /** Resolve ou rejeita na thread da interface, como o Capacitor espera. */
  private void responder(PluginCall call, JSObject resultado, String erro) {
    getActivity().runOnUiThread(() -> {
      if (erro != null) {
        call.reject(erro);
        return;
      }

      call.resolve(resultado);
    });
  }

  private File baixar(String endereco) throws Exception {
    File destino = new File(getContext().getCacheDir(), "roda-chamadas.apk");

    HttpURLConnection ligacao = (HttpURLConnection) new URL(endereco).openConnection();
    ligacao.setInstanceFollowRedirects(true);
    ligacao.setConnectTimeout(20000);
    ligacao.setReadTimeout(60000);
    ligacao.connect();

    try (InputStream entrada = ligacao.getInputStream();
         FileOutputStream saida = new FileOutputStream(destino)) {
      byte[] bloco = new byte[8192];
      int lidos;

      while ((lidos = entrada.read(bloco)) > 0) {
        saida.write(bloco, 0, lidos);
      }
    } finally {
      ligacao.disconnect();
    }

    return destino;
  }

  private void abrirInstalador(File apk) {
    String autoridade = getContext().getPackageName() + ".fileprovider";
    Uri uri = FileProvider.getUriForFile(getContext(), autoridade, apk);

    Intent instalar = new Intent(Intent.ACTION_VIEW);
    instalar.setDataAndType(uri, "application/vnd.android.package-archive");
    instalar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    instalar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

    getContext().startActivity(instalar);
  }
}
