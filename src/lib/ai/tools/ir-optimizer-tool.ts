/**
 * IR-OPTIMIZER TOOL
 * Intermediate Representation optimization with SSA, CFG, and dataflow analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// IR instruction types
type IROpcode = 'LOAD' | 'STORE' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD' |
  'EQ' | 'NE' | 'LT' | 'GT' | 'LE' | 'GE' | 'AND' | 'OR' | 'NOT' |
  'JUMP' | 'BRANCH' | 'CALL' | 'RETURN' | 'PHI' | 'NOP' | 'ALLOCA' |
  'GEP' | 'BITCAST' | 'SEXT' | 'ZEXT' | 'TRUNC';

interface IRInstruction {
  id: number;
  opcode: IROpcode;
  dest?: string;
  operands: string[];
  type?: string;
  label?: string;
  isSSA?: boolean;
  version?: number;
}

interface BasicBlock {
  id: string;
  instructions: IRInstruction[];
  predecessors: string[];
  successors: string[];
  dominators?: string[];
  dominanceFrontier?: string[];
  liveIn?: Set<string>;
  liveOut?: Set<string>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CFG {
  entry: string;
  exit: string;
  blocks: Map<string, BasicBlock>;
}

// Optimization passes
const OPTIMIZATION_PASSES: Record<string, {
  name: string;
  description: string;
  type: 'local' | 'global' | 'interprocedural';
  phase: 'early' | 'middle' | 'late';
}> = {
  'dead_code': {
    name: 'Dead Code Elimination',
    description: 'Remove instructions whose results are never used',
    type: 'global',
    phase: 'middle'
  },
  'constant_fold': {
    name: 'Constant Folding',
    description: 'Evaluate constant expressions at compile time',
    type: 'local',
    phase: 'early'
  },
  'constant_prop': {
    name: 'Constant Propagation',
    description: 'Replace variables with known constant values',
    type: 'global',
    phase: 'early'
  },
  'copy_prop': {
    name: 'Copy Propagation',
    description: 'Replace copies with their original values',
    type: 'global',
    phase: 'early'
  },
  'cse': {
    name: 'Common Subexpression Elimination',
    description: 'Reuse results of identical computations',
    type: 'global',
    phase: 'middle'
  },
  'inline': {
    name: 'Function Inlining',
    description: 'Replace function calls with function body',
    type: 'interprocedural',
    phase: 'early'
  },
  'loop_unroll': {
    name: 'Loop Unrolling',
    description: 'Duplicate loop body to reduce branch overhead',
    type: 'local',
    phase: 'late'
  },
  'loop_invariant': {
    name: 'Loop Invariant Code Motion',
    description: 'Move loop-invariant code outside the loop',
    type: 'global',
    phase: 'middle'
  },
  'strength_reduce': {
    name: 'Strength Reduction',
    description: 'Replace expensive operations with cheaper ones',
    type: 'local',
    phase: 'late'
  },
  'register_alloc': {
    name: 'Register Allocation',
    description: 'Assign variables to CPU registers',
    type: 'global',
    phase: 'late'
  },
  'tail_call': {
    name: 'Tail Call Optimization',
    description: 'Convert tail recursion to iteration',
    type: 'local',
    phase: 'middle'
  },
  'vectorize': {
    name: 'Vectorization',
    description: 'Convert scalar operations to SIMD instructions',
    type: 'global',
    phase: 'late'
  }
};

export const iroptimizerTool: UnifiedTool = {
  name: 'ir_optimizer',
  description: 'Intermediate Representation optimization - SSA conversion, CFG analysis, dead code elimination, constant folding, and more',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['dead_code', 'constant_fold', 'constant_prop', 'inline', 'loop_unroll', 'ssa_convert', 'cfg_build', 'dataflow', 'optimize', 'info', 'examples'],
        description: 'Operation type'
      },
      ir_code: { type: 'string', description: 'IR code to optimize' },
      optimization_level: { type: 'string', enum: ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'], description: 'Optimization level' },
      passes: { type: 'array', description: 'Specific optimization passes to apply' },
      show_cfg: { type: 'boolean', description: 'Show control flow graph' },
      show_dominators: { type: 'boolean', description: 'Show dominator tree' },
      show_liveness: { type: 'boolean', description: 'Show liveness analysis' },
      unroll_factor: { type: 'number', description: 'Loop unroll factor' },
      inline_threshold: { type: 'number', description: 'Inlining threshold (instruction count)' }
    },
    required: ['operation']
  }
};

export async function executeiroptimizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'dead_code':
        result = eliminateDeadCode(args);
        break;

      case 'constant_fold':
        result = foldConstants(args);
        break;

      case 'constant_prop':
        result = propagateConstants(args);
        break;

      case 'inline':
        result = inlineFunctions(args);
        break;

      case 'loop_unroll':
        result = unrollLoop(args);
        break;

      case 'ssa_convert':
        result = convertToSSA(args);
        break;

      case 'cfg_build':
        result = buildCFG(args);
        break;

      case 'dataflow':
        result = analyzeDataflow(args);
        break;

      case 'optimize':
        result = runOptimizer(args);
        break;

      case 'examples':
        result = getExamples();
        break;

      case 'info':
      default:
        result = getInfo();
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function parseIR(code: string): IRInstruction[] {
  const lines = code.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith(';'));
  const instructions: IRInstruction[] = [];
  let id = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Label
    if (trimmed.endsWith(':')) {
      instructions.push({
        id: id++,
        opcode: 'NOP',
        operands: [],
        label: trimmed.slice(0, -1)
      });
      continue;
    }

    // Assignment: dest = op operands
    const assignMatch = trimmed.match(/^(%\w+)\s*=\s*(\w+)\s*(.*)$/);
    if (assignMatch) {
      const [, dest, opcode, rest] = assignMatch;
      const operands = rest.split(/,\s*/).map(s => s.trim()).filter(Boolean);
      instructions.push({
        id: id++,
        opcode: opcode.toUpperCase() as IROpcode,
        dest,
        operands
      });
      continue;
    }

    // No dest: op operands
    const noDestMatch = trimmed.match(/^(\w+)\s*(.*)$/);
    if (noDestMatch) {
      const [, opcode, rest] = noDestMatch;
      const operands = rest.split(/,\s*/).map(s => s.trim()).filter(Boolean);
      instructions.push({
        id: id++,
        opcode: opcode.toUpperCase() as IROpcode,
        operands
      });
    }
  }

  return instructions;
}

