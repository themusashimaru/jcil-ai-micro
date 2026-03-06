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
import { COPY_FEEDBACK_DURATION_MS } from './types';
import { getLanguage } from './OutputPanelFileIcons';
import { OutputPanelFileList } from './OutputPanelFileList';
import { OutputPanelStyles } from './OutputPanelStyles';

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
      setTimeout(() => setCopiedFile(null), COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      // Client-side only - browser console for user debugging
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
        <OutputPanelFileList
          files={files}
          selectedFile={selectedFile}
          copiedFile={copiedFile}
          onSelectFile={setSelectedFile}
          onCopyFile={handleCopyFile}
        />

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

      <OutputPanelStyles />
    </div>
  );
}
