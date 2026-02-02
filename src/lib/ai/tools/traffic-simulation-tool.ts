/**
 * TRAFFIC-SIMULATION TOOL
 * Comprehensive traffic flow simulation and modeling
 * including cellular automaton, car-following, and fluid dynamics models
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Vehicle {
  id: number;
  position: number;        // meters
  velocity: number;        // m/s
  acceleration: number;    // m/s²
  length: number;          // meters
  maxVelocity: number;     // m/s
  type: 'car' | 'truck' | 'motorcycle' | 'bus';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface RoadSegment {
  id: string;
  length: number;          // meters
  lanes: number;
  speedLimit: number;      // m/s
  capacity: number;        // vehicles/hour
  vehicles: Vehicle[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TrafficSignal {
  id: string;
  position: number;
  greenTime: number;       // seconds
  redTime: number;         // seconds
  currentPhase: 'green' | 'red' | 'yellow';
  phaseTime: number;       // time in current phase
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SimulationConfig {
  duration: number;        // seconds
  timeStep: number;        // seconds
  randomSeed?: number;
}

interface TrafficMetrics {
  flow: number;            // vehicles/hour
  density: number;         // vehicles/km
  averageSpeed: number;    // m/s
  averageDelay: number;    // seconds
  travelTime: number;      // seconds
  levelOfService: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  queueLength: number;     // vehicles
}

interface SimulationResult {
  timeStep: number;
  time: number;
  vehicles: {
    id: number;
    position: number;
    velocity: number;
  }[];
  metrics: TrafficMetrics;
}

interface FundamentalDiagram {
  densities: number[];
  flows: number[];
  speeds: number[];
  criticalDensity: number;
  maxFlow: number;
  freeFlowSpeed: number;
}

// =============================================================================
// MODEL PARAMETERS
// =============================================================================

const PARAMETERS = {
  // Nagel-Schreckenberg model
  nagel_schreckenberg: {
    maxVelocity: 5,        // cells per time step
    slowdownProb: 0.3,     // random slowdown probability
    cellLength: 7.5        // meters per cell
  },

  // Intelligent Driver Model (IDM)
  idm: {
    a: 1.5,                // max acceleration (m/s²)
    b: 2.0,                // comfortable deceleration (m/s²)
    T: 1.5,                // safe time headway (s)
    s0: 2.0,               // minimum gap (m)
    delta: 4               // acceleration exponent
  },

  // Gipps model
  gipps: {
    a_n: 2.5,              // max acceleration (m/s²)
    b_n: -3.0,             // max deceleration (m/s²)
    tau: 0.67              // reaction time (s)
  },

  // LWR model (fluid)
  lwr: {
    vf: 30,                // free flow speed (m/s)
    kjam: 150,             // jam density (veh/km)
    qmax: 2000             // max flow (veh/hr)
  }
};

// =============================================================================
// RANDOM NUMBER GENERATOR
// =============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
    return this.seed / 2147483648;
  }
}

// =============================================================================
// CELLULAR AUTOMATON MODEL (Nagel-Schreckenberg)
// =============================================================================

function nagelSchreckenberg(
  roadLength: number,
  numVehicles: number,
  duration: number,
  rng: SeededRandom
): SimulationResult[] {
  const params = PARAMETERS.nagel_schreckenberg;
  const numCells = Math.floor(roadLength / params.cellLength);
  const results: SimulationResult[] = [];

  // Initialize vehicles randomly
  const cells: (number | null)[] = new Array(numCells).fill(null);
  const velocities: Map<number, number> = new Map();

  const positions = new Set<number>();
  let vehicleId = 0;

  while (positions.size < Math.min(numVehicles, numCells - 1)) {
    const pos = Math.floor(rng.next() * numCells);
    if (!positions.has(pos)) {
      positions.add(pos);
      cells[pos] = vehicleId;
      velocities.set(vehicleId, Math.floor(rng.next() * (params.maxVelocity + 1)));
      vehicleId++;
    }
  }

  // Simulation loop
  for (let t = 0; t <= duration; t++) {
    // Record state
    const vehicles: { id: number; position: number; velocity: number }[] = [];
    let totalVelocity = 0;
    let vehicleCount = 0;

    for (let i = 0; i < numCells; i++) {
      if (cells[i] !== null) {
        const v = velocities.get(cells[i]!) ?? 0;
        vehicles.push({
          id: cells[i]!,
          position: i * params.cellLength,
          velocity: v * params.cellLength
        });
        totalVelocity += v;
        vehicleCount++;
      }
    }

    const density = (vehicleCount / numCells) * 1000 / params.cellLength; // veh/km
    const avgSpeed = vehicleCount > 0 ? (totalVelocity / vehicleCount) * params.cellLength : 0;
    const flow = density * avgSpeed * 3.6; // veh/hr

    results.push({
      timeStep: t,
      time: t,
      vehicles,
      metrics: {
        flow,
        density,
        averageSpeed: avgSpeed,
        averageDelay: Math.max(0, params.maxVelocity * params.cellLength - avgSpeed) / params.cellLength,
        travelTime: avgSpeed > 0 ? roadLength / avgSpeed : Infinity,
        levelOfService: getLevelOfService(flow, 2000),
        queueLength: vehicles.filter(v => v.velocity < params.cellLength).length
      }
    });

    // Update rules
    const newCells: (number | null)[] = new Array(numCells).fill(null);
    const newVelocities: Map<number, number> = new Map();

    for (let i = 0; i < numCells; i++) {
      if (cells[i] !== null) {
        const vId = cells[i]!;
        let v = velocities.get(vId) ?? 0;

        // Rule 1: Acceleration
        v = Math.min(v + 1, params.maxVelocity);

        // Rule 2: Slowing down (gap)
        let gap = 1;
        for (let j = 1; j <= params.maxVelocity; j++) {
          if (cells[(i + j) % numCells] !== null) {
            gap = j - 1;
            break;
          }
          gap = j;
        }
        v = Math.min(v, gap);

        // Rule 3: Randomization
        if (v > 0 && rng.next() < params.slowdownProb) {
          v -= 1;
        }

        // Rule 4: Movement
        const newPos = (i + v) % numCells;
        newCells[newPos] = vId;
        newVelocities.set(vId, v);
      }
    }

    // Update state
    for (let i = 0; i < numCells; i++) {
      cells[i] = newCells[i];
    }
    velocities.clear();
    for (const [k, v] of newVelocities) {
      velocities.set(k, v);
    }
  }

  return results;
}

// =============================================================================
// CAR-FOLLOWING MODEL (Intelligent Driver Model)
// =============================================================================

function intelligentDriverModel(
  vehicles: Vehicle[],
  dt: number
): Vehicle[] {
  const params = PARAMETERS.idm;
  const sorted = [...vehicles].sort((a, b) => a.position - b.position);

  return sorted.map((vehicle, index) => {
    const leader = sorted[(index + 1) % sorted.length];

    // Gap and approach rate
    let gap: number;
    let deltaV: number;

    if (leader.position > vehicle.position) {
      gap = leader.position - vehicle.position - leader.length;
      deltaV = vehicle.velocity - leader.velocity;
    } else {
      // Wrap around
      gap = 1000; // Large gap for first vehicle
      deltaV = 0;
    }

    // Desired gap
    const s_star = params.s0 + Math.max(0,
      vehicle.velocity * params.T +
      (vehicle.velocity * deltaV) / (2 * Math.sqrt(params.a * params.b))
    );

    // Acceleration
    const freeTerm = Math.pow(vehicle.velocity / vehicle.maxVelocity, params.delta);
    const interactionTerm = Math.pow(s_star / Math.max(gap, 0.1), 2);
    const acceleration = params.a * (1 - freeTerm - interactionTerm);

    // Update vehicle
    const newVelocity = Math.max(0, vehicle.velocity + acceleration * dt);
    const newPosition = vehicle.position + vehicle.velocity * dt + 0.5 * acceleration * dt * dt;

    return {
      ...vehicle,
      position: newPosition,
      velocity: newVelocity,
      acceleration
    };
  });
}

function runIDMSimulation(
  roadLength: number,
  numVehicles: number,
  duration: number,
  dt: number,
  rng: SeededRandom
): SimulationResult[] {
  const results: SimulationResult[] = [];

  // Initialize vehicles
  let vehicles: Vehicle[] = [];
  const spacing = roadLength / numVehicles;

  for (let i = 0; i < numVehicles; i++) {
    const isHeavy = rng.next() < 0.1;
    vehicles.push({
      id: i,
      position: i * spacing,
      velocity: 25 + rng.next() * 5,
      acceleration: 0,
      length: isHeavy ? 12 : 5,
      maxVelocity: isHeavy ? 25 : 35,
      type: isHeavy ? 'truck' : 'car'
    });
  }

  // Simulation loop
  for (let t = 0; t <= duration; t += dt) {
    // Record state
    const totalVelocity = vehicles.reduce((sum, v) => sum + v.velocity, 0);
    const avgSpeed = totalVelocity / vehicles.length;
    const density = (vehicles.length / roadLength) * 1000; // veh/km
    const flow = density * avgSpeed * 3.6; // veh/hr

    results.push({
      timeStep: Math.round(t / dt),
      time: t,
      vehicles: vehicles.map(v => ({
        id: v.id,
        position: v.position,
        velocity: v.velocity
      })),
      metrics: {
        flow,
        density,
        averageSpeed: avgSpeed,
        averageDelay: Math.max(0, 30 - avgSpeed),
        travelTime: avgSpeed > 0 ? roadLength / avgSpeed : Infinity,
        levelOfService: getLevelOfService(flow, 2000),
        queueLength: vehicles.filter(v => v.velocity < 5).length
      }
    });

    // Update vehicles
    vehicles = intelligentDriverModel(vehicles, dt);

    // Handle periodic boundary
    vehicles = vehicles.map(v => ({
      ...v,
      position: v.position % roadLength
    }));
  }

  return results;
}

// =============================================================================
// FLUID MODEL (LWR - Lighthill-Whitham-Richards)
// =============================================================================

interface FluidCell {
  density: number;      // vehicles/km
  flow: number;         // vehicles/hr
  speed: number;        // km/hr
}

function lwrModel(
  roadLength: number,      // km
  initialDensity: number,  // vehicles/km
  duration: number,        // hours
  dt: number,              // hours
  dx: number               // km (cell size)
): { time: number; cells: FluidCell[] }[] {
  const params = PARAMETERS.lwr;
  const numCells = Math.ceil(roadLength / dx);
  const results: { time: number; cells: FluidCell[] }[] = [];

  // Initialize density
  let density: number[] = new Array(numCells).fill(initialDensity);

  // Fundamental diagram: Greenshields model
  // q = k * v_f * (1 - k/k_jam)
  function flowFromDensity(k: number): number {
    return k * params.vf * (1 - k / params.kjam);
  }

  function speedFromDensity(k: number): number {
    return params.vf * (1 - k / params.kjam);
  }

  // Simulation loop
  for (let t = 0; t <= duration; t += dt) {
    // Record state
    results.push({
      time: t,
      cells: density.map(k => ({
        density: k,
        flow: flowFromDensity(k),
        speed: speedFromDensity(k)
      }))
    });

    // Update using Godunov scheme
    const newDensity = [...density];

    for (let i = 0; i < numCells; i++) {
      const iMinus = (i - 1 + numCells) % numCells;

      // Numerical flux (upwind)
      const fluxIn = flowFromDensity(density[iMinus]);
      const fluxOut = flowFromDensity(density[i]);

      // Conservation law: dk/dt + dq/dx = 0
      newDensity[i] = density[i] - (dt / dx) * (fluxOut - fluxIn);

      // Ensure non-negative density
      newDensity[i] = Math.max(0, Math.min(params.kjam, newDensity[i]));
    }

    density = newDensity;
  }

  return results;
}

// =============================================================================
// FUNDAMENTAL DIAGRAM
// =============================================================================

function calculateFundamentalDiagram(
  freeFlowSpeed: number,
  jamDensity: number
): FundamentalDiagram {
  const densities: number[] = [];
  const flows: number[] = [];
  const speeds: number[] = [];

  let maxFlow = 0;
  let criticalDensity = 0;

  for (let k = 0; k <= jamDensity; k += jamDensity / 50) {
    const v = freeFlowSpeed * (1 - k / jamDensity);
    const q = k * v;

    densities.push(k);
    speeds.push(v);
    flows.push(q);

    if (q > maxFlow) {
      maxFlow = q;
      criticalDensity = k;
    }
  }

  return {
    densities,
    flows,
    speeds,
    criticalDensity,
    maxFlow,
    freeFlowSpeed
  };
}

// =============================================================================
// LEVEL OF SERVICE
// =============================================================================

function getLevelOfService(flow: number, capacity: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  const ratio = flow / capacity;
  if (ratio <= 0.35) return 'A';
  if (ratio <= 0.55) return 'B';
  if (ratio <= 0.75) return 'C';
  if (ratio <= 0.90) return 'D';
  if (ratio <= 1.00) return 'E';
  return 'F';
}

function losDescription(los: string): string {
  const descriptions: Record<string, string> = {
    A: 'Free flow - drivers can maintain desired speed',
    B: 'Reasonably free flow - speeds maintained',
    C: 'Stable flow - freedom to maneuver restricted',
    D: 'Approaching unstable flow - limited maneuverability',
    E: 'Unstable flow - at or near capacity',
    F: 'Forced flow - breakdown, stop-and-go'
  };
  return descriptions[los] ?? 'Unknown';
}

// =============================================================================
// SIGNAL OPTIMIZATION
// =============================================================================

interface SignalTiming {
  greenTime: number;
  redTime: number;
  cycleLength: number;
  effectiveGreen: number;
  capacity: number;
  saturationFlow: number;
}

function optimizeSignalTiming(
  approachVolume: number,      // vehicles/hour
  saturationFlow: number,      // vehicles/hour green
  _cycleLength: number          // seconds
): SignalTiming {
  // Webster's optimal cycle length approximation
  const lostTime = 4;  // seconds per phase
  const minGreen = 10;

  // Calculate minimum green time needed
  const criticalRatio = approachVolume / saturationFlow;
  const minCycle = (1.5 * lostTime + 5) / (1 - criticalRatio);

  const optimalCycle = Math.min(120, Math.max(30, minCycle));
  const effectiveGreen = (optimalCycle - lostTime) * criticalRatio;
  const greenTime = Math.max(minGreen, effectiveGreen + lostTime / 2);
  const redTime = optimalCycle - greenTime;

  const capacity = saturationFlow * (greenTime / optimalCycle);

  return {
    greenTime: Math.round(greenTime),
    redTime: Math.round(redTime),
    cycleLength: Math.round(optimalCycle),
    effectiveGreen: Math.round(effectiveGreen),
    capacity: Math.round(capacity),
    saturationFlow
  };
}

// =============================================================================
// EXAMPLE SCENARIOS
// =============================================================================

const exampleScenarios: Record<string, { roadLength: number; vehicles: number; speedLimit: number }> = {
  highway: { roadLength: 5000, vehicles: 50, speedLimit: 30 },
  arterial: { roadLength: 2000, vehicles: 30, speedLimit: 15 },
  urban: { roadLength: 500, vehicles: 20, speedLimit: 10 },
  congested: { roadLength: 1000, vehicles: 80, speedLimit: 15 },
  free_flow: { roadLength: 3000, vehicles: 15, speedLimit: 30 }
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const trafficsimulationTool: UnifiedTool = {
  name: 'traffic_simulation',
  description: 'Traffic flow simulation and modeling including cellular automaton (Nagel-Schreckenberg), car-following (IDM), and macroscopic fluid models (LWR). Analyzes flow, density, speed relationships and optimizes signal timing.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'fundamental_diagram', 'signal_timing', 'analyze', 'compare', 'examples', 'info'],
        description: 'Operation: simulate traffic, calculate fundamental diagram, optimize signals, analyze scenario, compare models, examples, or info'
      },
      model: {
        type: 'string',
        enum: ['cellular', 'car_following', 'fluid'],
        description: 'Traffic model: cellular (Nagel-Schreckenberg), car_following (IDM), or fluid (LWR)'
      },
      road_length: {
        type: 'number',
        description: 'Road segment length in meters'
      },
      num_vehicles: {
        type: 'number',
        description: 'Number of vehicles'
      },
      duration: {
        type: 'number',
        description: 'Simulation duration in seconds'
      },
      speed_limit: {
        type: 'number',
        description: 'Speed limit in m/s'
      },
      scenario: {
        type: 'string',
        description: 'Named scenario: highway, arterial, urban, congested, free_flow'
      },
      density: {
        type: 'number',
        description: 'Initial density for fluid model (vehicles/km)'
      },
      approach_volume: {
        type: 'number',
        description: 'Approach volume for signal timing (vehicles/hour)'
      },
      cycle_length: {
        type: 'number',
        description: 'Signal cycle length in seconds'
      },
      random_seed: {
        type: 'number',
        description: 'Random seed for reproducibility'
      }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executetrafficsimulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation, model = 'cellular', road_length, num_vehicles, duration = 100,
      speed_limit, scenario, density, approach_volume, cycle_length = 60,
      random_seed
    } = args;

    const rng = new SeededRandom(random_seed ?? Date.now());

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'traffic-simulation',
        description: 'Multi-model traffic flow simulation and analysis',
        models: {
          cellular: {
            name: 'Nagel-Schreckenberg',
            type: 'Cellular Automaton',
            parameters: PARAMETERS.nagel_schreckenberg,
            features: ['Discrete space/time', 'Random slowdown', 'Simple rules']
          },
          car_following: {
            name: 'Intelligent Driver Model (IDM)',
            type: 'Microscopic',
            parameters: PARAMETERS.idm,
            features: ['Continuous dynamics', 'Gap-based acceleration', 'Realistic car-following']
          },
          fluid: {
            name: 'Lighthill-Whitham-Richards (LWR)',
            type: 'Macroscopic',
            parameters: PARAMETERS.lwr,
            features: ['Density-based', 'Conservation laws', 'Shock waves']
          }
        },
        level_of_service: {
          A: 'Free flow (v/c ≤ 0.35)',
          B: 'Reasonably free (0.35-0.55)',
          C: 'Stable flow (0.55-0.75)',
          D: 'Approaching unstable (0.75-0.90)',
          E: 'Unstable (0.90-1.00)',
          F: 'Forced flow (> 1.00)'
        },
        fundamental_relations: {
          flow: 'q = k × v (vehicles/hour)',
          density: 'k = n / L (vehicles/km)',
          speed: 'v = q / k (km/hour)'
        },
        example_scenarios: Object.keys(exampleScenarios)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          scenarios: Object.entries(exampleScenarios).map(([name, s]) => ({
            name,
            road_length_m: s.roadLength,
            vehicles: s.vehicles,
            speed_limit_ms: s.speedLimit,
            density_veh_km: (s.vehicles / s.roadLength) * 1000
          }))
        }, null, 2)
      };
    }

    // Get scenario parameters
    let roadLen = road_length ?? 1000;
    let numVeh = num_vehicles ?? 30;
    let speedLim = speed_limit ?? 15;

    if (scenario && exampleScenarios[scenario]) {
      const s = exampleScenarios[scenario];
      roadLen = road_length ?? s.roadLength;
      numVeh = num_vehicles ?? s.vehicles;
      speedLim = speed_limit ?? s.speedLimit;
    }

    // Fundamental diagram operation
    if (operation === 'fundamental_diagram') {
      const vf = speedLim * 3.6;  // Convert to km/h
      const kjam = 150;           // vehicles/km

      const diagram = calculateFundamentalDiagram(vf, kjam);

      return {
        toolCallId: id,
        content: JSON.stringify({
          parameters: {
            free_flow_speed_kmh: vf,
            jam_density_veh_km: kjam
          },
          critical_point: {
            density_veh_km: diagram.criticalDensity,
            max_flow_veh_hr: diagram.maxFlow,
            speed_at_capacity_kmh: diagram.freeFlowSpeed / 2
          },
          diagram_points: diagram.densities.filter((_, i) => i % 5 === 0).map((k, i) => ({
            density: Math.round(k),
            flow: Math.round(diagram.flows[i * 5]),
            speed: Math.round(diagram.speeds[i * 5] * 10) / 10
          }))
        }, null, 2)
      };
    }

    // Signal timing operation
    if (operation === 'signal_timing') {
      const volume = approach_volume ?? 500;
      const satFlow = 1800;  // Standard saturation flow

      const timing = optimizeSignalTiming(volume, satFlow, cycle_length);

      return {
        toolCallId: id,
        content: JSON.stringify({
          input: {
            approach_volume_vph: volume,
            saturation_flow_vph: satFlow,
            target_cycle_s: cycle_length
          },
          optimized_timing: {
            cycle_length_s: timing.cycleLength,
            green_time_s: timing.greenTime,
            red_time_s: timing.redTime,
            effective_green_s: timing.effectiveGreen
          },
          performance: {
            capacity_vph: timing.capacity,
            volume_capacity_ratio: Math.round((volume / timing.capacity) * 100) / 100,
            level_of_service: getLevelOfService(volume, timing.capacity),
            description: losDescription(getLevelOfService(volume, timing.capacity))
          }
        }, null, 2)
      };
    }

    // Compare models operation
    if (operation === 'compare') {
      const simDuration = Math.min(duration, 50);

      // Run all three models
      const cellularResults = nagelSchreckenberg(roadLen, numVeh, simDuration, rng);
      const idmResults = runIDMSimulation(roadLen, numVeh, simDuration, 0.5, rng);

      // Get final metrics
      const cellularFinal = cellularResults[cellularResults.length - 1].metrics;
      const idmFinal = idmResults[idmResults.length - 1].metrics;

      return {
        toolCallId: id,
        content: JSON.stringify({
          scenario: {
            road_length_m: roadLen,
            vehicles: numVeh,
            duration_s: simDuration
          },
          comparison: {
            cellular_automaton: {
              model: 'Nagel-Schreckenberg',
              flow_vph: Math.round(cellularFinal.flow),
              avg_speed_ms: Math.round(cellularFinal.averageSpeed * 10) / 10,
              density_veh_km: Math.round(cellularFinal.density * 10) / 10,
              level_of_service: cellularFinal.levelOfService
            },
            car_following: {
              model: 'IDM',
              flow_vph: Math.round(idmFinal.flow),
              avg_speed_ms: Math.round(idmFinal.averageSpeed * 10) / 10,
              density_veh_km: Math.round(idmFinal.density * 10) / 10,
              level_of_service: idmFinal.levelOfService
            }
          },
          summary: 'Cellular model captures discrete stop-and-go; IDM provides smoother continuous dynamics'
        }, null, 2)
      };
    }

    // Analyze operation
    if (operation === 'analyze') {
      const actualDensity = (numVeh / roadLen) * 1000;
      const vf = speedLim;
      const kjam = 150;

      // Greenshields equilibrium
      const eqSpeed = vf * (1 - actualDensity / kjam);
      const eqFlow = actualDensity * eqSpeed * 3.6;

      const diagram = calculateFundamentalDiagram(vf * 3.6, kjam);

      return {
        toolCallId: id,
        content: JSON.stringify({
          scenario: {
            road_length_m: roadLen,
            num_vehicles: numVeh,
            speed_limit_ms: speedLim
          },
          current_state: {
            density_veh_km: Math.round(actualDensity * 10) / 10,
            estimated_speed_ms: Math.round(eqSpeed * 10) / 10,
            estimated_flow_vph: Math.round(eqFlow),
            level_of_service: getLevelOfService(eqFlow, diagram.maxFlow),
            description: losDescription(getLevelOfService(eqFlow, diagram.maxFlow))
          },
          capacity: {
            critical_density_veh_km: Math.round(diagram.criticalDensity),
            max_flow_vph: Math.round(diagram.maxFlow),
            utilization_pct: Math.round((eqFlow / diagram.maxFlow) * 100)
          },
          recommendation: actualDensity > diagram.criticalDensity
            ? 'Density exceeds critical value - congestion likely'
            : 'Operating below capacity - stable flow expected'
        }, null, 2)
      };
    }

    // Simulate operation
    const simDuration = Math.min(duration, 200);
    let results: SimulationResult[];

    switch (model) {
      case 'car_following':
        results = runIDMSimulation(roadLen, numVeh, simDuration, 0.5, rng);
        break;

      case 'fluid':
        const fluidResults = lwrModel(
          roadLen / 1000,
          density ?? numVeh / (roadLen / 1000),
          simDuration / 3600,
          1 / 3600,
          0.1
        );

        // Convert fluid results to standard format
        results = fluidResults.map((r, i) => {
          const avgDensity = r.cells.reduce((s, c) => s + c.density, 0) / r.cells.length;
          const avgSpeed = r.cells.reduce((s, c) => s + c.speed, 0) / r.cells.length;
          const avgFlow = r.cells.reduce((s, c) => s + c.flow, 0) / r.cells.length;

          return {
            timeStep: i,
            time: r.time * 3600,
            vehicles: [],
            metrics: {
              flow: avgFlow,
              density: avgDensity,
              averageSpeed: avgSpeed / 3.6,
              averageDelay: 0,
              travelTime: roadLen / 1000 / (avgSpeed / 3.6),
              levelOfService: getLevelOfService(avgFlow, 2000),
              queueLength: 0
            }
          };
        });
        break;

      case 'cellular':
      default:
        results = nagelSchreckenberg(roadLen, numVeh, simDuration, rng);
        break;
    }

    // Sample results for output
    const sampleRate = Math.max(1, Math.floor(results.length / 20));
    const sampledResults = results.filter((_, i) => i % sampleRate === 0 || i === results.length - 1);

    const finalMetrics = results[results.length - 1].metrics;

    return {
      toolCallId: id,
      content: JSON.stringify({
        model: model === 'car_following' ? 'Intelligent Driver Model' :
          model === 'fluid' ? 'LWR Macroscopic' : 'Nagel-Schreckenberg',
        parameters: {
          road_length_m: roadLen,
          num_vehicles: numVeh,
          duration_s: simDuration
        },
        final_metrics: {
          flow_vph: Math.round(finalMetrics.flow),
          density_veh_km: Math.round(finalMetrics.density * 10) / 10,
          avg_speed_ms: Math.round(finalMetrics.averageSpeed * 10) / 10,
          travel_time_s: Math.round(finalMetrics.travelTime),
          level_of_service: finalMetrics.levelOfService,
          description: losDescription(finalMetrics.levelOfService)
        },
        time_series: sampledResults.map(r => ({
          time_s: Math.round(r.time),
          flow_vph: Math.round(r.metrics.flow),
          avg_speed_ms: Math.round(r.metrics.averageSpeed * 10) / 10,
          queue: r.metrics.queueLength
        }))
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istrafficsimulationAvailable(): boolean {
  return true;
}
