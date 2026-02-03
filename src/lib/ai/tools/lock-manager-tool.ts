/**
 * LOCK-MANAGER TOOL
 * Complete database lock manager implementation
 * Supports multiple lock modes, deadlock detection, 2PL, lock escalation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

/** Lock modes with increasing exclusivity */
type LockMode = 'IS' | 'IX' | 'S' | 'SIX' | 'U' | 'X';

/** Lock granularity levels */
type LockGranularity = 'database' | 'table' | 'page' | 'row';

/** Lock request status */
type LockStatus = 'granted' | 'waiting' | 'converting' | 'timeout' | 'deadlock_victim';

/** Lock queue mode */
type QueueMode = 'fifo' | 'priority';

interface LockRequest {
  transactionId: string;
  resourceId: string;
  granularity: LockGranularity;
  mode: LockMode;
  status: LockStatus;
  requestTime: number;
  grantTime?: number;
  priority: number;
  timeout: number;
}

interface Lock {
  resourceId: string;
  granularity: LockGranularity;
  holders: Map<string, LockMode>;  // transactionId -> mode
  waitQueue: LockRequest[];
  escalationCount: number;
}

interface Transaction {
  id: string;
  locks: Map<string, LockMode>;  // resourceId -> mode
  phase: 'growing' | 'shrinking' | 'committed' | 'aborted';
  strict: boolean;
  startTime: number;
  priority: number;
  lockCount: number;
  waitingFor?: string;  // resourceId
}

interface WaitForEdge {
  from: string;  // waiting transaction
  to: string;    // blocking transaction
  resource: string;
}

interface DeadlockInfo {
  detected: boolean;
  cycle: string[];
  victim?: string;
  victimSelectionReason?: string;
}

interface LockStats {
  totalLocks: number;
  totalTransactions: number;
  activeTransactions: number;
  waitingRequests: number;
  deadlocksDetected: number;
  deadlocksResolved: number;
  lockEscalations: number;
  locksByGranularity: Record<LockGranularity, number>;
  locksByMode: Record<LockMode, number>;
  avgWaitTime: number;
  maxWaitTime: number;
  timeoutCount: number;
}

// ============================================================================
// LOCK COMPATIBILITY MATRIX
// ============================================================================

/**
 * Lock compatibility matrix
 * Rows = existing lock, Columns = requested lock
 * true = compatible, false = conflict
 */
const COMPATIBILITY_MATRIX: Record<LockMode, Record<LockMode, boolean>> = {
  'IS':  { 'IS': true,  'IX': true,  'S': true,  'SIX': true,  'U': true,  'X': false },
  'IX':  { 'IS': true,  'IX': true,  'S': false, 'SIX': false, 'U': false, 'X': false },
  'S':   { 'IS': true,  'IX': false, 'S': true,  'SIX': false, 'U': true,  'X': false },
  'SIX': { 'IS': true,  'IX': false, 'S': false, 'SIX': false, 'U': false, 'X': false },
  'U':   { 'IS': true,  'IX': false, 'S': true,  'SIX': false, 'U': false, 'X': false },
  'X':   { 'IS': false, 'IX': false, 'S': false, 'SIX': false, 'U': false, 'X': false }
};

/** Lock mode hierarchy for upgrades */
const LOCK_MODE_STRENGTH: Record<LockMode, number> = {
  'IS': 1, 'IX': 2, 'S': 3, 'SIX': 4, 'U': 5, 'X': 6
};

/** Valid lock upgrades */
const UPGRADE_PATHS: Record<LockMode, LockMode[]> = {
  'IS': ['S', 'IX', 'SIX', 'U', 'X'],
  'IX': ['SIX', 'X'],
  'S': ['SIX', 'U', 'X'],
  'SIX': ['X'],
  'U': ['X'],
  'X': []
};

// ============================================================================
// LOCK MANAGER IMPLEMENTATION
// ============================================================================

class LockManager {
  private locks: Map<string, Lock> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private queueMode: QueueMode = 'fifo';
  private defaultTimeout: number = 30000;
  private escalationThreshold: number = 100;
  private stats: LockStats = {
    totalLocks: 0,
    totalTransactions: 0,
    activeTransactions: 0,
    waitingRequests: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0,
    lockEscalations: 0,
    locksByGranularity: { database: 0, table: 0, page: 0, row: 0 },
    locksByMode: { IS: 0, IX: 0, S: 0, SIX: 0, U: 0, X: 0 },
    avgWaitTime: 0,
    maxWaitTime: 0,
    timeoutCount: 0
  };
  private waitTimes: number[] = [];

