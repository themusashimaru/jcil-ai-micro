/**
 * AUDIO TRANSCRIPTION TOOL
 *
 * Transcribes audio files using OpenAI Whisper API.
 * Supports uploaded files and audio URLs.
 *
 * Features:
 * - Multiple audio formats (mp3, wav, m4a, webm, etc.)
 * - Language detection or specified language
 * - Timestamps optional
 * - URL fetching for remote audio
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('AudioTranscribeTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_FILE_SIZE_MB = 25; // Whisper limit
const SUPPORTED_FORMATS = [
  'mp3',
  'mp4',
  'm4a',
  'wav',
  'webm',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'flac',
];
const FETCH_TIMEOUT_MS = 30000;

// ============================================================================
// OPENAI LAZY LOADING
// ============================================================================

let openaiAvailable: boolean | null = null;
let OpenAI: typeof import('openai').default | null = null;

async function initOpenAI(): Promise<boolean> {
  if (openaiAvailable !== null) {
    return openaiAvailable;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn('OPENAI_API_KEY not configured - audio transcription disabled');
      openaiAvailable = false;
      return false;
    }

    const openaiModule = await import('openai');
    OpenAI = openaiModule.default;
    openaiAvailable = true;
    log.info('OpenAI Whisper available for audio transcription');
    return true;
  } catch (error) {
    log.error('Failed to initialize OpenAI', { error: (error as Error).message });
    openaiAvailable = false;
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const audioTranscribeTool: UnifiedTool = {
  name: 'transcribe_audio',
  description: `Transcribe audio to text using OpenAI Whisper. Use this when:
- User uploads an audio file and wants it transcribed
- User shares an audio URL (podcast, voice memo, etc.)
- User asks "what does this audio say?" or "transcribe this"
- User wants to convert speech to text

Supports: MP3, MP4, M4A, WAV, WEBM, OGG, FLAC (max 25MB)

For YouTube videos, use the youtube_transcript tool instead (it's faster).`,
  parameters: {
    type: 'object',
    properties: {
      audio_url: {
        type: 'string',
        description: 'URL to the audio file to transcribe',
      },
      audio_base64: {
        type: 'string',
        description: 'Base64-encoded audio data (for uploaded files)',
      },
      filename: {
        type: 'string',
        description: 'Original filename (helps determine format)',
      },
      language: {
        type: 'string',
        description: 'ISO language code (e.g., "en", "es", "fr"). If not specified, auto-detects.',
      },
      include_timestamps: {
        type: 'boolean',
        description: 'Include word-level timestamps. Default: false',
        default: false,
      },
      prompt: {
        type: 'string',
        description:
          'Optional context to help transcription accuracy (e.g., technical terms, names)',
      },
    },
    required: [],
  },
};

// ============================================================================
// AUDIO FETCHING
// ============================================================================

async function fetchAudioFromUrl(
  url: string
): Promise<{ success: boolean; buffer?: Buffer; format?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Failed to fetch audio: ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    // Check size
    if (buffer.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { success: false, error: `Audio file too large (max ${MAX_FILE_SIZE_MB}MB)` };
    }

    // Determine format from content-type or URL
    let format = 'mp3'; // default
    if (contentType.includes('audio/')) {
      format = contentType.split('audio/')[1]?.split(';')[0] || 'mp3';
    } else {
      // Try to get from URL
      const urlPath = new URL(url).pathname.toLowerCase();
      for (const fmt of SUPPORTED_FORMATS) {
        if (urlPath.endsWith(`.${fmt}`)) {
          format = fmt;
          break;
        }
      }
    }

    return { success: true, buffer, format };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('abort')) {
      return { success: false, error: 'Audio fetch timed out' };
    }
    return { success: false, error: `Failed to fetch audio: ${message}` };
  }
}

// ============================================================================
// TRANSCRIPTION
// ============================================================================

async function transcribeAudio(
  audioBuffer: Buffer,
  format: string,
  options: {
    language?: string;
    includeTimestamps?: boolean;
    prompt?: string;
  }
): Promise<{ success: boolean; text?: string; error?: string }> {
  const available = await initOpenAI();
  if (!available || !OpenAI) {
    return { success: false, error: 'Audio transcription is not available' };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Create a File-like object for the API
    // Convert Buffer to Uint8Array for File constructor compatibility
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], `audio.${format}`, {
      type: `audio/${format}`,
    });

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: options.language,
      prompt: options.prompt,
      response_format: options.includeTimestamps ? 'verbose_json' : 'text',
    });

    if (options.includeTimestamps && typeof transcription === 'object') {
      // Format with timestamps
      const verbose = transcription as {
        text: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };
      let formatted = '';
      if (verbose.segments) {
        for (const segment of verbose.segments) {
          const start = formatTimestamp(segment.start);
          formatted += `[${start}] ${segment.text.trim()}\n`;
        }
      } else {
        formatted = verbose.text;
      }
      return { success: true, text: formatted };
    }

    // Handle the response - it's a Transcription object with a text property
    const text = typeof transcription === 'string' ? transcription : transcription.text;
    return { success: true, text };
  } catch (error) {
    log.error('Transcription failed', { error: (error as Error).message });
    return { success: false, error: `Transcription failed: ${(error as Error).message}` };
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeAudioTranscribe(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'transcribe_audio') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const audioUrl = args.audio_url as string | undefined;
  const audioBase64 = args.audio_base64 as string | undefined;
  const filename = args.filename as string | undefined;
  const language = args.language as string | undefined;
  const includeTimestamps = args.include_timestamps === true;
  const prompt = args.prompt as string | undefined;

  if (!audioUrl && !audioBase64) {
    return {
      toolCallId: id,
      content: 'No audio provided. Please provide either audio_url or audio_base64.',
      isError: true,
    };
  }

  log.info('Transcribing audio', { hasUrl: !!audioUrl, hasBase64: !!audioBase64, language });

  let audioBuffer: Buffer;
  let format: string;

  if (audioUrl) {
    // Fetch from URL
    const fetchResult = await fetchAudioFromUrl(audioUrl);
    if (!fetchResult.success) {
      return {
        toolCallId: id,
        content: fetchResult.error || 'Failed to fetch audio',
        isError: true,
      };
    }
    audioBuffer = fetchResult.buffer!;
    format = fetchResult.format!;
  } else {
    // Decode base64
    try {
      audioBuffer = Buffer.from(audioBase64!, 'base64');
      // Determine format from filename
      format = 'mp3';
      if (filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext && SUPPORTED_FORMATS.includes(ext)) {
          format = ext;
        }
      }
    } catch {
      return { toolCallId: id, content: 'Invalid base64 audio data', isError: true };
    }
  }

  // Check size
  if (audioBuffer.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      toolCallId: id,
      content: `Audio file too large (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`,
      isError: true,
    };
  }

  // Transcribe
  const result = await transcribeAudio(audioBuffer, format, {
    language,
    includeTimestamps,
    prompt,
  });

  if (!result.success) {
    return { toolCallId: id, content: result.error || 'Transcription failed', isError: true };
  }

  const response = `**Audio Transcription${language ? ` (${language})` : ''}:**\n\n${result.text}`;

  log.info('Transcription complete', { textLength: result.text?.length });

  return {
    toolCallId: id,
    content: response,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isAudioTranscribeAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
