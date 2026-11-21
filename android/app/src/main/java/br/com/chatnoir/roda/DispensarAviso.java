package br.com.chatnoir.roda;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * O botão "Dispensar" do aviso de chamada.
 *
 * Tira o aviso sem abrir a app — quem não quer atender não precisa de entrar.
 * Se entretanto quiser atender, a chamada continua a tocar até desligarem.
 */
public class DispensarAviso extends BroadcastReceiver {

  @Override
  public void onReceive(Context contexto, Intent intencao) {
    int id = intencao.getIntExtra("id", 0);
    if (id == 0) return;

    try {
      NotificationManagerCompat.from(contexto).cancel(id);
    } catch (SecurityException semPermissao) {
      // sem permissão de notificações não há nada para cancelar
    }
  }
}
