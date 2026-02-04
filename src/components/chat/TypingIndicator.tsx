/**
 * TYPING INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Show INTELLIGENT, CONTEXT-AWARE loading messages while AI is processing
 * - Extracts the actual TOPIC from user's query and incorporates it
 * - Like ChatGPT/Claude - shows what it's actually doing
 * - Provides engaging visual feedback during streaming
 *
 * INTELLIGENT MESSAGE SELECTION:
 * - Extracts key topics/subjects from user query
 * - Search: "Searching for [topic]...", "Analyzing [topic]..."
 * - Website: Shows industry-specific progress
 * - Documents: Shows formatting progress
 * - Research: Shows research phases with topics
 * - Default: Uses extracted topic in generic messages
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

/**
 * Extract the main topic/subject from a user query
 * This is what makes the messages intelligent
 */
function extractTopic(message: string): string {
  if (!message) return '';

  // Remove common question starters and clean up
  const cleaned = message
    .replace(
      /^(can you |please |i want to |i need to |help me |tell me |what is |what are |who is |who are |where is |where are |when is |when are |how to |how do |how does |how can |why is |why are |explain |describe |find |search |research |look up |give me |show me |get me )/i,
      ''
    )
    .replace(/\?$/, '')
    .trim();

  // Extract the core subject (usually first 3-6 meaningful words)
  const words = cleaned.split(/\s+/);

  // Filter out filler words
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
    'dare',
    'ought',
    'used',
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
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'and',
    'but',
    'if',
    'or',
    'because',
    'as',
    'until',
    'while',
    'although',
    'i',
    'me',
    'my',
    'myself',
    'we',
    'our',
    'ours',
    'you',
    'your',
    'yours',
    'it',
    'its',
    'itself',
    'they',
    'them',
    'their',
    'this',
    'that',
    'these',
    'those',
  ]);

  // Get meaningful words (up to 5)
  const meaningfulWords = words
    .filter((w) => !fillerWords.has(w.toLowerCase()) && w.length > 2)
    .slice(0, 5);

  if (meaningfulWords.length === 0) {
    // Fallback: just use first few words
    return words.slice(0, 3).join(' ');
  }

  // Capitalize first letter of result
  const topic = meaningfulWords.join(' ');
  return topic.charAt(0).toUpperCase() + topic.slice(1).toLowerCase();
}

/**
 * Generate intelligent status messages based on user input
 * NOW WITH DYNAMIC TOPIC EXTRACTION
 */
