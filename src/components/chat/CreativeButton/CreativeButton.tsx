/**
 * CREATIVE BUTTON COMPONENT
 *
 * Dropdown button for creative AI tools:
 * - Create Image (text-to-image)
 * - Edit Image (image editing with references)
 * - Create Slides (coming soon)
 *
 * Matches the design of the Agents dropdown.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Wand2, Presentation, Sparkles } from 'lucide-react';

export type CreativeMode = 'create-image' | 'edit-image' | 'create-slides';

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
      case 'create-slides':
        return 'Slides';
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
        className={`
          disabled:opacity-50 flex items-center gap-1 transition-all text-xs
          ${activeMode ? 'text-pink-300' : 'text-white hover:text-pink-300'}
        `}
        title="Creative tools"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{getModeLabel()}</span>
        {activeMode && <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse" />}
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
              className="fixed z-[9999] w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden"
              style={{
                bottom: buttonRef.current
                  ? window.innerHeight - buttonRef.current.getBoundingClientRect().top + 8
                  : 'auto',
                left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 'auto',
              }}
            >
              <div className="p-2 border-b border-gray-700">
                <p className="text-xs text-gray-400 font-medium">Creative Tools</p>
              </div>
              <div className="p-1">
                {/* Create Image */}
                <button
                  onClick={() => handleSelect('create-image')}
                  className={`w-full flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    activeMode === 'create-image'
                      ? 'bg-pink-600/20 text-pink-300'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <ImagePlus className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Create Image</p>
                    <p className="text-xs text-gray-500">Generate images from text descriptions</p>
                  </div>
                </button>

                {/* Edit Image */}
                <button
                  onClick={() => handleSelect('edit-image')}
                  className={`w-full flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    activeMode === 'edit-image'
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Wand2 className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Edit Image</p>
                    <p className="text-xs text-gray-500">Modify images with AI assistance</p>
                  </div>
                </button>

                {/* Create Slides - Coming Soon */}
                <button
                  onClick={() => handleSelect('create-slides')}
                  className={`w-full flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    activeMode === 'create-slides'
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Presentation className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Create Slides</p>
                    <p className="text-xs text-gray-500">Generate presentations with AI visuals</p>
                    <p className="text-xs text-blue-400 mt-0.5">Coming Soon</p>
                  </div>
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
