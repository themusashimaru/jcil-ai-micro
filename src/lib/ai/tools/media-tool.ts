/**
 * MEDIA PROCESSING TOOL
 *
 * Process audio and video using FFmpeg.js (WebAssembly).
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Convert formats (mp4, webm, mp3, wav, etc.)
 * - Extract audio from video
 * - Trim/cut media
 * - Create GIFs from video
 * - Compress media
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded FFmpeg
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FFmpeg: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchFile: any = null;

async function initFFmpeg(): Promise<boolean> {
  if (FFmpeg && fetchFile) return true;
  try {
    const ffmpegMod = await import('@ffmpeg/ffmpeg');
    const utilMod = await import('@ffmpeg/util');
    FFmpeg = ffmpegMod.FFmpeg;
    fetchFile = utilMod.fetchFile;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mediaTool: UnifiedTool = {
  name: 'media_process',
  description: `Process audio and video files locally using FFmpeg.

Operations:
- convert: Convert between formats (mp4, webm, mp3, wav, ogg, etc.)
- extract_audio: Extract audio track from video
- trim: Cut media to specific time range
- compress: Reduce file size
- to_gif: Convert video segment to GIF
- get_info: Get media metadata

Supported formats:
- Video: mp4, webm, avi, mkv, mov
- Audio: mp3, wav, ogg, aac, flac
- Image: gif (from video)

All processing runs locally via WebAssembly - no uploads required.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['convert', 'extract_audio', 'trim', 'compress', 'to_gif', 'get_info'],
        description: 'Media operation to perform',
      },
      input_data: {
        type: 'string',
        description: 'Base64 encoded input media file',
      },
      input_format: {
        type: 'string',
        description: 'Input file format/extension (e.g., mp4, mp3)',
      },
      output_format: {
        type: 'string',
        description: 'Desired output format (e.g., mp3, gif, webm)',
      },
      start_time: {
        type: 'string',
        description: 'Start time for trim/gif (format: HH:MM:SS or seconds)',
      },
      end_time: {
        type: 'string',
        description: 'End time for trim/gif (format: HH:MM:SS or seconds)',
      },
      duration: {
        type: 'number',
        description: 'Duration in seconds (alternative to end_time)',
      },
      quality: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Output quality level (affects file size)',
      },
    },
    required: ['operation', 'input_data', 'input_format'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMediaAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMedia(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    input_data: string;
    input_format: string;
    output_format?: string;
    start_time?: string;
    end_time?: string;
    duration?: number;
    quality?: string;
  };

  if (!args.operation || !args.input_data || !args.input_format) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation, input_data, and input_format are required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initFFmpeg();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize FFmpeg' }),
        isError: true,
      };
    }

    const ffmpeg = new FFmpeg();
    await ffmpeg.load();

    const inputName = `input.${args.input_format}`;
    const inputBytes = Buffer.from(args.input_data, 'base64');
    await ffmpeg.writeFile(inputName, inputBytes);

    let outputName: string;
    let ffmpegArgs: string[];

    switch (args.operation) {
      case 'convert': {
        const outFormat = args.output_format || 'mp3';
        outputName = `output.${outFormat}`;
        ffmpegArgs = ['-i', inputName, outputName];
        break;
      }

      case 'extract_audio': {
        const audioFormat = args.output_format || 'mp3';
        outputName = `output.${audioFormat}`;
        ffmpegArgs = ['-i', inputName, '-vn', '-acodec', getAudioCodec(audioFormat), outputName];
        break;
      }

      case 'trim': {
        const outFormat = args.output_format || args.input_format;
        outputName = `output.${outFormat}`;
        ffmpegArgs = ['-i', inputName];

        if (args.start_time) {
          ffmpegArgs.push('-ss', args.start_time);
        }
        if (args.end_time) {
          ffmpegArgs.push('-to', args.end_time);
        } else if (args.duration) {
          ffmpegArgs.push('-t', String(args.duration));
        }

        ffmpegArgs.push('-c', 'copy', outputName);
        break;
      }

      case 'compress': {
        const outFormat = args.output_format || args.input_format;
        outputName = `output.${outFormat}`;
        const crf = args.quality === 'low' ? '35' : args.quality === 'high' ? '18' : '28';
        ffmpegArgs = ['-i', inputName, '-crf', crf, outputName];
        break;
      }

      case 'to_gif': {
        outputName = 'output.gif';
        ffmpegArgs = ['-i', inputName];

        if (args.start_time) {
          ffmpegArgs.push('-ss', args.start_time);
        }
        if (args.duration) {
          ffmpegArgs.push('-t', String(args.duration));
        } else {
          ffmpegArgs.push('-t', '5'); // Default 5 seconds
        }

        // Scale down and optimize for GIF
        ffmpegArgs.push('-vf', 'fps=10,scale=320:-1:flags=lanczos', '-loop', '0', outputName);
        break;
      }

      case 'get_info': {
        // Run ffprobe-like command
        ffmpegArgs = ['-i', inputName, '-f', 'null', '-'];
        await ffmpeg.exec(ffmpegArgs).catch(() => {});

        // Return basic info (FFmpeg logs contain metadata)
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            operation: 'get_info',
            input_format: args.input_format,
            input_size_bytes: inputBytes.length,
            note: 'Detailed metadata extraction requires ffprobe binary',
          }),
          isError: false,
        };
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    // Execute FFmpeg command
    await ffmpeg.exec(ffmpegArgs);

    // Read output file
    const outputData = await ffmpeg.readFile(outputName);
    const outputBytes =
      outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData as ArrayBuffer);
    const base64Output = Buffer.from(outputBytes).toString('base64');

    const result = {
      operation: args.operation,
      input_format: args.input_format,
      output_format: outputName.split('.').pop(),
      input_size_bytes: inputBytes.length,
      output_size_bytes: outputBytes.length,
      compression_ratio:
        inputBytes.length > 0 ? (outputBytes.length / inputBytes.length).toFixed(2) : null,
      output_base64: base64Output,
    };

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Media processing failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

function getAudioCodec(format: string): string {
  const codecs: Record<string, string> = {
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    ogg: 'libvorbis',
    aac: 'aac',
    flac: 'flac',
  };
  return codecs[format] || 'copy';
}
