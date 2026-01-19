/**
 * COGNITIVE REASONING ENGINE
 *
 * This is the "thinking" module - it reasons about code like a senior engineer.
 * Uses Claude Opus for deep, multi-step reasoning about:
 * - What could go wrong and why
 * - What the code is really doing (not just what it looks like)
 * - How different parts interact
 * - What assumptions are being made
 *
 * "The expert sees the code. The senior engineer sees the consequences."
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  CognitiveAnalysis,
  ReasoningChain,
  ReasoningStep,
  Hypothesis,
  Conclusion,
  Uncertainty,
  MentalModel,
  Recommendation,
  PredictedIssue,
  PatternMatch,
  MultiDimensionalReport,
  DebugLanguage,
} from './types';

const log = logger('CognitiveReasoningEngine');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// COGNITIVE REASONING ENGINE
// ============================================================================

export class CognitiveReasoningEngine {
  /**
   * Perform deep cognitive analysis
   */
  async analyze(context: {
    code: string;
    language: DebugLanguage;
    predictions?: PredictedIssue[];
    patterns?: PatternMatch[];
    multiDimensional?: MultiDimensionalReport;
    userIntent?: string;
  }): Promise<CognitiveAnalysis> {
    log.info('Starting cognitive reasoning', {
      language: context.language,
      hasIntent: !!context.userIntent,
      predictionCount: context.predictions?.length || 0,
    });

    // Use extended thinking for deep reasoning
    const reasoning = await this.performDeepReasoning(context);

    // Generate hypotheses about potential issues
    const hypotheses = await this.generateHypotheses(context, reasoning);

    // Draw conclusions
    const conclusions = this.drawConclusions(reasoning, hypotheses);

    // Identify uncertainties
    const uncertainties = this.identifyUncertainties(context, reasoning);

    // Build mental model
    const mentalModel = await this.buildMentalModel(context);

    // Generate recommendations
    const recommendations = this.generateRecommendations(conclusions, hypotheses, context);

    return {
      reasoning,
      hypotheses,
      conclusions,
      uncertainties,
      mentalModel,
      recommendations,
    };
  }

  /**
   * Perform deep reasoning with extended thinking
   */
  private async performDeepReasoning(context: {
    code: string;
    language: DebugLanguage;
    predictions?: PredictedIssue[];
    userIntent?: string;
  }): Promise<ReasoningChain> {
    const predictionSummary = context.predictions?.length
      ? `Known Issues:\n${context.predictions
          .slice(0, 5)
          .map((p) => `- Line ${p.location.line}: ${p.type} - ${p.description}`)
          .join('\n')}`
      : '';

    const prompt = `As a senior software engineer with 20+ years of experience, analyze this ${context.language} code deeply.

${context.userIntent ? `USER'S INTENT: ${context.userIntent}\n` : ''}

CODE:
\`\`\`${context.language}
${context.code}
\`\`\`

${predictionSummary}

Think step by step:

1. **First Impression**: What is this code trying to do? What patterns do you recognize?

2. **Data Flow Analysis**: How does data flow through this code? What transformations occur?

3. **Control Flow Analysis**: What are the possible execution paths? What conditions affect them?

4. **Assumption Identification**: What assumptions does this code make? Are they valid?

5. **Failure Mode Analysis**: What are ALL the ways this could fail? Consider:
   - Edge cases
   - Race conditions
   - Resource exhaustion
   - External dependencies
   - Type mismatches
   - Null/undefined values

6. **Root Cause Analysis**: If there's a bug, what's the REAL cause? Not the symptom, the cause.

7. **Ripple Effect Analysis**: If we change something, what else might break?

8. **Senior Engineer Intuition**: What would make you nervous about this code? What would you want to test?

Return your analysis as JSON:
{
  "steps": [{
    "observation": "what you noticed",
    "inference": "what it implies",
    "evidence": ["specific lines/patterns that support this"],
    "confidence": "certain" | "high" | "medium" | "low"
  }],
  "mainConclusion": "the most important insight",
  "alternativeInterpretations": ["other possible meanings/issues"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract the text response
      let analysisText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          analysisText += block.text;
        }
      }

      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createFallbackReasoning();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        steps: (parsed.steps || []).map((step: Record<string, unknown>) => ({
          observation: String(step.observation || ''),
          inference: String(step.inference || ''),
          evidence: Array.isArray(step.evidence) ? step.evidence.map(String) : [],
          confidence: (step.confidence as ReasoningStep['confidence']) || 'medium',
        })),
        confidence: this.calculateOverallConfidence(parsed.steps || []),
        alternativePaths: (parsed.alternativeInterpretations || []).map((alt: string) => ({
          steps: [
            {
              observation: alt,
              inference: 'Alternative interpretation',
              evidence: [],
              confidence: 'low' as const,
            },
          ],
          confidence: 'low' as const,
          alternativePaths: [],
        })),
      };
    } catch (error) {
      log.warn('Deep reasoning failed', { error });
      return this.createFallbackReasoning();
    }
  }

  /**
   * Generate hypotheses about potential issues
   */
  private async generateHypotheses(
    context: { code: string; language: DebugLanguage },
    reasoning: ReasoningChain
  ): Promise<Hypothesis[]> {
    const observations = reasoning.steps
      .map((s) => `- ${s.observation}: ${s.inference}`)
      .join('\n');

    const prompt = `Based on these observations about ${context.language} code, generate HYPOTHESES about potential issues.

OBSERVATIONS:
${observations}

CODE SNIPPET:
\`\`\`${context.language}
${context.code.slice(0, 1000)}
\`\`\`

For each hypothesis:
1. State it clearly
2. Estimate probability (0-1)
3. List supporting evidence
4. List contradicting evidence
5. Can it be tested? How?

Return JSON:
[{
  "statement": "hypothesis statement",
  "probability": 0.0-1.0,
  "supportingEvidence": ["evidence 1", "evidence 2"],
  "contradictingEvidence": ["counter evidence"],
  "testable": boolean,
  "testStrategy": "how to verify"
}]

Generate 3-5 meaningful hypotheses.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((h: Record<string, unknown>) => ({
        statement: String(h.statement || ''),
        probability: Number(h.probability) || 0.5,
        supportingEvidence: Array.isArray(h.supportingEvidence)
          ? h.supportingEvidence.map(String)
          : [],
        contradictingEvidence: Array.isArray(h.contradictingEvidence)
          ? h.contradictingEvidence.map(String)
          : [],
        testable: Boolean(h.testable),
        testStrategy: h.testStrategy ? String(h.testStrategy) : undefined,
      }));
    } catch (error) {
      log.warn('Hypothesis generation failed', { error });
      return [];
    }
  }

  /**
   * Draw conclusions from reasoning and hypotheses
   */
  private drawConclusions(reasoning: ReasoningChain, hypotheses: Hypothesis[]): Conclusion[] {
    const conclusions: Conclusion[] = [];

    // High confidence reasoning steps become conclusions
    for (const step of reasoning.steps.filter(
      (s) => s.confidence === 'certain' || s.confidence === 'high'
    )) {
      conclusions.push({
        statement: step.inference,
        confidence: step.confidence,
        basis: [step.observation, ...step.evidence],
        implications: [],
      });
    }

    // High probability hypotheses become conclusions
    for (const hypothesis of hypotheses.filter((h) => h.probability >= 0.7)) {
      conclusions.push({
        statement: hypothesis.statement,
        confidence: hypothesis.probability >= 0.9 ? 'certain' : 'high',
        basis: hypothesis.supportingEvidence,
        implications: hypothesis.testStrategy ? [hypothesis.testStrategy] : [],
      });
    }

    return conclusions;
  }

  /**
   * Identify areas of uncertainty
   */
  private identifyUncertainties(
    context: { code: string; userIntent?: string },
    reasoning: ReasoningChain
  ): Uncertainty[] {
    const uncertainties: Uncertainty[] = [];

    // Low confidence reasoning steps indicate uncertainty
    for (const step of reasoning.steps.filter((s) => s.confidence === 'low')) {
      uncertainties.push({
        aspect: step.observation,
        unknowns: [step.inference],
        impact: 'minor',
        resolutionStrategy: 'Investigate further or add tests',
      });
    }

    // Missing intent creates uncertainty
    if (!context.userIntent) {
      uncertainties.push({
        aspect: 'User intent',
        unknowns: ['What is the code supposed to achieve?', 'What behavior is expected?'],
        impact: 'significant',
        resolutionStrategy: 'Clarify requirements with user',
      });
    }

    // External dependencies create uncertainty
    const hasExternalCalls = /fetch|axios|http|database|fs\.|require/.test(context.code);
    if (hasExternalCalls) {
      uncertainties.push({
        aspect: 'External dependencies',
        unknowns: ['Will external services be available?', 'What happens on timeout?'],
        impact: 'significant',
        resolutionStrategy: 'Add error handling and fallbacks',
      });
    }

    return uncertainties;
  }

  /**
   * Build a mental model of the code
   */
  private async buildMentalModel(context: {
    code: string;
    language: DebugLanguage;
  }): Promise<MentalModel> {
    const prompt = `Build a MENTAL MODEL of this ${context.language} code.

\`\`\`${context.language}
${context.code}
\`\`\`

Identify:
1. Main COMPONENTS (functions, classes, modules)
2. RELATIONSHIPS between components
3. INVARIANTS (things that must always be true)
4. ASSUMPTIONS (things the code assumes)

Return JSON:
{
  "components": [{
    "name": "component name",
    "type": "function" | "class" | "module" | "variable",
    "responsibilities": ["what it does"],
    "constraints": ["limitations"]
  }],
  "relationships": [{
    "from": "component A",
    "to": "component B",
    "type": "depends_on" | "uses" | "owns" | "creates" | "transforms" | "validates",
    "cardinality": "1:1" | "1:n" | "n:1" | "n:n"
  }],
  "invariants": ["things that must be true"],
  "assumptions": ["implicit assumptions"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyMentalModel();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        components: (parsed.components || []).map((c: Record<string, unknown>) => ({
          name: String(c.name || ''),
          type: String(c.type || 'function'),
          responsibilities: Array.isArray(c.responsibilities) ? c.responsibilities.map(String) : [],
          constraints: Array.isArray(c.constraints) ? c.constraints.map(String) : [],
        })),
        relationships: (parsed.relationships || []).map((r: Record<string, unknown>) => ({
          from: String(r.from || ''),
          to: String(r.to || ''),
          type:
            (r.type as 'depends_on' | 'uses' | 'owns' | 'creates' | 'transforms' | 'validates') ||
            'uses',
          cardinality: (r.cardinality as '1:1' | '1:n' | 'n:1' | 'n:n') || '1:1',
        })),
        invariants: Array.isArray(parsed.invariants) ? parsed.invariants.map(String) : [],
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
      };
    } catch (error) {
      log.warn('Mental model building failed', { error });
      return this.emptyMentalModel();
    }
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    conclusions: Conclusion[],
    hypotheses: Hypothesis[],
    context: {
      predictions?: PredictedIssue[];
      patterns?: PatternMatch[];
      multiDimensional?: MultiDimensionalReport;
    }
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let idCounter = 1;

    // From conclusions
    for (const conclusion of conclusions.filter(
      (c) => c.confidence === 'certain' || c.confidence === 'high'
    )) {
      if (conclusion.implications.length > 0) {
        recommendations.push({
          id: `rec_conclusion_${idCounter++}`,
          title: 'Action Required',
          description: conclusion.statement,
          rationale: `Based on ${conclusion.basis.length} observations`,
          priority: conclusion.confidence === 'certain' ? 'high' : 'medium',
          type: 'fix',
          action: conclusion.implications[0],
        });
      }
    }

    // From high-probability hypotheses
    for (const hypothesis of hypotheses.filter((h) => h.probability >= 0.6 && h.testable)) {
      recommendations.push({
        id: `rec_hypothesis_${idCounter++}`,
        title: 'Verify Hypothesis',
        description: hypothesis.statement,
        rationale: `${Math.round(hypothesis.probability * 100)}% probability`,
        priority: hypothesis.probability >= 0.8 ? 'high' : 'medium',
        type: 'test',
        action: hypothesis.testStrategy || 'Add test to verify',
      });
    }

    // From predictions
    for (const prediction of (context.predictions || []).filter(
      (p) => p.severity === 'critical' || p.severity === 'high'
    )) {
      recommendations.push({
        id: `rec_prediction_${idCounter++}`,
        title: `Fix ${prediction.type}`,
        description: prediction.description,
        rationale: `${Math.round(prediction.probability * 100)}% probability, ${prediction.severity} severity`,
        priority: prediction.severity === 'critical' ? 'critical' : 'high',
        type: 'fix',
        action: prediction.suggestedFix || prediction.preventionStrategy,
      });
    }

    // From multi-dimensional report
    if (context.multiDimensional) {
      // Security
      for (const vuln of (context.multiDimensional.security.vulnerabilities || []).slice(0, 3)) {
        recommendations.push({
          id: `rec_security_${idCounter++}`,
          title: `Security: ${vuln.type}`,
          description: vuln.description,
          rationale: `${vuln.severity} severity, ${vuln.exploitability} to exploit`,
          priority: 'critical',
          type: 'fix',
          action: vuln.fix,
        });
      }

      // Performance
      for (const bottleneck of (context.multiDimensional.performance.bottlenecks || []).filter(
        (b) => b.impact === 'blocking'
      )) {
        recommendations.push({
          id: `rec_performance_${idCounter++}`,
          title: `Performance: ${bottleneck.type}`,
          description: bottleneck.description,
          rationale: 'Blocking performance issue',
          priority: 'high',
          type: 'improvement',
          action: bottleneck.optimization,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private calculateOverallConfidence(
    steps: Array<{ confidence?: string }>
  ): 'certain' | 'high' | 'medium' | 'low' | 'speculative' {
    if (steps.length === 0) return 'low';

    const confidenceValues: Record<string, number> = {
      certain: 4,
      high: 3,
      medium: 2,
      low: 1,
      speculative: 0,
    };

    const avg =
      steps.reduce((sum, s) => sum + (confidenceValues[s.confidence || 'medium'] || 2), 0) /
      steps.length;

    if (avg >= 3.5) return 'certain';
    if (avg >= 2.5) return 'high';
    if (avg >= 1.5) return 'medium';
    if (avg >= 0.5) return 'low';
    return 'speculative';
  }

  private createFallbackReasoning(): ReasoningChain {
    return {
      steps: [
        {
          observation: 'Code analysis performed',
          inference: 'Unable to complete deep reasoning',
          evidence: [],
          confidence: 'low',
        },
      ],
      confidence: 'low',
      alternativePaths: [],
    };
  }

  private emptyMentalModel(): MentalModel {
    return {
      components: [],
      relationships: [],
      invariants: [],
      assumptions: [],
    };
  }

  /**
   * Explain why something might fail
   */
  async explainPotentialFailure(
    code: string,
    language: DebugLanguage,
    scenario: string
  ): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Explain why this ${language} code might fail in the following scenario:

SCENARIO: ${scenario}

CODE:
\`\`\`${language}
${code}
\`\`\`

Explain:
1. The root cause of potential failure
2. The exact sequence of events leading to failure
3. Why the current code doesn't handle this
4. How to prevent it

Be specific and reference actual code.`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
