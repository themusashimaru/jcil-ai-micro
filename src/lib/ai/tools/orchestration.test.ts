/**
 * Tests for tool orchestration layer.
 * Covers: ArtifactStore, extractArtifacts, TOOL_CHAINS, getOrchestrationPrompt, partitionParallelCalls
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing module
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  ArtifactStore,
  extractArtifacts,
  TOOL_CHAINS,
  getOrchestrationPrompt,
  partitionParallelCalls,
} from './orchestration';
import type { ArtifactType, ToolArtifact } from './orchestration';

// ============================================================================
// ArtifactStore
// ============================================================================

describe('ArtifactStore', () => {
  let store: ArtifactStore;

  beforeEach(() => {
    store = new ArtifactStore();
  });

  describe('add', () => {
    it('creates an artifact with incrementing IDs', () => {
      const a1 = store.add('tool_a', 'url', 'https://example.com', 'Link');
      const a2 = store.add('tool_b', 'text', 'hello', 'Greeting');
      expect(a1.id).toBe('artifact_1');
      expect(a2.id).toBe('artifact_2');
    });

    it('stores all provided fields', () => {
      const meta = { key: 'value' };
      const artifact = store.add('myTool', 'data', '{"x":1}', 'JSON data', meta);
      expect(artifact.toolName).toBe('myTool');
      expect(artifact.type).toBe('data');
      expect(artifact.content).toBe('{"x":1}');
      expect(artifact.label).toBe('JSON data');
      expect(artifact.metadata).toEqual(meta);
      expect(artifact.timestamp).toBeGreaterThan(0);
    });

    it('works without optional metadata', () => {
      const artifact = store.add('t', 'code', 'console.log()', 'snippet');
      expect(artifact.metadata).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns empty array initially', () => {
      expect(store.getAll()).toEqual([]);
    });

    it('returns a copy (not the internal array)', () => {
      store.add('t', 'url', 'u', 'l');
      const all = store.getAll();
      all.push({} as ToolArtifact);
      expect(store.getAll()).toHaveLength(1);
    });

    it('returns all added artifacts in order', () => {
      store.add('a', 'url', 'u1', 'l1');
      store.add('b', 'text', 'u2', 'l2');
      store.add('c', 'code', 'u3', 'l3');
      const all = store.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((a) => a.toolName)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getByType', () => {
    it('filters by type', () => {
      store.add('t1', 'url', 'u1', 'l1');
      store.add('t2', 'text', 'u2', 'l2');
      store.add('t3', 'url', 'u3', 'l3');
      expect(store.getByType('url')).toHaveLength(2);
      expect(store.getByType('text')).toHaveLength(1);
      expect(store.getByType('code')).toHaveLength(0);
    });
  });

  describe('getByTool', () => {
    it('filters by tool name', () => {
      store.add('alpha', 'url', 'u1', 'l1');
      store.add('beta', 'text', 'u2', 'l2');
      store.add('alpha', 'data', 'u3', 'l3');
      expect(store.getByTool('alpha')).toHaveLength(2);
      expect(store.getByTool('beta')).toHaveLength(1);
      expect(store.getByTool('gamma')).toHaveLength(0);
    });
  });

  describe('getLatest', () => {
    it('returns undefined when empty', () => {
      expect(store.getLatest()).toBeUndefined();
      expect(store.getLatest('url')).toBeUndefined();
    });

    it('returns the most recently added artifact', () => {
      store.add('t1', 'url', 'first', 'l1');
      store.add('t2', 'text', 'second', 'l2');
      expect(store.getLatest()!.content).toBe('second');
    });

    it('returns the latest of a specific type', () => {
      store.add('t1', 'url', 'url1', 'l1');
      store.add('t2', 'text', 'text1', 'l2');
      store.add('t3', 'url', 'url2', 'l3');
      expect(store.getLatest('url')!.content).toBe('url2');
      expect(store.getLatest('text')!.content).toBe('text1');
    });

    it('returns undefined for a type with no artifacts', () => {
      store.add('t1', 'url', 'u', 'l');
      expect(store.getLatest('code')).toBeUndefined();
    });
  });

  describe('hasArtifacts', () => {
    it('returns false when empty', () => {
      expect(store.hasArtifacts()).toBe(false);
    });

    it('returns true after adding an artifact', () => {
      store.add('t', 'url', 'u', 'l');
      expect(store.hasArtifacts()).toBe(true);
    });
  });

  describe('buildContextString', () => {
    it('returns empty string when no artifacts', () => {
      expect(store.buildContextString()).toBe('');
    });

    it('includes available_artifacts tags', () => {
      store.add('t', 'url', 'https://x.com', 'My URL');
      const ctx = store.buildContextString();
      expect(ctx).toContain('<available_artifacts>');
      expect(ctx).toContain('</available_artifacts>');
    });

    it('formats URL artifacts with full content', () => {
      store.add('myTool', 'url', 'https://example.com/file', 'Link');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Link] (url) from myTool: https://example.com/file');
    });

    it('formats image artifacts', () => {
      store.add('img_tool', 'image', 'https://img.com/a.png', 'Photo');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Photo] (image) from img_tool: https://img.com/a.png');
    });

    it('formats chart artifacts', () => {
      store.add('chart_tool', 'chart', 'https://quickchart.io/x', 'Chart');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Chart] (chart) from chart_tool: https://quickchart.io/x');
    });

    it('formats file artifacts', () => {
      store.add('doc_tool', 'file', '/tmp/report.pdf', 'Report');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Report] (file) from doc_tool: /tmp/report.pdf');
    });

    it('truncates data artifacts to 200 chars', () => {
      const longData = 'x'.repeat(300);
      store.add('data_tool', 'data', longData, 'Big Data');
      const ctx = store.buildContextString();
      expect(ctx).toContain('x'.repeat(200) + '...');
      expect(ctx).not.toContain('x'.repeat(201));
    });

    it('does not truncate short data artifacts', () => {
      store.add('data_tool', 'data', 'short', 'Small Data');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Small Data] (data) from data_tool: short');
      expect(ctx).not.toContain('...');
    });

    it('truncates text artifacts to 150 chars', () => {
      const longText = 'y'.repeat(200);
      store.add('text_tool', 'text', longText, 'Essay');
      const ctx = store.buildContextString();
      expect(ctx).toContain('y'.repeat(150) + '...');
    });

    it('truncates code artifacts to 100 chars with trailing ...', () => {
      const code = 'z'.repeat(200);
      store.add('code_tool', 'code', code, 'Snippet');
      const ctx = store.buildContextString();
      expect(ctx).toContain('z'.repeat(100) + '...');
    });

    it('handles unknown type gracefully via default format', () => {
      // Force an unknown type by casting
      store.add('mystery', 'unknown_type' as ArtifactType, 'stuff', 'Mystery');
      const ctx = store.buildContextString();
      expect(ctx).toContain('[Mystery] from mystery');
    });
  });

  describe('clear', () => {
    it('removes all artifacts', () => {
      store.add('t', 'url', 'u', 'l');
      store.add('t', 'text', 'x', 'l');
      store.clear();
      expect(store.getAll()).toEqual([]);
      expect(store.hasArtifacts()).toBe(false);
    });

    it('resets ID counter so next artifact starts at 1', () => {
      store.add('t', 'url', 'u', 'l');
      store.add('t', 'url', 'u', 'l');
      store.clear();
      const a = store.add('t', 'url', 'u', 'l');
      expect(a.id).toBe('artifact_1');
    });
  });
});

// ============================================================================
// extractArtifacts
// ============================================================================

describe('extractArtifacts', () => {
  it('returns empty array when isError is true', () => {
    expect(extractArtifacts('create_chart', 'https://quickchart.io/chart', true)).toEqual([]);
  });

  it('returns empty array for error regardless of tool name', () => {
    expect(extractArtifacts('sql_query', 'some result', true)).toEqual([]);
  });

  // create_chart
  describe('create_chart', () => {
    it('extracts QuickChart URLs', () => {
      const result = extractArtifacts(
        'create_chart',
        'Chart created: https://quickchart.io/chart?c=abc',
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('chart');
      expect(result[0].content).toBe('https://quickchart.io/chart?c=abc');
    });

    it('extracts multiple chart URLs', () => {
      const result = extractArtifacts(
        'create_chart',
        'https://quickchart.io/a https://quickchart.io/b',
        false
      );
      expect(result).toHaveLength(2);
    });

    it('returns empty when no chart URLs', () => {
      expect(extractArtifacts('create_chart', 'No chart here', false)).toEqual([]);
    });
  });

  // create_document
  describe('create_document', () => {
    it('detects PDF base64 content via data:application/ fallback', () => {
      const result = extractArtifacts('create_document', 'data:application/pdf;base64,abc', false);
      expect(result.some((a) => a.type === 'file' && a.label === 'Document')).toBe(true);
    });

    it('detects DOCX via HTTP URL containing .docx', () => {
      const result = extractArtifacts(
        'create_document',
        'Download at https://storage.example.com/file.docx',
        false
      );
      expect(result.some((a) => a.label === 'Word document')).toBe(true);
    });

    it('detects openxml via HTTP URL with DOCX keyword', () => {
      const result = extractArtifacts(
        'create_document',
        'DOCX file at https://storage.example.com/doc',
        false
      );
      expect(result.some((a) => a.label === 'Word document')).toBe(true);
    });

    it('extracts download URLs', () => {
      const result = extractArtifacts(
        'create_document',
        'Download at https://storage.example.com/doc.pdf',
        false
      );
      expect(result.some((a) => a.label === 'PDF document')).toBe(true);
    });

    it('extracts both data URL fallback and HTTP URL', () => {
      const result = extractArtifacts(
        'create_document',
        'data:application/pdf;base64,x at https://cdn.example.com/file.pdf',
        false
      );
      // Should have the HTTP URL artifact (PDF document)
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((a) => a.label === 'PDF document')).toBe(true);
    });
  });

  // create_presentation
  describe('create_presentation', () => {
    it('detects pptx via HTTP URL', () => {
      const result = extractArtifacts(
        'create_presentation',
        'File at https://storage.com/file.pptx',
        false
      );
      expect(result.some((a) => a.label === 'PowerPoint presentation')).toBe(true);
    });

    it('detects presentation via data:application/ fallback', () => {
      const result = extractArtifacts(
        'create_presentation',
        'data:application/vnd.openxml presentation',
        false
      );
      expect(result.some((a) => a.label === 'Presentation')).toBe(true);
    });

    it('extracts download URLs', () => {
      const result = extractArtifacts(
        'create_presentation',
        'https://storage.com/deck.pptx',
        false
      );
      expect(result.some((a) => a.label === 'PowerPoint presentation')).toBe(true);
    });
  });

  // create_spreadsheet / excel_advanced
  describe('create_spreadsheet / excel_advanced', () => {
    it('produces a file artifact for create_spreadsheet with URL', () => {
      const result = extractArtifacts(
        'create_spreadsheet',
        'https://storage.example.com/file.xlsx',
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('file');
      expect(result[0].label).toBe('Excel spreadsheet');
    });

    it('produces a file artifact for excel_advanced with data URL fallback', () => {
      const result = extractArtifacts(
        'excel_advanced',
        'data:application/vnd.openxml spreadsheet ready',
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('file');
    });

    it('returns empty when no URL or data URL present', () => {
      const result = extractArtifacts('create_spreadsheet', 'done', false);
      expect(result).toHaveLength(0);
    });
  });

  // Image tools
  describe('image tools (transform_image, generate_qr_code, generate_barcode)', () => {
    for (const tool of ['transform_image', 'generate_qr_code', 'generate_barcode']) {
      it(`${tool}: extracts image URLs`, () => {
        const result = extractArtifacts(tool, 'Image at https://img.com/pic.png', false);
        expect(result.some((a) => a.type === 'image')).toBe(true);
      });

      it(`${tool}: detects base64 images`, () => {
        const result = extractArtifacts(tool, 'data:image/png;base64,abc123', false);
        expect(
          result.some((a) => a.type === 'image' && a.content === 'Base64 image generated')
        ).toBe(true);
      });

      it(`${tool}: returns empty for no URLs or base64`, () => {
        expect(extractArtifacts(tool, 'no images here', false)).toEqual([]);
      });
    }
  });

  // Screenshot tools
  describe('screenshot / capture_webpage', () => {
    for (const tool of ['screenshot', 'capture_webpage']) {
      it(`${tool}: extracts screenshot URLs`, () => {
        const result = extractArtifacts(tool, 'https://storage.com/screenshot.png', false);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('image');
        expect(result[0].label).toBe('Screenshot');
      });

      it(`${tool}: returns empty when no URLs`, () => {
        expect(extractArtifacts(tool, 'No URL', false)).toEqual([]);
      });
    }
  });

  // Research tools
  describe('research tools (web_search, parallel_research, fetch_url)', () => {
    for (const tool of ['web_search', 'parallel_research', 'fetch_url']) {
      it(`${tool}: extracts text artifact when content > 100 chars`, () => {
        const content = 'a'.repeat(101);
        const result = extractArtifacts(tool, content, false);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('text');
        expect(result[0].label).toBe(`Research from ${tool}`);
      });

      it(`${tool}: returns empty when content <= 100 chars`, () => {
        expect(extractArtifacts(tool, 'a'.repeat(100), false)).toEqual([]);
        expect(extractArtifacts(tool, 'short', false)).toEqual([]);
      });
    }
  });

  // Code execution tools
  describe('run_code / create_and_run_tool', () => {
    for (const tool of ['run_code', 'create_and_run_tool']) {
      it(`${tool}: extracts data artifact when content > 50 chars`, () => {
        const result = extractArtifacts(tool, 'b'.repeat(51), false);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('data');
        expect(result[0].label).toBe('Code execution output');
      });

      it(`${tool}: returns empty when content <= 50 chars`, () => {
        expect(extractArtifacts(tool, 'b'.repeat(50), false)).toEqual([]);
      });
    }
  });

  // sql_query
  describe('sql_query', () => {
    it('always produces a data artifact', () => {
      const result = extractArtifacts('sql_query', 'rows returned', false);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('data');
      expect(result[0].label).toBe('SQL query results');
    });

    it('produces artifact even for empty result', () => {
      const result = extractArtifacts('sql_query', '', false);
      expect(result).toHaveLength(1);
    });
  });

  // Code tools
  describe('code tools (fix_error, refactor_code, format_code)', () => {
    for (const tool of ['fix_error', 'refactor_code', 'format_code']) {
      it(`${tool}: produces a code artifact`, () => {
        const result = extractArtifacts(tool, 'const x = 1;', false);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('code');
        expect(result[0].label).toBe(`Code from ${tool}`);
      });
    }
  });

  // NLP / sequence / medical
  describe('specialized tools', () => {
    it('analyze_text_nlp produces data artifact', () => {
      const result = extractArtifacts('analyze_text_nlp', '{"sentiment":"positive"}', false);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('NLP analysis results');
    });

    it('analyze_sequence produces data artifact', () => {
      const result = extractArtifacts('analyze_sequence', 'ATCG analysis', false);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('DNA/protein analysis');
    });

    it('medical_calc produces data artifact', () => {
      const result = extractArtifacts('medical_calc', 'BMI: 22', false);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Clinical calculation results');
    });
  });

  // Default case
  describe('default (unknown tool)', () => {
    it('extracts Supabase URLs as file artifacts', () => {
      const result = extractArtifacts(
        'unknown_tool',
        'File at https://abc.supabase.co/storage/file.png',
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('file');
      expect(result[0].label).toBe('File from unknown_tool');
    });

    it('extracts generic URLs when no Supabase URLs found', () => {
      const result = extractArtifacts('some_tool', 'See https://example.com/result', false);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('url');
      expect(result[0].label).toBe('URL from some_tool');
    });

    it('limits generic URLs to 3', () => {
      const result = extractArtifacts(
        'some_tool',
        'https://a.com https://b.com https://c.com https://d.com https://e.com',
        false
      );
      expect(result).toHaveLength(3);
    });

    it('prefers Supabase URLs over generic URLs', () => {
      const result = extractArtifacts(
        'some_tool',
        'https://example.com/other https://myapp.supabase.co/file.png',
        false
      );
      // Should only have supabase URL as file, not the generic one
      expect(result.every((a) => a.type === 'file')).toBe(true);
    });

    it('returns empty for no URLs at all', () => {
      expect(extractArtifacts('some_tool', 'no urls here', false)).toEqual([]);
    });
  });
});

// ============================================================================
// TOOL_CHAINS
// ============================================================================

describe('TOOL_CHAINS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(TOOL_CHAINS)).toBe(true);
    expect(TOOL_CHAINS.length).toBeGreaterThan(0);
  });

  it('every chain has required properties', () => {
    for (const chain of TOOL_CHAINS) {
      expect(chain).toHaveProperty('name');
      expect(chain).toHaveProperty('description');
      expect(chain).toHaveProperty('tools');
      expect(chain).toHaveProperty('trigger');
      expect(chain.name.length).toBeGreaterThan(0);
      expect(chain.tools.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has unique chain names', () => {
    const names = TOOL_CHAINS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ============================================================================
// getOrchestrationPrompt
// ============================================================================

describe('getOrchestrationPrompt', () => {
  it('returns prompt with tool_orchestration tags', () => {
    const prompt = getOrchestrationPrompt();
    expect(prompt).toContain('<tool_orchestration>');
    expect(prompt).toContain('</tool_orchestration>');
  });

  it('includes scheduled-action format', () => {
    const prompt = getOrchestrationPrompt();
    expect(prompt).toContain('scheduled-action');
    expect(prompt).toContain('scheduledFor');
  });

  it('includes scheduling instructions', () => {
    const prompt = getOrchestrationPrompt();
    expect(prompt).toContain('schedule');
    expect(prompt).toContain('confirmation');
  });

  it('does not include artifacts section when no store provided', () => {
    const prompt = getOrchestrationPrompt();
    expect(prompt).not.toContain('<available_artifacts>');
  });

  it('does not include artifacts section when store is empty', () => {
    const store = new ArtifactStore();
    const prompt = getOrchestrationPrompt(store);
    expect(prompt).not.toContain('<available_artifacts>');
  });

  it('includes artifact context when store has artifacts', () => {
    const store = new ArtifactStore();
    store.add('myTool', 'url', 'https://example.com', 'My Link');
    const prompt = getOrchestrationPrompt(store);
    expect(prompt).toContain('<available_artifacts>');
    expect(prompt).toContain('My Link');
    expect(prompt).toContain('https://example.com');
  });

  it('includes undefined store gracefully (no crash)', () => {
    expect(() => getOrchestrationPrompt(undefined)).not.toThrow();
  });
});

// ============================================================================
// partitionParallelCalls
// ============================================================================

describe('partitionParallelCalls', () => {
  const tc = (id: string, name: string) => ({ id, name, arguments: {} as Record<string, unknown> });

  it('returns single batch for empty array', () => {
    const result = partitionParallelCalls([]);
    expect(result).toEqual([[]]);
  });

  it('returns single batch for single tool call', () => {
    const calls = [tc('1', 'web_search')];
    const result = partitionParallelCalls(calls);
    expect(result).toEqual([calls]);
  });

  it('separates producers from consumers into two batches', () => {
    const calls = [
      tc('1', 'web_search'), // producer
      tc('2', 'create_presentation'), // consumer
    ];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(2);
    expect(result[0].map((c) => c.name)).toContain('web_search');
    expect(result[1].map((c) => c.name)).toContain('create_presentation');
  });

  it('groups multiple producers in first batch', () => {
    const calls = [tc('1', 'web_search'), tc('2', 'run_code'), tc('3', 'create_document')];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2); // web_search + run_code
    expect(result[1]).toHaveLength(1); // create_document
  });

  it('groups neutral tools with producers in first batch', () => {
    const calls = [
      tc('1', 'web_search'), // producer
      tc('2', 'some_neutral_tool'), // neutral
      tc('3', 'create_document'), // consumer
    ];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2); // producer + neutral
    expect(result[1]).toHaveLength(1); // consumer
  });

  it('puts all neutral tools in one batch when no producers or consumers', () => {
    const calls = [tc('1', 'neutral_a'), tc('2', 'neutral_b'), tc('3', 'neutral_c')];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('handles only producers (no consumers)', () => {
    const calls = [tc('1', 'web_search'), tc('2', 'fetch_url')];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('handles only consumers (no producers)', () => {
    const calls = [tc('1', 'create_presentation'), tc('2', 'create_document')];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('handles string arguments', () => {
    const calls = [{ id: '1', name: 'web_search', arguments: '{"q":"test"}' }];
    const result = partitionParallelCalls(calls);
    expect(result).toEqual([calls]);
  });

  it('correctly classifies all known producer tools', () => {
    const producers = [
      'web_search',
      'parallel_research',
      'fetch_url',
      'run_code',
      'create_chart',
      'screenshot',
      'extract_pdf',
      'extract_table',
      'analyze_image',
      'sql_query',
    ];
    const calls = producers.map((name, i) => tc(String(i), name));
    calls.push(tc('99', 'create_document')); // one consumer
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(producers.length); // all producers in batch 1
    expect(result[1]).toHaveLength(1); // consumer in batch 2
  });

  it('correctly classifies all known consumer tools', () => {
    const consumers = [
      'create_presentation',
      'create_document',
      'create_spreadsheet',
      'pdf_manipulate',
      'transform_image',
    ];
    const calls = [
      tc('0', 'web_search'), // one producer
      ...consumers.map((name, i) => tc(String(i + 1), name)),
    ];
    const result = partitionParallelCalls(calls);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1); // producer
    expect(result[1]).toHaveLength(consumers.length); // all consumers
  });
});