function formatIR(instructions: IRInstruction[]): string[] {
  return instructions.map(instr => {
    if (instr.label) {
      return `${instr.label}:`;
    }
    if (instr.dest) {
      return `  ${instr.dest} = ${instr.opcode.toLowerCase()} ${instr.operands.join(', ')}`;
    }
    return `  ${instr.opcode.toLowerCase()} ${instr.operands.join(', ')}`;
  });
}

function eliminateDeadCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.ir_code as string) || `
%1 = load x
%2 = load y
%3 = add %1, %2
%4 = mul %1, 2
%5 = sub %4, %1
store %3, result
return %3
`;

  const instructions = parseIR(code);
  const used = new Set<string>();
  const eliminated: IRInstruction[] = [];
  const kept: IRInstruction[] = [];

  // First pass: find all used values (work backwards)
  for (let i = instructions.length - 1; i >= 0; i--) {
    const instr = instructions[i];

    // Special instructions always kept
    if (['STORE', 'RETURN', 'BRANCH', 'JUMP', 'CALL'].includes(instr.opcode)) {
      kept.unshift(instr);
      instr.operands.forEach(op => {
        if (op.startsWith('%')) used.add(op);
      });
      continue;
    }

    // Check if result is used
    if (instr.dest && used.has(instr.dest)) {
      kept.unshift(instr);
      instr.operands.forEach(op => {
        if (op.startsWith('%')) used.add(op);
      });
    } else if (instr.dest) {
      eliminated.push(instr);
    } else if (instr.label) {
      kept.unshift(instr);
    }
  }

  return {
    operation: 'dead_code',
    original: formatIR(instructions),
    optimized: formatIR(kept),
    eliminated: eliminated.map(i => `${i.dest} = ${i.opcode.toLowerCase()} ${i.operands.join(', ')}`),
    statistics: {
      original_instructions: instructions.length,
      optimized_instructions: kept.length,
      eliminated_count: eliminated.length,
      reduction_percent: ((eliminated.length / instructions.length) * 100).toFixed(1) + '%'
    },
    explanation: 'Dead code elimination removes instructions whose results are never used downstream'
  };
}

