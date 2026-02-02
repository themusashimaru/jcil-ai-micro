/**
 * SOFT-BODY TOOL
 * Comprehensive soft body dynamics simulation
 * Features: mass-spring system, pressure-based soft body, volume conservation,
 * shape matching, collision handling, material properties, tetrahedral mesh support
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

interface Particle {
  id: number;
  position: Vector3;
  previousPosition: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  mass: number;
  isFixed: boolean;
  restPosition: Vector3; // for shape matching
}

interface Spring {
  particleA: number;
  particleB: number;
  restLength: number;
  stiffness: number;
  damping: number;
  type: 'structural' | 'shear' | 'bend' | 'pressure';
}

interface Tetrahedron {
  particles: [number, number, number, number];
  restVolume: number;
}

interface SoftBodyConfig {
  mass: number;
  stiffness: number; // 0-1
  damping: number; // 0-1
  pressure: number; // internal pressure for volume preservation
  volumeConservation: number; // 0-1
  shapeMatchingStiffness: number; // 0-1
  friction: number;
  restitution: number;
}

interface SoftBodyState {
  particles: Particle[];
  springs: Spring[];
  tetrahedra: Tetrahedron[];
  time: number;
  gravity: Vector3;
  restCenterOfMass: Vector3;
  restVolume: number;
  config: SoftBodyConfig;
}

interface CollisionPlane {
  normal: Vector3;
  distance: number;
  friction: number;
}

interface CollisionSphere {
  center: Vector3;
  radius: number;
  friction: number;
}

interface SimulationResult {
  frames: {
    time: number;
    particles: { id: number; position: Vector3; velocity: Vector3 }[];
    volume: number;
    energy: { kinetic: number; potential: number; elastic: number };
  }[];
  finalState: SoftBodyState;
  volumeConservation: number; // percentage of original volume
}

// ============================================================================
// Constants
// ============================================================================

const GRAVITY = 9.80665;
const CONSTRAINT_ITERATIONS = 10;
const COLLISION_MARGIN = 0.001;

// ============================================================================
// Vector3 Utilities
// ============================================================================

function vec3Zero(): Vector3 {
  return { x: 0, y: 0, z: 0 };
}

function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function vec3Length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3LengthSq(v: Vector3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / len);
}

function vec3Distance(a: Vector3, b: Vector3): number {
  return vec3Length(vec3Sub(a, b));
}

function vec3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

// ============================================================================
// Soft Body Creation
// ============================================================================

/**
 * Create a cube soft body
 */
