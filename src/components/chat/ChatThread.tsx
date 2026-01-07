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
import { MessageErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
// REMOVED: Various tools - gpt-5-mini handles these in regular chat

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
  documentType?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | null;
  onReply?: (message: Message) => void;
  enableCodeActions?: boolean;
  lastUserMessage?: string; // For intelligent status messages
  onQuickPrompt?: (prompt: string) => void; // For quick prompt templates
}

// Quick prompt templates shown on empty chat
const QUICK_PROMPTS = [
  {
    icon: '💡',
    label: 'Explain a concept',
    prompt: 'Explain to me like I\'m 5: ',
  },
  {
    icon: '📝',
    label: 'Help me write',
    prompt: 'Help me write ',
  },
  {
    icon: '🔍',
    label: 'Research a topic',
    prompt: 'Research and summarize: ',
  },
  {
    icon: '🙏',
    label: 'Biblical guidance',
    prompt: 'What does the Bible say about ',
  },
];

export function ChatThread({ messages, isStreaming, currentChatId, isAdmin, documentType, onReply, enableCodeActions, lastUserMessage, onQuickPrompt }: ChatThreadProps) {
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    // Using a small delay to let the DOM update first
    const scrollToBottom = () => {
      // Use scrollIntoView with block: 'end' to ensure consistent behavior across themes
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    // Initial scroll with short delay
    const initialTimeout = setTimeout(scrollToBottom, 50);

    // Secondary scroll to catch any late DOM updates (e.g., images loading)
    const secondaryTimeout = setTimeout(scrollToBottom, 300);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondaryTimeout);
    };
  }, [messages, messages.length]);

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

          {/* Quick Prompt Templates - Claude-inspired starter prompts */}
          {onQuickPrompt && (
            <div className="mt-6 grid grid-cols-2 gap-2 max-w-md mx-auto px-4">
              {QUICK_PROMPTS.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onQuickPrompt(item.prompt)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    backgroundColor: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          )}

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
              <MessageErrorBoundary>
                <MessageBubble
                  message={message}
                  isLast={index === messages.length - 1}
                  isAdmin={isAdmin}
                  onReply={onReply}
                  enableCodeActions={enableCodeActions}
                />
              </MessageErrorBoundary>
            </div>
          );
        })}

        {/* Intelligent typing indicator with contextual messages */}
        {isStreaming && <TypingIndicator documentType={documentType} userMessage={lastUserMessage} />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
