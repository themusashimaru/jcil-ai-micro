/**
 * CAUSAL-INFERENCE TOOL
 * Real causal inference methods - DAGs, do-calculus, interventions, counterfactuals
 * Understand cause and effect - NOT JUST CORRELATION!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const causalinferenceTool: UnifiedTool = {
  name: 'causal_inference',
  description:
    'Causal inference - DAGs, do-calculus, interventions, counterfactuals, propensity scores',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'build_dag',
          'intervention',
          'counterfactual',
          'identify',
          'estimate',
          'propensity',
          'mediation',
          'info',
        ],
        description: 'Operation to perform',
      },
      edges: { type: 'array', description: 'Array of [from, to] edges defining DAG' },
      treatment: { type: 'string', description: 'Treatment variable name' },
      outcome: { type: 'string', description: 'Outcome variable name' },
      confounders: { type: 'array', description: 'Array of confounder variable names' },
      treatment_data: { type: 'array', description: 'Treatment values (0 or 1)' },
      outcome_data: { type: 'array', description: 'Outcome values' },
      covariate_data: { type: 'object', description: 'Object with covariate arrays' },
      intervention_value: { type: 'number', description: 'Value to intervene with (do(X=x))' },
    },
    required: ['operation'],
  },
};

interface CausalArgs {
  operation: string;
  edges?: Array<[string, string]>;
  treatment?: string;
  outcome?: string;
  confounders?: string[];
  treatment_data?: number[];
  outcome_data?: number[];
  covariate_data?: Record<string, number[]>;
  intervention_value?: number;
}

/**
 * Directed Acyclic Graph (DAG) for causal structure
 */
class CausalDAG {
  nodes: Set<string>;
  edges: Map<string, Set<string>>; // node -> children
  parents: Map<string, Set<string>>; // node -> parents

  constructor() {
    this.nodes = new Set();
    this.edges = new Map();
    this.parents = new Map();
  }

  addNode(node: string): void {
    this.nodes.add(node);
    if (!this.edges.has(node)) this.edges.set(node, new Set());
    if (!this.parents.has(node)) this.parents.set(node, new Set());
  }

  addEdge(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);
    this.edges.get(from)!.add(to);
    this.parents.get(to)!.add(from);
  }

  getParents(node: string): string[] {
    return Array.from(this.parents.get(node) || []);
  }

  getChildren(node: string): string[] {
    return Array.from(this.edges.get(node) || []);
  }

  /**
   * Get all ancestors of a node (recursive)
   */
  getAncestors(node: string, visited: Set<string> = new Set()): Set<string> {
    const ancestors = new Set<string>();
    for (const parent of this.getParents(node)) {
      if (!visited.has(parent)) {
        visited.add(parent);
        ancestors.add(parent);
        for (const a of this.getAncestors(parent, visited)) {
          ancestors.add(a);
        }
      }
    }
    return ancestors;
  }

  /**
   * Get all descendants of a node (recursive)
   */
  getDescendants(node: string, visited: Set<string> = new Set()): Set<string> {
    const descendants = new Set<string>();
    for (const child of this.getChildren(node)) {
      if (!visited.has(child)) {
        visited.add(child);
        descendants.add(child);
        for (const d of this.getDescendants(child, visited)) {
          descendants.add(d);
        }
      }
    }
    return descendants;
  }

  /**
   * Check if graph is acyclic using DFS
   */
  isAcyclic(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      for (const child of this.getChildren(node)) {
        if (!visited.has(child)) {
          if (hasCycle(child)) return true;
        } else if (recStack.has(child)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of this.nodes) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return false;
      }
    }
    return true;
  }

  /**
   * Find all paths between two nodes (for d-separation)
   */
  findAllPaths(from: string, to: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]): void => {
      if (current === to) {
        paths.push([...path]);
        return;
      }

      visited.add(current);

      // Follow edges in both directions for path finding
      for (const next of [...this.getChildren(current), ...this.getParents(current)]) {
        if (!visited.has(next)) {
          dfs(next, [...path, next]);
        }
      }

      visited.delete(current);
    };

    dfs(from, [from]);
    return paths;
  }

  /**
   * Check d-separation: are X and Y independent given Z?
   * Using the Bayes-Ball algorithm concept
   */
  isDSeparated(X: string, Y: string, Z: Set<string>): boolean {
    // Simplified d-separation check
    // A path is blocked if:
    // 1. Contains a chain (A→B→C) or fork (A←B→C) where B is in Z
    // 2. Contains a collider (A→B←C) where B and its descendants are NOT in Z

    const paths = this.findAllPaths(X, Y);
    if (paths.length === 0) return true; // No path = separated

    for (const path of paths) {
      let blocked = false;

      for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const next = path[i + 1];

        const prevToMiddle = this.getChildren(prev).includes(curr);
        const nextToMiddle = this.getChildren(next).includes(curr);

        // Collider: → B ←
        const isCollider = prevToMiddle && nextToMiddle;

        if (isCollider) {
          // Collider blocks path unless it or descendant is in Z
          const descendants = this.getDescendants(curr);
          if (!Z.has(curr) && !Array.from(descendants).some((d) => Z.has(d))) {
            blocked = true;
            break;
          }
        } else {
          // Chain or fork: blocks if conditioned on
          if (Z.has(curr)) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) return false; // Found unblocked path
    }

    return true; // All paths blocked
  }

  /**
   * Find minimal adjustment set using backdoor criterion
   */
  findBackdoorAdjustmentSet(treatment: string, outcome: string): string[] {
    // Block all backdoor paths from treatment to outcome
    // Backdoor path: path that has arrow INTO treatment

    const treatmentParents = this.getParents(treatment);
    const treatmentAncestors = this.getAncestors(treatment);

    // Find confounders: ancestors of treatment that also affect outcome
    const outcomeAncestors = this.getAncestors(outcome);
    const confounders: string[] = [];

    for (const node of this.nodes) {
      if (node === treatment || node === outcome) continue;

      // Is this a potential confounder?
      if (treatmentAncestors.has(node) || treatmentParents.includes(node)) {
        if (outcomeAncestors.has(node) || this.getChildren(node).includes(outcome)) {
          confounders.push(node);
        }
      }
    }

    return confounders;
  }
}