function createCubeSoftBody(params: {
  center: Vector3;
  size: number;
  resolution: number; // particles per edge
  config: SoftBodyConfig;
}): SoftBodyState {
  const { center, size, resolution, config } = params;
  const n = Math.max(2, resolution);
  const spacing = size / (n - 1);
  const particleMass = config.mass / (n * n * n);
  const halfSize = size / 2;

  // Create particles in a 3D grid
  const particles: Particle[] = [];
  const particleIndex = (x: number, y: number, z: number) => x + y * n + z * n * n;

  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const position: Vector3 = {
          x: center.x - halfSize + x * spacing,
          y: center.y - halfSize + y * spacing,
          z: center.z - halfSize + z * spacing
        };

        particles.push({
          id: particleIndex(x, y, z),
          position: { ...position },
          previousPosition: { ...position },
          velocity: vec3Zero(),
          acceleration: vec3Zero(),
          mass: particleMass,
          isFixed: false,
          restPosition: { ...position }
        });
      }
    }
  }

  // Create springs
  const springs: Spring[] = [];
  const addSpring = (a: number, b: number, type: Spring['type']) => {
    const pa = particles[a];
    const pb = particles[b];
    springs.push({
      particleA: a,
      particleB: b,
      restLength: vec3Distance(pa.position, pb.position),
      stiffness: config.stiffness,
      damping: config.damping,
      type
    });
  };

  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const idx = particleIndex(x, y, z);

        // Structural springs (direct neighbors)
        if (x < n - 1) addSpring(idx, particleIndex(x + 1, y, z), 'structural');
        if (y < n - 1) addSpring(idx, particleIndex(x, y + 1, z), 'structural');
        if (z < n - 1) addSpring(idx, particleIndex(x, y, z + 1), 'structural');

        // Shear springs (face diagonals)
        if (x < n - 1 && y < n - 1) addSpring(idx, particleIndex(x + 1, y + 1, z), 'shear');
        if (x < n - 1 && z < n - 1) addSpring(idx, particleIndex(x + 1, y, z + 1), 'shear');
        if (y < n - 1 && z < n - 1) addSpring(idx, particleIndex(x, y + 1, z + 1), 'shear');

        // Bend springs (skip one neighbor)
        if (x < n - 2) addSpring(idx, particleIndex(x + 2, y, z), 'bend');
        if (y < n - 2) addSpring(idx, particleIndex(x, y + 2, z), 'bend');
        if (z < n - 2) addSpring(idx, particleIndex(x, y, z + 2), 'bend');
      }
    }
  }

  // Create tetrahedra for volume calculation
  const tetrahedra: Tetrahedron[] = [];
  for (let z = 0; z < n - 1; z++) {
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        // Each cube cell is divided into 5 tetrahedra
        const p000 = particleIndex(x, y, z);
        const p100 = particleIndex(x + 1, y, z);
        const p010 = particleIndex(x, y + 1, z);
        const p110 = particleIndex(x + 1, y + 1, z);
        const p001 = particleIndex(x, y, z + 1);
        const p101 = particleIndex(x + 1, y, z + 1);
        const p011 = particleIndex(x, y + 1, z + 1);
        const p111 = particleIndex(x + 1, y + 1, z + 1);

        // 5 tetrahedra decomposition
        const tets: [number, number, number, number][] = [
          [p000, p100, p010, p001],
          [p100, p110, p010, p111],
          [p010, p011, p001, p111],
          [p100, p101, p001, p111],
          [p001, p010, p100, p111]
        ];

        for (const tet of tets) {
          const vol = calculateTetrahedronVolume(
            particles[tet[0]].position,
            particles[tet[1]].position,
            particles[tet[2]].position,
            particles[tet[3]].position
          );
          tetrahedra.push({
            particles: tet,
            restVolume: Math.abs(vol)
          });
        }
      }
    }
  }

  const restCenterOfMass = calculateCenterOfMass(particles);
  const restVolume = calculateTotalVolume(particles, tetrahedra);

  return {
    particles,
    springs,
    tetrahedra,
    time: 0,
    gravity: { x: 0, y: -GRAVITY, z: 0 },
    restCenterOfMass,
    restVolume,
    config
  };
}

/**
 * Create a sphere soft body
 */
