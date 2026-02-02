/**
 * DISCRETE-EVENT-SIM TOOL
 * Discrete event simulation for queuing systems and process modeling
 *
 * Features:
 * - Queuing models (M/M/1, M/M/c, M/G/1)
 * - Petri nets simulation
 * - State machine execution
 * - Event scheduling and processing
 * - Statistical analysis of results
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const discreteeventsimTool: UnifiedTool = {
  name: 'discrete_event_sim',
  description: 'Discrete event simulation for queuing theory, Petri nets, and state machine modeling',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'queue_model', 'petri_net', 'state_machine', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      model: {
        type: 'string',
        enum: ['mm1', 'mmc', 'mg1', 'gg1', 'custom'],
        description: 'Queuing model type'
      },
      arrival_rate: {
        type: 'number',
        description: 'Arrival rate (lambda) for queuing models'
      },
      service_rate: {
        type: 'number',
        description: 'Service rate (mu) for queuing models'
      },
      num_servers: {
        type: 'number',
        description: 'Number of servers for M/M/c model'
      },
      simulation_time: {
        type: 'number',
        description: 'Total simulation time'
      },
      petri_net: {
        type: 'object',
        description: 'Petri net definition'
      },
      state_machine: {
        type: 'object',
        description: 'State machine definition'
      }
    },
    required: ['operation']
  }
};

// Event types
interface Event {
  time: number;
  type: string;
  data?: Record<string, unknown>;
}

// Priority queue for events (min-heap by time)
class EventQueue {
  private heap: Event[] = [];

  push(event: Event): void {
    this.heap.push(event);
    this.heapifyUp(this.heap.length - 1);
  }

  pop(): Event | undefined {
    if (this.heap.length === 0) return undefined;
    const result = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    return result;
  }

  peek(): Event | undefined {
    return this.heap[0];
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  size(): number {
    return this.heap.length;
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].time <= this.heap[index].time) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private heapifyDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.heap[left].time < this.heap[smallest].time) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].time < this.heap[smallest].time) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// Generate exponential random variable
function exponential(rate: number): number {
  return -Math.log(1 - Math.random()) / rate;
}

// Generate uniform random variable
function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Generate normal random variable (Box-Muller)
function normal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// Statistics collector
class Statistics {
  private values: number[] = [];
  private sum = 0;
  private sumSquares = 0;
  private count = 0;
  private min = Infinity;
  private max = -Infinity;

  record(value: number): void {
    this.values.push(value);
    this.sum += value;
    this.sumSquares += value * value;
    this.count++;
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;
  }

  mean(): number {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  variance(): number {
    if (this.count < 2) return 0;
    return (this.sumSquares - this.sum * this.sum / this.count) / (this.count - 1);
  }

  stdDev(): number {
    return Math.sqrt(this.variance());
  }

  percentile(p: number): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil(p / 100 * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  getSummary(): Record<string, number> {
    return {
      count: this.count,
      mean: this.mean(),
      std_dev: this.stdDev(),
      min: this.min === Infinity ? 0 : this.min,
      max: this.max === -Infinity ? 0 : this.max,
      p50: this.percentile(50),
      p90: this.percentile(90),
      p99: this.percentile(99)
    };
  }
}

// M/M/1 Queue Simulation
function simulateMM1(
  arrivalRate: number,
  serviceRate: number,
  simTime: number
): Record<string, unknown> {
  const events = new EventQueue();
  const waitTimes = new Statistics();
  const systemTimes = new Statistics();
  const queueLengths: number[] = [];

  let currentTime = 0;
  let queueLength = 0;
  let serverBusy = false;
  let customersServed = 0;
  let totalQueueLength = 0;
  let lastEventTime = 0;

  // Customer arrival times and service start times
  const customers: Map<number, { arrivalTime: number; serviceStartTime?: number }> = new Map();
  let nextCustomerId = 0;

  // Schedule first arrival
  events.push({ time: exponential(arrivalRate), type: 'arrival' });

  while (!events.isEmpty() && currentTime < simTime) {
    const event = events.pop()!;

    // Update time-weighted queue length
    totalQueueLength += queueLength * (event.time - lastEventTime);
    lastEventTime = event.time;
    currentTime = event.time;

    if (event.type === 'arrival') {
      const customerId = nextCustomerId++;
      customers.set(customerId, { arrivalTime: currentTime });

      if (!serverBusy) {
        // Start service immediately
        serverBusy = true;
        const serviceTime = exponential(serviceRate);
        events.push({
          time: currentTime + serviceTime,
          type: 'departure',
          data: { customerId }
        });
        customers.get(customerId)!.serviceStartTime = currentTime;
        waitTimes.record(0);
      } else {
        queueLength++;
      }

      // Schedule next arrival
      events.push({ time: currentTime + exponential(arrivalRate), type: 'arrival' });
    } else if (event.type === 'departure') {
      const customerId = event.data?.customerId as number;
      const customer = customers.get(customerId);

      if (customer) {
        const systemTime = currentTime - customer.arrivalTime;
        systemTimes.record(systemTime);
        customers.delete(customerId);
      }

      customersServed++;

      if (queueLength > 0) {
        // Serve next customer in queue
        queueLength--;
        const serviceTime = exponential(serviceRate);

        // Find oldest waiting customer
        let oldestCustomerId = -1;
        let oldestArrival = Infinity;
        for (const [id, cust] of customers) {
          if (!cust.serviceStartTime && cust.arrivalTime < oldestArrival) {
            oldestArrival = cust.arrivalTime;
            oldestCustomerId = id;
          }
        }

        if (oldestCustomerId >= 0) {
          const waitTime = currentTime - oldestArrival;
          waitTimes.record(waitTime);
          customers.get(oldestCustomerId)!.serviceStartTime = currentTime;
          events.push({
            time: currentTime + serviceTime,
            type: 'departure',
            data: { customerId: oldestCustomerId }
          });
        }
      } else {
        serverBusy = false;
      }
    }

    queueLengths.push(queueLength);
  }

  // Theoretical values for M/M/1
  const rho = arrivalRate / serviceRate;  // Utilization
  const theoreticalL = rho / (1 - rho);   // Average number in system
  const theoreticalLq = rho * rho / (1 - rho);  // Average queue length
  const theoreticalW = 1 / (serviceRate - arrivalRate);  // Average time in system
  const theoreticalWq = rho / (serviceRate - arrivalRate);  // Average wait time

  return {
    model: 'M/M/1',
    parameters: {
      arrival_rate: arrivalRate,
      service_rate: serviceRate,
      utilization: rho,
      stability: rho < 1 ? 'stable' : 'unstable'
    },
    simulation_results: {
      simulation_time: simTime,
      customers_served: customersServed,
      throughput: customersServed / simTime,
      avg_queue_length: totalQueueLength / currentTime,
      wait_time_stats: waitTimes.getSummary(),
      system_time_stats: systemTimes.getSummary()
    },
    theoretical_values: rho < 1 ? {
      avg_customers_in_system: theoreticalL,
      avg_queue_length: theoreticalLq,
      avg_time_in_system: theoreticalW,
      avg_wait_time: theoreticalWq
    } : 'System unstable (ρ >= 1)',
    comparison: rho < 1 ? {
      queue_length_error: Math.abs(totalQueueLength / currentTime - theoreticalLq) / theoreticalLq * 100,
      wait_time_error: Math.abs(waitTimes.mean() - theoreticalWq) / theoreticalWq * 100
    } : null
  };
}

// M/M/c Queue Simulation
function simulateMMc(
  arrivalRate: number,
  serviceRate: number,
  numServers: number,
  simTime: number
): Record<string, unknown> {
  const events = new EventQueue();
  const waitTimes = new Statistics();
  const systemTimes = new Statistics();

  let currentTime = 0;
  let queueLength = 0;
  let busyServers = 0;
  let customersServed = 0;
  let totalQueueLength = 0;
  let lastEventTime = 0;

  const customers: Map<number, { arrivalTime: number; serviceStartTime?: number }> = new Map();
  let nextCustomerId = 0;

  events.push({ time: exponential(arrivalRate), type: 'arrival' });

  while (!events.isEmpty() && currentTime < simTime) {
    const event = events.pop()!;

    totalQueueLength += queueLength * (event.time - lastEventTime);
    lastEventTime = event.time;
    currentTime = event.time;

    if (event.type === 'arrival') {
      const customerId = nextCustomerId++;
      customers.set(customerId, { arrivalTime: currentTime });

      if (busyServers < numServers) {
        busyServers++;
        const serviceTime = exponential(serviceRate);
        events.push({
          time: currentTime + serviceTime,
          type: 'departure',
          data: { customerId }
        });
        customers.get(customerId)!.serviceStartTime = currentTime;
        waitTimes.record(0);
      } else {
        queueLength++;
      }

      events.push({ time: currentTime + exponential(arrivalRate), type: 'arrival' });
    } else if (event.type === 'departure') {
      const customerId = event.data?.customerId as number;
      const customer = customers.get(customerId);

      if (customer) {
        systemTimes.record(currentTime - customer.arrivalTime);
        customers.delete(customerId);
      }

      customersServed++;

      if (queueLength > 0) {
        queueLength--;
        const serviceTime = exponential(serviceRate);

        let oldestCustomerId = -1;
        let oldestArrival = Infinity;
        for (const [id, cust] of customers) {
          if (!cust.serviceStartTime && cust.arrivalTime < oldestArrival) {
            oldestArrival = cust.arrivalTime;
            oldestCustomerId = id;
          }
        }

        if (oldestCustomerId >= 0) {
          waitTimes.record(currentTime - oldestArrival);
          customers.get(oldestCustomerId)!.serviceStartTime = currentTime;
          events.push({
            time: currentTime + serviceTime,
            type: 'departure',
            data: { customerId: oldestCustomerId }
          });
        }
      } else {
        busyServers--;
      }
    }
  }

  const rho = arrivalRate / (numServers * serviceRate);

  // Erlang C formula for P(wait > 0)
  function factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  const a = arrivalRate / serviceRate;
  let sumTerm = 0;
  for (let n = 0; n < numServers; n++) {
    sumTerm += Math.pow(a, n) / factorial(n);
  }
  const lastTerm = Math.pow(a, numServers) / factorial(numServers) * numServers / (numServers - a);
  const erlangC = lastTerm / (sumTerm + lastTerm);

  const theoreticalWq = erlangC / (numServers * serviceRate - arrivalRate);
  const theoreticalLq = arrivalRate * theoreticalWq;

  return {
    model: 'M/M/c',
    parameters: {
      arrival_rate: arrivalRate,
      service_rate: serviceRate,
      num_servers: numServers,
      utilization: rho,
      stability: rho < 1 ? 'stable' : 'unstable'
    },
    simulation_results: {
      simulation_time: simTime,
      customers_served: customersServed,
      throughput: customersServed / simTime,
      avg_queue_length: totalQueueLength / currentTime,
      wait_time_stats: waitTimes.getSummary(),
      system_time_stats: systemTimes.getSummary()
    },
    theoretical_values: rho < 1 ? {
      erlang_c: erlangC,
      avg_wait_time: theoreticalWq,
      avg_queue_length: theoreticalLq
    } : 'System unstable'
  };
}

// Petri Net Simulation
interface PetriPlace {
  name: string;
  tokens: number;
}

interface PetriTransition {
  name: string;
  inputs: { place: string; weight: number }[];
  outputs: { place: string; weight: number }[];
  rate?: number;  // For timed transitions
}

interface PetriNet {
  places: PetriPlace[];
  transitions: PetriTransition[];
}

function simulatePetriNet(
  net: PetriNet,
  simTime: number,
  maxSteps: number = 10000
): Record<string, unknown> {
  const places = new Map<string, number>();
  for (const place of net.places) {
    places.set(place.name, place.tokens);
  }

  const events = new EventQueue();
  const firingHistory: { time: number; transition: string; marking: Record<string, number> }[] = [];
  let currentTime = 0;
  let steps = 0;

  // Find enabled transitions
  function getEnabledTransitions(): PetriTransition[] {
    return net.transitions.filter(t => {
      for (const input of t.inputs) {
        if ((places.get(input.place) || 0) < input.weight) {
          return false;
        }
      }
      return true;
    });
  }

  // Fire a transition
  function fire(transition: PetriTransition): void {
    for (const input of transition.inputs) {
      places.set(input.place, (places.get(input.place) || 0) - input.weight);
    }
    for (const output of transition.outputs) {
      places.set(output.place, (places.get(output.place) || 0) + output.weight);
    }
  }

  // Schedule initial transitions
  const enabled = getEnabledTransitions();
  for (const t of enabled) {
    const delay = t.rate ? exponential(t.rate) : 0;
    events.push({ time: delay, type: 'fire', data: { transition: t.name } });
  }

  while (steps < maxSteps && currentTime < simTime) {
    const enabledNow = getEnabledTransitions();

    if (enabledNow.length === 0) {
      // Deadlock
      break;
    }

    // Select random enabled transition (or use timed semantics)
    const timedTransitions = enabledNow.filter(t => t.rate !== undefined);

    let selected: PetriTransition;
    let delay: number;

    if (timedTransitions.length > 0) {
      // Race between timed transitions
      let minTime = Infinity;
      selected = timedTransitions[0];
      for (const t of timedTransitions) {
        const time = exponential(t.rate!);
        if (time < minTime) {
          minTime = time;
          selected = t;
        }
      }
      delay = minTime;
    } else {
      // Immediate transition - random selection
      selected = enabledNow[Math.floor(Math.random() * enabledNow.length)];
      delay = 0;
    }

    currentTime += delay;
    if (currentTime > simTime) break;

    fire(selected);

    const marking: Record<string, number> = {};
    for (const [name, tokens] of places) {
      marking[name] = tokens;
    }

    firingHistory.push({
      time: currentTime,
      transition: selected.name,
      marking
    });

    steps++;
  }

  // Analyze results
  const transitionCounts = new Map<string, number>();
  for (const event of firingHistory) {
    transitionCounts.set(event.transition, (transitionCounts.get(event.transition) || 0) + 1);
  }

  const finalMarking: Record<string, number> = {};
  for (const [name, tokens] of places) {
    finalMarking[name] = tokens;
  }

  return {
    model: 'Petri Net',
    simulation_results: {
      simulation_time: currentTime,
      total_firings: steps,
      final_marking: finalMarking,
      transition_counts: Object.fromEntries(transitionCounts),
      deadlock_reached: getEnabledTransitions().length === 0,
      firing_history_sample: firingHistory.slice(-20)
    },
    analysis: {
      avg_firings_per_unit_time: steps / currentTime,
      most_fired: [...transitionCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    }
  };
}

// State Machine Simulation
interface State {
  name: string;
  entry_action?: string;
  exit_action?: string;
}

interface Transition {
  from: string;
  to: string;
  event: string;
  guard?: string;
  action?: string;
  probability?: number;
}

interface StateMachine {
  states: State[];
  transitions: Transition[];
  initial: string;
}

function simulateStateMachine(
  machine: StateMachine,
  events: string[],
  maxSteps: number = 1000
): Record<string, unknown> {
  let currentState = machine.initial;
  const stateHistory: { step: number; state: string; event?: string }[] = [];
  const stateDurations = new Map<string, number>();
  const transitionCounts = new Map<string, number>();

  stateHistory.push({ step: 0, state: currentState });

  for (let step = 0; step < Math.min(events.length, maxSteps); step++) {
    const event = events[step];

    // Find applicable transitions
    const applicable = machine.transitions.filter(t =>
      t.from === currentState && t.event === event
    );

    if (applicable.length === 0) {
      // No transition for this event, stay in current state
      continue;
    }

    // Select transition (by probability or random)
    let selected: Transition;
    if (applicable.some(t => t.probability !== undefined)) {
      const r = Math.random();
      let cumProb = 0;
      selected = applicable[applicable.length - 1];
      for (const t of applicable) {
        cumProb += t.probability || 0;
        if (r < cumProb) {
          selected = t;
          break;
        }
      }
    } else {
      selected = applicable[Math.floor(Math.random() * applicable.length)];
    }

    // Execute transition
    const transKey = `${selected.from}->${selected.to}`;
    transitionCounts.set(transKey, (transitionCounts.get(transKey) || 0) + 1);

    stateDurations.set(currentState, (stateDurations.get(currentState) || 0) + 1);
    currentState = selected.to;

    stateHistory.push({ step: step + 1, state: currentState, event });
  }

  // Calculate state probabilities
  const totalDuration = [...stateDurations.values()].reduce((a, b) => a + b, 0) || 1;
  const stateProbabilities: Record<string, number> = {};
  for (const [state, duration] of stateDurations) {
    stateProbabilities[state] = duration / totalDuration;
  }

  return {
    model: 'State Machine',
    simulation_results: {
      initial_state: machine.initial,
      final_state: currentState,
      total_steps: events.length,
      state_durations: Object.fromEntries(stateDurations),
      state_probabilities: stateProbabilities,
      transition_counts: Object.fromEntries(transitionCounts),
      history_sample: stateHistory.slice(-20)
    },
    analysis: {
      most_visited_state: [...stateDurations.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
      most_common_transition: [...transitionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    }
  };
}

// Generate random events for state machine
function generateEvents(
  eventTypes: string[],
  count: number,
  distribution: 'uniform' | 'weighted' = 'uniform',
  weights?: number[]
): string[] {
  const events: string[] = [];

  for (let i = 0; i < count; i++) {
    if (distribution === 'uniform') {
      events.push(eventTypes[Math.floor(Math.random() * eventTypes.length)]);
    } else if (weights) {
      const r = Math.random();
      let cumWeight = 0;
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      for (let j = 0; j < eventTypes.length; j++) {
        cumWeight += weights[j] / totalWeight;
        if (r < cumWeight) {
          events.push(eventTypes[j]);
          break;
        }
      }
    }
  }

  return events;
}

// Example models
function getExampleMM1(): Record<string, unknown> {
  return {
    model: 'mm1',
    arrival_rate: 0.8,
    service_rate: 1.0,
    description: 'Single server queue with 80% utilization'
  };
}

function getExamplePetriNet(): PetriNet {
  return {
    places: [
      { name: 'ready', tokens: 3 },
      { name: 'processing', tokens: 0 },
      { name: 'done', tokens: 0 }
    ],
    transitions: [
      {
        name: 'start',
        inputs: [{ place: 'ready', weight: 1 }],
        outputs: [{ place: 'processing', weight: 1 }],
        rate: 1.0
      },
      {
        name: 'finish',
        inputs: [{ place: 'processing', weight: 1 }],
        outputs: [{ place: 'done', weight: 1 }],
        rate: 0.5
      }
    ]
  };
}

function getExampleStateMachine(): StateMachine {
  return {
    states: [
      { name: 'idle' },
      { name: 'working' },
      { name: 'error' },
      { name: 'recovering' }
    ],
    transitions: [
      { from: 'idle', to: 'working', event: 'start', probability: 1.0 },
      { from: 'working', to: 'idle', event: 'complete', probability: 0.9 },
      { from: 'working', to: 'error', event: 'fail', probability: 0.1 },
      { from: 'error', to: 'recovering', event: 'repair', probability: 1.0 },
      { from: 'recovering', to: 'idle', event: 'ready', probability: 1.0 }
    ],
    initial: 'idle'
  };
}

export async function executediscreteeventsim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'discrete_event_sim',
          description: 'Discrete event simulation for queuing and process modeling',
          operations: {
            simulate: 'Run general discrete event simulation',
            queue_model: 'Simulate queuing systems (M/M/1, M/M/c, etc.)',
            petri_net: 'Simulate Petri net models',
            state_machine: 'Simulate finite state machines',
            analyze: 'Analyze simulation results and compare with theory'
          },
          queuing_models: {
            mm1: 'Single server, Poisson arrivals, exponential service',
            mmc: 'Multiple servers, Poisson arrivals, exponential service',
            mg1: 'Single server, Poisson arrivals, general service',
            gg1: 'Single server, general arrivals, general service'
          },
          features: [
            'Event-driven simulation engine',
            'Priority queue event scheduling',
            'Statistical analysis of results',
            'Comparison with theoretical values',
            'Petri net execution (timed/immediate)',
            'State machine simulation with probabilities'
          ],
          applications: [
            'Performance analysis',
            'Capacity planning',
            'Process optimization',
            'Reliability modeling',
            'Manufacturing systems',
            'Network traffic analysis'
          ],
          examples: {
            mm1_queue: getExampleMM1(),
            petri_net: getExamplePetriNet(),
            state_machine: getExampleStateMachine()
          }
        }, null, 2)
      };
    }

    if (operation === 'queue_model' || operation === 'simulate') {
      const model = args.model || 'mm1';
      const arrivalRate = args.arrival_rate || 0.8;
      const serviceRate = args.service_rate || 1.0;
      const numServers = args.num_servers || 1;
      const simTime = args.simulation_time || 1000;

      let result: Record<string, unknown>;

      switch (model) {
        case 'mm1':
          result = simulateMM1(arrivalRate, serviceRate, simTime);
          break;

        case 'mmc':
          result = simulateMMc(arrivalRate, serviceRate, numServers, simTime);
          break;

        case 'mg1': {
          // M/G/1 with deterministic service
          const events = new EventQueue();
          const waitTimes = new Statistics();
          const fixedServiceTime = 1 / serviceRate;

          let currentTime = 0;
          let queueLength = 0;
          let serverBusy = false;
          let customersServed = 0;
          const customers: Map<number, number> = new Map();
          let nextCustomerId = 0;

          events.push({ time: exponential(arrivalRate), type: 'arrival' });

          while (!events.isEmpty() && currentTime < simTime) {
            const event = events.pop()!;
            currentTime = event.time;

            if (event.type === 'arrival') {
              customers.set(nextCustomerId++, currentTime);

              if (!serverBusy) {
                serverBusy = true;
                events.push({
                  time: currentTime + fixedServiceTime,
                  type: 'departure',
                  data: { customerId: nextCustomerId - 1 }
                });
                waitTimes.record(0);
              } else {
                queueLength++;
              }

              events.push({ time: currentTime + exponential(arrivalRate), type: 'arrival' });
            } else {
              const customerId = event.data?.customerId as number;
              customers.delete(customerId);
              customersServed++;

              if (queueLength > 0) {
                queueLength--;
                let oldestId = -1;
                let oldestTime = Infinity;
                for (const [cid, arrTime] of customers) {
                  if (arrTime < oldestTime) {
                    oldestTime = arrTime;
                    oldestId = cid;
                  }
                }
                if (oldestId >= 0) {
                  waitTimes.record(currentTime - oldestTime);
                  events.push({
                    time: currentTime + fixedServiceTime,
                    type: 'departure',
                    data: { customerId: oldestId }
                  });
                }
              } else {
                serverBusy = false;
              }
            }
          }

          const rho = arrivalRate / serviceRate;
          // Pollaczek-Khinchine formula for M/G/1 with deterministic service (variance = 0)
          const theoreticalWq = rho / (2 * serviceRate * (1 - rho));

          result = {
            model: 'M/G/1 (Deterministic Service)',
            parameters: {
              arrival_rate: arrivalRate,
              service_rate: serviceRate,
              service_time: fixedServiceTime,
              utilization: rho
            },
            simulation_results: {
              customers_served: customersServed,
              wait_time_stats: waitTimes.getSummary()
            },
            theoretical_values: {
              avg_wait_time: theoreticalWq
            }
          };
          break;
        }

        default:
          result = simulateMM1(arrivalRate, serviceRate, simTime);
      }

      return {
        toolCallId: id,
        content: JSON.stringify(result, null, 2)
      };
    }

    if (operation === 'petri_net') {
      let net: PetriNet;

      if (args.petri_net) {
        net = args.petri_net as PetriNet;
      } else if (args.preset === 'producer_consumer') {
        net = {
          places: [
            { name: 'empty', tokens: 5 },
            { name: 'full', tokens: 0 },
            { name: 'producer_ready', tokens: 1 },
            { name: 'consumer_ready', tokens: 1 }
          ],
          transitions: [
            {
              name: 'produce',
              inputs: [
                { place: 'empty', weight: 1 },
                { place: 'producer_ready', weight: 1 }
              ],
              outputs: [
                { place: 'full', weight: 1 },
                { place: 'producer_ready', weight: 1 }
              ],
              rate: 2.0
            },
            {
              name: 'consume',
              inputs: [
                { place: 'full', weight: 1 },
                { place: 'consumer_ready', weight: 1 }
              ],
              outputs: [
                { place: 'empty', weight: 1 },
                { place: 'consumer_ready', weight: 1 }
              ],
              rate: 1.5
            }
          ]
        };
      } else if (args.preset === 'mutex') {
        net = {
          places: [
            { name: 'p1_ready', tokens: 1 },
            { name: 'p1_critical', tokens: 0 },
            { name: 'p2_ready', tokens: 1 },
            { name: 'p2_critical', tokens: 0 },
            { name: 'mutex', tokens: 1 }
          ],
          transitions: [
            {
              name: 'p1_enter',
              inputs: [{ place: 'p1_ready', weight: 1 }, { place: 'mutex', weight: 1 }],
              outputs: [{ place: 'p1_critical', weight: 1 }],
              rate: 1.0
            },
            {
              name: 'p1_exit',
              inputs: [{ place: 'p1_critical', weight: 1 }],
              outputs: [{ place: 'p1_ready', weight: 1 }, { place: 'mutex', weight: 1 }],
              rate: 2.0
            },
            {
              name: 'p2_enter',
              inputs: [{ place: 'p2_ready', weight: 1 }, { place: 'mutex', weight: 1 }],
              outputs: [{ place: 'p2_critical', weight: 1 }],
              rate: 1.0
            },
            {
              name: 'p2_exit',
              inputs: [{ place: 'p2_critical', weight: 1 }],
              outputs: [{ place: 'p2_ready', weight: 1 }, { place: 'mutex', weight: 1 }],
              rate: 2.0
            }
          ]
        };
      } else {
        net = getExamplePetriNet();
      }

      const simTime = args.simulation_time || 100;
      const maxSteps = args.max_steps || 10000;

      const result = simulatePetriNet(net, simTime, maxSteps);

      return {
        toolCallId: id,
        content: JSON.stringify({
          input_model: net,
          ...result
        }, null, 2)
      };
    }

    if (operation === 'state_machine') {
      let machine: StateMachine;

      if (args.state_machine) {
        machine = args.state_machine as StateMachine;
      } else if (args.preset === 'traffic_light') {
        machine = {
          states: [
            { name: 'green' },
            { name: 'yellow' },
            { name: 'red' }
          ],
          transitions: [
            { from: 'green', to: 'yellow', event: 'timer' },
            { from: 'yellow', to: 'red', event: 'timer' },
            { from: 'red', to: 'green', event: 'timer' }
          ],
          initial: 'green'
        };
      } else if (args.preset === 'connection') {
        machine = {
          states: [
            { name: 'disconnected' },
            { name: 'connecting' },
            { name: 'connected' },
            { name: 'error' }
          ],
          transitions: [
            { from: 'disconnected', to: 'connecting', event: 'connect' },
            { from: 'connecting', to: 'connected', event: 'success', probability: 0.9 },
            { from: 'connecting', to: 'error', event: 'fail', probability: 0.1 },
            { from: 'connected', to: 'disconnected', event: 'disconnect' },
            { from: 'connected', to: 'error', event: 'fail' },
            { from: 'error', to: 'disconnected', event: 'reset' }
          ],
          initial: 'disconnected'
        };
      } else {
        machine = getExampleStateMachine();
      }

      // Generate events
      let events: string[];
      if (args.events) {
        events = args.events;
      } else {
        const eventTypes = [...new Set(machine.transitions.map(t => t.event))];
        const numEvents = args.num_events || 500;
        events = generateEvents(eventTypes, numEvents);
      }

      const result = simulateStateMachine(machine, events);

      return {
        toolCallId: id,
        content: JSON.stringify({
          input_model: machine,
          events_processed: events.length,
          ...result
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      // Run comparative analysis
      const arrivalRate = args.arrival_rate || 0.8;
      const serviceRate = args.service_rate || 1.0;

      const results = {
        model_comparison: {
          mm1: simulateMM1(arrivalRate, serviceRate, 5000),
          mm2: simulateMMc(arrivalRate, serviceRate, 2, 5000),
          mm4: simulateMMc(arrivalRate, serviceRate, 4, 5000)
        },
        analysis: {
          description: 'Comparison of wait times across different server configurations',
          conclusions: [] as string[]
        }
      };

      const mm1Wait = (results.model_comparison.mm1.simulation_results as Record<string, unknown>).wait_time_stats as Record<string, number>;
      const mm2Wait = (results.model_comparison.mm2.simulation_results as Record<string, unknown>).wait_time_stats as Record<string, number>;
      const mm4Wait = (results.model_comparison.mm4.simulation_results as Record<string, unknown>).wait_time_stats as Record<string, number>;

      if (mm1Wait.mean > mm2Wait.mean) {
        results.analysis.conclusions.push(
          `Adding second server reduces mean wait time by ${((1 - mm2Wait.mean / mm1Wait.mean) * 100).toFixed(1)}%`
        );
      }

      if (mm2Wait.mean > mm4Wait.mean) {
        results.analysis.conclusions.push(
          `Four servers vs two reduces mean wait time by ${((1 - mm4Wait.mean / mm2Wait.mean) * 100).toFixed(1)}%`
        );
      }

      results.analysis.conclusions.push(
        `At ${(arrivalRate / serviceRate * 100).toFixed(0)}% utilization, 99th percentile wait times: ` +
        `M/M/1=${mm1Wait.p99.toFixed(2)}, M/M/2=${mm2Wait.p99.toFixed(2)}, M/M/4=${mm4Wait.p99.toFixed(2)}`
      );

      return {
        toolCallId: id,
        content: JSON.stringify(results, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: `Unknown operation: ${operation}`,
        available_operations: ['simulate', 'queue_model', 'petri_net', 'state_machine', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdiscreteeventsimAvailable(): boolean {
  return true;
}
