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
 * - Folder organization with colors
 * - Create/edit/delete folders
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Chat, ChatFolder } from '@/app/chat/types';
import InboxButton from '@/components/inbox/InboxButton';
import MyFilesPanel from '@/components/documents/MyFilesPanel';

// Strategy session type
interface StrategySession {
  session_id: string;
  phase: 'intake' | 'executing' | 'complete' | 'cancelled' | 'error';
  started_at: string;
  completed_at?: string;
  problem_summary?: string;
  total_agents: number;
  completed_agents: number;
  total_searches: number;
  total_cost: number;
  isActive?: boolean;
}

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  collapsed: boolean;
  loadError?: string | null;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
  onPinChat: (chatId: string) => void;
  onMoveToFolder: (
    chatId: string,
    folderId: string | null,
    folderData?: { id: string; name: string; color: string | null }
  ) => void;
  onSelectStrategySession?: (sessionId: string) => void;
}

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

export function ChatSidebar({
  chats,
  currentChatId,
  collapsed,
  loadError,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onPinChat,
  onMoveToFolder,
  onSelectStrategySession,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Folder state
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ChatFolder | null>(null);
  const [folderForm, setFolderForm] = useState({ name: '', color: '' });
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);

  // Strategy sessions state
  const [strategySessions, setStrategySessions] = useState<StrategySession[]>([]);
  const [strategyCollapsed, setStrategyCollapsed] = useState(false);

  // Fetch folders on mount
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch('/api/folders');
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[ChatSidebar] Error fetching folders:', error);
    }
  }, []);

  // Fetch strategy sessions (admin only)
  const fetchStrategySessions = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch('/api/strategy');
      if (response.ok) {
        const data = await response.json();
        setStrategySessions(data.sessions || []);
      }
    } catch (error) {
      console.error('[ChatSidebar] Error fetching strategy sessions:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (isAdmin) {
      fetchStrategySessions();
    }
  }, [isAdmin, fetchStrategySessions]);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/user/is-admin');
        if (response.ok) {
          const data = await response.json();
          // API returns { ok: true, data: { isAdmin: boolean } }
          setIsAdmin(data.data?.isAdmin === true);
        }
      } catch (error) {
        console.error('[ChatSidebar] Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
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
    if (searchQuery) {
      filtered = filtered.filter(
        (chat) =>
          chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [chats, searchQuery]);

  // Group chats by folder
  const { pinnedChats, folderGroups, unorganizedChats } = useMemo(() => {
    const pinned = filteredChats.filter((c) => c.isPinned);
    const unorganized = filteredChats.filter((c) => !c.isPinned && !c.folder);

    // Group by folder
    const groups: Record<string, { folder: ChatFolder; chats: Chat[] }> = {};
    folders.forEach((folder) => {
      groups[folder.id] = { folder, chats: [] };
    });

    filteredChats
      .filter((c) => !c.isPinned && c.folder)
      .forEach((chat) => {
        if (chat.folder && groups[chat.folder.id]) {
          groups[chat.folder.id].chats.push(chat);
        }
      });

    return {
      pinnedChats: pinned,
      folderGroups: Object.values(groups), // Show all folders, even empty ones
      unorganizedChats: unorganized,
    };
  }, [filteredChats, folders]);

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

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Folder CRUD
  const handleCreateFolder = async () => {
    if (!folderForm.name.trim()) return;
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderForm.name.trim(), color: folderForm.color || null }),
      });
      if (response.ok) {
        await fetchFolders();
        setShowFolderModal(false);
        setFolderForm({ name: '', color: '' });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('[ChatSidebar] Error creating folder:', error);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderForm.name.trim()) return;
    try {
      const response = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderForm.name.trim(), color: folderForm.color || null }),
      });
      if (response.ok) {
        await fetchFolders();
        setEditingFolder(null);
        setShowFolderModal(false);
        setFolderForm({ name: '', color: '' });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update folder');
      }
    } catch (error) {
      console.error('[ChatSidebar] Error updating folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Chats will be moved to Recent.')) return;
    try {
      const response = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchFolders();
        setFolderMenuId(null);
      }
    } catch (error) {
      console.error('[ChatSidebar] Error deleting folder:', error);
    }
  };

  const openEditFolder = (folder: ChatFolder) => {
    setEditingFolder(folder);
    setFolderForm({ name: folder.name, color: folder.color || '' });
    setShowFolderModal(true);
    setFolderMenuId(null);
  };

  const ChatItem = ({ chat }: { chat: Chat }) => {
    const isActive = chat.id === currentChatId;
    const isEditing = chat.id === editingId;
    const menuOpen = activeMenu === chat.id;
    const moveMenuOpen = showMoveMenu === chat.id;

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
              style={{
                backgroundColor: 'var(--glass-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              autoFocus
            />
          </div>
        ) : (
          <>
            <button onClick={() => onSelectChat(chat.id)} className="w-full p-3 text-left">
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
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {chat.title}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(menuOpen ? null : chat.id);
                    setShowMoveMenu(null);
                  }}
                  className="rounded p-1 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
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
                <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                  {chat.summary}
                </p>
              )}
            </button>

            {/* Context Menu */}
            {menuOpen && (
              <div
                className="absolute right-2 top-12 z-20 w-48 rounded-lg py-1 shadow-xl"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <button
                  onClick={() => handleStartEdit(chat)}
                  className="w-full px-4 py-2 text-left text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    onPinChat(chat.id);
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {chat.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveMenu(moveMenuOpen ? null : chat.id);
                  }}
                  className="w-full px-4 py-2 text-left text-sm flex items-center justify-between"
                  style={{ color: 'var(--text-primary)' }}
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
                    className="py-1"
                    style={{ borderTop: '1px solid var(--border)', marginTop: '4px' }}
                  >
                    {chat.folder && (
                      <button
                        onClick={() => {
                          onMoveToFolder(chat.id, null);
                          setActiveMenu(null);
                          setShowMoveMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm pl-6"
                        style={{ color: 'var(--text-muted)' }}
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
                          setActiveMenu(null);
                          setShowMoveMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 pl-6"
                        style={{ color: 'var(--text-primary)' }}
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
                        className="px-4 py-2 text-sm pl-6"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        No folders yet
                      </div>
                    )}
                  </div>
                )}
                <hr style={{ borderColor: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    if (confirm('Delete this chat?')) {
                      onDeleteChat(chat.id);
                    }
                    setActiveMenu(null);
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
  };

  const FolderSection = ({ folder, folderChats }: { folder: ChatFolder; folderChats: Chat[] }) => {
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
          <div className="mt-1 space-y-1 pl-2">
            {folderChats.map((chat) => (
              <ChatItem key={chat.id} chat={chat} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onNewChat}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          glass-morphism fixed md:relative inset-y-0 left-0 z-50
          transform transition-all duration-300 ease-in-out
          ${collapsed ? '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-0' : 'translate-x-0 w-72 md:w-80'}
        `}
        style={{ borderRight: collapsed ? 'none' : '1px solid var(--border)' }}
      >
        <div
          className={`flex h-full flex-col ${collapsed ? 'md:hidden' : ''}`}
          style={{ minWidth: '288px' }}
        >
          {/* My Files - Available to all users */}
          <MyFilesPanel />

          {/* Header */}
          <div
            className="p-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Chats
            </h2>
            <div className="flex items-center gap-2">
              <InboxButton />
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
                className="rounded-lg p-1.5 transition-colors md:hidden"
                style={{ color: 'var(--text-primary)' }}
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

          {/* New Chat & New Folder */}
          <div className="p-3 flex gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={onNewChat}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition new-chat-btn"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              + New Chat
            </button>
            <button
              onClick={() => {
                setEditingFolder(null);
                setFolderForm({ name: '', color: '' });
                setShowFolderModal(true);
              }}
              className="rounded-lg px-3 py-2.5 text-sm transition"
              style={{
                backgroundColor: 'var(--glass-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              title="New Folder"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
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
            {pinnedChats.length > 0 && (
              <div className="mb-4">
                <h3
                  className="mb-2 px-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Pinned
                </h3>
                <div className="space-y-1">
                  {pinnedChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} />
                  ))}
                </div>
              </div>
            )}

            {folderGroups.length > 0 && (
              <div className="mb-4">
                {folderGroups.map(({ folder, chats: folderChats }) => (
                  <FolderSection key={folder.id} folder={folder} folderChats={folderChats} />
                ))}
              </div>
            )}

            {/* Strategy Sessions (Admin Only) */}
            {isAdmin && strategySessions.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setStrategyCollapsed(!strategyCollapsed)}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-lg"
                  style={{ backgroundColor: 'var(--glass-bg)' }}
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${strategyCollapsed ? '' : 'rotate-90'}`}
                    style={{ color: 'var(--text-muted)' }}
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
                  <svg
                    className="w-3.5 h-3.5 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <span
                    className="text-xs font-semibold uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Strategy Sessions
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                    ({strategySessions.length})
                  </span>
                </button>
                {!strategyCollapsed && (
                  <div className="mt-1 space-y-1">
                    {strategySessions.map((session) => (
                      <button
                        key={session.session_id}
                        onClick={() => onSelectStrategySession?.(session.session_id)}
                        className="w-full p-2 text-left rounded-lg hover:bg-gray-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          {session.phase === 'complete' ? (
                            <svg
                              className="w-4 h-4 text-green-400 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : session.phase === 'executing' || session.isActive ? (
                            <svg
                              className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          ) : session.phase === 'error' ? (
                            <svg
                              className="w-4 h-4 text-red-400 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-gray-400 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {session.problem_summary || 'Strategy Session'}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {session.total_searches} searches
                              {session.total_cost > 0 && ` • $${session.total_cost.toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {unorganizedChats.length > 0 && (
              <div>
                <h3
                  className="mb-2 px-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Recent
                </h3>
                <div className="space-y-1">
                  {unorganizedChats.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} />
                  ))}
                </div>
              </div>
            )}

            {filteredChats.length === 0 && (
              <div className="flex h-full items-center justify-center p-4">
                {loadError ? (
                  <div className="text-center">
                    <svg
                      className="w-8 h-8 mx-auto mb-2"
                      style={{ color: 'var(--text-muted)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {loadError}
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-2 text-xs underline hover:opacity-80"
                      style={{ color: 'var(--primary)' }}
                    >
                      Refresh page
                    </button>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {searchQuery ? 'No chats found' : 'No chats yet'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
            {/* Code Lab (Admin only) */}
            {isAdmin && (
              <button
                onClick={() => (window.location.href = '/code-lab')}
                className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Code Lab</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => (window.location.href = '/admin')}
                className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
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
              onClick={() => (window.location.href = '/settings')}
              className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
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
              className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 disabled:opacity-50"
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

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowFolderModal(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingFolder ? 'Edit Folder' : 'New Folder'}
            </h3>
            <input
              type="text"
              placeholder="Folder name"
              value={folderForm.name}
              onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
              maxLength={50}
              className="w-full rounded-lg px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Color (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFolderForm({ ...folderForm, color: '' })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${!folderForm.color ? 'border-white ring-2 ring-white/50' : 'border-transparent hover:border-gray-400'}`}
                  style={{ backgroundColor: 'var(--glass-bg)' }}
                >
                  {!folderForm.color && (
                    <svg
                      className="w-4 h-4"
                      style={{ color: 'var(--text-muted)' }}
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
                    onClick={() => setFolderForm({ ...folderForm, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${folderForm.color === color ? 'border-white ring-2 ring-white/50 scale-110' : 'border-transparent hover:border-gray-400 hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
              >
                {editingFolder ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
