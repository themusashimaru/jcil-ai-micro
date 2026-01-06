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
import { searchCodebase, hasCodebaseIndex } from '@/lib/codebase-rag';
import { executeWorkspaceAgent, shouldUseWorkspaceAgent } from '@/lib/workspace/chat-integration';
import { processSlashCommand, isSlashCommand } from '@/lib/workspace/slash-commands';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Get encryption key (32 bytes for AES-256) - same as connectors API
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

// Decrypt token - same as connectors API
function decryptToken(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

// Generate UUID without external dependency
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
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
    if (isSlashCommand(enhancedContent)) {
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
        console.log(`[CodeLab] Slash command detected: ${content} -> ${processedPrompt.substring(0, 100)}...`);
        enhancedContent = processedPrompt;
      }
    }

    // Save user message
    const userMessageId = generateId();
    await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    // Get current session to increment message count
    const { data: currentSession } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .select('message_count')
      .eq('id', sessionId)
      .single();

    // Update session timestamp and message count
    await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .update({
        updated_at: new Date().toISOString(),
        message_count: (currentSession?.message_count || 0) + 1,
      })
      .eq('id', sessionId);

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
      console.log(`[CodeLab] Auto-summarizing ${messageCount} messages...`);

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
          console.error('[CodeLab] Summary generation failed:', err);
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

    // Detect intent (forceSearch from button overrides auto-detection)
    const useCodeAgent = checkCodeAgentIntent(enhancedContent);
    const useSearch = forceSearch || shouldUseSearch(enhancedContent);
    const useMultiAgent = shouldUseMultiAgent(enhancedContent);
    const useWorkspaceAgent = shouldUseWorkspaceAgent(enhancedContent);

    // ========================================
    // WORKSPACE AGENT - E2B Sandbox Execution (Claude Code-like)
    // ========================================
    // Check if user has an active workspace for this session
    const { data: workspaceData } = await (supabase
      .from('workspaces') as AnySupabase)
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_accessed_at', { ascending: false })
      .limit(1)
      .single();

    // Use workspace agent if: has active workspace AND request is agentic
    // OR if user explicitly asks for workspace mode with keywords
    const forceWorkspace = body.useWorkspace === true ||
      enhancedContent.toLowerCase().includes('/workspace') ||
      enhancedContent.toLowerCase().includes('/sandbox') ||
      enhancedContent.toLowerCase().includes('/execute');

    if ((workspaceData?.id && useWorkspaceAgent) || forceWorkspace) {
      console.log('[CodeLab] Using Workspace Agent (E2B sandbox mode)');

      // Get or create workspace
      let workspaceId = workspaceData?.id;

      if (!workspaceId) {
        // Create a new workspace for this user
        const { data: newWorkspace } = await (supabase
          .from('workspaces') as AnySupabase)
          .insert({
            user_id: user.id,
            name: 'Code Lab Workspace',
            type: 'sandbox',
            status: 'active',
            config: {
              nodeVersion: '20',
              timeout: 300,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        workspaceId = newWorkspace?.id;
      }

      if (workspaceId) {
        // Update last accessed
        await (supabase.from('workspaces') as AnySupabase)
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', workspaceId);

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
              console.error('[CodeLab Chat] Workspace Agent error:', error);
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
        githubToken = decryptToken(userData.github_token);
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
            console.error('[CodeLab Chat] Code Agent error:', error);
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
      console.log('[CodeLab] Multi-Agent mode activated. Agents:', suggestedAgents);

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
            console.error('[CodeLab Chat] Multi-Agent error:', error);
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
            console.error('[CodeLab Chat] Perplexity search error:', error);
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
              console.error('[CodeLab Chat] Fallback error:', fallbackError);
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
    // CODEBASE RAG - Retrieve relevant code context
    // ========================================
    let codebaseContext = '';
    if (repo) {
      try {
        const indexStatus = await hasCodebaseIndex(user.id, repo.owner, repo.name);
        if (indexStatus.indexed) {
          console.log(`[CodeLab] Searching codebase RAG for ${repo.fullName}...`);
          const { contextString } = await searchCodebase(
            user.id,
            repo.owner,
            repo.name,
            enhancedContent,
            { matchCount: 6, matchThreshold: 0.35 }
          );
          codebaseContext = contextString;
          if (codebaseContext) {
            console.log(`[CodeLab] RAG found relevant code context`);
          }
        }
      } catch (ragError) {
        console.error('[CodeLab] RAG search error:', ragError);
        // Continue without RAG context
      }
    }

    // ========================================
    // REGULAR CHAT - Claude Opus 4.5
    // ========================================
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

    // Add codebase RAG context if available
    if (codebaseContext) {
      systemPrompt += `

${codebaseContext}`;
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 8192,
            system: systemPrompt,
            messages,
            stream: true,
          });

          let fullContent = '';

          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if ('text' in delta) {
                fullContent += delta.text;
                controller.enqueue(encoder.encode(delta.text));
              }
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
          console.error('[CodeLab Chat] Error:', error);
          controller.enqueue(encoder.encode('\n\nI encountered an error. Please try again.'));
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
  } catch (error) {
    console.error('[CodeLab Chat] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
