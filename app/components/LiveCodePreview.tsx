/**
 * LIVE CODE PREVIEW COMPONENT
 *
 * PURPOSE:
 * - Sandboxed iframe preview for generated code
 * - Real-time rendering of HTML/CSS/JS
 * - Split view: code editor + live preview
 * - Security: fully sandboxed execution
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { escapeHtml } from '@/lib/sanitize';

interface CodeFile {
  name: string;
  language: 'html' | 'css' | 'javascript' | 'typescript' | 'json';
  content: string;
}

interface LiveCodePreviewProps {
  files: CodeFile[];
  title?: string;
  onCodeChange?: (files: CodeFile[]) => void;
  readOnly?: boolean;
  defaultTab?: number;
  showPreview?: boolean;
}

// Generate a complete HTML document from files
function generatePreviewHtml(files: CodeFile[]): string {
  const htmlFile = files.find((f) => f.language === 'html');
  const cssFiles = files.filter((f) => f.language === 'css');
  const jsFiles = files.filter((f) => f.language === 'javascript' || f.language === 'typescript');

  // If there's a full HTML file, use it as base
  if (htmlFile && htmlFile.content.includes('<!DOCTYPE')) {
    let html = htmlFile.content;

    // Inject CSS
    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map((f) => f.content).join('\n');
      html = html.replace('</head>', `<style>${cssContent}</style></head>`);
    }

    // Inject JS
    if (jsFiles.length > 0) {
      const jsContent = jsFiles.map((f) => f.content).join('\n');
      html = html.replace('</body>', `<script>${jsContent}</script></body>`);
    }

    return html;
  }

  // Build a complete HTML document
  const cssContent = cssFiles.map((f) => f.content).join('\n');
  const jsContent = jsFiles.map((f) => f.content).join('\n');
  const htmlContent = htmlFile?.content || '<div id="app"></div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  ${htmlContent}
  <script>
    // Error handling for preview
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      console.error('Preview Error:', msg);
      return false;
    };
    ${jsContent}
  </script>
</body>
</html>`;
}

// Syntax highlighting (basic)
// SECURITY FIX: Escape HTML first to prevent XSS, then apply highlighting
function highlightCode(code: string, language: string): string {
  // First escape HTML to prevent XSS attacks
  const escaped = escapeHtml(code);

  if (language === 'html') {
    return escaped
      .replace(/(&amp;lt;\/?)(\w+)/g, '$1<span class="text-pink-400">$2</span>')
      .replace(/(\w+)&#x3D;/g, '<span class="text-yellow-400">$1</span>&#x3D;')
      .replace(/&quot;([^&]*)&quot;/g, '<span class="text-green-400">&quot;$1&quot;</span>');
  }
  if (language === 'css') {
    return escaped
      .replace(/([.#]?\w+)\s*\{/g, '<span class="text-yellow-400">$1</span> {')
      .replace(/([\w-]+):/g, '<span class="text-cyan-400">$1</span>:')
      .replace(/:\s*([^;]+);/g, ': <span class="text-green-400">$1</span>;');
  }
  if (language === 'javascript' || language === 'typescript') {
    return escaped
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g,
        '<span class="text-purple-400">$1</span>'
      )
      .replace(/(&#x27;|&quot;|&#x60;)([^&#]*)\1/g, '<span class="text-green-400">$1$2$1</span>')
      .replace(/&#x2F;&#x2F;.*/g, '<span class="text-slate-500">$&</span>');
  }
  return escaped;
}

// Language icons
const LANGUAGE_ICONS: Record<string, string> = {
  html: '🌐',
  css: '🎨',
  javascript: '⚡',
  typescript: '🔷',
  json: '📋',
};

export default function LiveCodePreview({
  files,
  title = 'Live Preview',
  onCodeChange,
  readOnly = false,
  defaultTab = 0,
  showPreview = true,
}: LiveCodePreviewProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [localFiles, setLocalFiles] = useState<CodeFile[]>(files);
  const [previewKey, setPreviewKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Update local files when props change
  useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  // Debounced preview update
  const updatePreview = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setPreviewKey((k) => k + 1);
    }, 300);
  }, []);

  // Handle code changes
  const handleCodeChange = (index: number, newContent: string) => {
    const newFiles = [...localFiles];
    newFiles[index] = { ...newFiles[index], content: newContent };
    setLocalFiles(newFiles);
    onCodeChange?.(newFiles);
    updatePreview();
  };

  // Refresh preview
  const refreshPreview = () => {
    setPreviewKey((k) => k + 1);
  };

  // Get preview HTML
  const previewHtml = generatePreviewHtml(localFiles);

  return (
    <div
      className={`rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 ${
        isFullscreen ? 'fixed inset-4 z-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-white">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-slate-700/50 p-0.5">
            <button
              onClick={() => setViewMode('code')}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                viewMode === 'code' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                viewMode === 'split' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                viewMode === 'preview'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={refreshPreview}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Refresh Preview"
            aria-label="Refresh preview"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex ${isFullscreen ? 'h-[calc(100%-48px)]' : 'h-[500px]'}`}>
        {/* Code Panel */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div
            className={`flex flex-col ${viewMode === 'split' ? 'w-1/2 border-r border-slate-700/50' : 'w-full'}`}
          >
            {/* File Tabs */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/50 border-b border-slate-700/50 overflow-x-auto">
              {localFiles.map((file, index) => (
                <button
                  key={file.name}
                  onClick={() => setActiveTab(index)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    activeTab === index
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span>{LANGUAGE_ICONS[file.language] || '📄'}</span>
                  <span>{file.name}</span>
                </button>
              ))}
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
              {readOnly ? (
                <pre className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  <code
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(
                        localFiles[activeTab]?.content || '',
                        localFiles[activeTab]?.language || 'text'
                      ),
                    }}
                  />
                </pre>
              ) : (
                <textarea
                  value={localFiles[activeTab]?.content || ''}
                  onChange={(e) => handleCodeChange(activeTab, e.target.value)}
                  className="w-full h-full bg-transparent text-slate-300 resize-none outline-none leading-relaxed"
                  spellCheck={false}
                  aria-label={`Edit ${localFiles[activeTab]?.language || 'code'} file`}
                />
              )}
            </div>
          </div>
        )}

        {/* Preview Panel */}
        {(viewMode === 'preview' || viewMode === 'split') && showPreview && (
          <div className={`flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            {/* Preview Header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-slate-400">Live Preview</span>
            </div>

            {/* Iframe Preview */}
            <div className="flex-1 bg-white">
              <iframe
                ref={iframeRef}
                key={previewKey}
                srcDoc={previewHtml}
                title="Code Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>{localFiles.length} files</span>
          <span>{localFiles[activeTab]?.language.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Sandboxed</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
