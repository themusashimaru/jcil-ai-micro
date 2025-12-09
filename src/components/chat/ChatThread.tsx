/**
 * CHAT THREAD COMPONENT
 *
 * PURPOSE:
 * - Display message thread with virtualization for performance
 * - Show streaming responses with typing indicator
 * - Display tool call badges
 * - Support message attachments
 *
 * FEATURES:
 * - Virtualized scrolling for long conversations
 * - Glassmorphism message bubbles with tails
 * - Tool execution badges (pending, running, completed, error)
 * - Image thumbnails and file attachment badges
 * - Auto-scroll to bottom on new messages
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message } from '@/app/chat/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
// REMOVED: Email and Essay tools - gpt-5-mini handles these in regular chat
// import { QuickEmailWriter } from './QuickEmailWriter';
// import { QuickResearchTool } from './QuickResearchTool'; // HIDDEN: Auto-search is now enabled for all conversations
// import { QuickEssayWriter } from './QuickEssayWriter';
import { QuickDailyDevotional } from './QuickDailyDevotional';
import { QuickBibleStudy } from './QuickBibleStudy';
// REMOVED: Breaking News - too complex, causing issues
// import { QuickBreakingNews } from './QuickBreakingNews';

/**
 * Typewriter hook - animates text character by character
 */
function useTypewriter(text: string, speed: number = 40, delay: number = 0, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, enabled]);

  return { displayedText, isComplete };
}

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
  isAdmin?: boolean;
  onSubmitPrompt?: (prompt: string) => void;
}

