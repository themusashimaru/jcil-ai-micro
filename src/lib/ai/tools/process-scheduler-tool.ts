/**
 * PROCESS SCHEDULER TOOL
 * Comprehensive CPU scheduling algorithm simulator
 * Supports FCFS, SJF, Priority, Round Robin, Multilevel Queue, Real-time scheduling
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type ProcessState = 'new' | 'ready' | 'running' | 'waiting' | 'terminated';

interface Process {
  pid: number;
  name: string;
  arrivalTime: number;
  burstTime: number;
  remainingTime: number;
  priority: number;
  state: ProcessState;
  ioTime?: number;
  ioStartAfter?: number;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  completionTime: number;
  firstScheduled: boolean;
  queueLevel?: number;
  period?: number;  // For real-time scheduling
  deadline?: number;
}

interface GanttEntry {
  pid: number | string;
  processName: string;
  startTime: number;
  endTime: number;
}

interface SchedulerMetrics {
  avgTurnaroundTime: number;
  avgWaitingTime: number;
  avgResponseTime: number;
  throughput: number;
  cpuUtilization: number;
  totalTime: number;
  contextSwitches: number;
  processesCompleted: number;
}

interface IOEvent {
  pid: number;
  startTime: number;
  duration: number;
}

type SchedulingAlgorithm = 'fcfs' | 'sjf' | 'sjf-preemptive' | 'priority' | 'priority-preemptive' |
  'round-robin' | 'multilevel-queue' | 'multilevel-feedback' | 'rate-monotonic' | 'edf';

// ============================================================================
// PROCESS SCHEDULER CLASS
// ============================================================================

class ProcessScheduler {
  private processes: Process[];
  private readyQueue: Process[];
  private waitingQueue: Process[];
  private ganttChart: GanttEntry[];
  private currentTime: number;
  private algorithm: SchedulingAlgorithm;
  private quantum: number;
  private contextSwitchTime: number;
  private contextSwitches: number;
  private totalIdleTime: number;
  private ioEvents: IOEvent[];

  // For multilevel queues
  private queues: Process[][];
  private queueQuantums: number[];
  private numQueues: number;

  constructor(config: {
    algorithm?: SchedulingAlgorithm;
    quantum?: number;
    contextSwitchTime?: number;
    numQueues?: number;
  } = {}) {
    this.algorithm = config.algorithm || 'fcfs';
    this.quantum = config.quantum || 4;
    this.contextSwitchTime = config.contextSwitchTime || 0;
    this.numQueues = config.numQueues || 3;

    this.processes = [];
    this.readyQueue = [];
    this.waitingQueue = [];
    this.ganttChart = [];
    this.currentTime = 0;
    this.contextSwitches = 0;
    this.totalIdleTime = 0;
    this.ioEvents = [];

    // Initialize multilevel queues with different quantums
    this.queues = Array(this.numQueues).fill(null).map(() => []);
    this.queueQuantums = [8, 16, 32];  // Increasing quantum per level
  }

  addProcess(config: {
    pid?: number;
    name?: string;
    arrivalTime: number;
    burstTime: number;
    priority?: number;
    ioTime?: number;
    ioStartAfter?: number;
    period?: number;
    deadline?: number;
  }): Process {
    const process: Process = {
      pid: config.pid ?? this.processes.length + 1,
      name: config.name ?? `P${this.processes.length + 1}`,
      arrivalTime: config.arrivalTime,
      burstTime: config.burstTime,
      remainingTime: config.burstTime,
      priority: config.priority ?? 0,
      state: 'new',
      ioTime: config.ioTime,
      ioStartAfter: config.ioStartAfter,
      waitingTime: 0,
      turnaroundTime: 0,
      responseTime: -1,
      completionTime: 0,
      firstScheduled: false,
      queueLevel: 0,
      period: config.period,
      deadline: config.deadline
    };

    this.processes.push(process);
    return process;
  }

  private getArrivedProcesses(): Process[] {
    return this.processes.filter(p =>
      p.arrivalTime <= this.currentTime &&
      p.state !== 'terminated' &&
      p.state !== 'waiting' &&
      !this.readyQueue.includes(p)
    );
  }

  private selectNextFCFS(): Process | null {
    if (this.readyQueue.length === 0) return null;
    return this.readyQueue[0];
  }

  private selectNextSJF(preemptive: boolean = false): Process | null {
    if (this.readyQueue.length === 0) return null;

    let shortest = this.readyQueue[0];
    for (const p of this.readyQueue) {
      const time = preemptive ? p.remainingTime : p.burstTime;
      const shortestTime = preemptive ? shortest.remainingTime : shortest.burstTime;
      if (time < shortestTime) {
        shortest = p;
      }
    }
    return shortest;
  }

  private selectNextPriority(_preemptive: boolean = false): Process | null {
    if (this.readyQueue.length === 0) return null;

    let highest = this.readyQueue[0];
    for (const p of this.readyQueue) {
      if (p.priority < highest.priority) {  // Lower number = higher priority
        highest = p;
      } else if (p.priority === highest.priority && p.arrivalTime < highest.arrivalTime) {
        highest = p;
      }
    }
    return highest;
  }

  private selectNextRoundRobin(): Process | null {
    if (this.readyQueue.length === 0) return null;
    return this.readyQueue[0];
  }

  private selectNextMultilevelQueue(): { process: Process | null; quantum: number } {
    // Check queues in priority order
    for (let level = 0; level < this.numQueues; level++) {
      if (this.queues[level].length > 0) {
        return {
          process: this.queues[level][0],
          quantum: this.queueQuantums[level]
        };
      }
    }
    return { process: null, quantum: this.quantum };
  }

  private selectNextRateMonotonic(): Process | null {
    // Shorter period = higher priority
    if (this.readyQueue.length === 0) return null;

    let highest = this.readyQueue[0];
    for (const p of this.readyQueue) {
      if (p.period && highest.period) {
        if (p.period < highest.period) {
          highest = p;
        }
      }
    }
    return highest;
  }

  private selectNextEDF(): Process | null {
    // Earliest deadline first
    if (this.readyQueue.length === 0) return null;

    let earliest = this.readyQueue[0];
    for (const p of this.readyQueue) {
      const deadline = p.deadline ?? Infinity;
      const earliestDeadline = earliest.deadline ?? Infinity;
      if (deadline < earliestDeadline) {
        earliest = p;
      }
    }
    return earliest;
  }

  private selectNextProcess(): { process: Process | null; quantum: number } {
    let process: Process | null = null;
    let quantum = this.quantum;

    switch (this.algorithm) {
      case 'fcfs':
        process = this.selectNextFCFS();
        quantum = Infinity;
        break;
      case 'sjf':
        process = this.selectNextSJF(false);
        quantum = Infinity;
        break;
      case 'sjf-preemptive':
        process = this.selectNextSJF(true);
        quantum = 1;
        break;
      case 'priority':
        process = this.selectNextPriority(false);
        quantum = Infinity;
        break;
      case 'priority-preemptive':
        process = this.selectNextPriority(true);
        quantum = 1;
        break;
      case 'round-robin':
        process = this.selectNextRoundRobin();
        quantum = this.quantum;
        break;
      case 'multilevel-queue':
      case 'multilevel-feedback':
        const result = this.selectNextMultilevelQueue();
        process = result.process;
        quantum = result.quantum;
        break;
      case 'rate-monotonic':
        process = this.selectNextRateMonotonic();
        quantum = Infinity;
        break;
      case 'edf':
        process = this.selectNextEDF();
        quantum = Infinity;
        break;
    }

    return { process, quantum };
  }

  private handleIOCompletion(): void {
    const completed = this.waitingQueue.filter(p => {
      const ioEvent = this.ioEvents.find(e => e.pid === p.pid);
      return ioEvent && this.currentTime >= ioEvent.startTime + ioEvent.duration;
    });

    for (const p of completed) {
      p.state = 'ready';
      this.waitingQueue = this.waitingQueue.filter(w => w.pid !== p.pid);

      if (this.algorithm === 'multilevel-feedback') {
        this.queues[p.queueLevel || 0].push(p);
      } else {
        this.readyQueue.push(p);
      }
    }
  }

  private executeProcess(process: Process, timeSlice: number): number {
    const actualTime = Math.min(timeSlice, process.remainingTime);

    // Check for I/O
    let ioOccurred = false;
    let executedTime = actualTime;

    if (process.ioStartAfter !== undefined && process.ioTime !== undefined) {
      const timeUntilIO = process.burstTime - process.remainingTime;
      if (timeUntilIO < process.ioStartAfter &&
          timeUntilIO + actualTime >= process.ioStartAfter) {
        executedTime = process.ioStartAfter - timeUntilIO;
        ioOccurred = true;
      }
    }

    process.remainingTime -= executedTime;

    // Record in Gantt chart
    this.ganttChart.push({
      pid: process.pid,
      processName: process.name,
      startTime: this.currentTime,
      endTime: this.currentTime + executedTime
    });

    this.currentTime += executedTime;

    // Handle I/O
    if (ioOccurred && process.ioTime) {
      process.state = 'waiting';
      this.ioEvents.push({
        pid: process.pid,
        startTime: this.currentTime,
        duration: process.ioTime
      });
      this.waitingQueue.push(process);
      this.readyQueue = this.readyQueue.filter(p => p.pid !== process.pid);

      // Reset I/O trigger
      process.ioStartAfter = undefined;
    }

    return executedTime;
  }

  schedule(): SchedulerMetrics {
    // Reset simulation
    this.currentTime = 0;
    this.ganttChart = [];
    this.contextSwitches = 0;
    this.totalIdleTime = 0;
    this.readyQueue = [];
    this.waitingQueue = [];
    this.ioEvents = [];
    this.queues = Array(this.numQueues).fill(null).map(() => []);

    // Reset process states
    for (const p of this.processes) {
      p.state = 'new';
      p.remainingTime = p.burstTime;
      p.waitingTime = 0;
      p.turnaroundTime = 0;
      p.responseTime = -1;
      p.completionTime = 0;
      p.firstScheduled = false;
      p.queueLevel = 0;
    }

    let lastPid = -1;
    const maxTime = 10000;  // Safety limit

    while (this.currentTime < maxTime) {
      // Add newly arrived processes to ready queue
      const arrived = this.getArrivedProcesses();
      for (const p of arrived) {
        p.state = 'ready';
        if (this.algorithm === 'multilevel-queue' || this.algorithm === 'multilevel-feedback') {
          this.queues[p.queueLevel || 0].push(p);
        } else {
          this.readyQueue.push(p);
        }
      }

      // Handle I/O completion
      this.handleIOCompletion();

      // Check if all processes are done
      const allDone = this.processes.every(p => p.state === 'terminated');
      if (allDone) break;

      // Select next process
      const { process, quantum } = this.selectNextProcess();

      if (!process) {
        // CPU idle
        this.ganttChart.push({
          pid: 'IDLE',
          processName: 'IDLE',
          startTime: this.currentTime,
          endTime: this.currentTime + 1
        });
        this.currentTime++;
        this.totalIdleTime++;
        continue;
      }

      // Context switch
      if (lastPid !== -1 && lastPid !== process.pid && this.contextSwitchTime > 0) {
        this.currentTime += this.contextSwitchTime;
        this.contextSwitches++;
      }

      // Record response time
      if (!process.firstScheduled) {
        process.responseTime = this.currentTime - process.arrivalTime;
        process.firstScheduled = true;
      }

      process.state = 'running';

      // Execute process
      const executed = this.executeProcess(process, quantum);

      // Check completion
      if (process.remainingTime <= 0) {
        process.state = 'terminated';
        process.completionTime = this.currentTime;
        process.turnaroundTime = process.completionTime - process.arrivalTime;
        process.waitingTime = process.turnaroundTime - process.burstTime;

        // Remove from queues
        this.readyQueue = this.readyQueue.filter(p => p.pid !== process.pid);
        for (let i = 0; i < this.numQueues; i++) {
          this.queues[i] = this.queues[i].filter(p => p.pid !== process.pid);
        }
      } else if (executed === quantum) {
        // Time quantum expired - move to end of queue (Round Robin)
        if (this.algorithm === 'round-robin') {
          this.readyQueue = this.readyQueue.filter(p => p.pid !== process.pid);
          this.readyQueue.push(process);
        } else if (this.algorithm === 'multilevel-feedback') {
          // Demote to lower priority queue
          const currentLevel = process.queueLevel || 0;
          this.queues[currentLevel] = this.queues[currentLevel].filter(p => p.pid !== process.pid);
          const newLevel = Math.min(currentLevel + 1, this.numQueues - 1);
          process.queueLevel = newLevel;
          this.queues[newLevel].push(process);
        }
        process.state = 'ready';
      }

      lastPid = process.pid;
    }

    return this.calculateMetrics();
  }

  private calculateMetrics(): SchedulerMetrics {
    const completed = this.processes.filter(p => p.state === 'terminated');
    const n = completed.length;

    if (n === 0) {
      return {
        avgTurnaroundTime: 0,
        avgWaitingTime: 0,
        avgResponseTime: 0,
        throughput: 0,
        cpuUtilization: 0,
        totalTime: this.currentTime,
        contextSwitches: this.contextSwitches,
        processesCompleted: 0
      };
    }

    const avgTurnaround = completed.reduce((sum, p) => sum + p.turnaroundTime, 0) / n;
    const avgWaiting = completed.reduce((sum, p) => sum + p.waitingTime, 0) / n;
    const avgResponse = completed.reduce((sum, p) => sum + p.responseTime, 0) / n;
    const throughput = this.currentTime > 0 ? n / this.currentTime : 0;
    const cpuUtilization = this.currentTime > 0
      ? ((this.currentTime - this.totalIdleTime) / this.currentTime) * 100
      : 0;

    return {
      avgTurnaroundTime: Math.round(avgTurnaround * 100) / 100,
      avgWaitingTime: Math.round(avgWaiting * 100) / 100,
      avgResponseTime: Math.round(avgResponse * 100) / 100,
      throughput: Math.round(throughput * 1000) / 1000,
      cpuUtilization: Math.round(cpuUtilization * 100) / 100,
      totalTime: this.currentTime,
      contextSwitches: this.contextSwitches,
      processesCompleted: n
    };
  }

  visualizeGantt(): string {
    if (this.ganttChart.length === 0) {
      return 'No schedule generated yet. Run schedule() first.';
    }

    let viz = 'Gantt Chart\n';
    viz += '='.repeat(80) + '\n\n';

    // Timeline bar
    const maxTime = Math.min(this.ganttChart[this.ganttChart.length - 1].endTime, 50);
    const scale = 1;

    viz += '|';
    for (const entry of this.ganttChart) {
      if (entry.startTime >= maxTime) break;
      const width = Math.min(entry.endTime, maxTime) - entry.startTime;
      const label = entry.pid.toString().padStart(Math.floor(width * scale / 2)).padEnd(width * scale);
      viz += label.substring(0, width * scale) + '|';
    }
    viz += '\n';

    // Time markers
    viz += '0';
    let lastEnd = 0;
    for (const entry of this.ganttChart) {
      if (entry.startTime >= maxTime) break;
      const width = Math.min(entry.endTime, maxTime) - entry.startTime;
      lastEnd = Math.min(entry.endTime, maxTime);
      viz += ' '.repeat(Math.max(0, width * scale - 1)) + lastEnd;
    }
    viz += '\n\n';

    // Detailed view
    viz += 'Detailed Schedule:\n';
    viz += '-'.repeat(50) + '\n';
    for (const entry of this.ganttChart) {
      viz += `${entry.processName.padEnd(8)} | ${entry.startTime.toString().padStart(4)} - ${entry.endTime.toString().padEnd(4)} | Duration: ${entry.endTime - entry.startTime}\n`;
    }

    return viz;
  }

  getProcessDetails(): Array<{
    pid: number;
    name: string;
    arrival: number;
    burst: number;
    priority: number;
    waiting: number;
    turnaround: number;
    response: number;
    completion: number;
    state: ProcessState;
  }> {
    return this.processes.map(p => ({
      pid: p.pid,
      name: p.name,
      arrival: p.arrivalTime,
      burst: p.burstTime,
      priority: p.priority,
      waiting: p.waitingTime,
      turnaround: p.turnaroundTime,
      response: p.responseTime,
      completion: p.completionTime,
      state: p.state
    }));
  }

  configureQuantum(quantum: number): void {
    this.quantum = quantum;
  }

  configureAlgorithm(algorithm: SchedulingAlgorithm): void {
    this.algorithm = algorithm;
  }

  detectStarvation(threshold: number = 50): Array<{ pid: number; name: string; waitingTime: number }> {
    return this.processes
      .filter(p => p.waitingTime > threshold)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        waitingTime: p.waitingTime
      }));
  }

  detectConvoyEffect(): boolean {
    // Convoy effect: short processes wait behind long ones in FCFS
    if (this.algorithm !== 'fcfs') return false;

    const sorted = [...this.processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
    let hasConvoy = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].burstTime > 10 && sorted[i + 1].burstTime < 3) {
        if (sorted[i + 1].waitingTime > sorted[i].burstTime * 0.5) {
          hasConvoy = true;
          break;
        }
      }
    }

    return hasConvoy;
  }

  reset(): void {
    this.processes = [];
    this.readyQueue = [];
    this.waitingQueue = [];
    this.ganttChart = [];
    this.currentTime = 0;
    this.contextSwitches = 0;
    this.totalIdleTime = 0;
    this.ioEvents = [];
    this.queues = Array(this.numQueues).fill(null).map(() => []);
  }

  simulateIO(pid: number, duration: number): void {
    const process = this.processes.find(p => p.pid === pid);
    if (process) {
      process.ioTime = duration;
      process.ioStartAfter = Math.floor(process.burstTime / 2);
    }
  }
}

// ============================================================================
// ALGORITHM COMPARISON
// ============================================================================

function compareSchedulingAlgorithms(processes: Array<{
  arrivalTime: number;
  burstTime: number;
  priority?: number;
}>): Record<string, SchedulerMetrics> {
  const algorithms: SchedulingAlgorithm[] = [
    'fcfs', 'sjf', 'sjf-preemptive', 'priority', 'round-robin'
  ];

  const results: Record<string, SchedulerMetrics> = {};

  for (const algo of algorithms) {
    const scheduler = new ProcessScheduler({ algorithm: algo, quantum: 4 });

    for (const p of processes) {
      scheduler.addProcess(p);
    }

    results[algo] = scheduler.schedule();
  }

  return results;
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let scheduler: ProcessScheduler | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const processschedulerTool: UnifiedTool = {
  name: 'process_scheduler',
  description: 'CPU scheduling simulator with FCFS, SJF, Priority, Round Robin, Multilevel Queue, Rate Monotonic, EDF',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'add_process', 'schedule', 'get_metrics', 'compare_algorithms',
          'visualize_gantt', 'configure_quantum', 'simulate_io',
          'detect_starvation', 'detect_convoy', 'get_process_details',
          'configure_algorithm', 'reset', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      processes: {
        type: 'array',
        items: { type: 'object' },
        description: 'List of processes with arrivalTime, burstTime, priority, name properties'
      },
      pid: { type: 'number', description: 'Process ID' },
      name: { type: 'string', description: 'Process name' },
      arrivalTime: { type: 'number', description: 'Arrival time' },
      burstTime: { type: 'number', description: 'CPU burst time' },
      priority: { type: 'number', description: 'Priority (lower = higher)' },
      quantum: { type: 'number', description: 'Time quantum for Round Robin' },
      algorithm: {
        type: 'string',
        enum: ['fcfs', 'sjf', 'sjf-preemptive', 'priority', 'priority-preemptive',
               'round-robin', 'multilevel-queue', 'multilevel-feedback', 'rate-monotonic', 'edf'],
        description: 'Scheduling algorithm'
      },
      ioDuration: { type: 'number', description: 'I/O duration' },
      starvationThreshold: { type: 'number', description: 'Waiting time threshold for starvation' }
    },
    required: ['operation']
  }
};

export async function executeprocessscheduler(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'add_process': {
        if (!scheduler) {
          scheduler = new ProcessScheduler({
            algorithm: args.algorithm || 'fcfs',
            quantum: args.quantum || 4
          });
        }

        if (args.processes && Array.isArray(args.processes)) {
          const added = [];
          for (const p of args.processes) {
            const process = scheduler.addProcess({
              arrivalTime: p.arrivalTime ?? 0,
              burstTime: p.burstTime ?? 5,
              priority: p.priority ?? 0,
              name: p.name
            });
            added.push({ pid: process.pid, name: process.name });
          }
          return {
            toolCallId: id,
            content: JSON.stringify({ operation: 'add_process', added }, null, 2)
          };
        } else {
          const process = scheduler.addProcess({
            pid: args.pid,
            name: args.name,
            arrivalTime: args.arrivalTime ?? 0,
            burstTime: args.burstTime ?? 5,
            priority: args.priority ?? 0
          });

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'add_process',
              process: { pid: process.pid, name: process.name, arrival: process.arrivalTime, burst: process.burstTime, priority: process.priority }
            }, null, 2)
          };
        }
      }

      case 'schedule': {
        if (!scheduler) {
          scheduler = new ProcessScheduler({
            algorithm: args.algorithm || 'fcfs',
            quantum: args.quantum || 4
          });

          // Add default processes if none exist
          const defaultProcesses = [
            { arrivalTime: 0, burstTime: 10, priority: 2 },
            { arrivalTime: 1, burstTime: 5, priority: 1 },
            { arrivalTime: 2, burstTime: 8, priority: 3 },
            { arrivalTime: 3, burstTime: 3, priority: 4 }
          ];

          for (const p of defaultProcesses) {
            scheduler.addProcess(p);
          }
        }

        if (args.algorithm) {
          scheduler.configureAlgorithm(args.algorithm);
        }
        if (args.quantum) {
          scheduler.configureQuantum(args.quantum);
        }

        const metrics = scheduler.schedule();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'schedule',
            algorithm: args.algorithm || 'fcfs',
            metrics,
            gantt: scheduler.visualizeGantt(),
            processes: scheduler.getProcessDetails()
          }, null, 2)
        };
      }

      case 'get_metrics': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        const metrics = scheduler.schedule();
        return {
          toolCallId: id,
          content: JSON.stringify({ operation: 'get_metrics', metrics }, null, 2)
        };
      }

      case 'compare_algorithms': {
        const processes = args.processes || [
          { arrivalTime: 0, burstTime: 10, priority: 2 },
          { arrivalTime: 1, burstTime: 5, priority: 1 },
          { arrivalTime: 2, burstTime: 8, priority: 3 },
          { arrivalTime: 3, burstTime: 3, priority: 4 }
        ];

        const results = compareSchedulingAlgorithms(processes);

        const comparison = Object.entries(results).map(([algo, metrics]) => ({
          algorithm: algo.toUpperCase(),
          avgWaitingTime: metrics.avgWaitingTime,
          avgTurnaroundTime: metrics.avgTurnaroundTime,
          avgResponseTime: metrics.avgResponseTime,
          cpuUtilization: metrics.cpuUtilization + '%'
        })).sort((a, b) => a.avgWaitingTime - b.avgWaitingTime);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_algorithms',
            processes,
            comparison,
            bestForWaiting: comparison[0].algorithm,
            bestForTurnaround: [...comparison].sort((a, b) => a.avgTurnaroundTime - b.avgTurnaroundTime)[0].algorithm
          }, null, 2)
        };
      }

      case 'visualize_gantt': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize_gantt',
            gantt: scheduler.visualizeGantt()
          }, null, 2)
        };
      }

      case 'configure_quantum': {
        const quantum = args.quantum || 4;
        if (!scheduler) {
          scheduler = new ProcessScheduler({ quantum });
        } else {
          scheduler.configureQuantum(quantum);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_quantum',
            quantum,
            message: `Time quantum set to ${quantum}`
          }, null, 2)
        };
      }

      case 'configure_algorithm': {
        const algorithm = args.algorithm || 'fcfs';
        if (!scheduler) {
          scheduler = new ProcessScheduler({ algorithm });
        } else {
          scheduler.configureAlgorithm(algorithm);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_algorithm',
            algorithm,
            message: `Algorithm set to ${algorithm.toUpperCase()}`
          }, null, 2)
        };
      }

      case 'simulate_io': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        const pid = args.pid || 1;
        const duration = args.ioDuration || 5;
        scheduler.simulateIO(pid, duration);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_io',
            pid,
            ioDuration: duration,
            message: `I/O configured for process ${pid}`
          }, null, 2)
        };
      }

      case 'detect_starvation': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        const threshold = args.starvationThreshold || 50;
        const starving = scheduler.detectStarvation(threshold);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_starvation',
            threshold,
            starvingProcesses: starving,
            starvationDetected: starving.length > 0
          }, null, 2)
        };
      }

      case 'detect_convoy': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        const convoyDetected = scheduler.detectConvoyEffect();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_convoy',
            convoyEffectDetected: convoyDetected,
            explanation: convoyDetected
              ? 'Convoy effect detected: Short processes are waiting behind long ones in FCFS'
              : 'No convoy effect detected'
          }, null, 2)
        };
      }

      case 'get_process_details': {
        if (!scheduler) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No scheduler initialized' }), isError: true };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_process_details',
            processes: scheduler.getProcessDetails()
          }, null, 2)
        };
      }

      case 'reset': {
        if (scheduler) {
          scheduler.reset();
        }
        scheduler = null;

        return {
          toolCallId: id,
          content: JSON.stringify({ operation: 'reset', message: 'Scheduler reset' }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Process Scheduler',
            description: 'Comprehensive CPU scheduling algorithm simulator',
            algorithms: {
              FCFS: 'First Come First Serve - non-preemptive, simple queue',
              SJF: 'Shortest Job First - optimal for average waiting time (non-preemptive)',
              'SJF-Preemptive': 'Shortest Remaining Time First - preemptive SJF',
              Priority: 'Priority Scheduling - lower number = higher priority',
              'Priority-Preemptive': 'Preemptive priority scheduling',
              'Round-Robin': 'Time-sliced scheduling with configurable quantum',
              'Multilevel-Queue': 'Multiple queues with different priorities',
              'Multilevel-Feedback': 'Processes can move between queues',
              'Rate-Monotonic': 'Real-time: shorter period = higher priority',
              EDF: 'Earliest Deadline First - real-time scheduling'
            },
            metrics: ['Turnaround Time', 'Waiting Time', 'Response Time', 'Throughput', 'CPU Utilization'],
            features: ['Gantt chart visualization', 'Context switch simulation', 'I/O simulation', 'Starvation detection', 'Convoy effect detection']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Add processes and schedule with Round Robin',
                calls: [
                  { operation: 'add_process', processes: [
                    { arrivalTime: 0, burstTime: 10, name: 'P1' },
                    { arrivalTime: 2, burstTime: 5, name: 'P2' },
                    { arrivalTime: 4, burstTime: 8, name: 'P3' }
                  ]},
                  { operation: 'schedule', algorithm: 'round-robin', quantum: 3 }
                ]
              },
              {
                name: 'Compare algorithms',
                call: {
                  operation: 'compare_algorithms',
                  processes: [
                    { arrivalTime: 0, burstTime: 6 },
                    { arrivalTime: 1, burstTime: 8 },
                    { arrivalTime: 2, burstTime: 3 }
                  ]
                }
              },
              {
                name: 'Schedule with priority',
                calls: [
                  { operation: 'configure_algorithm', algorithm: 'priority' },
                  { operation: 'add_process', arrivalTime: 0, burstTime: 10, priority: 3 },
                  { operation: 'add_process', arrivalTime: 1, burstTime: 4, priority: 1 },
                  { operation: 'schedule' }
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

export function isprocessschedulerAvailable(): boolean { return true; }
