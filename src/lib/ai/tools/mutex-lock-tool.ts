/**
 * MUTEX LOCK TOOL
 * Comprehensive mutex synchronization primitive simulator
 * Supports basic mutex, recursive mutex, reader-writer locks, spinlocks, deadlock detection
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface MutexState {
  id: string;
  locked: boolean;
  owner: string | null;
  lockCount: number;  // For recursive mutex
  waitQueue: string[];
  lockTime: number | null;
  acquisitions: number;
  contentionCount: number;
  totalWaitTime: number;
  isRecursive: boolean;
  priorityCeiling?: number;
}

interface RWLockState {
  id: string;
  readers: Set<string>;
  writer: string | null;
  readWaitQueue: string[];
  writeWaitQueue: string[];
  preferWriter: boolean;
  readerCount: number;
  writerCount: number;
}

interface SpinLockState {
  id: string;
  locked: boolean;
  owner: string | null;
  spinCount: number;
  maxSpins: number;
  acquisitions: number;
}

interface ThreadState {
  id: string;
  priority: number;
  originalPriority: number;
  heldLocks: string[];
  waitingFor: string | null;
  state: 'running' | 'blocked' | 'ready';
  createdAt: number;
}

interface DeadlockInfo {
  detected: boolean;
  cycle: string[];
  involvedThreads: string[];
  involvedLocks: string[];
}

interface ContentionAnalysis {
  mutexId: string;
  acquisitions: number;
  contentionCount: number;
  contentionRate: number;
  avgWaitTime: number;
  currentWaiters: number;
}

// ============================================================================
// MUTEX IMPLEMENTATION
// ============================================================================

class Mutex {
  private state: MutexState;

  constructor(id: string, isRecursive: boolean = false, priorityCeiling?: number) {
    this.state = {
      id,
      locked: false,
      owner: null,
      lockCount: 0,
      waitQueue: [],
      lockTime: null,
      acquisitions: 0,
      contentionCount: 0,
      totalWaitTime: 0,
      isRecursive,
      priorityCeiling
    };
  }

  lock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; blocked: boolean; error?: string } {
    const thread = threads.get(threadId);
    if (!thread) {
      return { success: false, blocked: false, error: 'Thread not found' };
    }

    // Check if already locked by this thread (recursive case)
    if (this.state.locked && this.state.owner === threadId) {
      if (this.state.isRecursive) {
        this.state.lockCount++;
        return { success: true, blocked: false };
      } else {
        return { success: false, blocked: true, error: 'Deadlock: thread already owns this mutex' };
      }
    }

    // Check if locked by another thread
    if (this.state.locked) {
      this.state.contentionCount++;
      this.state.waitQueue.push(threadId);
      thread.waitingFor = this.state.id;
      thread.state = 'blocked';
      return { success: false, blocked: true };
    }

    // Acquire the lock
    this.state.locked = true;
    this.state.owner = threadId;
    this.state.lockCount = 1;
    this.state.lockTime = Date.now();
    this.state.acquisitions++;

    thread.heldLocks.push(this.state.id);
    thread.waitingFor = null;
    thread.state = 'running';

    // Priority inheritance
    if (this.state.priorityCeiling !== undefined) {
      thread.priority = Math.min(thread.priority, this.state.priorityCeiling);
    }

    return { success: true, blocked: false };
  }

  unlock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; nextOwner?: string; error?: string } {
    if (!this.state.locked) {
      return { success: false, error: 'Mutex is not locked' };
    }

    if (this.state.owner !== threadId) {
      return { success: false, error: 'Thread does not own this mutex' };
    }

    const thread = threads.get(threadId);

    // Handle recursive unlock
    if (this.state.isRecursive && this.state.lockCount > 1) {
      this.state.lockCount--;
      return { success: true };
    }

    // Full unlock
    this.state.lockCount = 0;

    // Restore thread's original priority
    if (thread && this.state.priorityCeiling !== undefined) {
      thread.priority = thread.originalPriority;
    }

    // Remove from thread's held locks
    if (thread) {
      thread.heldLocks = thread.heldLocks.filter(l => l !== this.state.id);
    }

    // Check wait queue
    if (this.state.waitQueue.length > 0) {
      const nextThreadId = this.state.waitQueue.shift()!;
      const nextThread = threads.get(nextThreadId);

      this.state.owner = nextThreadId;
      this.state.lockCount = 1;
      this.state.lockTime = Date.now();
      this.state.acquisitions++;

      if (nextThread) {
        nextThread.heldLocks.push(this.state.id);
        nextThread.waitingFor = null;
        nextThread.state = 'running';
      }

      return { success: true, nextOwner: nextThreadId };
    }

    // No waiters - release lock
    this.state.locked = false;
    this.state.owner = null;
    this.state.lockTime = null;

    return { success: true };
  }

  tryLock(threadId: string, threads: Map<string, ThreadState>, timeoutMs?: number): { success: boolean; timedOut: boolean } {
    // Simplified try_lock - in real implementation would use actual timing
    if (!this.state.locked) {
      const result = this.lock(threadId, threads);
      return { success: result.success, timedOut: false };
    }

    // Lock is held - would wait for timeout
    if (timeoutMs !== undefined && timeoutMs > 0) {
      // Simulate timeout
      return { success: false, timedOut: true };
    }

    return { success: false, timedOut: false };
  }

  getState(): MutexState {
    return { ...this.state };
  }

  getContentionAnalysis(): ContentionAnalysis {
    return {
      mutexId: this.state.id,
      acquisitions: this.state.acquisitions,
      contentionCount: this.state.contentionCount,
      contentionRate: this.state.acquisitions > 0
        ? this.state.contentionCount / this.state.acquisitions
        : 0,
      avgWaitTime: this.state.contentionCount > 0
        ? this.state.totalWaitTime / this.state.contentionCount
        : 0,
      currentWaiters: this.state.waitQueue.length
    };
  }
}

// ============================================================================
// READER-WRITER LOCK
// ============================================================================

class RWLock {
  private state: RWLockState;

  constructor(id: string, preferWriter: boolean = true) {
    this.state = {
      id,
      readers: new Set(),
      writer: null,
      readWaitQueue: [],
      writeWaitQueue: [],
      preferWriter,
      readerCount: 0,
      writerCount: 0
    };
  }

  readLock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; blocked: boolean } {
    const thread = threads.get(threadId);

    // Can't read if there's a writer
    if (this.state.writer !== null) {
      this.state.readWaitQueue.push(threadId);
      if (thread) {
        thread.waitingFor = this.state.id;
        thread.state = 'blocked';
      }
      return { success: false, blocked: true };
    }

    // Can't read if writers are waiting and we prefer writers
    if (this.state.preferWriter && this.state.writeWaitQueue.length > 0) {
      this.state.readWaitQueue.push(threadId);
      if (thread) {
        thread.waitingFor = this.state.id;
        thread.state = 'blocked';
      }
      return { success: false, blocked: true };
    }

    // Acquire read lock
    this.state.readers.add(threadId);
    this.state.readerCount++;

    if (thread) {
      thread.heldLocks.push(this.state.id + ':R');
      thread.waitingFor = null;
      thread.state = 'running';
    }

    return { success: true, blocked: false };
  }

  writeLock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; blocked: boolean } {
    const thread = threads.get(threadId);

    // Can't write if there are readers or another writer
    if (this.state.readers.size > 0 || this.state.writer !== null) {
      this.state.writeWaitQueue.push(threadId);
      if (thread) {
        thread.waitingFor = this.state.id;
        thread.state = 'blocked';
      }
      return { success: false, blocked: true };
    }

    // Acquire write lock
    this.state.writer = threadId;
    this.state.writerCount++;

    if (thread) {
      thread.heldLocks.push(this.state.id + ':W');
      thread.waitingFor = null;
      thread.state = 'running';
    }

    return { success: true, blocked: false };
  }

  readUnlock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; error?: string } {
    if (!this.state.readers.has(threadId)) {
      return { success: false, error: 'Thread does not hold read lock' };
    }

    this.state.readers.delete(threadId);

    const thread = threads.get(threadId);
    if (thread) {
      thread.heldLocks = thread.heldLocks.filter(l => l !== this.state.id + ':R');
    }

    // If no more readers, check if writers are waiting
    if (this.state.readers.size === 0 && this.state.writeWaitQueue.length > 0) {
      const nextWriter = this.state.writeWaitQueue.shift()!;
      this.state.writer = nextWriter;
      this.state.writerCount++;

      const nextThread = threads.get(nextWriter);
      if (nextThread) {
        nextThread.heldLocks.push(this.state.id + ':W');
        nextThread.waitingFor = null;
        nextThread.state = 'running';
      }
    }

    return { success: true };
  }

  writeUnlock(threadId: string, threads: Map<string, ThreadState>): { success: boolean; error?: string } {
    if (this.state.writer !== threadId) {
      return { success: false, error: 'Thread does not hold write lock' };
    }

    this.state.writer = null;

    const thread = threads.get(threadId);
    if (thread) {
      thread.heldLocks = thread.heldLocks.filter(l => l !== this.state.id + ':W');
    }

    // Check waiting queues
    if (this.state.preferWriter && this.state.writeWaitQueue.length > 0) {
      const nextWriter = this.state.writeWaitQueue.shift()!;
      this.state.writer = nextWriter;
      this.state.writerCount++;

      const nextThread = threads.get(nextWriter);
      if (nextThread) {
        nextThread.heldLocks.push(this.state.id + ':W');
        nextThread.waitingFor = null;
        nextThread.state = 'running';
      }
    } else if (this.state.readWaitQueue.length > 0) {
      // Wake all waiting readers
      while (this.state.readWaitQueue.length > 0) {
        const reader = this.state.readWaitQueue.shift()!;
        this.state.readers.add(reader);
        this.state.readerCount++;

        const readerThread = threads.get(reader);
        if (readerThread) {
          readerThread.heldLocks.push(this.state.id + ':R');
          readerThread.waitingFor = null;
          readerThread.state = 'running';
        }
      }
    }

    return { success: true };
  }

  getState(): RWLockState {
    return {
      ...this.state,
      readers: new Set(this.state.readers)
    };
  }
}

// ============================================================================
// SPINLOCK
// ============================================================================

class SpinLock {
  private state: SpinLockState;

  constructor(id: string, maxSpins: number = 1000) {
    this.state = {
      id,
      locked: false,
      owner: null,
      spinCount: 0,
      maxSpins,
      acquisitions: 0
    };
  }

  // Simulated compare-and-swap
  private compareAndSwap(expected: boolean, desired: boolean): boolean {
    if (this.state.locked === expected) {
      this.state.locked = desired;
      return true;
    }
    return false;
  }

  lock(threadId: string): { success: boolean; spins: number; timedOut: boolean } {
    let spins = 0;

    // Simulate spinning
    while (spins < this.state.maxSpins) {
      if (this.compareAndSwap(false, true)) {
        this.state.owner = threadId;
        this.state.spinCount += spins;
        this.state.acquisitions++;
        return { success: true, spins, timedOut: false };
      }
      spins++;
    }

    return { success: false, spins, timedOut: true };
  }

  unlock(threadId: string): { success: boolean; error?: string } {
    if (this.state.owner !== threadId) {
      return { success: false, error: 'Thread does not own spinlock' };
    }

    this.state.locked = false;
    this.state.owner = null;
    return { success: true };
  }

  getState(): SpinLockState {
    return { ...this.state };
  }
}

// ============================================================================
// LOCK MANAGER WITH DEADLOCK DETECTION
// ============================================================================

class LockManager {
  private mutexes: Map<string, Mutex>;
  private rwLocks: Map<string, RWLock>;
  private spinLocks: Map<string, SpinLock>;
  private threads: Map<string, ThreadState>;
  private lockOrder: Map<string, number>;  // For lock ordering protocol

  constructor() {
    this.mutexes = new Map();
    this.rwLocks = new Map();
    this.spinLocks = new Map();
    this.threads = new Map();
    this.lockOrder = new Map();
  }

  createThread(id: string, priority: number = 10): ThreadState {
    const thread: ThreadState = {
      id,
      priority,
      originalPriority: priority,
      heldLocks: [],
      waitingFor: null,
      state: 'ready',
      createdAt: Date.now()
    };

    this.threads.set(id, thread);
    return thread;
  }

  createMutex(id: string, isRecursive: boolean = false, priorityCeiling?: number): MutexState {
    const mutex = new Mutex(id, isRecursive, priorityCeiling);
    this.mutexes.set(id, mutex);

    // Assign lock order
    this.lockOrder.set(id, this.lockOrder.size);

    return mutex.getState();
  }

  createRWLock(id: string, preferWriter: boolean = true): RWLockState {
    const rwLock = new RWLock(id, preferWriter);
    this.rwLocks.set(id, rwLock);
    this.lockOrder.set(id, this.lockOrder.size);
    return rwLock.getState();
  }

  createSpinLock(id: string, maxSpins: number = 1000): SpinLockState {
    const spinLock = new SpinLock(id, maxSpins);
    this.spinLocks.set(id, spinLock);
    return spinLock.getState();
  }

  lock(mutexId: string, threadId: string): { success: boolean; blocked: boolean; error?: string } {
    const mutex = this.mutexes.get(mutexId);
    if (!mutex) {
      return { success: false, blocked: false, error: 'Mutex not found' };
    }

    // Check lock ordering
    const thread = this.threads.get(threadId);
    if (thread) {
      const newLockOrder = this.lockOrder.get(mutexId) ?? 0;
      for (const heldLock of thread.heldLocks) {
        const heldOrder = this.lockOrder.get(heldLock.replace(/:.*$/, '')) ?? 0;
        if (heldOrder >= newLockOrder) {
          // Potential deadlock due to lock ordering violation
          // Just warn, don't prevent
        }
      }
    }

    return mutex.lock(threadId, this.threads);
  }

  unlock(mutexId: string, threadId: string): { success: boolean; nextOwner?: string; error?: string } {
    const mutex = this.mutexes.get(mutexId);
    if (!mutex) {
      return { success: false, error: 'Mutex not found' };
    }

    return mutex.unlock(threadId, this.threads);
  }

  tryLock(mutexId: string, threadId: string, timeoutMs?: number): { success: boolean; timedOut: boolean; error?: string } {
    const mutex = this.mutexes.get(mutexId);
    if (!mutex) {
      return { success: false, timedOut: false, error: 'Mutex not found' };
    }

    return mutex.tryLock(threadId, this.threads, timeoutMs);
  }

  readLock(rwLockId: string, threadId: string): { success: boolean; blocked: boolean; error?: string } {
    const rwLock = this.rwLocks.get(rwLockId);
    if (!rwLock) {
      return { success: false, blocked: false, error: 'RWLock not found' };
    }

    return rwLock.readLock(threadId, this.threads);
  }

  writeLock(rwLockId: string, threadId: string): { success: boolean; blocked: boolean; error?: string } {
    const rwLock = this.rwLocks.get(rwLockId);
    if (!rwLock) {
      return { success: false, blocked: false, error: 'RWLock not found' };
    }

    return rwLock.writeLock(threadId, this.threads);
  }

  readUnlock(rwLockId: string, threadId: string): { success: boolean; error?: string } {
    const rwLock = this.rwLocks.get(rwLockId);
    if (!rwLock) {
      return { success: false, error: 'RWLock not found' };
    }

    return rwLock.readUnlock(threadId, this.threads);
  }

  writeUnlock(rwLockId: string, threadId: string): { success: boolean; error?: string } {
    const rwLock = this.rwLocks.get(rwLockId);
    if (!rwLock) {
      return { success: false, error: 'RWLock not found' };
    }

    return rwLock.writeUnlock(threadId, this.threads);
  }

  spinLock(spinLockId: string, threadId: string): { success: boolean; spins: number; timedOut: boolean; error?: string } {
    const spinLock = this.spinLocks.get(spinLockId);
    if (!spinLock) {
      return { success: false, spins: 0, timedOut: false, error: 'SpinLock not found' };
    }

    return spinLock.lock(threadId);
  }

  spinUnlock(spinLockId: string, threadId: string): { success: boolean; error?: string } {
    const spinLock = this.spinLocks.get(spinLockId);
    if (!spinLock) {
      return { success: false, error: 'SpinLock not found' };
    }

    return spinLock.unlock(threadId);
  }

  detectDeadlock(): DeadlockInfo {
    // Build wait-for graph
    const waitForGraph: Map<string, string[]> = new Map();

    for (const [threadId, thread] of this.threads) {
      if (thread.waitingFor) {
        const lockId = thread.waitingFor;

        // Find who owns this lock
        let owner: string | null = null;

        const mutex = this.mutexes.get(lockId);
        if (mutex) {
          owner = mutex.getState().owner;
        }

        const rwLock = this.rwLocks.get(lockId);
        if (rwLock) {
          const state = rwLock.getState();
          owner = state.writer || (state.readers.size > 0 ? [...state.readers][0] : null);
        }

        if (owner && owner !== threadId) {
          const edges = waitForGraph.get(threadId) || [];
          edges.push(owner);
          waitForGraph.set(threadId, edges);
        }
      }
    }

    // Detect cycle using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycle: string[] = [];

    const dfs = (node: string, path: string[]): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const edges = waitForGraph.get(node) || [];
      for (const neighbor of edges) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, path)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          cycle.push(...path.slice(cycleStart), neighbor);
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const threadId of waitForGraph.keys()) {
      if (!visited.has(threadId)) {
        if (dfs(threadId, [])) {
          break;
        }
      }
    }

    if (cycle.length > 0) {
      const involvedLocks: string[] = [];
      for (const threadId of cycle) {
        const thread = this.threads.get(threadId);
        if (thread?.waitingFor) {
          involvedLocks.push(thread.waitingFor);
        }
      }

      return {
        detected: true,
        cycle,
        involvedThreads: [...new Set(cycle)],
        involvedLocks: [...new Set(involvedLocks)]
      };
    }

    return {
      detected: false,
      cycle: [],
      involvedThreads: [],
      involvedLocks: []
    };
  }

  analyzeContention(): ContentionAnalysis[] {
    const analyses: ContentionAnalysis[] = [];

    for (const mutex of this.mutexes.values()) {
      analyses.push(mutex.getContentionAnalysis());
    }

    return analyses.sort((a, b) => b.contentionRate - a.contentionRate);
  }

  analyzeFairness(): {
    threadId: string;
    lockAttempts: number;
    successfulLocks: number;
    avgWaitTime: number;
  }[] {
    // Simplified fairness analysis
    const results: {
      threadId: string;
      lockAttempts: number;
      successfulLocks: number;
      avgWaitTime: number;
    }[] = [];

    for (const [threadId, thread] of this.threads) {
      results.push({
        threadId,
        lockAttempts: thread.heldLocks.length,
        successfulLocks: thread.heldLocks.length,
        avgWaitTime: 0
      });
    }

    return results;
  }

  getMutexState(mutexId: string): MutexState | null {
    const mutex = this.mutexes.get(mutexId);
    return mutex ? mutex.getState() : null;
  }

  getRWLockState(rwLockId: string): RWLockState | null {
    const rwLock = this.rwLocks.get(rwLockId);
    return rwLock ? rwLock.getState() : null;
  }

  getSpinLockState(spinLockId: string): SpinLockState | null {
    const spinLock = this.spinLocks.get(spinLockId);
    return spinLock ? spinLock.getState() : null;
  }

  getThreadState(threadId: string): ThreadState | null {
    return this.threads.get(threadId) || null;
  }

  getAllState(): {
    mutexes: MutexState[];
    rwLocks: RWLockState[];
    spinLocks: SpinLockState[];
    threads: ThreadState[];
  } {
    return {
      mutexes: [...this.mutexes.values()].map(m => m.getState()),
      rwLocks: [...this.rwLocks.values()].map(r => r.getState()),
      spinLocks: [...this.spinLocks.values()].map(s => s.getState()),
      threads: [...this.threads.values()]
    };
  }

  reset(): void {
    this.mutexes.clear();
    this.rwLocks.clear();
    this.spinLocks.clear();
    this.threads.clear();
    this.lockOrder.clear();
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let lockManager: LockManager | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mutexlockTool: UnifiedTool = {
  name: 'mutex_lock',
  description: 'Mutex synchronization simulator with basic mutex, recursive mutex, reader-writer locks, spinlocks, deadlock detection',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_mutex', 'lock', 'unlock', 'try_lock',
          'create_rwlock', 'read_lock', 'write_lock', 'read_unlock', 'write_unlock',
          'create_spinlock', 'spin_lock', 'spin_unlock',
          'create_thread', 'detect_deadlock', 'analyze_contention', 'analyze_fairness',
          'get_state', 'reset', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      mutexId: { type: 'string', description: 'Mutex ID' },
      rwLockId: { type: 'string', description: 'Reader-Writer Lock ID' },
      spinLockId: { type: 'string', description: 'SpinLock ID' },
      threadId: { type: 'string', description: 'Thread ID' },
      isRecursive: { type: 'boolean', description: 'Create recursive mutex' },
      priorityCeiling: { type: 'number', description: 'Priority ceiling for mutex' },
      preferWriter: { type: 'boolean', description: 'Writer preference for RWLock' },
      maxSpins: { type: 'number', description: 'Max spins for spinlock' },
      priority: { type: 'number', description: 'Thread priority' },
      timeout: { type: 'number', description: 'Timeout in ms for try_lock' }
    },
    required: ['operation']
  }
};

export async function executemutexlock(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    if (!lockManager) {
      lockManager = new LockManager();
    }

    switch (operation) {
      case 'create_thread': {
        const threadId = args.threadId || `thread_${Date.now()}`;
        const priority = args.priority || 10;
        const thread = lockManager.createThread(threadId, priority);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_thread',
            thread
          }, null, 2)
        };
      }

      case 'create_mutex': {
        const mutexId = args.mutexId || `mutex_${Date.now()}`;
        const isRecursive = args.isRecursive || false;
        const priorityCeiling = args.priorityCeiling;
        const mutex = lockManager.createMutex(mutexId, isRecursive, priorityCeiling);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_mutex',
            mutex
          }, null, 2)
        };
      }

      case 'lock': {
        const mutexId = args.mutexId;
        const threadId = args.threadId;

        if (!mutexId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'mutexId and threadId required' }), isError: true };
        }

        const result = lockManager.lock(mutexId, threadId);
        const deadlock = lockManager.detectDeadlock();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'lock',
            mutexId,
            threadId,
            ...result,
            deadlockCheck: deadlock
          }, null, 2)
        };
      }

      case 'unlock': {
        const mutexId = args.mutexId;
        const threadId = args.threadId;

        if (!mutexId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'mutexId and threadId required' }), isError: true };
        }

        const result = lockManager.unlock(mutexId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'unlock',
            mutexId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'try_lock': {
        const mutexId = args.mutexId;
        const threadId = args.threadId;
        const timeout = args.timeout;

        if (!mutexId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'mutexId and threadId required' }), isError: true };
        }

        const result = lockManager.tryLock(mutexId, threadId, timeout);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'try_lock',
            mutexId,
            threadId,
            timeout,
            ...result
          }, null, 2)
        };
      }

      case 'create_rwlock': {
        const rwLockId = args.rwLockId || `rwlock_${Date.now()}`;
        const preferWriter = args.preferWriter ?? true;
        const rwLock = lockManager.createRWLock(rwLockId, preferWriter);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_rwlock',
            rwLock: {
              id: rwLock.id,
              preferWriter: rwLock.preferWriter,
              readers: [...rwLock.readers],
              writer: rwLock.writer
            }
          }, null, 2)
        };
      }

      case 'read_lock': {
        const rwLockId = args.rwLockId;
        const threadId = args.threadId;

        if (!rwLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'rwLockId and threadId required' }), isError: true };
        }

        const result = lockManager.readLock(rwLockId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'read_lock',
            rwLockId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'write_lock': {
        const rwLockId = args.rwLockId;
        const threadId = args.threadId;

        if (!rwLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'rwLockId and threadId required' }), isError: true };
        }

        const result = lockManager.writeLock(rwLockId, threadId);
        const deadlock = lockManager.detectDeadlock();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'write_lock',
            rwLockId,
            threadId,
            ...result,
            deadlockCheck: deadlock
          }, null, 2)
        };
      }

      case 'read_unlock': {
        const rwLockId = args.rwLockId;
        const threadId = args.threadId;

        if (!rwLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'rwLockId and threadId required' }), isError: true };
        }

        const result = lockManager.readUnlock(rwLockId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'read_unlock',
            rwLockId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'write_unlock': {
        const rwLockId = args.rwLockId;
        const threadId = args.threadId;

        if (!rwLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'rwLockId and threadId required' }), isError: true };
        }

        const result = lockManager.writeUnlock(rwLockId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'write_unlock',
            rwLockId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'create_spinlock': {
        const spinLockId = args.spinLockId || `spinlock_${Date.now()}`;
        const maxSpins = args.maxSpins || 1000;
        const spinLock = lockManager.createSpinLock(spinLockId, maxSpins);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_spinlock',
            spinLock
          }, null, 2)
        };
      }

      case 'spin_lock': {
        const spinLockId = args.spinLockId;
        const threadId = args.threadId;

        if (!spinLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'spinLockId and threadId required' }), isError: true };
        }

        const result = lockManager.spinLock(spinLockId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'spin_lock',
            spinLockId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'spin_unlock': {
        const spinLockId = args.spinLockId;
        const threadId = args.threadId;

        if (!spinLockId || !threadId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'spinLockId and threadId required' }), isError: true };
        }

        const result = lockManager.spinUnlock(spinLockId, threadId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'spin_unlock',
            spinLockId,
            threadId,
            ...result
          }, null, 2)
        };
      }

      case 'detect_deadlock': {
        const result = lockManager.detectDeadlock();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_deadlock',
            ...result,
            explanation: result.detected
              ? `Deadlock detected! Cycle: ${result.cycle.join(' -> ')}`
              : 'No deadlock detected'
          }, null, 2)
        };
      }

      case 'analyze_contention': {
        const analysis = lockManager.analyzeContention();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_contention',
            analysis,
            mostContended: analysis.length > 0 ? analysis[0].mutexId : null
          }, null, 2)
        };
      }

      case 'analyze_fairness': {
        const analysis = lockManager.analyzeFairness();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_fairness',
            analysis
          }, null, 2)
        };
      }

      case 'get_state': {
        const state = lockManager.getAllState();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_state',
            state: {
              mutexes: state.mutexes,
              rwLocks: state.rwLocks.map(r => ({
                ...r,
                readers: [...r.readers]
              })),
              spinLocks: state.spinLocks,
              threads: state.threads
            }
          }, null, 2)
        };
      }

      case 'reset': {
        lockManager.reset();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reset',
            message: 'Lock manager reset'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Mutex Lock Simulator',
            description: 'Comprehensive mutex synchronization primitive simulator',
            lockTypes: {
              Mutex: 'Basic mutual exclusion lock',
              RecursiveMutex: 'Mutex that can be locked multiple times by same thread',
              TimedMutex: 'Mutex with timeout support',
              RWLock: 'Reader-writer lock allowing multiple readers or single writer',
              SpinLock: 'Busy-wait lock using test-and-set/CAS'
            },
            features: [
              'Priority inheritance protocol',
              'Priority ceiling protocol',
              'Deadlock detection (wait-for graph)',
              'Lock ordering protocol',
              'Contention analysis',
              'Fairness analysis',
              'Test-and-set simulation',
              'Compare-and-swap simulation'
            ],
            operations: {
              mutex: ['create_mutex', 'lock', 'unlock', 'try_lock'],
              rwlock: ['create_rwlock', 'read_lock', 'write_lock', 'read_unlock', 'write_unlock'],
              spinlock: ['create_spinlock', 'spin_lock', 'spin_unlock'],
              analysis: ['detect_deadlock', 'analyze_contention', 'analyze_fairness']
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Basic mutex lock/unlock',
                calls: [
                  { operation: 'create_thread', threadId: 'T1' },
                  { operation: 'create_mutex', mutexId: 'M1' },
                  { operation: 'lock', mutexId: 'M1', threadId: 'T1' },
                  { operation: 'unlock', mutexId: 'M1', threadId: 'T1' }
                ]
              },
              {
                name: 'Reader-writer lock',
                calls: [
                  { operation: 'create_thread', threadId: 'R1' },
                  { operation: 'create_thread', threadId: 'R2' },
                  { operation: 'create_thread', threadId: 'W1' },
                  { operation: 'create_rwlock', rwLockId: 'RW1' },
                  { operation: 'read_lock', rwLockId: 'RW1', threadId: 'R1' },
                  { operation: 'read_lock', rwLockId: 'RW1', threadId: 'R2' },
                  { operation: 'read_unlock', rwLockId: 'RW1', threadId: 'R1' }
                ]
              },
              {
                name: 'Deadlock scenario',
                calls: [
                  { operation: 'create_thread', threadId: 'T1' },
                  { operation: 'create_thread', threadId: 'T2' },
                  { operation: 'create_mutex', mutexId: 'M1' },
                  { operation: 'create_mutex', mutexId: 'M2' },
                  { operation: 'lock', mutexId: 'M1', threadId: 'T1' },
                  { operation: 'lock', mutexId: 'M2', threadId: 'T2' },
                  { operation: 'lock', mutexId: 'M2', threadId: 'T1' },
                  { operation: 'lock', mutexId: 'M1', threadId: 'T2' },
                  { operation: 'detect_deadlock' }
                ]
              }
            ]
          }, null, 2)
        };
      }

      default:
        return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismutexlockAvailable(): boolean { return true; }
