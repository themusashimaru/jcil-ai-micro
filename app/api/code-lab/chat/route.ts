/**
 * CODE LAB CHAT API
 *
 * The unified chat endpoint that handles:
 * - Regular chat with Claude Opus 4.5
 * - Code generation via Code Agent V2
 * - Web search via Perplexity
 *
 * Opus decides which tool to use based on the request.
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { executeCodeAgent, shouldUseCodeAgent as checkCodeAgentIntent } from '@/agents/code/integration';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { orchestrateStream, shouldUseMultiAgent, getSuggestedAgents } from '@/lib/multi-agent';
import { executeWorkspaceAgent } from '@/lib/workspace/chat-integration';
import { processSlashCommand, isSlashCommand, parseSlashCommand } from '@/lib/workspace/slash-commands';
import { detectCodeLabIntent } from '@/lib/workspace/intent-detector';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

const log = logger('CodeLabChat');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Get encryption key (32 bytes for AES-256) - same as connectors API
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

// Decrypt token - with proper error handling
function decryptToken(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      log.warn('Invalid encrypted token format');
      return null;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (!decrypted) {
      log.warn('Decrypted token is empty');
      return null;
    }

    return decrypted;
  } catch (error) {
    log.error('Token decryption failed', error as Error);
    return null;
  }
}

// SECURITY FIX: Use cryptographically secure UUID generation
// Math.random() is NOT secure and IDs could be predicted
function generateId(): string {
  return crypto.randomUUID();
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ========================================
// AUTO-SUMMARIZATION CONFIG
// ========================================
const SUMMARY_THRESHOLD = 15; // Summarize when message count exceeds this
const RECENT_MESSAGES_AFTER_SUMMARY = 5; // Keep this many recent messages after summary

/**
 * Generate a summary of conversation history
 * Called when message count exceeds threshold
 */
