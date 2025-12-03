'use client';

// Common Whisper hallucinations to filter out
const HALLUCINATION_PATTERNS = [
  /^thanks?(\s+for\s+watching)?\.?$/i,
  /^thank\s+you\.?$/i,
  /^i\s+love\s+you\.?$/i,
  /^bye\.?$/i,
  /^goodbye\.?$/i,
  /^hello\.?$/i,
  /^hey\.?$/i,
  /^hi\.?$/i,
  /^okay\.?$/i,
  /^ok\.?$/i,
  /^um+\.?$/i,
  /^uh+\.?$/i,
  /^ah+\.?$/i,
  /^hmm+\.?$/i,
  /^\.+$/,
  /^\s*$/,
];

function isHallucination(text: string): boolean {
  const trimmed = text.trim();
  // Too short (less than 3 chars or 2 words)
  if (trimmed.length < 3) return true;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return true;

  // Matches known hallucination patterns
  return HALLUCINATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

type RealtimeClientOptions = {
  tokenUrl?: string;
  voice?: string;
  onTranscriptDelta?: (text: string) => void;
  onTranscriptDone?: () => void;
  onUserTranscript?: (text: string) => void;  // Renamed: complete user transcript
  onStatus?: (msg: string) => void;
  onSilenceTimeout?: () => void;
  onGreeting?: () => void;  // Called when AI starts greeting
  silenceTimeoutMs?: number;
};

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private options: RealtimeClientOptions;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionReady = false;
  private pendingUserTranscripts: string[] = [];  // Buffer for ordering
  private isAiSpeaking = false;

  constructor(opts: RealtimeClientOptions) {
    this.options = opts;
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
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

    // Speaker playback
    const audio = document.createElement('audio');
    audio.autoplay = true;
    this.pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
    };

    // Microphone
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.mediaStream!));

    // Data channel
    this.dataChannel = this.pc.createDataChannel('oai-events');
    this.dataChannel.onopen = () => {
      this.configureSession();
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
    this.clearSilenceTimer();
    this.sessionReady = false;
    this.isAiSpeaking = false;
    this.pendingUserTranscripts = [];
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

  private configureSession() {
    try {
      this.dataChannel?.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: `You are Slingshot 2.0, a Christian AI voice assistant by JCIL.ai.

FIRST MESSAGE:
- Your very first response should be ONLY: "Hi, how can I help you today?"
- Nothing else, no introduction, no explanation

IDENTITY (only when asked):
- Say: "I am Slingshot 2.0, made by JCIL.ai"
- JCIL is pronounced "Jay-sill" and stands for "Jesus Christ is Lord"

VOICE STYLE:
- Be warm, natural, and conversational
- Keep responses concise - this is voice, not text
- Always complete your sentences fully
- Wait for the user to finish before responding

FAITH PRINCIPLES:
- Conservative Christian worldview
- Never contradict Scripture or profane God

When asked "Who is Jesus?":
"Jesus Christ is the Son of the living God, the King of kings and Lord of lords. He died for our sins and rose again on the third day."

CONTENT:
- Be helpful and practical
- Keep all responses family-friendly
- Never generate inappropriate content`,
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.97,          // Even higher threshold
            prefix_padding_ms: 500,   // More context before speech
            silence_duration_ms: 2000 // Wait 2s before responding
          }
        }
      }));
      this.status('session config sent');
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to configure session:', e);
      }
    }
  }

  private triggerGreeting() {
    if (!this.sessionReady) return;
    try {
      this.dataChannel?.send(JSON.stringify({ type: 'response.create' }));
      this.options.onGreeting?.();
      this.status('greeting triggered');
    } catch {}
  }

  // Flush any pending user transcripts before AI response
  private flushPendingUserTranscripts() {
    while (this.pendingUserTranscripts.length > 0) {
      const text = this.pendingUserTranscripts.shift()!;
      this.options.onUserTranscript?.(text);
    }
  }

  private handleDataMessage(evt: MessageEvent) {
    try {
      const msg = JSON.parse(evt.data);
      const type = msg?.type;

      if (process.env.NODE_ENV !== 'production') {
        console.log('[realtime event]', type, msg);
      }

      // Session is ready - now trigger greeting
      if (type === 'session.updated' || type === 'session.created') {
        this.sessionReady = true;
        this.resetSilenceTimer();
        // Small delay to ensure everything is ready
        setTimeout(() => this.triggerGreeting(), 100);
      }

      // AI is starting to respond - flush pending user messages first
      if (type === 'response.created' || type === 'response.audio.delta') {
        if (!this.isAiSpeaking) {
          this.flushPendingUserTranscripts();
          this.isAiSpeaking = true;
        }
      }

      // AI transcript streaming
      if (type === 'response.audio_transcript.delta') {
        const delta = msg?.delta || '';
        if (delta) {
          this.options.onTranscriptDelta?.(delta);
        }
      }

      // AI transcript complete
      if (type === 'response.audio_transcript.done') {
        this.options.onTranscriptDone?.();
        this.isAiSpeaking = false;
        this.resetSilenceTimer();
      }

      // Response fully complete
      if (type === 'response.done') {
        this.isAiSpeaking = false;
        this.resetSilenceTimer();
      }

      // User speech transcription complete
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = msg?.transcript || '';

        // Filter out hallucinations and noise
        if (text && !isHallucination(text)) {
          this.resetSilenceTimer();

          // If AI is currently speaking, buffer the user text
          // It will be flushed when AI starts next response
          if (this.isAiSpeaking) {
            this.pendingUserTranscripts.push(text);
          } else {
            this.options.onUserTranscript?.(text);
          }
        }
      }

      // Error handling
      if (type === 'error') {
        console.error('[realtime] Error from OpenAI:', msg?.error);
        this.status('error: ' + (msg?.error?.message || 'unknown'));
      }

    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to parse event:', e);
      }
    }
  }
}
