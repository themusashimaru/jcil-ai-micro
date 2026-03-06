'use client';

import type { Document, Folder } from './my-files-types';
import { formatFileSize } from './my-files-types';

function getFileIcon(type: string) {
  switch (type) {
    case 'pdf':
      return (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'docx':
    case 'doc':
      return (
        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'xlsx':
    case 'xls':
      return (
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ready':
      return <span className="text-xs text-green-500">Ready</span>;
    case 'processing':
      return <span className="text-xs text-yellow-500 animate-pulse">Processing...</span>;
    case 'pending':
      return <span className="text-xs text-gray-500">Pending</span>;
    case 'error':
      return <span className="text-xs text-red-500">Error</span>;
    default:
      return null;
  }
}

export function MoveDropdown({
  doc,
  folders,
  currentFolderId,
  onMove,
  onClose,
}: {
  doc: Document;
  folders: Folder[];
  currentFolderId: string | null;
  onMove: (docId: string, folderId: string | null) => void;
  onClose: () => void;
}) {
  const availableFolders = currentFolderId
    ? folders.filter((f) => f.id !== currentFolderId)
    : folders;

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 py-1 rounded-lg shadow-lg min-w-32 bg-background border border-theme"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-xs text-text-muted">
        {currentFolderId ? 'Move to:' : 'Move to folder:'}
      </div>
      {currentFolderId && (
        <button
          onClick={() => {
            onMove(doc.id, null);
            onClose();
          }}
          className="w-full px-2 py-1.5 text-left text-xs hover:bg-opacity-50 transition-colors flex items-center gap-2 text-text-primary"
        >
          <svg
            className="w-3 h-3 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Unfiled
        </button>
      )}
      {availableFolders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => {
            onMove(doc.id, folder.id);
            onClose();
          }}
          className="w-full px-2 py-1.5 text-left text-xs hover:bg-opacity-50 transition-colors flex items-center gap-2 text-text-primary"
        >
          <svg
            className="w-3 h-3"
            style={{ color: folder.color }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          {folder.name}
        </button>
      ))}
    </div>
  );
}

export default function FileItem({
  doc,
  folders,
  currentFolderId,
  showMoveMenu,
  setShowMoveMenu,
  onMove,
  onDelete,
  onContextMenu,
}: {
  doc: Document;
  folders: Folder[];
  currentFolderId: string | null;
  showMoveMenu: string | null;
  setShowMoveMenu: (id: string | null) => void;
  onMove: (docId: string, folderId: string | null) => void;
  onDelete: (docId: string) => void;
  onContextMenu: (e: React.MouseEvent, type: 'folder' | 'file', item: Document) => void;
}) {
  const showMoveButton = currentFolderId !== null || folders.length > 0;

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg group hover:bg-opacity-50 transition-colors relative bg-glass"
      onContextMenu={(e) => onContextMenu(e, 'file', doc)}
    >
      {getFileIcon(doc.file_type)}
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate text-text-primary">{doc.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{formatFileSize(doc.file_size)}</span>
          {getStatusBadge(doc.status)}
        </div>
      </div>
      {/* Move button */}
      {showMoveButton && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMoveMenu(showMoveMenu === doc.id ? null : doc.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-opacity-50 transition-all bg-glass"
            title={currentFolderId ? 'Move file' : 'Move to folder'}
          >
            <svg
              className="w-3 h-3 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </button>
          {/* Move dropdown */}
          {showMoveMenu === doc.id && (
            <MoveDropdown
              doc={doc}
              folders={folders}
              currentFolderId={currentFolderId}
              onMove={onMove}
              onClose={() => setShowMoveMenu(null)}
            />
          )}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(doc.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
        title="Delete file"
      >
        <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
