/**
 * NBODY-SIMULATION TOOL
 * Full N-body gravitational simulation
 *
 * Implements:
 * - Direct O(N^2) gravitational force calculation
 * - Barnes-Hut tree algorithm O(N log N)
 * - Multiple integrators (Euler, Leapfrog, RK4, Verlet)
 * - Energy and momentum conservation tracking
 * - Orbital element computation
 * - Preset solar system configurations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const G = 6.67430e-11;  // Gravitational constant (m^3 kg^-1 s^-2)
const AU = 1.496e11;    // Astronomical unit (m)
const YEAR = 365.25 * 24 * 3600;  // Year in seconds
const SOLAR_MASS = 1.989e30;  // Solar mass (kg)
const EARTH_MASS = 5.972e24;  // Earth mass (kg)

interface Body {
  name: string;
  mass: number;         // kg
  position: [number, number, number];  // m
  velocity: [number, number, number];  // m/s
  acceleration: [number, number, number];
  radius?: number;      // m (for collision detection)
}

interface SimulationState {
  bodies: Body[];
  time: number;
  dt: number;
  totalEnergy: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalMomentum: [number, number, number];
  angularMomentum: [number, number, number];
}

interface OrbitalElements {
  semiMajorAxis: number;    // m
  eccentricity: number;
  inclination: number;      // rad
  longitudeAscending: number;  // rad
  argumentPerihelion: number;  // rad
  trueAnomaly: number;      // rad
  period: number;           // s
  aphelion: number;         // m
  perihelion: number;       // m
}

// Barnes-Hut octree node
interface OctreeNode {
  centerOfMass: [number, number, number];
  totalMass: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  children: (OctreeNode | null)[];
  body: Body | null;
  isLeaf: boolean;
}

// Vector operations
function vecAdd(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecScale(v: [number, number, number], s: number): [number, number, number] {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function vecDot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecCross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecNorm(v: [number, number, number]): number {
  return Math.sqrt(vecDot(v, v));
}

function vecNormalize(v: [number, number, number]): [number, number, number] {
  const n = vecNorm(v);
  return n > 0 ? vecScale(v, 1/n) : [0, 0, 0];
}

// Direct force calculation O(N^2)
function computeForcesDirect(bodies: Body[], softening: number = 0): void {
  // Reset accelerations
  for (const body of bodies) {
    body.acceleration = [0, 0, 0];
  }

  // Compute pairwise gravitational forces
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dr = vecSub(bodies[j].position, bodies[i].position);
      const r = vecNorm(dr);
      const rSoft = Math.sqrt(r * r + softening * softening);

      if (rSoft < 1e-10) continue;

      // F = G * m1 * m2 / r^2
      const forceMag = G / (rSoft * rSoft * rSoft);  // divided by r again for direction

      // a = F / m
      const accI = vecScale(dr, forceMag * bodies[j].mass);
      const accJ = vecScale(dr, -forceMag * bodies[i].mass);

      bodies[i].acceleration = vecAdd(bodies[i].acceleration, accI);
      bodies[j].acceleration = vecAdd(bodies[j].acceleration, accJ);
    }
  }
}

// Barnes-Hut tree construction
function buildOctree(bodies: Body[]): OctreeNode | null {
  if (bodies.length === 0) return null;

  // Find bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const body of bodies) {
    minX = Math.min(minX, body.position[0]);
    minY = Math.min(minY, body.position[1]);
    minZ = Math.min(minZ, body.position[2]);
    maxX = Math.max(maxX, body.position[0]);
    maxY = Math.max(maxY, body.position[1]);
    maxZ = Math.max(maxZ, body.position[2]);
  }

  // Add padding
  const padding = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 0.01 + 1;
  minX -= padding; minY -= padding; minZ -= padding;
  maxX += padding; maxY += padding; maxZ += padding;

  return buildOctreeNode(bodies, { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] });
}

function buildOctreeNode(
  bodies: Body[],
  bounds: { min: [number, number, number]; max: [number, number, number] }
): OctreeNode | null {
  if (bodies.length === 0) return null;

  const node: OctreeNode = {
    centerOfMass: [0, 0, 0],
    totalMass: 0,
    bounds,
    children: [null, null, null, null, null, null, null, null],
    body: null,
    isLeaf: bodies.length === 1
  };

  if (bodies.length === 1) {
    node.body = bodies[0];
    node.centerOfMass = [...bodies[0].position];
    node.totalMass = bodies[0].mass;
    return node;
  }

  // Compute center of mass
  for (const body of bodies) {
    node.centerOfMass = vecAdd(node.centerOfMass, vecScale(body.position, body.mass));
    node.totalMass += body.mass;
  }
  node.centerOfMass = vecScale(node.centerOfMass, 1 / node.totalMass);

  // Split into octants
  const mid: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ];

  const octants: Body[][] = [[], [], [], [], [], [], [], []];

  for (const body of bodies) {
    const octant =
      (body.position[0] < mid[0] ? 0 : 1) +
      (body.position[1] < mid[1] ? 0 : 2) +
      (body.position[2] < mid[2] ? 0 : 4);
    octants[octant].push(body);
  }

  // Recursively build children
  for (let i = 0; i < 8; i++) {
    if (octants[i].length > 0) {
      const childBounds = {
        min: [
          (i & 1) ? mid[0] : bounds.min[0],
          (i & 2) ? mid[1] : bounds.min[1],
          (i & 4) ? mid[2] : bounds.min[2]
        ] as [number, number, number],
        max: [
          (i & 1) ? bounds.max[0] : mid[0],
          (i & 2) ? bounds.max[1] : mid[1],
          (i & 4) ? bounds.max[2] : mid[2]
        ] as [number, number, number]
      };
      node.children[i] = buildOctreeNode(octants[i], childBounds);
    }
  }

  return node;
}

// Barnes-Hut force calculation
function computeForceBarnesHut(
  body: Body,
  node: OctreeNode | null,
  theta: number,
  softening: number
): [number, number, number] {
  if (!node) return [0, 0, 0];

  const dr = vecSub(node.centerOfMass, body.position);
  const r = vecNorm(dr);

  if (r < 1e-10) return [0, 0, 0];

  // Check if we can use this node as a single mass
  const size = node.bounds.max[0] - node.bounds.min[0];

  if (node.isLeaf || size / r < theta) {
    // Treat as point mass
    const rSoft = Math.sqrt(r * r + softening * softening);
    const forceMag = G * node.totalMass / (rSoft * rSoft * rSoft);
    return vecScale(dr, forceMag);
  }

  // Recurse into children
  let acc: [number, number, number] = [0, 0, 0];
  for (const child of node.children) {
    if (child) {
      acc = vecAdd(acc, computeForceBarnesHut(body, child, theta, softening));
    }
  }

  return acc;
}

function computeForcesBarnesHut(bodies: Body[], theta: number = 0.5, softening: number = 0): void {
  const tree = buildOctree(bodies);

  for (const body of bodies) {
    body.acceleration = computeForceBarnesHut(body, tree, theta, softening);
  }
}

// Integration methods
function integrateEuler(bodies: Body[], dt: number): void {
  for (const body of bodies) {
    body.position = vecAdd(body.position, vecScale(body.velocity, dt));
    body.velocity = vecAdd(body.velocity, vecScale(body.acceleration, dt));
  }
}

function integrateLeapfrog(bodies: Body[], dt: number, computeForces: () => void): void {
  // Kick (half step velocity)
  for (const body of bodies) {
    body.velocity = vecAdd(body.velocity, vecScale(body.acceleration, dt / 2));
  }

  // Drift (full step position)
  for (const body of bodies) {
    body.position = vecAdd(body.position, vecScale(body.velocity, dt));
  }

  // Update forces
  computeForces();

  // Kick (half step velocity)
  for (const body of bodies) {
    body.velocity = vecAdd(body.velocity, vecScale(body.acceleration, dt / 2));
  }
}

function integrateVerlet(bodies: Body[], dt: number, computeForces: () => void): void {
  // Velocity Verlet
  // Update positions
  for (const body of bodies) {
    body.position = vecAdd(
      vecAdd(body.position, vecScale(body.velocity, dt)),
      vecScale(body.acceleration, 0.5 * dt * dt)
    );
  }

  // Store old accelerations
  const oldAcc = bodies.map(b => [...b.acceleration] as [number, number, number]);

  // Update forces
  computeForces();

  // Update velocities
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].velocity = vecAdd(
      bodies[i].velocity,
      vecScale(vecAdd(oldAcc[i], bodies[i].acceleration), 0.5 * dt)
    );
  }
}

function integrateRK4(bodies: Body[], dt: number, computeForces: () => void): void {
  const n = bodies.length;

  // Save initial state
  const x0 = bodies.map(b => [...b.position] as [number, number, number]);
  const v0 = bodies.map(b => [...b.velocity] as [number, number, number]);

  // k1
  computeForces();
  const k1x = bodies.map(b => [...b.velocity] as [number, number, number]);
  const k1v = bodies.map(b => [...b.acceleration] as [number, number, number]);

  // k2
  for (let i = 0; i < n; i++) {
    bodies[i].position = vecAdd(x0[i], vecScale(k1x[i], dt / 2));
    bodies[i].velocity = vecAdd(v0[i], vecScale(k1v[i], dt / 2));
  }
  computeForces();
  const k2x = bodies.map(b => [...b.velocity] as [number, number, number]);
  const k2v = bodies.map(b => [...b.acceleration] as [number, number, number]);

  // k3
  for (let i = 0; i < n; i++) {
    bodies[i].position = vecAdd(x0[i], vecScale(k2x[i], dt / 2));
    bodies[i].velocity = vecAdd(v0[i], vecScale(k2v[i], dt / 2));
  }
  computeForces();
  const k3x = bodies.map(b => [...b.velocity] as [number, number, number]);
  const k3v = bodies.map(b => [...b.acceleration] as [number, number, number]);

  // k4
  for (let i = 0; i < n; i++) {
    bodies[i].position = vecAdd(x0[i], vecScale(k3x[i], dt));
    bodies[i].velocity = vecAdd(v0[i], vecScale(k3v[i], dt));
  }
  computeForces();
  const k4x = bodies.map(b => [...b.velocity] as [number, number, number]);
  const k4v = bodies.map(b => [...b.acceleration] as [number, number, number]);

  // Combine
  for (let i = 0; i < n; i++) {
    bodies[i].position = vecAdd(x0[i], vecScale(
      vecAdd(vecAdd(k1x[i], vecScale(k2x[i], 2)), vecAdd(vecScale(k3x[i], 2), k4x[i])),
      dt / 6
    ));
    bodies[i].velocity = vecAdd(v0[i], vecScale(
      vecAdd(vecAdd(k1v[i], vecScale(k2v[i], 2)), vecAdd(vecScale(k3v[i], 2), k4v[i])),
      dt / 6
    ));
  }
}

// Compute energy and momentum
function computeEnergies(bodies: Body[]): { kinetic: number; potential: number; total: number } {
  let kinetic = 0;
  let potential = 0;

  for (const body of bodies) {
    const v2 = vecDot(body.velocity, body.velocity);
    kinetic += 0.5 * body.mass * v2;
  }

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dr = vecSub(bodies[j].position, bodies[i].position);
      const r = vecNorm(dr);
      if (r > 0) {
        potential -= G * bodies[i].mass * bodies[j].mass / r;
      }
    }
  }

  return { kinetic, potential, total: kinetic + potential };
}

function computeMomentum(bodies: Body[]): [number, number, number] {
  let p: [number, number, number] = [0, 0, 0];
  for (const body of bodies) {
    p = vecAdd(p, vecScale(body.velocity, body.mass));
  }
  return p;
}

function computeAngularMomentum(bodies: Body[]): [number, number, number] {
  let L: [number, number, number] = [0, 0, 0];
  for (const body of bodies) {
    const r = body.position;
    const p = vecScale(body.velocity, body.mass);
    L = vecAdd(L, vecCross(r, p));
  }
  return L;
}

// Compute orbital elements relative to central body
function computeOrbitalElements(body: Body, centralMass: number): OrbitalElements {
  const mu = G * centralMass;
  const r = body.position;
  const v = body.velocity;
  const rMag = vecNorm(r);
  const vMag = vecNorm(v);

  // Specific orbital energy
  const energy = vMag * vMag / 2 - mu / rMag;

  // Semi-major axis
  const a = -mu / (2 * energy);

  // Angular momentum vector
  const h = vecCross(r, v);
  const hMag = vecNorm(h);

  // Eccentricity vector
  const eVec = vecSub(
    vecScale(vecCross(v, h), 1 / mu),
    vecNormalize(r)
  );
  const e = vecNorm(eVec);

  // Inclination
  const i = Math.acos(h[2] / hMag);

  // Node vector
  const n: [number, number, number] = [-h[1], h[0], 0];
  const nMag = vecNorm(n);

  // Longitude of ascending node
  let Omega = 0;
  if (nMag > 0) {
    Omega = Math.acos(n[0] / nMag);
    if (n[1] < 0) Omega = 2 * Math.PI - Omega;
  }

  // Argument of perihelion
  let omega = 0;
  if (nMag > 0 && e > 1e-10) {
    omega = Math.acos(vecDot(n, eVec) / (nMag * e));
    if (eVec[2] < 0) omega = 2 * Math.PI - omega;
  }

  // True anomaly
  let nu = 0;
  if (e > 1e-10) {
    nu = Math.acos(vecDot(eVec, r) / (e * rMag));
    if (vecDot(r, v) < 0) nu = 2 * Math.PI - nu;
  }

  // Orbital period
  const period = 2 * Math.PI * Math.sqrt(Math.pow(Math.abs(a), 3) / mu);

  return {
    semiMajorAxis: a,
    eccentricity: e,
    inclination: i,
    longitudeAscending: Omega,
    argumentPerihelion: omega,
    trueAnomaly: nu,
    period,
    aphelion: a * (1 + e),
    perihelion: a * (1 - e)
  };
}

// Create preset systems
function createSolarSystem(): Body[] {
  // Simplified solar system (inner planets + Jupiter)
  return [
    {
      name: 'Sun',
      mass: SOLAR_MASS,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      acceleration: [0, 0, 0],
      radius: 6.96e8
    },
    {
      name: 'Mercury',
      mass: 3.285e23,
      position: [5.79e10, 0, 0],
      velocity: [0, 4.74e4, 0],
      acceleration: [0, 0, 0],
      radius: 2.44e6
    },
    {
      name: 'Venus',
      mass: 4.867e24,
      position: [1.082e11, 0, 0],
      velocity: [0, 3.5e4, 0],
      acceleration: [0, 0, 0],
      radius: 6.05e6
    },
    {
      name: 'Earth',
      mass: EARTH_MASS,
      position: [AU, 0, 0],
      velocity: [0, 2.978e4, 0],
      acceleration: [0, 0, 0],
      radius: 6.37e6
    },
    {
      name: 'Mars',
      mass: 6.39e23,
      position: [2.279e11, 0, 0],
      velocity: [0, 2.41e4, 0],
      acceleration: [0, 0, 0],
      radius: 3.39e6
    },
    {
      name: 'Jupiter',
      mass: 1.898e27,
      position: [7.785e11, 0, 0],
      velocity: [0, 1.31e4, 0],
      acceleration: [0, 0, 0],
      radius: 6.99e7
    }
  ];
}

function createBinarySystem(mass1: number, mass2: number, separation: number): Body[] {
  // Two bodies in circular orbit around common center of mass
  const totalMass = mass1 + mass2;
  const r1 = separation * mass2 / totalMass;
  const r2 = separation * mass1 / totalMass;

  const v1 = Math.sqrt(G * mass2 * mass2 / (totalMass * r1));
  const v2 = Math.sqrt(G * mass1 * mass1 / (totalMass * r2));

  return [
    {
      name: 'Body 1',
      mass: mass1,
      position: [r1, 0, 0],
      velocity: [0, v1, 0],
      acceleration: [0, 0, 0]
    },
    {
      name: 'Body 2',
      mass: mass2,
      position: [-r2, 0, 0],
      velocity: [0, -v2, 0],
      acceleration: [0, 0, 0]
    }
  ];
}

function createRandomCluster(n: number, totalMass: number, radius: number): Body[] {
  const bodies: Body[] = [];
  const massPerBody = totalMass / n;

  // Generate positions in a sphere
  for (let i = 0; i < n; i++) {
    // Uniform distribution in sphere
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    // Initial velocities for virial equilibrium (approximate)
    const vMag = Math.sqrt(G * totalMass / (2 * radius)) * 0.5;
    const vTheta = Math.random() * 2 * Math.PI;
    const vPhi = Math.acos(2 * Math.random() - 1);

    bodies.push({
      name: `Body ${i + 1}`,
      mass: massPerBody * (0.5 + Math.random()),
      position: [x, y, z],
      velocity: [
        vMag * Math.sin(vPhi) * Math.cos(vTheta),
        vMag * Math.sin(vPhi) * Math.sin(vTheta),
        vMag * Math.cos(vPhi)
      ],
      acceleration: [0, 0, 0]
    });
  }

  // Normalize masses
  const actualMass = bodies.reduce((sum, b) => sum + b.mass, 0);
  for (const body of bodies) {
    body.mass *= totalMass / actualMass;
  }

  // Remove center of mass velocity
  const comVel = computeMomentum(bodies);
  const totalM = bodies.reduce((sum, b) => sum + b.mass, 0);
  const comVelNorm = vecScale(comVel, 1 / totalM);

  for (const body of bodies) {
    body.velocity = vecSub(body.velocity, comVelNorm);
  }

  return bodies;
}

// Run simulation
function runSimulation(
  bodies: Body[],
  dt: number,
  nSteps: number,
  integrator: 'euler' | 'leapfrog' | 'verlet' | 'rk4',
  algorithm: 'direct' | 'barnes-hut',
  theta: number = 0.5,
  softening: number = 0,
  outputFreq: number = 100
): { states: SimulationState[]; bodies: Body[] } {
  const states: SimulationState[] = [];

  const computeForces = algorithm === 'barnes-hut'
    ? () => computeForcesBarnesHut(bodies, theta, softening)
    : () => computeForcesDirect(bodies, softening);

  // Initial forces
  computeForces();

  for (let step = 0; step < nSteps; step++) {
    // Record state
    if (step % outputFreq === 0) {
      const energies = computeEnergies(bodies);
      const momentum = computeMomentum(bodies);
      const angularMom = computeAngularMomentum(bodies);

      states.push({
        bodies: bodies.map(b => ({ ...b })),
        time: step * dt,
        dt,
        totalEnergy: energies.total,
        kineticEnergy: energies.kinetic,
        potentialEnergy: energies.potential,
        totalMomentum: momentum,
        angularMomentum: angularMom
      });
    }

    // Integrate
    switch (integrator) {
      case 'euler':
        integrateEuler(bodies, dt);
        computeForces();
        break;
      case 'leapfrog':
        integrateLeapfrog(bodies, dt, computeForces);
        break;
      case 'verlet':
        integrateVerlet(bodies, dt, computeForces);
        break;
      case 'rk4':
        integrateRK4(bodies, dt, computeForces);
        break;
    }
  }

  return { states, bodies };
}

export const nbodysimulationTool: UnifiedTool = {
  name: 'nbody_simulation',
  description: 'N-body gravitational simulation with direct and Barnes-Hut algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'step', 'analyze', 'orbital_elements', 'create_system', 'info'],
        description: 'Operation to perform'
      },
      // System setup
      systemType: {
        type: 'string',
        enum: ['solar', 'binary', 'cluster', 'custom'],
        description: 'Preset system type'
      },
      nBodies: { type: 'number', description: 'Number of bodies for cluster' },
      totalMass: { type: 'number', description: 'Total mass for cluster (kg)' },
      clusterRadius: { type: 'number', description: 'Cluster radius (m)' },

      // Binary system
      mass1: { type: 'number', description: 'First body mass (kg)' },
      mass2: { type: 'number', description: 'Second body mass (kg)' },
      separation: { type: 'number', description: 'Binary separation (m)' },

      // Simulation parameters
      timestep: { type: 'number', description: 'Timestep in seconds' },
      nsteps: { type: 'number', description: 'Number of steps' },
      integrator: {
        type: 'string',
        enum: ['euler', 'leapfrog', 'verlet', 'rk4'],
        description: 'Integration method'
      },
      algorithm: {
        type: 'string',
        enum: ['direct', 'barnes-hut'],
        description: 'Force calculation algorithm'
      },
      theta: { type: 'number', description: 'Barnes-Hut opening angle (default 0.5)' },
      softening: { type: 'number', description: 'Gravitational softening length (m)' },
      outputFreq: { type: 'number', description: 'Output frequency in steps' }
    },
    required: ['operation']
  }
};

export async function executenbodysimulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'nbody-simulation',
          description: 'N-body gravitational dynamics simulation',
          capabilities: [
            'Direct O(N^2) force calculation',
            'Barnes-Hut tree algorithm O(N log N)',
            'Multiple integrators: Euler, Leapfrog, Velocity Verlet, RK4',
            'Energy and momentum conservation tracking',
            'Orbital element computation',
            'Preset systems: Solar system, Binary stars, Star clusters'
          ],
          integrators: {
            euler: 'First-order, fast but inaccurate',
            leapfrog: 'Second-order symplectic, good energy conservation',
            verlet: 'Velocity Verlet, second-order, stable',
            rk4: 'Fourth-order Runge-Kutta, accurate but expensive'
          },
          algorithms: {
            direct: 'O(N^2), exact forces, best for small N',
            'barnes-hut': 'O(N log N), approximate, best for large N'
          },
          physicalConstants: {
            G: G + ' m^3 kg^-1 s^-2',
            AU: AU + ' m',
            solarMass: SOLAR_MASS + ' kg',
            earthMass: EARTH_MASS + ' kg'
          }
        }, null, 2)
      };
    }

    if (operation === 'create_system') {
      const systemType = args.systemType ?? 'solar';
      let bodies: Body[];

      switch (systemType) {
        case 'solar':
          bodies = createSolarSystem();
          break;
        case 'binary':
          bodies = createBinarySystem(
            args.mass1 ?? SOLAR_MASS,
            args.mass2 ?? SOLAR_MASS * 0.5,
            args.separation ?? AU
          );
          break;
        case 'cluster':
          bodies = createRandomCluster(
            args.nBodies ?? 100,
            args.totalMass ?? SOLAR_MASS * 1000,
            args.clusterRadius ?? AU * 10
          );
          break;
        default:
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Unknown system type', systemType }),
            isError: true
          };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          systemCreated: true,
          systemType,
          nBodies: bodies.length,
          bodies: bodies.map(b => ({
            name: b.name,
            mass: b.mass.toExponential(3) + ' kg',
            position: b.position.map(x => (x / AU).toFixed(3) + ' AU'),
            velocity: b.velocity.map(v => v.toFixed(1) + ' m/s')
          }))
        }, null, 2)
      };
    }

    if (operation === 'simulate') {
      const systemType = args.systemType ?? 'solar';
      let bodies: Body[];

      switch (systemType) {
        case 'solar':
          bodies = createSolarSystem();
          break;
        case 'binary':
          bodies = createBinarySystem(
            args.mass1 ?? SOLAR_MASS,
            args.mass2 ?? SOLAR_MASS * 0.5,
            args.separation ?? AU
          );
          break;
        case 'cluster':
          bodies = createRandomCluster(
            args.nBodies ?? 50,
            args.totalMass ?? SOLAR_MASS * 100,
            args.clusterRadius ?? AU * 5
          );
          break;
        default:
          bodies = createSolarSystem();
      }

      const dt = args.timestep ?? (systemType === 'solar' ? 86400 : 3600);
      const nSteps = args.nsteps ?? 1000;
      const integrator = args.integrator ?? 'leapfrog';
      const algorithm = args.algorithm ?? (bodies.length > 100 ? 'barnes-hut' : 'direct');
      const theta = args.theta ?? 0.5;
      const softening = args.softening ?? 0;
      const outputFreq = args.outputFreq ?? Math.max(1, Math.floor(nSteps / 20));

      const result = runSimulation(
        bodies, dt, nSteps, integrator, algorithm, theta, softening, outputFreq
      );

      // Compute energy conservation
      const initialEnergy = result.states[0]?.totalEnergy ?? 0;
      const finalEnergy = result.states[result.states.length - 1]?.totalEnergy ?? 0;
      const energyError = Math.abs((finalEnergy - initialEnergy) / initialEnergy);

      return {
        toolCallId: id,
        content: JSON.stringify({
          simulation: {
            systemType,
            nBodies: bodies.length,
            timestep: dt + ' s',
            totalSteps: nSteps,
            simulatedTime: (nSteps * dt / YEAR).toFixed(3) + ' years',
            integrator,
            algorithm
          },
          conservation: {
            initialEnergy: initialEnergy.toExponential(4) + ' J',
            finalEnergy: finalEnergy.toExponential(4) + ' J',
            relativeEnergyError: (energyError * 100).toFixed(6) + '%'
          },
          trajectory: result.states.slice(0, 10).concat(
            result.states.length > 10 ? result.states.slice(-5) : []
          ).map(s => ({
            time: (s.time / YEAR).toFixed(4) + ' years',
            totalEnergy: s.totalEnergy.toExponential(4),
            kineticEnergy: s.kineticEnergy.toExponential(4)
          })),
          finalPositions: result.bodies.map(b => ({
            name: b.name,
            position: b.position.map(x => (x / AU).toFixed(4) + ' AU').join(', ')
          }))
        }, null, 2)
      };
    }

    if (operation === 'orbital_elements') {
      const bodies = createSolarSystem();
      const centralMass = bodies[0].mass;

      // Compute orbital elements for each planet
      const elements = bodies.slice(1).map(body => {
        const orb = computeOrbitalElements(body, centralMass);
        return {
          name: body.name,
          semiMajorAxis: (orb.semiMajorAxis / AU).toFixed(4) + ' AU',
          eccentricity: orb.eccentricity.toFixed(6),
          inclination: (orb.inclination * 180 / Math.PI).toFixed(2) + ' deg',
          period: (orb.period / YEAR).toFixed(4) + ' years',
          perihelion: (orb.perihelion / AU).toFixed(4) + ' AU',
          aphelion: (orb.aphelion / AU).toFixed(4) + ' AU'
        };
      });

      return {
        toolCallId: id,
        content: JSON.stringify({
          centralBody: bodies[0].name,
          centralMass: centralMass.toExponential(3) + ' kg',
          orbitingBodies: elements
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      const systemType = args.systemType ?? 'cluster';
      let bodies: Body[];

      if (systemType === 'cluster') {
        bodies = createRandomCluster(
          args.nBodies ?? 100,
          args.totalMass ?? SOLAR_MASS * 1000,
          args.clusterRadius ?? AU * 10
        );
      } else {
        bodies = createSolarSystem();
      }

      // Initial analysis
      const energies = computeEnergies(bodies);
      const momentum = computeMomentum(bodies);
      const angularMom = computeAngularMomentum(bodies);

      // Compute center of mass
      let totalMass = 0;
      let com: [number, number, number] = [0, 0, 0];
      for (const body of bodies) {
        totalMass += body.mass;
        com = vecAdd(com, vecScale(body.position, body.mass));
      }
      com = vecScale(com, 1 / totalMass);

      // Compute velocity dispersion
      const velocities = bodies.map(b => vecNorm(b.velocity));
      const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const velDispersion = Math.sqrt(
        velocities.reduce((sum, v) => sum + (v - avgVel) ** 2, 0) / velocities.length
      );

      // Virial ratio
      const virialRatio = 2 * energies.kinetic / Math.abs(energies.potential);

      return {
        toolCallId: id,
        content: JSON.stringify({
          system: {
            type: systemType,
            nBodies: bodies.length,
            totalMass: totalMass.toExponential(3) + ' kg'
          },
          energetics: {
            kineticEnergy: energies.kinetic.toExponential(4) + ' J',
            potentialEnergy: energies.potential.toExponential(4) + ' J',
            totalEnergy: energies.total.toExponential(4) + ' J',
            bound: energies.total < 0
          },
          dynamics: {
            virialRatio: virialRatio.toFixed(4),
            equilibrium: Math.abs(virialRatio - 1) < 0.5 ? 'Near virial equilibrium' : 'Not in equilibrium',
            avgVelocity: avgVel.toFixed(2) + ' m/s',
            velocityDispersion: velDispersion.toFixed(2) + ' m/s'
          },
          centerOfMass: {
            position: com.map(x => (x / AU).toFixed(4) + ' AU'),
            momentum: momentum.map(p => p.toExponential(3) + ' kg m/s'),
            angularMomentum: angularMom.map(L => L.toExponential(3) + ' kg m^2/s')
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: 'Unknown operation', operation }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnbodysimulationAvailable(): boolean {
  return true;
}
