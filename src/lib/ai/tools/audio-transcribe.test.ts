// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAudioTranscribe,
  isAudioTranscribeAvailable,
  audioTranscribeTool,
} from './audio-transcribe';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    audio = {
      transcriptions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    };
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'audio-1', name: 'transcribe_audio', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockCreate.mockReset();
  process.env.OPENAI_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('audioTranscribeTool metadata', () => {
  it('should have correct name', () => {
    expect(audioTranscribeTool.name).toBe('transcribe_audio');
  });

  it('should have audio_url and audio_base64 params', () => {
    const props = audioTranscribeTool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('audio_url');
    expect(props).toHaveProperty('audio_base64');
  });
});

describe('isAudioTranscribeAvailable', () => {
  it('should return true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    expect(isAudioTranscribeAvailable()).toBe(true);
  });

  it('should return false when OPENAI_API_KEY is not set', () => {
    delete process.env.OPENAI_API_KEY;
    expect(isAudioTranscribeAvailable()).toBe(false);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeAudioTranscribe - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeAudioTranscribe({
      id: 'x',
      name: 'wrong_tool',
      arguments: { audio_url: 'https://example.com/audio.mp3' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error when no audio provided', async () => {
    const res = await executeAudioTranscribe(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No audio provided');
  });

  it('should return toolCallId', async () => {
    const res = await executeAudioTranscribe(makeCall({}));
    expect(res.toolCallId).toBe('audio-1');
  });
});

// -------------------------------------------------------------------
// URL fetching
// -------------------------------------------------------------------
describe('executeAudioTranscribe - URL fetching', () => {
  it('should fetch audio from URL and transcribe', async () => {
    const audioData = Buffer.from('fake-audio-data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'audio/mpeg']]),
      arrayBuffer: () => Promise.resolve(audioData.buffer),
    });
    mockCreate.mockResolvedValueOnce({ text: 'Hello, this is a test recording.' });

    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/speech.mp3' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Hello, this is a test recording.');
    expect(res.content).toContain('Audio Transcription');
  });

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/missing.mp3' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Failed to fetch audio');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));
    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/audio.mp3' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network failed');
  });

  it('should handle timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));
    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/audio.mp3' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('timed out');
  });

  it('should detect format from content-type', async () => {
    const audioData = Buffer.from('data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'audio/wav']]),
      arrayBuffer: () => Promise.resolve(audioData.buffer),
    });
    mockCreate.mockResolvedValueOnce({ text: 'transcribed' });

    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/audio.wav' })
    );
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// Base64 input
// -------------------------------------------------------------------
describe('executeAudioTranscribe - base64', () => {
  it('should transcribe base64 audio', async () => {
    mockCreate.mockResolvedValueOnce({ text: 'Base64 transcription result' });
    const res = await executeAudioTranscribe(
      makeCall({
        audio_base64: Buffer.from('fake-audio').toString('base64'),
        filename: 'recording.mp3',
      })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Base64 transcription result');
  });

  it('should detect format from filename', async () => {
    mockCreate.mockResolvedValueOnce({ text: 'wav audio' });
    const res = await executeAudioTranscribe(
      makeCall({
        audio_base64: Buffer.from('data').toString('base64'),
        filename: 'voice.wav',
      })
    );
    expect(res.isError).toBe(false);
  });

  it('should default to mp3 without filename', async () => {
    mockCreate.mockResolvedValueOnce({ text: 'default format' });
    const res = await executeAudioTranscribe(
      makeCall({ audio_base64: Buffer.from('data').toString('base64') })
    );
    expect(res.isError).toBe(false);
  });
});

// -------------------------------------------------------------------
// Size check
// -------------------------------------------------------------------
describe('executeAudioTranscribe - size limit', () => {
  it('should reject oversized audio from URL', async () => {
    const bigBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB > 25MB limit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'audio/mpeg']]),
      arrayBuffer: () => Promise.resolve(bigBuffer.buffer),
    });
    const res = await executeAudioTranscribe(
      makeCall({ audio_url: 'https://example.com/big.mp3' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('too large');
  });
});

// -------------------------------------------------------------------
// Language support
// -------------------------------------------------------------------
describe('executeAudioTranscribe - language', () => {
  it('should include language in output', async () => {
    mockCreate.mockResolvedValueOnce({ text: 'Hola mundo' });
    const res = await executeAudioTranscribe(
      makeCall({
        audio_base64: Buffer.from('data').toString('base64'),
        language: 'es',
      })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('(es)');
    expect(res.content).toContain('Hola mundo');
  });
});

// -------------------------------------------------------------------
// Transcription errors
// -------------------------------------------------------------------
describe('executeAudioTranscribe - transcription errors', () => {
  it('should handle OpenAI API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    const res = await executeAudioTranscribe(
      makeCall({ audio_base64: Buffer.from('data').toString('base64') })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Rate limit exceeded');
  });
});