function getIntelligentMessages(userMessage: string): string[] {
  if (!userMessage) return getGenericMessages('');

  const msg = userMessage.toLowerCase();
  const topic = extractTopic(userMessage);
  const shortTopic = topic.length > 30 ? topic.substring(0, 30) + '...' : topic;

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
  if (msg.match(/generate.*image|create.*image|draw|design.*logo|illustration|picture of/i)) {
    return [
      `Visualizing "${shortTopic}"...`,
      `Generating artistic concepts...`,
      `Applying creative direction...`,
      `Refining visual details...`,
      `Enhancing composition...`,
      `Finalizing your image...`,
    ];
  }

  // Code generation
  if (msg.match(/code|function|component|implement|write.*script|debug|fix.*bug/i)) {
    return [
      `Analyzing ${shortTopic} requirements...`,
      `Designing solution architecture...`,
      `Writing clean code...`,
      `Adding best practices...`,
      `Testing edge cases...`,
      `Optimizing performance...`,
    ];
  }

  // Research/deep research
  if (msg.match(/research|investigate|deep dive|comprehensive|analyze|study/i)) {
    return [
      `Researching "${shortTopic}"...`,
      `Gathering multiple sources...`,
      `Analyzing ${shortTopic} data...`,
      `Cross-referencing findings...`,
      `Evaluating source quality...`,
      `Synthesizing insights on ${shortTopic}...`,
      `Preparing comprehensive report...`,
    ];
  }

  // Search/lookup - MAKE VERY SPECIFIC
  if (msg.match(/search|find|look up|what is|who is|what are|who are|tell me about|explain/i)) {
    return [
      `Searching for "${shortTopic}"...`,
      `Finding information on ${shortTopic}...`,
      `Gathering relevant data...`,
      `Analyzing ${shortTopic} details...`,
      `Synthesizing response...`,
    ];
  }

  // Questions about places
  if (
    msg.match(
      /where|location|travel|visit|country|city|state|region|destination|trip|vacation|hotel/i
    )
  ) {
    return [
      `Searching for ${shortTopic}...`,
      `Finding location information...`,
      `Gathering travel details...`,
      `Checking relevant facts...`,
      `Preparing your answer...`,
    ];
  }

  // Questions about people
  if (msg.match(/who is|who was|person|ceo|founder|actor|singer|president|leader/i)) {
    return [
      `Looking up ${shortTopic}...`,
      `Finding biographical info...`,
      `Gathering relevant details...`,
      `Verifying information...`,
      `Preparing response...`,
    ];
  }

  // Questions about products/services
  if (msg.match(/price|cost|buy|purchase|product|service|best|top|recommend|review/i)) {
    return [
      `Searching for ${shortTopic}...`,
      `Comparing options...`,
      `Analyzing ${shortTopic} details...`,
      `Evaluating recommendations...`,
      `Preparing your answer...`,
    ];
  }

  // Weather
  if (msg.match(/weather|temperature|forecast|rain|snow|sunny|cloudy|storm/i)) {
    return [
      `Checking weather for ${shortTopic}...`,
      `Fetching forecast data...`,
      `Analyzing conditions...`,
      `Preparing weather report...`,
    ];
  }

  // Sports
  if (msg.match(/score|game|match|nfl|nba|mlb|nhl|soccer|football|basketball|team|player/i)) {
    return [
      `Looking up ${shortTopic}...`,
      `Fetching sports data...`,
      `Checking latest scores...`,
      `Gathering team info...`,
      `Preparing your answer...`,
    ];
  }

  // Stocks/finance
  if (msg.match(/stock|share|market|invest|price|nasdaq|nyse|crypto|bitcoin|ethereum/i)) {
    return [
      `Fetching ${shortTopic} data...`,
      `Analyzing market info...`,
      `Checking latest prices...`,
      `Gathering financial data...`,
      `Preparing your answer...`,
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
      `Analyzing ${shortTopic}...`,
      'Researching market dynamics...',
      'Developing recommendations...',
      'Crafting compelling narrative...',
      'Finalizing your plan...',
    ];
  }

  // Translation
  if (msg.match(/translate|translation|spanish|french|chinese|japanese|german|korean/i)) {
    return [
      'Analyzing source text...',
      'Understanding context...',
      `Translating "${shortTopic}"...`,
      'Preserving meaning...',
      'Finalizing translation...',
    ];
  }

  // Math/calculations
  if (msg.match(/calculate|math|equation|solve|formula/i)) {
    return [
      `Parsing ${shortTopic}...`,
      'Applying formulas...',
      'Computing results...',
      'Verifying calculations...',
      'Preparing solution...',
    ];
  }

  // How-to questions
  if (msg.match(/how to|how do|how can|tutorial|guide|steps|instructions/i)) {
    return [
      `Researching "${shortTopic}"...`,
      'Finding best practices...',
      'Organizing steps...',
      'Preparing instructions...',
      'Finalizing guide...',
    ];
  }

  // Comparison questions
  if (msg.match(/compare|versus|vs|difference|better|which one|pros and cons/i)) {
    return [
      `Comparing ${shortTopic}...`,
      'Analyzing differences...',
      'Evaluating pros and cons...',
      'Preparing comparison...',
    ];
  }

  // Default: use the extracted topic in generic messages
  return getGenericMessages(shortTopic);
}

/**
 * Get generic messages, optionally with a topic
 */
function getGenericMessages(topic: string): string[] {
  if (topic && topic.length > 3) {
    return [
      `Thinking about "${topic}"...`,
      `Processing your request...`,
      `Analyzing ${topic}...`,
      `Gathering information...`,
      `Synthesizing response...`,
      `Almost there...`,
    ];
  }

  return [
    'Thinking...',
    'Processing your request...',
    'Analyzing information...',
    'Generating response...',
    'Crafting your answer...',
    'Almost there...',
  ];
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
    const interval = setInterval(
      () => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
      },
      documentType ? 3000 : 2500
    );

    return () => clearInterval(interval);
  }, [documentType, messages.length]);

  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      {/* AI Avatar */}
      <div
        className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--primary)' }}
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
          <div className="flex items-center gap-2">
            {/* Intelligent status message */}
            <span
              className="text-sm font-medium transition-all duration-300"
              style={{ color: 'var(--text-secondary)' }}
            >
              {messages[messageIndex]}
            </span>
            {/* Blinking cursor - terminal style */}
            <span
              className="inline-block"
              style={{
                color: 'var(--primary)',
                animation: 'blink 1s step-end infinite',
                fontSize: '1rem',
                lineHeight: 1,
              }}
            >
              ▋
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
