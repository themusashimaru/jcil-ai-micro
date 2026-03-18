'use client';

import { useState, useCallback, useRef } from 'react';
import type { WebsitePage, MultiPageWebsite } from '@/app/chat/types';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string; icon: string }> = {
  mobile: { width: '375px', label: 'Mobile', icon: '📱' },
  tablet: { width: '768px', label: 'Tablet', icon: '📊' },
  desktop: { width: '100%', label: 'Desktop', icon: '🖥️' },
};

interface MultiPagePreviewFullscreenProps {
  website: MultiPageWebsite;
  pages: WebsitePage[];
  onClose: () => void;
  onCodeChange?: (pages: WebsitePage[]) => void;
  onDeploy?: () => void;
  onPushToGitHub?: () => void;
  onDownloadZip: () => void;
}

export function MultiPagePreviewFullscreen({
  website,
  pages,
  onClose,
  onCodeChange,
  onDeploy,
  onPushToGitHub,
  onDownloadZip,
}: MultiPagePreviewFullscreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewKey = useRef(0);

  const getCurrentPageHtml = useCallback((pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page) return '';

    let html = page.code;

    const navItems = pages.map((p: WebsitePage, i: number) =>
      `<a href="#${p.slug}" data-page="${i}" class="forge-nav-item ${i === pageIndex ? 'active' : ''}" style="padding: 8px 16px; margin: 0 4px; border-radius: 6px; text-decoration: none; color: ${i === pageIndex ? '#fff' : '#94a3b8'}; background: ${i === pageIndex ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)' : 'transparent'}; transition: all 0.2s;">${p.icon || ''} ${p.name}</a>`
    ).join('');

    const forgeNavigation = `
      <div id="forge-nav-bar" style="position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); padding: 8px 16px; display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        ${navItems}
      </div>
      <div style="height: 52px;"></div>
    `;

    const editModeScript = editMode ? `
      <style>
        .forge-editable:hover { outline: 2px dashed #8b5cf6 !important; outline-offset: 2px !important; cursor: pointer !important; }
        .forge-editing { outline: 2px solid #06b6d4 !important; outline-offset: 2px !important; }
      </style>
      <script>
        (function() {
          const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label, figcaption';
          document.querySelectorAll(editableSelectors).forEach(el => {
            el.classList.add('forge-editable');
            el.addEventListener('click', function(e) {
              e.preventDefault(); e.stopPropagation();
              window.parent.postMessage({ type: 'FORGE_ELEMENT_CLICK', text: this.textContent, path: getElementPath(this), tagName: this.tagName.toLowerCase() }, '*');
            });
          });
          function getElementPath(el) {
            const path = [];
            while (el && el.nodeType === Node.ELEMENT_NODE) {
              let selector = el.tagName.toLowerCase();
              if (el.id) { selector += '#' + el.id; path.unshift(selector); break; }
              else { let sibling = el; let nth = 1; while (sibling = sibling.previousElementSibling) { if (sibling.tagName === el.tagName) nth++; } if (nth > 1) selector += ':nth-of-type(' + nth + ')'; }
              path.unshift(selector); el = el.parentNode;
            }
            return path.join(' > ');
          }
        })();
      </script>
    ` : '';

    if (html.includes('<body')) {
      html = html.replace(/<body([^>]*)>/i, `<body$1>${forgeNavigation}`);
    } else {
      html = forgeNavigation + html;
    }

    if (editMode) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${editModeScript}</body>`);
      } else {
        html += editModeScript;
      }
    }

    return html;
  }, [pages, editMode]);

  const applyEdit = useCallback(() => {
    if (!selectedElement || !editingText) return;
    const updatedPages = [...pages];
    void updatedPages[currentPage].code;
    if (onCodeChange) onCodeChange(updatedPages);
    setSelectedElement(null);
    setEditingText('');
    previewKey.current++;
  }, [selectedElement, editingText, pages, currentPage, onCodeChange]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition" aria-label="Close preview" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-white">{website.title}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">{pages.length} pages</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {pages.map((page: WebsitePage, i: number) => (
            <button key={i} onClick={() => { setCurrentPage(i); previewKey.current++; }} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currentPage === i ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} aria-label={`Navigate to ${page.name} page`} aria-current={currentPage === i ? 'page' : undefined}>
              <span aria-hidden="true">{page.icon || '📄'}</span> {page.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {(Object.keys(VIEWPORT_SIZES) as ViewportSize[]).map((size) => (
              <button key={size} onClick={() => setViewport(size)} className={`px-2 py-1 rounded text-sm transition-all ${viewport === size ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`} aria-label={`Switch to ${VIEWPORT_SIZES[size].label} viewport`} aria-pressed={viewport === size} title={VIEWPORT_SIZES[size].label}>
                <span aria-hidden="true">{VIEWPORT_SIZES[size].icon}</span>
              </button>
            ))}
          </div>

          <button onClick={() => { setEditMode(!editMode); previewKey.current++; }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${editMode ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`} aria-label={editMode ? 'Disable edit mode' : 'Enable edit mode'} aria-pressed={editMode}>
            <span aria-hidden="true">✏️</span> {editMode ? 'Editing' : 'Edit Mode'}
          </button>

          <button onClick={() => setShowCode(!showCode)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showCode ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`} aria-label={showCode ? 'Hide source code' : 'Show source code'} aria-pressed={showCode}>
            {'</>'} Code
          </button>

          <button onClick={onDownloadZip} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-sm font-medium hover:bg-white/20 transition-all" aria-label="Download website as ZIP">
            <span aria-hidden="true">📦</span> ZIP
          </button>

          {onPushToGitHub && (
            <button onClick={onPushToGitHub} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-sm font-medium hover:bg-white/20 transition-all" aria-label="Push website to GitHub">Push</button>
          )}

          {onDeploy && (
            <button onClick={onDeploy} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-black to-gray-800 text-white text-sm font-medium hover:from-gray-800 hover:to-gray-700 transition-all border border-white/20" aria-label="Deploy website to Vercel">
              <span aria-hidden="true">▲</span> Deploy
            </button>
          )}

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white" aria-label="Close fullscreen preview">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Panel */}
      {editMode && selectedElement && (
        <div className="absolute top-14 right-4 z-50 w-80 bg-slate-800 rounded-xl border border-white/10 shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Edit Element</span>
            <button onClick={() => { setSelectedElement(null); setEditingText(''); }} className="text-gray-400 hover:text-white" aria-label="Close edit panel">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full h-24 bg-slate-900 rounded-lg border border-white/10 p-3 text-white text-sm resize-none focus:outline-none focus:border-violet-500" placeholder="Edit text..." />
          <div className="flex gap-2 mt-3">
            <button onClick={applyEdit} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium">Apply Changes</button>
            <button onClick={() => { setSelectedElement(null); setEditingText(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-48px)]">
        <div className={`flex-1 flex items-center justify-center bg-slate-950 p-4 ${showCode ? 'w-1/2' : 'w-full'}`}>
          <div className="h-full bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300" style={{ width: VIEWPORT_SIZES[viewport].width, maxWidth: '100%' }}>
            <iframe ref={iframeRef} key={previewKey.current} srcDoc={getCurrentPageHtml(currentPage)} className="w-full h-full" title={pages[currentPage]?.name || 'Preview'} sandbox="allow-scripts allow-same-origin" />
          </div>
        </div>

        {showCode && (
          <div className="w-1/2 bg-slate-900 border-l border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-sm font-medium text-white">{pages[currentPage]?.slug}.html</span>
              <button onClick={() => { navigator.clipboard.writeText(pages[currentPage]?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300 hover:bg-white/20" aria-label={copied ? 'Code copied to clipboard' : 'Copy page code to clipboard'}>
                {copied ? '✅ Copied' : '📋 Copy'}
              </button>
            </div>
            <pre className="h-[calc(100%-40px)] overflow-auto p-4 text-xs text-gray-300">
              <code>{pages[currentPage]?.code || ''}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
