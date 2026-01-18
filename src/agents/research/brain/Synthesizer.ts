/**
 * SYNTHESIZER
 *
 * The final stage of the Research Brain.
 * Takes all collected research and creates a structured, actionable output.
 *
 * This is where raw data becomes intelligence.
 *
 * POWERED BY: Claude Sonnet 4.5 (migrated from Gemini)
 */

import { createClaudeStructuredOutput } from '@/lib/anthropic/client';
import {
  ResearchIntent,
  SearchResult,
  ResearchOutput,
  KeyFinding,
  ResearchSection,
  SourceCitation,
  EvaluatedResults,
  ComparisonTable,
} from '../../core/types';
import { logger } from '@/lib/logger';

const log = logger('Synthesizer');

export class Synthesizer {

  /**
   * Synthesize all research into a structured output
   *
   * ULTRA-OPTIMIZED: Perplexity returns one-sentence answers per query.
   * We just combine and present them - minimal LLM processing.
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
    // Extract one-sentence answers from Perplexity responses
    const oneSentenceAnswers = results.slice(0, 6).map(r => {
      // Clean the content - remove sources section, get the core answer
      let answer = r.content.split('**Sources:**')[0].trim();
      // Remove markdown formatting
      answer = answer.replace(/\*\*/g, '').trim();
      // Get first sentence if still too long
      if (answer.length > 200) {
        const firstSentence = answer.match(/^[^.!?]+[.!?]/);
        answer = firstSentence ? firstSentence[0].trim() : answer.substring(0, 200);
      }
      return answer;
    }).filter(a => a.length > 10);

    // Detect if this is comparison research
    const isComparisonResearch = /competitor|compare|comparison|versus|vs\.?|alternative/i.test(intent.originalQuery);

    // ULTRA-LEAN prompt - just combine one-liners
    const prompt = `Combine these research findings into a brief report.

QUESTION: "${intent.originalQuery}"

FINDINGS (one per source):
${oneSentenceAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Return JSON:
{
  "bottomLine": "One sentence answer synthesizing the findings",
  "keyFindings": [
    {"title": "3-5 word title", "finding": "Unique insight under 120 chars"}
  ]${isComparisonResearch ? `,
  "comparisonTable": {
    "headers": ["Metric", "Entity1", "Entity2"],
    "rows": [{"entity": "Metric", "values": ["val1", "val2"]}]
  }` : ''}
}

Rules:
- bottomLine: Direct answer, one sentence
- keyFindings: 3-5 unique insights, no duplicates
${isComparisonResearch ? '- comparisonTable: Key metrics comparison' : ''}

JSON only:`;

    try {
      const schema = {
        type: 'object',
        properties: {
          bottomLine: { type: 'string' },
          keyFindings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                finding: { type: 'string' },
              },
            },
          },
          comparisonTable: {
            type: 'object',
            properties: {
              headers: { type: 'array', items: { type: 'string' } },
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    entity: { type: 'string' },
                    values: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
        required: ['bottomLine', 'keyFindings'],
      };

      interface SynthesisResponse {
        bottomLine?: string;
        keyFindings?: { title?: string; finding?: string }[];
        comparisonTable?: {
          headers?: string[];
          rows?: { entity?: string; values?: string[] }[];
        };
      }

      const { data: parsed } = await createClaudeStructuredOutput<SynthesisResponse>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a research analyst. Return valid JSON only.',
        schema,
      });

      log.info(`Synthesis complete`);

      // Build lean output
      const output: ResearchOutput = {
        bottomLine: String(parsed.bottomLine || 'Research complete.'),
        executiveSummary: '',
        keyFindings: (parsed.keyFindings || []).slice(0, 5).map(f => ({
          title: f.title,
          finding: String(f.finding || ''),
          confidence: 'medium' as const,
          sources: [],
        })),
        detailedSections: [],
        comparisonTable: this.buildComparisonTable(parsed.comparisonTable),
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
          sourcesUsed: [...new Set(results.map(r => r.source))],
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
   * Build key findings with proper typing
   */
  private buildKeyFindings(findings: unknown[] | undefined): KeyFinding[] {
    if (!findings || !Array.isArray(findings)) return [];

    return findings.map((f: unknown) => {
      const finding = f as Record<string, unknown>;
      return {
        title: finding.title ? String(finding.title) : undefined,
        finding: String(finding.finding || ''),
        confidence: this.validateConfidence(finding.confidence),
        sources: (finding.sources as string[]) || [],
      };
    }).filter(f => f.finding.length > 0);
  }

  /**
   * Build comparison table if present
   */
  private buildComparisonTable(table: { headers?: string[]; rows?: { entity?: string; values?: string[] }[] } | undefined): ComparisonTable | undefined {
    if (!table || !table.headers || !table.rows || table.rows.length === 0) {
      return undefined;
    }

    return {
      headers: table.headers,
      rows: table.rows.map(row => ({
        entity: String(row.entity || ''),
        values: (row.values || []).map(v => String(v)),
      })).filter(row => row.entity.length > 0),
    };
  }

  /**
   * Build detailed sections
   */
  private buildSections(sections: unknown[] | undefined): ResearchSection[] {
    if (!sections || !Array.isArray(sections)) return [];

    return sections.map((s: unknown) => {
      const section = s as Record<string, unknown>;
      return {
        title: String(section.title || 'Research Section'),
        content: String(section.content || ''),
        findings: this.buildKeyFindings(section.findings as unknown[]),
      };
    }).filter(s => s.content.length > 0);
  }

  /**
   * Build source citations
   */
  private buildSources(sources: unknown[] | undefined, results: SearchResult[]): SourceCitation[] {
    // Start with parsed sources
    const citations: SourceCitation[] = [];

    if (sources && Array.isArray(sources)) {
      sources.forEach((s: unknown, i: number) => {
        const source = s as Record<string, unknown>;
        citations.push({
          id: `source_${i}`,
          title: String(source.title || 'Source'),
          url: source.url ? String(source.url) : undefined,
          source: (source.source === 'perplexity' ? 'perplexity' : 'google') as 'google' | 'perplexity',
          accessedAt: Date.now(),
        });
      });
    }

    // Add any sources from results not already included
    results.forEach((r, i) => {
      if (r.url && !citations.some(c => c.url === r.url)) {
        citations.push({
          id: `result_source_${i}`,
          title: r.title || 'Search Result',
          url: r.url,
          source: r.source,
          accessedAt: r.timestamp,
        });
      }
    });

    return citations;
  }

  /**
   * Validate confidence level
   */
  private validateConfidence(confidence: unknown): 'high' | 'medium' | 'low' {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(String(confidence))
      ? (confidence as 'high' | 'medium' | 'low')
      : 'medium';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(evaluations: EvaluatedResults[]): number {
    if (evaluations.length === 0) return 0.5;

    const avgCoverage = evaluations.reduce((acc, e) => acc + e.coverage.score, 0) / evaluations.length;
    const avgQuality = evaluations.reduce((acc, e) => acc + e.quality.score, 0) / evaluations.length;

    return (avgCoverage * 0.5) + (avgQuality * 0.5);
  }

  /**
   * Create fallback output if synthesis fails
   * Provides concise, mobile-friendly output from raw results
   */
  private createFallbackOutput(
    results: SearchResult[],
    intent: ResearchIntent,
    metadata: { totalQueries: number; iterations: number; executionTime: number; depth: 'quick' | 'standard' | 'deep' }
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
        sourcesUsed: [...new Set(results.map(r => r.source))],
        confidenceScore: 0.5,
        executionTime: metadata.executionTime,
        depth: metadata.depth,
        completedAt: Date.now(),
      },
    };
  }

  /**
   * Format output as professional markdown report
   * Optimized for mobile: concise, scannable, no clutter
   */
  formatAsMarkdown(output: ResearchOutput): string {
    let md = '';

    // Bottom Line - THE key takeaway (most important, first)
    md += `**Bottom Line:** ${output.bottomLine}\n\n`;

    // Key Findings - max 5, concise format
    md += `---\n\n`;
    md += `**Key Findings**\n\n`;
    const findings = output.keyFindings.slice(0, 5);
    findings.forEach((f, i) => {
      const title = f.title ? `**${f.title}:**` : `**${i + 1}.**`;
      // Truncate long findings for mobile
      const findingText = f.finding.length > 200 ? f.finding.substring(0, 200) + '...' : f.finding;
      md += `${title} ${findingText}\n\n`;
    });

    // Comparison Table (if present and relevant)
    if (output.comparisonTable && output.comparisonTable.rows.length > 0 && output.comparisonTable.rows.length <= 5) {
      md += `---\n\n`;
      md += `**Comparison**\n\n`;
      md += `| ${output.comparisonTable.headers.join(' | ')} |\n`;
      md += `| ${output.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      output.comparisonTable.rows.slice(0, 5).forEach(row => {
        md += `| ${row.entity} | ${row.values.join(' | ')} |\n`;
      });
      md += '\n';
    }

    // Sources - minimal, just count
    md += `---\n\n`;
    md += `*Based on ${output.sources.length} sources • ${(output.metadata.executionTime / 1000).toFixed(0)}s*\n\n`;

    // Document conversion prompt - clean CTA
    md += `---\n\n`;
    md += `**Want a professional document?** Just ask:\n`;
    md += `• "Create a Word doc" • "Make a PDF" • "Draft an email"\n`;

    return md;
  }
}

export const synthesizer = new Synthesizer();
