/** Attachment file upload menu (portal) for ChatComposer */

'use client';

import { createPortal } from 'react-dom';
import type { RefObject } from 'react';

interface ComposerAttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  photoInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export function ComposerAttachmentMenu({
  isOpen,
  onClose,
  cameraInputRef,
  photoInputRef,
  fileInputRef,
}: ComposerAttachmentMenuProps) {
  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-24 left-4 z-[9999] w-56 rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
        <button
          onClick={() => {
            cameraInputRef.current?.click();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors rounded-t-lg"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Take a Photo
        </button>
        <button
          onClick={() => {
            photoInputRef.current?.click();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Upload Photo
        </button>
        <button
          onClick={() => {
            fileInputRef.current?.click();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10 rounded-b-lg"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Upload File
        </button>
      </div>
    </>,
    document.body
  );
}
