/**
 * LAMPORT-CLOCK TOOL
 * Comprehensive logical clock implementation for distributed systems
 * Supports: Lamport timestamps, Vector clocks, Matrix clocks, causal ordering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type ClockType = 'lamport' | 'vector' | 'matrix';
type CausalRelation = 'happened-before' | 'happened-after' | 'concurrent';

interface LamportClock {
  nodeId: string;
  timestamp: number;
}

interface VectorClock {
  nodeId: string;
  vector: Map<string, number>;
}

interface MatrixClock {
  nodeId: string;
  matrix: Map<string, Map<string, number>>;
}

interface Event {
  id: string;
  nodeId: string;
  type: 'local' | 'send' | 'receive';
  timestamp: number | number[] | number[][];
  clockType: ClockType;
  description: string;
  linkedEventId?: string;
  createdAt: number;
}

interface ClockSystem {
  id: string;
  type: ClockType;
  nodes: Map<string, LamportClock | VectorClock | MatrixClock>;
  events: Event[];
  messageQueue: Message[];
  nodeIds: string[];
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  timestamp: number | number[] | number[][];
  payload: unknown;
  sent: boolean;
  received: boolean;
  sentAt: number;
  receivedAt?: number;
}

interface ComparisonResult {
  eventA: string;
  eventB: string;
  relation: CausalRelation;
  timestampA: unknown;
  timestampB: unknown;
  explanation: string;
}

interface OrderingVisualization {
  nodes: string[];
  events: Array<{
    id: string;
    nodeId: string;
    timestamp: unknown;
    type: string;
    column: number;
    row: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'happens-before' | 'message';
  }>;
  asciiArt: string;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const clockSystems: Map<string, ClockSystem> = new Map();

// ============================================================================
// CLOCK CREATION
// ============================================================================

function createClock(config: {
  systemId: string;
  type: ClockType;
  nodeIds: string[];
}): ClockSystem {
  const system: ClockSystem = {
    id: config.systemId,
    type: config.type,
    nodes: new Map(),
    events: [],
    messageQueue: [],
    nodeIds: config.nodeIds,
  };

  // Initialize clocks for each node
  for (const nodeId of config.nodeIds) {
    switch (config.type) {
      case 'lamport':
        system.nodes.set(nodeId, {
          nodeId,
          timestamp: 0,
        } as LamportClock);
        break;

      case 'vector': {
        const vector = new Map<string, number>();
        for (const id of config.nodeIds) {
          vector.set(id, 0);
        }
        system.nodes.set(nodeId, {
          nodeId,
          vector,
        } as VectorClock);
        break;
      }

      case 'matrix': {
        const matrix = new Map<string, Map<string, number>>();
        for (const rowId of config.nodeIds) {
          const row = new Map<string, number>();
          for (const colId of config.nodeIds) {
            row.set(colId, 0);
          }
          matrix.set(rowId, row);
        }
        system.nodes.set(nodeId, {
          nodeId,
          matrix,
        } as MatrixClock);
        break;
      }
    }
  }

  clockSystems.set(config.systemId, system);
  return system;
}

// ============================================================================
// LAMPORT CLOCK OPERATIONS
// ============================================================================

function incrementLamport(clock: LamportClock): number {
  clock.timestamp++;
  return clock.timestamp;
}

function sendLamport(
  system: ClockSystem,
  senderId: string,
  receiverId: string,
  payload?: unknown
): {
  messageId: string;
  senderTimestamp: number;
} {
  const sender = system.nodes.get(senderId) as LamportClock;
  if (!sender) throw new Error(`Node ${senderId} not found`);

  // Increment before send
  incrementLamport(sender);

  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    senderId,
    receiverId,
    timestamp: sender.timestamp,
    payload,
    sent: true,
    received: false,
    sentAt: Date.now(),
  };

  system.messageQueue.push(message);

  // Record event
  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: senderId,
    type: 'send',
    timestamp: sender.timestamp,
    clockType: 'lamport',
    description: `Send to ${receiverId}`,
    linkedEventId: message.id,
    createdAt: Date.now(),
  });

  return {
    messageId: message.id,
    senderTimestamp: sender.timestamp,
  };
}

function receiveLamport(
  system: ClockSystem,
  messageId: string
): {
  receiverTimestamp: number;
  messageTimestamp: number;
} {
  const message = system.messageQueue.find((m) => m.id === messageId && !m.received);
  if (!message) throw new Error(`Message ${messageId} not found or already received`);

  const receiver = system.nodes.get(message.receiverId) as LamportClock;
  if (!receiver) throw new Error(`Node ${message.receiverId} not found`);

  const msgTimestamp = message.timestamp as number;

  // Lamport rule: max(local, received) + 1
  receiver.timestamp = Math.max(receiver.timestamp, msgTimestamp) + 1;
  message.received = true;
  message.receivedAt = Date.now();

  // Record event
  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: message.receiverId,
    type: 'receive',
    timestamp: receiver.timestamp,
    clockType: 'lamport',
    description: `Receive from ${message.senderId}`,
    linkedEventId: messageId,
    createdAt: Date.now(),
  });

  return {
    receiverTimestamp: receiver.timestamp,
    messageTimestamp: msgTimestamp,
  };
}

// ============================================================================
// VECTOR CLOCK OPERATIONS
// ============================================================================

function incrementVector(clock: VectorClock): Map<string, number> {
  const current = clock.vector.get(clock.nodeId) || 0;
  clock.vector.set(clock.nodeId, current + 1);
  return clock.vector;
}

function sendVector(
  system: ClockSystem,
  senderId: string,
  receiverId: string,
  payload?: unknown
): {
  messageId: string;
  senderVector: Record<string, number>;
} {
  const sender = system.nodes.get(senderId) as VectorClock;
  if (!sender) throw new Error(`Node ${senderId} not found`);

  // Increment before send
  incrementVector(sender);

  const vectorCopy = new Map(sender.vector);

  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    senderId,
    receiverId,
    timestamp: Array.from(vectorCopy.values()),
    payload,
    sent: true,
    received: false,
    sentAt: Date.now(),
  };

  system.messageQueue.push(message);

  // Record event
  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: senderId,
    type: 'send',
    timestamp: Array.from(sender.vector.values()),
    clockType: 'vector',
    description: `Send to ${receiverId}`,
    linkedEventId: message.id,
    createdAt: Date.now(),
  });

  return {
    messageId: message.id,
    senderVector: Object.fromEntries(sender.vector),
  };
}

function receiveVector(
  system: ClockSystem,
  messageId: string
): {
  receiverVector: Record<string, number>;
  merged: boolean;
} {
  const message = system.messageQueue.find((m) => m.id === messageId && !m.received);
  if (!message) throw new Error(`Message ${messageId} not found or already received`);

  const receiver = system.nodes.get(message.receiverId) as VectorClock;
  if (!receiver) throw new Error(`Node ${message.receiverId} not found`);

  const msgVector = new Map(message.timestamp as [string, number][]);

  // Merge vectors: take max of each component
  for (const [nodeId, value] of msgVector) {
    const current = receiver.vector.get(nodeId) || 0;
    receiver.vector.set(nodeId, Math.max(current, value));
  }

  // Increment own component
  incrementVector(receiver);

  message.received = true;
  message.receivedAt = Date.now();

  // Record event
  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: message.receiverId,
    type: 'receive',
    timestamp: Array.from(receiver.vector.values()),
    clockType: 'vector',
    description: `Receive from ${message.senderId}`,
    linkedEventId: messageId,
    createdAt: Date.now(),
  });

  return {
    receiverVector: Object.fromEntries(receiver.vector),
    merged: true,
  };
}

function compareVectorClocks(v1: Map<string, number>, v2: Map<string, number>): CausalRelation {
  let v1LessOrEqual = true;
  let v2LessOrEqual = true;
  let equal = true;

  const allKeys = new Set([...v1.keys(), ...v2.keys()]);

  for (const key of allKeys) {
    const val1 = v1.get(key) || 0;
    const val2 = v2.get(key) || 0;

    if (val1 !== val2) equal = false;
    if (val1 > val2) v1LessOrEqual = false;
    if (val2 > val1) v2LessOrEqual = false;
  }

  if (equal) return 'concurrent'; // Same event
  if (v1LessOrEqual && !v2LessOrEqual) return 'happened-before';
  if (v2LessOrEqual && !v1LessOrEqual) return 'happened-after';
  return 'concurrent';
}

// ============================================================================
// MATRIX CLOCK OPERATIONS
// ============================================================================

function incrementMatrix(clock: MatrixClock): void {
  const row = clock.matrix.get(clock.nodeId);
  if (row) {
    const current = row.get(clock.nodeId) || 0;
    row.set(clock.nodeId, current + 1);
  }
}

function sendMatrix(
  system: ClockSystem,
  senderId: string,
  receiverId: string,
  payload?: unknown
): {
  messageId: string;
  senderMatrix: Record<string, Record<string, number>>;
} {
  const sender = system.nodes.get(senderId) as MatrixClock;
  if (!sender) throw new Error(`Node ${senderId} not found`);

  incrementMatrix(sender);

  // Deep copy matrix - convert to 2D number array for Message type
  const matrixValues: number[][] = [];
  for (const [_rowId, row] of sender.matrix) {
    matrixValues.push(Array.from(row.values()));
  }

  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    senderId,
    receiverId,
    timestamp: matrixValues,
    payload,
    sent: true,
    received: false,
    sentAt: Date.now(),
  };

  system.messageQueue.push(message);

  // Record event
  const flatMatrix: number[][] = [];
  for (const [, row] of sender.matrix) {
    flatMatrix.push(Array.from(row.values()));
  }

  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: senderId,
    type: 'send',
    timestamp: flatMatrix,
    clockType: 'matrix',
    description: `Send to ${receiverId}`,
    linkedEventId: message.id,
    createdAt: Date.now(),
  });

  const resultMatrix: Record<string, Record<string, number>> = {};
  for (const [rowId, row] of sender.matrix) {
    resultMatrix[rowId] = Object.fromEntries(row);
  }

  return {
    messageId: message.id,
    senderMatrix: resultMatrix,
  };
}

function receiveMatrix(
  system: ClockSystem,
  messageId: string
): {
  receiverMatrix: Record<string, Record<string, number>>;
} {
  const message = system.messageQueue.find((m) => m.id === messageId && !m.received);
  if (!message) throw new Error(`Message ${messageId} not found or already received`);

  const receiver = system.nodes.get(message.receiverId) as MatrixClock;
  if (!receiver) throw new Error(`Node ${message.receiverId} not found`);

  // Reconstruct matrix from number[][] using system.nodeIds ordering
  const matrixValues = message.timestamp as number[][];
  const msgMatrix = new Map<string, Map<string, number>>();
  for (let i = 0; i < system.nodeIds.length; i++) {
    const rowId = system.nodeIds[i];
    const row = new Map<string, number>();
    for (let j = 0; j < system.nodeIds.length; j++) {
      row.set(system.nodeIds[j], matrixValues[i]?.[j] ?? 0);
    }
    msgMatrix.set(rowId, row);
  }

  // Update receiver's view of sender's knowledge
  const senderRow = msgMatrix.get(message.senderId);
  if (senderRow) {
    receiver.matrix.set(message.senderId, new Map(senderRow));
  }

  // Merge: take max for receiver's own row
  const receiverRow = receiver.matrix.get(message.receiverId)!;
  for (const [nodeId, senderValue] of senderRow || []) {
    const current = receiverRow.get(nodeId) || 0;
    receiverRow.set(nodeId, Math.max(current, senderValue));
  }

  incrementMatrix(receiver);

  message.received = true;
  message.receivedAt = Date.now();

  // Record event
  const flatMatrix: number[][] = [];
  for (const [, row] of receiver.matrix) {
    flatMatrix.push(Array.from(row.values()));
  }

  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId: message.receiverId,
    type: 'receive',
    timestamp: flatMatrix,
    clockType: 'matrix',
    description: `Receive from ${message.senderId}`,
    linkedEventId: messageId,
    createdAt: Date.now(),
  });

  const resultMatrix: Record<string, Record<string, number>> = {};
  for (const [rowId, row] of receiver.matrix) {
    resultMatrix[rowId] = Object.fromEntries(row);
  }

  return { receiverMatrix: resultMatrix };
}

// ============================================================================
// UNIFIED OPERATIONS
// ============================================================================

function increment(
  systemId: string,
  nodeId: string
): {
  nodeId: string;
  timestamp: unknown;
  clockType: ClockType;
} {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  const clock = system.nodes.get(nodeId);
  if (!clock) throw new Error(`Node ${nodeId} not found`);

  let timestamp: unknown;

  switch (system.type) {
    case 'lamport':
      timestamp = incrementLamport(clock as LamportClock);
      break;
    case 'vector':
      timestamp = Object.fromEntries(incrementVector(clock as VectorClock));
      break;
    case 'matrix':
      incrementMatrix(clock as MatrixClock);
      const mc = clock as MatrixClock;
      const result: Record<string, Record<string, number>> = {};
      for (const [rowId, row] of mc.matrix) {
        result[rowId] = Object.fromEntries(row);
      }
      timestamp = result;
      break;
  }

  // Record local event
  system.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nodeId,
    type: 'local',
    timestamp:
      system.type === 'lamport'
        ? (timestamp as number)
        : system.type === 'vector'
          ? Array.from((clock as VectorClock).vector.values())
          : [],
    clockType: system.type,
    description: 'Local event',
    createdAt: Date.now(),
  });

  return {
    nodeId,
    timestamp,
    clockType: system.type,
  };
}

function sendEvent(
  systemId: string,
  senderId: string,
  receiverId: string,
  payload?: unknown
): {
  messageId: string;
  senderTimestamp: unknown;
} {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  switch (system.type) {
    case 'lamport': {
      const result = sendLamport(system, senderId, receiverId, payload);
      return { messageId: result.messageId, senderTimestamp: result.senderTimestamp };
    }
    case 'vector': {
      const result = sendVector(system, senderId, receiverId, payload);
      return { messageId: result.messageId, senderTimestamp: result.senderVector };
    }
    case 'matrix': {
      const result = sendMatrix(system, senderId, receiverId, payload);
      return { messageId: result.messageId, senderTimestamp: result.senderMatrix };
    }
  }
}

function receiveEvent(
  systemId: string,
  messageId: string
): {
  receiverTimestamp: unknown;
  receiverId: string;
} {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  const message = system.messageQueue.find((m) => m.id === messageId);
  if (!message) throw new Error(`Message ${messageId} not found`);

  switch (system.type) {
    case 'lamport': {
      const result = receiveLamport(system, messageId);
      return { receiverTimestamp: result.receiverTimestamp, receiverId: message.receiverId };
    }
    case 'vector': {
      const result = receiveVector(system, messageId);
      return { receiverTimestamp: result.receiverVector, receiverId: message.receiverId };
    }
    case 'matrix': {
      const result = receiveMatrix(system, messageId);
      return { receiverTimestamp: result.receiverMatrix, receiverId: message.receiverId };
    }
  }
}

// ============================================================================
// COMPARISON AND ANALYSIS
// ============================================================================

function compareTimestamps(systemId: string, eventIdA: string, eventIdB: string): ComparisonResult {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  const eventA = system.events.find((e) => e.id === eventIdA);
  const eventB = system.events.find((e) => e.id === eventIdB);

  if (!eventA) throw new Error(`Event ${eventIdA} not found`);
  if (!eventB) throw new Error(`Event ${eventIdB} not found`);

  let relation: CausalRelation;
  let explanation: string;

  switch (system.type) {
    case 'lamport': {
      const tsA = eventA.timestamp as number;
      const tsB = eventB.timestamp as number;

      if (tsA < tsB) {
        relation = 'happened-before';
        explanation = `Lamport timestamp ${tsA} < ${tsB}, so A could have happened before B (but not guaranteed)`;
      } else if (tsA > tsB) {
        relation = 'happened-after';
        explanation = `Lamport timestamp ${tsA} > ${tsB}, so A happened after B (if causally related)`;
      } else {
        relation = 'concurrent';
        explanation = `Same Lamport timestamp ${tsA}, events are concurrent or same`;
      }
      break;
    }

    case 'vector': {
      const vecA = new Map<string, number>();
      const vecB = new Map<string, number>();

      const tsA = eventA.timestamp as number[];
      const tsB = eventB.timestamp as number[];

      system.nodeIds.forEach((id, i) => {
        vecA.set(id, tsA[i] || 0);
        vecB.set(id, tsB[i] || 0);
      });

      relation = compareVectorClocks(vecA, vecB);

      switch (relation) {
        case 'happened-before':
          explanation = `Vector clock A <= B componentwise with at least one strict inequality`;
          break;
        case 'happened-after':
          explanation = `Vector clock B <= A componentwise with at least one strict inequality`;
          break;
        case 'concurrent':
          explanation = `Neither vector clock dominates the other - events are concurrent`;
          break;
      }
      break;
    }

    case 'matrix':
      // For matrix clocks, compare the sender's row
      relation = 'concurrent';
      explanation = 'Matrix clock comparison based on relevant rows';
      break;

    default:
      relation = 'concurrent';
      explanation = 'Unknown clock type';
  }

  return {
    eventA: eventIdA,
    eventB: eventIdB,
    relation,
    timestampA: eventA.timestamp,
    timestampB: eventB.timestamp,
    explanation,
  };
}

function detectConcurrent(systemId: string): Array<{ eventA: string; eventB: string }> {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  const concurrent: Array<{ eventA: string; eventB: string }> = [];

  if (system.type !== 'vector') {
    // Only vector clocks can reliably detect concurrency
    return concurrent;
  }

  for (let i = 0; i < system.events.length; i++) {
    for (let j = i + 1; j < system.events.length; j++) {
      const eventA = system.events[i];
      const eventB = system.events[j];

      const vecA = new Map<string, number>();
      const vecB = new Map<string, number>();

      const tsA = eventA.timestamp as number[];
      const tsB = eventB.timestamp as number[];

      system.nodeIds.forEach((id, idx) => {
        vecA.set(id, tsA[idx] || 0);
        vecB.set(id, tsB[idx] || 0);
      });

      if (compareVectorClocks(vecA, vecB) === 'concurrent') {
        concurrent.push({ eventA: eventA.id, eventB: eventB.id });
      }
    }
  }

  return concurrent;
}

function visualizeOrdering(systemId: string): OrderingVisualization {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  const nodes = system.nodeIds;
  const nodeIndices = new Map(nodes.map((id, i) => [id, i]));

  // Group events by node and sort by timestamp
  const eventsByNode = new Map<string, Event[]>();
  for (const nodeId of nodes) {
    eventsByNode.set(nodeId, []);
  }

  for (const event of system.events) {
    eventsByNode.get(event.nodeId)?.push(event);
  }

  // Create visualization data
  const visualEvents: OrderingVisualization['events'] = [];
  const edges: OrderingVisualization['edges'] = [];

  let maxColumn = 0;
  const eventPositions = new Map<string, { column: number; row: number }>();

  for (const [nodeId, events] of eventsByNode) {
    const row = nodeIndices.get(nodeId)!;

    events.sort((a, b) => a.createdAt - b.createdAt);

    events.forEach((event, col) => {
      visualEvents.push({
        id: event.id,
        nodeId: event.nodeId,
        timestamp: event.timestamp,
        type: event.type,
        column: col,
        row,
      });
      eventPositions.set(event.id, { column: col, row });
      maxColumn = Math.max(maxColumn, col);
    });
  }

  // Add message edges
  for (const msg of system.messageQueue.filter((m) => m.received)) {
    const sendEvent = system.events.find((e) => e.linkedEventId === msg.id && e.type === 'send');
    const recvEvent = system.events.find((e) => e.linkedEventId === msg.id && e.type === 'receive');

    if (sendEvent && recvEvent) {
      edges.push({
        from: sendEvent.id,
        to: recvEvent.id,
        type: 'message',
      });
    }
  }

  // Add happens-before edges within same node
  for (const [, events] of eventsByNode) {
    for (let i = 1; i < events.length; i++) {
      edges.push({
        from: events[i - 1].id,
        to: events[i].id,
        type: 'happens-before',
      });
    }
  }

  // Generate ASCII art
  const asciiArt = generateAsciiDiagram(nodes, visualEvents, edges, maxColumn);

  return {
    nodes,
    events: visualEvents,
    edges,
    asciiArt,
  };
}

function generateAsciiDiagram(
  nodes: string[],
  events: OrderingVisualization['events'],
  edges: OrderingVisualization['edges'],
  maxColumn: number
): string {
  const lines: string[] = [];
  const cellWidth = 12;
  const header = '  Time -> ';

  // Header
  lines.push(
    header + Array.from({ length: maxColumn + 1 }, (_, i) => `t${i}`.padEnd(cellWidth)).join('')
  );
  lines.push('');

  // Create grid
  for (let row = 0; row < nodes.length; row++) {
    const nodeId = nodes[row];
    let line = nodeId.padEnd(10);

    const rowEvents = events.filter((e) => e.row === row).sort((a, b) => a.column - b.column);
    let lastCol = -1;

    for (const evt of rowEvents) {
      // Fill gaps
      while (lastCol < evt.column - 1) {
        line += '----'.padEnd(cellWidth);
        lastCol++;
      }

      // Event marker
      const marker = evt.type === 'send' ? 'S' : evt.type === 'receive' ? 'R' : 'L';
      line += `[${marker}]`.padEnd(cellWidth);
      lastCol = evt.column;
    }

    // Fill remaining
    while (lastCol < maxColumn) {
      line += '----'.padEnd(cellWidth);
      lastCol++;
    }

    lines.push(line);

    // Add message arrows (simplified)
    const outgoingMessages = edges.filter(
      (e) => e.type === 'message' && events.find((evt) => evt.id === e.from)?.row === row
    );

    if (outgoingMessages.length > 0) {
      let arrowLine = ''.padEnd(10);
      for (const msg of outgoingMessages) {
        const fromEvt = events.find((e) => e.id === msg.from)!;
        const toEvt = events.find((e) => e.id === msg.to)!;
        const direction = toEvt.row > fromEvt.row ? 'v' : '^';
        arrowLine += ''.padEnd(fromEvt.column * cellWidth) + direction;
      }
      if (arrowLine.trim()) {
        lines.push(arrowLine);
      }
    }
  }

  lines.push('');
  lines.push('Legend: [L]=Local, [S]=Send, [R]=Receive');

  return lines.join('\n');
}

function mergeClocks(
  systemId: string,
  nodeIds: string[]
): {
  mergedVector?: Record<string, number>;
  mergedMatrix?: Record<string, Record<string, number>>;
} {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  if (system.type === 'vector') {
    const merged = new Map<string, number>();

    for (const nodeId of system.nodeIds) {
      merged.set(nodeId, 0);
    }

    for (const nodeId of nodeIds) {
      const clock = system.nodes.get(nodeId) as VectorClock;
      if (clock) {
        for (const [id, value] of clock.vector) {
          merged.set(id, Math.max(merged.get(id) || 0, value));
        }
      }
    }

    return { mergedVector: Object.fromEntries(merged) };
  }

  if (system.type === 'matrix') {
    const merged = new Map<string, Map<string, number>>();

    for (const rowId of system.nodeIds) {
      const row = new Map<string, number>();
      for (const colId of system.nodeIds) {
        row.set(colId, 0);
      }
      merged.set(rowId, row);
    }

    for (const nodeId of nodeIds) {
      const clock = system.nodes.get(nodeId) as MatrixClock;
      if (clock) {
        for (const [rowId, row] of clock.matrix) {
          const mergedRow = merged.get(rowId)!;
          for (const [colId, value] of row) {
            mergedRow.set(colId, Math.max(mergedRow.get(colId) || 0, value));
          }
        }
      }
    }

    const result: Record<string, Record<string, number>> = {};
    for (const [rowId, row] of merged) {
      result[rowId] = Object.fromEntries(row);
    }

    return { mergedMatrix: result };
  }

  return {};
}

function getClockState(systemId: string, nodeId?: string): unknown {
  const system = clockSystems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);

  if (nodeId) {
    const clock = system.nodes.get(nodeId);
    if (!clock) throw new Error(`Node ${nodeId} not found`);

    switch (system.type) {
      case 'lamport':
        return { nodeId, timestamp: (clock as LamportClock).timestamp };
      case 'vector':
        return { nodeId, vector: Object.fromEntries((clock as VectorClock).vector) };
      case 'matrix': {
        const result: Record<string, Record<string, number>> = {};
        for (const [rowId, row] of (clock as MatrixClock).matrix) {
          result[rowId] = Object.fromEntries(row);
        }
        return { nodeId, matrix: result };
      }
    }
  }

  const allStates: Record<string, unknown> = {};
  for (const [id, clock] of system.nodes) {
    switch (system.type) {
      case 'lamport':
        allStates[id] = (clock as LamportClock).timestamp;
        break;
      case 'vector':
        allStates[id] = Object.fromEntries((clock as VectorClock).vector);
        break;
      case 'matrix': {
        const result: Record<string, Record<string, number>> = {};
        for (const [rowId, row] of (clock as MatrixClock).matrix) {
          result[rowId] = Object.fromEntries(row);
        }
        allStates[id] = result;
        break;
      }
    }
  }

  return {
    systemId,
    type: system.type,
    nodes: allStates,
    eventCount: system.events.length,
    pendingMessages: system.messageQueue.filter((m) => !m.received).length,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lamportclockTool: UnifiedTool = {
  name: 'lamport_clock',
  description:
    'Logical clocks for distributed systems: Lamport, Vector, and Matrix clocks with causal ordering',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_clock',
          'increment',
          'send_event',
          'receive_event',
          'compare_timestamps',
          'detect_concurrent',
          'visualize_ordering',
          'merge_clocks',
          'get_state',
          'get_events',
        ],
        description: 'Operation to perform',
      },
      systemId: { type: 'string', description: 'Clock system identifier' },
      nodeId: { type: 'string', description: 'Node identifier' },
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of node identifiers',
      },
      clockType: {
        type: 'string',
        enum: ['lamport', 'vector', 'matrix'],
        description: 'Type of clock',
      },
      senderId: { type: 'string', description: 'Sender node identifier' },
      receiverId: { type: 'string', description: 'Receiver node identifier' },
      messageId: { type: 'string', description: 'Message identifier' },
      eventIdA: { type: 'string', description: 'First event identifier' },
      eventIdB: { type: 'string', description: 'Second event identifier' },
      payload: { type: 'object', description: 'Message payload' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executelamportclock(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: unknown;

    switch (operation) {
      case 'create_clock': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.nodeIds || args.nodeIds.length === 0) throw new Error('nodeIds required');
        const clockType = args.clockType || 'lamport';

        const system = createClock({
          systemId: args.systemId,
          type: clockType,
          nodeIds: args.nodeIds,
        });

        result = {
          systemId: system.id,
          type: system.type,
          nodes: system.nodeIds,
          initialized: true,
        };
        break;
      }

      case 'increment': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.nodeId) throw new Error('nodeId required');
        result = increment(args.systemId, args.nodeId);
        break;
      }

      case 'send_event': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.senderId) throw new Error('senderId required');
        if (!args.receiverId) throw new Error('receiverId required');
        result = sendEvent(args.systemId, args.senderId, args.receiverId, args.payload);
        break;
      }

      case 'receive_event': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.messageId) throw new Error('messageId required');
        result = receiveEvent(args.systemId, args.messageId);
        break;
      }

      case 'compare_timestamps': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.eventIdA) throw new Error('eventIdA required');
        if (!args.eventIdB) throw new Error('eventIdB required');
        result = compareTimestamps(args.systemId, args.eventIdA, args.eventIdB);
        break;
      }

      case 'detect_concurrent': {
        if (!args.systemId) throw new Error('systemId required');
        result = {
          concurrentPairs: detectConcurrent(args.systemId),
        };
        break;
      }

      case 'visualize_ordering': {
        if (!args.systemId) throw new Error('systemId required');
        result = visualizeOrdering(args.systemId);
        break;
      }

      case 'merge_clocks': {
        if (!args.systemId) throw new Error('systemId required');
        if (!args.nodeIds) throw new Error('nodeIds required');
        result = mergeClocks(args.systemId, args.nodeIds);
        break;
      }

      case 'get_state': {
        if (!args.systemId) throw new Error('systemId required');
        result = getClockState(args.systemId, args.nodeId);
        break;
      }

      case 'get_events': {
        if (!args.systemId) throw new Error('systemId required');
        const system = clockSystems.get(args.systemId);
        if (!system) throw new Error(`System ${args.systemId} not found`);

        result = {
          events: system.events.map((e) => ({
            id: e.id,
            nodeId: e.nodeId,
            type: e.type,
            timestamp: e.timestamp,
            description: e.description,
          })),
          pendingMessages: system.messageQueue
            .filter((m) => !m.received)
            .map((m) => ({
              id: m.id,
              from: m.senderId,
              to: m.receiverId,
            })),
        };
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

export function islamportclockAvailable(): boolean {
  return true;
}