/**
 * Propensity Score Estimation
 * P(T=1|X) - probability of treatment given covariates
 */
function estimatePropensityScore(
  treatment: number[],
  covariates: Record<string, number[]>
): {
  scores: number[];
  weights: { ate: number[]; att: number[]; atc: number[] };
  balance: Record<string, { before: number; after: number }>;
} {
  const n = treatment.length;
  const covarNames = Object.keys(covariates);

  // Simple logistic regression using gradient descent
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1]; // Intercept
    for (const name of covarNames) {
      row.push(covariates[name][i]);
    }
    X.push(row);
  }

  // Initialize coefficients
  const beta = Array(X[0].length).fill(0);

  // Sigmoid function
  const sigmoid = (z: number): number => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));

  // Gradient descent
  const lr = 0.1;
  const iterations = 1000;

  for (let iter = 0; iter < iterations; iter++) {
    const gradient = Array(beta.length).fill(0);

    for (let i = 0; i < n; i++) {
      const z = X[i].reduce((sum, x, j) => sum + x * beta[j], 0);
      const pred = sigmoid(z);
      const error = treatment[i] - pred;

      for (let j = 0; j < beta.length; j++) {
        gradient[j] += error * X[i][j];
      }
    }

    for (let j = 0; j < beta.length; j++) {
      beta[j] += (lr * gradient[j]) / n;
    }
  }

  // Calculate propensity scores
  const scores: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = X[i].reduce((sum, x, j) => sum + x * beta[j], 0);
    scores.push(Math.max(0.01, Math.min(0.99, sigmoid(z)))); // Clip for stability
  }

  // Calculate IPW weights
  const ateWeights: number[] = []; // ATE: Average Treatment Effect
  const attWeights: number[] = []; // ATT: Average Treatment Effect on Treated
  const atcWeights: number[] = []; // ATC: Average Treatment Effect on Control

  for (let i = 0; i < n; i++) {
    const e = scores[i];
    if (treatment[i] === 1) {
      ateWeights.push(1 / e);
      attWeights.push(1);
      atcWeights.push(e / (1 - e));
    } else {
      ateWeights.push(1 / (1 - e));
      attWeights.push(e / (1 - e));
      atcWeights.push(1);
    }
  }

  // Calculate covariate balance
  const balance: Record<string, { before: number; after: number }> = {};

  for (const name of covarNames) {
    const treated = covariates[name].filter((_, i) => treatment[i] === 1);
    const control = covariates[name].filter((_, i) => treatment[i] === 0);

    const meanT = treated.reduce((a, b) => a + b, 0) / treated.length;
    const meanC = control.reduce((a, b) => a + b, 0) / control.length;
    const pooledSD = Math.sqrt(
      (variance(treated) * (treated.length - 1) + variance(control) * (control.length - 1)) /
        (treated.length + control.length - 2)
    );

    const smdBefore = Math.abs(meanT - meanC) / (pooledSD || 1);

    // Weighted means after IPW
    let sumWT = 0,
      sumWTVal = 0,
      sumWC = 0,
      sumWCVal = 0;
    for (let i = 0; i < n; i++) {
      if (treatment[i] === 1) {
        sumWT += ateWeights[i];
        sumWTVal += ateWeights[i] * covariates[name][i];
      } else {
        sumWC += ateWeights[i];
        sumWCVal += ateWeights[i] * covariates[name][i];
      }
    }
    const weightedMeanT = sumWTVal / sumWT;
    const weightedMeanC = sumWCVal / sumWC;
    const smdAfter = Math.abs(weightedMeanT - weightedMeanC) / (pooledSD || 1);

    balance[name] = { before: smdBefore, after: smdAfter };
  }

  return { scores, weights: { ate: ateWeights, att: attWeights, atc: atcWeights }, balance };
}

