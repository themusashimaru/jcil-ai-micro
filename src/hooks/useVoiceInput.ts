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
  const SILENCE_GRACE_PERIOD = 3000;  // 3 seconds before silence detection activates (was 2)
  const AUDIO_THRESHOLD = 3;  // Very low threshold for detecting any speech (was 5)
  const MIN_RECORDING_DURATION = 1500;  // Minimum 1.5 second recording to avoid hallucinations
  const SILENCE_DURATION_MS = 3000;  // 3 seconds of silence before auto-stop (more forgiving)

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
  // Ref to hold processAudio function (avoids stale closure issues)
  const processAudioRef = useRef<((blob: Blob) => Promise<void>) | null>(null);

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

      // Detect speech - log levels periodically to debug
      if (normalizedLevel > 10) {
        console.log('[VoiceInput] Audio level:', normalizedLevel, 'threshold:', AUDIO_THRESHOLD);
      }

      if (normalizedLevel > AUDIO_THRESHOLD) {
        if (!hasDetectedSpeechRef.current) {
          console.log('[VoiceInput] Speech detected! Level:', normalizedLevel);
        }
        hasDetectedSpeechRef.current = true;

        // Reset silence timer when speech is detected
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (graceperiodPassedRef.current && hasDetectedSpeechRef.current) {
        // Only start silence timer after grace period AND after we've detected speech
        // This prevents premature stopping during pauses
        // Use our more forgiving SILENCE_DURATION_MS instead of silenceTimeout
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
          }, SILENCE_DURATION_MS);
        }
      }

      if (state.isRecording) {
        requestAnimationFrame(checkLevel);
      }
    };

    checkLevel();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stopRecording is stable, avoiding circular dependency
  }, [state.isRecording, SILENCE_GRACE_PERIOD, AUDIO_THRESHOLD, SILENCE_DURATION_MS]);

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

      // Use processAudioRef to avoid stale closure issues
      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('[VoiceInput] MediaRecorder stopped, processing audio...');
          if (processAudioRef.current) {
            await processAudioRef.current(audioBlob);
          } else {
            console.error('[VoiceInput] processAudioRef is null!');
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- processAudio/stopRecording are stable, avoiding circular dependency
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

  // Check for hallucinations (non-Latin characters, known phrases)
  const isHallucination = useCallback((text: string): boolean => {
    const trimmed = text.trim().toLowerCase();

    // Empty or too short
    if (!trimmed || trimmed.length < 3) return true;

    // Single word and short
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2 && trimmed.length < 10) return true;

    // Non-Latin characters (Chinese, Korean, Japanese, Arabic, etc.)
    const nonLatinPattern = /[\u3000-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0E00-\u0E7F\u1100-\u11FF]/;
    if (nonLatinPattern.test(trimmed)) return true;

    // Common Whisper hallucination phrases - these appear when there's silence/noise
    const hallucinations = [
      // Short filler words
      /^thanks?\.?$/i,
      /^thank\s+you\.?$/i,
      /^bye\.?$/i,
      /^goodbye\.?$/i,
      /^hello\.?$/i,
      /^hey\.?$/i,
      /^hi\.?$/i,
      /^okay\.?$/i,
      /^ok\.?$/i,
      /^yes\.?$/i,
      /^no\.?$/i,
      /^um+\.?$/i,
      /^uh+\.?$/i,
      /^ah+\.?$/i,
      /^oh+\.?$/i,
      /^hmm+\.?$/i,
      /^huh\.?$/i,
      /^wow\.?$/i,
      /^well\.?$/i,
      /^so\.?$/i,
      // Subtitle/caption artifacts
      /^\[.*\]$/,
      /^♪.*♪$/,
      /^music$/i,
      /^applause$/i,
      /^laughter$/i,
      /^\(.*\)$/,
      // Common hallucination phrases (Whisper generates these from silence)
      /thanks?\s+for\s+watching/i,
      /thanks?\s+for\s+listening/i,
      /subscribe/i,
      /like\s+and\s+subscribe/i,
      /see\s+you\s+(next|in\s+the)/i,
      /good\s+(girl|boy|job|work)/i,
      /that'?s?\s+a\s+good/i,
      /please\s+subscribe/i,
      /don'?t\s+forget/i,
      /leave\s+a\s+(like|comment)/i,
      /hit\s+the\s+(bell|like)/i,
      /i'?ll\s+see\s+you/i,
      /until\s+next\s+time/i,
      /take\s+care/i,
      /have\s+a\s+(good|great|nice)/i,
      /silence/i,
      /inaudible/i,
      /indistinct/i,
      // Single repeated words/sounds
      /^(.)\1{2,}$/,  // aaa, ooo, etc.
      /^(la\s*)+$/i,
      /^(na\s*)+$/i,
      /^(da\s*)+$/i,
    ];

    return hallucinations.some(pattern => pattern.test(trimmed));
  }, []);

  // Process audio with Whisper API
  const processAudio = useCallback(async (audioBlob: Blob) => {
    // Check minimum duration - skip very short recordings
    const recordingDuration = Date.now() - startTimeRef.current;
    console.log('[VoiceInput] Processing audio:', {
      duration: recordingDuration,
      minRequired: MIN_RECORDING_DURATION,
      speechDetected: hasDetectedSpeechRef.current,
      blobSize: audioBlob.size,
    });

    if (recordingDuration < MIN_RECORDING_DURATION) {
      console.log('[VoiceInput] Recording too short, skipping transcription');
      setState(prev => ({ ...prev, isProcessing: false }));
      cleanup();
      return;
    }

    // Check audio blob size - very small blobs are likely silence
    // WebM audio at ~100kbps = ~12.5KB/sec, so 2 seconds should be ~25KB minimum
    const MIN_BLOB_SIZE = 10000; // 10KB minimum
    if (audioBlob.size < MIN_BLOB_SIZE) {
      console.log('[VoiceInput] Audio blob too small, likely silence:', audioBlob.size);
      setState(prev => ({ ...prev, isProcessing: false }));
      cleanup();
      return;
    }

    // CRITICAL: Only send to Whisper if we actually detected speech
    // This prevents hallucinations when the user doesn't speak
    if (!hasDetectedSpeechRef.current) {
      console.log('[VoiceInput] No speech detected during recording, skipping Whisper');
      setState(prev => ({ ...prev, isProcessing: false }));
      cleanup();
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const formData = new FormData();

      // Convert to proper file format
      const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
      formData.append('file', audioFile);

      if (language) {
        formData.append('language', language);
      }

      // Add prompt to help with transcription
      formData.append('prompt', 'Transcribe the following speech accurately.');

      console.log('[VoiceInput] Sending to Whisper API...');
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });

      console.log('[VoiceInput] Whisper API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[VoiceInput] Whisper API error:', errorData);
        throw new Error(errorData.error || 'Transcription failed');
      }

      const result = await response.json();
      const transcript = result.text?.trim() || '';
      console.log('[VoiceInput] Transcription result:', transcript);

      // Filter out hallucinations
      if (isHallucination(transcript)) {
        console.log('[VoiceInput] Filtered hallucination:', transcript);
        setState(prev => ({ ...prev, transcript: '', isProcessing: false }));
        cleanup();
        return;
      }

      setState(prev => ({ ...prev, transcript, isProcessing: false }));

      if (transcript) {
        console.log('[VoiceInput] Calling onTranscript callback with:', transcript);
        onTranscript?.(transcript);
      }

    } catch (err) {
      console.error('[VoiceInput] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setState(prev => ({ ...prev, error: errorMessage, isProcessing: false }));
      onError?.(errorMessage);
    } finally {
      cleanup();
    }
  }, [cleanup, language, onError, onTranscript, isHallucination]);

  // Keep processAudioRef updated with latest function
  processAudioRef.current = processAudio;

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
