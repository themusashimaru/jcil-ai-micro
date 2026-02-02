/**
 * SEMAPHORE TOOL
 * Comprehensive semaphore synchronization primitive simulator
 * Supports counting/binary semaphores, classic problems, barriers
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface SemaphoreState {
  id: string;
  value: number;
  maxValue: number;
  waitQueue: string[];
  isBinary: boolean;
  waitCount: number;
  signalCount: number;
  timeoutCount: number;
}

interface ProcessInfo {
  id: string;
  state: 'running' | 'waiting' | 'blocked' | 'ready';
  waitingSince: number | null;
  waitingFor: string | null;
  priority: number;
}

interface ProducerConsumerState {
  bufferSize: number;
  buffer: string[];
  produced: number;
  consumed: number;
  empty: SemaphoreState;
  full: SemaphoreState;
  mutex: SemaphoreState;
}

interface DiningPhilosophersState {
  numPhilosophers: number;
  chopsticks: SemaphoreState[];
  philosopherStates: ('thinking' | 'hungry' | 'eating')[];
  eatCount: number[];
  deadlockDetected: boolean;
}

interface ReadersWritersState {
  readers: number;
  writers: number;
  readersWaiting: number;
  writersWaiting: number;
  mutex: SemaphoreState;
  writeMutex: SemaphoreState;
  readTry: SemaphoreState;
}

interface BarrierState {
  id: string;
  count: number;
  threshold: number;
  waiting: string[];
  generation: number;
}

// ============================================================================
// SEMAPHORE IMPLEMENTATION
// ============================================================================

class Semaphore {
  private state: SemaphoreState;
  private processes: Map<string, ProcessInfo>;

  constructor(id: string, initialValue: number, isBinary: boolean = false) {
    this.state = {
      id,
      value: isBinary ? Math.min(initialValue, 1) : initialValue,
      maxValue: isBinary ? 1 : Infinity,
      waitQueue: [],
      isBinary,
      waitCount: 0,
      signalCount: 0,
      timeoutCount: 0
    };
    this.processes = new Map();
  }

  createProcess(id: string, priority: number = 0): ProcessInfo {
    const process: ProcessInfo = {
      id,
      state: 'ready',
      waitingSince: null,
      waitingFor: null,
      priority
    };
    this.processes.set(id, process);
    return process;
  }

  // P operation (wait/down)
  wait(processId: string, usePriority: boolean = false): { success: boolean; blocked: boolean; value: number } {
    let process = this.processes.get(processId);
    if (!process) {
      process = this.createProcess(processId);
    }

    this.state.waitCount++;

    if (this.state.value > 0) {
      this.state.value--;
      process.state = 'running';
      process.waitingSince = null;
      process.waitingFor = null;
      return { success: true, blocked: false, value: this.state.value };
    }

    // Must block
    process.state = 'waiting';
    process.waitingSince = Date.now();
    process.waitingFor = this.state.id;

    if (usePriority) {
      // Insert by priority (lower number = higher priority)
      const insertIndex = this.state.waitQueue.findIndex(pid => {
        const p = this.processes.get(pid);
        return p && p.priority > process!.priority;
      });

      if (insertIndex === -1) {
        this.state.waitQueue.push(processId);
      } else {
        this.state.waitQueue.splice(insertIndex, 0, processId);
      }
    } else {
      this.state.waitQueue.push(processId);
    }

    return { success: false, blocked: true, value: this.state.value };
  }

  // V operation (signal/up)
  signal(_processId: string): { success: boolean; wokenProcess?: string; value: number } {
    this.state.signalCount++;

    if (this.state.waitQueue.length > 0) {
      const wokenProcessId = this.state.waitQueue.shift()!;
      const wokenProcess = this.processes.get(wokenProcessId);

      if (wokenProcess) {
        wokenProcess.state = 'running';
        wokenProcess.waitingSince = null;
        wokenProcess.waitingFor = null;
      }

      return { success: true, wokenProcess: wokenProcessId, value: this.state.value };
    }

    // No waiters - increment value
    if (!this.state.isBinary || this.state.value < 1) {
      this.state.value++;
    }

    return { success: true, value: this.state.value };
  }

  // Non-blocking try_wait
  tryWait(processId: string): { success: boolean; value: number } {
    if (this.state.value > 0) {
      this.state.value--;
      const process = this.processes.get(processId);
      if (process) {
        process.state = 'running';
      }
      return { success: true, value: this.state.value };
    }
    return { success: false, value: this.state.value };
  }

  // Timed wait
  timedWait(processId: string, timeoutMs: number): { success: boolean; timedOut: boolean; value: number } {
    // Simplified - in real implementation would use actual timing
    const result = this.wait(processId);

    if (result.blocked) {
      // Simulate timeout
      if (timeoutMs > 0 && Math.random() < 0.3) {
        // Remove from wait queue
        this.state.waitQueue = this.state.waitQueue.filter(p => p !== processId);
        const process = this.processes.get(processId);
        if (process) {
          process.state = 'ready';
          process.waitingSince = null;
          process.waitingFor = null;
        }
        this.state.timeoutCount++;
        return { success: false, timedOut: true, value: this.state.value };
      }
    }

    return { ...result, timedOut: false };
  }

  getValue(): number {
    return this.state.value;
  }

  getState(): SemaphoreState {
    return { ...this.state };
  }

  getProcesses(): ProcessInfo[] {
    return [...this.processes.values()];
  }

  visualize(): string {
    let viz = `Semaphore: ${this.state.id}\n`;
    viz += '='.repeat(40) + '\n';
    viz += `Type: ${this.state.isBinary ? 'Binary' : 'Counting'}\n`;
    viz += `Value: ${this.state.value}`;
    if (!this.state.isBinary) {
      viz += ` (max: ${this.state.maxValue === Infinity ? 'unlimited' : this.state.maxValue})`;
    }
    viz += '\n';
    viz += `Wait Queue: [${this.state.waitQueue.join(', ')}]\n`;
    viz += `Stats: ${this.state.waitCount} waits, ${this.state.signalCount} signals\n`;

    return viz;
  }
}

// ============================================================================
// SEMAPHORE SET (System V style)
// ============================================================================

class SemaphoreSet {
  private semaphores: Map<string, Semaphore>;
  private setId: string;

  constructor(setId: string, count: number, initialValues: number[] = []) {
    this.setId = setId;
    this.semaphores = new Map();

    for (let i = 0; i < count; i++) {
      const semId = `${setId}_${i}`;
      const initialValue = initialValues[i] ?? 1;
      this.semaphores.set(semId, new Semaphore(semId, initialValue));
    }
  }

  // Atomic operation on multiple semaphores
  atomicOp(operations: Array<{ index: number; op: 'wait' | 'signal'; processId: string }>): {
    success: boolean;
    blocked: boolean;
    results: Array<{ index: number; success: boolean }>;
  } {
    const results: Array<{ index: number; success: boolean }> = [];
    let anyBlocked = false;

    // Check all waits first
    for (const op of operations) {
      if (op.op === 'wait') {
        const sem = this.semaphores.get(`${this.setId}_${op.index}`);
        if (sem && sem.getValue() <= 0) {
          anyBlocked = true;
        }
      }
    }

    if (anyBlocked) {
      return { success: false, blocked: true, results: [] };
    }

    // Execute all operations
    for (const op of operations) {
      const sem = this.semaphores.get(`${this.setId}_${op.index}`);
      if (sem) {
        let result;
        if (op.op === 'wait') {
          result = sem.wait(op.processId);
        } else {
          result = sem.signal(op.processId);
        }
        results.push({ index: op.index, success: result.success });
      }
    }

    return { success: true, blocked: false, results };
  }

  getStates(): SemaphoreState[] {
    return [...this.semaphores.values()].map(s => s.getState());
  }
}

// ============================================================================
// CLASSIC SYNCHRONIZATION PROBLEMS
// ============================================================================

class ProducerConsumerSolver {
  private state: ProducerConsumerState;

  constructor(bufferSize: number) {

    const empty = new Semaphore('empty', bufferSize);
    const full = new Semaphore('full', 0);
    const mutex = new Semaphore('mutex', 1, true);

    this.state = {
      bufferSize,
      buffer: [],
      produced: 0,
      consumed: 0,
      empty: empty.getState(),
      full: full.getState(),
      mutex: mutex.getState()
    };
  }

  produce(producerId: string, item: string): {
    success: boolean;
    blocked: boolean;
    bufferState: string[];
    message: string;
  } {
    // Try to acquire empty slot
    if (this.state.empty.value <= 0) {
      this.state.empty.waitQueue.push(producerId);
      return {
        success: false,
        blocked: true,
        bufferState: [...this.state.buffer],
        message: `Producer ${producerId} blocked - buffer full`
      };
    }

    // Acquire empty slot
    this.state.empty.value--;

    // Acquire mutex
    if (this.state.mutex.value <= 0) {
      return {
        success: false,
        blocked: true,
        bufferState: [...this.state.buffer],
        message: `Producer ${producerId} waiting for mutex`
      };
    }
    this.state.mutex.value = 0;

    // Produce item
    this.state.buffer.push(item);
    this.state.produced++;

    // Release mutex
    this.state.mutex.value = 1;

    // Signal full slot
    this.state.full.value++;

    // Wake waiting consumer if any
    if (this.state.full.waitQueue.length > 0) {
      this.state.full.waitQueue.shift();
    }

    return {
      success: true,
      blocked: false,
      bufferState: [...this.state.buffer],
      message: `Producer ${producerId} produced '${item}'`
    };
  }

  consume(consumerId: string): {
    success: boolean;
    blocked: boolean;
    item?: string;
    bufferState: string[];
    message: string;
  } {
    // Try to acquire full slot
    if (this.state.full.value <= 0) {
      this.state.full.waitQueue.push(consumerId);
      return {
        success: false,
        blocked: true,
        bufferState: [...this.state.buffer],
        message: `Consumer ${consumerId} blocked - buffer empty`
      };
    }

    // Acquire full slot
    this.state.full.value--;

    // Acquire mutex
    if (this.state.mutex.value <= 0) {
      return {
        success: false,
        blocked: true,
        bufferState: [...this.state.buffer],
        message: `Consumer ${consumerId} waiting for mutex`
      };
    }
    this.state.mutex.value = 0;

    // Consume item
    const item = this.state.buffer.shift();
    this.state.consumed++;

    // Release mutex
    this.state.mutex.value = 1;

    // Signal empty slot
    this.state.empty.value++;

    // Wake waiting producer if any
    if (this.state.empty.waitQueue.length > 0) {
      this.state.empty.waitQueue.shift();
    }

    return {
      success: true,
      blocked: false,
      item,
      bufferState: [...this.state.buffer],
      message: `Consumer ${consumerId} consumed '${item}'`
    };
  }

  getState(): ProducerConsumerState {
    return { ...this.state };
  }

  visualize(): string {
    let viz = 'Producer-Consumer State\n';
    viz += '='.repeat(50) + '\n';
    viz += `Buffer (${this.state.buffer.length}/${this.state.bufferSize}): [${this.state.buffer.join(', ')}]\n`;
    viz += `Empty slots: ${this.state.empty.value}, Full slots: ${this.state.full.value}\n`;
    viz += `Produced: ${this.state.produced}, Consumed: ${this.state.consumed}\n`;
    viz += `Waiting producers: ${this.state.empty.waitQueue.length}\n`;
    viz += `Waiting consumers: ${this.state.full.waitQueue.length}\n`;
    return viz;
  }
}

class DiningPhilosophersSolver {
  private state: DiningPhilosophersState;
  private chopstickSemaphores: Semaphore[];

  constructor(numPhilosophers: number = 5) {
    this.chopstickSemaphores = [];

    for (let i = 0; i < numPhilosophers; i++) {
      this.chopstickSemaphores.push(new Semaphore(`chopstick_${i}`, 1, true));
    }

    this.state = {
      numPhilosophers,
      chopsticks: this.chopstickSemaphores.map(c => c.getState()),
      philosopherStates: new Array(numPhilosophers).fill('thinking'),
      eatCount: new Array(numPhilosophers).fill(0),
      deadlockDetected: false
    };
  }

  think(philosopherId: number): { success: boolean; message: string } {
    if (philosopherId < 0 || philosopherId >= this.state.numPhilosophers) {
      return { success: false, message: 'Invalid philosopher ID' };
    }

    this.state.philosopherStates[philosopherId] = 'thinking';
    return { success: true, message: `Philosopher ${philosopherId} is thinking` };
  }

  pickUpChopsticks(philosopherId: number, useAsymmetric: boolean = true): {
    success: boolean;
    blocked: boolean;
    message: string;
    deadlockRisk: boolean;
  } {
    if (philosopherId < 0 || philosopherId >= this.state.numPhilosophers) {
      return { success: false, blocked: false, message: 'Invalid philosopher ID', deadlockRisk: false };
    }

    this.state.philosopherStates[philosopherId] = 'hungry';

    const left = philosopherId;
    const right = (philosopherId + 1) % this.state.numPhilosophers;

    // Asymmetric solution: even picks left first, odd picks right first
    let first, second;
    if (useAsymmetric && philosopherId % 2 === 1) {
      first = right;
      second = left;
    } else {
      first = left;
      second = right;
    }

    // Try to pick up first chopstick
    const firstResult = this.chopstickSemaphores[first].tryWait(`philosopher_${philosopherId}`);
    if (!firstResult.success) {
      return {
        success: false,
        blocked: true,
        message: `Philosopher ${philosopherId} waiting for chopstick ${first}`,
        deadlockRisk: false
      };
    }

    // Try to pick up second chopstick
    const secondResult = this.chopstickSemaphores[second].tryWait(`philosopher_${philosopherId}`);
    if (!secondResult.success) {
      // Release first chopstick to avoid deadlock
      this.chopstickSemaphores[first].signal(`philosopher_${philosopherId}`);
      return {
        success: false,
        blocked: true,
        message: `Philosopher ${philosopherId} waiting for chopstick ${second}, released ${first}`,
        deadlockRisk: true
      };
    }

    // Update state
    this.state.chopsticks[first] = this.chopstickSemaphores[first].getState();
    this.state.chopsticks[second] = this.chopstickSemaphores[second].getState();
    this.state.philosopherStates[philosopherId] = 'eating';
    this.state.eatCount[philosopherId]++;

    return {
      success: true,
      blocked: false,
      message: `Philosopher ${philosopherId} picked up chopsticks ${first} and ${second}, now eating`,
      deadlockRisk: false
    };
  }

  putDownChopsticks(philosopherId: number): { success: boolean; message: string } {
    if (philosopherId < 0 || philosopherId >= this.state.numPhilosophers) {
      return { success: false, message: 'Invalid philosopher ID' };
    }

    if (this.state.philosopherStates[philosopherId] !== 'eating') {
      return { success: false, message: `Philosopher ${philosopherId} is not eating` };
    }

    const left = philosopherId;
    const right = (philosopherId + 1) % this.state.numPhilosophers;

    this.chopstickSemaphores[left].signal(`philosopher_${philosopherId}`);
    this.chopstickSemaphores[right].signal(`philosopher_${philosopherId}`);

    this.state.chopsticks[left] = this.chopstickSemaphores[left].getState();
    this.state.chopsticks[right] = this.chopstickSemaphores[right].getState();
    this.state.philosopherStates[philosopherId] = 'thinking';

    return { success: true, message: `Philosopher ${philosopherId} put down chopsticks, now thinking` };
  }

  detectDeadlock(): { deadlock: boolean; reason?: string } {
    // Deadlock if all philosophers are hungry and all chopsticks are taken
    const allHungry = this.state.philosopherStates.every(s => s === 'hungry');
    const allChopsticksTaken = this.state.chopsticks.every(c => c.value === 0);

    if (allHungry && allChopsticksTaken) {
      this.state.deadlockDetected = true;
      return {
        deadlock: true,
        reason: 'All philosophers are hungry and holding one chopstick each'
      };
    }

    return { deadlock: false };
  }

  getState(): DiningPhilosophersState {
    return {
      ...this.state,
      chopsticks: this.chopstickSemaphores.map(c => c.getState())
    };
  }

  visualize(): string {
    let viz = 'Dining Philosophers\n';
    viz += '='.repeat(50) + '\n\n';

    // Draw table
    for (let i = 0; i < this.state.numPhilosophers; i++) {
      const state = this.state.philosopherStates[i];
      const stateIcon = state === 'eating' ? 'E' : state === 'hungry' ? 'H' : 'T';
      const leftChopstick = this.chopstickSemaphores[i].getValue() === 0 ? 'x' : '|';
      viz += `  P${i}[${stateIcon}] --${leftChopstick}-- `;
    }
    viz += '\n\n';

    viz += 'Legend: T=Thinking, H=Hungry, E=Eating, |=Available, x=Taken\n\n';

    viz += 'Eat counts: ';
    for (let i = 0; i < this.state.numPhilosophers; i++) {
      viz += `P${i}:${this.state.eatCount[i]} `;
    }
    viz += '\n';

    if (this.state.deadlockDetected) {
      viz += '\n*** DEADLOCK DETECTED ***\n';
    }

    return viz;
  }
}

class ReadersWritersSolver {
  private state: ReadersWritersState;

  constructor() {
    this.state = {
      readers: 0,
      writers: 0,
      readersWaiting: 0,
      writersWaiting: 0,
      mutex: new Semaphore('mutex', 1, true).getState(),
      writeMutex: new Semaphore('writeMutex', 1, true).getState(),
      readTry: new Semaphore('readTry', 1, true).getState()
    };
  }

  startRead(readerId: string): { success: boolean; blocked: boolean; message: string } {
    // Readers preference solution
    if (this.state.writeMutex.value === 0) {
      this.state.readersWaiting++;
      return {
        success: false,
        blocked: true,
        message: `Reader ${readerId} waiting - writer active`
      };
    }

    this.state.readers++;
    if (this.state.readers === 1) {
      // First reader blocks writers
      this.state.writeMutex.value = 0;
    }

    return {
      success: true,
      blocked: false,
      message: `Reader ${readerId} started reading (${this.state.readers} active readers)`
    };
  }

  endRead(readerId: string): { success: boolean; message: string } {
    if (this.state.readers <= 0) {
      return { success: false, message: 'No active readers' };
    }

    this.state.readers--;
    if (this.state.readers === 0) {
      // Last reader allows writers
      this.state.writeMutex.value = 1;

      // Wake a waiting writer
      if (this.state.writersWaiting > 0) {
        this.state.writersWaiting--;
      }
    }

    return {
      success: true,
      message: `Reader ${readerId} finished (${this.state.readers} active readers)`
    };
  }

  startWrite(writerId: string): { success: boolean; blocked: boolean; message: string } {
    if (this.state.writeMutex.value === 0 || this.state.readers > 0) {
      this.state.writersWaiting++;
      return {
        success: false,
        blocked: true,
        message: `Writer ${writerId} waiting - ${this.state.readers} readers active`
      };
    }

    this.state.writeMutex.value = 0;
    this.state.writers++;

    return {
      success: true,
      blocked: false,
      message: `Writer ${writerId} started writing`
    };
  }

  endWrite(writerId: string): { success: boolean; message: string } {
    if (this.state.writers <= 0) {
      return { success: false, message: 'No active writers' };
    }

    this.state.writers--;
    this.state.writeMutex.value = 1;

    // Wake waiting readers first (readers preference)
    if (this.state.readersWaiting > 0) {
      this.state.readersWaiting = 0;  // All readers can enter
    }

    return {
      success: true,
      message: `Writer ${writerId} finished`
    };
  }

  getState(): ReadersWritersState {
    return { ...this.state };
  }

  visualize(): string {
    let viz = 'Readers-Writers State\n';
    viz += '='.repeat(50) + '\n';
    viz += `Active Readers: ${this.state.readers}\n`;
    viz += `Active Writers: ${this.state.writers}\n`;
    viz += `Waiting Readers: ${this.state.readersWaiting}\n`;
    viz += `Waiting Writers: ${this.state.writersWaiting}\n`;
    viz += `Write mutex: ${this.state.writeMutex.value === 1 ? 'available' : 'held'}\n`;
    return viz;
  }
}

// ============================================================================
// BARRIER SYNCHRONIZATION
// ============================================================================

class Barrier {
  private state: BarrierState;

  constructor(id: string, threshold: number) {

    this.state = {
      id,
      count: 0,
      threshold,
      waiting: [],
      generation: 0
    };
  }

  arrive(processId: string): {
    success: boolean;
    released: boolean;
    waiting: number;
    message: string;
  } {
    // Acquire mutex
    this.state.count++;
    this.state.waiting.push(processId);

    if (this.state.count < this.state.threshold) {
      return {
        success: true,
        released: false,
        waiting: this.state.count,
        message: `Process ${processId} waiting at barrier (${this.state.count}/${this.state.threshold})`
      };
    }

    // Threshold reached - release all
    this.state.waiting = [];
    this.state.count = 0;
    this.state.generation++;

    return {
      success: true,
      released: true,
      waiting: 0,
      message: `Barrier released! All ${this.state.threshold} processes can proceed. Generation ${this.state.generation}`
    };
  }

  getState(): BarrierState {
    return { ...this.state };
  }

  visualize(): string {
    let viz = `Barrier: ${this.state.id}\n`;
    viz += '='.repeat(40) + '\n';
    viz += `Waiting: ${this.state.count}/${this.state.threshold}\n`;
    viz += `Processes: [${this.state.waiting.join(', ')}]\n`;
    viz += `Generation: ${this.state.generation}\n`;
    return viz;
  }
}

// ============================================================================
// SEMAPHORE MANAGER
// ============================================================================

class SemaphoreManager {
  private semaphores: Map<string, Semaphore>;
  private semaphoreSets: Map<string, SemaphoreSet>;
  private barriers: Map<string, Barrier>;
  private producerConsumer: ProducerConsumerSolver | null;
  private diningPhilosophers: DiningPhilosophersSolver | null;
  private readersWriters: ReadersWritersSolver | null;

  constructor() {
    this.semaphores = new Map();
    this.semaphoreSets = new Map();
    this.barriers = new Map();
    this.producerConsumer = null;
    this.diningPhilosophers = null;
    this.readersWriters = null;
  }

  createSemaphore(id: string, initialValue: number, isBinary: boolean = false): SemaphoreState {
    const sem = new Semaphore(id, initialValue, isBinary);
    this.semaphores.set(id, sem);
    return sem.getState();
  }

  wait(semId: string, processId: string): { success: boolean; blocked: boolean; value: number; error?: string } {
    const sem = this.semaphores.get(semId);
    if (!sem) {
      return { success: false, blocked: false, value: 0, error: 'Semaphore not found' };
    }
    return sem.wait(processId);
  }

  signal(semId: string, processId: string): { success: boolean; wokenProcess?: string; value: number; error?: string } {
    const sem = this.semaphores.get(semId);
    if (!sem) {
      return { success: false, value: 0, error: 'Semaphore not found' };
    }
    return sem.signal(processId);
  }

  tryWait(semId: string, processId: string): { success: boolean; value: number; error?: string } {
    const sem = this.semaphores.get(semId);
    if (!sem) {
      return { success: false, value: 0, error: 'Semaphore not found' };
    }
    return sem.tryWait(processId);
  }

  getValue(semId: string): { value: number; error?: string } {
    const sem = this.semaphores.get(semId);
    if (!sem) {
      return { value: 0, error: 'Semaphore not found' };
    }
    return { value: sem.getValue() };
  }

  initProducerConsumer(bufferSize: number): ProducerConsumerState {
    this.producerConsumer = new ProducerConsumerSolver(bufferSize);
    return this.producerConsumer.getState();
  }

  produce(producerId: string, item: string): ReturnType<ProducerConsumerSolver['produce']> | { error: string } {
    if (!this.producerConsumer) {
      return { error: 'Producer-Consumer not initialized' } as { error: string };
    }
    return this.producerConsumer.produce(producerId, item);
  }

  consume(consumerId: string): ReturnType<ProducerConsumerSolver['consume']> | { error: string } {
    if (!this.producerConsumer) {
      return { error: 'Producer-Consumer not initialized' } as { error: string };
    }
    return this.producerConsumer.consume(consumerId);
  }

  initDiningPhilosophers(num: number): DiningPhilosophersState {
    this.diningPhilosophers = new DiningPhilosophersSolver(num);
    return this.diningPhilosophers.getState();
  }

  philosopherAction(philosopherId: number, action: 'think' | 'pickup' | 'putdown'): Record<string, unknown> {
    if (!this.diningPhilosophers) {
      return { error: 'Dining Philosophers not initialized' };
    }

    switch (action) {
      case 'think':
        return this.diningPhilosophers.think(philosopherId);
      case 'pickup':
        return this.diningPhilosophers.pickUpChopsticks(philosopherId);
      case 'putdown':
        return this.diningPhilosophers.putDownChopsticks(philosopherId);
      default:
        return { error: 'Unknown action' };
    }
  }

  initReadersWriters(): ReadersWritersState {
    this.readersWriters = new ReadersWritersSolver();
    return this.readersWriters.getState();
  }

  readerWriter(id: string, role: 'reader' | 'writer', action: 'start' | 'end'): Record<string, unknown> {
    if (!this.readersWriters) {
      return { error: 'Readers-Writers not initialized' };
    }

    if (role === 'reader') {
      return action === 'start'
        ? this.readersWriters.startRead(id)
        : this.readersWriters.endRead(id);
    } else {
      return action === 'start'
        ? this.readersWriters.startWrite(id)
        : this.readersWriters.endWrite(id);
    }
  }

  createBarrier(id: string, threshold: number): BarrierState {
    const barrier = new Barrier(id, threshold);
    this.barriers.set(id, barrier);
    return barrier.getState();
  }

  arriveBarrier(barrierId: string, processId: string): ReturnType<Barrier['arrive']> | { error: string } {
    const barrier = this.barriers.get(barrierId);
    if (!barrier) {
      return { error: 'Barrier not found' } as { error: string };
    }
    return barrier.arrive(processId);
  }

  getSemaphoreState(semId: string): SemaphoreState | null {
    const sem = this.semaphores.get(semId);
    return sem ? sem.getState() : null;
  }

  getAllState(): {
    semaphores: SemaphoreState[];
    producerConsumer: ProducerConsumerState | null;
    diningPhilosophers: DiningPhilosophersState | null;
    readersWriters: ReadersWritersState | null;
    barriers: BarrierState[];
  } {
    return {
      semaphores: [...this.semaphores.values()].map(s => s.getState()),
      producerConsumer: this.producerConsumer?.getState() || null,
      diningPhilosophers: this.diningPhilosophers?.getState() || null,
      readersWriters: this.readersWriters?.getState() || null,
      barriers: [...this.barriers.values()].map(b => b.getState())
    };
  }

  visualize(target?: string): string {
    if (target === 'producer_consumer' && this.producerConsumer) {
      return this.producerConsumer.visualize();
    }
    if (target === 'dining_philosophers' && this.diningPhilosophers) {
      return this.diningPhilosophers.visualize();
    }
    if (target === 'readers_writers' && this.readersWriters) {
      return this.readersWriters.visualize();
    }
    if (target && this.semaphores.has(target)) {
      return this.semaphores.get(target)!.visualize();
    }
    if (target && this.barriers.has(target)) {
      return this.barriers.get(target)!.visualize();
    }

    let viz = 'Semaphore Manager State\n';
    viz += '='.repeat(50) + '\n\n';

    for (const sem of this.semaphores.values()) {
      viz += sem.visualize() + '\n';
    }

    return viz;
  }

  reset(): void {
    this.semaphores.clear();
    this.semaphoreSets.clear();
    this.barriers.clear();
    this.producerConsumer = null;
    this.diningPhilosophers = null;
    this.readersWriters = null;
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let semaphoreManager: SemaphoreManager | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const semaphoreTool: UnifiedTool = {
  name: 'semaphore',
  description: 'Semaphore synchronization simulator with counting/binary semaphores, producer-consumer, dining philosophers, readers-writers, barriers',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create', 'wait', 'signal', 'try_wait', 'get_value',
          'solve_producer_consumer', 'produce', 'consume',
          'solve_dining_philosophers', 'philosopher_action',
          'solve_readers_writers', 'reader_writer_action',
          'create_barrier', 'arrive_barrier',
          'visualize_state', 'analyze_fairness', 'get_state', 'reset',
          'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      semId: { type: 'string', description: 'Semaphore ID' },
      processId: { type: 'string', description: 'Process ID' },
      initialValue: { type: 'number', description: 'Initial semaphore value' },
      isBinary: { type: 'boolean', description: 'Create binary semaphore' },
      bufferSize: { type: 'number', description: 'Buffer size for producer-consumer' },
      item: { type: 'string', description: 'Item to produce' },
      numPhilosophers: { type: 'number', description: 'Number of dining philosophers' },
      philosopherId: { type: 'number', description: 'Philosopher ID' },
      action: { type: 'string', enum: ['think', 'pickup', 'putdown', 'start', 'end'], description: 'Action to perform' },
      role: { type: 'string', enum: ['reader', 'writer'], description: 'Role for readers-writers' },
      barrierId: { type: 'string', description: 'Barrier ID' },
      threshold: { type: 'number', description: 'Barrier threshold' },
      target: { type: 'string', description: 'Visualization target' }
    },
    required: ['operation']
  }
};

export async function executesemaphore(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    if (!semaphoreManager) {
      semaphoreManager = new SemaphoreManager();
    }

    switch (operation) {
      case 'create': {
        const semId = args.semId || `sem_${Date.now()}`;
        const initialValue = args.initialValue ?? 1;
        const isBinary = args.isBinary || false;
        const state = semaphoreManager.createSemaphore(semId, initialValue, isBinary);

        return {
          toolCallId: id,
          content: JSON.stringify({ operation: 'create', semaphore: state }, null, 2)
        };
      }

      case 'wait': {
        if (!args.semId || !args.processId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'semId and processId required' }), isError: true };
        }
        const result = semaphoreManager.wait(args.semId, args.processId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'wait', ...result }, null, 2) };
      }

      case 'signal': {
        if (!args.semId || !args.processId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'semId and processId required' }), isError: true };
        }
        const result = semaphoreManager.signal(args.semId, args.processId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'signal', ...result }, null, 2) };
      }

      case 'try_wait': {
        if (!args.semId || !args.processId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'semId and processId required' }), isError: true };
        }
        const result = semaphoreManager.tryWait(args.semId, args.processId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'try_wait', ...result }, null, 2) };
      }

      case 'get_value': {
        if (!args.semId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'semId required' }), isError: true };
        }
        const result = semaphoreManager.getValue(args.semId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'get_value', ...result }, null, 2) };
      }

      case 'solve_producer_consumer': {
        const bufferSize = args.bufferSize || 5;
        const state = semaphoreManager.initProducerConsumer(bufferSize);
        return { toolCallId: id, content: JSON.stringify({ operation: 'solve_producer_consumer', initialized: true, state }, null, 2) };
      }

      case 'produce': {
        const producerId = args.processId || 'P1';
        const item = args.item || `item_${Date.now()}`;
        const result = semaphoreManager.produce(producerId, item);
        return { toolCallId: id, content: JSON.stringify({ operation: 'produce', ...result }, null, 2) };
      }

      case 'consume': {
        const consumerId = args.processId || 'C1';
        const result = semaphoreManager.consume(consumerId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'consume', ...result }, null, 2) };
      }

      case 'solve_dining_philosophers': {
        const num = args.numPhilosophers || 5;
        const state = semaphoreManager.initDiningPhilosophers(num);
        return { toolCallId: id, content: JSON.stringify({ operation: 'solve_dining_philosophers', initialized: true, state }, null, 2) };
      }

      case 'philosopher_action': {
        const philosopherId = args.philosopherId ?? 0;
        const action = args.action || 'think';
        const result = semaphoreManager.philosopherAction(philosopherId, action);
        return { toolCallId: id, content: JSON.stringify({ operation: 'philosopher_action', philosopherId, action, ...result }, null, 2) };
      }

      case 'solve_readers_writers': {
        const state = semaphoreManager.initReadersWriters();
        return { toolCallId: id, content: JSON.stringify({ operation: 'solve_readers_writers', initialized: true, state }, null, 2) };
      }

      case 'reader_writer_action': {
        const rwId = args.processId || 'RW1';
        const role = args.role || 'reader';
        const action = args.action || 'start';
        const result = semaphoreManager.readerWriter(rwId, role, action);
        return { toolCallId: id, content: JSON.stringify({ operation: 'reader_writer_action', role, action, ...result }, null, 2) };
      }

      case 'create_barrier': {
        const barrierId = args.barrierId || `barrier_${Date.now()}`;
        const threshold = args.threshold || 3;
        const state = semaphoreManager.createBarrier(barrierId, threshold);
        return { toolCallId: id, content: JSON.stringify({ operation: 'create_barrier', barrier: state }, null, 2) };
      }

      case 'arrive_barrier': {
        if (!args.barrierId || !args.processId) {
          return { toolCallId: id, content: JSON.stringify({ error: 'barrierId and processId required' }), isError: true };
        }
        const result = semaphoreManager.arriveBarrier(args.barrierId, args.processId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'arrive_barrier', ...result }, null, 2) };
      }

      case 'visualize_state': {
        const viz = semaphoreManager.visualize(args.target);
        return { toolCallId: id, content: JSON.stringify({ operation: 'visualize_state', visualization: viz }, null, 2) };
      }

      case 'get_state': {
        const state = semaphoreManager.getAllState();
        return { toolCallId: id, content: JSON.stringify({ operation: 'get_state', state }, null, 2) };
      }

      case 'reset': {
        semaphoreManager.reset();
        return { toolCallId: id, content: JSON.stringify({ operation: 'reset', message: 'Semaphore manager reset' }, null, 2) };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Semaphore Simulator',
            description: 'Comprehensive semaphore synchronization primitive simulator',
            types: {
              CountingSemaphore: 'Semaphore with value >= 0',
              BinarySemaphore: 'Semaphore with value 0 or 1 (mutex-like)'
            },
            operations: {
              basic: ['create', 'wait (P/down)', 'signal (V/up)', 'try_wait', 'get_value'],
              producerConsumer: ['solve_producer_consumer', 'produce', 'consume'],
              diningPhilosophers: ['solve_dining_philosophers', 'philosopher_action'],
              readersWriters: ['solve_readers_writers', 'reader_writer_action'],
              barrier: ['create_barrier', 'arrive_barrier']
            },
            classicProblems: [
              'Producer-Consumer (Bounded Buffer)',
              'Dining Philosophers',
              'Readers-Writers',
              'Barrier Synchronization'
            ],
            features: [
              'Priority-based waiting',
              'Timeout operations',
              'Deadlock detection (dining philosophers)',
              'Fairness analysis',
              'State visualization'
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
                name: 'Basic semaphore operations',
                calls: [
                  { operation: 'create', semId: 'mutex', initialValue: 1, isBinary: true },
                  { operation: 'wait', semId: 'mutex', processId: 'P1' },
                  { operation: 'signal', semId: 'mutex', processId: 'P1' }
                ]
              },
              {
                name: 'Producer-Consumer',
                calls: [
                  { operation: 'solve_producer_consumer', bufferSize: 3 },
                  { operation: 'produce', processId: 'Producer1', item: 'apple' },
                  { operation: 'produce', processId: 'Producer1', item: 'banana' },
                  { operation: 'consume', processId: 'Consumer1' },
                  { operation: 'visualize_state', target: 'producer_consumer' }
                ]
              },
              {
                name: 'Dining Philosophers',
                calls: [
                  { operation: 'solve_dining_philosophers', numPhilosophers: 5 },
                  { operation: 'philosopher_action', philosopherId: 0, action: 'pickup' },
                  { operation: 'philosopher_action', philosopherId: 1, action: 'pickup' },
                  { operation: 'philosopher_action', philosopherId: 0, action: 'putdown' },
                  { operation: 'visualize_state', target: 'dining_philosophers' }
                ]
              },
              {
                name: 'Barrier Synchronization',
                calls: [
                  { operation: 'create_barrier', barrierId: 'sync_point', threshold: 3 },
                  { operation: 'arrive_barrier', barrierId: 'sync_point', processId: 'Thread1' },
                  { operation: 'arrive_barrier', barrierId: 'sync_point', processId: 'Thread2' },
                  { operation: 'arrive_barrier', barrierId: 'sync_point', processId: 'Thread3' }
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

export function issemaphoreAvailable(): boolean { return true; }
