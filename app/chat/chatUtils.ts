/**
 * CHAT UTILITY FUNCTIONS
 *
 * Pure utility functions extracted from ChatClient.tsx for better modularity.
 * These have no React dependencies and can be tested independently.
 */

import type { Message } from './types';

/**
 * Format messages array for the /api/chat endpoint.
 * Handles image attachments, document attachments (PDF, spreadsheet), and plain text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatMessagesForApi(allMessages: Message[]): any[] {
  // Find last image message index
  let lastImageMessageIndex = -1;
  for (let i = allMessages.length - 1; i >= 0; i--) {
    if (
      allMessages[i].role === 'user' &&
      allMessages[i].attachments?.some((att) => att.type.startsWith('image/'))
    ) {
      lastImageMessageIndex = i;
      break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allMessages.map((msg, index) => {
    const imageAttachments = msg.attachments?.filter(
      (att) => att.type.startsWith('image/') && att.thumbnail
    );
    const documentAttachments = msg.attachments?.filter(
      (att) => !att.type.startsWith('image/') && att.url
    );
    let messageContent = msg.content || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentParts: any[] = [];

    if (index === allMessages.length - 1 && documentAttachments?.length) {
      documentAttachments.forEach((doc) => {
        const fileContent = doc.url || '';
        const rawBase64 = doc.rawData || '';
        const isBase64 = fileContent.startsWith('data:');
        if (doc.type === 'application/pdf') {
          const pdfData = rawBase64 || fileContent;
          if (pdfData.startsWith('data:'))
            documentParts.push({
              type: 'document',
              name: doc.name,
              mediaType: 'application/pdf',
              data: pdfData,
            });
          if (!isBase64 && fileContent)
            messageContent = `[Document: ${doc.name}]\n\n${fileContent}\n\n---\n\n${messageContent}`;
        } else if (isBase64) {
          messageContent = `[File: ${doc.name} - Unable to extract content]\n\n${messageContent}`;
        } else {
          const label =
            doc.type.includes('spreadsheet') || doc.type.includes('excel') ? 'Spreadsheet' : 'File';
          messageContent = `[${label}: ${doc.name}]\n\n${fileContent}\n\n---\n\n${messageContent}`;
        }
      });
    }

    if (documentParts.length > 0 && !imageAttachments?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = [...documentParts];
      if (messageContent.trim()) contentParts.push({ type: 'text', text: messageContent });
      return { role: msg.role, content: contentParts };
    }

    if (!imageAttachments?.length)
      return {
        role: msg.role,
        content: messageContent.trim() || (msg.role === 'assistant' ? '[Response]' : '[Message]'),
      };
    if (index !== lastImageMessageIndex)
      return { role: msg.role, content: messageContent || '[User shared an image]' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];
    imageAttachments.forEach((image) =>
      contentParts.push({ type: 'image', image: image.thumbnail })
    );
    if (messageContent) contentParts.push({ type: 'text', text: messageContent });
    return { role: msg.role, content: contentParts };
  });
}

/**
 * Detect document type from user message (client-side detection for UI feedback)
 * Mirrors server-side detection for progress indicator
 */
export function detectDocumentTypeFromMessage(
  content: string
): 'pdf' | 'docx' | 'xlsx' | 'pptx' | null {
  const lowerContent = content.toLowerCase();

  // PDF patterns
  const pdfPatterns = [
    /\b(slides?|presentation|powerpoint|deck)\b.*\b(as|in|to)\s*(a\s*)?(pdf|pdf\s*format)\b/i,
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\bpdf\b/i,
    /\bpdf\b.*\b(file|document|version|format)\b/i,
    /\bas\s*a?\s*pdf\b/i,
    /\bresume\b.*\bpdf\b/i,
    /\bpdf\s*resume\b/i,
  ];

  // Excel patterns
  const excelPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(excel|spreadsheet|xlsx|xls)\b/i,
    /\b(excel|spreadsheet|xlsx|xls)\b.*\b(file|document|for|with|that)\b/i,
    /\bbudget\b.*\b(spreadsheet|template|excel)\b/i,
  ];

  // PowerPoint patterns
  const pptxPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(powerpoint|pptx|presentation|slides?|slide deck)\b/i,
    /\b(powerpoint|pptx|presentation|slides?)\b.*\b(file|about|on|for|with)\b/i,
  ];

  // Word patterns
  const docxPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(word|docx)\b/i,
    /\b(word|docx)\s*(document|doc|file)?\b/i,
    /\beditable\s*(document|doc)\b/i,
  ];

  // Check in priority order: PDF -> Excel -> PowerPoint -> Word
  if (pdfPatterns.some((pattern) => pattern.test(lowerContent))) return 'pdf';
  if (excelPatterns.some((pattern) => pattern.test(lowerContent))) return 'xlsx';
  if (pptxPatterns.some((pattern) => pattern.test(lowerContent))) return 'pptx';
  if (docxPatterns.some((pattern) => pattern.test(lowerContent))) return 'docx';

  return null;
}

