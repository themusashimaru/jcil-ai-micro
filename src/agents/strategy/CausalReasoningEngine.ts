/**
 * CAUSAL REASONING ENGINE
 *
 * Analyzes cause-effect relationships between findings and events.
 * Goes beyond correlation to identify actual causal mechanisms.
 *
 * Key capabilities:
 * - Causal chain identification
 * - Counterfactual analysis
 * - Intervention modeling
 * - Confounding factor detection
 * - Root cause analysis
 * - Impact propagation
 *
 * Based on Pearl's causal inference framework (do-calculus)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Finding, StrategyStreamCallback, SynthesizedProblem } from './types';
import { CLAUDE_OPUS_45, CLAUDE_SONNET_45 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('CausalReasoningEngine');

// =============================================================================
// TYPES
// =============================================================================

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  rootCauses: string[]; // Node IDs that are root causes
  finalEffects: string[]; // Node IDs that are final effects
  confounders: Confounder[];
  interventionPoints: InterventionPoint[];
}

export interface CausalNode {
  id: string;
  name: string;
  type: 'cause' | 'effect' | 'mediator' | 'confounder' | 'collider';
  description: string;
  observedValue?: string | number;
  sourceIds: string[]; // Finding IDs
  confidence: number;
}

export interface CausalEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  mechanism: string; // How does the cause lead to the effect
  strength: 'strong' | 'moderate' | 'weak';
  temporalOrder: 'immediate' | 'short_term' | 'long_term' | 'unknown';
  confidence: number;
  evidence: string[];
  isDirectCause: boolean;
}

export interface Confounder {
  id: string;
  name: string;
  affectedRelationships: Array<{
    causeId: string;
    effectId: string;
    confoundingMechanism: string;
  }>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  controlStrategy?: string;
}

export interface InterventionPoint {
  id: string;
  nodeId: string;
  name: string;
  interventionType: 'block' | 'amplify' | 'redirect' | 'add' | 'remove';
  description: string;
  expectedImpact: string;
  feasibility: 'high' | 'medium' | 'low';
  cost: 'high' | 'medium' | 'low';
  downstreamEffects: string[];
}

export interface CausalChain {
  id: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  description: string;
  totalStrength: number;
  confidence: number;
}

export interface CounterfactualAnalysis {
  scenario: string;
  intervention: string;
  predictedOutcome: string;
  confidence: number;
  assumptions: string[];
  limitations: string[];
}

export interface RootCauseAnalysis {
  problem: string;
  rootCauses: Array<{
    cause: string;
    mechanism: string;
    confidence: number;
    evidence: string[];
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
  contributingFactors: string[];
  recommendations: string[];
}

export interface CausalAnalysisResult {
  graph: CausalGraph;
  chains: CausalChain[];
  counterfactuals: CounterfactualAnalysis[];
  rootCauseAnalysis?: RootCauseAnalysis;
  keyInsights: string[];
  timestamp: number;
}

// =============================================================================
// PROMPTS
// =============================================================================

const CAUSAL_ANALYSIS_PROMPT = `You are a Causal Reasoning Engine - an AI specialized in identifying cause-effect relationships using rigorous causal inference methodology.

YOUR FRAMEWORK (based on Pearl's causal inference):

1. CAUSAL GRAPH CONSTRUCTION
   Identify:
   - Causes: Events/factors that lead to other events
   - Effects: Outcomes that result from causes
   - Mediators: Variables that transmit causal effects
   - Confounders: Variables that affect both cause and effect (spurious correlation)
   - Colliders: Variables affected by multiple causes

2. CAUSAL MECHANISMS
   For each cause-effect relationship:
   - HOW does the cause lead to the effect? (mechanism)
   - Is it direct or mediated?
   - How strong is the relationship?
   - What's the temporal order?

3. CONFOUNDER DETECTION
   - What variables might create spurious correlations?
   - How could we control for them?
   - What's the severity of the confounding?

4. INTERVENTION ANALYSIS
   Think about do(X) - what happens if we intervene?
   - Where are the leverage points?
   - What interventions are feasible?
   - What are downstream effects?

5. COUNTERFACTUAL REASONING
   - What would have happened if X were different?
   - What assumptions does this require?
   - How confident can we be?

6. ROOT CAUSE ANALYSIS
   - Trace back from effects to ultimate causes
   - Don't stop at proximate causes - go deeper
   - Identify the TRUE root causes

CRITICAL RULES:
- Correlation ≠ Causation: Don't confuse them
- Temporal precedence: Causes must precede effects
- Mechanism matters: Explain HOW, not just THAT
- Consider confounders: Always look for hidden variables
- Be explicit about uncertainty

OUTPUT FORMAT:
\`\`\`json
{
  "graph": {
    "nodes": [
      {
        "id": "node_1",
        "name": "Variable name",
        "type": "cause|effect|mediator|confounder|collider",
        "description": "Description",
        "observedValue": "value if known",
        "sourceIds": ["finding_ids"],
        "confidence": 0.8
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "fromNodeId": "node_1",
        "toNodeId": "node_2",
        "mechanism": "How cause leads to effect",
        "strength": "strong|moderate|weak",
        "temporalOrder": "immediate|short_term|long_term|unknown",
        "confidence": 0.75,
        "evidence": ["evidence points"],
        "isDirectCause": true
      }
    ],
    "rootCauses": ["node_ids of root causes"],
    "finalEffects": ["node_ids of final effects"],
    "confounders": [
      {
        "id": "conf_1",
        "name": "Confounder name",
        "affectedRelationships": [
          {"causeId": "x", "effectId": "y", "confoundingMechanism": "how"}
        ],
        "severity": "critical|high|medium|low",
        "controlStrategy": "how to control for it"
      }
    ],
    "interventionPoints": [
      {
        "id": "int_1",
        "nodeId": "node_1",
        "name": "Intervention name",
        "interventionType": "block|amplify|redirect|add|remove",
        "description": "What the intervention does",
        "expectedImpact": "What happens if we intervene",
        "feasibility": "high|medium|low",
        "cost": "high|medium|low",
        "downstreamEffects": ["effects on other nodes"]
      }
    ]
  },
  "chains": [
    {
      "id": "chain_1",
      "nodes": ["simplified list"],
      "edges": ["simplified list"],
      "description": "A → B → C: Description of causal chain",
      "totalStrength": 0.7,
      "confidence": 0.6
    }
  ],
  "counterfactuals": [
    {
      "scenario": "What if X were different?",
      "intervention": "The specific change",
      "predictedOutcome": "What would happen",
      "confidence": 0.5,
      "assumptions": ["assumptions required"],
      "limitations": ["limitations of this analysis"]
    }
  ],
  "rootCauseAnalysis": {
    "problem": "The main problem being analyzed",
    "rootCauses": [
      {
        "cause": "The root cause",
        "mechanism": "How it causes the problem",
        "confidence": 0.8,
        "evidence": ["supporting evidence"],
        "priority": "critical|high|medium|low"
      }
    ],
    "contributingFactors": ["factors that aren't root causes but contribute"],
    "recommendations": ["what to do about root causes"]
  },
  "keyInsights": [
    "Major insight about causality",
    "Another insight"
  ]
}
\`\`\`

REMEMBER: Rigorous causal reasoning requires humility about what we can and cannot infer from observational data.`;

// =============================================================================
// CAUSAL REASONING ENGINE CLASS
// =============================================================================

export class CausalReasoningEngine {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private analysisHistory: CausalAnalysisResult[] = [];

  constructor(client: Anthropic, onStream?: StrategyStreamCallback) {
    this.client = client;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Analyze findings for causal relationships
   */
  async analyze(
    findings: Finding[],
    problem: SynthesizedProblem,
    focusQuestion?: string
  ): Promise<CausalAnalysisResult> {
    this.emitEvent('Initiating causal reasoning analysis...');

    const prompt = this.buildAnalysisPrompt(findings, problem, focusQuestion);

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_OPUS_45,
        max_tokens: 8192,
        temperature: 0.5,
        system: CAUSAL_ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const result = this.parseAnalysisResponse(text);

      this.analysisHistory.push(result);

      this.emitEvent(
        `Causal analysis complete: ${result.graph.nodes.length} nodes, ` +
          `${result.graph.edges.length} edges, ${result.chains.length} causal chains, ` +
          `${result.counterfactuals.length} counterfactuals`
      );

      log.info('Causal analysis complete', {
        nodes: result.graph.nodes.length,
        edges: result.graph.edges.length,
        chains: result.chains.length,
        counterfactuals: result.counterfactuals.length,
      });

      return result;
    } catch (error) {
      log.error('Causal analysis failed', { error });
      return this.createDefaultResult();
    }
  }

  /**
   * Perform targeted root cause analysis
   */
  async analyzeRootCauses(
    problem: string,
    symptoms: string[],
    context: string
  ): Promise<RootCauseAnalysis> {
    this.emitEvent(`Performing root cause analysis for: ${problem.slice(0, 50)}...`);

    const prompt = `Perform a rigorous root cause analysis:

PROBLEM: ${problem}

SYMPTOMS/OBSERVATIONS:
${symptoms.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CONTEXT: ${context}

Use the "5 Whys" technique combined with causal inference:
1. Start with symptoms
2. Ask "why" repeatedly
3. Identify the TRUE root causes (not just proximate causes)
4. Distinguish between root causes and contributing factors
5. Provide actionable recommendations

Output a root cause analysis in JSON format.`;

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        temperature: 0.5,
        system:
          'You are an expert root cause analyst. Use rigorous causal reasoning to identify the true underlying causes of problems.',
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return {
          problem,
          rootCauses: [],
          contributingFactors: symptoms,
          recommendations: ['Further analysis needed'],
        };
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        problem: String(parsed.problem || problem),
        rootCauses: (parsed.rootCauses || []).map((rc: Record<string, unknown>) => ({
          cause: String(rc.cause || ''),
          mechanism: String(rc.mechanism || ''),
          confidence: Math.max(0, Math.min(1, Number(rc.confidence) || 0.5)),
          evidence: Array.isArray(rc.evidence) ? rc.evidence.map(String) : [],
          priority: (['critical', 'high', 'medium', 'low'].includes(String(rc.priority))
            ? rc.priority
            : 'medium') as 'critical' | 'high' | 'medium' | 'low',
        })),
        contributingFactors: Array.isArray(parsed.contributingFactors)
          ? parsed.contributingFactors.map(String)
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String)
          : [],
      };
    } catch (error) {
      log.error('Root cause analysis failed', { error });
      return {
        problem,
        rootCauses: [],
        contributingFactors: symptoms,
        recommendations: ['Analysis failed - manual review needed'],
      };
    }
  }

  /**
   * Generate counterfactual scenarios
   */
  async generateCounterfactuals(
    situation: string,
    keyVariables: string[],
    desiredOutcome: string
  ): Promise<CounterfactualAnalysis[]> {
    this.emitEvent('Generating counterfactual scenarios...');

    const prompt = `Generate counterfactual analyses for this situation:

CURRENT SITUATION: ${situation}

KEY VARIABLES THAT COULD BE DIFFERENT:
${keyVariables.map((v, i) => `${i + 1}. ${v}`).join('\n')}

DESIRED OUTCOME: ${desiredOutcome}

For each key variable, analyze:
1. What if this variable were different?
2. What would be the predicted outcome?
3. What assumptions does this require?
4. What are the limitations of this counterfactual?

Output as JSON array of counterfactual analyses.`;

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
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[1]);
      const counterfactuals = Array.isArray(parsed) ? parsed : parsed.counterfactuals || [];

      return counterfactuals.map((cf: Record<string, unknown>) => ({
        scenario: String(cf.scenario || ''),
        intervention: String(cf.intervention || ''),
        predictedOutcome: String(cf.predictedOutcome || ''),
        confidence: Math.max(0, Math.min(1, Number(cf.confidence) || 0.5)),
        assumptions: Array.isArray(cf.assumptions) ? cf.assumptions.map(String) : [],
        limitations: Array.isArray(cf.limitations) ? cf.limitations.map(String) : [],
      }));
    } catch (error) {
      log.error('Counterfactual generation failed', { error });
      return [];
    }
  }

  /**
   * Identify intervention points in a causal system
   */
  identifyInterventionPoints(graph: CausalGraph): InterventionPoint[] {
    const interventionPoints: InterventionPoint[] = [];

    // Find high-impact nodes (many outgoing edges)
    const outgoingCounts = new Map<string, number>();
    for (const edge of graph.edges) {
      outgoingCounts.set(edge.fromNodeId, (outgoingCounts.get(edge.fromNodeId) || 0) + 1);
    }

    for (const node of graph.nodes) {
      const outgoing = outgoingCounts.get(node.id) || 0;

      // Mediators with multiple effects are good intervention points
      if (node.type === 'mediator' && outgoing >= 2) {
        interventionPoints.push({
          id: `int_${node.id}`,
          nodeId: node.id,
          name: `Intervene on ${node.name}`,
          interventionType: 'block',
          description: `Blocking ${node.name} would affect ${outgoing} downstream effects`,
          expectedImpact: `Would disrupt causal pathway through ${node.name}`,
          feasibility: 'medium',
          cost: 'medium',
          downstreamEffects: graph.edges
            .filter((e) => e.fromNodeId === node.id)
            .map((e) => graph.nodes.find((n) => n.id === e.toNodeId)?.name || e.toNodeId),
        });
      }

      // Root causes are prime intervention targets
      if (graph.rootCauses.includes(node.id)) {
        interventionPoints.push({
          id: `int_root_${node.id}`,
          nodeId: node.id,
          name: `Address root cause: ${node.name}`,
          interventionType: 'remove',
          description: `Removing this root cause would prevent downstream effects`,
          expectedImpact: `Would eliminate the causal chain originating from ${node.name}`,
          feasibility: 'low',
          cost: 'high',
          downstreamEffects: this.getDownstreamNodes(graph, node.id).map((n) => n.name),
        });
      }
    }

    // Sort by number of downstream effects
    interventionPoints.sort((a, b) => b.downstreamEffects.length - a.downstreamEffects.length);

    return interventionPoints;
  }

  /**
   * Calculate total causal effect between two nodes
   */
  calculateCausalEffect(
    graph: CausalGraph,
    causeId: string,
    effectId: string
  ): { totalEffect: number; paths: CausalChain[] } {
    const paths: CausalChain[] = [];

    // Find all paths from cause to effect using DFS
    const findPaths = (
      currentId: string,
      targetId: string,
      visited: Set<string>,
      currentPath: { nodes: CausalNode[]; edges: CausalEdge[] }
    ): void => {
      if (currentId === targetId) {
        // Found a path
        const totalStrength = currentPath.edges.reduce(
          (acc, e) => acc * (e.strength === 'strong' ? 0.9 : e.strength === 'moderate' ? 0.6 : 0.3),
          1
        );
        const confidence = currentPath.edges.reduce((acc, e) => acc * e.confidence, 1);

        paths.push({
          id: `path_${paths.length}`,
          nodes: [...currentPath.nodes],
          edges: [...currentPath.edges],
          description: currentPath.nodes.map((n) => n.name).join(' → '),
          totalStrength,
          confidence,
        });
        return;
      }

      if (visited.has(currentId)) return;
      visited.add(currentId);

      for (const edge of graph.edges) {
        if (edge.fromNodeId === currentId) {
          const nextNode = graph.nodes.find((n) => n.id === edge.toNodeId);
          if (nextNode) {
            findPaths(edge.toNodeId, targetId, visited, {
              nodes: [...currentPath.nodes, nextNode],
              edges: [...currentPath.edges, edge],
            });
          }
        }
      }

      visited.delete(currentId);
    };

    const startNode = graph.nodes.find((n) => n.id === causeId);
    if (startNode) {
      findPaths(causeId, effectId, new Set(), { nodes: [startNode], edges: [] });
    }

    // Calculate total effect (sum of path effects, capped at 1)
    const totalEffect = Math.min(
      1,
      paths.reduce((acc, p) => acc + p.totalStrength, 0)
    );

    return { totalEffect, paths };
  }

  /**
   * Get analysis history
   */
  getHistory(): CausalAnalysisResult[] {
    return [...this.analysisHistory];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildAnalysisPrompt(
    findings: Finding[],
    problem: SynthesizedProblem,
    focusQuestion?: string
  ): string {
    const sections: string[] = [];

    sections.push('## THE PROBLEM:');
    sections.push(`Core Question: ${problem.coreQuestion}`);
    sections.push(`Summary: ${problem.summary}`);
    sections.push(`Domains: ${problem.domains.join(', ')}`);

    if (focusQuestion) {
      sections.push(`\n## FOCUS QUESTION FOR CAUSAL ANALYSIS:`);
      sections.push(focusQuestion);
    }

    sections.push('\n## FINDINGS TO ANALYZE FOR CAUSAL RELATIONSHIPS:');
    sections.push(`Total: ${findings.length} findings\n`);

    // Group by type
    const byType = findings.reduce(
      (acc, f) => {
        if (!acc[f.type]) acc[f.type] = [];
        acc[f.type].push(f);
        return acc;
      },
      {} as Record<string, Finding[]>
    );

    for (const [type, typeFindings] of Object.entries(byType)) {
      sections.push(`### ${type.toUpperCase()} (${typeFindings.length}):`);
      for (const f of typeFindings.slice(0, 15)) {
        sections.push(
          `- [${f.id}] ${f.title}: ${f.content.slice(0, 200)}${f.content.length > 200 ? '...' : ''}`
        );
      }
    }

    sections.push('\n## YOUR TASK:');
    sections.push(
      'Identify causal relationships in these findings. ' +
        'Build a causal graph, identify causal chains, detect confounders, ' +
        'suggest intervention points, and generate counterfactual analyses. ' +
        'Be rigorous - distinguish correlation from causation.'
    );

    return sections.join('\n');
  }

  private parseAnalysisResponse(response: string): CausalAnalysisResult {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      log.warn('Could not parse causal analysis JSON');
      return this.createDefaultResult();
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      // Parse graph
      const graph: CausalGraph = {
        nodes: (parsed.graph?.nodes || []).map((n: Record<string, unknown>, i: number) => ({
          id: String(n.id || `node_${i}`),
          name: String(n.name || ''),
          type: (['cause', 'effect', 'mediator', 'confounder', 'collider'].includes(String(n.type))
            ? n.type
            : 'cause') as CausalNode['type'],
          description: String(n.description || ''),
          observedValue: n.observedValue,
          sourceIds: Array.isArray(n.sourceIds) ? n.sourceIds.map(String) : [],
          confidence: Math.max(0, Math.min(1, Number(n.confidence) || 0.5)),
        })),
        edges: (parsed.graph?.edges || []).map((e: Record<string, unknown>, i: number) => ({
          id: String(e.id || `edge_${i}`),
          fromNodeId: String(e.fromNodeId || ''),
          toNodeId: String(e.toNodeId || ''),
          mechanism: String(e.mechanism || ''),
          strength: (['strong', 'moderate', 'weak'].includes(String(e.strength))
            ? e.strength
            : 'moderate') as CausalEdge['strength'],
          temporalOrder: (['immediate', 'short_term', 'long_term', 'unknown'].includes(
            String(e.temporalOrder)
          )
            ? e.temporalOrder
            : 'unknown') as CausalEdge['temporalOrder'],
          confidence: Math.max(0, Math.min(1, Number(e.confidence) || 0.5)),
          evidence: Array.isArray(e.evidence) ? e.evidence.map(String) : [],
          isDirectCause: Boolean(e.isDirectCause),
        })),
        rootCauses: Array.isArray(parsed.graph?.rootCauses)
          ? parsed.graph.rootCauses.map(String)
          : [],
        finalEffects: Array.isArray(parsed.graph?.finalEffects)
          ? parsed.graph.finalEffects.map(String)
          : [],
        confounders: (parsed.graph?.confounders || []).map(
          (c: Record<string, unknown>, i: number) => ({
            id: String(c.id || `conf_${i}`),
            name: String(c.name || ''),
            affectedRelationships: Array.isArray(c.affectedRelationships)
              ? c.affectedRelationships.map((r: Record<string, unknown>) => ({
                  causeId: String(r.causeId || ''),
                  effectId: String(r.effectId || ''),
                  confoundingMechanism: String(r.confoundingMechanism || ''),
                }))
              : [],
            severity: (['critical', 'high', 'medium', 'low'].includes(String(c.severity))
              ? c.severity
              : 'medium') as Confounder['severity'],
            controlStrategy: c.controlStrategy ? String(c.controlStrategy) : undefined,
          })
        ),
        interventionPoints: (parsed.graph?.interventionPoints || []).map(
          (ip: Record<string, unknown>, i: number) => ({
            id: String(ip.id || `int_${i}`),
            nodeId: String(ip.nodeId || ''),
            name: String(ip.name || ''),
            interventionType: (['block', 'amplify', 'redirect', 'add', 'remove'].includes(
              String(ip.interventionType)
            )
              ? ip.interventionType
              : 'block') as InterventionPoint['interventionType'],
            description: String(ip.description || ''),
            expectedImpact: String(ip.expectedImpact || ''),
            feasibility: (['high', 'medium', 'low'].includes(String(ip.feasibility))
              ? ip.feasibility
              : 'medium') as InterventionPoint['feasibility'],
            cost: (['high', 'medium', 'low'].includes(String(ip.cost))
              ? ip.cost
              : 'medium') as InterventionPoint['cost'],
            downstreamEffects: Array.isArray(ip.downstreamEffects)
              ? ip.downstreamEffects.map(String)
              : [],
          })
        ),
      };

      // Parse chains
      const chains: CausalChain[] = (parsed.chains || []).map(
        (c: Record<string, unknown>, i: number) => ({
          id: String(c.id || `chain_${i}`),
          nodes: Array.isArray(c.nodes) ? c.nodes : [],
          edges: Array.isArray(c.edges) ? c.edges : [],
          description: String(c.description || ''),
          totalStrength: Math.max(0, Math.min(1, Number(c.totalStrength) || 0.5)),
          confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0.5)),
        })
      );

      // Parse counterfactuals
      const counterfactuals: CounterfactualAnalysis[] = (parsed.counterfactuals || []).map(
        (cf: Record<string, unknown>) => ({
          scenario: String(cf.scenario || ''),
          intervention: String(cf.intervention || ''),
          predictedOutcome: String(cf.predictedOutcome || ''),
          confidence: Math.max(0, Math.min(1, Number(cf.confidence) || 0.5)),
          assumptions: Array.isArray(cf.assumptions) ? cf.assumptions.map(String) : [],
          limitations: Array.isArray(cf.limitations) ? cf.limitations.map(String) : [],
        })
      );

      // Parse root cause analysis
      let rootCauseAnalysis: RootCauseAnalysis | undefined;
      if (parsed.rootCauseAnalysis) {
        const rca = parsed.rootCauseAnalysis;
        rootCauseAnalysis = {
          problem: String(rca.problem || ''),
          rootCauses: (rca.rootCauses || []).map((rc: Record<string, unknown>) => ({
            cause: String(rc.cause || ''),
            mechanism: String(rc.mechanism || ''),
            confidence: Math.max(0, Math.min(1, Number(rc.confidence) || 0.5)),
            evidence: Array.isArray(rc.evidence) ? rc.evidence.map(String) : [],
            priority: (['critical', 'high', 'medium', 'low'].includes(String(rc.priority))
              ? rc.priority
              : 'medium') as 'critical' | 'high' | 'medium' | 'low',
          })),
          contributingFactors: Array.isArray(rca.contributingFactors)
            ? rca.contributingFactors.map(String)
            : [],
          recommendations: Array.isArray(rca.recommendations)
            ? rca.recommendations.map(String)
            : [],
        };
      }

      return {
        graph,
        chains,
        counterfactuals,
        rootCauseAnalysis,
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
        timestamp: Date.now(),
      };
    } catch (error) {
      log.error('Failed to parse causal analysis', { error });
      return this.createDefaultResult();
    }
  }

  private createDefaultResult(): CausalAnalysisResult {
    return {
      graph: {
        nodes: [],
        edges: [],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      },
      chains: [],
      counterfactuals: [],
      keyInsights: ['Causal analysis could not be completed'],
      timestamp: Date.now(),
    };
  }

  private getDownstreamNodes(graph: CausalGraph, nodeId: string): CausalNode[] {
    const visited = new Set<string>();
    const result: CausalNode[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      for (const edge of graph.edges) {
        if (edge.fromNodeId === id) {
          const node = graph.nodes.find((n) => n.id === edge.toNodeId);
          if (node) {
            result.push(node);
            traverse(edge.toNodeId);
          }
        }
      }
    };

    traverse(nodeId);
    return result;
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[Causal] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createCausalReasoningEngine(
  client: Anthropic,
  onStream?: StrategyStreamCallback
): CausalReasoningEngine {
  return new CausalReasoningEngine(client, onStream);
}
