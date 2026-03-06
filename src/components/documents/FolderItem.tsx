'use client';

import type { Folder, Document } from './my-files-types';
import FileItem from './FileItem';

export default function FolderItem({
  folder,
  isExpanded,
  docs,
  allFolders,
  showMoveMenu,
  setShowMoveMenu,
  onToggle,
  onEdit,
  onContextMenu,
  onMoveFile,
  onDeleteFile,
  onFileContextMenu,
}: {
  folder: Folder;
  isExpanded: boolean;
  docs: Document[];
  allFolders: Folder[];
  showMoveMenu: string | null;
  setShowMoveMenu: (id: string | null) => void;
  onToggle: (folderId: string) => void;
  onEdit: (folder: Folder) => void;
  onContextMenu: (e: React.MouseEvent, type: 'folder' | 'file', item: Folder | Document) => void;
  onMoveFile: (docId: string, folderId: string | null) => void;
  onDeleteFile: (docId: string) => void;
  onFileContextMenu: (e: React.MouseEvent, type: 'folder' | 'file', item: Document) => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer group ${isExpanded ? 'bg-glass' : 'bg-transparent'}`}
        onClick={() => onToggle(folder.id)}
        onContextMenu={(e) => onContextMenu(e, 'folder', folder)}
      >
        <svg
          className={`w-3 h-3 transition-transform flex-shrink-0 text-text-muted ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg
          className="w-4 h-4 flex-shrink-0"
          style={{ color: folder.color }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="text-sm flex-1 truncate text-text-primary">{folder.name}</span>
        <span className="text-xs text-text-muted">{docs.length}</span>
        {/* Folder actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(folder);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-opacity-50 transition-all bg-glass"
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
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      {/* Folder Contents */}
      {isExpanded && (
        <div className="ml-5 pl-2 space-y-1" style={{ borderLeft: `2px solid ${folder.color}` }}>
          {docs.length === 0 ? (
            <p className="text-xs py-2 px-2 text-text-muted">Empty folder</p>
          ) : (
            docs.map((doc) => (
              <FileItem
                key={doc.id}
                doc={doc}
                folders={allFolders}
                currentFolderId={folder.id}
                showMoveMenu={showMoveMenu}
                setShowMoveMenu={setShowMoveMenu}
                onMove={onMoveFile}
                onDelete={onDeleteFile}
                onContextMenu={onFileContextMenu}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
