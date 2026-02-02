/**
 * TRAFFIC-SIMULATION TOOL
 * Traffic flow simulation with cellular automata, car-following models,
 * and fundamental diagram analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const trafficsimulationTool: UnifiedTool = {
  name: 'traffic_simulation',
  description: 'Traffic flow simulation and modeling (cellular automata, car-following, fundamental diagrams)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'simulate', 'cellular', 'car_following', 'fundamental_diagram', 'bottleneck', 'intersection', 'demonstrate'],
        description: 'Operation to perform'
      },
      model: { type: 'string', description: 'Model type: nagel_schreckenberg, idm, krauss, optimal_velocity' },
      road_length: { type: 'number', description: 'Road length in cells or meters' },
      vehicle_count: { type: 'number', description: 'Number of vehicles' },
      time_steps: { type: 'number', description: 'Simulation duration' },
      parameters: { type: 'object', description: 'Model-specific parameters' }
    },
    required: ['operation']
  }
};

// ===== NAGEL-SCHRECKENBERG CELLULAR AUTOMATON =====

interface NSVehicle {
  position: number;
  velocity: number;
}

function nagelSchreckenberg(
  roadLength: number,
  vehicleCount: number,
  maxVelocity: number,
  slowdownProb: number,
  timeSteps: number
): {
  history: number[][];
  finalVehicles: NSVehicle[];
  avgSpeed: number;
  flow: number;
  density: number;
} {
  // Initialize vehicles
  const vehicles: NSVehicle[] = [];
  const usedPositions = new Set<number>();

  for (let i = 0; i < vehicleCount; i++) {
    let pos: number;
    do {
      pos = Math.floor(Math.random() * roadLength);
    } while (usedPositions.has(pos));

    usedPositions.add(pos);
    vehicles.push({
      position: pos,
      velocity: Math.floor(Math.random() * (maxVelocity + 1))
    });
  }

  vehicles.sort((a, b) => a.position - b.position);

  const history: number[][] = [];

  for (let t = 0; t < timeSteps; t++) {
    // Record current state
    const state = new Array(roadLength).fill(0);
    for (const v of vehicles) {
      state[v.position] = v.velocity + 1; // +1 to distinguish from empty
    }
    history.push(state);

    // Update rules (in order)
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const nextVehicle = vehicles[(i + 1) % vehicles.length];

      // Calculate gap to next vehicle
      let gap: number;
      if (nextVehicle.position > v.position) {
        gap = nextVehicle.position - v.position - 1;
      } else {
        gap = roadLength - v.position + nextVehicle.position - 1;
      }

      // Rule 1: Acceleration
      if (v.velocity < maxVelocity) {
        v.velocity++;
      }

      // Rule 2: Slowing down (avoid collision)
      if (v.velocity > gap) {
        v.velocity = gap;
      }

      // Rule 3: Randomization
      if (v.velocity > 0 && Math.random() < slowdownProb) {
        v.velocity--;
      }
    }

    // Rule 4: Movement
    for (const v of vehicles) {
      v.position = (v.position + v.velocity) % roadLength;
    }
  }

  // Calculate metrics
  const totalSpeed = vehicles.reduce((sum, v) => sum + v.velocity, 0);
  const avgSpeed = totalSpeed / vehicles.length;
  const density = vehicleCount / roadLength;
  const flow = density * avgSpeed;

  return { history, finalVehicles: vehicles, avgSpeed, flow, density };
}

// ===== INTELLIGENT DRIVER MODEL (IDM) =====

interface IDMVehicle {
  position: number;
  velocity: number;
  acceleration: number;
}

function intelligentDriverModel(
  roadLength: number,
  vehicleCount: number,
  timeSteps: number,
  dt: number,
  params: {
    v0: number;      // Desired velocity
    T: number;       // Safe time headway
    a: number;       // Max acceleration
    b: number;       // Comfortable deceleration
    s0: number;      // Minimum gap
    delta: number;   // Acceleration exponent
  }
): {
  history: { position: number; velocity: number }[][];
  metrics: { avgSpeed: number; flow: number; density: number };
} {
  const { v0, T, a, b, s0, delta } = params;

  // Initialize vehicles evenly spaced
  const spacing = roadLength / vehicleCount;
  const vehicles: IDMVehicle[] = [];

  for (let i = 0; i < vehicleCount; i++) {
    vehicles.push({
      position: i * spacing,
      velocity: v0 * 0.8, // Start near desired speed
      acceleration: 0
    });
  }

  const history: { position: number; velocity: number }[][] = [];

  for (let t = 0; t < timeSteps; t++) {
    // Record state
    history.push(vehicles.map(v => ({ position: v.position, velocity: v.velocity })));

    // Calculate accelerations
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const leader = vehicles[(i + 1) % vehicles.length];

      // Gap to leader
      let gap: number;
      if (leader.position > v.position) {
        gap = leader.position - v.position;
      } else {
        gap = roadLength - v.position + leader.position;
      }
      gap = Math.max(0.1, gap - 5); // Subtract vehicle length

      // Relative velocity
      const deltaV = v.velocity - leader.velocity;

      // Desired gap
      const sStar = s0 + Math.max(0, v.velocity * T + v.velocity * deltaV / (2 * Math.sqrt(a * b)));

      // IDM acceleration
      v.acceleration = a * (1 - Math.pow(v.velocity / v0, delta) - Math.pow(sStar / gap, 2));

      // Limit acceleration
      v.acceleration = Math.max(-b * 2, Math.min(a, v.acceleration));
    }

    // Update positions and velocities
    for (const v of vehicles) {
      v.velocity = Math.max(0, v.velocity + v.acceleration * dt);
      v.position = (v.position + v.velocity * dt + 0.5 * v.acceleration * dt * dt) % roadLength;
    }
  }

  // Calculate metrics
  const avgSpeed = vehicles.reduce((sum, v) => sum + v.velocity, 0) / vehicles.length;
  const density = vehicleCount / roadLength;
  const flow = density * avgSpeed;

  return { history, metrics: { avgSpeed, flow, density } };
}

// ===== FUNDAMENTAL DIAGRAM =====

function fundamentalDiagram(
  roadLength: number,
  maxDensity: number,
  points: number
): { density: number; flow: number; speed: number }[] {
  const results: { density: number; flow: number; speed: number }[] = [];

  for (let i = 0; i <= points; i++) {
    const density = (i / points) * maxDensity;
    const vehicleCount = Math.round(density * roadLength);

    if (vehicleCount === 0) {
      results.push({ density, flow: 0, speed: 0 });
      continue;
    }

    // Run short simulation
    const { avgSpeed } = nagelSchreckenberg(
      roadLength,
      Math.min(vehicleCount, roadLength - 1),
      5,
      0.3,
      100
    );

    results.push({
      density: Math.round(density * 1000) / 1000,
      flow: Math.round(density * avgSpeed * 1000) / 1000,
      speed: Math.round(avgSpeed * 100) / 100
    });
  }

  return results;
}

// ===== BOTTLENECK SIMULATION =====

function bottleneckSimulation(
  roadLength: number,
  vehicleCount: number,
  bottleneckStart: number,
  bottleneckEnd: number,
  capacityReduction: number,
  timeSteps: number
): {
  history: number[][];
  queueLength: number[];
  throughput: number[];
} {
  // Initialize vehicles
  const vehicles: NSVehicle[] = [];
  const usedPositions = new Set<number>();

  for (let i = 0; i < vehicleCount; i++) {
    let pos: number;
    do {
      pos = Math.floor(Math.random() * roadLength);
    } while (usedPositions.has(pos));

    usedPositions.add(pos);
    vehicles.push({ position: pos, velocity: Math.floor(Math.random() * 6) });
  }

  vehicles.sort((a, b) => a.position - b.position);

  const history: number[][] = [];
  const queueLength: number[] = [];
  const throughput: number[] = [];

  const maxVelocityNormal = 5;
  const maxVelocityBottleneck = Math.floor(maxVelocityNormal * (1 - capacityReduction));
  const slowdownProb = 0.3;

  for (let t = 0; t < timeSteps; t++) {
    // Record state
    const state = new Array(roadLength).fill(0);
    for (const v of vehicles) {
      state[v.position] = v.velocity + 1;
    }
    history.push(state);

    // Count queue (vehicles waiting before bottleneck)
    const queue = vehicles.filter(v =>
      v.position < bottleneckStart &&
      v.position >= bottleneckStart - 20 &&
      v.velocity <= 1
    ).length;
    queueLength.push(queue);

    // Count throughput (vehicles passing bottleneck end)
    let through = 0;

    // Update rules
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const nextVehicle = vehicles[(i + 1) % vehicles.length];

      // Determine max velocity based on position
      const inBottleneck = v.position >= bottleneckStart && v.position <= bottleneckEnd;
      const maxV = inBottleneck ? maxVelocityBottleneck : maxVelocityNormal;

      // Gap calculation
      let gap: number;
      if (nextVehicle.position > v.position) {
        gap = nextVehicle.position - v.position - 1;
      } else {
        gap = roadLength - v.position + nextVehicle.position - 1;
      }

      // NS rules with variable max velocity
      if (v.velocity < maxV) v.velocity++;
      if (v.velocity > gap) v.velocity = gap;
      if (v.velocity > 0 && Math.random() < slowdownProb) v.velocity--;
    }

    // Movement
    for (const v of vehicles) {
      const oldPos = v.position;
      v.position = (v.position + v.velocity) % roadLength;

      // Count throughput
      if (oldPos <= bottleneckEnd && v.position > bottleneckEnd) {
        through++;
      } else if (oldPos > bottleneckEnd && v.position < oldPos) {
        // Wrapped around
        through++;
      }
    }

    throughput.push(through);
  }

  return { history, queueLength, throughput };
}

// ===== INTERSECTION SIMULATION =====

function intersectionSimulation(
  approachLength: number,
  vehiclesPerApproach: number,
  greenTime: number,
  cycleTime: number,
  timeSteps: number
): {
  delays: number[];
  throughput: { north: number; east: number };
  queueLengths: { north: number[]; east: number[] };
} {
  // Simplified 2-way intersection
  interface IntersectionVehicle {
    position: number;
    approach: 'north' | 'east';
    arrivalTime: number;
    departureTime: number | null;
  }

  const vehicles: IntersectionVehicle[] = [];

  // Initialize vehicles on both approaches
  for (let i = 0; i < vehiclesPerApproach; i++) {
    vehicles.push({
      position: Math.random() * approachLength,
      approach: 'north',
      arrivalTime: Math.floor(Math.random() * timeSteps * 0.5),
      departureTime: null
    });
    vehicles.push({
      position: Math.random() * approachLength,
      approach: 'east',
      arrivalTime: Math.floor(Math.random() * timeSteps * 0.5),
      departureTime: null
    });
  }

  const queueLengths = { north: [] as number[], east: [] as number[] };
  const throughput = { north: 0, east: 0 };
  const delays: number[] = [];

  for (let t = 0; t < timeSteps; t++) {
    const phaseTime = t % cycleTime;
    const northGreen = phaseTime < greenTime;
    const eastGreen = phaseTime >= greenTime && phaseTime < 2 * greenTime;

    // Count queues
    const northQueue = vehicles.filter(v =>
      v.approach === 'north' && v.arrivalTime <= t && v.departureTime === null
    ).length;
    const eastQueue = vehicles.filter(v =>
      v.approach === 'east' && v.arrivalTime <= t && v.departureTime === null
    ).length;

    queueLengths.north.push(northQueue);
    queueLengths.east.push(eastQueue);

    // Process departures
    const saturationRate = 2; // vehicles per time step

    if (northGreen) {
      const waiting = vehicles.filter(v =>
        v.approach === 'north' && v.arrivalTime <= t && v.departureTime === null
      );
      for (let i = 0; i < Math.min(saturationRate, waiting.length); i++) {
        waiting[i].departureTime = t;
        throughput.north++;
        delays.push(t - waiting[i].arrivalTime);
      }
    }

    if (eastGreen) {
      const waiting = vehicles.filter(v =>
        v.approach === 'east' && v.arrivalTime <= t && v.departureTime === null
      );
      for (let i = 0; i < Math.min(saturationRate, waiting.length); i++) {
        waiting[i].departureTime = t;
        throughput.east++;
        delays.push(t - waiting[i].arrivalTime);
      }
    }
  }

  return { delays, throughput, queueLengths };
}

// ===== VISUALIZATION =====

function visualizeTraffic(history: number[][], roadLength: number, steps: number = 20): string[] {
  const lines: string[] = [];
  const start = Math.max(0, history.length - steps);

  for (let t = start; t < history.length; t++) {
    const state = history[t];
    let line = `t=${String(t).padStart(3)}|`;

    // Compress if road is too long
    const displayLength = Math.min(roadLength, 60);
    const ratio = roadLength / displayLength;

    for (let i = 0; i < displayLength; i++) {
      const idx = Math.floor(i * ratio);
      if (state[idx] > 0) {
        // Show velocity as character
        const v = state[idx] - 1;
        line += v.toString(16).toUpperCase();
      } else {
        line += '·';
      }
    }
    lines.push(line);
  }

  return lines;
}

// ===== MAIN EXECUTION =====

export async function executetrafficsimulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'traffic_simulation',
            description: 'Traffic flow simulation and modeling',
            models: {
              nagel_schreckenberg: {
                type: 'Cellular automaton',
                description: 'Discrete space/time/speed model with random slowdown',
                rules: ['Acceleration', 'Braking (avoid collision)', 'Random slowdown', 'Movement']
              },
              intelligent_driver_model: {
                type: 'Car-following',
                description: 'Continuous model balancing desired speed and safe following',
                parameters: ['Desired velocity v0', 'Safe time headway T', 'Acceleration a', 'Deceleration b']
              },
              fundamental_diagram: {
                description: 'Relationship between flow, density, and speed',
                formula: 'Flow = Density × Speed'
              }
            },
            phenomena: {
              phantom_jam: 'Traffic jam without apparent cause (from small perturbations)',
              capacity_drop: 'Flow reduction when queue forms at bottleneck',
              shockwave: 'Backward-moving wave of braking',
              hysteresis: 'Different flow-density curves for increasing vs decreasing density'
            },
            metrics: {
              flow: 'Vehicles per time unit (veh/h)',
              density: 'Vehicles per length unit (veh/km)',
              speed: 'Average velocity',
              travel_time: 'Time to traverse road segment'
            },
            operations: ['info', 'simulate', 'cellular', 'car_following', 'fundamental_diagram', 'bottleneck', 'intersection', 'demonstrate']
          }, null, 2)
        };
      }

      case 'simulate':
      case 'cellular': {
        const roadLength = args.road_length || 100;
        const vehicleCount = args.vehicle_count || 30;
        const timeSteps = args.time_steps || 100;
        const params = args.parameters || {};

        const maxVelocity = params.max_velocity || 5;
        const slowdownProb = params.slowdown_prob || 0.3;

        const result = nagelSchreckenberg(roadLength, vehicleCount, maxVelocity, slowdownProb, timeSteps);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Nagel-Schreckenberg Cellular Automaton',
            parameters: {
              road_length: roadLength,
              vehicle_count: vehicleCount,
              max_velocity: maxVelocity,
              slowdown_probability: slowdownProb,
              time_steps: timeSteps
            },
            rules: [
              '1. Acceleration: v → min(v+1, v_max)',
              '2. Braking: v → min(v, gap)',
              '3. Randomization: v → max(v-1, 0) with probability p',
              '4. Movement: position → position + v'
            ],
            results: {
              density: Math.round(result.density * 1000) / 1000,
              average_speed: Math.round(result.avgSpeed * 100) / 100,
              flow: Math.round(result.flow * 1000) / 1000,
              level_of_service: result.avgSpeed > maxVelocity * 0.8 ? 'A (free flow)' :
                               result.avgSpeed > maxVelocity * 0.5 ? 'C (stable flow)' :
                               result.avgSpeed > maxVelocity * 0.2 ? 'E (unstable flow)' : 'F (forced flow)'
            },
            visualization: visualizeTraffic(result.history, roadLength, 15).join('\n'),
            legend: 'Numbers 0-5 show vehicle velocity, · is empty cell'
          }, null, 2)
        };
      }

      case 'car_following': {
        const roadLength = args.road_length || 1000;
        const vehicleCount = args.vehicle_count || 20;
        const timeSteps = args.time_steps || 200;
        const params = args.parameters || {};

        const idmParams = {
          v0: params.desired_velocity || 30,
          T: params.time_headway || 1.5,
          a: params.max_acceleration || 1.5,
          b: params.comfortable_deceleration || 2.0,
          s0: params.minimum_gap || 2,
          delta: params.acceleration_exponent || 4
        };

        const result = intelligentDriverModel(roadLength, vehicleCount, timeSteps, 0.5, idmParams);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: 'Intelligent Driver Model (IDM)',
            description: 'Car-following model with smooth acceleration behavior',
            parameters: {
              road_length: `${roadLength} m`,
              vehicle_count: vehicleCount,
              desired_velocity: `${idmParams.v0} m/s (${Math.round(idmParams.v0 * 3.6)} km/h)`,
              safe_time_headway: `${idmParams.T} s`,
              max_acceleration: `${idmParams.a} m/s²`,
              comfortable_deceleration: `${idmParams.b} m/s²`,
              minimum_gap: `${idmParams.s0} m`
            },
            equation: {
              acceleration: 'a = a_max [1 - (v/v0)^δ - (s*/s)²]',
              desired_gap: 's* = s0 + max(0, vT + v·Δv/(2√(ab)))'
            },
            results: {
              average_speed: `${Math.round(result.metrics.avgSpeed * 100) / 100} m/s (${Math.round(result.metrics.avgSpeed * 3.6)} km/h)`,
              density: `${Math.round(result.metrics.density * 1000)} veh/km`,
              flow: `${Math.round(result.metrics.flow * 3600)} veh/h`
            },
            speed_profile: result.history.slice(-5).map((state, i) => ({
              time: timeSteps - 5 + i,
              speeds: state.slice(0, 5).map(v => Math.round(v.velocity * 10) / 10)
            }))
          }, null, 2)
        };
      }

      case 'fundamental_diagram': {
        const roadLength = args.road_length || 100;
        const maxDensity = args.max_density || 1.0;
        const points = args.points || 20;

        const diagram = fundamentalDiagram(roadLength, maxDensity, points);

        // Find capacity
        let maxFlow = 0;
        let optimalDensity = 0;
        for (const point of diagram) {
          if (point.flow > maxFlow) {
            maxFlow = point.flow;
            optimalDensity = point.density;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            analysis: 'Fundamental Diagram of Traffic Flow',
            relationship: 'Flow = Density × Speed',
            theory: {
              free_flow: 'Low density → high speed → increasing flow',
              capacity: 'Optimal density → maximum flow',
              congestion: 'High density → low speed → decreasing flow'
            },
            results: {
              capacity: {
                max_flow: Math.round(maxFlow * 1000) / 1000,
                optimal_density: Math.round(optimalDensity * 1000) / 1000
              },
              jam_density: maxDensity
            },
            data_points: diagram.filter((_, i) => i % 2 === 0).map(p => ({
              density: p.density,
              flow: p.flow,
              speed: p.speed
            })),
            phases: {
              free_flow: `Density < ${Math.round(optimalDensity * 500) / 1000}`,
              synchronized: `${Math.round(optimalDensity * 500) / 1000} < Density < ${Math.round(optimalDensity * 1500) / 1000}`,
              congested: `Density > ${Math.round(optimalDensity * 1500) / 1000}`
            }
          }, null, 2)
        };
      }

      case 'bottleneck': {
        const roadLength = args.road_length || 100;
        const vehicleCount = args.vehicle_count || 40;
        const timeSteps = args.time_steps || 200;
        const params = args.parameters || {};

        const bottleneckStart = params.bottleneck_start || Math.floor(roadLength * 0.4);
        const bottleneckEnd = params.bottleneck_end || Math.floor(roadLength * 0.6);
        const capacityReduction = params.capacity_reduction || 0.4;

        const result = bottleneckSimulation(
          roadLength, vehicleCount, bottleneckStart, bottleneckEnd, capacityReduction, timeSteps
        );

        const avgQueue = result.queueLength.reduce((a, b) => a + b, 0) / result.queueLength.length;
        const totalThroughput = result.throughput.reduce((a, b) => a + b, 0);

        return {
          toolCallId: id,
          content: JSON.stringify({
            simulation: 'Traffic Bottleneck',
            configuration: {
              road_length: roadLength,
              vehicle_count: vehicleCount,
              bottleneck_location: `cells ${bottleneckStart}-${bottleneckEnd}`,
              capacity_reduction: `${capacityReduction * 100}%`
            },
            phenomena: {
              queue_formation: 'Vehicles accumulate upstream of bottleneck',
              capacity_drop: 'Actual throughput may be less than bottleneck capacity',
              shockwave: 'Queue boundary moves upstream over time'
            },
            results: {
              average_queue_length: Math.round(avgQueue * 10) / 10,
              max_queue_length: Math.max(...result.queueLength),
              total_throughput: totalThroughput,
              avg_throughput_per_step: Math.round(totalThroughput / timeSteps * 100) / 100
            },
            queue_evolution: result.queueLength.filter((_, i) => i % 20 === 0).map((q, i) => ({
              time: i * 20,
              queue: q
            })),
            visualization: visualizeTraffic(result.history, roadLength, 10).join('\n'),
            insight: 'Bottleneck region creates upstream congestion and phantom jams'
          }, null, 2)
        };
      }

      case 'intersection': {
        const approachLength = args.approach_length || 100;
        const vehiclesPerApproach = args.vehicles_per_approach || 30;
        const params = args.parameters || {};

        const greenTime = params.green_time || 30;
        const cycleTime = params.cycle_time || 80;
        const timeSteps = args.time_steps || 300;

        const result = intersectionSimulation(
          approachLength, vehiclesPerApproach, greenTime, cycleTime, timeSteps
        );

        const avgDelay = result.delays.length > 0
          ? result.delays.reduce((a, b) => a + b, 0) / result.delays.length
          : 0;
        const maxQueue = Math.max(...result.queueLengths.north, ...result.queueLengths.east);

        return {
          toolCallId: id,
          content: JSON.stringify({
            simulation: 'Signalized Intersection',
            configuration: {
              approaches: 2,
              vehicles_per_approach: vehiclesPerApproach,
              green_time: `${greenTime} time units`,
              cycle_time: `${cycleTime} time units`,
              green_ratio: `${(greenTime / cycleTime * 100).toFixed(1)}%`
            },
            signal_timing: {
              north_south_green: `0-${greenTime}`,
              east_west_green: `${greenTime}-${greenTime * 2}`,
              all_red: `${greenTime * 2}-${cycleTime}`
            },
            results: {
              total_throughput: {
                north: result.throughput.north,
                east: result.throughput.east,
                total: result.throughput.north + result.throughput.east
              },
              average_delay: Math.round(avgDelay * 10) / 10,
              max_queue_length: maxQueue,
              level_of_service: avgDelay < 10 ? 'A' : avgDelay < 20 ? 'B' : avgDelay < 35 ? 'C' : avgDelay < 55 ? 'D' : avgDelay < 80 ? 'E' : 'F'
            },
            los_criteria: {
              A: 'delay ≤ 10s',
              B: '10s < delay ≤ 20s',
              C: '20s < delay ≤ 35s',
              D: '35s < delay ≤ 55s',
              E: '55s < delay ≤ 80s',
              F: 'delay > 80s'
            }
          }, null, 2)
        };
      }

      case 'demonstrate': {
        // Run comparison of different densities
        const roadLength = 100;
        const maxVelocity = 5;

        const scenarios = [
          { vehicles: 10, label: 'Light traffic' },
          { vehicles: 30, label: 'Moderate traffic' },
          { vehicles: 50, label: 'Heavy traffic' },
          { vehicles: 70, label: 'Very heavy traffic' }
        ];

        const results = scenarios.map(s => {
          const sim = nagelSchreckenberg(roadLength, s.vehicles, maxVelocity, 0.3, 100);
          return {
            scenario: s.label,
            density: Math.round(s.vehicles / roadLength * 100) / 100,
            avg_speed: Math.round(sim.avgSpeed * 100) / 100,
            flow: Math.round(sim.flow * 1000) / 1000
          };
        });

        // Run one detailed simulation
        const detailSim = nagelSchreckenberg(roadLength, 35, maxVelocity, 0.3, 50);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Traffic Flow Simulation',
            model: 'Nagel-Schreckenberg Cellular Automaton',
            scenario_comparison: results,
            fundamental_relationship: {
              explanation: 'Flow initially increases with density, then decreases',
              finding: `Maximum flow at density ≈ ${results.reduce((max, r) => r.flow > max.flow ? r : max, results[0]).density}`
            },
            detailed_simulation: {
              parameters: {
                road_length: roadLength,
                vehicles: 35,
                max_velocity: maxVelocity,
                slowdown_prob: 0.3
              },
              visualization: visualizeTraffic(detailSim.history, roadLength, 12).join('\n'),
              metrics: {
                avg_speed: Math.round(detailSim.avgSpeed * 100) / 100,
                flow: Math.round(detailSim.flow * 1000) / 1000
              }
            },
            key_insights: [
              'Random slowdown creates phantom jams',
              'Flow-density relationship is nonlinear',
              'Congestion propagates backward (shockwaves)',
              'Small perturbations can cause major delays',
              'Optimal flow occurs at intermediate density'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'simulate', 'cellular', 'car_following', 'fundamental_diagram', 'bottleneck', 'intersection', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istrafficsimulationAvailable(): boolean { return true; }
