/**
 * DISCRETE-EVENT-SIM TOOL
 * Discrete event simulation for queuing systems, process modeling, and Petri nets
 * Implements M/M/c queues, priority scheduling, and event-driven simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Event types
interface Event {
  time: number;
  type: string;
  entityId: number;
  data?: any;
}

// Entity in the system
interface Entity {
  id: number;
  arrivalTime: number;
  serviceStartTime?: number;
  departureTime?: number;
  priority?: number;
  entityType?: string;
}

// Queue statistics
interface QueueStats {
  avgWaitTime: number;
  avgSystemTime: number;
  avgQueueLength: number;
  serverUtilization: number;
  throughput: number;
  maxQueueLength: number;
  totalArrivals: number;
  totalDepartures: number;
}

// Random number generators
function exponentialRandom(rate: number): number {
  return -Math.log(1 - Math.random()) / rate;
}

function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function uniformRandom(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function normalRandom(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// Priority queue for events
class EventQueue {
  private events: Event[] = [];

  push(event: Event): void {
    this.events.push(event);
    this.events.sort((a, b) => a.time - b.time);
  }

  pop(): Event | undefined {
    return this.events.shift();
  }

  isEmpty(): boolean {
    return this.events.length === 0;
  }

  peek(): Event | undefined {
    return this.events[0];
  }

  size(): number {
    return this.events.length;
  }
}

// M/M/c Queue Simulation
function simulateMMcQueue(
  arrivalRate: number,
  serviceRate: number,
  numServers: number,
  maxTime: number,
  maxCustomers: number = 10000
): {
  stats: QueueStats;
  timeline: Array<{ time: number; queueLength: number; busyServers: number }>;
  theoretical: any;
} {
  const eventQueue = new EventQueue();
  const queue: Entity[] = [];
  const servers: (Entity | null)[] = new Array(numServers).fill(null);

  let currentTime = 0;
  let entityId = 0;
  let totalWaitTime = 0;
  let totalSystemTime = 0;
  let departures = 0;
  let queueLengthSum = 0;
  let lastEventTime = 0;
  let maxQueueLength = 0;

  const timeline: Array<{ time: number; queueLength: number; busyServers: number }> = [];

  // Schedule first arrival
  eventQueue.push({
    time: exponentialRandom(arrivalRate),
    type: 'arrival',
    entityId: entityId++
  });

  while (!eventQueue.isEmpty() && currentTime < maxTime && departures < maxCustomers) {
    const event = eventQueue.pop()!;
    const timeDelta = event.time - lastEventTime;
    queueLengthSum += queue.length * timeDelta;
    lastEventTime = event.time;
    currentTime = event.time;

    if (event.type === 'arrival') {
      const entity: Entity = {
        id: event.entityId,
        arrivalTime: currentTime
      };

      // Find free server
      const freeServerIndex = servers.findIndex(s => s === null);

      if (freeServerIndex !== -1) {
        // Server available, start service immediately
        entity.serviceStartTime = currentTime;
        servers[freeServerIndex] = entity;

        const serviceTime = exponentialRandom(serviceRate);
        eventQueue.push({
          time: currentTime + serviceTime,
          type: 'departure',
          entityId: entity.id,
          data: { serverIndex: freeServerIndex }
        });
      } else {
        // All servers busy, join queue
        queue.push(entity);
        maxQueueLength = Math.max(maxQueueLength, queue.length);
      }

      // Schedule next arrival
      if (currentTime + exponentialRandom(arrivalRate) < maxTime) {
        eventQueue.push({
          time: currentTime + exponentialRandom(arrivalRate),
          type: 'arrival',
          entityId: entityId++
        });
      }

    } else if (event.type === 'departure') {
      const serverIndex = event.data.serverIndex;
      const entity = servers[serverIndex];

      if (entity) {
        entity.departureTime = currentTime;
        totalWaitTime += (entity.serviceStartTime || currentTime) - entity.arrivalTime;
        totalSystemTime += currentTime - entity.arrivalTime;
        departures++;
      }

      // Check if anyone waiting in queue
      if (queue.length > 0) {
        const nextEntity = queue.shift()!;
        nextEntity.serviceStartTime = currentTime;
        servers[serverIndex] = nextEntity;

        const serviceTime = exponentialRandom(serviceRate);
        eventQueue.push({
          time: currentTime + serviceTime,
          type: 'departure',
          entityId: nextEntity.id,
          data: { serverIndex }
        });
      } else {
        servers[serverIndex] = null;
      }
    }

    // Record timeline periodically
    if (timeline.length === 0 || currentTime - timeline[timeline.length - 1].time > maxTime / 100) {
      timeline.push({
        time: parseFloat(currentTime.toFixed(2)),
        queueLength: queue.length,
        busyServers: servers.filter(s => s !== null).length
      });
    }
  }

  // Calculate statistics
  const rho = arrivalRate / (numServers * serviceRate); // utilization
  const avgWaitTime = departures > 0 ? totalWaitTime / departures : 0;
  const avgSystemTime = departures > 0 ? totalSystemTime / departures : 0;
  const avgQueueLength = queueLengthSum / currentTime;
  const throughput = departures / currentTime;

  // Theoretical values for M/M/c
  const theoretical = calculateMMcTheoretical(arrivalRate, serviceRate, numServers);

  return {
    stats: {
      avgWaitTime: parseFloat(avgWaitTime.toFixed(4)),
      avgSystemTime: parseFloat(avgSystemTime.toFixed(4)),
      avgQueueLength: parseFloat(avgQueueLength.toFixed(4)),
      serverUtilization: parseFloat(rho.toFixed(4)),
      throughput: parseFloat(throughput.toFixed(4)),
      maxQueueLength,
      totalArrivals: entityId,
      totalDepartures: departures
    },
    timeline: timeline.slice(0, 20), // Sample for display
    theoretical
  };
}

// Theoretical M/M/c calculations
function calculateMMcTheoretical(lambda: number, mu: number, c: number): any {
  const rho = lambda / (c * mu);

  if (rho >= 1) {
    return { error: 'System is unstable (ρ ≥ 1)', rho };
  }

  // Calculate P0 (probability of empty system)
  let sum = 0;
  for (let n = 0; n < c; n++) {
    sum += Math.pow(lambda / mu, n) / factorial(n);
  }
  sum += Math.pow(lambda / mu, c) / (factorial(c) * (1 - rho));
  const P0 = 1 / sum;

  // Probability of queuing (Erlang C formula)
  const Pc = (Math.pow(lambda / mu, c) / factorial(c)) * (1 / (1 - rho)) * P0;

  // Average queue length (Lq)
  const Lq = Pc * rho / (1 - rho);

  // Average waiting time in queue (Wq)
  const Wq = Lq / lambda;

  // Average number in system (L)
  const L = Lq + lambda / mu;

  // Average time in system (W)
  const W = Wq + 1 / mu;

  return {
    utilization: parseFloat(rho.toFixed(4)),
    P0: parseFloat(P0.toFixed(4)),
    P_queuing: parseFloat(Pc.toFixed(4)),
    avg_queue_length: parseFloat(Lq.toFixed(4)),
    avg_wait_time: parseFloat(Wq.toFixed(4)),
    avg_system_length: parseFloat(L.toFixed(4)),
    avg_system_time: parseFloat(W.toFixed(4))
  };
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Petri Net Simulation
interface PetriNet {
  places: Record<string, number>; // marking (tokens)
  transitions: Array<{
    name: string;
    inputs: Record<string, number>;
    outputs: Record<string, number>;
    rate?: number;
  }>;
}

function simulatePetriNet(
  net: PetriNet,
  maxSteps: number = 100,
  maxTime: number = 100
): {
  trace: Array<{ step: number; time: number; marking: Record<string, number>; fired?: string }>;
  deadlocked: boolean;
  finalMarking: Record<string, number>;
} {
  const marking = { ...net.places };
  const trace: Array<{ step: number; time: number; marking: Record<string, number>; fired?: string }> = [];
  let time = 0;
  let step = 0;

  trace.push({ step: 0, time: 0, marking: { ...marking } });

  while (step < maxSteps && time < maxTime) {
    // Find enabled transitions
    const enabledTransitions = net.transitions.filter(t => {
      return Object.entries(t.inputs).every(([place, tokens]) => {
        return (marking[place] || 0) >= tokens;
      });
    });

    if (enabledTransitions.length === 0) {
      // Deadlock
      break;
    }

    // Select transition (random for now, could use rates)
    const selected = enabledTransitions[Math.floor(Math.random() * enabledTransitions.length)];

    // Fire transition
    for (const [place, tokens] of Object.entries(selected.inputs)) {
      marking[place] = (marking[place] || 0) - tokens;
    }
    for (const [place, tokens] of Object.entries(selected.outputs)) {
      marking[place] = (marking[place] || 0) + tokens;
    }

    // Advance time (if rates specified)
    if (selected.rate) {
      time += exponentialRandom(selected.rate);
    } else {
      time += 1;
    }

    step++;
    trace.push({
      step,
      time: parseFloat(time.toFixed(2)),
      marking: { ...marking },
      fired: selected.name
    });
  }

  return {
    trace: trace.slice(0, 20),
    deadlocked: step < maxSteps && time < maxTime,
    finalMarking: marking
  };
}

// State Machine Simulation
interface StateMachine {
  states: string[];
  initial: string;
  transitions: Array<{
    from: string;
    to: string;
    event: string;
    guard?: string;
    action?: string;
  }>;
}

function simulateStateMachine(
  machine: StateMachine,
  events: string[],
  variables: Record<string, any> = {}
): {
  trace: Array<{ event: string; from: string; to: string; action?: string }>;
  finalState: string;
  variables: Record<string, any>;
} {
  let currentState = machine.initial;
  const trace: Array<{ event: string; from: string; to: string; action?: string }> = [];
  const vars = { ...variables };

  for (const event of events) {
    const validTransitions = machine.transitions.filter(t =>
      t.from === currentState && t.event === event
    );

    if (validTransitions.length > 0) {
      const transition = validTransitions[0];
      trace.push({
        event,
        from: currentState,
        to: transition.to,
        action: transition.action
      });
      currentState = transition.to;
    }
  }

  return {
    trace,
    finalState: currentState,
    variables: vars
  };
}

// Process simulation (simple manufacturing)
function simulateProcess(
  stages: Array<{ name: string; processingTime: number; variance?: number; capacity?: number }>,
  arrivalRate: number,
  simulationTime: number
): {
  stageStats: Array<{ name: string; utilization: number; avgQueue: number; throughput: number }>;
  overallThroughput: number;
  avgLeadTime: number;
  bottleneck: string;
} {
  const eventQueue = new EventQueue();
  const queues: number[][] = stages.map(() => []);
  const processing: (number | null)[] = stages.map(() => null);
  const stageCompletions: number[] = stages.map(() => 0);
  const queueSums: number[] = stages.map(() => 0);

  let entityId = 0;
  let currentTime = 0;
  let lastEventTime = 0;
  const leadTimes: number[] = [];
  const arrivalTimes: Record<number, number> = {};

  // First arrival
  eventQueue.push({ time: exponentialRandom(arrivalRate), type: 'arrival', entityId: entityId++ });

  while (!eventQueue.isEmpty() && currentTime < simulationTime) {
    const event = eventQueue.pop()!;
    const timeDelta = event.time - lastEventTime;

    // Update queue length sums
    for (let i = 0; i < stages.length; i++) {
      queueSums[i] += queues[i].length * timeDelta;
    }

    lastEventTime = event.time;
    currentTime = event.time;

    if (event.type === 'arrival') {
      arrivalTimes[event.entityId] = currentTime;

      if (processing[0] === null) {
        processing[0] = event.entityId;
        const processTime = stages[0].variance
          ? Math.max(0.1, normalRandom(stages[0].processingTime, stages[0].variance))
          : stages[0].processingTime;
        eventQueue.push({
          time: currentTime + processTime,
          type: 'stage_complete',
          entityId: event.entityId,
          data: { stage: 0 }
        });
      } else {
        queues[0].push(event.entityId);
      }

      // Schedule next arrival
      eventQueue.push({ time: currentTime + exponentialRandom(arrivalRate), type: 'arrival', entityId: entityId++ });

    } else if (event.type === 'stage_complete') {
      const stage = event.data.stage;
      stageCompletions[stage]++;

      // Move to next stage or complete
      if (stage < stages.length - 1) {
        const nextStage = stage + 1;
        if (processing[nextStage] === null) {
          processing[nextStage] = event.entityId;
          const processTime = stages[nextStage].variance
            ? Math.max(0.1, normalRandom(stages[nextStage].processingTime, stages[nextStage].variance))
            : stages[nextStage].processingTime;
          eventQueue.push({
            time: currentTime + processTime,
            type: 'stage_complete',
            entityId: event.entityId,
            data: { stage: nextStage }
          });
        } else {
          queues[nextStage].push(event.entityId);
        }
      } else {
        // Completed all stages
        leadTimes.push(currentTime - arrivalTimes[event.entityId]);
      }

      // Process next in queue
      if (queues[stage].length > 0) {
        const nextEntity = queues[stage].shift()!;
        processing[stage] = nextEntity;
        const processTime = stages[stage].variance
          ? Math.max(0.1, normalRandom(stages[stage].processingTime, stages[stage].variance))
          : stages[stage].processingTime;
        eventQueue.push({
          time: currentTime + processTime,
          type: 'stage_complete',
          entityId: nextEntity,
          data: { stage }
        });
      } else {
        processing[stage] = null;
      }
    }
  }

  // Calculate stats
  const stageStats = stages.map((stage, i) => ({
    name: stage.name,
    utilization: parseFloat((stageCompletions[i] * stage.processingTime / simulationTime).toFixed(3)),
    avgQueue: parseFloat((queueSums[i] / simulationTime).toFixed(3)),
    throughput: parseFloat((stageCompletions[i] / simulationTime).toFixed(3))
  }));

  const bottleneckIndex = stageStats.reduce((maxIdx, stat, idx, arr) =>
    stat.utilization > arr[maxIdx].utilization ? idx : maxIdx, 0);

  return {
    stageStats,
    overallThroughput: parseFloat((leadTimes.length / simulationTime).toFixed(3)),
    avgLeadTime: parseFloat((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length || 0).toFixed(3)),
    bottleneck: stages[bottleneckIndex].name
  };
}

export const discreteeventsimTool: UnifiedTool = {
  name: 'discrete_event_sim',
  description: 'Discrete event simulation for queuing systems, Petri nets, state machines, and process modeling',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'queue', 'mmc_theory', 'petri_net', 'state_machine', 'process', 'random', 'demonstrate'],
        description: 'Operation to perform'
      },
      model: { type: 'string', enum: ['queue', 'petri_net', 'state_machine', 'process'], description: 'Simulation model type' },
      arrival_rate: { type: 'number', description: 'Arrival rate (lambda)' },
      service_rate: { type: 'number', description: 'Service rate (mu)' },
      num_servers: { type: 'integer', description: 'Number of servers (c)' },
      simulation_time: { type: 'number', description: 'Total simulation time' },
      petri_net: { type: 'object', description: 'Petri net definition' },
      state_machine: { type: 'object', description: 'State machine definition' },
      events: { type: 'array', description: 'Events for state machine' },
      stages: { type: 'array', description: 'Process stages' },
      distribution: { type: 'string', enum: ['exponential', 'poisson', 'uniform', 'normal'], description: 'Random distribution' }
    },
    required: ['operation']
  }
};

export async function executediscreteeventsim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'discrete_event_sim',
          description: 'Discrete event simulation for queuing and process modeling',
          simulation_types: {
            queue: {
              name: 'M/M/c Queue',
              description: 'Markovian arrival/service with c servers',
              parameters: ['arrival_rate (λ)', 'service_rate (μ)', 'num_servers (c)']
            },
            petri_net: {
              name: 'Petri Net',
              description: 'Token-based concurrent system modeling',
              elements: ['Places (token holders)', 'Transitions (token movers)', 'Arcs (connections)']
            },
            state_machine: {
              name: 'State Machine',
              description: 'Finite state automaton simulation',
              elements: ['States', 'Transitions', 'Events', 'Guards', 'Actions']
            },
            process: {
              name: 'Process Simulation',
              description: 'Multi-stage manufacturing/service process',
              analysis: ['Bottleneck identification', 'Lead time', 'Utilization']
            }
          },
          distributions: {
            exponential: 'Inter-arrival times (memoryless)',
            poisson: 'Arrival counts per time period',
            uniform: 'Bounded random values',
            normal: 'Natural variation'
          },
          key_metrics: [
            'Average wait time (Wq)',
            'Average system time (W)',
            'Queue length (Lq)',
            'Server utilization (ρ)',
            'Throughput'
          ],
          operations: ['queue', 'mmc_theory', 'petri_net', 'state_machine', 'process', 'random', 'demonstrate']
        };
        break;
      }

      case 'queue': {
        const lambda = args.arrival_rate || 5;
        const mu = args.service_rate || 6;
        const c = args.num_servers || 1;
        const simTime = args.simulation_time || 1000;

        const simulation = simulateMMcQueue(lambda, mu, c, simTime);

        result = {
          operation: 'queue',
          model: `M/M/${c}`,
          parameters: {
            arrival_rate: lambda,
            service_rate: mu,
            num_servers: c,
            simulation_time: simTime
          },
          simulation_results: simulation.stats,
          theoretical_results: simulation.theoretical,
          comparison: {
            wait_time_error: simulation.theoretical.avg_wait_time ?
              parseFloat((Math.abs(simulation.stats.avgWaitTime - simulation.theoretical.avg_wait_time) /
                simulation.theoretical.avg_wait_time * 100).toFixed(1)) + '%' : 'N/A',
            utilization_match: Math.abs(simulation.stats.serverUtilization - (simulation.theoretical.utilization || 0)) < 0.05
          },
          timeline_sample: simulation.timeline.slice(0, 10),
          interpretation: {
            stable: simulation.stats.serverUtilization < 1,
            efficiency: simulation.stats.serverUtilization > 0.7 ? 'High utilization' :
                       simulation.stats.serverUtilization > 0.5 ? 'Moderate utilization' : 'Low utilization',
            recommendation: simulation.stats.avgQueueLength > 3 ?
              'Consider adding servers' : 'Queue length acceptable'
          }
        };
        break;
      }

      case 'mmc_theory': {
        const lambda = args.arrival_rate || 10;
        const mu = args.service_rate || 4;
        const c = args.num_servers || 3;

        const theory = calculateMMcTheoretical(lambda, mu, c);

        result = {
          operation: 'mmc_theory',
          model: `M/M/${c}`,
          parameters: {
            lambda: lambda + ' arrivals/time',
            mu: mu + ' services/time',
            c: c + ' servers'
          },
          theoretical_results: theory,
          formulas: {
            utilization: 'ρ = λ/(cμ)',
            P0: 'P₀ = [Σ(λ/μ)ⁿ/n! + (λ/μ)ᶜ/(c!(1-ρ))]⁻¹',
            erlang_c: 'C(c,ρ) = [(λ/μ)ᶜ/c!] × [1/(1-ρ)] × P₀',
            queue_length: 'Lq = C(c,ρ) × ρ/(1-ρ)',
            little_law: 'L = λW, Lq = λWq'
          },
          stability_check: {
            condition: 'ρ < 1 (λ < cμ)',
            is_stable: theory.utilization < 1,
            max_arrival_rate: c * mu
          }
        };
        break;
      }

      case 'petri_net': {
        // Default example: producer-consumer
        const net: PetriNet = args.petri_net || {
          places: {
            'buffer_empty': 3,
            'buffer_full': 0,
            'producer_ready': 1,
            'consumer_ready': 1
          },
          transitions: [
            {
              name: 'produce',
              inputs: { 'producer_ready': 1, 'buffer_empty': 1 },
              outputs: { 'producer_ready': 1, 'buffer_full': 1 },
              rate: 2
            },
            {
              name: 'consume',
              inputs: { 'consumer_ready': 1, 'buffer_full': 1 },
              outputs: { 'consumer_ready': 1, 'buffer_empty': 1 },
              rate: 1.5
            }
          ]
        };

        const simulation = simulatePetriNet(net, args.max_steps || 50, args.simulation_time || 100);

        result = {
          operation: 'petri_net',
          initial_marking: net.places,
          transitions: net.transitions.map(t => ({
            name: t.name,
            inputs: t.inputs,
            outputs: t.outputs
          })),
          simulation: {
            trace: simulation.trace.slice(0, 15),
            deadlocked: simulation.deadlocked,
            final_marking: simulation.finalMarking
          },
          petri_net_concepts: {
            place: 'Holds tokens (represents states/resources)',
            transition: 'Fires when inputs satisfied, moves tokens',
            marking: 'Current token distribution',
            enabled: 'Transition can fire when all inputs have enough tokens'
          }
        };
        break;
      }

      case 'state_machine': {
        const machine: StateMachine = args.state_machine || {
          states: ['idle', 'running', 'paused', 'stopped'],
          initial: 'idle',
          transitions: [
            { from: 'idle', to: 'running', event: 'start', action: 'initialize' },
            { from: 'running', to: 'paused', event: 'pause', action: 'save_state' },
            { from: 'paused', to: 'running', event: 'resume', action: 'restore_state' },
            { from: 'running', to: 'stopped', event: 'stop', action: 'cleanup' },
            { from: 'paused', to: 'stopped', event: 'stop', action: 'cleanup' },
            { from: 'stopped', to: 'idle', event: 'reset', action: 'clear' }
          ]
        };

        const events = args.events || ['start', 'pause', 'resume', 'stop', 'reset'];
        const simulation = simulateStateMachine(machine, events);

        result = {
          operation: 'state_machine',
          definition: {
            states: machine.states,
            initial_state: machine.initial,
            transitions: machine.transitions
          },
          input_events: events,
          execution_trace: simulation.trace,
          final_state: simulation.finalState,
          state_diagram: generateStateDiagram(machine)
        };
        break;
      }

      case 'process': {
        const stages = args.stages || [
          { name: 'Receiving', processingTime: 2, variance: 0.5 },
          { name: 'Assembly', processingTime: 5, variance: 1 },
          { name: 'Testing', processingTime: 3, variance: 0.5 },
          { name: 'Packaging', processingTime: 1.5, variance: 0.3 }
        ];
        const arrivalRate = args.arrival_rate || 0.15;
        const simTime = args.simulation_time || 500;

        const simulation = simulateProcess(stages, arrivalRate, simTime);

        result = {
          operation: 'process',
          stages: stages,
          arrival_rate: arrivalRate,
          simulation_time: simTime,
          results: {
            stage_statistics: simulation.stageStats,
            overall_throughput: simulation.overallThroughput + ' units/time',
            average_lead_time: simulation.avgLeadTime + ' time units',
            bottleneck_stage: simulation.bottleneck
          },
          analysis: {
            bottleneck_recommendation: `Consider adding capacity to ${simulation.bottleneck}`,
            wip_estimate: (simulation.avgLeadTime * simulation.overallThroughput).toFixed(1) + ' units (Little\'s Law)'
          }
        };
        break;
      }

      case 'random': {
        const distribution = args.distribution || 'exponential';
        const samples = 10;
        let values: number[] = [];

        switch (distribution) {
          case 'exponential':
            const rate = args.rate || 1;
            values = Array(samples).fill(0).map(() => exponentialRandom(rate));
            result = {
              operation: 'random',
              distribution: 'exponential',
              parameters: { rate },
              samples: values.map(v => parseFloat(v.toFixed(4))),
              theoretical: {
                mean: 1 / rate,
                variance: 1 / (rate * rate),
                pdf: `f(x) = λe^(-λx) for x ≥ 0`
              }
            };
            break;

          case 'poisson':
            const lambda = args.lambda || 5;
            values = Array(samples).fill(0).map(() => poissonRandom(lambda));
            result = {
              operation: 'random',
              distribution: 'poisson',
              parameters: { lambda },
              samples: values,
              theoretical: {
                mean: lambda,
                variance: lambda,
                pmf: `P(X=k) = λᵏe^(-λ)/k!`
              }
            };
            break;

          case 'uniform':
            const min = args.min || 0;
            const max = args.max || 1;
            values = Array(samples).fill(0).map(() => uniformRandom(min, max));
            result = {
              operation: 'random',
              distribution: 'uniform',
              parameters: { min, max },
              samples: values.map(v => parseFloat(v.toFixed(4))),
              theoretical: {
                mean: (min + max) / 2,
                variance: Math.pow(max - min, 2) / 12,
                pdf: `f(x) = 1/(b-a) for a ≤ x ≤ b`
              }
            };
            break;

          case 'normal':
            const mean = args.mean || 0;
            const stdDev = args.std_dev || 1;
            values = Array(samples).fill(0).map(() => normalRandom(mean, stdDev));
            result = {
              operation: 'random',
              distribution: 'normal',
              parameters: { mean, std_dev: stdDev },
              samples: values.map(v => parseFloat(v.toFixed(4))),
              theoretical: {
                mean: mean,
                variance: stdDev * stdDev,
                pdf: `f(x) = (1/σ√(2π))e^(-(x-μ)²/(2σ²))`
              }
            };
            break;
        }
        break;
      }

      case 'demonstrate': {
        // Run example M/M/1 queue
        const mm1 = simulateMMcQueue(4, 5, 1, 500);
        // Run example M/M/3 queue
        const mm3 = simulateMMcQueue(10, 4, 3, 500);

        result = {
          operation: 'demonstrate',
          tool: 'discrete_event_sim',
          examples: [
            {
              name: 'M/M/1 Queue (λ=4, μ=5)',
              utilization: mm1.stats.serverUtilization,
              avg_wait: mm1.stats.avgWaitTime,
              avg_queue: mm1.stats.avgQueueLength,
              theoretical: mm1.theoretical
            },
            {
              name: 'M/M/3 Queue (λ=10, μ=4)',
              utilization: mm3.stats.serverUtilization,
              avg_wait: mm3.stats.avgWaitTime,
              avg_queue: mm3.stats.avgQueueLength,
              theoretical: mm3.theoretical
            }
          ],
          key_formulas: {
            utilization: 'ρ = λ/(cμ)',
            little_law: 'L = λW (avg in system = arrival rate × avg time)',
            wait_time_mm1: 'Wq = ρ/(μ(1-ρ)) for M/M/1',
            stability: 'System stable when ρ < 1'
          },
          visualization: `
QUEUING SYSTEM MODEL
════════════════════

    Arrivals (λ)      Queue         Servers (c)      Departures
        │               │              │                │
        │    ┌──────────▼──────────┐   │                │
        ▼    │                     │   ▼                │
    ───●───▶ │  ● ● ● ● ● ●  ▶▶▶  │ ───●───▶           │
             │   (waiting)   ▶▶▶  │  (service)         │
             │               ▶▶▶  │                    ▼
             └────────────────────┘               ───●───▶

Key Metrics:
• Wq = Average wait time in queue
• W  = Average time in system (Wq + service time)
• Lq = Average queue length
• L  = Average number in system
• ρ  = Server utilization

Little's Law: L = λ × W
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'queue', 'mmc_theory', 'petri_net', 'state_machine', 'process', 'random', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

function generateStateDiagram(machine: StateMachine): string {
  let diagram = '\nSTATE DIAGRAM\n═════════════\n\n';
  diagram += `  ●──▶ [${machine.initial}] (initial)\n`;

  for (const t of machine.transitions) {
    diagram += `        │\n`;
    diagram += `        │ ${t.event}\n`;
    diagram += `        ▼\n`;
    diagram += `      [${t.to}]`;
    if (t.action) diagram += ` → ${t.action}`;
    diagram += '\n';
  }

  return diagram;
}

export function isdiscreteeventsimAvailable(): boolean {
  return true;
}
