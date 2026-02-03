/**
 * CLOTH-SIMULATION TOOL
 * Comprehensive cloth physics simulation using mass-spring systems
 * Features: structural/shear/bend springs, wind forces, self-collision,
 * fixed constraints, tearing simulation, multiple integration methods
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// Vector Math Utilities
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
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

function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / len);
}

function vec3Distance(a: Vector3, b: Vector3): number {
  return vec3Length(vec3Sub(a, b));
}

// ============================================================================
// Cloth Particle
// ============================================================================

interface ClothParticle {
  position: Vector3;
  previousPosition: Vector3;  // For Verlet integration
  velocity: Vector3;
  acceleration: Vector3;
  mass: number;
  invMass: number;  // 0 for fixed particles
  isFixed: boolean;
  gridX: number;  // Grid position for indexing
  gridY: number;
}

// ============================================================================
// Spring Types
// ============================================================================

type SpringType = 'structural' | 'shear' | 'bend';

interface Spring {
  particleA: number;  // Index
  particleB: number;  // Index
  restLength: number;
  stiffness: number;
  damping: number;
  type: SpringType;
  isBroken: boolean;
  maxStretch: number;  // For tearing (ratio of rest length)
  currentStretch: number;  // Current stretch ratio
}

// ============================================================================
// Cloth Configuration
// ============================================================================

interface ClothConfig {
  width: number;           // Grid width (number of particles)
  height: number;          // Grid height (number of particles)
  particleMass: number;    // Mass per particle
  spacing: number;         // Rest distance between adjacent particles

  // Spring stiffnesses
  structuralStiffness: number;
  shearStiffness: number;
  bendStiffness: number;

  // Damping coefficients
  structuralDamping: number;
  shearDamping: number;
  bendDamping: number;

  // Global damping (air resistance)
  airDamping: number;

  // Tearing parameters
  tearingEnabled: boolean;
  tearThreshold: number;  // Stretch ratio at which springs break

  // Integration
  integrationMethod: 'euler' | 'verlet' | 'rk4';
  constraintIterations: number;  // For Verlet position correction

  // Self-collision
  selfCollisionEnabled: boolean;
  collisionRadius: number;
  collisionStiffness: number;

  // External forces
  gravity: Vector3;
  wind: Vector3;
  windVariance: number;  // Random wind variation
}

// ============================================================================
// Collision Objects
// ============================================================================

interface CollisionSphere {
  type: 'sphere';
  center: Vector3;
  radius: number;
  friction: number;
}

interface CollisionPlane {
  type: 'plane';
  point: Vector3;
  normal: Vector3;
  friction: number;
}

interface CollisionBox {
  type: 'box';
  min: Vector3;
  max: Vector3;
  friction: number;
}

type CollisionObject = CollisionSphere | CollisionPlane | CollisionBox;

// ============================================================================
// Cloth State
// ============================================================================

interface ClothState {
  particles: ClothParticle[];
  springs: Spring[];
  config: ClothConfig;
  collisionObjects: CollisionObject[];
  time: number;
  frame: number;
  brokenSprings: number;
  totalEnergy: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): ClothConfig {
  return {
    width: 20,
    height: 20,
    particleMass: 0.1,
    spacing: 0.1,

    structuralStiffness: 1000,
    shearStiffness: 500,
    bendStiffness: 200,

    structuralDamping: 0.5,
    shearDamping: 0.3,
    bendDamping: 0.2,

    airDamping: 0.02,

    tearingEnabled: false,
    tearThreshold: 2.0,

    integrationMethod: 'verlet',
    constraintIterations: 3,

    selfCollisionEnabled: false,
    collisionRadius: 0.02,
    collisionStiffness: 500,

    gravity: vec3(0, -9.81, 0),
    wind: vec3(0, 0, 0),
    windVariance: 0
  };
}

// ============================================================================
// Cloth Initialization
// ============================================================================

function createCloth(config: ClothConfig, fixedPoints?: { x: number; y: number }[]): ClothState {
  const particles: ClothParticle[] = [];
  const springs: Spring[] = [];

  // Create fixed points set for quick lookup
  const fixedSet = new Set<string>();
  if (fixedPoints) {
    for (const fp of fixedPoints) {
      fixedSet.add(`${fp.x},${fp.y}`);
    }
  } else {
    // Default: fix top row
    for (let x = 0; x < config.width; x++) {
      fixedSet.add(`${x},0`);
    }
  }

  // Create particles in a grid
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      const isFixed = fixedSet.has(`${x},${y}`);
      const position = vec3(
        x * config.spacing,
        -y * config.spacing,  // Hang downward
        0
      );

      particles.push({
        position: { ...position },
        previousPosition: { ...position },
        velocity: vec3(0, 0, 0),
        acceleration: vec3(0, 0, 0),
        mass: config.particleMass,
        invMass: isFixed ? 0 : 1 / config.particleMass,
        isFixed,
        gridX: x,
        gridY: y
      });
    }
  }

  // Helper to get particle index
  const getIndex = (x: number, y: number): number => y * config.width + x;

  // Create structural springs (horizontal and vertical)
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      const idx = getIndex(x, y);

      // Horizontal spring
      if (x < config.width - 1) {
        springs.push(createSpring(
          idx, getIndex(x + 1, y),
          config.spacing,
          config.structuralStiffness,
          config.structuralDamping,
          'structural',
          config.tearThreshold
        ));
      }

      // Vertical spring
      if (y < config.height - 1) {
        springs.push(createSpring(
          idx, getIndex(x, y + 1),
          config.spacing,
          config.structuralStiffness,
          config.structuralDamping,
          'structural',
          config.tearThreshold
        ));
      }
    }
  }

  // Create shear springs (diagonals)
  const diagonalLength = config.spacing * Math.SQRT2;
  for (let y = 0; y < config.height - 1; y++) {
    for (let x = 0; x < config.width - 1; x++) {
      const idx = getIndex(x, y);

      // Diagonal \
      springs.push(createSpring(
        idx, getIndex(x + 1, y + 1),
        diagonalLength,
        config.shearStiffness,
        config.shearDamping,
        'shear',
        config.tearThreshold
      ));

      // Diagonal /
      springs.push(createSpring(
        getIndex(x + 1, y), getIndex(x, y + 1),
        diagonalLength,
        config.shearStiffness,
        config.shearDamping,
        'shear',
        config.tearThreshold
      ));
    }
  }

  // Create bend springs (skip one particle)
  const bendLength = config.spacing * 2;
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      const idx = getIndex(x, y);

      // Horizontal bend spring
      if (x < config.width - 2) {
        springs.push(createSpring(
          idx, getIndex(x + 2, y),
          bendLength,
          config.bendStiffness,
          config.bendDamping,
          'bend',
          config.tearThreshold
        ));
      }

      // Vertical bend spring
      if (y < config.height - 2) {
        springs.push(createSpring(
          idx, getIndex(x, y + 2),
          bendLength,
          config.bendStiffness,
          config.bendDamping,
          'bend',
          config.tearThreshold
        ));
      }
    }
  }

  return {
    particles,
    springs,
    config,
    collisionObjects: [],
    time: 0,
    frame: 0,
    brokenSprings: 0,
    totalEnergy: 0
  };
}

function createSpring(
  particleA: number,
  particleB: number,
  restLength: number,
  stiffness: number,
  damping: number,
  type: SpringType,
  maxStretch: number
): Spring {
  return {
    particleA,
    particleB,
    restLength,
    stiffness,
    damping,
    type,
    isBroken: false,
    maxStretch,
    currentStretch: 1
  };
}

// ============================================================================
// Force Calculations
// ============================================================================

function calculateSpringForce(
  spring: Spring,
  particles: ClothParticle[]
): { forceA: Vector3; forceB: Vector3 } {
  if (spring.isBroken) {
    return { forceA: vec3(0, 0, 0), forceB: vec3(0, 0, 0) };
  }

  const pA = particles[spring.particleA];
  const pB = particles[spring.particleB];

  const delta = vec3Sub(pB.position, pA.position);
  const distance = vec3Length(delta);

  if (distance < 1e-10) {
    return { forceA: vec3(0, 0, 0), forceB: vec3(0, 0, 0) };
  }

  // Update stretch ratio
  spring.currentStretch = distance / spring.restLength;

  // Hooke's law: F = -k * (x - x0)
  const displacement = distance - spring.restLength;
  const direction = vec3Scale(delta, 1 / distance);

  // Spring force
  const springMagnitude = spring.stiffness * displacement;

  // Damping force (velocity along spring direction)
  const relativeVelocity = vec3Sub(pB.velocity, pA.velocity);
  const dampingMagnitude = spring.damping * vec3Dot(relativeVelocity, direction);

  const totalMagnitude = springMagnitude + dampingMagnitude;
  const force = vec3Scale(direction, totalMagnitude);

  return {
    forceA: force,
    forceB: vec3Scale(force, -1)
  };
}

function calculateWindForce(
  particles: ClothParticle[],
  config: ClothConfig,
  p0Idx: number,
  p1Idx: number,
  p2Idx: number
): Vector3 {
  // Calculate wind force on a triangle face
  const p0 = particles[p0Idx].position;
  const p1 = particles[p1Idx].position;
  const p2 = particles[p2Idx].position;

  // Triangle edges
  const e1 = vec3Sub(p1, p0);
  const e2 = vec3Sub(p2, p0);

  // Face normal (not normalized for area calculation)
  const normal = vec3Cross(e1, e2);
  const area = vec3Length(normal) * 0.5;

  if (area < 1e-10) {
    return vec3(0, 0, 0);
  }

  const normalizedNormal = vec3Normalize(normal);

  // Add wind variance
  let wind = { ...config.wind };
  if (config.windVariance > 0) {
    wind = vec3Add(wind, vec3(
      (Math.random() - 0.5) * config.windVariance,
      (Math.random() - 0.5) * config.windVariance,
      (Math.random() - 0.5) * config.windVariance
    ));
  }

  // Wind force proportional to projected area
  const windSpeed = vec3Length(wind);
  if (windSpeed < 1e-10) {
    return vec3(0, 0, 0);
  }

  const windDir = vec3Normalize(wind);
  const projection = Math.abs(vec3Dot(normalizedNormal, windDir));

  // Force = 0.5 * rho * v^2 * Cd * A * cos(theta)
  // Simplified: force = windSpeed^2 * area * projection
  const forceMagnitude = windSpeed * windSpeed * area * projection * 0.5;

  // Force in wind direction
  return vec3Scale(windDir, forceMagnitude);
}

// ============================================================================
// Integration Methods
// ============================================================================

function integrateEuler(state: ClothState, dt: number): void {
  const { particles, springs, config } = state;

  // Reset accelerations
  for (const particle of particles) {
    if (particle.isFixed) continue;
    particle.acceleration = { ...config.gravity };
  }

  // Apply spring forces
  for (const spring of springs) {
    if (spring.isBroken) continue;

    const { forceA, forceB } = calculateSpringForce(spring, particles);
    const pA = particles[spring.particleA];
    const pB = particles[spring.particleB];

    if (!pA.isFixed) {
      pA.acceleration = vec3Add(pA.acceleration, vec3Scale(forceA, pA.invMass));
    }
    if (!pB.isFixed) {
      pB.acceleration = vec3Add(pB.acceleration, vec3Scale(forceB, pB.invMass));
    }
  }

  // Apply air damping
  for (const particle of particles) {
    if (particle.isFixed) continue;
    const dampingForce = vec3Scale(particle.velocity, -config.airDamping);
    particle.acceleration = vec3Add(particle.acceleration, dampingForce);
  }

  // Apply wind forces (on triangular faces)
  applyWindForces(state);

  // Euler integration
  for (const particle of particles) {
    if (particle.isFixed) continue;

    particle.velocity = vec3Add(particle.velocity, vec3Scale(particle.acceleration, dt));
    particle.position = vec3Add(particle.position, vec3Scale(particle.velocity, dt));
  }
}

function integrateVerlet(state: ClothState, dt: number): void {
  const { particles, config } = state;

  // Verlet integration: x(t+dt) = 2*x(t) - x(t-dt) + a*dt^2
  for (const particle of particles) {
    if (particle.isFixed) continue;

    // Calculate acceleration from gravity
    let acceleration = { ...config.gravity };

    // Air damping (applied to velocity)
    const velocity = vec3Sub(particle.position, particle.previousPosition);
    acceleration = vec3Add(acceleration, vec3Scale(velocity, -config.airDamping / dt));

    const newPosition = vec3Add(
      vec3Sub(vec3Scale(particle.position, 2), particle.previousPosition),
      vec3Scale(acceleration, dt * dt)
    );

    particle.previousPosition = { ...particle.position };
    particle.position = newPosition;
    particle.velocity = vec3Scale(vec3Sub(particle.position, particle.previousPosition), 1 / dt);
  }

  // Apply wind forces
  applyWindForcesVerlet(state, dt);

  // Satisfy constraints iteratively
  for (let iter = 0; iter < config.constraintIterations; iter++) {
    satisfySpringConstraints(state);
  }
}

function satisfySpringConstraints(state: ClothState): void {
  const { particles, springs, config } = state;

  for (const spring of springs) {
    if (spring.isBroken) continue;

    const pA = particles[spring.particleA];
    const pB = particles[spring.particleB];

    const delta = vec3Sub(pB.position, pA.position);
    const distance = vec3Length(delta);

    if (distance < 1e-10) continue;

    // Check for tearing
    spring.currentStretch = distance / spring.restLength;
    if (config.tearingEnabled && spring.currentStretch > spring.maxStretch) {
      spring.isBroken = true;
      state.brokenSprings++;
      continue;
    }

    // Position correction
    const correction = (distance - spring.restLength) / distance;
    const correctionVector = vec3Scale(delta, correction * 0.5);

    const totalInvMass = pA.invMass + pB.invMass;
    if (totalInvMass < 1e-10) continue;

    const ratioA = pA.invMass / totalInvMass;
    const ratioB = pB.invMass / totalInvMass;

    if (!pA.isFixed) {
      pA.position = vec3Add(pA.position, vec3Scale(correctionVector, ratioA));
    }
    if (!pB.isFixed) {
      pB.position = vec3Sub(pB.position, vec3Scale(correctionVector, ratioB));
    }
  }
}

function integrateRK4(state: ClothState, dt: number): void {
  const { particles } = state;

  // Store initial state
  const initialPositions: Vector3[] = [];
  const initialVelocities: Vector3[] = [];

  for (const particle of particles) {
    initialPositions.push({ ...particle.position });
    initialVelocities.push({ ...particle.velocity });
  }

  // k1
  const k1 = computeDerivatives(state);

  // k2 (at t + dt/2, using k1/2)
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isFixed) continue;
    particles[i].position = vec3Add(initialPositions[i], vec3Scale(k1.velocities[i], dt / 2));
    particles[i].velocity = vec3Add(initialVelocities[i], vec3Scale(k1.accelerations[i], dt / 2));
  }
  const k2 = computeDerivatives(state);

  // k3 (at t + dt/2, using k2/2)
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isFixed) continue;
    particles[i].position = vec3Add(initialPositions[i], vec3Scale(k2.velocities[i], dt / 2));
    particles[i].velocity = vec3Add(initialVelocities[i], vec3Scale(k2.accelerations[i], dt / 2));
  }
  const k3 = computeDerivatives(state);

  // k4 (at t + dt, using k3)
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isFixed) continue;
    particles[i].position = vec3Add(initialPositions[i], vec3Scale(k3.velocities[i], dt));
    particles[i].velocity = vec3Add(initialVelocities[i], vec3Scale(k3.accelerations[i], dt));
  }
  const k4 = computeDerivatives(state);

  // Final integration
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isFixed) continue;

    // x(t+dt) = x(t) + (k1 + 2*k2 + 2*k3 + k4) * dt / 6
    const dv = vec3Add(
      vec3Add(k1.velocities[i], vec3Scale(k2.velocities[i], 2)),
      vec3Add(vec3Scale(k3.velocities[i], 2), k4.velocities[i])
    );
    const da = vec3Add(
      vec3Add(k1.accelerations[i], vec3Scale(k2.accelerations[i], 2)),
      vec3Add(vec3Scale(k3.accelerations[i], 2), k4.accelerations[i])
    );

    particles[i].position = vec3Add(initialPositions[i], vec3Scale(dv, dt / 6));
    particles[i].velocity = vec3Add(initialVelocities[i], vec3Scale(da, dt / 6));
    particles[i].previousPosition = initialPositions[i];
  }
}

function computeDerivatives(state: ClothState): { velocities: Vector3[]; accelerations: Vector3[] } {
  const { particles, springs, config } = state;
  const velocities: Vector3[] = [];
  const accelerations: Vector3[] = [];

  // Initialize with gravity
  for (const particle of particles) {
    velocities.push({ ...particle.velocity });
    if (particle.isFixed) {
      accelerations.push(vec3(0, 0, 0));
    } else {
      accelerations.push({ ...config.gravity });
    }
  }

  // Add spring forces
  for (const spring of springs) {
    if (spring.isBroken) continue;

    const { forceA, forceB } = calculateSpringForce(spring, particles);

    if (!particles[spring.particleA].isFixed) {
      const accel = vec3Scale(forceA, particles[spring.particleA].invMass);
      accelerations[spring.particleA] = vec3Add(accelerations[spring.particleA], accel);
    }
    if (!particles[spring.particleB].isFixed) {
      const accel = vec3Scale(forceB, particles[spring.particleB].invMass);
      accelerations[spring.particleB] = vec3Add(accelerations[spring.particleB], accel);
    }
  }

  // Add air damping
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isFixed) continue;
    const damping = vec3Scale(particles[i].velocity, -config.airDamping);
    accelerations[i] = vec3Add(accelerations[i], damping);
  }

  return { velocities, accelerations };
}

// ============================================================================
// Wind Force Application
// ============================================================================

function applyWindForces(state: ClothState): void {
  const { particles, config } = state;
  const width = config.width;
  const height = config.height;

  // Apply wind to each triangular face
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i0 = y * width + x;
      const i1 = i0 + 1;
      const i2 = i0 + width;
      const i3 = i2 + 1;

      // First triangle
      const force1 = calculateWindForce(particles, config, i0, i1, i2);
      const forcePerParticle1 = vec3Scale(force1, 1 / 3);

      // Second triangle
      const force2 = calculateWindForce(particles, config, i1, i3, i2);
      const forcePerParticle2 = vec3Scale(force2, 1 / 3);

      // Apply to particles
      if (!particles[i0].isFixed) {
        particles[i0].acceleration = vec3Add(
          particles[i0].acceleration,
          vec3Scale(forcePerParticle1, particles[i0].invMass)
        );
      }
      if (!particles[i1].isFixed) {
        const totalForce = vec3Add(forcePerParticle1, forcePerParticle2);
        particles[i1].acceleration = vec3Add(
          particles[i1].acceleration,
          vec3Scale(totalForce, particles[i1].invMass)
        );
      }
      if (!particles[i2].isFixed) {
        const totalForce = vec3Add(forcePerParticle1, forcePerParticle2);
        particles[i2].acceleration = vec3Add(
          particles[i2].acceleration,
          vec3Scale(totalForce, particles[i2].invMass)
        );
      }
      if (!particles[i3].isFixed) {
        particles[i3].acceleration = vec3Add(
          particles[i3].acceleration,
          vec3Scale(forcePerParticle2, particles[i3].invMass)
        );
      }
    }
  }
}

function applyWindForcesVerlet(state: ClothState, dt: number): void {
  const { particles, config } = state;
  const width = config.width;
  const height = config.height;

  // Apply wind to each triangular face
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i0 = y * width + x;
      const i1 = i0 + 1;
      const i2 = i0 + width;
      const i3 = i2 + 1;

      // First triangle
      const force1 = calculateWindForce(particles, config, i0, i1, i2);
      const forcePerParticle1 = vec3Scale(force1, 1 / 3);

      // Second triangle
      const force2 = calculateWindForce(particles, config, i1, i3, i2);
      const forcePerParticle2 = vec3Scale(force2, 1 / 3);

      // Apply as position offset for Verlet
      if (!particles[i0].isFixed) {
        const offset = vec3Scale(forcePerParticle1, particles[i0].invMass * dt * dt);
        particles[i0].position = vec3Add(particles[i0].position, offset);
      }
      if (!particles[i1].isFixed) {
        const totalForce = vec3Add(forcePerParticle1, forcePerParticle2);
        const offset = vec3Scale(totalForce, particles[i1].invMass * dt * dt);
        particles[i1].position = vec3Add(particles[i1].position, offset);
      }
      if (!particles[i2].isFixed) {
        const totalForce = vec3Add(forcePerParticle1, forcePerParticle2);
        const offset = vec3Scale(totalForce, particles[i2].invMass * dt * dt);
        particles[i2].position = vec3Add(particles[i2].position, offset);
      }
      if (!particles[i3].isFixed) {
        const offset = vec3Scale(forcePerParticle2, particles[i3].invMass * dt * dt);
        particles[i3].position = vec3Add(particles[i3].position, offset);
      }
    }
  }
}

// ============================================================================
// Collision Detection and Response
// ============================================================================

function handleCollisions(state: ClothState): void {
  const { particles, collisionObjects, config } = state;

  for (const particle of particles) {
    if (particle.isFixed) continue;

    for (const obj of collisionObjects) {
      switch (obj.type) {
        case 'sphere':
          handleSphereCollision(particle, obj);
          break;
        case 'plane':
          handlePlaneCollision(particle, obj);
          break;
        case 'box':
          handleBoxCollision(particle, obj);
          break;
      }
    }
  }

  // Self-collision
  if (config.selfCollisionEnabled) {
    handleSelfCollision(state);
  }
}

function handleSphereCollision(particle: ClothParticle, sphere: CollisionSphere): void {
  const toParticle = vec3Sub(particle.position, sphere.center);
  const distance = vec3Length(toParticle);

  if (distance < sphere.radius) {
    // Push particle out
    const normal = vec3Normalize(toParticle);
    particle.position = vec3Add(sphere.center, vec3Scale(normal, sphere.radius));

    // Apply friction
    const velocityNormal = vec3Scale(normal, vec3Dot(particle.velocity, normal));
    const velocityTangent = vec3Sub(particle.velocity, velocityNormal);
    particle.velocity = vec3Scale(velocityTangent, 1 - sphere.friction);
  }
}

function handlePlaneCollision(particle: ClothParticle, plane: CollisionPlane): void {
  const toParticle = vec3Sub(particle.position, plane.point);
  const distance = vec3Dot(toParticle, plane.normal);

  if (distance < 0) {
    // Push particle above plane
    particle.position = vec3Sub(particle.position, vec3Scale(plane.normal, distance));

    // Apply friction
    const velocityNormal = vec3Scale(plane.normal, vec3Dot(particle.velocity, plane.normal));
    const velocityTangent = vec3Sub(particle.velocity, velocityNormal);

    // Reflect normal component, dampen tangent
    particle.velocity = vec3Sub(
      vec3Scale(velocityTangent, 1 - plane.friction),
      vec3Scale(velocityNormal, 0.1)  // Small bounce
    );
  }
}

function handleBoxCollision(particle: ClothParticle, box: CollisionBox): void {
  const pos = particle.position;

  // Check if inside box
  if (pos.x >= box.min.x && pos.x <= box.max.x &&
      pos.y >= box.min.y && pos.y <= box.max.y &&
      pos.z >= box.min.z && pos.z <= box.max.z) {

    // Find closest face
    const distances = [
      pos.x - box.min.x,  // Left
      box.max.x - pos.x,  // Right
      pos.y - box.min.y,  // Bottom
      box.max.y - pos.y,  // Top
      pos.z - box.min.z,  // Back
      box.max.z - pos.z   // Front
    ];

    const normals: Vector3[] = [
      vec3(-1, 0, 0), vec3(1, 0, 0),
      vec3(0, -1, 0), vec3(0, 1, 0),
      vec3(0, 0, -1), vec3(0, 0, 1)
    ];

    let minDist = distances[0];
    let minIdx = 0;
    for (let i = 1; i < 6; i++) {
      if (distances[i] < minDist) {
        minDist = distances[i];
        minIdx = i;
      }
    }

    // Push out through closest face
    particle.position = vec3Add(particle.position, vec3Scale(normals[minIdx], minDist));

    // Apply friction
    const normal = normals[minIdx];
    const velocityNormal = vec3Scale(normal, vec3Dot(particle.velocity, normal));
    const velocityTangent = vec3Sub(particle.velocity, velocityNormal);
    particle.velocity = vec3Scale(velocityTangent, 1 - box.friction);
  }
}

function handleSelfCollision(state: ClothState): void {
  const { particles, config } = state;
  const radius = config.collisionRadius;

  // Spatial hashing for efficiency
  const cellSize = radius * 2;
  const cells: Map<string, number[]> = new Map();

  // Hash particles into cells
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i].position;
    const cellX = Math.floor(p.x / cellSize);
    const cellY = Math.floor(p.y / cellSize);
    const cellZ = Math.floor(p.z / cellSize);
    const key = `${cellX},${cellY},${cellZ}`;

    if (!cells.has(key)) {
      cells.set(key, []);
    }
    cells.get(key)!.push(i);
  }

  // Check collisions within and between neighboring cells
  for (const [key, indices] of cells) {
    const [cx, cy, cz] = key.split(',').map(Number);

    // Get all particles in neighboring cells
    const neighbors: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`;
          if (cells.has(neighborKey)) {
            neighbors.push(...cells.get(neighborKey)!);
          }
        }
      }
    }

    // Check collisions
    for (const i of indices) {
      for (const j of neighbors) {
        if (j <= i) continue;  // Avoid duplicate checks

        // Skip adjacent particles (connected by springs)
        const pI = particles[i];
        const pJ = particles[j];
        if (Math.abs(pI.gridX - pJ.gridX) <= 1 && Math.abs(pI.gridY - pJ.gridY) <= 1) {
          continue;
        }

        const delta = vec3Sub(pJ.position, pI.position);
        const distance = vec3Length(delta);

        if (distance < radius * 2 && distance > 1e-10) {
          // Push particles apart
          const correction = (radius * 2 - distance) * 0.5;
          const normal = vec3Scale(delta, 1 / distance);
          const correctionVec = vec3Scale(normal, correction);

          const totalInvMass = pI.invMass + pJ.invMass;
          if (totalInvMass > 0) {
            if (!pI.isFixed) {
              pI.position = vec3Sub(pI.position, vec3Scale(correctionVec, pI.invMass / totalInvMass));
            }
            if (!pJ.isFixed) {
              pJ.position = vec3Add(pJ.position, vec3Scale(correctionVec, pJ.invMass / totalInvMass));
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// Simulation Step
// ============================================================================

function simulateStep(state: ClothState, dt: number): void {
  const { config } = state;

  // Integration
  switch (config.integrationMethod) {
    case 'euler':
      integrateEuler(state, dt);
      break;
    case 'verlet':
      integrateVerlet(state, dt);
      break;
    case 'rk4':
      integrateRK4(state, dt);
      break;
  }

  // Handle collisions
  handleCollisions(state);

  // Check for tearing (for non-Verlet methods)
  if (config.tearingEnabled && config.integrationMethod !== 'verlet') {
    checkTearing(state);
  }

  // Update state
  state.time += dt;
  state.frame++;

  // Calculate total energy
  calculateEnergy(state);
}

function checkTearing(state: ClothState): void {
  const { springs, particles, config } = state;

  for (const spring of springs) {
    if (spring.isBroken) continue;

    const pA = particles[spring.particleA];
    const pB = particles[spring.particleB];
    const distance = vec3Distance(pA.position, pB.position);

    spring.currentStretch = distance / spring.restLength;

    if (spring.currentStretch > config.tearThreshold) {
      spring.isBroken = true;
      state.brokenSprings++;
    }
  }
}

function calculateEnergy(state: ClothState): void {
  const { particles, springs, config } = state;
  let kinetic = 0;
  let potential = 0;
  let elastic = 0;

  for (const particle of particles) {
    // Kinetic energy: 0.5 * m * v^2
    const speed = vec3Length(particle.velocity);
    kinetic += 0.5 * particle.mass * speed * speed;

    // Gravitational potential energy: m * g * h
    potential += particle.mass * Math.abs(config.gravity.y) * particle.position.y;
  }

  for (const spring of springs) {
    if (spring.isBroken) continue;

    const pA = particles[spring.particleA];
    const pB = particles[spring.particleB];
    const distance = vec3Distance(pA.position, pB.position);
    const stretch = distance - spring.restLength;

    // Elastic potential energy: 0.5 * k * x^2
    elastic += 0.5 * spring.stiffness * stretch * stretch;
  }

  state.totalEnergy = kinetic + potential + elastic;
}

// ============================================================================
// Analysis Functions
// ============================================================================

interface ClothAnalysis {
  dimensions: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  centerOfMass: Vector3;
  totalMass: number;
  averageVelocity: Vector3;
  maxVelocity: number;
  kineticEnergy: number;
  potentialEnergy: number;
  elasticEnergy: number;
  totalEnergy: number;
  brokenSprings: number;
  totalSprings: number;
  tearPercentage: number;
  springStress: {
    structural: { avg: number; max: number };
    shear: { avg: number; max: number };
    bend: { avg: number; max: number };
  };
  fixedParticles: number;
  freeParticles: number;
}

function analyzeCloth(state: ClothState): ClothAnalysis {
  const { particles, springs, config } = state;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  let comX = 0, comY = 0, comZ = 0;
  let totalMass = 0;
  let avgVel = vec3(0, 0, 0);
  let maxVel = 0;
  let kinetic = 0;
  let potential = 0;
  let fixedCount = 0;

  for (const p of particles) {
    minX = Math.min(minX, p.position.x);
    maxX = Math.max(maxX, p.position.x);
    minY = Math.min(minY, p.position.y);
    maxY = Math.max(maxY, p.position.y);
    minZ = Math.min(minZ, p.position.z);
    maxZ = Math.max(maxZ, p.position.z);

    comX += p.position.x * p.mass;
    comY += p.position.y * p.mass;
    comZ += p.position.z * p.mass;
    totalMass += p.mass;

    avgVel = vec3Add(avgVel, p.velocity);
    maxVel = Math.max(maxVel, vec3Length(p.velocity));

    kinetic += 0.5 * p.mass * vec3Dot(p.velocity, p.velocity);
    potential += p.mass * Math.abs(config.gravity.y) * p.position.y;

    if (p.isFixed) fixedCount++;
  }

  // Calculate spring stress
  const stressStats = {
    structural: { sum: 0, count: 0, max: 0 },
    shear: { sum: 0, count: 0, max: 0 },
    bend: { sum: 0, count: 0, max: 0 }
  };

  let elastic = 0;
  let brokenCount = 0;

  for (const s of springs) {
    if (s.isBroken) {
      brokenCount++;
      continue;
    }

    const pA = particles[s.particleA];
    const pB = particles[s.particleB];
    const distance = vec3Distance(pA.position, pB.position);
    const stretch = distance - s.restLength;
    const stretchRatio = Math.abs(stretch / s.restLength);

    elastic += 0.5 * s.stiffness * stretch * stretch;

    const stats = stressStats[s.type];
    stats.sum += stretchRatio;
    stats.count++;
    stats.max = Math.max(stats.max, stretchRatio);
  }

  return {
    dimensions: { minX, maxX, minY, maxY, minZ, maxZ },
    centerOfMass: vec3(comX / totalMass, comY / totalMass, comZ / totalMass),
    totalMass,
    averageVelocity: vec3Scale(avgVel, 1 / particles.length),
    maxVelocity: maxVel,
    kineticEnergy: kinetic,
    potentialEnergy: potential,
    elasticEnergy: elastic,
    totalEnergy: kinetic + potential + elastic,
    brokenSprings: brokenCount,
    totalSprings: springs.length,
    tearPercentage: (brokenCount / springs.length) * 100,
    springStress: {
      structural: {
        avg: stressStats.structural.count > 0 ? stressStats.structural.sum / stressStats.structural.count : 0,
        max: stressStats.structural.max
      },
      shear: {
        avg: stressStats.shear.count > 0 ? stressStats.shear.sum / stressStats.shear.count : 0,
        max: stressStats.shear.max
      },
      bend: {
        avg: stressStats.bend.count > 0 ? stressStats.bend.sum / stressStats.bend.count : 0,
        max: stressStats.bend.max
      }
    },
    fixedParticles: fixedCount,
    freeParticles: particles.length - fixedCount
  };
}

// ============================================================================
// Tool Definition
// ============================================================================

export const clothsimulationTool: UnifiedTool = {
  name: 'cloth_simulation',
  description: `Comprehensive cloth physics simulation using mass-spring systems.
Features:
- Structural, shear, and bend springs for realistic cloth behavior
- Multiple integration methods: Euler, Verlet, RK4
- Wind forces with variance for dynamic effects
- Self-collision detection using spatial hashing
- Collision with spheres, planes, and boxes
- Tearing simulation with configurable threshold
- Fixed point constraints
- Full energy and stress analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'simulate', 'step', 'analyze', 'add_collision', 'set_wind', 'fix_point', 'release_point', 'info'],
        description: 'Operation to perform'
      },
      // Creation parameters
      width: { type: 'number', description: 'Grid width (particles)' },
      height: { type: 'number', description: 'Grid height (particles)' },
      spacing: { type: 'number', description: 'Particle spacing (m)' },
      particleMass: { type: 'number', description: 'Mass per particle (kg)' },
      fixedPoints: {
        type: 'array',
        items: { type: 'object' },
        description: 'Fixed point grid coordinates [{x, y}, ...]'
      },

      // Spring parameters
      structuralStiffness: { type: 'number', description: 'Structural spring stiffness' },
      shearStiffness: { type: 'number', description: 'Shear spring stiffness' },
      bendStiffness: { type: 'number', description: 'Bend spring stiffness' },

      // Simulation parameters
      timestep: { type: 'number', description: 'Simulation timestep (s)' },
      steps: { type: 'number', description: 'Number of simulation steps' },
      integrationMethod: { type: 'string', enum: ['euler', 'verlet', 'rk4'], description: 'Integration method' },
      constraintIterations: { type: 'number', description: 'Verlet constraint iterations' },

      // Tearing
      tearingEnabled: { type: 'boolean', description: 'Enable cloth tearing' },
      tearThreshold: { type: 'number', description: 'Tear threshold (stretch ratio)' },

      // Self-collision
      selfCollisionEnabled: { type: 'boolean', description: 'Enable self-collision' },
      collisionRadius: { type: 'number', description: 'Particle collision radius (m)' },

      // Forces
      gravity: { type: 'object', description: 'Gravity vector {x, y, z} (m/s^2)' },
      wind: { type: 'object', description: 'Wind velocity {x, y, z} (m/s)' },
      windVariance: { type: 'number', description: 'Wind random variance' },
      airDamping: { type: 'number', description: 'Air resistance coefficient' },

      // Collision objects
      collisionObject: { type: 'object', description: 'Collision object: {type, center, radius, point, normal, min, max, friction}' },

      // Point manipulation
      pointX: { type: 'number', description: 'Grid X coordinate for point operations' },
      pointY: { type: 'number', description: 'Grid Y coordinate for point operations' },

      // State
      state: { type: 'object', description: 'Current cloth simulation state' }
    },
    required: ['operation']
  }
};

// ============================================================================
// Tool Execution
// ============================================================================

export async function executeclothsimulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'create': {
        const config = getDefaultConfig();

        // Apply custom config
        if (args.width !== undefined) config.width = args.width;
        if (args.height !== undefined) config.height = args.height;
        if (args.spacing !== undefined) config.spacing = args.spacing;
        if (args.particleMass !== undefined) config.particleMass = args.particleMass;
        if (args.structuralStiffness !== undefined) config.structuralStiffness = args.structuralStiffness;
        if (args.shearStiffness !== undefined) config.shearStiffness = args.shearStiffness;
        if (args.bendStiffness !== undefined) config.bendStiffness = args.bendStiffness;
        if (args.integrationMethod !== undefined) config.integrationMethod = args.integrationMethod;
        if (args.constraintIterations !== undefined) config.constraintIterations = args.constraintIterations;
        if (args.tearingEnabled !== undefined) config.tearingEnabled = args.tearingEnabled;
        if (args.tearThreshold !== undefined) config.tearThreshold = args.tearThreshold;
        if (args.selfCollisionEnabled !== undefined) config.selfCollisionEnabled = args.selfCollisionEnabled;
        if (args.collisionRadius !== undefined) config.collisionRadius = args.collisionRadius;
        if (args.gravity !== undefined) config.gravity = args.gravity;
        if (args.wind !== undefined) config.wind = args.wind;
        if (args.windVariance !== undefined) config.windVariance = args.windVariance;
        if (args.airDamping !== undefined) config.airDamping = args.airDamping;

        const state = createCloth(config, args.fixedPoints);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create',
            cloth: {
              width: config.width,
              height: config.height,
              totalParticles: state.particles.length,
              totalSprings: state.springs.length,
              structuralSprings: state.springs.filter(s => s.type === 'structural').length,
              shearSprings: state.springs.filter(s => s.type === 'shear').length,
              bendSprings: state.springs.filter(s => s.type === 'bend').length,
              fixedParticles: state.particles.filter(p => p.isFixed).length,
              integrationMethod: config.integrationMethod,
              tearingEnabled: config.tearingEnabled,
              selfCollisionEnabled: config.selfCollisionEnabled
            },
            state
          }, null, 2)
        };
      }

      case 'simulate':
      case 'step': {
        if (!args.state) {
          return { toolCallId: id, content: 'Error: state required for simulation', isError: true };
        }

        const state = args.state as ClothState;
        const dt = args.timestep || 0.01;
        const steps = operation === 'simulate' ? (args.steps || 100) : 1;

        const startTime = state.time;

        for (let i = 0; i < steps; i++) {
          simulateStep(state, dt);
        }

        const analysis = analyzeCloth(state);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation,
            simulation: {
              stepsExecuted: steps,
              timeElapsed: state.time - startTime,
              currentTime: state.time,
              currentFrame: state.frame,
              brokenSprings: state.brokenSprings
            },
            analysis: {
              dimensions: analysis.dimensions,
              centerOfMass: analysis.centerOfMass,
              maxVelocity: analysis.maxVelocity,
              totalEnergy: analysis.totalEnergy,
              tearPercentage: analysis.tearPercentage,
              springStress: analysis.springStress
            },
            state
          }, null, 2)
        };
      }

      case 'analyze': {
        if (!args.state) {
          return { toolCallId: id, content: 'Error: state required for analysis', isError: true };
        }

        const state = args.state as ClothState;
        const analysis = analyzeCloth(state);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            analysis,
            state
          }, null, 2)
        };
      }

      case 'add_collision': {
        if (!args.state || !args.collisionObject) {
          return { toolCallId: id, content: 'Error: state and collisionObject required', isError: true };
        }

        const state = args.state as ClothState;
        const obj = args.collisionObject;

        let collisionObject: CollisionObject;

        switch (obj.type) {
          case 'sphere':
            collisionObject = {
              type: 'sphere',
              center: obj.center || vec3(0, 0, 0),
              radius: obj.radius || 0.5,
              friction: obj.friction || 0.3
            };
            break;
          case 'plane':
            collisionObject = {
              type: 'plane',
              point: obj.point || vec3(0, -2, 0),
              normal: vec3Normalize(obj.normal || vec3(0, 1, 0)),
              friction: obj.friction || 0.3
            };
            break;
          case 'box':
            collisionObject = {
              type: 'box',
              min: obj.min || vec3(-1, -1, -1),
              max: obj.max || vec3(1, 1, 1),
              friction: obj.friction || 0.3
            };
            break;
          default:
            return { toolCallId: id, content: 'Error: Invalid collision object type', isError: true };
        }

        state.collisionObjects.push(collisionObject);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'add_collision',
            addedObject: collisionObject,
            totalCollisionObjects: state.collisionObjects.length,
            state
          }, null, 2)
        };
      }

      case 'set_wind': {
        if (!args.state) {
          return { toolCallId: id, content: 'Error: state required', isError: true };
        }

        const state = args.state as ClothState;

        if (args.wind) {
          state.config.wind = args.wind;
        }
        if (args.windVariance !== undefined) {
          state.config.windVariance = args.windVariance;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'set_wind',
            wind: state.config.wind,
            windVariance: state.config.windVariance,
            state
          }, null, 2)
        };
      }

      case 'fix_point': {
        if (!args.state || args.pointX === undefined || args.pointY === undefined) {
          return { toolCallId: id, content: 'Error: state, pointX, pointY required', isError: true };
        }

        const state = args.state as ClothState;
        const idx = args.pointY * state.config.width + args.pointX;

        if (idx < 0 || idx >= state.particles.length) {
          return { toolCallId: id, content: 'Error: Invalid point coordinates', isError: true };
        }

        state.particles[idx].isFixed = true;
        state.particles[idx].invMass = 0;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'fix_point',
            point: { x: args.pointX, y: args.pointY },
            position: state.particles[idx].position,
            fixedCount: state.particles.filter(p => p.isFixed).length,
            state
          }, null, 2)
        };
      }

      case 'release_point': {
        if (!args.state || args.pointX === undefined || args.pointY === undefined) {
          return { toolCallId: id, content: 'Error: state, pointX, pointY required', isError: true };
        }

        const state = args.state as ClothState;
        const idx = args.pointY * state.config.width + args.pointX;

        if (idx < 0 || idx >= state.particles.length) {
          return { toolCallId: id, content: 'Error: Invalid point coordinates', isError: true };
        }

        state.particles[idx].isFixed = false;
        state.particles[idx].invMass = 1 / state.particles[idx].mass;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'release_point',
            point: { x: args.pointX, y: args.pointY },
            position: state.particles[idx].position,
            fixedCount: state.particles.filter(p => p.isFixed).length,
            state
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'info',
            tool: 'cloth_simulation',
            description: 'Comprehensive cloth physics simulation using mass-spring systems',
            features: [
              'Mass-spring cloth model with structural, shear, and bend springs',
              'Multiple integration methods: Euler, Verlet (position-based), RK4',
              'Wind forces with random variance for dynamic effects',
              'Self-collision detection using spatial hashing',
              'External collision with spheres, planes, and boxes',
              'Tearing simulation with configurable threshold',
              'Fixed point constraints (pin/release particles)',
              'Full energy and stress analysis'
            ],
            springTypes: {
              structural: 'Horizontal and vertical connections for basic shape',
              shear: 'Diagonal connections to prevent shearing deformation',
              bend: 'Skip-one connections to resist bending'
            },
            integrationMethods: {
              euler: 'Simple forward Euler (fast but less stable)',
              verlet: 'Position-based Verlet with constraint iterations (stable, recommended)',
              rk4: 'Runge-Kutta 4th order (accurate but slower)'
            },
            physicsNotes: [
              'Spring forces follow Hooke\'s law: F = -k(x - x0)',
              'Wind force proportional to projected area of triangular faces',
              'Damping applied to spring velocities and global air resistance',
              'Position corrections use mass-weighted distribution',
              'Energy calculation includes kinetic, gravitational potential, and elastic'
            ],
            defaultConfig: getDefaultConfig()
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation "${operation}"`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isclothsimulationAvailable(): boolean {
  return true;
}
