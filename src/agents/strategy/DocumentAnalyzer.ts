/**
 * MULTI-MODAL DOCUMENT UNDERSTANDING
 *
 * Advanced document analysis that understands various formats:
 * - Images (screenshots, photos, charts, diagrams)
 * - PDFs (text, tables, images within)
 * - Tables (spreadsheets, HTML tables)
 * - Documents (Word, text files)
 *
 * Key capabilities:
 * - Visual content extraction
 * - Table structure recognition
 * - Chart/graph data extraction
 * - Cross-format synthesis
 * - Structured data output
 */

import Anthropic from '@anthropic-ai/sdk';
import type { StrategyStreamCallback, StrategyAttachment } from './types';
import { CLAUDE_SONNET_45, CLAUDE_OPUS_46 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('DocumentAnalyzer');

// =============================================================================
// TYPES
// =============================================================================

export interface DocumentAnalysis {
  id: string;
  documentName: string;
  documentType: DocumentType;
  summary: string;
  extractedText: string;
  structuredData: StructuredData[];
  tables: ExtractedTable[];
  images: ExtractedImage[];
  keyEntities: DocumentEntity[];
  metadata: DocumentMetadata;
  confidence: number;
  timestamp: number;
}

export type DocumentType =
  | 'image' // PNG, JPG, WebP, GIF
  | 'pdf' // PDF documents
  | 'spreadsheet' // Excel, CSV
  | 'document' // Word, text
  | 'presentation' // PowerPoint
  | 'webpage' // HTML
  | 'unknown';

export interface StructuredData {
  type: 'key_value' | 'list' | 'hierarchy' | 'timeline' | 'comparison';
  label: string;
  data: Record<string, unknown>;
  confidence: number;
}

export interface ExtractedTable {
  id: string;
  title?: string;
  headers: string[];
  rows: string[][];
  columnTypes: Array<'text' | 'number' | 'currency' | 'date' | 'percentage'>;
  summary?: string;
  confidence: number;
}

export interface ExtractedImage {
  id: string;
  type: 'chart' | 'diagram' | 'photo' | 'screenshot' | 'logo' | 'unknown';
  description: string;
  extractedData?: Record<string, unknown>;
  textInImage?: string;
  confidence: number;
}

export interface DocumentEntity {
  name: string;
  type: 'person' | 'organization' | 'date' | 'money' | 'location' | 'product' | 'other';
  value: string;
  context: string;
  confidence: number;
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  language?: string;
  createdDate?: string;
  modifiedDate?: string;
  author?: string;
  title?: string;
}

export interface ChartDataExtraction {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'other';
  title?: string;
  xAxis?: { label: string; values: (string | number)[] };
  yAxis?: { label: string; values: (string | number)[] };
  series: Array<{
    name: string;
    data: Array<{ x: string | number; y: number }>;
  }>;
  confidence: number;
}

export interface ComparisonExtraction {
  items: string[];
  criteria: string[];
  values: Record<string, Record<string, string | number>>;
  bestChoice?: { item: string; reason: string };
  confidence: number;
}

// =============================================================================
// PROMPTS
// =============================================================================

const DOCUMENT_ANALYSIS_PROMPT = `You are a Multi-Modal Document Analyzer - an AI specialized in understanding various document formats.

YOUR CAPABILITIES:

1. IMAGE ANALYSIS
   - Extract text from images (OCR)
   - Understand charts and graphs
   - Extract data from diagrams
   - Identify key visual elements

2. TABLE EXTRACTION
   - Identify table structures
   - Extract headers and data
   - Understand column types
   - Recognize multi-level headers

3. DOCUMENT UNDERSTANDING
   - Extract main content
   - Identify structure (sections, lists)
   - Find key information
   - Summarize content

4. ENTITY EXTRACTION
   - People, organizations
   - Dates, money amounts
   - Locations, products

5. STRUCTURED OUTPUT
   - Convert unstructured to structured
   - Create comparison matrices
   - Build timelines
   - Extract key-value pairs

ANALYSIS APPROACH:
1. Identify document type
2. Extract all visible text
3. Understand structure
4. Extract tables/charts
5. Identify entities
6. Synthesize findings

OUTPUT FORMAT:
\`\`\`json
{
  "documentType": "image|pdf|spreadsheet|document|unknown",
  "summary": "Brief summary of document content",
  "extractedText": "All text extracted from document",
  "structuredData": [
    {
      "type": "key_value|list|hierarchy|timeline|comparison",
      "label": "What this data represents",
      "data": {},
      "confidence": 0.9
    }
  ],
  "tables": [
    {
      "id": "table_1",
      "title": "Table title if visible",
      "headers": ["Column1", "Column2"],
      "rows": [["data1", "data2"]],
      "columnTypes": ["text", "number"],
      "summary": "What this table shows",
      "confidence": 0.85
    }
  ],
  "images": [
    {
      "id": "img_1",
      "type": "chart|diagram|photo|screenshot|logo|unknown",
      "description": "What the image shows",
      "extractedData": {},
      "textInImage": "Any text visible",
      "confidence": 0.8
    }
  ],
  "keyEntities": [
    {
      "name": "Entity name",
      "type": "person|organization|date|money|location|product|other",
      "value": "The actual value",
      "context": "Where/how it appears",
      "confidence": 0.9
    }
  ],
  "metadata": {
    "pageCount": 1,
    "wordCount": 500,
    "language": "en",
    "title": "Document title"
  },
  "confidence": 0.85
}
\`\`\``;

const CHART_EXTRACTION_PROMPT = `You are a Chart Data Extraction specialist. Extract numerical data from chart images.

For the given chart image, extract:
1. Chart type (bar, line, pie, scatter, area)
2. Title if visible
3. X-axis label and values
4. Y-axis label and values
5. All data series with their data points

Be precise with numbers. If you can't read a value exactly, estimate with a confidence score.

OUTPUT FORMAT:
\`\`\`json
{
  "chartType": "bar|line|pie|scatter|area|other",
  "title": "Chart title",
  "xAxis": {"label": "X Label", "values": ["Jan", "Feb", "Mar"]},
  "yAxis": {"label": "Y Label", "values": [0, 50, 100]},
  "series": [
    {
      "name": "Series 1",
      "data": [{"x": "Jan", "y": 50}, {"x": "Feb", "y": 75}]
    }
  ],
  "confidence": 0.8
}
\`\`\``;

const COMPARISON_EXTRACTION_PROMPT = `You are a Comparison Table Extraction specialist. Extract comparison data from documents.

Identify:
1. Items being compared
2. Criteria/attributes being compared
3. Values for each item on each criterion
4. Best choice if indicated

OUTPUT FORMAT:
\`\`\`json
{
  "items": ["Option A", "Option B", "Option C"],
  "criteria": ["Price", "Quality", "Speed"],
  "values": {
    "Option A": {"Price": "$100", "Quality": "High", "Speed": "Fast"},
    "Option B": {"Price": "$80", "Quality": "Medium", "Speed": "Medium"}
  },
  "bestChoice": {"item": "Option A", "reason": "Best overall value"},
  "confidence": 0.85
}
\`\`\``;

// =============================================================================
// DOCUMENT ANALYZER CLASS
// =============================================================================

export class DocumentAnalyzer {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private analysisHistory: DocumentAnalysis[] = [];

  constructor(client: Anthropic, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Analyze a document attachment
   */
  async analyze(attachment: StrategyAttachment): Promise<DocumentAnalysis> {
    this.emitEvent(`Analyzing document: ${attachment.name}...`);

    const documentType = this.detectDocumentType(attachment.type, attachment.name);

    try {
      // For images, use vision capability
      if (documentType === 'image') {
        return this.analyzeImage(attachment);
      }

      // For PDFs and other documents, extract text first then analyze
      return this.analyzeDocument(attachment, documentType);
    } catch (error) {
      log.error('Document analysis failed', { error, name: attachment.name });
      return this.createDefaultAnalysis(attachment.name, documentType);
    }
  }

  /**
   * Analyze multiple documents together
   */
  async analyzeMultiple(attachments: StrategyAttachment[]): Promise<DocumentAnalysis[]> {
    this.emitEvent(`Analyzing ${attachments.length} documents...`);

    const results: DocumentAnalysis[] = [];

    for (const attachment of attachments) {
      const analysis = await this.analyze(attachment);
      results.push(analysis);
      this.emitEvent(`Completed: ${attachment.name}`);
    }

    return results;
  }

  /**
   * Extract chart data from an image
   */
  async extractChartData(imageBase64: string, mimeType: string): Promise<ChartDataExtraction> {
    this.emitEvent('Extracting chart data...');

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        system: CHART_EXTRACTION_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract all data from this chart. Be as precise as possible with numerical values.',
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return this.createDefaultChartExtraction();
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        chartType: (['bar', 'line', 'pie', 'scatter', 'area', 'other'].includes(parsed.chartType)
          ? parsed.chartType
          : 'other') as ChartDataExtraction['chartType'],
        title: parsed.title ? String(parsed.title) : undefined,
        xAxis: parsed.xAxis
          ? {
              label: String(parsed.xAxis.label || ''),
              values: Array.isArray(parsed.xAxis.values) ? parsed.xAxis.values : [],
            }
          : undefined,
        yAxis: parsed.yAxis
          ? {
              label: String(parsed.yAxis.label || ''),
              values: Array.isArray(parsed.yAxis.values) ? parsed.yAxis.values : [],
            }
          : undefined,
        series: Array.isArray(parsed.series)
          ? parsed.series.map((s: Record<string, unknown>) => ({
              name: String(s.name || ''),
              data: Array.isArray(s.data)
                ? s.data.map((d: Record<string, unknown>) => ({
                    x: d.x ?? '',
                    y: Number(d.y) || 0,
                  }))
                : [],
            }))
          : [],
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      };
    } catch (error) {
      log.error('Chart extraction failed', { error });
      return this.createDefaultChartExtraction();
    }
  }

  /**
   * Extract comparison data from a document
   */
  async extractComparison(content: string): Promise<ComparisonExtraction> {
    this.emitEvent('Extracting comparison data...');

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        system: COMPARISON_EXTRACTION_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Extract comparison data from this content:\n\n${content}`,
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return this.createDefaultComparisonExtraction();
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        items: Array.isArray(parsed.items) ? parsed.items.map(String) : [],
        criteria: Array.isArray(parsed.criteria) ? parsed.criteria.map(String) : [],
        values: (parsed.values as Record<string, Record<string, string | number>>) || {},
        bestChoice: parsed.bestChoice
          ? {
              item: String(parsed.bestChoice.item || ''),
              reason: String(parsed.bestChoice.reason || ''),
            }
          : undefined,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      };
    } catch (error) {
      log.error('Comparison extraction failed', { error });
      return this.createDefaultComparisonExtraction();
    }
  }

  /**
   * Extract tables from an image
   */
  async extractTablesFromImage(imageBase64: string, mimeType: string): Promise<ExtractedTable[]> {
    this.emitEvent('Extracting tables from image...');

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Extract all tables from this image. For each table, provide:
1. Headers
2. All rows of data
3. Column types (text, number, currency, date, percentage)
4. A brief summary

Output in JSON format:
\`\`\`json
{
  "tables": [
    {
      "id": "table_1",
      "title": "Title if visible",
      "headers": ["Col1", "Col2"],
      "rows": [["data1", "data2"]],
      "columnTypes": ["text", "number"],
      "summary": "What this table shows",
      "confidence": 0.85
    }
  ]
}
\`\`\``,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[1]);
      return this.parseTables(parsed.tables || []);
    } catch (error) {
      log.error('Table extraction from image failed', { error });
      return [];
    }
  }

  /**
   * Synthesize findings from multiple document analyses
   */
  async synthesize(analyses: DocumentAnalysis[]): Promise<{
    summary: string;
    keyFindings: string[];
    consolidatedTables: ExtractedTable[];
    entities: DocumentEntity[];
    recommendations: string[];
  }> {
    if (analyses.length === 0) {
      return {
        summary: 'No documents to synthesize',
        keyFindings: [],
        consolidatedTables: [],
        entities: [],
        recommendations: [],
      };
    }

    this.emitEvent(`Synthesizing ${analyses.length} document analyses...`);

    // Consolidate all tables
    const consolidatedTables = analyses.flatMap((a) => a.tables);

    // Consolidate all entities
    const allEntities = analyses.flatMap((a) => a.keyEntities);
    const uniqueEntities = this.deduplicateEntities(allEntities);

    // Use AI to synthesize
    const summaries = analyses.map((a) => `${a.documentName}: ${a.summary}`).join('\n\n');

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_OPUS_46,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Synthesize these document analyses:

${summaries}

Provide:
1. Overall summary
2. Key findings (5-10 points)
3. Recommendations based on the documents

Output in JSON:
\`\`\`json
{
  "summary": "Overall synthesis",
  "keyFindings": ["finding 1", "finding 2"],
  "recommendations": ["rec 1", "rec 2"]
}
\`\`\``,
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          summary: String(parsed.summary || ''),
          keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.map(String) : [],
          consolidatedTables,
          entities: uniqueEntities,
          recommendations: Array.isArray(parsed.recommendations)
            ? parsed.recommendations.map(String)
            : [],
        };
      }
    } catch (error) {
      log.error('Document synthesis failed', { error });
    }

    return {
      summary: 'Synthesis could not be completed',
      keyFindings: analyses.map((a) => a.summary),
      consolidatedTables,
      entities: uniqueEntities,
      recommendations: [],
    };
  }

  /**
   * Get analysis history
   */
  getHistory(): DocumentAnalysis[] {
    return [...this.analysisHistory];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private detectDocumentType(mimeType: string, fileName: string): DocumentType {
    const lowerMime = mimeType.toLowerCase();
    const lowerName = fileName.toLowerCase();

    if (lowerMime.startsWith('image/')) return 'image';
    if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
    if (
      lowerMime.includes('spreadsheet') ||
      lowerMime.includes('excel') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv')
    ) {
      return 'spreadsheet';
    }
    if (
      lowerMime.includes('document') ||
      lowerMime.includes('word') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.txt')
    ) {
      return 'document';
    }
    if (
      lowerMime.includes('presentation') ||
      lowerName.endsWith('.pptx') ||
      lowerName.endsWith('.ppt')
    ) {
      return 'presentation';
    }
    if (lowerMime === 'text/html' || lowerName.endsWith('.html')) return 'webpage';

    return 'unknown';
  }

  private async analyzeImage(attachment: StrategyAttachment): Promise<DocumentAnalysis> {
    const response = await this.client.messages.create({
      model: CLAUDE_SONNET_45,
      max_tokens: 8192,
      system: DOCUMENT_ANALYSIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.type as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: attachment.content,
              },
            },
            {
              type: 'text',
              text: `Analyze this image completely. Extract all visible text, data, tables, and information. Document name: ${attachment.name}`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return this.parseAnalysisResponse(text, attachment.name, 'image');
  }

  private async analyzeDocument(
    attachment: StrategyAttachment,
    documentType: DocumentType
  ): Promise<DocumentAnalysis> {
    // For non-image documents, decode base64 and analyze text content
    let textContent: string;

    try {
      textContent = Buffer.from(attachment.content, 'base64').toString('utf-8');
    } catch {
      textContent = attachment.content; // May already be text
    }

    // Truncate if too long
    const maxLength = 100000;
    if (textContent.length > maxLength) {
      textContent = textContent.slice(0, maxLength) + '\n... [truncated]';
    }

    const response = await this.client.messages.create({
      model: CLAUDE_SONNET_45,
      max_tokens: 8192,
      system: DOCUMENT_ANALYSIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${documentType} document completely. Extract all information, data, tables, and key entities.

Document name: ${attachment.name}
Document type: ${attachment.type}

Content:
${textContent}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return this.parseAnalysisResponse(text, attachment.name, documentType);
  }

  private parseAnalysisResponse(
    response: string,
    documentName: string,
    documentType: DocumentType
  ): DocumentAnalysis {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = Date.now();

    if (!jsonMatch) {
      return this.createDefaultAnalysis(documentName, documentType);
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      const analysis: DocumentAnalysis = {
        id,
        documentName,
        documentType,
        summary: String(parsed.summary || ''),
        extractedText: String(parsed.extractedText || ''),
        structuredData: Array.isArray(parsed.structuredData)
          ? parsed.structuredData.map((sd: Record<string, unknown>) => ({
              type: (['key_value', 'list', 'hierarchy', 'timeline', 'comparison'].includes(
                String(sd.type)
              )
                ? sd.type
                : 'key_value') as StructuredData['type'],
              label: String(sd.label || ''),
              data: (sd.data as Record<string, unknown>) || {},
              confidence: Math.max(0, Math.min(1, Number(sd.confidence) || 0.5)),
            }))
          : [],
        tables: this.parseTables(parsed.tables || []),
        images: Array.isArray(parsed.images)
          ? parsed.images.map((img: Record<string, unknown>, i: number) => ({
              id: String(img.id || `img_${i}`),
              type: (['chart', 'diagram', 'photo', 'screenshot', 'logo', 'unknown'].includes(
                String(img.type)
              )
                ? img.type
                : 'unknown') as ExtractedImage['type'],
              description: String(img.description || ''),
              extractedData: (img.extractedData as Record<string, unknown>) || undefined,
              textInImage: img.textInImage ? String(img.textInImage) : undefined,
              confidence: Math.max(0, Math.min(1, Number(img.confidence) || 0.5)),
            }))
          : [],
        keyEntities: Array.isArray(parsed.keyEntities)
          ? parsed.keyEntities.map((e: Record<string, unknown>) => ({
              name: String(e.name || ''),
              type: ([
                'person',
                'organization',
                'date',
                'money',
                'location',
                'product',
                'other',
              ].includes(String(e.type))
                ? e.type
                : 'other') as DocumentEntity['type'],
              value: String(e.value || ''),
              context: String(e.context || ''),
              confidence: Math.max(0, Math.min(1, Number(e.confidence) || 0.5)),
            }))
          : [],
        metadata: {
          pageCount: parsed.metadata?.pageCount ? Number(parsed.metadata.pageCount) : undefined,
          wordCount: parsed.metadata?.wordCount ? Number(parsed.metadata.wordCount) : undefined,
          language: parsed.metadata?.language ? String(parsed.metadata.language) : undefined,
          title: parsed.metadata?.title ? String(parsed.metadata.title) : undefined,
        },
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        timestamp: now,
      };

      this.analysisHistory.push(analysis);
      return analysis;
    } catch (error) {
      log.error('Failed to parse document analysis', { error });
      return this.createDefaultAnalysis(documentName, documentType);
    }
  }

  private parseTables(tables: unknown[]): ExtractedTable[] {
    if (!Array.isArray(tables)) return [];

    return tables.map((t: unknown, i: number) => {
      const table = t as Record<string, unknown>;
      return {
        id: String(table.id || `table_${i}`),
        title: table.title ? String(table.title) : undefined,
        headers: Array.isArray(table.headers) ? table.headers.map(String) : [],
        rows: Array.isArray(table.rows)
          ? table.rows.map((row) => (Array.isArray(row) ? row.map(String) : []))
          : [],
        columnTypes: Array.isArray(table.columnTypes)
          ? table.columnTypes.map(
              (ct) =>
                (['text', 'number', 'currency', 'date', 'percentage'].includes(String(ct))
                  ? ct
                  : 'text') as ExtractedTable['columnTypes'][number]
            )
          : [],
        summary: table.summary ? String(table.summary) : undefined,
        confidence: Math.max(0, Math.min(1, Number(table.confidence) || 0.5)),
      };
    });
  }

  private deduplicateEntities(entities: DocumentEntity[]): DocumentEntity[] {
    const seen = new Map<string, DocumentEntity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.value.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  private createDefaultAnalysis(
    documentName: string,
    documentType: DocumentType
  ): DocumentAnalysis {
    return {
      id: `doc_${Date.now()}`,
      documentName,
      documentType,
      summary: 'Analysis could not be completed',
      extractedText: '',
      structuredData: [],
      tables: [],
      images: [],
      keyEntities: [],
      metadata: {},
      confidence: 0.3,
      timestamp: Date.now(),
    };
  }

  private createDefaultChartExtraction(): ChartDataExtraction {
    return {
      chartType: 'other',
      series: [],
      confidence: 0.3,
    };
  }

  private createDefaultComparisonExtraction(): ComparisonExtraction {
    return {
      items: [],
      criteria: [],
      values: {},
      confidence: 0.3,
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Document] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createDocumentAnalyzer(
  client: Anthropic,
  onStream?: StrategyStreamCallback
): DocumentAnalyzer {
  return new DocumentAnalyzer(client, onStream);
}
