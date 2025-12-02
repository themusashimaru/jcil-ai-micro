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
import PasskeyPromptModal, { usePasskeyPrompt } from '@/components/auth/PasskeyPromptModal';
import { ConnectorsModal } from '@/components/connectors/ConnectorsModal';
import type { Chat, Message, Attachment } from './types';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

/**
 * Check if a chat title is generic/low-quality and should be regenerated
 * Returns true if the title is generic like "Initial Greeting", "Hello", "New Chat", etc.
 */
function isGenericTitle(title: string | undefined): boolean {
  if (!title) return true;

  const genericPatterns = [
    /^new chat$/i,
    /^hello$/i,
    /^hi$/i,
    /^hey$/i,
    /^greeting/i,
    /^initial/i,
    /^test/i,
    /^quick question$/i,
    /^general chat$/i,
    /^untitled/i,
    /^chat$/i,
    /^conversation$/i,
  ];

  return genericPatterns.some(pattern => pattern.test(title.trim()));
}

export function ChatClient() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Start with sidebar collapsed on mobile, open on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConnectorsOpen, setIsConnectorsOpen] = useState(false);
  const [showConnectorsTip, setShowConnectorsTip] = useState(false);
  const { profile, hasProfile } = useUserProfile();
  // Passkey prompt for Face ID / Touch ID setup
  const { shouldShow: showPasskeyPrompt, dismiss: dismissPasskeyPrompt } = usePasskeyPrompt();
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  // Selected tool (only one can be selected at a time)
  const [selectedTool, setSelectedTool] = useState<'image' | 'code' | 'search' | 'data' | null>(null);
  // Header logo from design settings
  const [headerLogo, setHeaderLogo] = useState<string>('');

  // Load header logo from design settings
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Use header_logo, fall back to main_logo
          const logoUrl = settings.header_logo || settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setHeaderLogo(logoUrl);
          }
        }
      } catch (err) {
        console.error('[ChatClient] Failed to load header logo:', err);
      }
    };
    loadLogo();
  }, []);

  // Show passkey prompt modal after a short delay on first load
  useEffect(() => {
    if (showPasskeyPrompt) {
      // Wait 2 seconds after page load before showing the prompt
      const timer = setTimeout(() => {
        setIsPasskeyModalOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showPasskeyPrompt]);

  // Show connectors onboarding tooltip for new users
  useEffect(() => {
    const hasSeenTip = localStorage.getItem('connectors_tip_seen');
    if (!hasSeenTip) {
      // Wait 3 seconds after page load, then show the tooltip
      const timer = setTimeout(() => {
        setShowConnectorsTip(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissConnectorsTip = () => {
    setShowConnectorsTip(false);
    localStorage.setItem('connectors_tip_seen', 'true');
  };

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

  // Load conversations from database
  useEffect(() => {
    const loadConversations = async () => {
      try {
        console.log('[ChatClient] Loading conversations from API...');
        const response = await fetch('/api/conversations');
        console.log('[ChatClient] API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[ChatClient] Loaded conversations from DB:', {
            count: data.conversations?.length || 0,
            conversations: data.conversations,
          });

          const formattedChats: Chat[] = data.conversations.map((conv: {
            id: string;
            title: string;
            summary: string | null;
            tool_context: string | null;
            created_at: string;
            updated_at: string;
            last_message_at: string;
          }) => ({
            id: conv.id,
            title: conv.title,
            summary: conv.summary || undefined,
            isPinned: false, // TODO: Add isPinned to database schema
            lastMessage: '', // We'll update this if needed
            createdAt: new Date(conv.created_at),
            updatedAt: new Date(conv.last_message_at || conv.updated_at),
          }));
          setChats(formattedChats);
          console.log('[ChatClient] Set chats state with', formattedChats.length, 'conversations');
        } else {
          console.error('[ChatClient] Failed to load conversations:', response.statusText);
        }
      } catch (error) {
        console.error('[ChatClient] Error loading conversations:', error);
      }
    };

    loadConversations();
  }, []);

  const handleNewChat = async () => {
    // Just reset to "new chat" state - don't create in database yet
    // The chat will be created when user sends their first message
    // This prevents blank/empty chats from accumulating
    setCurrentChatId(null);
    setMessages([]);

    // Auto-close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    // Auto-close sidebar on mobile after selecting chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }

    // Load messages from API
    try {
      const response = await fetch(`/api/conversations/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages: Message[] = data.messages.map((msg: {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type: string;
          attachment_urls: string[] | null;
          created_at: string;
        }) => {
          // Check if there are any image attachments
          const imageUrl = msg.attachment_urls && msg.attachment_urls.length > 0
            ? msg.attachment_urls[0]
            : undefined;

          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            imageUrl,
            timestamp: new Date(msg.created_at),
          };
        });
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
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

  const handleDataAnalysisComplete = async (response: string, source: string, type: 'file' | 'url') => {
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

      // Create conversation in database
      try {
        const dbConversationId = await createConversationInDatabase(
          `Data Analysis: ${source}`.slice(0, 40),
          'data'
        );
        // Update to use the database-generated UUID
        if (dbConversationId && typeof dbConversationId === 'string') {
          setCurrentChatId(dbConversationId);
          setChats((prevChats) =>
            prevChats.map((chat) =>
              chat.id === newChatId ? { ...chat, id: dbConversationId } : chat
            )
          );
        }
      } catch (error) {
        console.error('Failed to create conversation for data analysis:', error);
      }

      return;
    }

    setMessages((prev) => [...prev, userMessage, analysisMessage]);

    // Generate title for conversations that still have "New Chat" as title
    let shouldGenerateTitle = false;
    setChats((prevChats) => {
      const currentChat = prevChats.find(c => c.id === currentChatId);
      shouldGenerateTitle = currentChat?.title === 'New Chat';
      return prevChats.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              lastMessage: nextLastMessage.slice(0, 60),
              updatedAt: timestamp,
            }
          : chat
      );
    });

    if (shouldGenerateTitle) {
      const generatedTitle = `Data Analysis: ${source}`.slice(0, 40);

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === currentChatId ? { ...chat, title: generatedTitle } : chat
        )
      );

      // Update title in database
      try {
        await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentChatId,
            title: generatedTitle,
          }),
        });
      } catch (titleError) {
        console.error('Title update error:', titleError);
      }
    }
  };

  /**
   * Helper to safely parse JSON response and extract error message
   */
  const safeJsonParse = async (res: Response): Promise<{
    ok: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  } | null> => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  /**
   * Helper function to save message to database
   * Supports both JSON (for text-only) and FormData (for file attachments)
   */
  const saveMessageToDatabase = async (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    contentType: 'text' | 'image' | 'code' | 'error' = 'text',
    imageUrl?: string,
    attachmentUrls?: string[]
  ) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          content_type: contentType,
          image_url: imageUrl,
          attachment_urls: attachmentUrls,
        }),
      });

      const data = await safeJsonParse(response);

      if (!response.ok || data?.ok === false) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}`;
        const errorCode = data?.error?.code || 'UNKNOWN';
        console.error(`[ChatClient] Save message failed: ${errorCode}: ${errorMsg}`);
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      console.error('Error saving message to database:', error);
      // Don't re-throw - message display still works even if save fails
    }
  };

  // Helper function to create conversation in database
  const createConversationInDatabase = async (
    title: string,
    toolContext?: string
  ) => {
    try {
      console.log('[ChatClient] Creating conversation in DB:', { title, toolContext });
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't pass id - let the API generate it, then we'll get it back
          title,
          tool_context: toolContext || 'general',
        }),
      });

      console.log('[ChatClient] Conversation API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ChatClient] Conversation creation failed:', errorData);
        throw new Error(`Failed to create conversation: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('[ChatClient] Conversation API result:', result);

      // Return the database-generated UUID (don't update state here - let caller handle it)
      if (result.conversation && result.conversation.id) {
        console.log('[ChatClient] Returning conversation ID:', result.conversation.id);
        return result.conversation.id;
      }

      throw new Error('No conversation ID returned from API');
    } catch (error) {
      console.error('[ChatClient] Error creating conversation in database:', error);
      throw error; // Re-throw to let caller handle it
    }
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    if (!content.trim() && attachments.length === 0) return;

    // Handle tool-specific requests
    if (selectedTool) {
      const toolType = selectedTool;
      setSelectedTool(null); // Clear selection

      // Auto-create chat if none exists (important for first-time tool use)
      let chatId: string;

      if (!currentChatId) {
        chatId = Date.now().toString();
        const newChat: Chat = {
          id: chatId,
          title: 'New Chat',
          isPinned: false,
          lastMessage: content.slice(0, 50),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setChats([newChat, ...chats]);
        setCurrentChatId(chatId);

        // Create conversation in database
        try {
          const dbConversationId = await createConversationInDatabase(
            'New Chat',
            toolType
          );
          // Update chatId to use the database-generated UUID
          if (dbConversationId && typeof dbConversationId === 'string') {
            chatId = dbConversationId;
            setCurrentChatId(dbConversationId);
            setChats((prevChats) =>
              prevChats.map((chat) =>
                chat.id !== dbConversationId ? chat : { ...chat, id: dbConversationId }
              )
            );
          }
        } catch (error) {
          console.error('Failed to create conversation for tool:', error);
          // Continue anyway - conversation will be created when message is saved
        }
      } else {
        chatId = currentChatId;
      }

      // Add user message to chat first
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: toolType === 'image'
          ? `🎨 Generate image: ${content}`
          : toolType === 'code'
          ? `💻 Coding help: ${content}`
          : toolType === 'search'
          ? `🔍 Search: ${content}`
          : toolType === 'data'
          ? `📊 Data analysis: ${content}`
          : content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      // Save user message to database
      await saveMessageToDatabase(chatId, 'user', content, 'text');

      if (toolType === 'image') {
        // Image generation
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: content }],
              tool: 'image',
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || errorData.error || 'Image generation failed');
          }
          const data = await response.json();

          if (data.url) {
            // Add only the assistant response with image
            const imageMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Here's your generated image based on: "${content}"`,
              imageUrl: data.url,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, imageMessage]);

            // Save assistant message to database
            await saveMessageToDatabase(
              chatId,
              'assistant',
              imageMessage.content,
              'image',
              data.url
            );

            // Generate title for conversations that still have "New Chat" as title
            let shouldGenerateTitleForImage = false;
            setChats((prevChats) => {
              const currentChatForImage = prevChats.find(c => c.id === chatId);
              shouldGenerateTitleForImage = !currentChatForImage || currentChatForImage.title === 'New Chat';
              return prevChats; // No changes, just checking
            });

            if (shouldGenerateTitleForImage) {
              try {
                const titleResponse = await fetch('/api/chat/generate-title', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userMessage: content,
                    assistantMessage: imageMessage.content,
                  }),
                });

                if (titleResponse.ok) {
                  const titleData = await titleResponse.json();
                  const generatedTitle = titleData.title || 'Image Generation';

                  // Update chat title in sidebar
                  setChats((prevChats) =>
                    prevChats.map((chat) =>
                      chat.id === chatId ? { ...chat, title: generatedTitle } : chat
                    )
                  );

                  // Update title in database
                  await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: chatId,
                      title: generatedTitle,
                    }),
                  });
                }
              } catch (titleError) {
                console.error('Title generation error:', titleError);
              }
            }
          } else {
            // Handle case where no URL was returned
            throw new Error(data.error || 'No image URL returned from API');
          }
        } catch (error) {
          console.error('Image error:', error);
          const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);

          // Save error message to database
          await saveMessageToDatabase(chatId, 'assistant', errorMsg.content, 'error');
        } finally {
          setIsStreaming(false);
        }
        return;
      } else if (toolType === 'code') {
        // Code generation
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: content }],
              tool: 'code',
            }),
          });
          if (!response.ok) throw new Error('Code generation failed');
          const data = await response.json();
          if (data.content) {
            // Add only the assistant response
            const codeMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, codeMessage]);

            // Save message to database
            await saveMessageToDatabase(chatId, 'assistant', data.content, 'code');

            // Generate title for conversations that still have "New Chat" as title
            let shouldGenerateTitle = false;
            setChats((prevChats) => {
              const currentChat = prevChats.find(c => c.id === chatId);
              shouldGenerateTitle = !currentChat || currentChat.title === 'New Chat';
              return prevChats;
            });

            if (shouldGenerateTitle) {
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
                  const generatedTitle = titleData.title || 'Code Assistant';

                  setChats((prevChats) =>
                    prevChats.map((chat) =>
                      chat.id === chatId ? { ...chat, title: generatedTitle } : chat
                    )
                  );

                  await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: chatId,
                      title: generatedTitle,
                    }),
                  });
                }
              } catch (titleError) {
                console.error('Title generation error:', titleError);
              }
            }
          }
        } catch (error) {
          console.error('Code error:', error);
          const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        } finally {
          setIsStreaming(false);
        }
        return;
      } else if (toolType === 'search') {
        // Live search
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: content }],
              tool: 'research',
            }),
          });
          if (!response.ok) throw new Error('Search failed');
          const data = await response.json();
          if (data.content) {
            // Add only the assistant response
            const searchMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, searchMessage]);

            // Save message to database
            await saveMessageToDatabase(chatId, 'assistant', data.content, 'text');

            // Generate title for conversations that still have "New Chat" as title
            let shouldGenerateTitle = false;
            setChats((prevChats) => {
              const currentChat = prevChats.find(c => c.id === chatId);
              shouldGenerateTitle = !currentChat || currentChat.title === 'New Chat';
              return prevChats;
            });

            if (shouldGenerateTitle) {
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
                  const generatedTitle = titleData.title || 'Web Search';

                  setChats((prevChats) =>
                    prevChats.map((chat) =>
                      chat.id === chatId ? { ...chat, title: generatedTitle } : chat
                    )
                  );

                  await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: chatId,
                      title: generatedTitle,
                    }),
                  });
                }
              } catch (titleError) {
                console.error('Title generation error:', titleError);
              }
            }
          }
        } catch (error) {
          console.error('Search error:', error);
          const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        } finally {
          setIsStreaming(false);
        }
        return;
      } else if (toolType === 'data') {
        // Data analysis
        if (attachments.length > 0) {
          const file = attachments[0];
          handleDataAnalysisComplete(`Analysis of ${file.name}:\n\n[Analysis results would appear here based on file type: ${file.type}]`, file.name, 'file');
        } else if (content.trim()) {
          const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?$/;
          if (urlPattern.test(content.trim())) {
            handleDataAnalysisComplete(`Analysis of URL:\n\n[Analysis results would appear here for: ${content}]`, content, 'url');
          } else {
            const errorMsg: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Please attach a file (CSV, XLSX, etc.) or paste a valid URL for data analysis.',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          }
        }
        setIsStreaming(false);
        return;
      }
    }

    let newChatId: string;

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

      // Create conversation in database
      try {
        const tempId = newChatId; // Store temp ID before reassignment
        const dbConversationId = await createConversationInDatabase('New Chat', 'general');
        console.log('[ChatClient] Created conversation:', { tempId, dbId: dbConversationId });
        // Update newChatId to use the database-generated UUID
        if (dbConversationId && typeof dbConversationId === 'string') {
          newChatId = dbConversationId;
          setCurrentChatId(dbConversationId);
          setChats((prevChats) => {
            const updated = prevChats.map((chat) =>
              chat.id === tempId ? { ...chat, id: dbConversationId } : chat
            );
            const updatedChat = updated.find(c => c.id === dbConversationId);
            console.log('[ChatClient] Updated chats array - found chat with new UUID:', updatedChat?.id, 'title:', updatedChat?.title);
            return updated;
          });
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        // Continue anyway - conversation will be created on retry
      }
    } else {
      newChatId = currentChatId;
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

    // Save user message to database
    const attachmentUrls = attachments
      .filter(att => att.url)
      .map(att => att.url!);
    await saveMessageToDatabase(
      newChatId,
      'user',
      content,
      'text',
      undefined,
      attachmentUrls.length > 0 ? attachmentUrls : undefined
    );

    try {
      // Get all messages including the new one
      const allMessages = [...messages, userMessage];

      // Find the index of the last user message with images (should be the new one)
      let lastImageMessageIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === 'user' && msg.attachments?.some(att => att.type.startsWith('image/'))) {
          lastImageMessageIndex = i;
          break;
        }
      }

      // Format messages for API, stripping images from all but the most recent image message
      // This prevents payload bloat from accumulated image history
      const apiMessages = allMessages.map((msg, index) => {
        // Check if this message has image attachments
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

        // Only include images for the most recent image message
        // Strip images from older messages to keep payload small
        if (index !== lastImageMessageIndex) {
          // Return text-only version with placeholder for stripped images
          return {
            role: msg.role,
            content: msg.content || '[User shared an image]',
          };
        }

        // Format message with images (Vercel AI SDK format)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentParts: any[] = [];

        // Add images first (Vercel AI SDK format)
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
          conversationId: newChatId, // Pass current conversation ID to exclude from history
          // No tool parameter - let users manually select tools via buttons
        }),
      });

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        // Prioritize 'details' field for debugging, then other error formats
        const errorMsg =
          (errorData as { details?: string })?.details ||
          (typeof errorData?.error === 'string' ? errorData.error : null) ||
          errorData?.error?.message ||
          (errorData as { message?: string })?.message ||
          `HTTP ${response.status}`;
        const errorCode = errorData?.error?.code || 'API_ERROR';
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      // Check content type to determine if streaming or JSON
      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');

      let finalContent = '';
      const assistantMessageId = (Date.now() + 1).toString();

      if (isJsonResponse) {
        // Non-streaming response (for images or fallback)
        const data = await response.json();
        finalContent = data.content;

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: data.content,
          citations: data.citations || [],
          sourcesUsed: data.sourcesUsed || 0,
          timestamp: new Date(),
        };

        if (data.citations?.length > 0 || data.sourcesUsed > 0) {
          console.log(`[ChatClient] Live Search: ${data.sourcesUsed} sources, ${data.citations?.length} citations`);
        }

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Streaming response - read chunks and update progressively
        // AI SDK v5 uses simple text streaming (not data stream format)
        console.log('[ChatClient] Processing streaming response (text stream)');

        // Create initial empty assistant message
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Read the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let accumulatedContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Simple text streaming - just decode and append
              const chunk = decoder.decode(value, { stream: true });
              accumulatedContent += chunk;

              // Update the message with accumulated content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
          } finally {
            reader.releaseLock();
          }

          console.log('[ChatClient] Stream finished, total length:', accumulatedContent.length);
          finalContent = accumulatedContent;
        }
      }

      setIsStreaming(false);

      // Save assistant message to database
      await saveMessageToDatabase(newChatId, 'assistant', finalContent, 'text');

      // Generate chat title for new conversations OR regenerate if current title is generic
      const isNewConversation = messages.length === 0;

      // Check if current chat has a generic title that should be regenerated
      const currentChat = chats.find(c => c.id === newChatId);
      const hasGenericTitle = currentChat && isGenericTitle(currentChat.title);
      const isMeaningfulMessage = content.length > 20; // Skip short greetings
      const shouldRegenerateTitle = hasGenericTitle && isMeaningfulMessage && messages.length > 0;

      console.log('[ChatClient] Title generation check:', {
        isNewConversation,
        messageCount: messages.length,
        newChatId,
        currentTitle: currentChat?.title,
        hasGenericTitle,
        shouldRegenerateTitle
      });

      if ((isNewConversation || shouldRegenerateTitle) && newChatId) {
        console.log('[ChatClient] STARTING title generation:', { isNewConversation, shouldRegenerateTitle });
        try {
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userMessage: content,
              assistantMessage: finalContent,
            }),
          });

          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            const generatedTitle = titleData.title || 'New Chat';
            console.log('[ChatClient] Generated title:', generatedTitle);

            // Only update if the new title is better (not generic)
            if (!isGenericTitle(generatedTitle) || isNewConversation) {
              setChats((prevChats) =>
                prevChats.map((chat) =>
                  chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
                )
              );

              await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: newChatId,
                  title: generatedTitle,
                }),
              });
            }
          }
        } catch (titleError) {
          console.error('[ChatClient] Title generation error:', titleError);
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

      // Save error message to database
      await saveMessageToDatabase(newChatId, 'assistant', errorMessage.content, 'error');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Header */}
      <header className="glass-morphism border-b border-white/10 py-0.5 px-1 md:p-3">
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
              aria-label="Toggle sidebar"
            >
              {/* Menu/Close icon */}
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
            {/* Only show logo/site name when a chat is active */}
            {currentChatId && (
              headerLogo ? (
                <img src={headerLogo} alt="JCIL.ai" className="h-8" />
              ) : (
                <h1 className="text-base md:text-xl font-semibold">
                  <span className="text-white">JCIL</span>
                  <span className="text-blue-500">.ai</span>
                </h1>
              )
            )}
          </div>

          {/* New Chat Button - Mobile Only, Centered */}
          <button
            onClick={handleNewChat}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>

          <div className="flex items-center gap-0.5">
            {/* Connectors Button with Tooltip */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsConnectorsOpen(true);
                  if (showConnectorsTip) dismissConnectorsTip();
                }}
                className="rounded-lg px-1 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center justify-center gap-0.5 focus:outline-none"
                aria-label="Connectors"
                title="Connect external services"
              >
                <svg className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span className="hidden md:inline">Connectors</span>
              </button>

              {/* Onboarding Tooltip */}
              {showConnectorsTip && (
                <div className="absolute top-full right-0 mt-2 z-50 animate-slide-down">
                  <div className="relative bg-blue-600 text-white text-sm rounded-xl px-4 py-3 shadow-lg w-[260px]">
                    {/* Arrow pointing up */}
                    <div className="absolute -top-2 right-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-blue-600" />
                    <p className="font-semibold mb-1">Add Connectors</p>
                    <p className="text-blue-100 text-xs leading-relaxed">Connect your apps for full AI capabilities</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissConnectorsTip();
                      }}
                      className="mt-3 text-xs text-blue-200 hover:text-white underline"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Profile Button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="rounded-lg px-1 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center justify-center gap-0.5 focus:outline-none"
              aria-label="User Profile"
            >
              <svg className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <main className="flex flex-1 flex-col overflow-hidden">
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
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
          />
        </main>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Connectors Modal */}
      <ConnectorsModal isOpen={isConnectorsOpen} onClose={() => setIsConnectorsOpen(false)} />

      {/* Passkey Setup Prompt Modal */}
      <PasskeyPromptModal
        isOpen={isPasskeyModalOpen}
        onClose={() => {
          setIsPasskeyModalOpen(false);
          dismissPasskeyPrompt();
        }}
        onSuccess={() => {
          setIsPasskeyModalOpen(false);
          dismissPasskeyPrompt();
        }}
      />
    </div>
  );
}
