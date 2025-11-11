/**
 * CHAT SIDEBAR COMPONENT
 *
 * PURPOSE:
 * - Display chat history with search and filtering
 * - Support rename, delete, pin, folder organization
 * - Auto-title and summary display
 * - Mobile-responsive collapsible sidebar
 *
 * FEATURES:
 * - Search chats by title/content
 * - Context menu for chat actions
 * - Pinned chats section
 * - Folder organization
 * - Virtualized list for performance
 */

'use client';

import { useState, useMemo } from 'react';
import type { Chat } from '@/app/chat/types';

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  collapsed: boolean;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
  onPinChat: (chatId: string) => void;
  onMoveToFolder: (chatId: string, folder: string | undefined) => void;
}

export function ChatSidebar({
  chats,
  currentChatId,
  collapsed,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onPinChat,
  onMoveToFolder,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Filter and sort chats
  const filteredChats = useMemo(() => {
    let filtered = chats;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (chat) =>
          chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort: pinned first, then by updated date
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [chats, searchQuery]);

  // Group by folders
  const { pinnedChats, folderChats, unorganizedChats } = useMemo(() => {
    const pinned = filteredChats.filter((c) => c.isPinned);
    const withFolder = filteredChats.filter((c) => !c.isPinned && c.folder);
    const unorganized = filteredChats.filter((c) => !c.isPinned && !c.folder);

    return {
      pinnedChats: pinned,
      folderChats: withFolder,
      unorganizedChats: unorganized,
    };
  }, [filteredChats]);

  const handleStartEdit = (chat: Chat) => {
    setEditingId(chat.id);
    setEditTitle(chat.title);
    setActiveMenu(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRenameChat(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const ChatItem = ({ chat }: { chat: Chat }) => {
    const isActive = chat.id === currentChatId;
    const isEditing = chat.id === editingId;
    const menuOpen = activeMenu === chat.id;

    return (
      <div
        className={`group relative rounded-lg ${
          isActive ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
      >
        {isEditing ? (
          <div className="p-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              onBlur={handleSaveEdit}
              className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              autoFocus
            />
          </div>
        ) : (
          <>
            <button
              onClick={() => onSelectChat(chat.id)}
              className="w-full p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    {chat.isPinned && (
                      <svg
                        className="h-3 w-3 flex-shrink-0 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 3l2.5 6.5L19 10l-6.5 .5L10 17l-2.5-6.5L1 10l6.5-.5L10 3z" />
                      </svg>
                    )}
                    <span className="truncate text-sm font-medium">{chat.title}</span>
                  </div>
                  {chat.summary && (
                    <p className="mt-1 truncate text-xs text-gray-400">{chat.summary}</p>
                  )}
                  {chat.folder && (
                    <span className="mt-1 inline-block rounded bg-white/10 px-2 py-0.5 text-xs text-gray-300">
                      {chat.folder}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(menuOpen ? null : chat.id);
                  }}
                  className="rounded p-1 opacity-0 hover:bg-white/10 group-hover:opacity-100"
                  aria-label="Chat options"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
            </button>

            {/* Context Menu */}
            {menuOpen && (
              <div className="absolute right-2 top-12 z-10 w-48 rounded-lg border border-white/10 bg-black/90 py-1 shadow-xl backdrop-blur-lg">
                <button
                  onClick={() => handleStartEdit(chat)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    onPinChat(chat.id);
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                >
                  {chat.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => {
                    const folder = prompt('Enter folder name:');
                    if (folder !== null) {
                      onMoveToFolder(chat.id, folder || undefined);
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                >
                  Move to folder
                </button>
                <hr className="my-1 border-white/10" />
                <button
                  onClick={() => {
                    if (confirm('Delete this chat?')) {
                      onDeleteChat(chat.id);
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setActiveMenu(null)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          glass-morphism border-r border-white/10
          fixed md:relative
          inset-y-0 left-0 z-50
          w-80 md:w-80
          transform transition-transform duration-300 ease-in-out
          ${collapsed ? '-translate-x-full md:translate-x-0 md:w-0 md:border-0' : 'translate-x-0'}
        `}
      >
        <div className="flex h-full flex-col">
        {/* New Chat Button */}
        <div className="border-b border-white/10 p-4">
          <button
            onClick={onNewChat}
            className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
          >
            + New Chat
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/10 p-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Pinned Section */}
          {pinnedChats.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
                Pinned
              </h3>
              <div className="space-y-1">
                {pinnedChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} />
                ))}
              </div>
            </div>
          )}

          {/* Folders Section */}
          {folderChats.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
                Folders
              </h3>
              <div className="space-y-1">
                {folderChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} />
                ))}
              </div>
            </div>
          )}

          {/* Recent Chats */}
          {unorganizedChats.length > 0 && (
            <div>
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
                Recent
              </h3>
              <div className="space-y-1">
                {unorganizedChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredChats.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
