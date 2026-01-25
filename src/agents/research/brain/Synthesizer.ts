/**
 * SYNTHESIZER
 *
 * The final stage of the Research Brain.
 * Takes all collected research and creates a structured, actionable output.
 *
 * Enhanced orchestration for comprehensive results:
 * - Handles up to 20 search results from Brave
 * - Intelligent grouping and deduplication
 * - Rich data integration (weather, stocks, sports, crypto)
 * - Multi-provider AI synthesis with fallback
 *
 * This is where raw data becomes intelligence.
 *
 * POWERED BY: Claude Sonnet 4.5 with xAI fallback
 */

import { completeChat } from '@/lib/ai/chat-router';
import {
  ResearchIntent,
  SearchResult,
  ResearchOutput,
  EvaluatedResults,
  ComparisonTable,
} from '../../core/types';
import { logger } from '@/lib/logger';
import type { CoreMessage } from 'ai';

const log = logger('Synthesizer');

export class Synthesizer {
  /**
   * Synthesize all research into a structured output
   *
   * Enhanced for Brave Search with up to 20 results:
   * - Intelligent grouping by topic/theme
   * - Deduplication of similar findings
   * - Rich data integration (weather, stocks, sports, crypto)
   * - Comprehensive synthesis with multi-provider fallback
   */
  async synthesize(
    results: SearchResult[],
    intent: ResearchIntent,
    evaluations: EvaluatedResults[],
    metadata: {
      totalQueries: number;
      iterations: number;
      executionTime: number;
      depth: 'quick' | 'standard' | 'deep';
    }
  ): Promise<ResearchOutput> {
    // Extract and clean answers from all results (up to 15 for comprehensive synthesis)
    const cleanedAnswers = results
      .filter((r) => (r.relevanceScore ?? 0) > 0.2) // Filter low-relevance results
      .slice(0, 15)
      .map((r, i) => {
        // Clean the content - remove sources section, get the core answer
        let answer = r.content.split('**Sources:**')[0].trim();
        // Remove markdown formatting
        answer = answer.replace(/\*\*/g, '').trim();
        // Truncate if too long but preserve more content
        if (answer.length > 400) {
          answer = answer.substring(0, 400) + '...';
        }
        return {
          index: i + 1,
          answer,
          source: r.source,
          hasRichData: !!r.metadata?.hasRichData,
        };
      })
      .filter((a) => a.answer.length > 20);

    // Extract any rich data from results
    const richDataResults = results.filter((r) => r.metadata?.hasRichData);

    // Detect research type for optimal synthesis
    const isComparisonResearch = /competitor|compare|comparison|versus|vs\.?|alternative/i.test(
      intent.originalQuery
    );
    const isDataHeavy = /price|cost|statistic|number|percentage|rate|trend/i.test(
      intent.originalQuery
    );
    const isNews = /news|recent|latest|update|announcement/i.test(intent.originalQuery);

    // Build comprehensive synthesis prompt
    const prompt = `You are a senior research analyst. Synthesize these ${cleanedAnswers.length} research findings into a comprehensive, actionable report.

RESEARCH QUESTION: "${intent.originalQuery}"
REFINED FOCUS: "${intent.refinedQuery}"
TOPICS COVERED: ${intent.topics.join(', ')}
EXPECTED OUTPUTS: ${intent.expectedOutputs.join(', ')}

RESEARCH FINDINGS:
${cleanedAnswers.map((a) => `[${a.index}] ${a.answer}`).join('\n\n')}

${richDataResults.length > 0 ? `\nRICH DATA AVAILABLE: ${richDataResults.length} results with real-time data (weather/stocks/sports/crypto)` : ''}

SYNTHESIS REQUIREMENTS:
Return a JSON object with:
{
  "bottomLine": "The single most important takeaway - direct answer to the question (max 2 sentences)",
  "executiveSummary": "Brief overview for quick understanding (2-3 sentences)",
  "keyFindings": [
    {
      "title": "Short descriptive title (3-6 words)",
      "finding": "Detailed insight with specific data/facts (max 200 chars)",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "gaps": ["What information is missing or unclear"],
  "suggestions": ["Recommended next steps or actions"]
  ${
    isComparisonResearch
      ? `,
  "comparisonTable": {
    "headers": ["Metric/Feature", "Option A", "Option B", ...],
    "rows": [{"entity": "Metric name", "values": ["value1", "value2", ...]}]
  }`
      : ''
  }
  ${
    isDataHeavy
      ? `,
  "dataHighlights": [{"metric": "Name", "value": "Data point", "context": "Brief context"}]`
      : ''
  }
}

SYNTHESIS RULES:
1. bottomLine: THE answer - what the user really needs to know
2. executiveSummary: Quick context for decision-makers
3. keyFindings: 5-8 unique insights, prioritized by importance
   - Include specific numbers, dates, percentages when available
   - Each finding should be distinct, no overlapping information
   - Mark confidence based on source quality and consistency
4. gaps: Note what couldn't be fully answered
5. suggestions: Actionable next steps
${isComparisonResearch ? '6. comparisonTable: Side-by-side comparison of key metrics' : ''}
${isDataHeavy ? '6. dataHighlights: Key statistics and numbers' : ''}
${isNews ? '6. Focus on recency - what is NEW and different' : ''}

Prioritize accuracy over completeness. Be specific with data.
OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const messages: CoreMessage[] = [{ role: 'user', content: prompt }];

      // Use multi-provider synthesis with fallback
      const result = await completeChat(messages, {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.3,
        systemPrompt:
          'You are a senior research analyst. Return valid JSON only. Be comprehensive but concise.',
      });

      log.info('Synthesis complete', {
        provider: result.providerId,
        usedFallback: result.usedFallback,
        resultsProcessed: cleanedAnswers.length,
      });

      // Parse JSON from response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in synthesis response');
      }

      interface SynthesisResponse {
        bottomLine?: string;
        executiveSummary?: string;
        keyFindings?: { title?: string; finding?: string; confidence?: string }[];
        gaps?: string[];
        suggestions?: string[];
        comparisonTable?: {
          headers?: string[];
          rows?: { entity?: string; values?: string[] }[];
        };
        dataHighlights?: { metric?: string; value?: string; context?: string }[];
      }

      const parsed = JSON.parse(jsonMatch[0]) as SynthesisResponse;

      // Build comprehensive output
      const output: ResearchOutput = {
        bottomLine: String(parsed.bottomLine || 'Research complete.'),
        executiveSummary: String(parsed.executiveSummary || ''),
        keyFindings: (parsed.keyFindings || []).slice(0, 8).map((f) => ({
          title: f.title || '',
          finding: String(f.finding || ''),
          confidence: (f.confidence as 'high' | 'medium' | 'low') || 'medium',
          sources: [],
        })),
        detailedSections: [],
        comparisonTable: this.buildComparisonTable(parsed.comparisonTable),
        gaps: parsed.gaps || [],
        suggestions: parsed.suggestions || [],
        followUpQuestions: [],
        sources: results
          .filter((r) => (r.relevanceScore ?? 0) > 0.2)
          .slice(0, 10)
          .map((r, i) => ({
            id: `source_${i}`,
            title: r.title || `Source ${i + 1}`,
            url: r.url,
            source: r.source,
            accessedAt: r.timestamp,
          })),
        metadata: {
          totalQueries: metadata.totalQueries,
          iterations: metadata.iterations,
          sourcesUsed: [...new Set(results.map((r) => r.source))],
          confidenceScore: this.calculateConfidence(evaluations),
          executionTime: metadata.executionTime,
          depth: metadata.depth,
          completedAt: Date.now(),
        },
      };

      return output;
    } catch (error) {
      log.error('Synthesis error', error as Error);
      return this.createFallbackOutput(results, intent, metadata);
    }
  }

  /**
   * Build comparison table if present
   */
  private buildComparisonTable(
    table: { headers?: string[]; rows?: { entity?: string; values?: string[] }[] } | undefined
  ): ComparisonTable | undefined {
    if (!table || !table.headers || !table.rows || table.rows.length === 0) {
      return undefined;
    }

    return {
      headers: table.headers,
      rows: table.rows
        .map((row) => ({
          entity: String(row.entity || ''),
          values: (row.values || []).map((v) => String(v)),
        }))
        .filter((row) => row.entity.length > 0),
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(evaluations: EvaluatedResults[]): number {
    if (evaluations.length === 0) return 0.5;

    const avgCoverage =
      evaluations.reduce((acc, e) => acc + e.coverage.score, 0) / evaluations.length;
    const avgQuality =
      evaluations.reduce((acc, e) => acc + e.quality.score, 0) / evaluations.length;

    return avgCoverage * 0.5 + avgQuality * 0.5;
  }

  /**
   * Create fallback output if synthesis fails
   * Provides concise, mobile-friendly output from raw results
   */
  private createFallbackOutput(
    results: SearchResult[],
    intent: ResearchIntent,
    metadata: {
      totalQueries: number;
      iterations: number;
      executionTime: number;
      depth: 'quick' | 'standard' | 'deep';
    }
  ): ResearchOutput {
    // Extract clean summaries from results
    const keyFindings = results.slice(0, 3).map((r, i) => {
      // Clean the content - remove markdown, extra whitespace
      let content = r.content
        .replace(/#{1,6}\s*/g, '') // Remove markdown headers
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();

      // Take first 180 chars and find last complete word
      if (content.length > 180) {
        content = content.substring(0, 180);
        const lastSpace = content.lastIndexOf(' ');
        if (lastSpace > 100) {
          content = content.substring(0, lastSpace);
        }
        content += '...';
      }

      return {
        title: r.title?.substring(0, 40) || `Finding ${i + 1}`,
        finding: content,
        confidence: 'medium' as const,
        sources: [r.source],
      };
    });

    return {
      bottomLine: `Found ${results.length} sources on "${intent.topics[0] || intent.refinedQuery}".`,
      executiveSummary: '',
      keyFindings,
      detailedSections: [],
      gaps: [],
      suggestions: [],
      followUpQuestions: [],
      sources: results.map((r, i) => ({
        id: `source_${i}`,
        title: r.title || `Source ${i + 1}`,
        url: r.url,
        source: r.source,
        accessedAt: r.timestamp,
      })),
      metadata: {
        totalQueries: metadata.totalQueries,
        iterations: metadata.iterations,
        sourcesUsed: [...new Set(results.map((r) => r.source))],
        confidenceScore: 0.5,
        executionTime: metadata.executionTime,
        depth: metadata.depth,
        completedAt: Date.now(),
      },
    };
  }

  /**
   * Format output as professional markdown report
   * Enhanced for comprehensive research results
   */
  formatAsMarkdown(output: ResearchOutput): string {
    let md = '';

    // Bottom Line - THE key takeaway (most important, first)
    md += `**Bottom Line:** ${output.bottomLine}\n\n`;

    // Executive Summary (if available)
    if (output.executiveSummary) {
      md += `${output.executiveSummary}\n\n`;
    }

    // Key Findings - up to 8, with confidence indicators
    md += `---\n\n`;
    md += `**Key Findings**\n\n`;
    const findings = output.keyFindings.slice(0, 8);
    findings.forEach((f, i) => {
      const title = f.title ? `**${f.title}**` : `**Finding ${i + 1}**`;
      const confidence = f.confidence === 'high' ? ' ✓' : f.confidence === 'low' ? ' ?' : '';
      const findingText = f.finding.length > 250 ? f.finding.substring(0, 250) + '...' : f.finding;
      md += `${title}${confidence}: ${findingText}\n\n`;
    });

    // Comparison Table (if present and relevant)
    if (
      output.comparisonTable &&
      output.comparisonTable.rows.length > 0 &&
      output.comparisonTable.rows.length <= 8
    ) {
      md += `---\n\n`;
      md += `**Comparison**\n\n`;
      md += `| ${output.comparisonTable.headers.join(' | ')} |\n`;
      md += `| ${output.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      output.comparisonTable.rows.slice(0, 8).forEach((row) => {
        md += `| ${row.entity} | ${row.values.join(' | ')} |\n`;
      });
      md += '\n';
    }

    // Gaps (if any identified)
    if (output.gaps && output.gaps.length > 0) {
      md += `---\n\n`;
      md += `**Information Gaps**\n\n`;
      output.gaps.slice(0, 3).forEach((gap) => {
        md += `• ${gap}\n`;
      });
      md += '\n';
    }

    // Suggestions (if any)
    if (output.suggestions && output.suggestions.length > 0) {
      md += `---\n\n`;
      md += `**Next Steps**\n\n`;
      output.suggestions.slice(0, 3).forEach((suggestion) => {
        md += `• ${suggestion}\n`;
      });
      md += '\n';
    }

    // Sources and metadata
    md += `---\n\n`;
    md += `*${output.metadata.totalQueries} searches • ${output.sources.length} sources • ${(output.metadata.executionTime / 1000).toFixed(0)}s*\n\n`;

    // Document conversion prompt - clean CTA
    md += `---\n\n`;
    md += `**Want a professional document?** Just ask:\n`;
    md += `• "Create a Word doc" • "Make a PDF" • "Draft an email"\n`;

    return md;
  }
}

export const synthesizer = new Synthesizer();
