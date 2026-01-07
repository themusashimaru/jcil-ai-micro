'use client';

/**
 * USE VOICE INPUT HOOK
 *
 * A powerful hook for voice-to-text in Code Lab.
 * Uses Web Audio API for recording and Whisper API for transcription.
 *
 * Features:
 * - Real-time recording with visual feedback
 * - Automatic silence detection
 * - Audio level monitoring for visual feedback
 * - Noise cancellation support
 * - Mobile-optimized (works with native mic button)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceInputState {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;  // 0-100 for visual feedback
  error: string | null;
  transcript: string | null;
  duration: number;  // Recording duration in seconds
}

export interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  silenceTimeout?: number;  // Auto-stop after silence (ms)
  maxDuration?: number;  // Max recording duration (ms)
  language?: string;  // Whisper language hint
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    onTranscript,
    onError,
    silenceTimeout = 4000,  // 4 seconds of silence before auto-stop
    maxDuration = 120000,   // 2 minutes max
    language,
  } = options;

  // Grace period before silence detection kicks in (let user start speaking)
  const SILENCE_GRACE_PERIOD = 2000;  // 2 seconds before silence detection activates
  const AUDIO_THRESHOLD = 5;  // Lower threshold for detecting speech (was 10)

  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    error: null,
    transcript: null,
    duration: 0,
  });

  // Refs for audio processing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const graceperiodPassedRef = useRef<boolean>(false);
  const hasDetectedSpeechRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    graceperiodPassedRef.current = false;
    hasDetectedSpeechRef.current = false;
  }, []);

  // Monitor audio levels for visual feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average level with more weight on voice frequencies (300Hz-3kHz)
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      const normalizedLevel = Math.min(100, Math.round((average / 128) * 100));

      setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

      // Check if grace period has passed
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= SILENCE_GRACE_PERIOD && !graceperiodPassedRef.current) {
        graceperiodPassedRef.current = true;
      }

      // Detect speech with lower threshold
      if (normalizedLevel > AUDIO_THRESHOLD) {
        hasDetectedSpeechRef.current = true;

        // Reset silence timer when speech is detected
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (graceperiodPassedRef.current && hasDetectedSpeechRef.current) {
        // Only start silence timer after grace period AND after we've detected speech
        // This prevents premature stopping during pauses
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
          }, silenceTimeout);
        }
      }

      if (state.isRecording) {
        requestAnimationFrame(checkLevel);
      }
    };

    checkLevel();
  }, [silenceTimeout, state.isRecording, SILENCE_GRACE_PERIOD, AUDIO_THRESHOLD]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, transcript: null }));

      // Request microphone access with noise cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio context for level monitoring
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // CRITICAL FIX: Wrap processAudio in try-catch to handle errors
      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          await processAudio(audioBlob);
        } catch (error) {
          console.error('[VoiceInput] Error processing audio:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
          setState(prev => ({ ...prev, error: errorMessage, isProcessing: false }));
          onError?.(errorMessage);
          cleanup();
        }
      };

      // Start recording
      mediaRecorder.start(100);  // Collect data every 100ms
      startTimeRef.current = Date.now();

      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));

      // Reset tracking refs for new recording
      graceperiodPassedRef.current = false;
      hasDetectedSpeechRef.current = false;

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

      // Start audio level monitoring (handles silence detection after grace period)
      monitorAudioLevel();

      // NOTE: Silence detection is now handled in monitorAudioLevel()
      // It waits for grace period AND requires speech detection before starting silence timer

      // Set up max duration safety
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, maxDuration);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
      cleanup();
    }
  }, [cleanup, maxDuration, monitorAudioLevel, onError, silenceTimeout]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  // Process audio with Whisper API
  const processAudio = useCallback(async (audioBlob: Blob) => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const formData = new FormData();

      // Convert to proper file format
      const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
      formData.append('file', audioFile);

      if (language) {
        formData.append('language', language);
      }

      // Add prompt to help with code-related transcription
      formData.append('prompt', 'This is a coding-related voice command. It may include programming terms, function names, and technical jargon.');

      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      const transcript = result.text?.trim() || '';

      setState(prev => ({ ...prev, transcript, isProcessing: false }));

      if (transcript) {
        onTranscript?.(transcript);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setState(prev => ({ ...prev, error: errorMessage, isProcessing: false }));
      onError?.(errorMessage);
    } finally {
      cleanup();
    }
  }, [cleanup, language, onError, onTranscript]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  // Cancel recording (without processing)
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: false,
      audioLevel: 0,
      duration: 0,
    }));
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Check if browser supports voice input
  const isSupported = typeof window !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices &&
    'MediaRecorder' in window;

  return {
    ...state,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
}