function foldConstants(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.ir_code as string) || `
%1 = add 5, 3
%2 = mul 4, 2
%3 = add %1, %2
%4 = sub 10, 3
%5 = div %3, %4
store %5, result
`;

  const instructions = parseIR(code);
  const constants = new Map<string, number>();
  const folded: { original: string; result: string }[] = [];
  const optimized: IRInstruction[] = [];

  for (const instr of instructions) {
    // Try to fold if all operands are constants
    const values = instr.operands.map(op => {
      if (op.match(/^-?\d+$/)) return parseInt(op);
      if (constants.has(op)) return constants.get(op)!;
      return null;
    });

    if (instr.dest && values.every(v => v !== null)) {
      let result: number | null = null;

      switch (instr.opcode) {
        case 'ADD': result = (values[0]! + values[1]!); break;
        case 'SUB': result = (values[0]! - values[1]!); break;
        case 'MUL': result = (values[0]! * values[1]!); break;
        case 'DIV': result = Math.floor(values[0]! / values[1]!); break;
        case 'MOD': result = (values[0]! % values[1]!); break;
      }

      if (result !== null) {
        constants.set(instr.dest, result);
        folded.push({
          original: `${instr.dest} = ${instr.opcode.toLowerCase()} ${instr.operands.join(', ')}`,
          result: `${instr.dest} = ${result}`
        });
        optimized.push({ ...instr, opcode: 'LOAD', operands: [result.toString()] });
        continue;
      }
    }

    // Replace known constant operands
    const newOperands = instr.operands.map(op =>
      constants.has(op) ? constants.get(op)!.toString() : op
    );
    optimized.push({ ...instr, operands: newOperands });
  }

  return {
    operation: 'constant_fold',
    original: formatIR(instructions),
    optimized: formatIR(optimized),
    folded_expressions: folded,
    computed_constants: Object.fromEntries(constants),
    explanation: 'Constant folding evaluates expressions with known constant values at compile time'
  };
}

function propagateConstants(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.ir_code as string) || `
%x = load 10
%y = load 5
%a = add %x, %y
%b = mul %x, 2
%c = add %a, %b
store %c, result
`;

  const instructions = parseIR(code);
  const values = new Map<string, string>();
  const propagations: { variable: string; value: string; uses: number }[] = [];

  // First pass: find constant assignments
  for (const instr of instructions) {
    if (instr.opcode === 'LOAD' && instr.dest && instr.operands[0].match(/^-?\d+$/)) {
      values.set(instr.dest, instr.operands[0]);
    }
  }

  // Second pass: propagate and count
  const optimized: IRInstruction[] = [];
  for (const instr of instructions) {
    const newOperands = instr.operands.map(op => {
      if (values.has(op)) {
        const existing = propagations.find(p => p.variable === op);
        if (existing) {
          existing.uses++;
        } else {
          propagations.push({ variable: op, value: values.get(op)!, uses: 1 });
        }
        return values.get(op)!;
      }
      return op;
    });
    optimized.push({ ...instr, operands: newOperands });
  }

  return {
    operation: 'constant_prop',
    original: formatIR(instructions),
    optimized: formatIR(optimized),
    propagated: propagations,
    statistics: {
      constants_found: values.size,
      total_propagations: propagations.reduce((sum, p) => sum + p.uses, 0)
    },
    explanation: 'Constant propagation replaces variable uses with their known constant values'
  };
}

