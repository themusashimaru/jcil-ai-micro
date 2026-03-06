export function CodeLabPreviewStyles() {
  return (
    <style jsx>{`
      .code-preview {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e293b;
        border-radius: 8px;
        overflow: hidden;
      }

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        background: #0f172a;
        border-bottom: 1px solid #334155;
      }

      .preview-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: white;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .preview-title svg {
        width: 18px;
        height: 18px;
        color: #1e3a5f;
      }

      .preview-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .device-selector {
        display: flex;
        background: #1e293b;
        border-radius: 6px;
        padding: 2px;
      }

      .device-selector button {
        padding: 0.375rem;
        background: none;
        border: none;
        border-radius: 4px;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;
      }

      .device-selector button:hover {
        color: #94a3b8;
      }

      .device-selector button.active {
        background: #334155;
        color: #1e3a5f;
      }

      .device-selector button svg {
        width: 16px;
        height: 16px;
      }

      .preview-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.375rem;
        background: #1e293b;
        border: none;
        border-radius: 6px;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .preview-btn:hover:not(:disabled) {
        color: #94a3b8;
        background: #334155;
      }

      .preview-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .preview-btn.active {
        background: #334155;
        color: #1e3a5f;
      }

      .preview-btn.close:hover {
        color: #ef4444;
      }

      .preview-btn svg {
        width: 18px;
        height: 18px;
      }

      .preview-btn svg.spinning {
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

      .console-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        min-width: 14px;
        height: 14px;
        padding: 0 4px;
        background: #1e3a5f;
        color: white;
        font-size: 0.625rem;
        font-weight: 600;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .preview-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: #7f1d1d;
        color: #fecaca;
        font-size: 0.8125rem;
      }

      .preview-error svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .preview-error span {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-error button {
        background: none;
        border: none;
        color: #fecaca;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .preview-content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: #334155;
        overflow: auto;
      }

      .preview-frame-wrapper {
        width: 100%;
        height: 100%;
        background: white;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: max-width 0.3s ease;
      }

      .preview-frame {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }

      .preview-console {
        max-height: 200px;
        background: #0f172a;
        border-top: 1px solid #334155;
        display: flex;
        flex-direction: column;
      }

      .console-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.375rem 0.75rem;
        background: #1e293b;
        font-size: 0.75rem;
        color: #94a3b8;
      }

      .console-header button {
        background: none;
        border: none;
        color: #64748b;
        font-size: 0.6875rem;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .console-header button:hover {
        color: #94a3b8;
      }

      .console-logs {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }

      .console-empty {
        color: #64748b;
        font-size: 0.75rem;
        text-align: center;
        padding: 1rem;
      }

      .console-log {
        display: flex;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        font-family: 'SF Mono', 'Menlo', monospace;
        font-size: 0.75rem;
        color: #e2e8f0;
        border-radius: 4px;
      }

      .console-log.log {
        background: transparent;
      }

      .console-log.warn {
        background: rgba(250, 204, 21, 0.1);
        color: #fcd34d;
      }

      .console-log.error {
        background: rgba(239, 68, 68, 0.1);
        color: #fca5a5;
      }

      .log-type {
        color: #64748b;
        text-transform: uppercase;
        font-size: 0.625rem;
        font-weight: 600;
        min-width: 40px;
      }

      .log-message {
        flex: 1;
        word-break: break-all;
      }

      @media (max-width: 640px) {
        .device-selector {
          display: none;
        }

        .preview-content {
          padding: 0;
        }

        .preview-frame-wrapper {
          max-width: 100% !important;
          border-radius: 0;
        }
      }
    `}</style>
  );
}