function createSphereSoftBody(params: {
  center: Vector3;
  radius: number;
  resolution: number;
  config: SoftBodyConfig;
}): SoftBodyState {
  const { center, radius, resolution, config } = params;
  const particles: Particle[] = [];
  const springs: Spring[] = [];

  // Create center particle
  const centerParticle: Particle = {
    id: 0,
    position: { ...center },
    previousPosition: { ...center },
    velocity: vec3Zero(),
    acceleration: vec3Zero(),
    mass: config.mass * 0.1,
    isFixed: false,
    restPosition: { ...center }
  };
  particles.push(centerParticle);

  // Create surface particles using spherical coordinates
  const latSteps = Math.max(4, resolution);
  const lonSteps = Math.max(6, resolution * 2);
  let particleId = 1;

  for (let lat = 1; lat < latSteps; lat++) {
    const theta = (lat / latSteps) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon < lonSteps; lon++) {
      const phi = (lon / lonSteps) * 2 * Math.PI;

      const position: Vector3 = {
        x: center.x + radius * sinTheta * Math.cos(phi),
        y: center.y + radius * cosTheta,
        z: center.z + radius * sinTheta * Math.sin(phi)
      };

      particles.push({
        id: particleId++,
        position: { ...position },
        previousPosition: { ...position },
        velocity: vec3Zero(),
        acceleration: vec3Zero(),
        mass: config.mass * 0.9 / (latSteps * lonSteps),
        isFixed: false,
        restPosition: { ...position }
      });
    }
  }

  // Add poles
  const northPole: Vector3 = { x: center.x, y: center.y + radius, z: center.z };
  const southPole: Vector3 = { x: center.x, y: center.y - radius, z: center.z };

  particles.push({
    id: particleId++,
    position: { ...northPole },
    previousPosition: { ...northPole },
    velocity: vec3Zero(),
    acceleration: vec3Zero(),
    mass: config.mass * 0.005,
    isFixed: false,
    restPosition: { ...northPole }
  });

  particles.push({
    id: particleId++,
    position: { ...southPole },
    previousPosition: { ...southPole },
    velocity: vec3Zero(),
    acceleration: vec3Zero(),
    mass: config.mass * 0.005,
    isFixed: false,
    restPosition: { ...southPole }
  });

  // Create springs from center to all surface particles
  for (let i = 1; i < particles.length; i++) {
    springs.push({
      particleA: 0,
      particleB: i,
      restLength: vec3Distance(particles[0].position, particles[i].position),
      stiffness: config.stiffness,
      damping: config.damping,
      type: 'structural'
    });
  }

  // Create springs between neighboring surface particles
  for (let i = 1; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dist = vec3Distance(particles[i].position, particles[j].position);
      if (dist < radius * 0.8) {
        springs.push({
          particleA: i,
          particleB: j,
          restLength: dist,
          stiffness: config.stiffness * 0.5,
          damping: config.damping,
          type: 'shear'
        });
      }
    }
  }

  // Simplified tetrahedra (just for volume estimation)
  const tetrahedra: Tetrahedron[] = [];

  const restCenterOfMass = calculateCenterOfMass(particles);
  const restVolume = (4/3) * Math.PI * radius * radius * radius;

  return {
    particles,
    springs,
    tetrahedra,
    time: 0,
    gravity: { x: 0, y: -GRAVITY, z: 0 },
    restCenterOfMass,
    restVolume,
    config
  };
}

// ============================================================================
// Volume Calculations
// ============================================================================

function calculateTetrahedronVolume(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3): number {
  const a = vec3Sub(p1, p0);
  const b = vec3Sub(p2, p0);
  const c = vec3Sub(p3, p0);
  return vec3Dot(a, vec3Cross(b, c)) / 6;
}

function calculateTotalVolume(particles: Particle[], tetrahedra: Tetrahedron[]): number {
  let volume = 0;
  for (const tet of tetrahedra) {
    volume += Math.abs(calculateTetrahedronVolume(
      particles[tet.particles[0]].position,
      particles[tet.particles[1]].position,
      particles[tet.particles[2]].position,
      particles[tet.particles[3]].position
    ));
  }
  return volume;
}

function calculateCenterOfMass(particles: Particle[]): Vector3 {
  let totalMass = 0;
  let com = vec3Zero();

  for (const p of particles) {
    totalMass += p.mass;
    com = vec3Add(com, vec3Scale(p.position, p.mass));
  }

  return totalMass > 0 ? vec3Scale(com, 1 / totalMass) : vec3Zero();
}

// ============================================================================
// Spring Forces
// ============================================================================

