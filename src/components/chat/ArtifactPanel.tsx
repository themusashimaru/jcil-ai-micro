'use client';

/**
 * ARTIFACT PANEL
 *
 * Slide-in right panel for previewing HTML/SVG/code from chat.
 * Similar to Claude.ai's artifact system.
 *
 * - Preview tab: sandboxed iframe for HTML/SVG
 * - Code tab: Shiki-highlighted source code
 * - Copy and download buttons
 */

import { useState, useCallback } from 'react';
import { useArtifact } from '@/contexts/ArtifactContext';
import { HighlightedCode } from './HighlightedCode';

type Tab = 'preview' | 'code';

export function ArtifactPanel() {
  const { artifact, isOpen, closeArtifact } = useArtifact();
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  const handleDownload = useCallback(() => {
    if (!artifact) return;
    const ext =
      artifact.type === 'html'
        ? '.html'
        : artifact.type === 'svg'
          ? '.svg'
          : `.${artifact.language || 'txt'}`;
    const mime =
      artifact.type === 'html'
        ? 'text/html'
        : artifact.type === 'svg'
          ? 'image/svg+xml'
          : 'text/plain';
    const blob = new Blob([artifact.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, '_')}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [artifact]);

  if (!isOpen || !artifact) return null;

  const canPreview = artifact.type === 'html' || artifact.type === 'svg';

  return (
    <div className="w-[45%] min-w-[360px] max-w-[600px] border-l border-white/10 bg-gray-950 flex flex-col h-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{artifact.title}</h3>
          <span className="text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-2 py-0.5 rounded">
            {artifact.type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? (
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Download"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
          <button
            onClick={closeArtifact}
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      {canPreview && (
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'code'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Code
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'preview' && canPreview ? (
          <iframe
            srcDoc={artifact.content}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts"
            title={artifact.title}
          />
        ) : (
          <div className="p-4">
            <HighlightedCode code={artifact.content} language={artifact.language} />
          </div>
        )}
      </div>
    </div>
  );
}
