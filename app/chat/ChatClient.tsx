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

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    if (!currentChatId) return;

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
      // Call streaming API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Text delta from Vercel AI SDK stream format
            const content = line.slice(2).replace(/^"(.*)"$/, '$1');
            if (content) {
              accumulatedContent += content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
          }
        }
      }

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
            isStreaming={isStreaming}
          />
        </main>
      </div>
    </div>
  );
}