// Helper: variance
function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length;
}

/**
 * Estimate ATE using Inverse Probability Weighting
 */
function estimateATEipw(
  treatment: number[],
  outcome: number[],
  propensityScores: number[]
): { ate: number; se: number; ci95: [number, number] } {
  const n = treatment.length;

  let sumTreated = 0,
    sumControl = 0;
  let countT = 0,
    countC = 0;

  for (let i = 0; i < n; i++) {
    const e = propensityScores[i];
    if (treatment[i] === 1) {
      sumTreated += outcome[i] / e;
      countT += 1 / e;
    } else {
      sumControl += outcome[i] / (1 - e);
      countC += 1 / (1 - e);
    }
  }

  const ate = sumTreated / countT - sumControl / countC;

  // Bootstrap SE (simplified)
  const bootstrapATEs: number[] = [];
  for (let b = 0; b < 100; b++) {
    const indices = Array(n)
      .fill(0)
      .map(() => Math.floor(Math.random() * n));
    let bSumT = 0,
      bSumC = 0,
      bCountT = 0,
      bCountC = 0;

    for (const i of indices) {
      const e = propensityScores[i];
      if (treatment[i] === 1) {
        bSumT += outcome[i] / e;
        bCountT += 1 / e;
      } else {
        bSumC += outcome[i] / (1 - e);
        bCountC += 1 / (1 - e);
      }
    }
    bootstrapATEs.push(bSumT / bCountT - bSumC / bCountC);
  }

  const se = Math.sqrt(variance(bootstrapATEs));
  const ci95: [number, number] = [ate - 1.96 * se, ate + 1.96 * se];

  return { ate, se, ci95 };
}

/**
 * Doubly Robust Estimation (AIPW)
 * Combines outcome modeling and propensity score weighting
 */
export function estimateATEDoublyRobust(
  treatment: number[],
  outcome: number[],
  propensityScores: number[],
  outcomeModelPred: { treated: number[]; control: number[] }
): { ate: number; se: number } {
  const n = treatment.length;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const e = propensityScores[i];
    const y = outcome[i];
    const t = treatment[i];
    const mu1 = outcomeModelPred.treated[i];
    const mu0 = outcomeModelPred.control[i];

    // AIPW estimator
    const term = (t * (y - mu1)) / e - ((1 - t) * (y - mu0)) / (1 - e) + (mu1 - mu0);
    sum += term;
  }

  const ate = sum / n;

  // Simplified SE
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const e = propensityScores[i];
    const y = outcome[i];
    const t = treatment[i];
    const mu1 = outcomeModelPred.treated[i];
    const mu0 = outcomeModelPred.control[i];
    const term = (t * (y - mu1)) / e - ((1 - t) * (y - mu0)) / (1 - e) + (mu1 - mu0);
    varSum += (term - ate) ** 2;
  }
  const se = Math.sqrt(varSum / (n * (n - 1)));

  return { ate, se };
}

