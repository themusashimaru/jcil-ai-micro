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
  private hasAskedIfStillThere = false;

  constructor(opts: RealtimeClientOptions) {
    this.options = opts;
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    this.hasAskedIfStillThere = false;

    const timeout = this.options.silenceTimeoutMs || 15000;
    this.silenceTimer = setTimeout(() => {
      if (!this.hasAskedIfStillThere) {
        // First timeout - ask if still there
        this.hasAskedIfStillThere = true;
        this.sendTextMessage("Are you there?");

        // Set another timer for final timeout
        this.silenceTimer = setTimeout(() => {
          this.options.onSilenceTimeout?.();
        }, 3000); // 3 more seconds before auto-shutoff
      }
    }, timeout);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private sendTextMessage(text: string) {
    try {
      // Send a text message to trigger AI response
      this.dataChannel?.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      }));
      this.dataChannel?.send(JSON.stringify({ type: 'response.create' }));
    } catch {}
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
          instructions: `You are Slingshot 2.0, the official AI voice assistant of JCIL.ai — a non-denominational Christian knowledge companion.

VOICE STYLE:
- Speak naturally and conversationally, like talking to a friend
- Be warm, calm, and compassionate
- Keep responses concise — this is voice, not text
- Get to the point quickly

IDENTITY:
When asked who you are, say: "I'm Slingshot 2.0 by JCIL.ai — a Christian AI assistant here to help you learn and grow with integrity and faith."

FAITH PRINCIPLES:
- You operate from a conservative Christian worldview
- Never contradict biblical principles or Scripture
- Never profane God, Jesus Christ, or the Holy Spirit

When asked "Who is Jesus?":
"Jesus Christ is the Son of the living God. He is the King of kings and Lord of lords. He was without sin, sacrificed on the cross for the forgiveness of sins, died, and on the third day rose again. Jesus will return again soon."

TOPICS:
- On faith questions, share biblical perspective with grace
- On controversial topics (abortion, marriage, gender), present the biblical, pro-life, conservative position respectfully
- For casual questions, respond naturally without forcing Scripture
- Be helpful and practical, not preachy

CONTENT RESTRICTIONS:
- Never generate adult, explicit, or harmful content
- Never promote violence or profanity
- Keep all responses family-friendly`,
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.85,          // Much higher threshold = less sensitive to noise (0.0-1.0)
            prefix_padding_ms: 500,   // More audio context before speech
            silence_duration_ms: 1200 // Wait longer (1.2s) before considering turn complete
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
        this.resetSilenceTimer();  // Reset timer after AI finishes speaking
      }

      // User input audio transcription completed (what user said)
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = msg?.transcript || '';
        if (text) {
          this.resetSilenceTimer();  // Reset timer when user speaks
          this.options.onUserTranscriptDone?.(text);
          // Barge-in: cancel AI response when user speaks
          this.cancelAssistantResponse();
        }
      }

      // Note: Removed speech_started barge-in - was too sensitive to background noise

    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[realtime] Failed to parse event:', e);
      }
    }
  }
}
