/**
 * CREATIVE BUTTON COMPONENT
 *
 * Dropdown button for creative AI tools:
 * - Create Image (text-to-image)
 * - Edit Image (image editing with references)
 *
 * Matches the design of the Agents dropdown.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type CreativeMode = 'create-image' | 'edit-image' | 'view-gallery';

interface CreativeButtonProps {
  onSelect: (mode: CreativeMode) => void;
  disabled?: boolean;
  activeMode?: CreativeMode | null;
}

export function CreativeButton({ onSelect, disabled, activeMode }: CreativeButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state on client-side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideButton = buttonRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);

      if (showMenu && !isInsideButton && !isInsideMenu) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleSelect = (mode: CreativeMode) => {
    setShowMenu(false);
    onSelect(mode);
  };

  const getModeLabel = (): string => {
    switch (activeMode) {
      case 'create-image':
        return 'Create Image';
      case 'edit-image':
        return 'Edit Image';
      default:
        return 'Create';
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80"
        style={{
          color: activeMode ? 'var(--primary)' : 'var(--text-primary)',
        }}
        title="Creative tools"
      >
        <span>{getModeLabel()}</span>
        {activeMode && <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />}
        <svg
          className={`w-3 h-3 transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu via portal */}
      {showMenu &&
        isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowMenu(false)}
              aria-hidden="true"
            />
            {/* Menu positioned above button */}
            <div
              ref={menuRef}
              className="fixed z-[9999] w-64 rounded-xl shadow-xl overflow-hidden bg-surface-elevated border border-theme"
              style={{
                bottom: buttonRef.current
                  ? window.innerHeight - buttonRef.current.getBoundingClientRect().top + 8
                  : 'auto',
                left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 'auto',
              }}
            >
              <div className="p-2 border-b border-theme">
                <p className="text-xs font-medium text-text-muted">Creative Tools</p>
              </div>
              <div className="p-1">
                {/* Create Image */}
                <button
                  onClick={() => handleSelect('create-image')}
                  className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor:
                      activeMode === 'create-image' ? 'var(--glass-bg)' : 'transparent',
                    color:
                      activeMode === 'create-image'
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                  }}
                >
                  <p className="text-sm font-medium">Create Image</p>
                  {activeMode === 'create-image' && (
                    <svg
                      className="w-4 h-4 ml-auto text-text-muted"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </button>

                {/* Edit Image */}
                <button
                  onClick={() => handleSelect('edit-image')}
                  className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor:
                      activeMode === 'edit-image' ? 'var(--glass-bg)' : 'transparent',
                    color:
                      activeMode === 'edit-image' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <p className="text-sm font-medium">Edit Image</p>
                  {activeMode === 'edit-image' && (
                    <svg
                      className="w-4 h-4 ml-auto text-text-muted"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-theme" />

                {/* View Gallery */}
                <button
                  onClick={() => handleSelect('view-gallery')}
                  className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-text-secondary"
                >
                  <p className="text-sm font-medium">My Creations</p>
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
