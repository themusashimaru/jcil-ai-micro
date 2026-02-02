/**
 * SPH-FLUID TOOL
 * Smoothed Particle Hydrodynamics fluid simulation
 * Features: density computation, pressure forces, viscosity forces, surface tension,
 * boundary handling, particle neighbor search, incompressibility
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// Type Definitions
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface SPHParticle {
  id: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  density: number;
  pressure: number;
  mass: number;
  isFluid: boolean;
  colorField: number;
  colorFieldGradient: Vector3;
  neighbors: number[];
}

interface FluidConfig {
  restDensity: number;
  particleMass: number;
  smoothingRadius: number;
  stiffness: number;
  viscosity: number;
  surfaceTension: number;
  surfaceTensionThreshold: number;
  gravity: Vector3;
  boundaryDamping: number;
}

interface SPHState {
  particles: SPHParticle[];
  time: number;
  config: FluidConfig;
  spatialHash: Map<string, number[]>;
  cellSize: number;
  bounds: { min: Vector3; max: Vector3 };
}

interface SimulationResult {
  frames: {
    time: number;
    particles: { id: number; position: Vector3; velocity: Vector3; density: number; pressure: number }[];
    stats: { avgDensity: number; maxVelocity: number; particleCount: number };
  }[];
  finalState: SPHState;
  performanceMetrics: { avgNeighbors: number; totalSteps: number };
}

// ============================================================================
// Constants and Vector Utilities
// ============================================================================

const GRAVITY = 9.80665;
const PI = Math.PI;

function vec3Zero(): Vector3 { return { x: 0, y: 0, z: 0 }; }
function vec3Add(a: Vector3, b: Vector3): Vector3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function vec3Sub(a: Vector3, b: Vector3): Vector3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function vec3Scale(v: Vector3, s: number): Vector3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function vec3Dot(a: Vector3, b: Vector3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function vec3Length(v: Vector3): number { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
function vec3LengthSq(v: Vector3): number { return v.x * v.x + v.y * v.y + v.z * v.z; }
function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Length(v);
  return len < 1e-10 ? vec3Zero() : vec3Scale(v, 1 / len);
}

// ============================================================================
// SPH Kernel Functions
// ============================================================================

function kernelPoly6(r: number, h: number): number {
  if (r > h) return 0;
  const h2 = h * h, r2 = r * r;
  const diff = h2 - r2;
  return (315 / (64 * PI * Math.pow(h, 9))) * diff * diff * diff;
}

function gradKernelPoly6(rVec: Vector3, r: number, h: number): Vector3 {
  if (r > h || r < 1e-10) return vec3Zero();
  const h2 = h * h, r2 = r * r;
  const diff = h2 - r2;
  return vec3Scale(rVec, (-945 / (32 * PI * Math.pow(h, 9))) * diff * diff);
}

function laplacianPoly6(r: number, h: number): number {
  if (r > h) return 0;
  const h2 = h * h, r2 = r * r;
  return (-945 / (32 * PI * Math.pow(h, 9))) * (h2 - r2) * (3 * h2 - 7 * r2);
}

function gradKernelSpiky(rVec: Vector3, r: number, h: number): Vector3 {
  if (r > h || r < 1e-10) return vec3Zero();
  const diff = h - r;
  return vec3Scale(rVec, (-45 / (PI * Math.pow(h, 6))) * diff * diff / r);
}

function laplacianKernelViscosity(r: number, h: number): number {
  if (r > h) return 0;
  return (45 / (PI * Math.pow(h, 6))) * (h - r);
}

// ============================================================================
// Spatial Hashing for Neighbor Search
// ============================================================================

function getCellKey(pos: Vector3, cellSize: number): string {
  return `${Math.floor(pos.x / cellSize)},${Math.floor(pos.y / cellSize)},${Math.floor(pos.z / cellSize)}`;
}

function buildSpatialHash(particles: SPHParticle[], cellSize: number): Map<string, number[]> {
  const hash = new Map<string, number[]>();
  for (let i = 0; i < particles.length; i++) {
    const key = getCellKey(particles[i].position, cellSize);
    if (!hash.has(key)) hash.set(key, []);
    hash.get(key)!.push(i);
  }
  return hash;
}

function getNeighborCellKeys(pos: Vector3, cellSize: number): string[] {
  const cx = Math.floor(pos.x / cellSize);
  const cy = Math.floor(pos.y / cellSize);
  const cz = Math.floor(pos.z / cellSize);
  const keys: string[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        keys.push(`${cx + dx},${cy + dy},${cz + dz}`);
  return keys;
}

function findNeighbors(particle: SPHParticle, particles: SPHParticle[], spatialHash: Map<string, number[]>, cellSize: number, h: number): number[] {
  const neighbors: number[] = [];
  const h2 = h * h;
  for (const key of getNeighborCellKeys(particle.position, cellSize)) {
    const cell = spatialHash.get(key);
    if (!cell) continue;
    for (const idx of cell) {
      if (idx === particle.id) continue;
      if (vec3LengthSq(vec3Sub(particle.position, particles[idx].position)) < h2) {
        neighbors.push(idx);
      }
    }
  }
  return neighbors;
}

// ============================================================================
// SPH Calculations
// ============================================================================

function computeDensity(state: SPHState): void {
  const { particles, config } = state;
  const h = config.smoothingRadius;
  for (const pi of particles) {
    let density = pi.mass * kernelPoly6(0, h);
    for (const j of pi.neighbors) {
      const r = vec3Length(vec3Sub(pi.position, particles[j].position));
      density += particles[j].mass * kernelPoly6(r, h);
    }
    pi.density = Math.max(density, config.restDensity * 0.1);
  }
}

function computePressure(state: SPHState): void {
  const { particles, config } = state;
  for (const p of particles) {
    p.pressure = Math.max(0, config.stiffness * (p.density - config.restDensity));
  }
}

function computePressureForces(state: SPHState): void {
  const { particles, config } = state;
  const h = config.smoothingRadius;
  for (const pi of particles) {
    if (!pi.isFluid) continue;
    let force = vec3Zero();
    for (const j of pi.neighbors) {
      const pj = particles[j];
      const rVec = vec3Sub(pi.position, pj.position);
      const r = vec3Length(rVec);
      if (r < 1e-10) continue;
      const pressureTerm = (pi.pressure / (pi.density * pi.density)) + (pj.pressure / (pj.density * pj.density));
      force = vec3Add(force, vec3Scale(gradKernelSpiky(rVec, r, h), -pi.mass * pj.mass * pressureTerm));
    }
    pi.acceleration = vec3Add(pi.acceleration, force);
  }
}

function computeViscosityForces(state: SPHState): void {
  const { particles, config } = state;
  const h = config.smoothingRadius;
  for (const pi of particles) {
    if (!pi.isFluid) continue;
    let force = vec3Zero();
    for (const j of pi.neighbors) {
      const pj = particles[j];
      const r = vec3Length(vec3Sub(pi.position, pj.position));
      const velDiff = vec3Sub(pj.velocity, pi.velocity);
      force = vec3Add(force, vec3Scale(velDiff, config.viscosity * pj.mass * laplacianKernelViscosity(r, h) / pj.density));
    }
    pi.acceleration = vec3Add(pi.acceleration, force);
  }
}

function computeSurfaceTensionForces(state: SPHState): void {
  const { particles, config } = state;
  const h = config.smoothingRadius;
  if (config.surfaceTension === 0) return;

  for (const pi of particles) {
    if (!pi.isFluid) continue;
    let colorField = pi.mass / pi.density * kernelPoly6(0, h);
    let colorGradient = vec3Zero();
    for (const j of pi.neighbors) {
      const pj = particles[j];
      if (!pj.isFluid) continue;
      const rVec = vec3Sub(pi.position, pj.position);
      const r = vec3Length(rVec);
      colorField += pj.mass / pj.density * kernelPoly6(r, h);
      colorGradient = vec3Add(colorGradient, vec3Scale(gradKernelPoly6(rVec, r, h), pj.mass / pj.density));
    }
    pi.colorField = colorField;
    pi.colorFieldGradient = colorGradient;
  }

  for (const pi of particles) {
    if (!pi.isFluid) continue;
    const gradLength = vec3Length(pi.colorFieldGradient);
    if (gradLength < config.surfaceTensionThreshold) continue;
    let colorLaplacian = pi.mass / pi.density * laplacianPoly6(0, h);
    for (const j of pi.neighbors) {
      const pj = particles[j];
      if (!pj.isFluid) continue;
      const r = vec3Length(vec3Sub(pi.position, pj.position));
      colorLaplacian += pj.mass / pj.density * laplacianPoly6(r, h);
    }
    const normal = vec3Normalize(pi.colorFieldGradient);
    pi.acceleration = vec3Add(pi.acceleration, vec3Scale(normal, -config.surfaceTension * colorLaplacian));
  }
}

function applyExternalForces(state: SPHState): void {
  for (const p of state.particles) {
    if (p.isFluid) p.acceleration = vec3Add(p.acceleration, state.config.gravity);
  }
}

function handleBoundaries(state: SPHState): void {
  const { particles, config, bounds } = state;
  const damping = config.boundaryDamping;
  for (const p of particles) {
    if (!p.isFluid) continue;
    if (p.position.x < bounds.min.x) { p.position.x = bounds.min.x; p.velocity.x *= -damping; }
    else if (p.position.x > bounds.max.x) { p.position.x = bounds.max.x; p.velocity.x *= -damping; }
    if (p.position.y < bounds.min.y) { p.position.y = bounds.min.y; p.velocity.y *= -damping; }
    else if (p.position.y > bounds.max.y) { p.position.y = bounds.max.y; p.velocity.y *= -damping; }
    if (p.position.z < bounds.min.z) { p.position.z = bounds.min.z; p.velocity.z *= -damping; }
    else if (p.position.z > bounds.max.z) { p.position.z = bounds.max.z; p.velocity.z *= -damping; }
  }
}

function integrateParticles(state: SPHState, dt: number): void {
  for (const p of state.particles) {
    if (!p.isFluid) continue;
    p.velocity = vec3Add(p.velocity, vec3Scale(p.acceleration, dt));
    p.position = vec3Add(p.position, vec3Scale(p.velocity, dt));
    p.acceleration = vec3Zero();
  }
}

// ============================================================================
// Fluid Creation
// ============================================================================

function createFluidBlock(min: Vector3, max: Vector3, spacing: number, config: FluidConfig): SPHParticle[] {
  const particles: SPHParticle[] = [];
  let id = 0;
  for (let x = min.x; x <= max.x; x += spacing) {
    for (let y = min.y; y <= max.y; y += spacing) {
      for (let z = min.z; z <= max.z; z += spacing) {
        const jitter = spacing * 0.1;
        particles.push({
          id: id++,
          position: {
            x: x + (Math.random() - 0.5) * jitter,
            y: y + (Math.random() - 0.5) * jitter,
            z: z + (Math.random() - 0.5) * jitter
          },
          velocity: vec3Zero(),
          acceleration: vec3Zero(),
          density: config.restDensity,
          pressure: 0,
          mass: config.particleMass,
          isFluid: true,
          colorField: 0,
          colorFieldGradient: vec3Zero(),
          neighbors: []
        });
      }
    }
  }
  return particles;
}

function createBoundaryParticles(bounds: { min: Vector3; max: Vector3 }, spacing: number, config: FluidConfig, startId: number): SPHParticle[] {
  const particles: SPHParticle[] = [];
  let id = startId;
  for (let x = bounds.min.x; x <= bounds.max.x; x += spacing) {
    for (let z = bounds.min.z; z <= bounds.max.z; z += spacing) {
      particles.push({
        id: id++,
        position: { x, y: bounds.min.y - spacing, z },
        velocity: vec3Zero(),
        acceleration: vec3Zero(),
        density: config.restDensity,
        pressure: 0,
        mass: config.particleMass,
        isFluid: false,
        colorField: 0,
        colorFieldGradient: vec3Zero(),
        neighbors: []
      });
    }
  }
  return particles;
}

// ============================================================================
// Simulation
// ============================================================================

function initializeSPH(fluidMin: Vector3, fluidMax: Vector3, domainMin: Vector3, domainMax: Vector3, config: FluidConfig): SPHState {
  const spacing = config.smoothingRadius * 0.5;
  const fluidParticles = createFluidBlock(fluidMin, fluidMax, spacing, config);
  const boundaryParticles = createBoundaryParticles({ min: domainMin, max: domainMax }, spacing, config, fluidParticles.length);
  return {
    particles: [...fluidParticles, ...boundaryParticles],
    time: 0,
    config,
    spatialHash: new Map(),
    cellSize: config.smoothingRadius,
    bounds: { min: domainMin, max: domainMax }
  };
}

function stepSPH(state: SPHState, dt: number): void {
  const h = state.config.smoothingRadius;
  state.spatialHash = buildSpatialHash(state.particles, state.cellSize);
  for (const p of state.particles) {
    p.neighbors = findNeighbors(p, state.particles, state.spatialHash, state.cellSize, h);
  }
  computeDensity(state);
  computePressure(state);
  for (const p of state.particles) p.acceleration = vec3Zero();
  computePressureForces(state);
  computeViscosityForces(state);
  computeSurfaceTensionForces(state);
  applyExternalForces(state);
  integrateParticles(state, dt);
  handleBoundaries(state);
  state.time += dt;
}

function simulateSPH(params: {
  fluidMin: Vector3;
  fluidMax: Vector3;
  domainMin: Vector3;
  domainMax: Vector3;
  config: Partial<FluidConfig>;
  duration: number;
  timestep: number;
}): SimulationResult {
  const defaultConfig: FluidConfig = {
    restDensity: params.config.restDensity ?? 1000,
    particleMass: params.config.particleMass ?? 0.02,
    smoothingRadius: params.config.smoothingRadius ?? 0.1,
    stiffness: params.config.stiffness ?? 1000,
    viscosity: params.config.viscosity ?? 0.1,
    surfaceTension: params.config.surfaceTension ?? 0.0728,
    surfaceTensionThreshold: params.config.surfaceTensionThreshold ?? 7.065,
    gravity: params.config.gravity ?? { x: 0, y: -GRAVITY, z: 0 },
    boundaryDamping: params.config.boundaryDamping ?? 0.3
  };

  const state = initializeSPH(params.fluidMin, params.fluidMax, params.domainMin, params.domainMax, defaultConfig);
  const dt = params.timestep || 0.001;
  const steps = Math.floor(params.duration / dt);
  const recordInterval = Math.max(1, Math.floor(1 / 30 / dt));
  const frames: SimulationResult['frames'] = [];
  let totalNeighbors = 0;

  for (let step = 0; step < steps; step++) {
    stepSPH(state, dt);
    if (step % recordInterval === 0) {
      const fluidParticles = state.particles.filter(p => p.isFluid);
      const avgDensity = fluidParticles.reduce((sum, p) => sum + p.density, 0) / fluidParticles.length;
      const maxVelocity = Math.max(...fluidParticles.map(p => vec3Length(p.velocity)));
      totalNeighbors += fluidParticles.reduce((sum, p) => sum + p.neighbors.length, 0);
      frames.push({
        time: state.time,
        particles: fluidParticles.map(p => ({
          id: p.id,
          position: { ...p.position },
          velocity: { ...p.velocity },
          density: p.density,
          pressure: p.pressure
        })),
        stats: { avgDensity, maxVelocity, particleCount: fluidParticles.length }
      });
    }
  }

  const fluidCount = state.particles.filter(p => p.isFluid).length;
  return {
    frames,
    finalState: state,
    performanceMetrics: {
      avgNeighbors: totalNeighbors / (frames.length * fluidCount) || 0,
      totalSteps: steps
    }
  };
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const sphfluidTool: UnifiedTool = {
  name: 'sph_fluid',
  description: 'Smoothed Particle Hydrodynamics (SPH) fluid simulation. Features density computation, pressure forces, viscosity forces, surface tension, boundary handling, and efficient neighbor search.',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['simulate', 'analyze', 'info'], description: 'Operation type' },
      fluidMin: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      fluidMax: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      domainMin: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      domainMax: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      config: {
        type: 'object',
        properties: {
          restDensity: { type: 'number' },
          particleMass: { type: 'number' },
          smoothingRadius: { type: 'number' },
          stiffness: { type: 'number' },
          viscosity: { type: 'number' },
          surfaceTension: { type: 'number' },
          gravity: { type: 'object' },
          boundaryDamping: { type: 'number' }
        }
      },
      duration: { type: 'number' },
      timestep: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executesphfluid(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const fluidMin = args.fluidMin || { x: 0.1, y: 0.1, z: 0.1 };
    const fluidMax = args.fluidMax || { x: 0.5, y: 0.5, z: 0.5 };
    const domainMin = args.domainMin || { x: 0, y: 0, z: 0 };
    const domainMax = args.domainMax || { x: 1, y: 1, z: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate':
        result = simulateSPH({ fluidMin, fluidMax, domainMin, domainMax, config: args.config || {}, duration: args.duration || 1, timestep: args.timestep || 0.001 });
        break;
      case 'analyze': {
        const sim = simulateSPH({ fluidMin, fluidMax, domainMin, domainMax, config: args.config || {}, duration: args.duration || 1, timestep: args.timestep || 0.001 });
        const last = sim.frames[sim.frames.length - 1];
        const fluid = sim.finalState.particles.filter(p => p.isFluid);
        const avgDensity = last.stats.avgDensity;
        const densityVar = fluid.reduce((s, p) => s + Math.pow(p.density - avgDensity, 2), 0) / fluid.length;
        result = {
          time: sim.finalState.time,
          frames: sim.frames.length,
          particles: fluid.length,
          performance: sim.performanceMetrics,
          avgDensity,
          densityStdDev: Math.sqrt(densityVar),
          maxVelocity: last.stats.maxVelocity,
          incompressibilityError: (Math.abs(avgDensity - (args.config?.restDensity || 1000)) / (args.config?.restDensity || 1000) * 100).toFixed(2) + '%'
        };
        break;
      }
      default:
        result = {
          description: 'SPH fluid simulation',
          features: ['Poly6/Spiky/Viscosity kernels', 'Spatial hashing neighbor search', 'Pressure forces', 'Viscosity forces', 'Surface tension', 'Boundary handling'],
          kernels: { poly6: 'Density', spiky: 'Pressure gradient', viscosity: 'Viscosity Laplacian' },
          equations: { density: 'ρᵢ = Σⱼ mⱼ W(rᵢⱼ, h)', pressure: 'p = k(ρ - ρ₀)', pressureForce: 'F = -Σⱼ mⱼ(pᵢ/ρᵢ² + pⱼ/ρⱼ²)∇W' },
          operations: ['simulate', 'analyze', 'info']
        };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: 'Error: ' + (e instanceof Error ? e.message : 'Unknown'), isError: true };
  }
}

export function issphfluidAvailable(): boolean { return true; }
