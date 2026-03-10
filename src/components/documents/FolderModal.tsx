'use client';

import type { Folder } from './my-files-types';
import { FOLDER_COLORS } from './my-files-types';

export default function FolderModal({
  editingFolder,
  folderName,
  setFolderName,
  folderColor,
  setFolderColor,
  isSavingFolder,
  onSave,
  onClose,
}: {
  editingFolder: Folder | null;
  folderName: string;
  setFolderName: (name: string) => void;
  folderColor: string;
  setFolderColor: (color: string) => void;
  isSavingFolder: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 p-4 rounded-lg shadow-xl bg-background border border-theme">
        <h3 className="text-sm font-semibold mb-4 text-text-primary">
          {editingFolder ? 'Edit Folder' : 'New Folder'}
        </h3>

        <div className="space-y-4">
          {/* Folder Name */}
          <div>
            <label className="block text-xs mb-1 text-text-muted">Folder Name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="My Documents"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 bg-glass border border-theme text-text-primary"
              autoFocus
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs mb-2 text-text-muted">Color</label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFolderColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${folderColor === color ? 'ring-2 ring-offset-2 scale-110' : ''}`}
                  style={{
                    backgroundColor: color,
                    outlineColor: folderColor === color ? color : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors bg-glass text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!folderName.trim() || isSavingFolder}
              className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 bg-primary text-white"
            >
              {isSavingFolder ? 'Saving...' : editingFolder ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
