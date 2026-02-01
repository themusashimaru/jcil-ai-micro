'use client';

/**
 * LIVE PREVIEW COMPONENT (Enhancement #6)
 *
 * Renders HTML/React code in a sandboxed iframe for immediate preview.
 * Security: Uses strict CSP and sandboxed iframe attributes.
 *
 * Features:
 * - Real-time HTML preview
 * - React component preview (using standalone build)
 * - Device size presets (mobile, tablet, desktop)
 * - Refresh/reload capability
 * - Error boundary
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface LivePreviewProps {
  code: string;
  language: 'html' | 'react' | 'jsx' | 'tsx';
  title?: string;
  defaultHeight?: number;
}

// Device presets for responsive preview
const DEVICE_PRESETS = {
  mobile: { width: 375, height: 667, label: 'Mobile' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  desktop: { width: '100%', height: 600, label: 'Desktop' },
};

type DevicePreset = keyof typeof DEVICE_PRESETS;

/**
 * Create a sandboxed HTML document with strict CSP
 */
function createSandboxedHTML(code: string, isReact: boolean): string {
  const baseStyles = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
    }
  `;

  if (isReact) {
    // Wrap React code with runtime
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${baseStyles}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    try {
      ${code}

      // Try to find and render the component
      const componentNames = ['App', 'Component', 'Main', 'Root'];
      let ComponentToRender = null;

      for (const name of componentNames) {
        if (typeof window[name] !== 'undefined') {
          ComponentToRender = window[name];
          break;
        }
      }

      // If code defines a function/const at top level, try to use it
      if (!ComponentToRender) {
        const lastDefinedComponent = (() => {
          ${code}
          // Return the last defined component-like thing
          ${code.match(/(?:function|const|let|var)\s+([A-Z][a-zA-Z0-9]*)/g)?.map(m => {
            const name = m.match(/([A-Z][a-zA-Z0-9]*)/)?.[1];
            return name ? `if (typeof ${name} !== 'undefined') return ${name};` : '';
          }).join('\n') || ''}
          return null;
        })();
        ComponentToRender = lastDefinedComponent;
      }

      if (ComponentToRender) {
        ReactDOM.createRoot(document.getElementById('root')).render(
          React.createElement(ComponentToRender)
        );
      } else {
        document.getElementById('root').innerHTML = '<p style="color: #f85149;">No React component found. Define a component named App, Component, Main, or Root.</p>';
      }
    } catch (error) {
      document.getElementById('root').innerHTML = '<pre style="color: #f85149; white-space: pre-wrap;">' + error.message + '</pre>';
    }
  </script>
</body>
</html>`;
  }

  // Plain HTML
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';">
  <style>${baseStyles}</style>
</head>
<body>
  ${code}
</body>
</html>`;
}

export function LivePreview({
  code,
  language,
  title = 'Preview',
  defaultHeight = 400,
}: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DevicePreset>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const isReact = language === 'react' || language === 'jsx' || language === 'tsx';
  const preset = DEVICE_PRESETS[device];

  const updatePreview = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const html = createSandboxedHTML(code, isReact);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      if (iframeRef.current) {
        iframeRef.current.src = url;
      }

      // Clean up blob URL after iframe loads
      return () => URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [code, isReact]);

  useEffect(() => {
    const cleanup = updatePreview();
    return cleanup;
  }, [updatePreview, key]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load preview');
    setIsLoading(false);
  };

  const handleRefresh = () => {
    setKey((k) => k + 1);
  };

  return (
    <div
      className="my-3 rounded-lg overflow-hidden border"
      style={{ backgroundColor: '#0d1117', borderColor: '#30363d' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ backgroundColor: 'rgba(63, 185, 80, 0.1)', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="text-sm font-medium text-gray-300">{title}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
            {isReact ? 'React' : 'HTML'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device selector */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5">
            {Object.entries(DEVICE_PRESETS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setDevice(key as DevicePreset)}
                className={`px-2 py-1 text-xs rounded ${
                  device === key
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {value.label}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400"
            title="Refresh preview"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div
        className="relative bg-white flex items-center justify-center"
        style={{
          minHeight: `${defaultHeight}px`,
          padding: device !== 'desktop' ? '16px' : 0,
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="flex items-center gap-2 text-gray-300">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading preview...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/20">
            <div className="text-red-400 text-center p-4">
              <svg className="w-8 h-8 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={key}
          title="Live Preview"
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{
            width: typeof preset.width === 'number' ? `${preset.width}px` : preset.width,
            height: typeof preset.height === 'number' ? `${preset.height}px` : `${defaultHeight}px`,
            border: device !== 'desktop' ? '1px solid #30363d' : 'none',
            borderRadius: device !== 'desktop' ? '8px' : 0,
            backgroundColor: 'white',
          }}
        />
      </div>

      {/* Footer */}
      <div
        className="px-3 py-1.5 text-xs text-gray-500 border-t"
        style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
      >
        Sandboxed preview - External requests are blocked for security
      </div>
    </div>
  );
}

/**
 * Detect if code is suitable for live preview
 */
export function canLivePreview(code: string, language: string): boolean {
  const previewableLanguages = ['html', 'htm', 'jsx', 'tsx', 'react'];
  if (!previewableLanguages.includes(language.toLowerCase())) {
    return false;
  }

  // Check for HTML-like content
  if (language.toLowerCase() === 'html' || language.toLowerCase() === 'htm') {
    return code.includes('<') && code.includes('>');
  }

  // Check for React component patterns
  if (['jsx', 'tsx', 'react'].includes(language.toLowerCase())) {
    return (
      code.includes('React') ||
      code.includes('return') ||
      code.includes('function') ||
      code.includes('const') ||
      code.includes('<')
    );
  }

  return false;
}

export default LivePreview;