function applySpringForce(state: SoftBodyState, spring: Spring): void {
  const pa = state.particles[spring.particleA];
  const pb = state.particles[spring.particleB];

  const diff = vec3Sub(pb.position, pa.position);
  const currentLength = vec3Length(diff);

  if (currentLength < 1e-10) return;

  const direction = vec3Scale(diff, 1 / currentLength);

  // Spring force (Hooke's law)
  const stretch = currentLength - spring.restLength;
  const springForce = stretch * spring.stiffness;

  // Damping force
  const relativeVelocity = vec3Sub(pb.velocity, pa.velocity);
  const dampingForce = vec3Dot(relativeVelocity, direction) * spring.damping;

  const totalForce = springForce + dampingForce;
  const force = vec3Scale(direction, totalForce);

  if (!pa.isFixed) {
    pa.acceleration = vec3Add(pa.acceleration, vec3Scale(force, 1 / pa.mass));
  }
  if (!pb.isFixed) {
    pb.acceleration = vec3Sub(pb.acceleration, vec3Scale(force, 1 / pb.mass));
  }
}

// ============================================================================
// Pressure Force (Volume Conservation)
// ============================================================================

function applyPressureForce(state: SoftBodyState): void {
  if (state.config.pressure === 0 || state.tetrahedra.length === 0) return;

  const currentVolume = calculateTotalVolume(state.particles, state.tetrahedra);
  const volumeRatio = currentVolume / state.restVolume;

  // Pressure force inversely proportional to volume
  const pressureMultiplier = state.config.pressure * (1 - volumeRatio) * state.config.volumeConservation;

  // Apply pressure to surface particles (simplified - push outward from center)
  const com = calculateCenterOfMass(state.particles);

  for (const particle of state.particles) {
    if (particle.isFixed) continue;

    const toParticle = vec3Sub(particle.position, com);
    const dist = vec3Length(toParticle);

    if (dist > 1e-10) {
      const normal = vec3Scale(toParticle, 1 / dist);
      const pressureForce = vec3Scale(normal, pressureMultiplier);
      particle.acceleration = vec3Add(particle.acceleration, pressureForce);
    }
  }
}

// ============================================================================
// Shape Matching
// ============================================================================

function applyShapeMatching(state: SoftBodyState): void {
  if (state.config.shapeMatchingStiffness === 0) return;

  const currentCom = calculateCenterOfMass(state.particles);

  // Calculate optimal rotation (simplified - using polar decomposition approximation)
  // For full implementation, use SVD or iterative methods

  // Apply shape matching forces
  for (const particle of state.particles) {
    if (particle.isFixed) continue;

    // Rest position relative to rest COM
    const restRelative = vec3Sub(particle.restPosition, state.restCenterOfMass);

    // Target position
    const targetPos = vec3Add(currentCom, restRelative);

    // Move towards target
    const diff = vec3Sub(targetPos, particle.position);
    const force = vec3Scale(diff, state.config.shapeMatchingStiffness);
    particle.acceleration = vec3Add(particle.acceleration, vec3Scale(force, 1 / particle.mass));
  }
}

// ============================================================================
// Integration
// ============================================================================

function integrateParticles(state: SoftBodyState, dt: number): void {
  for (const particle of state.particles) {
    if (particle.isFixed) continue;

    // Add gravity
    particle.acceleration = vec3Add(particle.acceleration, state.gravity);

    // Verlet integration
    const newPosition = vec3Add(
      vec3Sub(vec3Scale(particle.position, 2), particle.previousPosition),
      vec3Scale(particle.acceleration, dt * dt)
    );

    // Update velocity for damping calculations
    particle.velocity = vec3Scale(vec3Sub(newPosition, particle.previousPosition), 0.5 / dt);

    // Apply damping
    const dampFactor = 1 - state.config.damping * 0.1;
    particle.velocity = vec3Scale(particle.velocity, dampFactor);

    particle.previousPosition = { ...particle.position };
    particle.position = newPosition;

    // Clear acceleration
    particle.acceleration = vec3Zero();
  }
}

// ============================================================================
// Collision Handling
// ============================================================================

