import { describe, it, expect } from 'vitest';
import type { CoreMessage } from 'ai';

import {
  MAX_RESPONSE_TOKENS,
  DEFAULT_RESPONSE_TOKENS,
  MAX_CONTEXT_MESSAGES,
  extractKeyPoints,
  truncateMessages,
  clampMaxTokens,
  getLastUserContent,
  getImageAttachments,
  findPreviousGeneratedImage,
  sanitizeToolError,
} from '../helpers';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Shorthand for a user message with string content. */
function userMsg(text: string): CoreMessage {
  return { role: 'user', content: text };
}

/** Shorthand for an assistant message with string content. */
function assistantMsg(text: string): CoreMessage {
  return { role: 'assistant', content: text };
}

/** Shorthand for a system message with string content. */
function systemMsg(text: string): CoreMessage {
  return { role: 'system', content: text };
}

/** Create a string of length `n` using a repeating character. */
function repeat(char: string, n: number): string {
  return char.repeat(n);
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('MAX_RESPONSE_TOKENS is 4096', () => {
    expect(MAX_RESPONSE_TOKENS).toBe(4096);
  });

  it('DEFAULT_RESPONSE_TOKENS is 2048', () => {
    expect(DEFAULT_RESPONSE_TOKENS).toBe(2048);
  });

  it('MAX_CONTEXT_MESSAGES is 60', () => {
    expect(MAX_CONTEXT_MESSAGES).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// extractKeyPoints
// ---------------------------------------------------------------------------

describe('extractKeyPoints', () => {
  it('returns an empty array for an empty message list', () => {
    expect(extractKeyPoints([])).toEqual([]);
  });

  it('skips messages with content shorter than 20 characters', () => {
    const messages: CoreMessage[] = [
      userMsg('short'),
      userMsg('also too short'),
      assistantMsg('tiny'),
    ];
    expect(extractKeyPoints(messages)).toEqual([]);
  });

  it('includes messages with exactly 20 characters', () => {
    // 20 chars: "12345678901234567890"
    const text = repeat('a', 20);
    const messages: CoreMessage[] = [userMsg(text)];
    expect(extractKeyPoints(messages)).toEqual([`User asked: ${text}`]);
  });

  it('does not include messages with 19 characters', () => {
    const text = repeat('a', 19);
    expect(extractKeyPoints([userMsg(text)])).toEqual([]);
  });

  it('prefixes user messages with "User asked:"', () => {
    const text = 'How do I set up authentication in NextJS?';
    expect(extractKeyPoints([userMsg(text)])).toEqual([`User asked: ${text}`]);
  });

  it('prefixes assistant messages with "Assistant responded:"', () => {
    const text = 'Here is how you can set up authentication.';
    expect(extractKeyPoints([assistantMsg(text)])).toEqual([`Assistant responded: ${text}`]);
  });

  it('ignores system messages entirely', () => {
    const text = 'You are a helpful assistant that always responds politely.';
    expect(extractKeyPoints([systemMsg(text)])).toEqual([]);
  });

  it('truncates content longer than 150 characters and appends "..."', () => {
    const longText = repeat('x', 200);
    const result = extractKeyPoints([userMsg(longText)]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(`User asked: ${longText.substring(0, 150)}...`);
  });

  it('does not truncate content that is exactly 150 characters', () => {
    const text = repeat('z', 150);
    const result = extractKeyPoints([userMsg(text)]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(`User asked: ${text}`);
    expect(result[0]).not.toContain('...');
  });

  it('limits output to at most 10 key points', () => {
    const messages: CoreMessage[] = Array.from({ length: 20 }, (_, i) =>
      userMsg(`This is message number ${i} with enough text to pass the length filter.`)
    );
    const result = extractKeyPoints(messages);

    expect(result).toHaveLength(10);
  });

  it('handles array content with text parts', () => {
    const message: CoreMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'This is part one of the question I am asking you today.' }],
    };
    const result = extractKeyPoints([message]);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('User asked:');
    expect(result[0]).toContain('This is part one of the question I am asking you today.');
  });

  it('concatenates multiple text parts from array content', () => {
    const message: CoreMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'First part of the longer message content.' },
        { type: 'text', text: 'Second part of the longer message content.' },
      ],
    };
    const result = extractKeyPoints([message]);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('First part');
    expect(result[0]).toContain('Second part');
  });

  it('ignores non-text parts in array content', () => {
    const message: CoreMessage = {
      role: 'user',
      content: [{ type: 'image', image: new URL('https://example.com/img.png') }],
    };
    // No text extracted, content is empty, length < 20
    expect(extractKeyPoints([message])).toEqual([]);
  });

  it('handles a mix of user and assistant messages', () => {
    const messages: CoreMessage[] = [
      userMsg('What is the capital of France? I really need to know this.'),
      assistantMsg('The capital of France is Paris, a beautiful city.'),
    ];
    const result = extractKeyPoints(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatch(/^User asked:/);
    expect(result[1]).toMatch(/^Assistant responded:/);
  });
});

