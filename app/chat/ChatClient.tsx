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
  // Selected tool (only one can be selected at a time)
  const [selectedTool, setSelectedTool] = useState<'image' | 'code' | 'search' | 'data' | null>(null);

  // Load design settings from localStorage
  const [siteName, setSiteName] = useState<string>('JCIL.ai');
  const [headerLogo, setHeaderLogo] = useState<string>('');

  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('admin_design_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.siteName) setSiteName(settings.siteName);
          if (settings.headerLogo) setHeaderLogo(settings.headerLogo);
        }
      } catch (error) {
        console.error('Failed to load design settings:', error);
      }
    };

    loadSettings();

    // Listen for settings updates
    window.addEventListener('design-settings-updated', loadSettings);
    return () => window.removeEventListener('design-settings-updated', loadSettings);
  }, []);

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
          }) => ({
            id: conv.id,
            title: conv.title,
            summary: conv.summary || undefined,
            isPinned: false, // TODO: Add isPinned to database schema
            lastMessage: '', // We'll update this if needed
            createdAt: new Date(conv.created_at),
            updatedAt: new Date(conv.updated_at),
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
    const newChatId = Date.now().toString();
    const newChat: Chat = {
      id: newChatId,
      title: 'New Chat',
      isPinned: false,
      lastMessage: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChatId);
    setMessages([]);

    // Create conversation in database immediately
    try {
      const dbConversationId = await createConversationInDatabase('New Chat', 'general');
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
      console.error('Failed to create conversation:', error);
      // Keep the local chat even if DB creation fails
      // The conversation will be created when first message is sent
    }

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

  // Helper function to save message to database
  const saveMessageToDatabase = async (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    contentType: 'text' | 'image' | 'code' | 'error' = 'text',
    imageUrl?: string,
    attachmentUrls?: string[]
  ) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
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
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
  };

  // Helper function to create conversation in database
  const createConversationInDatabase = async (
    title: string,
    toolContext?: string
  ) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't pass id - let the API generate it, then we'll get it back
          title,
          tool_context: toolContext || 'general',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create conversation: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();

      // Return the database-generated UUID (don't update state here - let caller handle it)
      if (result.conversation && result.conversation.id) {
        return result.conversation.id;
      }

      throw new Error('No conversation ID returned from API');
    } catch (error) {
      console.error('Error creating conversation in database:', error);
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
            console.log('[ChatClient] Updated chats array with UUID:', updated[0]?.id);
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
          conversationId: newChatId, // Pass current conversation ID to exclude from history
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

      // Save assistant message to database
      await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');

      // Generate chat title for new conversations (check state with updater to get latest)
      let shouldGenerateTitle = false;
      setChats((prevChats) => {
        console.log('[ChatClient] Checking if title needed for ID:', newChatId);
        console.log('[ChatClient] Available chat IDs:', prevChats.map(c => c.id));
        const currentChat = prevChats.find(c => c.id === newChatId);
        shouldGenerateTitle = !currentChat || currentChat.title === 'New Chat';
        console.log('[ChatClient] Should generate title?', { shouldGenerateTitle, chatFound: !!currentChat, currentTitle: currentChat?.title });
        return prevChats; // No changes, just checking
      });

      if (shouldGenerateTitle && newChatId) {
        console.log('[ChatClient] STARTING title generation for chat ID:', newChatId);
        try {
          console.log('[ChatClient] Calling /api/chat/generate-title with:', { userMessage: content, assistantMessage: data.content?.slice(0, 100) });
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userMessage: content,
              assistantMessage: data.content,
            }),
          });

          console.log('[ChatClient] Title API response status:', titleResponse.status);

          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            const generatedTitle = titleData.title || 'New Chat';
            console.log('[ChatClient] Generated title:', generatedTitle, 'for chat ID:', newChatId);

            // Update chat title in sidebar
            setChats((prevChats) =>
              prevChats.map((chat) =>
                chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
              )
            );

            // Update title in database
            console.log('[ChatClient] Updating title in DB with ID:', newChatId);
            const updateResponse = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: newChatId,
                title: generatedTitle,
              }),
            });
            const updateResult = await updateResponse.json();
            console.log('[ChatClient] Title update result:', updateResult);
          } else {
            const errorData = await titleResponse.json();
            console.error('[ChatClient] Title generation failed:', titleResponse.status, errorData);
          }
        } catch (titleError) {
          console.error('[ChatClient] Title generation error:', titleError);
          if (titleError instanceof Error) {
            console.error('[ChatClient] Error details:', titleError.message, titleError.stack);
          }
        }
      } else {
        console.log('[ChatClient] Skipping title generation:', { shouldGenerateTitle, newChatId });
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
              <>
                {headerLogo ? (
                  <img
                    src={headerLogo}
                    alt={siteName}
                    className="h-6 md:h-8 w-auto"
                  />
                ) : (
                  <h1 className="text-base md:text-xl font-semibold">{siteName}</h1>
                )}
              </>
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
            <button
              onClick={() => setIsProfileOpen(true)}
              className="rounded-lg px-1 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center gap-0.5"
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
    </div>
  );
}
