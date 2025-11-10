/**
 * xAI Agentic Tools Configuration
 * Server-side tool definitions for agentic tool calling
 */

import { ToolType } from './types';

/**
 * Get server-side agentic tools configuration
 * These tools are executed by xAI servers automatically
 */
export function getAgenticTools(toolType?: ToolType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [];

  // Research tool should have live_search (xAI's real-time web search)
  if (toolType === 'research') {
    tools.push(
      { type: 'live_search' }
    );
  }

  // Code tool should have live_search for documentation lookup
  if (toolType === 'code') {
    tools.push(
      { type: 'live_search' }
    );
  }

  // Shopping should have live_search
  if (toolType === 'shopper') {
    tools.push({ type: 'live_search' });
  }

  // Scripture study might benefit from live_search
  if (toolType === 'scripture') {
    tools.push({ type: 'live_search' });
  }

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
      return `You are a thorough research assistant. Conduct comprehensive research using available tools. Cite your sources and provide detailed analysis.`;

    case 'email':
      return `You are a professional email writing assistant. Craft clear, well-structured emails appropriate for the specified tone and context.`;

    case 'essay':
      return `You are an expert essay writer. Create well-structured, coherent essays with proper citations and formatting.`;

    case 'sms':
      return `You are an SMS writing assistant. Create concise, clear text messages appropriate for the context and recipient.`;

    case 'translate':
      return `You are a professional translator. Provide accurate translations that preserve meaning, tone, and cultural context.`;

    case 'shopper':
      return `You are a helpful shopping assistant. Research products, compare options, and provide recommendations based on user preferences and budget.`;

    case 'scripture':
      return `You are a knowledgeable scripture study assistant. Help users explore biblical texts with context, interpretation, and application.`;

    case 'data':
      return `You are a data analysis expert. Analyze data, identify patterns, and create visualizations to communicate insights clearly.`;

    case 'image':
      return `You are an AI image generation assistant. Help users refine their prompts and generate high-quality images matching their vision.`;

    case 'video':
      return `You are a video generation assistant. Help users create engaging video content with appropriate style and duration.`;

    default:
      return `You are a helpful AI assistant powered by xAI's Grok. Provide accurate, thoughtful, and engaging responses.`;
  }
}
