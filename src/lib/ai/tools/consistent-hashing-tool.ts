/**
 * CONSISTENT-HASHING TOOL
 * Comprehensive consistent hashing implementation for distributed systems
 * Supports: hash rings, virtual nodes, jump consistent hashing, rendezvous hashing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface PhysicalNode {
  id: string;
  address: string;
  weight: number;
  metadata: Record<string, unknown>;
  virtualNodes: number[];
}

interface VirtualNode {
  hash: number;
  physicalNodeId: string;
  index: number;
}

interface HashRing {
  id: string;
  nodes: Map<string, PhysicalNode>;
  virtualNodes: VirtualNode[];
  replicationFactor: number;
  totalVirtualNodes: number;
  hashFunction: 'fnv1a' | 'murmur3' | 'xxhash';
  createdAt: number;
}

interface KeyMapping {
  key: string;
  hash: number;
  primaryNode: string;
  replicaNodes: string[];
  virtualNodeIndex: number;
}

interface LoadDistribution {
  nodeId: string;
  keyCount: number;
  percentage: number;
  virtualNodeCount: number;
  loadFactor: number;
  isHotSpot: boolean;
}

interface RebalanceResult {
  movedKeys: number;
  totalKeys: number;
  movementPercentage: number;
  affectedNodes: string[];
  keyMigrations: Array<{ key: string; from: string; to: string }>;
}

interface RendezvousResult {
  key: string;
  rankings: Array<{ nodeId: string; score: number }>;
  selectedNode: string;
  replicaNodes: string[];
}

interface JumpHashResult {
  key: string;
  bucket: number;
  nodeId: string;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const hashRings: Map<string, HashRing> = new Map();
const keyAssignments: Map<string, Map<string, KeyMapping>> = new Map();

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function murmur3Hash(str: string, seed: number = 0): number {
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  const nblocks = Math.floor(len / 4);

  for (let i = 0; i < nblocks; i++) {
    let k1 = bytes[i * 4] | (bytes[i * 4 + 1] << 8) |
             (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24);

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  let k1 = 0;
  const tail = len & 3;
  const tailStart = nblocks * 4;

  if (tail >= 3) k1 ^= bytes[tailStart + 2] << 16;
  if (tail >= 2) k1 ^= bytes[tailStart + 1] << 8;
  if (tail >= 1) {
    k1 ^= bytes[tailStart];
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function xxHash(str: string, seed: number = 0): number {
  const PRIME1 = 2654435761;
  const PRIME2 = 2246822519;
  const PRIME3 = 3266489917;
  const PRIME4 = 668265263;
  const PRIME5 = 374761393;

  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  let h32: number;
  let index = 0;

  if (len >= 16) {
    let v1 = (seed + PRIME1 + PRIME2) >>> 0;
    let v2 = (seed + PRIME2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - PRIME1) >>> 0;

    const limit = len - 16;
    while (index <= limit) {
      const val1 = bytes[index] | (bytes[index + 1] << 8) |
                   (bytes[index + 2] << 16) | (bytes[index + 3] << 24);
      v1 = Math.imul((v1 + Math.imul(val1, PRIME2)) >>> 0, PRIME1);
      v1 = ((v1 << 13) | (v1 >>> 19)) >>> 0;
      index += 4;

      const val2 = bytes[index] | (bytes[index + 1] << 8) |
                   (bytes[index + 2] << 16) | (bytes[index + 3] << 24);
      v2 = Math.imul((v2 + Math.imul(val2, PRIME2)) >>> 0, PRIME1);
      v2 = ((v2 << 13) | (v2 >>> 19)) >>> 0;
      index += 4;

      const val3 = bytes[index] | (bytes[index + 1] << 8) |
                   (bytes[index + 2] << 16) | (bytes[index + 3] << 24);
      v3 = Math.imul((v3 + Math.imul(val3, PRIME2)) >>> 0, PRIME1);
      v3 = ((v3 << 13) | (v3 >>> 19)) >>> 0;
      index += 4;

      const val4 = bytes[index] | (bytes[index + 1] << 8) |
                   (bytes[index + 2] << 16) | (bytes[index + 3] << 24);
      v4 = Math.imul((v4 + Math.imul(val4, PRIME2)) >>> 0, PRIME1);
      v4 = ((v4 << 13) | (v4 >>> 19)) >>> 0;
      index += 4;
    }

    h32 = (((v1 << 1) | (v1 >>> 31)) + ((v2 << 7) | (v2 >>> 25)) +
           ((v3 << 12) | (v3 >>> 20)) + ((v4 << 18) | (v4 >>> 14))) >>> 0;
  } else {
    h32 = (seed + PRIME5) >>> 0;
  }

  h32 = (h32 + len) >>> 0;

  while (index <= len - 4) {
    const val = bytes[index] | (bytes[index + 1] << 8) |
                (bytes[index + 2] << 16) | (bytes[index + 3] << 24);
    h32 = Math.imul((h32 + Math.imul(val, PRIME3)) >>> 0, PRIME4);
    h32 = ((h32 << 17) | (h32 >>> 15)) >>> 0;
    index += 4;
  }

  while (index < len) {
    h32 = Math.imul((h32 + Math.imul(bytes[index], PRIME5)) >>> 0, PRIME1);
    h32 = ((h32 << 11) | (h32 >>> 21)) >>> 0;
    index++;
  }

  h32 ^= h32 >>> 15;
  h32 = Math.imul(h32, PRIME2);
  h32 ^= h32 >>> 13;
  h32 = Math.imul(h32, PRIME3);
  h32 ^= h32 >>> 16;

  return h32 >>> 0;
}

function getHashFunction(name: string): (str: string) => number {
  switch (name) {
    case 'murmur3': return (s) => murmur3Hash(s);
    case 'xxhash': return (s) => xxHash(s);
    default: return fnv1aHash;
  }
}

// ============================================================================
// CONSISTENT HASHING OPERATIONS
// ============================================================================

function createRing(config: {
  ringId: string;
  nodes?: Array<{ id: string; address: string; weight?: number; metadata?: Record<string, unknown> }>;
  virtualNodesPerNode?: number;
  replicationFactor?: number;
  hashFunction?: 'fnv1a' | 'murmur3' | 'xxhash';
}): { ring: HashRing; initialDistribution: VirtualNode[] } {
  const ringId = config.ringId;
  const virtualNodesPerNode = config.virtualNodesPerNode || 150;
  const replicationFactor = config.replicationFactor || 3;
  const hashFn = config.hashFunction || 'fnv1a';

  const ring: HashRing = {
    id: ringId,
    nodes: new Map(),
    virtualNodes: [],
    replicationFactor,
    totalVirtualNodes: 0,
    hashFunction: hashFn,
    createdAt: Date.now()
  };

  const hash = getHashFunction(hashFn);

  // Add initial nodes
  if (config.nodes) {
    for (const nodeConfig of config.nodes) {
      const weight = nodeConfig.weight || 1;
      const numVirtualNodes = Math.floor(virtualNodesPerNode * weight);
      const virtualNodeHashes: number[] = [];

      for (let i = 0; i < numVirtualNodes; i++) {
        const virtualNodeKey = `${nodeConfig.id}#${i}`;
        const nodeHash = hash(virtualNodeKey);
        virtualNodeHashes.push(nodeHash);

        ring.virtualNodes.push({
          hash: nodeHash,
          physicalNodeId: nodeConfig.id,
          index: i
        });
      }

      ring.nodes.set(nodeConfig.id, {
        id: nodeConfig.id,
        address: nodeConfig.address,
        weight,
        metadata: nodeConfig.metadata || {},
        virtualNodes: virtualNodeHashes
      });
    }
  }

  // Sort virtual nodes by hash
  ring.virtualNodes.sort((a, b) => a.hash - b.hash);
  ring.totalVirtualNodes = ring.virtualNodes.length;

  hashRings.set(ringId, ring);
  keyAssignments.set(ringId, new Map());

  return { ring, initialDistribution: ring.virtualNodes };
}

function addNode(ringId: string, node: {
  id: string;
  address: string;
  weight?: number;
  virtualNodes?: number;
  metadata?: Record<string, unknown>;
}): { success: boolean; addedVirtualNodes: number; rebalanceInfo: RebalanceResult } {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  if (ring.nodes.has(node.id)) {
    throw new Error(`Node ${node.id} already exists in ring`);
  }

  const weight = node.weight || 1;
  const baseVirtualNodes = node.virtualNodes || 150;
  const numVirtualNodes = Math.floor(baseVirtualNodes * weight);
  const hash = getHashFunction(ring.hashFunction);

  const virtualNodeHashes: number[] = [];
  const newVirtualNodes: VirtualNode[] = [];

  // Track keys that need to move
  const keyMigrations: Array<{ key: string; from: string; to: string }> = [];
  const assignments = keyAssignments.get(ringId)!;
  const affectedNodes = new Set<string>();

  for (let i = 0; i < numVirtualNodes; i++) {
    const virtualNodeKey = `${node.id}#${i}`;
    const nodeHash = hash(virtualNodeKey);
    virtualNodeHashes.push(nodeHash);

    const vn: VirtualNode = {
      hash: nodeHash,
      physicalNodeId: node.id,
      index: i
    };
    newVirtualNodes.push(vn);

    // Find keys that should move to this new node
    const insertIndex = binarySearchInsertIndex(ring.virtualNodes, nodeHash);
    const prevIndex = (insertIndex - 1 + ring.virtualNodes.length) % ring.virtualNodes.length;

    if (ring.virtualNodes.length > 0) {
      const prevVN = ring.virtualNodes[prevIndex];
      const prevHash = prevVN.hash;

      // Keys between prevHash and nodeHash should move
      for (const [key, mapping] of assignments) {
        if (mapping.primaryNode !== node.id) {
          const keyHash = mapping.hash;
          const shouldMove = nodeHash >= prevHash
            ? keyHash > prevHash && keyHash <= nodeHash
            : keyHash > prevHash || keyHash <= nodeHash;

          if (shouldMove && mapping.primaryNode !== node.id) {
            keyMigrations.push({
              key,
              from: mapping.primaryNode,
              to: node.id
            });
            affectedNodes.add(mapping.primaryNode);
          }
        }
      }
    }
  }

  // Add virtual nodes to ring
  ring.virtualNodes.push(...newVirtualNodes);
  ring.virtualNodes.sort((a, b) => a.hash - b.hash);
  ring.totalVirtualNodes = ring.virtualNodes.length;

  // Add physical node
  ring.nodes.set(node.id, {
    id: node.id,
    address: node.address,
    weight,
    metadata: node.metadata || {},
    virtualNodes: virtualNodeHashes
  });

  // Update key assignments
  for (const migration of keyMigrations) {
    const mapping = assignments.get(migration.key);
    if (mapping) {
      mapping.primaryNode = migration.to;
      mapping.replicaNodes = getReplicaNodes(ring, mapping.hash, ring.replicationFactor);
    }
  }

  affectedNodes.add(node.id);

  return {
    success: true,
    addedVirtualNodes: numVirtualNodes,
    rebalanceInfo: {
      movedKeys: keyMigrations.length,
      totalKeys: assignments.size,
      movementPercentage: assignments.size > 0
        ? (keyMigrations.length / assignments.size) * 100
        : 0,
      affectedNodes: Array.from(affectedNodes),
      keyMigrations
    }
  };
}

function removeNode(ringId: string, nodeId: string): {
  success: boolean;
  removedVirtualNodes: number;
  rebalanceInfo: RebalanceResult
} {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  const node = ring.nodes.get(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found in ring`);
  }

  const assignments = keyAssignments.get(ringId)!;
  const keyMigrations: Array<{ key: string; from: string; to: string }> = [];
  const affectedNodes = new Set<string>([nodeId]);

  // Find all keys that need to move
  for (const [key, mapping] of assignments) {
    if (mapping.primaryNode === nodeId) {
      // Find new primary
      const keyHash = mapping.hash;

      // Find next node in ring that's not the removed node
      const newPrimary = findNextNode(ring, keyHash, new Set([nodeId]));
      if (newPrimary) {
        keyMigrations.push({
          key,
          from: nodeId,
          to: newPrimary
        });
        affectedNodes.add(newPrimary);
      }
    }
  }

  // Remove virtual nodes
  const removedCount = node.virtualNodes.length;
  ring.virtualNodes = ring.virtualNodes.filter(vn => vn.physicalNodeId !== nodeId);
  ring.totalVirtualNodes = ring.virtualNodes.length;

  // Remove physical node
  ring.nodes.delete(nodeId);

  // Update key assignments
  for (const migration of keyMigrations) {
    const mapping = assignments.get(migration.key);
    if (mapping) {
      mapping.primaryNode = migration.to;
      mapping.replicaNodes = getReplicaNodes(ring, mapping.hash, ring.replicationFactor);
    }
  }

  return {
    success: true,
    removedVirtualNodes: removedCount,
    rebalanceInfo: {
      movedKeys: keyMigrations.length,
      totalKeys: assignments.size,
      movementPercentage: assignments.size > 0
        ? (keyMigrations.length / assignments.size) * 100
        : 0,
      affectedNodes: Array.from(affectedNodes),
      keyMigrations
    }
  };
}

function lookupKey(ringId: string, key: string): KeyMapping {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  if (ring.virtualNodes.length === 0) {
    throw new Error('Ring has no nodes');
  }

  const hash = getHashFunction(ring.hashFunction);
  const keyHash = hash(key);

  // Binary search for the first virtual node with hash >= keyHash
  const index = binarySearchFirstGE(ring.virtualNodes, keyHash);
  const primaryVN = ring.virtualNodes[index];

  // Get replica nodes
  const replicaNodes = getReplicaNodes(ring, keyHash, ring.replicationFactor);

  const mapping: KeyMapping = {
    key,
    hash: keyHash,
    primaryNode: primaryVN.physicalNodeId,
    replicaNodes: replicaNodes.filter(n => n !== primaryVN.physicalNodeId),
    virtualNodeIndex: index
  };

  // Store the assignment
  keyAssignments.get(ringId)!.set(key, mapping);

  return mapping;
}

function getDistribution(ringId: string, options?: {
  sampleKeys?: string[];
  generateRandomKeys?: number;
}): { distribution: LoadDistribution[]; hotSpots: string[]; standardDeviation: number } {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  const hash = getHashFunction(ring.hashFunction);
  const assignments = keyAssignments.get(ringId)!;

  // Generate sample keys if requested
  if (options?.generateRandomKeys) {
    for (let i = 0; i < options.generateRandomKeys; i++) {
      const key = `sample_key_${Date.now()}_${i}_${Math.random().toString(36)}`;
      lookupKey(ringId, key);
    }
  }

  // Also lookup any provided sample keys
  if (options?.sampleKeys) {
    for (const key of options.sampleKeys) {
      lookupKey(ringId, key);
    }
  }

  // Calculate key counts per node
  const keyCounts: Map<string, number> = new Map();
  for (const nodeId of ring.nodes.keys()) {
    keyCounts.set(nodeId, 0);
  }

  for (const mapping of assignments.values()) {
    const current = keyCounts.get(mapping.primaryNode) || 0;
    keyCounts.set(mapping.primaryNode, current + 1);
  }

  const totalKeys = assignments.size;
  const nodeCount = ring.nodes.size;
  const expectedKeysPerNode = totalKeys / nodeCount;

  // Calculate distribution and standard deviation
  const distribution: LoadDistribution[] = [];
  let sumSquaredDiff = 0;

  for (const [nodeId, node] of ring.nodes) {
    const keyCount = keyCounts.get(nodeId) || 0;
    const percentage = totalKeys > 0 ? (keyCount / totalKeys) * 100 : 0;
    const loadFactor = expectedKeysPerNode > 0 ? keyCount / expectedKeysPerNode : 0;
    const isHotSpot = loadFactor > 1.5; // More than 50% above average

    distribution.push({
      nodeId,
      keyCount,
      percentage,
      virtualNodeCount: node.virtualNodes.length,
      loadFactor,
      isHotSpot
    });

    sumSquaredDiff += Math.pow(keyCount - expectedKeysPerNode, 2);
  }

  const standardDeviation = nodeCount > 0
    ? Math.sqrt(sumSquaredDiff / nodeCount)
    : 0;

  const hotSpots = distribution
    .filter(d => d.isHotSpot)
    .map(d => d.nodeId);

  return { distribution, hotSpots, standardDeviation };
}

function addVirtualNodes(ringId: string, nodeId: string, count: number): {
  success: boolean;
  totalVirtualNodes: number;
  newHashes: number[];
} {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  const node = ring.nodes.get(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const hash = getHashFunction(ring.hashFunction);
  const newHashes: number[] = [];
  const startIndex = node.virtualNodes.length;

  for (let i = 0; i < count; i++) {
    const virtualNodeKey = `${nodeId}#${startIndex + i}`;
    const nodeHash = hash(virtualNodeKey);
    newHashes.push(nodeHash);
    node.virtualNodes.push(nodeHash);

    ring.virtualNodes.push({
      hash: nodeHash,
      physicalNodeId: nodeId,
      index: startIndex + i
    });
  }

  ring.virtualNodes.sort((a, b) => a.hash - b.hash);
  ring.totalVirtualNodes = ring.virtualNodes.length;

  return {
    success: true,
    totalVirtualNodes: node.virtualNodes.length,
    newHashes
  };
}

function rebalance(ringId: string, targetDistribution?: Map<string, number>): RebalanceResult {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  const assignments = keyAssignments.get(ringId)!;
  const keyMigrations: Array<{ key: string; from: string; to: string }> = [];
  const affectedNodes = new Set<string>();

  // Recalculate all key assignments
  for (const [key, oldMapping] of assignments) {
    const newMapping = lookupKey(ringId, key);

    if (oldMapping.primaryNode !== newMapping.primaryNode) {
      keyMigrations.push({
        key,
        from: oldMapping.primaryNode,
        to: newMapping.primaryNode
      });
      affectedNodes.add(oldMapping.primaryNode);
      affectedNodes.add(newMapping.primaryNode);
    }
  }

  return {
    movedKeys: keyMigrations.length,
    totalKeys: assignments.size,
    movementPercentage: assignments.size > 0
      ? (keyMigrations.length / assignments.size) * 100
      : 0,
    affectedNodes: Array.from(affectedNodes),
    keyMigrations
  };
}

function analyzeLoad(ringId: string): {
  totalNodes: number;
  totalVirtualNodes: number;
  totalKeys: number;
  avgKeysPerNode: number;
  minKeysNode: { nodeId: string; count: number } | null;
  maxKeysNode: { nodeId: string; count: number } | null;
  loadImbalance: number;
  recommendations: string[];
} {
  const ring = hashRings.get(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }

  const { distribution, standardDeviation } = getDistribution(ringId);

  const totalNodes = ring.nodes.size;
  const totalVirtualNodes = ring.totalVirtualNodes;
  const totalKeys = keyAssignments.get(ringId)!.size;
  const avgKeysPerNode = totalNodes > 0 ? totalKeys / totalNodes : 0;

  let minKeysNode: { nodeId: string; count: number } | null = null;
  let maxKeysNode: { nodeId: string; count: number } | null = null;

  for (const d of distribution) {
    if (!minKeysNode || d.keyCount < minKeysNode.count) {
      minKeysNode = { nodeId: d.nodeId, count: d.keyCount };
    }
    if (!maxKeysNode || d.keyCount > maxKeysNode.count) {
      maxKeysNode = { nodeId: d.nodeId, count: d.keyCount };
    }
  }

  const loadImbalance = avgKeysPerNode > 0 ? standardDeviation / avgKeysPerNode : 0;

  const recommendations: string[] = [];

  if (loadImbalance > 0.3) {
    recommendations.push('High load imbalance detected. Consider adding more virtual nodes.');
  }

  const avgVirtualNodesPerNode = totalVirtualNodes / totalNodes;
  if (avgVirtualNodesPerNode < 100) {
    recommendations.push(`Low virtual node count (${avgVirtualNodesPerNode.toFixed(0)}). Recommend at least 150 per node.`);
  }

  for (const d of distribution) {
    if (d.isHotSpot) {
      recommendations.push(`Node ${d.nodeId} is a hot spot with ${d.loadFactor.toFixed(2)}x average load.`);
    }
  }

  if (ring.replicationFactor > totalNodes) {
    recommendations.push(`Replication factor (${ring.replicationFactor}) exceeds node count (${totalNodes}).`);
  }

  return {
    totalNodes,
    totalVirtualNodes,
    totalKeys,
    avgKeysPerNode,
    minKeysNode,
    maxKeysNode,
    loadImbalance,
    recommendations
  };
}

// ============================================================================
// JUMP CONSISTENT HASHING
// ============================================================================

function jumpConsistentHash(key: string, numBuckets: number): JumpHashResult {
  if (numBuckets <= 0) {
    throw new Error('Number of buckets must be positive');
  }

  // Google's Jump Consistent Hash algorithm
  let keyHash = fnv1aHash(key);
  let b = -1;
  let j = 0;

  while (j < numBuckets) {
    b = j;
    keyHash = ((keyHash * 2862933555777941757n) + 1n) & 0xFFFFFFFFFFFFFFFFn;
    j = Math.floor((b + 1) * (Number(1n << 31n) / Number((keyHash >> 33n) + 1n)));
  }

  return {
    key,
    bucket: b,
    nodeId: `node_${b}`
  };
}

// ============================================================================
// RENDEZVOUS (HRW) HASHING
// ============================================================================

function rendezvousHash(key: string, nodes: string[], replicationFactor: number = 1): RendezvousResult {
  if (nodes.length === 0) {
    throw new Error('No nodes provided');
  }

  const rankings: Array<{ nodeId: string; score: number }> = [];

  for (const nodeId of nodes) {
    // Combine key and node for scoring
    const combined = `${key}:${nodeId}`;
    const score = murmur3Hash(combined);
    rankings.push({ nodeId, score });
  }

  // Sort by score (highest first)
  rankings.sort((a, b) => b.score - a.score);

  const selectedNode = rankings[0].nodeId;
  const replicaNodes = rankings
    .slice(1, replicationFactor)
    .map(r => r.nodeId);

  return {
    key,
    rankings,
    selectedNode,
    replicaNodes
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function binarySearchInsertIndex(arr: VirtualNode[], hash: number): number {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid].hash < hash) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

function binarySearchFirstGE(arr: VirtualNode[], hash: number): number {
  const index = binarySearchInsertIndex(arr, hash);
  return index >= arr.length ? 0 : index;
}

function findNextNode(ring: HashRing, hash: number, excludeNodes: Set<string>): string | null {
  if (ring.virtualNodes.length === 0) return null;

  const startIndex = binarySearchFirstGE(ring.virtualNodes, hash);

  for (let i = 0; i < ring.virtualNodes.length; i++) {
    const index = (startIndex + i) % ring.virtualNodes.length;
    const vn = ring.virtualNodes[index];
    if (!excludeNodes.has(vn.physicalNodeId)) {
      return vn.physicalNodeId;
    }
  }

  return null;
}

function getReplicaNodes(ring: HashRing, hash: number, count: number): string[] {
  const replicas: string[] = [];
  const seen = new Set<string>();

  const startIndex = binarySearchFirstGE(ring.virtualNodes, hash);

  for (let i = 0; i < ring.virtualNodes.length && replicas.length < count; i++) {
    const index = (startIndex + i) % ring.virtualNodes.length;
    const nodeId = ring.virtualNodes[index].physicalNodeId;

    if (!seen.has(nodeId)) {
      seen.add(nodeId);
      replicas.push(nodeId);
    }
  }

  return replicas;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const consistenthashingTool: UnifiedTool = {
  name: 'consistent_hashing',
  description: 'Consistent hashing for distributed systems with virtual nodes, jump hashing, and rendezvous hashing',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_ring', 'add_node', 'remove_node', 'lookup_key',
          'get_distribution', 'rebalance', 'add_virtual_nodes', 'analyze_load',
          'jump_hash', 'rendezvous_hash', 'get_ring_info'
        ],
        description: 'Operation to perform'
      },
      ringId: { type: 'string', description: 'Hash ring identifier' },
      nodeId: { type: 'string', description: 'Node identifier' },
      key: { type: 'string', description: 'Key to look up' },
      keys: { type: 'array', items: { type: 'string' }, description: 'Multiple keys' },
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            address: { type: 'string' },
            weight: { type: 'number' }
          }
        },
        description: 'Node configurations'
      },
      node: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          address: { type: 'string' },
          weight: { type: 'number' },
          virtualNodes: { type: 'number' }
        },
        description: 'Single node configuration'
      },
      virtualNodesPerNode: { type: 'number', description: 'Virtual nodes per physical node' },
      replicationFactor: { type: 'number', description: 'Replication factor' },
      hashFunction: { type: 'string', enum: ['fnv1a', 'murmur3', 'xxhash'], description: 'Hash function' },
      count: { type: 'number', description: 'Count for various operations' },
      numBuckets: { type: 'number', description: 'Number of buckets for jump hash' },
      generateRandomKeys: { type: 'number', description: 'Generate random sample keys' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeconsistenthashing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: unknown;

    switch (operation) {
      case 'create_ring': {
        result = createRing({
          ringId: args.ringId || `ring_${Date.now()}`,
          nodes: args.nodes,
          virtualNodesPerNode: args.virtualNodesPerNode,
          replicationFactor: args.replicationFactor,
          hashFunction: args.hashFunction
        });
        break;
      }

      case 'add_node': {
        if (!args.ringId) throw new Error('ringId required');
        if (!args.node && !args.nodeId) throw new Error('node or nodeId required');

        const nodeConfig = args.node || {
          id: args.nodeId,
          address: args.address || `${args.nodeId}.local`,
          weight: args.weight,
          virtualNodes: args.virtualNodes
        };

        result = addNode(args.ringId, nodeConfig);
        break;
      }

      case 'remove_node': {
        if (!args.ringId) throw new Error('ringId required');
        if (!args.nodeId) throw new Error('nodeId required');
        result = removeNode(args.ringId, args.nodeId);
        break;
      }

      case 'lookup_key': {
        if (!args.ringId) throw new Error('ringId required');
        if (!args.key && !args.keys) throw new Error('key or keys required');

        if (args.keys) {
          result = args.keys.map((k: string) => lookupKey(args.ringId, k));
        } else {
          result = lookupKey(args.ringId, args.key);
        }
        break;
      }

      case 'get_distribution': {
        if (!args.ringId) throw new Error('ringId required');
        result = getDistribution(args.ringId, {
          sampleKeys: args.keys,
          generateRandomKeys: args.generateRandomKeys
        });
        break;
      }

      case 'rebalance': {
        if (!args.ringId) throw new Error('ringId required');
        result = rebalance(args.ringId);
        break;
      }

      case 'add_virtual_nodes': {
        if (!args.ringId) throw new Error('ringId required');
        if (!args.nodeId) throw new Error('nodeId required');
        result = addVirtualNodes(args.ringId, args.nodeId, args.count || 50);
        break;
      }

      case 'analyze_load': {
        if (!args.ringId) throw new Error('ringId required');
        result = analyzeLoad(args.ringId);
        break;
      }

      case 'jump_hash': {
        if (!args.key) throw new Error('key required');
        if (!args.numBuckets) throw new Error('numBuckets required');
        result = jumpConsistentHash(args.key, args.numBuckets);
        break;
      }

      case 'rendezvous_hash': {
        if (!args.key) throw new Error('key required');
        if (!args.nodes || args.nodes.length === 0) throw new Error('nodes required');

        const nodeIds = args.nodes.map((n: { id?: string } | string) =>
          typeof n === 'string' ? n : n.id
        );
        result = rendezvousHash(args.key, nodeIds, args.replicationFactor || 1);
        break;
      }

      case 'get_ring_info': {
        if (!args.ringId) throw new Error('ringId required');
        const ring = hashRings.get(args.ringId);
        if (!ring) throw new Error(`Ring ${args.ringId} not found`);

        result = {
          id: ring.id,
          nodeCount: ring.nodes.size,
          totalVirtualNodes: ring.totalVirtualNodes,
          replicationFactor: ring.replicationFactor,
          hashFunction: ring.hashFunction,
          nodes: Array.from(ring.nodes.values()).map(n => ({
            id: n.id,
            address: n.address,
            weight: n.weight,
            virtualNodeCount: n.virtualNodes.length
          })),
          keyCount: keyAssignments.get(args.ringId)?.size || 0
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isconsistenthashingAvailable(): boolean {
  return true;
}