/**
 * Check if a chat title is generic/low-quality and should be regenerated
 * Returns true if the title is generic like "Initial Greeting", "Hello", "New Chat", etc.
 */
export function isGenericTitle(title: string | undefined): boolean {
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

  return genericPatterns.some((pattern) => pattern.test(title.trim()));
}

/**
 * Format Composio action success messages in a user-friendly way
 * Instead of showing raw JSON, display clean confirmation messages
 */
export function formatActionSuccessMessage(
  platform: string,
  action: string,
  _data: unknown
): string {
  const platformLower = platform.toLowerCase();
  const actionLower = action.toLowerCase();

  // Gmail
  if (platformLower === 'gmail') {
    if (actionLower.includes('send')) {
      return '✉️ Email sent successfully!';
    }
    if (actionLower.includes('draft')) {
      return '📝 Draft saved successfully!';
    }
    if (actionLower.includes('reply')) {
      return '↩️ Reply sent successfully!';
    }
    return `✉️ ${action} completed successfully!`;
  }

  // Twitter/X
  if (platformLower === 'twitter' || platformLower === 'x') {
    if (actionLower.includes('retweet')) {
      return '🔁 Retweeted successfully!';
    }
    if (actionLower.includes('tweet') || actionLower.includes('post')) {
      return '🐦 Tweet posted successfully!';
    }
    if (actionLower.includes('like')) {
      return '❤️ Liked successfully!';
    }
    return `🐦 ${action} completed successfully!`;
  }

  // Slack
  if (platformLower === 'slack') {
    if (actionLower.includes('message') || actionLower.includes('send')) {
      return '💬 Slack message sent successfully!';
    }
    return `💬 ${action} completed successfully!`;
  }

  // LinkedIn
  if (platformLower === 'linkedin') {
    if (actionLower.includes('post')) {
      return '💼 LinkedIn post published successfully!';
    }
    if (actionLower.includes('message')) {
      return '💼 LinkedIn message sent successfully!';
    }
    return `💼 ${action} completed successfully!`;
  }

  // Google Calendar
  if (platformLower === 'googlecalendar' || platformLower === 'google calendar') {
    if (actionLower.includes('create') || actionLower.includes('event')) {
      return '📅 Calendar event created successfully!';
    }
    if (actionLower.includes('update')) {
      return '📅 Calendar event updated successfully!';
    }
    if (actionLower.includes('delete')) {
      return '📅 Calendar event deleted successfully!';
    }
    return `📅 ${action} completed successfully!`;
  }

  // Google Drive
  if (platformLower === 'googledrive' || platformLower === 'google drive') {
    if (actionLower.includes('upload')) {
      return '📁 File uploaded to Drive successfully!';
    }
    if (actionLower.includes('create')) {
      return '📁 File created in Drive successfully!';
    }
    if (actionLower.includes('share')) {
      return '🔗 File shared successfully!';
    }
    return `📁 ${action} completed successfully!`;
  }

  // Notion
  if (platformLower === 'notion') {
    if (actionLower.includes('page') || actionLower.includes('create')) {
      return '📓 Notion page created successfully!';
    }
    if (actionLower.includes('update')) {
      return '📓 Notion page updated successfully!';
    }
    return `📓 ${action} completed successfully!`;
  }

  // GitHub
  if (platformLower === 'github') {
    if (actionLower.includes('issue')) {
      return '🐙 GitHub issue created successfully!';
    }
    if (actionLower.includes('pr') || actionLower.includes('pull')) {
      return '🐙 Pull request created successfully!';
    }
    if (actionLower.includes('commit')) {
      return '🐙 Committed successfully!';
    }
    return `🐙 ${action} completed successfully!`;
  }

  // Trello
  if (platformLower === 'trello') {
    if (actionLower.includes('card')) {
      return '📋 Trello card created successfully!';
    }
    return `📋 ${action} completed successfully!`;
  }

  // Asana
  if (platformLower === 'asana') {
    if (actionLower.includes('task')) {
      return '✅ Asana task created successfully!';
    }
    return `✅ ${action} completed successfully!`;
  }

  // Discord
  if (platformLower === 'discord') {
    if (actionLower.includes('message') || actionLower.includes('send')) {
      return '🎮 Discord message sent successfully!';
    }
    return `🎮 ${action} completed successfully!`;
  }

  // Default fallback - clean message without raw data
  return `✅ ${action} on ${platform} completed successfully!`;
}
