/**
 * VOICE CHAT BUTTON COMPONENT
 *
 * PURPOSE:
 * - Enable hands-free voice conversation with AI
 * - Click to start recording, auto-sends after 1.5s silence
 * - AI responses are spoken back via TTS
 *
 * FEATURES:
 * - Fuzzy electric blue glow when idle
 * - Grey when recording
 * - Automatic silence detection (1.5 seconds)
 * - Auto-sends message when silence detected
 * - TTS playback for AI responses
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'speaking';

interface VoiceChatButtonProps {
  onTranscriptionComplete: (text: string) => void;
  isStreaming: boolean;
  lastAssistantMessage?: string;
  voiceModeActive: boolean;
  onVoiceModeChange: (active: boolean) => void;
}

export function VoiceChatButton({
  onTranscriptionComplete,
  isStreaming,
  lastAssistantMessage,
  voiceModeActive,
  onVoiceModeChange,
}: VoiceChatButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPlayedMessageRef = useRef<string>(''); // Track last played message to avoid replaying
  const shouldAutoRestartRef = useRef<boolean>(false); // Track if we should auto-restart after TTS

  const SILENCE_THRESHOLD = 20; // Audio level below this is silence
  const SILENCE_DURATION = 1500; // 1.5 seconds of silence to trigger send

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  // Play TTS when assistant message arrives and voice mode is active
  useEffect(() => {
    if (voiceModeActive && lastAssistantMessage && !isStreaming && voiceState === 'idle') {
      // Only play if this is a new message we haven't played yet
      if (lastAssistantMessage !== lastPlayedMessageRef.current) {
        lastPlayedMessageRef.current = lastAssistantMessage;
        shouldAutoRestartRef.current = true; // Auto-restart listening after TTS
        playTTS(lastAssistantMessage);
      }
    }
  }, [lastAssistantMessage, isStreaming, voiceModeActive, voiceState]);

  const playTTS = async (text: string) => {
    if (!text || text.length < 2) return;

    try {
      setVoiceState('speaking');

      // Strip markdown and code blocks for cleaner speech
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_~]/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'alloy' }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play audio
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioElementRef.current = null;
        // Auto-restart recording for continuous conversation
        if (shouldAutoRestartRef.current && voiceModeActive) {
          // Small delay before restarting to feel natural
          setTimeout(() => {
            if (voiceModeActive) {
              startRecording();
            } else {
              setVoiceState('idle');
            }
          }, 300);
        } else {
          setVoiceState('idle');
        }
      };

      audio.onerror = () => {
        setVoiceState('idle');
        URL.revokeObjectURL(audioUrl);
        audioElementRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error('[VoiceChat] TTS error:', err);
      setVoiceState('idle');
    }
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      onVoiceModeChange(true);
      shouldAutoRestartRef.current = true; // Enable auto-restart for conversation flow

      // Stop any playing audio (allows interruption)
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current = null;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for silence detection
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setVoiceState('recording');

      // Start silence detection
      detectSilence();
    } catch (err) {
      console.error('[VoiceChat] Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
      setVoiceState('idle');
      onVoiceModeChange(false);
    }
  }, [onVoiceModeChange]);

  const detectSilence = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudioLevel = () => {
      if (voiceState !== 'recording' || !analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (average < SILENCE_THRESHOLD) {
        // Silence detected - start timer if not already started
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            // Auto-stop after silence
            stopRecording();
          }, SILENCE_DURATION);
        }
      } else {
        // Sound detected - clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      // Continue checking
      requestAnimationFrame(checkAudioLevel);
    };

    requestAnimationFrame(checkAudioLevel);
  }, [voiceState]);

  const stopRecording = useCallback(async () => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        try {
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          // Close audio context
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // Only transcribe if we have enough audio
          if (audioBlob.size > 1000) {
            setVoiceState('transcribing');

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await fetch('/api/voice/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Transcription failed');
            }

            const result = await response.json();

            if (result.text && result.text.trim()) {
              // Send the transcribed text
              onTranscriptionComplete(result.text.trim());
            }
          }

          setVoiceState('idle');
          resolve();
        } catch (err) {
          console.error('[VoiceChat] Transcription error:', err);
          setError(err instanceof Error ? err.message : 'Transcription failed');
          setVoiceState('idle');
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [onTranscriptionComplete]);

  const handleClick = async () => {
    if (isStreaming) return;

    if (voiceState === 'idle') {
      await startRecording();
    } else if (voiceState === 'recording') {
      await stopRecording();
    } else if (voiceState === 'speaking') {
      // Stop speaking and start listening (interruption)
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      // Start recording immediately for interruption
      await startRecording();
    }
  };

  const handleDisableVoiceMode = () => {
    shouldAutoRestartRef.current = false; // Stop auto-restart
    onVoiceModeChange(false);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    // Also stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
    setVoiceState('idle');
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isStreaming || voiceState === 'transcribing'}
        className={`
          relative rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300
          ${voiceState === 'recording'
            ? 'bg-gray-500 text-white'
            : voiceState === 'transcribing'
            ? 'bg-gray-600 text-white'
            : voiceState === 'speaking'
            ? 'bg-green-500 text-white animate-pulse'
            : 'bg-cyan-500/80 text-white hover:bg-cyan-400/90'
          }
          ${voiceState === 'idle' ? 'shadow-[0_0_15px_rgba(6,182,212,0.6)]' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title={
          voiceState === 'idle'
            ? 'Start voice chat'
            : voiceState === 'recording'
            ? 'Listening... (auto-sends after 1.5s silence)'
            : voiceState === 'transcribing'
            ? 'Processing...'
            : 'AI is speaking (click to stop)'
        }
      >
        {voiceState === 'transcribing' ? (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            ...
          </span>
        ) : voiceState === 'speaking' ? (
          'Playing'
        ) : voiceState === 'recording' ? (
          <span className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Listening
          </span>
        ) : (
          'Talk'
        )}
      </button>

      {/* Voice mode indicator */}
      {voiceModeActive && voiceState === 'idle' && (
        <button
          onClick={handleDisableVoiceMode}
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
          title="Disable voice mode"
        >
          ×
        </button>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500/90 px-2 py-1 text-xs text-white">
          {error}
        </div>
      )}
    </div>
  );
}
