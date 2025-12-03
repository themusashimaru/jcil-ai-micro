'use client';

type RealtimeClientOptions = {
  tokenUrl?: string;
  voice?: string;
  onTranscriptDelta?: (text: string) => void;
  onTranscriptDone?: (text: string) => void;
  onUserTranscriptDelta?: (text: string) => void;
  onUserTranscriptDone?: (text: string) => void;
  onStatus?: (msg: string) => void;
};

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private options: RealtimeClientOptions;

  constructor(opts: RealtimeClientOptions) {
    this.options = opts;
  }

  private status(msg: string) {
    this.options.onStatus?.(msg);
    if (process.env.NODE_ENV !== 'production') console.log('[realtime]', msg);
  }

  async start() {
    this.status('starting');
    this.pc = new RTCPeerConnection();

    // speaker playback
    const audio = document.createElement('audio');
    audio.autoplay = true;
    this.pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
    };

    // mic
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.mediaStream!));

    // data channel
    this.dataChannel = this.pc.createDataChannel('oai-events');
    this.dataChannel.onmessage = (evt) => this.handleDataMessage(evt);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const r = await fetch(this.options.tokenUrl || '/api/rt-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: offer.sdp, voice: this.options.voice || 'verse' }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error('rt-token failed ' + txt);
    }

    const { sdp: answer } = await r.json();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answer });
    this.status('live');
  }

  async stop() {
    this.status('stopping');
    try {
      this.dataChannel?.close();
      this.pc?.getTransceivers().forEach((t) => t.stop());
      this.pc?.close();
      this.mediaStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.dataChannel = null;
    this.pc = null;
    this.mediaStream = null;
    this.status('stopped');
  }

  cancelAssistantResponse() {
    try {
      this.dataChannel?.send(JSON.stringify({ type: 'response.cancel' }));
      this.status('AI response canceled (barge-in)');
    } catch {}
  }

  private handleDataMessage(evt: MessageEvent) {
    try {
      const msg = JSON.parse(evt.data);

      // assistant deltas
      const aiDelta =
        msg?.type === 'response.delta' ? msg?.delta :
        msg?.type === 'output_text.delta' ? msg?.delta :
        (msg?.type === 'transcript.delta' && msg?.speaker === 'assistant') ? msg?.text :
        '';

      if (aiDelta) this.options.onTranscriptDelta?.(aiDelta);

      const aiDone =
        msg?.type === 'response.completed' ||
        msg?.type === 'response.done' ||
        msg?.type === 'output_text.completed' ||
        (msg?.type === 'transcript.completed' && msg?.speaker === 'assistant');

      if (aiDone) this.options.onTranscriptDone?.(msg?.text ?? '');

      // user deltas
      const userDelta =
        (msg?.type === 'transcript.delta' && msg?.speaker === 'user') ? msg?.text :
        (msg?.type === 'input_transcript.delta' ? msg?.text : '');

      if (userDelta) {
        this.options.onUserTranscriptDelta?.(userDelta);
        // barge-in: if AI currently speaking, cancel it
        this.cancelAssistantResponse();
      }

      const userDone =
        (msg?.type === 'transcript.completed' && msg?.speaker === 'user') ||
        msg?.type === 'input_transcript.completed';

      if (userDone) this.options.onUserTranscriptDone?.(msg?.text ?? '');
    } catch {}
  }
}