// ---------------------------------------------------------------------------
// truncateMessages
// ---------------------------------------------------------------------------

describe('truncateMessages', () => {
  it('returns messages unchanged when count is within the limit', () => {
    const messages: CoreMessage[] = [userMsg('Hello'), assistantMsg('Hi')];
    const result = truncateMessages(messages, 10);
    expect(result).toEqual(messages);
  });

  it('returns messages unchanged when count equals the limit', () => {
    const messages: CoreMessage[] = Array.from({ length: 5 }, (_, i) =>
      userMsg(`Message ${i} with enough text to be reasonable.`)
    );
    const result = truncateMessages(messages, 5);
    expect(result).toEqual(messages);
  });

  it('uses default MAX_CONTEXT_MESSAGES when no maxMessages is provided', () => {
    const messages: CoreMessage[] = Array.from({ length: 50 }, (_, i) => userMsg(`Message ${i}`));
    // 50 < 60 (MAX_CONTEXT_MESSAGES), so no truncation
    const result = truncateMessages(messages);
    expect(result).toEqual(messages);
  });

  it('truncates messages exceeding the limit and inserts a summary', () => {
    // Create more messages than the limit
    const maxMessages = 5;
    const messages: CoreMessage[] = [
      systemMsg('System instructions go here at the start of the conversation.'),
      userMsg('First user question that has enough characters to pass the filter.'),
      assistantMsg('First assistant answer that has enough characters to pass the filter.'),
      userMsg('Second user question that has enough characters to pass the filter.'),
      assistantMsg('Second assistant answer that has enough characters to pass the filter.'),
      userMsg('Third user question that has enough characters to pass the filter.'),
      assistantMsg('Third assistant answer that has enough characters to pass the filter.'),
      userMsg('Last user question that is the final one in the conversation.'),
    ];

    const result = truncateMessages(messages, maxMessages);

    // Should keep the first message, add a summary, and keep the last (maxMessages - 2) = 3 messages
    expect(result.length).toBe(maxMessages);
    expect(result[0]).toEqual(messages[0]); // first message preserved

    // The second message should be a summary
    const summaryMsg = result[1];
    expect(summaryMsg.role).toBe('user');
    expect(typeof summaryMsg.content).toBe('string');
    expect(summaryMsg.content as string).toContain('[CONVERSATION CONTEXT');
    expect(summaryMsg.content as string).toContain('[Context from earlier in our conversation]');

    // The last (maxMessages - 2) messages should be the tail of the original
    const expectedTail = messages.slice(-(maxMessages - 2));
    expect(result.slice(2)).toEqual(expectedTail);
  });

  it('preserves the first message (system context) during truncation', () => {
    const first = systemMsg('You are a helpful assistant for the JCIL AI platform.');
    const messages: CoreMessage[] = [
      first,
      ...Array.from({ length: 10 }, (_, i) =>
        userMsg(`Message ${i} with enough text to be long enough for the filter check.`)
      ),
    ];

    const result = truncateMessages(messages, 5);
    expect(result[0]).toEqual(first);
  });

  it('handles the edge case where toSummarize has no qualifying messages (all < 20 chars)', () => {
    const messages: CoreMessage[] = [
      systemMsg('System'),
      userMsg('Hi'), // < 20 chars
      userMsg('Ok'), // < 20 chars
      userMsg('Sure'), // < 20 chars
      userMsg('The final qualifying user message in this conversation right here.'),
    ];

    const result = truncateMessages(messages, 4);

    // toSummarize = messages.slice(1, -(4-2)) = messages.slice(1, -2) = [Hi, Ok]
    // Key points are empty (both < 20 chars), but summary is still inserted
    const summaryMsg = result[1];
    expect(summaryMsg.role).toBe('user');
    expect(summaryMsg.content as string).toContain('[CONVERSATION CONTEXT');
    expect(summaryMsg.content as string).toContain('summarizes 2 earlier messages');
  });

  it('returns first + last messages when maxMessages is 3', () => {
    const messages: CoreMessage[] = [
      systemMsg('System message that initializes the conversation context for the AI.'),
      userMsg('Question one that is long enough to pass the twenty character filter check.'),
      userMsg('Question two that is long enough to pass the twenty character filter check.'),
      userMsg('Question three is the final one in the conversation history being tested.'),
    ];

    const result = truncateMessages(messages, 3);

    // keepFirst = messages[0], keepLast = messages.slice(-1), summary from messages[1..2]
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(messages[0]);
    expect(result[2]).toEqual(messages[3]);
  });

  it('handles an empty messages array gracefully', () => {
    expect(truncateMessages([], 5)).toEqual([]);
  });

  it('handles a single message array', () => {
    const messages: CoreMessage[] = [userMsg('Only message')];
    expect(truncateMessages(messages, 5)).toEqual(messages);
  });
});

