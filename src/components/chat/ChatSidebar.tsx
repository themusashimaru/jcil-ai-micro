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

import { useState, useMemo, useEffect } from 'react';
import type { Chat } from '@/app/chat/types';
import InboxButton from '@/components/inbox/InboxButton';

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
  onOpenCodeCommand?: () => void; // Admin-only Code Command
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
  onOpenCodeCommand,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/user/is-admin');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        console.error('[ChatSidebar] Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  // Logout handler
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      console.log('[ChatSidebar] Calling logout API...');
      // Call the API route to handle logout with proper cookie management
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      console.log('[ChatSidebar] Logout successful, redirecting...');
      // Force a hard redirect to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('[ChatSidebar] Logout error:', error);
      setIsLoggingOut(false);
      alert('Failed to logout. Please try again.');
    }
  };

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
        className="group relative rounded-lg"
        style={{ backgroundColor: isActive ? 'var(--glass-bg)' : 'transparent' }}
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
              className="w-full rounded px-2 py-1 text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              autoFocus
            />
          </div>
        ) : (
          <>
            <button
              onClick={() => onSelectChat(chat.id)}
              className="w-full p-3 text-left"
            >
              {/* Title row: title + three-dots aligned */}
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
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{chat.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(menuOpen ? null : chat.id);
                  }}
                  className="rounded p-1 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
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
              {/* Summary and folder below title */}
              {chat.summary && (
                <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>{chat.summary}</p>
              )}
              {chat.folder && (
                <span className="mt-1 inline-block rounded px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-secondary)' }}>
                  {chat.folder}
                </span>
              )}
            </button>

            {/* Context Menu */}
            {menuOpen && (
              <div
                className="absolute right-2 top-12 z-10 w-48 rounded-lg py-1 shadow-xl"
                style={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
                }}
              >
                <button
                  onClick={() => handleStartEdit(chat)}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    onPinChat(chat.id);
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Move to folder
                </button>
                <hr style={{ borderColor: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    if (confirm('Delete this chat?')) {
                      onDeleteChat(chat.id);
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
          onClick={onNewChat}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          glass-morphism
          fixed md:relative
          inset-y-0 left-0 z-50
          transform transition-all duration-300 ease-in-out
          ${collapsed ? '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-0' : 'translate-x-0 w-72 md:w-80'}
        `}
        style={{ borderRight: collapsed ? 'none' : '1px solid var(--border)' }}
      >
        <div className={`flex h-full flex-col ${collapsed ? 'md:hidden' : ''}`} style={{ minWidth: '288px' }}>
        {/* Code Command Button - Admin Only */}
        {isAdmin && onOpenCodeCommand && (
          <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={onOpenCodeCommand}
              className="code-cmd-btn-glass w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                {/* Code icon */}
                <svg className="w-5 h-5 text-white code-cmd-title" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <div>
                  <div className="text-sm font-semibold text-white code-cmd-title">
                    Code Command
                  </div>
                  <div className="text-xs text-blue-200 code-cmd-subtitle">
                    GPT-5.1 · Advanced coding
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Sidebar Header with Inbox and Close Button */}
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Chats</h2>
          <div className="flex items-center gap-2">
            {/* Inbox Button */}
            <InboxButton />
            {/* Close Sidebar Button - Mobile Only */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
              className="rounded-lg p-1.5 transition-colors md:hidden"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNewChat();
            }}
            className="sidebar-btn-glass w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition relative z-10 cursor-pointer"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--background)', pointerEvents: 'auto' }}
          >
            + New Chat
          </button>
        </div>

        {/* Search */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative">
            <svg
              className="absolute left-3 top-2.5 h-4 w-4"
              style={{ color: 'var(--text-muted)' }}
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
              className="w-full rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Pinned Section */}
          {pinnedChats.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
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
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
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
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
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
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Admin Panel Button - Only shown to admins */}
          {isAdmin && (
            <button
              onClick={() => window.location.href = '/admin'}
              className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Admin Panel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Admin Panel</span>
            </button>
          )}
          <button
            onClick={() => window.location.href = '/settings'}
            className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Settings"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Settings</span>
          </button>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Logout"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
