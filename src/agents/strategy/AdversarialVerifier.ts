/**
 * ADVERSARIAL VERIFICATION LAYER
 *
 * A critical component that actively challenges AI outputs by generating
 * counter-arguments, devil's advocate positions, and stress-testing findings.
 *
 * This creates a "red team" within the AI system itself - an internal adversary
 * that tries to find flaws, weaknesses, and blind spots in the reasoning.
 *
 * Key capabilities:
 * - Devil's advocate argumentation
 * - Counter-evidence generation
 * - Stress testing recommendations
 * - Finding contradiction detection
 * - Robustness scoring
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Finding,
  StrategyOutput,
  StrategyRecommendation,
  StrategyStreamCallback,
  SynthesizedProblem,
} from './types';
import { CLAUDE_OPUS_46, CLAUDE_SONNET_45 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('AdversarialVerifier');

// =============================================================================
// TYPES
// =============================================================================

export interface AdversarialResult {
  /** Overall verification status */
  status: 'verified' | 'concerns' | 'failed';

  /** Robustness score (0-1) - how well the findings/recommendations hold up */
  robustnessScore: number;

  /** Counter-arguments generated */
  counterArguments: CounterArgument[];

  /** Contradictions found in findings */
  contradictions: Contradiction[];

  /** Stress test results */
  stressTests: StressTestResult[];

  /** Alternative perspectives that were underweighted */
  underweightedPerspectives: Perspective[];

  /** Devil's advocate assessment */
  devilsAdvocate: DevilsAdvocateAssessment;

  /** Final verdict and recommendations */
  verdict: VerificationVerdict;

  /** Timestamp */
  timestamp: number;
}

export interface CounterArgument {
  id: string;
  targetFindingId?: string;
  targetRecommendation?: string;
  argument: string;
  strength: 'strong' | 'moderate' | 'weak';
  evidence: string[];
  rebuttalSuggestion: string;
}

export interface Contradiction {
  id: string;
  findingA: { id: string; title: string; content: string };
  findingB: { id: string; title: string; content: string };
  contradictionType: 'direct' | 'implicit' | 'temporal' | 'contextual';
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolution: string;
}

export interface StressTestResult {
  id: string;
  scenario: string;
  testedElement: string;
  passed: boolean;
  failureMode?: string;
  implications: string;
}

export interface Perspective {
  id: string;
  perspective: string;
  stakeholder: string;
  importance: number; // 0-1
  currentWeight: number; // 0-1
  suggestedWeight: number; // 0-1
  reasoning: string;
}

export interface DevilsAdvocateAssessment {
  mainThesis: string;
  opposingPosition: string;
  strongestCounterpoints: string[];
  weaknesses: string[];
  whatCouldGoWrong: string[];
  hiddenRisks: string[];
}

export interface VerificationVerdict {
  confidence: number; // Adjusted confidence after adversarial review
  recommendation: 'proceed' | 'proceed_with_caution' | 'reconsider' | 'reject';
  summary: string;
  requiredActions: string[];
  remainingRisks: string[];
}

export interface AdversarialContext {
  problem: SynthesizedProblem;
  findings: Finding[];
  recommendation?: StrategyRecommendation;
  fullStrategy?: StrategyOutput;
}

// =============================================================================
// PROMPTS
// =============================================================================

