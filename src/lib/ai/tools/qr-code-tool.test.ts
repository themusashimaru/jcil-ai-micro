// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeQRCode, isQRCodeAvailable, qrCodeTool } from './qr-code-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'generate_qr_code', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeQRCode(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('qrCodeTool metadata', () => {
  it('should have correct name', () => {
    expect(qrCodeTool.name).toBe('generate_qr_code');
  });

  it('should require content', () => {
    expect(qrCodeTool.parameters.required).toContain('content');
  });
});

describe('isQRCodeAvailable', () => {
  it('should return true', () => {
    expect(isQRCodeAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Basic generation
// -------------------------------------------------------------------
describe('executeQRCode - basic', () => {
  it('should generate QR code for URL', async () => {
    const result = await getResult({ content: 'https://example.com' });
    expect(result.success).toBe(true);
    expect(result.imageData).toBeDefined();
    expect(result.dataUrl).toContain('data:image/png;base64,');
    expect(result.mimeType).toBe('image/png');
    expect(result.dataLength).toBe('https://example.com'.length);
  });

  it('should generate QR code for plain text', async () => {
    const result = await getResult({ content: 'Hello World' });
    expect(result.success).toBe(true);
    expect(result.imageData).toBeDefined();
    expect(result.message).toContain('Hello World');
  });

  it('should generate QR code for long content', async () => {
    const content = 'A'.repeat(100);
    const result = await getResult({ content });
    expect(result.success).toBe(true);
    expect(result.message).toContain('...');
  });
});

// -------------------------------------------------------------------
// Size options
// -------------------------------------------------------------------
describe('executeQRCode - size', () => {
  it('should accept custom size', async () => {
    const result = await getResult({ content: 'test', size: 500 });
    expect(result.success).toBe(true);
    expect(result.size).toBe('500x500');
  });

  it('should clamp size to minimum 100', async () => {
    const result = await getResult({ content: 'test', size: 10 });
    expect(result.success).toBe(true);
    expect(result.size).toBe('100x100');
  });

  it('should clamp size to maximum 1000', async () => {
    const result = await getResult({ content: 'test', size: 5000 });
    expect(result.success).toBe(true);
    expect(result.size).toBe('1000x1000');
  });

  it('should default size to 300', async () => {
    const result = await getResult({ content: 'test' });
    expect(result.size).toBe('300x300');
  });
});

// -------------------------------------------------------------------
// Error correction
// -------------------------------------------------------------------
describe('executeQRCode - error correction', () => {
  it('should accept error correction level L', async () => {
    const result = await getResult({ content: 'test', error_correction: 'L' });
    expect(result.errorCorrection).toBe('L');
  });

  it('should accept error correction level H', async () => {
    const result = await getResult({ content: 'test', error_correction: 'H' });
    expect(result.errorCorrection).toBe('H');
  });

  it('should default to M', async () => {
    const result = await getResult({ content: 'test' });
    expect(result.errorCorrection).toBe('M');
  });
});

// -------------------------------------------------------------------
// Colors
// -------------------------------------------------------------------
describe('executeQRCode - colors', () => {
  it('should accept custom dark color', async () => {
    const result = await getResult({
      content: 'test',
      dark_color: '#FF0000',
    });
    expect(result.success).toBe(true);
  });

  it('should accept custom light color', async () => {
    const result = await getResult({
      content: 'test',
      light_color: '#CCCCCC',
    });
    expect(result.success).toBe(true);
  });

  it('should error on invalid dark color', async () => {
    const res = await executeQRCode(makeCall({ content: 'test', dark_color: 'red' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('dark_color');
  });

  it('should error on invalid light color', async () => {
    const res = await executeQRCode(makeCall({ content: 'test', light_color: 'not-a-color' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('light_color');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeQRCode - errors', () => {
  it('should error without content', async () => {
    const res = await executeQRCode(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should error on content too long', async () => {
    const res = await executeQRCode(makeCall({ content: 'A'.repeat(5000) }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('too long');
  });

  it('should return toolCallId', async () => {
    const res = await executeQRCode({
      id: 'my-id',
      name: 'generate_qr_code',
      arguments: { content: 'test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
