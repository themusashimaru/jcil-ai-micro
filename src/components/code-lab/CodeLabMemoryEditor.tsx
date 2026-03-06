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
import { SECTION_TEMPLATES } from './MemoryEditorConstants';
import { SaveIcon, EditIcon, EyeIcon, PlusIcon, FileIcon, RefreshIcon } from './MemoryEditorIcons';
import { MemoryEditorStyles } from './MemoryEditorStyles';

export type { MemoryFile, CodeLabMemoryEditorProps } from './MemoryEditorConstants';

import type { CodeLabMemoryEditorProps } from './MemoryEditorConstants';

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

      <MemoryEditorStyles />
    </div>
  );
}

export default CodeLabMemoryEditor;