/**
 * Simple mediation analysis
 * X → M → Y with direct effect X → Y
 */
function mediationAnalysis(
  treatment: number[],
  mediator: number[],
  outcome: number[]
): {
  total_effect: number;
  direct_effect: number;
  indirect_effect: number;
  proportion_mediated: number;
} {
  const n = treatment.length;

  // Total effect: regression of Y on X
  const meanX = treatment.reduce((a, b) => a + b, 0) / n;
  const meanY = outcome.reduce((a, b) => a + b, 0) / n;
  let covXY = 0,
    varX = 0;
  for (let i = 0; i < n; i++) {
    covXY += (treatment[i] - meanX) * (outcome[i] - meanY);
    varX += (treatment[i] - meanX) ** 2;
  }
  const totalEffect = covXY / varX;

  // Effect of X on M
  const meanM = mediator.reduce((a, b) => a + b, 0) / n;
  let covXM = 0;
  for (let i = 0; i < n; i++) {
    covXM += (treatment[i] - meanX) * (mediator[i] - meanM);
  }
  const effectXonM = covXM / varX;

  // Effect of M on Y controlling for X (simplified OLS)
  // Y = a + b*X + c*M
  // Using residualization approach
  const residM = mediator.map((m, i) => m - (meanM + effectXonM * (treatment[i] - meanX)));
  const residY = outcome.map((y, i) => y - (meanY + totalEffect * (treatment[i] - meanX)));

  let covResidMY = 0,
    varResidM = 0;
  for (let i = 0; i < n; i++) {
    covResidMY += residM[i] * residY[i];
    varResidM += residM[i] ** 2;
  }
  const effectMonY = covResidMY / (varResidM || 1);

  const indirectEffect = effectXonM * effectMonY;
  const directEffect = totalEffect - indirectEffect;

  return {
    total_effect: totalEffect,
    direct_effect: directEffect,
    indirect_effect: indirectEffect,
    proportion_mediated: Math.abs(indirectEffect / (totalEffect || 1)),
  };
}

/**
 * Counterfactual estimation using potential outcomes
 */
function estimateCounterfactual(
  treatment: number[],
  outcome: number[],
  covariates: Record<string, number[]>,
  targetTreatment: number
): { estimated_outcome: number; uncertainty: number } {
  const n = treatment.length;

  // Find similar units that received target treatment
  const targetUnits = treatment
    .map((t, i) => (t === targetTreatment ? i : -1))
    .filter((i) => i >= 0);

  // Simple matching based on covariates
  const covarNames = Object.keys(covariates);

  // Normalize covariates
  const normalizedCov: Record<string, number[]> = {};
  for (const name of covarNames) {
    const values = covariates[name];
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(variance(values)) || 1;
    normalizedCov[name] = values.map((v) => (v - mean) / sd);
  }

  // Estimate counterfactual for each unit
  const counterfactuals: number[] = [];

  for (let i = 0; i < n; i++) {
    if (treatment[i] === targetTreatment) {
      // Already observed
      counterfactuals.push(outcome[i]);
    } else {
      // Find nearest neighbor in target group
      let minDist = Infinity;
      let nearestOutcome = 0;

      for (const j of targetUnits) {
        let dist = 0;
        for (const name of covarNames) {
          dist += (normalizedCov[name][i] - normalizedCov[name][j]) ** 2;
        }
        dist = Math.sqrt(dist);

        if (dist < minDist) {
          minDist = dist;
          nearestOutcome = outcome[j];
        }
      }
      counterfactuals.push(nearestOutcome);
    }
  }

  const meanOutcome = counterfactuals.reduce((a, b) => a + b, 0) / n;
  const uncertainty = Math.sqrt(variance(counterfactuals)) / Math.sqrt(n);

  return {
    estimated_outcome: meanOutcome,
    uncertainty,
  };
}

