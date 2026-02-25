/**
 * Tests for Document Storage
 *
 * Tests uploadDocument with mocked Supabase storage
 */

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockUpload = vi.fn();
const mockCreateBucket = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      createBucket: mockCreateBucket,
      from: vi.fn(() => ({
        upload: mockUpload,
      })),
    },
  })),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadDocument } from './storage';

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateBucket.mockResolvedValue({});
  mockUpload.mockResolvedValue({ error: null });
});

describe('uploadDocument', () => {
  it('should fall back to base64 when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const buffer = Buffer.from('test content');
    const result = await uploadDocument('user-1', buffer, 'test.pdf', 'application/pdf');

    expect(result.storage).toBe('base64');
    expect(result.url.startsWith('data:application/pdf;base64,')).toBe(true);
  });

  it('should upload to Supabase when configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://jcil.ai';

    const buffer = Buffer.from('pdf content');
    const result = await uploadDocument('user-1', buffer, 'doc.pdf', 'application/pdf');

    expect(result.storage).toBe('supabase');
    expect(result.url).toContain('/api/documents/download?token=');
  });

  it('should fall back to base64 on upload error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });

    const buffer = Buffer.from('test content');
    const result = await uploadDocument('user-1', buffer, 'test.pdf', 'application/pdf');

    expect(result.storage).toBe('base64');
    expect(result.url.startsWith('data:')).toBe(true);
  });

  it('should handle bucket creation errors gracefully', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://jcil.ai';

    mockCreateBucket.mockRejectedValue(new Error('Bucket exists'));

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-1', buffer, 'file.docx', 'application/docx');

    // Should still succeed since bucket already exists
    expect(result.storage).toBe('supabase');
  });

  it('should fall back to base64 on unexpected errors', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    mockUpload.mockRejectedValue(new Error('Network error'));

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-1', buffer, 'file.pdf', 'application/pdf');

    expect(result.storage).toBe('base64');
  });

  it('should use default app URL when not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    delete process.env.NEXT_PUBLIC_APP_URL;

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-1', buffer, 'file.pdf', 'application/pdf');

    expect(result.storage).toBe('supabase');
    expect(result.url).toContain('https://jcil.ai');
  });

  it('should encode user id and filename in the token', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://jcil.ai';

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-42', buffer, 'report.xlsx', 'application/xlsx');

    // Extract and decode token
    const tokenMatch = result.url.match(/token=(.+)$/);
    expect(tokenMatch).not.toBeNull();

    const decoded = JSON.parse(Buffer.from(tokenMatch![1], 'base64url').toString());
    expect(decoded.u).toBe('user-42');
    expect(decoded.f).toContain('report.xlsx');
    expect(decoded.t).toBe('xlsx');
  });

  it('should generate base64 data URL with correct mime type', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const buffer = Buffer.from('spreadsheet data');
    const result = await uploadDocument(
      'user-1',
      buffer,
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    expect(
      result.url.startsWith(
        'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'
      )
    ).toBe(true);
  });

  it('should include buffer content in base64 URL', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const content = 'hello world';
    const buffer = Buffer.from(content);
    const result = await uploadDocument('user-1', buffer, 'test.txt', 'text/plain');

    const base64Part = result.url.split(',')[1];
    const decoded = Buffer.from(base64Part, 'base64').toString();
    expect(decoded).toBe(content);
  });

  it('should handle missing only supabase URL', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-1', buffer, 'file.pdf', 'application/pdf');

    expect(result.storage).toBe('base64');
  });

  it('should handle missing only service key', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const buffer = Buffer.from('content');
    const result = await uploadDocument('user-1', buffer, 'file.pdf', 'application/pdf');

    expect(result.storage).toBe('base64');
  });
});
