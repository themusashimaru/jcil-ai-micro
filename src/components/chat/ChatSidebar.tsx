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
import { CodeLabLazyList } from '@/components/code-lab/CodeLabVirtualizedList';
import { ChatItem } from './ChatSidebarItem';
import { ChatSidebarFolderModal } from './ChatSidebarFolderModal';
import { ChatSidebarFolderSection } from './ChatSidebarFolderSection';
import { ChatSidebarAgentSessions } from './ChatSidebarAgentSessions';
import { ChatSidebarFooter } from './ChatSidebarFooter';

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

  // Fetch agent sessions (admin only)
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

  const handleStartEdit = useCallback((chat: Chat) => {
    setEditingId(chat.id);
    setEditTitle(chat.title);
    setActiveMenu(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    setEditingId((prevId) => {
      setEditTitle((prevTitle) => {
        if (prevId && prevTitle.trim()) {
          onRenameChat(prevId, prevTitle.trim());
        }
        return '';
      });
      return null;
    });
  }, [onRenameChat]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleToggleMenu = useCallback((chatId: string) => {
    setActiveMenu((prev) => (prev === chatId ? null : chatId));
    setShowMoveMenu(null);
  }, []);

  const handleToggleMoveMenu = useCallback((chatId: string) => {
    setShowMoveMenu((prev) => (prev === chatId ? null : chatId));
  }, []);

  const handleCloseMenus = useCallback(() => {
    setActiveMenu(null);
    setShowMoveMenu(null);
  }, []);

  const handleEditTitleChange = useCallback((title: string) => {
    setEditTitle(title);
  }, []);

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

  // Helper to render a memoized ChatItem with current sidebar state
  const renderChatItem = useCallback(
    (chat: Chat) => (
      <ChatItem
        key={chat.id}
        chat={chat}
        isActive={chat.id === currentChatId}
        isEditing={chat.id === editingId}
        editTitle={editTitle}
        menuOpen={activeMenu === chat.id}
        moveMenuOpen={showMoveMenu === chat.id}
        folders={folders}
        onSelect={onSelectChat}
        onToggleMenu={handleToggleMenu}
        onToggleMoveMenu={handleToggleMoveMenu}
        onCloseMenus={handleCloseMenus}
        onStartEdit={handleStartEdit}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onEditTitleChange={handleEditTitleChange}
        onPin={onPinChat}
        onDelete={onDeleteChat}
        onMoveToFolder={onMoveToFolder}
      />
    ),
    [
      currentChatId,
      editingId,
      editTitle,
      activeMenu,
      showMoveMenu,
      folders,
      onSelectChat,
      handleToggleMenu,
      handleToggleMoveMenu,
      handleCloseMenus,
      handleStartEdit,
      handleSaveEdit,
      handleCancelEdit,
      handleEditTitleChange,
      onPinChat,
      onDeleteChat,
      onMoveToFolder,
    ]
  );

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
        role="navigation"
        aria-label="Chat history"
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
                <div className="space-y-1" role="list" aria-label="Pinned chats">
                  {pinnedChats.map((chat) => renderChatItem(chat))}
                </div>
              </div>
            )}

            {folderGroups.length > 0 && (
              <div className="mb-4">
                {folderGroups.map(({ folder, chats: folderChats }) => (
                  <ChatSidebarFolderSection
                    key={folder.id}
                    folder={folder}
                    folderChats={folderChats}
                    collapsedFolders={collapsedFolders}
                    folderMenuId={folderMenuId}
                    toggleFolderCollapse={toggleFolderCollapse}
                    setFolderMenuId={setFolderMenuId}
                    openEditFolder={openEditFolder}
                    handleDeleteFolder={handleDeleteFolder}
                    renderChatItem={renderChatItem}
                  />
                ))}
              </div>
            )}

            {/* Agent Sessions (Admin Only) */}
            {isAdmin && (
              <ChatSidebarAgentSessions
                strategySessions={strategySessions}
                strategyCollapsed={strategyCollapsed}
                setStrategyCollapsed={setStrategyCollapsed}
                onSelectStrategySession={onSelectStrategySession}
              />
            )}

            {unorganizedChats.length > 0 && (
              <div>
                <h3
                  className="mb-2 px-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Recent
                </h3>
                {/* PERF-001: Virtualize large chat lists for 1000+ conversations */}
                <CodeLabLazyList
                  items={unorganizedChats}
                  keyExtractor={(chat) => chat.id}
                  renderItem={(chat) => <div className="mb-1">{renderChatItem(chat)}</div>}
                  threshold={100}
                />
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
          <ChatSidebarFooter
            isAdmin={isAdmin}
            isLoggingOut={isLoggingOut}
            handleLogout={handleLogout}
          />
        </div>
      </aside>

      {/* Folder Modal */}
      {showFolderModal && (
        <ChatSidebarFolderModal
          editingFolder={editingFolder}
          folderForm={folderForm}
          onFormChange={setFolderForm}
          onClose={() => setShowFolderModal(false)}
          onSave={editingFolder ? handleUpdateFolder : handleCreateFolder}
        />
      )}
    </>
  );
}
