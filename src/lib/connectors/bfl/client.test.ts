/**
 * BFL (Black Forest Labs) Client Tests
 *
 * Tests for the FLUX.2 image generation API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BFLError } from './types';

// Mock logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// We need to import after mocks are set up
import {
  isBFLConfigured,
  submitGeneration,
  submitEdit,
  pollForResult,
  generateImage,
  editImage,
  imageToBase64,
  extractBase64,
} from './client';

// Helper to create a mock fetch response
function mockFetchResponse(
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('BFL Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.BLACK_FOREST_LABS_API_KEY = 'test-bfl-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ===========================================================================
  // isBFLConfigured
  // ===========================================================================
  describe('isBFLConfigured', () => {
    it('should return true when API key is set', () => {
      process.env.BLACK_FOREST_LABS_API_KEY = 'some-key';
      expect(isBFLConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.BLACK_FOREST_LABS_API_KEY;
      expect(isBFLConfigured()).toBe(false);
    });

    it('should return false when API key is empty string', () => {
      process.env.BLACK_FOREST_LABS_API_KEY = '';
      expect(isBFLConfigured()).toBe(false);
    });
  });

  // ===========================================================================
  // imageToBase64
  // ===========================================================================
  describe('imageToBase64', () => {
    it('should convert buffer to base64 data URL with default mime type', () => {
      const buffer = Buffer.from('test-image-data');
      const result = imageToBase64(buffer);
      expect(result).toBe(`data:image/png;base64,${buffer.toString('base64')}`);
    });

    it('should use custom mime type', () => {
      const buffer = Buffer.from('test-image-data');
      const result = imageToBase64(buffer, 'image/jpeg');
      expect(result).toBe(`data:image/jpeg;base64,${buffer.toString('base64')}`);
    });
  });

  // ===========================================================================
  // extractBase64
  // ===========================================================================
  describe('extractBase64', () => {
    it('should extract base64 data from data URL', () => {
      const result = extractBase64('data:image/png;base64,abc123');
      expect(result).toBe('abc123');
    });

    it('should return raw string if not a data URL', () => {
      const result = extractBase64('just-raw-base64-data');
      expect(result).toBe('just-raw-base64-data');
    });

    it('should handle different mime types', () => {
      const result = extractBase64('data:image/jpeg;base64,xyz789');
      expect(result).toBe('xyz789');
    });
  });

  // ===========================================================================
  // submitGeneration
  // ===========================================================================
  describe('submitGeneration', () => {
    it('should submit a generation request with default parameters', async () => {
      const mockResponse = {
        id: 'gen-123',
        polling_url: 'https://api.bfl.ai/poll/gen-123',
        status: 'Pending',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(mockResponse) as unknown as Response
      );

      const result = await submitGeneration('A cat');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.bfl.ai/v1/flux-2-pro');
      expect(options?.method).toBe('POST');
      expect(options?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'x-key': 'test-bfl-api-key',
      });

      const body = JSON.parse(options?.body as string);
      expect(body.prompt).toBe('A cat');
      expect(body.width).toBe(1024);
      expect(body.height).toBe(1024);

      expect(result).toEqual(mockResponse);
    });

    it('should use custom options when provided', async () => {
      const mockResponse = {
        id: 'gen-456',
        polling_url: 'https://api.bfl.ai/poll/gen-456',
        status: 'Pending',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(mockResponse) as unknown as Response
      );

      await submitGeneration('A dog', { width: 512, height: 512, guidance: 5.0 });

      const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);
      expect(body.width).toBe(512);
      expect(body.height).toBe(512);
      expect(body.guidance).toBe(5.0);
    });

    it('should use specified model endpoint', async () => {
      const mockResponse = {
        id: 'gen-789',
        polling_url: 'https://api.bfl.ai/poll/gen-789',
        status: 'Pending',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(mockResponse) as unknown as Response
      );

      await submitGeneration('A bird', {}, 'flux-2-klein-4b');

      const [url] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.bfl.ai/v1/flux-2-klein-4b');
    });

    it('should throw BFLError when API key is missing', async () => {
      delete process.env.BLACK_FOREST_LABS_API_KEY;

      await expect(submitGeneration('A cat')).rejects.toThrow(BFLError);
      await expect(submitGeneration('A cat')).rejects.toThrow(
        'BLACK_FOREST_LABS_API_KEY environment variable is not set'
      );
    });

    it('should throw BFLError on API error response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(
          { message: 'Rate limit exceeded' },
          { ok: false, status: 429, statusText: 'Too Many Requests' }
        ) as unknown as Response
      );

      try {
        await submitGeneration('A cat');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BFLError);
        expect((error as BFLError).message).toBe('Rate limit exceeded');
        expect((error as BFLError).code).toBe('API_ERROR');
        expect((error as BFLError).status).toBe(429);
      }
    });

    it('should handle API error without message body', async () => {
      const badResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockRejectedValue(new Error('not JSON')),
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(badResponse as unknown as Response);

      await expect(submitGeneration('A cat')).rejects.toThrow(
        'BFL API error: 500 Internal Server Error'
      );
    });
  });

  // ===========================================================================
  // submitEdit
  // ===========================================================================
  describe('submitEdit', () => {
    it('should submit an edit request with a single image', async () => {
      const mockResponse = {
        id: 'edit-123',
        polling_url: 'https://api.bfl.ai/poll/edit-123',
        status: 'Pending',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(mockResponse) as unknown as Response
      );

      const result = await submitEdit('Make it blue', ['base64image1']);

      const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);
      expect(body.prompt).toBe('Make it blue');
      expect(body.image).toBe('base64image1');
      expect(body.images).toBeUndefined();
      expect(result).toEqual(mockResponse);
    });

    it('should submit edit with multiple images', async () => {
      const mockResponse = {
        id: 'edit-456',
        polling_url: 'https://api.bfl.ai/poll/edit-456',
        status: 'Pending',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(mockResponse) as unknown as Response
      );

      await submitEdit('Blend these', ['img1', 'img2', 'img3']);

      const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);
      expect(body.images).toEqual(['img1', 'img2', 'img3']);
      expect(body.image).toBeUndefined();
    });

    it('should throw BFLError for model that does not support editing', async () => {
      await expect(submitEdit('Edit this', ['img1'], {}, 'flux-2-klein-4b')).rejects.toThrow(
        'does not support image editing'
      );
    });

    it('should throw BFLError when too many images are provided', async () => {
      // flux-2-flex supports max 4 reference images
      const manyImages = ['img1', 'img2', 'img3', 'img4', 'img5'];
      await expect(submitEdit('Edit this', manyImages, {}, 'flux-2-flex')).rejects.toThrow(
        'maximum 4 reference images'
      );
    });
  });

  // ===========================================================================
  // pollForResult
  // ===========================================================================
  describe('pollForResult', () => {
    it('should return immediately when status is Ready', async () => {
      const readyResponse = {
        status: 'Ready',
        result: { sample: 'https://example.com/image.png', seed: 42 },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(readyResponse) as unknown as Response
      );

      const result = await pollForResult('https://api.bfl.ai/poll/gen-123');

      expect(result.status).toBe('Ready');
      expect(result.result?.sample).toBe('https://example.com/image.png');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should poll multiple times for Pending then Ready', async () => {
      const pendingResponse = { status: 'Pending' };
      const readyResponse = {
        status: 'Ready',
        result: { sample: 'https://example.com/image.png' },
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(pendingResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(readyResponse) as unknown as Response);

      const result = await pollForResult('https://api.bfl.ai/poll/gen-123', {
        initialInterval: 10,
        maxInterval: 20,
        timeout: 5000,
      });

      expect(result.status).toBe('Ready');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw BFLError on Error status', async () => {
      const errorResponse = { status: 'Error', error: 'Generation failed internally' };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(errorResponse) as unknown as Response
      );

      await expect(pollForResult('https://api.bfl.ai/poll/gen-123')).rejects.toThrow(
        'Generation failed internally'
      );
    });

    it('should throw BFLError on Request Moderated status', async () => {
      const moderatedResponse = { status: 'Request Moderated' };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(moderatedResponse) as unknown as Response
      );

      await expect(pollForResult('https://api.bfl.ai/poll/gen-123')).rejects.toThrow(
        'Request was moderated by content filter'
      );
    });

    it('should throw BFLError on Content Moderated status', async () => {
      const moderatedResponse = { status: 'Content Moderated' };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(moderatedResponse) as unknown as Response
      );

      await expect(pollForResult('https://api.bfl.ai/poll/gen-123')).rejects.toThrow(
        'Generated content was moderated by safety filter'
      );
    });

    it('should throw BFLError on Task not found status', async () => {
      const notFoundResponse = { status: 'Task not found' };
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(notFoundResponse) as unknown as Response
      );

      await expect(pollForResult('https://api.bfl.ai/poll/gen-123')).rejects.toThrow(
        'Generation task not found'
      );
    });

    it('should throw timeout BFLError when polling exceeds timeout', async () => {
      const pendingResponse = { status: 'Pending' };
      // Always return pending
      vi.mocked(global.fetch).mockResolvedValue(
        mockFetchResponse(pendingResponse) as unknown as Response
      );

      await expect(
        pollForResult('https://api.bfl.ai/poll/gen-123', {
          timeout: 50,
          initialInterval: 10,
          maxInterval: 10,
          backoffMultiplier: 1,
        })
      ).rejects.toThrow('Generation timed out');
    });

    it('should retry on network errors with backoff', async () => {
      const readyResponse = {
        status: 'Ready',
        result: { sample: 'https://example.com/image.png' },
      };

      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockFetchResponse(readyResponse) as unknown as Response);

      const result = await pollForResult('https://api.bfl.ai/poll/gen-123', {
        initialInterval: 10,
        maxInterval: 20,
        timeout: 5000,
      });

      expect(result.status).toBe('Ready');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should re-throw BFLError from fetch without retrying', async () => {
      // When bflFetch throws a BFLError (e.g. 404), it should propagate immediately
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockFetchResponse(
          { message: 'Not found' },
          { ok: false, status: 404, statusText: 'Not Found' }
        ) as unknown as Response
      );

      await expect(
        pollForResult('https://api.bfl.ai/poll/gen-123', {
          initialInterval: 10,
          timeout: 5000,
        })
      ).rejects.toThrow(BFLError);
    });
  });

  // ===========================================================================
  // generateImage (high-level API)
  // ===========================================================================
  describe('generateImage', () => {
    it('should submit and poll to get a complete result', async () => {
      // First call: submit generation
      const submitResponse = {
        id: 'gen-100',
        polling_url: 'https://api.bfl.ai/poll/gen-100',
        status: 'Pending',
      };
      // Second call: poll result
      const pollResponse = {
        status: 'Ready',
        result: {
          sample: 'https://example.com/generated.png',
          seed: 99,
          prompt: 'Enhanced: A cat',
        },
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(submitResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(pollResponse) as unknown as Response);

      const result = await generateImage('A cat', {
        pollingConfig: { initialInterval: 10, timeout: 5000 },
      });

      expect(result.id).toBe('gen-100');
      expect(result.status).toBe('Ready');
      expect(result.imageUrl).toBe('https://example.com/generated.png');
      expect(result.seed).toBe(99);
      expect(result.model).toBe('flux-2-pro');
      expect(result.prompt).toBe('A cat');
      expect(result.enhancedPrompt).toBe('Enhanced: A cat');
      expect(result.dimensions).toEqual({ width: 1024, height: 1024 });
      expect(result.cost).toBeGreaterThan(0);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should throw BFLError when no image URL in result', async () => {
      const submitResponse = {
        id: 'gen-200',
        polling_url: 'https://api.bfl.ai/poll/gen-200',
        status: 'Pending',
      };
      const pollResponse = { status: 'Ready', result: {} };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(submitResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(pollResponse) as unknown as Response);

      await expect(
        generateImage('A cat', { pollingConfig: { initialInterval: 10, timeout: 5000 } })
      ).rejects.toThrow('no image URL returned');
    });

    it('should use custom dimensions and model', async () => {
      const submitResponse = {
        id: 'gen-300',
        polling_url: 'https://api.bfl.ai/poll/gen-300',
        status: 'Pending',
      };
      const pollResponse = {
        status: 'Ready',
        result: { sample: 'https://example.com/img.png', seed: 1 },
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(submitResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(pollResponse) as unknown as Response);

      const result = await generateImage('A landscape', {
        model: 'flux-2-klein-4b',
        width: 512,
        height: 256,
        pollingConfig: { initialInterval: 10, timeout: 5000 },
      });

      expect(result.model).toBe('flux-2-klein-4b');
      expect(result.dimensions).toEqual({ width: 512, height: 256 });
    });
  });

  // ===========================================================================
  // editImage (high-level API)
  // ===========================================================================
  describe('editImage', () => {
    it('should submit edit and poll to get a complete result', async () => {
      const submitResponse = {
        id: 'edit-100',
        polling_url: 'https://api.bfl.ai/poll/edit-100',
        status: 'Pending',
      };
      const pollResponse = {
        status: 'Ready',
        result: { sample: 'https://example.com/edited.png', seed: 55 },
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(submitResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(pollResponse) as unknown as Response);

      const result = await editImage('Make it red', ['base64img'], {
        pollingConfig: { initialInterval: 10, timeout: 5000 },
      });

      expect(result.id).toBe('edit-100');
      expect(result.status).toBe('Ready');
      expect(result.imageUrl).toBe('https://example.com/edited.png');
      expect(result.prompt).toBe('Make it red');
    });

    it('should throw BFLError when no image URL in edit result', async () => {
      const submitResponse = {
        id: 'edit-200',
        polling_url: 'https://api.bfl.ai/poll/edit-200',
        status: 'Pending',
      };
      const pollResponse = { status: 'Ready', result: {} };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockFetchResponse(submitResponse) as unknown as Response)
        .mockResolvedValueOnce(mockFetchResponse(pollResponse) as unknown as Response);

      await expect(
        editImage('Edit', ['img'], { pollingConfig: { initialInterval: 10, timeout: 5000 } })
      ).rejects.toThrow('no image URL returned');
    });
  });
});