const ADVERSARIAL_SYSTEM_PROMPT = `You are an Adversarial Verification Agent - your job is to be the "red team" that stress-tests AI outputs.

You are NOT a supporter. You are the devil's advocate. Your job is to find problems.

YOUR MANDATE:
1. Challenge every conclusion
2. Generate counter-arguments for every recommendation
3. Find contradictions in the data
4. Stress test against failure scenarios
5. Identify underweighted perspectives
6. Surface hidden risks

BE GENUINELY ADVERSARIAL. Don't be lazy. Don't just rubber-stamp.

ADVERSARIAL FRAMEWORK:

1. COUNTER-ARGUMENTS
   For each major finding or recommendation:
   - What evidence contradicts this?
   - What would someone who disagrees say?
   - What's the strongest case against this?
   - Rate strength of counter-argument

2. CONTRADICTION DETECTION
   - Do any findings contradict each other?
   - Are there inconsistencies in the data?
   - Do timelines conflict?
   - Are there contextual contradictions?

3. STRESS TESTING
   Test recommendations against scenarios:
   - What if the economy changes?
   - What if key assumptions are wrong?
   - What if timing is off?
   - What if costs are 50% higher?
   - What if the market shifts?
   - What if personal circumstances change?

4. UNDERWEIGHTED PERSPECTIVES
   - Whose voice is missing?
   - What stakeholders were ignored?
   - What perspectives got short shrift?

5. DEVIL'S ADVOCATE
   Make the strongest possible case AGAINST the recommendation:
   - If you HAD to argue against it, what would you say?
   - What are the strongest counterpoints?
   - What could go wrong?
   - What are the hidden risks?

6. FINAL VERDICT
   After all analysis, render judgment:
   - Adjusted confidence (often LOWER than stated)
   - Proceed / Proceed with caution / Reconsider / Reject
   - Required actions before proceeding
   - Remaining risks that can't be mitigated

OUTPUT FORMAT:
\`\`\`json
{
  "status": "verified|concerns|failed",
  "robustnessScore": 0.65,
  "counterArguments": [
    {
      "id": "ca_1",
      "targetFindingId": "finding_123",
      "targetRecommendation": null,
      "argument": "The counter-argument",
      "strength": "strong|moderate|weak",
      "evidence": ["evidence point 1", "evidence point 2"],
      "rebuttalSuggestion": "How to address this counter-argument"
    }
  ],
  "contradictions": [
    {
      "id": "contra_1",
      "findingA": {"id": "f1", "title": "title", "content": "content"},
      "findingB": {"id": "f2", "title": "title", "content": "content"},
      "contradictionType": "direct|implicit|temporal|contextual",
      "severity": "critical|high|medium|low",
      "resolution": "How to resolve this contradiction"
    }
  ],
  "stressTests": [
    {
      "id": "st_1",
      "scenario": "Economic downturn",
      "testedElement": "Housing affordability recommendation",
      "passed": false,
      "failureMode": "Budget becomes unsustainable",
      "implications": "Need contingency plan"
    }
  ],
  "underweightedPerspectives": [
    {
      "id": "up_1",
      "perspective": "The perspective",
      "stakeholder": "Who holds this view",
      "importance": 0.8,
      "currentWeight": 0.2,
      "suggestedWeight": 0.6,
      "reasoning": "Why this matters more than it was weighted"
    }
  ],
  "devilsAdvocate": {
    "mainThesis": "The recommendation being challenged",
    "opposingPosition": "The strongest case against it",
    "strongestCounterpoints": ["point 1", "point 2"],
    "weaknesses": ["weakness in the original analysis"],
    "whatCouldGoWrong": ["failure mode 1", "failure mode 2"],
    "hiddenRisks": ["risk that wasn't mentioned"]
  },
  "verdict": {
    "confidence": 0.6,
    "recommendation": "proceed_with_caution",
    "summary": "Summary of the adversarial review",
    "requiredActions": ["action before proceeding"],
    "remainingRisks": ["risks that can't be fully mitigated"]
  }
}
\`\`\`

CRITICAL: Your job is to make the system SAFER by finding REAL issues. This is not an exercise in being difficult - it's about protecting the user from bad decisions.`;

// =============================================================================
// ADVERSARIAL VERIFIER CLASS
// =============================================================================

export class AdversarialVerifier {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private verificationHistory: AdversarialResult[] = [];
  private opusModel = CLAUDE_OPUS_46;
  private sonnetModel = CLAUDE_SONNET_45;

  constructor(client: Anthropic, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Run full adversarial verification on the strategy
   */
  async verify(context: AdversarialContext): Promise<AdversarialResult> {
    this.emitEvent('Starting adversarial verification - preparing counter-arguments...');

    const userPrompt = this.buildVerificationPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.opusModel, // Use Opus for thorough adversarial analysis
        max_tokens: 8192,
        temperature: 0.8, // Higher temperature for creative counter-arguments
        system: ADVERSARIAL_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      const result = this.parseVerificationResponse(textContent);

      // Store in history
      this.verificationHistory.push(result);

      // Emit summary
      this.emitEvent(
        `Adversarial verification complete: ${result.status}. ` +
          `Found ${result.counterArguments.length} counter-arguments, ` +
          `${result.contradictions.length} contradictions. ` +
          `Robustness score: ${(result.robustnessScore * 100).toFixed(0)}%`
      );

      log.info('Adversarial verification complete', {
        status: result.status,
        robustnessScore: result.robustnessScore,
        counterArguments: result.counterArguments.length,
        contradictions: result.contradictions.length,
        stressTests: result.stressTests.length,
        verdictRecommendation: result.verdict.recommendation,
      });

      return result;
    } catch (error) {
      log.error('Adversarial verification failed', { error });
      return this.createDefaultResult();
    }
  }

