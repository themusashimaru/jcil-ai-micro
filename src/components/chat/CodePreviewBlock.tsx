/** Code Preview Block — displays generated code with live preview, copy, and full-screen modal */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface CodePreviewBlockProps {
  code: string;
  language: string;
  title?: string;
  description?: string;
}

export function CodePreviewBlock({ code, language, title, description }: CodePreviewBlockProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inlineExpanded, setInlineExpanded] = useState(true);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => {
    setPreviewLoaded(false);
  }, [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const openPreview = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const isHtml =
    language.toLowerCase() === 'html' || code.includes('<!DOCTYPE html>') || code.includes('<html');

  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/5 overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-medium text-white text-sm">{title || 'Generated Code'}</div>
            {description && (
              <div className="text-xs text-gray-400 truncate max-w-[200px]">{description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-cyan-300 uppercase font-medium">
            {language}
          </span>
        </div>
      </div>

      {/* Inline Mini Preview */}
      {isHtml && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setInlineExpanded(!inlineExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors bg-black/20"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Preview
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${inlineExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {inlineExpanded && (
            <div
              className="relative cursor-pointer group overflow-hidden min-h-[300px]"
              onClick={openPreview}
            >
              {!previewLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-0">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs text-gray-400">Loading preview...</span>
                  </div>
                </div>
              )}
              <iframe
                srcDoc={code}
                className="relative w-full h-[300px] pointer-events-none z-10 bg-white"
                title={`${title || 'Preview'} - Inline`}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setPreviewLoaded(true)}
              />
              <div className="absolute inset-0 z-20 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  Click to expand
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
        <button
          onClick={openPreview}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium hover:from-violet-600 hover:to-cyan-600 transition-all shadow-lg shadow-violet-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          Full Screen
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>

        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {showCode ? 'Hide Code' : 'Code'}
        </button>
      </div>

      {/* Collapsible Code Block */}
      {showCode && (
        <div className="px-4 pb-4">
          <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto text-xs text-gray-300 max-h-[400px] overflow-y-auto">
            <code>{code}</code>
          </pre>
        </div>
      )}

      {/* Full Screen Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-[95vw] h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-sm font-medium text-white">{title || 'Preview'}</span>
              </div>
              <button
                onClick={closePreview}
                className="p-2 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <iframe
              srcDoc={code}
              className="w-full h-[calc(100%-52px)] bg-white"
              title={title || 'Code Preview'}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
