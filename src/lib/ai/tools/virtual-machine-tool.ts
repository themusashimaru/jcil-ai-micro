/**
 * VIRTUAL MACHINE TOOL
 * Stack-based VM with bytecode execution
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

enum OpCode {
  PUSH, POP, ADD, SUB, MUL, DIV, MOD, NEG,
  EQ, NE, LT, LE, GT, GE, AND, OR, NOT,
  LOAD, STORE, JMP, JZ, JNZ, CALL, RET,
  PRINT, HALT, DUP, SWAP
}

interface VM {
  stack: number[];
  memory: number[];
  pc: number;
  callStack: number[];
  output: string[];
  running: boolean;
}

function createVM(memSize: number = 1024): VM {
  return { stack: [], memory: new Array(memSize).fill(0), pc: 0, callStack: [], output: [], running: true };
}

function execute(vm: VM, program: number[]): { output: string[]; finalStack: number[]; memory: number[]; steps: number } {
  let steps = 0;
  const maxSteps = 10000;
  
  while (vm.running && vm.pc < program.length && steps < maxSteps) {
    steps++;
    const op = program[vm.pc++];
    
    switch (op) {
      case OpCode.PUSH: vm.stack.push(program[vm.pc++]); break;
      case OpCode.POP: vm.stack.pop(); break;
      case OpCode.DUP: vm.stack.push(vm.stack[vm.stack.length - 1]); break;
      case OpCode.SWAP: {
        const a = vm.stack.pop()!;
        const b = vm.stack.pop()!;
        vm.stack.push(a, b);
        break;
      }
      case OpCode.ADD: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a + b);
        break;
      }
      case OpCode.SUB: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a - b);
        break;
      }
      case OpCode.MUL: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a * b);
        break;
      }
      case OpCode.DIV: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(Math.floor(a / b));
        break;
      }
      case OpCode.MOD: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a % b);
        break;
      }
      case OpCode.NEG: vm.stack.push(-vm.stack.pop()!); break;
      case OpCode.EQ: vm.stack.push(vm.stack.pop()! === vm.stack.pop()! ? 1 : 0); break;
      case OpCode.NE: vm.stack.push(vm.stack.pop()! !== vm.stack.pop()! ? 1 : 0); break;
      case OpCode.LT: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a < b ? 1 : 0);
        break;
      }
      case OpCode.LE: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a <= b ? 1 : 0);
        break;
      }
      case OpCode.GT: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a > b ? 1 : 0);
        break;
      }
      case OpCode.GE: {
        const b = vm.stack.pop()!;
        const a = vm.stack.pop()!;
        vm.stack.push(a >= b ? 1 : 0);
        break;
      }
      case OpCode.AND: vm.stack.push(vm.stack.pop()! && vm.stack.pop()! ? 1 : 0); break;
      case OpCode.OR: vm.stack.push(vm.stack.pop()! || vm.stack.pop()! ? 1 : 0); break;
      case OpCode.NOT: vm.stack.push(vm.stack.pop()! ? 0 : 1); break;
      case OpCode.LOAD: {
        const addr = program[vm.pc++];
        vm.stack.push(vm.memory[addr]);
        break;
      }
      case OpCode.STORE: {
        const addr = program[vm.pc++];
        vm.memory[addr] = vm.stack.pop()!;
        break;
      }
      case OpCode.JMP: vm.pc = program[vm.pc]; break;
      case OpCode.JZ: {
        const addr = program[vm.pc++];
        if (vm.stack.pop()! === 0) vm.pc = addr;
        break;
      }
      case OpCode.JNZ: {
        const addr = program[vm.pc++];
        if (vm.stack.pop()! !== 0) vm.pc = addr;
        break;
      }
      case OpCode.CALL: {
        const addr = program[vm.pc++];
        vm.callStack.push(vm.pc);
        vm.pc = addr;
        break;
      }
      case OpCode.RET: vm.pc = vm.callStack.pop()!; break;
      case OpCode.PRINT: vm.output.push(String(vm.stack.pop()!)); break;
      case OpCode.HALT: vm.running = false; break;
    }
  }
  
  return { output: vm.output, finalStack: vm.stack, memory: vm.memory.slice(0, 20), steps };
}

function assemble(code: string): number[] {
  const labels = new Map<string, number>();
  const program: number[] = [];
  const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
  
  // First pass: collect labels
  let addr = 0;
  for (const line of lines) {
    if (line.endsWith(':')) {
      labels.set(line.slice(0, -1), addr);
    } else {
      const parts = line.split(/\s+/);
      addr++;
      if (['PUSH', 'LOAD', 'STORE', 'JMP', 'JZ', 'JNZ', 'CALL'].includes(parts[0].toUpperCase())) addr++;
    }
  }
  
  // Second pass: generate bytecode
  for (const line of lines) {
    if (line.endsWith(':')) continue;
    const parts = line.split(/\s+/);
    const op = parts[0].toUpperCase();
    const opCode = OpCode[op as keyof typeof OpCode];
    if (opCode !== undefined) {
      program.push(opCode);
      if (parts.length > 1) {
        const arg = labels.get(parts[1]) ?? parseInt(parts[1]);
        program.push(arg);
      }
    }
  }
  
  return program;
}

export const virtualMachineTool: UnifiedTool = {
  name: 'virtual_machine',
  description: 'Stack-based virtual machine with bytecode execution',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['run', 'assemble', 'demo', 'info'], description: 'Operation' },
      program: { type: 'array', description: 'Bytecode program' },
      assembly: { type: 'string', description: 'Assembly code' }
    },
    required: ['operation']
  }
};

export async function executeVirtualMachine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'run': {
        const vm = createVM();
        const program = args.program || [OpCode.PUSH, 5, OpCode.PUSH, 3, OpCode.ADD, OpCode.PRINT, OpCode.HALT];
        result = execute(vm, program);
        break;
      }
      case 'assemble': {
        const code = args.assembly || 'PUSH 10\nPUSH 20\nADD\nPRINT\nHALT';
        const bytecode = assemble(code);
        const vm = createVM();
        const execResult = execute(vm, bytecode);
        result = { bytecode, ...execResult };
        break;
      }
      case 'demo': {
        // Factorial of 5
        const factorialCode = 'PUSH 5\nSTORE 0\nPUSH 1\nSTORE 1\nloop:\nLOAD 0\nPUSH 1\nLE\nJNZ end\nLOAD 1\nLOAD 0\nMUL\nSTORE 1\nLOAD 0\nPUSH 1\nSUB\nSTORE 0\nJMP loop\nend:\nLOAD 1\nPRINT\nHALT';
        const bytecode = assemble(factorialCode);
        const vm = createVM();
        result = { example: 'Factorial of 5', code: factorialCode, ...execute(vm, bytecode) };
        break;
      }
      case 'info':
      default:
        result = { 
          description: 'Stack-based virtual machine', 
          opcodes: Object.keys(OpCode).filter(k => isNaN(Number(k))),
          features: ['Arithmetic', 'Comparisons', 'Jumps', 'Function calls', 'Memory access']
        };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isVirtualMachineAvailable(): boolean { return true; }
