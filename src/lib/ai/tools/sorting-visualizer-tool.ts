/**
 * SORTING VISUALIZER TOOL
 *
 * Educational sorting algorithm visualization with step-by-step execution.
 *
 * Part of TIER EDUCATION - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface SortStep {
  array: number[];
  comparing?: [number, number];
  swapping?: [number, number];
  sorted?: number[];
  description: string;
}

function bubbleSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;

  steps.push({ array: [...a], description: 'Initial array' });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      steps.push({ array: [...a], comparing: [j, j + 1], description: `Compare ${a[j]} and ${a[j + 1]}` });
      if (a[j] > a[j + 1]) {
        const temp = a[j];
        a[j] = a[j + 1];
        a[j + 1] = temp;
        steps.push({ array: [...a], swapping: [j, j + 1], description: `Swap ${a[j]} and ${a[j + 1]}` });
      }
    }
  }
  steps.push({ array: [...a], sorted: Array.from({length: n}, (_, k) => k), description: 'Sorted!' });
  return steps;
}

function selectionSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;

  steps.push({ array: [...a], description: 'Initial array' });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      steps.push({ array: [...a], comparing: [minIdx, j], description: `Compare min(${a[minIdx]}) with ${a[j]}` });
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) {
      const temp = a[i];
      a[i] = a[minIdx];
      a[minIdx] = temp;
      steps.push({ array: [...a], swapping: [i, minIdx], description: `Swap to position ${i}` });
    }
  }
  steps.push({ array: [...a], sorted: Array.from({length: n}, (_, k) => k), description: 'Sorted!' });
  return steps;
}

function insertionSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;

  steps.push({ array: [...a], description: 'Initial array' });

  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;

    while (j >= 0 && a[j] > key) {
      steps.push({ array: [...a], comparing: [j, j + 1], description: `Shift ${a[j]} right` });
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
    steps.push({ array: [...a], description: `Inserted ${key}` });
  }
  steps.push({ array: [...a], sorted: Array.from({length: n}, (_, k) => k), description: 'Sorted!' });
  return steps;
}

function visualizeStep(step: SortStep, maxVal: number): string {
  const lines: string[] = [];

  for (let h = 5; h >= 1; h--) {
    let row = '';
    for (let i = 0; i < step.array.length; i++) {
      const barHeight = Math.ceil((step.array[i] / maxVal) * 5);
      if (barHeight >= h) {
        if (step.swapping?.includes(i)) row += '█ ';
        else if (step.comparing?.includes(i)) row += '▓ ';
        else if (step.sorted?.includes(i)) row += '░ ';
        else row += '│ ';
      } else {
        row += '  ';
      }
    }
    lines.push(row);
  }

  lines.push('─'.repeat(step.array.length * 2));
  lines.push(step.array.join(' '));
  lines.push(step.description);

  return lines.join('\n');
}

export const sortingVisualizerTool: UnifiedTool = {
  name: 'sorting_visualizer',
  description: `Educational sorting algorithm visualizer.

Operations:
- bubble: Bubble sort O(n²)
- selection: Selection sort O(n²)
- insertion: Insertion sort O(n²)
- compare: Compare all algorithms`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bubble', 'selection', 'insertion', 'compare'],
        description: 'Sorting algorithm',
      },
      array: { type: 'string', description: 'Array as JSON [3,1,4]' },
    },
    required: ['operation'],
  },
};

export async function executeSortingVisualizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const arrayStr = args.array || '[5, 3, 8, 4, 2]';
    const arr: number[] = JSON.parse(arrayStr);
    const maxVal = Math.max(...arr);

    let result: Record<string, unknown>;

    if (operation === 'compare') {
      const algos = ['bubble', 'selection', 'insertion'];
      const comparison = algos.map(algo => {
        const sortFn = { bubble: bubbleSort, selection: selectionSort, insertion: insertionSort }[algo]!;
        const steps = sortFn([...arr]);
        return { algorithm: algo, steps: steps.length, swaps: steps.filter(s => s.swapping).length };
      });
      result = { operation: 'compare', input: arr, results: comparison };
    } else {
      const sortFn = { bubble: bubbleSort, selection: selectionSort, insertion: insertionSort }[operation];
      if (!sortFn) throw new Error(`Unknown: ${operation}`);

      const steps = sortFn([...arr]);
      const keySteps = [steps[0], steps[Math.floor(steps.length / 2)], steps[steps.length - 1]];

      result = {
        operation,
        input: arr,
        total_steps: steps.length,
        visualizations: keySteps.map(s => visualizeStep(s, maxVal)),
        final: steps[steps.length - 1].array,
      };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isSortingVisualizerAvailable(): boolean { return true; }
