/**
 * QUALITY CONTROL MODULE
 *
 * Adversarial verification of research output.
 * Acts as a "devil's advocate" to challenge assumptions,
 * verify claims, and improve user questions.
 *
 * Key Features:
 * - Question refinement (users are often vague)
 * - Claim verification (cross-check key facts)
 * - Bias detection (identify one-sided sources)
 * - Completeness check (did we miss anything?)
 * - Confidence calibration (how sure are we?)
 *
 * Powered by Claude Sonnet 4.5.
 */

import { createClaudeStructuredOutput } from '@/lib/anthropic/client';
import { ResearchIntent, ResearchOutput, KeyFinding, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';

const log = logger('QualityControl');

// Types for QC results
export interface QuestionRefinement {
  originalQuestion: string;
  refinedQuestion: string;
  missingContext: string[];
  clarifyingQuestions: string[];
  implicitAssumptions: string[];
}

export interface ClaimVerification {
  claim: string;
  verificationStatus: 'verified' | 'unverified' | 'conflicting' | 'needs_more_research';
  supportingSources: string[];
  conflictingSources: string[];
  confidence: number;
  notes: string;
}

export interface BiasAnalysis {
  overallBias: 'balanced' | 'slightly_biased' | 'heavily_biased';
  biasDirection?: string;
  missingPerspectives: string[];
  recommendations: string[];
}

export interface QCReport {
  questionRefinement?: QuestionRefinement;
  verifiedClaims: ClaimVerification[];
  unverifiedClaims: string[];
  biasAnalysis: BiasAnalysis;
  completenessScore: number;
  overallConfidence: number;
  criticalIssues: string[];
  suggestions: string[];
}

export class QualityControl {
  /**
   * Refine a user's question to get better research results
   * Users often ask vague or poorly structured questions
   */
  async refineQuestion(
    originalQuestion: string,
    userContext?: string
  ): Promise<QuestionRefinement> {
    const prompt = `You are a research assistant helping to refine a user's question for better research results.

ORIGINAL QUESTION: "${originalQuestion}"
${userContext ? `USER CONTEXT: ${userContext}` : ''}

Analyze this question and output a JSON object:
{
  "originalQuestion": "${originalQuestion}",
  "refinedQuestion": "A clearer, more specific version of the question",
  "missingContext": ["List of context that would help answer the question"],
  "clarifyingQuestions": ["Questions to ask the user for clarity"],
  "implicitAssumptions": ["Assumptions the user seems to be making"]
}

REFINEMENT RULES:
1. Make the question more specific and actionable
2. Identify implicit assumptions the user might have
3. Suggest what additional context would help
4. Consider multiple interpretations of vague terms
5. Preserve the user's original intent

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          originalQuestion: { type: 'string' },
          refinedQuestion: { type: 'string' },
          missingContext: { type: 'array', items: { type: 'string' } },
          clarifyingQuestions: { type: 'array', items: { type: 'string' } },
          implicitAssumptions: { type: 'array', items: { type: 'string' } },
        },
        required: ['originalQuestion', 'refinedQuestion'],
      };

      const { data: parsed } = await createClaudeStructuredOutput<QuestionRefinement>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a research quality analyst. Respond with valid JSON only.',
        schema,
      });

      log.info('Question refinement complete', {
        original: originalQuestion.substring(0, 50),
        refined: parsed.refinedQuestion?.substring(0, 50),
      });

      return {
        originalQuestion,
        refinedQuestion: parsed.refinedQuestion || originalQuestion,
        missingContext: parsed.missingContext || [],
        clarifyingQuestions: parsed.clarifyingQuestions || [],
        implicitAssumptions: parsed.implicitAssumptions || [],
      };
    } catch (error) {
      log.error('Question refinement failed', { error: (error as Error).message });
      return {
        originalQuestion,
        refinedQuestion: originalQuestion,
        missingContext: [],
        clarifyingQuestions: [],
        implicitAssumptions: [],
      };
    }
  }

  /**
   * Verify key claims from research findings
   * Cross-check facts against sources
   */
  async verifyClaims(
    findings: KeyFinding[],
    results: SearchResult[]
  ): Promise<ClaimVerification[]> {
    const claims = findings.map((f) => f.finding);

    if (claims.length === 0) {
      return [];
    }

    const sourcesContent = results
      .map((r) => `[${r.source}${r.url ? ` - ${r.url}` : ''}]\n${r.content.substring(0, 500)}`)
      .join('\n\n---\n\n');

    const prompt = `You are a fact-checker verifying research claims against source materials.

CLAIMS TO VERIFY:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

SOURCE MATERIALS:
${sourcesContent.substring(0, 12000)}

For each claim, output a JSON array:
[
  {
    "claim": "The exact claim being verified",
    "verificationStatus": "verified" | "unverified" | "conflicting" | "needs_more_research",
    "supportingSources": ["Sources that support this claim"],
    "conflictingSources": ["Sources that contradict this claim"],
    "confidence": 0.0-1.0,
    "notes": "Explanation of verification result"
  }
]

VERIFICATION RULES:
1. "verified" - Multiple sources confirm, no contradictions
2. "unverified" - Cannot find supporting evidence in sources
3. "conflicting" - Sources disagree on this claim
4. "needs_more_research" - Partial support, needs more investigation
5. Be conservative - only mark verified if clearly supported

OUTPUT ONLY THE JSON ARRAY.`;

    try {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            claim: { type: 'string' },
            verificationStatus: {
              type: 'string',
              enum: ['verified', 'unverified', 'conflicting', 'needs_more_research'],
            },
            supportingSources: { type: 'array', items: { type: 'string' } },
            conflictingSources: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            notes: { type: 'string' },
          },
        },
      };

      const { data: parsed } = await createClaudeStructuredOutput<ClaimVerification[]>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a fact-checking specialist. Respond with valid JSON only.',
        schema,
      });

      log.info('Claim verification complete', {
        totalClaims: claims.length,
        verified: parsed.filter((c) => c.verificationStatus === 'verified').length,
      });

      return parsed.map((c) => ({
        claim: c.claim || '',
        verificationStatus: c.verificationStatus || 'unverified',
        supportingSources: c.supportingSources || [],
        conflictingSources: c.conflictingSources || [],
        confidence: c.confidence || 0.5,
        notes: c.notes || '',
      }));
    } catch (error) {
      log.error('Claim verification failed', { error: (error as Error).message });
      return claims.map((claim) => ({
        claim,
        verificationStatus: 'unverified' as const,
        supportingSources: [],
        conflictingSources: [],
        confidence: 0.5,
        notes: 'Verification failed due to error',
      }));
    }
  }

  /**
   * Analyze research output for bias
   */
  async analyzeBias(
    intent: ResearchIntent,
    results: SearchResult[],
    output: ResearchOutput
  ): Promise<BiasAnalysis> {
    const sourceDiversity = new Set(results.map((r) => r.source)).size;
    const urlDiversity = new Set(results.filter((r) => r.url).map((r) => new URL(r.url!).hostname))
      .size;

    const prompt = `You are a bias detection specialist analyzing research output.

RESEARCH TOPIC: "${intent.refinedQuery}"

FINDINGS SUMMARY:
${output.executiveSummary}

KEY FINDINGS:
${output.keyFindings.map((f) => `- ${f.finding}`).join('\n')}

SOURCE DIVERSITY:
- Number of search sources used: ${sourceDiversity}
- Number of unique domains: ${urlDiversity}

Analyze for bias and output a JSON object:
{
  "overallBias": "balanced" | "slightly_biased" | "heavily_biased",
  "biasDirection": "What direction the bias leans, if any",
  "missingPerspectives": ["Perspectives that should have been included"],
  "recommendations": ["How to get a more balanced view"]
}

BIAS INDICATORS:
1. All sources from same domain/outlet
2. Only positive OR negative perspectives
3. Missing counterarguments or alternative views
4. Overly certain language without caveats
5. Ignoring valid criticisms or concerns

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          overallBias: {
            type: 'string',
            enum: ['balanced', 'slightly_biased', 'heavily_biased'],
          },
          biasDirection: { type: 'string' },
          missingPerspectives: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
        },
        required: ['overallBias'],
      };

      const { data: parsed } = await createClaudeStructuredOutput<BiasAnalysis>({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a bias detection specialist. Respond with valid JSON only.',
        schema,
      });

      log.info('Bias analysis complete', { bias: parsed.overallBias });

      return {
        overallBias: parsed.overallBias || 'balanced',
        biasDirection: parsed.biasDirection,
        missingPerspectives: parsed.missingPerspectives || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      log.error('Bias analysis failed', { error: (error as Error).message });
      return {
        overallBias: 'balanced',
        missingPerspectives: [],
        recommendations: ['Unable to complete bias analysis'],
      };
    }
  }

  /**
   * Full quality control review of research output
   */
  async review(
    intent: ResearchIntent,
    results: SearchResult[],
    output: ResearchOutput
  ): Promise<QCReport> {
    log.info('Starting QC review', { topic: intent.refinedQuery.substring(0, 50) });

    try {
      // Run all QC checks in parallel
      const [claimVerifications, biasAnalysis] = await Promise.all([
        this.verifyClaims(output.keyFindings, results),
        this.analyzeBias(intent, results, output),
      ]);

      // Calculate completeness
      const topicsCovered = intent.topics.filter(
        (topic) =>
          output.executiveSummary.toLowerCase().includes(topic.toLowerCase()) ||
          output.keyFindings.some((f) => f.finding.toLowerCase().includes(topic.toLowerCase()))
      ).length;
      const completenessScore =
        intent.topics.length > 0 ? topicsCovered / intent.topics.length : 0.7;

      // Identify critical issues
      const criticalIssues: string[] = [];
      const unverifiedClaims: string[] = [];

      for (const v of claimVerifications) {
        if (v.verificationStatus === 'conflicting') {
          criticalIssues.push(`Conflicting information about: ${v.claim.substring(0, 50)}...`);
        }
        if (v.verificationStatus === 'unverified') {
          unverifiedClaims.push(v.claim);
        }
      }

      if (biasAnalysis.overallBias === 'heavily_biased') {
        criticalIssues.push('Research appears heavily biased toward one perspective');
      }

      if (completenessScore < 0.5) {
        criticalIssues.push('Many requested topics not adequately covered');
      }

      // Calculate overall confidence
      const verifiedCount = claimVerifications.filter(
        (c) => c.verificationStatus === 'verified'
      ).length;
      const verificationRate =
        claimVerifications.length > 0 ? verifiedCount / claimVerifications.length : 0.7;

      const overallConfidence =
        completenessScore * 0.3 +
        verificationRate * 0.4 +
        (biasAnalysis.overallBias === 'balanced'
          ? 0.3
          : biasAnalysis.overallBias === 'slightly_biased'
            ? 0.2
            : 0.1);

      // Generate suggestions
      const suggestions: string[] = [];

      if (unverifiedClaims.length > 0) {
        suggestions.push(
          `Consider verifying these claims with additional sources: ${unverifiedClaims[0]}`
        );
      }

      if (biasAnalysis.missingPerspectives.length > 0) {
        suggestions.push(`Missing perspective: ${biasAnalysis.missingPerspectives[0]}`);
      }

      if (output.gaps.length > 0) {
        suggestions.push(`Research gap identified: ${output.gaps[0]}`);
      }

      const report: QCReport = {
        verifiedClaims: claimVerifications,
        unverifiedClaims,
        biasAnalysis,
        completenessScore,
        overallConfidence,
        criticalIssues,
        suggestions,
      };

      log.info('QC review complete', {
        completeness: completenessScore.toFixed(2),
        confidence: overallConfidence.toFixed(2),
        criticalIssues: criticalIssues.length,
      });

      return report;
    } catch (error) {
      log.error('QC review failed', { error: (error as Error).message });
      return {
        verifiedClaims: [],
        unverifiedClaims: [],
        biasAnalysis: {
          overallBias: 'balanced',
          missingPerspectives: [],
          recommendations: [],
        },
        completenessScore: 0.5,
        overallConfidence: 0.5,
        criticalIssues: ['Quality control review could not be completed'],
        suggestions: [],
      };
    }
  }

  /**
   * Quick confidence calibration
   * Returns adjusted confidence based on QC checks
   */
  async calibrateConfidence(
    findings: KeyFinding[],
    results: SearchResult[]
  ): Promise<{
    originalConfidence: number;
    adjustedConfidence: number;
    adjustmentReason: string;
  }> {
    // Calculate original confidence from findings
    const originalConfidence =
      findings.reduce((sum, f) => {
        const conf = f.confidence === 'high' ? 0.9 : f.confidence === 'medium' ? 0.7 : 0.5;
        return sum + conf;
      }, 0) / (findings.length || 1);

    // Quick verification check
    const verifications = await this.verifyClaims(findings.slice(0, 3), results);
    const verifiedCount = verifications.filter((v) => v.verificationStatus === 'verified').length;
    const verificationRate = verifications.length > 0 ? verifiedCount / verifications.length : 0.5;

    // Adjust confidence
    const adjustedConfidence = originalConfidence * (0.5 + verificationRate * 0.5);
    const adjustmentReason =
      verificationRate > 0.7
        ? 'Claims verified against sources'
        : verificationRate > 0.4
          ? 'Some claims could not be fully verified'
          : 'Many claims lack source verification';

    return {
      originalConfidence,
      adjustedConfidence,
      adjustmentReason,
    };
  }
}

export const qualityControl = new QualityControl();
