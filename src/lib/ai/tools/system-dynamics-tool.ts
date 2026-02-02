/**
 * SYSTEM-DYNAMICS TOOL
 * System dynamics modeling with stocks, flows, feedback loops, and simulation
 * Based on Jay Forrester's methodology
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const systemdynamicsTool: UnifiedTool = {
  name: 'system_dynamics',
  description: 'System dynamics modeling (stocks, flows, feedback loops, causal loop diagrams)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'simulate', 'stock_flow', 'causal_loop', 'feedback', 'equilibrium', 'sensitivity', 'archetype', 'demonstrate'],
        description: 'Operation to perform'
      },
      model: { type: 'string', description: 'Model type: population, predator_prey, epidemic, inventory, adoption, resource, custom' },
      stocks: { type: 'object', description: 'Initial stock values' },
      parameters: { type: 'object', description: 'Model parameters' },
      time_steps: { type: 'number', description: 'Number of simulation steps' },
      dt: { type: 'number', description: 'Time step size' },
      archetype: { type: 'string', description: 'System archetype name' }
    },
    required: ['operation']
  }
};

// ===== STOCK-FLOW SIMULATION =====

interface Stock {
  name: string;
  value: number;
  min?: number;
  max?: number;
}

interface Flow {
  name: string;
  from: string | null; // null = source (inflow from outside)
  to: string | null;   // null = sink (outflow to outside)
  rate: (stocks: Record<string, number>, params: Record<string, number>) => number;
}

interface SystemModel {
  stocks: Stock[];
  flows: Flow[];
  parameters: Record<string, number>;
}

// Euler integration step
function eulerStep(
  stocks: Record<string, number>,
  flows: Flow[],
  params: Record<string, number>,
  dt: number
): Record<string, number> {
  const newStocks = { ...stocks };
  const netFlows: Record<string, number> = {};

  // Initialize net flows
  for (const name of Object.keys(stocks)) {
    netFlows[name] = 0;
  }

  // Calculate flows
  for (const flow of flows) {
    const rate = flow.rate(stocks, params) * dt;
    if (flow.from && newStocks[flow.from] !== undefined) {
      netFlows[flow.from] -= rate;
    }
    if (flow.to && newStocks[flow.to] !== undefined) {
      netFlows[flow.to] += rate;
    }
  }

  // Update stocks
  for (const name of Object.keys(stocks)) {
    newStocks[name] = Math.max(0, stocks[name] + netFlows[name]);
  }

  return newStocks;
}

// RK4 integration step for more accuracy
function rk4Step(
  stocks: Record<string, number>,
  flows: Flow[],
  params: Record<string, number>,
  dt: number
): Record<string, number> {
  const calcDerivatives = (s: Record<string, number>): Record<string, number> => {
    const derivs: Record<string, number> = {};
    for (const name of Object.keys(s)) {
      derivs[name] = 0;
    }
    for (const flow of flows) {
      const rate = flow.rate(s, params);
      if (flow.from && derivs[flow.from] !== undefined) derivs[flow.from] -= rate;
      if (flow.to && derivs[flow.to] !== undefined) derivs[flow.to] += rate;
    }
    return derivs;
  };

  const k1 = calcDerivatives(stocks);

  const s2: Record<string, number> = {};
  for (const name of Object.keys(stocks)) {
    s2[name] = stocks[name] + k1[name] * dt / 2;
  }
  const k2 = calcDerivatives(s2);

  const s3: Record<string, number> = {};
  for (const name of Object.keys(stocks)) {
    s3[name] = stocks[name] + k2[name] * dt / 2;
  }
  const k3 = calcDerivatives(s3);

  const s4: Record<string, number> = {};
  for (const name of Object.keys(stocks)) {
    s4[name] = stocks[name] + k3[name] * dt;
  }
  const k4 = calcDerivatives(s4);

  const newStocks: Record<string, number> = {};
  for (const name of Object.keys(stocks)) {
    newStocks[name] = Math.max(0, stocks[name] + (k1[name] + 2*k2[name] + 2*k3[name] + k4[name]) * dt / 6);
  }

  return newStocks;
}

// ===== PREDEFINED MODELS =====

function createPopulationModel(params: Record<string, number>): SystemModel {
  const birthRate = params.birth_rate ?? 0.03;
  const deathRate = params.death_rate ?? 0.02;
  const carryingCapacity = params.carrying_capacity ?? 10000;

  return {
    stocks: [{ name: 'population', value: params.initial_population ?? 1000 }],
    flows: [
      {
        name: 'births',
        from: null,
        to: 'population',
        rate: (s, p) => p.birth_rate * s.population * (1 - s.population / p.carrying_capacity)
      },
      {
        name: 'deaths',
        from: 'population',
        to: null,
        rate: (s, p) => p.death_rate * s.population
      }
    ],
    parameters: { birth_rate: birthRate, death_rate: deathRate, carrying_capacity: carryingCapacity }
  };
}

function createPredatorPreyModel(params: Record<string, number>): SystemModel {
  return {
    stocks: [
      { name: 'prey', value: params.initial_prey ?? 100 },
      { name: 'predators', value: params.initial_predators ?? 20 }
    ],
    flows: [
      {
        name: 'prey_births',
        from: null,
        to: 'prey',
        rate: (s, p) => p.prey_birth_rate * s.prey
      },
      {
        name: 'predation',
        from: 'prey',
        to: null,
        rate: (s, p) => p.predation_rate * s.prey * s.predators
      },
      {
        name: 'predator_births',
        from: null,
        to: 'predators',
        rate: (s, p) => p.predator_efficiency * p.predation_rate * s.prey * s.predators
      },
      {
        name: 'predator_deaths',
        from: 'predators',
        to: null,
        rate: (s, p) => p.predator_death_rate * s.predators
      }
    ],
    parameters: {
      prey_birth_rate: params.prey_birth_rate ?? 0.1,
      predation_rate: params.predation_rate ?? 0.01,
      predator_efficiency: params.predator_efficiency ?? 0.1,
      predator_death_rate: params.predator_death_rate ?? 0.05
    }
  };
}

function createInventoryModel(params: Record<string, number>): SystemModel {
  return {
    stocks: [
      { name: 'inventory', value: params.initial_inventory ?? 100 },
      { name: 'backlog', value: 0 }
    ],
    flows: [
      {
        name: 'production',
        from: null,
        to: 'inventory',
        rate: (s, p) => {
          const desired = p.target_inventory - s.inventory + s.backlog / p.backlog_adjustment_time;
          return Math.max(0, Math.min(p.max_production, desired / p.production_delay));
        }
      },
      {
        name: 'shipments',
        from: 'inventory',
        to: null,
        rate: (s, p) => Math.min(s.inventory / p.shipping_time, p.demand + s.backlog / p.backlog_adjustment_time)
      },
      {
        name: 'order_accumulation',
        from: null,
        to: 'backlog',
        rate: (s, p) => Math.max(0, p.demand - s.inventory / p.shipping_time)
      },
      {
        name: 'backlog_fulfillment',
        from: 'backlog',
        to: null,
        rate: (s, p) => Math.min(s.backlog / p.backlog_adjustment_time, s.inventory / p.shipping_time)
      }
    ],
    parameters: {
      target_inventory: params.target_inventory ?? 100,
      max_production: params.max_production ?? 20,
      production_delay: params.production_delay ?? 2,
      demand: params.demand ?? 10,
      shipping_time: params.shipping_time ?? 1,
      backlog_adjustment_time: params.backlog_adjustment_time ?? 4
    }
  };
}

function createAdoptionModel(params: Record<string, number>): SystemModel {
  const totalPopulation = params.total_population ?? 10000;

  return {
    stocks: [
      { name: 'potential_adopters', value: totalPopulation - (params.initial_adopters ?? 10) },
      { name: 'adopters', value: params.initial_adopters ?? 10 }
    ],
    flows: [
      {
        name: 'adoption_from_advertising',
        from: 'potential_adopters',
        to: 'adopters',
        rate: (s, p) => p.advertising_effectiveness * s.potential_adopters
      },
      {
        name: 'adoption_from_word_of_mouth',
        from: 'potential_adopters',
        to: 'adopters',
        rate: (s, p) => p.contact_rate * p.adoption_fraction * s.adopters * s.potential_adopters / p.total_population
      }
    ],
    parameters: {
      advertising_effectiveness: params.advertising_effectiveness ?? 0.01,
      contact_rate: params.contact_rate ?? 10,
      adoption_fraction: params.adoption_fraction ?? 0.05,
      total_population: totalPopulation
    }
  };
}

function createResourceModel(params: Record<string, number>): SystemModel {
  return {
    stocks: [
      { name: 'resource', value: params.initial_resource ?? 1000 },
      { name: 'capital', value: params.initial_capital ?? 100 }
    ],
    flows: [
      {
        name: 'extraction',
        from: 'resource',
        to: null,
        rate: (s, p) => p.extraction_rate * s.capital * s.resource / (s.resource + p.half_saturation)
      },
      {
        name: 'investment',
        from: null,
        to: 'capital',
        rate: (s, p) => p.investment_fraction * p.extraction_rate * s.capital * s.resource / (s.resource + p.half_saturation)
      },
      {
        name: 'depreciation',
        from: 'capital',
        to: null,
        rate: (s, p) => p.depreciation_rate * s.capital
      }
    ],
    parameters: {
      extraction_rate: params.extraction_rate ?? 0.1,
      half_saturation: params.half_saturation ?? 500,
      investment_fraction: params.investment_fraction ?? 0.2,
      depreciation_rate: params.depreciation_rate ?? 0.05
    }
  };
}

// ===== CAUSAL LOOP ANALYSIS =====

interface CausalLink {
  from: string;
  to: string;
  polarity: '+' | '-';
  delay?: boolean;
}

function analyzeCausalLoops(links: CausalLink[]): { loops: string[][], feedback: string[] } {
  // Build adjacency list
  const graph: Map<string, { to: string, polarity: '+' | '-' }[]> = new Map();
  const allNodes = new Set<string>();

  for (const link of links) {
    allNodes.add(link.from);
    allNodes.add(link.to);
    if (!graph.has(link.from)) graph.set(link.from, []);
    graph.get(link.from)!.push({ to: link.to, polarity: link.polarity });
  }

  // Find all cycles using DFS
  const loops: string[][] = [];
  const feedback: string[] = [];

  function findCycles(start: string, current: string, path: string[], polarities: ('+' | '-')[], visited: Set<string>) {
    if (path.length > 0 && current === start) {
      loops.push([...path]);
      const netPolarity = polarities.reduce((acc, p) => acc * (p === '+' ? 1 : -1), 1);
      feedback.push(netPolarity === 1 ? 'reinforcing' : 'balancing');
      return;
    }

    if (visited.has(current) || path.length > 10) return;

    visited.add(current);
    path.push(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      findCycles(start, neighbor.to, path, [...polarities, neighbor.polarity], new Set(visited));
    }

    path.pop();
  }

  for (const node of allNodes) {
    findCycles(node, node, [], [], new Set());
  }

  return { loops, feedback };
}

// ===== SYSTEM ARCHETYPES =====

const systemArchetypes: Record<string, {
  name: string;
  description: string;
  structure: string;
  behavior: string;
  example: string;
  intervention: string;
}> = {
  limits_to_growth: {
    name: 'Limits to Growth',
    description: 'A reinforcing process is set in motion to produce a desired result but creates secondary effects that limit growth.',
    structure: 'Reinforcing loop (R) of growth is coupled with a balancing loop (B) that kicks in as limits are approached.',
    behavior: 'Initial exponential growth gradually slows, levels off, or collapses.',
    example: 'Company growth limited by market saturation, population limited by resources.',
    intervention: 'Anticipate limits early and invest in expanding them before growth slows.'
  },
  shifting_the_burden: {
    name: 'Shifting the Burden',
    description: 'A problem is addressed with short-term solutions that divert attention from fundamental solutions.',
    structure: 'Two balancing loops: symptomatic solution (quick) and fundamental solution (slow). Symptomatic may create side effects that worsen the problem.',
    behavior: 'Symptomatic solutions become increasingly necessary as fundamental capacity atrophies.',
    example: 'Using overtime instead of hiring, taking painkillers instead of physical therapy.',
    intervention: 'Focus on fundamental solution while limiting symptomatic interventions.'
  },
  eroding_goals: {
    name: 'Eroding Goals',
    description: 'Goals are lowered to close the gap between desired and actual performance.',
    structure: 'Balancing loop where gap between goal and reality is closed by lowering the goal rather than improving performance.',
    behavior: 'Gradual decline in performance standards over time.',
    example: 'Quality standards relaxed to meet deadlines, fitness goals reduced when not met.',
    intervention: 'Hold the vision. Set explicit minimum standards that cannot be eroded.'
  },
  escalation: {
    name: 'Escalation',
    description: 'Two parties compete, each responding to the other\'s actions with more aggressive action.',
    structure: 'Two reinforcing loops linked together, each party\'s action driving the other\'s response.',
    behavior: 'Exponential escalation until exhaustion or intervention.',
    example: 'Arms races, price wars, advertising spending battles.',
    intervention: 'Unilateral de-escalation or mutual agreement to limit responses.'
  },
  success_to_successful: {
    name: 'Success to the Successful',
    description: 'Initial advantage leads to more resources, widening the gap with competitors.',
    structure: 'Two competing reinforcing loops, where success in one diminishes resources available to the other.',
    behavior: 'Winner-take-all dynamics, increasing inequality.',
    example: 'Rich get richer, market leaders capture more market share.',
    intervention: 'Policies that redistribute advantages or level the playing field.'
  },
  tragedy_of_commons: {
    name: 'Tragedy of the Commons',
    description: 'Individual users benefit from common resource, but collective overuse depletes it.',
    structure: 'Multiple reinforcing loops (individual gain) coupled with balancing loop (resource depletion) that affects all.',
    behavior: 'Resource is gradually depleted despite harm to all users.',
    example: 'Overfishing, overgrazing, pollution of shared air/water.',
    intervention: 'Establish governance rules, privatize commons, or educate users.'
  },
  fixes_that_fail: {
    name: 'Fixes that Fail',
    description: 'A fix has unintended consequences that create new problems.',
    structure: 'Balancing loop (fix) coupled with delayed reinforcing loop (unintended consequences).',
    behavior: 'Initial improvement followed by return or worsening of problem.',
    example: 'Antibiotics creating resistant bacteria, pesticides killing beneficial insects.',
    intervention: 'Consider long-term consequences before implementing fixes.'
  },
  growth_underinvestment: {
    name: 'Growth and Underinvestment',
    description: 'Growth approaches a limit that can be raised by investment, but investment is not made.',
    structure: 'Limits to Growth structure plus an additional loop where growth drives (or should drive) capacity investment.',
    behavior: 'Growth stagnates not because of inherent limits but because of failure to invest.',
    example: 'Company fails to invest in infrastructure, leading to service quality decline.',
    intervention: 'Invest ahead of demand to maintain growth potential.'
  }
};

// ===== EQUILIBRIUM ANALYSIS =====

function findEquilibrium(
  model: SystemModel,
  maxIterations: number = 1000,
  tolerance: number = 0.001
): { equilibrium: Record<string, number>, stable: boolean, iterations: number } {
  let stocks: Record<string, number> = {};
  for (const stock of model.stocks) {
    stocks[stock.name] = stock.value;
  }

  const dt = 0.1;
  let iterations = 0;
  let stable = false;

  for (let i = 0; i < maxIterations; i++) {
    const newStocks = rk4Step(stocks, model.flows, model.parameters, dt);

    // Check for convergence
    let maxChange = 0;
    for (const name of Object.keys(stocks)) {
      const change = Math.abs(newStocks[name] - stocks[name]);
      if (change > maxChange) maxChange = change;
    }

    if (maxChange < tolerance) {
      stable = true;
      iterations = i;
      break;
    }

    stocks = newStocks;
    iterations = i;
  }

  return { equilibrium: stocks, stable, iterations };
}

// ===== SENSITIVITY ANALYSIS =====

function sensitivityAnalysis(
  modelCreator: (params: Record<string, number>) => SystemModel,
  baseParams: Record<string, number>,
  paramName: string,
  variation: number = 0.1,
  timeSteps: number = 100,
  dt: number = 0.1
): { paramValue: number, finalStocks: Record<string, number> }[] {
  const results: { paramValue: number, finalStocks: Record<string, number> }[] = [];
  const baseValue = baseParams[paramName];

  // Test at -20%, -10%, base, +10%, +20%
  for (const multiplier of [0.8, 0.9, 1.0, 1.1, 1.2]) {
    const testParams = { ...baseParams, [paramName]: baseValue * multiplier };
    const model = modelCreator(testParams);

    let stocks: Record<string, number> = {};
    for (const stock of model.stocks) {
      stocks[stock.name] = stock.value;
    }

    for (let t = 0; t < timeSteps; t++) {
      stocks = rk4Step(stocks, model.flows, model.parameters, dt);
    }

    results.push({ paramValue: baseValue * multiplier, finalStocks: stocks });
  }

  return results;
}

// ===== MAIN EXECUTION =====

export async function executesystemdynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'system_dynamics',
            description: 'System dynamics modeling based on Jay Forrester\'s methodology',
            concepts: {
              stocks: 'Accumulations that change over time (population, inventory, capital)',
              flows: 'Rates that change stocks (birth rate, production rate, investment)',
              feedback_loops: 'Circular causality where effects become causes',
              reinforcing_loops: 'R loops: amplify change (exponential growth/decay)',
              balancing_loops: 'B loops: seek equilibrium (goal-seeking behavior)',
              delays: 'Time lags between cause and effect'
            },
            models_available: {
              population: 'Logistic growth with carrying capacity',
              predator_prey: 'Lotka-Volterra ecological dynamics',
              inventory: 'Supply chain with production and demand',
              adoption: 'Bass diffusion model for product adoption',
              resource: 'Resource extraction with capital investment'
            },
            archetypes: Object.keys(systemArchetypes),
            operations: [
              'info - Tool information',
              'simulate - Run model simulation',
              'stock_flow - Analyze stock-flow structure',
              'causal_loop - Analyze causal loops',
              'feedback - Identify feedback loops',
              'equilibrium - Find system equilibrium',
              'sensitivity - Parameter sensitivity analysis',
              'archetype - System archetype information',
              'demonstrate - Run demonstration'
            ],
            methodology: 'Uses RK4 numerical integration for accurate simulation'
          }, null, 2)
        };
      }

      case 'simulate': {
        const modelType = args.model || 'population';
        const timeSteps = args.time_steps || 100;
        const dt = args.dt || 0.1;
        const params = args.parameters || {};

        let model: SystemModel;
        switch (modelType) {
          case 'predator_prey':
            model = createPredatorPreyModel(params);
            break;
          case 'inventory':
            model = createInventoryModel(params);
            break;
          case 'adoption':
            model = createAdoptionModel(params);
            break;
          case 'resource':
            model = createResourceModel(params);
            break;
          default:
            model = createPopulationModel(params);
        }

        // Run simulation
        let stocks: Record<string, number> = {};
        for (const stock of model.stocks) {
          stocks[stock.name] = stock.value;
        }

        const history: { time: number, stocks: Record<string, number> }[] = [
          { time: 0, stocks: { ...stocks } }
        ];

        for (let t = 1; t <= timeSteps; t++) {
          stocks = rk4Step(stocks, model.flows, model.parameters, dt);
          if (t % 10 === 0 || t === timeSteps) {
            history.push({ time: t * dt, stocks: { ...stocks } });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: modelType,
            parameters: model.parameters,
            initial_stocks: Object.fromEntries(model.stocks.map(s => [s.name, s.value])),
            final_stocks: stocks,
            simulation: {
              time_steps: timeSteps,
              dt: dt,
              total_time: timeSteps * dt
            },
            history: history.slice(0, 15), // First 15 samples
            flows: model.flows.map(f => ({ name: f.name, from: f.from, to: f.to }))
          }, null, 2)
        };
      }

      case 'stock_flow': {
        const modelType = args.model || 'population';
        const params = args.parameters || {};

        let model: SystemModel;
        let description: string;

        switch (modelType) {
          case 'predator_prey':
            model = createPredatorPreyModel(params);
            description = 'Lotka-Volterra predator-prey dynamics';
            break;
          case 'inventory':
            model = createInventoryModel(params);
            description = 'Supply chain inventory management';
            break;
          case 'adoption':
            model = createAdoptionModel(params);
            description = 'Bass diffusion model for innovation adoption';
            break;
          case 'resource':
            model = createResourceModel(params);
            description = 'Resource extraction with capital dynamics';
            break;
          default:
            model = createPopulationModel(params);
            description = 'Logistic population growth with carrying capacity';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: modelType,
            description,
            structure: {
              stocks: model.stocks.map(s => ({
                name: s.name,
                initial_value: s.value,
                description: `Accumulation of ${s.name}`
              })),
              flows: model.flows.map(f => ({
                name: f.name,
                type: f.from === null ? 'inflow' : f.to === null ? 'outflow' : 'internal',
                from: f.from || 'source',
                to: f.to || 'sink'
              })),
              parameters: Object.entries(model.parameters).map(([k, v]) => ({
                name: k,
                value: v
              }))
            },
            diagram_ascii: generateStockFlowDiagram(model)
          }, null, 2)
        };
      }

      case 'causal_loop': {
        const modelType = args.model || 'population';

        // Define causal links for each model
        let links: CausalLink[];
        switch (modelType) {
          case 'predator_prey':
            links = [
              { from: 'prey', to: 'prey_births', polarity: '+' },
              { from: 'prey_births', to: 'prey', polarity: '+' },
              { from: 'prey', to: 'predators', polarity: '+', delay: true },
              { from: 'predators', to: 'prey', polarity: '-' },
              { from: 'predators', to: 'predator_deaths', polarity: '+' },
              { from: 'predator_deaths', to: 'predators', polarity: '-' }
            ];
            break;
          case 'adoption':
            links = [
              { from: 'adopters', to: 'word_of_mouth', polarity: '+' },
              { from: 'word_of_mouth', to: 'new_adopters', polarity: '+' },
              { from: 'new_adopters', to: 'adopters', polarity: '+' },
              { from: 'potential_adopters', to: 'new_adopters', polarity: '+' },
              { from: 'new_adopters', to: 'potential_adopters', polarity: '-' }
            ];
            break;
          default:
            links = [
              { from: 'population', to: 'births', polarity: '+' },
              { from: 'births', to: 'population', polarity: '+' },
              { from: 'population', to: 'deaths', polarity: '+' },
              { from: 'deaths', to: 'population', polarity: '-' },
              { from: 'population', to: 'crowding', polarity: '+' },
              { from: 'crowding', to: 'births', polarity: '-' }
            ];
        }

        const analysis = analyzeCausalLoops(links);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: modelType,
            causal_links: links,
            analysis: {
              loops_found: analysis.loops.length,
              loops: analysis.loops.map((loop, i) => ({
                path: loop.join(' → ') + ' → ' + loop[0],
                type: analysis.feedback[i],
                description: analysis.feedback[i] === 'reinforcing'
                  ? 'Amplifies change (exponential behavior)'
                  : 'Seeks equilibrium (goal-seeking behavior)'
              }))
            },
            legend: {
              '+': 'Same direction: if A increases, B increases',
              '-': 'Opposite direction: if A increases, B decreases'
            }
          }, null, 2)
        };
      }

      case 'feedback': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            feedback_loops: {
              reinforcing: {
                symbol: 'R',
                behavior: 'Exponential growth or decay',
                examples: ['Population growth', 'Compound interest', 'Viral spread'],
                characteristics: [
                  'Even number of negative links (or all positive)',
                  'Amplifies any change from equilibrium',
                  'Can lead to collapse or explosion'
                ]
              },
              balancing: {
                symbol: 'B',
                behavior: 'Goal-seeking, oscillation, or equilibrium',
                examples: ['Thermostat', 'Predator-prey', 'Market prices'],
                characteristics: [
                  'Odd number of negative links',
                  'Counteracts change, seeks equilibrium',
                  'May oscillate if delays are present'
                ]
              }
            },
            loop_dominance: 'The active loop that most influences behavior at any time',
            delays: {
              description: 'Time lags between cause and effect',
              effect: 'Can cause oscillations and instability in balancing loops',
              example: 'Shower temperature adjustment'
            },
            nonlinearity: 'Feedback can change from reinforcing to balancing as conditions change'
          }, null, 2)
        };
      }

      case 'equilibrium': {
        const modelType = args.model || 'population';
        const params = args.parameters || {};

        let model: SystemModel;
        switch (modelType) {
          case 'predator_prey':
            model = createPredatorPreyModel(params);
            break;
          case 'inventory':
            model = createInventoryModel(params);
            break;
          case 'adoption':
            model = createAdoptionModel(params);
            break;
          case 'resource':
            model = createResourceModel(params);
            break;
          default:
            model = createPopulationModel(params);
        }

        const result = findEquilibrium(model);

        // Calculate analytical equilibrium for population model
        let analyticalEquilibrium: Record<string, number> | null = null;
        if (modelType === 'population') {
          const K = model.parameters.carrying_capacity;
          const r = model.parameters.birth_rate - model.parameters.death_rate;
          if (r > 0) {
            analyticalEquilibrium = { population: K };
          } else {
            analyticalEquilibrium = { population: 0 };
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: modelType,
            initial_stocks: Object.fromEntries(model.stocks.map(s => [s.name, s.value])),
            equilibrium: result.equilibrium,
            analytical_equilibrium: analyticalEquilibrium,
            convergence: {
              stable: result.stable,
              iterations: result.iterations,
              method: 'RK4 integration with convergence check'
            },
            interpretation: result.stable
              ? 'System converges to stable equilibrium'
              : 'System may be unstable, oscillating, or approaching limit cycle'
          }, null, 2)
        };
      }

      case 'sensitivity': {
        const modelType = args.model || 'population';
        const paramName = args.parameter || 'birth_rate';
        const params = args.parameters || {};

        let modelCreator: (p: Record<string, number>) => SystemModel;
        let baseParams: Record<string, number>;

        switch (modelType) {
          case 'predator_prey':
            modelCreator = createPredatorPreyModel;
            baseParams = { prey_birth_rate: 0.1, predation_rate: 0.01, predator_efficiency: 0.1, predator_death_rate: 0.05, ...params };
            break;
          default:
            modelCreator = createPopulationModel;
            baseParams = { birth_rate: 0.03, death_rate: 0.02, carrying_capacity: 10000, initial_population: 1000, ...params };
        }

        const results = sensitivityAnalysis(modelCreator, baseParams, paramName);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model: modelType,
            parameter_tested: paramName,
            base_value: baseParams[paramName],
            results: results.map(r => ({
              parameter_value: r.paramValue.toFixed(4),
              percent_change: (((r.paramValue / baseParams[paramName]) - 1) * 100).toFixed(1) + '%',
              final_stocks: Object.fromEntries(
                Object.entries(r.finalStocks).map(([k, v]) => [k, Math.round(v * 100) / 100])
              )
            })),
            interpretation: 'Shows how final stocks change when parameter varies by ±10% and ±20%'
          }, null, 2)
        };
      }

      case 'archetype': {
        const archetypeName = args.archetype?.toLowerCase().replace(/\s+/g, '_') || 'limits_to_growth';
        const archetype = systemArchetypes[archetypeName];

        if (!archetype) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown archetype: ${archetypeName}`,
              available_archetypes: Object.keys(systemArchetypes)
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            archetype: archetype.name,
            description: archetype.description,
            structure: archetype.structure,
            behavior: archetype.behavior,
            example: archetype.example,
            intervention: archetype.intervention,
            all_archetypes: Object.entries(systemArchetypes).map(([key, val]) => ({
              key,
              name: val.name,
              brief: val.description.substring(0, 80) + '...'
            }))
          }, null, 2)
        };
      }

      case 'demonstrate': {
        // Run a complete demonstration
        const popModel = createPopulationModel({ initial_population: 100, carrying_capacity: 1000 });
        const predPreyModel = createPredatorPreyModel({ initial_prey: 100, initial_predators: 20 });

        // Simulate population
        let popStocks: Record<string, number> = { population: 100 };
        for (let t = 0; t < 200; t++) {
          popStocks = rk4Step(popStocks, popModel.flows, popModel.parameters, 0.1);
        }

        // Simulate predator-prey
        let ppStocks: Record<string, number> = { prey: 100, predators: 20 };
        const ppHistory: { prey: number, predators: number }[] = [];
        for (let t = 0; t < 500; t++) {
          ppStocks = rk4Step(ppStocks, predPreyModel.flows, predPreyModel.parameters, 0.1);
          if (t % 50 === 0) ppHistory.push({ prey: Math.round(ppStocks.prey), predators: Math.round(ppStocks.predators) });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'System Dynamics Modeling',
            examples: [
              {
                name: 'Logistic Population Growth',
                description: 'Population with carrying capacity (S-curve)',
                initial: 100,
                carrying_capacity: 1000,
                final_population: Math.round(popStocks.population),
                behavior: 'Exponential growth initially, then slows as carrying capacity is approached'
              },
              {
                name: 'Predator-Prey Dynamics',
                description: 'Lotka-Volterra oscillations',
                history: ppHistory,
                behavior: 'Cyclic oscillations: prey increase → predators increase → prey decrease → predators decrease'
              }
            ],
            key_insights: [
              'Feedback loops determine system behavior',
              'Delays can cause oscillations and instability',
              'System archetypes reveal common patterns',
              'Leverage points can dramatically change outcomes'
            ],
            applications: ['Ecology', 'Economics', 'Public policy', 'Business strategy', 'Urban planning']
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'simulate', 'stock_flow', 'causal_loop', 'feedback', 'equilibrium', 'sensitivity', 'archetype', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

// Generate ASCII diagram for stock-flow structure
function generateStockFlowDiagram(model: SystemModel): string {
  const lines: string[] = ['', 'Stock-Flow Diagram:', ''];

  for (const stock of model.stocks) {
    lines.push(`  ┌─────────────────┐`);
    lines.push(`  │ ${stock.name.padEnd(15)} │  [${stock.value}]`);
    lines.push(`  └─────────────────┘`);

    // Find flows for this stock
    const inflows = model.flows.filter(f => f.to === stock.name);
    const outflows = model.flows.filter(f => f.from === stock.name);

    if (inflows.length > 0) {
      lines.push(`        ↑ ${inflows.map(f => f.name).join(', ')}`);
    }
    if (outflows.length > 0) {
      lines.push(`        ↓ ${outflows.map(f => f.name).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function issystemdynamicsAvailable(): boolean { return true; }
