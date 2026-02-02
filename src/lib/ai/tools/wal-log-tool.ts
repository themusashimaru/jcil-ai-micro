/**
 * WAL-LOG TOOL
 * Write-Ahead Logging implementation for database durability
 * Supports ARIES-style recovery, checkpointing, and log management
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type LogRecordType = 'begin' | 'commit' | 'abort' | 'update' | 'checkpoint' | 'clr' | 'end';
type TransactionState = 'active' | 'committed' | 'aborted' | 'prepared';
type CheckpointType = 'sharp' | 'fuzzy';
type RecoveryPhase = 'analysis' | 'redo' | 'undo' | 'complete';

interface LogRecord {
  lsn: number;
  prevLsn: number | null;  // Previous LSN for this transaction
  transactionId: string | null;
  type: LogRecordType;
  pageId?: string;
  offset?: number;
  length?: number;
  beforeImage?: string;
  afterImage?: string;
  undoNextLsn?: number;  // For CLR records
  timestamp: number;
}

interface TransactionEntry {
  transactionId: string;
  state: TransactionState;
  lastLsn: number;
  firstLsn: number;
  undoNextLsn: number | null;
}

interface DirtyPageEntry {
  pageId: string;
  recLsn: number;  // Recovery LSN - first LSN that dirtied the page
}

interface CheckpointRecord {
  lsn: number;
  type: CheckpointType;
  activeTransactions: TransactionEntry[];
  dirtyPages: DirtyPageEntry[];
  timestamp: number;
}

interface WALStats {
  totalRecords: number;
  totalSize: number;
  currentLsn: number;
  oldestActiveLsn: number | null;
  checkpointCount: number;
  lastCheckpointLsn: number | null;
  activeTransactions: number;
  committedTransactions: number;
  abortedTransactions: number;
  dirtyPages: number;
  logFileCount: number;
  archivedLogCount: number;
}

interface RecoveryResult {
  phase: RecoveryPhase;
  analysisResult?: {
    transactionTable: TransactionEntry[];
    dirtyPageTable: DirtyPageEntry[];
    redoStartLsn: number;
  };
  redoResult?: {
    recordsProcessed: number;
    pagesUpdated: number;
    startLsn: number;
    endLsn: number;
  };
  undoResult?: {
    transactionsUndone: number;
    clrsWritten: number;
    recordsProcessed: number;
  };
  duration: number;
}

// ============================================================================
// WAL IMPLEMENTATION
// ============================================================================

class WriteAheadLog {
  private log: LogRecord[] = [];
  private currentLsn: number = 1;
  private transactionTable: Map<string, TransactionEntry> = new Map();
  private dirtyPageTable: Map<string, DirtyPageEntry> = new Map();
  private checkpoints: CheckpointRecord[] = [];
  private logBuffer: LogRecord[] = [];
  private bufferSize: number = 100;
  private logFiles: Array<{ id: number; startLsn: number; endLsn: number; archived: boolean }> = [];
  private currentLogFileId: number = 0;
  private logFileMaxRecords: number = 1000;
  private committedCount: number = 0;
  private abortedCount: number = 0;
  private archivedLogs: Array<{ id: number; startLsn: number; endLsn: number }> = [];

  /**
   * Write a log record
   */
  writeLog(
    transactionId: string | null,
    type: LogRecordType,
    data?: {
      pageId?: string;
      offset?: number;
      length?: number;
      beforeImage?: string;
      afterImage?: string;
      undoNextLsn?: number;
    }
  ): { lsn: number; record: LogRecord } {
    const prevLsn = transactionId
      ? this.transactionTable.get(transactionId)?.lastLsn ?? null
      : null;

    const record: LogRecord = {
      lsn: this.currentLsn,
      prevLsn,
      transactionId,
      type,
      pageId: data?.pageId,
      offset: data?.offset,
      length: data?.length,
      beforeImage: data?.beforeImage,
      afterImage: data?.afterImage,
      undoNextLsn: data?.undoNextLsn,
      timestamp: Date.now()
    };

    // Add to log buffer
    this.logBuffer.push(record);

    // Flush if buffer full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    // Update transaction table
    if (transactionId) {
      if (type === 'begin') {
        this.transactionTable.set(transactionId, {
          transactionId,
          state: 'active',
          lastLsn: this.currentLsn,
          firstLsn: this.currentLsn,
          undoNextLsn: null
        });
      } else {
        const txn = this.transactionTable.get(transactionId);
        if (txn) {
          txn.lastLsn = this.currentLsn;
          if (type === 'commit') {
            txn.state = 'committed';
            this.committedCount++;
          } else if (type === 'abort') {
            txn.state = 'aborted';
            this.abortedCount++;
          }
        }
      }
    }

    // Update dirty page table for update records
    if (type === 'update' && data?.pageId) {
      if (!this.dirtyPageTable.has(data.pageId)) {
        this.dirtyPageTable.set(data.pageId, {
          pageId: data.pageId,
          recLsn: this.currentLsn
        });
      }
    }

    // Check if need new log file
    if (this.log.length > 0 && this.log.length % this.logFileMaxRecords === 0) {
      this.rotateLogFile();
    }

    const lsn = this.currentLsn;
    this.currentLsn++;

    return { lsn, record };
  }

  /**
   * Begin a transaction
   */
  beginTransaction(transactionId: string): { lsn: number; transactionId: string } {
    const { lsn } = this.writeLog(transactionId, 'begin');
    return { lsn, transactionId };
  }

  /**
   * Write an update record
   */
  logUpdate(
    transactionId: string,
    pageId: string,
    offset: number,
    beforeImage: string,
    afterImage: string
  ): { lsn: number } {
    const { lsn } = this.writeLog(transactionId, 'update', {
      pageId,
      offset,
      length: afterImage.length,
      beforeImage,
      afterImage
    });
    return { lsn };
  }

  /**
   * Commit a transaction (force log first)
   */
  commit(transactionId: string): { lsn: number; forced: boolean } {
    // Force log buffer to disk before commit
    this.flushBuffer();

    const { lsn } = this.writeLog(transactionId, 'commit');

    // Force commit record
    this.flushBuffer();

    // Write end record
    this.writeLog(transactionId, 'end');

    return { lsn, forced: true };
  }

  /**
   * Abort a transaction
   */
  abort(transactionId: string): { lsn: number; undoOperations: number } {
    const txn = this.transactionTable.get(transactionId);
    if (!txn) {
      return { lsn: -1, undoOperations: 0 };
    }

    // Write abort record
    const { lsn: abortLsn } = this.writeLog(transactionId, 'abort');

    // Undo all updates
    let undoOperations = 0;
    let currentLsn = txn.lastLsn;

    while (currentLsn) {
      const record = this.log.find(r => r.lsn === currentLsn);
      if (!record) break;

      if (record.type === 'update') {
        // Write CLR for the undo
        this.writeLog(transactionId, 'clr', {
          pageId: record.pageId,
          offset: record.offset,
          beforeImage: record.afterImage,  // Swap before/after for undo
          afterImage: record.beforeImage,
          undoNextLsn: record.prevLsn ?? undefined
        });
        undoOperations++;
      }

      currentLsn = record.prevLsn ?? 0;
      if (!currentLsn) break;
    }

    // Write end record
    this.writeLog(transactionId, 'end');

    return { lsn: abortLsn, undoOperations };
  }

  /**
   * Flush log buffer to "disk"
   */
  private flushBuffer(): void {
    this.log.push(...this.logBuffer);
    this.logBuffer = [];
  }

  /**
   * Rotate log file
   */
  private rotateLogFile(): void {
    const startIdx = this.currentLogFileId * this.logFileMaxRecords;
    const endIdx = Math.min(startIdx + this.logFileMaxRecords - 1, this.log.length - 1);

    if (startIdx < this.log.length) {
      this.logFiles.push({
        id: this.currentLogFileId,
        startLsn: this.log[startIdx]?.lsn || 0,
        endLsn: this.log[endIdx]?.lsn || 0,
        archived: false
      });
      this.currentLogFileId++;
    }
  }

  /**
   * Write a checkpoint
   */
  checkpoint(type: CheckpointType = 'fuzzy'): CheckpointRecord {
    // Flush buffer first
    this.flushBuffer();

    const activeTransactions: TransactionEntry[] = [];
    for (const txn of this.transactionTable.values()) {
      if (txn.state === 'active') {
        activeTransactions.push({ ...txn });
      }
    }

    const dirtyPages: DirtyPageEntry[] = Array.from(this.dirtyPageTable.values());

    const checkpoint: CheckpointRecord = {
      lsn: this.currentLsn,
      type,
      activeTransactions,
      dirtyPages,
      timestamp: Date.now()
    };

    // Write checkpoint begin
    this.writeLog(null, 'checkpoint', {});

    // For sharp checkpoint, wait for all active transactions
    if (type === 'sharp') {
      // In real implementation, would block new transactions
      // and wait for active ones to complete
    }

    this.checkpoints.push(checkpoint);

    return checkpoint;
  }

  /**
   * ARIES Recovery - Analysis Phase
   */
  private analysisPhase(startLsn?: number): {
    transactionTable: TransactionEntry[];
    dirtyPageTable: DirtyPageEntry[];
    redoStartLsn: number;
  } {
    // Start from last checkpoint or beginning
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    const scanStartLsn = startLsn ?? lastCheckpoint?.lsn ?? 1;

    // Initialize from checkpoint
    const txnTable = new Map<string, TransactionEntry>();
    const dirtyPageTab = new Map<string, DirtyPageEntry>();

    if (lastCheckpoint) {
      for (const txn of lastCheckpoint.activeTransactions) {
        txnTable.set(txn.transactionId, { ...txn });
      }
      for (const page of lastCheckpoint.dirtyPages) {
        dirtyPageTab.set(page.pageId, { ...page });
      }
    }

    // Scan forward from checkpoint
    for (const record of this.log) {
      if (record.lsn < scanStartLsn) continue;

      if (record.transactionId) {
        if (record.type === 'begin') {
          txnTable.set(record.transactionId, {
            transactionId: record.transactionId,
            state: 'active',
            firstLsn: record.lsn,
            lastLsn: record.lsn,
            undoNextLsn: null
          });
        } else if (record.type === 'commit' || record.type === 'abort') {
          const txn = txnTable.get(record.transactionId);
          if (txn) {
            txn.state = record.type === 'commit' ? 'committed' : 'aborted';
            txn.lastLsn = record.lsn;
          }
        } else if (record.type === 'end') {
          txnTable.delete(record.transactionId);
        } else {
          const txn = txnTable.get(record.transactionId);
          if (txn) {
            txn.lastLsn = record.lsn;
            if (record.type === 'clr' && record.undoNextLsn !== undefined) {
              txn.undoNextLsn = record.undoNextLsn;
            }
          }
        }
      }

      // Update dirty page table
      if (record.type === 'update' && record.pageId) {
        if (!dirtyPageTab.has(record.pageId)) {
          dirtyPageTab.set(record.pageId, {
            pageId: record.pageId,
            recLsn: record.lsn
          });
        }
      }
    }

    // Find redo start LSN (minimum recLsn in dirty page table)
    let redoStartLsn = this.currentLsn;
    for (const entry of dirtyPageTab.values()) {
      redoStartLsn = Math.min(redoStartLsn, entry.recLsn);
    }

    return {
      transactionTable: Array.from(txnTable.values()),
      dirtyPageTable: Array.from(dirtyPageTab.values()),
      redoStartLsn
    };
  }

  /**
   * ARIES Recovery - Redo Phase
   */
  private redoPhase(startLsn: number, dirtyPages: Map<string, DirtyPageEntry>): {
    recordsProcessed: number;
    pagesUpdated: number;
    startLsn: number;
    endLsn: number;
  } {
    let recordsProcessed = 0;
    let pagesUpdated = 0;
    let endLsn = startLsn;

    // Redo all logged updates starting from redoStartLsn
    for (const record of this.log) {
      if (record.lsn < startLsn) continue;

      endLsn = record.lsn;

      if (record.type === 'update' || record.type === 'clr') {
        recordsProcessed++;

        // Check if page is in dirty page table and LSN >= recLsn
        const dirtyPage = record.pageId ? dirtyPages.get(record.pageId) : null;
        if (dirtyPage && record.lsn >= dirtyPage.recLsn) {
          // Would apply the update to the page here
          pagesUpdated++;
        }
      }
    }

    return { recordsProcessed, pagesUpdated, startLsn, endLsn };
  }

  /**
   * ARIES Recovery - Undo Phase
   */
  private undoPhase(loserTransactions: TransactionEntry[]): {
    transactionsUndone: number;
    clrsWritten: number;
    recordsProcessed: number;
  } {
    let transactionsUndone = 0;
    let clrsWritten = 0;
    let recordsProcessed = 0;

    // Build list of LSNs to undo
    const toUndo: Array<{ txnId: string; lsn: number }> = [];
    for (const txn of loserTransactions) {
      if (txn.state === 'active') {
        toUndo.push({ txnId: txn.transactionId, lsn: txn.undoNextLsn ?? txn.lastLsn });
      }
    }

    // Process in reverse LSN order
    toUndo.sort((a, b) => b.lsn - a.lsn);

    const undoneTransactions = new Set<string>();

    while (toUndo.length > 0) {
      const { txnId, lsn } = toUndo.shift()!;
      const record = this.log.find(r => r.lsn === lsn);
      if (!record) continue;

      recordsProcessed++;

      if (record.type === 'update') {
        // Write CLR
        this.writeLog(txnId, 'clr', {
          pageId: record.pageId,
          offset: record.offset,
          beforeImage: record.afterImage,
          afterImage: record.beforeImage,
          undoNextLsn: record.prevLsn ?? undefined
        });
        clrsWritten++;

        // Add previous LSN to undo
        if (record.prevLsn) {
          toUndo.push({ txnId, lsn: record.prevLsn });
          toUndo.sort((a, b) => b.lsn - a.lsn);
        } else {
          // Transaction fully undone
          this.writeLog(txnId, 'end');
          undoneTransactions.add(txnId);
        }
      } else if (record.type === 'clr') {
        // Continue from undoNextLsn
        if (record.undoNextLsn) {
          toUndo.push({ txnId, lsn: record.undoNextLsn });
          toUndo.sort((a, b) => b.lsn - a.lsn);
        } else {
          this.writeLog(txnId, 'end');
          undoneTransactions.add(txnId);
        }
      } else if (record.type === 'begin') {
        // Transaction fully undone
        this.writeLog(txnId, 'end');
        undoneTransactions.add(txnId);
      }
    }

    transactionsUndone = undoneTransactions.size;
    return { transactionsUndone, clrsWritten, recordsProcessed };
  }

  /**
   * Full ARIES Recovery
   */
  recover(): RecoveryResult {
    const startTime = Date.now();

    // Flush any pending records
    this.flushBuffer();

    // Analysis Phase
    const analysisResult = this.analysisPhase();

    // Build dirty page map
    const dirtyPages = new Map<string, DirtyPageEntry>();
    for (const page of analysisResult.dirtyPageTable) {
      dirtyPages.set(page.pageId, page);
    }

    // Redo Phase
    const redoResult = this.redoPhase(analysisResult.redoStartLsn, dirtyPages);

    // Find loser transactions (active at crash)
    const loserTransactions = analysisResult.transactionTable.filter(
      t => t.state === 'active'
    );

    // Undo Phase
    const undoResult = this.undoPhase(loserTransactions);

    const duration = Date.now() - startTime;

    return {
      phase: 'complete',
      analysisResult,
      redoResult,
      undoResult,
      duration
    };
  }

  /**
   * Analyze log records
   */
  analyzeLog(options?: { startLsn?: number; endLsn?: number; transactionId?: string }): {
    records: LogRecord[];
    summary: {
      totalRecords: number;
      byType: Record<LogRecordType, number>;
      byTransaction: Record<string, number>;
      timeRange: { start: number; end: number };
    };
  } {
    let records = [...this.log, ...this.logBuffer];

    if (options?.startLsn) {
      records = records.filter(r => r.lsn >= options.startLsn!);
    }
    if (options?.endLsn) {
      records = records.filter(r => r.lsn <= options.endLsn!);
    }
    if (options?.transactionId) {
      records = records.filter(r => r.transactionId === options.transactionId);
    }

    const byType: Record<string, number> = {};
    const byTransaction: Record<string, number> = {};

    for (const record of records) {
      byType[record.type] = (byType[record.type] || 0) + 1;
      if (record.transactionId) {
        byTransaction[record.transactionId] = (byTransaction[record.transactionId] || 0) + 1;
      }
    }

    return {
      records: records.slice(0, 50), // Limit for display
      summary: {
        totalRecords: records.length,
        byType: byType as Record<LogRecordType, number>,
        byTransaction,
        timeRange: {
          start: records[0]?.timestamp || 0,
          end: records[records.length - 1]?.timestamp || 0
        }
      }
    };
  }

  /**
   * Replay a specific transaction
   */
  replayTransaction(transactionId: string): {
    success: boolean;
    operations: Array<{ lsn: number; type: LogRecordType; pageId?: string }>;
  } {
    const operations: Array<{ lsn: number; type: LogRecordType; pageId?: string }> = [];

    for (const record of this.log) {
      if (record.transactionId === transactionId) {
        operations.push({
          lsn: record.lsn,
          type: record.type,
          pageId: record.pageId
        });
      }
    }

    return { success: operations.length > 0, operations };
  }

  /**
   * Point-in-time recovery
   */
  pointInTimeRecovery(targetLsn: number): {
    success: boolean;
    recoveredToLsn: number;
    transactionsUndone: string[];
    recordsProcessed: number;
  } {
    const transactionsUndone: string[] = [];
    let recordsProcessed = 0;

    // Find transactions that committed after target LSN
    const toUndo = new Set<string>();
    for (const record of this.log) {
      if (record.lsn <= targetLsn) continue;
      if (record.type === 'commit' && record.transactionId) {
        // This transaction committed after target - need to undo
        toUndo.add(record.transactionId);
      }
    }

    // Undo those transactions
    for (const txnId of toUndo) {
      const result = this.abort(txnId);
      recordsProcessed += result.undoOperations;
      transactionsUndone.push(txnId);
    }

    return {
      success: true,
      recoveredToLsn: targetLsn,
      transactionsUndone,
      recordsProcessed
    };
  }

  /**
   * Truncate log up to a certain LSN
   */
  truncateLog(upToLsn: number): { success: boolean; recordsRemoved: number; newStartLsn: number } {
    // Can only truncate records before oldest active transaction
    let oldestActiveLsn = this.currentLsn;
    for (const txn of this.transactionTable.values()) {
      if (txn.state === 'active') {
        oldestActiveLsn = Math.min(oldestActiveLsn, txn.firstLsn);
      }
    }

    const safetruncateLsn = Math.min(upToLsn, oldestActiveLsn - 1);
    const originalCount = this.log.length;

    this.log = this.log.filter(r => r.lsn > safetruncateLsn);

    return {
      success: true,
      recordsRemoved: originalCount - this.log.length,
      newStartLsn: this.log[0]?.lsn || this.currentLsn
    };
  }

  /**
   * Archive old log files
   */
  archiveLogs(): { archivedCount: number; archivedFiles: number[] } {
    const archivedFiles: number[] = [];

    // Find oldest LSN we still need
    let oldestNeededLsn = this.currentLsn;
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    if (lastCheckpoint) {
      oldestNeededLsn = lastCheckpoint.lsn;
      for (const txn of lastCheckpoint.activeTransactions) {
        oldestNeededLsn = Math.min(oldestNeededLsn, txn.firstLsn);
      }
    }

    // Archive log files that are entirely before oldest needed LSN
    for (const logFile of this.logFiles) {
      if (!logFile.archived && logFile.endLsn < oldestNeededLsn) {
        logFile.archived = true;
        this.archivedLogs.push({
          id: logFile.id,
          startLsn: logFile.startLsn,
          endLsn: logFile.endLsn
        });
        archivedFiles.push(logFile.id);
      }
    }

    return { archivedCount: archivedFiles.length, archivedFiles };
  }

  /**
   * Get current LSN
   */
  getLsn(): number {
    return this.currentLsn;
  }

  /**
   * Get statistics
   */
  getStatistics(): WALStats {
    let oldestActiveLsn: number | null = null;
    let activeCount = 0;

    for (const txn of this.transactionTable.values()) {
      if (txn.state === 'active') {
        activeCount++;
        if (oldestActiveLsn === null || txn.firstLsn < oldestActiveLsn) {
          oldestActiveLsn = txn.firstLsn;
        }
      }
    }

    const totalRecords = this.log.length + this.logBuffer.length;
    const avgRecordSize = 100; // Approximate

    return {
      totalRecords,
      totalSize: totalRecords * avgRecordSize,
      currentLsn: this.currentLsn,
      oldestActiveLsn,
      checkpointCount: this.checkpoints.length,
      lastCheckpointLsn: this.checkpoints[this.checkpoints.length - 1]?.lsn ?? null,
      activeTransactions: activeCount,
      committedTransactions: this.committedCount,
      abortedTransactions: this.abortedCount,
      dirtyPages: this.dirtyPageTable.size,
      logFileCount: this.logFiles.length + 1, // +1 for current
      archivedLogCount: this.archivedLogs.length
    };
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.log = [];
    this.logBuffer = [];
    this.currentLsn = 1;
    this.transactionTable.clear();
    this.dirtyPageTable.clear();
    this.checkpoints = [];
    this.logFiles = [];
    this.currentLogFileId = 0;
    this.committedCount = 0;
    this.abortedCount = 0;
    this.archivedLogs = [];
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const wallogTool: UnifiedTool = {
  name: 'wal_log',
  description: 'Write-Ahead Logging with ARIES-style recovery, checkpointing, and log management',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'write_log', 'checkpoint', 'recover', 'analyze_log', 'redo', 'undo',
          'get_lsn', 'truncate_log', 'archive', 'replay_transaction',
          'begin', 'commit', 'abort', 'update',
          'get_statistics', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      transactionId: {
        type: 'string',
        description: 'Transaction identifier'
      },
      pageId: {
        type: 'string',
        description: 'Page identifier for update operations'
      },
      offset: {
        type: 'number',
        description: 'Byte offset within page'
      },
      beforeImage: {
        type: 'string',
        description: 'Data before modification'
      },
      afterImage: {
        type: 'string',
        description: 'Data after modification'
      },
      checkpointType: {
        type: 'string',
        enum: ['sharp', 'fuzzy'],
        description: 'Type of checkpoint'
      },
      targetLsn: {
        type: 'number',
        description: 'Target LSN for point-in-time recovery or truncation'
      },
      startLsn: {
        type: 'number',
        description: 'Start LSN for log analysis'
      },
      endLsn: {
        type: 'number',
        description: 'End LSN for log analysis'
      }
    },
    required: ['operation']
  }
};

