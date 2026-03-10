/** Folder create/edit modal — extracted from ChatSidebar */

'use client';

import type { ChatFolder } from '@/app/chat/types';

const FOLDER_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

interface ChatSidebarFolderModalProps {
  editingFolder: ChatFolder | null;
  folderForm: { name: string; color: string };
  onFormChange: (form: { name: string; color: string }) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ChatSidebarFolderModal({
  editingFolder,
  folderForm,
  onFormChange,
  onClose,
  onSave,
}: ChatSidebarFolderModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingFolder ? 'Edit Folder' : 'New Folder'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="relative w-full max-w-sm rounded-2xl p-6 bg-surface border border-theme"
      >
        <h3 className="text-lg font-semibold mb-4 text-text-primary">
          {editingFolder ? 'Edit Folder' : 'New Folder'}
        </h3>
        <input
          type="text"
          placeholder="Folder name"
          value={folderForm.name}
          onChange={(e) => onFormChange({ ...folderForm, name: e.target.value })}
          maxLength={50}
          className="w-full rounded-lg px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 bg-glass border border-theme text-text-primary"
          autoFocus
        />
        <div className="mb-4">
          <label className="block text-sm mb-2 text-text-secondary">Color (optional)</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFormChange({ ...folderForm, color: '' })}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-glass ${!folderForm.color ? 'border-white ring-2 ring-white/50' : 'border-transparent hover:border-gray-400'}`}
            >
              {!folderForm.color && (
                <svg
                  className="w-4 h-4 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
            {FOLDER_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => onFormChange({ ...folderForm, color })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${folderForm.color === color ? 'border-white ring-2 ring-white/50 scale-110' : 'border-transparent hover:border-gray-400 hover:scale-105'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm bg-glass text-text-primary border border-theme"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-primary text-background"
          >
            {editingFolder ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