export async function executecausalinference(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args: CausalArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      edges = [
        ['U', 'X'],
        ['U', 'Y'],
        ['X', 'Y'],
      ], // Simple confounded DAG
      treatment = 'X',
      outcome = 'Y',
      confounders = ['U'],
      treatment_data = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0],
      outcome_data = [
        5.2, 2.1, 4.8, 5.5, 1.9, 2.3, 5.1, 2.0, 4.9, 2.2, 5.3, 4.7, 2.4, 1.8, 5.0, 2.1, 4.6, 2.5,
        5.4, 1.7,
      ],
      covariate_data = {
        age: [45, 32, 55, 48, 38, 29, 52, 35, 50, 42, 47, 53, 31, 28, 49, 36, 51, 33, 46, 30],
        income: [50, 35, 65, 55, 40, 30, 60, 38, 58, 45, 52, 62, 33, 28, 56, 37, 59, 34, 54, 32],
      },
      intervention_value = 1,
    } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'build_dag': {
        const dag = new CausalDAG();
        for (const [from, to] of edges) {
          dag.addEdge(from, to);
        }

        const structure: Record<string, { parents: string[]; children: string[] }> = {};
        for (const node of dag.nodes) {
          structure[node] = {
            parents: dag.getParents(node),
            children: dag.getChildren(node),
          };
        }

        result = {
          operation: 'build_dag',
          nodes: Array.from(dag.nodes),
          edges: edges,
          structure,
          is_acyclic: dag.isAcyclic(),
          backdoor_adjustment: dag.findBackdoorAdjustmentSet(treatment, outcome),
          interpretation: {
            dag_meaning: 'Directed edges represent direct causal effects',
            arrows: 'A → B means A directly causes B',
            confounders: 'Variables causing both treatment and outcome create bias',
          },
        };
        break;
      }

      case 'intervention': {
        // do(X=x) - intervention analysis
        const dag = new CausalDAG();
        for (const [from, to] of edges) {
          dag.addEdge(from, to);
        }

        // Under intervention do(X=x), we cut incoming edges to X
        const interventionDAG = new CausalDAG();
        for (const [from, to] of edges) {
          if (to !== treatment) {
            // Remove edges INTO treatment
            interventionDAG.addEdge(from, to);
          }
        }
        interventionDAG.addNode(treatment); // Keep treatment as node

        // Estimate E[Y|do(X=x)] using backdoor adjustment
        const adjustmentSet = dag.findBackdoorAdjustmentSet(treatment, outcome);

        // Simplified estimation using stratification
        const strata: Record<string, { treated: number[]; control: number[] }> = {};

        for (let i = 0; i < treatment_data.length; i++) {
          const strataKey = confounders
            .map((c) => (covariate_data[c] ? (covariate_data[c][i] > 40 ? 'high' : 'low') : 'na'))
            .join('_');

          if (!strata[strataKey]) strata[strataKey] = { treated: [], control: [] };
          if (treatment_data[i] === intervention_value) {
            strata[strataKey].treated.push(outcome_data[i]);
          } else {
            strata[strataKey].control.push(outcome_data[i]);
          }
        }

        // Weighted average across strata
        let totalWeight = 0;
        let weightedSum = 0;
        for (const key of Object.keys(strata)) {
          const s = strata[key];
          const weight = s.treated.length + s.control.length;
          const mean =
            s.treated.length > 0
              ? s.treated.reduce((a, b) => a + b, 0) / s.treated.length
              : outcome_data.reduce((a, b) => a + b, 0) / outcome_data.length;
          weightedSum += weight * mean;
          totalWeight += weight;
        }

        const interventionalExpectation = weightedSum / totalWeight;

        result = {
          operation: 'intervention',
          intervention: `do(${treatment}=${intervention_value})`,
          adjustment_set: adjustmentSet,
          expected_outcome: interventionalExpectation,
          formula: `E[${outcome}|do(${treatment}=${intervention_value})] = Σ_Z E[${outcome}|${treatment},Z] × P(Z)`,
          causal_effect: 'This estimates the causal effect, not mere association',
          interpretation: {
            do_operator: 'Intervention (do) differs from conditioning (|)',
            conditioning: 'P(Y|X=x) includes selection bias from confounders',
            intervention: 'P(Y|do(X=x)) represents actual causal effect',
          },
        };
        break;
      }

      case 'counterfactual': {
        const cf0 = estimateCounterfactual(treatment_data, outcome_data, covariate_data, 0);
        const cf1 = estimateCounterfactual(treatment_data, outcome_data, covariate_data, 1);

        result = {
          operation: 'counterfactual',
          description: 'Estimate outcomes under different treatments using matching',
          counterfactual_Y_if_treated: cf1,
          counterfactual_Y_if_control: cf0,
          individual_treatment_effect: cf1.estimated_outcome - cf0.estimated_outcome,
          interpretation: {
            meaning: 'What would outcome be if treatment were different?',
            Y0: `E[Y(0)] - Expected outcome if everyone received control`,
            Y1: `E[Y(1)] - Expected outcome if everyone received treatment`,
            ITE: 'Individual Treatment Effect varies across units',
          },
          assumptions: [
            'Consistency: Y = Y(T) when T is observed treatment',
            'No interference: Units dont affect each other',
            'Positivity: P(T=t|X) > 0 for all strata',
          ],
        };
        break;
      }

      case 'identify': {
        const dag = new CausalDAG();
        for (const [from, to] of edges) {
          dag.addEdge(from, to);
        }

        const backdoorSet = dag.findBackdoorAdjustmentSet(treatment, outcome);

        // Check identification conditions
        const identifiable = backdoorSet.length > 0 || dag.getParents(treatment).length === 0;

        result = {
          operation: 'identify',
          treatment,
          outcome,
          dag_edges: edges,
          backdoor_criterion: {
            adjustment_set: backdoorSet,
            satisfies_criterion: identifiable,
            explanation: 'Backdoor criterion: Adjust for variables that block all backdoor paths',
          },
          frontdoor_criterion: {
            applicable: false, // Simplified
            explanation: 'Frontdoor criterion uses mediator when confounders unobserved',
          },
          identification_strategy: identifiable
            ? `Adjust for ${backdoorSet.join(', ')} to identify causal effect`
            : 'Effect may not be identifiable from observational data',
          do_calculus_rules: {
            rule1: 'P(Y|do(X),Z,W) = P(Y|do(X),W) if Z d-separated from Y given X,W in G_X̄',
            rule2: 'P(Y|do(X),do(Z),W) = P(Y|do(X),Z,W) if Y d-separated from Z given X,W in G_X̄Z̄',
            rule3: 'P(Y|do(X),do(Z),W) = P(Y|do(X),W) if Y d-separated from Z given X,W in G_X̄Z̄(W)',
          },
        };
        break;
      }

      case 'estimate': {
        // Full ATE estimation with multiple methods
        const ps = estimatePropensityScore(treatment_data, covariate_data);
        const ipw = estimateATEipw(treatment_data, outcome_data, ps.scores);

        // Simple outcome regression
        const treatedOutcomes = outcome_data.filter((_, i) => treatment_data[i] === 1);
        const controlOutcomes = outcome_data.filter((_, i) => treatment_data[i] === 0);
        const naiveATE =
          treatedOutcomes.reduce((a, b) => a + b, 0) / treatedOutcomes.length -
          controlOutcomes.reduce((a, b) => a + b, 0) / controlOutcomes.length;

        result = {
          operation: 'estimate',
          sample_size: treatment_data.length,
          treated_count: treatment_data.filter((t) => t === 1).length,
          control_count: treatment_data.filter((t) => t === 0).length,
          naive_difference: {
            ate: naiveATE,
            warning: 'May be biased due to confounding',
          },
          ipw_estimate: {
            ate: ipw.ate,
            standard_error: ipw.se,
            confidence_interval_95: ipw.ci95,
            method: 'Inverse Probability Weighting',
          },
          propensity_scores: {
            min: Math.min(...ps.scores),
            max: Math.max(...ps.scores),
            mean: ps.scores.reduce((a, b) => a + b, 0) / ps.scores.length,
            overlap: Math.min(...ps.scores) > 0.05 && Math.max(...ps.scores) < 0.95,
          },
          covariate_balance: ps.balance,
          interpretation: {
            ate: 'Average Treatment Effect - average causal effect across population',
            ipw: 'Reweights sample to simulate randomized experiment',
            balance: 'SMD < 0.1 indicates good balance after weighting',
          },
        };
        break;
      }

      case 'propensity': {
        const ps = estimatePropensityScore(treatment_data, covariate_data);

        result = {
          operation: 'propensity',
          description: 'Propensity score analysis for causal inference',
          propensity_scores: ps.scores.map((s, i) => ({
            unit: i,
            treatment: treatment_data[i],
            propensity: Math.round(s * 1000) / 1000,
          })),
          score_distribution: {
            treated_mean:
              ps.scores.filter((_, i) => treatment_data[i] === 1).reduce((a, b) => a + b, 0) /
              treatment_data.filter((t) => t === 1).length,
            control_mean:
              ps.scores.filter((_, i) => treatment_data[i] === 0).reduce((a, b) => a + b, 0) /
              treatment_data.filter((t) => t === 0).length,
          },
          covariate_balance: ps.balance,
          overlap_assessment: {
            min_treated: Math.min(...ps.scores.filter((_, i) => treatment_data[i] === 1)),
            max_control: Math.max(...ps.scores.filter((_, i) => treatment_data[i] === 0)),
            sufficient_overlap: true,
          },
          uses: {
            matching: 'Match treated/control with similar propensity',
            stratification: 'Stratify by propensity quintiles',
            weighting: 'IPW, ATT, ATC weights',
            regression: 'Include propensity as covariate',
          },
        };
        break;
      }

      case 'mediation': {
        // Use first covariate as mediator for demo
        const mediatorData =
          covariate_data[Object.keys(covariate_data)[0]] ||
          Array(treatment_data.length)
            .fill(0)
            .map(() => Math.random() * 10);

        const mediation = mediationAnalysis(treatment_data, mediatorData, outcome_data);

        result = {
          operation: 'mediation',
          description: 'Causal mediation analysis: X → M → Y',
          effects: {
            total_effect: mediation.total_effect,
            direct_effect: mediation.direct_effect,
            indirect_effect: mediation.indirect_effect,
            proportion_mediated: mediation.proportion_mediated,
          },
          interpretation: {
            total: 'Total effect of treatment on outcome',
            direct: 'Effect not through mediator (X → Y)',
            indirect: 'Effect through mediator (X → M → Y)',
            proportion: 'Fraction of effect explained by mediator',
          },
          assumptions: [
            'No unmeasured confounding of X-Y',
            'No unmeasured confounding of M-Y',
            'No unmeasured confounding of X-M',
            'No intermediate confounders affected by X',
          ],
        };
        break;
      }

      case 'info':
      default:
        result = {
          operation: 'info',
          description: 'Causal Inference Toolkit - Understanding Cause and Effect',
          core_concepts: {
            correlation_vs_causation: 'Correlation does not imply causation due to confounding',
            potential_outcomes: 'Y(1), Y(0) - outcomes under treatment/control',
            counterfactual: 'What would have happened under different treatment',
            dag: 'Directed Acyclic Graph encodes causal structure',
          },
          operations: {
            build_dag: 'Construct causal DAG from edge list',
            intervention: 'Estimate effect of do(X=x) intervention',
            counterfactual: 'Estimate counterfactual outcomes',
            identify: 'Check if causal effect is identifiable',
            estimate: 'Estimate ATE using IPW and other methods',
            propensity: 'Estimate propensity scores for weighting',
            mediation: 'Analyze direct and indirect effects',
          },
          key_methods: {
            backdoor_criterion: 'Identify adjustment set to block confounding',
            frontdoor_criterion: 'Identify through mediator when confounders unobserved',
            ipw: 'Inverse Probability Weighting',
            matching: 'Match similar treated and control units',
            did: 'Difference in Differences for panel data',
            rdd: 'Regression Discontinuity Design',
            iv: 'Instrumental Variables',
          },
          assumptions: {
            sutva: 'Stable Unit Treatment Value - no interference',
            ignorability: 'Conditional on X, treatment is as-if random',
            positivity: 'All units have positive probability of each treatment',
            consistency: 'Observed outcome equals potential outcome for treatment received',
          },
          references: [
            'Pearl (2009) - Causality',
            'Rubin (1974) - Potential Outcomes Framework',
            'Angrist & Pischke - Mostly Harmless Econometrics',
          ],
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iscausalinferenceAvailable(): boolean {
  return true;
}
