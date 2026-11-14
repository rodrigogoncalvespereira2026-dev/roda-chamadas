/*
  Chamada de voz e vídeo ponto a ponto (WebRTC em malha).

  Cada participante conversa direto com os outros: uma RTCPeerConnection por
  pessoa. O servidor só troca as descrições de sessão (SDP) e os candidatos de
  rede (ICE) — imagem e som não passam por ele.

  A negociação segue o padrão "perfect negotiation": quem tem o nome maior é o
  educado (cede quando as duas ofertas se cruzam), então as duas pontas podem
  ligar a câmera ou mexer nas faixas a qualquer momento sem travar a chamada.
*/

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: "user",
};

export class CallSession {
  constructor({ callId, self, kind, iceServers = [], send, onChange, heroOf }) {
    this.callId = callId;
    this.self = self;
    this.kind = kind === "voice" ? "voice" : "video";
    this.iceServers = iceServers;
    this.send = send;
    this.onChange = onChange;
    this.heroOf = heroOf ?? (() => "cat");

    /** name → { pc, stream, state, polite, ... } */
    this.peers = new Map();
    this.pendingSignals = [];
    /** Nomes pedidos antes da mídia ficar pronta. */
    this.wanted = [];

    this.local = null;
    this.mediaError = null;
    this.muted = false;
    this.camera = this.kind === "video";

    this.ready = false;
    this.closed = false;

    // só no dev: deixa o console (e os testes) olharem as conexões abertas
    if (import.meta.env.DEV) {
      globalThis.__rodaChamadas = [...(globalThis.__rodaChamadas ?? []), this];
    }
  }

  /* ---------- mídia local ---------- */

  async start() {
    await this.prepareMedia();

    this.ready = true;

    // As conexões nascem depois da mídia: assim cada faixa entra uma vez só.
    this.setMembers(this.wanted);

    const queue = this.pendingSignals.splice(0);
    for (const item of queue) this.applySignal(item.from, item.data);

    this.emit();
  }