export function ChatThread({ messages, isStreaming, currentChatId, isAdmin, onSubmitPrompt }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const { profile, hasProfile } = useUserProfile();
  const { theme } = useTheme();

  // Load design settings from database API
  const [mainLogo, setMainLogo] = useState<string>('');
  const [lightModeLogo, setLightModeLogo] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('Faith-based AI tools for your everyday needs');
  const [modelName, setModelName] = useState<string>('');
  const [isLogoLoading, setIsLogoLoading] = useState<boolean>(true);

  // Typewriter animation for welcome screen
  const showWelcome = !currentChatId || messages.length === 0;
  const typewriterEnabled = showWelcome && !isLogoLoading;

  // First line: model name (if exists) or subtitle
  const firstLineText = modelName || '';
  const { displayedText: firstLineDisplayed, isComplete: firstLineDone } = useTypewriter(
    firstLineText,
    25, // speed (ms per character) - faster
    200, // delay before starting
    typewriterEnabled && !!modelName
  );

  // Second line: subtitle (starts after first line OR immediately if no model name)
  const { displayedText: subtitleDisplayed, isComplete: subtitleDone } = useTypewriter(
    subtitle,
    20, // faster
    modelName ? 0 : 200, // if no model name, add initial delay
    typewriterEnabled && (firstLineDone || !modelName)
  );

  // Third line: "Start a new chat..." (starts after subtitle)
  const thirdLineText = 'Start a new chat or select an existing conversation';
  const { displayedText: thirdLineDisplayed } = useTypewriter(
    thirdLineText,
    15, // fastest
    100,
    typewriterEnabled && subtitleDone && !currentChatId
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Use main_logo from database
          const logoUrl = settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setMainLogo(logoUrl);
          }
          // Load light mode logo
          if (settings.light_mode_logo) {
            setLightModeLogo(settings.light_mode_logo);
          }
          if (settings.subtitle) {
            setSubtitle(settings.subtitle);
          }
          if (settings.model_name) {
            setModelName(settings.model_name);
          }
        }
      } catch (error) {
        console.error('[ChatThread] Failed to load design settings:', error);
      } finally {
        setIsLogoLoading(false);
      }
    };

    loadSettings();

    // Listen for settings updates
    const handleUpdate = () => loadSettings();
    window.addEventListener('design-settings-updated', handleUpdate);
    return () => window.removeEventListener('design-settings-updated', handleUpdate);
  }, []);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    // Using a small delay to let the DOM update first
    setTimeout(() => {
      // Always scroll to show latest message at bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Show logo and tools when no chat is selected OR when chat is empty
  if (!currentChatId || messages.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center p-4 chat-bg-orbs">
        <div className="text-center relative z-10 mt-8">
          {/* JCIL.ai Logo */}
          <div className="mb-0">
            {/* Logo - Dynamically loaded from database (supports images and videos) */}
            {/* In light mode: always show text "jcil.ai" instead of logo */}
            {isLogoLoading ? (
              // Show placeholder while loading to prevent flash
              <div className="h-36 md:h-72 w-auto mx-auto mb-1" />
            ) : theme === 'light' ? (
              // Light mode: Use light mode logo if uploaded, otherwise show text
              lightModeLogo ? (
                <img
                  src={lightModeLogo}
                  alt="JCIL.ai"
                  className="h-36 md:h-72 w-auto mx-auto mb-1"
                />
              ) : (
                <h1 className="text-6xl md:text-8xl font-normal mb-1">
                  <span style={{ color: 'var(--text-primary)' }}>jcil.</span>
                  <span style={{ color: 'var(--primary)' }}>ai</span>
                </h1>
              )
            ) : mainLogo ? (
              // Check if logo is a video (MP4 or WebM)
              mainLogo.startsWith('data:video/') ? (
                <video
                  src={mainLogo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-36 md:h-72 w-auto mx-auto mb-2"
                />
              ) : (
                <img
                  src={mainLogo}
                  alt="JCIL.ai"
                  className="h-36 md:h-72 w-auto mx-auto mb-2"
                />
              )
            ) : (
              <h1 className="text-6xl md:text-8xl font-bold mb-2">
                <span className="text-white">JCIL</span>
                <span className="text-blue-500">.ai</span>
              </h1>
            )}
            {modelName && (
              <p className="text-sm md:text-xl font-medium mb-1 min-h-[1.5em]" style={{ color: 'var(--text-primary)' }}>
                {firstLineDisplayed}
                {!firstLineDone && firstLineDisplayed && (
                  <span className="animate-pulse" style={{ color: 'var(--primary)' }}>|</span>
                )}
              </p>
            )}
            <p className="text-xs md:text-sm italic min-h-[1.25em]" style={{ color: 'var(--text-primary)' }}>
              {subtitleDisplayed}
              {!subtitleDone && subtitleDisplayed && (
                <span className="animate-pulse" style={{ color: 'var(--primary)' }}>|</span>
              )}
            </p>
          </div>

          {/* Personalized greeting if profile exists */}
          {hasProfile && currentChatId && (
            <p className="mb-1 text-xs md:text-lg" style={{ color: 'var(--text-primary)' }}>
              Hi {profile.name}! How can I help you today?
            </p>
          )}

          {!currentChatId && (
            <p className="mb-2 text-xs md:text-sm min-h-[1.25em]" style={{ color: 'var(--text-primary)' }}>
              {thirdLineDisplayed}
              {subtitleDone && thirdLineDisplayed && thirdLineDisplayed !== thirdLineText && (
                <span className="animate-pulse" style={{ color: 'var(--primary)' }}>|</span>
              )}
            </p>
          )}

          {/* Bible Tools */}
          <div className="flex justify-center gap-1 mb-1 mt-2">
            <QuickDailyDevotional />
            <QuickBibleStudy onSubmitPrompt={onSubmitPrompt} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 md:px-4 chat-bg-orbs"
    >
      {/* Third animated orb (purple) */}
      <div className="chat-bg-orb-tertiary" />

      <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl space-y-3 md:space-y-4 pt-16 pb-8 relative z-10">

        {messages.map((message, index) => {
          // Check if this is the last user message
          const isLastUserMessage = index === messages.length - 1 && message.role === 'user';
          // Add entrance animation to recent messages
          const isRecentMessage = index >= messages.length - 2;

          return (
            <div
              key={message.id}
              ref={isLastUserMessage ? lastUserMessageRef : null}
              className={isRecentMessage ? 'message-enter' : ''}
            >
              <MessageBubble
                message={message}
                isLast={index === messages.length - 1}
                isAdmin={isAdmin}
              />
            </div>
          );
        })}

        {/* Professional typing indicator */}
        {isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
