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

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ text: '{}' }] }),
    },
  })),
}));

// Mock AI SDK
const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// Mock Supabase
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({ data: { publicUrl: 'https://storage.example.com/doc.pdf' } }),
      }),
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

// Mock document generation
vi.mock('@/app/api/chat/documents', () => ({
  detectDocumentType: vi.fn().mockReturnValue(null),
  detectDocumentIntent: vi.fn().mockReturnValue(null),
  generateDocumentSchemaPrompt: vi.fn().mockReturnValue(''),
  stripCodeFences: vi.fn().mockImplementation((s: string) => s),
  validateDocumentJSON: vi.fn().mockReturnValue({ valid: true }),
  generateDocument: vi.fn().mockResolvedValue({
    buffer: Buffer.from('test'),
    filename: 'test.pdf',
    mimeType: 'application/pdf',
  }),
  uploadDocument: vi.fn().mockResolvedValue({
    publicUrl: 'https://storage.example.com/doc.pdf',
    filename: 'test.pdf',
  }),
  formatDocumentResponse: vi.fn().mockReturnValue('Document generated'),
  getResumeTemplatePrompt: vi.fn().mockReturnValue(''),
  generateResumeDocument: vi.fn().mockResolvedValue({
    buffer: Buffer.from('resume'),
    filename: 'resume.pdf',
    mimeType: 'application/pdf',
  }),
}));

// Mock queue/tracking
vi.mock('@/lib/queue', () => ({
  acquireSlot: vi.fn().mockResolvedValue({ acquired: true, position: 0 }),
  releaseSlot: vi.fn(),
}));

vi.mock('@/lib/ai/providers/registry', () => ({
  getDefaultChatModelId: vi.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
  getDefaultModel: vi.fn().mockReturnValue({
    provider: 'claude',
    modelId: 'claude-3-5-sonnet-20241022',
  }),
}));

vi.mock('@/lib/token-tracking', () => ({
  incrementTokenUsage: vi.fn(),
}));

// Import after mocks
const { handleExplicitDocumentGeneration, handleResumeGeneration, handleAutoDetectedDocument } =
  await import('../document-routes');

type DocRouteContext = Parameters<typeof handleExplicitDocumentGeneration>[0];

function createMockContext(overrides: Partial<DocRouteContext> = {}): DocRouteContext {
  return {
    messages: [{ role: 'user' as const, content: 'Create a business report' }],
    lastUserContent: 'Create a business report',
    userId: 'user-123',
    userPlanKey: 'pro',
    conversationId: 'conv-456',
    requestId: 'req-789',
    isAuthenticated: true,
    memoryContext: '',
    slotAcquired: false,
    ...overrides,
  };
}

describe('handleExplicitDocumentGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const ctx = createMockContext({ isAuthenticated: false });
    const result = await handleExplicitDocumentGeneration(ctx, 'pdf');

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const data = await result!.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });
});

describe('handleResumeGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns auth error when user is not authenticated', async () => {
    const ctx = createMockContext({ isAuthenticated: false });
    const result = await handleResumeGeneration(ctx);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe(401);
    }
  });
});

describe('handleAutoDetectedDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user is not authenticated', async () => {
    const ctx = createMockContext({ isAuthenticated: false });
    const result = await handleAutoDetectedDocument(ctx);

    expect(result).toBeNull();
  });

  it('returns null when no document intent is detected', async () => {
    const { detectDocumentIntent } = await import('@/app/api/chat/documents');
    vi.mocked(detectDocumentIntent).mockReturnValue(null);

    const ctx = createMockContext();
    const result = await handleAutoDetectedDocument(ctx);

    expect(result).toBeNull();
  });
});
