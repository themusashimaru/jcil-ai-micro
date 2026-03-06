'use client';

import type { Folder, Document } from './my-files-types';

export default function MyFilesContextMenu({
  contextMenu,
  folders,
  onEditFolder,
  onDeleteFolder,
  onMoveFile,
  onDeleteFile,
}: {
  contextMenu: {
    x: number;
    y: number;
    type: 'folder' | 'file';
    item: Folder | Document;
  };
  folders: Folder[];
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFile: (docId: string, folderId: string | null) => void;
  onDeleteFile: (docId: string) => void;
}) {
  return (
    <div
      className="fixed z-50 py-1 rounded-lg shadow-lg min-w-32 bg-background border border-theme"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
    >
      {contextMenu.type === 'folder' && (
        <>
          <button
            onClick={() => onEditFolder(contextMenu.item as Folder)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2 text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Rename
          </button>
          <button
            onClick={() => onDeleteFolder((contextMenu.item as Folder).id)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2 text-red-500"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </>
      )}
      {contextMenu.type === 'file' && (
        <>
          {/* Move to folder options */}
          <div className="px-3 py-1 text-xs text-text-muted">Move to:</div>
          <button
            onClick={() => onMoveFile((contextMenu.item as Document).id, null)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2 text-text-primary"
          >
            <svg
              className="w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Root
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onMoveFile((contextMenu.item as Document).id, folder.id)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-opacity-50 transition-colors flex items-center gap-2 text-text-primary"
            >
              <svg
                className="w-4 h-4"
                style={{ color: folder.color }}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              {folder.name}
            </button>
          ))}
          <div className="border-t border-theme my-1" />
          <button
            onClick={() => onDeleteFile((contextMenu.item as Document).id)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2 text-red-500"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
