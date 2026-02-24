import { describe, it, expect, vi } from 'vitest';

// Mock Anthropic SDK (used by async detectImageRequest)
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  quickDetectImageRequest,
  detectEditWithAttachment,
  detectConversationalEdit,
} from './imageRequestDetector';

// -------------------------------------------------------------------
// quickDetectImageRequest (synchronous pattern matching)
// -------------------------------------------------------------------
describe('quickDetectImageRequest', () => {
  // Strong create patterns
  it('should detect "generate an image of"', () => {
    expect(quickDetectImageRequest('generate an image of a sunset')).toBe(true);
  });

  it('should detect "create a picture"', () => {
    expect(quickDetectImageRequest('create a picture of a cat')).toBe(true);
  });

  it('should detect "draw me a"', () => {
    expect(quickDetectImageRequest('draw me a landscape')).toBe(true);
  });

  it('should detect "make me a pic"', () => {
    expect(quickDetectImageRequest('make me a pic of mountains')).toBe(true);
  });

  it('should detect "sketch a portrait"', () => {
    expect(quickDetectImageRequest('sketch a portrait of a woman')).toBe(true);
  });

  it('should detect "create a slide about"', () => {
    expect(quickDetectImageRequest('create a slide about marketing')).toBe(true);
  });

  it('should detect "paint a"', () => {
    expect(quickDetectImageRequest('can you paint a watercolor landscape')).toBe(true);
  });

  // Non-image requests
  it('should return false for text questions', () => {
    expect(quickDetectImageRequest('what is the capital of France?')).toBe(false);
  });

  it('should return false for code requests', () => {
    expect(quickDetectImageRequest('write a function to sort an array')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(quickDetectImageRequest('')).toBe(false);
  });

  it('should return false for greeting', () => {
    expect(quickDetectImageRequest('hello, how are you?')).toBe(false);
  });
});

// -------------------------------------------------------------------
// detectEditWithAttachment
// -------------------------------------------------------------------
describe('detectEditWithAttachment', () => {
  it('should return null when no attachment', () => {
    expect(detectEditWithAttachment('edit this image', false)).toBeNull();
  });

  it('should detect "edit" command with attachment', () => {
    const result = detectEditWithAttachment('edit the background', true);
    expect(result).not.toBeNull();
    expect(result!.isImageRequest).toBe(true);
    expect(result!.requestType).toBe('edit');
  });

  it('should detect "make this brighter" with attachment', () => {
    const result = detectEditWithAttachment('make this brighter', true);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('high');
  });

  it('should detect "remove the background" with attachment', () => {
    const result = detectEditWithAttachment('remove the background', true);
    expect(result).not.toBeNull();
    expect(result!.requestType).toBe('edit');
  });

  it('should detect "add sunglasses" with attachment', () => {
    const result = detectEditWithAttachment('add sunglasses', true);
    expect(result).not.toBeNull();
  });

  it('should detect "change the color" with attachment', () => {
    const result = detectEditWithAttachment('change the colors to blue', true);
    expect(result).not.toBeNull();
  });

  it('should detect "crop" with attachment', () => {
    const result = detectEditWithAttachment('crop this image', true);
    expect(result).not.toBeNull();
  });

  it('should detect "fix this" with attachment', () => {
    const result = detectEditWithAttachment('fix this photo', true);
    expect(result).not.toBeNull();
  });

  it('should detect "clean up" with attachment', () => {
    const result = detectEditWithAttachment('clean up this photo', true);
    expect(result).not.toBeNull();
  });

  it('should detect short adjective commands with attachment', () => {
    const result = detectEditWithAttachment('brighter', true);
    expect(result).not.toBeNull();
  });

  it('should return null for unrelated message with attachment', () => {
    const result = detectEditWithAttachment('what is this a picture of?', true);
    expect(result).toBeNull();
  });
});

// -------------------------------------------------------------------
// detectConversationalEdit
// -------------------------------------------------------------------
describe('detectConversationalEdit', () => {
  it('should return null for short messages', () => {
    expect(detectConversationalEdit('hi')).toBeNull();
  });

  it('should detect "replace the X with Y"', () => {
    const result = detectConversationalEdit('replace the typewriter with a football');
    expect(result).not.toBeNull();
    expect(result!.requestType).toBe('edit');
  });

  it('should detect "change the background to blue"', () => {
    const result = detectConversationalEdit('change the background to blue');
    expect(result).not.toBeNull();
    expect(result!.isImageRequest).toBe(true);
  });

  it('should detect "add some text to the image"', () => {
    const result = detectConversationalEdit('add some text to the image');
    expect(result).not.toBeNull();
  });

  it('should detect "make the dog bigger"', () => {
    const result = detectConversationalEdit('can you make the dog bigger');
    expect(result).not.toBeNull();
  });

  it('should return null for new creation requests', () => {
    const result = detectConversationalEdit('generate an image of a sunset');
    expect(result).toBeNull();
  });

  it('should return null for text questions', () => {
    const result = detectConversationalEdit('What does this code do?');
    expect(result).toBeNull();
  });

  it('should strip conversational prefixes from extracted prompt', () => {
    const result = detectConversationalEdit('can you remove the background');
    if (result?.extractedPrompt) {
      expect(result.extractedPrompt).not.toMatch(/^can you\s/i);
    }
  });
});
