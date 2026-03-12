/**
 * CHAT INITIALIZATION HOOK
 *
 * Handles all startup effects: logo loading, admin check, provider fetch,
 * sidebar resize, passkey prompt, first-run, cleanup, ref syncing.
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import type { ChatState } from './useChatState';

const log = logger('ChatClient');

export function useChatInit(state: ChatState) {
  const {
    setHeaderLogo,
    showPasskeyPrompt,
    setIsPasskeyModalOpen,
    hasProfile,
    setShowFirstRun,
    setIsAdmin,
    setSidebarCollapsed,
    abortControllerRef,
    pollingIntervalRef,
    isMountedRef,
    currentChatId,
    currentChatIdRef,
    messages,
    messagesRef,
    isStreaming,
    isStreamingRef,
  } = state;

  // Load header logo from design settings
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          const logoUrl = settings.header_logo || settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setHeaderLogo(logoUrl);
          }
        }
      } catch (err) {
        log.error('Failed to load header logo:', err as Error);
      }
    };
    loadLogo();
  }, [setHeaderLogo]);

  // Show passkey prompt modal after a short delay on first load
  useEffect(() => {
    if (showPasskeyPrompt) {
      const timer = setTimeout(() => {
        setIsPasskeyModalOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showPasskeyPrompt, setIsPasskeyModalOpen]);

  // First-run onboarding check
  useEffect(() => {
    if (localStorage.getItem('jcil-first-run-completed') === 'true') return;

    const checkFirstRun = async () => {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const data = await response.json();
          if (!data.settings?.first_run_completed) {
            setShowFirstRun(true);
          } else {
            localStorage.setItem('jcil-first-run-completed', 'true');
          }
        }
      } catch {
        if (!hasProfile) {
          setShowFirstRun(true);
        }
      }
    };
    checkFirstRun();
  }, [hasProfile, setShowFirstRun]);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/user/is-admin');
        if (response.ok) {
          const responseData = await response.json();
          const data = responseData.data || responseData;
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        log.error('Error checking admin status:', error as Error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [setIsAdmin]);

  // Detect screen size and set initial sidebar state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(false);
      }
    };

    const handleToggleSidebar = () => {
      setSidebarCollapsed((prev) => !prev);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, [setSidebarCollapsed]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isMountedRef, abortControllerRef, pollingIntervalRef]);

  // Sync refs with state (avoids stale closures in event handlers)
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId, currentChatIdRef]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages, messagesRef]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming, isStreamingRef]);

  // Memory optimization: Strip base64 image data from older messages
  const MAX_MESSAGES_WITH_IMAGES = 10;
  useEffect(() => {
    if (messages.length > MAX_MESSAGES_WITH_IMAGES) {
      const cutoffIndex = messages.length - MAX_MESSAGES_WITH_IMAGES;
      let needsUpdate = false;

      for (let i = 0; i < cutoffIndex; i++) {
        if (messages[i].imageUrl?.startsWith('data:')) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        state.setMessages((prev) =>
          prev.map((msg, index) => {
            if (index >= cutoffIndex) return msg;
            if (msg.imageUrl?.startsWith('data:')) {
              return { ...msg, imageUrl: undefined };
            }
            return msg;
          })
        );
        log.debug('Cleared base64 images from old messages to save memory');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only depend on length
  }, [messages.length]);
}
