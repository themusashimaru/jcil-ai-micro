/** Creative tools dropdown menu for CodeLab composer */

'use client';

import { useRef, useEffect } from 'react';

interface CodeLabComposerCreativeProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCreativeMode: (mode: 'create-image' | 'edit-image') => void;
  disabled?: boolean;
  isStreaming: boolean;
}

export function CodeLabComposerCreative({
  isOpen,
  onToggle,
  onClose,
  onCreativeMode,
  disabled,
  isStreaming,
}: CodeLabComposerCreativeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="creative-menu-container" ref={ref}>
      <button
        className="composer-btn creative"
        onClick={onToggle}
        disabled={disabled || isStreaming}
        title="Creative Tools"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="btn-label">Create</span>
      </button>

      {isOpen && (
        <div className="creative-dropdown">
          <button
            className="creative-option"
            onClick={() => {
              onCreativeMode('create-image');
              onClose();
            }}
          >
            <div className="creative-icon create">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <div className="creative-info">
              <span className="creative-name">Create Image</span>
              <span className="creative-desc">Generate images from text descriptions</span>
            </div>
          </button>

          <button
            className="creative-option"
            onClick={() => {
              onCreativeMode('edit-image');
              onClose();
            }}
          >
            <div className="creative-icon edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div className="creative-info">
              <span className="creative-name">Edit Image</span>
              <span className="creative-desc">Modify uploaded images with AI</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
