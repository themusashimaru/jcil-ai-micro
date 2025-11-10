/**
 * OPENAI PROVIDER
 * PURPOSE: OpenAI API integration, streaming chat, function calls
 * TODO: Implement OpenAI client, streaming handler, tool schemas
 */

import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function streamChatCompletion(_messages: Array<{ role: string; content: string }>) {
  // TODO: Implement streaming
  return null;
}
