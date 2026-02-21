/**
 * CHAT UTILITY FUNCTIONS
 *
 * Pure utility functions extracted from ChatClient.tsx for better modularity.
 * These have no React dependencies and can be tested independently.
 */

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
    if (actionLower.includes('tweet') || actionLower.includes('post')) {
      return '🐦 Tweet posted successfully!';
    }
    if (actionLower.includes('retweet')) {
      return '🔁 Retweeted successfully!';
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
