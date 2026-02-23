/**
 * CHAT SIDEBAR FOLDER SECTION
 *
 * PURPOSE:
 * - Render a single folder with its chats in the sidebar
 * - Support collapse/expand, context menu (edit/delete)
 *
 * Extracted from ChatSidebar.tsx to reduce component size.
 */

'use client';

import type { ReactNode } from 'react';
import type { Chat, ChatFolder } from '@/app/chat/types';

export interface ChatSidebarFolderSectionProps {
  folder: ChatFolder;
  folderChats: Chat[];
  collapsedFolders: Set<string>;
  folderMenuId: string | null;
  toggleFolderCollapse: (folderId: string) => void;
  setFolderMenuId: (id: string | null) => void;
  openEditFolder: (folder: ChatFolder) => void;
  handleDeleteFolder: (folderId: string) => void;
  renderChatItem: (chat: Chat) => ReactNode;
}

export function ChatSidebarFolderSection({
  folder,
  folderChats,
  collapsedFolders,
  folderMenuId,
  toggleFolderCollapse,
  setFolderMenuId,
  openEditFolder,
  handleDeleteFolder,
  renderChatItem,
}: ChatSidebarFolderSectionProps) {
  const isCollapsed = collapsedFolders.has(folder.id);
  const menuOpen = folderMenuId === folder.id;

  return (
    <div className="mb-2">
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group"
        style={{ backgroundColor: 'var(--glass-bg)' }}
      >
        <button
          onClick={() => toggleFolderCollapse(folder.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <svg
            className={`h-3 w-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            style={{ color: 'var(--text-muted)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {folder.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: folder.color }}
            />
          )}
          <span
            className="text-xs font-semibold uppercase truncate"
            style={{ color: 'var(--text-muted)' }}
          >
            {folder.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ({folderChats.length})
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFolderMenuId(menuOpen ? null : folder.id);
          }}
          className="p-1 opacity-0 group-hover:opacity-100 rounded"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01"
            />
          </svg>
        </button>

        {/* Folder context menu */}
        {menuOpen && (
          <div
            className="absolute right-4 top-8 z-20 w-36 rounded-lg py-1 shadow-xl"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => openEditFolder(folder)}
              className="w-full px-3 py-1.5 text-left text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteFolder(folder.id)}
              className="w-full px-3 py-1.5 text-left text-sm text-red-500"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-1 space-y-1 pl-2" role="list">
          {folderChats.map((chat) => renderChatItem(chat))}
        </div>
      )}
    </div>
  );
}
