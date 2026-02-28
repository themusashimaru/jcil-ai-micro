// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockOrder = vi.fn().mockReturnValue({ data: [], error: null });
const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  select: mockSelect,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock E2B code runner
vi.mock('../tools/e2bCode', () => ({
  runCode: vi.fn().mockResolvedValue({ success: false, stdout: '', error: 'No E2B' }),
}));

import { generateArtifacts, getSessionArtifacts } from '../ArtifactGenerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOutput(overrides = {}) {
  return {
    recommendation: {
      title: 'Use React',
      summary: 'React is the best choice for this project.',
      confidence: 85,
      reasoning: ['Large ecosystem', 'Team familiarity'],
      tradeoffs: ['Larger bundle size', 'Learning curve for hooks'],
    },
    alternatives: [
      {
        title: 'Vue.js',
        summary: 'Vue is simpler but less ecosystem.',
        confidence: 70,
        whyNotTop: 'Smaller community',
      },
      {
        title: 'Svelte',
        summary: 'Svelte compiles away.',
        confidence: 60,
        whyNotTop: 'Less mature ecosystem',
      },
    ],
    analysis: {
      byDomain: [
        {
          domain: 'Frontend',
          summary: 'React dominates frontend space.',
          comparisonTable: {
            headers: ['Framework', 'Popularity', 'Performance'],
            rows: [
              { option: 'React', values: ['High', 'Good'] },
              { option: 'Vue', values: ['Medium', 'Great'] },
            ],
          },
        },
      ],
      riskAssessment: {
        overallRisk: 'medium',
        risks: [
          {
            risk: 'Bundle size',
            probability: 'medium',
            impact: 'low',
            mitigation: 'Code splitting',
          },
        ],
      },
    },
    actionPlan: [
      {
        order: 1,
        action: 'Set up project',
        priority: 'high',
        timeframe: '1 week',
        details: 'Use create-react-app',
      },
    ],
    gaps: ['Need to evaluate SSR performance'],
    nextSteps: ['Start prototype', 'Run benchmarks'],
    metadata: {
      totalAgents: 5,
      totalSearches: 12,
      totalCost: 0.45,
      executionTime: 32000,
      qualityScore: 88,
    },
    ...overrides,
  };
}

