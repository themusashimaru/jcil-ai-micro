import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeYouTubeTranscript,
  isYouTubeTranscriptAvailable,
  youtubeTranscriptTool,
} from './youtube-transcript';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'yt-1', name: 'youtube_transcript', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('youtubeTranscriptTool metadata', () => {
  it('should have correct name', () => {
    expect(youtubeTranscriptTool.name).toBe('youtube_transcript');
  });

  it('should require video_url', () => {
    expect(youtubeTranscriptTool.parameters.required).toContain('video_url');
  });
});

describe('isYouTubeTranscriptAvailable', () => {
  it('should return true', () => {
    expect(isYouTubeTranscriptAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeYouTubeTranscript - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeYouTubeTranscript({
      id: 'x',
      name: 'wrong_tool',
      arguments: { video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error when no video_url provided', async () => {
    const res = await executeYouTubeTranscript(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No video URL');
  });

  it('should error for invalid YouTube URL', async () => {
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://example.com/not-youtube' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid YouTube URL');
  });

  it('should error for partial URL without valid ID', async () => {
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'youtube.com/watch?v=short' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid YouTube URL');
  });
});

// -------------------------------------------------------------------
// Video ID extraction (tested indirectly through executor)
// -------------------------------------------------------------------
describe('executeYouTubeTranscript - video ID extraction', () => {
  // Mock a page that has no captions
  function mockNoCaptions() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve('<html><title>Test Video - YouTube</title><body>no captions</body></html>'),
    });
  }

  it('should accept youtube.com/watch?v= format', async () => {
    mockNoCaptions();
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    );
    // Will fail because no captions, but it means the URL was accepted
    expect(res.content).toContain('No captions');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should accept youtu.be/ format', async () => {
    mockNoCaptions();
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://youtu.be/dQw4w9WgXcQ' })
    );
    expect(res.content).toContain('No captions');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should accept youtube.com/shorts/ format', async () => {
    mockNoCaptions();
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://youtube.com/shorts/dQw4w9WgXcQ' })
    );
    expect(res.content).toContain('No captions');
  });

  it('should accept bare video ID', async () => {
    mockNoCaptions();
    const res = await executeYouTubeTranscript(makeCall({ video_url: 'dQw4w9WgXcQ' }));
    expect(res.content).toContain('No captions');
  });
});

// -------------------------------------------------------------------
// Fetch error handling
// -------------------------------------------------------------------
describe('executeYouTubeTranscript - fetch errors', () => {
  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network error');
  });

  it('should handle non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('403');
  });

  it('should handle abort/timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('timed out');
  });

  it('should return toolCallId', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    const res = await executeYouTubeTranscript(makeCall({ video_url: 'dQw4w9WgXcQ' }));
    expect(res.toolCallId).toBe('yt-1');
  });
});

// -------------------------------------------------------------------
// Successful transcript extraction
// -------------------------------------------------------------------
describe('executeYouTubeTranscript - success', () => {
  function mockSuccessfulTranscript() {
    // First call: video page with caption tracks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          '<html><title>Test Video - YouTube</title>' +
            '"captions":{"playerCaptionsTracklistRenderer":{}}' +
            '"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=test\\u0026lang=en"}]' +
            '"baseUrl":"https://www.youtube.com/api/timedtext?v=test\\u0026lang=en"' +
            '</html>'
        ),
    });

    // Second call: transcript JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          events: [
            { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: 'Hello world' }] },
            { tStartMs: 5000, dDurationMs: 3000, segs: [{ utf8: 'This is a test' }] },
            { tStartMs: 8000, dDurationMs: 2000, segs: [{ utf8: 'transcript' }] },
          ],
        }),
    });
  }

  it('should extract transcript without timestamps', async () => {
    mockSuccessfulTranscript();
    const res = await executeYouTubeTranscript(makeCall({ video_url: 'dQw4w9WgXcQ' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Test Video');
    expect(res.content).toContain('Hello world');
    expect(res.content).toContain('This is a test');
    expect(res.content).toContain('transcript');
    expect(res.content).toContain('Segments');
    expect(res.content).toContain('3');
  });

  it('should extract transcript with timestamps', async () => {
    mockSuccessfulTranscript();
    const res = await executeYouTubeTranscript(
      makeCall({ video_url: 'dQw4w9WgXcQ', include_timestamps: true })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('[0:00]');
    expect(res.content).toContain('[0:05]');
    expect(res.content).toContain('[0:08]');
  });

  it('should handle string arguments', async () => {
    mockSuccessfulTranscript();
    const res = await executeYouTubeTranscript({
      id: 'yt-2',
      name: 'youtube_transcript',
      arguments: JSON.stringify({ video_url: 'dQw4w9WgXcQ' }),
      sessionId: 'test-session',
    });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Hello world');
  });
});