// ---------------------------------------------------------------------------
// clampMaxTokens
// ---------------------------------------------------------------------------

describe('clampMaxTokens', () => {
  it('returns DEFAULT_RESPONSE_TOKENS when no argument is provided', () => {
    expect(clampMaxTokens()).toBe(DEFAULT_RESPONSE_TOKENS);
  });

  it('returns DEFAULT_RESPONSE_TOKENS when undefined is passed', () => {
    expect(clampMaxTokens(undefined)).toBe(DEFAULT_RESPONSE_TOKENS);
  });

  it('returns DEFAULT_RESPONSE_TOKENS when 0 is passed (falsy)', () => {
    expect(clampMaxTokens(0)).toBe(DEFAULT_RESPONSE_TOKENS);
  });

  it('returns the requested value when it is within the valid range', () => {
    expect(clampMaxTokens(1024)).toBe(1024);
    expect(clampMaxTokens(2048)).toBe(2048);
    expect(clampMaxTokens(3000)).toBe(3000);
  });

  it('clamps to the minimum of 256 when a smaller value is requested', () => {
    expect(clampMaxTokens(1)).toBe(256);
    expect(clampMaxTokens(100)).toBe(256);
    expect(clampMaxTokens(255)).toBe(256);
  });

  it('returns exactly 256 for the boundary value of 256', () => {
    expect(clampMaxTokens(256)).toBe(256);
  });

  it('clamps to MAX_RESPONSE_TOKENS when a larger value is requested', () => {
    expect(clampMaxTokens(5000)).toBe(MAX_RESPONSE_TOKENS);
    expect(clampMaxTokens(99999)).toBe(MAX_RESPONSE_TOKENS);
  });

  it('returns exactly MAX_RESPONSE_TOKENS for the boundary value', () => {
    expect(clampMaxTokens(MAX_RESPONSE_TOKENS)).toBe(MAX_RESPONSE_TOKENS);
  });

  it('returns DEFAULT_RESPONSE_TOKENS for NaN (falsy)', () => {
    expect(clampMaxTokens(NaN)).toBe(DEFAULT_RESPONSE_TOKENS);
  });
});

// ---------------------------------------------------------------------------
// getLastUserContent
// ---------------------------------------------------------------------------

describe('getLastUserContent', () => {
  it('returns the string content of the last message', () => {
    const messages: CoreMessage[] = [
      userMsg('first'),
      userMsg('second'),
      userMsg('last message content'),
    ];
    expect(getLastUserContent(messages)).toBe('last message content');
  });

  it('extracts text from array content parts', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'World' },
        ],
      },
    ];
    expect(getLastUserContent(messages)).toBe('Hello World');
  });

  it('filters out non-text parts from array content', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image', image: new URL('https://example.com/img.png') },
          { type: 'text', text: 'Describe this image please' },
        ],
      },
    ];
    expect(getLastUserContent(messages)).toBe('Describe this image please');
  });

  it('returns empty string when messages array is empty', () => {
    expect(getLastUserContent([])).toBe('');
  });

  it('returns empty string when last message content is neither string nor array', () => {
    // Force an unusual content type via type assertion
    const messages = [{ role: 'user', content: 42 }] as unknown as CoreMessage[];
    expect(getLastUserContent(messages)).toBe('');
  });

  it('handles array content where text parts have no text property', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: '' }],
      },
    ];
    expect(getLastUserContent(messages)).toBe('');
  });

  it('returns content from the very last message regardless of role', () => {
    const messages: CoreMessage[] = [userMsg('user question'), assistantMsg('assistant response')];
    // The function just looks at messages[messages.length - 1]
    expect(getLastUserContent(messages)).toBe('assistant response');
  });
});

