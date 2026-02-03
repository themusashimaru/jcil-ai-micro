/**
 * MVCC TOOL
 * Multi-Version Concurrency Control implementation
 * Supports transaction management, version chains, and multiple isolation levels
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type IsolationLevel = 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
type TransactionState = 'ACTIVE' | 'COMMITTED' | 'ABORTED' | 'PREPARING';
type VersionStorageType = 'APPEND_ONLY' | 'IN_PLACE_WITH_UNDO';

interface TransactionId {
  id: number;
  timestamp: number;
}

interface Transaction {
  txId: TransactionId;
  state: TransactionState;
  isolationLevel: IsolationLevel;
  startTimestamp: number;
  commitTimestamp?: number;
  readSet: Map<string, number>; // key -> version read
  writeSet: Map<string, VersionedValue>; // key -> value written
  snapshot?: Snapshot;
  locksHeld: Set<string>;
}

interface VersionedValue {
  value: unknown;
  xmin: number; // Transaction that created this version
  xmax: number; // Transaction that deleted/updated this version (0 if active)
  timestamp: number;
  prevVersion?: VersionedValue;
  undoLog?: UndoLogEntry;
}

interface UndoLogEntry {
  txId: number;
  key: string;
  oldValue: unknown;
  timestamp: number;
  next?: UndoLogEntry;
}

interface Snapshot {
  xmin: number; // Oldest active transaction at snapshot time
  xmax: number; // Next transaction ID at snapshot time
  activeTransactions: Set<number>; // Transactions active at snapshot time
  timestamp: number;
}

interface ConflictInfo {
  type: 'WRITE_WRITE' | 'READ_WRITE' | 'WRITE_READ' | 'DEADLOCK';
  txId1: number;
  txId2: number;
  key: string;
  resolution: string;
}

interface VersionChain {
  key: string;
  versions: VersionedValue[];
  currentVersion: VersionedValue;
  oldestVisibleVersion?: VersionedValue;
}

interface VacuumResult {
  versionsRemoved: number;
  keysProcessed: number;
  oldestActiveTx: number;
  spaceReclaimed: number;
  duration: number;
}

interface MVCCStats {
  totalTransactions: number;
  activeTransactions: number;
  committedTransactions: number;
  abortedTransactions: number;
  totalVersions: number;
  deadVersions: number;
  conflicts: number;
  deadlocks: number;
}

// ============================================================================
// MVCC ENGINE
// ============================================================================

class MVCCEngine {
  private transactions: Map<number, Transaction> = new Map();
  private data: Map<string, VersionedValue> = new Map();
  private nextTxId = 1;
  private nextTimestamp = 1;
  private conflictLog: ConflictInfo[] = [];
  private versionStorage: VersionStorageType = 'APPEND_ONLY';
  private undoLog: UndoLogEntry[] = [];
  private waitForGraph: Map<number, Set<number>> = new Map(); // txId -> waiting for txIds

  // Statistics
  private stats: MVCCStats = {
    totalTransactions: 0,
    activeTransactions: 0,
    committedTransactions: 0,
    abortedTransactions: 0,
    totalVersions: 0,
    deadVersions: 0,
    conflicts: 0,
    deadlocks: 0,
  };

  constructor(storageType: VersionStorageType = 'APPEND_ONLY') {
    this.versionStorage = storageType;
  }

  // ==========================================================================
  // TRANSACTION MANAGEMENT
  // ==========================================================================

  beginTransaction(isolationLevel: IsolationLevel = 'READ_COMMITTED'): Transaction {
    const txId: TransactionId = {
      id: this.nextTxId++,
      timestamp: this.nextTimestamp++,
    };

    const tx: Transaction = {
      txId,
      state: 'ACTIVE',
      isolationLevel,
      startTimestamp: txId.timestamp,
      readSet: new Map(),
      writeSet: new Map(),
      locksHeld: new Set(),
    };

    // Create snapshot for REPEATABLE_READ and SERIALIZABLE
    if (isolationLevel === 'REPEATABLE_READ' || isolationLevel === 'SERIALIZABLE') {
      tx.snapshot = this.createSnapshot();
    }

    this.transactions.set(txId.id, tx);
    this.stats.totalTransactions++;
    this.stats.activeTransactions++;

    return tx;
  }

  commit(txId: number): { success: boolean; error?: string } {
    const tx = this.transactions.get(txId);
    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    if (tx.state !== 'ACTIVE') {
      return { success: false, error: `Transaction is ${tx.state}, cannot commit` };
    }

    // For SERIALIZABLE, check for serialization anomalies
    if (tx.isolationLevel === 'SERIALIZABLE') {
      const conflict = this.checkSerializableConflicts(tx);
      if (conflict) {
        this.abort(txId);
        return { success: false, error: `Serialization failure: ${conflict.resolution}` };
      }
    }

    // Assign commit timestamp
    tx.commitTimestamp = this.nextTimestamp++;
    tx.state = 'COMMITTED';

    // Make writes visible
    for (const [key, version] of tx.writeSet) {
      version.xmax = 0; // Mark as current version
      this.data.set(key, version);
    }

    // Release locks
    tx.locksHeld.clear();
    this.removeFromWaitForGraph(txId);

    this.stats.activeTransactions--;
    this.stats.committedTransactions++;

    return { success: true };
  }

  abort(txId: number): { success: boolean; error?: string } {
    const tx = this.transactions.get(txId);
    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    if (tx.state === 'COMMITTED') {
      return { success: false, error: 'Cannot abort committed transaction' };
    }

    tx.state = 'ABORTED';

    // Rollback writes
    if (this.versionStorage === 'IN_PLACE_WITH_UNDO') {
      this.rollbackWithUndo(tx);
    } else {
      // For append-only, just mark versions as invalid
      for (const [key, version] of tx.writeSet) {
        version.xmax = txId; // Mark version as dead
        // Restore previous version if exists
        if (version.prevVersion) {
          this.data.set(key, version.prevVersion);
        } else {
          this.data.delete(key);
        }
      }
    }

    // Release locks
    tx.locksHeld.clear();
    this.removeFromWaitForGraph(txId);

    this.stats.activeTransactions--;
    this.stats.abortedTransactions++;

    return { success: true };
  }

  rollback(txId: number): { success: boolean; error?: string } {
    return this.abort(txId);
  }

  private rollbackWithUndo(tx: Transaction): void {
    // Process undo log in reverse order
    for (const entry of this.undoLog.filter((e) => e.txId === tx.txId.id).reverse()) {
      const current = this.data.get(entry.key);
      if (current) {
        // Restore old value
        const restoredVersion: VersionedValue = {
          value: entry.oldValue,
          xmin: current.xmin,
          xmax: 0,
          timestamp: entry.timestamp,
        };
        this.data.set(entry.key, restoredVersion);
      }
    }
  }

  // ==========================================================================
  // READ/WRITE OPERATIONS
  // ==========================================================================

  read(txId: number, key: string): { value: unknown | null; found: boolean; version?: number } {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state !== 'ACTIVE') {
      throw new Error('Invalid or inactive transaction');
    }

    // Check if we wrote this value in current transaction
    if (tx.writeSet.has(key)) {
      const version = tx.writeSet.get(key)!;
      return { value: version.value, found: true, version: version.timestamp };
    }

    // Find visible version based on isolation level
    const version = this.findVisibleVersion(tx, key);
    if (!version) {
      return { value: null, found: false };
    }

    // Record in read set for conflict detection
    tx.readSet.set(key, version.timestamp);

    return { value: version.value, found: true, version: version.timestamp };
  }

  write(txId: number, key: string, value: unknown): { success: boolean; conflict?: ConflictInfo } {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state !== 'ACTIVE') {
      throw new Error('Invalid or inactive transaction');
    }

    const currentVersion = this.data.get(key);

    // Check for write-write conflicts
    if (currentVersion && currentVersion.xmax === 0) {
      // Check if another active transaction wrote this
      const writerTx = this.transactions.get(currentVersion.xmin);
      if (writerTx && writerTx.state === 'ACTIVE' && writerTx.txId.id !== txId) {
        const conflict: ConflictInfo = {
          type: 'WRITE_WRITE',
          txId1: txId,
          txId2: currentVersion.xmin,
          key,
          resolution: 'First-writer wins - current transaction must wait or abort',
        };
        this.conflictLog.push(conflict);
        this.stats.conflicts++;

        // Add to wait-for graph and check for deadlock
        this.addToWaitForGraph(txId, currentVersion.xmin);
        if (this.detectDeadlock(txId)) {
          conflict.type = 'DEADLOCK';
          conflict.resolution = 'Deadlock detected - aborting current transaction';
          this.stats.deadlocks++;
          return { success: false, conflict };
        }

        return { success: false, conflict };
      }
    }

    // Create new version
    const newVersion: VersionedValue = {
      value,
      xmin: txId,
      xmax: txId, // Not yet visible to others
      timestamp: this.nextTimestamp++,
      prevVersion: currentVersion,
    };

    // For in-place with undo, create undo log entry
    if (this.versionStorage === 'IN_PLACE_WITH_UNDO' && currentVersion) {
      const undoEntry: UndoLogEntry = {
        txId,
        key,
        oldValue: currentVersion.value,
        timestamp: currentVersion.timestamp,
      };
      this.undoLog.push(undoEntry);
      newVersion.undoLog = undoEntry;
    }

    // Mark old version as superseded
    if (currentVersion) {
      currentVersion.xmax = txId;
    }

    tx.writeSet.set(key, newVersion);
    this.stats.totalVersions++;

    return { success: true };
  }

  // ==========================================================================
  // VISIBILITY CHECKING
  // ==========================================================================

  private findVisibleVersion(tx: Transaction, key: string): VersionedValue | null {
    let version = this.data.get(key);

    while (version) {
      if (this.isVersionVisible(tx, version)) {
        return version;
      }
      version = version.prevVersion;
    }

    return null;
  }

  isVersionVisible(tx: Transaction, version: VersionedValue): boolean {
    const xmin = version.xmin;
    const xmax = version.xmax;

    switch (tx.isolationLevel) {
      case 'READ_UNCOMMITTED':
        // Can see uncommitted data
        return xmax === 0 || xmax === tx.txId.id;

      case 'READ_COMMITTED':
        // Can only see committed data
        return this.isCommitted(xmin) && (xmax === 0 || !this.isCommitted(xmax));

      case 'REPEATABLE_READ':
      case 'SERIALIZABLE':
        // Use snapshot
        if (!tx.snapshot) return false;
        return this.isVisibleInSnapshot(version, tx.snapshot);

      default:
        return false;
    }
  }

  private isVisibleInSnapshot(version: VersionedValue, snapshot: Snapshot): boolean {
    const xmin = version.xmin;
    const xmax = version.xmax;

    // Version created by transaction that was active at snapshot time is not visible
    if (snapshot.activeTransactions.has(xmin)) {
      return false;
    }

    // Version created after snapshot is not visible
    if (xmin >= snapshot.xmax) {
      return false;
    }

    // Check if version was deleted before snapshot
    if (xmax !== 0) {
      const deleteTx = this.transactions.get(xmax);
      if (
        deleteTx &&
        deleteTx.state === 'COMMITTED' &&
        deleteTx.commitTimestamp! < snapshot.timestamp
      ) {
        return false;
      }
    }

    // Check if creating transaction was committed before snapshot
    const createTx = this.transactions.get(xmin);
    if (!createTx || createTx.state !== 'COMMITTED') {
      return false;
    }

    return true;
  }

  checkVisibility(
    txId: number,
    key: string
  ): { visible: boolean; reason: string; version?: VersionedValue } {
    const tx = this.transactions.get(txId);
    if (!tx) {
      return { visible: false, reason: 'Transaction not found' };
    }

    const version = this.data.get(key);
    if (!version) {
      return { visible: false, reason: 'Key does not exist' };
    }

    const visible = this.isVersionVisible(tx, version);
    let reason: string;

    if (visible) {
      reason = `Version visible: xmin=${version.xmin}, xmax=${version.xmax}, isolation=${tx.isolationLevel}`;
    } else {
      const xminTx = this.transactions.get(version.xmin);
      if (!xminTx) {
        reason = 'Creating transaction not found';
      } else if (xminTx.state !== 'COMMITTED') {
        reason = `Creating transaction ${version.xmin} is ${xminTx.state}`;
      } else if (tx.snapshot && version.xmin >= tx.snapshot.xmax) {
        reason = 'Version created after snapshot';
      } else if (tx.snapshot && tx.snapshot.activeTransactions.has(version.xmin)) {
        reason = 'Creating transaction was active at snapshot time';
      } else {
        reason = 'Version deleted or superseded';
      }
    }

    return { visible, reason, version };
  }

  // ==========================================================================
  // SNAPSHOT MANAGEMENT
  // ==========================================================================

  private createSnapshot(): Snapshot {
    const activeTransactions = new Set<number>();

    for (const [id, tx] of this.transactions) {
      if (tx.state === 'ACTIVE') {
        activeTransactions.add(id);
      }
    }

    let xmin = this.nextTxId;
    for (const id of activeTransactions) {
      if (id < xmin) xmin = id;
    }

    return {
      xmin,
      xmax: this.nextTxId,
      activeTransactions,
      timestamp: this.nextTimestamp++,
    };
  }

  getSnapshot(txId: number): Snapshot | null {
    const tx = this.transactions.get(txId);
    if (!tx) return null;

    if (!tx.snapshot) {
      tx.snapshot = this.createSnapshot();
    }

    return tx.snapshot;
  }

  // ==========================================================================
  // CONFLICT DETECTION
  // ==========================================================================

  private isCommitted(txId: number): boolean {
    const tx = this.transactions.get(txId);
    return tx?.state === 'COMMITTED';
  }

  private checkSerializableConflicts(tx: Transaction): ConflictInfo | null {
    // Check for write-skew anomalies
    // If another committed transaction wrote to something we read, we have a conflict

    for (const [key, readVersion] of tx.readSet) {
      const currentVersion = this.data.get(key);
      if (!currentVersion) continue;

      // Check if someone else modified this key after we read it
      if (currentVersion.timestamp > readVersion && currentVersion.xmin !== tx.txId.id) {
        const writerTx = this.transactions.get(currentVersion.xmin);
        if (
          writerTx &&
          writerTx.state === 'COMMITTED' &&
          writerTx.commitTimestamp! > tx.startTimestamp
        ) {
          const conflict: ConflictInfo = {
            type: 'READ_WRITE',
            txId1: tx.txId.id,
            txId2: currentVersion.xmin,
            key,
            resolution: 'Serialization failure - must abort',
          };
          this.conflictLog.push(conflict);
          this.stats.conflicts++;
          return conflict;
        }
      }
    }

    return null;
  }

  analyzeConflicts(): { conflicts: ConflictInfo[]; summary: Record<string, number> } {
    const summary: Record<string, number> = {
      WRITE_WRITE: 0,
      READ_WRITE: 0,
      WRITE_READ: 0,
      DEADLOCK: 0,
    };

    for (const conflict of this.conflictLog) {
      summary[conflict.type]++;
    }

    return { conflicts: this.conflictLog.slice(-20), summary };
  }

  // ==========================================================================
  // DEADLOCK DETECTION
  // ==========================================================================

  private addToWaitForGraph(waitingTx: number, holdingTx: number): void {
    if (!this.waitForGraph.has(waitingTx)) {
      this.waitForGraph.set(waitingTx, new Set());
    }
    this.waitForGraph.get(waitingTx)!.add(holdingTx);
  }

  private removeFromWaitForGraph(txId: number): void {
    this.waitForGraph.delete(txId);
    for (const [, waiting] of this.waitForGraph) {
      waiting.delete(txId);
    }
  }

  private detectDeadlock(startTx: number): boolean {
    const visited = new Set<number>();
    const stack = new Set<number>();

    const dfs = (tx: number): boolean => {
      if (stack.has(tx)) return true; // Cycle found
      if (visited.has(tx)) return false;

      visited.add(tx);
      stack.add(tx);

      const waitingFor = this.waitForGraph.get(tx);
      if (waitingFor) {
        for (const waitTx of waitingFor) {
          if (dfs(waitTx)) return true;
        }
      }

      stack.delete(tx);
      return false;
    };

    return dfs(startTx);
  }

  // ==========================================================================
  // GARBAGE COLLECTION (VACUUM)
  // ==========================================================================

  vacuum(): VacuumResult {
    const startTime = Date.now();
    let versionsRemoved = 0;
    let keysProcessed = 0;
    let spaceReclaimed = 0;

    // Find oldest active transaction
    let oldestActiveTx = this.nextTxId;
    for (const [id, tx] of this.transactions) {
      if (tx.state === 'ACTIVE' && id < oldestActiveTx) {
        oldestActiveTx = id;
      }
    }

    // Process each key
    for (const [_key, version] of this.data) {
      keysProcessed++;

      // Remove dead versions that are no longer visible to any transaction
      let current: VersionedValue | undefined = version;
      let prev: VersionedValue | null = null;

      while (current) {
        const canRemove = this.canRemoveVersion(current, oldestActiveTx);

        if (canRemove && prev) {
          // Remove this version from the chain
          prev.prevVersion = current.prevVersion;
          versionsRemoved++;
          spaceReclaimed += this.estimateVersionSize(current);
          this.stats.deadVersions++;
        } else {
          prev = current;
        }

        current = current.prevVersion;
      }
    }

    // Clean up old undo log entries
    if (this.versionStorage === 'IN_PLACE_WITH_UNDO') {
      const undoCountBefore = this.undoLog.length;
      this.undoLog = this.undoLog.filter((entry) => {
        const tx = this.transactions.get(entry.txId);
        return tx && tx.state === 'ACTIVE';
      });
      versionsRemoved += undoCountBefore - this.undoLog.length;
    }

    // Clean up old transaction records (but keep for history)
    for (const [id, tx] of this.transactions) {
      if ((tx.state === 'COMMITTED' || tx.state === 'ABORTED') && id < oldestActiveTx) {
        // Could remove, but keeping for demo purposes
      }
    }

    const duration = Date.now() - startTime;

    return {
      versionsRemoved,
      keysProcessed,
      oldestActiveTx,
      spaceReclaimed,
      duration,
    };
  }

  private canRemoveVersion(version: VersionedValue, oldestActiveTx: number): boolean {
    // Cannot remove if no newer version exists
    if (version.xmax === 0) return false;

    // Cannot remove if any active transaction might need it
    const deleteTx = this.transactions.get(version.xmax);
    if (!deleteTx || deleteTx.state !== 'COMMITTED') {
      return false;
    }

    // Safe to remove if deleted before oldest active transaction started
    return deleteTx.commitTimestamp! < oldestActiveTx;
  }

  private estimateVersionSize(version: VersionedValue): number {
    const valueSize = JSON.stringify(version.value).length;
    return valueSize + 64; // Overhead
  }

  // ==========================================================================
  // VERSION CHAIN MANAGEMENT
  // ==========================================================================

  getVersionChain(key: string): VersionChain | null {
    const current = this.data.get(key);
    if (!current) return null;

    const versions: VersionedValue[] = [];
    let version: VersionedValue | undefined = current;

    while (version) {
      versions.push(version);
      version = version.prevVersion;
    }

    return {
      key,
      versions,
      currentVersion: current,
      oldestVisibleVersion: versions[versions.length - 1],
    };
  }

  // ==========================================================================
  // STATISTICS AND INFO
  // ==========================================================================

  getStats(): MVCCStats {
    return { ...this.stats };
  }

  getTransactionInfo(txId: number): Transaction | null {
    return this.transactions.get(txId) || null;
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter((tx) => tx.state === 'ACTIVE');
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  // ==========================================================================
  // RESET
  // ==========================================================================

  reset(): void {
    this.transactions.clear();
    this.data.clear();
    this.nextTxId = 1;
    this.nextTimestamp = 1;
    this.conflictLog = [];
    this.undoLog = [];
    this.waitForGraph.clear();
    this.stats = {
      totalTransactions: 0,
      activeTransactions: 0,
      committedTransactions: 0,
      abortedTransactions: 0,
      totalVersions: 0,
      deadVersions: 0,
      conflicts: 0,
      deadlocks: 0,
    };
  }
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

const mvccEngine = new MVCCEngine('APPEND_ONLY');

// Pre-populate with some data for demo
function initializeDemoData(): void {
  const tx = mvccEngine.beginTransaction('READ_COMMITTED');
  mvccEngine.write(tx.txId.id, 'account:1', { balance: 1000, owner: 'Alice' });
  mvccEngine.write(tx.txId.id, 'account:2', { balance: 2000, owner: 'Bob' });
  mvccEngine.write(tx.txId.id, 'account:3', { balance: 500, owner: 'Carol' });
  mvccEngine.commit(tx.txId.id);
}

initializeDemoData();

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mvccTool: UnifiedTool = {
  name: 'mvcc',
  description:
    'Multi-Version Concurrency Control with transaction management, version chains, and multiple isolation levels',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'begin_transaction',
          'commit',
          'rollback',
          'read',
          'write',
          'check_visibility',
          'get_snapshot',
          'vacuum',
          'analyze_conflicts',
          'get_version_chain',
          'get_stats',
          'demo',
          'info',
          'examples',
          'reset',
        ],
        description: 'Operation to perform',
      },
      txId: {
        type: 'number',
        description: 'Transaction ID',
      },
      isolationLevel: {
        type: 'string',
        enum: ['READ_UNCOMMITTED', 'READ_COMMITTED', 'REPEATABLE_READ', 'SERIALIZABLE'],
        description: 'Isolation level for new transaction',
      },
      key: {
        type: 'string',
        description: 'Key to read or write',
      },
      value: {
        type: 'string',
        description: 'Value to write',
      },
    },
    required: ['operation'],
  },
};

export async function executemvcc(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'begin_transaction': {
        const isolationLevel = (args.isolationLevel || 'READ_COMMITTED') as IsolationLevel;
        const tx = mvccEngine.beginTransaction(isolationLevel);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'begin_transaction',
              transaction: {
                txId: tx.txId.id,
                state: tx.state,
                isolationLevel: tx.isolationLevel,
                startTimestamp: tx.startTimestamp,
                hasSnapshot: !!tx.snapshot,
              },
              message: `Transaction ${tx.txId.id} started with ${isolationLevel} isolation`,
            },
            null,
            2
          ),
        };
      }

      case 'commit': {
        const txId = args.txId;
        if (!txId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId is required' }),
            isError: true,
          };
        }

        const result = mvccEngine.commit(txId);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'commit',
              txId,
              success: result.success,
              error: result.error,
              message: result.success
                ? `Transaction ${txId} committed successfully`
                : `Commit failed: ${result.error}`,
            },
            null,
            2
          ),
        };
      }

      case 'rollback': {
        const txId = args.txId;
        if (!txId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId is required' }),
            isError: true,
          };
        }

        const result = mvccEngine.rollback(txId);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'rollback',
              txId,
              success: result.success,
              error: result.error,
              message: result.success
                ? `Transaction ${txId} rolled back`
                : `Rollback failed: ${result.error}`,
            },
            null,
            2
          ),
        };
      }

      case 'read': {
        const txId = args.txId;
        const key = args.key;

        if (!txId || !key) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId and key are required' }),
            isError: true,
          };
        }

        try {
          const result = mvccEngine.read(txId, key);

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'read',
                txId,
                key,
                found: result.found,
                value: result.value,
                version: result.version,
                message: result.found
                  ? `Read value for '${key}'`
                  : `Key '${key}' not found or not visible`,
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: (e as Error).message }),
            isError: true,
          };
        }
      }

      case 'write': {
        const txId = args.txId;
        const key = args.key;
        const value = args.value;

        if (!txId || !key || value === undefined) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId, key, and value are required' }),
            isError: true,
          };
        }

        try {
          const result = mvccEngine.write(txId, key, value);

          if (result.success) {
            return {
              toolCallId: id,
              content: JSON.stringify(
                {
                  operation: 'write',
                  txId,
                  key,
                  success: true,
                  message: `Wrote value to '${key}'`,
                },
                null,
                2
              ),
            };
          } else {
            return {
              toolCallId: id,
              content: JSON.stringify(
                {
                  operation: 'write',
                  txId,
                  key,
                  success: false,
                  conflict: result.conflict,
                  message: `Write conflict: ${result.conflict?.resolution}`,
                },
                null,
                2
              ),
            };
          }
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: (e as Error).message }),
            isError: true,
          };
        }
      }

      case 'check_visibility': {
        const txId = args.txId;
        const key = args.key;

        if (!txId || !key) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId and key are required' }),
            isError: true,
          };
        }

        const result = mvccEngine.checkVisibility(txId, key);
        const tx = mvccEngine.getTransactionInfo(txId);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'check_visibility',
              txId,
              key,
              visible: result.visible,
              reason: result.reason,
              transaction: tx
                ? {
                    isolationLevel: tx.isolationLevel,
                    startTimestamp: tx.startTimestamp,
                    hasSnapshot: !!tx.snapshot,
                  }
                : null,
              version: result.version
                ? {
                    xmin: result.version.xmin,
                    xmax: result.version.xmax,
                    timestamp: result.version.timestamp,
                  }
                : null,
            },
            null,
            2
          ),
        };
      }

      case 'get_snapshot': {
        const txId = args.txId;

        if (!txId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'txId is required' }),
            isError: true,
          };
        }

        const snapshot = mvccEngine.getSnapshot(txId);

        if (!snapshot) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Transaction not found' }),
            isError: true,
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'get_snapshot',
              txId,
              snapshot: {
                xmin: snapshot.xmin,
                xmax: snapshot.xmax,
                activeTransactions: Array.from(snapshot.activeTransactions),
                timestamp: snapshot.timestamp,
              },
              explanation: {
                xmin: 'Oldest transaction ID that was active at snapshot time',
                xmax: 'Next transaction ID at snapshot time',
                activeTransactions:
                  'Transaction IDs that were active at snapshot time (their changes are invisible)',
                timestamp: 'Logical timestamp when snapshot was created',
              },
            },
            null,
            2
          ),
        };
      }

      case 'vacuum': {
        const result = mvccEngine.vacuum();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'vacuum',
              result: {
                versionsRemoved: result.versionsRemoved,
                keysProcessed: result.keysProcessed,
                oldestActiveTx: result.oldestActiveTx,
                spaceReclaimed: `${result.spaceReclaimed} bytes`,
                duration: `${result.duration}ms`,
              },
              message: `Vacuum complete: removed ${result.versionsRemoved} dead versions from ${result.keysProcessed} keys`,
            },
            null,
            2
          ),
        };
      }

      case 'analyze_conflicts': {
        const analysis = mvccEngine.analyzeConflicts();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze_conflicts',
              summary: analysis.summary,
              recentConflicts: analysis.conflicts.map((c) => ({
                type: c.type,
                txId1: c.txId1,
                txId2: c.txId2,
                key: c.key,
                resolution: c.resolution,
              })),
              explanation: {
                WRITE_WRITE: 'Two transactions tried to modify same row',
                READ_WRITE: 'Transaction read data that was later modified (serialization anomaly)',
                WRITE_READ: 'Transaction overwrote data that another transaction read',
                DEADLOCK: 'Circular wait between transactions',
              },
            },
            null,
            2
          ),
        };
      }

      case 'get_version_chain': {
        const key = args.key || 'account:1';
        const chain = mvccEngine.getVersionChain(key);

        if (!chain) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'get_version_chain',
                key,
                found: false,
                message: `No version chain found for key '${key}'`,
              },
              null,
              2
            ),
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'get_version_chain',
              key,
              found: true,
              versionCount: chain.versions.length,
              versions: chain.versions.map((v, i) => ({
                index: i,
                value: v.value,
                xmin: v.xmin,
                xmax: v.xmax,
                timestamp: v.timestamp,
                isCurrent: i === 0,
              })),
              explanation: 'Version chain shows all versions of a key, with newest first',
            },
            null,
            2
          ),
        };
      }

      case 'get_stats': {
        const stats = mvccEngine.getStats();
        const activeTxs = mvccEngine.getActiveTransactions();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'get_stats',
              statistics: stats,
              activeTransactions: activeTxs.map((tx) => ({
                txId: tx.txId.id,
                isolationLevel: tx.isolationLevel,
                startTimestamp: tx.startTimestamp,
                readSetSize: tx.readSet.size,
                writeSetSize: tx.writeSet.size,
              })),
            },
            null,
            2
          ),
        };
      }

      case 'demo': {
        // Reset and run a demo scenario
        mvccEngine.reset();
        initializeDemoData();

        const results: unknown[] = [];

        // Start two concurrent transactions
        const tx1 = mvccEngine.beginTransaction('REPEATABLE_READ');
        const tx2 = mvccEngine.beginTransaction('REPEATABLE_READ');

        results.push({
          step: 1,
          action: 'Started two transactions',
          tx1: { id: tx1.txId.id, isolation: tx1.isolationLevel },
          tx2: { id: tx2.txId.id, isolation: tx2.isolationLevel },
        });

        // TX1 reads account:1
        const read1 = mvccEngine.read(tx1.txId.id, 'account:1');
        results.push({
          step: 2,
          action: 'TX1 reads account:1',
          result: read1,
        });

        // TX2 reads account:1 (same value due to snapshot isolation)
        const read2 = mvccEngine.read(tx2.txId.id, 'account:1');
        results.push({
          step: 3,
          action: 'TX2 reads account:1',
          result: read2,
        });

        // TX1 writes to account:1
        const write1 = mvccEngine.write(tx1.txId.id, 'account:1', { balance: 900, owner: 'Alice' });
        results.push({
          step: 4,
          action: 'TX1 writes account:1 (balance: 900)',
          result: write1,
        });

        // TX2 tries to write to account:1 (conflict!)
        const write2 = mvccEngine.write(tx2.txId.id, 'account:1', {
          balance: 1100,
          owner: 'Alice',
        });
        results.push({
          step: 5,
          action: 'TX2 tries to write account:1 (conflict expected)',
          result: write2,
        });

        // TX1 commits
        const commit1 = mvccEngine.commit(tx1.txId.id);
        results.push({
          step: 6,
          action: 'TX1 commits',
          result: commit1,
        });

        // TX2 must abort due to conflict
        if (!write2.success) {
          const abort2 = mvccEngine.abort(tx2.txId.id);
          results.push({
            step: 7,
            action: 'TX2 aborts due to conflict',
            result: abort2,
          });
        }

        // Show final state
        const tx3 = mvccEngine.beginTransaction('READ_COMMITTED');
        const finalRead = mvccEngine.read(tx3.txId.id, 'account:1');
        mvccEngine.commit(tx3.txId.id);

        results.push({
          step: 8,
          action: 'Final state of account:1',
          value: finalRead.value,
        });

        // Show version chain
        const chain = mvccEngine.getVersionChain('account:1');

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'demo',
              description: 'Write-write conflict scenario with REPEATABLE_READ isolation',
              steps: results,
              versionChain: chain
                ? {
                    versionCount: chain.versions.length,
                    versions: chain.versions.map((v) => ({
                      value: v.value,
                      xmin: v.xmin,
                      xmax: v.xmax,
                    })),
                  }
                : null,
              stats: mvccEngine.getStats(),
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'MVCC (Multi-Version Concurrency Control)',
              description: 'Database concurrency control that maintains multiple versions of data',
              concepts: {
                transaction: 'Unit of work with ACID properties',
                version: 'Timestamped snapshot of a data item',
                snapshot: 'Consistent view of database at a point in time',
                xmin: 'Transaction ID that created a version',
                xmax: 'Transaction ID that deleted/updated a version (0 if current)',
              },
              isolationLevels: {
                READ_UNCOMMITTED: 'Can see uncommitted data (dirty reads possible)',
                READ_COMMITTED: 'Only sees committed data (no dirty reads)',
                REPEATABLE_READ: 'Uses snapshot - same query returns same results',
                SERIALIZABLE: 'Transactions appear to execute serially',
              },
              operations: [
                'begin_transaction - Start new transaction',
                'commit - Commit transaction',
                'rollback - Abort and undo transaction',
                'read - Read value with visibility rules',
                'write - Write new version',
                'check_visibility - Check if version is visible to transaction',
                'get_snapshot - Get transaction snapshot',
                'vacuum - Clean up old versions',
                'analyze_conflicts - View conflict history',
                'get_version_chain - View version history for a key',
                'get_stats - View MVCC statistics',
              ],
              conflictTypes: {
                WRITE_WRITE: 'Two active transactions modify same row',
                READ_WRITE: 'Serializable violation - read-then-write by another',
                DEADLOCK: 'Circular wait between transactions',
              },
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  name: 'Start a transaction',
                  call: {
                    operation: 'begin_transaction',
                    isolationLevel: 'REPEATABLE_READ',
                  },
                },
                {
                  name: 'Read a value',
                  call: {
                    operation: 'read',
                    txId: 1,
                    key: 'account:1',
                  },
                },
                {
                  name: 'Write a value',
                  call: {
                    operation: 'write',
                    txId: 1,
                    key: 'account:1',
                    value: { balance: 1500, owner: 'Alice' },
                  },
                },
                {
                  name: 'Commit transaction',
                  call: {
                    operation: 'commit',
                    txId: 1,
                  },
                },
                {
                  name: 'Check visibility',
                  call: {
                    operation: 'check_visibility',
                    txId: 2,
                    key: 'account:1',
                  },
                },
                {
                  name: 'Get version chain',
                  call: {
                    operation: 'get_version_chain',
                    key: 'account:1',
                  },
                },
                {
                  name: 'Run vacuum',
                  call: { operation: 'vacuum' },
                },
                {
                  name: 'Run demo scenario',
                  call: { operation: 'demo' },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      case 'reset': {
        mvccEngine.reset();
        initializeDemoData();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'reset',
              message: 'MVCC engine reset with initial demo data',
              initialData: [
                { key: 'account:1', value: { balance: 1000, owner: 'Alice' } },
                { key: 'account:2', value: { balance: 2000, owner: 'Bob' } },
                { key: 'account:3', value: { balance: 500, owner: 'Carol' } },
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismvccAvailable(): boolean {
  return true;
}