function handlePlaneCollision(particle: Particle, plane: CollisionPlane, restitution: number): void {
  if (particle.isFixed) return;

  const dist = vec3Dot(particle.position, plane.normal) - plane.distance;

  if (dist < COLLISION_MARGIN) {
    // Push out of plane
    const penetration = COLLISION_MARGIN - dist;
    particle.position = vec3Add(particle.position, vec3Scale(plane.normal, penetration));

    // Reflect velocity
    const normalVel = vec3Dot(particle.velocity, plane.normal);
    if (normalVel < 0) {
      const reflection = vec3Scale(plane.normal, -normalVel * (1 + restitution));
      particle.velocity = vec3Add(particle.velocity, reflection);

      // Apply friction
      const tangentVel = vec3Sub(particle.velocity, vec3Scale(plane.normal, vec3Dot(particle.velocity, plane.normal)));
      particle.velocity = vec3Sub(particle.velocity, vec3Scale(tangentVel, plane.friction));
    }

    // Update previous position
    particle.previousPosition = vec3Sub(particle.position, particle.velocity);
  }
}

function handleSphereCollision(particle: Particle, sphere: CollisionSphere, restitution: number): void {
  if (particle.isFixed) return;

  const toParticle = vec3Sub(particle.position, sphere.center);
  const dist = vec3Length(toParticle);

  if (dist < sphere.radius + COLLISION_MARGIN) {
    const normal = dist > 1e-10 ? vec3Scale(toParticle, 1 / dist) : { x: 0, y: 1, z: 0 };
    const penetration = sphere.radius + COLLISION_MARGIN - dist;

    // Push out
    particle.position = vec3Add(particle.position, vec3Scale(normal, penetration));

    // Reflect velocity
    const normalVel = vec3Dot(particle.velocity, normal);
    if (normalVel < 0) {
      const reflection = vec3Scale(normal, -normalVel * (1 + restitution));
      particle.velocity = vec3Add(particle.velocity, reflection);

      // Apply friction
      const tangentVel = vec3Sub(particle.velocity, vec3Scale(normal, vec3Dot(particle.velocity, normal)));
      particle.velocity = vec3Sub(particle.velocity, vec3Scale(tangentVel, sphere.friction));
    }

    particle.previousPosition = vec3Sub(particle.position, particle.velocity);
  }
}

// ============================================================================
// Constraint Solving (Position-Based)
// ============================================================================

function solveDistanceConstraints(state: SoftBodyState, iterations: number): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (const spring of state.springs) {
      const pa = state.particles[spring.particleA];
      const pb = state.particles[spring.particleB];

      const diff = vec3Sub(pb.position, pa.position);
      const currentLength = vec3Length(diff);

      if (currentLength < 1e-10) continue;

      const error = currentLength - spring.restLength;
      const correction = vec3Scale(diff, error / currentLength * spring.stiffness * 0.5);

      if (!pa.isFixed) {
        pa.position = vec3Add(pa.position, correction);
      }
      if (!pb.isFixed) {
        pb.position = vec3Sub(pb.position, correction);
      }
    }
  }
}

// ============================================================================
// Energy Calculations
// ============================================================================

function calculateKineticEnergy(state: SoftBodyState): number {
  let energy = 0;
  for (const p of state.particles) {
    if (!p.isFixed) {
      energy += 0.5 * p.mass * vec3LengthSq(p.velocity);
    }
  }
  return energy;
}

function calculatePotentialEnergy(state: SoftBodyState): number {
  let energy = 0;
  const g = vec3Length(state.gravity);
  for (const p of state.particles) {
    energy += p.mass * g * p.position.y;
  }
  return energy;
}

function calculateElasticEnergy(state: SoftBodyState): number {
  let energy = 0;
  for (const spring of state.springs) {
    const pa = state.particles[spring.particleA];
    const pb = state.particles[spring.particleB];
    const currentLength = vec3Distance(pa.position, pb.position);
    const stretch = currentLength - spring.restLength;
    energy += 0.5 * spring.stiffness * stretch * stretch;
  }
  return energy;
}

// ============================================================================
// Simulation
// ============================================================================

