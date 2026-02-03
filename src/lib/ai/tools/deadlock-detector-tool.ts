/**
 * DEADLOCK-DETECTOR TOOL
 * Deadlock detection and prevention algorithms
 *
 * Implements:
 * - Resource Allocation Graph (RAG) analysis
 * - Cycle detection for deadlock identification
 * - Banker's Algorithm for deadlock avoidance
 * - Wait-for Graph construction
 * - Safe sequence computation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Process state
interface Process {
  id: string;
  allocation: number[]; // Currently allocated resources
  max: number[]; // Maximum resource need
  need?: number[]; // Max - Allocation
}

// System state for Banker's Algorithm
interface SystemState {
  available: number[];
  processes: Process[];
  resourceNames: string[];
}

// Resource Allocation Graph edge
interface RAGEdge {
  from: string;
  to: string;
  type: 'request' | 'assignment';
}

// Wait-for Graph
interface WaitForGraph {
  processes: string[];
  edges: { from: string; to: string }[];
}

// Compute need matrix
function computeNeed(processes: Process[]): Process[] {
  return processes.map((p) => ({
    ...p,
    need: p.max.map((m, i) => m - p.allocation[i]),
  }));
}

// Check if process can be satisfied with available resources
function canSatisfy(need: number[], available: number[]): boolean {
  return need.every((n, i) => n <= available[i]);
}

// Banker's Algorithm - find safe sequence
function bankersAlgorithm(state: SystemState): {
  isSafe: boolean;
  safeSequence: string[];
  trace: { step: number; process: string; available: number[]; reason?: string }[];
} {
  const processes = computeNeed(state.processes);
  const n = processes.length;
  const m = state.available.length;

  const work = [...state.available];
  const finish = new Array(n).fill(false);
  const safeSequence: string[] = [];
  const trace: { step: number; process: string; available: number[]; reason?: string }[] = [];

  let found = true;
  let step = 0;

  while (found) {
    found = false;

    for (let i = 0; i < n; i++) {
      if (!finish[i] && canSatisfy(processes[i].need!, work)) {
        // Process can complete
        finish[i] = true;
        safeSequence.push(processes[i].id);

        // Release resources
        const newWork = work.map((w, j) => w + processes[i].allocation[j]);

        trace.push({
          step: step++,
          process: processes[i].id,
          available: [...newWork],
          reason: `Process ${processes[i].id} completes, releases resources`,
        });

        for (let j = 0; j < m; j++) {
          work[j] = newWork[j];
        }

        found = true;
        break;
      }
    }
  }

  // Check if all processes finished
  const isSafe = finish.every((f) => f);

  if (!isSafe) {
    const blocked = processes.filter((_p, i) => !finish[i]).map((proc) => proc.id);
    trace.push({
      step,
      process: 'DEADLOCK',
      available: [...work],
      reason: `Processes ${blocked.join(', ')} cannot proceed - potential deadlock`,
    });
  }

  return { isSafe, safeSequence, trace };
}

// Check if a request can be granted safely
function requestResources(
  state: SystemState,
  processId: string,
  request: number[]
): {
  granted: boolean;
  reason: string;
  newState?: SystemState;
} {
  const processIdx = state.processes.findIndex((p) => p.id === processId);

  if (processIdx === -1) {
    return { granted: false, reason: `Process ${processId} not found` };
  }

  const process = state.processes[processIdx];
  const need = process.max.map((m, i) => m - process.allocation[i]);

  // Check if request exceeds need
  for (let i = 0; i < request.length; i++) {
    if (request[i] > need[i]) {
      return {
        granted: false,
        reason: `Request exceeds declared maximum need for resource ${state.resourceNames[i]}`,
      };
    }
  }

  // Check if request exceeds available
  for (let i = 0; i < request.length; i++) {
    if (request[i] > state.available[i]) {
      return {
        granted: false,
        reason: `Insufficient ${state.resourceNames[i]} available (requested: ${request[i]}, available: ${state.available[i]})`,
      };
    }
  }

  // Try granting the request
  const newAvailable = state.available.map((a, i) => a - request[i]);
  const newProcesses = state.processes.map((p, idx) => {
    if (idx === processIdx) {
      return {
        ...p,
        allocation: p.allocation.map((a, i) => a + request[i]),
      };
    }
    return p;
  });

  const newState: SystemState = {
    available: newAvailable,
    processes: newProcesses,
    resourceNames: state.resourceNames,
  };

  // Check if new state is safe
  const safetyCheck = bankersAlgorithm(newState);

  if (safetyCheck.isSafe) {
    return {
      granted: true,
      reason: 'Request granted - system remains in safe state',
      newState,
    };
  } else {
    return {
      granted: false,
      reason: 'Request denied - would result in unsafe state',
    };
  }
}

// Detect cycle in Resource Allocation Graph using DFS
function detectCycleRAG(
  edges: RAGEdge[],
  processes: string[],
  resources: string[]
): {
  hasCycle: boolean;
  cycle?: string[];
} {
  // Build adjacency list
  const graph = new Map<string, string[]>();

  for (const node of [...processes, ...resources]) {
    graph.set(node, []);
  }

  for (const edge of edges) {
    const neighbors = graph.get(edge.from) || [];
    neighbors.push(edge.to);
    graph.set(edge.from, neighbors);
  }

  // DFS for cycle detection
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();

  for (const node of graph.keys()) {
    color.set(node, WHITE);
  }

  const dfs = (node: string, path: string[]): string[] | null => {
    color.set(node, GRAY);

    for (const neighbor of graph.get(node) || []) {
      if (color.get(neighbor) === GRAY) {
        // Back edge found - cycle detected
        const cycleStart = path.indexOf(neighbor);
        return [...path.slice(cycleStart), neighbor];
      }

      if (color.get(neighbor) === WHITE) {
        const result = dfs(neighbor, [...path, neighbor]);
        if (result) return result;
      }
    }

    color.set(node, BLACK);
    return null;
  };

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node, [node]);
      if (cycle) {
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false };
}

// Build Wait-For Graph from RAG
function buildWaitForGraph(
  edges: RAGEdge[],
  processes: string[],
  _resources: string[]
): WaitForGraph {
  const wfgEdges: { from: string; to: string }[] = [];

  // Find which process holds each resource
  const resourceHolder = new Map<string, string>();
  for (const edge of edges) {
    if (edge.type === 'assignment') {
      // Assignment edge: resource -> process
      resourceHolder.set(edge.from, edge.to);
    }
  }

  // For each request edge, add wait-for edge
  for (const edge of edges) {
    if (edge.type === 'request') {
      // Request edge: process -> resource
      const holder = resourceHolder.get(edge.to);
      if (holder && holder !== edge.from) {
        wfgEdges.push({ from: edge.from, to: holder });
      }
    }
  }

  return {
    processes,
    edges: wfgEdges,
  };
}

// Detect deadlock in Wait-For Graph
function detectDeadlockWFG(wfg: WaitForGraph): {
  hasDeadlock: boolean;
  deadlockedProcesses: string[];
} {
  const graph = new Map<string, string[]>();

  for (const p of wfg.processes) {
    graph.set(p, []);
  }

  for (const edge of wfg.edges) {
    const neighbors = graph.get(edge.from) || [];
    neighbors.push(edge.to);
    graph.set(edge.from, neighbors);
  }

  // Find strongly connected components (simplified for small graphs)
  const visited = new Set<string>();
  const deadlocked = new Set<string>();

  const findCycle = (start: string, current: string, path: Set<string>): boolean => {
    if (path.has(current)) {
      // Cycle found
      for (const p of path) {
        deadlocked.add(p);
      }
      return true;
    }

    if (visited.has(current)) return false;

    path.add(current);

    for (const neighbor of graph.get(current) || []) {
      if (findCycle(start, neighbor, new Set(path))) {
        deadlocked.add(current);
        return true;
      }
    }

    return false;
  };

  for (const process of wfg.processes) {
    if (!visited.has(process)) {
      findCycle(process, process, new Set());
      visited.add(process);
    }
  }

  return {
    hasDeadlock: deadlocked.size > 0,
    deadlockedProcesses: [...deadlocked],
  };
}

// Generate demo system state
function generateDemoState(): SystemState {
  return {
    available: [3, 3, 2],
    resourceNames: ['A', 'B', 'C'],
    processes: [
      { id: 'P0', allocation: [0, 1, 0], max: [7, 5, 3] },
      { id: 'P1', allocation: [2, 0, 0], max: [3, 2, 2] },
      { id: 'P2', allocation: [3, 0, 2], max: [9, 0, 2] },
      { id: 'P3', allocation: [2, 1, 1], max: [2, 2, 2] },
      { id: 'P4', allocation: [0, 0, 2], max: [4, 3, 3] },
    ],
  };
}

// Generate deadlock scenario
function generateDeadlockScenario(): {
  edges: RAGEdge[];
  processes: string[];
  resources: string[];
} {
  return {
    processes: ['P1', 'P2', 'P3'],
    resources: ['R1', 'R2', 'R3'],
    edges: [
      { from: 'R1', to: 'P1', type: 'assignment' }, // P1 holds R1
      { from: 'P1', to: 'R2', type: 'request' }, // P1 requests R2
      { from: 'R2', to: 'P2', type: 'assignment' }, // P2 holds R2
      { from: 'P2', to: 'R3', type: 'request' }, // P2 requests R3
      { from: 'R3', to: 'P3', type: 'assignment' }, // P3 holds R3
      { from: 'P3', to: 'R1', type: 'request' }, // P3 requests R1 -> CYCLE
    ],
  };
}

export const deadlockdetectorTool: UnifiedTool = {
  name: 'deadlock_detector',
  description:
    "Deadlock detection and prevention - Banker's Algorithm, RAG analysis, Wait-For Graph",
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bankers', 'request', 'rag_cycle', 'wait_for', 'demo', 'info', 'examples'],
        description: 'Operation to perform',
      },
      state: { type: 'object', description: 'System state {available, processes, resourceNames}' },
      processId: { type: 'string', description: 'Process ID for resource request' },
      request: { type: 'array', items: { type: 'number' }, description: 'Resource request vector' },
      edges: { type: 'array', description: 'RAG edges array' },
      processes: { type: 'array', items: { type: 'string' }, description: 'Process list' },
      resources: { type: 'array', items: { type: 'string' }, description: 'Resource list' },
    },
    required: ['operation'],
  },
};

export async function executedeadlockdetector(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            tool: 'deadlock-detector',
            description: 'Deadlock detection and avoidance algorithms',
            algorithms: {
              bankers: {
                name: "Banker's Algorithm",
                description: 'Deadlock avoidance by finding safe sequence',
                complexity: 'O(n^2 * m) where n=processes, m=resources',
              },
              rag: {
                name: 'Resource Allocation Graph',
                description: 'Graph-based deadlock detection via cycle finding',
                complexity: 'O(n + e) where e=edges',
              },
              waitFor: {
                name: 'Wait-For Graph',
                description: 'Simplified RAG for single-instance resources',
              },
            },
            concepts: {
              safeState: 'System state where at least one safe sequence exists',
              safeSequence: 'Order in which all processes can complete',
              deadlock: 'Circular wait condition among processes',
            },
            operations: ['bankers', 'request', 'rag_cycle', 'wait_for', 'demo', 'info', 'examples'],
          },
          null,
          2
        ),
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            examples: [
              {
                description: "Run Banker's Algorithm on demo state",
                call: { operation: 'demo' },
              },
              {
                description: 'Check resource request safety',
                call: { operation: 'request', processId: 'P1', request: [1, 0, 2] },
              },
              {
                description: 'Detect cycle in RAG',
                call: { operation: 'rag_cycle' },
              },
              {
                description: 'Build and analyze Wait-For Graph',
                call: { operation: 'wait_for' },
              },
            ],
          },
          null,
          2
        ),
      };
    }

    if (operation === 'demo' || operation === 'bankers') {
      const state = args.state || generateDemoState();

      const result = bankersAlgorithm(state);

      // Compute need matrix for display
      const processesWithNeed = computeNeed(state.processes);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            algorithm: "Banker's Algorithm",
            systemState: {
              resources: state.resourceNames,
              totalAvailable: state.available,
              processes: processesWithNeed.map((p) => ({
                id: p.id,
                allocation: p.allocation,
                maximum: p.max,
                need: p.need,
              })),
            },
            analysis: {
              isSafe: result.isSafe,
              safeSequence: result.isSafe ? result.safeSequence : null,
              message: result.isSafe
                ? `Safe state - sequence: ${result.safeSequence.join(' -> ')}`
                : 'Unsafe state - no safe sequence exists',
            },
            executionTrace: result.trace,
          },
          null,
          2
        ),
      };
    }

    if (operation === 'request') {
      const state = args.state || generateDemoState();
      const processId = args.processId || 'P1';
      const request = args.request || [1, 0, 2];

      const result = requestResources(state, processId, request);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'resource_request',
            process: processId,
            request,
            resourceNames: state.resourceNames,
            result: {
              granted: result.granted,
              reason: result.reason,
            },
            newAvailable: result.newState?.available,
          },
          null,
          2
        ),
      };
    }

    if (operation === 'rag_cycle') {
      const scenario = args.edges
        ? {
            edges: args.edges,
            processes: args.processes || [],
            resources: args.resources || [],
          }
        : generateDeadlockScenario();

      const cycleResult = detectCycleRAG(scenario.edges, scenario.processes, scenario.resources);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            algorithm: 'Resource Allocation Graph Cycle Detection',
            graph: {
              processes: scenario.processes,
              resources: scenario.resources,
              edges: scenario.edges.map((e: RAGEdge) => ({
                ...e,
                description:
                  e.type === 'assignment'
                    ? `${e.from} is held by ${e.to}`
                    : `${e.from} requests ${e.to}`,
              })),
            },
            analysis: {
              hasCycle: cycleResult.hasCycle,
              cycle: cycleResult.cycle,
              conclusion: cycleResult.hasCycle
                ? `DEADLOCK DETECTED: ${cycleResult.cycle?.join(' -> ')}`
                : 'No deadlock - no cycle in RAG',
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'wait_for') {
      const scenario = args.edges
        ? {
            edges: args.edges,
            processes: args.processes || [],
            resources: args.resources || [],
          }
        : generateDeadlockScenario();

      const wfg = buildWaitForGraph(scenario.edges, scenario.processes, scenario.resources);
      const deadlockResult = detectDeadlockWFG(wfg);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            algorithm: 'Wait-For Graph Analysis',
            waitForGraph: {
              processes: wfg.processes,
              edges: wfg.edges.map((e) => `${e.from} waits for ${e.to}`),
            },
            analysis: {
              hasDeadlock: deadlockResult.hasDeadlock,
              deadlockedProcesses: deadlockResult.deadlockedProcesses,
              conclusion: deadlockResult.hasDeadlock
                ? `DEADLOCK: Processes ${deadlockResult.deadlockedProcesses.join(', ')} are in circular wait`
                : 'No deadlock detected',
            },
          },
          null,
          2
        ),
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdeadlockdetectorAvailable(): boolean {
  return true;
}
