/**
 * TYPING INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Show a single, intelligent status message while the AI is processing
 * - Derives context from the user's actual query — no canned rotation, no fake phases
 * - Clean and professional — shows ONE relevant message, then the real stream takes over
 *
 * DESIGN:
 * - Minimal: avatar + one contextual status line + cursor
 * - No boot sequence, no terminal theater, no typewriter effect
 * - Document generation gets specific progress messages (these take longer)
 * - Regular chat gets one smart message that stays until text arrives
 */

'use client';

import { useEffect, useState, useMemo } from 'react';

// Document generation takes time — show specific phase progress
const DOCUMENT_MESSAGES: Record<string, string[]> = {
  pdf: [
    'Structuring your PDF...',
    'Formatting layout and styles...',
    'Generating downloadable PDF...',
  ],
  docx: [
    'Structuring your document...',
    'Formatting headers and styles...',
    'Generating downloadable document...',
  ],
  xlsx: [
    'Building your spreadsheet...',
    'Formatting columns and data...',
    'Generating downloadable file...',
  ],
  pptx: [
    'Designing your slides...',
    'Formatting content and layout...',
    'Generating downloadable presentation...',
  ],
};

/**
 * Extract the core subject from a user query.
 * Strips common prefixes and filler words to get the real topic.
 */
function extractTopic(message: string): string {
  if (!message) return '';

  const cleaned = message
    .replace(
      /^(can you |please |i want to |i need to |help me |tell me |what is |what are |who is |who are |where is |where are |when is |when are |how to |how do |how does |how can |why is |why are |explain |describe |find |search |research |look up |give me |show me |get me )/i,
      ''
    )
    .replace(/\?$/, '')
    .trim();

  const words = cleaned.split(/\s+/);

  const fillerWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'between',
    'and',
    'but',
    'if',
    'or',
    'because',
    'as',
    'until',
    'while',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'it',
    'its',
    'they',
    'them',
    'their',
    'this',
    'that',
    'these',
    'those',
    'so',
    'very',
    'just',
    'not',
    'no',
  ]);

  const meaningful = words
    .filter((w) => !fillerWords.has(w.toLowerCase()) && w.length > 2)
    .slice(0, 4);

  if (meaningful.length === 0) return words.slice(0, 3).join(' ');

  const topic = meaningful.join(' ');
  return topic.charAt(0).toUpperCase() + topic.slice(1).toLowerCase();
}

/**
 * Get ONE smart status message based on what the user actually asked.
 * No rotation — this shows until real stream text replaces it.
 */
function getStatusMessage(userMessage: string): string {
  if (!userMessage) return 'Thinking...';

  const msg = userMessage.toLowerCase();
  const topic = extractTopic(userMessage);
  const short = topic.length > 35 ? topic.substring(0, 35) + '...' : topic;

  // Website generation
  if (msg.match(/website|landing\s*page|web\s*page|site\s+for|build.*site/i)) {
    const businessMatch = userMessage.match(/(?:for|called|named)\s+["']?([^"'\n,]+)/i);
    const biz = businessMatch ? businessMatch[1].trim().substring(0, 25) : null;
    return biz ? `Building website for ${biz}...` : 'Designing your website...';
  }

  // Image generation
  if (msg.match(/generate.*image|create.*image|draw|design.*logo|illustration|picture of/i)) {
    return `Creating "${short}"...`;
  }

  // Code
  if (msg.match(/code|function|component|implement|write.*script|debug|fix.*bug/i)) {
    return short ? `Working on ${short}...` : 'Writing code...';
  }

  // Research
  if (msg.match(/research|investigate|deep dive|comprehensive|analyze|study/i)) {
    return short ? `Researching ${short}...` : 'Researching...';
  }

  // Search / lookup
  if (msg.match(/search|find|look up|what is|who is|what are|who are|tell me about/i)) {
    return short ? `Looking up ${short}...` : 'Searching...';
  }

  // Document creation (resume, plan, etc.)
  if (msg.match(/resume|cv|cover letter|business plan|proposal|pitch/i)) {
    return short ? `Drafting ${short}...` : 'Drafting your document...';
  }

  // Translation
  if (msg.match(/translate|translation|spanish|french|chinese|japanese|german|korean/i)) {
    return 'Translating...';
  }

  // Math
  if (msg.match(/calculate|math|equation|solve|formula/i)) {
    return 'Calculating...';
  }

  // Comparison
  if (msg.match(/compare|versus|vs|difference|better|which one|pros and cons/i)) {
    return short ? `Comparing ${short}...` : 'Comparing options...';
  }

  // How-to
  if (msg.match(/how to|how do|how can|tutorial|guide|steps|instructions|explain/i)) {
    return short ? `Thinking about ${short}...` : 'Thinking...';
  }

  // Default — use the topic if we have one
  if (short && short.length > 3) {
    return `Thinking about ${short}...`;
  }

  return 'Thinking...';
}

interface TypingIndicatorProps {
  documentType?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | null;
  userMessage?: string;
  /** @deprecated No longer used — kept for backwards compat */
  showBootSequence?: boolean;
  /** @deprecated No longer used — kept for backwards compat */
  showNeuralThinking?: boolean;
}

export function TypingIndicator({ documentType, userMessage }: TypingIndicatorProps = {}) {
  const [docMessageIndex, setDocMessageIndex] = useState(0);

  // For document generation, cycle through phase-specific messages
  const docMessages = useMemo(() => {
    if (documentType && DOCUMENT_MESSAGES[documentType]) {
      return DOCUMENT_MESSAGES[documentType];
    }
    return null;
  }, [documentType]);

  // For regular chat, derive ONE message from the query
  const statusMessage = useMemo(() => {
    if (docMessages) return docMessages[0]; // Will be overridden by rotation
    return getStatusMessage(userMessage || '');
  }, [docMessages, userMessage]);

  // Only rotate for document generation (takes longer, needs progress feel)
  useEffect(() => {
    if (!docMessages) return;
    setDocMessageIndex(0);

    const interval = setInterval(() => {
      setDocMessageIndex((prev) => (prev + 1) % docMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [docMessages]);

  const displayText = docMessages ? docMessages[docMessageIndex] : statusMessage;

  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      {/* AI Avatar */}
      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--avatar-bg)] text-primary">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      </div>

      {/* Status Message */}
      <div className="flex-1">
        <div className="inline-block rounded-lg px-4 py-3 bg-glass border border-theme">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium transition-all duration-300 text-text-secondary">
              {displayText}
              <span className="inline-block ml-0.5 text-primary animate-[blink_1s_step-end_infinite]">
                ▋
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
