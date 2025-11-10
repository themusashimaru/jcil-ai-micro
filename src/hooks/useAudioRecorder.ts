/**
 * AUDIO RECORDER HOOK
 *
 * PURPOSE:
 * - Handle microphone recording using MediaRecorder API
 * - Transcribe audio using Whisper API
 * - Manage recording state and permissions
 */

'use client';

import { useState, useRef, useCallback } from 'react';

type RecordingState = 'idle' | 'recording' | 'transcribing';

export function useAudioRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
      mediaRecorder.start();
      setRecordingState('recording');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
      setRecordingState('idle');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      mediaRecorder.onstop = async () => {
        try {
          // Stop all tracks
          const stream = mediaRecorder.stream;
          stream.getTracks().forEach((track) => track.stop());

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // Transcribe audio
          setRecordingState('transcribing');

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Transcription failed');
          }

          const result = await response.json();
          setRecordingState('idle');
          resolve(result.text);
        } catch (err) {
          console.error('Transcription error:', err);
          setError(err instanceof Error ? err.message : 'Transcription failed');
          setRecordingState('idle');
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      const stream = mediaRecorder.stream;
      stream.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setRecordingState('idle');
    setError(null);
  }, []);

  return {
    recordingState,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
