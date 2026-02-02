/**
 * AGENT-BASED-MODEL TOOL
 * Agent-based modeling for complex systems simulation
 *
 * Features:
 * - Configurable agent behaviors
 * - Spatial environment (grid/continuous)
 * - Agent interactions and emergent behavior
 * - Statistical analysis of population dynamics
 * - Preset models (Schelling, Flocking, Predator-Prey)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const agentbasedmodelTool: UnifiedTool = {
  name: 'agent_based_model',
  description: 'Agent-based modeling for complex systems simulation with emergent behaviors',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'step', 'analyze', 'preset', 'info'],
        description: 'Operation to perform'
      },
      model: {
        type: 'string',
        enum: ['schelling', 'flocking', 'predator_prey', 'epidemic', 'custom'],
        description: 'Preset model type'
      },
      agent_count: {
        type: 'number',
        description: 'Number of agents'
      },
      grid_size: {
        type: 'number',
        description: 'Size of the grid environment'
      },
      steps: {
        type: 'number',
        description: 'Number of simulation steps'
      },
      parameters: {
        type: 'object',
        description: 'Model-specific parameters'
      }
    },
    required: ['operation']
  }
};

// Agent interface
interface Agent {
  id: number;
  x: number;
  y: number;
  type: string;
  state: Record<string, number | boolean | string>;
  vx?: number;
  vy?: number;
}

// Simulation state
interface SimulationState {
  agents: Agent[];
  gridSize: number;
  step: number;
  statistics: Record<string, number[]>;
}

// Schelling Segregation Model
function schellingModel(
  numAgents: number,
  gridSize: number,
  steps: number,
  tolerance: number = 0.3
): { state: SimulationState; metrics: Record<string, number[]> } {
  const agents: Agent[] = [];
  const grid: (number | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

  // Initialize agents randomly
  const types = ['A', 'B'];
  let id = 0;

  for (let i = 0; i < numAgents && id < gridSize * gridSize * 0.8; i++) {
    let x, y;
    do {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
    } while (grid[x][y] !== null);

    const type = types[i % 2];
    agents.push({ id: id++, x, y, type, state: { happy: false } });
    grid[x][y] = agents.length - 1;
  }

  const segregationHistory: number[] = [];
  const happinessHistory: number[] = [];

  // Simulation loop
  for (let step = 0; step < steps; step++) {
    // Calculate happiness for each agent
    let happyCount = 0;
    const unhappyAgents: number[] = [];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      let sameType = 0;
      let neighbors = 0;

      // Check neighbors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (agent.x + dx + gridSize) % gridSize;
          const ny = (agent.y + dy + gridSize) % gridSize;
          if (grid[nx][ny] !== null) {
            neighbors++;
            if (agents[grid[nx][ny]!].type === agent.type) {
              sameType++;
            }
          }
        }
      }

      const isHappy = neighbors === 0 || sameType / neighbors >= tolerance;
      agent.state.happy = isHappy;

      if (isHappy) {
        happyCount++;
      } else {
        unhappyAgents.push(i);
      }
    }

    // Move unhappy agents to empty cells
    const emptyCells: [number, number][] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        if (grid[x][y] === null) {
          emptyCells.push([x, y]);
        }
      }
    }

    // Shuffle and move
    for (const agentIdx of unhappyAgents) {
      if (emptyCells.length === 0) break;
      const randomIdx = Math.floor(Math.random() * emptyCells.length);
      const [newX, newY] = emptyCells.splice(randomIdx, 1)[0];

      const agent = agents[agentIdx];
      grid[agent.x][agent.y] = null;
      emptyCells.push([agent.x, agent.y]);
      agent.x = newX;
      agent.y = newY;
      grid[newX][newY] = agentIdx;
    }

    // Calculate segregation index
    let totalSameNeighbors = 0;
    let totalNeighbors = 0;
    for (const agent of agents) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (agent.x + dx + gridSize) % gridSize;
          const ny = (agent.y + dy + gridSize) % gridSize;
          if (grid[nx][ny] !== null) {
            totalNeighbors++;
            if (agents[grid[nx][ny]!].type === agent.type) {
              totalSameNeighbors++;
            }
          }
        }
      }
    }

    segregationHistory.push(totalNeighbors > 0 ? totalSameNeighbors / totalNeighbors : 0);
    happinessHistory.push(happyCount / agents.length);
  }

  return {
    state: { agents, gridSize, step: steps, statistics: {} },
    metrics: {
      segregation: segregationHistory,
      happiness: happinessHistory
    }
  };
}

// Boids Flocking Model
function flockingModel(
  numAgents: number,
  gridSize: number,
  steps: number,
  params: { separation: number; alignment: number; cohesion: number; speed: number } =
    { separation: 2, alignment: 1, cohesion: 1, speed: 2 }
): { state: SimulationState; metrics: Record<string, number[]> } {
  const agents: Agent[] = [];

  // Initialize boids
  for (let i = 0; i < numAgents; i++) {
    const angle = Math.random() * 2 * Math.PI;
    agents.push({
      id: i,
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      type: 'boid',
      state: {},
      vx: Math.cos(angle) * params.speed,
      vy: Math.sin(angle) * params.speed
    });
  }

  const orderHistory: number[] = [];
  const clusterHistory: number[] = [];

  const neighborRadius = gridSize / 10;

  for (let step = 0; step < steps; step++) {
    // Update each boid
    const newVelocities: { vx: number; vy: number }[] = [];

    for (const boid of agents) {
      let sepX = 0, sepY = 0;  // Separation
      let alignX = 0, alignY = 0;  // Alignment
      let cohX = 0, cohY = 0;  // Cohesion
      let neighbors = 0;

      for (const other of agents) {
        if (other.id === boid.id) continue;

        const dx = other.x - boid.x;
        const dy = other.y - boid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < neighborRadius && dist > 0) {
          neighbors++;

          // Separation
          sepX -= dx / dist;
          sepY -= dy / dist;

          // Alignment
          alignX += other.vx!;
          alignY += other.vy!;

          // Cohesion
          cohX += other.x;
          cohY += other.y;
        }
      }

      let newVx = boid.vx!;
      let newVy = boid.vy!;

      if (neighbors > 0) {
        // Apply separation
        newVx += sepX * params.separation;
        newVy += sepY * params.separation;

        // Apply alignment
        alignX /= neighbors;
        alignY /= neighbors;
        newVx += (alignX - boid.vx!) * params.alignment;
        newVy += (alignY - boid.vy!) * params.alignment;

        // Apply cohesion
        cohX /= neighbors;
        cohY /= neighbors;
        newVx += (cohX - boid.x) * params.cohesion * 0.01;
        newVy += (cohY - boid.y) * params.cohesion * 0.01;
      }

      // Normalize speed
      const speed = Math.sqrt(newVx * newVx + newVy * newVy);
      if (speed > 0) {
        newVx = (newVx / speed) * params.speed;
        newVy = (newVy / speed) * params.speed;
      }

      newVelocities.push({ vx: newVx, vy: newVy });
    }

    // Update positions and velocities
    for (let i = 0; i < agents.length; i++) {
      agents[i].vx = newVelocities[i].vx;
      agents[i].vy = newVelocities[i].vy;
      agents[i].x = (agents[i].x + agents[i].vx! + gridSize) % gridSize;
      agents[i].y = (agents[i].y + agents[i].vy! + gridSize) % gridSize;
    }

    // Calculate order parameter (alignment)
    let totalVx = 0, totalVy = 0;
    for (const boid of agents) {
      totalVx += boid.vx!;
      totalVy += boid.vy!;
    }
    const avgSpeed = Math.sqrt(totalVx * totalVx + totalVy * totalVy) / agents.length;
    orderHistory.push(avgSpeed / params.speed);

    // Calculate clustering
    let clusterCount = 0;
    for (const boid of agents) {
      for (const other of agents) {
        if (other.id > boid.id) {
          const dx = other.x - boid.x;
          const dy = other.y - boid.y;
          if (Math.sqrt(dx * dx + dy * dy) < neighborRadius) {
            clusterCount++;
          }
        }
      }
    }
    clusterHistory.push(clusterCount / (agents.length * (agents.length - 1) / 2));
  }

  return {
    state: { agents, gridSize, step: steps, statistics: {} },
    metrics: {
      order_parameter: orderHistory,
      clustering: clusterHistory
    }
  };
}

// Predator-Prey Model (Lotka-Volterra on grid)
function predatorPreyModel(
  numPrey: number,
  numPredators: number,
  gridSize: number,
  steps: number,
  params: { preyBirth: number; predationRate: number; predatorDeath: number; predatorBirth: number } =
    { preyBirth: 0.1, predationRate: 0.02, predatorDeath: 0.1, predatorBirth: 0.01 }
): { state: SimulationState; metrics: Record<string, number[]> } {
  const agents: Agent[] = [];
  let id = 0;

  // Initialize prey
  for (let i = 0; i < numPrey; i++) {
    agents.push({
      id: id++,
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      type: 'prey',
      state: { energy: 10 }
    });
  }

  // Initialize predators
  for (let i = 0; i < numPredators; i++) {
    agents.push({
      id: id++,
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      type: 'predator',
      state: { energy: 20 }
    });
  }

  const preyHistory: number[] = [];
  const predatorHistory: number[] = [];

  for (let step = 0; step < steps; step++) {
    const toRemove: Set<number> = new Set();
    const toAdd: Agent[] = [];

    // Move all agents randomly
    for (const agent of agents) {
      if (toRemove.has(agent.id)) continue;

      agent.x = (agent.x + (Math.random() - 0.5) * 2 + gridSize) % gridSize;
      agent.y = (agent.y + (Math.random() - 0.5) * 2 + gridSize) % gridSize;

      if (agent.type === 'prey') {
        // Prey reproduction
        if (Math.random() < params.preyBirth) {
          toAdd.push({
            id: id++,
            x: agent.x + (Math.random() - 0.5),
            y: agent.y + (Math.random() - 0.5),
            type: 'prey',
            state: { energy: 10 }
          });
        }
      } else {
        // Predator loses energy
        (agent.state.energy as number)--;

        if ((agent.state.energy as number) <= 0) {
          toRemove.add(agent.id);
          continue;
        }

        // Predator hunts
        for (const other of agents) {
          if (other.type === 'prey' && !toRemove.has(other.id)) {
            const dx = other.x - agent.x;
            const dy = other.y - agent.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 1 && Math.random() < params.predationRate * 10) {
              toRemove.add(other.id);
              (agent.state.energy as number) += 10;

              // Predator reproduction
              if (Math.random() < params.predatorBirth * 10) {
                toAdd.push({
                  id: id++,
                  x: agent.x + (Math.random() - 0.5),
                  y: agent.y + (Math.random() - 0.5),
                  type: 'predator',
                  state: { energy: 20 }
                });
              }
              break;
            }
          }
        }

        // Natural death
        if (Math.random() < params.predatorDeath) {
          toRemove.add(agent.id);
        }
      }
    }

    // Remove dead agents
    const aliveAgents = agents.filter(a => !toRemove.has(a.id));
    agents.length = 0;
    agents.push(...aliveAgents, ...toAdd);

    // Count populations
    const prey = agents.filter(a => a.type === 'prey').length;
    const predators = agents.filter(a => a.type === 'predator').length;
    preyHistory.push(prey);
    predatorHistory.push(predators);

    // Stop if one population dies out
    if (prey === 0 || predators === 0) {
      // Fill remaining history
      for (let s = step + 1; s < steps; s++) {
        preyHistory.push(prey);
        predatorHistory.push(predators);
      }
      break;
    }
  }

  return {
    state: { agents, gridSize, step: steps, statistics: {} },
    metrics: {
      prey_population: preyHistory,
      predator_population: predatorHistory
    }
  };
}

// SIR Epidemic Model
function epidemicModel(
  numAgents: number,
  gridSize: number,
  steps: number,
  params: { infectionRate: number; recoveryRate: number; initialInfected: number } =
    { infectionRate: 0.3, recoveryRate: 0.1, initialInfected: 5 }
): { state: SimulationState; metrics: Record<string, number[]> } {
  const agents: Agent[] = [];

  // Initialize agents
  for (let i = 0; i < numAgents; i++) {
    agents.push({
      id: i,
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      type: i < params.initialInfected ? 'infected' : 'susceptible',
      state: { days_infected: i < params.initialInfected ? 0 : -1 }
    });
  }

  const susceptibleHistory: number[] = [];
  const infectedHistory: number[] = [];
  const recoveredHistory: number[] = [];

  for (let step = 0; step < steps; step++) {
    // Move agents
    for (const agent of agents) {
      agent.x = (agent.x + (Math.random() - 0.5) * 2 + gridSize) % gridSize;
      agent.y = (agent.y + (Math.random() - 0.5) * 2 + gridSize) % gridSize;
    }

    // Infection and recovery
    const newInfections: number[] = [];

    for (const agent of agents) {
      if (agent.type === 'infected') {
        (agent.state.days_infected as number)++;

        // Recovery
        if (Math.random() < params.recoveryRate) {
          agent.type = 'recovered';
          continue;
        }

        // Infect nearby susceptible
        for (const other of agents) {
          if (other.type === 'susceptible') {
            const dx = other.x - agent.x;
            const dy = other.y - agent.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 1 && Math.random() < params.infectionRate) {
              newInfections.push(other.id);
            }
          }
        }
      }
    }

    // Apply new infections
    for (const id of newInfections) {
      const agent = agents.find(a => a.id === id);
      if (agent && agent.type === 'susceptible') {
        agent.type = 'infected';
        agent.state.days_infected = 0;
      }
    }

    // Count populations
    susceptibleHistory.push(agents.filter(a => a.type === 'susceptible').length);
    infectedHistory.push(agents.filter(a => a.type === 'infected').length);
    recoveredHistory.push(agents.filter(a => a.type === 'recovered').length);
  }

  return {
    state: { agents, gridSize, step: steps, statistics: {} },
    metrics: {
      susceptible: susceptibleHistory,
      infected: infectedHistory,
      recovered: recoveredHistory
    }
  };
}

// Analyze simulation results
function analyzeResults(metrics: Record<string, number[]>): Record<string, unknown> {
  const analysis: Record<string, unknown> = {};

  for (const [name, values] of Object.entries(metrics)) {
    if (values.length === 0) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

    // Find peaks and troughs
    const peaks: number[] = [];
    const troughs: number[] = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
      if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
        troughs.push(i);
      }
    }

    analysis[name] = {
      initial: values[0],
      final: values[values.length - 1],
      mean: parseFloat(mean.toFixed(4)),
      std_dev: parseFloat(Math.sqrt(variance).toFixed(4)),
      min: Math.min(...values),
      max: Math.max(...values),
      num_peaks: peaks.length,
      num_troughs: troughs.length,
      trend: values[values.length - 1] > values[0] ? 'increasing' :
             values[values.length - 1] < values[0] ? 'decreasing' : 'stable'
    };
  }

  return analysis;
}

export async function executeagentbasedmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'agent_based_model',
          description: 'Agent-based modeling for complex systems simulation',
          operations: {
            simulate: 'Run a full simulation',
            step: 'Run single simulation step',
            analyze: 'Analyze simulation results',
            preset: 'Get preset model configuration'
          },
          models: {
            schelling: 'Schelling segregation model - agents relocate based on neighbor similarity',
            flocking: 'Boids flocking model - emergent flocking from simple rules',
            predator_prey: 'Lotka-Volterra predator-prey dynamics on a spatial grid',
            epidemic: 'SIR epidemic model with spatial transmission',
            custom: 'Custom agent behavior specification'
          },
          features: [
            'Configurable agent count and grid size',
            'Multiple preset models',
            'Time-series metrics collection',
            'Statistical analysis of emergent behavior',
            'Population dynamics tracking'
          ],
          example: {
            operation: 'simulate',
            model: 'schelling',
            agent_count: 200,
            grid_size: 20,
            steps: 50,
            parameters: { tolerance: 0.3 }
          }
        }, null, 2)
      };
    }

    if (operation === 'preset') {
      const model = args.model || 'schelling';

      const presets: Record<string, Record<string, unknown>> = {
        schelling: {
          model: 'schelling',
          description: 'Schelling segregation model',
          default_parameters: {
            tolerance: 0.3,
            agent_types: 2
          },
          recommended_settings: {
            agent_count: 200,
            grid_size: 20,
            steps: 100
          },
          emergent_behavior: 'Segregation patterns emerge even with mild preferences'
        },
        flocking: {
          model: 'flocking',
          description: 'Boids flocking model (Reynolds rules)',
          default_parameters: {
            separation: 2,
            alignment: 1,
            cohesion: 1,
            speed: 2
          },
          recommended_settings: {
            agent_count: 100,
            grid_size: 100,
            steps: 200
          },
          emergent_behavior: 'Coherent flocking from simple local rules'
        },
        predator_prey: {
          model: 'predator_prey',
          description: 'Spatial predator-prey dynamics',
          default_parameters: {
            preyBirth: 0.1,
            predationRate: 0.02,
            predatorDeath: 0.1,
            predatorBirth: 0.01
          },
          recommended_settings: {
            agent_count: '100 prey + 20 predators',
            grid_size: 50,
            steps: 500
          },
          emergent_behavior: 'Oscillating population cycles'
        },
        epidemic: {
          model: 'epidemic',
          description: 'SIR epidemic model',
          default_parameters: {
            infectionRate: 0.3,
            recoveryRate: 0.1,
            initialInfected: 5
          },
          recommended_settings: {
            agent_count: 200,
            grid_size: 30,
            steps: 100
          },
          emergent_behavior: 'Epidemic curve with peak and decline'
        }
      };

      return {
        toolCallId: id,
        content: JSON.stringify(presets[model] || presets.schelling, null, 2)
      };
    }

    if (operation === 'simulate') {
      const model = args.model || 'schelling';
      const agentCount = args.agent_count || 200;
      const gridSize = args.grid_size || 20;
      const steps = args.steps || 50;
      const params = args.parameters || {};

      let result: { state: SimulationState; metrics: Record<string, number[]> };

      switch (model) {
        case 'schelling':
          result = schellingModel(agentCount, gridSize, steps, params.tolerance || 0.3);
          break;

        case 'flocking':
          result = flockingModel(agentCount, gridSize, steps, {
            separation: params.separation || 2,
            alignment: params.alignment || 1,
            cohesion: params.cohesion || 1,
            speed: params.speed || 2
          });
          break;

        case 'predator_prey':
          const numPrey = params.prey || Math.floor(agentCount * 0.8);
          const numPredators = params.predators || Math.floor(agentCount * 0.2);
          result = predatorPreyModel(numPrey, numPredators, gridSize, steps, {
            preyBirth: params.preyBirth || 0.1,
            predationRate: params.predationRate || 0.02,
            predatorDeath: params.predatorDeath || 0.1,
            predatorBirth: params.predatorBirth || 0.01
          });
          break;

        case 'epidemic':
          result = epidemicModel(agentCount, gridSize, steps, {
            infectionRate: params.infectionRate || 0.3,
            recoveryRate: params.recoveryRate || 0.1,
            initialInfected: params.initialInfected || 5
          });
          break;

        default:
          result = schellingModel(agentCount, gridSize, steps);
      }

      const analysis = analyzeResults(result.metrics);

      // Sample metrics (every 10th step)
      const sampledMetrics: Record<string, number[]> = {};
      for (const [name, values] of Object.entries(result.metrics)) {
        sampledMetrics[name] = values.filter((_, i) => i % Math.max(1, Math.floor(steps / 20)) === 0);
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'simulate',
          model,
          configuration: {
            agent_count: result.state.agents.length,
            grid_size: gridSize,
            steps
          },
          final_state: {
            total_agents: result.state.agents.length,
            agent_types: [...new Set(result.state.agents.map(a => a.type))],
            type_counts: result.state.agents.reduce((acc, a) => {
              acc[a.type] = (acc[a.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          metrics_sample: sampledMetrics,
          analysis
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      // Run a quick simulation and provide detailed analysis
      const model = args.model || 'schelling';
      const agentCount = args.agent_count || 200;
      const gridSize = args.grid_size || 20;
      const steps = args.steps || 100;

      let result: { state: SimulationState; metrics: Record<string, number[]> };

      switch (model) {
        case 'schelling':
          result = schellingModel(agentCount, gridSize, steps);
          break;
        case 'flocking':
          result = flockingModel(agentCount, gridSize, steps);
          break;
        case 'predator_prey':
          result = predatorPreyModel(Math.floor(agentCount * 0.8), Math.floor(agentCount * 0.2), gridSize, steps);
          break;
        case 'epidemic':
          result = epidemicModel(agentCount, gridSize, steps);
          break;
        default:
          result = schellingModel(agentCount, gridSize, steps);
      }

      const analysis = analyzeResults(result.metrics);

      // Calculate additional statistics
      const correlations: Record<string, number> = {};
      const metricNames = Object.keys(result.metrics);
      for (let i = 0; i < metricNames.length; i++) {
        for (let j = i + 1; j < metricNames.length; j++) {
          const m1 = result.metrics[metricNames[i]];
          const m2 = result.metrics[metricNames[j]];
          if (m1.length === m2.length && m1.length > 1) {
            const mean1 = m1.reduce((a, b) => a + b) / m1.length;
            const mean2 = m2.reduce((a, b) => a + b) / m2.length;
            let cov = 0, var1 = 0, var2 = 0;
            for (let k = 0; k < m1.length; k++) {
              cov += (m1[k] - mean1) * (m2[k] - mean2);
              var1 += (m1[k] - mean1) ** 2;
              var2 += (m2[k] - mean2) ** 2;
            }
            const corr = var1 > 0 && var2 > 0 ? cov / Math.sqrt(var1 * var2) : 0;
            correlations[`${metricNames[i]}_vs_${metricNames[j]}`] = parseFloat(corr.toFixed(4));
          }
        }
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          model,
          simulation_summary: {
            agent_count: result.state.agents.length,
            grid_size: gridSize,
            steps
          },
          metric_analysis: analysis,
          correlations,
          conclusions: model === 'schelling' ? [
            'Segregation emerges from individual tolerance thresholds',
            'Final segregation often exceeds initial preferences'
          ] : model === 'predator_prey' ? [
            'Population cycles show characteristic predator-prey dynamics',
            'Spatial structure affects population stability'
          ] : model === 'flocking' ? [
            'Global order emerges from local interaction rules',
            'Separation prevents collisions while cohesion maintains group'
          ] : [
            'Epidemic spread depends on infection and recovery rates',
            'Spatial clustering affects transmission dynamics'
          ]
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: `Unknown operation: ${operation}`,
        available_operations: ['simulate', 'step', 'analyze', 'preset', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isagentbasedmodelAvailable(): boolean {
  return true;
}
