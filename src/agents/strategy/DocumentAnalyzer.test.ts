import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  DocumentAnalyzer,
  createDocumentAnalyzer,
  type DocumentAnalysis,
  type DocumentType,
  type StructuredData,
  type ExtractedTable,
  type ExtractedImage,
  type DocumentEntity,
  type DocumentMetadata,
  type ChartDataExtraction,
  type ComparisonExtraction,
} from './DocumentAnalyzer';
import type { StrategyAttachment } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockClient(): Anthropic {
  return new Anthropic();
}

function makeAttachment(overrides: Partial<StrategyAttachment> = {}): StrategyAttachment {
  return {
    name: 'test-file.txt',
    type: 'text/plain',
    content: Buffer.from('hello world').toString('base64'),
    ...overrides,
  };
}

function makeImageAttachment(overrides: Partial<StrategyAttachment> = {}): StrategyAttachment {
  return {
    name: 'photo.png',
    type: 'image/png',
    content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
    ...overrides,
  };
}

/** Simulate an API response that contains a JSON block wrapped in fences. */
function apiResponseWithJson(json: Record<string, unknown>): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [
      {
        type: 'text' as const,
        text: '```json\n' + JSON.stringify(json) + '\n```',
      },
    ],
  };
}

/** Simulate an API response with plain text (no JSON block). */
function apiResponsePlainText(text: string): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

// ===========================================================================
// TYPE EXPORT VALIDATION
// ===========================================================================

describe('DocumentAnalyzer type exports', () => {
  it('should export DocumentAnalysis interface', () => {
    const analysis: DocumentAnalysis = {
      id: 'doc_1',
      documentName: 'test.pdf',
      documentType: 'pdf',
      summary: 'A test document',
      extractedText: 'Hello world',
      structuredData: [],
      tables: [],
      images: [],
      keyEntities: [],
      metadata: {},
      confidence: 0.9,
      timestamp: Date.now(),
    };
    expect(analysis.id).toBe('doc_1');
  });

  it('should export DocumentType as union', () => {
    const types: DocumentType[] = [
      'image',
      'pdf',
      'spreadsheet',
      'document',
      'presentation',
      'webpage',
      'unknown',
    ];
    expect(types).toHaveLength(7);
  });

  it('should export StructuredData interface', () => {
    const sd: StructuredData = {
      type: 'key_value',
      label: 'Test',
      data: { key: 'value' },
      confidence: 0.8,
    };
    expect(sd.type).toBe('key_value');
  });

  it('should allow all StructuredData type values', () => {
    const types: StructuredData['type'][] = [
      'key_value',
      'list',
      'hierarchy',
      'timeline',
      'comparison',
    ];
    expect(types).toHaveLength(5);
  });

  it('should export ExtractedTable interface', () => {
    const table: ExtractedTable = {
      id: 'table_1',
      title: 'Sales Data',
      headers: ['Month', 'Revenue'],
      rows: [['Jan', '1000']],
      columnTypes: ['text', 'currency'],
      summary: 'Monthly sales',
      confidence: 0.85,
    };
    expect(table.id).toBe('table_1');
  });

  it('should allow all ExtractedTable columnType values', () => {
    const types: ExtractedTable['columnTypes'][number][] = [
      'text',
      'number',
      'currency',
      'date',
      'percentage',
    ];
    expect(types).toHaveLength(5);
  });

  it('should export ExtractedImage interface', () => {
    const img: ExtractedImage = {
      id: 'img_1',
      type: 'chart',
      description: 'A bar chart',
      extractedData: { series: [1, 2, 3] },
      textInImage: 'Title',
      confidence: 0.8,
    };
    expect(img.type).toBe('chart');
  });

  it('should allow all ExtractedImage type values', () => {
    const types: ExtractedImage['type'][] = [
      'chart',
      'diagram',
      'photo',
      'screenshot',
      'logo',
      'unknown',
    ];
    expect(types).toHaveLength(6);
  });

  it('should export DocumentEntity interface', () => {
    const entity: DocumentEntity = {
      name: 'Acme Corp',
      type: 'organization',
      value: 'Acme Corp',
      context: 'Mentioned in header',
      confidence: 0.95,
    };
    expect(entity.name).toBe('Acme Corp');
  });

  it('should allow all DocumentEntity type values', () => {
    const types: DocumentEntity['type'][] = [
      'person',
      'organization',
      'date',
      'money',
      'location',
      'product',
      'other',
    ];
    expect(types).toHaveLength(7);
  });

  it('should export DocumentMetadata interface', () => {
    const meta: DocumentMetadata = {
      pageCount: 10,
      wordCount: 5000,
      language: 'en',
      createdDate: '2025-01-01',
      modifiedDate: '2025-06-01',
      author: 'Test Author',
      title: 'Test Document',
    };
    expect(meta.pageCount).toBe(10);
  });

  it('should allow partial DocumentMetadata (all fields optional)', () => {
    const meta: DocumentMetadata = {};
    expect(meta.pageCount).toBeUndefined();
  });

  it('should export ChartDataExtraction interface', () => {
    const chart: ChartDataExtraction = {
      chartType: 'bar',
      title: 'Revenue',
      xAxis: { label: 'Month', values: ['Jan', 'Feb'] },
      yAxis: { label: 'Amount', values: [100, 200] },
      series: [{ name: 'Revenue', data: [{ x: 'Jan', y: 100 }] }],
      confidence: 0.85,
    };
    expect(chart.chartType).toBe('bar');
  });

  it('should allow all ChartDataExtraction chartType values', () => {
    const types: ChartDataExtraction['chartType'][] = [
      'bar',
      'line',
      'pie',
      'scatter',
      'area',
      'other',
    ];
    expect(types).toHaveLength(6);
  });

  it('should export ComparisonExtraction interface', () => {
    const comparison: ComparisonExtraction = {
      items: ['A', 'B'],
      criteria: ['Price', 'Quality'],
      values: {
        A: { Price: '$100', Quality: 'High' },
        B: { Price: '$80', Quality: 'Medium' },
      },
      bestChoice: { item: 'A', reason: 'Better quality' },
      confidence: 0.85,
    };
    expect(comparison.items).toHaveLength(2);
  });

  it('should allow ComparisonExtraction without bestChoice', () => {
    const comparison: ComparisonExtraction = {
      items: [],
      criteria: [],
      values: {},
      confidence: 0.5,
    };
    expect(comparison.bestChoice).toBeUndefined();
  });
});

