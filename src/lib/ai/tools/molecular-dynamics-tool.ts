/**
 * MOLECULAR-DYNAMICS TOOL
 * Molecular dynamics simulation with force field calculations
 * Implements basic MD simulation for educational purposes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const moleculardynamicsTool: UnifiedTool = {
  name: 'molecular_dynamics',
  description: 'Molecular dynamics simulation for proteins and molecules',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['simulate', 'minimize', 'analyze', 'rmsd', 'info'], description: 'Operation' },
      force_field: { type: 'string', enum: ['AMBER', 'CHARMM', 'OPLS', 'simple'], description: 'Force field' },
      atoms: { type: 'array', items: { type: 'object' }, description: 'Atom positions and types' },
      bonds: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Bond pairs [[i,j],...]' },
      timestep: { type: 'number', description: 'Integration timestep in fs' },
      n_steps: { type: 'number', description: 'Number of simulation steps' },
      temperature: { type: 'number', description: 'Target temperature in K' },
      integrator: { type: 'string', enum: ['verlet', 'leapfrog', 'velocity_verlet'], description: 'Integration method' }
    },
    required: ['operation']
  }
};

// Physical constants
const kB = 0.001987204;  // Boltzmann constant in kcal/(mol·K)
const FEMTOSECOND = 1e-15;

// 3D Vector operations
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecScale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vecDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vecLength(v: Vec3): number {
  return Math.sqrt(vecDot(v, v));
}

function vecNormalize(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len < 1e-10) return vec3(0, 0, 0);
  return vecScale(v, 1 / len);
}

function vecCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

// Atom representation
interface Atom {
  element: string;
  position: Vec3;
  velocity: Vec3;
  force: Vec3;
  mass: number;
  charge: number;
}

// Atomic masses (amu)
const MASSES: { [key: string]: number } = {
  'H': 1.008,
  'C': 12.011,
  'N': 14.007,
  'O': 15.999,
  'S': 32.065,
  'P': 30.974
};

// Van der Waals parameters (sigma in Å, epsilon in kcal/mol)
const VDW_PARAMS: { [key: string]: { sigma: number; epsilon: number } } = {
  'H': { sigma: 1.20, epsilon: 0.0157 },
  'C': { sigma: 1.70, epsilon: 0.1094 },
  'N': { sigma: 1.55, epsilon: 0.1700 },
  'O': { sigma: 1.52, epsilon: 0.2100 },
  'S': { sigma: 1.80, epsilon: 0.2500 },
  'P': { sigma: 1.80, epsilon: 0.2000 }
};

// Bond parameters (k in kcal/(mol·Å²), r0 in Å)
const BOND_PARAMS: { [key: string]: { k: number; r0: number } } = {
  'C-C': { k: 310, r0: 1.526 },
  'C-H': { k: 340, r0: 1.090 },
  'C-N': { k: 337, r0: 1.449 },
  'C-O': { k: 320, r0: 1.410 },
  'C=O': { k: 570, r0: 1.229 },
  'N-H': { k: 434, r0: 1.010 },
  'O-H': { k: 553, r0: 0.960 }
};

// Get bond parameters
function getBondParams(elem1: string, elem2: string): { k: number; r0: number } {
  const key1 = `${elem1}-${elem2}`;
  const key2 = `${elem2}-${elem1}`;
  return BOND_PARAMS[key1] || BOND_PARAMS[key2] || { k: 300, r0: 1.5 };
}

// Calculate Lennard-Jones potential and force
function lennardJones(r: number, sigma: number, epsilon: number): { energy: number; force: number } {
  if (r < 0.1) r = 0.1;  // Prevent singularity
  const sr6 = Math.pow(sigma / r, 6);
  const sr12 = sr6 * sr6;
  const energy = 4 * epsilon * (sr12 - sr6);
  const force = 24 * epsilon * (2 * sr12 - sr6) / r;
  return { energy, force };
}

// Calculate harmonic bond potential
function bondPotential(r: number, k: number, r0: number): { energy: number; force: number } {
  const dr = r - r0;
  const energy = 0.5 * k * dr * dr;
  const force = -k * dr;
  return { energy, force };
}

// Calculate Coulomb potential (with dielectric constant)
function coulombPotential(r: number, q1: number, q2: number, epsilon: number = 80): { energy: number; force: number } {
  if (r < 0.1) r = 0.1;
  const k_coulomb = 332.0636;  // kcal·Å/(mol·e²)
  const energy = k_coulomb * q1 * q2 / (epsilon * r);
  const force = -k_coulomb * q1 * q2 / (epsilon * r * r);
  return { energy, force };
}

// Calculate all forces on atoms
function calculateForces(atoms: Atom[], bonds: number[][]): { totalEnergy: number; bonded: number; nonbonded: number } {
  // Reset forces
  for (const atom of atoms) {
    atom.force = vec3(0, 0, 0);
  }

  let bondedEnergy = 0;
  let nonbondedEnergy = 0;

  // Bonded interactions
  for (const [i, j] of bonds) {
    const atom1 = atoms[i];
    const atom2 = atoms[j];
    const r_vec = vecSub(atom2.position, atom1.position);
    const r = vecLength(r_vec);
    const r_unit = vecNormalize(r_vec);

    const params = getBondParams(atom1.element, atom2.element);
    const { energy, force } = bondPotential(r, params.k, params.r0);
    bondedEnergy += energy;

    const f_vec = vecScale(r_unit, force);
    atom1.force = vecSub(atom1.force, f_vec);
    atom2.force = vecAdd(atom2.force, f_vec);
  }

  // Non-bonded interactions (LJ + Coulomb)
  const cutoff = 10.0;  // Å
  const bondSet = new Set(bonds.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));

  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      // Skip bonded pairs
      const bondKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (bondSet.has(bondKey)) continue;

      const atom1 = atoms[i];
      const atom2 = atoms[j];
      const r_vec = vecSub(atom2.position, atom1.position);
      const r = vecLength(r_vec);

      if (r > cutoff) continue;

      const r_unit = vecNormalize(r_vec);

      // Lennard-Jones
      const vdw1 = VDW_PARAMS[atom1.element] || { sigma: 1.5, epsilon: 0.1 };
      const vdw2 = VDW_PARAMS[atom2.element] || { sigma: 1.5, epsilon: 0.1 };
      const sigma = (vdw1.sigma + vdw2.sigma) / 2;
      const epsilon = Math.sqrt(vdw1.epsilon * vdw2.epsilon);

      const lj = lennardJones(r, sigma, epsilon);
      nonbondedEnergy += lj.energy;

      // Coulomb
      if (atom1.charge !== 0 && atom2.charge !== 0) {
        const coul = coulombPotential(r, atom1.charge, atom2.charge);
        nonbondedEnergy += coul.energy;
        const f_coul = vecScale(r_unit, coul.force);
        atom1.force = vecSub(atom1.force, f_coul);
        atom2.force = vecAdd(atom2.force, f_coul);
      }

      const f_lj = vecScale(r_unit, lj.force);
      atom1.force = vecSub(atom1.force, f_lj);
      atom2.force = vecAdd(atom2.force, f_lj);
    }
  }

  return {
    totalEnergy: bondedEnergy + nonbondedEnergy,
    bonded: bondedEnergy,
    nonbonded: nonbondedEnergy
  };
}

// Calculate kinetic energy
function kineticEnergy(atoms: Atom[]): number {
  let ke = 0;
  for (const atom of atoms) {
    const v2 = vecDot(atom.velocity, atom.velocity);
    ke += 0.5 * atom.mass * v2;
  }
  return ke;
}

// Calculate temperature from kinetic energy
function calculateTemperature(atoms: Atom[]): number {
  const ke = kineticEnergy(atoms);
  const nDOF = 3 * atoms.length - 3;  // Degrees of freedom (minus center of mass)
  return 2 * ke / (nDOF * kB);
}

// Velocity rescaling thermostat
function rescaleVelocities(atoms: Atom[], targetTemp: number) {
  const currentTemp = calculateTemperature(atoms);
  if (currentTemp < 1e-10) return;

  const scale = Math.sqrt(targetTemp / currentTemp);
  for (const atom of atoms) {
    atom.velocity = vecScale(atom.velocity, scale);
  }
}

// Initialize velocities from Maxwell-Boltzmann distribution
function initializeVelocities(atoms: Atom[], temperature: number) {
  // Box-Muller transform for Gaussian random numbers
  const gaussian = () => {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  for (const atom of atoms) {
    const sigma = Math.sqrt(kB * temperature / atom.mass);
    atom.velocity = vec3(
      sigma * gaussian(),
      sigma * gaussian(),
      sigma * gaussian()
    );
  }

  // Remove center of mass motion
  let totalMass = 0;
  let comVelocity = vec3(0, 0, 0);
  for (const atom of atoms) {
    comVelocity = vecAdd(comVelocity, vecScale(atom.velocity, atom.mass));
    totalMass += atom.mass;
  }
  comVelocity = vecScale(comVelocity, 1 / totalMass);

  for (const atom of atoms) {
    atom.velocity = vecSub(atom.velocity, comVelocity);
  }

  // Rescale to exact target temperature
  rescaleVelocities(atoms, temperature);
}

// Velocity Verlet integrator
function velocityVerletStep(atoms: Atom[], bonds: number[][], dt: number): { energy: number } {
  // Update positions: r(t+dt) = r(t) + v(t)*dt + 0.5*a(t)*dt²
  for (const atom of atoms) {
    const a = vecScale(atom.force, 1 / atom.mass);
    atom.position = vecAdd(
      atom.position,
      vecAdd(
        vecScale(atom.velocity, dt),
        vecScale(a, 0.5 * dt * dt)
      )
    );
    // Store half of velocity update
    atom.velocity = vecAdd(atom.velocity, vecScale(a, 0.5 * dt));
  }

  // Calculate new forces
  const { totalEnergy } = calculateForces(atoms, bonds);

  // Complete velocity update: v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
  for (const atom of atoms) {
    const a = vecScale(atom.force, 1 / atom.mass);
    atom.velocity = vecAdd(atom.velocity, vecScale(a, 0.5 * dt));
  }

  return { energy: totalEnergy };
}

// Energy minimization using steepest descent
function minimizeEnergy(atoms: Atom[], bonds: number[][], maxSteps: number = 1000, tolerance: number = 0.001): {
  steps: number;
  finalEnergy: number;
  converged: boolean;
} {
  let stepSize = 0.01;
  let prevEnergy = Infinity;
  let steps = 0;

  for (steps = 0; steps < maxSteps; steps++) {
    const { totalEnergy } = calculateForces(atoms, bonds);

    // Calculate max force
    let maxForce = 0;
    for (const atom of atoms) {
      const f = vecLength(atom.force);
      if (f > maxForce) maxForce = f;
    }

    // Check convergence
    if (maxForce < tolerance) {
      return { steps, finalEnergy: totalEnergy, converged: true };
    }

    // Adjust step size
    if (totalEnergy > prevEnergy) {
      stepSize *= 0.5;
    } else {
      stepSize *= 1.1;
    }
    stepSize = Math.min(stepSize, 0.1);
    stepSize = Math.max(stepSize, 0.001);

    // Move atoms along force direction
    for (const atom of atoms) {
      const displacement = vecScale(atom.force, stepSize / atom.mass);
      atom.position = vecAdd(atom.position, displacement);
    }

    prevEnergy = totalEnergy;
  }

  const { totalEnergy: finalEnergy } = calculateForces(atoms, bonds);
  return { steps, finalEnergy, converged: false };
}

// Calculate RMSD between two structures
function calculateRMSD(atoms1: Vec3[], atoms2: Vec3[]): number {
  if (atoms1.length !== atoms2.length) return NaN;

  let sumSq = 0;
  for (let i = 0; i < atoms1.length; i++) {
    const diff = vecSub(atoms1[i], atoms2[i]);
    sumSq += vecDot(diff, diff);
  }
  return Math.sqrt(sumSq / atoms1.length);
}

// Create a simple molecule for demo
function createDemoMolecule(): { atoms: Atom[], bonds: number[][] } {
  // Simple ethane-like molecule (C2H6)
  const atoms: Atom[] = [
    { element: 'C', position: vec3(0, 0, 0), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['C'], charge: -0.18 },
    { element: 'C', position: vec3(1.54, 0, 0), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['C'], charge: -0.18 },
    { element: 'H', position: vec3(-0.36, 1.03, 0), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 },
    { element: 'H', position: vec3(-0.36, -0.51, 0.89), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 },
    { element: 'H', position: vec3(-0.36, -0.51, -0.89), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 },
    { element: 'H', position: vec3(1.90, 1.03, 0), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 },
    { element: 'H', position: vec3(1.90, -0.51, 0.89), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 },
    { element: 'H', position: vec3(1.90, -0.51, -0.89), velocity: vec3(0, 0, 0), force: vec3(0, 0, 0), mass: MASSES['H'], charge: 0.06 }
  ];

  const bonds: number[][] = [
    [0, 1],  // C-C
    [0, 2], [0, 3], [0, 4],  // C-H (first carbon)
    [1, 5], [1, 6], [1, 7]   // C-H (second carbon)
  ];

  return { atoms, bonds };
}

export async function executemoleculardynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'molecular-dynamics',
        description: 'Classical molecular dynamics simulation',

        forceFields: {
          AMBER: {
            description: 'Assisted Model Building with Energy Refinement',
            strengths: 'Good for proteins and nucleic acids',
            terms: ['bonds', 'angles', 'dihedrals', 'LJ', 'electrostatics']
          },
          CHARMM: {
            description: 'Chemistry at HARvard Macromolecular Mechanics',
            strengths: 'Extensive parameterization',
            terms: ['bonds', 'angles', 'Urey-Bradley', 'dihedrals', 'impropers', 'LJ', 'electrostatics']
          },
          OPLS: {
            description: 'Optimized Potentials for Liquid Simulations',
            strengths: 'Good for small molecules and liquids'
          }
        },

        potentialEnergy: {
          bonded: {
            bond: 'V = k(r - r₀)² (harmonic)',
            angle: 'V = k(θ - θ₀)² (harmonic)',
            dihedral: 'V = k[1 + cos(nφ - δ)]'
          },
          nonbonded: {
            lennardJones: 'V = 4ε[(σ/r)¹² - (σ/r)⁶]',
            coulomb: 'V = q₁q₂/(4πε₀εr)'
          }
        },

        integrators: {
          verlet: {
            description: 'Position Verlet',
            order: 'O(Δt²)',
            properties: 'Time-reversible, symplectic'
          },
          velocity_verlet: {
            description: 'Velocity Verlet',
            order: 'O(Δt²)',
            properties: 'Explicit velocities, good energy conservation'
          },
          leapfrog: {
            description: 'Leapfrog (staggered velocities)',
            order: 'O(Δt²)',
            properties: 'Equivalent to velocity Verlet'
          }
        },

        thermostats: {
          velocity_rescaling: 'Simple, but can affect dynamics',
          berendsen: 'Weak coupling to heat bath',
          nose_hoover: 'Proper canonical ensemble'
        },

        operations: {
          simulate: 'Run MD simulation',
          minimize: 'Energy minimization (steepest descent)',
          analyze: 'Analyze trajectory properties',
          rmsd: 'Calculate RMSD between structures'
        },

        typicalParameters: {
          timestep: '1-2 fs (femtoseconds)',
          temperature: '300 K (room temperature)',
          cutoff: '10-12 Å for non-bonded interactions'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Create demo molecule if none provided
    let { atoms, bonds } = args.atoms ? { atoms: args.atoms, bonds: args.bonds || [] } : createDemoMolecule();

    // Ensure atoms have proper structure
    atoms = atoms.map((a: any) => ({
      element: a.element || 'C',
      position: a.position ? vec3(a.position.x || 0, a.position.y || 0, a.position.z || 0) : vec3(0, 0, 0),
      velocity: vec3(0, 0, 0),
      force: vec3(0, 0, 0),
      mass: MASSES[a.element] || 12,
      charge: a.charge || 0
    }));

    const forceField = args.force_field || 'simple';

    if (operation === 'minimize') {
      const maxSteps = args.n_steps || 1000;

      // Store initial positions
      const initialPositions = atoms.map((a: Atom) => ({ ...a.position }));
      const { totalEnergy: initialEnergy } = calculateForces(atoms, bonds);

      // Run minimization
      const result = minimizeEnergy(atoms, bonds, maxSteps);

      // Calculate RMSD from initial
      const rmsd = calculateRMSD(
        initialPositions,
        atoms.map((a: Atom) => a.position)
      );

      const output = {
        operation: 'energy_minimization',
        algorithm: 'steepest_descent',
        forceField,

        system: {
          atoms: atoms.length,
          bonds: bonds.length
        },

        results: {
          converged: result.converged,
          steps: result.steps,
          initialEnergy: Number(initialEnergy.toFixed(4)) + ' kcal/mol',
          finalEnergy: Number(result.finalEnergy.toFixed(4)) + ' kcal/mol',
          energyChange: Number((result.finalEnergy - initialEnergy).toFixed(4)) + ' kcal/mol',
          rmsdFromInitial: Number(rmsd.toFixed(4)) + ' Å'
        },

        finalStructure: atoms.slice(0, 5).map((a: Atom) => ({
          element: a.element,
          position: {
            x: Number(a.position.x.toFixed(4)),
            y: Number(a.position.y.toFixed(4)),
            z: Number(a.position.z.toFixed(4))
          }
        })),

        note: atoms.length > 5 ? `... and ${atoms.length - 5} more atoms` : undefined
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'simulate') {
      const timestep = args.timestep || 1.0;  // fs
      const nSteps = args.n_steps || 1000;
      const temperature = args.temperature || 300;
      const dt = timestep * 0.001;  // Convert to ps-like internal units

      // Initialize velocities
      initializeVelocities(atoms, temperature);

      // Calculate initial energies
      const initialPE = calculateForces(atoms, bonds);
      const initialKE = kineticEnergy(atoms);
      const initialTemp = calculateTemperature(atoms);

      // Trajectory data
      const trajectory: { step: number; PE: number; KE: number; T: number; total: number }[] = [];
      const thermostatInterval = 100;

      // Run simulation
      for (let step = 0; step < nSteps; step++) {
        const { energy: PE } = velocityVerletStep(atoms, bonds, dt);

        // Apply thermostat periodically
        if (step % thermostatInterval === 0 && step > 0) {
          rescaleVelocities(atoms, temperature);
        }

        // Record trajectory
        if (step % Math.max(1, Math.floor(nSteps / 20)) === 0 || step === nSteps - 1) {
          const KE = kineticEnergy(atoms);
          const T = calculateTemperature(atoms);
          trajectory.push({
            step,
            PE: Number(PE.toFixed(4)),
            KE: Number(KE.toFixed(4)),
            T: Number(T.toFixed(1)),
            total: Number((PE + KE).toFixed(4))
          });
        }
      }

      // Final analysis
      const finalPE = calculateForces(atoms, bonds);
      const finalKE = kineticEnergy(atoms);
      const finalTemp = calculateTemperature(atoms);

      // Calculate averages
      const avgT = trajectory.reduce((s, t) => s + t.T, 0) / trajectory.length;
      const avgPE = trajectory.reduce((s, t) => s + t.PE, 0) / trajectory.length;
      const avgTotal = trajectory.reduce((s, t) => s + t.total, 0) / trajectory.length;

      // Energy drift (should be small for good integration)
      const energyDrift = trajectory[trajectory.length - 1].total - trajectory[0].total;

      const output = {
        operation: 'md_simulation',
        integrator: args.integrator || 'velocity_verlet',
        forceField,

        parameters: {
          timestep: timestep + ' fs',
          steps: nSteps,
          simulationTime: (nSteps * timestep).toFixed(1) + ' fs',
          targetTemperature: temperature + ' K',
          thermostat: 'velocity_rescaling'
        },

        system: {
          atoms: atoms.length,
          bonds: bonds.length,
          degreesOfFreedom: 3 * atoms.length - 3
        },

        initialState: {
          potentialEnergy: Number(initialPE.totalEnergy.toFixed(4)) + ' kcal/mol',
          kineticEnergy: Number(initialKE.toFixed(4)) + ' kcal/mol',
          temperature: Number(initialTemp.toFixed(1)) + ' K'
        },

        finalState: {
          potentialEnergy: Number(finalPE.totalEnergy.toFixed(4)) + ' kcal/mol',
          kineticEnergy: Number(finalKE.toFixed(4)) + ' kcal/mol',
          temperature: Number(finalTemp.toFixed(1)) + ' K'
        },

        statistics: {
          averageTemperature: Number(avgT.toFixed(1)) + ' K',
          averagePotentialEnergy: Number(avgPE.toFixed(4)) + ' kcal/mol',
          averageTotalEnergy: Number(avgTotal.toFixed(4)) + ' kcal/mol',
          energyDrift: Number(energyDrift.toFixed(6)) + ' kcal/mol',
          energyConservation: Math.abs(energyDrift) < 1 ? 'Good' : 'Check timestep'
        },

        trajectory: trajectory.slice(0, 10),

        note: 'Simplified educational simulation - production MD requires more sophisticated algorithms'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'analyze') {
      // Calculate various structural properties
      const { totalEnergy, bonded, nonbonded } = calculateForces(atoms, bonds);

      // Calculate bond lengths
      const bondLengths = bonds.map(([i, j]: number[]) => {
        const r = vecLength(vecSub(atoms[j].position, atoms[i].position));
        return {
          atoms: `${atoms[i].element}${i}-${atoms[j].element}${j}`,
          length: Number(r.toFixed(4))
        };
      });

      // Calculate center of mass
      let totalMass = 0;
      let com = vec3(0, 0, 0);
      for (const atom of atoms) {
        com = vecAdd(com, vecScale(atom.position, atom.mass));
        totalMass += atom.mass;
      }
      com = vecScale(com, 1 / totalMass);

      // Calculate radius of gyration
      let rg2 = 0;
      for (const atom of atoms) {
        const r = vecSub(atom.position, com);
        rg2 += atom.mass * vecDot(r, r);
      }
      const rg = Math.sqrt(rg2 / totalMass);

      // Composition
      const composition: { [key: string]: number } = {};
      for (const atom of atoms) {
        composition[atom.element] = (composition[atom.element] || 0) + 1;
      }

      const output = {
        operation: 'structure_analysis',
        forceField,

        composition,
        totalAtoms: atoms.length,
        totalMass: Number(totalMass.toFixed(3)) + ' amu',

        energy: {
          total: Number(totalEnergy.toFixed(4)) + ' kcal/mol',
          bonded: Number(bonded.toFixed(4)) + ' kcal/mol',
          nonbonded: Number(nonbonded.toFixed(4)) + ' kcal/mol'
        },

        geometry: {
          centerOfMass: {
            x: Number(com.x.toFixed(4)),
            y: Number(com.y.toFixed(4)),
            z: Number(com.z.toFixed(4))
          },
          radiusOfGyration: Number(rg.toFixed(4)) + ' Å'
        },

        bondLengths: bondLengths.slice(0, 10),

        atomDetails: atoms.slice(0, 5).map((a: Atom, i: number) => ({
          index: i,
          element: a.element,
          mass: a.mass,
          charge: a.charge,
          position: {
            x: Number(a.position.x.toFixed(4)),
            y: Number(a.position.y.toFixed(4)),
            z: Number(a.position.z.toFixed(4))
          }
        }))
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'rmsd') {
      // Calculate RMSD with reference structure (or self-RMSD demo)
      const reference = args.reference || atoms.map((a: Atom) => a.position);

      const rmsd = calculateRMSD(
        atoms.map((a: Atom) => a.position),
        reference.map((p: any) => vec3(p.x || 0, p.y || 0, p.z || 0))
      );

      // Per-atom displacement
      const displacements = atoms.map((a: Atom, i: number) => {
        const ref = reference[i] || { x: 0, y: 0, z: 0 };
        const refVec = vec3(ref.x || 0, ref.y || 0, ref.z || 0);
        return vecLength(vecSub(a.position, refVec));
      });

      const maxDisp = Math.max(...displacements);
      const avgDisp = displacements.reduce((a, b) => a + b, 0) / displacements.length;

      const output = {
        operation: 'rmsd_calculation',

        rmsd: Number(rmsd.toFixed(4)) + ' Å',
        averageDisplacement: Number(avgDisp.toFixed(4)) + ' Å',
        maxDisplacement: Number(maxDisp.toFixed(4)) + ' Å',

        perAtomDisplacement: atoms.slice(0, 10).map((a: Atom, i: number) => ({
          atom: `${a.element}${i}`,
          displacement: Number(displacements[i].toFixed(4))
        })),

        interpretation: rmsd < 1.0
          ? 'Structures are very similar'
          : rmsd < 2.0
          ? 'Moderate structural difference'
          : 'Significant structural change'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismoleculardynamicsAvailable(): boolean { return true; }
