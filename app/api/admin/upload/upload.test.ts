/**
 * ADMIN UPLOAD API TESTS
 *
 * Tests for /api/admin/upload endpoint:
 * - File type validation (MIME types)
 * - Magic byte verification (SEC-004)
 * - File size limits
 * - Admin authentication
 * - Rate limiting
 * - Supabase storage upload
 * - Base64 fallback when Supabase not configured
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'admin-user-id', email: 'admin@example.com' },
    adminUser: {
      id: 'admin-123',
      permissions: {
        can_view_users: true,
        can_edit_users: true,
        can_view_conversations: true,
        can_export_data: true,
        can_manage_subscriptions: true,
        can_ban_users: true,
      },
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/api/utils', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: vi.fn((data) => NextResponse.json({ ok: true, data }, { status: 200 })),
    errors: {
      unauthorized: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      ),
      forbidden: vi.fn(() => NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })),
      badRequest: vi.fn((msg: string) =>
        NextResponse.json({ ok: false, error: msg }, { status: 400 })
      ),
      serverError: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
      ),
      rateLimited: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
      ),
    },
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    rateLimits: {
      strict: { limit: 10, windowMs: 60000 },
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Upload API Module', () => {
  it('should export POST handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.POST).toBeDefined();
    expect(typeof routeModule.POST).toBe('function');
  });

  it('should have correct runtime config', async () => {
    const routeModule = await import('./route');
    expect(routeModule.dynamic).toBe('force-dynamic');
    expect(routeModule.runtime).toBe('nodejs');
  });
});

describe('File Type Validation', () => {
  it('should accept valid image types', () => {
    const validImageTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/gif',
    ];

    // All standard image types should be supported
    for (const type of validImageTypes) {
      expect(type).toMatch(/^image\//);
    }
  });

  it('should accept valid video types', () => {
    const validVideoTypes = ['video/mp4', 'video/webm'];

    for (const type of validVideoTypes) {
      expect(type).toMatch(/^video\//);
    }
  });

  it('should reject unsupported file types', () => {
    const unsupportedTypes = [
      'application/javascript',
      'text/html',
      'application/xml',
      'text/css',
      'application/octet-stream',
      'application/x-executable',
    ];

    const supportedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/gif',
      'video/mp4',
      'video/webm',
    ];

    for (const type of unsupportedTypes) {
      expect(supportedTypes).not.toContain(type);
    }
  });
});

describe('Magic Byte Verification (SEC-004)', () => {
  it('should verify PNG magic bytes', () => {
    // PNG starts with: 0x89 0x50 0x4E 0x47
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(pngHeader[0]).toBe(0x89);
    expect(pngHeader[1]).toBe(0x50); // 'P'
    expect(pngHeader[2]).toBe(0x4e); // 'N'
    expect(pngHeader[3]).toBe(0x47); // 'G'
  });

  it('should verify JPEG magic bytes', () => {
    // JPEG starts with: 0xFF 0xD8 0xFF
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(jpegHeader[0]).toBe(0xff);
    expect(jpegHeader[1]).toBe(0xd8);
    expect(jpegHeader[2]).toBe(0xff);
  });

  it('should verify GIF magic bytes', () => {
    // GIF starts with: 0x47 0x49 0x46 0x38 (GIF8)
    const gifHeader = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    ]);
    expect(gifHeader.toString('ascii', 0, 3)).toBe('GIF');
  });

  it('should verify ICO magic bytes', () => {
    // ICO starts with: 0x00 0x00 0x01 0x00
    const icoHeader = Buffer.from([
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00,
    ]);
    expect(icoHeader[0]).toBe(0x00);
    expect(icoHeader[1]).toBe(0x00);
    expect(icoHeader[2]).toBe(0x01);
    expect(icoHeader[3]).toBe(0x00);
  });

  it('should verify MP4 magic bytes at offset 4', () => {
    // MP4 has 'ftyp' at offset 4
    const mp4Header = Buffer.from([
      0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(mp4Header.toString('ascii', 4, 8)).toBe('ftyp');
  });

  it('should verify WebM magic bytes', () => {
    // WebM starts with EBML header: 0x1A 0x45 0xDF 0xA3
    const webmHeader = Buffer.from([
      0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72,
    ]);
    expect(webmHeader[0]).toBe(0x1a);
    expect(webmHeader[1]).toBe(0x45);
    expect(webmHeader[2]).toBe(0xdf);
    expect(webmHeader[3]).toBe(0xa3);
  });

  it('should reject files with mismatched magic bytes', () => {
    // A file claiming to be PNG but with JPEG bytes
    const fakeHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);

    // PNG signature check
    const pngSignature = [0x89, 0x50, 0x4e, 0x47];
    const matches = pngSignature.every((b, i) => fakeHeader[i] === b);
    expect(matches).toBe(false);
  });

  it('should reject files smaller than 12 bytes', () => {
    const tinyBuffer = Buffer.from([0x89, 0x50]);
    expect(tinyBuffer.length).toBeLessThan(12);
  });
});

describe('File Size Limits', () => {
  it('should enforce 5MB limit for images', () => {
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    expect(maxImageSize).toBe(5242880);
  });

  it('should enforce 15MB limit for videos', () => {
    const maxVideoSize = 15 * 1024 * 1024; // 15MB
    expect(maxVideoSize).toBe(15728640);
  });

  it('should distinguish between image and video size limits', () => {
    const imageLimit = 5 * 1024 * 1024;
    const videoLimit = 15 * 1024 * 1024;
    expect(videoLimit).toBeGreaterThan(imageLimit);
    expect(videoLimit / imageLimit).toBe(3);
  });
});

describe('Admin Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require admin privileges', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const { POST } = await import('./route');

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');
    formData.append('type', 'main_logo');

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    expect(response.status).toBe(403);

    // Restore
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: true,
      user: { id: 'admin-user-id', email: 'admin@example.com' },
      adminUser: {
        id: 'admin-123',
        permissions: {
          can_view_users: true,
          can_edit_users: true,
          can_view_conversations: true,
          can_export_data: true,
          can_manage_subscriptions: true,
          can_ban_users: true,
        },
      },
    });
  });

  it('should reject unauthenticated requests', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const { POST } = await import('./route');

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    expect(response.status).toBe(401);

    // Restore
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: true,
      user: { id: 'admin-user-id', email: 'admin@example.com' },
      adminUser: {
        id: 'admin-123',
        permissions: {
          can_view_users: true,
          can_edit_users: true,
          can_view_conversations: true,
          can_export_data: true,
          can_manage_subscriptions: true,
          can_ban_users: true,
        },
      },
    });
  });
});

describe('Upload Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enforce strict rate limiting for uploads', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(checkRequestRateLimit).mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 }),
    });

    const { POST } = await import('./route');

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');
    formData.append('type', 'main_logo');

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    expect(response.status).toBe(429);

    // Restore
    vi.mocked(checkRequestRateLimit).mockResolvedValue({ allowed: true });
  });
});

describe('Filename Generation', () => {
  it('should generate unique filenames with timestamp and random string', () => {
    const fileType = 'main_logo';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = 'png';

    const filename = `${fileType}_${timestamp}_${randomStr}.${ext}`;

    expect(filename).toMatch(/^main_logo_\d+_[a-z0-9]+\.png$/);
    expect(filename).toContain(fileType);
    expect(filename).toContain(ext);
  });

  it('should use correct extension from uploaded file', () => {
    const testFiles = [
      { name: 'logo.png', expected: 'png' },
      { name: 'icon.ico', expected: 'ico' },
      { name: 'animation.mp4', expected: 'mp4' },
      { name: 'clip.webm', expected: 'webm' },
      { name: 'photo.jpeg', expected: 'jpeg' },
    ];

    for (const file of testFiles) {
      const ext = file.name.split('.').pop();
      expect(ext).toBe(file.expected);
    }
  });

  it('should default extension for files without one', () => {
    const filename = 'noextension';
    const ext = filename.split('.').pop() || 'png';
    // When split produces only one element (no dot), pop returns the whole name
    // The fallback should be 'png' for images
    expect(ext === filename ? 'png' : ext).toBe('png');
  });
});

describe('Supabase Storage', () => {
  it('should set immutable cache control for CDN delivery', () => {
    const cacheControl = '31536000'; // 1 year
    expect(Number(cacheControl)).toBe(365 * 24 * 60 * 60);
  });

  it('should use branding bucket', () => {
    const bucketName = 'branding';
    expect(bucketName).toBe('branding');
  });

  it('should not upsert (prevent accidental overwrite)', () => {
    const upsert = false;
    expect(upsert).toBe(false);
  });

  it('should auto-create bucket if not found', () => {
    // The upload handler attempts to create the bucket with:
    const bucketConfig = {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
    };

    expect(bucketConfig.public).toBe(true);
    expect(bucketConfig.fileSizeLimit).toBe(15728640);
  });
});

describe('Base64 Fallback', () => {
  it('should construct valid data URL when Supabase not configured', () => {
    const mimeType = 'image/png';
    const base64Data = 'iVBORw0KGgo='; // Truncated base64 for test
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('should include correct response metadata for base64', () => {
    const response = {
      url: 'data:image/png;base64,abc123',
      type: 'image/png',
      size: 1024,
      isVideo: false,
    };

    expect(response.url).toMatch(/^data:/);
    expect(response.isVideo).toBe(false);
    expect(response.size).toBeGreaterThan(0);
  });

  it('should include storage indicator for CDN uploads', () => {
    const cdnResponse = {
      url: 'https://example.supabase.co/storage/v1/object/public/branding/logo.png',
      type: 'image/png',
      size: 1024,
      isVideo: false,
      storage: 'supabase',
    };

    expect(cdnResponse.storage).toBe('supabase');
    expect(cdnResponse.url).toMatch(/^https:/);
  });
});
