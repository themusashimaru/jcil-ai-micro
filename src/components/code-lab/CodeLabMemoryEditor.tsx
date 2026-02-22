'use client';

/**
 * CODE LAB MEMORY EDITOR
 *
 * Beautiful CLAUDE.md file editor for project memory/instructions.
 * Claude Code parity feature - allows users to create and edit
 * project-level context that Claude remembers across sessions.
 *
 * Features:
 * - Create/edit CLAUDE.md files
 * - Template suggestions
 * - Section-based editing
 * - Preview mode
 * - Keyboard shortcuts
 *
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { DEFAULT_CLAUDE_MD_TEMPLATE } from '@/lib/workspace/memory-files';
import { sanitizeHtml } from '@/lib/sanitize';

// ============================================
// TYPES
// ============================================

interface MemoryFile {
  path: string;
  content: string;
  exists: boolean;
  lastModified?: Date;
}

interface CodeLabMemoryEditorProps {
  memoryFile?: MemoryFile;
  onSave: (content: string) => Promise<void>;
  onLoad?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// SECTION TEMPLATES
// ============================================

const SECTION_TEMPLATES = [
  {
    id: 'overview',
    name: 'Project Overview',
    icon: '📋',
    content: `## Project Overview

<!-- Describe your project here -->
- **Name**:
- **Description**:
- **Tech Stack**:
`,
  },
  {
    id: 'style',
    name: 'Code Style',
    icon: '🎨',
    content: `## Code Style & Conventions

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Write self-documenting code with clear variable names
- Prefer functional components with hooks
`,
  },
  {
    id: 'instructions',
    name: 'Instructions',
    icon: '📝',
    content: `## Instructions

- Always run tests after making changes
- Prefer small, focused commits
- Explain changes before making them
- Keep dependencies up to date
`,
  },
  {
    id: 'donot',
    name: 'Do Not',
    icon: '🚫',
    content: `## Do Not

- Do not modify configuration files without asking
- Do not delete files without confirmation
- Do not push to main branch directly
- Do not expose API keys or secrets
`,
  },
  {
    id: 'architecture',
    name: 'Architecture',
    icon: '🏗️',
    content: `## Architecture Notes

<!-- Document key architectural decisions -->
-
`,
  },
  {
    id: 'tasks',
    name: 'Common Tasks',
    icon: '✅',
    content: `## Common Tasks

<!-- Document frequently performed tasks -->
- **Run tests**: \`npm test\`
- **Build**: \`npm run build\`
- **Deploy**: \`npm run deploy\`
`,
  },
];

// ============================================
// ICONS
// ============================================

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
    />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
    />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
    />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
    />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function CodeLabMemoryEditor({
  memoryFile,
  onSave,
  onLoad,
  isLoading = false,
  className = '',
}: CodeLabMemoryEditorProps) {
  const [content, setContent] = useState(memoryFile?.content || '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showTemplates, setShowTemplates] = useState(!memoryFile?.exists);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update content when memoryFile changes
  useEffect(() => {
    if (memoryFile?.content !== undefined) {
      setContent(memoryFile.content);
      setHasChanges(false);
    }
  }, [memoryFile?.content]);

  // Handle content change
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
      // Cmd/Ctrl + P to toggle preview
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setMode((prev) => (prev === 'edit' ? 'preview' : 'edit'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving, handleSave]);

  // Insert section template
  const insertTemplate = useCallback(
    (template: (typeof SECTION_TEMPLATES)[0]) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent((prev) => (prev ? `${prev}\n\n${template.content}` : template.content));
        setHasChanges(true);
        return;
      }

      const start = textarea.selectionStart;
      const before = content.substring(0, start);
      const after = content.substring(start);
      const newContent = before + template.content + after;

      setContent(newContent);
      setHasChanges(true);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + template.content.length,
          start + template.content.length
        );
      }, 0);
    },
    [content]
  );

  // Use default template
  const useDefaultTemplate = useCallback(() => {
    setContent(DEFAULT_CLAUDE_MD_TEMPLATE);
    setHasChanges(true);
    setShowTemplates(false);
  }, []);

  // Render preview
  const renderPreview = () => {
    // Simple markdown-ish rendering
    const html = content
      .replace(/^### (.*$)/gm, '<h3 class="preview-h3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="preview-h2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="preview-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="preview-code">$1</code>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="numbered">$2</li>')
      .replace(/<!--(.*?)-->/g, '<span class="preview-comment">&lt;!--$1--&gt;</span>')
      .replace(/\n/g, '<br />');

    return (
      <div className="preview-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
    );
  };

  return (
    <div className={`memory-editor ${className}`}>
      {/* Header */}
      <div className="memory-header">
        <div className="memory-title">
          <FileIcon />
          <h2>CLAUDE.md</h2>
          {hasChanges && <span className="unsaved-badge">Unsaved</span>}
        </div>
        <div className="memory-actions">
          {onLoad && (
            <button
              className="action-btn"
              onClick={onLoad}
              disabled={isLoading}
              title="Reload file"
            >
              <RefreshIcon />
            </button>
          )}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
              onClick={() => setMode('edit')}
            >
              <EditIcon />
              Edit
            </button>
            <button
              className={`mode-btn ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >
              <EyeIcon />
              Preview
            </button>
          </div>
          <button className="save-btn" onClick={handleSave} disabled={!hasChanges || isSaving}>
            <SaveIcon />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="memory-description">
        Define project-specific instructions and context for Claude. This file is automatically
        loaded at the start of each session.
      </p>

      {/* Templates panel (show when no content exists) */}
      {showTemplates && !content && (
        <div className="templates-panel">
          <h3>Quick Start</h3>
          <p>Choose a template or start from scratch:</p>
          <div className="templates-grid">
            <button className="template-card default" onClick={useDefaultTemplate}>
              <span className="template-icon">📄</span>
              <span className="template-name">Default Template</span>
              <span className="template-desc">Full template with all sections</span>
            </button>
            {SECTION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => {
                  insertTemplate(template);
                  setShowTemplates(false);
                }}
              >
                <span className="template-icon">{template.icon}</span>
                <span className="template-name">{template.name}</span>
              </button>
            ))}
          </div>
          <button className="skip-templates" onClick={() => setShowTemplates(false)}>
            Start from scratch
          </button>
        </div>
      )}

      {/* Editor/Preview */}
      {(!showTemplates || content) && (
        <div className="editor-container">
          {mode === 'edit' ? (
            <>
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="# Project Memory (CLAUDE.md)

Write instructions and context for Claude here...

## Instructions
- Always run tests after making changes
- Follow existing code patterns

## Do Not
- Do not modify critical config files"
                disabled={isLoading}
              />
              <div className="section-buttons">
                <span className="section-label">Add section:</span>
                {SECTION_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className="section-btn"
                    onClick={() => insertTemplate(template)}
                    title={template.name}
                  >
                    <PlusIcon />
                    {template.icon} {template.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            renderPreview()
          )}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="keyboard-hints">
        <span>
          <kbd>⌘S</kbd> Save
        </span>
        <span>
          <kbd>⌘P</kbd> Toggle Preview
        </span>
      </div>

      <style jsx>{`
        .memory-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1rem;
          background: var(--cl-bg-primary, #ffffff);
        }

        .memory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .memory-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .memory-title h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .unsaved-badge {
          font-size: 0.6875rem;
          padding: 0.125rem 0.375rem;
          background: rgba(245, 158, 11, 0.15);
          color: #d97706;
          border-radius: 4px;
          font-weight: 500;
        }

        .memory-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .action-btn {
          padding: 0.375rem;
          background: none;
          border: none;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .action-btn:hover:not(:disabled) {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-primary, #1a1f36);
        }

        .mode-toggle {
          display: flex;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 8px;
          padding: 0.125rem;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.625rem;
          background: none;
          border: none;
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .mode-btn.active {
          background: var(--cl-bg-primary, #ffffff);
          color: var(--cl-text-primary, #1a1f36);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .save-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          background: var(--cl-accent-primary, #1e3a5f);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .save-btn:hover:not(:disabled) {
          background: var(--cl-accent-secondary, #2d4a6f);
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .memory-description {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          margin: 0 0 1rem 0;
          line-height: 1.5;
        }

        .templates-panel {
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .templates-panel h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .templates-panel > p {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: var(--cl-text-secondary, #374151);
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .template-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          padding: 0.875rem;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .template-card:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .template-card.default {
          grid-column: 1 / -1;
          flex-direction: row;
          justify-content: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: linear-gradient(135deg, rgba(30, 58, 95, 0.05), rgba(30, 58, 95, 0.02));
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .template-icon {
          font-size: 1.5rem;
        }

        .template-name {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
        }

        .template-desc {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .skip-templates {
          width: 100%;
          padding: 0.5rem;
          background: none;
          border: none;
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .skip-templates:hover {
          color: var(--cl-text-primary, #1a1f36);
        }

        .editor-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .editor-textarea {
          flex: 1;
          width: 100%;
          padding: 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 10px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: var(--cl-text-primary, #1a1f36);
          resize: none;
          transition: border-color 0.15s ease;
        }

        .editor-textarea:focus {
          outline: none;
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .editor-textarea::placeholder {
          color: var(--cl-text-tertiary, #9ca3af);
        }

        .section-buttons {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .section-label {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .section-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 6px;
          font-size: 0.75rem;
          color: var(--cl-text-secondary, #374151);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .section-btn:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-accent-primary, #1e3a5f);
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .preview-content {
          flex: 1;
          padding: 1rem;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 10px;
          overflow-y: auto;
          font-size: 0.875rem;
          line-height: 1.7;
          color: var(--cl-text-primary, #1a1f36);
        }

        .preview-content :global(.preview-h1) {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.75rem 0;
          color: var(--cl-text-primary, #1a1f36);
        }

        .preview-content :global(.preview-h2) {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 1.5rem 0 0.5rem 0;
          padding-bottom: 0.375rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          color: var(--cl-text-primary, #1a1f36);
        }

        .preview-content :global(.preview-h3) {
          font-size: 1rem;
          font-weight: 600;
          margin: 1rem 0 0.375rem 0;
          color: var(--cl-text-primary, #1a1f36);
        }

        .preview-content :global(.preview-code) {
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 4px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.8125rem;
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .preview-content :global(.preview-comment) {
          color: var(--cl-text-tertiary, #9ca3af);
          font-style: italic;
        }

        .preview-content :global(li) {
          margin: 0.25rem 0;
          padding-left: 1.25rem;
          position: relative;
        }

        .preview-content :global(li)::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .keyboard-hints {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .keyboard-hints kbd {
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 4px;
          font-family: inherit;
          font-size: 0.6875rem;
        }
      `}</style>
    </div>
  );
}

export default CodeLabMemoryEditor;