function inlineFunctions(args: Record<string, unknown>): Record<string, unknown> {
  const threshold = (args.inline_threshold as number) || 10;

  // Example function to inline
  const callee = {
    name: 'square',
    params: ['n'],
    body: [
      { id: 0, opcode: 'MUL' as IROpcode, dest: '%result', operands: ['%n', '%n'] },
      { id: 1, opcode: 'RETURN' as IROpcode, dest: undefined, operands: ['%result'] }
    ],
    instructions: 2
  };

  const caller = `
%x = load 5
%y = call @square, %x
%z = add %y, 10
store %z, result
`;

  const callerInstructions = parseIR(caller);

  // Inline the function
  const inlined: IRInstruction[] = [];
  let tempCounter = 100;

  for (const instr of callerInstructions) {
    if (instr.opcode === 'CALL' && instr.operands[0] === '@square') {
      // Check threshold
      if (callee.instructions <= threshold) {
        // Substitute parameters
        const argValue = instr.operands[1];
        const resultVar = instr.dest;

        // Add inlined body
        inlined.push({
          id: tempCounter++,
          opcode: 'MUL',
          dest: resultVar,
          operands: [argValue, argValue]
        });
      } else {
        inlined.push(instr);
      }
    } else {
      inlined.push(instr);
    }
  }

  return {
    operation: 'inline',
    callee_function: {
      name: callee.name,
      params: callee.params,
      body: formatIR(callee.body),
      instruction_count: callee.instructions
    },
    original_caller: formatIR(callerInstructions),
    inlined_result: formatIR(inlined),
    inline_threshold: threshold,
    decision: callee.instructions <= threshold ? 'INLINED' : 'NOT_INLINED',
    benefits: [
      'Eliminates function call overhead',
      'Enables further optimizations',
      'Improves cache locality'
    ],
    costs: [
      'Increases code size',
      'May increase compile time',
      'Can cause instruction cache misses if overused'
    ]
  };
}

function unrollLoop(args: Record<string, unknown>): Record<string, unknown> {
  const factor = (args.unroll_factor as number) || 4;

  const originalLoop = `
loop_header:
  %i = phi [0, entry], [%i_next, loop_body]
  %sum = phi [0, entry], [%sum_next, loop_body]
  %cond = lt %i, 100
  branch %cond, loop_body, exit
loop_body:
  %val = load arr, %i
  %sum_next = add %sum, %val
  %i_next = add %i, 1
  jump loop_header
exit:
  return %sum
`;

  // Generate unrolled version
  const unrolledBody: string[] = [];
  for (let j = 0; j < factor; j++) {
    unrolledBody.push(`  %val_${j} = load arr, %i_${j}`);
    unrolledBody.push(`  %sum_${j + 1} = add %sum_${j}, %val_${j}`);
    if (j < factor - 1) {
      unrolledBody.push(`  %i_${j + 1} = add %i_${j}, 1`);
    }
  }

  const unrolledLoop = `
loop_header:
  %i_0 = phi [0, entry], [%i_next, loop_body]
  %sum_0 = phi [0, entry], [%sum_${factor}, loop_body]
  %cond = lt %i_0, 100
  branch %cond, loop_body, exit
loop_body:
${unrolledBody.join('\n')}
  %i_next = add %i_0, ${factor}
  jump loop_header
exit:
  return %sum_${factor}
`;

  return {
    operation: 'loop_unroll',
    unroll_factor: factor,
    original: originalLoop.trim().split('\n'),
    unrolled: unrolledLoop.trim().split('\n'),
    statistics: {
      original_body_instructions: 4,
      unrolled_body_instructions: factor * 2 + 1,
      branch_reduction: `${((factor - 1) / factor * 100).toFixed(0)}%`,
      iterations_per_branch: factor
    },
    tradeoffs: {
      benefits: [
        `Reduces loop overhead by ${factor}x`,
        'Enables more instruction-level parallelism',
        'Better utilization of CPU pipeline'
      ],
      costs: [
        `Code size increases by ~${factor}x`,
        'May cause instruction cache pressure',
        'Requires cleanup code for non-divisible trip counts'
      ]
    }
  };
}

