/**
 * DINING-PHILOSOPHERS TOOL
 * Classic concurrency problem with multiple solutions:
 * - Resource hierarchy (ordered forks)
 * - Arbitrator (waiter) solution
 * - Chandy/Misra solution
 * - Simulation of deadlock and livelock scenarios
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const diningphilosophersTool: UnifiedTool = {
  name: 'dining_philosophers',
  description: 'Dining philosophers problem with multiple deadlock-free solutions',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'resource_hierarchy', 'arbitrator', 'chandy_misra', 'analyze', 'deadlock_demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      num_philosophers: { type: 'integer', minimum: 2, maximum: 20, description: 'Number of philosophers (default: 5)' },
      steps: { type: 'integer', minimum: 1, maximum: 1000, description: 'Number of simulation steps' },
      think_time: { type: 'integer', description: 'Average thinking time in ticks' },
      eat_time: { type: 'integer', description: 'Average eating time in ticks' },
      solution: {
        type: 'string',
        enum: ['naive', 'resource_hierarchy', 'arbitrator', 'chandy_misra', 'odd_even'],
        description: 'Solution strategy to use'
      },
      random_seed: { type: 'integer', description: 'Random seed for reproducibility' }
    },
    required: ['operation']
  }
};

// Philosopher states
type PhilosopherState = 'thinking' | 'hungry' | 'eating' | 'waiting_left' | 'waiting_right';

interface Philosopher {
  id: number;
  name: string;
  state: PhilosopherState;
  thinkTime: number;
  eatTime: number;
  timesEaten: number;
  totalWaitTime: number;
  hasLeftFork: boolean;
  hasRightFork: boolean;
  currentAction: number; // Countdown for current action
}

interface Fork {
  id: number;
  heldBy: number | null;
  dirty: boolean; // For Chandy/Misra
  requestedBy: number | null;
}

interface SimulationState {
  philosophers: Philosopher[];
  forks: Fork[];
  time: number;
  events: string[];
  deadlockDetected: boolean;
  livelockDetected: boolean;
}

// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

// Initialize simulation state
function initSimulation(n: number, thinkTime: number, eatTime: number): SimulationState {
  const names = ['Aristotle', 'Plato', 'Socrates', 'Confucius', 'Descartes',
                 'Kant', 'Nietzsche', 'Hume', 'Locke', 'Spinoza',
                 'Leibniz', 'Hegel', 'Marx', 'Russell', 'Wittgenstein',
                 'Sartre', 'Camus', 'Kierkegaard', 'Aquinas', 'Augustine'];

  const philosophers: Philosopher[] = [];
  const forks: Fork[] = [];

  for (let i = 0; i < n; i++) {
    philosophers.push({
      id: i,
      name: names[i % names.length],
      state: 'thinking',
      thinkTime,
      eatTime,
      timesEaten: 0,
      totalWaitTime: 0,
      hasLeftFork: false,
      hasRightFork: false,
      currentAction: thinkTime
    });

    forks.push({
      id: i,
      heldBy: null,
      dirty: true,
      requestedBy: null
    });
  }

  return {
    philosophers,
    forks,
    time: 0,
    events: [],
    deadlockDetected: false,
    livelockDetected: false
  };
}

// Get fork indices for a philosopher
function getForkIndices(philosopherId: number, n: number): { left: number; right: number } {
  return {
    left: philosopherId,
    right: (philosopherId + 1) % n
  };
}

// Naive solution (can deadlock)
function simulateNaive(state: SimulationState, rng: SeededRandom): void {
  const n = state.philosophers.length;

  for (const phil of state.philosophers) {
    const { left, right } = getForkIndices(phil.id, n);
    const leftFork = state.forks[left];
    const rightFork = state.forks[right];

    if (phil.state === 'thinking') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        phil.state = 'hungry';
        state.events.push(`[${state.time}] ${phil.name} is hungry`);
      }
    } else if (phil.state === 'hungry') {
      // Try to pick up left fork first
      if (!phil.hasLeftFork && leftFork.heldBy === null) {
        leftFork.heldBy = phil.id;
        phil.hasLeftFork = true;
        state.events.push(`[${state.time}] ${phil.name} picks up left fork ${left}`);
      }

      // Then try right fork
      if (phil.hasLeftFork && !phil.hasRightFork && rightFork.heldBy === null) {
        rightFork.heldBy = phil.id;
        phil.hasRightFork = true;
        state.events.push(`[${state.time}] ${phil.name} picks up right fork ${right}`);
      }

      // If both forks acquired, start eating
      if (phil.hasLeftFork && phil.hasRightFork) {
        phil.state = 'eating';
        phil.currentAction = phil.eatTime;
        state.events.push(`[${state.time}] ${phil.name} starts eating`);
      } else {
        phil.totalWaitTime++;
      }
    } else if (phil.state === 'eating') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        // Done eating, release forks
        leftFork.heldBy = null;
        rightFork.heldBy = null;
        phil.hasLeftFork = false;
        phil.hasRightFork = false;
        phil.timesEaten++;
        phil.state = 'thinking';
        phil.currentAction = phil.thinkTime + rng.nextInt(phil.thinkTime);
        state.events.push(`[${state.time}] ${phil.name} finished eating, thinking`);
      }
    }
  }

  // Check for deadlock: all philosophers hungry with one fork
  const hungryWithOneFork = state.philosophers.filter(
    p => p.state === 'hungry' && ((p.hasLeftFork && !p.hasRightFork) || (!p.hasLeftFork && p.hasRightFork))
  );
  if (hungryWithOneFork.length === n) {
    state.deadlockDetected = true;
    state.events.push(`[${state.time}] DEADLOCK DETECTED! All philosophers holding one fork`);
  }
}

// Resource hierarchy solution (lower-numbered fork first)
function simulateResourceHierarchy(state: SimulationState, rng: SeededRandom): void {
  const n = state.philosophers.length;

  for (const phil of state.philosophers) {
    const { left, right } = getForkIndices(phil.id, n);
    const lowerFork = Math.min(left, right);
    const higherFork = Math.max(left, right);
    const lowerForkObj = state.forks[lowerFork];
    const higherForkObj = state.forks[higherFork];
    const leftFork = state.forks[left];
    const rightFork = state.forks[right];

    if (phil.state === 'thinking') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        phil.state = 'hungry';
        state.events.push(`[${state.time}] ${phil.name} is hungry`);
      }
    } else if (phil.state === 'hungry') {
      // Always pick up lower-numbered fork first
      const hasLower = (lowerFork === left) ? phil.hasLeftFork : phil.hasRightFork;
      const hasHigher = (higherFork === left) ? phil.hasLeftFork : phil.hasRightFork;

      if (!hasLower && lowerForkObj.heldBy === null) {
        lowerForkObj.heldBy = phil.id;
        if (lowerFork === left) {
          phil.hasLeftFork = true;
        } else {
          phil.hasRightFork = true;
        }
        state.events.push(`[${state.time}] ${phil.name} picks up fork ${lowerFork} (lower)`);
      }

      const hasLowerNow = (lowerFork === left) ? phil.hasLeftFork : phil.hasRightFork;
      if (hasLowerNow && !hasHigher && higherForkObj.heldBy === null) {
        higherForkObj.heldBy = phil.id;
        if (higherFork === left) {
          phil.hasLeftFork = true;
        } else {
          phil.hasRightFork = true;
        }
        state.events.push(`[${state.time}] ${phil.name} picks up fork ${higherFork} (higher)`);
      }

      if (phil.hasLeftFork && phil.hasRightFork) {
        phil.state = 'eating';
        phil.currentAction = phil.eatTime;
        state.events.push(`[${state.time}] ${phil.name} starts eating`);
      } else {
        phil.totalWaitTime++;
      }
    } else if (phil.state === 'eating') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        leftFork.heldBy = null;
        rightFork.heldBy = null;
        phil.hasLeftFork = false;
        phil.hasRightFork = false;
        phil.timesEaten++;
        phil.state = 'thinking';
        phil.currentAction = phil.thinkTime + rng.nextInt(phil.thinkTime);
        state.events.push(`[${state.time}] ${phil.name} finished eating`);
      }
    }
  }
}

// Arbitrator (waiter) solution
function simulateArbitrator(state: SimulationState, rng: SeededRandom): void {
  const n = state.philosophers.length;
  const maxEating = Math.floor(n / 2); // Waiter allows at most floor(n/2) to eat

  // Count currently eating
  const currentlyEating = state.philosophers.filter(p => p.state === 'eating').length;

  for (const phil of state.philosophers) {
    const { left, right } = getForkIndices(phil.id, n);
    const leftFork = state.forks[left];
    const rightFork = state.forks[right];

    if (phil.state === 'thinking') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        phil.state = 'hungry';
        state.events.push(`[${state.time}] ${phil.name} is hungry, asks waiter`);
      }
    } else if (phil.state === 'hungry') {
      // Waiter grants permission only if below max eating limit and both forks free
      const eatingNow = state.philosophers.filter(p => p.state === 'eating').length;
      if (eatingNow < maxEating && leftFork.heldBy === null && rightFork.heldBy === null) {
        leftFork.heldBy = phil.id;
        rightFork.heldBy = phil.id;
        phil.hasLeftFork = true;
        phil.hasRightFork = true;
        phil.state = 'eating';
        phil.currentAction = phil.eatTime;
        state.events.push(`[${state.time}] Waiter allows ${phil.name} to eat`);
      } else {
        phil.totalWaitTime++;
      }
    } else if (phil.state === 'eating') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        leftFork.heldBy = null;
        rightFork.heldBy = null;
        phil.hasLeftFork = false;
        phil.hasRightFork = false;
        phil.timesEaten++;
        phil.state = 'thinking';
        phil.currentAction = phil.thinkTime + rng.nextInt(phil.thinkTime);
        state.events.push(`[${state.time}] ${phil.name} finished, notifies waiter`);
      }
    }
  }
}

// Chandy/Misra solution (dirty/clean forks)
function simulateChandyMisra(state: SimulationState, rng: SeededRandom): void {
  const n = state.philosophers.length;

  // Initialize: lower-numbered philosopher gets fork, forks start dirty
  if (state.time === 0) {
    for (let i = 0; i < n; i++) {
      const fork = state.forks[i];
      // Fork i is between philosopher i-1 and i
      // Give to lower-numbered neighbor
      fork.heldBy = i;
      fork.dirty = true;
    }
    // Update philosopher's fork ownership
    for (const phil of state.philosophers) {
      const { left, right } = getForkIndices(phil.id, n);
      phil.hasLeftFork = state.forks[left].heldBy === phil.id;
      phil.hasRightFork = state.forks[right].heldBy === phil.id;
    }
  }

  for (const phil of state.philosophers) {
    const { left, right } = getForkIndices(phil.id, n);
    const leftFork = state.forks[left];
    const rightFork = state.forks[right];

    if (phil.state === 'thinking') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        phil.state = 'hungry';
        // Request forks we don't have
        if (!phil.hasLeftFork) {
          leftFork.requestedBy = phil.id;
          state.events.push(`[${state.time}] ${phil.name} requests left fork`);
        }
        if (!phil.hasRightFork) {
          rightFork.requestedBy = phil.id;
          state.events.push(`[${state.time}] ${phil.name} requests right fork`);
        }
      }
    } else if (phil.state === 'hungry') {
      // Try to get forks
      if (!phil.hasLeftFork && leftFork.requestedBy === phil.id) {
        const holder = leftFork.heldBy;
        if (holder !== null && holder !== phil.id && leftFork.dirty) {
          // Holder must give up dirty fork when requested
          const holderPhil = state.philosophers[holder];
          if (left === holder) {
            holderPhil.hasLeftFork = false;
          } else {
            holderPhil.hasRightFork = false;
          }
          leftFork.heldBy = phil.id;
          leftFork.dirty = false; // Clean when transferred
          phil.hasLeftFork = true;
          leftFork.requestedBy = null;
          state.events.push(`[${state.time}] ${phil.name} receives left fork (was dirty)`);
        }
      }

      if (!phil.hasRightFork && rightFork.requestedBy === phil.id) {
        const holder = rightFork.heldBy;
        if (holder !== null && holder !== phil.id && rightFork.dirty) {
          const holderPhil = state.philosophers[holder];
          if (right === holder) {
            holderPhil.hasLeftFork = false;
          } else {
            holderPhil.hasRightFork = false;
          }
          rightFork.heldBy = phil.id;
          rightFork.dirty = false;
          phil.hasRightFork = true;
          rightFork.requestedBy = null;
          state.events.push(`[${state.time}] ${phil.name} receives right fork (was dirty)`);
        }
      }

      if (phil.hasLeftFork && phil.hasRightFork) {
        phil.state = 'eating';
        phil.currentAction = phil.eatTime;
        state.events.push(`[${state.time}] ${phil.name} starts eating`);
      } else {
        phil.totalWaitTime++;
      }
    } else if (phil.state === 'eating') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        // Mark forks as dirty after eating
        leftFork.dirty = true;
        rightFork.dirty = true;
        phil.timesEaten++;
        phil.state = 'thinking';
        phil.currentAction = phil.thinkTime + rng.nextInt(phil.thinkTime);
        state.events.push(`[${state.time}] ${phil.name} finished eating (forks now dirty)`);
      }
    }
  }
}

// Odd-even solution
function simulateOddEven(state: SimulationState, rng: SeededRandom): void {
  const n = state.philosophers.length;

  for (const phil of state.philosophers) {
    const { left, right } = getForkIndices(phil.id, n);
    const leftFork = state.forks[left];
    const rightFork = state.forks[right];

    // Odd philosophers pick right first, even pick left first
    const isOdd = phil.id % 2 === 1;
    const firstFork = isOdd ? rightFork : leftFork;
    const secondFork = isOdd ? leftFork : rightFork;
    const firstIsLeft = !isOdd;

    if (phil.state === 'thinking') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        phil.state = 'hungry';
        state.events.push(`[${state.time}] ${phil.name} is hungry`);
      }
    } else if (phil.state === 'hungry') {
      const hasFirst = firstIsLeft ? phil.hasLeftFork : phil.hasRightFork;
      const hasSecond = firstIsLeft ? phil.hasRightFork : phil.hasLeftFork;

      if (!hasFirst && firstFork.heldBy === null) {
        firstFork.heldBy = phil.id;
        if (firstIsLeft) {
          phil.hasLeftFork = true;
        } else {
          phil.hasRightFork = true;
        }
        state.events.push(`[${state.time}] ${phil.name} picks up ${firstIsLeft ? 'left' : 'right'} fork first`);
      }

      const hasFirstNow = firstIsLeft ? phil.hasLeftFork : phil.hasRightFork;
      if (hasFirstNow && !hasSecond && secondFork.heldBy === null) {
        secondFork.heldBy = phil.id;
        if (firstIsLeft) {
          phil.hasRightFork = true;
        } else {
          phil.hasLeftFork = true;
        }
        state.events.push(`[${state.time}] ${phil.name} picks up ${firstIsLeft ? 'right' : 'left'} fork`);
      }

      if (phil.hasLeftFork && phil.hasRightFork) {
        phil.state = 'eating';
        phil.currentAction = phil.eatTime;
        state.events.push(`[${state.time}] ${phil.name} starts eating`);
      } else {
        phil.totalWaitTime++;
      }
    } else if (phil.state === 'eating') {
      phil.currentAction--;
      if (phil.currentAction <= 0) {
        leftFork.heldBy = null;
        rightFork.heldBy = null;
        phil.hasLeftFork = false;
        phil.hasRightFork = false;
        phil.timesEaten++;
        phil.state = 'thinking';
        phil.currentAction = phil.thinkTime + rng.nextInt(phil.thinkTime);
        state.events.push(`[${state.time}] ${phil.name} finished eating`);
      }
    }
  }
}

// Run simulation
function runSimulation(
  n: number,
  steps: number,
  solution: string,
  thinkTime: number,
  eatTime: number,
  seed: number
): SimulationState {
  const state = initSimulation(n, thinkTime, eatTime);
  const rng = new SeededRandom(seed);

  const simulators: Record<string, (s: SimulationState, r: SeededRandom) => void> = {
    naive: simulateNaive,
    resource_hierarchy: simulateResourceHierarchy,
    arbitrator: simulateArbitrator,
    chandy_misra: simulateChandyMisra,
    odd_even: simulateOddEven
  };

  const simulate = simulators[solution] || simulateNaive;

  for (let t = 0; t < steps; t++) {
    state.time = t;
    simulate(state, rng);

    if (state.deadlockDetected) break;
  }

  return state;
}

// Analyze solution properties
function analyzeSolution(solution: string): object {
  const properties: Record<string, object> = {
    naive: {
      name: 'Naive (Unsafe)',
      deadlock_free: false,
      starvation_free: false,
      fairness: 'none',
      description: 'Each philosopher picks up left fork, then right. Circular wait leads to deadlock.',
      issue: 'All philosophers may hold their left fork, waiting for right fork forever.'
    },
    resource_hierarchy: {
      name: 'Resource Hierarchy',
      deadlock_free: true,
      starvation_free: false,
      fairness: 'weak',
      description: 'Forks are numbered; philosophers always pick up lower-numbered fork first.',
      prevents: 'Circular wait (one of four Coffman conditions)',
      note: 'Simple and efficient, but philosopher n-1 may starve under high contention.'
    },
    arbitrator: {
      name: 'Arbitrator (Waiter)',
      deadlock_free: true,
      starvation_free: true,
      fairness: 'strong (with FIFO queue)',
      description: 'Central waiter grants permission to eat. Max n/2 can eat simultaneously.',
      prevents: 'Hold and wait condition',
      note: 'Centralized bottleneck, but guarantees fairness.'
    },
    chandy_misra: {
      name: 'Chandy/Misra',
      deadlock_free: true,
      starvation_free: true,
      fairness: 'strong',
      description: 'Forks have dirty/clean state. Dirty forks must be given to requesters.',
      prevents: 'Circular wait through acyclic precedence graph',
      note: 'Fully distributed, no central coordinator.'
    },
    odd_even: {
      name: 'Odd-Even',
      deadlock_free: true,
      starvation_free: false,
      fairness: 'weak',
      description: 'Odd philosophers pick right first; even pick left first.',
      prevents: 'Circular wait by breaking symmetry',
      note: 'Simple modification of naive approach.'
    }
  };

  return properties[solution] || properties['naive'];
}

export async function executediningphilosophers(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'simulate': {
        const n = args.num_philosophers || 5;
        const steps = args.steps || 100;
        const solution = args.solution || 'resource_hierarchy';
        const thinkTime = args.think_time || 3;
        const eatTime = args.eat_time || 2;
        const seed = args.random_seed || Date.now();

        const state = runSimulation(n, steps, solution, thinkTime, eatTime, seed);

        const totalMeals = state.philosophers.reduce((sum, p) => sum + p.timesEaten, 0);
        const avgWait = state.philosophers.reduce((sum, p) => sum + p.totalWaitTime, 0) / n;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate',
            solution,
            num_philosophers: n,
            steps_run: state.time + 1,
            deadlock_detected: state.deadlockDetected,
            statistics: {
              total_meals: totalMeals,
              average_meals_per_philosopher: (totalMeals / n).toFixed(2),
              average_wait_time: avgWait.toFixed(2),
              meals_per_step: (totalMeals / (state.time + 1)).toFixed(4)
            },
            philosophers: state.philosophers.map(p => ({
              id: p.id,
              name: p.name,
              state: p.state,
              times_eaten: p.timesEaten,
              total_wait_time: p.totalWaitTime,
              has_forks: `L:${p.hasLeftFork} R:${p.hasRightFork}`
            })),
            forks: state.forks.map(f => ({
              id: f.id,
              held_by: f.heldBy !== null ? state.philosophers[f.heldBy].name : 'table',
              dirty: f.dirty
            })),
            recent_events: state.events.slice(-20),
            all_events: state.events
          }, null, 2)
        };
      }

      case 'resource_hierarchy': {
        const n = args.num_philosophers || 5;
        const steps = args.steps || 50;
        const state = runSimulation(n, steps, 'resource_hierarchy', 3, 2, args.random_seed || 42);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'resource_hierarchy',
            explanation: 'Philosophers always pick up the lower-numbered fork first',
            principle: 'Prevents circular wait by imposing total ordering on resources',
            example: `Philosopher ${n-1} picks up fork 0 before fork ${n-1} (unlike others who pick left first)`,
            simulation_result: {
              steps: steps,
              deadlock: state.deadlockDetected,
              total_meals: state.philosophers.reduce((sum, p) => sum + p.timesEaten, 0)
            },
            coffman_conditions_prevented: ['Circular Wait'],
            events_sample: state.events.slice(0, 15)
          }, null, 2)
        };
      }

      case 'arbitrator': {
        const n = args.num_philosophers || 5;
        const steps = args.steps || 50;
        const state = runSimulation(n, steps, 'arbitrator', 3, 2, args.random_seed || 42);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'arbitrator',
            explanation: 'A central waiter controls access to forks',
            rules: [
              'Philosophers must ask waiter for permission to eat',
              `Maximum ${Math.floor(n/2)} philosophers can eat simultaneously`,
              'Waiter ensures no deadlock by atomic fork acquisition',
              'Can implement FIFO queue for fairness'
            ],
            simulation_result: {
              steps: steps,
              deadlock: state.deadlockDetected,
              max_concurrent_eating: Math.floor(n/2),
              total_meals: state.philosophers.reduce((sum, p) => sum + p.timesEaten, 0)
            },
            coffman_conditions_prevented: ['Hold and Wait'],
            events_sample: state.events.slice(0, 15)
          }, null, 2)
        };
      }

      case 'chandy_misra': {
        const n = args.num_philosophers || 5;
        const steps = args.steps || 50;
        const state = runSimulation(n, steps, 'chandy_misra', 3, 2, args.random_seed || 42);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'chandy_misra',
            explanation: 'Fully distributed solution using dirty/clean fork protocol',
            rules: [
              'Forks start dirty; initially given to lower-numbered philosopher',
              'When a philosopher finishes eating, forks become dirty',
              'A dirty fork must be given to any requester',
              'A clean fork may be kept until used',
              'This creates an acyclic precedence graph'
            ],
            simulation_result: {
              steps: steps,
              deadlock: state.deadlockDetected,
              total_meals: state.philosophers.reduce((sum, p) => sum + p.timesEaten, 0)
            },
            properties: {
              deadlock_free: true,
              starvation_free: true,
              distributed: true,
              no_central_coordinator: true
            },
            fork_states: state.forks.map(f => ({
              fork: f.id,
              holder: f.heldBy,
              dirty: f.dirty
            })),
            events_sample: state.events.slice(0, 15)
          }, null, 2)
        };
      }

      case 'analyze': {
        const solution = args.solution || 'all';

        if (solution === 'all') {
          const solutions = ['naive', 'resource_hierarchy', 'arbitrator', 'chandy_misra', 'odd_even'];
          const analysis = solutions.map(s => ({
            solution: s,
            ...analyzeSolution(s) as object
          }));

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'analyze',
              problem_description: 'Five philosophers sit at a round table with a fork between each pair. To eat, a philosopher needs both adjacent forks.',
              coffman_conditions: [
                'Mutual Exclusion: Forks cannot be shared',
                'Hold and Wait: Holding one fork while waiting for another',
                'No Preemption: Cannot forcibly take a fork',
                'Circular Wait: Each waits for the next'
              ],
              solutions: analysis,
              recommendation: 'Use Chandy/Misra for distributed systems, Arbitrator for guaranteed fairness, Resource Hierarchy for simplicity'
            }, null, 2)
          };
        } else {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'analyze',
              solution,
              ...analyzeSolution(solution)
            }, null, 2)
          };
        }
      }

      case 'deadlock_demo': {
        const n = args.num_philosophers || 5;
        const state = runSimulation(n, 200, 'naive', 1, 2, args.random_seed || 12345);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'deadlock_demo',
            description: 'Demonstration of deadlock with naive solution',
            num_philosophers: n,
            steps_until_deadlock: state.deadlockDetected ? state.time : 'No deadlock in 200 steps',
            deadlock_detected: state.deadlockDetected,
            final_state: state.philosophers.map(p => ({
              name: p.name,
              state: p.state,
              left_fork: p.hasLeftFork,
              right_fork: p.hasRightFork
            })),
            explanation: state.deadlockDetected
              ? 'All philosophers holding left fork, waiting for right fork - classic circular wait!'
              : 'Deadlock did not occur in this run (try different seed)',
            events: state.events.slice(-30)
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'dining_philosophers',
            description: 'Classic concurrency problem demonstrating deadlock and synchronization',
            problem: {
              setup: 'N philosophers sit at round table with N forks (one between each pair)',
              goal: 'Each philosopher alternates between thinking and eating',
              constraint: 'Eating requires both adjacent forks',
              challenge: 'Prevent deadlock while maximizing concurrency'
            },
            solutions_implemented: [
              'naive: Unsafe - picks up left then right (can deadlock)',
              'resource_hierarchy: Always pick lower-numbered fork first',
              'arbitrator: Central waiter controls access',
              'chandy_misra: Distributed dirty/clean fork protocol',
              'odd_even: Odd philosophers pick right first'
            ],
            operations: {
              simulate: 'Run simulation with chosen solution',
              resource_hierarchy: 'Demo resource hierarchy solution',
              arbitrator: 'Demo arbitrator solution',
              chandy_misra: 'Demo Chandy/Misra solution',
              analyze: 'Analyze solution properties',
              deadlock_demo: 'Demonstrate deadlock with naive solution'
            },
            historical_note: 'Problem formulated by Edsger Dijkstra in 1965',
            applications: [
              'Database transaction locking',
              'Operating system resource allocation',
              'Network protocol design',
              'Distributed systems consensus'
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
                description: 'Simulate 5 philosophers with resource hierarchy',
                call: {
                  operation: 'simulate',
                  num_philosophers: 5,
                  steps: 100,
                  solution: 'resource_hierarchy'
                }
              },
              {
                description: 'Demonstrate deadlock with naive solution',
                call: {
                  operation: 'deadlock_demo',
                  num_philosophers: 5,
                  random_seed: 12345
                }
              },
              {
                description: 'Compare Chandy/Misra solution',
                call: {
                  operation: 'chandy_misra',
                  num_philosophers: 5,
                  steps: 100
                }
              },
              {
                description: 'Analyze all solutions',
                call: {
                  operation: 'analyze',
                  solution: 'all'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdiningphilosophersAvailable(): boolean {
  return true;
}