function simulateSoftBody(params: {
  shape: 'cube' | 'sphere';
  center: Vector3;
  size?: number;
  radius?: number;
  resolution?: number;
  config: SoftBodyConfig;
  duration: number;
  timestep: number;
  collisionPlanes?: CollisionPlane[];
  collisionSpheres?: CollisionSphere[];
  gravity?: Vector3;
  initialVelocity?: Vector3;
}): SimulationResult {
  // Create soft body
  let state: SoftBodyState;
  if (params.shape === 'sphere') {
    state = createSphereSoftBody({
      center: params.center,
      radius: params.radius || 1,
      resolution: params.resolution || 8,
      config: params.config
    });
  } else {
    state = createCubeSoftBody({
      center: params.center,
      size: params.size || 1,
      resolution: params.resolution || 4,
      config: params.config
    });
  }

  if (params.gravity) state.gravity = params.gravity;

  // Apply initial velocity
  if (params.initialVelocity) {
    for (const p of state.particles) {
      p.velocity = { ...params.initialVelocity };
      p.previousPosition = vec3Sub(p.position, vec3Scale(params.initialVelocity, params.timestep));
    }
  }

  // Default collision plane (ground)
  const collisionPlanes: CollisionPlane[] = params.collisionPlanes || [
    { normal: { x: 0, y: 1, z: 0 }, distance: 0, friction: 0.3 }
  ];
  const collisionSpheres: CollisionSphere[] = params.collisionSpheres || [];

  const dt = params.timestep || 1/120;
  const steps = Math.floor(params.duration / dt);
  const recordInterval = Math.max(1, Math.floor(1/60 / dt));

  const frames: SimulationResult['frames'] = [];
  const initialVolume = state.restVolume;

  for (let step = 0; step < steps; step++) {
    // Apply forces
    for (const spring of state.springs) {
      applySpringForce(state, spring);
    }

    applyPressureForce(state);
    applyShapeMatching(state);

    // Integrate
    integrateParticles(state, dt);

    // Solve constraints
    solveDistanceConstraints(state, CONSTRAINT_ITERATIONS);

    // Handle collisions
    for (const particle of state.particles) {
      for (const plane of collisionPlanes) {
        handlePlaneCollision(particle, plane, state.config.restitution);
      }
      for (const sphere of collisionSpheres) {
        handleSphereCollision(particle, sphere, state.config.restitution);
      }
    }

    state.time += dt;

    // Record frame
    if (step % recordInterval === 0) {
      const currentVolume = state.tetrahedra.length > 0 ?
        calculateTotalVolume(state.particles, state.tetrahedra) :
        state.restVolume; // Approximate for sphere

      frames.push({
        time: state.time,
        particles: state.particles.map(p => ({
          id: p.id,
          position: { ...p.position },
          velocity: { ...p.velocity }
        })),
        volume: currentVolume,
        energy: {
          kinetic: calculateKineticEnergy(state),
          potential: calculatePotentialEnergy(state),
          elastic: calculateElasticEnergy(state)
        }
      });
    }
  }

  const finalVolume = state.tetrahedra.length > 0 ?
    calculateTotalVolume(state.particles, state.tetrahedra) :
    state.restVolume;

  return {
    frames,
    finalState: state,
    volumeConservation: (finalVolume / initialVolume) * 100
  };
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const softbodyTool: UnifiedTool = {
  name: 'soft_body',
  description: 'Comprehensive soft body dynamics simulation. Features mass-spring system, pressure-based soft body, volume conservation, shape matching, collision handling, and material properties.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'analyze', 'info'],
        description: 'Operation type'
      },
      shape: {
        type: 'string',
        enum: ['cube', 'sphere'],
        description: 'Shape of soft body'
      },
      center: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
      },
      size: { type: 'number', description: 'Size for cube shape' },
      radius: { type: 'number', description: 'Radius for sphere shape' },
      resolution: { type: 'number', description: 'Particle resolution' },
      config: {
        type: 'object',
        properties: {
          mass: { type: 'number' },
          stiffness: { type: 'number', description: '0-1' },
          damping: { type: 'number', description: '0-1' },
          pressure: { type: 'number', description: 'Internal pressure' },
          volumeConservation: { type: 'number', description: '0-1' },
          shapeMatchingStiffness: { type: 'number', description: '0-1' },
          friction: { type: 'number' },
          restitution: { type: 'number' }
        }
      },
      duration: { type: 'number', description: 'Simulation duration in seconds' },
      timestep: { type: 'number', description: 'Physics timestep' },
      gravity: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
      },
      initialVelocity: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
      },
      collisionPlanes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            normal: { type: 'object' },
            distance: { type: 'number' },
            friction: { type: 'number' }
          }
        }
      },
      collisionSpheres: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            center: { type: 'object' },
            radius: { type: 'number' },
            friction: { type: 'number' }
          }
        }
      }
    },
    required: ['operation']
  }
};

