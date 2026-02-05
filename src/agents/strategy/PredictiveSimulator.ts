/**
 * PREDICTIVE SIMULATION / WHAT-IF ENGINE
 *
 * Enables scenario modeling and predictive analysis.
 * Allows users to explore "what if" questions and see potential outcomes.
 *
 * Key capabilities:
 * - Scenario generation
 * - Monte Carlo simulation
 * - Decision tree analysis
 * - Sensitivity analysis
 * - Outcome probability estimation
 * - Timeline projection
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Finding,
  StrategyStreamCallback,
  SynthesizedProblem,
  StrategyRecommendation,
} from './types';
import { CLAUDE_OPUS_46, CLAUDE_SONNET_45 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('PredictiveSimulator');

// =============================================================================
// TYPES
// =============================================================================

export interface Scenario {
  id: string;
  name: string;
  description: string;
  type: 'optimistic' | 'pessimistic' | 'most_likely' | 'custom';
  assumptions: string[];
  variables: ScenarioVariable[];
  probability: number; // Estimated probability of this scenario
  timeline: TimelineEvent[];
  outcomes: Outcome[];
  risks: ScenarioRisk[];
  opportunities: string[];
}

export interface ScenarioVariable {
  name: string;
  baseValue: string | number;
  scenarioValue: string | number;
  unit?: string;
  sensitivity: 'high' | 'medium' | 'low'; // How much this affects outcomes
  confidence: number;
}

export interface TimelineEvent {
  date: string; // Relative or absolute
  event: string;
  probability: number;
  dependencies: string[];
  impact: 'positive' | 'negative' | 'neutral';
}

export interface Outcome {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  quantitativeEstimate?: {
    value: number;
    unit: string;
    range: { min: number; max: number };
  };
  qualitativeDescription: string;
}

export interface ScenarioRisk {
  risk: string;
  probability: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface WhatIfQuery {
  question: string;
  variables: Array<{
    name: string;
    currentValue: string | number;
    hypotheticalValue: string | number;
  }>;
  context?: string;
}

export interface WhatIfResult {
  query: WhatIfQuery;
  analysis: string;
  primaryEffect: string;
  secondaryEffects: string[];
  probability: number;
  confidence: number;
  assumptions: string[];
  caveats: string[];
  recommendations: string[];
}

export interface SensitivityAnalysis {
  variable: string;
  baseValue: number;
  testRange: { min: number; max: number };
  sensitivityScore: number; // 0-1, how much this variable affects outcomes
  breakpoints: Array<{
    value: number;
    event: string;
    significance: 'critical' | 'important' | 'minor';
  }>;
  recommendations: string[];
}

export interface DecisionTree {
  id: string;
  rootNode: DecisionNode;
  expectedValue?: number;
  bestPath: string[];
  worstPath: string[];
}

export interface DecisionNode {
  id: string;
  type: 'decision' | 'chance' | 'outcome';
  label: string;
  probability?: number; // For chance nodes
  value?: number; // For outcome nodes
  children: DecisionNode[];
}

export interface SimulationResult {
  scenarios: Scenario[];
  whatIfResults: WhatIfResult[];
  sensitivityAnalyses: SensitivityAnalysis[];
  decisionTree?: DecisionTree;
  keyInsights: string[];
  recommendations: string[];
  timestamp: number;
}

// =============================================================================
// PROMPTS
// =============================================================================

const SIMULATION_SYSTEM_PROMPT = `You are a Predictive Simulation Engine - an AI specialized in scenario modeling and what-if analysis.

YOUR CAPABILITIES:

1. SCENARIO GENERATION
   Create multiple scenarios:
   - Optimistic: Things go better than expected
   - Pessimistic: Things go worse than expected
   - Most Likely: The probable outcome
   - Custom: Based on specific variable changes

2. WHAT-IF ANALYSIS
   Answer "what if" questions:
   - Identify primary effects
   - Trace secondary/ripple effects
   - Estimate probabilities
   - Note assumptions and caveats

3. SENSITIVITY ANALYSIS
   Identify which variables matter most:
   - Test variable ranges
   - Find breakpoints
   - Determine sensitivity scores

4. TIMELINE PROJECTION
   Map out events over time:
   - Sequence of events
   - Dependencies
   - Probability at each stage

5. OUTCOME ESTIMATION
   Predict results:
   - Quantitative where possible
   - Qualitative descriptions
   - Confidence intervals

METHODOLOGY:
- Be explicit about assumptions
- Provide probability ranges, not single points
- Consider second-order effects
- Acknowledge uncertainty
- Base predictions on evidence when available
- Use structured reasoning

OUTPUT FORMAT:
\`\`\`json
{
  "scenarios": [
    {
      "id": "scenario_1",
      "name": "Scenario name",
      "description": "Description",
      "type": "optimistic|pessimistic|most_likely|custom",
      "assumptions": ["assumption 1"],
      "variables": [
        {
          "name": "Variable",
          "baseValue": "current",
          "scenarioValue": "changed",
          "unit": "optional",
          "sensitivity": "high|medium|low",
          "confidence": 0.7
        }
      ],
      "probability": 0.3,
      "timeline": [
        {
          "date": "Month 1",
          "event": "What happens",
          "probability": 0.8,
          "dependencies": [],
          "impact": "positive|negative|neutral"
        }
      ],
      "outcomes": [
        {
          "id": "outcome_1",
          "name": "Outcome name",
          "description": "Description",
          "probability": 0.7,
          "impact": "positive",
          "quantitativeEstimate": {
            "value": 50000,
            "unit": "USD",
            "range": {"min": 40000, "max": 60000}
          },
          "qualitativeDescription": "Description"
        }
      ],
      "risks": [
        {
          "risk": "Risk description",
          "probability": 0.3,
          "impact": "high",
          "mitigation": "How to handle"
        }
      ],
      "opportunities": ["Opportunity 1"]
    }
  ],
  "whatIfResults": [],
  "sensitivityAnalyses": [],
  "keyInsights": ["Insight 1"],
  "recommendations": ["Recommendation 1"]
}
\`\`\``;

// =============================================================================
// PREDICTIVE SIMULATOR CLASS
// =============================================================================

export class PredictiveSimulator {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private simulationHistory: SimulationResult[] = [];

  constructor(client: Anthropic, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Generate comprehensive scenario analysis
   */
  async generateScenarios(
    problem: SynthesizedProblem,
    recommendation: StrategyRecommendation,
    findings: Finding[]
  ): Promise<SimulationResult> {
    this.emitEvent('Generating predictive scenarios...');

    const prompt = this.buildScenarioPrompt(problem, recommendation, findings);

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_OPUS_46,
        max_tokens: 8192,
        temperature: 0.7,
        system: SIMULATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const result = this.parseSimulationResponse(text);

      this.simulationHistory.push(result);

      this.emitEvent(`Scenario analysis complete: ${result.scenarios.length} scenarios generated`);

      log.info('Scenario generation complete', {
        scenarios: result.scenarios.length,
        insights: result.keyInsights.length,
      });

      return result;
    } catch (error) {
      log.error('Scenario generation failed', { error });
      return this.createDefaultResult();
    }
  }

  /**
   * Answer a specific what-if question
   */
  async whatIf(query: WhatIfQuery, context: SynthesizedProblem): Promise<WhatIfResult> {
    this.emitEvent(`Analyzing: ${query.question.slice(0, 50)}...`);

    const prompt = `Answer this what-if question:

QUESTION: ${query.question}

VARIABLE CHANGES:
${query.variables.map((v) => `- ${v.name}: ${v.currentValue} → ${v.hypotheticalValue}`).join('\n')}

${query.context ? `ADDITIONAL CONTEXT: ${query.context}` : ''}

PROBLEM CONTEXT:
${context.summary}

Analyze:
1. Primary effect of this change
2. Secondary/ripple effects
3. Probability of each effect
4. Key assumptions
5. Caveats and limitations
6. Recommendations

Output in JSON format.`;

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return this.createDefaultWhatIfResult(query);
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        query,
        analysis: String(parsed.analysis || ''),
        primaryEffect: String(parsed.primaryEffect || ''),
        secondaryEffects: Array.isArray(parsed.secondaryEffects)
          ? parsed.secondaryEffects.map(String)
          : [],
        probability: Math.max(0, Math.min(1, Number(parsed.probability) || 0.5)),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
        caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String) : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String)
          : [],
      };
    } catch (error) {
      log.error('What-if analysis failed', { error });
      return this.createDefaultWhatIfResult(query);
    }
  }

  /**
   * Run sensitivity analysis on key variables
   */
  async analyzeSensitivity(
    variables: Array<{ name: string; baseValue: number; testRange: { min: number; max: number } }>,
    outcomeDescription: string,
    context: SynthesizedProblem
  ): Promise<SensitivityAnalysis[]> {
    this.emitEvent(`Running sensitivity analysis on ${variables.length} variables...`);

    const results: SensitivityAnalysis[] = [];

    for (const variable of variables) {
      const prompt = `Analyze how changes in "${variable.name}" affect the outcome.

VARIABLE: ${variable.name}
BASE VALUE: ${variable.baseValue}
TEST RANGE: ${variable.testRange.min} to ${variable.testRange.max}

OUTCOME TO ANALYZE: ${outcomeDescription}

CONTEXT: ${context.summary}

Determine:
1. Sensitivity score (0-1): How much does this variable affect the outcome?
2. Breakpoints: At what values do significant changes occur?
3. Recommendations for managing this variable

Output in JSON format.`;

      try {
        const response = await this.client.messages.create({
          model: CLAUDE_SONNET_45,
          max_tokens: 2048,
          temperature: 0.5,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('');

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          results.push({
            variable: variable.name,
            baseValue: variable.baseValue,
            testRange: variable.testRange,
            sensitivityScore: Math.max(0, Math.min(1, Number(parsed.sensitivityScore) || 0.5)),
            breakpoints: Array.isArray(parsed.breakpoints)
              ? parsed.breakpoints.map((bp: Record<string, unknown>) => ({
                  value: Number(bp.value) || 0,
                  event: String(bp.event || ''),
                  significance: (['critical', 'important', 'minor'].includes(
                    String(bp.significance)
                  )
                    ? bp.significance
                    : 'minor') as 'critical' | 'important' | 'minor',
                }))
              : [],
            recommendations: Array.isArray(parsed.recommendations)
              ? parsed.recommendations.map(String)
              : [],
          });
        }
      } catch (error) {
        log.warn('Sensitivity analysis failed for variable', { variable: variable.name, error });
      }
    }

    // Sort by sensitivity score
    results.sort((a, b) => b.sensitivityScore - a.sensitivityScore);

    return results;
  }

  /**
   * Build a decision tree for a complex decision
   */
  async buildDecisionTree(
    decision: string,
    options: string[],
    uncertainties: string[],
    context: SynthesizedProblem
  ): Promise<DecisionTree> {
    this.emitEvent('Building decision tree...');

    const prompt = `Build a decision tree for this decision:

DECISION: ${decision}

OPTIONS:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

UNCERTAINTIES (chance events):
${uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n')}

CONTEXT: ${context.summary}

Create a decision tree with:
- Decision nodes (choices you make)
- Chance nodes (uncertain events with probabilities)
- Outcome nodes (final results with values)

Identify:
- Best path (highest expected value)
- Worst path (lowest expected value)
- Overall expected value

Output in JSON format.`;

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return this.createDefaultDecisionTree(decision);
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        id: `tree_${Date.now()}`,
        rootNode: this.parseDecisionNode(parsed.rootNode || {}),
        expectedValue: parsed.expectedValue ? Number(parsed.expectedValue) : undefined,
        bestPath: Array.isArray(parsed.bestPath) ? parsed.bestPath.map(String) : [],
        worstPath: Array.isArray(parsed.worstPath) ? parsed.worstPath.map(String) : [],
      };
    } catch (error) {
      log.error('Decision tree generation failed', { error });
      return this.createDefaultDecisionTree(decision);
    }
  }

  /**
   * Run Monte Carlo simulation
   */
  async runMonteCarlo(
    variables: Array<{
      name: string;
      distribution: 'normal' | 'uniform' | 'triangular';
      params: { mean?: number; stdDev?: number; min?: number; max?: number; mode?: number };
    }>,
    iterations: number,
    outcomeFormula: string
  ): Promise<{
    mean: number;
    median: number;
    stdDev: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
    histogram: Array<{ bin: number; count: number }>;
  }> {
    this.emitEvent(`Running Monte Carlo simulation (${iterations} iterations)...`);

    // Generate samples
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const varValues: Record<string, number> = {};

      for (const v of variables) {
        varValues[v.name] = this.sampleDistribution(v.distribution, v.params);
      }

      // Evaluate outcome (simplified - in practice, you'd want a proper formula parser)
      // For now, use AI to estimate
      samples.push(this.evaluateOutcome(varValues, outcomeFormula));
    }

    // Calculate statistics
    samples.sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const median = samples[Math.floor(samples.length / 2)];
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    const percentiles = {
      p5: samples[Math.floor(samples.length * 0.05)],
      p25: samples[Math.floor(samples.length * 0.25)],
      p50: samples[Math.floor(samples.length * 0.5)],
      p75: samples[Math.floor(samples.length * 0.75)],
      p95: samples[Math.floor(samples.length * 0.95)],
    };

    // Create histogram
    const min = samples[0];
    const max = samples[samples.length - 1];
    const binCount = 20;
    const binSize = (max - min) / binCount;
    const histogram: Array<{ bin: number; count: number }> = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      const count = samples.filter((s) => s >= binStart && s < binEnd).length;
      histogram.push({ bin: binStart + binSize / 2, count });
    }

    return { mean, median, stdDev, percentiles, histogram };
  }

  /**
   * Get simulation history
   */
  getHistory(): SimulationResult[] {
    return [...this.simulationHistory];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildScenarioPrompt(
    problem: SynthesizedProblem,
    recommendation: StrategyRecommendation,
    findings: Finding[]
  ): string {
    const sections: string[] = [];

    sections.push('## THE DECISION:');
    sections.push(`Core Question: ${problem.coreQuestion}`);
    sections.push(`Recommendation: ${recommendation.title}`);
    sections.push(`Summary: ${recommendation.summary}`);
    sections.push(`Confidence: ${recommendation.confidence}%`);

    sections.push('\n## CONSTRAINTS:');
    sections.push(problem.constraints.join('\n'));

    sections.push('\n## KEY FINDINGS:');
    for (const f of findings.slice(0, 20)) {
      sections.push(`- ${f.title}: ${f.content.slice(0, 150)}`);
    }

    sections.push('\n## YOUR TASK:');
    sections.push(
      'Generate comprehensive scenario analysis:\n' +
        '1. Optimistic scenario (things go better than expected)\n' +
        '2. Pessimistic scenario (things go worse than expected)\n' +
        '3. Most likely scenario (probable outcome)\n' +
        'For each, provide variables, timeline, outcomes, risks, and opportunities.'
    );

    return sections.join('\n');
  }

  private parseSimulationResponse(response: string): SimulationResult {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      log.warn('Could not parse simulation JSON');
      return this.createDefaultResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      const scenarios: Scenario[] = (parsed.scenarios || []).map(
        (s: Record<string, unknown>, i: number) => ({
          id: String(s.id || `scenario_${i}`),
          name: String(s.name || ''),
          description: String(s.description || ''),
          type: (['optimistic', 'pessimistic', 'most_likely', 'custom'].includes(String(s.type))
            ? s.type
            : 'custom') as Scenario['type'],
          assumptions: Array.isArray(s.assumptions) ? s.assumptions.map(String) : [],
          variables: Array.isArray(s.variables)
            ? s.variables.map((v: Record<string, unknown>) => ({
                name: String(v.name || ''),
                baseValue: v.baseValue ?? '',
                scenarioValue: v.scenarioValue ?? '',
                unit: v.unit ? String(v.unit) : undefined,
                sensitivity: (['high', 'medium', 'low'].includes(String(v.sensitivity))
                  ? v.sensitivity
                  : 'medium') as ScenarioVariable['sensitivity'],
                confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0.5)),
              }))
            : [],
          probability: Math.max(0, Math.min(1, Number(s.probability) || 0.33)),
          timeline: Array.isArray(s.timeline)
            ? s.timeline.map((t: Record<string, unknown>) => ({
                date: String(t.date || ''),
                event: String(t.event || ''),
                probability: Math.max(0, Math.min(1, Number(t.probability) || 0.5)),
                dependencies: Array.isArray(t.dependencies) ? t.dependencies.map(String) : [],
                impact: (['positive', 'negative', 'neutral'].includes(String(t.impact))
                  ? t.impact
                  : 'neutral') as TimelineEvent['impact'],
              }))
            : [],
          outcomes: Array.isArray(s.outcomes)
            ? s.outcomes.map((o: Record<string, unknown>, j: number) => ({
                id: String(o.id || `outcome_${j}`),
                name: String(o.name || ''),
                description: String(o.description || ''),
                probability: Math.max(0, Math.min(1, Number(o.probability) || 0.5)),
                impact: ([
                  'very_positive',
                  'positive',
                  'neutral',
                  'negative',
                  'very_negative',
                ].includes(String(o.impact))
                  ? o.impact
                  : 'neutral') as Outcome['impact'],
                quantitativeEstimate: o.quantitativeEstimate
                  ? {
                      value: Number((o.quantitativeEstimate as Record<string, unknown>).value) || 0,
                      unit: String((o.quantitativeEstimate as Record<string, unknown>).unit || ''),
                      range: {
                        min:
                          Number(
                            (
                              (o.quantitativeEstimate as Record<string, unknown>).range as Record<
                                string,
                                unknown
                              >
                            )?.min
                          ) || 0,
                        max:
                          Number(
                            (
                              (o.quantitativeEstimate as Record<string, unknown>).range as Record<
                                string,
                                unknown
                              >
                            )?.max
                          ) || 0,
                      },
                    }
                  : undefined,
                qualitativeDescription: String(o.qualitativeDescription || ''),
              }))
            : [],
          risks: Array.isArray(s.risks)
            ? s.risks.map((r: Record<string, unknown>) => ({
                risk: String(r.risk || ''),
                probability: Math.max(0, Math.min(1, Number(r.probability) || 0.3)),
                impact: (['critical', 'high', 'medium', 'low'].includes(String(r.impact))
                  ? r.impact
                  : 'medium') as ScenarioRisk['impact'],
                mitigation: r.mitigation ? String(r.mitigation) : undefined,
              }))
            : [],
          opportunities: Array.isArray(s.opportunities) ? s.opportunities.map(String) : [],
        })
      );

      return {
        scenarios,
        whatIfResults: [],
        sensitivityAnalyses: [],
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String)
          : [],
        timestamp: Date.now(),
      };
    } catch (error) {
      log.error('Failed to parse simulation response', { error });
      return this.createDefaultResult();
    }
  }

  private createDefaultResult(): SimulationResult {
    return {
      scenarios: [],
      whatIfResults: [],
      sensitivityAnalyses: [],
      keyInsights: ['Simulation could not be completed'],
      recommendations: [],
      timestamp: Date.now(),
    };
  }

  private createDefaultWhatIfResult(query: WhatIfQuery): WhatIfResult {
    return {
      query,
      analysis: 'Analysis could not be completed',
      primaryEffect: 'Unknown',
      secondaryEffects: [],
      probability: 0.5,
      confidence: 0.3,
      assumptions: [],
      caveats: ['Analysis incomplete'],
      recommendations: [],
    };
  }

  private createDefaultDecisionTree(decision: string): DecisionTree {
    return {
      id: `tree_${Date.now()}`,
      rootNode: {
        id: 'root',
        type: 'decision',
        label: decision,
        children: [],
      },
      bestPath: [],
      worstPath: [],
    };
  }

  private parseDecisionNode(node: Record<string, unknown>): DecisionNode {
    return {
      id: String(node.id || `node_${Date.now()}`),
      type: (['decision', 'chance', 'outcome'].includes(String(node.type))
        ? node.type
        : 'decision') as DecisionNode['type'],
      label: String(node.label || ''),
      probability: node.probability ? Number(node.probability) : undefined,
      value: node.value ? Number(node.value) : undefined,
      children: Array.isArray(node.children)
        ? node.children.map((c: Record<string, unknown>) => this.parseDecisionNode(c))
        : [],
    };
  }

  private sampleDistribution(
    distribution: 'normal' | 'uniform' | 'triangular',
    params: { mean?: number; stdDev?: number; min?: number; max?: number; mode?: number }
  ): number {
    switch (distribution) {
      case 'normal': {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return (params.mean || 0) + z * (params.stdDev || 1);
      }
      case 'uniform':
        return (params.min || 0) + Math.random() * ((params.max || 1) - (params.min || 0));
      case 'triangular': {
        const min = params.min || 0;
        const max = params.max || 1;
        const mode = params.mode || (min + max) / 2;
        const u = Math.random();
        const fc = (mode - min) / (max - min);
        if (u < fc) {
          return min + Math.sqrt(u * (max - min) * (mode - min));
        } else {
          return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
        }
      }
      default:
        return Math.random();
    }
  }

  private evaluateOutcome(_varValues: Record<string, number>, _formula: string): number {
    // Simplified - in production, use a proper expression evaluator
    // For now, just return sum of variables
    return Object.values(_varValues).reduce((a, b) => a + b, 0);
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Simulation] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createPredictiveSimulator(
  client: Anthropic,
  onStream?: StrategyStreamCallback
): PredictiveSimulator {
  return new PredictiveSimulator(client, onStream);
}
