'use client';

type RealtimeClientOptions = {
  tokenUrl?: string;
  voice?: string;
  onTranscriptDelta?: (text: string) => void;
  onTranscriptDone?: (text: string) => void;
  onUserTranscriptDelta?: (text: string) => void;
  onUserTranscriptDone?: (text: string) => void;
  onStatus?: (msg: string) => void;
  onSilenceTimeout?: () => void;  // Called when user is silent too long
  silenceTimeoutMs?: number;       // Default 15000 (15 seconds)
};

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private options: RealtimeClientOptions;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: RealtimeClientOptions) {
    this.options = opts;
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Simply auto-shutoff after prolonged silence
    const timeout = this.options.silenceTimeoutMs || 30000;
    this.silenceTimer = setTimeout(() => {
      this.options.onSilenceTimeout?.();
    }, timeout);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
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
    this.dataChannel.onopen = () => {
      this.configureSession();
      this.resetSilenceTimer();  // Start silence timer when session begins
    };
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
    this.clearSilenceTimer();  // Clear silence timer on stop
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
    // Configure session with system prompt, turn detection, and transcription
    try {
      this.dataChannel?.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: `You are Slingshot 2.0, a Christian AI voice assistant by JCIL.ai.

GREETING:
- When starting a conversation, simply say: "Hi, how can I help you today?"
- Do NOT introduce yourself unless asked
- Keep greetings brief and professional

IDENTITY (only when asked who you are):
- Say: "I am Slingshot 2.0, made by JCIL.ai"
- JCIL is pronounced "Jay-sill"
- JCIL stands for "Jesus Christ is Lord"
- Only share this detail if they ask what JCIL means

VOICE STYLE:
- Speak naturally and conversationally
- Be warm but concise — this is voice, not text
- Get to the point quickly
- Always finish your sentences completely before stopping

FAITH PRINCIPLES:
- You operate from a conservative Christian worldview
- Never contradict biblical principles or Scripture
- Never profane God, Jesus Christ, or the Holy Spirit

When asked "Who is Jesus?":
"Jesus Christ is the Son of the living God, the King of kings and Lord of lords. He died for our sins and rose again on the third day."

TOPICS:
- On faith questions, share biblical perspective with grace
- On controversial topics, present the biblical, pro-life, conservative position respectfully
- For casual questions, respond naturally
- Be helpful and practical, not preachy

CONTENT RESTRICTIONS:
- Never generate adult, explicit, or harmful content
- Keep all responses family-friendly`,
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.95,          // Very high threshold = only clear speech triggers (0.0-1.0)
            prefix_padding_ms: 400,   // Audio context before speech
            silence_duration_ms: 1500 // Wait 1.5s of silence before AI responds
          }
        }
      }));

      // Trigger initial greeting from AI
      this.dataChannel?.send(JSON.stringify({ type: 'response.create' }));

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

      // Assistant transcript done - signal completion without adding text (already accumulated via deltas)
      if (type === 'response.audio_transcript.done') {
        // Signal done but don't pass empty text (prevents blank bubbles)
        this.options.onTranscriptDone?.('__DONE__');
        this.resetSilenceTimer();  // Reset timer after AI finishes speaking
      }

      // User input audio transcription completed (what user said)
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = msg?.transcript || '';
        if (text) {
          this.resetSilenceTimer();  // Reset timer when user speaks
          this.options.onUserTranscriptDone?.(text);
          // Note: Removed automatic barge-in - was cutting off AI mid-sentence
          // User can still interrupt naturally via VAD
        }
      }

    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to parse event:', e);
      }
    }
  }
}