// Global instance
let wal: WriteAheadLog | null = null;

function getWAL(): WriteAheadLog {
  if (!wal) {
    wal = new WriteAheadLog();
  }
  return wal;
}

export async function executewallog(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const walLog = getWAL();

    switch (operation) {
      case 'begin': {
        const transactionId = args.transactionId || `T${Date.now()}`;
        const result = walLog.beginTransaction(transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'begin',
            ...result,
            explanation: 'Transaction started. BEGIN record written to log.'
          }, null, 2)
        };
      }

      case 'update': {
        const transactionId = args.transactionId || 'T1';
        const pageId = args.pageId || 'page_001';
        const offset = args.offset || 0;
        const beforeImage = args.beforeImage || 'old_data';
        const afterImage = args.afterImage || 'new_data';

        const result = walLog.logUpdate(transactionId, pageId, offset, beforeImage, afterImage);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'update',
            transactionId,
            pageId,
            offset,
            beforeImage,
            afterImage,
            ...result,
            explanation: 'UPDATE record written to log with before and after images for undo/redo.'
          }, null, 2)
        };
      }

      case 'commit': {
        const transactionId = args.transactionId || 'T1';
        const result = walLog.commit(transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'commit',
            transactionId,
            ...result,
            explanation: 'COMMIT record written and log forced to disk (force-log-at-commit).'
          }, null, 2)
        };
      }

      case 'abort': {
        const transactionId = args.transactionId || 'T1';
        const result = walLog.abort(transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'abort',
            transactionId,
            ...result,
            explanation: `Transaction aborted. ${result.undoOperations} update(s) undone using CLR records.`
          }, null, 2)
        };
      }

      case 'write_log': {
        const transactionId = args.transactionId;
        const type = args.type || 'update';
        const result = walLog.writeLog(transactionId, type as LogRecordType, {
          pageId: args.pageId,
          offset: args.offset,
          beforeImage: args.beforeImage,
          afterImage: args.afterImage
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'write_log',
            ...result
          }, null, 2)
        };
      }

      case 'checkpoint': {
        const type: CheckpointType = args.checkpointType || 'fuzzy';
        const result = walLog.checkpoint(type);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'checkpoint',
            type,
            checkpointLsn: result.lsn,
            activeTransactions: result.activeTransactions.length,
            dirtyPages: result.dirtyPages.length,
            timestamp: new Date(result.timestamp).toISOString(),
            explanation: type === 'fuzzy'
              ? 'Fuzzy checkpoint: Recorded active transactions and dirty pages. System continues operating.'
              : 'Sharp checkpoint: All transactions quiesced before checkpoint. Simpler recovery but blocks operations.'
          }, null, 2)
        };
      }

      case 'recover': {
        const result = walLog.recover();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'recover',
            ...result,
            explanation: {
              analysis: 'Scanned log from last checkpoint to identify active transactions and dirty pages',
              redo: `Reapplied ${result.redoResult?.recordsProcessed || 0} logged updates to bring database to crash state`,
              undo: `Rolled back ${result.undoResult?.transactionsUndone || 0} incomplete transaction(s) using CLRs`
            }
          }, null, 2)
        };
      }

      case 'analyze_log': {
        const result = walLog.analyzeLog({
          startLsn: args.startLsn,
          endLsn: args.endLsn,
          transactionId: args.transactionId
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_log',
            ...result
          }, null, 2)
        };
      }

      case 'redo': {
        // Trigger just the redo phase
        const stats = walLog.getStatistics();
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'redo',
            message: 'Redo phase repeats history to restore database state',
            currentLsn: stats.currentLsn,
            explanation: 'REDO scans forward from checkpoint, reapplying all logged updates to pages that may not have been flushed to disk before crash.'
          }, null, 2)
        };
      }

      case 'undo': {
        // Trigger just info about undo
        const stats = walLog.getStatistics();
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'undo',
            message: 'Undo phase rolls back incomplete transactions',
            activeTransactions: stats.activeTransactions,
            explanation: 'UNDO processes loser transactions in reverse, writing Compensation Log Records (CLRs) for each undone update.'
          }, null, 2)
        };
      }

      case 'get_lsn': {
        const lsn = walLog.getLsn();
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_lsn',
            currentLsn: lsn,
            explanation: 'LSN (Log Sequence Number) is a monotonically increasing identifier for log records.'
          }, null, 2)
        };
      }

      case 'truncate_log': {
        const targetLsn = args.targetLsn || walLog.getLsn() - 100;
        const result = walLog.truncateLog(targetLsn);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'truncate_log',
            requestedLsn: targetLsn,
            ...result,
            explanation: 'Log truncation removes old records no longer needed for recovery. Cannot truncate past oldest active transaction.'
          }, null, 2)
        };
      }

      case 'archive': {
        const result = walLog.archiveLogs();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'archive',
            ...result,
            explanation: 'Archived log files can be stored offline for media recovery. Kept until no longer needed for any active transaction or checkpoint.'
          }, null, 2)
        };
      }

      case 'replay_transaction': {
        const transactionId = args.transactionId || 'T1';
        const result = walLog.replayTransaction(transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'replay_transaction',
            transactionId,
            ...result
          }, null, 2)
        };
      }

      case 'get_statistics': {
        const stats = walLog.getStatistics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_statistics',
            ...stats
          }, null, 2)
        };
      }

      case 'demo': {
        walLog.reset();

        const results: Record<string, unknown>[] = [];

        // 1. Start transactions
        const t1 = walLog.beginTransaction('T1');
        const t2 = walLog.beginTransaction('T2');
        results.push({
          step: 1,
          description: 'Start two transactions',
          T1: t1,
          T2: t2
        });

        // 2. Log some updates
        const u1 = walLog.logUpdate('T1', 'page_001', 0, 'AAA', 'BBB');
        const u2 = walLog.logUpdate('T1', 'page_002', 100, 'XXX', 'YYY');
        const u3 = walLog.logUpdate('T2', 'page_001', 50, 'MMM', 'NNN');
        results.push({
          step: 2,
          description: 'Log updates',
          T1_updates: [u1, u2],
          T2_updates: [u3]
        });

        // 3. Checkpoint
        const checkpoint = walLog.checkpoint('fuzzy');
        results.push({
          step: 3,
          description: 'Take fuzzy checkpoint',
          checkpoint: {
            lsn: checkpoint.lsn,
            activeTransactions: checkpoint.activeTransactions.map(t => t.transactionId),
            dirtyPages: checkpoint.dirtyPages.map(p => p.pageId)
          }
        });

        // 4. More updates
        const u4 = walLog.logUpdate('T1', 'page_003', 0, 'OLD', 'NEW');
        results.push({
          step: 4,
          description: 'More updates after checkpoint',
          update: u4
        });

        // 5. Commit T1
        const commit = walLog.commit('T1');
        results.push({
          step: 5,
          description: 'Commit T1 (force log)',
          commit
        });

        // 6. Simulate crash and recover (T2 is a loser)
        results.push({
          step: 6,
          description: 'Simulate crash - T2 is uncommitted (loser transaction)'
        });

        const recovery = walLog.recover();
        results.push({
          step: 7,
          description: 'ARIES Recovery',
          recovery
        });

        // 8. Final state
        const analysis = walLog.analyzeLog({});
        results.push({
          step: 8,
          description: 'Log analysis after recovery',
          logSummary: analysis.summary
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Complete WAL demo with ARIES recovery',
            scenarios: results,
            finalStats: walLog.getStatistics(),
            ariesPhases: {
              analysis: 'Scan log from checkpoint, build transaction table and dirty page table',
              redo: 'Repeat history - reapply all logged updates',
              undo: 'Rollback loser transactions using CLRs'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Write-Ahead Log (WAL)',
            description: 'ARIES-style write-ahead logging for database durability and recovery',
            principles: {
              WAL: 'Write log record BEFORE modifying data page',
              forceLogAtCommit: 'Force log to disk before acknowledging commit',
              stealNoForce: 'Can flush dirty pages anytime (steal), dont force at commit (no-force)'
            },
            logRecordTypes: {
              begin: 'Transaction start',
              update: 'Data modification with before/after images',
              commit: 'Transaction successful completion',
              abort: 'Transaction rollback',
              checkpoint: 'Recovery point',
              clr: 'Compensation Log Record - records undo operation',
              end: 'Transaction processing complete'
            },
            recoveryPhases: {
              analysis: 'Scan from checkpoint, identify active txns and dirty pages',
              redo: 'Repeat history forward, reapply all logged changes',
              undo: 'Rollback incomplete transactions backward using CLRs'
            },
            checkpointTypes: {
              sharp: 'Block all transactions, flush all dirty pages, simple recovery',
              fuzzy: 'Record state while system runs, more complex but no blocking'
            },
            operations: [
              'begin - Start transaction',
              'update - Log data modification',
              'commit - Commit transaction',
              'abort - Rollback transaction',
              'checkpoint - Create recovery point',
              'recover - ARIES recovery',
              'analyze_log - View log records',
              'truncate_log - Remove old records',
              'archive - Archive old log files'
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
                name: 'Begin transaction',
                call: { operation: 'begin', transactionId: 'T1' }
              },
              {
                name: 'Log update',
                call: {
                  operation: 'update',
                  transactionId: 'T1',
                  pageId: 'page_001',
                  offset: 100,
                  beforeImage: 'old_value',
                  afterImage: 'new_value'
                }
              },
              {
                name: 'Commit transaction',
                call: { operation: 'commit', transactionId: 'T1' }
              },
              {
                name: 'Abort transaction',
                call: { operation: 'abort', transactionId: 'T2' }
              },
              {
                name: 'Take fuzzy checkpoint',
                call: { operation: 'checkpoint', checkpointType: 'fuzzy' }
              },
              {
                name: 'Perform ARIES recovery',
                call: { operation: 'recover' }
              },
              {
                name: 'Analyze log',
                call: { operation: 'analyze_log', transactionId: 'T1' }
              },
              {
                name: 'Get current LSN',
                call: { operation: 'get_lsn' }
              },
              {
                name: 'Run demo',
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

export function iswallogAvailable(): boolean { return true; }
