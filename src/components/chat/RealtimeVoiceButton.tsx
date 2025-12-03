/**
 * REALTIME VOICE CHAT BUTTON
 *
 * PURPOSE:
 * - Full speech-to-speech conversation with GPT-4o-realtime
 * - User speaks, AI responds with voice
 * - Both sides transcribed and logged to chat
 *
 * FEATURES:
 * - WebSocket connection to OpenAI Realtime API
 * - Bidirectional audio streaming
 * - Voice wave animation during conversation
 * - Automatic transcription logging
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface RealtimeVoiceButtonProps {
  onConversationMessage: (role: 'user' | 'assistant', text: string) => void;
  disabled?: boolean;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export function RealtimeVoiceButton({ onConversationMessage, disabled }: RealtimeVoiceButtonProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[RealtimeVoice] Cleaning up...');

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsUserSpeaking(false);
    setIsAISpeaking(false);
    setCurrentTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Play audio from queue
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;

    isPlayingRef.current = true;
    setIsAISpeaking(true);

    while (playbackQueueRef.current.length > 0) {
      const audioData = playbackQueueRef.current.shift();
      if (!audioData || !audioContextRef.current) break;

      const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
      audioBuffer.getChannelData(0).set(audioData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      await new Promise<void>(resolve => {
        source.onended = () => resolve();
        source.start();
      });
    }

    isPlayingRef.current = false;
    setIsAISpeaking(false);
  }, []);

  // Convert base64 to Float32Array (PCM16)
  const base64ToFloat32Array = useCallback((base64: string): Float32Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM16 to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    return float32Array;
  }, []);

  // Convert Float32Array to base64 (PCM16)
  const float32ToBase64 = useCallback((float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }

    return btoa(binary);
  }, []);

  // Start real-time voice conversation
  const startConversation = useCallback(async () => {
    if (connectionState !== 'idle' || disabled) return;

    setError(null);
    setConnectionState('connecting');

    try {
      // 1. Get session token from our API
      console.log('[RealtimeVoice] Getting session token...');
      const sessionResponse = await fetch('/api/voice/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: 'alloy' }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to get session token');
      }

      const { session } = await sessionResponse.json();
      console.log('[RealtimeVoice] Got session:', session.id);

      // 2. Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // 3. Get microphone access
      console.log('[RealtimeVoice] Requesting microphone access...');
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 4. Connect to OpenAI Realtime WebSocket
      // Use subprotocol for authentication (browser WebSockets can't set headers)
      console.log('[RealtimeVoice] Connecting to WebSocket...');
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        ['realtime', `openai-insecure-api-key.${session.token}`]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RealtimeVoice] WebSocket connected');
        setConnectionState('connected');

        // Configure the session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `You are Slingshot 2.0, a helpful Christian AI assistant by JCIL.ai. Be concise, friendly, and helpful. Speak naturally as if having a real conversation. Keep responses brief unless asked for detail.`,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        }));

        // Start sending audio
        startAudioCapture();
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleRealtimeMessage(message);
      };

      ws.onerror = (event) => {
        console.error('[RealtimeVoice] WebSocket error:', event);
        setError('Connection error');
        setConnectionState('error');
      };

      ws.onclose = (event) => {
        console.log('[RealtimeVoice] WebSocket closed:', event.code, event.reason);
        setConnectionState('idle');
        cleanup();
      };

    } catch (err) {
      console.error('[RealtimeVoice] Start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
      setConnectionState('error');
      cleanup();
    }
  }, [connectionState, disabled, cleanup]);

  // Handle messages from OpenAI Realtime API
  const handleRealtimeMessage = useCallback((message: {
    type: string;
    delta?: string;
    transcript?: string;
    audio?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) => {
    switch (message.type) {
      case 'session.created':
        console.log('[RealtimeVoice] Session created');
        break;

      case 'session.updated':
        console.log('[RealtimeVoice] Session updated');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[RealtimeVoice] User started speaking');
        setIsUserSpeaking(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[RealtimeVoice] User stopped speaking');
        setIsUserSpeaking(false);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        if (message.transcript) {
          console.log('[RealtimeVoice] User transcript:', message.transcript);
          onConversationMessage('user', message.transcript);
        }
        break;

      case 'response.audio_transcript.delta':
        // AI response transcript streaming
        if (message.delta) {
          setCurrentTranscript(prev => prev + message.delta);
        }
        break;

      case 'response.audio_transcript.done':
        // AI response transcript complete
        if (message.transcript) {
          console.log('[RealtimeVoice] AI transcript:', message.transcript);
          onConversationMessage('assistant', message.transcript);
          setCurrentTranscript('');
        }
        break;

      case 'response.audio.delta':
        // AI audio response chunk
        if (message.delta) {
          const audioData = base64ToFloat32Array(message.delta);
          playbackQueueRef.current.push(audioData);
          playNextAudio();
        }
        break;

      case 'response.audio.done':
        console.log('[RealtimeVoice] AI audio complete');
        break;

      case 'error':
        console.error('[RealtimeVoice] API error:', message);
        setError(message.error?.message || 'API error');
        break;

      default:
        // Log other message types for debugging
        if (message.type.includes('error')) {
          console.error('[RealtimeVoice] Error message:', message);
        }
    }
  }, [onConversationMessage, base64ToFloat32Array, playNextAudio]);

  // Start capturing and sending audio
  const startAudioCapture = useCallback(() => {
    if (!audioContextRef.current || !mediaStreamRef.current || !wsRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
    sourceRef.current = source;

    // Use ScriptProcessorNode for audio processing (deprecated but widely supported)
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const base64Audio = float32ToBase64(inputData);

      // Send audio to OpenAI
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      }));
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);

    console.log('[RealtimeVoice] Audio capture started');
  }, [float32ToBase64]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    console.log('[RealtimeVoice] Stopping conversation...');
    setConnectionState('idle');
    cleanup();
  }, [cleanup]);

  // Toggle conversation
  const toggleConversation = useCallback(() => {
    if (connectionState === 'connected') {
      stopConversation();
    } else if (connectionState === 'idle') {
      startConversation();
    }
  }, [connectionState, startConversation, stopConversation]);

  const isActive = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <>
      {/* Conversation Overlay */}
      {isActive && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 pointer-events-none">
          <div className="glass-morphism rounded-2xl px-6 py-4 max-w-lg w-full shadow-2xl border border-[#0096FF]/30 pointer-events-auto">
            {/* Status indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Voice wave animation */}
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isUserSpeaking
                          ? 'bg-green-400 animate-voice-wave'
                          : isAISpeaking
                          ? 'bg-[#0096FF] animate-voice-wave'
                          : 'bg-gray-500 h-2'
                      }`}
                      style={{
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span className={`text-sm font-medium ${
                  isUserSpeaking ? 'text-green-400' : isAISpeaking ? 'text-[#0096FF]' : 'text-gray-400'
                }`}>
                  {isUserSpeaking ? 'You are speaking...' : isAISpeaking ? 'AI is speaking...' : 'Listening...'}
                </span>
              </div>
              <button
                onClick={stopConversation}
                className="text-red-400 hover:text-red-300 text-sm font-medium"
              >
                End Call
              </button>
            </div>

            {/* Current transcript */}
            {currentTranscript && (
              <p className="text-white/80 text-sm italic">
                {currentTranscript}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg max-w-xs">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Voice Button - positioned above the send button area */}
      <button
        onClick={toggleConversation}
        disabled={disabled || isConnecting}
        className={`
          fixed bottom-[9.5rem] right-4 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg transition-all duration-300 ease-out
          ${isActive
            ? 'bg-red-500 hover:bg-red-600 animate-pulse-glow-red'
            : isConnecting
            ? 'bg-yellow-500 cursor-wait'
            : 'bg-[#0096FF]/80 hover:bg-[#0096FF] hover:scale-105 shadow-[#0096FF]/20'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={isActive ? 'End voice call' : 'Start voice call'}
        title={isActive ? 'Click to end call' : 'Click to start voice conversation'}
      >
        {isConnecting ? (
          /* Loading spinner */
          <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isActive ? (
          /* Stop/X icon when active */
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* Voice wave icon */
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-3 bg-white rounded-full" />
            <div className="w-1 h-5 bg-white rounded-full" />
            <div className="w-1 h-6 bg-white rounded-full" />
            <div className="w-1 h-5 bg-white rounded-full" />
            <div className="w-1 h-3 bg-white rounded-full" />
          </div>
        )}
      </button>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes voice-wave {
          0%, 100% {
            height: 8px;
          }
          50% {
            height: 24px;
          }
        }

        .animate-voice-wave {
          animation: voice-wave 0.5s ease-in-out infinite;
        }

        @keyframes pulse-glow-red {
          0%, 100% {
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(239, 68, 68, 0.6), 0 0 60px rgba(239, 68, 68, 0.3);
          }
        }

        .animate-pulse-glow-red {
          animation: pulse-glow-red 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