async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Use Sonnet for efficient summarization
    max_tokens: 1024,
    system: `You are summarizing a developer conversation for context continuation.
Create a concise technical summary that captures:
1. Main topics and goals discussed
2. Key decisions made
3. Code/technical context established
4. Current state of any projects
5. Open questions or next steps

Format as bullet points. Be specific about file names, technologies, and code patterns mentioned.
Keep it under 500 words but include all important technical details.`,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation for context continuation:\n\n${conversationText}`,
      },
    ],
  });

  let summary = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summary += block.text;
    }
  }
  return summary;
}

// Search detection - improved patterns for developer queries
function shouldUseSearch(message: string): boolean {
  const searchPatterns = [
    // Explicit search requests
    /\b(search|look up|find|google|lookup|research)\b.*\b(docs?|documentation|how to|guide|tutorial|info|information)/i,
    /\bsearch (for|the|web|online)\b/i,

    // Current/latest information needs
    /\bwhat is\b.*\b(latest|current|new|newest|recent)\b/i,
    /\b(latest|current|newest|recent)\b.*\b(version|release|update|news)/i,

    // Technical documentation queries
    /\bhow (do|can|to|does)\b.*\b(i|you|we|one)\b/i,
    /\bwhat('s| is) the (best|recommended|standard|official)\b/i,

    // Package/library information
    /\b(npm|yarn|pip|cargo|composer)\b.*\b(package|library|module)\b/i,
    /\b(install|setup|configure)\b.*\b(guide|instructions|docs)\b/i,

    // API/framework questions
    /\b(api|sdk|framework|library)\b.*\b(documentation|reference|examples?)\b/i,

    // Comparison/evaluation
    /\b(compare|vs|versus|difference between|which is better)\b/i,
    /\b(pros and cons|advantages|disadvantages)\b/i,

    // Troubleshooting
    /\b(error|issue|problem|bug)\b.*\b(fix|solve|resolve|solution)\b/i,
    /\bwhy (does|is|am|do)\b.*\b(not working|failing|broken|error)/i,
  ];
  return searchPatterns.some(p => p.test(message));
}

// In-memory rate limit store (per user, resets every minute)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - userLimit.count };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // SECURITY FIX: Rate limiting to prevent abuse
    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      log.warn('Rate limit exceeded', { userId: user.id });
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please wait a moment before sending more messages.',
        code: 'RATE_LIMIT_EXCEEDED'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60)
        }
      });
    }

    const body = await request.json();
    const { sessionId, content, repo, attachments, forceSearch } = body;

    if (!sessionId || (!content && (!attachments || attachments.length === 0))) {
      return new Response('Missing sessionId or content', { status: 400 });
    }

    // Process attachments for Claude vision
    interface AttachmentData {
      name: string;
      type: string;
      data: string;
    }
    const imageAttachments = (attachments as AttachmentData[] || []).filter(
      (a: AttachmentData) => a.type.startsWith('image/')
    );
    const documentAttachments = (attachments as AttachmentData[] || []).filter(
      (a: AttachmentData) => !a.type.startsWith('image/')
    );

    // Build content with document info
    let enhancedContent = content || '';
    if (documentAttachments.length > 0) {
      enhancedContent += '\n\n[Attached documents: ' +
        documentAttachments.map((d: AttachmentData) => d.name).join(', ') + ']';
    }

    // Process slash commands - convert /fix, /test, etc. to enhanced prompts
    let slashCommandFailed = false;
    let slashCommandError = '';
    if (isSlashCommand(enhancedContent)) {
      const parsed = parseSlashCommand(enhancedContent);
      if (parsed) {
        const processedPrompt = processSlashCommand(enhancedContent, {
          userId: user.id,
          sessionId,
          repo: repo ? {
            owner: repo.owner,
            name: repo.name,
            branch: repo.branch || 'main',
          } : undefined,
        });
        if (processedPrompt) {
          log.debug('Slash command detected', { command: content?.substring(0, 50) });
          enhancedContent = processedPrompt;
        }
      } else {
        // Unknown slash command - provide helpful feedback
        const commandName = enhancedContent.split(' ')[0];
        slashCommandFailed = true;
        slashCommandError = `Unknown command: ${commandName}. Try /help to see available commands.`;
        log.debug('Unknown slash command', { command: commandName });
      }
    }

    // Run intelligent intent detection
    const intentResult = detectCodeLabIntent(enhancedContent);
    log.debug('Intent detected', {
      type: intentResult.type,
      confidence: intentResult.confidence,
      workspace: intentResult.shouldUseWorkspace
    });

    // Save user message
    const userMessageId = generateId();
    const { error: msgError } = await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    if (msgError) {
      log.warn('Failed to save user message', { error: msgError.message });
      // Continue anyway - we can still process the request
    }

    // Get current session to increment message count
    const { data: currentSession, error: sessionError } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .select('message_count')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      log.warn('Failed to get session', { error: sessionError.message });
    }

    // Update session timestamp and message count
    const { error: updateError } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .update({
        updated_at: new Date().toISOString(),
        message_count: (currentSession?.message_count || 0) + 1,
      })
      .eq('id', sessionId);

    if (updateError) {
      log.warn('Failed to update session', { error: updateError.message });
    }

    // Get conversation history with auto-summarization
    const { data: allMessages } = await (supabase
      .from('code_lab_messages') as AnySupabase)
      .select('id, role, content, type')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Check for existing summary
    const existingSummary = (allMessages || []).find(
      (m: { type: string }) => m.type === 'summary'
    );

    // Build effective history for context
    let history: Array<{ role: string; content: string }> = [];
    const messageCount = currentSession?.message_count || 0;

    if (messageCount > SUMMARY_THRESHOLD && !existingSummary) {
      // Need to generate a summary
      log.info('Auto-summarizing conversation', { messageCount });

      const messagesToSummarize = (allMessages || [])
        .filter((m: { type: string }) => m.type !== 'summary')
        .slice(0, -RECENT_MESSAGES_AFTER_SUMMARY);

      if (messagesToSummarize.length > 0) {
        try {
          const summary = await generateConversationSummary(
            messagesToSummarize.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            }))
          );

          // Save summary to database
          await (supabase.from('code_lab_messages') as AnySupabase).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'system',
            content: summary,
            created_at: new Date().toISOString(),
            type: 'summary',
          });

          // Update session has_summary flag
          await (supabase.from('code_lab_sessions') as AnySupabase)
            .update({ has_summary: true, last_summary_at: new Date().toISOString() })
            .eq('id', sessionId);

          // Use summary + recent messages
          history = [
            { role: 'system', content: `[Previous conversation summary]\n${summary}` },
            ...(allMessages || [])
              .filter((m: { type: string }) => m.type !== 'summary')
              .slice(-RECENT_MESSAGES_AFTER_SUMMARY)
              .map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
          ];
        } catch (err) {
          log.error('Summary generation failed', err as Error);
          // Fall back to recent messages only
          history = (allMessages || [])
            .slice(-20)
            .map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            }));
        }
      }
    } else if (existingSummary) {
      // Use existing summary + messages after it
      const summaryIndex = (allMessages || []).findIndex(
        (m: { id: string }) => m.id === existingSummary.id
      );
      history = [
        { role: 'system', content: `[Previous conversation summary]\n${existingSummary.content}` },
        ...(allMessages || [])
          .slice(summaryIndex + 1)
          .map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
      ];
    } else {
      // No summarization needed, use all messages
      history = (allMessages || [])
        .slice(-20)
        .map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        }));
    }

    // Handle slash command failures by returning error response
    if (slashCommandFailed) {
      const errorMessageId = generateId();
      const errorContent = `**${slashCommandError}**\n\nAvailable commands:\n- \`/fix\` - Fix errors in the codebase\n- \`/test\` - Run tests\n- \`/build\` - Run build\n- \`/commit\` - Commit changes\n- \`/push\` - Push to remote\n- \`/review\` - Code review\n- \`/explain\` - Explain code\n- \`/workspace\` - Enable sandbox mode\n- \`/help\` - Show all commands`;

      await (supabase.from('code_lab_messages') as AnySupabase).insert({
        id: errorMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: errorContent,
        created_at: new Date().toISOString(),
      });

      // Return error as stream
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          }
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Message-Id': errorMessageId,
          },
        }
      );
    }

    // Detect intent (forceSearch from button overrides auto-detection)
    const useCodeAgent = checkCodeAgentIntent(enhancedContent);
    const useSearch = forceSearch || shouldUseSearch(enhancedContent);
    const useMultiAgent = shouldUseMultiAgent(enhancedContent);
    // Use intelligent intent detector result
    const useWorkspaceAgent = intentResult.shouldUseWorkspace;

    // ========================================
    // WORKSPACE AGENT - E2B Sandbox Execution (Claude Code-like)
    // ========================================
    // Check if user has an active workspace for this session
    const { data: workspaceData } = await (supabase
      .from('code_lab_workspaces') as AnySupabase)
      .select('id, sandbox_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single();

    // Use workspace agent if: has active workspace AND request is agentic (high confidence)
    // OR if user explicitly asks for workspace mode with keywords
    const forceWorkspace = body.useWorkspace === true ||
      enhancedContent.toLowerCase().includes('/workspace') ||
      enhancedContent.toLowerCase().includes('/sandbox') ||
      enhancedContent.toLowerCase().includes('/execute');

    // Only use workspace for high-confidence agentic requests
    const shouldActivateWorkspace = (workspaceData?.id && useWorkspaceAgent && intentResult.confidence >= 50) || forceWorkspace;

    if (shouldActivateWorkspace) {
      log.info('Using Workspace Agent (E2B sandbox mode)');

      // Get or create workspace
      let workspaceId = workspaceData?.id;
      let sandboxId = workspaceData?.sandbox_id;

      if (!workspaceId) {
        // Generate a sandbox ID (will be replaced by real E2B sandbox ID when created)
        sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create a new workspace for this user
        const { data: newWorkspace, error: wsError } = await (supabase
          .from('code_lab_workspaces') as AnySupabase)
          .insert({
            user_id: user.id,
            session_id: sessionId,
            sandbox_id: sandboxId,
            template: 'nodejs',
            status: 'active',
            created_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (wsError) {
          log.error('Failed to create workspace', wsError);
        }

        workspaceId = newWorkspace?.id;
      }

      if (workspaceId) {
        // Update last activity
        const { error: activityError } = await (supabase.from('code_lab_workspaces') as AnySupabase)
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', workspaceId);

        if (activityError) {
          log.warn('Failed to update workspace activity', { error: activityError.message });
        }

        // Execute workspace agent with streaming
        const workspaceStream = await executeWorkspaceAgent(content, {
          workspaceId,
          userId: user.id,
          sessionId,
          history: (history || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        // Collect stream and save to database
        const reader = workspaceStream.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                fullContent += text;
                controller.enqueue(encoder.encode(text));
              }

              // Save assistant message
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                type: 'workspace',
              });

              controller.close();
            } catch (error) {
              log.error('Workspace Agent error', error as Error);
              controller.enqueue(encoder.encode('\n\n`✕ Error:` I encountered an error during workspace execution. Please try again.'));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
    }

    // ========================================
    // CODE AGENT V2 - Full Project Generation
    // ========================================
    if (useCodeAgent) {
      // Get GitHub token from users table (stored via PAT in Settings > Connectors)
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: userData } = await adminClient
        .from('users')
        .select('github_token')
        .eq('id', user.id)
        .single();

      let githubToken: string | undefined;
      if (userData?.github_token) {
        const decrypted = decryptToken(userData.github_token);
        if (decrypted) {
          githubToken = decrypted;
        } else {
          log.warn('GitHub token decryption failed - proceeding without GitHub access');
        }
      }

      // Execute Code Agent with streaming
      const codeAgentStream = await executeCodeAgent(content, {
        userId: user.id,
        conversationId: sessionId,
        previousMessages: (history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        githubToken,
        selectedRepo: repo ? {
          owner: repo.owner,
          repo: repo.name,
          fullName: repo.fullName,
        } : undefined,
        skipClarification: content.toLowerCase().includes('just build') ||
                          content.toLowerCase().includes('proceed') ||
                          content.toLowerCase().includes('go ahead'),
      });

      // Collect the stream and save to database
      const reader = codeAgentStream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value);
              fullContent += text;
              controller.enqueue(encoder.encode(text));
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'code',
            });

            controller.close();
          } catch (error) {
            log.error('Code Agent error', error as Error);
            controller.enqueue(encoder.encode('\n\nI encountered an error during code generation. Please try again.'));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ========================================
    // MULTI-AGENT MODE - Specialized Agents
    // ========================================
    if (useMultiAgent) {
      const suggestedAgents = getSuggestedAgents(enhancedContent);
      log.info('Multi-Agent mode activated', { agents: suggestedAgents });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = '';

            // Stream the orchestrated response
            const agentStream = orchestrateStream(enhancedContent, {
              userId: user.id,
              sessionId,
              repo: repo ? {
                owner: repo.owner,
                name: repo.name,
                branch: repo.branch || 'main',
                fullName: repo.fullName,
              } : undefined,
              previousMessages: (history || []).map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            });

            for await (const chunk of agentStream) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'multi-agent',
            });

            controller.close();
          } catch (error) {
            log.error('Multi-Agent error', error as Error);
            controller.enqueue(encoder.encode('\n\nI encountered an error with the multi-agent system. Please try again.'));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ========================================
    // PERPLEXITY SEARCH - Real-time Web Search
    // ========================================
    if (useSearch && isPerplexityConfigured()) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Show search indicator
            controller.enqueue(encoder.encode('`🔍 Searching the web...`\n\n'));

            // Perform Perplexity search
            const searchResult = await perplexitySearch({
              query: content,
              systemPrompt: `You are a developer-focused search assistant. Provide accurate, technical information.
Format your response with:
1. Direct answer to the question
2. Code examples if relevant (with language tags)
3. Best practices or tips
Keep it professional and focused on development.`,
            });

            // Format the search result
            let fullContent = '';
            fullContent += searchResult.answer;

            // Add sources
            if (searchResult.sources && searchResult.sources.length > 0) {
              fullContent += '\n\n---\n\n**Sources:**\n';
              searchResult.sources.slice(0, 5).forEach((source, i) => {
                fullContent += `${i + 1}. [${source.title || 'Source'}](${source.url})\n`;
              });
            }

            // Stream the response
            controller.enqueue(encoder.encode(fullContent));

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'search',
              search_output: JSON.stringify({
                query: content,
                sources: searchResult.sources,
                model: searchResult.model,
              }),
            });

            controller.close();
          } catch (error) {
            log.error('Perplexity search error', error as Error);
            // Fall back to Claude if Perplexity fails
            controller.enqueue(encoder.encode('`Search unavailable, using knowledge base...`\n\n'));

            try {
              const fallbackResponse = await anthropic.messages.create({
                model: 'claude-opus-4-5-20251101',
                max_tokens: 4096,
                system: `You are Claude in Code Lab. The user asked a search question but web search failed.
Provide the best answer you can from your training knowledge.
Be honest about knowledge cutoff limitations when relevant.`,
                messages: [{ role: 'user', content }],
              });

              let fallbackContent = '';
              for (const block of fallbackResponse.content) {
                if (block.type === 'text') {
                  fallbackContent += block.text;
                  controller.enqueue(encoder.encode(block.text));
                }
              }

              // Save fallback response
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fallbackContent,
                created_at: new Date().toISOString(),
                type: 'search',
              });
            } catch (fallbackError) {
              log.error('Fallback error', fallbackError as Error);
              controller.enqueue(encoder.encode('\n\nI encountered an error. Please try again.'));
            }

            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ========================================
    // REGULAR CHAT - Claude Opus 4.5
    // ========================================
    // Note: Codebase RAG removed (used Google embeddings)
    // Use Code Lab grep/find tools for code search instead
    const messages: Anthropic.MessageParam[] = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build the current user message content (with vision support)
    type MessageContent = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
    const userContent: MessageContent[] = [];

    // Add text content
    if (enhancedContent) {
      userContent.push({ type: 'text', text: enhancedContent });
    }

    // Add images for vision (Claude can process images)
    for (const img of imageAttachments) {
      // Extract base64 data (remove "data:image/...;base64," prefix)
      const base64Data = img.data.split(',')[1] || img.data;
      const mediaType = img.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    // Add the user message with all content
    if (userContent.length > 0) {
      messages.push({
        role: 'user',
        content: userContent,
      });
    }

    // Build system prompt
    let systemPrompt = `You are Claude, a highly capable AI assistant in Code Lab - a professional developer workspace.

You help developers with:
- Building code and applications
- Debugging and fixing issues
- Searching documentation
- Explaining concepts
- Code review and best practices
- Analyzing screenshots and images (you have vision capabilities)

Keep your responses clear, professional, and focused.
Use markdown for formatting. Use code blocks with language tags.
When showing terminal commands, use \`\`\`bash blocks.

${imageAttachments.length > 0 ? `The user has attached ${imageAttachments.length} image(s). Analyze them carefully and provide helpful feedback.` : ''}

Style Guidelines:
- Be concise but thorough
- Use proper code formatting
- Provide working, tested code
- Explain your reasoning briefly`;

    if (repo) {
      systemPrompt += `

The user is working in repository: ${repo.fullName} (branch: ${repo.branch || 'main'})`;
    }

    // Stream the response with reliability features
    const encoder = new TextEncoder();

    // Configuration for reliability
    const CHUNK_TIMEOUT_MS = 60000; // 60s timeout per chunk
    const KEEPALIVE_INTERVAL_MS = 15000; // Send keepalive every 15s

    const stream = new ReadableStream({
      async start(controller) {
        let keepaliveInterval: NodeJS.Timeout | null = null;
        let lastActivity = Date.now();

        // Keepalive function to prevent proxy timeouts
        const startKeepalive = () => {
          keepaliveInterval = setInterval(() => {
            const timeSinceActivity = Date.now() - lastActivity;
            if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
              try {
                controller.enqueue(encoder.encode(' ')); // Invisible keepalive
                log.debug('Sent keepalive heartbeat');
              } catch {
                // Controller might be closed
              }
            }
          }, KEEPALIVE_INTERVAL_MS);
        };

        const stopKeepalive = () => {
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
          }
        };

        try {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 8192,
            system: systemPrompt,
            messages,
            stream: true,
          });

          let fullContent = '';

          // Start keepalive once stream is established
          startKeepalive();

          // Stream with timeout per chunk
          const iterator = response[Symbol.asyncIterator]();

          while (true) {
            const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
              setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS);
            });

            try {
              const result = await Promise.race([
                iterator.next(),
                timeoutPromise,
              ]);

              if (result.done) break;

              lastActivity = Date.now();
              const event = result.value;

              if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if ('text' in delta) {
                  fullContent += delta.text;
                  controller.enqueue(encoder.encode(delta.text));
                }
              }
            } catch (error) {
              if (error instanceof Error && error.message === 'Stream chunk timeout') {
                log.error('Stream chunk timeout - no data for 60s');
                controller.enqueue(encoder.encode('\n\n*[Response interrupted: Connection timed out. Please try again.]*'));
              }
              throw error;
            }
          }

          // Save assistant message
          await (supabase.from('code_lab_messages') as AnySupabase).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
            type: useSearch ? 'search' : 'chat',
          });

          controller.close();
        } catch (error) {
          log.error('Stream error', error as Error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isTimeout = errorMessage.includes('timeout');
          const userMessage = isTimeout
            ? '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
            : '\n\nI encountered an error. Please try again.';
          controller.enqueue(encoder.encode(userMessage));
          controller.close();
        } finally {
          stopKeepalive();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    log.error('Request error', error as Error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Vercel serverless configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for complex code generation