function createMockFinding(overrides = {}) {
  return {
    type: 'fact',
    title: 'React has 200k+ stars',
    content: 'React is the most popular frontend framework on GitHub.',
    confidence: 0.95,
    relevanceScore: 0.88,
    agentName: 'ResearchAgent',
    sources: [{ url: 'https://github.com/facebook/react', title: 'React GitHub' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should generate artifacts from output', async () => {
    const output = createMockOutput();
    const findings = [createMockFinding()];

    const artifacts = await generateArtifacts('user-1', 'session-1', output, findings);

    expect(artifacts.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate comparison CSV when domain has comparison table', async () => {
    const output = createMockOutput();
    const artifacts = await generateArtifacts('user-1', 'session-1', output, []);

    const csvArtifact = artifacts.find((a) => a.type === 'csv' && a.title === 'Comparison Table');
    expect(csvArtifact).toBeDefined();
    expect(csvArtifact?.mimeType).toBe('text/csv');
    expect(csvArtifact?.contentText).toContain('Framework');
    expect(csvArtifact?.contentText).toContain('React');
    expect(csvArtifact?.contentText).toContain('Vue');
  });

  it('should not generate comparison CSV when no tables exist', async () => {
    const output = createMockOutput({
      analysis: {
        byDomain: [{ domain: 'Test', summary: 'No table' }],
        riskAssessment: { overallRisk: 'low', risks: [] },
      },
    });

    const artifacts = await generateArtifacts('user-1', 'session-1', output, []);
    const csvArtifact = artifacts.find((a) => a.title === 'Comparison Table');
    expect(csvArtifact).toBeUndefined();
  });

  it('should generate findings CSV when findings provided', async () => {
    const findings = [
      createMockFinding(),
      createMockFinding({ title: 'Second finding', content: 'Another finding.' }),
    ];

    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), findings);
    const findingsArtifact = artifacts.find((a) => a.title === 'All Research Findings');

    expect(findingsArtifact).toBeDefined();
    expect(findingsArtifact?.contentText).toContain('Type');
    expect(findingsArtifact?.contentText).toContain('Title');
    expect(findingsArtifact?.contentText).toContain('React has 200k+ stars');
    expect(findingsArtifact?.contentText).toContain('Second finding');
  });

  it('should not generate findings CSV when no findings', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const findingsArtifact = artifacts.find((a) => a.title === 'All Research Findings');
    expect(findingsArtifact).toBeUndefined();
  });

  it('should always generate executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report).toBeDefined();
    expect(report?.mimeType).toBe('text/markdown');
    expect(report?.contentText).toContain('Use React');
    expect(report?.contentText).toContain('Executive Summary');
    expect(report?.contentText).toContain('85%');
  });

  it('should include reasoning in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Large ecosystem');
    expect(report?.contentText).toContain('Team familiarity');
  });

  it('should include trade-offs in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Larger bundle size');
  });

  it('should include alternatives in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Vue.js');
    expect(report?.contentText).toContain('Smaller community');
  });

  it('should include risk assessment in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Risk Assessment');
    expect(report?.contentText).toContain('Bundle size');
    expect(report?.contentText).toContain('Code splitting');
  });

  it('should include action plan in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Set up project');
    expect(report?.contentText).toContain('1 week');
  });

  it('should include gaps and next steps in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('SSR performance');
    expect(report?.contentText).toContain('Start prototype');
    expect(report?.contentText).toContain('Run benchmarks');
  });

  it('should include metadata in executive report', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).toContain('Agents Deployed: 5');
    expect(report?.contentText).toContain('$0.45');
    expect(report?.contentText).toContain('Quality Score: 88');
  });

  it('should store artifacts in supabase', async () => {
    await generateArtifacts('user-1', 'session-1', createMockOutput(), [createMockFinding()]);

    // At minimum: comparison CSV + findings CSV + executive report = 3 inserts
    expect(mockInsert).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('strategy_artifacts');
  });

  it('should call stream callback', async () => {
    const onStream = vi.fn();
    await generateArtifacts('user-1', 'session-1', createMockOutput(), [], onStream);

    expect(onStream).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'synthesis_progress', message: 'Generating deliverables...' })
    );
  });

  it('should handle supabase insert error gracefully', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } });

    // Should not throw
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);
    expect(artifacts.length).toBeGreaterThan(0);
  });

  it('should set correct file names with session prefix', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-123-abc', createMockOutput(), [
      createMockFinding(),
    ]);

    for (const artifact of artifacts) {
      expect(artifact.fileName).toContain('session-');
    }
  });

  it('should set sizeBytes correctly', async () => {
    const artifacts = await generateArtifacts('user-1', 'session-1', createMockOutput(), []);

    for (const artifact of artifacts) {
      expect(artifact.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('should escape CSV fields with commas', async () => {
    const output = createMockOutput({
      analysis: {
        byDomain: [
          {
            domain: 'Test',
            summary: 'Test domain',
            comparisonTable: {
              headers: ['Name', 'Value'],
              rows: [{ option: 'Option, with comma', values: ['value "with" quotes'] }],
            },
          },
        ],
        riskAssessment: { overallRisk: 'low', risks: [] },
      },
    });

    const artifacts = await generateArtifacts('user-1', 'session-1', output, []);
    const csv = artifacts.find((a) => a.title === 'Comparison Table');

    expect(csv?.contentText).toContain('"Option, with comma"');
  });

  it('should handle empty alternatives list', async () => {
    const output = createMockOutput({ alternatives: [] });
    const artifacts = await generateArtifacts('user-1', 'session-1', output, []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report).toBeDefined();
    // No "Alternative Options" section should appear
    expect(report?.contentText).not.toContain('Alternative Options');
  });

  it('should handle empty gaps list', async () => {
    const output = createMockOutput({ gaps: [] });
    const artifacts = await generateArtifacts('user-1', 'session-1', output, []);
    const report = artifacts.find((a) => a.type === 'report');

    expect(report?.contentText).not.toContain('Information Gaps');
  });
});

describe('getSessionArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should query supabase for session artifacts', async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          id: 'art-1',
          session_id: 'session-1',
          artifact_type: 'report',
          title: 'Test Report',
          description: 'A test report',
          mime_type: 'text/markdown',
          file_name: 'report.md',
          content_text: '# Report',
          size_bytes: 100,
          created_at: '2026-02-27T00:00:00Z',
        },
      ],
      error: null,
    });

    const artifacts = await getSessionArtifacts('session-1');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe('art-1');
    expect(artifacts[0].type).toBe('report');
    expect(artifacts[0].title).toBe('Test Report');
  });

  it('should return empty array on supabase error', async () => {
    mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } });

    const artifacts = await getSessionArtifacts('session-1');
    expect(artifacts).toEqual([]);
  });

  it('should return empty array when no data', async () => {
    mockOrder.mockReturnValue({ data: null, error: null });

    const artifacts = await getSessionArtifacts('session-1');
    expect(artifacts).toEqual([]);
  });

  it('should map supabase rows to Artifact objects', async () => {
    mockOrder.mockReturnValue({
      data: [
        {
          id: 'art-2',
          session_id: 'session-2',
          artifact_type: 'csv',
          title: 'Data CSV',
          description: undefined,
          mime_type: 'text/csv',
          file_name: 'data.csv',
          content_base64: undefined,
          content_text: 'a,b,c',
          size_bytes: 5,
          created_at: '2026-02-27T12:00:00Z',
        },
      ],
      error: null,
    });

    const artifacts = await getSessionArtifacts('session-2');
    expect(artifacts[0].sessionId).toBe('session-2');
    expect(artifacts[0].type).toBe('csv');
    expect(artifacts[0].mimeType).toBe('text/csv');
    expect(artifacts[0].createdAt).toBeGreaterThan(0);
  });
});
