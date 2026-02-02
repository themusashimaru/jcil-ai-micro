/**
 * SYSTEM-DYNAMICS TOOL
 * Comprehensive system dynamics modeling with stocks, flows, and feedback loops
 * Implements Forrester's system dynamics methodology for complex systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Stock {
  name: string;
  value: number;
  initialValue: number;
  unit: string;
  minValue?: number;
  maxValue?: number;
}

interface Flow {
  name: string;
  from: string | null;   // null = source (from environment)
  to: string | null;     // null = sink (to environment)
  equation: string;
  value: number;
  unit: string;
}

interface Auxiliary {
  name: string;
  equation: string;
  value: number;
  unit: string;
}

interface FeedbackLoop {
  name: string;
  variables: string[];
  type: 'reinforcing' | 'balancing';
  description: string;
}

interface SystemModel {
  name: string;
  stocks: Map<string, Stock>;
  flows: Map<string, Flow>;
  auxiliaries: Map<string, Auxiliary>;
  constants: Map<string, number>;
  feedbackLoops: FeedbackLoop[];
}

interface SimulationConfig {
  startTime: number;
  endTime: number;
  timeStep: number;
  method: 'euler' | 'rk4';
}

interface SimulationResult {
  time: number[];
  stocks: Record<string, number[]>;
  flows: Record<string, number[]>;
  auxiliaries: Record<string, number[]>;
}

interface CausalLoopDiagram {
  variables: string[];
  links: { from: string; to: string; polarity: '+' | '-' }[];
  loops: { variables: string[]; type: 'R' | 'B'; name: string }[];
}

// =============================================================================
// EQUATION PARSER AND EVALUATOR
// =============================================================================

/**
 * Simple equation evaluator for system dynamics
 */