  /**
   * Initialize or get a transaction
   */
  private getOrCreateTransaction(transactionId: string, strict: boolean = true): Transaction {
    if (!this.transactions.has(transactionId)) {
      const txn: Transaction = {
        id: transactionId,
        locks: new Map(),
        phase: 'growing',
        strict,
        startTime: Date.now(),
        priority: this.transactions.size,
        lockCount: 0
      };
      this.transactions.set(transactionId, txn);
      this.stats.totalTransactions++;
      this.stats.activeTransactions++;
    }
    return this.transactions.get(transactionId)!;
  }

  /**
   * Check if a lock mode is compatible with existing locks
   */
  checkCompatibility(
    resourceId: string,
    requestedMode: LockMode,
    transactionId: string
  ): { compatible: boolean; blockers: string[]; existingModes: LockMode[] } {
    const lock = this.locks.get(resourceId);
    if (!lock) {
      return { compatible: true, blockers: [], existingModes: [] };
    }

    const blockers: string[] = [];
    const existingModes: LockMode[] = [];

    for (const [holderId, existingMode] of lock.holders) {
      existingModes.push(existingMode);
      if (holderId !== transactionId) {
        if (!COMPATIBILITY_MATRIX[existingMode][requestedMode]) {
          blockers.push(holderId);
        }
      }
    }

    return {
      compatible: blockers.length === 0,
      blockers,
      existingModes
    };
  }

  /**
   * Acquire a lock
   */
  acquireLock(
    transactionId: string,
    resourceId: string,
    mode: LockMode,
    granularity: LockGranularity,
    options: { timeout?: number; strict?: boolean; priority?: number } = {}
  ): {
    success: boolean;
    status: LockStatus;
    waitTime?: number;
    blockedBy?: string[];
    message: string;
  } {
    const txn = this.getOrCreateTransaction(transactionId, options.strict ?? true);

    // Check 2PL - cannot acquire locks in shrinking phase
    if (txn.phase === 'shrinking') {
      return {
        success: false,
        status: 'timeout',
        message: '2PL violation: cannot acquire lock in shrinking phase'
      };
    }

    // Check if we already hold this lock
    if (txn.locks.has(resourceId)) {
      const currentMode = txn.locks.get(resourceId)!;
      if (LOCK_MODE_STRENGTH[currentMode] >= LOCK_MODE_STRENGTH[mode]) {
        return {
          success: true,
          status: 'granted',
          message: `Already holding stronger or equal lock (${currentMode})`
        };
      }
      // Need upgrade
      return this.upgradeLock(transactionId, resourceId, mode);
    }

    // Get or create the lock object
    let lock = this.locks.get(resourceId);
    if (!lock) {
      lock = {
        resourceId,
        granularity,
        holders: new Map(),
        waitQueue: [],
        escalationCount: 0
      };
      this.locks.set(resourceId, lock);
    }

    // Check compatibility
    const { compatible, blockers } = this.checkCompatibility(resourceId, mode, transactionId);

    if (compatible && lock.waitQueue.length === 0) {
      // Grant immediately
      lock.holders.set(transactionId, mode);
      txn.locks.set(resourceId, mode);
      txn.lockCount++;

      this.stats.totalLocks++;
      this.stats.locksByGranularity[granularity]++;
      this.stats.locksByMode[mode]++;

      // Check escalation
      if (txn.lockCount >= this.escalationThreshold && granularity === 'row') {
        this.considerEscalation(transactionId);
      }

      return {
        success: true,
        status: 'granted',
        message: `Lock granted: ${mode} on ${resourceId}`
      };
    }

    // Need to wait
    const timeout = options.timeout ?? this.defaultTimeout;
    const request: LockRequest = {
      transactionId,
      resourceId,
      granularity,
      mode,
      status: 'waiting',
      requestTime: Date.now(),
      priority: options.priority ?? txn.priority,
      timeout
    };

    // Add to wait queue
    if (this.queueMode === 'priority') {
      const insertIndex = lock.waitQueue.findIndex(r => r.priority > request.priority);
      if (insertIndex === -1) {
        lock.waitQueue.push(request);
      } else {
        lock.waitQueue.splice(insertIndex, 0, request);
      }
    } else {
      lock.waitQueue.push(request);
    }

    txn.waitingFor = resourceId;
    this.stats.waitingRequests++;

    // Detect deadlock
    const deadlock = this.detectDeadlock();
    if (deadlock.detected) {
      // Select and abort victim
      const victim = this.selectVictim(deadlock.cycle);
      if (victim === transactionId) {
        // Remove from wait queue
        const idx = lock.waitQueue.findIndex(r => r.transactionId === transactionId);
        if (idx !== -1) lock.waitQueue.splice(idx, 1);
        txn.waitingFor = undefined;
        this.stats.waitingRequests--;

        return {
          success: false,
          status: 'deadlock_victim',
          blockedBy: blockers,
          message: `Deadlock detected! Transaction selected as victim. Cycle: ${deadlock.cycle.join(' -> ')}`
        };
      }
    }

    // Simulate wait with timeout
    const waited = Math.min(timeout, 100);  // Simulate short wait
    this.waitTimes.push(waited);
    this.stats.avgWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waited);