export async function executesoftbody(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    const defaultConfig: SoftBodyConfig = {
      mass: args.config?.mass || 1,
      stiffness: args.config?.stiffness || 0.8,
      damping: args.config?.damping || 0.1,
      pressure: args.config?.pressure || 1,
      volumeConservation: args.config?.volumeConservation || 0.5,
      shapeMatchingStiffness: args.config?.shapeMatchingStiffness || 0.1,
      friction: args.config?.friction || 0.3,
      restitution: args.config?.restitution || 0.3
    };

    let result: any;

    switch (operation) {
      case 'simulate': {
        result = simulateSoftBody({
          shape: args.shape || 'cube',
          center: args.center || { x: 0, y: 2, z: 0 },
          size: args.size,
          radius: args.radius,
          resolution: args.resolution,
          config: defaultConfig,
          duration: args.duration || 3,
          timestep: args.timestep || 1/120,
          collisionPlanes: args.collisionPlanes,
          collisionSpheres: args.collisionSpheres,
          gravity: args.gravity,
          initialVelocity: args.initialVelocity
        });
        break;
      }

      case 'analyze': {
        const simResult = simulateSoftBody({
          shape: args.shape || 'cube',
          center: args.center || { x: 0, y: 2, z: 0 },
          size: args.size,
          radius: args.radius,
          resolution: args.resolution,
          config: defaultConfig,
          duration: args.duration || 3,
          timestep: args.timestep || 1/120,
          gravity: args.gravity,
          initialVelocity: args.initialVelocity
        });

        const finalFrame = simResult.frames[simResult.frames.length - 1];
        const initialFrame = simResult.frames[0];

        result = {
          simulationTime: simResult.finalState.time,
          frameCount: simResult.frames.length,
          particleCount: simResult.finalState.particles.length,
          springCount: simResult.finalState.springs.length,
          volumeConservation: simResult.volumeConservation.toFixed(2) + '%',
          initialVolume: initialFrame?.volume || 0,
          finalVolume: finalFrame?.volume || 0,
          energy: {
            initial: initialFrame?.energy,
            final: finalFrame?.energy
          },
          centerOfMass: calculateCenterOfMass(simResult.finalState.particles),
          isAtRest: (finalFrame?.energy.kinetic || 0) < 0.001
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: 'Soft body dynamics simulation',
          features: [
            'Mass-spring system',
            'Pressure-based volume preservation',
            'Shape matching',
            'Verlet integration',
            'Position-based constraint solving',
            'Plane and sphere collision',
            'Cube and sphere shapes',
            'Tetrahedral mesh for volume calculation',
            'Energy tracking'
          ],
          springTypes: {
            structural: 'Direct neighbor connections',
            shear: 'Diagonal connections for rigidity',
            bend: 'Skip-one connections for bending resistance'
          },
          defaultConfig,
          constants: {
            GRAVITY,
            CONSTRAINT_ITERATIONS
          },
          operations: ['simulate', 'analyze', 'info']
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issoftbodyAvailable(): boolean { return true; }
