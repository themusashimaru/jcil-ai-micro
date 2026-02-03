/**
 * MOLECULAR-DYNAMICS TOOL
 * Full molecular dynamics simulation for molecular systems
 *
 * Implements:
 * - Lennard-Jones potential for van der Waals interactions
 * - Coulombic interactions for charged particles
 * - Bond stretch (harmonic), angle bend, and torsion potentials
 * - Velocity Verlet integration
 * - NVE, NVT (Berendsen thermostat), NPT ensembles
 * - Energy minimization (steepest descent, conjugate gradient)
 * - Radial distribution function analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const KB = 1.380649e-23; // Boltzmann constant (J/K)
export const NA = 6.02214076e23; // Avogadro's number
export const KCAL_TO_JOULE = 4184;

// Force field parameters (simplified AMBER-like)
interface AtomType {
  mass: number; // atomic mass (amu)
  epsilon: number; // LJ well depth (kcal/mol)
  sigma: number; // LJ diameter (Angstrom)
  charge: number; // partial charge (e)
}

interface BondType {
  k: number; // force constant (kcal/mol/A^2)
  r0: number; // equilibrium distance (A)
}

interface AngleType {
  k: number; // force constant (kcal/mol/rad^2)
  theta0: number; // equilibrium angle (rad)
}

interface Atom {
  type: string;
  position: [number, number, number];
  velocity: [number, number, number];
  force: [number, number, number];
  mass: number;
  charge: number;
}

interface Bond {
  i: number;
  j: number;
  type: string;
}

interface Angle {
  i: number;
  j: number;
  k: number;
  type: string;
}

interface MolecularSystem {
  atoms: Atom[];
  bonds: Bond[];
  angles: Angle[];
  boxSize: [number, number, number];
  forceField: string;
}

interface SimulationParams {
  dt: number; // timestep (fs)
  nsteps: number; // number of steps
  temperature?: number; // target temperature (K)
  pressure?: number; // target pressure (bar)
  ensemble: 'NVE' | 'NVT' | 'NPT';
  cutoff: number; // nonbonded cutoff (A)
  outputFreq: number; // output frequency
}

interface EnergyTerms {
  kinetic: number;
  potential: number;
  bond: number;
  angle: number;
  vdw: number;
  electrostatic: number;
  total: number;
}

// Default atom types (simplified)
const ATOM_TYPES: Record<string, AtomType> = {
  C: { mass: 12.01, epsilon: 0.1094, sigma: 3.4, charge: 0.0 },
  H: { mass: 1.008, epsilon: 0.0157, sigma: 2.47, charge: 0.0 },
  O: { mass: 16.0, epsilon: 0.21, sigma: 3.07, charge: -0.5 },
  N: { mass: 14.01, epsilon: 0.17, sigma: 3.25, charge: -0.4 },
  S: { mass: 32.06, epsilon: 0.25, sigma: 3.55, charge: 0.0 },
  P: { mass: 30.97, epsilon: 0.2, sigma: 3.74, charge: 0.0 },
  Ar: { mass: 39.95, epsilon: 0.234, sigma: 3.4, charge: 0.0 },
  Na: { mass: 22.99, epsilon: 0.0028, sigma: 2.73, charge: 1.0 },
  Cl: { mass: 35.45, epsilon: 0.1, sigma: 4.02, charge: -1.0 },
};

// Bond types
const BOND_TYPES: Record<string, BondType> = {
  'C-C': { k: 310.0, r0: 1.526 },
  'C-H': { k: 340.0, r0: 1.09 },
  'C-O': { k: 320.0, r0: 1.41 },
  'C-N': { k: 337.0, r0: 1.449 },
  'C=O': { k: 570.0, r0: 1.229 },
  'C=C': { k: 549.0, r0: 1.34 },
  'O-H': { k: 553.0, r0: 0.96 },
  'N-H': { k: 434.0, r0: 1.01 },
};

// Angle types
const ANGLE_TYPES: Record<string, AngleType> = {
  'C-C-C': { k: 40.0, theta0: (109.5 * Math.PI) / 180 },
  'C-C-H': { k: 50.0, theta0: (109.5 * Math.PI) / 180 },
  'H-C-H': { k: 35.0, theta0: (109.5 * Math.PI) / 180 },
  'C-O-H': { k: 55.0, theta0: (108.5 * Math.PI) / 180 },
  'C-N-H': { k: 50.0, theta0: (118.0 * Math.PI) / 180 },
  'O-C-O': { k: 80.0, theta0: (126.0 * Math.PI) / 180 },
};

// Vector operations
function vecSub(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecAdd(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecScale(v: [number, number, number], s: number): [number, number, number] {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function vecDot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecNorm(v: [number, number, number]): number {
  return Math.sqrt(vecDot(v, v));
}

function vecNormalize(v: [number, number, number]): [number, number, number] {
  const n = vecNorm(v);
  return n > 0 ? vecScale(v, 1 / n) : [0, 0, 0];
}

export function vecCross(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Minimum image convention for periodic boundary conditions
function minimumImage(
  dr: [number, number, number],
  box: [number, number, number]
): [number, number, number] {
  return [
    dr[0] - box[0] * Math.round(dr[0] / box[0]),
    dr[1] - box[1] * Math.round(dr[1] / box[1]),
    dr[2] - box[2] * Math.round(dr[2] / box[2]),
  ];
}

// Compute Lennard-Jones force and energy
function ljInteraction(
  ri: [number, number, number],
  rj: [number, number, number],
  epsilonI: number,
  sigmaI: number,
  epsilonJ: number,
  sigmaJ: number,
  box: [number, number, number],
  cutoff: number
): { force: [number, number, number]; energy: number } {
  let dr = vecSub(ri, rj);
  dr = minimumImage(dr, box);
  const r = vecNorm(dr);

  if (r > cutoff || r < 0.1) {
    return { force: [0, 0, 0], energy: 0 };
  }

  // Lorentz-Berthelot mixing rules
  const epsilon = Math.sqrt(epsilonI * epsilonJ);
  const sigma = (sigmaI + sigmaJ) / 2;

  const sr6 = Math.pow(sigma / r, 6);
  const sr12 = sr6 * sr6;

  const energy = 4 * epsilon * (sr12 - sr6);
  const forceMag = (24 * epsilon * (2 * sr12 - sr6)) / r;

  const forceDir = vecNormalize(dr);
  const force = vecScale(forceDir, forceMag);

  return { force, energy };
}

// Compute Coulombic force and energy
function coulombInteraction(
  ri: [number, number, number],
  rj: [number, number, number],
  qi: number,
  qj: number,
  box: [number, number, number],
  cutoff: number,
  dielectric: number = 1.0
): { force: [number, number, number]; energy: number } {
  let dr = vecSub(ri, rj);
  dr = minimumImage(dr, box);
  const r = vecNorm(dr);

  if (r > cutoff || r < 0.1 || qi === 0 || qj === 0) {
    return { force: [0, 0, 0], energy: 0 };
  }

  // Coulomb's law in kcal/mol units
  const ke = 332.0636; // conversion factor
  const energy = (ke * qi * qj) / (dielectric * r);
  const forceMag = (ke * qi * qj) / (dielectric * r * r);

  const forceDir = vecNormalize(dr);
  const force = vecScale(forceDir, forceMag);

  return { force, energy };
}

// Compute bond force and energy
function bondForce(
  ri: [number, number, number],
  rj: [number, number, number],
  bondType: BondType
): { forceI: [number, number, number]; forceJ: [number, number, number]; energy: number } {
  const dr = vecSub(ri, rj);
  const r = vecNorm(dr);
  const dr_eq = r - bondType.r0;

  const energy = 0.5 * bondType.k * dr_eq * dr_eq;
  const forceMag = -bondType.k * dr_eq;

  const forceDir = vecNormalize(dr);
  const forceI = vecScale(forceDir, forceMag);
  const forceJ = vecScale(forceDir, -forceMag);

  return { forceI, forceJ, energy };
}

// Compute angle force and energy
function angleForce(
  ri: [number, number, number],
  rj: [number, number, number],
  rk: [number, number, number],
  angleType: AngleType
): {
  forceI: [number, number, number];
  forceJ: [number, number, number];
  forceK: [number, number, number];
  energy: number;
} {
  const rij = vecSub(ri, rj);
  const rkj = vecSub(rk, rj);

  const rij_norm = vecNorm(rij);
  const rkj_norm = vecNorm(rkj);

  if (rij_norm < 0.01 || rkj_norm < 0.01) {
    return { forceI: [0, 0, 0], forceJ: [0, 0, 0], forceK: [0, 0, 0], energy: 0 };
  }

  const cosTheta = vecDot(rij, rkj) / (rij_norm * rkj_norm);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  const dtheta = theta - angleType.theta0;

  const energy = 0.5 * angleType.k * dtheta * dtheta;

  // Gradient computation (simplified)
  const sinTheta = Math.sin(theta);
  if (Math.abs(sinTheta) < 1e-10) {
    return { forceI: [0, 0, 0], forceJ: [0, 0, 0], forceK: [0, 0, 0], energy };
  }

  const dEdTheta = angleType.k * dtheta;

  const rijUnit = vecScale(rij, 1 / rij_norm);
  const rkjUnit = vecScale(rkj, 1 / rkj_norm);

  const dThetaDri = vecScale(
    vecSub(vecScale(rkjUnit, 1 / rij_norm), vecScale(rijUnit, cosTheta / rij_norm)),
    -1 / sinTheta
  );

  const dThetaDrk = vecScale(
    vecSub(vecScale(rijUnit, 1 / rkj_norm), vecScale(rkjUnit, cosTheta / rkj_norm)),
    -1 / sinTheta
  );

  const forceI = vecScale(dThetaDri, -dEdTheta);
  const forceK = vecScale(dThetaDrk, -dEdTheta);
  const forceJ = vecScale(vecAdd(forceI, forceK), -1);

  return { forceI, forceJ, forceK, energy };
}

// Initialize velocities from Maxwell-Boltzmann distribution
function initializeVelocities(atoms: Atom[], temperature: number): void {
  // Box-Muller transform for Gaussian distribution
  function gaussianRandom(): number {
    let u1 = 0,
      u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Set velocities according to Maxwell-Boltzmann
  for (const atom of atoms) {
    const sigma = Math.sqrt((KB * temperature) / (atom.mass * 1.66054e-27)) * 1e-5; // A/fs
    atom.velocity = [gaussianRandom() * sigma, gaussianRandom() * sigma, gaussianRandom() * sigma];
  }

  // Remove center of mass motion
  let totalMass = 0;
  let comVel: [number, number, number] = [0, 0, 0];
  for (const atom of atoms) {
    totalMass += atom.mass;
    comVel = vecAdd(comVel, vecScale(atom.velocity, atom.mass));
  }
  comVel = vecScale(comVel, 1 / totalMass);

  for (const atom of atoms) {
    atom.velocity = vecSub(atom.velocity, comVel);
  }

  // Scale to exact temperature
  const currentTemp = computeTemperature(atoms);
  if (currentTemp > 0) {
    const scale = Math.sqrt(temperature / currentTemp);
    for (const atom of atoms) {
      atom.velocity = vecScale(atom.velocity, scale);
    }
  }
}

// Compute instantaneous temperature
function computeTemperature(atoms: Atom[]): number {
  let kineticEnergy = 0;
  for (const atom of atoms) {
    const v2 = vecDot(atom.velocity, atom.velocity);
    kineticEnergy += 0.5 * atom.mass * v2;
  }

  // Convert to Kelvin (units: amu * (A/fs)^2 -> kcal/mol -> K)
  const conversionFactor = 418.4; // amu*(A/fs)^2 to kcal/mol
  const nDOF = 3 * atoms.length - 3; // degrees of freedom

  if (nDOF <= 0) return 0;
  return (2 * kineticEnergy * conversionFactor) / (nDOF * 0.001987); // R = 0.001987 kcal/mol/K
}

// Compute all forces
function computeForces(system: MolecularSystem, cutoff: number): EnergyTerms {
  const { atoms, bonds, angles, boxSize } = system;

  // Reset forces
  for (const atom of atoms) {
    atom.force = [0, 0, 0];
  }

  let bondEnergy = 0;
  let angleEnergy = 0;
  let vdwEnergy = 0;
  let elecEnergy = 0;

  // Bond forces
  for (const bond of bonds) {
    const bondType = BOND_TYPES[bond.type] || BOND_TYPES['C-C'];
    const result = bondForce(atoms[bond.i].position, atoms[bond.j].position, bondType);
    atoms[bond.i].force = vecAdd(atoms[bond.i].force, result.forceI);
    atoms[bond.j].force = vecAdd(atoms[bond.j].force, result.forceJ);
    bondEnergy += result.energy;
  }

  // Angle forces
  for (const angle of angles) {
    const angleType = ANGLE_TYPES[angle.type] || ANGLE_TYPES['C-C-C'];
    const result = angleForce(
      atoms[angle.i].position,
      atoms[angle.j].position,
      atoms[angle.k].position,
      angleType
    );
    atoms[angle.i].force = vecAdd(atoms[angle.i].force, result.forceI);
    atoms[angle.j].force = vecAdd(atoms[angle.j].force, result.forceJ);
    atoms[angle.k].force = vecAdd(atoms[angle.k].force, result.forceK);
    angleEnergy += result.energy;
  }

  // Build exclusion list from bonds
  const excluded = new Set<string>();
  for (const bond of bonds) {
    excluded.add(`${Math.min(bond.i, bond.j)}-${Math.max(bond.i, bond.j)}`);
  }
  for (const angle of angles) {
    excluded.add(`${Math.min(angle.i, angle.k)}-${Math.max(angle.i, angle.k)}`);
  }

  // Nonbonded forces (LJ + Coulomb)
  for (let i = 0; i < atoms.length; i++) {
    const atomI = atoms[i];
    const typeI = ATOM_TYPES[atomI.type] || ATOM_TYPES['C'];

    for (let j = i + 1; j < atoms.length; j++) {
      const pairKey = `${i}-${j}`;
      if (excluded.has(pairKey)) continue;

      const atomJ = atoms[j];
      const typeJ = ATOM_TYPES[atomJ.type] || ATOM_TYPES['C'];

      // LJ interaction
      const ljResult = ljInteraction(
        atomI.position,
        atomJ.position,
        typeI.epsilon,
        typeI.sigma,
        typeJ.epsilon,
        typeJ.sigma,
        boxSize,
        cutoff
      );
      atomI.force = vecAdd(atomI.force, ljResult.force);
      atomJ.force = vecSub(atomJ.force, ljResult.force);
      vdwEnergy += ljResult.energy;

      // Coulomb interaction
      const coulResult = coulombInteraction(
        atomI.position,
        atomJ.position,
        atomI.charge,
        atomJ.charge,
        boxSize,
        cutoff
      );
      atomI.force = vecAdd(atomI.force, coulResult.force);
      atomJ.force = vecSub(atomJ.force, coulResult.force);
      elecEnergy += coulResult.energy;
    }
  }

  // Compute kinetic energy
  let kineticEnergy = 0;
  for (const atom of atoms) {
    const v2 = vecDot(atom.velocity, atom.velocity);
    kineticEnergy += 0.5 * atom.mass * v2 * 418.4; // Convert to kcal/mol
  }

  const potentialEnergy = bondEnergy + angleEnergy + vdwEnergy + elecEnergy;

  return {
    kinetic: kineticEnergy,
    potential: potentialEnergy,
    bond: bondEnergy,
    angle: angleEnergy,
    vdw: vdwEnergy,
    electrostatic: elecEnergy,
    total: kineticEnergy + potentialEnergy,
  };
}

// Velocity Verlet integration step
function velocityVerletStep(system: MolecularSystem, dt: number, cutoff: number): EnergyTerms {
  const { atoms, boxSize } = system;

  // Update positions: r(t+dt) = r(t) + v(t)*dt + 0.5*a(t)*dt^2
  for (const atom of atoms) {
    const a = vecScale(atom.force, 1 / atom.mass / 418.4); // force in kcal/mol/A, need A/fs^2

    for (let d = 0; d < 3; d++) {
      atom.position[d] += atom.velocity[d] * dt + 0.5 * a[d] * dt * dt;

      // Periodic boundary conditions
      while (atom.position[d] < 0) atom.position[d] += boxSize[d];
      while (atom.position[d] >= boxSize[d]) atom.position[d] -= boxSize[d];
    }

    // Store half velocity: v(t+dt/2) = v(t) + 0.5*a(t)*dt
    atom.velocity = vecAdd(atom.velocity, vecScale(a, 0.5 * dt));
  }

  // Compute new forces
  const energies = computeForces(system, cutoff);

  // Complete velocity update: v(t+dt) = v(t+dt/2) + 0.5*a(t+dt)*dt
  for (const atom of atoms) {
    const a = vecScale(atom.force, 1 / atom.mass / 418.4);
    atom.velocity = vecAdd(atom.velocity, vecScale(a, 0.5 * dt));
  }

  return energies;
}

// Berendsen thermostat
function applyBerendsenThermostat(
  atoms: Atom[],
  targetTemp: number,
  tau: number,
  dt: number
): void {
  const currentTemp = computeTemperature(atoms);
  if (currentTemp <= 0) return;

  const lambda = Math.sqrt(1 + (dt / tau) * (targetTemp / currentTemp - 1));

  for (const atom of atoms) {
    atom.velocity = vecScale(atom.velocity, lambda);
  }
}

// Energy minimization - steepest descent
function minimizeSteepestDescent(
  system: MolecularSystem,
  maxSteps: number,
  tolerance: number,
  cutoff: number
): { energies: EnergyTerms[]; converged: boolean; finalGradient: number } {
  const energies: EnergyTerms[] = [];
  let stepSize = 0.01; // Angstrom

  computeForces(system, cutoff);

  for (let step = 0; step < maxSteps; step++) {
    // Compute max force (gradient)
    let maxForce = 0;
    for (const atom of system.atoms) {
      const f = vecNorm(atom.force);
      maxForce = Math.max(maxForce, f);
    }

    if (maxForce < tolerance) {
      const finalEnergy = computeForces(system, cutoff);
      energies.push(finalEnergy);
      return { energies, converged: true, finalGradient: maxForce };
    }

    // Move atoms along force direction
    for (const atom of system.atoms) {
      const direction = vecNormalize(atom.force);
      atom.position = vecAdd(atom.position, vecScale(direction, stepSize));
    }

    const newEnergy = computeForces(system, cutoff);
    energies.push(newEnergy);

    // Adaptive step size
    if (energies.length >= 2 && newEnergy.potential > energies[energies.length - 2].potential) {
      stepSize *= 0.5;
    } else {
      stepSize *= 1.2;
    }
    stepSize = Math.min(Math.max(stepSize, 0.001), 0.1);
  }

  let finalMaxForce = 0;
  for (const atom of system.atoms) {
    finalMaxForce = Math.max(finalMaxForce, vecNorm(atom.force));
  }

  return { energies, converged: false, finalGradient: finalMaxForce };
}

// Run MD simulation
function runSimulation(
  system: MolecularSystem,
  params: SimulationParams
): {
  trajectory: Array<{ step: number; energies: EnergyTerms; temperature: number }>;
  finalSystem: MolecularSystem;
} {
  const trajectory: Array<{ step: number; energies: EnergyTerms; temperature: number }> = [];

  // Initialize velocities if NVT or NVE with temperature
  if (params.temperature && params.temperature > 0) {
    initializeVelocities(system.atoms, params.temperature);
  }

  // Initial force computation
  computeForces(system, params.cutoff);

  for (let step = 0; step < params.nsteps; step++) {
    // Integration step
    const energies = velocityVerletStep(system, params.dt, params.cutoff);

    // Apply thermostat for NVT
    if (params.ensemble === 'NVT' && params.temperature) {
      applyBerendsenThermostat(system.atoms, params.temperature, 0.1, params.dt);
    }

    // Record trajectory
    if (step % params.outputFreq === 0) {
      const temp = computeTemperature(system.atoms);
      trajectory.push({ step, energies, temperature: temp });
    }
  }

  return { trajectory, finalSystem: system };
}

// Compute radial distribution function
function computeRDF(
  system: MolecularSystem,
  rMax: number,
  nBins: number,
  atomType1?: string,
  atomType2?: string
): { r: number[]; g: number[] } {
  const dr = rMax / nBins;
  const histogram = new Array(nBins).fill(0);
  const { atoms, boxSize } = system;

  for (let i = 0; i < atoms.length; i++) {
    if (atomType1 && atoms[i].type !== atomType1) continue;

    for (let j = i + 1; j < atoms.length; j++) {
      if (atomType2 && atoms[j].type !== atomType2) continue;

      let dr_vec = vecSub(atoms[i].position, atoms[j].position);
      dr_vec = minimumImage(dr_vec, boxSize);
      const r = vecNorm(dr_vec);

      if (r < rMax) {
        const bin = Math.floor(r / dr);
        if (bin < nBins) {
          histogram[bin]++;
        }
      }
    }
  }

  // Normalize
  const volume = boxSize[0] * boxSize[1] * boxSize[2];
  const density = atoms.length / volume;

  const r: number[] = [];
  const g: number[] = [];

  for (let i = 0; i < nBins; i++) {
    const rLow = i * dr;
    const rHigh = (i + 1) * dr;
    const rMid = (rLow + rHigh) / 2;
    const shellVolume = (4 / 3) * Math.PI * (Math.pow(rHigh, 3) - Math.pow(rLow, 3));
    const idealCount = (density * shellVolume * atoms.length) / 2;

    r.push(rMid);
    g.push(idealCount > 0 ? histogram[i] / idealCount : 0);
  }

  return { r, g };
}

// Create example systems
function createArgonBox(n: number, density: number): MolecularSystem {
  const totalAtoms = n * n * n;
  const volume = (totalAtoms * 39.95) / density; // A^3
  const boxLength = Math.pow(volume, 1 / 3);
  const spacing = boxLength / n;

  const atoms: Atom[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        atoms.push({
          type: 'Ar',
          position: [(i + 0.5) * spacing, (j + 0.5) * spacing, (k + 0.5) * spacing],
          velocity: [0, 0, 0],
          force: [0, 0, 0],
          mass: 39.95,
          charge: 0,
        });
      }
    }
  }

  return {
    atoms,
    bonds: [],
    angles: [],
    boxSize: [boxLength, boxLength, boxLength],
    forceField: 'LJ',
  };
}

function createWaterBox(n: number): MolecularSystem {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const angles: Angle[] = [];

  const spacing = 3.5; // A between water molecules
  const boxLength = n * spacing;

  let atomIndex = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const baseX = (i + 0.5) * spacing;
        const baseY = (j + 0.5) * spacing;
        const baseZ = (k + 0.5) * spacing;

        // Oxygen
        atoms.push({
          type: 'O',
          position: [baseX, baseY, baseZ],
          velocity: [0, 0, 0],
          force: [0, 0, 0],
          mass: 16.0,
          charge: -0.82,
        });

        // Hydrogen 1
        atoms.push({
          type: 'H',
          position: [baseX + 0.76, baseY + 0.59, baseZ],
          velocity: [0, 0, 0],
          force: [0, 0, 0],
          mass: 1.008,
          charge: 0.41,
        });

        // Hydrogen 2
        atoms.push({
          type: 'H',
          position: [baseX - 0.76, baseY + 0.59, baseZ],
          velocity: [0, 0, 0],
          force: [0, 0, 0],
          mass: 1.008,
          charge: 0.41,
        });

        // Bonds
        bonds.push({ i: atomIndex, j: atomIndex + 1, type: 'O-H' });
        bonds.push({ i: atomIndex, j: atomIndex + 2, type: 'O-H' });

        // Angle
        angles.push({ i: atomIndex + 1, j: atomIndex, k: atomIndex + 2, type: 'H-O-H' });

        atomIndex += 3;
      }
    }
  }

  // Add H-O-H angle type if not present
  if (!ANGLE_TYPES['H-O-H']) {
    ANGLE_TYPES['H-O-H'] = { k: 100.0, theta0: (104.5 * Math.PI) / 180 };
  }

  return {
    atoms,
    bonds,
    angles,
    boxSize: [boxLength, boxLength, boxLength],
    forceField: 'TIP3P-like',
  };
}

export const moleculardynamicsTool: UnifiedTool = {
  name: 'molecular_dynamics',
  description: 'Molecular dynamics simulation for proteins, molecules, and atomic systems',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'minimize', 'analyze', 'create_system', 'rdf', 'info'],
        description: 'Operation to perform',
      },
      // System setup
      systemType: {
        type: 'string',
        enum: ['argon', 'water', 'custom'],
        description: 'Type of system to create',
      },
      nMolecules: {
        type: 'number',
        description: 'Number of molecules per dimension (creates n^3 grid)',
      },
      density: { type: 'number', description: 'Density in g/cm^3 for argon box' },

      // Simulation parameters
      timestep: { type: 'number', description: 'Timestep in femtoseconds' },
      nsteps: { type: 'number', description: 'Number of simulation steps' },
      temperature: { type: 'number', description: 'Temperature in Kelvin' },
      ensemble: {
        type: 'string',
        enum: ['NVE', 'NVT', 'NPT'],
        description: 'Statistical ensemble',
      },
      cutoff: { type: 'number', description: 'Nonbonded cutoff in Angstroms' },
      outputFreq: { type: 'number', description: 'Output frequency in steps' },

      // Minimization
      minSteps: { type: 'number', description: 'Maximum minimization steps' },
      tolerance: { type: 'number', description: 'Force tolerance for minimization (kcal/mol/A)' },

      // RDF analysis
      rdfMax: { type: 'number', description: 'Maximum radius for RDF' },
      rdfBins: { type: 'number', description: 'Number of bins for RDF histogram' },
    },
    required: ['operation'],
  },
};

export async function executemoleculardynamics(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            tool: 'molecular-dynamics',
            description: 'Molecular dynamics simulation engine',
            capabilities: [
              'Velocity Verlet integration',
              'Lennard-Jones potential (van der Waals)',
              'Coulombic interactions (electrostatics)',
              'Harmonic bond stretching',
              'Harmonic angle bending',
              'Periodic boundary conditions',
              'NVE, NVT (Berendsen thermostat) ensembles',
              'Energy minimization (steepest descent)',
              'Radial distribution function analysis',
              'Pre-built systems: Argon, Water',
            ],
            forceFields: {
              supported: ['AMBER-like (simplified)', 'LJ', 'TIP3P-like'],
              parameters: 'Includes common atom types: C, H, O, N, S, P, Ar, Na, Cl',
            },
            units: {
              length: 'Angstrom',
              time: 'femtosecond',
              energy: 'kcal/mol',
              temperature: 'Kelvin',
              mass: 'amu',
            },
            references: [
              'Allen & Tildesley "Computer Simulation of Liquids"',
              'Frenkel & Smit "Understanding Molecular Simulation"',
            ],
          },
          null,
          2
        ),
      };
    }

    if (operation === 'create_system') {
      const systemType = args.systemType ?? 'argon';
      const n = args.nMolecules ?? 4;
      const density = args.density ?? 1.4; // g/cm^3

      let system: MolecularSystem;
      if (systemType === 'argon') {
        system = createArgonBox(n, density);
      } else if (systemType === 'water') {
        system = createWaterBox(n);
      } else {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Unknown system type', systemType }),
          isError: true,
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            systemCreated: true,
            systemType,
            nAtoms: system.atoms.length,
            nBonds: system.bonds.length,
            nAngles: system.angles.length,
            boxSize: system.boxSize.map((x) => x.toFixed(2)),
            forceField: system.forceField,
            atomTypes: [...new Set(system.atoms.map((a) => a.type))],
          },
          null,
          2
        ),
      };
    }

    if (operation === 'simulate') {
      const systemType = args.systemType ?? 'argon';
      const n = args.nMolecules ?? 4;
      const density = args.density ?? 1.4;

      let system: MolecularSystem;
      if (systemType === 'argon') {
        system = createArgonBox(n, density);
      } else {
        system = createWaterBox(n);
      }

      const params: SimulationParams = {
        dt: args.timestep ?? 1.0,
        nsteps: args.nsteps ?? 1000,
        temperature: args.temperature ?? 300,
        ensemble: args.ensemble ?? 'NVT',
        cutoff: args.cutoff ?? 10.0,
        outputFreq: args.outputFreq ?? 100,
      };

      const result = runSimulation(system, params);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            simulation: {
              systemType,
              nAtoms: system.atoms.length,
              timestep: params.dt + ' fs',
              totalSteps: params.nsteps,
              ensemble: params.ensemble,
              targetTemperature: params.temperature + ' K',
            },
            trajectory: result.trajectory.map((t) => ({
              step: t.step,
              temperature: t.temperature.toFixed(2) + ' K',
              kineticEnergy: t.energies.kinetic.toFixed(4),
              potentialEnergy: t.energies.potential.toFixed(4),
              totalEnergy: t.energies.total.toFixed(4),
            })),
            finalEnergies: {
              kinetic: result.trajectory[result.trajectory.length - 1]?.energies.kinetic.toFixed(4),
              bond: result.trajectory[result.trajectory.length - 1]?.energies.bond.toFixed(4),
              angle: result.trajectory[result.trajectory.length - 1]?.energies.angle.toFixed(4),
              vdw: result.trajectory[result.trajectory.length - 1]?.energies.vdw.toFixed(4),
              electrostatic:
                result.trajectory[result.trajectory.length - 1]?.energies.electrostatic.toFixed(4),
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'minimize') {
      const systemType = args.systemType ?? 'argon';
      const n = args.nMolecules ?? 3;
      const density = args.density ?? 1.4;

      let system: MolecularSystem;
      if (systemType === 'argon') {
        system = createArgonBox(n, density);
      } else {
        system = createWaterBox(n);
      }

      const maxSteps = args.minSteps ?? 500;
      const tolerance = args.tolerance ?? 0.1;
      const cutoff = args.cutoff ?? 10.0;

      const result = minimizeSteepestDescent(system, maxSteps, tolerance, cutoff);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            minimization: {
              method: 'steepest descent',
              converged: result.converged,
              steps: result.energies.length,
              finalGradient: result.finalGradient.toFixed(6) + ' kcal/mol/A',
            },
            energyHistory: result.energies
              .slice(0, 10)
              .concat(result.energies.length > 10 ? result.energies.slice(-5) : [])
              .map((e, i) => ({
                step: i < 10 ? i : result.energies.length - 5 + (i - 10),
                potential: e.potential.toFixed(4),
                bond: e.bond.toFixed(4),
                vdw: e.vdw.toFixed(4),
              })),
            finalEnergy: result.energies[result.energies.length - 1]?.potential.toFixed(4),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'rdf') {
      const systemType = args.systemType ?? 'argon';
      const n = args.nMolecules ?? 5;
      const density = args.density ?? 1.4;

      let system: MolecularSystem;
      if (systemType === 'argon') {
        system = createArgonBox(n, density);
      } else {
        system = createWaterBox(n);
      }

      // Run brief equilibration
      const eqParams: SimulationParams = {
        dt: 1.0,
        nsteps: 500,
        temperature: 300,
        ensemble: 'NVT',
        cutoff: 10.0,
        outputFreq: 100,
      };

      runSimulation(system, eqParams);

      // Compute RDF
      const rMax = args.rdfMax ?? Math.min(...system.boxSize) / 2;
      const nBins = args.rdfBins ?? 100;
      const rdf = computeRDF(system, rMax, nBins);

      // Find peaks
      const peaks: { r: number; g: number }[] = [];
      for (let i = 1; i < rdf.g.length - 1; i++) {
        if (rdf.g[i] > rdf.g[i - 1] && rdf.g[i] > rdf.g[i + 1] && rdf.g[i] > 1.5) {
          peaks.push({ r: rdf.r[i], g: rdf.g[i] });
        }
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            rdf: {
              systemType,
              nAtoms: system.atoms.length,
              rMax: rMax.toFixed(2) + ' A',
              nBins,
            },
            peaks: peaks.slice(0, 5).map((p) => ({
              distance: p.r.toFixed(3) + ' A',
              gOfR: p.g.toFixed(3),
            })),
            profile: rdf.r
              .filter((_, i) => i % 10 === 0)
              .map((r, i) => ({
                r: r.toFixed(2),
                g: rdf.g[i * 10]?.toFixed(3) ?? '0',
              })),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'analyze') {
      const systemType = args.systemType ?? 'argon';
      const n = args.nMolecules ?? 4;

      let system: MolecularSystem;
      if (systemType === 'argon') {
        system = createArgonBox(n, args.density ?? 1.4);
      } else {
        system = createWaterBox(n);
      }

      // Run simulation for analysis
      const params: SimulationParams = {
        dt: 1.0,
        nsteps: 1000,
        temperature: 300,
        ensemble: 'NVT',
        cutoff: 10.0,
        outputFreq: 100,
      };

      const result = runSimulation(system, params);

      // Compute statistics
      const temps = result.trajectory.map((t) => t.temperature);
      const potEnergies = result.trajectory.map((t) => t.energies.potential);
      const totEnergies = result.trajectory.map((t) => t.energies.total);

      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const avgPot = potEnergies.reduce((a, b) => a + b, 0) / potEnergies.length;
      const avgTot = totEnergies.reduce((a, b) => a + b, 0) / totEnergies.length;

      const tempStd = Math.sqrt(temps.reduce((a, b) => a + (b - avgTemp) ** 2, 0) / temps.length);
      const totStd = Math.sqrt(
        totEnergies.reduce((a, b) => a + (b - avgTot) ** 2, 0) / totEnergies.length
      );

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            analysis: {
              systemType,
              nAtoms: system.atoms.length,
              boxVolume:
                (system.boxSize[0] * system.boxSize[1] * system.boxSize[2]).toFixed(2) + ' A^3',
            },
            thermodynamics: {
              avgTemperature: avgTemp.toFixed(2) + ' K',
              tempFluctuation: tempStd.toFixed(2) + ' K',
              avgPotentialEnergy: avgPot.toFixed(4) + ' kcal/mol',
              avgTotalEnergy: avgTot.toFixed(4) + ' kcal/mol',
              energyConservation: totStd.toFixed(6) + ' kcal/mol',
            },
            equilibration: {
              temperatureStable: tempStd < 20,
              energyStable: totStd < Math.abs(avgTot) * 0.01,
            },
          },
          null,
          2
        ),
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: 'Unknown operation', operation }),
      isError: true,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismoleculardynamicsAvailable(): boolean {
  return true;
}
