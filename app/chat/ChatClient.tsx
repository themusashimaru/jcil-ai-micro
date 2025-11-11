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
import type { Chat, Message, Attachment } from './types';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

export function ChatClient() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
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

  const handleShopComplete = (response: string, query: string) => {
    // Add user message with shop query
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `🛒 Shop: ${query}`,
      timestamp: new Date(),
    };

    // Add assistant message with product results
    const shopMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, shopMessage]);
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
    // Auto-create chat if none exists
    if (!currentChatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: 'New Chat',
        isPinned: false,
        lastMessage: content.slice(0, 50),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats([newChat, ...chats]);
      setCurrentChatId(newChat.id);
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

      // Call API with regular chat (no auto tool selection)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
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
      <header className="glass-morphism border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded-lg p-2 hover:bg-white/10 md:hidden"
              aria-label="Toggle sidebar"
            >
              <svg
                className="h-5 w-5"
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
            <h1 className="text-xl font-semibold">Delta-2 Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationProvider />
            <button
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
              aria-label="Settings"
            >
              Settings
            </button>
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
            onShopComplete={handleShopComplete}
            isStreaming={isStreaming}
          />
        </main>
      </div>
    </div>
  );
}