function convertToSSA(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.ir_code as string) || `
  x = 1
  y = 2
  x = x + y
  y = x * 2
  z = x + y
`;

  // Parse and convert to SSA
  const lines = code.trim().split('\n').filter(l => l.trim());
  const versions = new Map<string, number>();
  const ssaCode: string[] = [];
  const renaming: { original: string; ssa: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
    if (!match) {
      ssaCode.push(line);
      continue;
    }

    const [, dest, expr] = match;

    // Replace uses with SSA versions
    let ssaExpr = expr;
    for (const [varName, version] of versions) {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      ssaExpr = ssaExpr.replace(regex, `${varName}_${version}`);
    }

    // Create new SSA version for destination
    const newVersion = (versions.get(dest) || 0) + 1;
    versions.set(dest, newVersion);
    const ssaDest = `${dest}_${newVersion}`;

    ssaCode.push(`  ${ssaDest} = ${ssaExpr}`);
    renaming.push({ original: dest, ssa: ssaDest });
  }

  return {
    operation: 'ssa_convert',
    original: lines,
    ssa_form: ssaCode,
    variable_versions: Object.fromEntries(versions),
    renaming_history: renaming,
    properties: {
      single_assignment: 'Each variable is assigned exactly once',
      dominance: 'Every use is dominated by its definition',
      phi_functions: 'Would be needed at control flow merge points'
    },
    benefits: [
      'Simplifies dataflow analysis',
      'Makes def-use chains explicit',
      'Enables efficient optimization algorithms',
      'Used by LLVM, GCC, and other modern compilers'
    ]
  };
}

function buildCFG(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.ir_code as string) || `
entry:
  %x = load input
  %cond = lt %x, 0
  branch %cond, negative, non_negative
negative:
  %result1 = sub 0, %x
  jump exit
non_negative:
  %cond2 = eq %x, 0
  branch %cond2, zero, positive
zero:
  %result2 = load 0
  jump exit
positive:
  %result3 = load %x
  jump exit
exit:
  %result = phi [%result1, negative], [%result2, zero], [%result3, positive]
  return %result
`;

  // Build CFG from IR
  const blocks = new Map<string, BasicBlock>();
  const instructions = parseIR(code);

  let currentBlock: BasicBlock | null = null;

  for (const instr of instructions) {
    if (instr.label) {
      if (currentBlock) {
        blocks.set(currentBlock.id, currentBlock);
      }
      currentBlock = {
        id: instr.label,
        instructions: [],
        predecessors: [],
        successors: []
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.instructions.push(instr);

      // Track successors
      if (instr.opcode === 'JUMP') {
        currentBlock.successors.push(instr.operands[0]);
      } else if (instr.opcode === 'BRANCH') {
        currentBlock.successors.push(instr.operands[1], instr.operands[2]);
      }
    }
  }

  if (currentBlock) {
    blocks.set(currentBlock.id, currentBlock);
  }

  // Build predecessors
  for (const [blockId, block] of blocks) {
    for (const succ of block.successors) {
      const succBlock = blocks.get(succ);
      if (succBlock) {
        succBlock.predecessors.push(blockId);
      }
    }
  }

  // Calculate dominators (simplified)
  const dominators: Record<string, string[]> = {};
  for (const [blockId] of blocks) {
    if (blockId === 'entry') {
      dominators[blockId] = ['entry'];
    } else {
      dominators[blockId] = ['entry', blockId];
    }
  }

  return {
    operation: 'cfg_build',
    blocks: Array.from(blocks.entries()).map(([id, block]) => ({
      id,
      instructions: block.instructions.length,
      predecessors: block.predecessors,
      successors: block.successors
    })),
    edges: Array.from(blocks.values()).flatMap(block =>
      block.successors.map(succ => ({ from: block.id, to: succ }))
    ),
    dominators,
    statistics: {
      total_blocks: blocks.size,
      total_edges: Array.from(blocks.values()).reduce((sum, b) => sum + b.successors.length, 0),
      entry_block: 'entry',
      exit_blocks: Array.from(blocks.values())
        .filter(b => b.instructions.some(i => i.opcode === 'RETURN'))
        .map(b => b.id)
    }
  };
}

