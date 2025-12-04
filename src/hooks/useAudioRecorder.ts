/**
 * SPEECH RECOGNITION HOOK
 *
 * PURPOSE:
 * - Handle speech-to-text using browser's native Web Speech API
 * - Works with device dictation (no server calls needed)
 * - More reliable than Whisper for real-time transcription
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type RecordingState = 'idle' | 'recording' | 'transcribing';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
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
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useAudioRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  const resolveRef = useRef<((value: string) => void) | null>(null);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);

  // Check if Speech Recognition is supported
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.');
      return;
    }

    try {
      setError(null);
      transcriptRef.current = '';

      // Create SpeechRecognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true; // Keep listening until stopped
      recognition.interimResults = true; // Get results as user speaks
      recognition.lang = 'en-US'; // English language

      recognition.onstart = () => {
        setRecordingState('recording');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';

        // Collect all final results
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          transcriptRef.current = finalTranscript;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);

        // Don't treat 'no-speech' as an error - just return empty
        if (event.error === 'no-speech') {
          transcriptRef.current = '';
          return;
        }

        // Handle permission denied
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'network') {
          setError('Network error. Please check your connection.');
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }

        setRecordingState('idle');
        if (rejectRef.current) {
          rejectRef.current(new Error(event.error));
          rejectRef.current = null;
          resolveRef.current = null;
        }
      };

      recognition.onend = () => {
        // Only resolve if we're still in recording/transcribing state
        if (resolveRef.current) {
          resolveRef.current(transcriptRef.current);
          resolveRef.current = null;
          rejectRef.current = null;
        }
        setRecordingState('idle');
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition. Please try again.');
      setRecordingState('idle');
    }
  }, [isSupported]);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recognition = recognitionRef.current;

      if (!recognition) {
        resolve('');
        return;
      }

      // Store resolve/reject for onend handler
      resolveRef.current = resolve;
      rejectRef.current = reject;

      setRecordingState('transcribing');

      // Stop recognition - onend will fire and resolve the promise
      recognition.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.abort();
    }
    transcriptRef.current = '';
    resolveRef.current = null;
    rejectRef.current = null;
    setRecordingState('idle');
    setError(null);
  }, []);

  return {
    recordingState,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
  };
}
