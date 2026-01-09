'use client';

/**
 * CODE LAB PREVIEW
 *
 * Live preview panel for generated code.
 * Supports:
 * - HTML/CSS/JS preview in sandboxed iframe
 * - React component preview (compiled via Babel)
 * - Console output capture
 * - Error display
 * - Responsive preview (mobile/tablet/desktop)
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface GeneratedFile {
  path: string;
  content: string;
  language?: string;
}

interface CodeLabPreviewProps {
  files: GeneratedFile[];
  onClose?: () => void;
}

type DeviceSize = 'mobile' | 'tablet' | 'desktop' | 'full';

const DEVICE_SIZES: Record<DeviceSize, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobile' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '1024px', label: 'Desktop' },
  full: { width: '100%', label: 'Full' },
};

export function CodeLabPreview({ files, onClose }: CodeLabPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('full');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: string; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  // Build preview HTML from files
  const previewHtml = useMemo(() => {
    return buildPreviewHtml(files);
  }, [files]);

  // Handle messages from iframe (console logs, errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        setConsoleLogs((prev) => [
          ...prev,
          { type: event.data.logType, message: event.data.message },
        ]);
      } else if (event.data?.type === 'error') {
        setError(event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Refresh preview
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setConsoleLogs([]);
    setError(null);

    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewHtml;
    }

    setTimeout(() => setIsRefreshing(false), 500);
  }, [previewHtml]);

  // Initial load
  useEffect(() => {
    if (previewHtml) {
      refresh();
    }
  }, [previewHtml, refresh]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="code-preview">
      {/* Header */}
      <div className="preview-header">
        <div className="preview-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Live Preview</span>
        </div>

        <div className="preview-controls">
          {/* Device size selector */}
          <div className="device-selector">
            {(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => (
              <button
                key={size}
                className={deviceSize === size ? 'active' : ''}
                onClick={() => setDeviceSize(size)}
                title={DEVICE_SIZES[size].label}
              >
                {size === 'mobile' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                    />
                  </svg>
                )}
                {size === 'tablet' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                )}
                {size === 'desktop' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
                    />
                  </svg>
                )}
                {size === 'full' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button className="preview-btn" onClick={refresh} disabled={isRefreshing}>
            <svg
              className={isRefreshing ? 'spinning' : ''}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>

          {/* Console toggle */}
          <button
            className={`preview-btn ${showConsole ? 'active' : ''}`}
            onClick={() => setShowConsole(!showConsole)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            {consoleLogs.length > 0 && <span className="console-badge">{consoleLogs.length}</span>}
          </button>

          {/* Close button */}
          {onClose && (
            <button className="preview-btn close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="preview-error">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Preview content */}
      <div className="preview-content">
        <div className="preview-frame-wrapper" style={{ maxWidth: DEVICE_SIZES[deviceSize].width }}>
          <iframe
            ref={iframeRef}
            className="preview-frame"
            sandbox="allow-scripts allow-modals"
            title="Code Preview"
          />
        </div>
      </div>

      {/* Console panel */}
      {showConsole && (
        <div className="preview-console">
          <div className="console-header">
            <span>Console</span>
            <button onClick={() => setConsoleLogs([])}>Clear</button>
          </div>
          <div className="console-logs">
            {consoleLogs.length === 0 ? (
              <div className="console-empty">No console output</div>
            ) : (
              consoleLogs.map((log, i) => (
                <div key={i} className={`console-log ${log.type}`}>
                  <span className="log-type">{log.type}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .code-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e293b;
          border-radius: 8px;
          overflow: hidden;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #0f172a;
          border-bottom: 1px solid #334155;
        }

        .preview-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .preview-title svg {
          width: 18px;
          height: 18px;
          color: #6366f1;
        }

        .preview-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .device-selector {
          display: flex;
          background: #1e293b;
          border-radius: 6px;
          padding: 2px;
        }

        .device-selector button {
          padding: 0.375rem;
          background: none;
          border: none;
          border-radius: 4px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .device-selector button:hover {
          color: #94a3b8;
        }

        .device-selector button.active {
          background: #334155;
          color: #6366f1;
        }

        .device-selector button svg {
          width: 16px;
          height: 16px;
        }

        .preview-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.375rem;
          background: #1e293b;
          border: none;
          border-radius: 6px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .preview-btn:hover:not(:disabled) {
          color: #94a3b8;
          background: #334155;
        }

        .preview-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .preview-btn.active {
          background: #334155;
          color: #6366f1;
        }

        .preview-btn.close:hover {
          color: #ef4444;
        }

        .preview-btn svg {
          width: 18px;
          height: 18px;
        }

        .preview-btn svg.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .console-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          min-width: 14px;
          height: 14px;
          padding: 0 4px;
          background: #6366f1;
          color: white;
          font-size: 0.625rem;
          font-weight: 600;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #7f1d1d;
          color: #fecaca;
          font-size: 0.8125rem;
        }

        .preview-error svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .preview-error span {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-error button {
          background: none;
          border: none;
          color: #fecaca;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .preview-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: #334155;
          overflow: auto;
        }

        .preview-frame-wrapper {
          width: 100%;
          height: 100%;
          background: white;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          transition: max-width 0.3s ease;
        }

        .preview-frame {
          width: 100%;
          height: 100%;
          border: none;
          background: white;
        }

        .preview-console {
          max-height: 200px;
          background: #0f172a;
          border-top: 1px solid #334155;
          display: flex;
          flex-direction: column;
        }

        .console-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.375rem 0.75rem;
          background: #1e293b;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .console-header button {
          background: none;
          border: none;
          color: #64748b;
          font-size: 0.6875rem;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .console-header button:hover {
          color: #94a3b8;
        }

        .console-logs {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .console-empty {
          color: #64748b;
          font-size: 0.75rem;
          text-align: center;
          padding: 1rem;
        }

        .console-log {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.75rem;
          color: #e2e8f0;
          border-radius: 4px;
        }

        .console-log.log {
          background: transparent;
        }

        .console-log.warn {
          background: rgba(250, 204, 21, 0.1);
          color: #fcd34d;
        }

        .console-log.error {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
        }

        .log-type {
          color: #64748b;
          text-transform: uppercase;
          font-size: 0.625rem;
          font-weight: 600;
          min-width: 40px;
        }

        .log-message {
          flex: 1;
          word-break: break-all;
        }

        @media (max-width: 640px) {
          .device-selector {
            display: none;
          }

          .preview-content {
            padding: 0;
          }

          .preview-frame-wrapper {
            max-width: 100% !important;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Build HTML document from generated files
 */
function buildPreviewHtml(files: GeneratedFile[]): string {
  // Find main files
  const htmlFile = files.find((f) => f.path.endsWith('.html') || f.path === 'index.html');
  const cssFiles = files.filter((f) => f.path.endsWith('.css'));
  const jsFiles = files.filter(
    (f) => f.path.endsWith('.js') && !f.path.endsWith('.config.js') && !f.path.endsWith('.test.js')
  );
  const tsxFiles = files.filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));

  // If we have an HTML file, use it as base
  if (htmlFile) {
    let html = htmlFile.content;

    // Inject CSS if not already linked
    const cssContent = cssFiles.map((f) => f.content).join('\n');
    if (cssContent && !html.includes('<style>')) {
      html = html.replace('</head>', `<style>\n${cssContent}\n</style>\n</head>`);
    }

    // Inject JS if not already linked
    const jsContent = jsFiles.map((f) => f.content).join('\n');
    if (jsContent && !html.includes('<script')) {
      html = html.replace('</body>', `<script>\n${jsContent}\n</script>\n</body>`);
    }

    return wrapWithConsoleCapture(html);
  }

  // If we have React/JSX files, build a React preview
  if (tsxFiles.length > 0) {
    return buildReactPreview(tsxFiles, cssFiles);
  }

  // If we only have CSS/JS, create a basic HTML shell
  const cssContent = cssFiles.map((f) => f.content).join('\n');
  const jsContent = jsFiles.map((f) => f.content).join('\n');

  return wrapWithConsoleCapture(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    ${jsContent}
  </script>
</body>
</html>
  `);
}

/**
 * Build a React preview with Babel for JSX transformation
 */
function buildReactPreview(tsxFiles: GeneratedFile[], cssFiles: GeneratedFile[]): string {
  const mainComponent =
    tsxFiles.find(
      (f) => f.path.includes('App') || f.path.includes('page') || f.path.includes('index')
    ) || tsxFiles[0];

  const cssContent = cssFiles.map((f) => f.content).join('\n');

  // Extract component code (simplified - assumes functional component)
  let componentCode = mainComponent?.content || '';

  // Remove imports and exports for inline execution
  componentCode = componentCode
    .replace(/import .+?;?\n/g, '')
    .replace(/export default .+?;?\n?$/, '')
    .replace(/export /g, '');

  return wrapWithConsoleCapture(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

    ${componentCode}

    // Try to render the component
    try {
      const rootElement = document.getElementById('root');
      const root = ReactDOM.createRoot(rootElement);

      // Look for the main component
      const MainComponent = typeof App !== 'undefined' ? App :
                            typeof Component !== 'undefined' ? Component :
                            typeof Page !== 'undefined' ? Page :
                            null;

      if (MainComponent) {
        root.render(<MainComponent />);
      } else {
        rootElement.innerHTML = '<p style="padding: 1rem; color: #666;">No component found to render.</p>';
      }
    } catch (err) {
      window.parent.postMessage({ type: 'error', message: err.message }, '*');
      // Safe DOM manipulation to prevent XSS
      const rootEl = document.getElementById('root');
      const pre = document.createElement('pre');
      pre.style.cssText = 'color: red; padding: 1rem;';
      pre.textContent = err.message; // textContent is XSS-safe
      rootEl.innerHTML = '';
      rootEl.appendChild(pre);
    }
  </script>
</body>
</html>
  `);
}

/**
 * Wrap HTML with console capture script
 */
function wrapWithConsoleCapture(html: string): string {
  const captureScript = `
    <script>
      (function() {
        const originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
        };

        ['log', 'warn', 'error'].forEach(type => {
          console[type] = function(...args) {
            originalConsole[type].apply(console, args);
            const message = args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            window.parent.postMessage({ type: 'console', logType: type, message }, '*');
          };
        });

        window.onerror = function(message, source, lineno, colno, error) {
          window.parent.postMessage({ type: 'error', message: message + ' at line ' + lineno }, '*');
        };
      })();
    </script>
  `;

  // Insert capture script right after <head>
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + captureScript);
  }

  // Or at the start of the document
  return captureScript + html;
}
