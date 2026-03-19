'use client';

import { logger } from '@/lib/logger';
import { parseSlashCommand } from '@/lib/slashCommands';
import { analyzeResponse, isConfirmation, isDecline } from '@/lib/response-analysis';
// Agent mode imports removed — agent system deprecated
import type { SearchMode } from '@/components/chat/ChatComposer';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';
import type { Message, ToolCall } from './types';
import { extractCitationsFromText } from './types';
import { detectDocumentTypeFromMessage, isGenericTitle, formatMessagesForApi } from './chatUtils';
import { saveMessageToDatabase, createConversationInDatabase, safeJsonParse } from './chatApi';
import { processDocumentMarkers } from './documentMarkers';
import type { ChatState } from './useChatState';
import { useDeviceInfo } from '@/hooks/useDeviceInfo';

const log = logger('ChatClient');

// ── Chat messaging constants ──
/** Max messages before triggering continuation prompt */
const HARD_CONTEXT_LIMIT = 45;
/** Max chars to show from a quoted reply */
const REPLY_QUOTE_MAX_CHARS = 200;
/** Timeout before aborting a chat request (ms) */
const CHAT_TIMEOUT_MS = 180_000;
/** Delay before showing "slow response" warning (ms) */
const SLOW_RESPONSE_WARNING_MS = 30_000;
/** Delay before retrying after continuation (ms) */
const CONTINUATION_RETRY_DELAY_MS = 500;

interface UseChatMessagingArgs {
  state: ChatState;
  handleChatContinuation: () => Promise<void>;
}

