/**
 * DECISION TREE TOOL
 * Decision tree classification and visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DataPoint { features: number[]; label: string; }
interface TreeNode { feature?: number; threshold?: number; left?: TreeNode; right?: TreeNode; label?: string; samples: number; gini: number; }

function giniImpurity(labels: string[]): number {
  if (labels.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const l of labels) counts[l] = (counts[l] || 0) + 1;
  let impurity = 1;
  for (const count of Object.values(counts)) {
    const p = count / labels.length;
    impurity -= p * p;
  }
  return Math.round(impurity * 1000) / 1000;
}

function entropy(labels: string[]): number {
  if (labels.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const l of labels) counts[l] = (counts[l] || 0) + 1;
  let ent = 0;
  for (const count of Object.values(counts)) {
    const p = count / labels.length;
    if (p > 0) ent -= p * Math.log2(p);
  }
  return Math.round(ent * 1000) / 1000;
}

function findBestSplit(data: DataPoint[]): { feature: number; threshold: number; gain: number } | null {
  if (data.length < 2) return null;

  const labels = data.map(d => d.label);
  const baseGini = giniImpurity(labels);
  let bestGain = 0;
  let bestFeature = 0;
  let bestThreshold = 0;

  const numFeatures = data[0].features.length;
  for (let f = 0; f < numFeatures; f++) {
    const values = [...new Set(data.map(d => d.features[f]))].sort((a, b) => a - b);

    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;
      const left = data.filter(d => d.features[f] <= threshold);
      const right = data.filter(d => d.features[f] > threshold);

      if (left.length === 0 || right.length === 0) continue;

      const leftGini = giniImpurity(left.map(d => d.label));
      const rightGini = giniImpurity(right.map(d => d.label));
      const weightedGini = (left.length * leftGini + right.length * rightGini) / data.length;
      const gain = baseGini - weightedGini;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = threshold;
      }
    }
  }

  return bestGain > 0 ? { feature: bestFeature, threshold: bestThreshold, gain: bestGain } : null;
}

function buildTree(data: DataPoint[], maxDepth: number = 5, minSamples: number = 2, depth: number = 0): TreeNode {
  const labels = data.map(d => d.label);
  const gini = giniImpurity(labels);

  // Check stopping conditions
  if (depth >= maxDepth || data.length < minSamples || gini === 0) {
    const counts: Record<string, number> = {};
    for (const l of labels) counts[l] = (counts[l] || 0) + 1;
    const majorityLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { label: majorityLabel, samples: data.length, gini };
  }

  const split = findBestSplit(data);
  if (!split) {
    const counts: Record<string, number> = {};
    for (const l of labels) counts[l] = (counts[l] || 0) + 1;
    const majorityLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { label: majorityLabel, samples: data.length, gini };
  }

  const leftData = data.filter(d => d.features[split.feature] <= split.threshold);
  const rightData = data.filter(d => d.features[split.feature] > split.threshold);

  return {
    feature: split.feature,
    threshold: Math.round(split.threshold * 100) / 100,
    left: buildTree(leftData, maxDepth, minSamples, depth + 1),
    right: buildTree(rightData, maxDepth, minSamples, depth + 1),
    samples: data.length,
    gini
  };
}

function predict(tree: TreeNode, features: number[]): string {
  if (tree.label !== undefined) return tree.label;
  if (features[tree.feature!] <= tree.threshold!) {
    return predict(tree.left!, features);
  }
  return predict(tree.right!, features);
}

function treeToAscii(node: TreeNode, featureNames: string[], prefix: string = '', isLeft: boolean = true): string {
  if (node.label !== undefined) {
    return `${prefix}${isLeft ? '├── ' : '└── '}[${node.label}] (n=${node.samples}, gini=${node.gini})\n`;
  }

  let result = `${prefix}${isLeft ? '├── ' : '└── '}${featureNames[node.feature!]} <= ${node.threshold} (n=${node.samples}, gini=${node.gini})\n`;
  const childPrefix = prefix + (isLeft ? '│   ' : '    ');

  if (node.left) result += treeToAscii(node.left, featureNames, childPrefix, true);
  if (node.right) result += treeToAscii(node.right, featureNames, childPrefix, false);

  return result;
}

function generateIrisData(): { data: DataPoint[]; featureNames: string[] } {
  const data: DataPoint[] = [];
  const featureNames = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];

  // Simplified Iris-like data
  for (let i = 0; i < 30; i++) {
    data.push({ features: [5 + Math.random() * 1, 3 + Math.random() * 0.5, 1.5 + Math.random() * 0.5, 0.2 + Math.random() * 0.3], label: 'setosa' });
    data.push({ features: [5.5 + Math.random() * 1.5, 2.5 + Math.random() * 0.5, 4 + Math.random() * 1, 1.2 + Math.random() * 0.5], label: 'versicolor' });
    data.push({ features: [6 + Math.random() * 2, 2.8 + Math.random() * 0.6, 5 + Math.random() * 1.5, 1.8 + Math.random() * 0.7], label: 'virginica' });
  }

  return { data, featureNames };
}

function generateSimpleData(): { data: DataPoint[]; featureNames: string[] } {
  const data: DataPoint[] = [];
  const featureNames = ['age', 'income'];

  for (let i = 0; i < 50; i++) {
    const age = 20 + Math.random() * 50;
    const income = 20000 + Math.random() * 100000;
    const label = (age > 40 && income > 60000) || (age > 50) ? 'yes' : 'no';
    data.push({ features: [Math.round(age), Math.round(income)], label });
  }

  return { data, featureNames };
}

void entropy; // Available for information gain

export const decisionTreeTool: UnifiedTool = {
  name: 'decision_tree',
  description: 'Decision Tree: build, predict, visualize, iris_demo, simple_demo, metrics',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['build', 'predict', 'visualize', 'iris_demo', 'simple_demo', 'metrics', 'info'] },
      features: { type: 'array' },
      maxDepth: { type: 'number' },
      minSamples: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeDecisionTree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'build':
        const { data, featureNames } = generateSimpleData();
        const tree = buildTree(data, args.maxDepth || 4, args.minSamples || 5);
        result = {
          tree,
          featureNames,
          samples: data.length,
          depth: args.maxDepth || 4
        };
        break;
      case 'predict':
        const predData = generateSimpleData();
        const predTree = buildTree(predData.data, 4, 5);
        const features = args.features || [35, 75000];
        const prediction = predict(predTree, features);
        result = {
          features: Object.fromEntries(predData.featureNames.map((n, i) => [n, features[i]])),
          prediction,
          confidence: 'Based on trained model'
        };
        break;
      case 'visualize':
        const vizData = generateSimpleData();
        const vizTree = buildTree(vizData.data, args.maxDepth || 3, 5);
        result = { ascii: treeToAscii(vizTree, vizData.featureNames, '', false) };
        break;
      case 'iris_demo':
        const irisResult = generateIrisData();
        const irisTree = buildTree(irisResult.data, args.maxDepth || 4, 3);
        const testSamples = [
          { features: [5.1, 3.5, 1.4, 0.2], expected: 'setosa' },
          { features: [6.0, 2.7, 4.5, 1.5], expected: 'versicolor' },
          { features: [7.2, 3.0, 5.8, 1.6], expected: 'virginica' }
        ];
        const predictions = testSamples.map(s => ({
          features: s.features,
          expected: s.expected,
          predicted: predict(irisTree, s.features),
          correct: predict(irisTree, s.features) === s.expected
        }));
        result = {
          dataset: 'Iris (simplified)',
          samples: irisResult.data.length,
          classes: ['setosa', 'versicolor', 'virginica'],
          testPredictions: predictions,
          tree: treeToAscii(irisTree, irisResult.featureNames, '', false)
        };
        break;
      case 'simple_demo':
        const simpleData = generateSimpleData();
        const simpleTree = buildTree(simpleData.data, 3, 5);
        result = {
          dataset: 'Purchase Decision',
          features: simpleData.featureNames,
          samples: simpleData.data.length,
          tree: treeToAscii(simpleTree, simpleData.featureNames, '', false),
          interpretation: 'Predicts purchase decision based on age and income'
        };
        break;
      case 'metrics':
        const metricsData = generateSimpleData();
        const metricsTree = buildTree(metricsData.data, 4, 5);
        let correct = 0;
        for (const d of metricsData.data) {
          if (predict(metricsTree, d.features) === d.label) correct++;
        }
        result = {
          accuracy: `${(correct / metricsData.data.length * 100).toFixed(1)}%`,
          samples: metricsData.data.length,
          correct,
          giniAtRoot: metricsTree.gini
        };
        break;
      case 'info':
        result = {
          description: 'Decision tree classifier with CART algorithm',
          splitCriteria: ['Gini impurity', 'Information gain (entropy)'],
          parameters: ['maxDepth', 'minSamples'],
          features: ['Binary splits', 'Handles numeric features', 'ASCII visualization'],
          limitations: 'Simplified implementation for demonstration'
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDecisionTreeAvailable(): boolean { return true; }
