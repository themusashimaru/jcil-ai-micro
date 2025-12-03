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
    this.dataChannel.onopen = () => this.configureSession();
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

  private configureSession() {
    // Enable input audio transcription so we can see what user says
    try {
      this.dataChannel?.send(JSON.stringify({
        type: 'session.update',
        session: {
          input_audio_transcription: {
            model: 'whisper-1'
          }
        }
      }));
      this.status('session configured');
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to configure session:', e);
      }
    }
  }

  private handleDataMessage(evt: MessageEvent) {
    try {
      const msg = JSON.parse(evt.data);
      const type = msg?.type;

      // Log events in dev mode for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('[realtime event]', type, msg);
      }

      // Assistant transcript delta (streaming text as AI speaks)
      if (type === 'response.audio_transcript.delta') {
        const delta = msg?.delta || '';
        if (delta) this.options.onTranscriptDelta?.(delta);
      }

      // Assistant transcript done - just signal completion (text already accumulated via deltas)
      if (type === 'response.audio_transcript.done') {
        this.options.onTranscriptDone?.('');
      }

      // User input audio transcription completed (what user said)
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = msg?.transcript || '';
        if (text) {
          this.options.onUserTranscriptDone?.(text);
          // Barge-in: cancel AI response when user speaks
          this.cancelAssistantResponse();
        }
      }

      // Also handle input_audio_buffer.speech_started for immediate barge-in
      if (type === 'input_audio_buffer.speech_started') {
        this.cancelAssistantResponse();
      }

    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to parse event:', e);
      }
    }
  }
}
