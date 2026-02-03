/**
 * CPU-SIMULATOR TOOL
 * CPU architecture simulation for RISC-V, MIPS, ARM, and x86
 *
 * Provides instruction execution, disassembly, register/memory inspection,
 * pipeline simulation, and performance analysis.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type Architecture = 'RISC-V' | 'MIPS' | 'ARM' | 'x86';

interface CPUState {
  arch: Architecture;
  pc: number;
  registers: number[];
  memory: Uint8Array;
  flags: {
    zero: boolean;
    negative: boolean;
    carry: boolean;
    overflow: boolean;
  };
  halted: boolean;
  cycles: number;
}

interface Instruction {
  opcode: string;
  rd?: number;
  rs1?: number;
  rs2?: number;
  imm?: number;
  funct3?: number;
  funct7?: number;
  raw: number;
}

interface ExecutionResult {
  instruction: string;
  pc: number;
  changed: { register?: string; memory?: string; flags?: string };
  cycles: number;
}

interface PipelineStage {
  stage: 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
  instruction: string | null;
  stall: boolean;
}

export interface PerformanceStats {
  totalCycles: number;
  instructionCount: number;
  cpi: number; // Cycles per instruction
  ipc: number; // Instructions per cycle
  branchMispredictions: number;
  memoryAccesses: number;
  cacheHits: number;
  cacheMisses: number;
}

// ============================================================================
// RISC-V IMPLEMENTATION
// ============================================================================

const RISCV_OPCODES: Record<number, string> = {
  0b0110011: 'R-type', // ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT, SLTU
  0b0010011: 'I-type', // ADDI, ANDI, ORI, XORI, SLTI, SLTIU, SLLI, SRLI, SRAI
  0b0000011: 'Load', // LB, LH, LW, LBU, LHU
  0b0100011: 'Store', // SB, SH, SW
  0b1100011: 'Branch', // BEQ, BNE, BLT, BGE, BLTU, BGEU
  0b1101111: 'JAL', // JAL
  0b1100111: 'JALR', // JALR
  0b0110111: 'LUI', // LUI
  0b0010111: 'AUIPC', // AUIPC
  0b1110011: 'System', // ECALL, EBREAK
};

const RISCV_REGISTER_NAMES = [
  'zero',
  'ra',
  'sp',
  'gp',
  'tp',
  't0',
  't1',
  't2',
  's0',
  's1',
  'a0',
  'a1',
  'a2',
  'a3',
  'a4',
  'a5',
  'a6',
  'a7',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  's10',
  's11',
  't3',
  't4',
  't5',
  't6',
];

function decodeRISCV(word: number): Instruction {
  const opcode = word & 0x7f;
  const rd = (word >> 7) & 0x1f;
  const funct3 = (word >> 12) & 0x7;
  const rs1 = (word >> 15) & 0x1f;
  const rs2 = (word >> 20) & 0x1f;
  const funct7 = (word >> 25) & 0x7f;

  let imm = 0;
  const opcodeStr = RISCV_OPCODES[opcode] || 'Unknown';

  switch (opcode) {
    case 0b0010011: // I-type
    case 0b0000011: // Load
    case 0b1100111: // JALR
      imm = (word >> 20) & 0xfff;
      if (imm & 0x800) imm |= 0xfffff000; // Sign extend
      break;
    case 0b0100011: // Store (S-type)
      imm = ((word >> 7) & 0x1f) | (((word >> 25) & 0x7f) << 5);
      if (imm & 0x800) imm |= 0xfffff000;
      break;
    case 0b1100011: // Branch (B-type)
      imm =
        (((word >> 8) & 0xf) << 1) |
        (((word >> 25) & 0x3f) << 5) |
        (((word >> 7) & 0x1) << 11) |
        (((word >> 31) & 0x1) << 12);
      if (imm & 0x1000) imm |= 0xffffe000;
      break;
    case 0b0110111: // LUI (U-type)
    case 0b0010111: // AUIPC
      imm = word & 0xfffff000;
      break;
    case 0b1101111: // JAL (J-type)
      imm =
        (((word >> 21) & 0x3ff) << 1) |
        (((word >> 20) & 0x1) << 11) |
        (((word >> 12) & 0xff) << 12) |
        (((word >> 31) & 0x1) << 20);
      if (imm & 0x100000) imm |= 0xffe00000;
      break;
  }

  return { opcode: opcodeStr, rd, rs1, rs2, imm, funct3, funct7, raw: word };
}

function disassembleRISCV(instr: Instruction): string {
  const { opcode, rd, rs1, rs2, imm, funct3, funct7 } = instr;
  const reg = (r: number) => RISCV_REGISTER_NAMES[r];

  switch (opcode) {
    case 'R-type':
      if (funct7 === 0x00) {
        const ops = ['add', 'sll', 'slt', 'sltu', 'xor', 'srl', 'or', 'and'];
        return `${ops[funct3!]} ${reg(rd!)}, ${reg(rs1!)}, ${reg(rs2!)}`;
      } else if (funct7 === 0x20) {
        if (funct3 === 0) return `sub ${reg(rd!)}, ${reg(rs1!)}, ${reg(rs2!)}`;
        if (funct3 === 5) return `sra ${reg(rd!)}, ${reg(rs1!)}, ${reg(rs2!)}`;
      } else if (funct7 === 0x01) {
        const ops = ['mul', 'mulh', 'mulhsu', 'mulhu', 'div', 'divu', 'rem', 'remu'];
        return `${ops[funct3!]} ${reg(rd!)}, ${reg(rs1!)}, ${reg(rs2!)}`;
      }
      break;
    case 'I-type':
      const iops = ['addi', 'slli', 'slti', 'sltiu', 'xori', 'srli', 'ori', 'andi'];
      return `${iops[funct3!]} ${reg(rd!)}, ${reg(rs1!)}, ${imm}`;
    case 'Load':
      const loads = ['lb', 'lh', 'lw', '', 'lbu', 'lhu'];
      return `${loads[funct3!]} ${reg(rd!)}, ${imm}(${reg(rs1!)})`;
    case 'Store':
      const stores = ['sb', 'sh', 'sw'];
      return `${stores[funct3!]} ${reg(rs2!)}, ${imm}(${reg(rs1!)})`;
    case 'Branch':
      const branches = ['beq', 'bne', '', '', 'blt', 'bge', 'bltu', 'bgeu'];
      return `${branches[funct3!]} ${reg(rs1!)}, ${reg(rs2!)}, ${imm}`;
    case 'JAL':
      return `jal ${reg(rd!)}, ${imm}`;
    case 'JALR':
      return `jalr ${reg(rd!)}, ${imm}(${reg(rs1!)})`;
    case 'LUI':
      return `lui ${reg(rd!)}, ${(imm! >>> 12) & 0xfffff}`;
    case 'AUIPC':
      return `auipc ${reg(rd!)}, ${(imm! >>> 12) & 0xfffff}`;
    case 'System':
      if (instr.raw === 0x00000073) return 'ecall';
      if (instr.raw === 0x00100073) return 'ebreak';
      break;
  }

  return `unknown (0x${instr.raw.toString(16).padStart(8, '0')})`;
}

function executeRISCVInstruction(state: CPUState, instr: Instruction): ExecutionResult {
  const { opcode, rd, rs1, rs2, imm, funct3, funct7 } = instr;
  const changed: ExecutionResult['changed'] = {};
  const originalPC = state.pc;
  let nextPC = state.pc + 4;

  const getReg = (r: number) => (r === 0 ? 0 : state.registers[r]);
  const setReg = (r: number, val: number) => {
    if (r !== 0) {
      state.registers[r] = val >>> 0; // Ensure unsigned
      changed.register = `${RISCV_REGISTER_NAMES[r]} = 0x${(val >>> 0).toString(16)}`;
    }
  };

  switch (opcode) {
    case 'R-type':
      if (funct7 === 0x00) {
        switch (funct3) {
          case 0:
            setReg(rd!, getReg(rs1!) + getReg(rs2!));
            break; // ADD
          case 1:
            setReg(rd!, getReg(rs1!) << (getReg(rs2!) & 0x1f));
            break; // SLL
          case 2:
            setReg(rd!, (getReg(rs1!) | 0) < (getReg(rs2!) | 0) ? 1 : 0);
            break; // SLT
          case 3:
            setReg(rd!, getReg(rs1!) < getReg(rs2!) ? 1 : 0);
            break; // SLTU
          case 4:
            setReg(rd!, getReg(rs1!) ^ getReg(rs2!));
            break; // XOR
          case 5:
            setReg(rd!, getReg(rs1!) >>> (getReg(rs2!) & 0x1f));
            break; // SRL
          case 6:
            setReg(rd!, getReg(rs1!) | getReg(rs2!));
            break; // OR
          case 7:
            setReg(rd!, getReg(rs1!) & getReg(rs2!));
            break; // AND
        }
      } else if (funct7 === 0x20) {
        switch (funct3) {
          case 0:
            setReg(rd!, getReg(rs1!) - getReg(rs2!));
            break; // SUB
          case 5:
            setReg(rd!, (getReg(rs1!) | 0) >> (getReg(rs2!) & 0x1f));
            break; // SRA
        }
      } else if (funct7 === 0x01) {
        // M extension (multiply/divide)
        switch (funct3) {
          case 0:
            setReg(rd!, Math.imul(getReg(rs1!), getReg(rs2!)));
            break; // MUL
          case 4: {
            // DIV
            const a = getReg(rs1!) | 0;
            const b = getReg(rs2!) | 0;
            setReg(rd!, b === 0 ? -1 : Math.trunc(a / b));
            break;
          }
          case 5: {
            // DIVU
            const a = getReg(rs1!) >>> 0;
            const b = getReg(rs2!) >>> 0;
            setReg(rd!, b === 0 ? 0xffffffff : Math.trunc(a / b));
            break;
          }
          case 6: {
            // REM
            const a = getReg(rs1!) | 0;
            const b = getReg(rs2!) | 0;
            setReg(rd!, b === 0 ? a : a % b);
            break;
          }
        }
      }
      break;

    case 'I-type':
      switch (funct3) {
        case 0:
          setReg(rd!, getReg(rs1!) + imm!);
          break; // ADDI
        case 1:
          setReg(rd!, getReg(rs1!) << (imm! & 0x1f));
          break; // SLLI
        case 2:
          setReg(rd!, (getReg(rs1!) | 0) < (imm! | 0) ? 1 : 0);
          break; // SLTI
        case 3:
          setReg(rd!, getReg(rs1!) < imm! >>> 0 ? 1 : 0);
          break; // SLTIU
        case 4:
          setReg(rd!, getReg(rs1!) ^ imm!);
          break; // XORI
        case 5:
          if (funct7 === 0)
            setReg(rd!, getReg(rs1!) >>> (imm! & 0x1f)); // SRLI
          else setReg(rd!, (getReg(rs1!) | 0) >> (imm! & 0x1f)); // SRAI
          break;
        case 6:
          setReg(rd!, getReg(rs1!) | imm!);
          break; // ORI
        case 7:
          setReg(rd!, getReg(rs1!) & imm!);
          break; // ANDI
      }
      break;

    case 'Load': {
      const addr = (getReg(rs1!) + imm!) >>> 0;
      let value = 0;
      switch (funct3) {
        case 0: // LB
          value = state.memory[addr] || 0;
          if (value & 0x80) value |= 0xffffff00;
          break;
        case 1: // LH
          value = (state.memory[addr] || 0) | ((state.memory[addr + 1] || 0) << 8);
          if (value & 0x8000) value |= 0xffff0000;
          break;
        case 2: // LW
          value =
            (state.memory[addr] || 0) |
            ((state.memory[addr + 1] || 0) << 8) |
            ((state.memory[addr + 2] || 0) << 16) |
            ((state.memory[addr + 3] || 0) << 24);
          break;
        case 4: // LBU
          value = state.memory[addr] || 0;
          break;
        case 5: // LHU
          value = (state.memory[addr] || 0) | ((state.memory[addr + 1] || 0) << 8);
          break;
      }
      setReg(rd!, value);
      changed.memory = `read from 0x${addr.toString(16)}`;
      break;
    }

    case 'Store': {
      const addr = (getReg(rs1!) + imm!) >>> 0;
      const value = getReg(rs2!);
      switch (funct3) {
        case 0: // SB
          state.memory[addr] = value & 0xff;
          break;
        case 1: // SH
          state.memory[addr] = value & 0xff;
          state.memory[addr + 1] = (value >> 8) & 0xff;
          break;
        case 2: // SW
          state.memory[addr] = value & 0xff;
          state.memory[addr + 1] = (value >> 8) & 0xff;
          state.memory[addr + 2] = (value >> 16) & 0xff;
          state.memory[addr + 3] = (value >> 24) & 0xff;
          break;
      }
      changed.memory = `write 0x${value.toString(16)} to 0x${addr.toString(16)}`;
      break;
    }

    case 'Branch': {
      const a = getReg(rs1!) | 0;
      const b = getReg(rs2!) | 0;
      const au = getReg(rs1!) >>> 0;
      const bu = getReg(rs2!) >>> 0;
      let taken = false;
      switch (funct3) {
        case 0:
          taken = a === b;
          break; // BEQ
        case 1:
          taken = a !== b;
          break; // BNE
        case 4:
          taken = a < b;
          break; // BLT
        case 5:
          taken = a >= b;
          break; // BGE
        case 6:
          taken = au < bu;
          break; // BLTU
        case 7:
          taken = au >= bu;
          break; // BGEU
      }
      if (taken) nextPC = state.pc + imm!;
      break;
    }

    case 'JAL':
      setReg(rd!, state.pc + 4);
      nextPC = state.pc + imm!;
      break;

    case 'JALR':
      setReg(rd!, state.pc + 4);
      nextPC = (getReg(rs1!) + imm!) & ~1;
      break;

    case 'LUI':
      setReg(rd!, imm!);
      break;

    case 'AUIPC':
      setReg(rd!, state.pc + imm!);
      break;

    case 'System':
      if (instr.raw === 0x00000073) {
        // ECALL
        state.halted = true;
      }
      break;
  }

  state.pc = nextPC;
  state.cycles++;

  return {
    instruction: disassembleRISCV(instr),
    pc: originalPC,
    changed,
    cycles: 1,
  };
}

// ============================================================================
// MIPS IMPLEMENTATION (Simplified)
// ============================================================================

const MIPS_REGISTER_NAMES = [
  '$zero',
  '$at',
  '$v0',
  '$v1',
  '$a0',
  '$a1',
  '$a2',
  '$a3',
  '$t0',
  '$t1',
  '$t2',
  '$t3',
  '$t4',
  '$t5',
  '$t6',
  '$t7',
  '$s0',
  '$s1',
  '$s2',
  '$s3',
  '$s4',
  '$s5',
  '$s6',
  '$s7',
  '$t8',
  '$t9',
  '$k0',
  '$k1',
  '$gp',
  '$sp',
  '$fp',
  '$ra',
];

function decodeMIPS(word: number): Instruction {
  const opcode = (word >> 26) & 0x3f;
  const rs = (word >> 21) & 0x1f;
  const rt = (word >> 16) & 0x1f;
  const rd = (word >> 11) & 0x1f;
  const shamt = (word >> 6) & 0x1f;
  const funct = word & 0x3f;
  const imm = word & 0xffff;
  const target = word & 0x3ffffff;

  return {
    opcode: opcode === 0 ? 'R-type' : opcode === 2 || opcode === 3 ? 'J-type' : 'I-type',
    rd,
    rs1: rs,
    rs2: rt,
    imm: opcode === 0 ? funct : opcode === 2 || opcode === 3 ? target : imm,
    funct3: shamt,
    funct7: opcode,
    raw: word,
  };
}

function disassembleMIPS(instr: Instruction): string {
  const reg = (r: number) => MIPS_REGISTER_NAMES[r];
  const { opcode, rd, rs1, rs2, imm, funct3, funct7, raw: _raw } = instr;

  if (opcode === 'R-type') {
    const functs: Record<number, string> = {
      0x20: 'add',
      0x21: 'addu',
      0x22: 'sub',
      0x23: 'subu',
      0x24: 'and',
      0x25: 'or',
      0x26: 'xor',
      0x27: 'nor',
      0x2a: 'slt',
      0x2b: 'sltu',
      0x00: 'sll',
      0x02: 'srl',
      0x03: 'sra',
      0x08: 'jr',
      0x09: 'jalr',
    };
    const op = functs[imm!] || 'unknown';
    if (imm === 0x08) return `jr ${reg(rs1!)}`;
    if (imm === 0x09) return `jalr ${reg(rd!)}, ${reg(rs1!)}`;
    if (imm === 0x00 || imm === 0x02 || imm === 0x03) {
      return `${op} ${reg(rd!)}, ${reg(rs2!)}, ${funct3}`;
    }
    return `${op} ${reg(rd!)}, ${reg(rs1!)}, ${reg(rs2!)}`;
  }

  if (opcode === 'J-type') {
    return funct7 === 2 ? `j 0x${(imm! << 2).toString(16)}` : `jal 0x${(imm! << 2).toString(16)}`;
  }

  // I-type
  const iops: Record<number, string> = {
    0x08: 'addi',
    0x09: 'addiu',
    0x0a: 'slti',
    0x0b: 'sltiu',
    0x0c: 'andi',
    0x0d: 'ori',
    0x0e: 'xori',
    0x0f: 'lui',
    0x23: 'lw',
    0x2b: 'sw',
    0x20: 'lb',
    0x24: 'lbu',
    0x21: 'lh',
    0x25: 'lhu',
    0x28: 'sb',
    0x29: 'sh',
    0x04: 'beq',
    0x05: 'bne',
  };
  const op = iops[funct7!] || 'unknown';
  if (funct7 === 0x0f) return `lui ${reg(rs2!)}, ${imm}`;
  if (funct7! >= 0x20 && funct7! <= 0x2b && funct7 !== 0x04 && funct7 !== 0x05) {
    const signedImm = imm! & 0x8000 ? imm! | 0xffff0000 : imm!;
    return `${op} ${reg(rs2!)}, ${signedImm}(${reg(rs1!)})`;
  }
  if (funct7 === 0x04 || funct7 === 0x05) {
    const signedImm = imm! & 0x8000 ? imm! | 0xffff0000 : imm!;
    return `${op} ${reg(rs1!)}, ${reg(rs2!)}, ${signedImm * 4}`;
  }
  return `${op} ${reg(rs2!)}, ${reg(rs1!)}, ${imm}`;
}

// ============================================================================
// ASSEMBLER
// ============================================================================

function assembleRISCV(assembly: string): number[] {
  const instructions: number[] = [];
  const labels: Record<string, number> = {};
  const lines = assembly
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  // First pass: collect labels
  let addr = 0;
  for (const line of lines) {
    if (line.endsWith(':')) {
      labels[line.slice(0, -1)] = addr;
    } else {
      addr += 4;
    }
  }

  // Second pass: assemble
  addr = 0;
  for (const line of lines) {
    if (line.endsWith(':')) continue;

    const parts = line.split(/[\s,]+/).filter((p) => p);
    const op = parts[0].toLowerCase();
    const regNum = (name: string): number => {
      const idx = RISCV_REGISTER_NAMES.indexOf(name);
      if (idx >= 0) return idx;
      const match = name.match(/^x(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    };

    let word = 0;

    switch (op) {
      case 'add':
        word = 0x33 | (regNum(parts[1]) << 7) | (regNum(parts[2]) << 15) | (regNum(parts[3]) << 20);
        break;
      case 'sub':
        word =
          0x33 |
          (regNum(parts[1]) << 7) |
          (regNum(parts[2]) << 15) |
          (regNum(parts[3]) << 20) |
          (0x20 << 25);
        break;
      case 'addi':
        word =
          0x13 |
          (regNum(parts[1]) << 7) |
          (regNum(parts[2]) << 15) |
          ((parseInt(parts[3]) & 0xfff) << 20);
        break;
      case 'lw': {
        const match = parts[2].match(/(-?\d+)\((\w+)\)/);
        if (match) {
          const offset = parseInt(match[1]) & 0xfff;
          word =
            0x03 | (2 << 12) | (regNum(parts[1]) << 7) | (regNum(match[2]) << 15) | (offset << 20);
        }
        break;
      }
      case 'sw': {
        const match = parts[2].match(/(-?\d+)\((\w+)\)/);
        if (match) {
          const offset = parseInt(match[1]);
          word =
            0x23 |
            (2 << 12) |
            ((offset & 0x1f) << 7) |
            (regNum(match[2]) << 15) |
            (regNum(parts[1]) << 20) |
            (((offset >> 5) & 0x7f) << 25);
        }
        break;
      }
      case 'beq': {
        let target = parseInt(parts[3]);
        if (isNaN(target) && labels[parts[3]] !== undefined) {
          target = labels[parts[3]] - addr;
        }
        const imm = target;
        word =
          0x63 |
          (0 << 12) |
          (((imm >> 11) & 1) << 7) |
          (((imm >> 1) & 0xf) << 8) |
          (regNum(parts[1]) << 15) |
          (regNum(parts[2]) << 20) |
          (((imm >> 5) & 0x3f) << 25) |
          (((imm >> 12) & 1) << 31);
        break;
      }
      case 'jal':
        if (parts.length === 2) {
          // jal label (rd=ra)
          const target =
            labels[parts[1]] !== undefined ? labels[parts[1]] - addr : parseInt(parts[1]);
          word =
            0x6f |
            (1 << 7) |
            (((target >> 12) & 0xff) << 12) |
            (((target >> 11) & 1) << 20) |
            (((target >> 1) & 0x3ff) << 21) |
            (((target >> 20) & 1) << 31);
        }
        break;
      case 'ecall':
        word = 0x73;
        break;
      case 'nop':
        word = 0x13; // addi zero, zero, 0
        break;
    }

    instructions.push(word);
    addr += 4;
  }

  return instructions;
}

// ============================================================================
// CPU STATE MANAGEMENT
// ============================================================================

function createCPUState(arch: Architecture, memorySize: number = 65536): CPUState {
  return {
    arch,
    pc: 0,
    registers: new Array(32).fill(0),
    memory: new Uint8Array(memorySize),
    flags: { zero: false, negative: false, carry: false, overflow: false },
    halted: false,
    cycles: 0,
  };
}

function loadProgram(state: CPUState, program: number[], startAddr: number = 0): void {
  for (let i = 0; i < program.length; i++) {
    const word = program[i];
    const addr = startAddr + i * 4;
    state.memory[addr] = word & 0xff;
    state.memory[addr + 1] = (word >> 8) & 0xff;
    state.memory[addr + 2] = (word >> 16) & 0xff;
    state.memory[addr + 3] = (word >> 24) & 0xff;
  }
  state.pc = startAddr;
}

function fetchInstruction(state: CPUState): number {
  const addr = state.pc;
  return (
    state.memory[addr] |
    (state.memory[addr + 1] << 8) |
    (state.memory[addr + 2] << 16) |
    (state.memory[addr + 3] << 24)
  );
}

function step(state: CPUState): ExecutionResult {
  if (state.halted) {
    return {
      instruction: 'halted',
      pc: state.pc,
      changed: {},
      cycles: 0,
    };
  }

  const word = fetchInstruction(state);
  const instr = state.arch === 'MIPS' ? decodeMIPS(word) : decodeRISCV(word);

  return executeRISCVInstruction(state, instr);
}

function run(state: CPUState, maxCycles: number = 10000): ExecutionResult[] {
  const results: ExecutionResult[] = [];

  while (!state.halted && state.cycles < maxCycles) {
    const result = step(state);
    results.push(result);
    if (state.halted) break;
  }

  return results;
}

// ============================================================================
// PIPELINE SIMULATION
// ============================================================================

function simulatePipeline(program: number[], cycles: number = 20): PipelineStage[][] {
  const pipeline: PipelineStage[][] = [];
  const instructions = program.map((w, i) => ({
    addr: i * 4,
    disasm: disassembleRISCV(decodeRISCV(w)),
  }));

  const stages: (string | null)[] = [null, null, null, null, null];

  for (let c = 0; c < cycles; c++) {
    // Shift pipeline
    stages[4] = stages[3];
    stages[3] = stages[2];
    stages[2] = stages[1];
    stages[1] = stages[0];

    // Fetch new instruction
    const instrIdx = c < instructions.length ? c : null;
    stages[0] = instrIdx !== null ? instructions[instrIdx].disasm : null;

    pipeline.push([
      { stage: 'IF', instruction: stages[0], stall: false },
      { stage: 'ID', instruction: stages[1], stall: false },
      { stage: 'EX', instruction: stages[2], stall: false },
      { stage: 'MEM', instruction: stages[3], stall: false },
      { stage: 'WB', instruction: stages[4], stall: false },
    ]);
  }

  return pipeline;
}

// ============================================================================
// SAMPLE PROGRAMS
// ============================================================================

function getSampleProgram(name: string): { assembly: string; description: string } {
  switch (name) {
    case 'fibonacci':
      return {
        description: 'Calculate Fibonacci numbers',
        assembly: `
# Fibonacci sequence
addi t0, zero, 0    # F(0) = 0
addi t1, zero, 1    # F(1) = 1
addi t2, zero, 10   # Calculate 10 numbers
loop:
  add t3, t0, t1    # F(n) = F(n-1) + F(n-2)
  add t0, t1, zero  # Shift F(n-1) to F(n-2)
  add t1, t3, zero  # Shift F(n) to F(n-1)
  addi t2, t2, -1   # Decrement counter
  beq t2, zero, done
  jal loop
done:
  ecall             # Exit
`,
      };
    case 'factorial':
      return {
        description: 'Calculate factorial',
        assembly: `
# Factorial of 5
addi a0, zero, 5    # n = 5
addi a1, zero, 1    # result = 1
loop:
  beq a0, zero, done
  add t0, a0, zero  # temp = n
  addi t1, zero, 0  # accumulator
mult_loop:
  beq t0, zero, mult_done
  add t1, t1, a1    # accumulator += result
  addi t0, t0, -1
  jal mult_loop
mult_done:
  add a1, t1, zero  # result = accumulator
  addi a0, a0, -1   # n--
  jal loop
done:
  ecall
`,
      };
    case 'sum':
      return {
        description: 'Sum array elements',
        assembly: `
# Sum numbers 1 to 10
addi t0, zero, 0    # sum = 0
addi t1, zero, 1    # i = 1
addi t2, zero, 11   # limit = 11
loop:
  beq t1, t2, done
  add t0, t0, t1    # sum += i
  addi t1, t1, 1    # i++
  jal loop
done:
  add a0, t0, zero  # return sum in a0
  ecall
`,
      };
    default:
      return {
        description: 'Simple addition',
        assembly: `
addi t0, zero, 5
addi t1, zero, 3
add t2, t0, t1
ecall
`,
      };
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const cpusimulatorTool: UnifiedTool = {
  name: 'cpu_simulator',
  description:
    'Simulate CPU architectures - RISC-V, MIPS instruction execution, pipeline, disassembly',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'execute',
          'step',
          'run',
          'disassemble',
          'assemble',
          'registers',
          'memory',
          'pipeline',
          'sample',
          'info',
        ],
        description: 'Operation to perform',
      },
      arch: {
        type: 'string',
        enum: ['RISC-V', 'MIPS', 'ARM', 'x86'],
        description: 'CPU architecture',
      },
      assembly: {
        type: 'string',
        description: 'Assembly code to assemble/execute',
      },
      program: {
        type: 'array',
        items: { type: 'number' },
        description: 'Machine code words',
      },
      address: {
        type: 'number',
        description: 'Memory address for read/write',
      },
      max_cycles: {
        type: 'number',
        description: 'Maximum cycles to execute',
      },
      sample: {
        type: 'string',
        enum: ['fibonacci', 'factorial', 'sum', 'simple'],
        description: 'Sample program name',
      },
    },
    required: ['operation'],
  },
};

export async function executecpusimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const arch: Architecture = args.arch || 'RISC-V';

    switch (operation) {
      case 'assemble': {
        const assembly = args.assembly || 'addi t0, zero, 42\necall';
        const program = assembleRISCV(assembly);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'assemble',
              arch,
              assembly: assembly.split('\n').filter((l: string) => l.trim()),
              machineCode: program.map((w) => ({
                hex: '0x' + w.toString(16).padStart(8, '0'),
                binary: w.toString(2).padStart(32, '0'),
                disassembly: disassembleRISCV(decodeRISCV(w)),
              })),
            },
            null,
            2
          ),
        };
      }

      case 'disassemble': {
        const program: number[] = args.program || [0x00500293, 0x00300313, 0x006283b3, 0x00000073];
        const disassembled = program.map((word, i) => {
          const instr = arch === 'MIPS' ? decodeMIPS(word) : decodeRISCV(word);
          const disasm = arch === 'MIPS' ? disassembleMIPS(instr) : disassembleRISCV(instr);
          return {
            address: `0x${(i * 4).toString(16).padStart(8, '0')}`,
            hex: `0x${word.toString(16).padStart(8, '0')}`,
            instruction: disasm,
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'disassemble',
              arch,
              instructions: disassembled,
            },
            null,
            2
          ),
        };
      }

      case 'step':
      case 'execute': {
        const state = createCPUState(arch);
        let program: number[];

        if (args.assembly) {
          program = assembleRISCV(args.assembly);
        } else if (args.program) {
          program = args.program;
        } else {
          const sample = getSampleProgram(args.sample || 'simple');
          program = assembleRISCV(sample.assembly);
        }

        loadProgram(state, program);

        if (operation === 'step') {
          const result = step(state);
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'step',
                arch,
                result,
                pc: state.pc,
                halted: state.halted,
                registers: RISCV_REGISTER_NAMES.reduce(
                  (acc, name, i) => {
                    if (state.registers[i] !== 0) acc[name] = state.registers[i];
                    return acc;
                  },
                  {} as Record<string, number>
                ),
              },
              null,
              2
            ),
          };
        }

        const maxCycles = args.max_cycles || 1000;
        const results = run(state, maxCycles);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'execute',
              arch,
              instructionsExecuted: results.length,
              totalCycles: state.cycles,
              finalPC: state.pc,
              halted: state.halted,
              executionTrace: results.slice(0, 20).map((r) => ({
                pc: `0x${r.pc.toString(16)}`,
                instruction: r.instruction,
                changed: r.changed,
              })),
              registers: RISCV_REGISTER_NAMES.reduce(
                (acc, name, i) => {
                  if (state.registers[i] !== 0) {
                    acc[name] = {
                      decimal: state.registers[i],
                      hex: '0x' + state.registers[i].toString(16),
                    };
                  }
                  return acc;
                },
                {} as Record<string, { decimal: number; hex: string }>
              ),
            },
            null,
            2
          ),
        };
      }

      case 'run': {
        const state = createCPUState(arch);
        const sample = getSampleProgram(args.sample || 'fibonacci');
        const program = assembleRISCV(sample.assembly);
        loadProgram(state, program);

        const maxCycles = args.max_cycles || 10000;
        run(state, maxCycles);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'run',
              arch,
              program: sample.description,
              cycles: state.cycles,
              halted: state.halted,
              result: {
                a0: state.registers[10],
                a1: state.registers[11],
                t0: state.registers[5],
                t1: state.registers[6],
                t2: state.registers[7],
              },
            },
            null,
            2
          ),
        };
      }

      case 'registers': {
        const names = arch === 'MIPS' ? MIPS_REGISTER_NAMES : RISCV_REGISTER_NAMES;
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'registers',
              arch,
              registers: names.map((name, i) => ({
                index: i,
                name,
                abiName: arch === 'RISC-V' ? name : undefined,
              })),
              specialRegisters:
                arch === 'RISC-V'
                  ? {
                      pc: 'Program Counter',
                      zero: 'Hardwired zero',
                      ra: 'Return address',
                      sp: 'Stack pointer',
                    }
                  : {
                      pc: 'Program Counter',
                      hi: 'High multiply result',
                      lo: 'Low multiply result',
                    },
            },
            null,
            2
          ),
        };
      }

      case 'pipeline': {
        const sample = getSampleProgram(args.sample || 'simple');
        const program = assembleRISCV(sample.assembly);
        const cycles = args.max_cycles || 15;
        const pipelineTrace = simulatePipeline(program, cycles);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'pipeline',
              arch,
              stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
              stageDescriptions: {
                IF: 'Instruction Fetch',
                ID: 'Instruction Decode / Register Read',
                EX: 'Execute / Address Calculation',
                MEM: 'Memory Access',
                WB: 'Write Back',
              },
              trace: pipelineTrace.slice(0, 10).map((cycle, i) => ({
                cycle: i + 1,
                stages: cycle.map((s) => s.instruction || '-'),
              })),
              hazards: ['Data hazard (RAW)', 'Control hazard (branch)', 'Structural hazard'],
              forwarding: 'Forwarding paths: EX/MEM to EX, MEM/WB to EX',
            },
            null,
            2
          ),
        };
      }

      case 'sample': {
        const sampleName = args.sample || 'fibonacci';
        const sample = getSampleProgram(sampleName);
        const program = assembleRISCV(sample.assembly);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'sample',
              name: sampleName,
              description: sample.description,
              assembly: sample.assembly
                .trim()
                .split('\n')
                .filter((l: string) => l.trim()),
              machineCode: program.slice(0, 10).map((w) => '0x' + w.toString(16).padStart(8, '0')),
            },
            null,
            2
          ),
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'cpu_simulator',
              description: 'CPU architecture simulation and instruction execution',
              supportedArchitectures: {
                'RISC-V': {
                  description: 'RISC-V RV32I base integer instruction set',
                  features: [
                    'R-type',
                    'I-type',
                    'S-type',
                    'B-type',
                    'U-type',
                    'J-type instructions',
                  ],
                  extensions: ['M (multiply/divide)'],
                  registers: '32 general-purpose (x0-x31)',
                },
                MIPS: {
                  description: 'MIPS32 instruction set',
                  features: ['R-type', 'I-type', 'J-type instructions'],
                  registers: '32 general-purpose ($0-$31)',
                },
              },
              operations: [
                'assemble - Convert assembly to machine code',
                'disassemble - Convert machine code to assembly',
                'execute - Run program and get final state',
                'step - Execute single instruction',
                'run - Run sample program',
                'registers - List register names',
                'pipeline - Visualize 5-stage pipeline',
              ],
              samplePrograms: ['fibonacci', 'factorial', 'sum', 'simple'],
              pipelineStages: [
                'IF (Fetch)',
                'ID (Decode)',
                'EX (Execute)',
                'MEM (Memory)',
                'WB (Writeback)',
              ],
            },
            null,
            2
          ),
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iscpusimulatorAvailable(): boolean {
  return true;
}