export function useChatMessaging({ state, handleChatContinuation }: UseChatMessagingArgs) {
  const {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    continuationDismissed,
    setContinuationDismissed,
    replyingTo,
    setReplyingTo,
    setPendingDocumentType,
    pendingToolSuggestion,
    setPendingToolSuggestion,
    abortControllerRef,
    isMountedRef,
    currentChatIdRef,
    profile,
    hasProfile,
  } = state;

  const deviceInfo = useDeviceInfo();

  const handleSendMessage = async (
    content: string,
    attachments: import('./types').Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => {
    if (!content.trim() && attachments.length === 0) return;
    if (isStreaming) return;

    if (messages.length >= HARD_CONTEXT_LIMIT && !continuationDismissed) {
      try {
        await handleChatContinuation();
        setContinuationDismissed(true);
        setTimeout(
          () => handleSendMessage(content, attachments, searchMode, selectedRepo),
          CONTINUATION_RETRY_DELAY_MS
        );
      } catch (err) {
        log.error('Chat continuation failed', err instanceof Error ? err : undefined);
        setContinuationDismissed(true);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'This conversation has reached its limit and I was unable to continue automatically. Please start a new chat to continue.',
            timestamp: new Date(),
          },
        ]);
      }
      return;
    }

    // Slash commands
    const parsed = parseSlashCommand(content);
    if (parsed.isCommand) {
      if (parsed.helpText) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: parsed.helpText!,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (parsed.prompt) content = parsed.prompt;
    }

    // Agent mode intake/steering removed — agent system deprecated

    // Tool suggestion confirmation
    let contentForAI = content;
    if (pendingToolSuggestion) {
      if (isConfirmation(content)) {
        if (pendingToolSuggestion.action === 'search') searchMode = 'search';
        else if (pendingToolSuggestion.action === 'factcheck') searchMode = 'factcheck';
        if (pendingToolSuggestion.originalQuestion)
          contentForAI = pendingToolSuggestion.originalQuestion;
        setPendingToolSuggestion(null);
      } else if (isDecline(content)) {
        setPendingToolSuggestion(null);
      } else {
        setPendingToolSuggestion(null);
      }
    }

    setIsStreaming(true);

    // Auto-create chat if none exists
    let newChatId: string;
    if (!currentChatId) {
      const tempId = crypto.randomUUID();
      setChats([
        {
          id: tempId,
          title: 'New Chat',
          isPinned: false,
          lastMessage: content.slice(0, 50),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ...chats,
      ]);
      setCurrentChatId(tempId);
      currentChatIdRef.current = tempId;

      try {
        const dbConversationId = await createConversationInDatabase('New Chat', 'general');
        if (!dbConversationId || typeof dbConversationId !== 'string')
          throw new Error('Invalid conversation ID');
        newChatId = dbConversationId;
        setCurrentChatId(dbConversationId);
        currentChatIdRef.current = dbConversationId;
        setChats((prev) =>
          prev.map((chat) => (chat.id === tempId ? { ...chat, id: dbConversationId } : chat))
        );
      } catch {
        setChats((prev) => prev.filter((c) => c.id !== tempId));
        setCurrentChatId(null);
        setIsStreaming(false);
        return;
      }
    } else {
      newChatId = currentChatId;
    }

    // Reply context
    let finalContent = content;
    if (replyingTo) {
      const quoted =
        replyingTo.content.length > REPLY_QUOTE_MAX_CHARS
          ? replyingTo.content.slice(0, REPLY_QUOTE_MAX_CHARS) + '...'
          : replyingTo.content;
      finalContent = `[Replying to: "${quoted}"]\n\n${content}`;
      setReplyingTo(null);
    }

    const userMessageId = crypto.randomUUID();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: finalContent,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
    };
    const attachmentUrls = attachments.filter((att) => att.url).map((att) => att.url!);

    // Save user message to database FIRST
    try {
      await saveMessageToDatabase(
        newChatId,
        'user',
        finalContent,
        'text',
        undefined,
        attachmentUrls.length > 0 ? attachmentUrls : undefined
      );
      setMessages((prev) => [...prev, userMessage]);
      const detectedDocType = detectDocumentTypeFromMessage(content);
      setPendingDocumentType(detectedDocType);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Sorry, your message could not be sent. Please check your connection and try again.',
          timestamp: new Date(),
        },
      ]);
      setIsStreaming(false);
      return;
    }

    let streamFinalContent = '';
    try {
      // Format messages for API (handle images, documents, etc.)
      const allMessages = [...messages, userMessage];
      if (contentForAI !== content) {
        allMessages[allMessages.length - 1] = {
          ...allMessages[allMessages.length - 1],
          content: contentForAI,
        };
      }

      // Format messages for API (handles images, documents, plain text)
      const apiMessages = formatMessagesForApi(allMessages);

      const userContext = hasProfile
        ? {
            name: profile.name,
            role: profile.isStudent ? 'student' : 'professional',
            field: profile.jobTitle,
            purpose: profile.description,
          }
        : undefined;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      // Timeout: show a warning at 30s, abort at 3 minutes
      const slowWarningId = setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && msg.isStreaming && !msg.content
              ? { ...msg, content: '_Taking longer than usual... still working on your request._' }
              : msg
          )
        );
        log.info('Response taking longer than expected', { chatId: newChatId });
      }, SLOW_RESPONSE_WARNING_MS);

      const chatTimeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          // Show explicit timeout message to user
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content:
                'The request timed out after 3 minutes. This can happen with complex queries. Please try again, or try breaking your request into smaller parts.',
              timestamp: new Date(),
            },
          ]);
          setIsStreaming(false);
        }
      }, CHAT_TIMEOUT_MS);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          userContext,
          conversationId: newChatId,
          searchMode: searchMode || 'none',
          selectedRepo: selectedRepo || undefined,
          provider: 'claude',
          deviceInfo,
          thinking: { enabled: true, budgetTokens: 10000 },
        }),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(chatTimeoutId);
      clearTimeout(slowWarningId);
      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = errorData as any;
        const serverMessage =
          parsed?.message ||
          (typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message) ||
          `HTTP ${response.status}`;
        throw new Error(serverMessage);
      }

      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const modelUsed = response.headers.get('X-Model-Used') || undefined;
      const searchProvider = response.headers.get('X-Web-Search') || undefined;
      const assistantMessageId = crypto.randomUUID();
      let isImageResponse = false;

      if (isJsonResponse) {
        const data = await response.json();
        if (data.type === 'image' && data.url) {
          isImageResponse = true;
          const msg: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: `Here's your generated image based on: "${data.prompt || content}"`,
            imageUrl: data.url,
            model: data.model || modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
          streamFinalContent = msg.content;
          await saveMessageToDatabase(newChatId, 'assistant', msg.content, 'image', data.url);
        } else if (data.type === 'image_generation' && data.generatedImage) {
          isImageResponse = true;
          const msg: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || "I've created this image for you.",
            generatedImage: data.generatedImage as import('./types').GeneratedImage,
            model: data.generatedImage.model || modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
          streamFinalContent = msg.content;
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            msg.content,
            'image',
            data.generatedImage.imageUrl
          );
        } else if (data.type === 'code_preview' && data.codePreview) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your generated code:',
              model: data.model || modelUsed,
              codePreview: data.codePreview,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'multi_page_website' && data.multiPageWebsite) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your multi-page website:',
              model: data.model || modelUsed,
              multiPageWebsite: data.multiPageWebsite,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'video_job' && data.video_job) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || '',
              model: data.model || modelUsed,
              videoJob: data.video_job,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'analytics' && data.analytics) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your data analysis:',
              model: data.model || modelUsed,
              analytics: data.analytics,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else {
          let messageContent = data.content || '';
          if (data.documentDownload?.url) {
            const format = (data.documentDownload.format || 'file').toUpperCase();
            messageContent += `\n\n✅ **Your ${format} is ready!**\n\n📄 **[Download ${format}](${data.documentDownload.url})**\n\n*Link expires in 1 hour.*`;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: messageContent,
              citations: data.citations || [],
              sourcesUsed: data.sourcesUsed || 0,
              model: data.model || modelUsed,
              searchProvider,
              files: data.files,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = messageContent;
        }
      } else {
        // Streaming response (text or SSE)
        const isSSE = contentType.includes('text/event-stream');

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: isSSE ? '🚀 Generating...' : '',
            model: modelUsed,
            timestamp: new Date(),
          },
        ]);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let accumulatedContent = '';
          const activeToolCalls: ToolCall[] = [];
          try {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });

              if (isSSE) {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;
                  try {
                    const event = JSON.parse(data);
                    if (currentChatIdRef.current === newChatId) {
                      if (event.type === 'progress') {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId ? { ...msg, content: event.message } : msg
                          )
                        );
                      } else if (event.type === 'code_preview' && event.codePreview) {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? {
                                  ...msg,
                                  content: event.content || 'Here is your website:',
                                  codePreview: event.codePreview,
                                }
                              : msg
                          )
                        );
                        streamFinalContent = event.content;
                        await saveMessageToDatabase(
                          newChatId,
                          'assistant',
                          event.content || 'Generated website',
                          'text'
                        );
                      } else if (event.type === 'error') {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? { ...msg, content: `❌ Error: ${event.message}` }
                              : msg
                          )
                        );
                      }
                    }
                  } catch (sseErr) {
                    log.debug('SSE event parse error (may be partial data)', {
                      error: sseErr instanceof Error ? sseErr.message : String(sseErr),
                    });
                  }
                }
              } else {
                accumulatedContent += chunk;

                // Parse tool activity markers from stream
                const toolStartMatches = accumulatedContent.matchAll(/<!--TOOL_START:([^>]+)-->/g);
                for (const match of toolStartMatches) {
                  const toolName = match[1];
                  if (!activeToolCalls.find((t) => t.name === toolName && t.status === 'running')) {
                    activeToolCalls.push({
                      id: `tool-${toolName}-${Date.now()}`,
                      name: toolName,
                      status: 'running',
                    });
                  }
                }
                const toolResultMatches = accumulatedContent.matchAll(
                  /<!--TOOL_RESULT:([^:]+):(success|error)-->/g
                );
                for (const match of toolResultMatches) {
                  const toolName = match[1];
                  const status = match[2] === 'success' ? 'completed' : 'error';
                  const existing = activeToolCalls.find(
                    (t) => t.name === toolName && t.status === 'running'
                  );
                  if (existing) {
                    existing.status = status;
                  }
                }

                if (currentChatIdRef.current === newChatId) {
                  // Keep thinking tags in the content — MessageBubble renders
                  // them as a live-streaming thinking block (DeepSeek-style).
                  // Only strip non-display markers (DONE, followups, tool markers).
                  const displayContent = accumulatedContent
                    .replace(/\n?\[DONE]\n?/g, '')
                    .replace(/\n?<!--TOOL_START:[^>]+-->/g, '')
                    .replace(/\n?<!--TOOL_RESULT:[^>]+-->/g, '')
                    .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/g, '')
                    .replace(/<suggested-followups>[\s\S]*$/g, '')
                    .trimEnd();
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: displayContent,
                            isStreaming: true,
                            toolCalls:
                              activeToolCalls.length > 0 ? [...activeToolCalls] : undefined,
                          }
                        : msg
                    )
                  );
                }
              }
            }
          } catch (readerError) {
            if (accumulatedContent.length > 0) {
              // Stream was interrupted but we have partial content — show it
              // with truncation notice so user knows it was cut off
              streamFinalContent = accumulatedContent
                .replace(/\n?\[DONE]\n?/g, '')
                .replace(/\n?<!--TOOL_START:[^>]+-->/g, '')
                .replace(/\n?<!--TOOL_RESULT:[^>]+-->/g, '')
                .trimEnd();
              streamFinalContent +=
                '\n\n---\n*Response was interrupted. You can ask me to continue.*';
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: streamFinalContent, isStreaming: false }
                    : msg
                )
              );
            } else throw readerError;
          } finally {
            reader.releaseLock();
          }
          if (!streamFinalContent && accumulatedContent) {
            streamFinalContent = accumulatedContent
              .replace(/\n?\[DONE]\n?/g, '')
              .replace(/\n?<!--TOOL_START:[^>]+-->/g, '')
              .replace(/\n?<!--TOOL_RESULT:[^>]+-->/g, '')
              .trimEnd();
          }
        }
      }

      // Post-processing: document markers, follow-ups, citations, title
      if (streamFinalContent) {
        const { content: processedContent, documentDownloadMeta } = await processDocumentMarkers(
          streamFinalContent,
          assistantMessageId,
          setMessages
        );
        streamFinalContent = processedContent;

        // Set the full content (including thinking blocks) on the message
        // During streaming, thinking was stripped for display; restore it now
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: streamFinalContent, isStreaming: false }
              : msg
          )
        );

        // Parse suggested follow-ups
        const followupsMatch = streamFinalContent.match(
          /<suggested-followups>\s*(\[[\s\S]*?\])\s*<\/suggested-followups>/
        );
        if (followupsMatch) {
          try {
            const followups = JSON.parse(followupsMatch[1]) as string[];
            if (Array.isArray(followups) && followups.length > 0) {
              streamFinalContent = streamFinalContent
                .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
                .trimEnd();
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: streamFinalContent,
                        suggestedFollowups: followups.slice(0, 3),
                      }
                    : msg
                )
              );
            }
          } catch {
            streamFinalContent = streamFinalContent
              .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
              .trimEnd();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: streamFinalContent } : msg
              )
            );
          }
        }

        // Extract citations
        const extractedCitations = extractCitationsFromText(streamFinalContent);
        if (extractedCitations.length > 0) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, citations: extractedCitations, sourcesUsed: extractedCitations.length }
                : msg
            )
          );
        }

        // Smart tool suggestions
        if (!searchProvider && !isImageResponse) {
          const analysisResult = analyzeResponse(streamFinalContent);
          if (
            analysisResult.triggerType !== 'none' &&
            analysisResult.suggestedAction !== 'none' &&
            analysisResult.suggestedPrompt
          ) {
            const updatedContent = streamFinalContent + analysisResult.suggestedPrompt;
            streamFinalContent = updatedContent;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: updatedContent } : msg
              )
            );
            setPendingToolSuggestion({
              action: analysisResult.suggestedAction,
              originalQuestion: content,
            });
          }
        }

        // Save assistant message
        if (!isImageResponse) {
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            streamFinalContent,
            'text',
            undefined,
            undefined,
            documentDownloadMeta
          );
        }
      }

      setIsStreaming(false);
      setPendingDocumentType(null);
      abortControllerRef.current = null;

      // Generate/regenerate title
      const isNewConversation = messages.length === 0;
      const currentChat = chats.find((c) => c.id === newChatId);
      const shouldGenerateTitle =
        (isNewConversation ||
          (currentChat && isGenericTitle(currentChat.title) && content.length > 20)) &&
        newChatId;

      if (shouldGenerateTitle) {
        try {
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage: content, assistantMessage: streamFinalContent }),
          });
          if (titleResponse.ok) {
            const { title: generatedTitle } = await titleResponse.json();
            if (generatedTitle && (!isGenericTitle(generatedTitle) || isNewConversation)) {
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
                )
              );
              await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: newChatId, title: generatedTitle }),
              });
            }
          }
        } catch (titleErr) {
          log.warn('Title generation failed (non-critical)', {
            chatId: newChatId,
            error: titleErr instanceof Error ? titleErr.message : String(titleErr),
          });
        }
      }
    } catch (error) {
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'));
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('Load failed'));

      if (isAbortError || isNetworkError) {
        if (streamFinalContent) {
          try {
            await saveMessageToDatabase(newChatId, 'assistant', streamFinalContent, 'text');
          } catch (saveErr) {
            log.warn('Failed to save partial response after abort', {
              chatId: newChatId,
              error: saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
        }
        abortControllerRef.current = null;
        if (isMountedRef.current) {
          setIsStreaming(false);
          setPendingDocumentType(null);
        }
        return;
      }

      log.error('Chat API error:', error as Error);
      if (!isMountedRef.current) return;

      const rawErrorMsg = error instanceof Error ? error.message : '';
      const errorMsg = rawErrorMsg.toLowerCase();

      // Context exhaustion auto-recovery
      if (
        errorMsg.includes('context') ||
        errorMsg.includes('too long') ||
        errorMsg.includes('exceeds the model')
      ) {
        handleChatContinuation().catch((e) => log.error('Auto-continuation failed:', e));
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'This conversation has reached its context limit. Creating a new chat with your conversation summary...',
            timestamp: new Date(),
          },
        ]);
        setIsStreaming(false);
        setPendingDocumentType(null);
        return;
      }

      // User-friendly error messages
      let errorContent: string;
      if (errorMsg.includes('rate limit') || errorMsg.includes('429'))
        errorContent = "You're sending messages too quickly. Please wait a moment.";
      else if (
        errorMsg.includes('server busy') ||
        errorMsg.includes('503') ||
        errorMsg.includes('service_unavailable')
      )
        errorContent =
          "I'm still processing your previous request. Please wait a moment and try again.";
      else if (errorMsg.includes('token limit') || errorMsg.includes('quota exceeded'))
        errorContent = "You've reached your usage limit.";
      else if (errorMsg.includes('duplicate request'))
        errorContent = 'Please wait a moment before sending the same message again.';
      else if (errorMsg.includes('moderation') || errorMsg.includes('content policy'))
        errorContent = "Your message couldn't be processed due to content guidelines.";
      else if (errorMsg.includes('timeout'))
        errorContent = 'The request took too long. Please try again.';
      else if (errorMsg.includes('unauthorized') || errorMsg.includes('401'))
        errorContent = 'Your session may have expired. Please refresh.';
      else if (
        errorMsg.includes('overloaded') ||
        errorMsg.includes('capacity') ||
        errorMsg.includes('529')
      )
        errorContent = 'The AI service is temporarily at capacity. Please try again in a moment.';
      else if (errorMsg.includes('500') || errorMsg.includes('internal'))
        errorContent =
          'An internal error occurred. Please try again. If this persists, try refreshing the page.';
      else if (rawErrorMsg && rawErrorMsg !== 'undefined' && rawErrorMsg.length > 5)
        errorContent = rawErrorMsg;
      else errorContent = 'An unexpected error occurred. Please try again.';

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorContent,
          isError: true,
          timestamp: new Date(),
        },
      ]);
      setIsStreaming(false);
      setPendingDocumentType(null);
      abortControllerRef.current = null;
      await saveMessageToDatabase(newChatId, 'assistant', errorContent, 'error');
    } finally {
      abortControllerRef.current = null;
      if (isMountedRef.current) {
        setIsStreaming(false);
        setPendingDocumentType(null);
      }
    }
  };

  return { handleSendMessage };
}