// ===========================================================================
// CLASS CONSTRUCTION & FACTORY
// ===========================================================================

describe('DocumentAnalyzer construction', () => {
  it('should create an instance via constructor', () => {
    const analyzer = new DocumentAnalyzer(mockClient());
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });

  it('should accept an optional onStream callback', () => {
    const onStream = vi.fn();
    const analyzer = new DocumentAnalyzer(mockClient(), onStream);
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });

  it('should create an instance via createDocumentAnalyzer factory', () => {
    const analyzer = createDocumentAnalyzer(mockClient());
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });

  it('should pass onStream through the factory', () => {
    const onStream = vi.fn();
    const analyzer = createDocumentAnalyzer(mockClient(), onStream);
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });
});

// ===========================================================================
// METHOD EXISTENCE
// ===========================================================================

describe('DocumentAnalyzer method existence', () => {
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    analyzer = new DocumentAnalyzer(mockClient());
  });

  it('should have an analyze method', () => {
    expect(typeof analyzer.analyze).toBe('function');
  });

  it('should have an analyzeMultiple method', () => {
    expect(typeof analyzer.analyzeMultiple).toBe('function');
  });

  it('should have an extractChartData method', () => {
    expect(typeof analyzer.extractChartData).toBe('function');
  });

  it('should have an extractComparison method', () => {
    expect(typeof analyzer.extractComparison).toBe('function');
  });

  it('should have an extractTablesFromImage method', () => {
    expect(typeof analyzer.extractTablesFromImage).toBe('function');
  });

  it('should have a synthesize method', () => {
    expect(typeof analyzer.synthesize).toBe('function');
  });

  it('should have a getHistory method', () => {
    expect(typeof analyzer.getHistory).toBe('function');
  });
});

// ===========================================================================
// getHistory
// ===========================================================================

describe('DocumentAnalyzer.getHistory', () => {
  it('should return empty array initially', () => {
    const analyzer = new DocumentAnalyzer(mockClient());
    expect(analyzer.getHistory()).toEqual([]);
  });

  it('should return a copy (not the internal reference)', () => {
    const analyzer = new DocumentAnalyzer(mockClient());
    const h1 = analyzer.getHistory();
    const h2 = analyzer.getHistory();
    expect(h1).not.toBe(h2);
    expect(h1).toEqual(h2);
  });
});

// ===========================================================================
// synthesize — empty input
// ===========================================================================

describe('DocumentAnalyzer.synthesize (empty input)', () => {
  it('should return default object when given no analyses', async () => {
    const analyzer = new DocumentAnalyzer(mockClient());
    const result = await analyzer.synthesize([]);

    expect(result).toEqual({
      summary: 'No documents to synthesize',
      keyFindings: [],
      consolidatedTables: [],
      entities: [],
      recommendations: [],
    });
  });
});

