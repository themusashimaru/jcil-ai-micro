/**
 * XAI PROVIDER
 * PURPOSE: xAI (Grok) API integration with live web search capabilities
 */

import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';

export interface LiveSearchOptions {
  query: string;
  enableWebSearch?: boolean;
  enableXSearch?: boolean;
  enableNewsSearch?: boolean;
}

/**
 * Get xAI client with API key
 */
function getXAIClient() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required');
  }
  return createXai({ apiKey });
}

/**
 * Perform live search with real-time web results
 * Uses xAI's search_parameters feature for current information
 */
export async function liveSearch(options: LiveSearchOptions) {
  const {
    query,
    enableWebSearch = true,
    enableXSearch = true,
    enableNewsSearch = true,
  } = options;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required');
  }

  // Build search sources
  const sources: Array<{ type: string }> = [];
  if (enableWebSearch) sources.push({ type: 'web' });
  if (enableXSearch) sources.push({ type: 'x' });
  if (enableNewsSearch) sources.push({ type: 'news' });

  // Make direct API call to xAI with search_parameters
  // Note: search_parameters is a top-level field, not a tool
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful research assistant. Provide accurate, comprehensive answers using real-time web search. Always cite your sources.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      search_parameters: {
        mode: 'on',
        return_citations: true,
        sources,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    finishReason: data.choices[0].finish_reason,
    usage: data.usage,
    citations: data.citations || [],
  };
}

/**
 * Generate chat completion using xAI (without search)
 */
export async function chatCompletion(messages: Array<{ role: string; content: string }>) {
  const xai = getXAIClient();
  const model = xai('grok-2-latest');

  const result = await generateText({
    model,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  });

  return {
    content: result.text,
    usage: result.usage,
  };
}