  async prepareMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.mediaError = "Este navegador não libera microfone e câmera.";
      return;
    }

    const wantsVideo = this.kind === "video";

    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo ? VIDEO_CONSTRAINTS : false,
      });
    } catch {
      // sem câmera a chamada continua só com voz, em vez de morrer
      try {
        this.local = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (wantsVideo) this.mediaError = "Câmera indisponível: a chamada segue só com voz.";
      } catch {
        try {
          this.local = wantsVideo
            ? await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS })
            : null;
          this.mediaError = this.local
            ? "Microfone bloqueado: você só ouve."
            : "Sem microfone e sem câmera. A chamada segue em modo de escuta.";
        } catch {
          this.local = null;
          this.mediaError = "Sem acesso ao microfone e à câmera. A chamada segue em modo de escuta.";
        }
      }
    }

    if (this.local?.getAudioTracks().length) this.setMuted(this.muted);
    if (this.local?.getVideoTracks().length) {
      this.local.getVideoTracks().forEach((track) => {
        track.enabled = this.camera;
      });
    }

    for (const peer of this.peers.values()) this.publishLocalTracks(peer);
  }

  /** Manda as faixas locais para uma conexão (ou deixa lugar para receber). */
  publishLocalTracks(peer) {
    const { pc } = peer;

    if (this.local?.getTracks().length) {
      for (const track of this.local.getTracks()) {
        const already = pc.getSenders().some((sender) => sender.track === track);
        if (!already) {
          try {
            pc.addTrack(track, this.local);
          } catch {
            /* faixa repetida ou conexão fechada */
          }
        }
      }
      return;
    }

    // sem mídia local: pelo menos avisa que quer receber
    if (!pc.getTransceivers().length) {
      pc.addTransceiver("audio", { direction: "recvonly" });
      if (this.kind === "video") pc.addTransceiver("video", { direction: "recvonly" });
    }
  }

  /* ---------- participantes ---------- */

  setMembers(names) {
    const wanted = [...new Set(names)].filter((name) => name !== this.self);

    this.wanted = wanted;

    // ainda sem mídia: guarda a lista, o start() abre as conexões
    if (!this.ready) return;

    for (const name of [...this.peers.keys()]) {
      if (!wanted.includes(name)) this.removePeer(name);
    }

    for (const name of wanted) this.ensurePeer(name);

    this.emit();
  }

  ensurePeer(name) {
    if (this.peers.has(name)) return this.peers.get(name);

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    const peer = {
      name,
      pc,
      stream: null,
      state: "new",
      polite: this.self > name,
      makingOffer: false,
      ignoreOffer: false,
      answerPending: false,
      /** Candidatos que chegaram antes da descrição remota. */
      pendingCandidates: [],
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      // `toJSON` deixa o candidato viajável em JSON (a classe não serialize sozinha)
      this.send("signal", {
        callId: this.callId,
        to: name,
        data: { candidate: candidate.toJSON ? candidate.toJSON() : candidate },
      });
    };

    pc.ontrack = (event) => {
      peer.stream = event.streams[0] ?? new MediaStream([event.track]);
      this.emit();
    };

    pc.onicecandidateerror = (event) => {
      if (import.meta.env.DEV) {
        console.warn(`[ice] ${name}: ${event.errorText} (${event.url ?? "sem url"})`);
      }
    };

    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState;
      if (pc.connectionState === "failed") {
        try {
          pc.restartIce();
        } catch {
          /* sem reinício: a próxima negociação resolve */
        }
      }
      this.emit();
    };

    const enviarOferta = async () => {
      if (peer.makingOffer || peer.closed) return;

      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.send("signal", {
          callId: this.callId,
          to: name,
          data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } },
        });
      } catch {
        /* conexão fechada durante a negociação */
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onnegotiationneeded = () => {
      // As duas pontas criam a conexão na mesma hora. Se as duas oferecerem
      // juntas, o desfazer da oferta trava a coleta de ICE no Chrome — então o
      // lado "educado" espera um pouco para ver se a oferta do outro chega.
      if (!peer.polite) {
        enviarOferta();
        return;
      }

      clearTimeout(peer.offerTimer);
      peer.offerTimer = setTimeout(enviarOferta, 350);
    };

    this.peers.set(name, peer);
    this.publishLocalTracks(peer);

    return peer;
  }

  removePeer(name) {
    const peer = this.peers.get(name);
    if (!peer) return;
    this.peers.delete(name);
    peer.closed = true;
    clearTimeout(peer.offerTimer);
    try {
      peer.pc.close();
    } catch {
      /* já fechada */
    }
  }

  /* ---------- sinalização ---------- */

  handleSignal(from, data) {
    if (!data) return;

    if (!this.ready) {
      this.pendingSignals.push({ from, data });
      return;
    }

    this.applySignal(from, data);
  }

  async applySignal(from, data) {
    if (!from || from === this.self) return;

    const peer = this.ensurePeer(from);
    const { pc } = peer;

    try {
      if (data.sdp) {
        // a oferta do outro lado chegou: não precisa oferecer também
        clearTimeout(peer.offerTimer);

        const readyForOffer =
          !peer.makingOffer && (pc.signalingState === "stable" || peer.answerPending);

        const collision = data.sdp.type === "offer" && !readyForOffer;

        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;

        peer.answerPending = data.sdp.type === "answer";
        await pc.setRemoteDescription(data.sdp);
        peer.answerPending = false;

        if (data.sdp.type === "offer") {
          await pc.setLocalDescription();
          this.send("signal", {
            callId: this.callId,
            to: from,
            data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } },
          });
        }

        // candidatos que chegaram cedo demais entram agora
        const cedo = peer.pendingCandidates.splice(0);
        for (const candidate of cedo) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            /* candidato velho: o ICE novo resolve */
          }
        }
      } else if (data.candidate) {
        if (!pc.remoteDescription) {
          peer.pendingCandidates.push(data.candidate);
          return;
        }

        try {
          await pc.addIceCandidate(data.candidate);
        } catch (error) {
          if (!peer.ignoreOffer) throw error;
        }
      }
    } catch (error) {
      console.warn("sinalização ignorada:", error?.message ?? error);
    }
  }

  /* ---------- controles ---------- */

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
    this.emit();
  }

  async setCamera(on) {
    this.camera = Boolean(on);

    const tracks = this.local?.getVideoTracks() ?? [];

    if (tracks.length) {
      tracks.forEach((track) => {
        track.enabled = this.camera;
      });
      this.emit();
      return;
    }

    if (!this.camera || !navigator.mediaDevices?.getUserMedia) {
      this.emit();
      return;
    }

    try {
      const extra = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      if (!this.local) this.local = new MediaStream();

      const track = extra.getVideoTracks()[0];
      this.local.addTrack(track);
      tracks.forEach(() => {});

      for (const peer of this.peers.values()) {
        try {
          peer.pc.addTrack(track, this.local);
        } catch {
          /* conexão já fechada */
        }
      }

      this.mediaError = null;
    } catch {
      this.mediaError = "A câmera não liberou. A chamada segue sem vídeo.";
      this.camera = false;
    }

    this.emit();
  }

  /*
    Reinicia a câmera quando ela dá uma faixa sem imagem.

    Acontece no iPhone: a faixa existe, está "ligada", mas não chega nenhum
    quadro. Parar a faixa e pedir a câmera outra vez costuma resolver, porque
    força o sistema a abrir uma sessão nova em vez de reaproveitar a que ficou
    presa (por exemplo depois de a app ir para segundo plano).
  */
  async restartCamera() {
    const antigas = this.local?.getVideoTracks() ?? [];

    for (const track of antigas) {
      track.stop();
      this.local.removeTrack(track);
    }

    try {
      const nova = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      const track = nova.getVideoTracks()[0];

      if (!this.local) this.local = new MediaStream();
      this.local.addTrack(track);

      for (const peer of this.peers.values()) {
        const envio = peer.pc.getSenders().find((sender) => sender.track?.kind === "video");

        try {
          // a faixa que já estava no lugar da antiga não precisa de renegociar
          if (envio) await envio.replaceTrack(track);
          else peer.pc.addTrack(track, this.local);
        } catch {
          /* conexão já fechada */
        }
      }

      this.mediaError = null;
      this.camera = true;
    } catch {
      this.mediaError = "A câmera não liberou. A chamada segue sem vídeo.";
      this.camera = false;
    }

    this.emit();
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    for (const peer of this.peers.values()) {
      try {
        peer.pc.close();
      } catch {
        /* já fechada */
      }
    }
    this.peers.clear();

    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;

    this.emit();
  }

  /* ---------- estado para a tela ---------- */

  snapshot() {
    const peers = [...this.peers.values()].map((peer) => ({
      name: peer.name,
      hero: this.heroOf(peer.name),
      stream: peer.stream,
      state: peer.state,
      hasVideo: Boolean(peer.stream?.getVideoTracks().some((track) => track.readyState === "live")),
      hasAudio: Boolean(peer.stream?.getAudioTracks().some((track) => track.readyState === "live")),
    }));

    return {
      local: this.local,
      peers,
      muted: this.muted,
      camera: this.camera,
      mediaError: this.mediaError,
      kind: this.kind,
    };
  }

  emit() {
    if (this.closed) return;
    this.onChange?.(this.snapshot());
  }
}