// ===========================================================================
// analyze — with mocked API
// ===========================================================================

describe('DocumentAnalyzer.analyze (mocked API)', () => {
  let client: Anthropic;
  let onStream: ReturnType<typeof vi.fn>;
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    client = mockClient();
    onStream = vi.fn();
    analyzer = new DocumentAnalyzer(client, onStream);
  });

  it('should emit a stream event when analyzing', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Test summary',
        extractedText: 'Hello',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [],
        metadata: {},
        confidence: 0.9,
      })
    );

    await analyzer.analyze(makeAttachment());

    expect(onStream).toHaveBeenCalled();
    const firstCall = onStream.mock.calls[0][0];
    expect(firstCall.type).toBe('synthesis_progress');
    expect(firstCall.message).toContain('[Document]');
  });

  it('should return a default analysis when API returns non-JSON text', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('Sorry, I cannot parse this.')
    );

    const result = await analyzer.analyze(makeAttachment());

    expect(result.summary).toBe('Analysis could not be completed');
    expect(result.confidence).toBe(0.3);
    expect(result.documentType).toBe('document');
  });

  it('should detect image type and call analyzeImage path', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Photo of a cat',
        extractedText: '',
        structuredData: [],
        tables: [],
        images: [{ id: 'img_0', type: 'photo', description: 'A cat', confidence: 0.9 }],
        keyEntities: [],
        metadata: {},
        confidence: 0.88,
      })
    );

    const result = await analyzer.analyze(makeImageAttachment());

    expect(result.documentType).toBe('image');
    expect(result.summary).toBe('Photo of a cat');
    expect(result.images).toHaveLength(1);
  });

  it('should detect PDF type from mime type', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'A PDF report',
        extractedText: 'report text',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [],
        metadata: { pageCount: 5 },
        confidence: 0.85,
      })
    );

    const result = await analyzer.analyze(
      makeAttachment({ type: 'application/pdf', name: 'report.pdf' })
    );

    expect(result.documentType).toBe('pdf');
    expect(result.metadata.pageCount).toBe(5);
  });

  it('should propagate error when API throws in document analysis', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API down'));

    // The try/catch in analyze uses `return` (not `await`) so rejected promises
    // from analyzeDocument propagate rather than being caught.
    await expect(analyzer.analyze(makeAttachment())).rejects.toThrow('API down');
  });

  it('should parse tables from API response', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Document with tables',
        extractedText: 'table content',
        structuredData: [],
        tables: [
          {
            id: 'table_0',
            title: 'Sales',
            headers: ['Month', 'Revenue'],
            rows: [
              ['Jan', '100'],
              ['Feb', '200'],
            ],
            columnTypes: ['text', 'number'],
            summary: 'Monthly sales',
            confidence: 0.9,
          },
        ],
        images: [],
        keyEntities: [],
        metadata: {},
        confidence: 0.85,
      })
    );

    const result = await analyzer.analyze(makeAttachment());

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['Month', 'Revenue']);
    expect(result.tables[0].rows).toHaveLength(2);
  });

  it('should parse key entities from API response', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Contract doc',
        extractedText: 'Acme Corp signed on Jan 1',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [
          {
            name: 'Acme Corp',
            type: 'organization',
            value: 'Acme Corp',
            context: 'header',
            confidence: 0.95,
          },
          {
            name: 'Jan 1',
            type: 'date',
            value: '2025-01-01',
            context: 'signing date',
            confidence: 0.8,
          },
        ],
        metadata: {},
        confidence: 0.9,
      })
    );

    const result = await analyzer.analyze(makeAttachment());

    expect(result.keyEntities).toHaveLength(2);
    expect(result.keyEntities[0].type).toBe('organization');
    expect(result.keyEntities[1].type).toBe('date');
  });

  it('should add successful analysis to history', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Good doc',
        extractedText: 'content',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [],
        metadata: {},
        confidence: 0.9,
      })
    );

    await analyzer.analyze(makeAttachment());

    const history = analyzer.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].summary).toBe('Good doc');
  });
});

// ===========================================================================
// extractChartData — with mocked API
// ===========================================================================