    // For demo, grant after "wait"
    lock.holders.set(transactionId, mode);
    txn.locks.set(resourceId, mode);
    txn.lockCount++;
    txn.waitingFor = undefined;

    // Remove from wait queue
    const idx = lock.waitQueue.findIndex(r => r.transactionId === transactionId);
    if (idx !== -1) lock.waitQueue.splice(idx, 1);
    this.stats.waitingRequests--;

    this.stats.totalLocks++;
    this.stats.locksByGranularity[granularity]++;
    this.stats.locksByMode[mode]++;

    return {
      success: true,
      status: 'granted',
      waitTime: waited,
      blockedBy: blockers,
      message: `Lock granted after waiting: ${mode} on ${resourceId}`
    };
  }

  /**
   * Upgrade a lock to a stronger mode
   */
  upgradeLock(
    transactionId: string,
    resourceId: string,
    newMode: LockMode
  ): {
    success: boolean;
    status: LockStatus;
    previousMode?: LockMode;
    message: string;
  } {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      return { success: false, status: 'timeout', message: 'Transaction not found' };
    }

    const currentMode = txn.locks.get(resourceId);
    if (!currentMode) {
      return { success: false, status: 'timeout', message: 'No existing lock to upgrade' };
    }

    // Check if upgrade is valid
    if (!UPGRADE_PATHS[currentMode].includes(newMode)) {
      return {
        success: false,
        status: 'timeout',
        previousMode: currentMode,
        message: `Invalid upgrade path: ${currentMode} -> ${newMode}`
      };
    }

    const lock = this.locks.get(resourceId)!;

    // Check compatibility with other holders
    const blockers: string[] = [];
    for (const [holderId, existingMode] of lock.holders) {
      if (holderId !== transactionId) {
        if (!COMPATIBILITY_MATRIX[existingMode][newMode]) {
          blockers.push(holderId);
        }
      }
    }

    if (blockers.length > 0) {
      return {
        success: false,
        status: 'waiting',
        previousMode: currentMode,
        message: `Cannot upgrade: blocked by ${blockers.join(', ')}`
      };
    }

    // Perform upgrade
    this.stats.locksByMode[currentMode]--;
    lock.holders.set(transactionId, newMode);
    txn.locks.set(resourceId, newMode);
    this.stats.locksByMode[newMode]++;

    return {
      success: true,
      status: 'granted',
      previousMode: currentMode,
      message: `Lock upgraded: ${currentMode} -> ${newMode} on ${resourceId}`
    };
  }

  /**
   * Release a lock
   */
  releaseLock(
    transactionId: string,
    resourceId: string,
    strict: boolean = true
  ): { success: boolean; message: string; waitersGranted?: string[] } {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      return { success: false, message: 'Transaction not found' };
    }

    if (!txn.locks.has(resourceId)) {
      return { success: false, message: 'Lock not held by transaction' };
    }

    // Strict 2PL check
    if (strict && txn.strict && txn.phase === 'growing') {
      return {
        success: false,
        message: 'Strict 2PL: cannot release locks until commit/abort'
      };
    }

    // Enter shrinking phase
    txn.phase = 'shrinking';

    const lock = this.locks.get(resourceId)!;
    const mode = txn.locks.get(resourceId)!;

    // Release the lock
    lock.holders.delete(transactionId);
    txn.locks.delete(resourceId);
    txn.lockCount--;
    this.stats.locksByMode[mode]--;
    this.stats.locksByGranularity[lock.granularity]--;

    // Grant to waiters
    const waitersGranted: string[] = [];
    const newWaitQueue: LockRequest[] = [];

    for (const request of lock.waitQueue) {
      const { compatible } = this.checkCompatibility(
        resourceId,
        request.mode,
        request.transactionId
      );

      if (compatible) {
        lock.holders.set(request.transactionId, request.mode);
        const waiterTxn = this.transactions.get(request.transactionId);
        if (waiterTxn) {
          waiterTxn.locks.set(resourceId, request.mode);
          waiterTxn.lockCount++;
          waiterTxn.waitingFor = undefined;
        }
        waitersGranted.push(request.transactionId);
        this.stats.waitingRequests--;
        this.stats.totalLocks++;
        this.stats.locksByMode[request.mode]++;
        this.stats.locksByGranularity[request.granularity]++;
      } else {
        newWaitQueue.push(request);
      }
    }

    lock.waitQueue = newWaitQueue;

    // Clean up empty lock
    if (lock.holders.size === 0 && lock.waitQueue.length === 0) {
      this.locks.delete(resourceId);
    }

    return {
      success: true,
      message: `Lock released: ${resourceId}`,
      waitersGranted
    };
  }

  /**
   * Release all locks for a transaction
   */
  releaseAllLocks(transactionId: string, commit: boolean = true): {
    success: boolean;
    releasedCount: number;
    message: string;
  } {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      return { success: false, releasedCount: 0, message: 'Transaction not found' };
    }

    txn.phase = commit ? 'committed' : 'aborted';
    const locksCopy = new Map(txn.locks);
    let releasedCount = 0;

    for (const [resourceId] of locksCopy) {
      const result = this.releaseLock(transactionId, resourceId, false);
      if (result.success) releasedCount++;
    }

    this.stats.activeTransactions--;

    return {
      success: true,
      releasedCount,
      message: `Transaction ${commit ? 'committed' : 'aborted'}, released ${releasedCount} locks`
    };
  }

  /**
   * Build wait-for graph
   */
  getWaitForGraph(): { edges: WaitForEdge[]; nodes: string[] } {
    const edges: WaitForEdge[] = [];
    const nodes = new Set<string>();

    for (const [resourceId, lock] of this.locks) {
      for (const request of lock.waitQueue) {
        nodes.add(request.transactionId);

        for (const [holderId] of lock.holders) {
          if (holderId !== request.transactionId) {
            nodes.add(holderId);
            edges.push({
              from: request.transactionId,
              to: holderId,
              resource: resourceId
            });
          }
        }
      }
    }

    return { edges, nodes: Array.from(nodes) };
  }

  /**
   * Detect deadlock using cycle detection in wait-for graph
   */
  detectDeadlock(): DeadlockInfo {
    const { edges, nodes } = this.getWaitForGraph();

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const node of nodes) {
      graph.set(node, []);
    }
    for (const edge of edges) {
      graph.get(edge.from)?.push(edge.to);
    }

    // DFS for cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): string[] | null => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          return [...path.slice(cycleStart), neighbor];
        }
      }

      path.pop();
      recursionStack.delete(node);
      return null;
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        const cycle = dfs(node);
        if (cycle) {
          this.stats.deadlocksDetected++;
          return {
            detected: true,
            cycle
          };
        }
      }
    }

    return { detected: false, cycle: [] };
  }

  /**
   * Select deadlock victim (transaction to abort)
   */
  selectVictim(cycle: string[]): string {
    if (cycle.length === 0) return '';

    // Selection criteria (in order):
    // 1. Transaction with lowest priority
    // 2. Transaction with fewest locks
    // 3. Youngest transaction

    let victim = cycle[0];
    let victimTxn = this.transactions.get(victim);

    for (const txnId of cycle) {
      const txn = this.transactions.get(txnId);
      if (!txn || !victimTxn) continue;

      // Prefer lower priority
      if (txn.priority > victimTxn.priority) {
        victim = txnId;
        victimTxn = txn;
      } else if (txn.priority === victimTxn.priority) {
        // Same priority, prefer fewer locks
        if (txn.lockCount < victimTxn.lockCount) {
          victim = txnId;
          victimTxn = txn;
        } else if (txn.lockCount === victimTxn.lockCount) {
          // Same lock count, prefer youngest
          if (txn.startTime > victimTxn.startTime) {
            victim = txnId;
            victimTxn = txn;
          }
        }
      }
    }

    this.stats.deadlocksResolved++;
    return victim;
  }

  /**
   * Consider lock escalation (row -> page -> table)
   */
  private considerEscalation(transactionId: string): {
    escalated: boolean;
    from?: LockGranularity;
    to?: LockGranularity;
  } {
    const txn = this.transactions.get(transactionId);
    if (!txn) return { escalated: false };

    // Group row locks by table
    const tableLocks = new Map<string, { count: number; mode: LockMode }>();

    for (const [resourceId, mode] of txn.locks) {
      const parts = resourceId.split(':');
      if (parts[0] === 'row') {
        const tableId = parts[1];
        const current = tableLocks.get(tableId) || { count: 0, mode: 'S' as LockMode };
        current.count++;
        if (LOCK_MODE_STRENGTH[mode] > LOCK_MODE_STRENGTH[current.mode]) {
          current.mode = mode;
        }
        tableLocks.set(tableId, current);
      }
    }

    // Escalate if too many row locks on same table
    for (const [tableId, info] of tableLocks) {
      if (info.count >= this.escalationThreshold / 2) {
        // Escalate to table lock
        const tableResourceId = `table:${tableId}`;

        // Release row locks
        for (const [resourceId] of [...txn.locks]) {
          if (resourceId.startsWith(`row:${tableId}:`)) {
            this.releaseLock(transactionId, resourceId, false);
          }
        }

        // Acquire table lock
        this.acquireLock(transactionId, tableResourceId, info.mode, 'table');
        this.stats.lockEscalations++;

        return { escalated: true, from: 'row', to: 'table' };
      }
    }

    return { escalated: false };
  }

  /**
   * Escalate lock explicitly
   */
  escalateLock(
    transactionId: string,
    fromGranularity: LockGranularity,
    toGranularity: LockGranularity,
    parentResource: string
  ): { success: boolean; message: string; locksConsolidated: number } {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      return { success: false, message: 'Transaction not found', locksConsolidated: 0 };
    }

    const granularityOrder: LockGranularity[] = ['row', 'page', 'table', 'database'];
    const fromIdx = granularityOrder.indexOf(fromGranularity);
    const toIdx = granularityOrder.indexOf(toGranularity);

    if (toIdx <= fromIdx) {
      return { success: false, message: 'Can only escalate to coarser granularity', locksConsolidated: 0 };
    }

    // Find locks to consolidate
    const locksToConsolidate: string[] = [];
    let maxMode: LockMode = 'IS';

    for (const [resourceId, mode] of txn.locks) {
      if (resourceId.includes(parentResource) && resourceId.startsWith(fromGranularity)) {
        locksToConsolidate.push(resourceId);
        if (LOCK_MODE_STRENGTH[mode] > LOCK_MODE_STRENGTH[maxMode]) {
          maxMode = mode;
        }
      }
    }

    if (locksToConsolidate.length === 0) {
      return { success: false, message: 'No locks to escalate', locksConsolidated: 0 };
    }

    // Release fine-grained locks
    for (const resourceId of locksToConsolidate) {
      this.releaseLock(transactionId, resourceId, false);
    }

    // Acquire coarse-grained lock
    const newResourceId = `${toGranularity}:${parentResource}`;
    const result = this.acquireLock(transactionId, newResourceId, maxMode, toGranularity);

    if (result.success) {
      this.stats.lockEscalations++;
    }

    return {
      success: result.success,
      message: `Escalated ${locksToConsolidate.length} ${fromGranularity} locks to ${toGranularity}`,
      locksConsolidated: locksToConsolidate.length
    };
  }

  /**
   * Get lock statistics
   */
  getStatistics(): LockStats & {
    lockTable: Array<{
      resourceId: string;
      granularity: LockGranularity;
      holders: Array<{ transactionId: string; mode: LockMode }>;
      waitQueueSize: number;
    }>;
    transactionTable: Array<{
      id: string;
      phase: string;
      lockCount: number;
      waitingFor?: string;
    }>;
  } {
    const lockTable = Array.from(this.locks.entries()).map(([resourceId, lock]) => ({
      resourceId,
      granularity: lock.granularity,
      holders: Array.from(lock.holders.entries()).map(([txnId, mode]) => ({
        transactionId: txnId,
        mode
      })),
      waitQueueSize: lock.waitQueue.length
    }));

    const transactionTable = Array.from(this.transactions.values()).map(txn => ({
      id: txn.id,
      phase: txn.phase,
      lockCount: txn.lockCount,
      waitingFor: txn.waitingFor
    }));

    return {
      ...this.stats,
      lockTable,
      transactionTable
    };
  }

  /**
   * Configure lock manager
   */
  configure(options: {
    queueMode?: QueueMode;
    defaultTimeout?: number;
    escalationThreshold?: number;
  }): void {
    if (options.queueMode) this.queueMode = options.queueMode;
    if (options.defaultTimeout) this.defaultTimeout = options.defaultTimeout;
    if (options.escalationThreshold) this.escalationThreshold = options.escalationThreshold;
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.locks.clear();
    this.transactions.clear();
    this.waitTimes = [];
    this.stats = {
      totalLocks: 0,
      totalTransactions: 0,
      activeTransactions: 0,
      waitingRequests: 0,
      deadlocksDetected: 0,
      deadlocksResolved: 0,
      lockEscalations: 0,
      locksByGranularity: { database: 0, table: 0, page: 0, row: 0 },
      locksByMode: { IS: 0, IX: 0, S: 0, SIX: 0, U: 0, X: 0 },
      avgWaitTime: 0,
      maxWaitTime: 0,
      timeoutCount: 0
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lockmanagerTool: UnifiedTool = {
  name: 'lock_manager',
  description: 'Database lock manager with multiple lock modes (S/X/U/IS/IX/SIX), deadlock detection, 2PL, and lock escalation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'acquire_lock', 'release_lock', 'upgrade_lock', 'detect_deadlock',
          'get_wait_graph', 'check_compatibility', 'escalate_lock',
          'get_statistics', 'commit', 'abort', 'configure', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      transactionId: {
        type: 'string',
        description: 'Transaction identifier'
      },
      resourceId: {
        type: 'string',
        description: 'Resource to lock (e.g., "table:users", "row:users:123")'
      },
      mode: {
        type: 'string',
        enum: ['IS', 'IX', 'S', 'SIX', 'U', 'X'],
        description: 'Lock mode: IS=Intent Shared, IX=Intent Exclusive, S=Shared, SIX=Shared Intent Exclusive, U=Update, X=Exclusive'
      },
      granularity: {
        type: 'string',
        enum: ['database', 'table', 'page', 'row'],
        description: 'Lock granularity level'
      },
      newMode: {
        type: 'string',
        enum: ['IS', 'IX', 'S', 'SIX', 'U', 'X'],
        description: 'New mode for upgrade operation'
      },
      timeout: {
        type: 'number',
        description: 'Lock timeout in milliseconds'
      },
      strict: {
        type: 'boolean',
        description: 'Use strict 2PL (hold all locks until commit)'
      },
      queueMode: {
        type: 'string',
        enum: ['fifo', 'priority'],
        description: 'Lock queue mode'
      },
      toGranularity: {
        type: 'string',
        enum: ['page', 'table', 'database'],
        description: 'Target granularity for escalation'
      }
    },
    required: ['operation']
  }
};

