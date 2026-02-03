/**
 * GOSSIP-PROTOCOL TOOL
 * Comprehensive gossip/epidemic protocol implementation for distributed systems
 * Supports: push, pull, push-pull gossip, failure detection, anti-entropy, CRDTs
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type NodeStatus = 'alive' | 'suspected' | 'dead' | 'left';
type GossipMode = 'push' | 'pull' | 'push-pull';

interface NodeState {
  id: string;
  address: string;
  status: NodeStatus;
  heartbeat: number;
  lastUpdate: number;
  metadata: Record<string, unknown>;
  version: number;
  suspicionLevel: number;
  incarnation: number;
}

interface GossipMessage {
  id: string;
  type: 'rumor' | 'anti-entropy' | 'membership' | 'crdt-sync';
  senderId: string;
  payload: unknown;
  timestamp: number;
  ttl: number;
  version: number;
}

interface Cluster {
  id: string;
  selfId: string;
  nodes: Map<string, NodeState>;
  rumors: Map<string, RumorState>;
  gossipMode: GossipMode;
  fanout: number;
  gossipInterval: number;
  suspicionTimeout: number;
  deadTimeout: number;
  crdtState: Map<string, CRDTValue>;
  messageLog: GossipMessage[];
  partitions: Set<string>[];
  convergenceHistory: ConvergencePoint[];
}

interface RumorState {
  id: string;
  content: unknown;
  originNode: string;
  createdAt: number;
  infectedNodes: Set<string>;
  version: number;
}

interface CRDTValue {
  type: 'g-counter' | 'pn-counter' | 'lww-register' | 'or-set';
  value: unknown;
  vectorClock: Map<string, number>;
  lastUpdate: number;
}

interface ConvergencePoint {
  timestamp: number;
  rumorId: string;
  coveredNodes: number;
  totalNodes: number;
  percentage: number;
}

interface PropagationSimulation {
  rumorId: string;
  rounds: PropagationRound[];
  convergenceRound: number | null;
  totalMessages: number;
  convergenceTime: number;
}

interface PropagationRound {
  round: number;
  infectedCount: number;
  newInfections: string[];
  messages: number;
  coverage: number;
}

interface FailureDetectionResult {
  suspected: string[];
  confirmed: string[];
  healthy: string[];
  phiValues: Map<string, number>;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const clusters: Map<string, Cluster> = new Map();

// ============================================================================
// GOSSIP CLUSTER OPERATIONS
// ============================================================================

function initCluster(config: {
  clusterId: string;
  selfId: string;
  selfAddress: string;
  nodes?: Array<{ id: string; address: string; metadata?: Record<string, unknown> }>;
  gossipMode?: GossipMode;
  fanout?: number;
  gossipInterval?: number;
  suspicionTimeout?: number;
  deadTimeout?: number;
}): Cluster {
  const clusterId = config.clusterId;
  const fanout = config.fanout || 3;
  const gossipMode = config.gossipMode || 'push-pull';

  const cluster: Cluster = {
    id: clusterId,
    selfId: config.selfId,
    nodes: new Map(),
    rumors: new Map(),
    gossipMode,
    fanout,
    gossipInterval: config.gossipInterval || 1000,
    suspicionTimeout: config.suspicionTimeout || 5000,
    deadTimeout: config.deadTimeout || 30000,
    crdtState: new Map(),
    messageLog: [],
    partitions: [],
    convergenceHistory: [],
  };

  // Add self node
  cluster.nodes.set(config.selfId, {
    id: config.selfId,
    address: config.selfAddress,
    status: 'alive',
    heartbeat: Date.now(),
    lastUpdate: Date.now(),
    metadata: {},
    version: 1,
    suspicionLevel: 0,
    incarnation: 0,
  });

  // Add initial nodes
  if (config.nodes) {
    for (const node of config.nodes) {
      cluster.nodes.set(node.id, {
        id: node.id,
        address: node.address,
        status: 'alive',
        heartbeat: Date.now(),
        lastUpdate: Date.now(),
        metadata: node.metadata || {},
        version: 1,
        suspicionLevel: 0,
        incarnation: 0,
      });
    }
  }

  clusters.set(clusterId, cluster);
  return cluster;
}

function selectGossipTargets(cluster: Cluster, excludeNodes?: Set<string>): string[] {
  const candidates: string[] = [];

  for (const [nodeId, node] of cluster.nodes) {
    if (nodeId !== cluster.selfId && node.status === 'alive' && !excludeNodes?.has(nodeId)) {
      candidates.push(nodeId);
    }
  }

  // Shuffle and select fanout number of targets
  shuffleArray(candidates);
  return candidates.slice(0, Math.min(cluster.fanout, candidates.length));
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============================================================================
// GOSSIP OPERATIONS
// ============================================================================

function gossip(
  clusterId: string,
  options?: {
    rumorId?: string;
    content?: unknown;
    mode?: GossipMode;
    targetNodes?: string[];
  }
): {
  messagesSent: number;
  targets: string[];
  mode: GossipMode;
  rumorId?: string;
  responses: Array<{ nodeId: string; status: string }>;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const mode = options?.mode || cluster.gossipMode;
  const targets = options?.targetNodes || selectGossipTargets(cluster);

  // Update self heartbeat
  const selfNode = cluster.nodes.get(cluster.selfId)!;
  selfNode.heartbeat = Date.now();
  selfNode.version++;

  const responses: Array<{ nodeId: string; status: string }> = [];
  let rumorId = options?.rumorId;

  // Create rumor if content provided
  if (options?.content && !rumorId) {
    rumorId = `rumor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cluster.rumors.set(rumorId, {
      id: rumorId,
      content: options.content,
      originNode: cluster.selfId,
      createdAt: Date.now(),
      infectedNodes: new Set([cluster.selfId]),
      version: 1,
    });
  }

  for (const targetId of targets) {
    const targetNode = cluster.nodes.get(targetId);
    if (!targetNode) continue;

    // Create gossip message
    const message: GossipMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: rumorId ? 'rumor' : 'membership',
      senderId: cluster.selfId,
      payload: {
        membership: serializeMembership(cluster),
        rumorId,
        rumorContent: rumorId ? cluster.rumors.get(rumorId)?.content : undefined,
      },
      timestamp: Date.now(),
      ttl: 10,
      version: selfNode.version,
    };

    cluster.messageLog.push(message);

    // Simulate receiving at target
    if (mode === 'push' || mode === 'push-pull') {
      // Push: send our state
      if (rumorId) {
        const rumor = cluster.rumors.get(rumorId);
        if (rumor) {
          rumor.infectedNodes.add(targetId);
        }
      }
      targetNode.lastUpdate = Date.now();
      responses.push({ nodeId: targetId, status: 'received' });
    }

    if (mode === 'pull' || mode === 'push-pull') {
      // Pull: request state from target
      // Simulate getting response with target's state
      responses.push({ nodeId: targetId, status: 'responded' });
    }
  }

  // Track convergence
  if (rumorId) {
    const rumor = cluster.rumors.get(rumorId);
    if (rumor) {
      cluster.convergenceHistory.push({
        timestamp: Date.now(),
        rumorId,
        coveredNodes: rumor.infectedNodes.size,
        totalNodes: cluster.nodes.size,
        percentage: (rumor.infectedNodes.size / cluster.nodes.size) * 100,
      });
    }
  }

  return {
    messagesSent: targets.length * (mode === 'push-pull' ? 2 : 1),
    targets,
    mode,
    rumorId,
    responses,
  };
}

function receiveGossip(
  clusterId: string,
  message: {
    senderId: string;
    membership?: Array<{
      id: string;
      status: NodeStatus;
      heartbeat: number;
      version: number;
      incarnation: number;
    }>;
    rumorId?: string;
    rumorContent?: unknown;
  }
): {
  accepted: boolean;
  updates: Array<{ nodeId: string; change: string }>;
  newRumor: boolean;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const updates: Array<{ nodeId: string; change: string }> = [];
  let newRumor = false;

  // Update sender's state
  const senderNode = cluster.nodes.get(message.senderId);
  if (senderNode) {
    senderNode.lastUpdate = Date.now();
    senderNode.status = 'alive';
    senderNode.suspicionLevel = 0;
    updates.push({ nodeId: message.senderId, change: 'heartbeat_updated' });
  }

  // Process membership updates
  if (message.membership) {
    for (const memberInfo of message.membership) {
      const existingNode = cluster.nodes.get(memberInfo.id);

      if (!existingNode) {
        // New node discovered
        cluster.nodes.set(memberInfo.id, {
          id: memberInfo.id,
          address: `${memberInfo.id}.local`,
          status: memberInfo.status,
          heartbeat: memberInfo.heartbeat,
          lastUpdate: Date.now(),
          metadata: {},
          version: memberInfo.version,
          suspicionLevel: 0,
          incarnation: memberInfo.incarnation,
        });
        updates.push({ nodeId: memberInfo.id, change: 'discovered' });
      } else {
        // Update existing node if newer information
        if (
          memberInfo.incarnation > existingNode.incarnation ||
          (memberInfo.incarnation === existingNode.incarnation &&
            memberInfo.version > existingNode.version)
        ) {
          existingNode.status = memberInfo.status;
          existingNode.heartbeat = memberInfo.heartbeat;
          existingNode.version = memberInfo.version;
          existingNode.incarnation = memberInfo.incarnation;
          existingNode.lastUpdate = Date.now();
          updates.push({ nodeId: memberInfo.id, change: 'updated' });
        }
      }
    }
  }

  // Process rumor
  if (message.rumorId && message.rumorContent !== undefined) {
    let rumor = cluster.rumors.get(message.rumorId);
    if (!rumor) {
      rumor = {
        id: message.rumorId,
        content: message.rumorContent,
        originNode: message.senderId,
        createdAt: Date.now(),
        infectedNodes: new Set([message.senderId, cluster.selfId]),
        version: 1,
      };
      cluster.rumors.set(message.rumorId, rumor);
      newRumor = true;
    } else {
      rumor.infectedNodes.add(cluster.selfId);
    }
  }

  return {
    accepted: true,
    updates,
    newRumor,
  };
}

// ============================================================================
// FAILURE DETECTION
// ============================================================================

function detectFailures(
  clusterId: string,
  options?: {
    phiThreshold?: number;
    usePhiAccrual?: boolean;
  }
): FailureDetectionResult {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const now = Date.now();
  const phiThreshold = options?.phiThreshold || 8;
  const suspected: string[] = [];
  const confirmed: string[] = [];
  const healthy: string[] = [];
  const phiValues = new Map<string, number>();

  for (const [nodeId, node] of cluster.nodes) {
    if (nodeId === cluster.selfId) {
      healthy.push(nodeId);
      phiValues.set(nodeId, 0);
      continue;
    }

    const timeSinceLastUpdate = now - node.lastUpdate;

    // Calculate phi value (simplified phi accrual)
    const phi = calculatePhi(timeSinceLastUpdate, cluster.gossipInterval);
    phiValues.set(nodeId, phi);

    if (options?.usePhiAccrual) {
      if (phi >= phiThreshold * 2) {
        node.status = 'dead';
        confirmed.push(nodeId);
      } else if (phi >= phiThreshold) {
        node.status = 'suspected';
        node.suspicionLevel++;
        suspected.push(nodeId);
      } else {
        node.status = 'alive';
        node.suspicionLevel = 0;
        healthy.push(nodeId);
      }
    } else {
      // Simple timeout-based detection
      if (timeSinceLastUpdate > cluster.deadTimeout) {
        node.status = 'dead';
        confirmed.push(nodeId);
      } else if (timeSinceLastUpdate > cluster.suspicionTimeout) {
        node.status = 'suspected';
        node.suspicionLevel++;
        suspected.push(nodeId);
      } else {
        node.status = 'alive';
        node.suspicionLevel = 0;
        healthy.push(nodeId);
      }
    }
  }

  return { suspected, confirmed, healthy, phiValues };
}

function calculatePhi(timeSinceLastHeartbeat: number, expectedInterval: number): number {
  // Simplified phi accrual failure detector
  // In production, this would track heartbeat history for accurate calculation
  const mean = expectedInterval;
  const stdDev = expectedInterval * 0.5;

  const y = (timeSinceLastHeartbeat - mean) / stdDev;
  const cdf = 0.5 * (1 + erf(y / Math.sqrt(2)));

  return -Math.log10(1 - cdf);
}

function erf(x: number): number {
  // Approximation of error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// ============================================================================
// ANTI-ENTROPY
// ============================================================================

function runAntiEntropy(
  clusterId: string,
  targetNodeId?: string
): {
  synchronized: boolean;
  differences: Array<{ key: string; action: 'added' | 'updated' | 'removed' }>;
  messagesExchanged: number;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const target = targetNodeId || selectGossipTargets(cluster)[0];
  if (!target) {
    return { synchronized: false, differences: [], messagesExchanged: 0 };
  }

  // Simulate Merkle tree comparison
  const differences: Array<{ key: string; action: 'added' | 'updated' | 'removed' }> = [];

  // Compare membership state
  for (const [nodeId, _node] of cluster.nodes) {
    // Simulate detecting differences
    if (Math.random() < 0.1) {
      // 10% chance of difference
      differences.push({
        key: `node:${nodeId}`,
        action: Math.random() < 0.5 ? 'updated' : 'added',
      });
    }
  }

  // Compare CRDT state
  for (const [key] of cluster.crdtState) {
    if (Math.random() < 0.05) {
      differences.push({ key: `crdt:${key}`, action: 'updated' });
    }
  }

  const message: GossipMessage = {
    id: `ae_${Date.now()}`,
    type: 'anti-entropy',
    senderId: cluster.selfId,
    payload: { differences },
    timestamp: Date.now(),
    ttl: 1,
    version: 1,
  };

  cluster.messageLog.push(message);

  return {
    synchronized: differences.length === 0,
    differences,
    messagesExchanged: 2, // Request + response
  };
}

// ============================================================================
// PROPAGATION SIMULATION
// ============================================================================

function simulatePropagation(
  clusterId: string,
  options?: {
    rumorId?: string;
    content?: unknown;
    maxRounds?: number;
    mode?: GossipMode;
  }
): PropagationSimulation {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const maxRounds = options?.maxRounds || 20;
  const mode = options?.mode || cluster.gossipMode;
  const fanout = cluster.fanout;

  const rumorId = options?.rumorId || `sim_${Date.now()}`;
  const nodeIds = Array.from(cluster.nodes.keys());
  const totalNodes = nodeIds.length;

  // Track infection state
  const infected = new Set<string>([cluster.selfId]);
  const rounds: PropagationRound[] = [];
  let totalMessages = 0;
  let convergenceRound: number | null = null;

  for (let round = 1; round <= maxRounds; round++) {
    const newlyInfected: string[] = [];
    let roundMessages = 0;

    // Each infected node gossips
    const infectedList = Array.from(infected);
    for (const nodeId of infectedList) {
      // Select random targets
      const candidates = nodeIds.filter((n) => n !== nodeId);
      shuffleArray(candidates);
      const targets = candidates.slice(0, fanout);

      for (const target of targets) {
        roundMessages++;

        if (!infected.has(target)) {
          // Probability of infection based on mode
          let infectProb = 1.0;
          if (mode === 'pull') {
            // Pull: target must request
            infectProb = 0.5;
          }

          if (Math.random() < infectProb) {
            infected.add(target);
            newlyInfected.push(target);
          }
        }
      }
    }

    totalMessages += roundMessages;
    const coverage = (infected.size / totalNodes) * 100;

    rounds.push({
      round,
      infectedCount: infected.size,
      newInfections: newlyInfected,
      messages: roundMessages,
      coverage,
    });

    // Check for convergence
    if (infected.size === totalNodes && convergenceRound === null) {
      convergenceRound = round;
    }

    // Early termination if no new infections
    if (newlyInfected.length === 0 && round > 3) {
      break;
    }
  }

  return {
    rumorId,
    rounds,
    convergenceRound,
    totalMessages,
    convergenceTime: convergenceRound ? convergenceRound * cluster.gossipInterval : -1,
  };
}

function analyzeConvergence(clusterId: string): {
  averageConvergenceRounds: number;
  theoreticalBound: number;
  fanout: number;
  nodeCount: number;
  convergenceHistory: ConvergencePoint[];
  efficiency: number;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const n = cluster.nodes.size;
  const f = cluster.fanout;

  // Theoretical bound: O(log(n)) rounds for epidemic spread
  const theoreticalBound = Math.ceil(Math.log(n) / Math.log(f + 1));

  // Calculate average from history
  const completedConvergence = cluster.convergenceHistory.filter((c) => c.percentage >= 99);
  let avgRounds = theoreticalBound;

  if (completedConvergence.length >= 2) {
    // Estimate rounds from timestamps
    const roundTime = cluster.gossipInterval;
    const durations = [];
    for (let i = 1; i < completedConvergence.length; i++) {
      const duration = completedConvergence[i].timestamp - completedConvergence[i - 1].timestamp;
      durations.push(duration / roundTime);
    }
    avgRounds = durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  // Efficiency: how close to theoretical optimum
  const efficiency = theoreticalBound / Math.max(avgRounds, theoreticalBound);

  return {
    averageConvergenceRounds: avgRounds,
    theoreticalBound,
    fanout: f,
    nodeCount: n,
    convergenceHistory: cluster.convergenceHistory,
    efficiency,
  };
}

// ============================================================================
// MEMBERSHIP MANAGEMENT
// ============================================================================

function getMembership(clusterId: string): {
  selfId: string;
  totalNodes: number;
  aliveNodes: number;
  suspectedNodes: number;
  deadNodes: number;
  members: Array<{
    id: string;
    status: NodeStatus;
    address: string;
    lastUpdate: number;
    incarnation: number;
  }>;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const members: Array<{
    id: string;
    status: NodeStatus;
    address: string;
    lastUpdate: number;
    incarnation: number;
  }> = [];

  let aliveCount = 0;
  let suspectedCount = 0;
  let deadCount = 0;

  for (const [, node] of cluster.nodes) {
    members.push({
      id: node.id,
      status: node.status,
      address: node.address,
      lastUpdate: node.lastUpdate,
      incarnation: node.incarnation,
    });

    switch (node.status) {
      case 'alive':
        aliveCount++;
        break;
      case 'suspected':
        suspectedCount++;
        break;
      case 'dead':
      case 'left':
        deadCount++;
        break;
    }
  }

  return {
    selfId: cluster.selfId,
    totalNodes: cluster.nodes.size,
    aliveNodes: aliveCount,
    suspectedNodes: suspectedCount,
    deadNodes: deadCount,
    members,
  };
}

function joinCluster(
  clusterId: string,
  newNode: {
    id: string;
    address: string;
    metadata?: Record<string, unknown>;
  }
): { success: boolean; acknowledged: string[] } {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  if (cluster.nodes.has(newNode.id)) {
    throw new Error(`Node ${newNode.id} already in cluster`);
  }

  cluster.nodes.set(newNode.id, {
    id: newNode.id,
    address: newNode.address,
    status: 'alive',
    heartbeat: Date.now(),
    lastUpdate: Date.now(),
    metadata: newNode.metadata || {},
    version: 1,
    suspicionLevel: 0,
    incarnation: 0,
  });

  // Notify other nodes via gossip
  const { targets } = gossip(clusterId, {
    content: { type: 'join', nodeId: newNode.id },
  });

  return { success: true, acknowledged: targets };
}

function leaveCluster(
  clusterId: string,
  nodeId: string
): {
  success: boolean;
  notified: string[];
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const node = cluster.nodes.get(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  node.status = 'left';
  node.incarnation++;

  // Notify via gossip
  const { targets } = gossip(clusterId, {
    content: { type: 'leave', nodeId },
  });

  return { success: true, notified: targets };
}

// ============================================================================
// CRDT SYNCHRONIZATION
// ============================================================================

function syncCRDT(
  clusterId: string,
  key: string,
  crdtType: CRDTValue['type'],
  operation: {
    op: 'increment' | 'decrement' | 'set' | 'add' | 'remove';
    value?: unknown;
    nodeId?: string;
  }
): {
  key: string;
  newValue: unknown;
  merged: boolean;
  vectorClock: Record<string, number>;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  let crdt = cluster.crdtState.get(key);

  if (!crdt) {
    crdt = {
      type: crdtType,
      value: initCRDTValue(crdtType),
      vectorClock: new Map([[cluster.selfId, 0]]),
      lastUpdate: Date.now(),
    };
    cluster.crdtState.set(key, crdt);
  }

  // Increment vector clock
  const currentClock = crdt.vectorClock.get(cluster.selfId) || 0;
  crdt.vectorClock.set(cluster.selfId, currentClock + 1);
  crdt.lastUpdate = Date.now();

  // Apply operation
  const nodeId = operation.nodeId || cluster.selfId;

  switch (crdtType) {
    case 'g-counter': {
      const counter = crdt.value as Map<string, number>;
      const current = counter.get(nodeId) || 0;
      if (operation.op === 'increment') {
        counter.set(nodeId, current + (typeof operation.value === 'number' ? operation.value : 1));
      }
      break;
    }

    case 'pn-counter': {
      const pnCounter = crdt.value as { p: Map<string, number>; n: Map<string, number> };
      if (operation.op === 'increment') {
        const current = pnCounter.p.get(nodeId) || 0;
        pnCounter.p.set(
          nodeId,
          current + (typeof operation.value === 'number' ? operation.value : 1)
        );
      } else if (operation.op === 'decrement') {
        const current = pnCounter.n.get(nodeId) || 0;
        pnCounter.n.set(
          nodeId,
          current + (typeof operation.value === 'number' ? operation.value : 1)
        );
      }
      break;
    }

    case 'lww-register': {
      const register = crdt.value as { value: unknown; timestamp: number };
      if (operation.op === 'set') {
        register.value = operation.value;
        register.timestamp = Date.now();
      }
      break;
    }

    case 'or-set': {
      const orSet = crdt.value as Map<unknown, Set<string>>;
      if (operation.op === 'add') {
        const tag = `${nodeId}:${Date.now()}`;
        const existing = orSet.get(operation.value) || new Set();
        existing.add(tag);
        orSet.set(operation.value, existing);
      } else if (operation.op === 'remove') {
        orSet.delete(operation.value);
      }
      break;
    }
  }

  return {
    key,
    newValue: getCRDTDisplayValue(crdt),
    merged: false,
    vectorClock: Object.fromEntries(crdt.vectorClock),
  };
}

function initCRDTValue(type: CRDTValue['type']): unknown {
  switch (type) {
    case 'g-counter':
      return new Map<string, number>();
    case 'pn-counter':
      return { p: new Map<string, number>(), n: new Map<string, number>() };
    case 'lww-register':
      return { value: null, timestamp: 0 };
    case 'or-set':
      return new Map<unknown, Set<string>>();
    default:
      return null;
  }
}

function getCRDTDisplayValue(crdt: CRDTValue): unknown {
  switch (crdt.type) {
    case 'g-counter': {
      const counter = crdt.value as Map<string, number>;
      let sum = 0;
      for (const v of counter.values()) sum += v;
      return { total: sum, perNode: Object.fromEntries(counter) };
    }
    case 'pn-counter': {
      const pn = crdt.value as { p: Map<string, number>; n: Map<string, number> };
      let pSum = 0,
        nSum = 0;
      for (const v of pn.p.values()) pSum += v;
      for (const v of pn.n.values()) nSum += v;
      return { total: pSum - nSum, increments: pSum, decrements: nSum };
    }
    case 'lww-register': {
      const reg = crdt.value as { value: unknown; timestamp: number };
      return reg.value;
    }
    case 'or-set': {
      const orSet = crdt.value as Map<unknown, Set<string>>;
      return Array.from(orSet.keys());
    }
    default:
      return crdt.value;
  }
}

// ============================================================================
// NETWORK PARTITION HANDLING
// ============================================================================

function simulatePartition(
  clusterId: string,
  partitionA: string[],
  partitionB: string[]
): {
  success: boolean;
  partitionCount: number;
  partitions: string[][];
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  cluster.partitions = [new Set(partitionA), new Set(partitionB)];

  return {
    success: true,
    partitionCount: 2,
    partitions: [partitionA, partitionB],
  };
}

function healPartition(clusterId: string): {
  success: boolean;
  mergedNodes: number;
  conflictsDetected: number;
} {
  const cluster = clusters.get(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const mergedNodes = cluster.partitions.reduce((sum, p) => sum + p.size, 0);
  const conflicts = Math.floor(Math.random() * 3); // Simulate potential conflicts

  cluster.partitions = [];

  // Run anti-entropy to sync
  runAntiEntropy(clusterId);

  return {
    success: true,
    mergedNodes,
    conflictsDetected: conflicts,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function serializeMembership(cluster: Cluster): Array<{
  id: string;
  status: NodeStatus;
  heartbeat: number;
  version: number;
  incarnation: number;
}> {
  const result = [];
  for (const [, node] of cluster.nodes) {
    result.push({
      id: node.id,
      status: node.status,
      heartbeat: node.heartbeat,
      version: node.version,
      incarnation: node.incarnation,
    });
  }
  return result;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const gossipprotocolTool: UnifiedTool = {
  name: 'gossip_protocol',
  description:
    'Gossip/epidemic protocol for distributed systems with failure detection and CRDT sync',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'init_cluster',
          'gossip',
          'receive_gossip',
          'detect_failures',
          'get_membership',
          'simulate_propagation',
          'analyze_convergence',
          'anti_entropy',
          'join_cluster',
          'leave_cluster',
          'sync_crdt',
          'simulate_partition',
          'heal_partition',
        ],
        description: 'Operation to perform',
      },
      clusterId: { type: 'string', description: 'Cluster identifier' },
      selfId: { type: 'string', description: 'Self node identifier' },
      selfAddress: { type: 'string', description: 'Self node address' },
      nodeId: { type: 'string', description: 'Target node identifier' },
      nodes: {
        type: 'array',
        items: { type: 'object' },
        description: 'Node list. Each node has: id (string), address (string)',
      },
      gossipMode: {
        type: 'string',
        enum: ['push', 'pull', 'push-pull'],
        description: 'Gossip mode',
      },
      fanout: { type: 'number', description: 'Fanout factor' },
      content: { type: 'object', description: 'Rumor content' },
      rumorId: { type: 'string', description: 'Rumor identifier' },
      message: { type: 'object', description: 'Gossip message' },
      maxRounds: { type: 'number', description: 'Max simulation rounds' },
      phiThreshold: { type: 'number', description: 'Phi accrual threshold' },
      usePhiAccrual: { type: 'boolean', description: 'Use phi accrual detector' },
      crdtKey: { type: 'string', description: 'CRDT key' },
      crdtType: {
        type: 'string',
        enum: ['g-counter', 'pn-counter', 'lww-register', 'or-set'],
        description: 'CRDT type',
      },
      crdtOperation: { type: 'object', description: 'CRDT operation' },
      partitionA: { type: 'array', items: { type: 'string' }, description: 'Partition A nodes' },
      partitionB: { type: 'array', items: { type: 'string' }, description: 'Partition B nodes' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executegossipprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: unknown;

    switch (operation) {
      case 'init_cluster': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.selfId) throw new Error('selfId required');

        const cluster = initCluster({
          clusterId: args.clusterId,
          selfId: args.selfId,
          selfAddress: args.selfAddress || `${args.selfId}.local`,
          nodes: args.nodes,
          gossipMode: args.gossipMode,
          fanout: args.fanout,
          gossipInterval: args.gossipInterval,
          suspicionTimeout: args.suspicionTimeout,
          deadTimeout: args.deadTimeout,
        });

        result = {
          clusterId: cluster.id,
          selfId: cluster.selfId,
          nodeCount: cluster.nodes.size,
          gossipMode: cluster.gossipMode,
          fanout: cluster.fanout,
        };
        break;
      }

      case 'gossip': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = gossip(args.clusterId, {
          rumorId: args.rumorId,
          content: args.content,
          mode: args.gossipMode,
          targetNodes: args.targetNodes,
        });
        break;
      }

      case 'receive_gossip': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.message) throw new Error('message required');
        result = receiveGossip(args.clusterId, args.message);
        break;
      }

      case 'detect_failures': {
        if (!args.clusterId) throw new Error('clusterId required');
        const detection = detectFailures(args.clusterId, {
          phiThreshold: args.phiThreshold,
          usePhiAccrual: args.usePhiAccrual,
        });
        result = {
          ...detection,
          phiValues: Object.fromEntries(detection.phiValues),
        };
        break;
      }

      case 'get_membership': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = getMembership(args.clusterId);
        break;
      }

      case 'simulate_propagation': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = simulatePropagation(args.clusterId, {
          rumorId: args.rumorId,
          content: args.content,
          maxRounds: args.maxRounds,
          mode: args.gossipMode,
        });
        break;
      }

      case 'analyze_convergence': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = analyzeConvergence(args.clusterId);
        break;
      }

      case 'anti_entropy': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = runAntiEntropy(args.clusterId, args.nodeId);
        break;
      }

      case 'join_cluster': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.nodeId) throw new Error('nodeId required');
        result = joinCluster(args.clusterId, {
          id: args.nodeId,
          address: args.address || `${args.nodeId}.local`,
          metadata: args.metadata,
        });
        break;
      }

      case 'leave_cluster': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.nodeId) throw new Error('nodeId required');
        result = leaveCluster(args.clusterId, args.nodeId);
        break;
      }

      case 'sync_crdt': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.crdtKey) throw new Error('crdtKey required');
        if (!args.crdtType) throw new Error('crdtType required');
        if (!args.crdtOperation) throw new Error('crdtOperation required');
        result = syncCRDT(args.clusterId, args.crdtKey, args.crdtType, args.crdtOperation);
        break;
      }

      case 'simulate_partition': {
        if (!args.clusterId) throw new Error('clusterId required');
        if (!args.partitionA) throw new Error('partitionA required');
        if (!args.partitionB) throw new Error('partitionB required');
        result = simulatePartition(args.clusterId, args.partitionA, args.partitionB);
        break;
      }

      case 'heal_partition': {
        if (!args.clusterId) throw new Error('clusterId required');
        result = healPartition(args.clusterId);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isgossipprotocolAvailable(): boolean {
  return true;
}
