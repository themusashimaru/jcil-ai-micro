/**
 * SYNTHESIZER
 *
 * The final stage of the Research Brain.
 * Takes all collected research and creates a structured, actionable output.
 *
 * This is where raw data becomes intelligence.
 */

import { GoogleGenAI } from '@google/genai';
import {
  ResearchIntent,
  SearchResult,
  ResearchOutput,
  KeyFinding,
  ResearchSection,
  SourceCitation,
  EvaluatedResults,
} from '../../core/types';

const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export class Synthesizer {
  private model = 'gemini-3-pro-preview';

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
    }
  ): Promise<ResearchOutput> {
    // Combine all results
    const combinedContent = results
      .map(r => `[${r.source.toUpperCase()}] ${r.title || 'Source'}\nURL: ${r.url || 'N/A'}\n${r.content}`)
      .join('\n\n---\n\n');

    // Get gaps from evaluations
    const allGaps = [...new Set(evaluations.flatMap(e => e.quality.gaps))];
    const conflicts = [...new Set(evaluations.flatMap(e => e.quality.conflicts))];

    const prompt = `You are an expert research analyst. Synthesize the following research into a comprehensive, actionable report.

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

Create a comprehensive research report as JSON:
{
  "executiveSummary": "2-3 paragraph overview of key findings and recommendations",
  "keyFindings": [
    {
      "finding": "Specific, actionable finding",
      "confidence": "high" | "medium" | "low",
      "sources": ["source names/URLs that support this"]
    }
  ],
  "detailedSections": [
    {
      "title": "Section title based on topic",
      "content": "Detailed analysis with specific data points",
      "findings": [
        {
          "finding": "Section-specific finding",
          "confidence": "high" | "medium" | "low",
          "sources": ["supporting sources"]
        }
      ]
    }
  ],
  "gaps": ["What we couldn't find or verify"],
  "suggestions": ["What the user should research next or actions to take"],
  "sources": [
    {
      "title": "Source title",
      "url": "URL if available",
      "source": "google" | "perplexity"
    }
  ]
}

SYNTHESIS RULES:
1. executiveSummary should be actionable, not just descriptive
2. keyFindings should be 5-10 SPECIFIC findings with data
3. Confidence levels:
   - "high": Multiple sources agree, recent data
   - "medium": Single source or some ambiguity
   - "low": Uncertain, conflicting, or outdated
4. detailedSections should organize by topic (3-5 sections)
5. gaps should be honest about what's missing
6. suggestions should be actionable next steps
7. Include ALL sources used

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const response = await gemini.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build the output with proper typing
      const output: ResearchOutput = {
        executiveSummary: String(parsed.executiveSummary || 'Research synthesis complete.'),
        keyFindings: this.buildKeyFindings(parsed.keyFindings),
        detailedSections: this.buildSections(parsed.detailedSections),
        gaps: (parsed.gaps as string[]) || allGaps,
        suggestions: (parsed.suggestions as string[]) || [],
        sources: this.buildSources(parsed.sources, results),
        metadata: {
          totalQueries: metadata.totalQueries,
          iterations: metadata.iterations,
          sourcesUsed: [...new Set(results.map(r => r.source))],
          confidenceScore: this.calculateConfidence(evaluations),
          executionTime: metadata.executionTime,
        },
      };

      return output;
    } catch (error) {
      console.error('[Synthesizer] Error synthesizing results:', error);
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
        finding: String(finding.finding || ''),
        confidence: this.validateConfidence(finding.confidence),
        sources: (finding.sources as string[]) || [],
      };
    }).filter(f => f.finding.length > 0);
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
    metadata: { totalQueries: number; iterations: number; executionTime: number }
  ): ResearchOutput {
    // Create basic output from raw results
    const combinedContent = results.map(r => r.content).join('\n\n');

    return {
      executiveSummary: `Research on "${intent.refinedQuery}" collected ${results.length} results from ${new Set(results.map(r => r.source)).size} sources. Review the detailed findings below.`,
      keyFindings: results.slice(0, 5).map((r, i) => ({
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
      },
    };
  }

  /**
   * Format output as markdown for display
   */
  formatAsMarkdown(output: ResearchOutput): string {
    let md = '';

    // Executive Summary
    md += `## Executive Summary\n\n${output.executiveSummary}\n\n`;

    // Key Findings
    md += `## Key Findings\n\n`;
    output.keyFindings.forEach((f, i) => {
      const confidenceIcon = f.confidence === 'high' ? '✅' : f.confidence === 'medium' ? '⚠️' : '❓';
      md += `${i + 1}. ${confidenceIcon} **${f.finding}**\n`;
      if (f.sources.length > 0) {
        md += `   _Sources: ${f.sources.join(', ')}_\n`;
      }
      md += '\n';
    });

    // Detailed Sections
    output.detailedSections.forEach(section => {
      md += `## ${section.title}\n\n${section.content}\n\n`;
      if (section.findings.length > 0) {
        md += `**Section Findings:**\n`;
        section.findings.forEach(f => {
          md += `- ${f.finding}\n`;
        });
        md += '\n';
      }
    });

    // Gaps
    if (output.gaps.length > 0) {
      md += `## Research Gaps\n\n`;
      md += `_The following information could not be found or verified:_\n\n`;
      output.gaps.forEach(gap => {
        md += `- ${gap}\n`;
      });
      md += '\n';
    }

    // Suggestions
    if (output.suggestions.length > 0) {
      md += `## Next Steps\n\n`;
      output.suggestions.forEach((s, i) => {
        md += `${i + 1}. ${s}\n`;
      });
      md += '\n';
    }

    // Sources
    md += `## Sources\n\n`;
    output.sources.forEach((s, i) => {
      if (s.url) {
        md += `${i + 1}. [${s.title}](${s.url}) _(${s.source})_\n`;
      } else {
        md += `${i + 1}. ${s.title} _(${s.source})_\n`;
      }
    });

    // Metadata
    md += `\n---\n`;
    md += `_Research completed in ${(output.metadata.executionTime / 1000).toFixed(1)}s | `;
    md += `${output.metadata.totalQueries} queries | `;
    md += `${output.metadata.iterations} iterations | `;
    md += `Confidence: ${(output.metadata.confidenceScore * 100).toFixed(0)}%_\n`;

    return md;
  }
}

export const synthesizer = new Synthesizer();
