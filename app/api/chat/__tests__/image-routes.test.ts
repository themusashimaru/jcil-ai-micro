import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock BFL connector
const mockIsBFLConfigured = vi.fn().mockReturnValue(true);
const mockDetectImageRequest = vi.fn();
const mockDetectEditWithAttachment = vi.fn();
const mockDetectConversationalEdit = vi.fn();
const mockGenerateImage = vi.fn();
const mockEditImage = vi.fn();
const mockDownloadAndStore = vi.fn();
const mockEnhanceImagePrompt = vi.fn();
const mockEnhanceEditPromptWithVision = vi.fn();
const mockVerifyGenerationResult = vi.fn();

vi.mock('@/lib/connectors/bfl', () => ({
  isBFLConfigured: () => mockIsBFLConfigured(),
  detectImageRequest: (...args: unknown[]) => mockDetectImageRequest(...args),
  detectEditWithAttachment: (...args: unknown[]) => mockDetectEditWithAttachment(...args),
  detectConversationalEdit: (...args: unknown[]) => mockDetectConversationalEdit(...args),
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
  editImage: (...args: unknown[]) => mockEditImage(...args),
  downloadAndStore: (...args: unknown[]) => mockDownloadAndStore(...args),
  enhanceImagePrompt: (...args: unknown[]) => mockEnhanceImagePrompt(...args),
  enhanceEditPromptWithVision: (...args: unknown[]) => mockEnhanceEditPromptWithVision(...args),
  verifyGenerationResult: (...args: unknown[]) => mockVerifyGenerationResult(...args),
  ASPECT_RATIOS: { '1:1': '1024x1024', '16:9': '1344x768', '9:16': '768x1344' },
  BFLError: class BFLError extends Error {},
}));

// Mock Supabase
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(),
}));

// Mock helpers
vi.mock('@/app/api/chat/helpers', () => ({
  getImageAttachments: vi.fn().mockReturnValue([]),
  findPreviousGeneratedImage: vi.fn().mockReturnValue(null),
}));

// Import after mocks
const { tryImageCreation, tryImageEditWithAttachment, tryConversationalImageEdit } = await import(
  '../image-routes'
);

describe('tryImageCreation', () => {
  const baseCtx = {
    messages: [{ role: 'user' as const, content: 'Create an image of a sunset' }],
    lastUserContent: 'Create an image of a sunset',
    userId: 'user-123',
    conversationId: 'conv-456',
    isAuthenticated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBFLConfigured.mockReturnValue(true);
  });

  it('returns null when BFL is not configured', async () => {
    mockIsBFLConfigured.mockReturnValue(false);

    const result = await tryImageCreation(baseCtx);

    expect(result).toBeNull();
    expect(mockDetectImageRequest).not.toHaveBeenCalled();
  });

  it('returns null when user is not authenticated', async () => {
    const result = await tryImageCreation({ ...baseCtx, isAuthenticated: false });

    expect(result).toBeNull();
  });

  it('returns null when message is not an image request', async () => {
    mockDetectImageRequest.mockResolvedValue({
      isImageRequest: false,
    });

    const result = await tryImageCreation(baseCtx);

    expect(result).toBeNull();
  });

  it('returns null when image request type is not create', async () => {
    mockDetectImageRequest.mockResolvedValue({
      isImageRequest: true,
      requestType: 'edit',
      confidence: 'high',
    });

    const result = await tryImageCreation(baseCtx);

    expect(result).toBeNull();
  });

  it('calls detectImageRequest with correct parameters', async () => {
    mockDetectImageRequest.mockResolvedValue({
      isImageRequest: false,
    });

    await tryImageCreation(baseCtx);

    expect(mockDetectImageRequest).toHaveBeenCalledWith(
      'Create an image of a sunset',
      expect.objectContaining({ useClaude: false, minConfidence: 'high' })
    );
  });
});

describe('tryImageEditWithAttachment', () => {
  const baseCtx = {
    messages: [{ role: 'user' as const, content: 'Make this image brighter' }],
    lastUserContent: 'Make this image brighter',
    userId: 'user-123',
    conversationId: 'conv-456',
    isAuthenticated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBFLConfigured.mockReturnValue(true);
  });

  it('returns null when BFL is not configured', async () => {
    mockIsBFLConfigured.mockReturnValue(false);

    const result = await tryImageEditWithAttachment(baseCtx);

    expect(result).toBeNull();
  });

  it('returns null when user is not authenticated', async () => {
    const result = await tryImageEditWithAttachment({
      ...baseCtx,
      isAuthenticated: false,
    });

    expect(result).toBeNull();
  });

  it('returns null when no image attachment detected', async () => {
    mockDetectEditWithAttachment.mockResolvedValue(null);

    const result = await tryImageEditWithAttachment(baseCtx);

    expect(result).toBeNull();
  });
});

describe('tryConversationalImageEdit', () => {
  const baseCtx = {
    messages: [{ role: 'user' as const, content: 'Now make it darker' }],
    lastUserContent: 'Now make it darker',
    userId: 'user-123',
    conversationId: 'conv-456',
    isAuthenticated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBFLConfigured.mockReturnValue(true);
  });

  it('returns null when BFL is not configured', async () => {
    mockIsBFLConfigured.mockReturnValue(false);

    const result = await tryConversationalImageEdit(baseCtx);

    expect(result).toBeNull();
  });

  it('returns null when user is not authenticated', async () => {
    const result = await tryConversationalImageEdit({
      ...baseCtx,
      isAuthenticated: false,
    });

    expect(result).toBeNull();
  });

  it('returns null when no conversational edit detected', async () => {
    mockDetectConversationalEdit.mockResolvedValue(null);

    const result = await tryConversationalImageEdit(baseCtx);

    expect(result).toBeNull();
  });
});