describe('DocumentAnalyzer.extractChartData (mocked API)', () => {
  let client: Anthropic;
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    client = mockClient();
    analyzer = new DocumentAnalyzer(client);
  });

  it('should return default chart extraction when API returns non-JSON', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('I see a chart but cannot extract data.')
    );

    const result = await analyzer.extractChartData('base64data', 'image/png');

    expect(result.chartType).toBe('other');
    expect(result.series).toEqual([]);
    expect(result.confidence).toBe(0.3);
  });

  it('should return default chart extraction when API throws', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    const result = await analyzer.extractChartData('base64data', 'image/png');

    expect(result.chartType).toBe('other');
    expect(result.confidence).toBe(0.3);
  });

  it('should parse valid chart data from API response', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        chartType: 'bar',
        title: 'Revenue',
        xAxis: { label: 'Month', values: ['Jan', 'Feb'] },
        yAxis: { label: 'Amount', values: [0, 200] },
        series: [
          {
            name: 'Rev',
            data: [
              { x: 'Jan', y: 100 },
              { x: 'Feb', y: 150 },
            ],
          },
        ],
        confidence: 0.88,
      })
    );

    const result = await analyzer.extractChartData('base64data', 'image/png');

    expect(result.chartType).toBe('bar');
    expect(result.title).toBe('Revenue');
    expect(result.series).toHaveLength(1);
    expect(result.series[0].data).toHaveLength(2);
    expect(result.confidence).toBe(0.88);
  });

  it('should clamp confidence between 0 and 1', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        chartType: 'line',
        series: [],
        confidence: 5.0,
      })
    );

    const result = await analyzer.extractChartData('base64data', 'image/png');
    expect(result.confidence).toBe(1);
  });

  it('should default chartType to "other" for invalid values', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        chartType: 'invalid_type',
        series: [],
        confidence: 0.5,
      })
    );

    const result = await analyzer.extractChartData('base64data', 'image/png');
    expect(result.chartType).toBe('other');
  });
});

// ===========================================================================
// extractComparison — with mocked API
// ===========================================================================

describe('DocumentAnalyzer.extractComparison (mocked API)', () => {
  let client: Anthropic;
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    client = mockClient();
    analyzer = new DocumentAnalyzer(client);
  });

  it('should return default comparison when API returns non-JSON', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('No comparison data found.')
    );

    const result = await analyzer.extractComparison('some text');

    expect(result.items).toEqual([]);
    expect(result.criteria).toEqual([]);
    expect(result.values).toEqual({});
    expect(result.confidence).toBe(0.3);
  });

  it('should return default comparison when API throws', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    const result = await analyzer.extractComparison('some text');
    expect(result.confidence).toBe(0.3);
  });

  it('should parse valid comparison data from API response', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        items: ['Product A', 'Product B'],
        criteria: ['Price', 'Quality'],
        values: {
          'Product A': { Price: '$100', Quality: 'High' },
          'Product B': { Price: '$80', Quality: 'Medium' },
        },
        bestChoice: { item: 'Product A', reason: 'Better quality' },
        confidence: 0.9,
      })
    );

    const result = await analyzer.extractComparison('compare products');

    expect(result.items).toEqual(['Product A', 'Product B']);
    expect(result.criteria).toEqual(['Price', 'Quality']);
    expect(result.bestChoice).toBeDefined();
    expect(result.bestChoice!.item).toBe('Product A');
    expect(result.confidence).toBe(0.9);
  });
});

// ===========================================================================
// extractTablesFromImage — with mocked API
// ===========================================================================

describe('DocumentAnalyzer.extractTablesFromImage (mocked API)', () => {
  let client: Anthropic;
  let analyzer: DocumentAnalyzer;

  beforeEach(() => {
    client = mockClient();
    analyzer = new DocumentAnalyzer(client);
  });

  it('should return empty array when API returns non-JSON', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('No tables found.')
    );

    const result = await analyzer.extractTablesFromImage('base64data', 'image/png');
    expect(result).toEqual([]);
  });

  it('should return empty array when API throws', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    const result = await analyzer.extractTablesFromImage('base64data', 'image/png');
    expect(result).toEqual([]);
  });

  it('should parse tables from API response', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        tables: [
          {
            id: 'table_1',
            title: 'Pricing',
            headers: ['Plan', 'Price'],
            rows: [
              ['Basic', '$10'],
              ['Pro', '$25'],
            ],
            columnTypes: ['text', 'currency'],
            summary: 'Pricing tiers',
            confidence: 0.9,
          },
        ],
      })
    );

    const result = await analyzer.extractTablesFromImage('base64data', 'image/png');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Pricing');
    expect(result[0].rows).toHaveLength(2);
  });
});

// ===========================================================================
// synthesize — with populated analyses (mocked API)
// ===========================================================================

