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
    // Combine all results
    const combinedContent = results
      .map(r => `[${r.source.toUpperCase()}] ${r.title || 'Source'}\nURL: ${r.url || 'N/A'}\n${r.content}`)
      .join('\n\n---\n\n');

    // Get gaps from evaluations
    const allGaps = [...new Set(evaluations.flatMap(e => e.quality.gaps))];
    const conflicts = [...new Set(evaluations.flatMap(e => e.quality.conflicts))];

    // Detect if this is comparison/competitor research
    const isComparisonResearch = /competitor|compare|comparison|versus|vs\.?|alternative/i.test(intent.originalQuery);

    const prompt = `You are an elite research analyst producing premium intelligence reports. Synthesize the following research into a comprehensive, professional report.

ORIGINAL RESEARCH REQUEST:
"${intent.originalQuery}"

REFINED UNDERSTANDING:
"${intent.refinedQuery}"

TOPICS RESEARCHED:
${intent.topics.join(', ')}

EXPECTED OUTPUTS:
${intent.expectedOutputs.join(', ')}

RESEARCH COLLECTED:
${combinedContent.substring(0, 20000)}

KNOWN GAPS IN RESEARCH:
${allGaps.length > 0 ? allGaps.join('\n') : 'None identified'}

CONFLICTS FOUND:
${conflicts.length > 0 ? conflicts.join('\n') : 'None identified'}

Create a premium research report as JSON:
{
  "bottomLine": "ONE powerful sentence that directly answers the user's question - this is the most important takeaway",
  "executiveSummary": "2-3 paragraph overview of key findings and strategic recommendations",
  "keyFindings": [
    {
      "title": "Short finding title (3-5 words)",
      "finding": "Detailed, specific, actionable finding with data points",
      "confidence": "high" | "medium" | "low",
      "sources": ["source names that support this"]
    }
  ],
  "detailedSections": [
    {
      "title": "Section title based on topic",
      "content": "Detailed analysis with specific data points, statistics, and insights",
      "findings": [
        {
          "finding": "Section-specific finding",
          "confidence": "high" | "medium" | "low",
          "sources": ["supporting sources"]
        }
      ]
    }
  ],${isComparisonResearch ? `
  "comparisonTable": {
    "headers": ["Feature/Aspect", "Column headers for each entity being compared"],
    "rows": [
      {
        "entity": "Row label (feature/aspect name)",
        "values": ["Value for each column"]
      }
    ]
  },` : ''}
  "gaps": ["What we couldn't find or verify - be honest"],
  "suggestions": ["Actionable next steps the user should take"],
  "followUpQuestions": ["3-5 specific follow-up questions the user might want to explore based on these findings"],
  "sources": [
    {
      "title": "Source title",
      "url": "URL if available",
      "source": "google" | "perplexity"
    }
  ]
}

SYNTHESIS RULES:
1. bottomLine MUST directly answer the user's question in ONE impactful sentence
2. executiveSummary should be strategic and actionable, not just descriptive
3. keyFindings should be 5-10 SPECIFIC findings with real data/numbers when available
4. Each keyFinding needs a short "title" for scannability
5. Confidence levels:
   - "high": Multiple sources agree, recent data, verifiable
   - "medium": Single source or some ambiguity
   - "low": Uncertain, conflicting, or outdated
6. detailedSections should organize by topic (3-5 sections)
7. gaps should be honest about what's missing - users appreciate transparency
8. suggestions should be concrete, actionable next steps
9. followUpQuestions should be specific and valuable questions to explore next
10. ${isComparisonResearch ? 'Include comparisonTable with meaningful comparison data' : 'Skip comparisonTable if not relevant'}
11. Include ALL sources used

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          bottomLine: { type: 'string' },
          executiveSummary: { type: 'string' },
          keyFindings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                finding: { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                sources: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          detailedSections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                findings: { type: 'array' },
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
          gaps: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
          followUpQuestions: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array' },
        },
        required: ['bottomLine', 'executiveSummary', 'keyFindings'],
      };

      interface SynthesisResponse {
        bottomLine?: string;
        executiveSummary?: string;
        keyFindings?: unknown[];
        detailedSections?: unknown[];
        comparisonTable?: {
          headers?: string[];
          rows?: { entity?: string; values?: string[] }[];
        };
        gaps?: string[];
        suggestions?: string[];
        followUpQuestions?: string[];
        sources?: unknown[];
      }

      const { data: parsed } = await createClaudeStructuredOutput<SynthesisResponse>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are an expert research analyst. Respond with valid JSON only.',
        schema,
      });

      log.info(`Using Claude Sonnet for research synthesis`);

      // Build the output with proper typing
      const output: ResearchOutput = {
        bottomLine: String(parsed.bottomLine || 'Research synthesis complete.'),
        executiveSummary: String(parsed.executiveSummary || 'Research synthesis complete.'),
        keyFindings: this.buildKeyFindings(parsed.keyFindings),
        detailedSections: this.buildSections(parsed.detailedSections),
        comparisonTable: this.buildComparisonTable(parsed.comparisonTable),
        gaps: (parsed.gaps as string[]) || allGaps,
        suggestions: (parsed.suggestions as string[]) || [],
        followUpQuestions: (parsed.followUpQuestions as string[]) || [],
        sources: this.buildSources(parsed.sources, results),
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
      log.error('Error synthesizing results (Claude Sonnet)', error as Error);
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
   */
  private createFallbackOutput(
    results: SearchResult[],
    intent: ResearchIntent,
    metadata: { totalQueries: number; iterations: number; executionTime: number; depth: 'quick' | 'standard' | 'deep' }
  ): ResearchOutput {
    // Create basic output from raw results
    const combinedContent = results.map(r => r.content).join('\n\n');

    return {
      bottomLine: `Research collected ${results.length} results on "${intent.refinedQuery}" - review findings below.`,
      executiveSummary: `Research on "${intent.refinedQuery}" collected ${results.length} results from ${new Set(results.map(r => r.source)).size} sources. Review the detailed findings below.`,
      keyFindings: results.slice(0, 5).map((r, i) => ({
        title: `Finding ${i + 1}`,
        finding: r.content.substring(0, 200) + '...',
        confidence: 'medium' as const,
        sources: [r.title || `Source ${i + 1}`],
      })),
      detailedSections: [
        {
          title: 'Research Results',
          content: combinedContent.substring(0, 5000),
          findings: [],
        },
      ],
      gaps: ['Full synthesis was not possible - raw results provided'],
      suggestions: ['Review the raw results and identify key takeaways'],
      followUpQuestions: ['What specific aspects would you like to explore further?'],
      sources: results.map((r, i) => ({
        id: `source_${i}`,
        title: r.title || `Result ${i + 1}`,
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
   */
  formatAsMarkdown(output: ResearchOutput): string {
    let md = '';

    // Research metadata header
    const depthLabel = output.metadata.depth === 'deep' ? 'Deep Research' :
                       output.metadata.depth === 'quick' ? 'Quick Research' : 'Standard Research';
    const completedDate = new Date(output.metadata.completedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    md += `*${depthLabel} • ${completedDate} • Real-time data*\n\n`;

    // Bottom Line - THE key takeaway
    md += `> **Bottom Line:** ${output.bottomLine}\n\n`;

    // Executive Summary
    md += `---\n\n`;
    md += `## Executive Summary\n\n`;
    md += `${output.executiveSummary}\n\n`;

    // Key Findings - numbered with titles
    md += `---\n\n`;
    md += `## Key Findings\n\n`;
    output.keyFindings.forEach((f, i) => {
      const title = f.title ? `**${f.title}**` : `**Finding ${i + 1}**`;
      md += `${i + 1}. ${title}\n`;
      md += `   ${f.finding}\n`;
      if (f.sources.length > 0) {
        md += `   *Sources: ${f.sources.join(', ')}*\n`;
      }
      md += '\n';
    });

    // Comparison Table (if present)
    if (output.comparisonTable && output.comparisonTable.rows.length > 0) {
      md += `---\n\n`;
      md += `## Comparison\n\n`;
      // Header row
      md += `| ${output.comparisonTable.headers.join(' | ')} |\n`;
      // Separator row
      md += `| ${output.comparisonTable.headers.map(() => '---').join(' | ')} |\n`;
      // Data rows
      output.comparisonTable.rows.forEach(row => {
        md += `| ${row.entity} | ${row.values.join(' | ')} |\n`;
      });
      md += '\n';
    }

    // Detailed Sections
    if (output.detailedSections.length > 0) {
      md += `---\n\n`;
      md += `## Detailed Analysis\n\n`;
      output.detailedSections.forEach(section => {
        md += `### ${section.title}\n\n`;
        md += `${section.content}\n\n`;
        if (section.findings.length > 0) {
          md += `**Key Points:**\n\n`;
          section.findings.forEach(f => {
            md += `• ${f.finding}\n`;
          });
          md += '\n';
        }
      });
    }

    // Research Gaps
    if (output.gaps.length > 0) {
      md += `---\n\n`;
      md += `## Data Gaps & Limitations\n\n`;
      output.gaps.forEach(gap => {
        md += `• ${gap}\n`;
      });
      md += '\n';
    }

    // Recommended Actions
    if (output.suggestions.length > 0) {
      md += `---\n\n`;
      md += `## Recommended Actions\n\n`;
      output.suggestions.forEach((s, i) => {
        md += `**${i + 1}.** ${s}\n\n`;
      });
    }

    // What to Explore Next
    if (output.followUpQuestions && output.followUpQuestions.length > 0) {
      md += `---\n\n`;
      md += `## What to Explore Next\n\n`;
      md += `Based on this research, you might want to ask:\n\n`;
      output.followUpQuestions.forEach(q => {
        md += `• ${q}\n`;
      });
      md += '\n';
    }

    // Sources
    md += `---\n\n`;
    md += `## Sources\n\n`;
    output.sources.slice(0, 10).forEach((s, i) => {
      md += `${i + 1}. ${s.title}\n`;
    });
    if (output.sources.length > 10) {
      md += `\n*+ ${output.sources.length - 10} additional sources*\n`;
    }

    // Footer with metadata
    md += `\n---\n\n`;
    md += `*Research completed in ${(output.metadata.executionTime / 1000).toFixed(1)}s using ${output.metadata.totalQueries} queries across ${output.metadata.iterations} iteration${output.metadata.iterations > 1 ? 's' : ''}.*\n\n`;

    // Document conversion prompt
    md += `---\n\n`;
    md += `**Would you like me to turn this research into a professional document?**\n\n`;
    md += `• *"Create a Word document"* — Formatted report ready for sharing\n`;
    md += `• *"Create a PDF"* — Professional PDF report\n`;
    md += `• *"Draft an email summary"* — Key findings formatted for email\n`;
    md += `• *"Create a presentation outline"* — Slide deck structure\n`;

    return md;
  }
}

export const synthesizer = new Synthesizer();
