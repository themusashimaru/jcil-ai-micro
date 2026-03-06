export function MemoryEditorStyles() {
  return (
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
  );
}
