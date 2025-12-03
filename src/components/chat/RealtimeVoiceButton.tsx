/**
 * REALTIME VOICE BUTTON
 *
 * PURPOSE:
 * - Floating voice button with real-time transcription
 * - Uses Web Speech API for live speech-to-text
 * - Shows voice waves animation while recording
 * - Electric blue theme
 *
 * FEATURES:
 * - Real-time transcription (text appears as you speak)
 * - Floating button in bottom-right corner
 * - Voice wave animation
 * - Transcription overlay while speaking
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface RealtimeVoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function RealtimeVoiceButton({ onTranscript, disabled }: RealtimeVoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('[Voice] Started listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Voice] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors - just means silence
      } else {
        setError(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('[Voice] Stopped listening');
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('[Voice] Start error:', err);
      setError('Failed to start speech recognition');
    }
  }, [isSupported, disabled]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Send final transcript to parent
    const finalText = (transcript + interimTranscript).trim();
    if (finalText) {
      onTranscript(finalText);
    }

    setIsListening(false);
    setTranscript('');
    setInterimTranscript('');
  }, [transcript, interimTranscript, onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  const displayText = transcript + interimTranscript;

  return (
    <>
      {/* Transcription Overlay - shows while speaking */}
      {isListening && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 pointer-events-none">
          <div className="glass-morphism rounded-2xl px-6 py-4 max-w-lg w-full shadow-2xl border border-[#0096FF]/30 pointer-events-auto">
            <div className="flex items-center gap-3 mb-2">
              {/* Animated voice waves */}
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#0096FF] rounded-full animate-voice-wave"
                    style={{
                      height: `${12 + Math.random() * 12}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[#0096FF] text-sm font-medium">Listening...</span>
            </div>
            <p className="text-white text-lg min-h-[1.5em]">
              {displayText || (
                <span className="text-white/50 italic">Start speaking...</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && !isListening && (
        <div className="fixed bottom-24 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Floating Voice Button */}
      <button
        onClick={toggleListening}
        disabled={disabled}
        className={`
          fixed bottom-20 right-4 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg shadow-[#0096FF]/20
          transition-all duration-300 ease-out
          ${isListening
            ? 'bg-[#0096FF] scale-110 animate-pulse-glow'
            : 'bg-[#0096FF]/80 hover:bg-[#0096FF] hover:scale-105'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={isListening ? 'Stop recording' : 'Start voice input'}
        title={isListening ? 'Click to stop and send' : 'Click to speak'}
      >
        {isListening ? (
          /* Voice waves animation while recording */
          <div className="flex items-center gap-0.5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full animate-voice-wave"
                style={{
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        ) : (
          /* Microphone/Voice icon */
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
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

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 150, 255, 0.4), 0 0 40px rgba(0, 150, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(0, 150, 255, 0.6), 0 0 60px rgba(0, 150, 255, 0.3);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
