'use client';

import { Counts, CATEGORY_LABELS, STATUS_LABELS } from './types';

interface InboxSidebarProps {
  counts: Counts | null;
  currentFilter: string;
  currentCategory: string | null;
  currentStatus: string | null;
  currentSource: string | null;
  isAllFilter: boolean;
  showMobileSidebar: boolean;
  setFilter: (filter: string, value?: string) => void;
  setShowMobileSidebar: (show: boolean) => void;
}

export function InboxSidebar({
  counts,
  currentFilter,
  currentCategory,
  currentStatus,
  currentSource,
  isAllFilter,
  showMobileSidebar,
  setFilter,
  setShowMobileSidebar,
}: InboxSidebarProps) {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${showMobileSidebar ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:block'}
          w-64 rounded-xl p-4 overflow-y-auto bg-glass border border-theme
        `}
      >
        <div className="lg:hidden flex justify-between items-center mb-4">
          <h2 className="font-bold">Filters</h2>
          <button onClick={() => setShowMobileSidebar(false)} className="text-text-muted">
            X
          </button>
        </div>

        {/* Main Filters */}
        <div className="space-y-1 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left transition ${isAllFilter ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
          >
            <span>All Messages</span>
            <span className="text-sm text-text-muted">{counts?.all || 0}</span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left transition ${currentFilter === 'unread' ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
          >
            <span>Unread</span>
            <span className="text-sm bg-red-500 text-white px-2 rounded-full">
              {counts?.unread || 0}
            </span>
          </button>
          <button
            onClick={() => setFilter('starred')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left transition ${currentFilter === 'starred' ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
          >
            <span>Starred</span>
            <span className="text-sm text-text-muted">{counts?.starred || 0}</span>
          </button>
        </div>

        {/* By Source */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase mb-2 text-text-muted">Source</h3>
          <div className="space-y-1">
            <button
              onClick={() => setFilter('source', 'internal')}
              className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm transition ${currentSource === 'internal' ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
            >
              <span>Internal (Users)</span>
              <span className="text-text-muted">{counts?.bySource.internal || 0}</span>
            </button>
            <button
              onClick={() => setFilter('source', 'external')}
              className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm transition ${currentSource === 'external' ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
            >
              <span>External (Contact)</span>
              <span className="text-text-muted">{counts?.bySource.external || 0}</span>
            </button>
          </div>
        </div>

        {/* By Category */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase mb-2 text-text-muted">Category</h3>
          <div className="space-y-1">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter('category', key)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm transition ${currentCategory === key ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
              >
                <span>{label}</span>
                <span className="text-text-muted">{counts?.byCategory[key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* By Status */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase mb-2 text-text-muted">Status</h3>
          <div className="space-y-1">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter('status', key)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm transition ${currentStatus === key ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
              >
                <span>{label}</span>
                <span className="text-text-muted">{counts?.byStatus[key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Archived */}
        <button
          onClick={() => setFilter('archived')}
          className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left transition ${currentFilter === 'archived' ? 'bg-primary text-white' : 'bg-transparent text-text-primary'}`}
        >
          <span>Archived</span>
          <span className="text-sm text-text-muted">{counts?.archived || 0}</span>
        </button>
      </div>
    </>
  );
}
