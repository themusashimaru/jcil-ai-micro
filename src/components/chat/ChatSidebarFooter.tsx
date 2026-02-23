/**
 * CHAT SIDEBAR FOOTER
 *
 * PURPOSE:
 * - Render the bottom action buttons: Code Lab, Admin Panel, Settings, Logout
 * - Code Lab and Admin Panel are admin-only
 *
 * Extracted from ChatSidebar.tsx to reduce component size.
 */

'use client';

export interface ChatSidebarFooterProps {
  isAdmin: boolean;
  isLoggingOut: boolean;
  handleLogout: () => void;
}

export function ChatSidebarFooter({ isAdmin, isLoggingOut, handleLogout }: ChatSidebarFooterProps) {
  return (
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
  );
}
