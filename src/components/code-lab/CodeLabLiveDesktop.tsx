/**
 * Live Desktop Panel — Displays an interactive E2B desktop sandbox preview.
 *
 * Users can watch the AI interact with a real desktop environment:
 * - Screenshots update in real-time as the AI works
 * - Manual controls for screenshot, URL navigation, and commands
 * - Status indicators for sandbox lifecycle
 */

'use client';

import { useDesktopSandbox } from './useDesktopSandbox';

interface CodeLabLiveDesktopProps {
  sessionId: string;
}

export function CodeLabLiveDesktop({ sessionId }: CodeLabLiveDesktopProps) {
  const {
    desktop,
    urlInput, setUrlInput,
    commandInput, setCommandInput,
    aiTaskInput, setAiTaskInput,
    aiTaskRunning,
    aiSteps,
    aiSummary,
    isRefreshing,
    startDesktop,
    takeScreenshot,
    openUrl,
    runCommand,
    runAiTask,
  } = useDesktopSandbox(sessionId);

  // Idle state
  if (desktop.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">Live Desktop</h3>
        <p className="text-sm text-text-muted mb-4 max-w-[240px] leading-relaxed">
          Launch a virtual desktop to browse websites, run apps, and watch the AI work visually.
        </p>
        <button
          onClick={startDesktop}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Start Desktop
        </button>
        <div className="w-full mt-4 px-4">
          <div className="relative">
            <input
              type="text"
              value={aiTaskInput}
              onChange={(e) => setAiTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aiTaskInput.trim()) {
                  startDesktop().then(() => runAiTask(aiTaskInput));
                }
              }}
              placeholder="Or describe a task for AI..."
              className="w-full px-3 py-2 pr-10 text-xs bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-500/50"
              aria-label="Describe a task for the AI to complete on the desktop"
            />
            {aiTaskInput.trim() && (
              <button
                onClick={() => startDesktop().then(() => runAiTask(aiTaskInput))}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Run AI
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3 opacity-60">
          Powered by E2B sandbox + Anthropic Computer Use
        </p>
      </div>
    );
  }

  // Starting state
  if (desktop.status === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <svg className="w-8 h-8 animate-spin text-blue-400 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm text-text-muted">Starting virtual desktop...</p>
        <p className="text-xs text-text-muted mt-1 opacity-60">This may take 10-15 seconds</p>
      </div>
    );
  }

  // Error state (no screenshot)
  if (desktop.status === 'error' && !desktop.screenshot) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-red-400 mb-3">{desktop.error}</p>
        <button onClick={startDesktop} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-text-primary transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // Running state
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <form className="flex-1 flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); openUrl(urlInput); }}>
          <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Enter URL..." className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-500/50" aria-label="URL to open in desktop browser" />
          <button type="submit" disabled={!urlInput.trim()} className="px-2 py-1 text-xs rounded bg-blue-600/80 hover:bg-blue-500 disabled:opacity-30 text-white transition-colors" aria-label="Navigate to URL">Go</button>
        </form>
        <button onClick={takeScreenshot} disabled={isRefreshing} className="p-1.5 rounded hover:bg-white/10 transition-colors text-text-muted" aria-label="Refresh screenshot" title="Refresh (auto-refreshes every 5s)">
          <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${desktop.status === 'running' ? 'bg-green-400 animate-pulse' : desktop.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`} aria-label={`Desktop ${desktop.status}`} />
          <span className="text-[10px] text-text-muted font-mono">{desktop.status === 'running' ? 'Live' : desktop.status}</span>
        </div>
      </div>

      {/* Screenshot */}
      <div className="flex-1 overflow-auto bg-black/20 relative">
        {desktop.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${desktop.screenshot}`} alt="Desktop screenshot" className="w-full h-auto object-contain" />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-muted">Waiting for first screenshot...</div>
        )}
        {isRefreshing && <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-text-muted">Updating...</div>}
      </div>

      {/* Command bar */}
      <form className="flex items-center gap-1 px-3 py-2 border-t border-white/10" onSubmit={(e) => { e.preventDefault(); runCommand(commandInput); }}>
        <span className="text-xs text-text-muted font-mono">$</span>
        <input type="text" value={commandInput} onChange={(e) => setCommandInput(e.target.value)} placeholder="Run a terminal command..." className="flex-1 px-2 py-1 text-xs bg-transparent border-none text-text-primary placeholder:text-text-muted focus:outline-none font-mono" aria-label="Terminal command" />
        <button type="submit" disabled={!commandInput.trim()} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/15 disabled:opacity-30 text-text-primary transition-colors" aria-label="Run command">Run</button>
      </form>

      {/* AI Task input */}
      <form className="flex items-center gap-1 px-3 py-2 border-t border-white/10" onSubmit={(e) => { e.preventDefault(); runAiTask(aiTaskInput); }}>
        <span className="text-xs text-purple-400 font-medium">AI</span>
        <input type="text" value={aiTaskInput} onChange={(e) => setAiTaskInput(e.target.value)} disabled={aiTaskRunning} placeholder={aiTaskRunning ? 'AI is working...' : 'Tell AI what to do on the desktop...'} className="flex-1 px-2 py-1 text-xs bg-transparent border-none text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50" aria-label="AI task description" />
        {aiTaskRunning ? (
          <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <button type="submit" disabled={!aiTaskInput.trim()} className="px-2 py-1 text-xs rounded bg-purple-600/80 hover:bg-purple-500 disabled:opacity-30 text-white transition-colors" aria-label="Run AI task">Run</button>
        )}
      </form>

      {/* AI Steps log */}
      {aiSteps.length > 0 && (
        <div className="px-3 py-1 border-t border-white/5 max-h-20 overflow-y-auto">
          {aiSteps.map((step, i) => (
            <div key={i} className="text-[10px] text-text-muted font-mono py-0.5">
              <span className="text-purple-400">{i + 1}.</span> {step.action}
              {step.reasoning && <span className="opacity-50 ml-1">— {step.reasoning.slice(0, 60)}</span>}
            </div>
          ))}
        </div>
      )}

      {aiSummary && (
        <div className="px-3 py-2 border-t border-purple-500/20 bg-purple-500/5 text-xs text-purple-300">{aiSummary}</div>
      )}

      {desktop.lastAction && (
        <div className="px-3 py-1 border-t border-white/5 text-[10px] text-text-muted font-mono truncate">{desktop.lastAction}</div>
      )}

      {desktop.error && (
        <div className="px-3 py-1.5 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400" role="alert">{desktop.error}</div>
      )}
    </div>
  );
}