  /**
   * Quick verification of a single finding
   */
  async verifyFinding(
    finding: Finding,
    context: SynthesizedProblem
  ): Promise<{
    isValid: boolean;
    counterArguments: string[];
    adjustedConfidence: number;
  }> {
    const prompt = `Quickly verify this finding:

PROBLEM CONTEXT: ${context.coreQuestion}

FINDING:
Title: ${finding.title}
Content: ${finding.content}
Confidence: ${finding.confidence}
Sources: ${finding.sources.map((s) => s.title).join(', ')}

In 3-5 sentences:
1. Is this finding valid?
2. What's the strongest counter-argument?
3. Adjusted confidence (0-1)?

Format: VALID: [yes/no] | COUNTER: [counter-argument] | CONFIDENCE: [0-1]`;

    try {
      const response = await this.client.messages.create({
        model: this.sonnetModel, // Use Sonnet for quick checks
        max_tokens: 512,
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const validMatch = text.match(/VALID:\s*(yes|no)/i);
      const counterMatch = text.match(/COUNTER:\s*(.+?)(?:\||$)/i);
      const confMatch = text.match(/CONFIDENCE:\s*([\d.]+)/i);

      const isValid = validMatch?.[1]?.toLowerCase() === 'yes';
      const counter = counterMatch?.[1]?.trim();
      const confidence = confMatch ? parseFloat(confMatch[1]) : 0.5;

      return {
        isValid,
        counterArguments: counter && counter.toLowerCase() !== 'none' ? [counter] : [],
        adjustedConfidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      log.warn('Quick verification failed', { error });
      return { isValid: true, counterArguments: [], adjustedConfidence: 0.5 };
    }
  }

  /**
   * Detect contradictions between findings
   */
  async detectContradictions(findings: Finding[]): Promise<Contradiction[]> {
    if (findings.length < 2) return [];

    // Group findings for comparison (to avoid O(n²) with large datasets)
    const findingPairs: Array<[Finding, Finding]> = [];
    const maxPairs = 50; // Limit comparisons

    // Compare findings within same type or related topics
    for (let i = 0; i < findings.length && findingPairs.length < maxPairs; i++) {
      for (let j = i + 1; j < findings.length && findingPairs.length < maxPairs; j++) {
        // Only compare findings that might conflict (same topic area)
        const f1 = findings[i];
        const f2 = findings[j];
        const titleOverlap = this.hasWordOverlap(f1.title, f2.title);
        const contentOverlap = this.hasWordOverlap(
          f1.content.slice(0, 200),
          f2.content.slice(0, 200)
        );

        if (titleOverlap || contentOverlap) {
          findingPairs.push([f1, f2]);
        }
      }
    }

    if (findingPairs.length === 0) return [];

    const prompt = `Analyze these finding pairs for contradictions:

${findingPairs
  .map(
    ([a, b], i) => `PAIR ${i + 1}:
  A: "${a.title}" - ${a.content.slice(0, 150)}...
  B: "${b.title}" - ${b.content.slice(0, 150)}...`
  )
  .join('\n\n')}

For each pair, output: PAIR [number]: [CONTRADICTION/NO_CONTRADICTION] - [explanation if contradiction]`;

    try {
      const response = await this.client.messages.create({
        model: this.sonnetModel,
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const contradictions: Contradiction[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
        const match = line.match(/PAIR\s*(\d+):\s*CONTRADICTION\s*[-–—]\s*(.+)/i);
        if (match) {
          const pairIndex = parseInt(match[1]) - 1;
          if (pairIndex >= 0 && pairIndex < findingPairs.length) {
            const [findingA, findingB] = findingPairs[pairIndex];
            contradictions.push({
              id: `contra_${Date.now()}_${pairIndex}`,
              findingA: { id: findingA.id, title: findingA.title, content: findingA.content },
              findingB: { id: findingB.id, title: findingB.title, content: findingB.content },
              contradictionType: 'direct',
              severity: 'medium',
              resolution: match[2].trim(),
            });
          }
        }
      }

      return contradictions;
    } catch (error) {
      log.warn('Contradiction detection failed', { error });
      return [];
    }
  }

  /**
   * Get verification history
   */
  getHistory(): AdversarialResult[] {
    return [...this.verificationHistory];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private hasWordOverlap(text1: string, text2: string): boolean {
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
    );
    const words2 = text2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    let overlap = 0;
    for (const word of words2) {
      if (words1.has(word)) overlap++;
    }

    return overlap >= 2;
  }

  private buildVerificationPrompt(context: AdversarialContext): string {
    const sections: string[] = [];

    sections.push('## THE PROBLEM:');
    sections.push(JSON.stringify(context.problem, null, 2));

    if (context.recommendation) {
      sections.push('\n## THE RECOMMENDATION TO CHALLENGE:');
      sections.push(`Title: ${context.recommendation.title}`);
      sections.push(`Summary: ${context.recommendation.summary}`);
      sections.push(`Confidence: ${context.recommendation.confidence}%`);
      sections.push(`Reasoning: ${context.recommendation.reasoning.join('; ')}`);
      sections.push(`Tradeoffs: ${context.recommendation.tradeoffs.join('; ')}`);
    }

    sections.push('\n## FINDINGS TO SCRUTINIZE:');
    sections.push(`Total: ${context.findings.length} findings`);

    // Group by confidence for targeted scrutiny
    const highConf = context.findings.filter((f) => f.confidence === 'high');
    const medConf = context.findings.filter((f) => f.confidence === 'medium');
    const lowConf = context.findings.filter((f) => f.confidence === 'low');

    sections.push(`\n### High Confidence Findings (${highConf.length}) - CHALLENGE THESE:`);
    for (const f of highConf.slice(0, 10)) {
      sections.push(`- [${f.id}] ${f.title}: ${f.content.slice(0, 200)}`);
    }

    sections.push(`\n### Medium Confidence Findings (${medConf.length}):`);
    for (const f of medConf.slice(0, 5)) {
      sections.push(`- [${f.id}] ${f.title}: ${f.content.slice(0, 150)}`);
    }

    sections.push(`\n### Low Confidence Findings (${lowConf.length}):`);
    for (const f of lowConf.slice(0, 3)) {
      sections.push(`- [${f.id}] ${f.title}: ${f.content.slice(0, 100)}`);
    }

    sections.push('\n## YOUR TASK:');
    sections.push(
      "Be the devil's advocate. Generate counter-arguments. Find contradictions. " +
        'Stress test. Challenge assumptions. Make the strongest case AGAINST the recommendation. ' +
        'Output your analysis in the JSON format specified.'
    );

    return sections.join('\n');
  }

  private parseVerificationResponse(response: string): AdversarialResult {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      log.warn('Could not parse adversarial JSON, creating default');
      return this.createDefaultResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      return {
        status: (['verified', 'concerns', 'failed'].includes(parsed.status)
          ? parsed.status
          : 'concerns') as 'verified' | 'concerns' | 'failed',
        robustnessScore: Math.max(0, Math.min(1, Number(parsed.robustnessScore) || 0.5)),
        counterArguments: (parsed.counterArguments || []).map(
          (ca: Record<string, unknown>, i: number) => ({
            id: String(ca.id || `ca_${i}`),
            targetFindingId: ca.targetFindingId ? String(ca.targetFindingId) : undefined,
            targetRecommendation: ca.targetRecommendation
              ? String(ca.targetRecommendation)
              : undefined,
            argument: String(ca.argument || ''),
            strength: (['strong', 'moderate', 'weak'].includes(String(ca.strength))
              ? ca.strength
              : 'moderate') as 'strong' | 'moderate' | 'weak',
            evidence: Array.isArray(ca.evidence) ? ca.evidence.map(String) : [],
            rebuttalSuggestion: String(ca.rebuttalSuggestion || ''),
          })
        ),
        contradictions: (parsed.contradictions || []).map(
          (c: Record<string, unknown>, i: number) => ({
            id: String(c.id || `contra_${i}`),
            findingA: {
              id: String((c.findingA as Record<string, unknown>)?.id || ''),
              title: String((c.findingA as Record<string, unknown>)?.title || ''),
              content: String((c.findingA as Record<string, unknown>)?.content || ''),
            },
            findingB: {
              id: String((c.findingB as Record<string, unknown>)?.id || ''),
              title: String((c.findingB as Record<string, unknown>)?.title || ''),
              content: String((c.findingB as Record<string, unknown>)?.content || ''),
            },
            contradictionType: String(
              c.contradictionType || 'direct'
            ) as Contradiction['contradictionType'],
            severity: (['critical', 'high', 'medium', 'low'].includes(String(c.severity))
              ? c.severity
              : 'medium') as 'critical' | 'high' | 'medium' | 'low',
            resolution: String(c.resolution || ''),
          })
        ),
        stressTests: (parsed.stressTests || []).map((st: Record<string, unknown>, i: number) => ({
          id: String(st.id || `st_${i}`),
          scenario: String(st.scenario || ''),
          testedElement: String(st.testedElement || ''),
          passed: Boolean(st.passed),
          failureMode: st.failureMode ? String(st.failureMode) : undefined,
          implications: String(st.implications || ''),
        })),
        underweightedPerspectives: (parsed.underweightedPerspectives || []).map(
          (up: Record<string, unknown>, i: number) => ({
            id: String(up.id || `up_${i}`),
            perspective: String(up.perspective || ''),
            stakeholder: String(up.stakeholder || ''),
            importance: Math.max(0, Math.min(1, Number(up.importance) || 0.5)),
            currentWeight: Math.max(0, Math.min(1, Number(up.currentWeight) || 0.3)),
            suggestedWeight: Math.max(0, Math.min(1, Number(up.suggestedWeight) || 0.5)),
            reasoning: String(up.reasoning || ''),
          })
        ),
        devilsAdvocate: {
          mainThesis: String(parsed.devilsAdvocate?.mainThesis || ''),
          opposingPosition: String(parsed.devilsAdvocate?.opposingPosition || ''),
          strongestCounterpoints: Array.isArray(parsed.devilsAdvocate?.strongestCounterpoints)
            ? parsed.devilsAdvocate.strongestCounterpoints.map(String)
            : [],
          weaknesses: Array.isArray(parsed.devilsAdvocate?.weaknesses)
            ? parsed.devilsAdvocate.weaknesses.map(String)
            : [],
          whatCouldGoWrong: Array.isArray(parsed.devilsAdvocate?.whatCouldGoWrong)
            ? parsed.devilsAdvocate.whatCouldGoWrong.map(String)
            : [],
          hiddenRisks: Array.isArray(parsed.devilsAdvocate?.hiddenRisks)
            ? parsed.devilsAdvocate.hiddenRisks.map(String)
            : [],
        },
        verdict: {
          confidence: Math.max(0, Math.min(1, Number(parsed.verdict?.confidence) || 0.5)),
          recommendation: (['proceed', 'proceed_with_caution', 'reconsider', 'reject'].includes(
            String(parsed.verdict?.recommendation)
          )
            ? parsed.verdict.recommendation
            : 'proceed_with_caution') as VerificationVerdict['recommendation'],
          summary: String(parsed.verdict?.summary || ''),
          requiredActions: Array.isArray(parsed.verdict?.requiredActions)
            ? parsed.verdict.requiredActions.map(String)
            : [],
          remainingRisks: Array.isArray(parsed.verdict?.remainingRisks)
            ? parsed.verdict.remainingRisks.map(String)
            : [],
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      log.error('Failed to parse adversarial response', { error });
      return this.createDefaultResult();
    }
  }

  private createDefaultResult(): AdversarialResult {
    return {
      status: 'concerns',
      robustnessScore: 0.5,
      counterArguments: [],
      contradictions: [],
      stressTests: [],
      underweightedPerspectives: [],
      devilsAdvocate: {
        mainThesis: 'Unable to analyze',
        opposingPosition: 'Unable to generate',
        strongestCounterpoints: [],
        weaknesses: [],
        whatCouldGoWrong: ['Adversarial analysis could not be completed'],
        hiddenRisks: ['Risks may exist that were not identified'],
      },
      verdict: {
        confidence: 0.5,
        recommendation: 'proceed_with_caution',
        summary: 'Adversarial verification could not be fully completed. Proceed with caution.',
        requiredActions: ['Manual review recommended'],
        remainingRisks: ['Unverified risks may exist'],
      },
      timestamp: Date.now(),
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Adversarial] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAdversarialVerifier(
  client: Anthropic,
  onStream?: StrategyStreamCallback
): AdversarialVerifier {
  return new AdversarialVerifier(client, onStream);
}
