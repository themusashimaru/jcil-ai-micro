// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, mockFetch } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockRemove = vi.fn();
  const mockCreateSignedUrl = vi.fn();
  const mockList = vi.fn();

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
      remove: mockRemove,
      createSignedUrl: mockCreateSignedUrl,
      list: mockList,
    }),
  };

  return {
    mockSupabase: {
      storage: mockStorage,
      mockUpload,
      mockGetPublicUrl,
      mockRemove,
      mockCreateSignedUrl,
      mockList,
    },
    mockFetch: vi.fn(),
  };
});

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock global fetch
vi.stubGlobal('fetch', mockFetch);

import {
  downloadAndStore,
  storeBuffer,
  storeBase64Image,
  deleteGeneration,
  getSignedUrl,
  generationExists,
  listUserGenerations,
} from './storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupUploadSuccess(path = 'user1/gen1.png') {
  mockSupabase.mockUpload.mockResolvedValue({
    data: { path },
    error: null,
  });
  mockSupabase.mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: `https://storage.example.com/${path}` },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bfl/storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUploadSuccess();
  });

  // =========================================================================
  // downloadAndStore
  // =========================================================================

  describe('downloadAndStore', () => {
    it('should download image and store in Supabase', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const url = await downloadAndStore('https://bfl.ai/img.png', 'user1', 'gen1');
      expect(url).toContain('storage.example.com');
    });

    it('should use correct storage path', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      await downloadAndStore('https://bfl.ai/img.png', 'user1', 'gen1', 'jpeg');
      expect(mockSupabase.mockUpload).toHaveBeenCalledWith(
        'user1/gen1.jpeg',
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'image/jpeg' })
      );
    });

    it('should default to png format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      await downloadAndStore('https://bfl.ai/img', 'user1', 'gen1');
      expect(mockSupabase.mockUpload).toHaveBeenCalledWith(
        'user1/gen1.png',
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'image/png' })
      );
    });

    it('should throw on failed download', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(downloadAndStore('https://bfl.ai/gone', 'u1', 'g1')).rejects.toThrow(
        'Failed to download'
      );
    });

    it('should throw on upload error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });
      mockSupabase.mockUpload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      await expect(downloadAndStore('https://bfl.ai/img', 'u1', 'g1')).rejects.toThrow(
        'Failed to store'
      );
    });

    it('should not upsert existing files', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      await downloadAndStore('https://bfl.ai/img', 'u1', 'g1');
      expect(mockSupabase.mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({ upsert: false })
      );
    });
  });

  // =========================================================================
  // storeBuffer
  // =========================================================================

  describe('storeBuffer', () => {
    it('should store Uint8Array buffer', async () => {
      const buffer = new Uint8Array([1, 2, 3]);
      const url = await storeBuffer(buffer, 'user1', 'gen1');
      expect(url).toContain('storage.example.com');
    });

    it('should store Buffer (Node.js)', async () => {
      const buffer = Buffer.from([1, 2, 3]);
      const url = await storeBuffer(buffer, 'user1', 'gen1');
      expect(url).toContain('storage.example.com');
    });

    it('should use correct path and format', async () => {
      await storeBuffer(new Uint8Array([1]), 'user2', 'gen2', 'webp');
      expect(mockSupabase.mockUpload).toHaveBeenCalledWith(
        'user2/gen2.webp',
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'image/webp' })
      );
    });

    it('should throw on upload error', async () => {
      mockSupabase.mockUpload.mockResolvedValue({
        data: null,
        error: { message: 'Quota exceeded' },
      });

      await expect(storeBuffer(new Uint8Array([1]), 'u1', 'g1')).rejects.toThrow('Failed to store');
    });
  });

  // =========================================================================
  // storeBase64Image
  // =========================================================================

  describe('storeBase64Image', () => {
    it('should store base64 image data', async () => {
      const b64 = btoa('fake image data');
      const url = await storeBase64Image(b64, 'user1', 'gen1');
      expect(url).toContain('storage.example.com');
    });

    it('should strip data URL prefix', async () => {
      const b64 = `data:image/png;base64,${btoa('fake')}`;
      await storeBase64Image(b64, 'user1', 'gen1');
      // Should upload the decoded bytes, not the prefix
      expect(mockSupabase.mockUpload).toHaveBeenCalled();
    });

    it('should use correct content type for format', async () => {
      const b64 = btoa('data');
      await storeBase64Image(b64, 'u1', 'g1', 'jpeg');
      expect(mockSupabase.mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'image/jpeg' })
      );
    });

    it('should throw on upload error', async () => {
      mockSupabase.mockUpload.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized' },
      });

      await expect(storeBase64Image(btoa('x'), 'u1', 'g1')).rejects.toThrow('Failed to store');
    });
  });

  // =========================================================================
  // deleteGeneration
  // =========================================================================

  describe('deleteGeneration', () => {
    it('should delete generation from storage', async () => {
      mockSupabase.mockRemove.mockResolvedValue({ error: null });
      await deleteGeneration('user1', 'gen1');
      expect(mockSupabase.mockRemove).toHaveBeenCalledWith(['user1/gen1.png']);
    });

    it('should use custom format', async () => {
      mockSupabase.mockRemove.mockResolvedValue({ error: null });
      await deleteGeneration('user1', 'gen1', 'webp');
      expect(mockSupabase.mockRemove).toHaveBeenCalledWith(['user1/gen1.webp']);
    });

    it('should not throw on delete error (logs warning)', async () => {
      mockSupabase.mockRemove.mockResolvedValue({
        error: { message: 'Not found' },
      });
      // Should not throw
      await deleteGeneration('user1', 'gen1');
    });
  });

  // =========================================================================
  // getSignedUrl
  // =========================================================================

  describe('getSignedUrl', () => {
    it('should return signed URL', async () => {
      mockSupabase.mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed.example.com/img' },
        error: null,
      });

      const url = await getSignedUrl('user1', 'gen1');
      expect(url).toBe('https://signed.example.com/img');
    });

    it('should use default 1 hour expiration', async () => {
      mockSupabase.mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'url' },
        error: null,
      });

      await getSignedUrl('u1', 'g1');
      expect(mockSupabase.mockCreateSignedUrl).toHaveBeenCalledWith('u1/g1.png', 3600);
    });

    it('should use custom expiration', async () => {
      mockSupabase.mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'url' },
        error: null,
      });

      await getSignedUrl('u1', 'g1', 'png', 7200);
      expect(mockSupabase.mockCreateSignedUrl).toHaveBeenCalledWith('u1/g1.png', 7200);
    });

    it('should throw on error', async () => {
      mockSupabase.mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Access denied' },
      });

      await expect(getSignedUrl('u1', 'g1')).rejects.toThrow('Failed to create signed URL');
    });
  });

  // =========================================================================
  // generationExists
  // =========================================================================

  describe('generationExists', () => {
    it('should return true when generation exists', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: [{ name: 'gen1.png' }],
        error: null,
      });

      expect(await generationExists('user1', 'gen1')).toBe(true);
    });

    it('should return false when generation does not exist', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: [],
        error: null,
      });

      expect(await generationExists('user1', 'gen1')).toBe(false);
    });

    it('should return false on error', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      expect(await generationExists('user1', 'gen1')).toBe(false);
    });

    it('should search with correct format', async () => {
      mockSupabase.mockList.mockResolvedValue({ data: [], error: null });
      await generationExists('u1', 'g1', 'webp');
      expect(mockSupabase.mockList).toHaveBeenCalledWith('u1', { search: 'g1.webp' });
    });
  });

  // =========================================================================
  // listUserGenerations
  // =========================================================================

  describe('listUserGenerations', () => {
    it('should list user generations', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: [
          { name: 'gen1.png', created_at: '2026-01-01' },
          { name: 'gen2.png', created_at: '2026-01-02' },
        ],
        error: null,
      });

      const results = await listUserGenerations('user1');
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('gen1.png');
    });

    it('should use default options', async () => {
      mockSupabase.mockList.mockResolvedValue({ data: [], error: null });
      await listUserGenerations('user1');
      expect(mockSupabase.mockList).toHaveBeenCalledWith('user1', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    });

    it('should use custom options', async () => {
      mockSupabase.mockList.mockResolvedValue({ data: [], error: null });
      await listUserGenerations('user1', {
        limit: 10,
        offset: 20,
        sortBy: { column: 'name', order: 'asc' },
      });
      expect(mockSupabase.mockList).toHaveBeenCalledWith('user1', {
        limit: 10,
        offset: 20,
        sortBy: { column: 'name', order: 'asc' },
      });
    });

    it('should throw on error', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      await expect(listUserGenerations('user1')).rejects.toThrow('Failed to list');
    });

    it('should handle files without created_at', async () => {
      mockSupabase.mockList.mockResolvedValue({
        data: [{ name: 'gen1.png' }],
        error: null,
      });

      const results = await listUserGenerations('user1');
      expect(results[0].created_at).toBeTruthy();
    });
  });
});
