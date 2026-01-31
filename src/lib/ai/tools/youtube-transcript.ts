/**
 * YOUTUBE TRANSCRIPT TOOL
 *
 * Extracts transcripts/captions from YouTube videos.
 * Uses YouTube's auto-generated captions API.
 *
 * Features:
 * - Extract full video transcripts
 * - Support for multiple languages
 * - Timestamp extraction
 * - Works with any public YouTube video
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('YouTubeTranscript');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_TRANSCRIPT_LENGTH = 50000; // ~50KB max transcript
const FETCH_TIMEOUT_MS = 15000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const youtubeTranscriptTool: UnifiedTool = {
  name: 'youtube_transcript',
  description: `Extract the transcript/captions from a YouTube video. Use this when:
- User shares a YouTube link and asks about the video content
- User wants a summary of a YouTube video
- You need to analyze what's said in a video
- User asks "What does this video talk about?"

This extracts the full text transcript with timestamps.
Works with any public YouTube video that has captions (auto-generated or manual).`,
  parameters: {
    type: 'object',
    properties: {
      video_url: {
        type: 'string',
        description:
          'YouTube video URL (supports youtube.com/watch?v=, youtu.be/, and youtube.com/shorts/ formats)',
      },
      language: {
        type: 'string',
        description: 'Preferred language code (e.g., "en", "es", "fr"). Defaults to "en".',
        default: 'en',
      },
      include_timestamps: {
        type: 'boolean',
        description: 'Whether to include timestamps in the output. Defaults to false.',
        default: false,
      },
    },
    required: ['video_url'],
  },
};

// ============================================================================
// VIDEO ID EXTRACTION
// ============================================================================

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// ============================================================================
// TRANSCRIPT EXTRACTION
// ============================================================================

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

async function fetchTranscript(
  videoId: string,
  language: string = 'en'
): Promise<{ success: boolean; transcript?: TranscriptSegment[]; error?: string; title?: string }> {
  try {
    // First, get the video page to extract caption tracks
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    if (!videoPageResponse.ok) {
      return { success: false, error: `Failed to fetch video page: ${videoPageResponse.status}` };
    }

    const html = await videoPageResponse.text();

    // Extract video title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : undefined;

    // Find captions URL in the page data
    const captionsMatch = html.match(/"captions":\s*({[^}]+})/);
    if (!captionsMatch) {
      // Try alternative pattern for caption tracks
      const timedTextMatch = html.match(/"captionTracks":\s*\[([^\]]+)\]/);
      if (!timedTextMatch) {
        return {
          success: false,
          error: 'No captions available for this video. The video may not have subtitles.',
        };
      }
    }

    // Extract the timedtext URL
    const baseUrlMatch = html.match(
      /"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/
    );
    if (!baseUrlMatch) {
      return { success: false, error: 'Could not find caption track URL' };
    }

    // Clean up the URL (unescape)
    let captionUrl = baseUrlMatch[1].replace(/\\u0026/g, '&');

    // Try to get the requested language, fall back to any available
    if (!captionUrl.includes(`lang=${language}`)) {
      // Try to find the specific language
      const langPattern = new RegExp(
        `"baseUrl":\\s*"(https:\\/\\/www\\.youtube\\.com\\/api\\/timedtext[^"]*lang=${language}[^"]*)"`
      );
      const langMatch = html.match(langPattern);
      if (langMatch) {
        captionUrl = langMatch[1].replace(/\\u0026/g, '&');
      }
    }

    // Fetch the actual transcript
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);

    // Request JSON format
    const transcriptUrl = captionUrl + '&fmt=json3';
    const transcriptResponse = await fetch(transcriptUrl, {
      signal: controller2.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeout2);

    if (!transcriptResponse.ok) {
      return { success: false, error: `Failed to fetch transcript: ${transcriptResponse.status}` };
    }

    const transcriptData = await transcriptResponse.json();

    // Parse the transcript events
    const segments: TranscriptSegment[] = [];
    if (transcriptData.events) {
      for (const event of transcriptData.events) {
        if (event.segs) {
          const text = event.segs.map((seg: { utf8?: string }) => seg.utf8 || '').join('');
          if (text.trim()) {
            segments.push({
              text: text.trim(),
              start: (event.tStartMs || 0) / 1000,
              duration: (event.dDurationMs || 0) / 1000,
            });
          }
        }
      }
    }

    if (segments.length === 0) {
      return { success: false, error: 'Transcript was empty' };
    }

    return { success: true, transcript: segments, title };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('aborted') || errorMessage.includes('abort')) {
      return { success: false, error: 'Request timed out' };
    }

    log.error('Failed to fetch YouTube transcript', { videoId, error: errorMessage });
    return { success: false, error: `Failed to fetch transcript: ${errorMessage}` };
  }
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeYouTubeTranscript(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'youtube_transcript') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const videoUrl = args.video_url as string;
  const language = (args.language as string) || 'en';
  const includeTimestamps = args.include_timestamps === true;

  if (!videoUrl) {
    return {
      toolCallId: id,
      content: 'No video URL provided. Please provide a YouTube video URL.',
      isError: true,
    };
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return {
      toolCallId: id,
      content:
        'Invalid YouTube URL. Please provide a valid YouTube video URL (youtube.com/watch?v=, youtu.be/, or youtube.com/shorts/).',
      isError: true,
    };
  }

  log.info('Extracting YouTube transcript', { videoId, language });

  const result = await fetchTranscript(videoId, language);

  if (!result.success || !result.transcript) {
    return {
      toolCallId: id,
      content: result.error || 'Failed to extract transcript',
      isError: true,
    };
  }

  // Format the transcript
  let content = '';
  if (result.title) {
    content += `# ${result.title}\n\n`;
  }
  content += `**Video ID:** ${videoId}\n`;
  content += `**URL:** https://youtube.com/watch?v=${videoId}\n`;
  content += `**Segments:** ${result.transcript.length}\n\n`;
  content += `## Transcript\n\n`;

  if (includeTimestamps) {
    for (const segment of result.transcript) {
      content += `[${formatTimestamp(segment.start)}] ${segment.text}\n`;
    }
  } else {
    // Combine into paragraphs
    const fullText = result.transcript.map((s) => s.text).join(' ');
    // Clean up multiple spaces
    content += fullText.replace(/\s+/g, ' ').trim();
  }

  // Truncate if too long
  if (content.length > MAX_TRANSCRIPT_LENGTH) {
    content = content.slice(0, MAX_TRANSCRIPT_LENGTH) + '\n\n[Transcript truncated...]';
  }

  log.info('YouTube transcript extracted', {
    videoId,
    segmentCount: result.transcript.length,
    contentLength: content.length,
  });

  return {
    toolCallId: id,
    content,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isYouTubeTranscriptAvailable(): boolean {
  return true; // Always available - uses fetch
}
