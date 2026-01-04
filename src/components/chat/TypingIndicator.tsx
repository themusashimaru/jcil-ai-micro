/**
 * TYPING INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Show INTELLIGENT loading messages while AI is processing
 * - Analyzes user input to show contextual status messages
 * - Cycles through relevant status updates
 * - Provides visual feedback during streaming
 *
 * INTELLIGENT MESSAGE SELECTION:
 * - Website generation: Shows logo, layout, design progress
 * - Image generation: Shows artistic process
 * - Documents: Shows formatting/export progress
 * - Code: Shows syntax analysis
 * - Search: Shows research progress
 * - Default: Professional generic messages
 */

'use client';

import { useEffect, useState, useMemo } from 'react';

// Document-specific messages
const DOCUMENT_MESSAGES: Record<string, string[]> = {
  pdf: [
    'Creating your PDF...',
    'Formatting document layout...',
    'Setting up margins and spacing...',
    'Applying professional styling...',
    'Generating downloadable PDF...',
    'Almost ready...',
  ],
  docx: [
    'Creating your Word document...',
    'Formatting headers and styles...',
    'Setting up document structure...',
    'Applying professional layout...',
    'Generating downloadable document...',
    'Almost ready...',
  ],
  xlsx: [
    'Creating your spreadsheet...',
    'Formatting columns and rows...',
    'Applying data formatting...',
    'Setting up formulas...',
    'Generating downloadable Excel file...',
    'Almost ready...',
  ],
  pptx: [
    'Creating your presentation...',
    'Designing slide layouts...',
    'Formatting content...',
    'Applying professional styling...',
    'Generating downloadable PowerPoint...',
    'Almost ready...',
  ],
};

// Generic fallback messages
const GENERIC_MESSAGES = [
  'Analyzing your request...',
  'Processing information...',
  'Synthesizing response...',
  'Generating insights...',
  'Crafting your answer...',
  'Almost there...',
];

/**
 * Generate intelligent status messages based on user input
 */
function getIntelligentMessages(userMessage: string): string[] {
  if (!userMessage) return GENERIC_MESSAGES;

  const msg = userMessage.toLowerCase();

  // Website generation
  if (msg.match(/website|landing\s*page|web\s*page|site\s+for|build.*site/i)) {
    // Try to extract business name or industry
    const businessMatch = userMessage.match(/(?:for|called|named)\s+["']?([^"'\n,]+)/i);
    const business = businessMatch ? businessMatch[1].trim().substring(0, 20) : 'your business';

    // Detect industry
    let industry = 'your';
    if (msg.match(/photography|photo/i)) industry = 'photography';
    else if (msg.match(/restaurant|food|cafe|coffee/i)) industry = 'restaurant';
    else if (msg.match(/salon|beauty|spa|nail/i)) industry = 'beauty';
    else if (msg.match(/dental|dentist|clinic/i)) industry = 'dental';
    else if (msg.match(/law|attorney|legal/i)) industry = 'law firm';
    else if (msg.match(/gym|fitness|yoga/i)) industry = 'fitness';
    else if (msg.match(/real\s*estate|realtor/i)) industry = 'real estate';
    else if (msg.match(/agency|marketing|creative/i)) industry = 'agency';
    else if (msg.match(/tech|startup|saas|ai/i)) industry = 'tech startup';
    else if (msg.match(/ecommerce|shop|store/i)) industry = 'e-commerce';
    else if (msg.match(/portfolio|personal/i)) industry = 'portfolio';

    return [
      `Analyzing ${industry} business needs...`,
      `Researching ${industry} industry trends...`,
      `Generating custom logo for ${business}...`,
      `Creating hero section imagery...`,
      `Building responsive layouts...`,
      `Adding contact forms and CTAs...`,
      `Optimizing for conversions...`,
      `Polishing the final design...`,
    ];
  }

  // Image generation
  if (msg.match(/generate.*image|create.*image|draw|design|logo|illustration|picture of/i)) {
    return [
      'Analyzing your vision...',
      'Generating artistic concepts...',
      'Applying creative direction...',
      'Refining visual details...',
      'Enhancing composition...',
      'Finalizing your image...',
    ];
  }

  // Code generation
  if (msg.match(/code|function|component|implement|write.*script|debug|fix.*bug/i)) {
    return [
      'Analyzing requirements...',
      'Designing solution architecture...',
      'Writing clean code...',
      'Adding best practices...',
      'Testing edge cases...',
      'Optimizing performance...',
    ];
  }

  // Research/search
  if (msg.match(/search|find|research|look up|what is|who is|explain|tell me about/i)) {
    return [
      'Searching knowledge base...',
      'Gathering relevant sources...',
      'Cross-referencing information...',
      'Synthesizing findings...',
      'Preparing comprehensive answer...',
    ];
  }

  // Resume/career
  if (msg.match(/resume|cv|cover letter|job|career/i)) {
    return [
      'Analyzing your experience...',
      'Optimizing for ATS systems...',
      'Crafting compelling language...',
      'Formatting professionally...',
      'Finalizing your document...',
    ];
  }

  // Business/marketing
  if (msg.match(/business plan|marketing|strategy|pitch|proposal/i)) {
    return [
      'Analyzing market dynamics...',
      'Researching industry standards...',
      'Developing strategic recommendations...',
      'Crafting compelling narrative...',
      'Finalizing your plan...',
    ];
  }

  // Translation
  if (msg.match(/translate|translation|spanish|french|chinese|japanese|german/i)) {
    return [
      'Analyzing source text...',
      'Understanding context...',
      'Translating with nuance...',
      'Preserving meaning...',
      'Finalizing translation...',
    ];
  }

  // Math/calculations
  if (msg.match(/calculate|math|equation|solve|formula/i)) {
    return [
      'Parsing the problem...',
      'Applying formulas...',
      'Computing results...',
      'Verifying calculations...',
      'Preparing solution...',
    ];
  }

  return GENERIC_MESSAGES;
}

interface TypingIndicatorProps {
  documentType?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | null;
  userMessage?: string; // The user's last message for intelligent status
}

export function TypingIndicator({ documentType, userMessage }: TypingIndicatorProps = {}) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Select messages based on document type or user message
  const messages = useMemo(() => {
    // Document type takes priority
    if (documentType && DOCUMENT_MESSAGES[documentType]) {
      return DOCUMENT_MESSAGES[documentType];
    }
    // Otherwise, use intelligent messages based on user input
    return getIntelligentMessages(userMessage || '');
  }, [documentType, userMessage]);

  useEffect(() => {
    // Reset index when context changes
    setMessageIndex(0);
  }, [documentType, userMessage]);

  useEffect(() => {
    // Rotate through messages - slower for documents since they take longer
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, documentType ? 3000 : 2500);

    return () => clearInterval(interval);
  }, [documentType, messages.length]);

  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      {/* AI Avatar */}
      <div
        className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--primary-hover)', color: 'var(--primary)' }}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      </div>

      {/* Typing Message */}
      <div className="flex-1 space-y-2">
        <div
          className="inline-block rounded-lg px-4 py-3"
          style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            {/* Animated dots with gradient colors */}
            <div className="flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '300ms' }} />
            </div>

            {/* Intelligent status message */}
            <span className="text-sm font-medium transition-all duration-300" style={{ color: 'var(--text-secondary)' }}>
              {messages[messageIndex]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
