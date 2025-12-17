/**
 * DEEPSEEK VISION PREPROCESSOR
 *
 * DeepSeek doesn't support vision/images natively.
 * This module uses GPT-4o-mini to preprocess images and extract
 * text descriptions before sending to DeepSeek.
 *
 * Features:
 * - Image analysis and description
 * - OCR (text extraction from images)
 * - Document/receipt parsing
 * - Chart/graph interpretation
 */

import OpenAI from 'openai';
import { CoreMessage } from 'ai';

// Use GPT-4o-mini for cost-effective vision processing
const VISION_MODEL = 'gpt-4o-mini';

// Get OpenAI client for vision processing
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY_1 || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured for vision preprocessing');
  }
  return new OpenAI({ apiKey });
}

/**
 * Extract information from an image using GPT-4o-mini
 */
export async function extractImageContent(imageUrl: string): Promise<string> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a vision assistant that extracts and describes image content for a text-only AI.
Your job is to provide a comprehensive description that captures ALL useful information from the image.

Guidelines:
- Extract ALL visible text (OCR) - be thorough and accurate
- Describe visual elements, layouts, colors, and composition
- For documents/receipts: extract dates, amounts, names, addresses, line items
- For charts/graphs: describe the data, trends, axes labels, legends
- For photos: describe subjects, setting, actions, emotions
- For diagrams: explain the structure, relationships, flow
- For screenshots: describe the UI, content, any error messages
- Be detailed but organized - use bullet points for complex content
- If there's handwriting, do your best to transcribe it
- Note anything that seems important or unusual

Format your response as:
[IMAGE ANALYSIS]
Type: (photo/document/chart/screenshot/diagram/etc)
Description: (brief overview)
Details:
- (detailed extracted content)
[END IMAGE ANALYSIS]`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image and extract all relevant information:'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more accurate extraction
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return '[IMAGE ANALYSIS]\nType: Unknown\nDescription: Unable to analyze image\n[END IMAGE ANALYSIS]';
    }

    console.log('[Vision Preprocessor] Successfully extracted image content');
    return content;
  } catch (error) {
    console.error('[Vision Preprocessor] Error extracting image content:', error);
    return '[IMAGE ANALYSIS]\nType: Error\nDescription: Failed to process image - the image may be corrupted or inaccessible\n[END IMAGE ANALYSIS]';
  }
}

/**
 * Check if a message contains image content
 */
export function hasImageContent(message: CoreMessage): boolean {
  if (message.role !== 'user') return false;
  if (typeof message.content === 'string') return false;
  if (!Array.isArray(message.content)) return false;

  return message.content.some(part => part.type === 'image');
}

/**
 * Preprocess messages to replace images with text descriptions
 * Used when sending to DeepSeek (which doesn't support vision)
 */
export async function preprocessMessagesForDeepSeek(
  messages: CoreMessage[]
): Promise<CoreMessage[]> {
  const processedMessages: CoreMessage[] = [];

  for (const message of messages) {
    if (!hasImageContent(message)) {
      // No images, keep as-is
      processedMessages.push(message);
      continue;
    }

    // Process user message with images
    if (Array.isArray(message.content)) {
      const newParts: Array<{ type: 'text'; text: string }> = [];

      for (const part of message.content) {
        if (part.type === 'text') {
          newParts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image') {
          // Extract image URL
          const imageUrl = typeof part.image === 'string' ? part.image : '';
          if (imageUrl) {
            console.log('[Vision Preprocessor] Processing image for DeepSeek...');
            const imageDescription = await extractImageContent(imageUrl);
            newParts.push({ type: 'text', text: imageDescription });
          }
        }
      }

      // Combine all text parts into a single message
      const combinedText = newParts.map(p => p.text).join('\n\n');
      processedMessages.push({
        role: 'user',
        content: combinedText
      });
    }
  }

  return processedMessages;
}

/**
 * Check if any messages in the array contain images
 */
export function messagesContainImages(messages: CoreMessage[]): boolean {
  return messages.some(hasImageContent);
}
