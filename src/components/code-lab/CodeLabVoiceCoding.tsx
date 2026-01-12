'use client';

/**
 * CODE LAB VOICE CODING MODE
 *
 * Hands-free coding with voice commands.
 *
 * Features:
 * - Continuous voice recognition
 * - Voice command detection
 * - Code dictation
 * - Natural language to code
 * - Voice feedback
 * - Multimodal (voice + visual)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';

type VoiceMode = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceCommand {
  pattern: RegExp;
  action: string;
  description: string;
}

// Built-in voice commands
const VOICE_COMMANDS: VoiceCommand[] = [
  { pattern: /^(hey code|hey codelab|code lab)/i, action: 'wake', description: 'Wake word' },
  { pattern: /^(stop|cancel|nevermind)/i, action: 'stop', description: 'Cancel current action' },
  { pattern: /^(fix|fix this|fix the error)/i, action: 'fix', description: 'Run /fix command' },
  { pattern: /^(run tests?|test)/i, action: 'test', description: 'Run tests' },
  { pattern: /^(build|run build)/i, action: 'build', description: 'Run build' },
  { pattern: /^(commit|save changes)/i, action: 'commit', description: 'Commit changes' },
  { pattern: /^(push|push changes)/i, action: 'push', description: 'Push to remote' },
  { pattern: /^(undo|undo that)/i, action: 'undo', description: 'Undo last action' },
  { pattern: /^(create|new) (file|component)/i, action: 'create', description: 'Create new file' },
  { pattern: /^(open|go to) (.+)/i, action: 'navigate', description: 'Open file' },
  { pattern: /^(explain|what does .+ do)/i, action: 'explain', description: 'Explain code' },
  { pattern: /^(search for|find) (.+)/i, action: 'search', description: 'Search codebase' },
];

interface CodeLabVoiceCodingProps {
  onCommand: (command: string, payload?: string) => void;
  onDictation: (text: string) => void;
  isEnabled?: boolean;
  className?: string;
}

export function CodeLabVoiceCoding({
  onCommand,
  onDictation,
  isEnabled = false,
  className = '',
}: CodeLabVoiceCodingProps) {
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isActive, setIsActive] = useState(isEnabled);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const feedbackTimeoutRef = useRef<NodeJS.Timeout>();

  const { isRecording, isProcessing, audioLevel, isSupported, toggleRecording, cancelRecording } =
    useVoiceInput({
      onTranscript: handleTranscript,
      onError: (error) => {
        showFeedback(`Error: ${error}`, 'error');
      },
      silenceTimeout: 3000,
      maxDuration: 60000,
    });

  // Handle transcript from voice input
  function handleTranscript(text: string) {
    setTranscript(text);

    // Check for voice commands
    const command = detectCommand(text);

    if (command) {
      executeCommand(command.action, command.payload);
      setCommandHistory((prev) => [...prev.slice(-9), text]);
    } else {
      // Treat as dictation
      onDictation(text);
      showFeedback('Dictated: ' + text.substring(0, 50) + '...', 'success');
    }
  }

  // Detect voice command from transcript
  function detectCommand(text: string): { action: string; payload?: string } | null {
    for (const cmd of VOICE_COMMANDS) {
      const match = text.match(cmd.pattern);
      if (match) {
        return {
          action: cmd.action,
          payload: match[2] || match[1],
        };
      }
    }
    return null;
  }

  // Execute detected command
  function executeCommand(action: string, payload?: string) {
    switch (action) {
      case 'wake':
        showFeedback('Listening...', 'info');
        break;
      case 'stop':
        cancelRecording();
        showFeedback('Cancelled', 'info');
        break;
      case 'fix':
        onCommand('/fix');
        showFeedback('Running fix...', 'success');
        break;
      case 'test':
        onCommand('/test');
        showFeedback('Running tests...', 'success');
        break;
      case 'build':
        onCommand('/build');
        showFeedback('Running build...', 'success');
        break;
      case 'commit':
        onCommand('/commit');
        showFeedback('Committing changes...', 'success');
        break;
      case 'push':
        onCommand('/push');
        showFeedback('Pushing changes...', 'success');
        break;
      case 'create':
        onCommand('create', payload);
        showFeedback(`Creating ${payload}...`, 'success');
        break;
      case 'navigate':
        onCommand('navigate', payload);
        showFeedback(`Opening ${payload}...`, 'info');
        break;
      case 'explain':
        onCommand('/explain');
        showFeedback('Explaining...', 'info');
        break;
      case 'search':
        onCommand('search', payload);
        showFeedback(`Searching for ${payload}...`, 'info');
        break;
      default:
        onCommand(action, payload);
    }
  }

  // Show feedback message
  function showFeedback(message: string, _type: 'success' | 'error' | 'info' = 'info') {
    setFeedback(message);

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback('');
    }, 3000);
  }

  // Toggle voice mode
  const handleToggle = useCallback(() => {
    if (isActive) {
      cancelRecording();
      setIsActive(false);
      setMode('idle');
    } else {
      setIsActive(true);
      toggleRecording();
    }
  }, [isActive, cancelRecording, toggleRecording]);

  // Update mode based on recording state
  useEffect(() => {
    if (isRecording) {
      setMode('listening');
    } else if (isProcessing) {
      setMode('processing');
    } else if (isActive) {
      // Auto-restart listening in voice mode
      setTimeout(() => {
        if (isActive) toggleRecording();
      }, 1000);
    } else {
      setMode('idle');
    }
  }, [isRecording, isProcessing, isActive, toggleRecording]);

  if (!isSupported) {
    return (
      <div className={`voice-coding unsupported ${className}`}>
        <p>Voice input is not supported in this browser</p>
      </div>
    );
  }

  return (
    <div className={`voice-coding ${className}`}>
      {/* Main control */}
      <div className="voice-control">
        <button
          className={`voice-btn ${mode}`}
          onClick={handleToggle}
          title={isActive ? 'Stop voice mode' : 'Start voice mode'}
        >
          <div className="voice-indicator">
            <div className="audio-ring" style={{ transform: `scale(${1 + audioLevel / 100})` }} />
            <div className="mic-icon">
              {mode === 'listening' ? '🎙️' : mode === 'processing' ? '⏳' : '🎤'}
            </div>
          </div>
        </button>

        <div className="voice-status">
          <span className={`status-label ${mode}`}>
            {mode === 'idle' && 'Voice Mode Off'}
            {mode === 'listening' && 'Listening...'}
            {mode === 'processing' && 'Processing...'}
            {mode === 'speaking' && 'Speaking...'}
          </span>
          {transcript && <span className="transcript">&quot;{transcript}&quot;</span>}
        </div>

        <button className="help-btn" onClick={() => setShowHelp(!showHelp)} title="Voice commands">
          ❓
        </button>
      </div>

      {/* Feedback toast */}
      {feedback && <div className="voice-feedback">{feedback}</div>}

      {/* Help panel */}
      {showHelp && (
        <div className="voice-help">
          <h4>Voice Commands</h4>
          <div className="command-list">
            {VOICE_COMMANDS.map((cmd, idx) => (
              <div key={idx} className="command-item">
                <code>{cmd.pattern.source.replace(/[^a-zA-Z\s|]/g, '').trim()}</code>
                <span>{cmd.description}</span>
              </div>
            ))}
          </div>

          {commandHistory.length > 0 && (
            <>
              <h4>Recent Commands</h4>
              <div className="history-list">
                {commandHistory
                  .slice()
                  .reverse()
                  .map((cmd, idx) => (
                    <div key={idx} className="history-item">
                      {cmd}
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .voice-coding {
          position: relative;
        }

        .voice-coding.unsupported {
          padding: 1rem;
          text-align: center;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .voice-control {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
        }

        .voice-btn {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: var(--cl-bg-primary, white);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .voice-btn.listening {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
        }

        .voice-btn.processing {
          background: #f59e0b;
        }

        .voice-indicator {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .audio-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid currentColor;
          opacity: 0.3;
          transition: transform 0.1s;
        }

        .voice-btn.listening .audio-ring {
          border-color: white;
        }

        .mic-icon {
          font-size: 1.5rem;
          z-index: 1;
        }

        .voice-status {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .status-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
        }

        .status-label.listening {
          color: #ef4444;
        }

        .status-label.processing {
          color: #f59e0b;
        }

        .transcript {
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #6b7280);
          font-style: italic;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .help-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 1rem;
        }

        .help-btn:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .voice-feedback {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 0.5rem;
          padding: 0.5rem 1rem;
          background: #1a1f36;
          color: white;
          border-radius: 8px;
          font-size: 0.8125rem;
          white-space: nowrap;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .voice-help {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          width: 320px;
          padding: 1rem;
          background: var(--cl-bg-primary, white);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .voice-help h4 {
          margin: 0 0 0.75rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .command-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .command-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .command-item code {
          padding: 0.25rem 0.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .command-item span {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .history-item {
          font-size: 0.75rem;
          color: var(--cl-text-secondary, #4b5563);
          padding: 0.25rem 0.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