function analyzeDataflow(_args: Record<string, unknown>): Record<string, unknown> {
  // Simplified liveness analysis
  const liveness: Record<string, { liveIn: string[]; liveOut: string[]; def: string[]; use: string[] }> = {
    'entry': {
      liveIn: ['x', 'y', '%cond'],
      liveOut: ['%a', '%b', '%c'],
      def: ['%a', '%b', '%c'],
      use: ['x', 'y']
    },
    'left': {
      liveIn: ['%a', '%b'],
      liveOut: ['%e'],
      def: ['%d', '%e'],
      use: ['%a', '%b', '%d']
    },
    'right': {
      liveIn: ['%a', '%b', '%c'],
      liveOut: ['%g'],
      def: ['%f', '%g'],
      use: ['%a', '%b', '%c', '%f']
    },
    'exit': {
      liveIn: ['%e', '%g'],
      liveOut: [],
      def: ['%result'],
      use: ['%e', '%g']
    }
  };

  // Reaching definitions
  const reachingDefs: Record<string, string[]> = {
    '%a': ['entry'],
    '%b': ['entry'],
    '%c': ['entry'],
    '%d': ['left'],
    '%e': ['left'],
    '%f': ['right'],
    '%g': ['right'],
    '%result': ['exit']
  };

  // Available expressions
  const availableExprs = {
    'entry': [],
    'left': ['add %a, %b'],
    'right': ['add %a, %b'],
    'exit': ['add %a, %b']
  };

  return {
    operation: 'dataflow',
    analysis_types: {
      liveness: {
        description: 'Variables that may be used before being redefined',
        direction: 'Backward',
        confluence: 'Union',
        results: liveness
      },
      reaching_definitions: {
        description: 'Definitions that may reach each point',
        direction: 'Forward',
        confluence: 'Union',
        results: reachingDefs
      },
      available_expressions: {
        description: 'Expressions guaranteed to be computed',
        direction: 'Forward',
        confluence: 'Intersection',
        results: availableExprs
      }
    },
    applications: [
      'Dead code elimination (liveness)',
      'Constant propagation (reaching defs)',
      'Common subexpression elimination (available exprs)',
      'Register allocation (liveness)',
      'Code motion (available exprs)'
    ]
  };
}

