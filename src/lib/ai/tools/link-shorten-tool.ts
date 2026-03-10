/**
 * LINK SHORTENER TOOL
 *
 * Creates shortened URLs using multiple services.
 * Falls back through services if one fails.
 *
 * Services (in order of priority):
 * 1. TinyURL (free, no auth)
 * 2. is.gd (free, no auth)
 * 3. v.gd (free, no auth)
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const linkShortenTool: UnifiedTool = {
  name: 'shorten_link',
  description: `Create shortened URLs for long links. Uses free shortening services (TinyURL, is.gd).

Use cases:
- Shorten long URLs for sharing
- Create memorable links
- Clean up ugly URLs with tracking parameters

Returns the shortened URL that redirects to the original.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The long URL to shorten',
      },
      custom_alias: {
        type: 'string',
        description: 'Optional custom alias (not all services support this)',
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isLinkShortenAvailable(): boolean {
  // Always available - uses free public APIs
  return true;
}

// ============================================================================
// URL VALIDATION
// ============================================================================

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ============================================================================
// SHORTENING SERVICES
// ============================================================================

interface ShortenResult {
  success: boolean;
  shortUrl?: string;
  error?: string;
  service?: string;
}

async function shortenWithTinyUrl(url: string): Promise<ShortenResult> {
  try {
    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'JCIL-AI-LinkShortener/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`TinyURL returned ${response.status}`);
    }

    const shortUrl = await response.text();

    // TinyURL returns the short URL directly as text
    if (shortUrl && shortUrl.startsWith('https://tinyurl.com/')) {
      return {
        success: true,
        shortUrl: shortUrl.trim(),
        service: 'TinyURL',
      };
    }

    throw new Error('Invalid response from TinyURL');
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

async function shortenWithIsGd(url: string): Promise<ShortenResult> {
  try {
    const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'JCIL-AI-LinkShortener/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`is.gd returned ${response.status}`);
    }

    const shortUrl = await response.text();

    if (shortUrl && shortUrl.startsWith('https://is.gd/')) {
      return {
        success: true,
        shortUrl: shortUrl.trim(),
        service: 'is.gd',
      };
    }

    // Check for error response
    if (shortUrl.includes('Error')) {
      throw new Error(shortUrl);
    }

    throw new Error('Invalid response from is.gd');
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

async function shortenWithVgd(url: string): Promise<ShortenResult> {
  try {
    const apiUrl = `https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'JCIL-AI-LinkShortener/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`v.gd returned ${response.status}`);
    }

    const shortUrl = await response.text();

    if (shortUrl && shortUrl.startsWith('https://v.gd/')) {
      return {
        success: true,
        shortUrl: shortUrl.trim(),
        service: 'v.gd',
      };
    }

    throw new Error('Invalid response from v.gd');
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeLinkShorten(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    url: string;
    custom_alias?: string;
  };

  // Validate URL
  if (!args.url) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: url parameter is required',
      isError: true,
    };
  }

  // Add protocol if missing
  let url = args.url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!isValidUrl(url)) {
    return {
      toolCallId: toolCall.id,
      content: `Error: Invalid URL format. Please provide a valid HTTP/HTTPS URL.`,
      isError: true,
    };
  }

  // Check URL length (some services have limits)
  if (url.length > 2000) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: URL is too long. Maximum length is 2000 characters.',
      isError: true,
    };
  }

  // Try shortening services in order
  const services = [
    { name: 'TinyURL', fn: shortenWithTinyUrl },
    { name: 'is.gd', fn: shortenWithIsGd },
    { name: 'v.gd', fn: shortenWithVgd },
  ];

  const errors: string[] = [];

  for (const service of services) {
    const result = await service.fn(url);

    if (result.success && result.shortUrl) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          success: true,
          originalUrl: url,
          shortUrl: result.shortUrl,
          service: result.service,
          message: `URL shortened successfully using ${result.service}`,
        }),
      };
    }

    errors.push(`${service.name}: ${result.error}`);
  }

  // All services failed
  return {
    toolCallId: toolCall.id,
    content: `Error: Failed to shorten URL. All services returned errors:\n${errors.join('\n')}`,
    isError: true,
  };
}
