'use client';

/**
 * CODE LAB OUTPUT PANEL
 *
 * Displays generated code files from Code Agent V2.
 * Features:
 * - File tree of generated files
 * - Syntax highlighted code preview
 * - Copy individual files
 * - Download all files as zip
 * - Diff view for modified files
 */

import { useState, useMemo } from 'react';
import { CodeLabDiffView } from './CodeLabDiffView';

interface GeneratedFile {
  path: string;
  content: string;
  language?: string;
  isNew?: boolean;
  oldContent?: string; // For diff view
}

interface CodeLabOutputPanelProps {
  files: GeneratedFile[];
  projectName?: string;
  onClose?: () => void;
  onPushToGitHub?: () => void;
  isPushing?: boolean;
}

export function CodeLabOutputPanel({
  files,
  projectName = 'Generated Project',
  onClose,
  onPushToGitHub,
  isPushing = false,
}: CodeLabOutputPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    files.length > 0 ? files[0].path : null
  );
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Get selected file data
  const selectedFileData = useMemo(() => {
    return files.find((f) => f.path === selectedFile);
  }, [files, selectedFile]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalLines = 0;
    let newFiles = 0;
    let modifiedFiles = 0;

    files.forEach((file) => {
      totalLines += file.content.split('\n').length;
      if (file.isNew) {
        newFiles++;
      } else if (file.oldContent) {
        modifiedFiles++;
      }
    });

    return { totalLines, newFiles, modifiedFiles, totalFiles: files.length };
  }, [files]);

  // Copy file content
  const handleCopyFile = async (filePath: string) => {
    const file = files.find((f) => f.path === filePath);
    if (!file) return;

    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFile(filePath);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download all files as zip
  const handleDownloadAll = async () => {
    // Create a simple tar-like format or use client-side zip library
    // For now, create a combined text file
    const combined = files
      .map((f) => `${'='.repeat(60)}\n// FILE: ${f.path}\n${'='.repeat(60)}\n${f.content}`)
      .join('\n\n');

    const blob = new Blob([combined], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-files.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Get language from file path
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      kt: 'kotlin',
      swift: 'swift',
      css: 'css',
      scss: 'scss',
      html: 'html',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
    };
    return langMap[ext || ''] || ext || 'text';
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="output-panel">
      {/* Header */}
      <div className="output-header">
        <div className="output-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
            />
          </svg>
          <span>{projectName}</span>
          <span className="output-badge">{stats.totalFiles} files</span>
        </div>
        <div className="output-actions">
          {onPushToGitHub && (
            <button className="output-btn push" onClick={onPushToGitHub} disabled={isPushing}>
              {isPushing ? (
                <>
                  <svg
                    className="spinner"
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
                  Pushing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                  </svg>
                  Push to GitHub
                </>
              )}
            </button>
          )}
          <button className="output-btn" onClick={handleDownloadAll}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Download
          </button>
          {onClose && (
            <button className="output-btn close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="output-stats">
        <span className="stat">
          <span className="stat-value">{stats.totalLines}</span> lines
        </span>
        {stats.newFiles > 0 && (
          <span className="stat new">
            <span className="stat-value">+{stats.newFiles}</span> new
          </span>
        )}
        {stats.modifiedFiles > 0 && (
          <span className="stat modified">
            <span className="stat-value">{stats.modifiedFiles}</span> modified
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="output-content">
        {/* File List */}
        <div className="output-files">
          {files.map((file) => (
            <button
              key={file.path}
              className={`file-item ${selectedFile === file.path ? 'selected' : ''}`}
              onClick={() => setSelectedFile(file.path)}
            >
              <span className="file-icon">{getFileIcon(file.path)}</span>
              <span className="file-path">{file.path}</span>
              {file.isNew && <span className="file-badge new">new</span>}
              {file.oldContent && <span className="file-badge modified">modified</span>}
              <button
                className="file-copy"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyFile(file.path);
                }}
              >
                {copiedFile === file.path ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </button>
          ))}
        </div>

        {/* Code Preview */}
        <div className="output-preview">
          {selectedFileData && (
            <>
              {/* View Mode Toggle (if file has old content) */}
              {selectedFileData.oldContent && (
                <div className="preview-toggle">
                  <button
                    className={viewMode === 'code' ? 'active' : ''}
                    onClick={() => setViewMode('code')}
                  >
                    Code
                  </button>
                  <button
                    className={viewMode === 'diff' ? 'active' : ''}
                    onClick={() => setViewMode('diff')}
                  >
                    Diff
                  </button>
                </div>
              )}

              {viewMode === 'diff' && selectedFileData.oldContent ? (
                <CodeLabDiffView
                  oldCode={selectedFileData.oldContent}
                  newCode={selectedFileData.content}
                  filename={selectedFileData.path}
                  language={getLanguage(selectedFileData.path)}
                />
              ) : (
                <div className="code-preview">
                  <div className="code-header">
                    <span className="code-lang">{getLanguage(selectedFileData.path)}</span>
                    <span className="code-lines">
                      {selectedFileData.content.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="code-content">
                    <code>{selectedFileData.content}</code>
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .output-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .output-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .output-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #1a1f36;
        }

        .output-title svg {
          width: 18px;
          height: 18px;
          color: #1e3a5f;
        }

        .output-badge {
          font-size: 0.6875rem;
          font-weight: 500;
          padding: 0.125rem 0.5rem;
          background: #e5e7eb;
          border-radius: 9999px;
          color: #6b7280;
        }

        .output-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .output-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .output-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .output-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .output-btn svg {
          width: 16px;
          height: 16px;
        }

        .output-btn.push {
          background: #1a1f36;
          border-color: #1a1f36;
          color: white;
        }

        .output-btn.push:hover:not(:disabled) {
          background: #2d3348;
        }

        .output-btn.close {
          padding: 0.375rem;
        }

        .spinner {
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

        .output-stats {
          display: flex;
          gap: 1rem;
          padding: 0.5rem 1rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .stat-value {
          font-weight: 600;
          color: #374151;
        }

        .stat.new .stat-value {
          color: #16a34a;
        }

        .stat.modified .stat-value {
          color: #f59e0b;
        }

        .output-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .output-files {
          width: 240px;
          flex-shrink: 0;
          border-right: 1px solid #e5e7eb;
          overflow-y: auto;
          background: #fafbfc;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          text-align: left;
          border-bottom: 1px solid #f3f4f6;
        }

        .file-item:hover {
          background: #f3f4f6;
        }

        .file-item.selected {
          background: #eef2ff;
          color: #4f46e5;
        }

        .file-icon {
          flex-shrink: 0;
        }

        .file-icon svg {
          width: 16px;
          height: 16px;
        }

        .file-path {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-weight: 500;
        }

        .file-badge.new {
          background: #dcfce7;
          color: #16a34a;
        }

        .file-badge.modified {
          background: #fef3c7;
          color: #d97706;
        }

        .file-copy {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 4px;
          opacity: 0;
          transition: all 0.2s;
        }

        .file-item:hover .file-copy {
          opacity: 1;
        }

        .file-copy:hover {
          color: #1e3a5f;
          background: #eef2ff;
        }

        .file-copy svg {
          width: 14px;
          height: 14px;
        }

        .output-preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .preview-toggle {
          display: flex;
          gap: 0.25rem;
          padding: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        .preview-toggle button {
          padding: 0.375rem 0.75rem;
          background: none;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #6b7280;
          cursor: pointer;
        }

        .preview-toggle button.active {
          background: #1a1f36;
          color: white;
        }

        .code-preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .code-lang {
          font-size: 0.6875rem;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
        }

        .code-lines {
          font-size: 0.6875rem;
          color: #9ca3af;
        }

        .code-content {
          flex: 1;
          margin: 0;
          padding: 1rem;
          background: #1e293b;
          overflow: auto;
        }

        .code-content code {
          font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #e2e8f0;
          white-space: pre;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .output-content {
            flex-direction: column;
          }

          .output-files {
            width: 100%;
            max-height: 150px;
            border-right: none;
            border-bottom: 1px solid #e5e7eb;
          }

          .output-header {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .output-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .output-btn span {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

// File icon helper
function getFileIcon(path: string): React.ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();

  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="#f7df1e">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="10" fill="#000" textAnchor="middle" fontWeight="bold">
          {ext?.toUpperCase().substring(0, 2)}
        </text>
      </svg>
    );
  }

  if (ext === 'py') {
    return (
      <svg viewBox="0 0 24 24" fill="#3776ab">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">
          PY
        </text>
      </svg>
    );
  }

  if (ext === 'json') {
    return (
      <svg viewBox="0 0 24 24" fill="#6b7280">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="7" fill="#fff" textAnchor="middle">
          {'{}'}
        </text>
      </svg>
    );
  }

  if (['css', 'scss', 'sass'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="#264de4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="7" fill="#fff" textAnchor="middle" fontWeight="bold">
          CSS
        </text>
      </svg>
    );
  }

  if (ext === 'html') {
    return (
      <svg viewBox="0 0 24 24" fill="#e34c26">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="bold">
          HTML
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