// ---------------------------------------------------------------------------
// getImageAttachments
// ---------------------------------------------------------------------------

describe('getImageAttachments', () => {
  it('returns empty array when last message has string content', () => {
    const messages: CoreMessage[] = [userMsg('Hello, no images here')];
    expect(getImageAttachments(messages)).toEqual([]);
  });

  it('returns empty array when messages array is empty', () => {
    expect(getImageAttachments([])).toEqual([]);
  });

  it('extracts Vercel AI SDK image format', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'image', image: 'base64EncodedImageData' }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual(['base64EncodedImageData']);
  });

  it('extracts file type with image mimeType', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'file', data: 'fileBase64Data', mimeType: 'image/png' }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual(['fileBase64Data']);
  });

  it('ignores file type with non-image mimeType', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'file', data: 'pdfData', mimeType: 'application/pdf' }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual([]);
  });

  it('extracts base64 from OpenAI data URL format', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'image_url', image_url: { url: dataUrl } }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual(['iVBORw0KGgoAAAANSUhEUg==']);
  });

  it('passes through regular URL from OpenAI format without extracting base64', () => {
    const url = 'https://example.com/image.png';
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'image_url', image_url: { url } }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual([url]);
  });

  it('handles multiple image attachments in a single message', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'image', image: 'img1base64' },
          { type: 'text', text: 'Compare these images' },
          { type: 'image', image: 'img2base64' },
        ],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual(['img1base64', 'img2base64']);
  });

  it('ignores text parts in array content', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'No images here at all' }],
      },
    ];
    expect(getImageAttachments(messages)).toEqual([]);
  });

  it('only looks at the last message', () => {
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'image', image: 'firstMsgImage' }],
      },
      {
        role: 'user' as const,
        content: [{ type: 'text', text: 'No images in this message' }],
      },
    ] as CoreMessage[];
    expect(getImageAttachments(messages)).toEqual([]);
  });

  it('handles data URL with no base64 portion after comma', () => {
    const dataUrl = 'data:image/png;base64,';
    const messages = [
      {
        role: 'user' as const,
        content: [{ type: 'image_url', image_url: { url: dataUrl } }],
      },
    ] as CoreMessage[];
    // split(',')[1] is '' which is falsy, so nothing is pushed
    expect(getImageAttachments(messages)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findPreviousGeneratedImage
// ---------------------------------------------------------------------------

describe('findPreviousGeneratedImage', () => {
  it('returns null for empty messages', () => {
    expect(findPreviousGeneratedImage([])).toBeNull();
  });

  it('returns null when there are no assistant messages', () => {
    const messages: CoreMessage[] = [userMsg('Hello'), userMsg('Generate an image')];
    expect(findPreviousGeneratedImage(messages)).toBeNull();
  });

  it('returns null when assistant messages contain no image URLs', () => {
    const messages: CoreMessage[] = [assistantMsg('Sure, I can help you with that task.')];
    expect(findPreviousGeneratedImage(messages)).toBeNull();
  });

  it('finds [ref:url] format in assistant messages', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/generations/abc.png';
    const messages: CoreMessage[] = [assistantMsg(`Here is your image. [ref:${url}]`)];
    expect(findPreviousGeneratedImage(messages)).toBe(url);
  });

  it('finds markdown image link format', () => {
    const url = 'https://example.com/generated-image.png';
    const messages: CoreMessage[] = [
      assistantMsg(`Here is the result: ![Generated Image](${url})`),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(url);
  });

  it('finds Supabase storage URL in plain text', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/generations/img-123.webp';
    const messages: CoreMessage[] = [
      assistantMsg(`Your image has been generated. You can find it at ${url} and download it.`),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(url);
  });

  it('finds generic image URLs by extension', () => {
    const messages: CoreMessage[] = [
      assistantMsg('Check out this result: https://cdn.example.com/output.jpg done!'),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe('https://cdn.example.com/output.jpg');
  });

  it('finds image URLs with query parameters', () => {
    const messages: CoreMessage[] = [
      assistantMsg('Here: https://cdn.example.com/output.png?width=512&height=512 enjoy!'),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(
      'https://cdn.example.com/output.png?width=512&height=512'
    );
  });

  it('searches from the most recent message backwards', () => {
    const olderUrl = 'https://example.com/old-image.png';
    const newerUrl = 'https://example.com/new-image.png';
    const messages: CoreMessage[] = [
      assistantMsg(`![Old](${olderUrl})`),
      userMsg('Can you make it brighter?'),
      assistantMsg(`![New](${newerUrl})`),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(newerUrl);
  });

  it('skips user messages when searching', () => {
    const messages: CoreMessage[] = [
      assistantMsg('Here is your image: https://example.com/gen.png'),
      userMsg('I found this image: https://user-uploaded.com/photo.jpg'),
    ];
    // The last message is a user message — the function only looks at assistant messages
    expect(findPreviousGeneratedImage(messages)).toBe('https://example.com/gen.png');
  });

  it('prefers [ref:url] over markdown image link in the same message', () => {
    const refUrl = 'https://ref.example.com/image.png';
    const mdUrl = 'https://md.example.com/image.png';
    const messages: CoreMessage[] = [assistantMsg(`[ref:${refUrl}] and also ![img](${mdUrl})`)];
    expect(findPreviousGeneratedImage(messages)).toBe(refUrl);
  });

  it('handles array content with image parts containing HTTP URLs', () => {
    const url = 'https://storage.example.com/generated.webp';
    const messages: CoreMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'image', image: url } as unknown as { type: 'text'; text: string }],
      },
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(url);
  });

  it('handles array content with Supabase URL in text parts', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/generations/test-img.png';
    const messages: CoreMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Generated successfully! ${url}` }],
      },
    ];
    expect(findPreviousGeneratedImage(messages)).toBe(url);
  });

  it('returns null when assistant message has array content with no images', () => {
    const messages: CoreMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Just a plain text response with no image.' }],
      },
    ];
    expect(findPreviousGeneratedImage(messages)).toBeNull();
  });

  it('handles image extension matching case-insensitively', () => {
    const messages: CoreMessage[] = [
      assistantMsg('Result: https://cdn.example.com/output.PNG is ready.'),
    ];
    expect(findPreviousGeneratedImage(messages)).toBe('https://cdn.example.com/output.PNG');
  });

  it('finds .webp and .gif extensions', () => {
    expect(findPreviousGeneratedImage([assistantMsg('Here: https://a.com/img.webp done')])).toBe(
      'https://a.com/img.webp'
    );

    expect(findPreviousGeneratedImage([assistantMsg('Here: https://a.com/anim.gif done')])).toBe(
      'https://a.com/anim.gif'
    );
  });
});

// ---------------------------------------------------------------------------
// sanitizeToolError
// ---------------------------------------------------------------------------

describe('sanitizeToolError', () => {
  it('returns a formatted error message for simple errors', () => {
    const result = sanitizeToolError('my_tool', 'Something went wrong');
    expect(result).toBe('Tool "my_tool" encountered an error. Something went wrong');
  });

  it('strips stack traces (only keeps first line)', () => {
    const raw =
      'Error: Connection failed\n    at Object.<anonymous> (file.ts:42)\n    at Module._compile';
    const result = sanitizeToolError('db_tool', raw);
    expect(result).not.toContain('at Object');
    expect(result).not.toContain('Module._compile');
    expect(result).toContain('Connection failed');
  });

  it('replaces file paths with [path]', () => {
    const raw = 'Error: Cannot find module /home/user/project/lib/tools/fetch.ts';
    const result = sanitizeToolError('fetch_tool', raw);
    expect(result).not.toContain('/home/user');
    expect(result).toContain('[path]');
  });

  it('replaces URLs with [url] when path regex does not consume them first', () => {
    // Note: the path regex (?:\/[\w.-]+)+ runs BEFORE the URL regex.
    // URLs with path components get their paths replaced by [path] first.
    // Only URLs that survive path replacement intact are then replaced by [url].
    const raw = 'Failed to fetch from https://api.example.com/v2/data?key=secret';
    const result = sanitizeToolError('api_tool', raw);
    // The path portion is consumed first, so full domain is partially obscured
    expect(result).not.toContain('api.example.com/v2/data');
    expect(result).toContain('[path]');
  });

  it('sanitizes URLs via path regex first, then URL regex', () => {
    // The path regex (/[\w.-]+)+ runs before the URL regex,
    // so "https://example.com" becomes "https:[path]" (path eats //example.com)
    const raw = 'Connection refused by https://example.com end';
    const result = sanitizeToolError('url_tool', raw);
    expect(result).toContain('[path]');
    expect(result).not.toContain('example.com');
  });

  it('obscures HTTP URLs via path replacement', () => {
    const raw = 'Connection to http://internal-service:3000/health refused';
    const result = sanitizeToolError('health_check', raw);
    // Path components are stripped, sensitive info is removed
    expect(result).not.toContain('/health');
    expect(result).toContain('[path]');
  });

  it('replaces SQL-like references with [query]', () => {
    const raw = 'Error: SELECT * FROM users WHERE id = 1.failed';
    const result = sanitizeToolError('db_tool', raw);
    expect(result).toContain('[query]');
    expect(result).not.toContain('SELECT');
    expect(result).not.toContain('FROM users');
  });

  it('handles INSERT, UPDATE, and DELETE SQL patterns', () => {
    expect(sanitizeToolError('t', 'INSERT INTO users.failed')).toContain('[query]');
    expect(sanitizeToolError('t', 'UPDATE accounts SET balance.error')).toContain('[query]');
    expect(sanitizeToolError('t', 'DELETE FROM sessions.timeout')).toContain('[query]');
  });

  it('truncates messages longer than 200 characters', () => {
    const longError = repeat('A', 300);
    const result = sanitizeToolError('long_tool', longError);

    // The result is: 'Tool "long_tool" encountered an error. ' + truncated msg
    // The truncated msg should be 200 chars + '...'
    const prefix = 'Tool "long_tool" encountered an error. ';
    const sanitizedPart = result.slice(prefix.length);
    expect(sanitizedPart).toBe(repeat('A', 200) + '...');
  });

  it('does not truncate messages at exactly 200 characters', () => {
    const exactError = repeat('B', 200);
    const result = sanitizeToolError('exact_tool', exactError);
    const prefix = 'Tool "exact_tool" encountered an error. ';
    const sanitizedPart = result.slice(prefix.length);
    expect(sanitizedPart).toBe(exactError);
    expect(sanitizedPart).not.toContain('...');
  });

  it('handles empty error message', () => {
    const result = sanitizeToolError('empty_tool', '');
    // rawMessage.split('\n')[0] is '', which is falsy, so falls back to rawMessage ('')
    expect(result).toBe('Tool "empty_tool" encountered an error. ');
  });

  it('handles error message with only newlines', () => {
    const result = sanitizeToolError('newline_tool', '\n\n\n');
    // split('\n')[0] is '' which is falsy, so falls back to '\n\n\n'
    // Then path/url/sql replacements run on '\n\n\n', no changes
    expect(result).toBe('Tool "newline_tool" encountered an error. \n\n\n');
  });

  it('applies multiple sanitization rules on the same message', () => {
    const raw = 'Failed at /usr/lib/node.ts: could not connect to https://db.internal.com/api';
    const result = sanitizeToolError('combo', raw);
    // Both the file path and the URL path components are replaced by [path]
    expect(result).not.toContain('/usr/lib');
    expect(result).not.toContain('db.internal.com/api');
    expect(result).toContain('[path]');
  });

  it('preserves the tool name in the output', () => {
    const result = sanitizeToolError('special-tool_v2', 'generic error');
    expect(result).toContain('"special-tool_v2"');
  });

  it('handles SQL keywords case-insensitively', () => {
    const raw = 'select count(*) from analytics.query_failed';
    const result = sanitizeToolError('analytics', raw);
    expect(result).toContain('[query]');
  });
});
