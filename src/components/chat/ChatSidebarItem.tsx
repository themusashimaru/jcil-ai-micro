/** Memoized chat item for sidebar — extracted from ChatSidebar */

'use client';

import { memo } from 'react';
import type { Chat, ChatFolder } from '@/app/chat/types';

export interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  menuOpen: boolean;
  moveMenuOpen: boolean;
  folders: ChatFolder[];
  onSelect: (chatId: string) => void;
  onToggleMenu: (chatId: string) => void;
  onToggleMoveMenu: (chatId: string) => void;
  onCloseMenus: () => void;
  onStartEdit: (chat: Chat) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTitleChange: (title: string) => void;
  onPin: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onMoveToFolder: (
    chatId: string,
    folderId: string | null,
    folderData?: { id: string; name: string; color: string | null }
  ) => void;
}

export const ChatItem = memo(
  function ChatItem({
    chat,
    isActive,
    isEditing,
    editTitle,
    menuOpen,
    moveMenuOpen,
    folders,
    onSelect,
    onToggleMenu,
    onToggleMoveMenu,
    onCloseMenus,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditTitleChange,
    onPin,
    onDelete,
    onMoveToFolder,
  }: ChatItemProps) {
    return (
      <div
        role="listitem"
        aria-current={isActive ? 'page' : undefined}
        className={`group relative rounded-lg ${isActive ? 'bg-glass' : 'bg-transparent'}`}
      >
        {isEditing ? (
          <div className="p-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              onBlur={onSaveEdit}
              className="w-full rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 bg-glass text-text-primary border border-theme"
              autoFocus
            />
          </div>
        ) : (
          <>
            <button onClick={() => onSelect(chat.id)} className="w-full p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                  {chat.isPinned && (
                    <svg
                      className="h-3 w-3 flex-shrink-0 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 3l2.5 6.5L19 10l-6.5 .5L10 17l-2.5-6.5L1 10l6.5-.5L10 3z" />
                    </svg>
                  )}
                  <span
                    className="truncate text-sm font-medium text-text-primary"
                  >
                    {chat.title}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMenu(chat.id);
                  }}
                  className="rounded p-1 opacity-0 group-hover:opacity-100 flex-shrink-0 text-text-muted"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
              {chat.summary && (
                <p className="mt-1 truncate text-xs text-text-muted">
                  {chat.summary}
                </p>
              )}
            </button>

            {/* Context Menu */}
            {menuOpen && (
              <div
                className="absolute right-2 top-12 z-20 w-48 rounded-lg py-1 shadow-xl bg-background border border-theme"
              >
                <button
                  onClick={() => onStartEdit(chat)}
                  className="w-full px-4 py-2 text-left text-sm text-text-primary"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    onPin(chat.id);
                    onCloseMenus();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-text-primary"
                >
                  {chat.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMoveMenu(chat.id);
                  }}
                  className="w-full px-4 py-2 text-left text-sm flex items-center justify-between text-text-primary"
                >
                  <span>Move to folder</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${moveMenuOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                {/* Move to folder - inline expanded */}
                {moveMenuOpen && (
                  <div
                    className="py-1 border-t border-theme mt-1"
                  >
                    {chat.folder && (
                      <button
                        onClick={() => {
                          onMoveToFolder(chat.id, null);
                          onCloseMenus();
                        }}
                        className="w-full px-4 py-2 text-left text-sm pl-6 text-text-muted"
                      >
                        Remove from folder
                      </button>
                    )}
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          onMoveToFolder(chat.id, folder.id, {
                            id: folder.id,
                            name: folder.name,
                            color: folder.color,
                          });
                          onCloseMenus();
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 pl-6 text-text-primary"
                      >
                        {folder.color && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: folder.color }}
                          />
                        )}
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                    {folders.length === 0 && (
                      <div
                        className="px-4 py-2 text-sm pl-6 text-text-muted"
                      >
                        No folders yet
                      </div>
                    )}
                  </div>
                )}
                <hr className="border-theme my-1" />
                <button
                  onClick={() => {
                    if (confirm('Delete this chat?')) {
                      onDelete(chat.id);
                    }
                    onCloseMenus();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.chat.id === next.chat.id &&
    prev.chat.title === next.chat.title &&
    prev.chat.isPinned === next.chat.isPinned &&
    prev.chat.summary === next.chat.summary &&
    prev.chat.folder?.id === next.chat.folder?.id &&
    prev.isActive === next.isActive &&
    prev.isEditing === next.isEditing &&
    prev.editTitle === next.editTitle &&
    prev.menuOpen === next.menuOpen &&
    prev.moveMenuOpen === next.moveMenuOpen &&
    prev.folders === next.folders
);
