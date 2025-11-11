/**
 * CHAT CLIENT COMPONENT
 *
 * PURPOSE:
 * - Client-side chat interface with state management
 * - Handles user interactions, message sending, file uploads
 * - Manages sidebar state, search, and chat organization
 *
 * FEATURES:
 * - Sidebar: search, rename, delete, pin, folders
 * - Virtualized thread list
 * - Composer with file attachments
 * - Streaming message UI with tool badges
 *
 * STATE:
 * - chats: Array of chat conversations
 * - messages: Current thread messages
 * - isStreaming: Streaming state
 * - attachments: File attachments
 */

'use client';

import { useState, useEffect } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import { useUserProfile } from '@/contexts/UserProfileContext';
import type { Chat, Message, Attachment } from './types';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

export function ChatClient() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Start with sidebar collapsed on mobile, open on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { profile, hasProfile } = useUserProfile();

  // Detect screen size and set initial sidebar state
  useEffect(() => {
    const handleResize = () => {
      // Auto-open sidebar on desktop (≥768px), keep closed on mobile
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(false);
      }
    };

    // Handle toggle sidebar event from sidebar close button
    const handleToggleSidebar = () => {
      setSidebarCollapsed(prev => !prev);
    };

    // Set initial state
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  // Mock data for development
  useEffect(() => {
    // TODO: Fetch real chats from API
    setChats([
      {
        id: '1',
        title: 'Welcome to Delta-2',
        summary: 'Getting started with AI chat',
        isPinned: true,
        lastMessage: 'Hello! How can I help you today?',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: '2',
        title: 'Email Draft Help',
        folder: 'Work',
        isPinned: false,
        lastMessage: 'I can help you write professional emails',
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(Date.now() - 7200000),
      },
    ]);
  }, []);

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      isPinned: false,
      lastMessage: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);
    setMessages([]);
    // Auto-close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    // Auto-close sidebar on mobile after selecting chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
    // TODO: Load messages from API
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        timestamp: new Date(),
      },
    ]);
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(chats.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat)));
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(chats.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }
  };

  const handlePinChat = (chatId: string) => {
    setChats(
      chats.map((chat) => (chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat))
    );
  };

  const handleMoveToFolder = (chatId: string, folder: string | undefined) => {
    setChats(chats.map((chat) => (chat.id === chatId ? { ...chat, folder } : chat)));
  };

  const handleImageGenerated = (imageUrl: string, prompt: string) => {
    // Add user message with prompt
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Generate image: ${prompt}`,
      timestamp: new Date(),
    };

    // Add assistant message with generated image
    const imageMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Here's your generated image based on: "${prompt}"`,
      imageUrl,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, imageMessage]);
  };

  const handleCodeGenerated = (response: string, request: string) => {
    // Add user message with request
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: request,
      timestamp: new Date(),
    };

    // Add assistant message with code response
    const codeMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, codeMessage]);
  };

  const handleSearchComplete = (response: string, query: string) => {
    // Add user message with search query
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Search: ${query}`,
      timestamp: new Date(),
    };

    // Add assistant message with search results
    const searchMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, searchMessage]);
  };

  const handleDataAnalysisComplete = (response: string, source: string, type: 'file' | 'url') => {
    const timestamp = new Date();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `📊 Data Analysis: ${type === 'file' ? source : 'URL'}`,
      timestamp,
    };

    const analysisMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp,
    };

    const nextLastMessage = `📊 Analysis: ${source.slice(0, 40)}`;

    if (!currentChatId) {
      const newChatId = Date.now().toString();
      const newChat: Chat = {
        id: newChatId,
        title: `Data Analysis: ${source}`.slice(0, 40),
        isPinned: false,
        lastMessage: nextLastMessage.slice(0, 60),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setChats((prevChats) => [newChat, ...prevChats]);
      setCurrentChatId(newChatId);
      setMessages([userMessage, analysisMessage]);
      return;
    }

    setMessages((prev) => [...prev, userMessage, analysisMessage]);
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              lastMessage: nextLastMessage.slice(0, 60),
              updatedAt: timestamp,
            }
          : chat
      )
    );
  };

  // Check if query needs live search and provide a helpful message
  const needsLiveSearch = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();

    // Patterns that indicate live search is needed
    const liveSearchPatterns = [
      /what('s| is) (the )?(current )?time/i,
      /what time is it/i,
      /what('s| is) (today'?s?|the) date/i,
      /what day is it/i,
      /current (time|date)/i,
      /today'?s? (date|time)/i,
      /weather (in|at|for)/i,
      /what('s| is) the weather/i,
      /latest news/i,
      /recent (news|events)/i,
      /stock price/i,
      /current (price|value)/i,
      /happening (now|today)/i,
    ];

    // Check for live search patterns
    for (const pattern of liveSearchPatterns) {
      if (pattern.test(lowerQuery)) {
        return "For real-time information like current time, date, weather, or latest news, please use the **Live Search** button below to get accurate, up-to-date results.";
      }
    }

    return null;
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    // Track if this is a new chat (for title generation)
    const isNewChat = !currentChatId;
    let newChatId = currentChatId;

    // Auto-create chat if none exists
    if (!currentChatId) {
      newChatId = Date.now().toString();
      const newChat: Chat = {
        id: newChatId,
        title: 'New Chat',
        isPinned: false,
        lastMessage: content.slice(0, 50),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats([newChat, ...chats]);
      setCurrentChatId(newChatId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setIsStreaming(true);

    try {
      // Format messages for API (handle text + image attachments)
      const apiMessages = [...messages, userMessage].map((msg) => {
        // Check if message has image attachments
        const imageAttachments = msg.attachments?.filter(
          (att) => att.type.startsWith('image/') && att.thumbnail
        );

        // If no images, send simple text message
        if (!imageAttachments || imageAttachments.length === 0) {
          return {
            role: msg.role,
            content: msg.content,
          };
        }

        // Format message with images (Vercel AI SDK format)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentParts: any[] = [];

        // Add images first (AI SDK format)
        imageAttachments.forEach((image) => {
          contentParts.push({
            type: 'image',
            image: image.thumbnail, // Base64 data URL
          });
        });

        // Add text content
        if (msg.content) {
          contentParts.push({
            type: 'text',
            text: msg.content,
          });
        }

        return {
          role: msg.role,
          content: contentParts,
        };
      });

      // Check if query needs live search
      const liveSearchMessage = needsLiveSearch(content);

      if (liveSearchMessage) {
        // Provide helpful message about using Live Search button
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: liveSearchMessage,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsStreaming(false);
        return;
      }

      // Build user context for personalization
      const userContext = hasProfile
        ? {
            name: profile.name,
            role: profile.isStudent ? 'student' : 'professional',
            field: profile.jobTitle,
            purpose: profile.description,
          }
        : undefined;

      // Call API with regular chat (no auto tool selection)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          userContext,
          // No tool parameter - let users manually select tools via buttons
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.details || response.statusText}`);
      }

      // Parse JSON response (non-streaming)
      const data = await response.json();

      // Create assistant message with the response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(false);

      // Generate chat title for new chats
      if (isNewChat && newChatId) {
        try {
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userMessage: content,
              assistantMessage: data.content,
            }),
          });

          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            const generatedTitle = titleData.title || 'New Chat';

            // Update chat title
            setChats((prevChats) =>
              prevChats.map((chat) =>
                chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
              )
            );
          }
        } catch (titleError) {
          console.error('Title generation error:', titleError);
          // Continue silently if title generation fails
        }
      }
    } catch (error) {
      console.error('Chat API error:', error);

      // Show error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console and Vercel logs.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Header */}
      <header className="glass-morphism border-b border-white/10 py-0.5 px-1 md:p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
              aria-label="Toggle sidebar"
            >
              {/* Menu/Close icon */}
              <svg
                className="h-4 w-4 md:h-5 md:w-5"
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
            <h1 className="text-base md:text-xl font-semibold">JCIL.ai</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="rounded-lg px-1.5 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center gap-1"
              aria-label="User Profile"
            >
              <svg className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {hasProfile ? profile.name : 'Profile'}
            </button>
            <NotificationProvider />
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          collapsed={sidebarCollapsed}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          onPinChat={handlePinChat}
          onMoveToFolder={handleMoveToFolder}
        />

        {/* Chat thread area */}
        <main className="flex flex-1 flex-col">
          <ChatThread
            messages={messages}
            isStreaming={isStreaming}
            currentChatId={currentChatId}
          />
          <ChatComposer
            onSendMessage={handleSendMessage}
            onImageGenerated={handleImageGenerated}
            onCodeGenerated={handleCodeGenerated}
            onSearchComplete={handleSearchComplete}
            onDataAnalysisComplete={handleDataAnalysisComplete}
            isStreaming={isStreaming}
          />
        </main>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
