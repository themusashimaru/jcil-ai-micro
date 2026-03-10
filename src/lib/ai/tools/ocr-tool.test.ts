// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOCR, isOCRAvailable, ocrTool } from './ocr-tool';

// Mock tesseract.js
const mockRecognize = vi.fn();
const mockTerminate = vi.fn();
const mockCreateWorker = vi.fn().mockResolvedValue({
  recognize: mockRecognize,
  terminate: mockTerminate,
});

vi.mock('tesseract.js', () => ({
  default: { createWorker: mockCreateWorker },
  createWorker: mockCreateWorker,
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'ocr-1', name: 'ocr_extract_text', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockRecognize.mockReset();
  mockTerminate.mockReset();
  mockCreateWorker.mockClear();
});

// Standard OCR result
function mockOCRResult(text = 'Hello World', confidence = 95) {
  mockRecognize.mockResolvedValueOnce({
    data: {
      text,
      confidence,
      paragraphs: [{ text }],
      lines: [
        { text: 'Hello', confidence: 96 },
        { text: 'World', confidence: 94 },
      ],
      words: [
        { text: 'Hello', confidence: 96 },
        { text: 'World', confidence: 94 },
      ],
    },
  });
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('ocrTool metadata', () => {
  it('should have correct name', () => {
    expect(ocrTool.name).toBe('ocr_extract_text');
  });

  it('should require image', () => {
    expect(ocrTool.parameters.required).toContain('image');
  });

  it('should have output_format enum', () => {
    const props = ocrTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.output_format.enum).toContain('text');
    expect(props.output_format.enum).toContain('detailed');
    expect(props.output_format.enum).toContain('words');
    expect(props.output_format.enum).toContain('lines');
  });
});

describe('isOCRAvailable', () => {
  it('should return true', () => {
    expect(isOCRAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeOCR - validation', () => {
  it('should error when no image provided', async () => {
    const res = await executeOCR(makeCall({}));
    expect(res.isError).toBe(true);
    const data = JSON.parse(res.content);
    expect(data.error).toContain('required');
  });

  it('should return toolCallId', async () => {
    const res = await executeOCR(makeCall({}));
    expect(res.toolCallId).toBe('ocr-1');
  });
});

// -------------------------------------------------------------------
// OCR execution - text format (default)
// -------------------------------------------------------------------
describe('executeOCR - text format', () => {
  it('should extract text from base64 image', async () => {
    mockOCRResult('Sample text from image', 92);
    const res = await executeOCR(makeCall({ image: 'iVBORw0KGgoAAAANSUhEUg==' }));
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.text).toBe('Sample text from image');
    expect(data.confidence).toBe(92);
  });

  it('should handle URL input', async () => {
    mockOCRResult('Text from URL');
    const res = await executeOCR(makeCall({ image: 'https://example.com/image.png' }));
    expect(res.isError).toBe(false);
    // URL should be passed directly, not wrapped in data URI
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toBe('https://example.com/image.png');
  });

  it('should handle data URI input', async () => {
    mockOCRResult('Text from data URI');
    const res = await executeOCR(makeCall({ image: 'data:image/png;base64,iVBORw0KGgo=' }));
    expect(res.isError).toBe(false);
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('should detect JPEG from base64 signature', async () => {
    mockOCRResult('JPEG text');
    await executeOCR(makeCall({ image: '/9j/4AAQSkZJRg==' }));
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toContain('data:image/jpeg;base64,');
  });

  it('should detect PNG from base64 signature', async () => {
    mockOCRResult('PNG text');
    await executeOCR(makeCall({ image: 'iVBORw0KGgoAAAA' }));
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toContain('data:image/png;base64,');
  });

  it('should detect GIF from base64 signature', async () => {
    mockOCRResult('GIF text');
    await executeOCR(makeCall({ image: 'R0lGODlhAQAB' }));
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toContain('data:image/gif;base64,');
  });

  it('should detect WEBP from base64 signature', async () => {
    mockOCRResult('WEBP text');
    await executeOCR(makeCall({ image: 'UklGRkAAAA' }));
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toContain('data:image/webp;base64,');
  });

  it('should default to PNG for unknown signature', async () => {
    mockOCRResult('Unknown');
    await executeOCR(makeCall({ image: 'AAAAAAAAAA' }));
    const call = mockRecognize.mock.calls[0][0];
    expect(call).toContain('data:image/png;base64,');
  });
});

// -------------------------------------------------------------------
// OCR execution - detailed format
// -------------------------------------------------------------------
describe('executeOCR - detailed format', () => {
  it('should return detailed output', async () => {
    mockOCRResult('Hello World', 95);
    const res = await executeOCR(makeCall({ image: 'iVBORw0KGgo=', output_format: 'detailed' }));
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.text).toBe('Hello World');
    expect(data.confidence).toBe(95);
    expect(data.paragraphs).toBe(1);
    expect(data.lines).toBe(2);
    expect(data.words).toBe(2);
  });
});

// -------------------------------------------------------------------
// OCR execution - words format
// -------------------------------------------------------------------
describe('executeOCR - words format', () => {
  it('should return word-by-word output', async () => {
    mockOCRResult();
    const res = await executeOCR(makeCall({ image: 'iVBORw0KGgo=', output_format: 'words' }));
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.words).toHaveLength(2);
    expect(data.words[0].text).toBe('Hello');
    expect(data.words[0].confidence).toBe(96);
    expect(data.total).toBe(2);
  });
});

// -------------------------------------------------------------------
// OCR execution - lines format
// -------------------------------------------------------------------
describe('executeOCR - lines format', () => {
  it('should return line-by-line output', async () => {
    mockOCRResult();
    const res = await executeOCR(makeCall({ image: 'iVBORw0KGgo=', output_format: 'lines' }));
    expect(res.isError).toBe(false);
    const data = JSON.parse(res.content);
    expect(data.lines).toHaveLength(2);
    expect(data.total).toBe(2);
  });
});

// -------------------------------------------------------------------
// Language support
// -------------------------------------------------------------------
describe('executeOCR - language', () => {
  it('should pass language to worker', async () => {
    mockOCRResult('Hola Mundo');
    await executeOCR(makeCall({ image: 'iVBORw0KGgo=', language: 'spa' }));
    expect(mockCreateWorker).toHaveBeenCalledWith('spa');
  });

  it('should default to English', async () => {
    mockOCRResult('Hello');
    await executeOCR(makeCall({ image: 'iVBORw0KGgo=' }));
    expect(mockCreateWorker).toHaveBeenCalledWith('eng');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeOCR - errors', () => {
  it('should handle OCR recognition failure', async () => {
    mockRecognize.mockRejectedValueOnce(new Error('Recognition failed'));
    const res = await executeOCR(makeCall({ image: 'iVBORw0KGgo=' }));
    expect(res.isError).toBe(true);
    const data = JSON.parse(res.content);
    expect(data.error).toBe('OCR failed');
    expect(data.details).toContain('Recognition failed');
  });

  it('should terminate worker after success', async () => {
    mockOCRResult('done');
    await executeOCR(makeCall({ image: 'iVBORw0KGgo=' }));
    expect(mockTerminate).toHaveBeenCalledOnce();
  });
});