describe('DocumentAnalyzer.synthesize (populated, mocked API)', () => {
  let client: Anthropic;
  let analyzer: DocumentAnalyzer;

  const sampleAnalysis: DocumentAnalysis = {
    id: 'doc_1',
    documentName: 'report.pdf',
    documentType: 'pdf',
    summary: 'Q4 financial report',
    extractedText: 'Revenue was $5M',
    structuredData: [],
    tables: [
      {
        id: 'table_1',
        headers: ['Metric', 'Value'],
        rows: [['Revenue', '$5M']],
        columnTypes: ['text', 'currency'],
        confidence: 0.9,
      },
    ],
    images: [],
    keyEntities: [
      { name: 'Q4', type: 'date', value: 'Q4 2025', context: 'reporting period', confidence: 0.95 },
    ],
    metadata: { pageCount: 10 },
    confidence: 0.9,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    client = mockClient();
    analyzer = new DocumentAnalyzer(client);
  });

  it('should consolidate tables from all analyses', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Synthesized view',
        keyFindings: ['Revenue is $5M'],
        recommendations: ['Increase marketing spend'],
      })
    );

    const result = await analyzer.synthesize([sampleAnalysis]);

    expect(result.consolidatedTables).toHaveLength(1);
    expect(result.consolidatedTables[0].id).toBe('table_1');
  });

  it('should consolidate entities from all analyses', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Synthesized view',
        keyFindings: [],
        recommendations: [],
      })
    );

    const result = await analyzer.synthesize([sampleAnalysis]);

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Q4');
  });

  it('should fall back gracefully when API fails during synthesis', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API fail'));

    const result = await analyzer.synthesize([sampleAnalysis]);

    expect(result.summary).toBe('Synthesis could not be completed');
    expect(result.keyFindings).toContain('Q4 financial report');
    expect(result.recommendations).toEqual([]);
  });

  it('should fall back when API returns non-JSON during synthesis', async () => {
    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('Unable to synthesize')
    );

    const result = await analyzer.synthesize([sampleAnalysis]);

    expect(result.summary).toBe('Synthesis could not be completed');
    expect(result.keyFindings).toEqual(['Q4 financial report']);
  });

  it('should deduplicate entities keeping highest confidence', async () => {
    const analysis2: DocumentAnalysis = {
      ...sampleAnalysis,
      id: 'doc_2',
      keyEntities: [
        {
          name: 'Q4 better',
          type: 'date',
          value: 'Q4 2025',
          context: 'better source',
          confidence: 0.99,
        },
      ],
    };

    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Combined',
        keyFindings: [],
        recommendations: [],
      })
    );

    const result = await analyzer.synthesize([sampleAnalysis, analysis2]);

    // Both have type:date + value:"Q4 2025" (lowercase), so they should be deduped
    const q4Entities = result.entities.filter((e) => e.value.toLowerCase().includes('q4'));
    expect(q4Entities).toHaveLength(1);
    expect(q4Entities[0].confidence).toBe(0.99);
  });
});

// ===========================================================================
// analyzeMultiple — with mocked API
// ===========================================================================

describe('DocumentAnalyzer.analyzeMultiple (mocked API)', () => {
  it('should analyze each attachment and return results array', async () => {
    const client = mockClient();
    const onStream = vi.fn();
    const analyzer = new DocumentAnalyzer(client, onStream);

    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'Doc analysis',
        extractedText: 'text',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [],
        metadata: {},
        confidence: 0.85,
      })
    );

    const results = await analyzer.analyzeMultiple([
      makeAttachment({ name: 'file1.txt' }),
      makeAttachment({ name: 'file2.txt' }),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].summary).toBe('Doc analysis');
    expect(results[1].summary).toBe('Doc analysis');
  });
});

// ===========================================================================
// Stream callback behavior
// ===========================================================================

describe('DocumentAnalyzer stream callback', () => {
  it('should not throw when onStream is not provided', async () => {
    const client = mockClient();
    const analyzer = new DocumentAnalyzer(client); // no onStream

    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponseWithJson({
        summary: 'test',
        extractedText: '',
        structuredData: [],
        tables: [],
        images: [],
        keyEntities: [],
        metadata: {},
        confidence: 0.5,
      })
    );

    // Should not throw
    await expect(analyzer.analyze(makeAttachment())).resolves.toBeDefined();
  });

  it('should emit events with correct structure', async () => {
    const client = mockClient();
    const onStream = vi.fn();
    const analyzer = new DocumentAnalyzer(client, onStream);

    (client.messages.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      apiResponsePlainText('No JSON here')
    );

    await analyzer.analyze(makeAttachment({ name: 'my-file.csv' }));

    expect(onStream).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'synthesis_progress',
        message: expect.stringContaining('my-file.csv'),
        timestamp: expect.any(Number),
      })
    );
  });
});