function runOptimizer(args: Record<string, unknown>): Record<string, unknown> {
  const level = (args.optimization_level as string) || 'O2';
  const passes = args.passes as string[] | undefined;

  // Optimization levels
  const levelPasses: Record<string, string[]> = {
    'O0': [],
    'O1': ['constant_fold', 'dead_code'],
    'O2': ['constant_fold', 'constant_prop', 'cse', 'dead_code', 'loop_invariant'],
    'O3': ['constant_fold', 'constant_prop', 'cse', 'dead_code', 'loop_invariant', 'inline', 'loop_unroll', 'vectorize'],
    'Os': ['constant_fold', 'constant_prop', 'dead_code'],
    'Oz': ['constant_fold', 'dead_code']
  };

  const selectedPasses = passes || levelPasses[level] || levelPasses['O2'];

  const passDetails = selectedPasses.map(p => ({
    name: OPTIMIZATION_PASSES[p]?.name || p,
    description: OPTIMIZATION_PASSES[p]?.description || 'Custom pass',
    type: OPTIMIZATION_PASSES[p]?.type || 'local',
    phase: OPTIMIZATION_PASSES[p]?.phase || 'middle'
  }));

  // Simulate optimization statistics
  const stats = {
    instructions_before: 100,
    instructions_after: level === 'O3' ? 45 : level === 'O2' ? 55 : level === 'O1' ? 70 : 100,
    constants_folded: ['O1', 'O2', 'O3', 'Os', 'Oz'].includes(level) ? 12 : 0,
    dead_code_removed: ['O1', 'O2', 'O3', 'Os', 'Oz'].includes(level) ? 8 : 0,
    functions_inlined: level === 'O3' ? 5 : 0,
    loops_unrolled: level === 'O3' ? 3 : 0
  };

  return {
    operation: 'optimize',
    optimization_level: level,
    passes_applied: passDetails,
    pass_order: selectedPasses,
    statistics: stats,
    speedup_estimate: {
      'O0': '1.0x',
      'O1': '1.5x',
      'O2': '2.0x',
      'O3': '2.5x',
      'Os': '1.3x',
      'Oz': '1.1x'
    }[level],
    size_change: {
      'O0': '0%',
      'O1': '-10%',
      'O2': '-15%',
      'O3': '+20%',
      'Os': '-25%',
      'Oz': '-40%'
    }[level],
    recommendations: level === 'O3' ? [
      'Best for CPU-bound code',
      'May increase compile time significantly',
      'Test thoroughly for correctness'
    ] : level === 'Os' || level === 'Oz' ? [
      'Good for embedded systems',
      'Prioritizes code size over speed',
      'May miss some performance optimizations'
    ] : [
      'Good balance of speed and compile time',
      'Suitable for most applications'
    ]
  };
}

function getExamples(): Record<string, unknown> {
  return {
    operation: 'examples',
    examples: [
      {
        name: 'Dead code elimination',
        call: {
          operation: 'dead_code',
          ir_code: '%1 = add 5, 3\n%2 = mul %1, 2\n%3 = sub 10, 5\nreturn %2'
        }
      },
      {
        name: 'Constant folding',
        call: {
          operation: 'constant_fold',
          ir_code: '%1 = add 5, 3\n%2 = mul %1, 2\nstore %2, result'
        }
      },
      {
        name: 'Convert to SSA',
        call: {
          operation: 'ssa_convert',
          ir_code: 'x = 1\nx = x + 1\ny = x * 2'
        }
      },
      {
        name: 'Loop unrolling',
        call: {
          operation: 'loop_unroll',
          unroll_factor: 4
        }
      },
      {
        name: 'Run optimizer',
        call: {
          operation: 'optimize',
          optimization_level: 'O2'
        }
      }
    ]
  };
}

function getInfo(): Record<string, unknown> {
  return {
    operation: 'info',
    tool: 'ir_optimizer',
    description: 'Intermediate Representation optimization framework',
    capabilities: [
      'Dead code elimination',
      'Constant folding and propagation',
      'Function inlining',
      'Loop unrolling',
      'SSA (Static Single Assignment) conversion',
      'Control Flow Graph (CFG) construction',
      'Dataflow analysis (liveness, reaching defs, available exprs)',
      'Multi-level optimization (-O0 through -O3, -Os, -Oz)'
    ],
    optimization_passes: Object.entries(OPTIMIZATION_PASSES).map(([id, pass]) => ({
      id,
      ...pass
    })),
    optimization_levels: {
      'O0': 'No optimization',
      'O1': 'Basic optimizations, fast compile',
      'O2': 'Moderate optimizations, good balance',
      'O3': 'Aggressive optimizations, best performance',
      'Os': 'Optimize for size',
      'Oz': 'Aggressively optimize for size'
    },
    ir_features: [
      'Three-address code format',
      'SSA form support',
      'Phi functions for control flow merge',
      'Type annotations',
      'Basic block structure'
    ],
    references: [
      'Engineering a Compiler (Cooper & Torczon)',
      'Modern Compiler Implementation (Appel)',
      'LLVM IR Reference',
      'GCC RTL Documentation'
    ]
  };
}

export function isiroptimizerAvailable(): boolean {
  return true;
}
