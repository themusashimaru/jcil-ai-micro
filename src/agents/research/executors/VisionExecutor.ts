/**
 * VISION EXECUTOR FOR RESEARCH AGENT
 *
 * Executes image analysis for research using Claude Vision.
 * Enables the Research Agent to analyze screenshots, charts, documents, and images.
 *
 * Key Features:
 * - Text extraction (OCR-like) from images
 * - Chart and graph data extraction
 * - Table extraction from image formats
 * - General image description and analysis
 * - Safety rails from main chat tools
 */

import { GeneratedQuery, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';
import { analyzeConversationImage, isVisionAnalyzeAvailable } from '@/lib/ai/tools/vision-analyze';

const log = logger('VisionExecutor');

// Analysis types for research
type VisionAnalysisType =
  | 'general'
  | 'text_extraction'
  | 'table_extraction'
  | 'chart_data'
  | 'describe';

// Input for vision analysis
export interface VisionInput {
  imageBase64: string;
  mediaType: string;
  query?: GeneratedQuery;
  analysisType?: VisionAnalysisType;
  question?: string;
}

export class VisionExecutor {
  /**
   * Check if vision execution is available
   */
  async isAvailable(): Promise<boolean> {
    return isVisionAnalyzeAvailable();
  }

  /**
   * Determine if a query should use vision analysis
   * Used when image data is available or visual analysis is needed
   */
  shouldUseVision(query: GeneratedQuery): boolean {
    const lower = query.query.toLowerCase();

    // Patterns that suggest vision analysis is needed
    const visionPatterns = [
      /analyze.*image/i,
      /extract.*text.*from/i,
      /read.*screenshot/i,
      /chart.*data/i,
      /graph.*values/i,
      /table.*image/i,
      /ocr/i,
      /what.*does.*show/i,
      /describe.*image/i,
      /visual.*content/i,
      /screenshot/i,
      /diagram/i,
      /infographic/i,
      /receipt/i,
      /document.*scan/i,
    ];

    return visionPatterns.some((p) => p.test(lower));
  }

  /**
   * Determine the best analysis type based on query intent
   */
  determineAnalysisType(query: GeneratedQuery): VisionAnalysisType {
    const lower = query.query.toLowerCase();

    // Text extraction patterns
    if (/extract.*text|ocr|read.*text|transcribe/i.test(lower)) {
      return 'text_extraction';
    }

    // Table extraction patterns
    if (/table|spreadsheet|rows.*columns|grid.*data/i.test(lower)) {
      return 'table_extraction';
    }

    // Chart/graph patterns
    if (/chart|graph|plot|axis|trend|data.*point|bar.*chart|line.*graph|pie.*chart/i.test(lower)) {
      return 'chart_data';
    }

    // Description patterns
    if (/describe|what.*is.*this|identify|explain.*image/i.test(lower)) {
      return 'describe';
    }

    // Default to general analysis
    return 'general';
  }

  /**
   * Execute vision analysis for a research query
   */
  async execute(input: VisionInput): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      if (!(await this.isAvailable())) {
        return this.createErrorResult(
          input.query,
          'Vision analysis not available (Anthropic API not configured)'
        );
      }

      // Validate input
      if (!input.imageBase64) {
        return this.createErrorResult(input.query, 'No image data provided');
      }

      if (!input.mediaType) {
        return this.createErrorResult(input.query, 'No media type specified');
      }

      // Determine analysis type
      const analysisType =
        input.analysisType || (input.query ? this.determineAnalysisType(input.query) : 'general');

      // Build question from query if provided
      const question =
        input.question || (input.query ? this.buildQuestionFromQuery(input.query) : undefined);

      log.info('Executing vision analysis', {
        analysisType,
        hasQuestion: !!question,
        mediaType: input.mediaType,
      });

      // Execute vision analysis
      const result = await analyzeConversationImage(input.imageBase64, input.mediaType, {
        analysisType,
        question,
      });

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return this.createErrorResult(input.query, `Vision analysis failed: ${result.error}`);
      }

      return {
        id: `vision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: input.query?.query || 'Image analysis',
        source: 'brave', // Using 'brave' as closest existing type
        content: result.result || 'Analysis complete but no content extracted.',
        title: `Vision Analysis: ${analysisType}`,
        timestamp: Date.now(),
        relevanceScore: 0.85, // Vision results are typically highly relevant
        metadata: {
          executionTime,
          hasRichData: true,
          richDataType: `vision_${analysisType}`,
        },
      };
    } catch (error) {
      log.error('Vision execution failed', { error: (error as Error).message });
      return this.createErrorResult(input.query, `Vision error: ${(error as Error).message}`);
    }
  }

  /**
   * Execute vision analysis for multiple images
   * Runs sequentially to manage API load
   */
  async executeMany(inputs: VisionInput[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // Rate limit: wait between requests
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const result = await this.execute(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Analyze an image from URL
   * Fetches the image and runs analysis
   */
  async analyzeFromUrl(url: string, query?: GeneratedQuery): Promise<SearchResult> {
    try {
      if (!(await this.isAvailable())) {
        return this.createErrorResult(query, 'Vision analysis not available');
      }

      log.info('Fetching image from URL', { url });

      // Fetch the image
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        return this.createErrorResult(query, `Failed to fetch image: HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return this.createErrorResult(query, `URL does not point to an image: ${contentType}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mediaType = contentType.split(';')[0].trim();

      // Execute analysis
      return this.execute({
        imageBase64: base64,
        mediaType,
        query,
      });
    } catch (error) {
      log.error('Failed to analyze image from URL', { error: (error as Error).message, url });
      return this.createErrorResult(query, `Failed to fetch image: ${(error as Error).message}`);
    }
  }

  /**
   * Build a question from the research query
   */
  private buildQuestionFromQuery(query: GeneratedQuery): string {
    const parts: string[] = [];

    // Add the main query
    parts.push(query.query);

    // Add expected info hints
    if (query.expectedInfo.length > 0) {
      parts.push(`Focus on finding: ${query.expectedInfo.join(', ')}`);
    }

    // Add purpose context
    if (query.purpose) {
      parts.push(`Purpose: ${query.purpose}`);
    }

    return parts.join('\n');
  }

  /**
   * Create error result
   */
  private createErrorResult(query: GeneratedQuery | undefined, error: string): SearchResult {
    return {
      id: `vision_error_${Date.now()}`,
      query: query?.query || 'Image analysis',
      source: 'brave',
      content: error,
      timestamp: Date.now(),
      relevanceScore: 0,
    };
  }
}

// Singleton instance
export const visionExecutor = new VisionExecutor();
