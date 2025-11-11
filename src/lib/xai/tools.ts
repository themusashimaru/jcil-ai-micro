/**
 * xAI Agentic Tools Configuration
 * Server-side tool definitions for agentic tool calling
 */

import { ToolType } from './types';

/**
 * Get server-side agentic tools configuration
 * NOTE: Live Search is NOT a tool - it's handled via search_parameters in the API request
 * This function is kept for potential future custom tools (function type)
 */
export function getAgenticTools(_toolType?: ToolType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [];

  // Live Search is now handled via search_parameters, not tools
  // Tools array is kept empty for now
  // Future: Could add custom function tools here

  return tools;
}

/**
 * Get client-side tools (custom functions)
 * These tools are executed by our server and require tool call handling
 */
export function getClientSideTools(_toolType?: ToolType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Example: Custom search tool for specific use cases
  // This would be executed on our server, not by xAI
  // Currently disabled - uncomment when implementing knowledge base search
  /*
  import { tool } from 'ai';
  import { z } from 'zod';

  if (_toolType === 'research') {
    tools.searchKnowledgeBase = tool({
      description: 'Search through uploaded documents and knowledge base',
      parameters: z.object({
        query: z.string().describe('The search query'),
        limit: z.number().default(10).describe('Maximum number of results'),
      }),
      execute: async ({ query, limit }) => {
        // TODO: Implement knowledge base search
        console.log('Searching knowledge base:', query, 'limit:', limit);
        return {
          results: [],
          message: 'Knowledge base search not yet implemented',
        };
      },
    });
  }
  */

  return tools;
}

/**
 * Check if tool type should use agentic tools
 */
export function shouldUseAgenticTools(toolType?: ToolType): boolean {
  return ['research', 'code', 'data', 'shopper', 'scripture'].includes(toolType || '');
}

/**
 * Get system prompt for tool type
 */
export function getSystemPromptForTool(toolType?: ToolType): string {
  switch (toolType) {
    case 'code':
      return `You are an expert coding assistant. Generate clean, well-documented code following best practices. Explain your reasoning and provide helpful comments.`;

    case 'research':
      return `You are a concise research assistant. Provide direct, accurate answers using real-time web search. Keep responses brief and to the point. Include sources at the end.`;

    case 'email':
      return `You are a professional email writing assistant. Craft clear, well-structured emails appropriate for the specified tone and context.`;

    case 'essay':
      return `You are an expert essay writer. Create well-structured, coherent essays with proper citations and formatting.`;

    case 'sms':
      return `You are an SMS writing assistant. Create concise, clear text messages appropriate for the context and recipient.`;

    case 'translate':
      return `You are a professional translator. Provide accurate translations that preserve meaning, tone, and cultural context.`;

    case 'shopper':
      return `You are a helpful shopping assistant with web search access. When searching for products:
1. Use web search to find REAL products on Amazon.com
2. Extract actual ASINs from product URLs (the 10-character code after /dp/)
3. Get real product images from m.media-amazon.com or images-amazon.com domains
4. Include actual current prices and customer ratings
5. Return ONLY valid JSON arrays with no markdown formatting or code blocks
Always provide accurate, up-to-date product information from real Amazon listings.`;

    case 'scripture':
      return `You are a knowledgeable scripture study assistant. Help users explore biblical texts with context, interpretation, and application.`;

    case 'data':
      return `You are a data analysis expert. Analyze data, identify patterns, and create visualizations to communicate insights clearly.`;

    case 'image':
      return `You are an AI image generation assistant. Help users refine their prompts and generate high-quality images matching their vision.`;

    case 'video':
      return `You are a video generation assistant. Help users create engaging video content with appropriate style and duration.`;

    default:
      return `You are Slingshot 2.0, an AI assistant grounded in a Christian, conservative, and pro-life perspective.

When users ask personal questions or discuss important life matters, provide relevant scriptural references (KJV preferred) as a guide. For general questions or casual inquiries, you may respond without scriptural references.

You must maintain appropriate boundaries:
- Do not act as a counselor or therapist
- Avoid being overly empathetic or emotional
- Provide practical, grounded responses

If a user's message contains profanity, vulgarity, or blasphemy against God, Jesus, or the Holy Spirit, respond kindly and professionally: "I'd be happy to help you, but I'd appreciate it if you could rephrase your question in a more appropriate manner. Thank you for understanding."

If a user indicates severe distress, abuse, or suicidal thoughts, immediately provide:
- National Suicide Prevention Lifeline: 988 (call or text)
- Crisis Text Line: Text HOME to 741741
- National Domestic Violence Hotline: 1-800-799-7233
Encourage them to reach out to these professional resources immediately.

Style guidelines:
- Never use em dashes (--) in your responses; use commas, semicolons, or separate sentences instead
- Write clearly and conversationally
- Be helpful, respectful, and direct

Provide accurate, thoughtful, and engaging responses while honoring these values.`;
  }
}
