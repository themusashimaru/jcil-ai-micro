/**
 * CHAT HEADER COMPONENT
 *
 * Top navigation bar with sidebar toggle, logo, connectors link,
 * new chat button (mobile), and profile button.
 */

'use client';

import Link from 'next/link';
import { ScrambleTextOnHover } from '@/app/components/landing-v2/ScrambleText';

interface ChatHeaderProps {
  currentChatId: string | null;
  headerLogo: string;
  hasProfile: boolean;
  profileName: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenProfile: () => void;
}

export function ChatHeader({
  currentChatId,
  hasProfile,
  profileName,
  onToggleSidebar,
  onNewChat,
  onOpenProfile,
}: ChatHeaderProps) {
  return (
    <header
      className="border-b py-0.5 px-1 md:p-3 bg-background border-border"
      role="banner"
    >
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 hover:opacity-70 transition-opacity"
            aria-label="Toggle sidebar"
          >
            <svg
              className="h-5 w-5 md:h-6 md:w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Connectors Link */}
          <Link
            href="/settings?tab=connectors"
            className="flex px-1.5 md:px-3 py-1 md:py-1.5 items-center gap-1 transition-all font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent"
            title="Connect 150+ apps"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="text-[9px] font-mono uppercase tracking-widest border border-accent/30 px-1.5 py-0.5 text-accent">
              NEW
            </span>
          </Link>

          {/* Logo / site name (only when chat active) */}
          {currentChatId && (
            <h1 className="font-bebas text-lg md:text-xl tracking-tight hidden sm:block text-foreground">
              JCIL<span className="text-accent">.AI</span>
            </h1>
          )}
        </div>

        {/* New Chat Button - Mobile Only, Centered */}
        <button
          onClick={onNewChat}
          className="absolute left-1/2 -translate-x-1/2 md:hidden p-1.5 hover:opacity-70 transition-opacity flex items-center justify-center"
          aria-label="New chat"
          title="Start new chat"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="flex items-center gap-0.5">
          {/* Profile Button */}
          <button
            onClick={onOpenProfile}
            className="px-1 py-0.5 md:px-3 md:py-1.5 flex items-center justify-center gap-0.5 focus:outline-none transition-all font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            aria-label="User Profile"
          >
            <svg
              className="h-3 w-3 md:h-4 md:w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <ScrambleTextOnHover
              text={hasProfile ? profileName : 'Profile'}
              className="inline"
              duration={0.3}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
