/**
 * VQE TOOL
 * Variational Quantum Eigensolver for molecular simulation
 * Implements quantum chemistry simulations using hybrid classical-quantum optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// COMPLEX NUMBER OPERATIONS
// =============================================================================

interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

export function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

function cMag2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

// =============================================================================
// QUANTUM STATE OPERATIONS
// =============================================================================

type StateVector = Complex[];

function createZeroState(numQubits: number): StateVector {
  const size = 1 << numQubits;
  const state: StateVector = new Array(size).fill(null).map(() => complex(0));
  state[0] = complex(1);
  return state;
}

function copyState(state: StateVector): StateVector {
  return state.map((c) => ({ ...c }));
}

export function normalizeState(state: StateVector): StateVector {
  const norm = Math.sqrt(state.reduce((sum, c) => sum + cMag2(c), 0));
  if (norm < 1e-10) return state;
  return state.map((c) => cScale(c, 1 / norm));
}

// =============================================================================
// QUANTUM GATES FOR VQE
// =============================================================================

export function applyRx(
  state: StateVector,
  qubit: number,
  numQubits: number,
  theta: number
): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);
  const cosHalf = Math.cos(theta / 2);
  const sinHalf = Math.sin(theta / 2);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const a = state[i];
      const b = state[j];
      // Rx gate: [[cos(θ/2), -i*sin(θ/2)], [-i*sin(θ/2), cos(θ/2)]]
      newState[i] = cAdd(cScale(a, cosHalf), cMul(b, complex(0, -sinHalf)));
      newState[j] = cAdd(cMul(a, complex(0, -sinHalf)), cScale(b, cosHalf));
    }
  }
  return newState;
}

function applyRy(state: StateVector, qubit: number, numQubits: number, theta: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);
  const cosHalf = Math.cos(theta / 2);
  const sinHalf = Math.sin(theta / 2);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const a = state[i];
      const b = state[j];
      // Ry gate: [[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]
      newState[i] = cAdd(cScale(a, cosHalf), cScale(b, -sinHalf));
      newState[j] = cAdd(cScale(a, sinHalf), cScale(b, cosHalf));
    }
  }
  return newState;
}

function applyRz(state: StateVector, qubit: number, numQubits: number, theta: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    // Rz gate: [[e^(-iθ/2), 0], [0, e^(iθ/2)]]
    if ((i & mask) === 0) {
      newState[i] = cMul(state[i], cExp(-theta / 2));
    } else {
      newState[i] = cMul(state[i], cExp(theta / 2));
    }
  }
  return newState;
}

function applyCNOT(
  state: StateVector,
  control: number,
  target: number,
  numQubits: number
): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const controlMask = 1 << (numQubits - 1 - control);
  const targetMask = 1 << (numQubits - 1 - target);

  for (let i = 0; i < size; i++) {
    if ((i & controlMask) !== 0 && (i & targetMask) === 0) {
      const j = i | targetMask;
      const temp = newState[i];
      newState[i] = newState[j];
      newState[j] = temp;
    }
  }
  return newState;
}

function applyX(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const temp = newState[i];
      newState[i] = newState[j];
      newState[j] = temp;
    }
  }
  return newState;
}

export function applyZ(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) !== 0) {
      newState[i] = cScale(newState[i], -1);
    }
  }
  return newState;
}

// =============================================================================
// MOLECULAR HAMILTONIANS
// =============================================================================

interface PauliTerm {
  coefficient: number;
  paulis: { qubit: number; operator: 'I' | 'X' | 'Y' | 'Z' }[];
}

interface Hamiltonian {
  terms: PauliTerm[];
  numQubits: number;
  molecule: string;
  bondLength?: number;
  description: string;
}

// H2 molecule Hamiltonian (STO-3G basis, Jordan-Wigner encoding)
function getH2Hamiltonian(bondLength: number = 0.74): Hamiltonian {
  // Simplified H2 Hamiltonian coefficients depend on bond length
  // These are approximate values from quantum chemistry calculations
  const R = bondLength;

  // Energy coefficients as function of bond length (simplified model)
  const g0 = -1.0523 + 0.5 * (R - 0.74) * (R - 0.74);
  const g1 = 0.3979 - 0.1 * (R - 0.74);
  const g2 = -0.3979 + 0.1 * (R - 0.74);
  const g3 = -0.0112;
  const g4 = 0.1809;

  return {
    molecule: 'H2',
    bondLength: R,
    numQubits: 4,
    description: 'Hydrogen molecule in STO-3G basis with Jordan-Wigner encoding',
    terms: [
      { coefficient: g0, paulis: [] }, // Identity term
      { coefficient: g1, paulis: [{ qubit: 0, operator: 'Z' }] },
      { coefficient: g1, paulis: [{ qubit: 1, operator: 'Z' }] },
      { coefficient: g2, paulis: [{ qubit: 2, operator: 'Z' }] },
      { coefficient: g2, paulis: [{ qubit: 3, operator: 'Z' }] },
      {
        coefficient: g3,
        paulis: [
          { qubit: 0, operator: 'Z' },
          { qubit: 1, operator: 'Z' },
        ],
      },
      {
        coefficient: g3,
        paulis: [
          { qubit: 0, operator: 'Z' },
          { qubit: 2, operator: 'Z' },
        ],
      },
      {
        coefficient: g4,
        paulis: [
          { qubit: 1, operator: 'Z' },
          { qubit: 2, operator: 'Z' },
        ],
      },
      {
        coefficient: g3,
        paulis: [
          { qubit: 0, operator: 'Z' },
          { qubit: 3, operator: 'Z' },
        ],
      },
      {
        coefficient: g4,
        paulis: [
          { qubit: 1, operator: 'Z' },
          { qubit: 3, operator: 'Z' },
        ],
      },
      {
        coefficient: g3,
        paulis: [
          { qubit: 2, operator: 'Z' },
          { qubit: 3, operator: 'Z' },
        ],
      },
      // XX + YY terms (fermionic hopping)
      {
        coefficient: 0.0452,
        paulis: [
          { qubit: 0, operator: 'X' },
          { qubit: 1, operator: 'X' },
          { qubit: 2, operator: 'X' },
          { qubit: 3, operator: 'X' },
        ],
      },
      {
        coefficient: 0.0452,
        paulis: [
          { qubit: 0, operator: 'Y' },
          { qubit: 1, operator: 'Y' },
          { qubit: 2, operator: 'X' },
          { qubit: 3, operator: 'X' },
        ],
      },
      {
        coefficient: 0.0452,
        paulis: [
          { qubit: 0, operator: 'X' },
          { qubit: 1, operator: 'X' },
          { qubit: 2, operator: 'Y' },
          { qubit: 3, operator: 'Y' },
        ],
      },
      {
        coefficient: 0.0452,
        paulis: [
          { qubit: 0, operator: 'Y' },
          { qubit: 1, operator: 'Y' },
          { qubit: 2, operator: 'Y' },
          { qubit: 3, operator: 'Y' },
        ],
      },
    ],
  };
}

// LiH molecule Hamiltonian (simplified)
function getLiHHamiltonian(bondLength: number = 1.6): Hamiltonian {
  const R = bondLength;
  // Simplified LiH Hamiltonian
  const offset = -7.8 + 0.5 * (R - 1.6) * (R - 1.6);

  return {
    molecule: 'LiH',
    bondLength: R,
    numQubits: 4,
    description: 'Lithium hydride in minimal basis with simplified Hamiltonian',
    terms: [
      { coefficient: offset, paulis: [] },
      { coefficient: 0.18, paulis: [{ qubit: 0, operator: 'Z' }] },
      { coefficient: 0.18, paulis: [{ qubit: 1, operator: 'Z' }] },
      { coefficient: -0.22, paulis: [{ qubit: 2, operator: 'Z' }] },
      { coefficient: -0.22, paulis: [{ qubit: 3, operator: 'Z' }] },
      {
        coefficient: 0.12,
        paulis: [
          { qubit: 0, operator: 'Z' },
          { qubit: 1, operator: 'Z' },
        ],
      },
      {
        coefficient: 0.17,
        paulis: [
          { qubit: 2, operator: 'Z' },
          { qubit: 3, operator: 'Z' },
        ],
      },
      {
        coefficient: 0.04,
        paulis: [
          { qubit: 0, operator: 'X' },
          { qubit: 1, operator: 'X' },
          { qubit: 2, operator: 'X' },
          { qubit: 3, operator: 'X' },
        ],
      },
    ],
  };
}

// BeH2 molecule Hamiltonian (simplified)
function getBeH2Hamiltonian(): Hamiltonian {
  return {
    molecule: 'BeH2',
    numQubits: 6,
    description: 'Beryllium dihydride in minimal basis (simplified)',
    terms: [
      { coefficient: -15.5, paulis: [] },
      { coefficient: 0.2, paulis: [{ qubit: 0, operator: 'Z' }] },
      { coefficient: 0.2, paulis: [{ qubit: 1, operator: 'Z' }] },
      { coefficient: -0.3, paulis: [{ qubit: 2, operator: 'Z' }] },
      { coefficient: -0.3, paulis: [{ qubit: 3, operator: 'Z' }] },
      { coefficient: -0.1, paulis: [{ qubit: 4, operator: 'Z' }] },
      { coefficient: -0.1, paulis: [{ qubit: 5, operator: 'Z' }] },
      {
        coefficient: 0.15,
        paulis: [
          { qubit: 0, operator: 'Z' },
          { qubit: 1, operator: 'Z' },
        ],
      },
      {
        coefficient: 0.12,
        paulis: [
          { qubit: 2, operator: 'Z' },
          { qubit: 3, operator: 'Z' },
        ],
      },
    ],
  };
}

function getHamiltonian(molecule: string, bondLength?: number): Hamiltonian {
  switch (molecule.toUpperCase()) {
    case 'H2':
      return getH2Hamiltonian(bondLength || 0.74);
    case 'LIH':
      return getLiHHamiltonian(bondLength || 1.6);
    case 'BEH2':
      return getBeH2Hamiltonian();
    default:
      return getH2Hamiltonian(bondLength || 0.74);
  }
}

// =============================================================================
// ANSATZ CIRCUITS
// =============================================================================

interface AnsatzConfig {
  type: 'UCCSD' | 'hardware_efficient' | 'RY';
  numQubits: number;
  depth: number;
  numParameters: number;
}

function getAnsatzConfig(type: string, numQubits: number, depth: number = 2): AnsatzConfig {
  let numParameters: number;

  switch (type) {
    case 'UCCSD':
      // UCCSD has parameters for single and double excitations
      numParameters = numQubits + (numQubits * (numQubits - 1)) / 2;
      break;
    case 'hardware_efficient':
      // Each layer: Ry on each qubit + entangling gates
      numParameters = numQubits * depth * 2; // Ry and Rz on each qubit per layer
      break;
    case 'RY':
    default:
      // Simple Ry rotation on each qubit per layer
      numParameters = numQubits * depth;
      break;
  }

  return {
    type: type as AnsatzConfig['type'],
    numQubits,
    depth,
    numParameters,
  };
}

function applyHartreeFockState(
  state: StateVector,
  numQubits: number,
  numElectrons: number
): StateVector {
  // Prepare Hartree-Fock initial state (fill lowest orbitals)
  let newState = state;
  for (let i = 0; i < Math.min(numElectrons, numQubits); i++) {
    newState = applyX(newState, i, numQubits);
  }
  return newState;
}

function applyHardwareEfficientAnsatz(
  state: StateVector,
  numQubits: number,
  parameters: number[],
  depth: number
): StateVector {
  let currentState = state;
  let paramIdx = 0;

  for (let layer = 0; layer < depth; layer++) {
    // Single qubit rotations
    for (let q = 0; q < numQubits; q++) {
      if (paramIdx < parameters.length) {
        currentState = applyRy(currentState, q, numQubits, parameters[paramIdx++]);
      }
      if (paramIdx < parameters.length) {
        currentState = applyRz(currentState, q, numQubits, parameters[paramIdx++]);
      }
    }

    // Entangling layer (linear connectivity)
    for (let q = 0; q < numQubits - 1; q++) {
      currentState = applyCNOT(currentState, q, q + 1, numQubits);
    }
  }

  return currentState;
}

function applyRYAnsatz(
  state: StateVector,
  numQubits: number,
  parameters: number[],
  depth: number
): StateVector {
  let currentState = state;
  let paramIdx = 0;

  for (let layer = 0; layer < depth; layer++) {
    // Ry rotations
    for (let q = 0; q < numQubits; q++) {
      if (paramIdx < parameters.length) {
        currentState = applyRy(currentState, q, numQubits, parameters[paramIdx++]);
      }
    }

    // CNOT ladder
    for (let q = 0; q < numQubits - 1; q++) {
      currentState = applyCNOT(currentState, q, q + 1, numQubits);
    }
  }

  return currentState;
}

function applyUCCSD(
  state: StateVector,
  numQubits: number,
  parameters: number[],
  _numElectrons: number
): StateVector {
  // Simplified UCCSD ansatz
  // Full UCCSD involves exponentiating fermionic operators, which requires
  // Trotterization and many gates. This is a simplified version.

  let currentState = state;
  let paramIdx = 0;

  // Single excitation terms
  for (let q = 0; q < numQubits && paramIdx < parameters.length; q++) {
    currentState = applyRy(currentState, q, numQubits, parameters[paramIdx++]);
  }

  // Double excitation terms (simplified as Ry + entangling)
  for (let i = 0; i < numQubits - 1 && paramIdx < parameters.length; i++) {
    for (let j = i + 1; j < numQubits && paramIdx < parameters.length; j++) {
      // Apply pair excitation circuit
      currentState = applyCNOT(currentState, i, j, numQubits);
      currentState = applyRy(currentState, j, numQubits, parameters[paramIdx++]);
      currentState = applyCNOT(currentState, i, j, numQubits);
    }
  }

  return currentState;
}

function applyAnsatz(
  state: StateVector,
  config: AnsatzConfig,
  parameters: number[],
  numElectrons: number = 2
): StateVector {
  // Start with Hartree-Fock state
  const currentState = applyHartreeFockState(state, config.numQubits, numElectrons);

  switch (config.type) {
    case 'UCCSD':
      return applyUCCSD(currentState, config.numQubits, parameters, numElectrons);
    case 'hardware_efficient':
      return applyHardwareEfficientAnsatz(currentState, config.numQubits, parameters, config.depth);
    case 'RY':
    default:
      return applyRYAnsatz(currentState, config.numQubits, parameters, config.depth);
  }
}

// =============================================================================
// ENERGY EXPECTATION VALUE
// =============================================================================

function measurePauliString(
  state: StateVector,
  numQubits: number,
  paulis: PauliTerm['paulis']
): number {
  if (paulis.length === 0) {
    // Identity: expectation is 1
    return 1.0;
  }

  // Apply basis transformation for non-Z operators
  let transformedState = copyState(state);

  for (const { qubit, operator } of paulis) {
    if (operator === 'X') {
      // H transforms X-basis to Z-basis
      transformedState = applyHadamard(transformedState, qubit, numQubits);
    } else if (operator === 'Y') {
      // S†H transforms Y-basis to Z-basis
      transformedState = applySdg(transformedState, qubit, numQubits);
      transformedState = applyHadamard(transformedState, qubit, numQubits);
    }
  }

  // Calculate Z expectation value
  let expectation = 0;
  const size = 1 << numQubits;

  for (let i = 0; i < size; i++) {
    let parity = 0;
    for (const { qubit } of paulis) {
      if (paulis.find((p) => p.qubit === qubit)?.operator === 'I') continue;
      const bit = (i >> (numQubits - 1 - qubit)) & 1;
      parity ^= bit;
    }
    const sign = parity === 0 ? 1 : -1;
    expectation += sign * cMag2(transformedState[i]);
  }

  return expectation;
}

function applyHadamard(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);
  const factor = 1 / Math.sqrt(2);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const a = state[i];
      const b = state[j];
      newState[i] = cScale(cAdd(a, b), factor);
      newState[j] = cScale({ re: a.re - b.re, im: a.im - b.im }, factor);
    }
  }
  return newState;
}

function applySdg(state: StateVector, qubit: number, numQubits: number): StateVector {
  // S† = [[1, 0], [0, -i]]
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) !== 0) {
      newState[i] = cMul(state[i], complex(0, -1));
    }
  }
  return newState;
}

function computeEnergy(state: StateVector, hamiltonian: Hamiltonian): number {
  let totalEnergy = 0;

  for (const term of hamiltonian.terms) {
    const expectation = measurePauliString(state, hamiltonian.numQubits, term.paulis);
    totalEnergy += term.coefficient * expectation;
  }

  return totalEnergy;
}

// =============================================================================
// CLASSICAL OPTIMIZATION
// =============================================================================

interface OptimizationResult {
  parameters: number[];
  energy: number;
  iterations: number;
  convergenceHistory: number[];
  converged: boolean;
}

function gradientDescent(
  hamiltonian: Hamiltonian,
  ansatzConfig: AnsatzConfig,
  initialParams: number[],
  learningRate: number = 0.1,
  maxIterations: number = 100,
  tolerance: number = 1e-6,
  numElectrons: number = 2
): OptimizationResult {
  const parameters = [...initialParams];
  const convergenceHistory: number[] = [];
  let prevEnergy = Infinity;
  const epsilon = 0.01; // For numerical gradient

  for (let iter = 0; iter < maxIterations; iter++) {
    // Compute current energy
    const state = createZeroState(hamiltonian.numQubits);
    const preparedState = applyAnsatz(state, ansatzConfig, parameters, numElectrons);
    const energy = computeEnergy(preparedState, hamiltonian);
    convergenceHistory.push(energy);

    // Check convergence
    if (Math.abs(energy - prevEnergy) < tolerance) {
      return {
        parameters,
        energy,
        iterations: iter + 1,
        convergenceHistory,
        converged: true,
      };
    }
    prevEnergy = energy;

    // Compute gradient using parameter shift rule
    const gradient: number[] = [];
    for (let p = 0; p < parameters.length; p++) {
      const paramsPlus = [...parameters];
      const paramsMinus = [...parameters];
      paramsPlus[p] += epsilon;
      paramsMinus[p] -= epsilon;

      const statePlus = applyAnsatz(
        createZeroState(hamiltonian.numQubits),
        ansatzConfig,
        paramsPlus,
        numElectrons
      );
      const stateMinus = applyAnsatz(
        createZeroState(hamiltonian.numQubits),
        ansatzConfig,
        paramsMinus,
        numElectrons
      );

      const energyPlus = computeEnergy(statePlus, hamiltonian);
      const energyMinus = computeEnergy(stateMinus, hamiltonian);

      gradient.push((energyPlus - energyMinus) / (2 * epsilon));
    }

    // Update parameters
    for (let p = 0; p < parameters.length; p++) {
      parameters[p] -= learningRate * gradient[p];
    }
  }

  const finalState = applyAnsatz(
    createZeroState(hamiltonian.numQubits),
    ansatzConfig,
    parameters,
    numElectrons
  );
  const finalEnergy = computeEnergy(finalState, hamiltonian);

  return {
    parameters,
    energy: finalEnergy,
    iterations: maxIterations,
    convergenceHistory,
    converged: false,
  };
}

function cobyla(
  hamiltonian: Hamiltonian,
  ansatzConfig: AnsatzConfig,
  initialParams: number[],
  maxIterations: number = 100,
  tolerance: number = 1e-6,
  numElectrons: number = 2
): OptimizationResult {
  // Simplified COBYLA-like optimizer (Nelder-Mead simplex)
  const n = initialParams.length;
  const alpha = 1.0; // Reflection
  const gamma = 2.0; // Expansion
  const rho = 0.5; // Contraction
  const sigma = 0.5; // Shrink

  // Initialize simplex
  const simplex: number[][] = [initialParams];
  for (let i = 0; i < n; i++) {
    const point = [...initialParams];
    point[i] += 0.5;
    simplex.push(point);
  }

  // Evaluate initial simplex
  const evaluateEnergy = (params: number[]): number => {
    const state = applyAnsatz(
      createZeroState(hamiltonian.numQubits),
      ansatzConfig,
      params,
      numElectrons
    );
    return computeEnergy(state, hamiltonian);
  };

  const values = simplex.map(evaluateEnergy);
  const convergenceHistory: number[] = [Math.min(...values)];

  for (let iter = 0; iter < maxIterations; iter++) {
    // Sort by function value
    const indices = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
    simplex.sort((_, __, i, j) => values[indices.indexOf(i)] - values[indices.indexOf(j)]);
    values.sort((a, b) => a - b);

    // Check convergence
    const spread = values[n] - values[0];
    if (spread < tolerance) {
      return {
        parameters: simplex[0],
        energy: values[0],
        iterations: iter + 1,
        convergenceHistory,
        converged: true,
      };
    }

    convergenceHistory.push(values[0]);

    // Centroid of all points except worst
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i][j] / n;
      }
    }

    // Reflection
    const reflected = centroid.map((c, j) => c + alpha * (c - simplex[n][j]));
    const reflectedValue = evaluateEnergy(reflected);

    if (reflectedValue < values[n - 1] && reflectedValue >= values[0]) {
      simplex[n] = reflected;
      values[n] = reflectedValue;
      continue;
    }

    if (reflectedValue < values[0]) {
      // Expansion
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c));
      const expandedValue = evaluateEnergy(expanded);

      if (expandedValue < reflectedValue) {
        simplex[n] = expanded;
        values[n] = expandedValue;
      } else {
        simplex[n] = reflected;
        values[n] = reflectedValue;
      }
      continue;
    }

    // Contraction
    const contracted = centroid.map((c, j) => c + rho * (simplex[n][j] - c));
    const contractedValue = evaluateEnergy(contracted);

    if (contractedValue < values[n]) {
      simplex[n] = contracted;
      values[n] = contractedValue;
      continue;
    }

    // Shrink
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j < n; j++) {
        simplex[i][j] = simplex[0][j] + sigma * (simplex[i][j] - simplex[0][j]);
      }
      values[i] = evaluateEnergy(simplex[i]);
    }
  }

  return {
    parameters: simplex[0],
    energy: values[0],
    iterations: maxIterations,
    convergenceHistory,
    converged: false,
  };
}

// =============================================================================
// BOND DISSOCIATION CURVE
// =============================================================================

interface DissociationPoint {
  bondLength: number;
  energy: number;
  parameters: number[];
}

function computeDissociationCurve(
  molecule: string,
  ansatzType: string,
  bondLengths: number[],
  depth: number = 2,
  maxIterations: number = 50
): DissociationPoint[] {
  const results: DissociationPoint[] = [];
  let previousParams: number[] | null = null;

  for (const bondLength of bondLengths) {
    const hamiltonian = getHamiltonian(molecule, bondLength);
    const ansatzConfig = getAnsatzConfig(ansatzType, hamiltonian.numQubits, depth);

    // Use previous parameters as starting point for smoother curve
    const initialParams =
      previousParams ||
      new Array(ansatzConfig.numParameters).fill(0).map(() => Math.random() * 0.1);

    const result = gradientDescent(
      hamiltonian,
      ansatzConfig,
      initialParams,
      0.1,
      maxIterations,
      1e-5,
      2
    );

    results.push({
      bondLength,
      energy: result.energy,
      parameters: result.parameters,
    });

    previousParams = result.parameters;
  }

  return results;
}

// =============================================================================
// MAIN TOOL INTERFACE
// =============================================================================

export const vqeTool: UnifiedTool = {
  name: 'vqe',
  description:
    'Variational Quantum Eigensolver for molecular simulation. Computes ground state energies of molecules using hybrid classical-quantum optimization with various ansatz types (UCCSD, hardware-efficient, RY).',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['optimize', 'compute_energy', 'dissociation_curve', 'info'],
        description:
          'Operation: optimize for ground state, compute energy at given parameters, compute dissociation curve, or get info',
      },
      molecule: {
        type: 'string',
        enum: ['H2', 'LiH', 'BeH2'],
        description: 'Molecule to simulate',
      },
      ansatz: {
        type: 'string',
        enum: ['UCCSD', 'hardware_efficient', 'RY'],
        description: 'Ansatz circuit type',
      },
      bondLength: {
        type: 'number',
        description: 'Bond length in Angstroms (for diatomic molecules)',
      },
      depth: {
        type: 'number',
        description: 'Circuit depth for hardware-efficient/RY ansatz (default 2)',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum optimization iterations (default 100)',
      },
      optimizer: {
        type: 'string',
        enum: ['gradient_descent', 'cobyla'],
        description: 'Classical optimizer to use',
      },
      parameters: {
        type: 'array',
        items: { type: 'number' },
        description: 'Variational parameters for compute_energy operation',
      },
      bondLengths: {
        type: 'array',
        items: { type: 'number' },
        description: 'Bond lengths for dissociation curve',
      },
    },
    required: ['operation'],
  },
};

interface VQEArgs {
  operation: 'optimize' | 'compute_energy' | 'dissociation_curve' | 'info';
  molecule?: 'H2' | 'LiH' | 'BeH2';
  ansatz?: 'UCCSD' | 'hardware_efficient' | 'RY';
  bondLength?: number;
  depth?: number;
  maxIterations?: number;
  optimizer?: 'gradient_descent' | 'cobyla';
  parameters?: number[];
  bondLengths?: number[];
}

export async function executevqe(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args: VQEArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      molecule = 'H2',
      ansatz = 'hardware_efficient',
      bondLength,
      depth = 2,
      maxIterations = 100,
      optimizer = 'gradient_descent',
    } = args;

    switch (operation) {
      case 'info': {
        const hamiltonian = getHamiltonian(molecule, bondLength);
        const ansatzConfig = getAnsatzConfig(ansatz, hamiltonian.numQubits, depth);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'info',
              molecule,
              hamiltonian: {
                numQubits: hamiltonian.numQubits,
                numTerms: hamiltonian.terms.length,
                description: hamiltonian.description,
                bondLength: hamiltonian.bondLength,
              },
              ansatz: {
                type: ansatzConfig.type,
                numQubits: ansatzConfig.numQubits,
                depth: ansatzConfig.depth,
                numParameters: ansatzConfig.numParameters,
              },
              availableMolecules: ['H2', 'LiH', 'BeH2'],
              availableAnsatze: ['UCCSD', 'hardware_efficient', 'RY'],
              availableOptimizers: ['gradient_descent', 'cobyla'],
              description:
                'VQE finds the ground state energy by variationally optimizing a parameterized quantum circuit (ansatz) to minimize the energy expectation value of the molecular Hamiltonian.',
            },
            null,
            2
          ),
        };
      }

      case 'optimize': {
        const hamiltonian = getHamiltonian(molecule, bondLength);
        const ansatzConfig = getAnsatzConfig(ansatz, hamiltonian.numQubits, depth);

        // Initialize parameters
        const initialParams =
          args.parameters ||
          new Array(ansatzConfig.numParameters).fill(0).map(() => Math.random() * 0.1);

        // Run optimization
        const result =
          optimizer === 'cobyla'
            ? cobyla(hamiltonian, ansatzConfig, initialParams, maxIterations, 1e-6, 2)
            : gradientDescent(
                hamiltonian,
                ansatzConfig,
                initialParams,
                0.1,
                maxIterations,
                1e-6,
                2
              );

        // Compute final state for analysis
        const finalState = applyAnsatz(
          createZeroState(hamiltonian.numQubits),
          ansatzConfig,
          result.parameters,
          2
        );

        // Get probability distribution
        const probabilities: { [key: string]: number } = {};
        const size = 1 << hamiltonian.numQubits;
        for (let i = 0; i < size; i++) {
          const prob = cMag2(finalState[i]);
          if (prob > 0.001) {
            const basis = i.toString(2).padStart(hamiltonian.numQubits, '0');
            probabilities[`|${basis}⟩`] = Math.round(prob * 10000) / 10000;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'optimize',
              molecule,
              bondLength: hamiltonian.bondLength,
              ansatz: ansatzConfig.type,
              optimizer,
              result: {
                groundStateEnergy: result.energy,
                energyUnit: 'Hartree',
                optimizedParameters: result.parameters.map((p) => Math.round(p * 10000) / 10000),
                iterations: result.iterations,
                converged: result.converged,
                convergenceHistory: result.convergenceHistory
                  .slice(-10)
                  .map((e) => Math.round(e * 10000) / 10000),
              },
              stateProbabilities: probabilities,
              circuitInfo: {
                numQubits: hamiltonian.numQubits,
                ansatzDepth: ansatzConfig.depth,
                numParameters: ansatzConfig.numParameters,
              },
            },
            null,
            2
          ),
        };
      }

      case 'compute_energy': {
        const hamiltonian = getHamiltonian(molecule, bondLength);
        const ansatzConfig = getAnsatzConfig(ansatz, hamiltonian.numQubits, depth);

        const params = args.parameters || new Array(ansatzConfig.numParameters).fill(0);

        const state = applyAnsatz(createZeroState(hamiltonian.numQubits), ansatzConfig, params, 2);

        const energy = computeEnergy(state, hamiltonian);

        // Compute individual term contributions
        const termContributions = hamiltonian.terms.slice(0, 10).map((term) => {
          const expectation = measurePauliString(state, hamiltonian.numQubits, term.paulis);
          const pauliStr =
            term.paulis.length === 0
              ? 'I'
              : term.paulis.map((p) => `${p.operator}${p.qubit}`).join('');
          return {
            pauli: pauliStr,
            coefficient: term.coefficient,
            expectation,
            contribution: term.coefficient * expectation,
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'compute_energy',
              molecule,
              bondLength: hamiltonian.bondLength,
              ansatz: ansatzConfig.type,
              parameters: params,
              energy,
              energyUnit: 'Hartree',
              termContributions: termContributions.map((t) => ({
                ...t,
                coefficient: Math.round(t.coefficient * 10000) / 10000,
                expectation: Math.round(t.expectation * 10000) / 10000,
                contribution: Math.round(t.contribution * 10000) / 10000,
              })),
            },
            null,
            2
          ),
        };
      }

      case 'dissociation_curve': {
        const bondLengths = args.bondLengths || [0.5, 0.6, 0.7, 0.74, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];

        const curve = computeDissociationCurve(
          molecule,
          ansatz,
          bondLengths,
          depth,
          Math.min(maxIterations, 50)
        );

        // Find equilibrium bond length
        let minEnergy = Infinity;
        let equilibriumBondLength = bondLengths[0];
        for (const point of curve) {
          if (point.energy < minEnergy) {
            minEnergy = point.energy;
            equilibriumBondLength = point.bondLength;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'dissociation_curve',
              molecule,
              ansatz,
              curve: curve.map((p) => ({
                bondLength: p.bondLength,
                energy: Math.round(p.energy * 10000) / 10000,
              })),
              equilibrium: {
                bondLength: equilibriumBondLength,
                energy: Math.round(minEnergy * 10000) / 10000,
              },
              dissociationEnergy:
                Math.round((curve[curve.length - 1].energy - minEnergy) * 10000) / 10000,
              energyUnit: 'Hartree',
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              error: `Unknown operation: ${operation}`,
              supportedOperations: ['optimize', 'compute_energy', 'dissociation_curve', 'info'],
            },
            null,
            2
          ),
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isvqeAvailable(): boolean {
  return true;
}
