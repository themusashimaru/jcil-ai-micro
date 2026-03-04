/**
 * CHAT HEADER COMPONENT
 *
 * Top navigation bar with sidebar toggle, logo, connectors link,
 * new chat button (mobile), theme toggle, and profile button.
 */

'use client';

import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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
  headerLogo,
  hasProfile,
  profileName,
  onToggleSidebar,
  onNewChat,
  onOpenProfile,
}: ChatHeaderProps) {
  const { theme } = useTheme();

  return (
    <header className="glass-morphism border-b border-white/10 py-0.5 px-1 md:p-3" role="banner">
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
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
          <a
            href="/settings?tab=connectors"
            className="flex rounded-lg px-1.5 md:px-3 py-1 md:py-1.5 text-sm hover:bg-white/10 items-center gap-1 transition-colors"
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
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold">
              NEW
            </span>
          </a>

          {/* Logo / site name (only when chat active) */}
          {currentChatId &&
            (theme === 'light' ? (
              <h1 className="text-base md:text-xl font-normal hidden sm:block">
                <span className="text-text-primary">jcil.</span>
                <span className="text-primary">ai</span>
              </h1>
            ) : headerLogo ? (
              <Image
                src={headerLogo}
                alt="JCIL.ai"
                width={120}
                height={32}
                className="h-8 w-auto hidden sm:block"
              />
            ) : (
              <h1 className="text-base md:text-xl font-semibold hidden sm:block">
                <span className="text-white">JCIL</span>
                <span className="text-blue-500">.ai</span>
              </h1>
            ))}
        </div>

        {/* New Chat Button - Mobile Only, Centered */}
        <button
          onClick={onNewChat}
          className="absolute left-1/2 -translate-x-1/2 md:hidden rounded-full p-1.5 hover:bg-white/10 transition-colors flex items-center justify-center"
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
          <ThemeToggle />

          {/* Profile Button */}
          <button
            onClick={onOpenProfile}
            className="rounded-lg px-1 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center justify-center gap-0.5 focus:outline-none"
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
            {hasProfile ? profileName : 'Profile'}
          </button>
        </div>
      </div>
    </header>
  );
}
