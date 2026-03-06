export function CommandPaletteStyles() {
  return (
    <style jsx>{`
      .command-palette-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 15vh;
        z-index: 1000;
        animation: fadeIn 0.15s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .command-palette {
        width: 100%;
        max-width: 560px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        animation: slideDown 0.15s ease;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .palette-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
      }

      .search-icon {
        width: 20px;
        height: 20px;
        color: #9ca3af;
        flex-shrink: 0;
      }

      .palette-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 1rem;
        background: transparent;
        color: #1a1f36;
      }

      .palette-input::placeholder {
        color: #9ca3af;
      }

      .palette-hint {
        padding: 0.25rem 0.5rem;
        background: #f3f4f6;
        border-radius: 4px;
        font-size: 0.75rem;
        color: #4b5563;
        font-family: inherit;
      }

      .palette-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 0.5rem;
      }

      .command-group {
        margin-bottom: 0.5rem;
      }

      .group-label {
        padding: 0.5rem 0.75rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .command-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s;
      }

      .command-item:hover,
      .command-item.selected {
        background: #f3f4f6;
      }

      .command-item.selected {
        background: var(--cl-info-bg-medium, #e0e7ff);
      }

      .command-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
        width: 28px;
        text-align: center;
      }

      .command-info {
        flex: 1;
        min-width: 0;
      }

      .command-title {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #1a1f36;
      }

      .command-desc {
        display: block;
        font-size: 0.75rem;
        color: #4b5563;
        margin-top: 0.125rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .command-shortcut {
        padding: 0.25rem 0.5rem;
        background: #e5e7eb;
        border-radius: 4px;
        font-size: 0.6875rem;
        color: #4b5563;
        font-family: inherit;
      }

      .no-results {
        padding: 2rem;
        text-align: center;
        color: #4b5563;
      }

      .palette-footer {
        display: flex;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        background: var(--cl-bg-secondary, #f9fafb);
      }

      .footer-hint {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: #4b5563;
      }

      .footer-hint kbd {
        padding: 0.125rem 0.375rem;
        background: #e5e7eb;
        border-radius: 3px;
        font-size: 0.6875rem;
        font-family: inherit;
      }

      @media (max-width: 640px) {
        .command-palette-overlay {
          padding: 1rem;
          padding-top: 5vh;
        }

        .command-palette {
          max-height: 80vh;
        }
      }
    `}</style>
  );
}