function evaluateEquation(
  equation: string,
  context: Map<string, number>
): number {
  // Replace variable names with values
  let expr = equation;

  // Sort by name length (longest first) to avoid partial replacements
  const sorted = Array.from(context.entries()).sort((a, b) => b[0].length - a[0].length);

  for (const [name, value] of sorted) {
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    expr = expr.replace(regex, value.toString());
  }

  // Handle functions
  expr = expr.replace(/MIN\(([^,]+),([^)]+)\)/gi, (_, a, b) => Math.min(Number(a), Number(b)).toString());
  expr = expr.replace(/MAX\(([^,]+),([^)]+)\)/gi, (_, a, b) => Math.max(Number(a), Number(b)).toString());
  expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, t, f) => {
    try {
      // eslint-disable-next-line no-eval
      return eval(cond) ? t : f;
    } catch {
      return f;
    }
  });
  expr = expr.replace(/STEP\(([^,]+),([^)]+)\)/gi, (_, height, time) => {
    const t = context.get('time') ?? 0;
    return t >= Number(time) ? height : '0';
  });
  expr = expr.replace(/PULSE\(([^,]+),([^,]+),([^)]+)\)/gi, (_, magnitude, start, duration) => {
    const t = context.get('time') ?? 0;
    return (t >= Number(start) && t < Number(start) + Number(duration)) ? magnitude : '0';
  });
  expr = expr.replace(/DELAY\(([^,]+),([^)]+)\)/gi, (_, value) => value); // Simplified
  expr = expr.replace(/SMOOTH\(([^,]+),([^)]+)\)/gi, (_, value) => value); // Simplified
  expr = expr.replace(/EXP\(([^)]+)\)/gi, (_, v) => Math.exp(Number(v)).toString());
  expr = expr.replace(/LN\(([^)]+)\)/gi, (_, v) => Math.log(Number(v)).toString());
  expr = expr.replace(/SQRT\(([^)]+)\)/gi, (_, v) => Math.sqrt(Number(v)).toString());
  expr = expr.replace(/ABS\(([^)]+)\)/gi, (_, v) => Math.abs(Number(v)).toString());

  try {
    // Evaluate arithmetic expression
    // eslint-disable-next-line no-eval
    const result = eval(expr);
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

// =============================================================================
// SIMULATION ENGINE
// =============================================================================

/**
 * Run system dynamics simulation using Euler or RK4 method
 */
function runSimulation(
  model: SystemModel,
  config: SimulationConfig
): SimulationResult {
  const result: SimulationResult = {
    time: [],
    stocks: {},
    flows: {},
    auxiliaries: {}
  };

  // Initialize result arrays
  for (const [name] of model.stocks) {
    result.stocks[name] = [];
  }
  for (const [name] of model.flows) {
    result.flows[name] = [];
  }
  for (const [name] of model.auxiliaries) {
    result.auxiliaries[name] = [];
  }

  // Initialize stocks
  for (const [name, stock] of model.stocks) {
    stock.value = stock.initialValue;
  }

  // Simulation loop
  for (let t = config.startTime; t <= config.endTime; t += config.timeStep) {
    // Build context
    const context = new Map<string, number>();
    context.set('time', t);
    context.set('dt', config.timeStep);

    // Add constants
    for (const [name, value] of model.constants) {
      context.set(name, value);
    }

    // Add stock values
    for (const [name, stock] of model.stocks) {
      context.set(name, stock.value);
    }

    // Calculate auxiliaries (may depend on each other, simple iteration)
    for (let iter = 0; iter < 3; iter++) {
      for (const [name, aux] of model.auxiliaries) {
        aux.value = evaluateEquation(aux.equation, context);
        context.set(name, aux.value);
      }
    }

    // Calculate flows
    for (const [name, flow] of model.flows) {
      flow.value = evaluateEquation(flow.equation, context);
      context.set(name, flow.value);
    }

    // Record state
    result.time.push(t);
    for (const [name, stock] of model.stocks) {
      result.stocks[name].push(stock.value);
    }
    for (const [name, flow] of model.flows) {
      result.flows[name].push(flow.value);
    }
    for (const [name, aux] of model.auxiliaries) {
      result.auxiliaries[name].push(aux.value);
    }

    // Update stocks (Euler method)
    if (config.method === 'euler') {
      for (const [name, stock] of model.stocks) {
        let netFlow = 0;

        for (const [, flow] of model.flows) {
          if (flow.to === name) netFlow += flow.value;
          if (flow.from === name) netFlow -= flow.value;
        }

        stock.value += netFlow * config.timeStep;

        // Enforce bounds
        if (stock.minValue !== undefined) stock.value = Math.max(stock.minValue, stock.value);
        if (stock.maxValue !== undefined) stock.value = Math.min(stock.maxValue, stock.value);
      }
    }
    // RK4 would require more complex implementation
  }

  return result;
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Identify feedback loops from causal links
 */
function identifyFeedbackLoops(diagram: CausalLoopDiagram): FeedbackLoop[] {
  const loops: FeedbackLoop[] = [];
  const adjacency = new Map<string, { to: string; polarity: '+' | '-' }[]>();

  // Build adjacency list
  for (const variable of diagram.variables) {
    adjacency.set(variable, []);
  }
  for (const link of diagram.links) {
    adjacency.get(link.from)?.push({ to: link.to, polarity: link.polarity });
  }

  // DFS to find cycles
  function findCycles(start: string, current: string, path: string[], polarities: ('+' | '-')[]): void {
    const neighbors = adjacency.get(current) ?? [];

    for (const { to, polarity } of neighbors) {
      if (to === start && path.length >= 2) {
        // Found a loop
        const negativeCount = [...polarities, polarity].filter(p => p === '-').length;
        const loopType = negativeCount % 2 === 0 ? 'reinforcing' : 'balancing';

        // Check if we already have this loop (different starting point)
        const loopKey = [...path, to].sort().join('-');
        const exists = loops.some(l => l.variables.sort().join('-') === loopKey);

        if (!exists) {
          loops.push({
            name: `${loopType === 'reinforcing' ? 'R' : 'B'}${loops.length + 1}`,
            variables: [...path, to],
            type: loopType,
            description: `${loopType === 'reinforcing' ? 'Reinforcing' : 'Balancing'} loop: ${[...path, to].join(' → ')}`
          });
        }
      } else if (!path.includes(to)) {
        findCycles(start, to, [...path, to], [...polarities, polarity]);
      }
    }
  }

  for (const variable of diagram.variables) {
    findCycles(variable, variable, [variable], []);
  }

  return loops;
}

/**
 * Calculate sensitivity of outputs to parameters
 */
function sensitivityAnalysis(
  model: SystemModel,
  config: SimulationConfig,
  targetStock: string,
  parameterName: string,
  perturbation: number = 0.1
): { parameter: string; sensitivity: number; baseline: number; perturbed: number } {
  // Get baseline
  const originalValue = model.constants.get(parameterName) ?? 0;

  // Run baseline simulation
  const baselineResult = runSimulation(model, config);
  const baselineFinal = baselineResult.stocks[targetStock]?.slice(-1)[0] ?? 0;

  // Perturb parameter
  model.constants.set(parameterName, originalValue * (1 + perturbation));

  // Reset stocks
  for (const [, stock] of model.stocks) {
    stock.value = stock.initialValue;
  }

  // Run perturbed simulation
  const perturbedResult = runSimulation(model, config);
  const perturbedFinal = perturbedResult.stocks[targetStock]?.slice(-1)[0] ?? 0;

  // Restore original value
  model.constants.set(parameterName, originalValue);

  // Calculate elasticity
  const outputChange = (perturbedFinal - baselineFinal) / baselineFinal;
  const sensitivity = outputChange / perturbation;

  return {
    parameter: parameterName,
    sensitivity,
    baseline: baselineFinal,
    perturbed: perturbedFinal
  };
}

// =============================================================================
// EXAMPLE MODELS
// =============================================================================

interface ModelTemplate {
  name: string;
  description: string;
  stocks: { name: string; initial: number; unit: string }[];
  flows: { name: string; from: string | null; to: string | null; equation: string; unit: string }[];
  auxiliaries: { name: string; equation: string; unit: string }[];
  constants: Record<string, number>;
  loops: FeedbackLoop[];
}

const exampleModels: Record<string, ModelTemplate> = {
  population: {
    name: 'Population Growth',
    description: 'Simple population model with births and deaths',
    stocks: [{ name: 'Population', initial: 1000, unit: 'people' }],
    flows: [
      { name: 'Births', from: null, to: 'Population', equation: 'Population * birth_rate', unit: 'people/year' },
      { name: 'Deaths', from: 'Population', to: null, equation: 'Population * death_rate', unit: 'people/year' }
    ],
    auxiliaries: [
      { name: 'Growth_Rate', equation: 'birth_rate - death_rate', unit: '1/year' },
      { name: 'Doubling_Time', equation: 'LN(2) / Growth_Rate', unit: 'years' }
    ],
    constants: { birth_rate: 0.03, death_rate: 0.01 },
    loops: [{ name: 'R1', variables: ['Population', 'Births'], type: 'reinforcing', description: 'More population → more births → more population' }]
  },
  inventory: {
    name: 'Inventory Management',
    description: 'Supply chain inventory with orders and deliveries',
    stocks: [
      { name: 'Inventory', initial: 100, unit: 'units' },
      { name: 'Supply_Line', initial: 50, unit: 'units' }
    ],
    flows: [
      { name: 'Production', from: null, to: 'Supply_Line', equation: 'Order_Rate', unit: 'units/week' },
      { name: 'Delivery', from: 'Supply_Line', to: 'Inventory', equation: 'Supply_Line / delivery_delay', unit: 'units/week' },
      { name: 'Shipments', from: 'Inventory', to: null, equation: 'MIN(Desired_Shipments, Inventory / dt)', unit: 'units/week' }
    ],
    auxiliaries: [
      { name: 'Inventory_Gap', equation: 'desired_inventory - Inventory', unit: 'units' },
      { name: 'Adjustment', equation: 'Inventory_Gap / adjustment_time', unit: 'units/week' },
      { name: 'Desired_Shipments', equation: 'customer_demand', unit: 'units/week' },
      { name: 'Order_Rate', equation: 'MAX(0, customer_demand + Adjustment)', unit: 'units/week' }
    ],
    constants: { desired_inventory: 100, adjustment_time: 4, delivery_delay: 2, customer_demand: 20 },
    loops: [
      { name: 'B1', variables: ['Inventory', 'Inventory_Gap', 'Adjustment', 'Order_Rate', 'Production', 'Delivery'], type: 'balancing', description: 'Inventory control loop' }
    ]
  },
  sir: {
    name: 'SIR Epidemic Model',
    description: 'Susceptible-Infected-Recovered epidemic dynamics',
    stocks: [
      { name: 'Susceptible', initial: 9990, unit: 'people' },
      { name: 'Infected', initial: 10, unit: 'people' },
      { name: 'Recovered', initial: 0, unit: 'people' }
    ],
    flows: [
      { name: 'Infection', from: 'Susceptible', to: 'Infected', equation: 'Infection_Rate', unit: 'people/day' },
      { name: 'Recovery', from: 'Infected', to: 'Recovered', equation: 'Infected * recovery_rate', unit: 'people/day' }
    ],
    auxiliaries: [
      { name: 'Total_Population', equation: 'Susceptible + Infected + Recovered', unit: 'people' },
      { name: 'Infection_Rate', equation: 'contact_rate * infectivity * Susceptible * Infected / Total_Population', unit: 'people/day' },
      { name: 'R0', equation: 'contact_rate * infectivity / recovery_rate', unit: 'dimensionless' }
    ],
    constants: { contact_rate: 10, infectivity: 0.05, recovery_rate: 0.2 },
    loops: [
      { name: 'R1', variables: ['Infected', 'Infection_Rate', 'Susceptible'], type: 'reinforcing', description: 'Contagion spread' },
      { name: 'B1', variables: ['Infected', 'Recovery', 'Recovered'], type: 'balancing', description: 'Recovery depletion' },
      { name: 'B2', variables: ['Susceptible', 'Infection_Rate', 'Infected'], type: 'balancing', description: 'Susceptible depletion' }
    ]
  },
  predator_prey: {
    name: 'Predator-Prey (Lotka-Volterra)',
    description: 'Ecological predator-prey dynamics',
    stocks: [
      { name: 'Prey', initial: 100, unit: 'animals' },
      { name: 'Predators', initial: 20, unit: 'animals' }
    ],
    flows: [
      { name: 'Prey_Births', from: null, to: 'Prey', equation: 'Prey * prey_birth_rate', unit: 'animals/year' },
      { name: 'Predation', from: 'Prey', to: null, equation: 'predation_rate * Prey * Predators', unit: 'animals/year' },
      { name: 'Predator_Births', from: null, to: 'Predators', equation: 'predation_efficiency * predation_rate * Prey * Predators', unit: 'animals/year' },
      { name: 'Predator_Deaths', from: 'Predators', to: null, equation: 'Predators * predator_death_rate', unit: 'animals/year' }
    ],
    auxiliaries: [],
    constants: { prey_birth_rate: 0.5, predation_rate: 0.01, predation_efficiency: 0.1, predator_death_rate: 0.2 },
    loops: [
      { name: 'R1', variables: ['Prey', 'Prey_Births'], type: 'reinforcing', description: 'Prey reproduction' },
      { name: 'B1', variables: ['Prey', 'Predation', 'Predators', 'Predator_Births'], type: 'balancing', description: 'Predation control' },
      { name: 'R2', variables: ['Predators', 'Predator_Births', 'Prey', 'Predation'], type: 'reinforcing', description: 'Predator growth' }
    ]
  },
  project: {
    name: 'Project Management',
    description: "Brooks' Law - adding people to late project",
    stocks: [
      { name: 'Tasks_Remaining', initial: 100, unit: 'tasks' },
      { name: 'Experienced_Staff', initial: 5, unit: 'people' },
      { name: 'New_Staff', initial: 0, unit: 'people' }
    ],
    flows: [
      { name: 'Task_Completion', from: 'Tasks_Remaining', to: null, equation: 'Productivity', unit: 'tasks/week' },
      { name: 'Hiring', from: null, to: 'New_Staff', equation: 'hiring_rate', unit: 'people/week' },
      { name: 'Training', from: 'New_Staff', to: 'Experienced_Staff', equation: 'New_Staff / training_time', unit: 'people/week' }
    ],
    auxiliaries: [
      { name: 'Total_Staff', equation: 'Experienced_Staff + New_Staff', unit: 'people' },
      { name: 'Effective_Staff', equation: 'Experienced_Staff + New_Staff * 0.3', unit: 'people' },
      { name: 'Communication_Overhead', equation: 'comm_factor * Total_Staff * (Total_Staff - 1) / 2', unit: 'hours/week' },
      { name: 'Productivity', equation: 'MAX(0, Effective_Staff * base_productivity - Communication_Overhead * overhead_cost)', unit: 'tasks/week' }
    ],
    constants: { hiring_rate: 1, training_time: 8, base_productivity: 2, comm_factor: 0.1, overhead_cost: 0.05 },
    loops: [
      { name: 'B1', variables: ['Tasks_Remaining', 'Hiring', 'New_Staff', 'Training', 'Experienced_Staff', 'Productivity'], type: 'balancing', description: 'Staffing up' },
      { name: 'B2', variables: ['Total_Staff', 'Communication_Overhead', 'Productivity'], type: 'balancing', description: 'Brooks Law overhead' }
    ]
  }
};

/**
 * Build model from template
 */
function buildModel(template: ModelTemplate): SystemModel {
  const model: SystemModel = {
    name: template.name,
    stocks: new Map(),
    flows: new Map(),
    auxiliaries: new Map(),
    constants: new Map(Object.entries(template.constants)),
    feedbackLoops: template.loops
  };

  for (const s of template.stocks) {
    model.stocks.set(s.name, {
      name: s.name,
      value: s.initial,
      initialValue: s.initial,
      unit: s.unit,
      minValue: 0
    });
  }

  for (const f of template.flows) {
    model.flows.set(f.name, {
      name: f.name,
      from: f.from,
      to: f.to,
      equation: f.equation,
      value: 0,
      unit: f.unit
    });
  }

  for (const a of template.auxiliaries) {
    model.auxiliaries.set(a.name, {
      name: a.name,
      equation: a.equation,
      value: 0,
      unit: a.unit
    });
  }

  return model;
}

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const systemdynamicsTool: UnifiedTool = {
  name: 'system_dynamics',
  description: 'System dynamics modeling with stocks, flows, and feedback loops. Simulates complex systems over time using Forrester methodology.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'analyze', 'causal_loop', 'sensitivity', 'examples', 'info'],
        description: 'Operation: simulate model, analyze behavior, create causal loop diagram, sensitivity analysis, examples, or info'
      },
      model_name: {
        type: 'string',
        description: 'Named model: population, inventory, sir, predator_prey, project'
      },
      model: {
        type: 'object',
        description: 'Custom model definition with stocks, flows, auxiliaries, constants'
      },
      time_start: { type: 'number', description: 'Simulation start time (default: 0)' },
      time_end: { type: 'number', description: 'Simulation end time (default: 100)' },
      time_step: { type: 'number', description: 'Time step (default: 0.25)' },
      parameter_overrides: {
        type: 'object',
        description: 'Override model constants'
      },
      causal_links: {
        type: 'array',
        description: 'Causal links for loop analysis'
      },
      target_variable: { type: 'string', description: 'Target variable for sensitivity analysis' },
      parameter: { type: 'string', description: 'Parameter for sensitivity analysis' }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executesystemdynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation, model_name, model: customModel, time_start = 0, time_end = 100,
      time_step = 0.25, parameter_overrides, causal_links, target_variable, parameter
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'system-dynamics',
        description: 'System dynamics modeling and simulation',
        methodology: 'Forrester System Dynamics',
        components: {
          stocks: 'Accumulations that change over time (state variables)',
          flows: 'Rates that fill or drain stocks',
          auxiliaries: 'Computed variables based on stocks and constants',
          constants: 'Parameters that do not change during simulation',
          feedback_loops: 'Circular causal chains that amplify (R) or stabilize (B) system behavior'
        },
        loop_types: {
          reinforcing: 'R loops amplify change (exponential growth/collapse)',
          balancing: 'B loops seek equilibrium (goal-seeking behavior)'
        },
        simulation: {
          method: 'Euler integration',
          functions: ['MIN', 'MAX', 'IF', 'STEP', 'PULSE', 'DELAY', 'SMOOTH', 'EXP', 'LN', 'SQRT', 'ABS']
        },
        example_models: Object.keys(exampleModels)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      const examples = Object.entries(exampleModels).map(([key, m]) => ({
        name: key,
        description: m.description,
        stocks: m.stocks.map(s => s.name),
        flows: m.flows.map(f => f.name),
        feedback_loops: m.loops.map(l => ({ name: l.name, type: l.type }))
      }));
      return { toolCallId: id, content: JSON.stringify({ models: examples }, null, 2) };
    }

    // Causal loop operation
    if (operation === 'causal_loop') {
      if (!causal_links || !Array.isArray(causal_links)) {
        return {
          toolCallId: id,
          content: 'Error: causal_links array required for loop analysis. Format: [{from, to, polarity}]',
          isError: true
        };
      }

      const variables = new Set<string>();
      for (const link of causal_links) {
        variables.add(link.from);
        variables.add(link.to);
      }

      const diagram: CausalLoopDiagram = {
        variables: Array.from(variables),
        links: causal_links,
        loops: []
      };

      const loops = identifyFeedbackLoops(diagram);

      return {
        toolCallId: id,
        content: JSON.stringify({
          causal_loop_diagram: {
            variables: diagram.variables,
            links: diagram.links.map(l => `${l.from} --(${l.polarity})--> ${l.to}`),
            num_variables: diagram.variables.length,
            num_links: diagram.links.length
          },
          feedback_loops: loops.map(l => ({
            name: l.name,
            type: l.type,
            path: l.variables.join(' → '),
            description: l.description
          })),
          summary: {
            reinforcing_loops: loops.filter(l => l.type === 'reinforcing').length,
            balancing_loops: loops.filter(l => l.type === 'balancing').length
          }
        }, null, 2)
      };
    }

    // Get model
    let model: SystemModel;
    let template: ModelTemplate;

    if (model_name && exampleModels[model_name]) {
      template = exampleModels[model_name];
      model = buildModel(template);
    } else if (customModel) {
      template = customModel;
      model = buildModel(customModel);
    } else {
      template = exampleModels.population;
      model = buildModel(template);
    }

    // Apply parameter overrides
    if (parameter_overrides) {
      for (const [key, value] of Object.entries(parameter_overrides)) {
        model.constants.set(key, value as number);
      }
    }

    // Sensitivity operation
    if (operation === 'sensitivity') {
      if (!target_variable || !parameter) {
        return {
          toolCallId: id,
          content: 'Error: target_variable and parameter required for sensitivity analysis',
          isError: true
        };
      }

      const config: SimulationConfig = {
        startTime: time_start,
        endTime: time_end,
        timeStep: time_step,
        method: 'euler'
      };

      const result = sensitivityAnalysis(model, config, target_variable, parameter);

      return {
        toolCallId: id,
        content: JSON.stringify({
          sensitivity_analysis: {
            target: target_variable,
            parameter,
            perturbation: '10%',
            results: {
              baseline_final: Math.round(result.baseline * 100) / 100,
              perturbed_final: Math.round(result.perturbed * 100) / 100,
              sensitivity_elasticity: Math.round(result.sensitivity * 1000) / 1000,
              interpretation: Math.abs(result.sensitivity) > 1 ? 'High sensitivity' :
                Math.abs(result.sensitivity) > 0.5 ? 'Moderate sensitivity' : 'Low sensitivity'
            }
          }
        }, null, 2)
      };
    }

    // Analyze operation
    if (operation === 'analyze') {
      const config: SimulationConfig = {
        startTime: time_start,
        endTime: time_end,
        timeStep: time_step,
        method: 'euler'
      };

      const result = runSimulation(model, config);

      // Analyze behavior
      const analysis: Record<string, unknown> = {
        model: template.name,
        description: template.description,
        structure: {
          stocks: Array.from(model.stocks.values()).map(s => ({
            name: s.name,
            initial: s.initialValue,
            unit: s.unit
          })),
          flows: Array.from(model.flows.values()).map(f => ({
            name: f.name,
            equation: f.equation,
            from: f.from ?? 'source',
            to: f.to ?? 'sink'
          })),
          constants: Object.fromEntries(model.constants)
        },
        feedback_loops: model.feedbackLoops.map(l => ({
          name: l.name,
          type: l.type,
          description: l.description
        })),
        behavior_summary: {}
      };

      // Summarize behavior for each stock
      for (const [name, values] of Object.entries(result.stocks)) {
        const initial = values[0];
        const final = values[values.length - 1];
        const max = Math.max(...values);
        const min = Math.min(...values);

        let pattern = 'stable';
        if (final > initial * 1.5) pattern = 'growth';
        else if (final < initial * 0.5) pattern = 'decline';
        else if (max > initial * 1.2 && min < initial * 0.8) pattern = 'oscillating';

        (analysis.behavior_summary as Record<string, unknown>)[name] = {
          initial: Math.round(initial * 100) / 100,
          final: Math.round(final * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          pattern
        };
      }

      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    // Simulate operation (default)
    const config: SimulationConfig = {
      startTime: time_start,
      endTime: time_end,
      timeStep: time_step,
      method: 'euler'
    };

    const result = runSimulation(model, config);

    // Sample time series (every 10 points or so)
    const sampleRate = Math.max(1, Math.floor(result.time.length / 20));
    const sampledIndices = result.time.map((_, i) => i).filter(i => i % sampleRate === 0 || i === result.time.length - 1);

    const timeSeries = sampledIndices.map(i => {
      const point: Record<string, number> = { time: result.time[i] };
      for (const [name, values] of Object.entries(result.stocks)) {
        point[name] = Math.round(values[i] * 100) / 100;
      }
      return point;
    });

    return {
      toolCallId: id,
      content: JSON.stringify({
        model: template.name,
        simulation: {
          start: time_start,
          end: time_end,
          step: time_step,
          data_points: result.time.length
        },
        initial_conditions: Object.fromEntries(
          Array.from(model.stocks.entries()).map(([name, stock]) => [name, stock.initialValue])
        ),
        final_state: Object.fromEntries(
          Object.entries(result.stocks).map(([name, values]) => [name, Math.round(values[values.length - 1] * 100) / 100])
        ),
        time_series: timeSeries
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issystemdynamicsAvailable(): boolean {
  return true;
}
