// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMedia, isMediaAvailable, mediaTool } from './media-tool';

// Mock FFmpeg
const mockLoad = vi.fn();
const mockWriteFile = vi.fn();
const mockExec = vi.fn();
const mockReadFile = vi.fn();

function MockFFmpeg() {
  return {
    load: mockLoad,
    writeFile: mockWriteFile,
    exec: mockExec,
    readFile: mockReadFile,
  };
}

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: MockFFmpeg,
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(),
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'media-1', name: 'media_process', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockLoad.mockReset().mockResolvedValue(undefined);
  mockWriteFile.mockReset().mockResolvedValue(undefined);
  mockExec.mockReset().mockResolvedValue(undefined);
  mockReadFile.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('mediaTool metadata', () => {
  it('should have correct name', () => {
    expect(mediaTool.name).toBe('media_process');
  });

  it('should require operation, input_data, input_format', () => {
    expect(mediaTool.parameters.required).toContain('operation');
    expect(mediaTool.parameters.required).toContain('input_data');
    expect(mediaTool.parameters.required).toContain('input_format');
  });

  it('should have operation enum', () => {
    const props = mediaTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.operation.enum).toContain('convert');
    expect(props.operation.enum).toContain('extract_audio');
    expect(props.operation.enum).toContain('trim');
    expect(props.operation.enum).toContain('compress');
    expect(props.operation.enum).toContain('to_gif');
    expect(props.operation.enum).toContain('get_info');
  });
});

describe('isMediaAvailable', () => {
  it('should return true', () => {
    expect(isMediaAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeMedia - validation', () => {
  it('should error when operation missing', async () => {
    const res = await executeMedia(makeCall({ input_data: 'AAAA', input_format: 'mp4' }));
    expect(res.isError).toBe(true);
    const data = JSON.parse(res.content);
    expect(data.error).toContain('required');
  });

  it('should error when input_data missing', async () => {
    const res = await executeMedia(makeCall({ operation: 'convert', input_format: 'mp4' }));
    expect(res.isError).toBe(true);
  });

  it('should error when input_format missing', async () => {
    const res = await executeMedia(makeCall({ operation: 'convert', input_data: 'AAAA' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeMedia(makeCall({}));
    expect(res.toolCallId).toBe('media-1');
  });
});

// -------------------------------------------------------------------
// Convert operation
// -------------------------------------------------------------------
describe('executeMedia - convert', () => {
  it('should convert to specified format', async () => {
    const res = await executeMedia(
      makeCall({
        operation: 'convert',
        input_data: Buffer.from('fake-video').toString('base64'),
        input_format: 'mp4',
        output_format: 'webm',
      })
    );
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.operation).toBe('convert');
    expect(data.output_format).toBe('webm');
    expect(data.output_base64).toBeTruthy();
    expect(mockExec).toHaveBeenCalledWith(['-i', 'input.mp4', 'output.webm']);
  });

  it('should default to mp3 output', async () => {
    await executeMedia(
      makeCall({
        operation: 'convert',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'wav',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(['-i', 'input.wav', 'output.mp3']);
  });
});

// -------------------------------------------------------------------
// Extract audio
// -------------------------------------------------------------------
describe('executeMedia - extract_audio', () => {
  it('should extract audio with codec', async () => {
    await executeMedia(
      makeCall({
        operation: 'extract_audio',
        input_data: Buffer.from('video').toString('base64'),
        input_format: 'mp4',
        output_format: 'mp3',
      })
    );
    expect(mockExec).toHaveBeenCalledWith([
      '-i',
      'input.mp4',
      '-vn',
      '-acodec',
      'libmp3lame',
      'output.mp3',
    ]);
  });

  it('should use wav codec', async () => {
    await executeMedia(
      makeCall({
        operation: 'extract_audio',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        output_format: 'wav',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-acodec', 'pcm_s16le']));
  });
});

// -------------------------------------------------------------------
// Trim
// -------------------------------------------------------------------
describe('executeMedia - trim', () => {
  it('should trim with start and end times', async () => {
    await executeMedia(
      makeCall({
        operation: 'trim',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        start_time: '00:00:10',
        end_time: '00:00:30',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.arrayContaining(['-ss', '00:00:10', '-to', '00:00:30', '-c', 'copy'])
    );
  });

  it('should trim with duration instead of end_time', async () => {
    await executeMedia(
      makeCall({
        operation: 'trim',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        start_time: '0',
        duration: 15,
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-ss', '0', '-t', '15']));
  });
});

// -------------------------------------------------------------------
// Compress
// -------------------------------------------------------------------
describe('executeMedia - compress', () => {
  it('should compress with medium quality by default', async () => {
    await executeMedia(
      makeCall({
        operation: 'compress',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-crf', '28']));
  });

  it('should use low quality CRF', async () => {
    await executeMedia(
      makeCall({
        operation: 'compress',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        quality: 'low',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-crf', '35']));
  });

  it('should use high quality CRF', async () => {
    await executeMedia(
      makeCall({
        operation: 'compress',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        quality: 'high',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-crf', '18']));
  });
});

// -------------------------------------------------------------------
// GIF conversion
// -------------------------------------------------------------------
describe('executeMedia - to_gif', () => {
  it('should convert to GIF with defaults', async () => {
    await executeMedia(
      makeCall({
        operation: 'to_gif',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
      })
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.arrayContaining([
        '-t',
        '5',
        '-vf',
        'fps=10,scale=320:-1:flags=lanczos',
        '-loop',
        '0',
        'output.gif',
      ])
    );
  });

  it('should use custom start_time and duration', async () => {
    await executeMedia(
      makeCall({
        operation: 'to_gif',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        start_time: '00:01:00',
        duration: 3,
      })
    );
    expect(mockExec).toHaveBeenCalledWith(expect.arrayContaining(['-ss', '00:01:00', '-t', '3']));
  });
});

// -------------------------------------------------------------------
// Get info
// -------------------------------------------------------------------
describe('executeMedia - get_info', () => {
  it('should return media info', async () => {
    const res = await executeMedia(
      makeCall({
        operation: 'get_info',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
      })
    );
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.operation).toBe('get_info');
    expect(data.input_format).toBe('mp4');
    expect(data.input_size_bytes).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Unknown operation
// -------------------------------------------------------------------
describe('executeMedia - unknown operation', () => {
  it('should error for invalid operation', async () => {
    const res = await executeMedia(
      makeCall({
        operation: 'invalid_op',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
      })
    );
    expect(res.isError).toBe(true);
    const data = JSON.parse(res.content);
    expect(data.error).toContain('Unknown operation');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeMedia - errors', () => {
  it('should handle FFmpeg execution error', async () => {
    mockExec.mockRejectedValueOnce(new Error('FFmpeg crashed'));
    const res = await executeMedia(
      makeCall({
        operation: 'convert',
        input_data: Buffer.from('data').toString('base64'),
        input_format: 'mp4',
        output_format: 'webm',
      })
    );
    expect(res.isError).toBe(true);
    const data = JSON.parse(res.content);
    expect(data.error).toContain('Media processing failed');
    expect(data.details).toContain('FFmpeg crashed');
  });
});
