/**
 * SYNTHESIZER - Pre-QC Finding Compilation
 *
 * Uses Opus 4.6 to compile and organize ALL raw findings from scouts
 * before Quality Control review. Ensures users always receive
 * valuable, organized output even when QC triggers limits.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Finding,
  SynthesizedProblem,
  StrategyStreamCallback,
} from './types';
import { CLAUDE_OPUS_46, SYNTHESIZER_PROMPT } from './constants';
import { extractJSON } from './utils';
import { logger } from '@/lib/logger';

const log = logger('Synthesizer');

// =============================================================================
// SYNTHESIZER RESULT TYPES
// =============================================================================

export interface SynthesizedInsight {
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  supportingEvidence: string[];
  sourceCount: number;
  sources: string[];
}

export interface SynthesizedDataPoint {
  metric: string;
  value: string;
  range?: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

export interface DomainFindings {
  keyInsights: SynthesizedInsight[];
  dataPoints: SynthesizedDataPoint[];
  warnings: string[];
  opportunities: string[];
}

export interface ConflictResolution {
  topic: string;
  position1: { claim: string; source: string; confidence: string };
  position2: { claim: string; source: string; confidence: string };
  resolution: string;
}

export interface ResearchGap {
  question: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  suggestedAction: string;
}

export interface TopFinding {
  rank: number;
  finding: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface OverallAssessment {
  researchQuality: 'excellent' | 'good' | 'fair' | 'poor';
  coverageCompleteness: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  readyForQC: boolean;
  notes: string;
}

export interface SynthesizerResult {
  synthesisComplete: boolean;
  totalFindingsProcessed: number;
  uniqueFindingsAfterDedup: number;
  organizedFindings: Record<string, DomainFindings>;
  conflicts: ConflictResolution[];
  gaps: ResearchGap[];
  topFindings: TopFinding[];
  overallAssessment: OverallAssessment;
  // Raw for backup
  rawSynthesis?: string;
}

// =============================================================================
// SYNTHESIZER CLASS
// =============================================================================

export class Synthesizer {
  private client: Anthropic;
  private model = CLAUDE_OPUS_46;
  private onStream?: StrategyStreamCallback;
  private systemPrompt: string;

  constructor(
    client: Anthropic,
    onStream?: StrategyStreamCallback,
    systemPrompt?: string
  ) {
    this.client = client;
    this.onStream = onStream;
    this.systemPrompt = systemPrompt || SYNTHESIZER_PROMPT;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Update the stream callback (needed when switching from intake to execute stream)
   */
  setStreamCallback(callback: StrategyStreamCallback | undefined): void {
    this.onStream = callback;
  }

  /**
   * Synthesize all findings into organized, QC-ready format
   */
  async synthesize(
    problem: SynthesizedProblem,
    findings: Finding[]
  ): Promise<SynthesizerResult> {
    const startTime = Date.now();

    log.info('Starting synthesis', {
      findingsCount: findings.length,
      domains: problem.domains,
    });

    this.emitEvent('synthesis_starting', 'Opus Synthesizer compiling findings...', {
      findingsCount: findings.length,
    });

    if (findings.length === 0) {
      log.warn('No findings to synthesize');
      return this.createEmptyResult();
    }

    try {
      // Build the prompt with problem and findings
      const prompt = this.buildPrompt(problem, findings);

      // Call Opus for synthesis
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        temperature: 0.3, // Lower temperature for more consistent organization
        system: prompt,
        messages: [
          {
            role: 'user',
            content: 'Synthesize all findings into an organized, QC-ready format. Be thorough but concise.',
          },
        ],
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // Parse the response
      const result = this.parseResponse(textContent, findings.length);

      const elapsed = Date.now() - startTime;

      log.info('Synthesis complete', {
        elapsed,
        uniqueFindings: result.uniqueFindingsAfterDedup,
        domains: Object.keys(result.organizedFindings).length,
        conflicts: result.conflicts.length,
        gaps: result.gaps.length,
      });

      this.emitEvent('synthesis_complete', 'Findings compiled and organized', {
        uniqueFindings: result.uniqueFindingsAfterDedup,
        quality: result.overallAssessment.researchQuality,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error('Synthesis failed', { error: errMsg });

      this.emitEvent('synthesis_error', `Synthesis error: ${errMsg}`, {});

      // Return a fallback result with raw findings organized by agent
      return this.createFallbackResult(findings);
    }
  }

  /**
   * Quick synthesis for partial results (when QC triggers early)
   */
  async quickSynthesize(
    _problem: SynthesizedProblem,
    findings: Finding[]
  ): Promise<SynthesizerResult> {
    log.info('Running quick synthesis for partial results', {
      findingsCount: findings.length,
    });

    this.emitEvent('quick_synthesis', 'Compiling partial results...', {
      findingsCount: findings.length,
    });

    // For quick synthesis, do basic organization without full Opus call
    // This ensures users always get SOMETHING even if we're resource-constrained
    return this.createFallbackResult(findings, true);
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build the synthesis prompt
   */
  private buildPrompt(problem: SynthesizedProblem, findings: Finding[]): string {
    // Serialize findings for the prompt
    const findingsJson = JSON.stringify(
      findings.map((f) => ({
        id: f.id,
        agent: f.agentName,
        type: f.type,
        title: f.title,
        content: f.content,
        confidence: f.confidence,
        sources: f.sources.map((s) => s.title || s.url),
        relevance: f.relevanceScore,
      })),
      null,
      2
    );

    return this.systemPrompt
      .replace('{SYNTHESIZED_PROBLEM}', JSON.stringify(problem, null, 2))
      .replace('{RAW_FINDINGS}', findingsJson);
  }

  /**
   * Parse the Opus response into structured result
   */
  private parseResponse(response: string, totalFindings: number): SynthesizerResult {
    const json = extractJSON(response) as Partial<SynthesizerResult> | null;

    if (!json) {
      log.warn('Could not parse synthesis response as JSON');
      return {
        synthesisComplete: true,
        totalFindingsProcessed: totalFindings,
        uniqueFindingsAfterDedup: totalFindings,
        organizedFindings: {},
        conflicts: [],
        gaps: [],
        topFindings: [],
        overallAssessment: {
          researchQuality: 'fair',
          coverageCompleteness: 50,
          confidenceLevel: 'medium',
          readyForQC: true,
          notes: 'Synthesis completed but JSON parsing failed. Raw text preserved.',
        },
        rawSynthesis: response,
      };
    }

    return {
      synthesisComplete: json.synthesisComplete ?? true,
      totalFindingsProcessed: json.totalFindingsProcessed ?? totalFindings,
      uniqueFindingsAfterDedup: json.uniqueFindingsAfterDedup ?? totalFindings,
      organizedFindings: json.organizedFindings ?? {},
      conflicts: json.conflicts ?? [],
      gaps: json.gaps ?? [],
      topFindings: json.topFindings ?? [],
      overallAssessment: json.overallAssessment ?? {
        researchQuality: 'good',
        coverageCompleteness: 70,
        confidenceLevel: 'medium',
        readyForQC: true,
        notes: '',
      },
      rawSynthesis: response,
    };
  }

  /**
   * Create empty result when no findings
   */
  private createEmptyResult(): SynthesizerResult {
    return {
      synthesisComplete: true,
      totalFindingsProcessed: 0,
      uniqueFindingsAfterDedup: 0,
      organizedFindings: {},
      conflicts: [],
      gaps: [
        {
          question: 'No research findings were collected',
          importance: 'critical',
          suggestedAction: 'Review agent execution logs for errors',
        },
      ],
      topFindings: [],
      overallAssessment: {
        researchQuality: 'poor',
        coverageCompleteness: 0,
        confidenceLevel: 'low',
        readyForQC: false,
        notes: 'No findings to synthesize. Research phase may have failed.',
      },
    };
  }

  /**
   * Create fallback result by organizing findings without Opus
   * Used when synthesis fails or for quick partial results
   */
  private createFallbackResult(findings: Finding[], isPartial = false): SynthesizerResult {
    // Group by agent/domain
    const byAgent: Record<string, Finding[]> = {};
    for (const f of findings) {
      const key = f.agentName || f.agentId || 'unknown';
      if (!byAgent[key]) byAgent[key] = [];
      byAgent[key].push(f);
    }

    // Convert to organized format
    const organizedFindings: Record<string, DomainFindings> = {};
    for (const [agentName, agentFindings] of Object.entries(byAgent)) {
      organizedFindings[agentName] = {
        keyInsights: agentFindings
          .filter((f) => f.type === 'insight' || f.type === 'fact')
          .map((f) => ({
            insight: f.content,
            confidence: f.confidence,
            supportingEvidence: [f.id],
            sourceCount: f.sources.length,
            sources: f.sources.map((s) => s.title || s.url || 'unknown'),
          })),
        dataPoints: agentFindings
          .filter((f) => f.type === 'data' && f.dataPoints)
          .flatMap((f) =>
            (f.dataPoints || []).map((dp) => ({
              metric: dp.label,
              value: String(dp.value),
              confidence: f.confidence,
              sources: f.sources.map((s) => s.title || 'unknown'),
            }))
          ),
        warnings: agentFindings
          .filter((f) => f.type === 'warning')
          .map((f) => f.content),
        opportunities: agentFindings
          .filter((f) => f.type === 'opportunity')
          .map((f) => f.content),
      };
    }

    // Extract top findings by relevance
    const sortedByRelevance = [...findings].sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    const topFindings: TopFinding[] = sortedByRelevance.slice(0, 5).map((f, i) => ({
      rank: i + 1,
      finding: f.title || f.content.slice(0, 100),
      impact: f.content,
      confidence: f.confidence,
    }));

    return {
      synthesisComplete: true,
      totalFindingsProcessed: findings.length,
      uniqueFindingsAfterDedup: findings.length, // No dedup in fallback
      organizedFindings,
      conflicts: [],
      gaps: isPartial
        ? [
            {
              question: 'Research was interrupted before completion',
              importance: 'important',
              suggestedAction: 'Results are partial - some findings may be missing',
            },
          ]
        : [],
      topFindings,
      overallAssessment: {
        researchQuality: isPartial ? 'fair' : 'good',
        coverageCompleteness: isPartial ? 50 : 70,
        confidenceLevel: 'medium',
        readyForQC: true,
        notes: isPartial
          ? 'Partial results compiled. Full synthesis was not completed.'
          : 'Fallback synthesis used. Results organized by agent.',
      },
    };
  }

  /**
   * Emit stream event
   */
  private emitEvent(
    type: string,
    message: string,
    data: Record<string, unknown>
  ): void {
    if (this.onStream) {
      this.onStream({
        type: type as 'synthesis_starting',
        message,
        timestamp: Date.now(),
        data: data as Parameters<StrategyStreamCallback>[0]['data'],
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createSynthesizer(
  client: Anthropic,
  onStream?: StrategyStreamCallback,
  systemPrompt?: string
): Synthesizer {
  return new Synthesizer(client, onStream, systemPrompt);
}
