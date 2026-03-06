'use client';

import { EditorFile, EditorChange, getFileIcon } from './CodeLabEditor.utils';
import { emptyStateStyles } from './CodeLabEditor.styles';

export function EditorTabs({
  files,
  activeFileId,
  onFileSelect,
  onFileClose,
}: {
  files: EditorFile[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onFileClose: (fileId: string) => void;
}) {
  return (
    <div className="editor-tabs">
      {files.map((file) => (
        <div
          key={file.id}
          className={`editor-tab ${file.id === activeFileId ? 'active' : ''} ${file.isDirty ? 'dirty' : ''}`}
          onClick={() => onFileSelect(file.id)}
        >
          <span className="tab-icon">{getFileIcon(file.language)}</span>
          <span className="tab-name">{file.name}</span>
          {file.isDirty && <span className="tab-dirty-indicator" aria-label="Unsaved changes" />}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onFileClose(file.id);
            }}
            aria-label={`Close ${file.name}`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function EditorBreadcrumbs({ activeFile }: { activeFile: EditorFile | undefined }) {
  if (!activeFile) return null;

  const parts = activeFile.path.split('/').filter(Boolean);

  return (
    <div className="editor-breadcrumbs" aria-label="File path">
      {parts.map((part, index) => (
        <span key={index} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          <span className={index === parts.length - 1 ? 'breadcrumb-current' : ''}>{part}</span>
        </span>
      ))}
    </div>
  );
}

export function DiffActionsBar({
  activeFileChanges,
  activeFileId,
  onAcceptAllChanges,
  onRejectAllChanges,
}: {
  activeFileChanges: EditorChange | undefined;
  activeFileId: string;
  onAcceptAllChanges: (fileId: string) => void;
  onRejectAllChanges: (fileId: string) => void;
}) {
  if (!activeFileChanges || activeFileChanges.hunks.length === 0) return null;

  const pendingHunks = activeFileChanges.hunks.filter((h) => h.status === 'pending');

  return (
    <div className="diff-actions-bar">
      <div className="diff-info">
        <span className="diff-count">{pendingHunks.length} pending changes</span>
      </div>
      <div className="diff-buttons">
        <button
          className="diff-btn accept-all"
          onClick={() => onAcceptAllChanges(activeFileId)}
          disabled={pendingHunks.length === 0}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
          Accept All
        </button>
        <button
          className="diff-btn reject-all"
          onClick={() => onRejectAllChanges(activeFileId)}
          disabled={pendingHunks.length === 0}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
          Reject All
        </button>
      </div>
    </div>
  );
}

export function EditorSearchBar({
  searchOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  currentSearchIndex,
  setCurrentSearchIndex,
  setSearchOpen,
}: {
  searchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: number[];
  currentSearchIndex: number;
  setCurrentSearchIndex: (fn: (i: number) => number) => void;
  setSearchOpen: (open: boolean) => void;
}) {
  if (!searchOpen) return null;

  return (
    <div className="editor-search-bar">
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
        aria-label="Search in file"
      />
      <span className="search-results-count">
        {searchResults.length > 0
          ? `${currentSearchIndex + 1} of ${searchResults.length}`
          : 'No results'}
      </span>
      <button
        onClick={() => setCurrentSearchIndex((i) => Math.max(0, i - 1))}
        disabled={searchResults.length === 0}
        aria-label="Previous result"
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.22 9.78a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L8 6.06 4.28 9.78a.75.75 0 01-1.06 0z" />
        </svg>
      </button>
      <button
        onClick={() => setCurrentSearchIndex((i) => Math.min(searchResults.length - 1, i + 1))}
        disabled={searchResults.length === 0}
        aria-label="Next result"
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z" />
        </svg>
      </button>
      <button onClick={() => setSearchOpen(false)} aria-label="Close search">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  );
}

export function EditorStatusBar({
  activeFile,
  cursorPosition,
}: {
  activeFile: EditorFile | undefined;
  cursorPosition: { line: number; column: number };
}) {
  return (
    <div className="editor-status-bar">
      <div className="status-left">
        <span className="status-item">{activeFile?.language || 'Plain Text'}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">LF</span>
      </div>
      <div className="status-right">
        <span className="status-item">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        {activeFile?.isDirty && <span className="status-item status-dirty">Modified</span>}
      </div>
    </div>
  );
}

export function EditorEmptyState({
  theme,
  onFileCreate,
}: {
  theme: string;
  onFileCreate: (path: string, content: string) => void;
}) {
  return (
    <div className={`code-lab-editor empty ${theme}`}>
      <div className="editor-empty-state">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3>No files open</h3>
        <p>Open a file from the sidebar or create a new one</p>
        <button className="empty-action" onClick={() => onFileCreate('untitled.ts', '')}>
          Create New File
        </button>
      </div>

      <style jsx>{emptyStateStyles}</style>
    </div>
  );
}
