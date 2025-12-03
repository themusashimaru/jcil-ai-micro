'use client';
import React, { useRef, useState } from 'react';
import { RealtimeClient } from './realtimeClient';
import { recordOneUtterance } from './localRecorder';

export default function VoiceButton({
  onUserText,
  onAssistantText,
  onStart,
}: {
  onUserText: (delta: string, done?: boolean) => void;
  onAssistantText: (delta: string, done?: boolean) => void;
  onStart?: () => void;
}) {
  const rtc = useRef<RealtimeClient | null>(null);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<string>('idle');

  async function start() {
    // Trigger chat creation/opening first
    onStart?.();

    rtc.current = new RealtimeClient({
      voice: 'verse',
      onStatus: setStatus,
      onUserTranscriptDelta: (t) => onUserText(t, false),
      onUserTranscriptDone: (t) => onUserText(t || '', true),
      onTranscriptDelta: (t) => onAssistantText(t, false),
      onTranscriptDone: (t) => onAssistantText(t || '', true),
    });
    await rtc.current.start();
    setLive(true);
  }

  async function stop() {
    try {
      // whisper fallback
      const blob = await recordOneUtterance(1200);
      const fd = new FormData();
      fd.append('file', new File([blob], 'user.webm', { type: 'audio/webm' }));
      const r = await fetch('/api/whisper', { method: 'POST', body: fd });
      if (r.ok) {
        const { text } = await r.json();
        if (text?.trim()) onUserText(text, true);
      }
    } catch {}
    await rtc.current?.stop();
    rtc.current = null;
    setLive(false);
    setStatus('idle');
  }

  return (
    <button
      onClick={live ? stop : start}
      className={`
        fixed bottom-[9.5rem] right-4 z-50
        w-14 h-14 rounded-full
        flex items-center justify-center
        shadow-lg transition-all duration-300 ease-out
        ${live
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-[#0096FF]/80 hover:bg-[#0096FF] hover:scale-105 shadow-[#0096FF]/20'
        }
      `}
      aria-label={live ? 'Stop voice' : 'Start voice'}
      title={`${status} - ${live ? 'Click to stop' : 'Click to start voice conversation'}`}
    >
      {live ? (
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
  );
}