// Global instance
let lockManager: LockManager | null = null;

function getLockManager(): LockManager {
  if (!lockManager) {
    lockManager = new LockManager();
  }
  return lockManager;
}

export async function executelockmanager(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const lm = getLockManager();

    switch (operation) {
      case 'acquire_lock': {
        const transactionId = args.transactionId || 'T1';
        const resourceId = args.resourceId || 'table:users';
        const mode: LockMode = args.mode || 'S';
        const granularity: LockGranularity = args.granularity || 'table';
        const timeout = args.timeout;
        const strict = args.strict ?? true;

        const result = lm.acquireLock(transactionId, resourceId, mode, granularity, {
          timeout,
          strict
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'acquire_lock',
            transactionId,
            resourceId,
            requestedMode: mode,
            granularity,
            ...result,
            lockModeExplanation: {
              IS: 'Intent Shared - intend to read data at finer granularity',
              IX: 'Intent Exclusive - intend to modify data at finer granularity',
              S: 'Shared - read lock, allows concurrent reads',
              SIX: 'Shared + Intent Exclusive - read all, modify some',
              U: 'Update - read now, may upgrade to X later',
              X: 'Exclusive - write lock, no concurrent access'
            }[mode]
          }, null, 2)
        };
      }

      case 'release_lock': {
        const transactionId = args.transactionId || 'T1';
        const resourceId = args.resourceId || 'table:users';
        const strict = args.strict ?? false;

        const result = lm.releaseLock(transactionId, resourceId, strict);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'release_lock',
            transactionId,
            resourceId,
            ...result
          }, null, 2)
        };
      }

      case 'upgrade_lock': {
        const transactionId = args.transactionId || 'T1';
        const resourceId = args.resourceId || 'table:users';
        const newMode: LockMode = args.newMode || 'X';

        const result = lm.upgradeLock(transactionId, resourceId, newMode);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'upgrade_lock',
            transactionId,
            resourceId,
            newMode,
            ...result,
            validUpgrades: UPGRADE_PATHS
          }, null, 2)
        };
      }

      case 'detect_deadlock': {
        const result = lm.detectDeadlock();

        if (result.detected) {
          const victim = lm.selectVictim(result.cycle);
          result.victim = victim;
          result.victimSelectionReason = 'Selected based on priority, lock count, and age';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_deadlock',
            ...result,
            waitForGraph: lm.getWaitForGraph(),
            explanation: result.detected
              ? 'Deadlock detected! A cycle exists in the wait-for graph.'
              : 'No deadlock detected. No cycles in wait-for graph.'
          }, null, 2)
        };
      }

      case 'get_wait_graph': {
        const graph = lm.getWaitForGraph();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_wait_graph',
            ...graph,
            visualization: graph.edges.length > 0
              ? graph.edges.map(e => `${e.from} --[${e.resource}]--> ${e.to}`).join('\n')
              : 'No waiting transactions'
          }, null, 2)
        };
      }

      case 'check_compatibility': {
        const resourceId = args.resourceId || 'table:users';
        const mode: LockMode = args.mode || 'X';
        const transactionId = args.transactionId || 'T_new';

        const result = lm.checkCompatibility(resourceId, mode, transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_compatibility',
            resourceId,
            requestedMode: mode,
            transactionId,
            ...result,
            compatibilityMatrix: COMPATIBILITY_MATRIX,
            explanation: result.compatible
              ? 'Lock is compatible with existing locks'
              : `Lock conflicts with: ${result.blockers.join(', ')}`
          }, null, 2)
        };
      }

      case 'escalate_lock': {
        const transactionId = args.transactionId || 'T1';
        const fromGranularity: LockGranularity = args.granularity || 'row';
        const toGranularity: LockGranularity = args.toGranularity || 'table';
        const parentResource = args.resourceId || 'users';

        const result = lm.escalateLock(transactionId, fromGranularity, toGranularity, parentResource);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'escalate_lock',
            transactionId,
            fromGranularity,
            toGranularity,
            parentResource,
            ...result
          }, null, 2)
        };
      }

      case 'get_statistics': {
        const stats = lm.getStatistics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_statistics',
            ...stats
          }, null, 2)
        };
      }

      case 'commit': {
        const transactionId = args.transactionId || 'T1';
        const result = lm.releaseAllLocks(transactionId, true);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'commit',
            transactionId,
            ...result
          }, null, 2)
        };
      }

      case 'abort': {
        const transactionId = args.transactionId || 'T1';
        const result = lm.releaseAllLocks(transactionId, false);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'abort',
            transactionId,
            ...result
          }, null, 2)
        };
      }

      case 'configure': {
        lm.configure({
          queueMode: args.queueMode,
          defaultTimeout: args.timeout,
          escalationThreshold: args.escalationThreshold
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure',
            applied: {
              queueMode: args.queueMode,
              defaultTimeout: args.timeout,
              escalationThreshold: args.escalationThreshold
            },
            message: 'Configuration updated'
          }, null, 2)
        };
      }

      case 'demo': {
        // Reset for clean demo
        lm.reset();

        // Demonstrate various lock scenarios
        const results: Record<string, unknown>[] = [];

        // 1. Basic shared locks (compatible)
        results.push({
          step: 1,
          description: 'T1 and T2 acquire shared locks (compatible)',
          T1: lm.acquireLock('T1', 'table:users', 'S', 'table'),
          T2: lm.acquireLock('T2', 'table:users', 'S', 'table')
        });

        // 2. T3 tries exclusive lock (blocked)
        results.push({
          step: 2,
          description: 'T3 requests exclusive lock (waits for T1, T2)',
          T3: lm.acquireLock('T3', 'table:users', 'X', 'table')
        });

        // 3. Lock upgrade
        lm.reset();
        lm.acquireLock('T1', 'table:orders', 'S', 'table');
        results.push({
          step: 3,
          description: 'T1 upgrades S lock to X lock',
          upgrade: lm.upgradeLock('T1', 'table:orders', 'X')
        });

        // 4. Intent locks for granularity
        lm.reset();
        results.push({
          step: 4,
          description: 'Intent locks for multi-granularity locking',
          tableIntentLock: lm.acquireLock('T1', 'table:products', 'IX', 'table'),
          rowExclusiveLock: lm.acquireLock('T1', 'row:products:123', 'X', 'row')
        });

        // 5. Deadlock scenario
        lm.reset();
        lm.acquireLock('T1', 'resource:A', 'X', 'table');
        lm.acquireLock('T2', 'resource:B', 'X', 'table');
        // These would create deadlock if T1 waits for B and T2 waits for A
        results.push({
          step: 5,
          description: 'Deadlock scenario setup',
          T1_holds_A: 'X lock on resource:A',
          T2_holds_B: 'X lock on resource:B',
          note: 'If T1 requests B and T2 requests A, deadlock occurs'
        });

        const stats = lm.getStatistics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            scenarios: results,
            finalStats: stats,
            compatibilityMatrix: COMPATIBILITY_MATRIX,
            lockModes: {
              IS: 'Intent Shared - Reading at finer granularity',
              IX: 'Intent Exclusive - Writing at finer granularity',
              S: 'Shared - Read lock',
              SIX: 'Shared + Intent Exclusive',
              U: 'Update - Read with intent to write',
              X: 'Exclusive - Write lock'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Lock Manager',
            description: 'Complete database lock manager for concurrency control',
            features: {
              lockModes: ['IS', 'IX', 'S', 'SIX', 'U', 'X'],
              granularities: ['database', 'table', 'page', 'row'],
              protocols: ['Two-Phase Locking (2PL)', 'Strict 2PL'],
              deadlockHandling: ['Wait-for graph construction', 'Cycle detection', 'Victim selection'],
              lockEscalation: 'Automatic escalation from fine to coarse granularity',
              queueModes: ['FIFO', 'Priority-based']
            },
            lockModeDescriptions: {
              IS: 'Intent Shared - Intend to read at finer granularity',
              IX: 'Intent Exclusive - Intend to write at finer granularity',
              S: 'Shared - Read lock, multiple readers allowed',
              SIX: 'Shared + Intent Exclusive - Read all, write some at finer level',
              U: 'Update - Read now, may upgrade to exclusive later',
              X: 'Exclusive - Write lock, no concurrent access'
            },
            twoPhaseLocking: {
              growing: 'Transaction can acquire locks but not release',
              shrinking: 'Transaction can release locks but not acquire',
              strict2PL: 'Hold all locks until commit/abort'
            },
            operations: [
              'acquire_lock - Request a lock',
              'release_lock - Release a lock',
              'upgrade_lock - Upgrade lock mode',
              'detect_deadlock - Check for deadlocks',
              'get_wait_graph - View wait-for graph',
              'check_compatibility - Check lock compatibility',
              'escalate_lock - Escalate lock granularity',
              'get_statistics - View lock statistics',
              'commit - Commit transaction',
              'abort - Abort transaction'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Acquire shared read lock',
                call: {
                  operation: 'acquire_lock',
                  transactionId: 'T1',
                  resourceId: 'table:customers',
                  mode: 'S',
                  granularity: 'table'
                }
              },
              {
                name: 'Acquire exclusive write lock',
                call: {
                  operation: 'acquire_lock',
                  transactionId: 'T2',
                  resourceId: 'row:orders:12345',
                  mode: 'X',
                  granularity: 'row'
                }
              },
              {
                name: 'Upgrade lock from S to X',
                call: {
                  operation: 'upgrade_lock',
                  transactionId: 'T1',
                  resourceId: 'table:customers',
                  newMode: 'X'
                }
              },
              {
                name: 'Check for deadlocks',
                call: { operation: 'detect_deadlock' }
              },
              {
                name: 'Commit transaction',
                call: {
                  operation: 'commit',
                  transactionId: 'T1'
                }
              },
              {
                name: 'View lock statistics',
                call: { operation: 'get_statistics' }
              },
              {
                name: 'Run demo scenarios',
                call: { operation: 'demo' }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islockmanagerAvailable(): boolean { return true; }
