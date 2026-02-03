/**
 * ROPE-PHYSICS TOOL
 * Comprehensive rope and chain physics simulation using Verlet integration
 * Features: distance constraints, multiple attachment points, tension calculation,
 * breaking threshold, collision with environment, stiffness parameters
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

interface RopeNode {
  id: number;
  position: Vector3;
  previousPosition: Vector3;
  acceleration: Vector3;
  mass: number;
  isFixed: boolean;
  fixedPosition?: Vector3;
}

interface RopeConstraint {
  nodeA: number;
  nodeB: number;
  restLength: number;
  stiffness: number;
  maxTension: number; // Breaking threshold
  isBroken: boolean;
}

interface CollisionSphere {
  center: Vector3;
  radius: number;
  friction: number;
}

interface CollisionPlane {
  normal: Vector3;
  distance: number; // distance from origin along normal
  friction: number;
}

interface RopeConfig {
  length: number;
  nodeCount: number;
  mass: number; // total mass
  stiffness: number; // 0-1
  damping: number; // 0-1
  breakingTension: number; // force threshold for breaking
  thickness: number;
}

interface RopeState {
  nodes: RopeNode[];
  constraints: RopeConstraint[];
  time: number;
  gravity: Vector3;
  wind: Vector3;
  collisionSpheres: CollisionSphere[];
  collisionPlanes: CollisionPlane[];
}

interface TensionInfo {
  constraintIndex: number;
  tension: number;
  stretchRatio: number;
  isBroken: boolean;
}

interface SimulationResult {
  frames: {
    time: number;
    nodes: { id: number; position: Vector3; velocity: Vector3 }[];
    tensions: TensionInfo[];
    brokenSegments: number[];
  }[];
  finalState: RopeState;
  totalLength: number;
  maxTension: number;
  brokenCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const GRAVITY = 9.80665;
const CONSTRAINT_ITERATIONS = 20;
const VELOCITY_DAMPING = 0.99;
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

export function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vec3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

// ============================================================================
// Rope Creation
// ============================================================================

function createRope(params: {
  startPoint: Vector3;
  endPoint?: Vector3;
  direction?: Vector3;
  config: RopeConfig;
  fixedStart?: boolean;
  fixedEnd?: boolean;
  fixedIndices?: number[];
}): RopeState {
  const { startPoint, config } = params;
  const nodeCount = Math.max(2, config.nodeCount);
  const segmentLength = config.length / (nodeCount - 1);
  const nodeMass = config.mass / nodeCount;

  // Calculate direction
  let direction: Vector3;
  if (params.endPoint) {
    direction = vec3Normalize(vec3Sub(params.endPoint, startPoint));
  } else if (params.direction) {
    direction = vec3Normalize(params.direction);
  } else {
    direction = { x: 0, y: -1, z: 0 }; // Default: hanging down
  }

  // Create nodes
  const nodes: RopeNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    let position: Vector3;

    if (params.endPoint) {
      // Interpolate between start and end with slight sag
      position = vec3Lerp(startPoint, params.endPoint, t);
      // Add sag based on parabola
      const sagAmount = config.length * 0.1 * Math.sin(t * Math.PI);
      position.y -= sagAmount;
    } else {
      position = vec3Add(startPoint, vec3Scale(direction, i * segmentLength));
    }

    const isFixed =
      (params.fixedStart && i === 0) ||
      (params.fixedEnd && i === nodeCount - 1) ||
      (params.fixedIndices?.includes(i) ?? false);

    nodes.push({
      id: i,
      position: { ...position },
      previousPosition: { ...position },
      acceleration: vec3Zero(),
      mass: nodeMass,
      isFixed,
      fixedPosition: isFixed ? { ...position } : undefined,
    });
  }

  // Create constraints between consecutive nodes
  const constraints: RopeConstraint[] = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    constraints.push({
      nodeA: i,
      nodeB: i + 1,
      restLength: segmentLength,
      stiffness: config.stiffness,
      maxTension: config.breakingTension,
      isBroken: false,
    });
  }

  return {
    nodes,
    constraints,
    time: 0,
    gravity: { x: 0, y: -GRAVITY, z: 0 },
    wind: vec3Zero(),
    collisionSpheres: [],
    collisionPlanes: [
      // Default ground plane
      { normal: { x: 0, y: 1, z: 0 }, distance: 0, friction: 0.5 },
    ],
  };
}

// ============================================================================
// Verlet Integration
// ============================================================================

function verletIntegrate(state: RopeState, dt: number, damping: number): void {
  for (const node of state.nodes) {
    if (node.isFixed) {
      // Fixed nodes stay at their fixed position
      if (node.fixedPosition) {
        node.position = { ...node.fixedPosition };
        node.previousPosition = { ...node.fixedPosition };
      }
      continue;
    }

    // Calculate velocity from position difference
    const velocity = vec3Sub(node.position, node.previousPosition);

    // Apply damping to velocity
    const dampedVelocity = vec3Scale(velocity, damping);

    // Store current position
    const currentPos = { ...node.position };

    // Add external forces (gravity + wind)
    const totalAcceleration = vec3Add(
      state.gravity,
      vec3Scale(state.wind, 1 / node.mass) // Wind force proportional to surface area (simplified)
    );

    // Verlet integration: x_new = x + v*damping + a*dt²
    node.position = vec3Add(
      vec3Add(node.position, dampedVelocity),
      vec3Scale(totalAcceleration, dt * dt)
    );

    // Update previous position
    node.previousPosition = currentPos;
  }
}

// ============================================================================
// Constraint Solving
// ============================================================================

function solveDistanceConstraint(
  nodeA: RopeNode,
  nodeB: RopeNode,
  constraint: RopeConstraint,
  dt: number
): number {
  if (constraint.isBroken) return 0;

  const diff = vec3Sub(nodeB.position, nodeA.position);
  const currentLength = vec3Length(diff);

  if (currentLength < 1e-10) return 0;

  const error = currentLength - constraint.restLength;

  // Calculate tension (force = stiffness * displacement)
  const tension = (Math.abs(error) * constraint.stiffness) / dt / dt;

  // Check for breaking
  if (constraint.maxTension > 0 && tension > constraint.maxTension) {
    constraint.isBroken = true;
    return tension;
  }

  // Calculate correction
  const correction = vec3Scale(diff, (error / currentLength) * constraint.stiffness);

  // Apply correction based on mass ratio
  const totalMass = nodeA.mass + nodeB.mass;
  const ratioA = nodeA.isFixed ? 0 : nodeB.mass / totalMass;
  const ratioB = nodeB.isFixed ? 0 : nodeA.mass / totalMass;

  if (!nodeA.isFixed) {
    nodeA.position = vec3Add(nodeA.position, vec3Scale(correction, ratioA));
  }
  if (!nodeB.isFixed) {
    nodeB.position = vec3Sub(nodeB.position, vec3Scale(correction, ratioB));
  }

  return tension;
}

function solveConstraints(state: RopeState, iterations: number, dt: number): TensionInfo[] {
  const tensions: TensionInfo[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < state.constraints.length; i++) {
      const constraint = state.constraints[i];
      const nodeA = state.nodes[constraint.nodeA];
      const nodeB = state.nodes[constraint.nodeB];

      const tension = solveDistanceConstraint(nodeA, nodeB, constraint, dt);

      // Record tension on last iteration
      if (iter === iterations - 1) {
        const diff = vec3Sub(nodeB.position, nodeA.position);
        const currentLength = vec3Length(diff);
        tensions.push({
          constraintIndex: i,
          tension,
          stretchRatio: currentLength / constraint.restLength,
          isBroken: constraint.isBroken,
        });
      }
    }
  }

  return tensions;
}

// ============================================================================
// Collision Detection and Response
// ============================================================================

function handleSphereCollision(node: RopeNode, sphere: CollisionSphere): void {
  if (node.isFixed) return;

  const toNode = vec3Sub(node.position, sphere.center);
  const dist = vec3Length(toNode);
  const penetration = sphere.radius + COLLISION_MARGIN - dist;

  if (penetration > 0) {
    // Push node out of sphere
    const normal = dist > 1e-10 ? vec3Scale(toNode, 1 / dist) : { x: 0, y: 1, z: 0 };
    node.position = vec3Add(node.position, vec3Scale(normal, penetration));

    // Apply friction
    const velocity = vec3Sub(node.position, node.previousPosition);
    const normalVel = vec3Scale(normal, vec3Dot(velocity, normal));
    const tangentVel = vec3Sub(velocity, normalVel);

    // Reduce tangent velocity by friction
    const frictionVel = vec3Scale(tangentVel, 1 - sphere.friction);
    node.previousPosition = vec3Sub(node.position, vec3Add(normalVel, frictionVel));
  }
}

function handlePlaneCollision(node: RopeNode, plane: CollisionPlane): void {
  if (node.isFixed) return;

  // Calculate signed distance to plane
  const dist = vec3Dot(node.position, plane.normal) - plane.distance;

  if (dist < COLLISION_MARGIN) {
    // Push node above plane
    const penetration = COLLISION_MARGIN - dist;
    node.position = vec3Add(node.position, vec3Scale(plane.normal, penetration));

    // Apply friction
    const velocity = vec3Sub(node.position, node.previousPosition);
    const normalVel = vec3Scale(plane.normal, vec3Dot(velocity, plane.normal));
    const tangentVel = vec3Sub(velocity, normalVel);

    // Reduce tangent velocity by friction
    const frictionVel = vec3Scale(tangentVel, 1 - plane.friction);

    // Bounce: reverse normal velocity with damping
    const bounceDamping = 0.3;
    const bounceVel = vec3Scale(normalVel, -bounceDamping);

    node.previousPosition = vec3Sub(node.position, vec3Add(bounceVel, frictionVel));
  }
}

function handleCollisions(state: RopeState): void {
  for (const node of state.nodes) {
    for (const sphere of state.collisionSpheres) {
      handleSphereCollision(node, sphere);
    }
    for (const plane of state.collisionPlanes) {
      handlePlaneCollision(node, plane);
    }
  }
}

// ============================================================================
// Analysis Functions
// ============================================================================

function calculateTotalLength(state: RopeState): number {
  let length = 0;
  for (const constraint of state.constraints) {
    if (!constraint.isBroken) {
      const nodeA = state.nodes[constraint.nodeA];
      const nodeB = state.nodes[constraint.nodeB];
      length += vec3Distance(nodeA.position, nodeB.position);
    }
  }
  return length;
}

function getNodeVelocity(node: RopeNode, dt: number): Vector3 {
  const velocity = vec3Sub(node.position, node.previousPosition);
  return vec3Scale(velocity, 1 / dt);
}

function calculateCenterOfMass(state: RopeState): Vector3 {
  let totalMass = 0;
  let weightedSum = vec3Zero();

  for (const node of state.nodes) {
    totalMass += node.mass;
    weightedSum = vec3Add(weightedSum, vec3Scale(node.position, node.mass));
  }

  return totalMass > 0 ? vec3Scale(weightedSum, 1 / totalMass) : vec3Zero();
}

function calculateKineticEnergy(state: RopeState, dt: number): number {
  let energy = 0;
  for (const node of state.nodes) {
    if (!node.isFixed) {
      const velocity = getNodeVelocity(node, dt);
      const speed = vec3Length(velocity);
      energy += 0.5 * node.mass * speed * speed;
    }
  }
  return energy;
}

function calculatePotentialEnergy(state: RopeState): number {
  let energy = 0;
  const g = vec3Length(state.gravity);

  for (const node of state.nodes) {
    // Gravitational PE relative to y=0
    energy += node.mass * g * node.position.y;
  }

  // Elastic PE from stretched constraints
  for (const constraint of state.constraints) {
    if (!constraint.isBroken) {
      const nodeA = state.nodes[constraint.nodeA];
      const nodeB = state.nodes[constraint.nodeB];
      const currentLength = vec3Distance(nodeA.position, nodeB.position);
      const stretch = currentLength - constraint.restLength;
      // Elastic PE = 0.5 * k * x²
      energy += 0.5 * constraint.stiffness * stretch * stretch;
    }
  }

  return energy;
}

// ============================================================================
// Simulation
// ============================================================================

function simulateRope(params: {
  startPoint: Vector3;
  endPoint?: Vector3;
  direction?: Vector3;
  config: RopeConfig;
  fixedStart?: boolean;
  fixedEnd?: boolean;
  fixedIndices?: number[];
  duration: number;
  timestep: number;
  constraintIterations?: number;
  collisionSpheres?: CollisionSphere[];
  collisionPlanes?: CollisionPlane[];
  wind?: Vector3;
  gravity?: Vector3;
}): SimulationResult {
  const state = createRope({
    startPoint: params.startPoint,
    endPoint: params.endPoint,
    direction: params.direction,
    config: params.config,
    fixedStart: params.fixedStart ?? true,
    fixedEnd: params.fixedEnd,
    fixedIndices: params.fixedIndices,
  });

  // Set custom parameters
  if (params.gravity) state.gravity = params.gravity;
  if (params.wind) state.wind = params.wind;
  if (params.collisionSpheres) {
    state.collisionSpheres = params.collisionSpheres;
  }
  if (params.collisionPlanes) {
    state.collisionPlanes = params.collisionPlanes;
  }

  const dt = params.timestep || 1 / 120;
  const iterations = params.constraintIterations || CONSTRAINT_ITERATIONS;
  const steps = Math.floor(params.duration / dt);
  const damping = 1 - params.config.damping * 0.1; // Convert to velocity retention

  const frames: SimulationResult['frames'] = [];
  const recordInterval = Math.max(1, Math.floor(1 / 60 / dt)); // ~60 FPS

  let maxTension = 0;

  for (let step = 0; step < steps; step++) {
    // Verlet integration
    verletIntegrate(state, dt, damping);

    // Solve constraints
    const tensions = solveConstraints(state, iterations, dt);

    // Track max tension
    for (const t of tensions) {
      if (t.tension > maxTension) maxTension = t.tension;
    }

    // Handle collisions
    handleCollisions(state);

    state.time += dt;

    // Record frame
    if (step % recordInterval === 0) {
      frames.push({
        time: state.time,
        nodes: state.nodes.map((n) => ({
          id: n.id,
          position: { ...n.position },
          velocity: getNodeVelocity(n, dt),
        })),
        tensions,
        brokenSegments: state.constraints.filter((c) => c.isBroken).map((_, i) => i),
      });
    }
  }

  // Count broken segments
  const brokenCount = state.constraints.filter((c) => c.isBroken).length;

  return {
    frames,
    finalState: state,
    totalLength: calculateTotalLength(state),
    maxTension,
    brokenCount,
  };
}

// ============================================================================
// Rope Manipulation
// ============================================================================

export function moveFixedPoint(state: RopeState, nodeIndex: number, newPosition: Vector3): void {
  const node = state.nodes[nodeIndex];
  if (node && node.isFixed) {
    node.fixedPosition = { ...newPosition };
    node.position = { ...newPosition };
    node.previousPosition = { ...newPosition };
  }
}

export function applyForceToNode(
  state: RopeState,
  nodeIndex: number,
  force: Vector3,
  dt: number
): void {
  const node = state.nodes[nodeIndex];
  if (node && !node.isFixed) {
    // Apply impulse as position change
    const impulse = vec3Scale(force, (dt * dt) / node.mass);
    node.position = vec3Add(node.position, impulse);
  }
}

export function cutRope(state: RopeState, constraintIndex: number): void {
  if (constraintIndex >= 0 && constraintIndex < state.constraints.length) {
    state.constraints[constraintIndex].isBroken = true;
  }
}

// ============================================================================
// Catenary Calculation
// ============================================================================

/**
 * Calculate theoretical catenary curve for rope hanging between two points
 */
function calculateCatenary(params: {
  pointA: Vector3;
  pointB: Vector3;
  ropeLength: number;
  nodeCount: number;
}): Vector3[] {
  const { pointA, pointB, ropeLength, nodeCount } = params;

  // Horizontal distance
  const dx = pointB.x - pointA.x;
  const dz = pointB.z - pointA.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // Vertical difference
  const dy = pointB.y - pointA.y;

  // If rope is shorter than distance, it's taut
  const straightDist = vec3Distance(pointA, pointB);
  if (ropeLength <= straightDist) {
    // Return straight line
    const points: Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const t = i / (nodeCount - 1);
      points.push(vec3Lerp(pointA, pointB, t));
    }
    return points;
  }

  // Solve for catenary parameter 'a' using Newton-Raphson
  // This is the characteristic shape parameter
  const slack = ropeLength - straightDist;
  let a = Math.sqrt((3 * slack) / horizontalDist) * horizontalDist; // Initial guess

  for (let iter = 0; iter < 20; iter++) {
    const sinh_val = Math.sinh(horizontalDist / (2 * a));
    const f = 2 * a * sinh_val - ropeLength;
    const df = 2 * sinh_val - (horizontalDist * Math.cosh(horizontalDist / (2 * a))) / a;

    if (Math.abs(df) < 1e-10) break;
    a = a - f / df;

    if (Math.abs(f) < 1e-10) break;
  }

  // Generate catenary points
  const points: Vector3[] = [];
  const xOffset = pointA.x;
  const zOffset = pointA.z;

  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    const x = t * horizontalDist;

    // Catenary equation: y = a * cosh((x - x0) / a) + c
    const x0 = horizontalDist / 2; // Center point
    const y_cat = a * (Math.cosh((x - x0) / a) - Math.cosh(x0 / a));

    // Adjust for endpoint heights
    const y_base = pointA.y + t * dy;
    const y = y_base + y_cat;

    points.push({
      x: xOffset + t * dx,
      y,
      z: zOffset + t * dz,
    });
  }

  return points;
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const ropephysicsTool: UnifiedTool = {
  name: 'rope_physics',
  description:
    'Comprehensive rope and chain physics simulation using Verlet integration. Features distance constraints, multiple attachment points, tension calculation, breaking threshold, collision with environment, and stiffness parameters.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'catenary', 'analyze', 'info'],
        description: 'Operation type',
      },
      startPoint: {
        type: 'object',
        description: 'Starting point: { x: number, y: number, z: number }',
      },
      endPoint: {
        type: 'object',
        description: 'Ending point: { x: number, y: number, z: number }',
      },
      direction: {
        type: 'object',
        description: 'Direction vector: { x: number, y: number, z: number }',
      },
      config: {
        type: 'object',
        description:
          'Rope configuration: length (m), nodeCount, mass (kg), stiffness (0-1), damping (0-1), breakingTension, thickness (m)',
      },
      fixedStart: { type: 'boolean', description: 'Fix the starting point' },
      fixedEnd: { type: 'boolean', description: 'Fix the ending point' },
      fixedIndices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Additional fixed node indices',
      },
      duration: { type: 'number', description: 'Simulation duration in seconds' },
      timestep: { type: 'number', description: 'Simulation timestep' },
      constraintIterations: { type: 'number', description: 'Constraint solver iterations' },
      gravity: {
        type: 'object',
        description: 'Gravity vector: { x: number, y: number, z: number }',
      },
      wind: {
        type: 'object',
        description: 'Wind force vector: { x: number, y: number, z: number }',
      },
      collisionSpheres: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Collision spheres. Each sphere has: center (object with x/y/z), radius (number), friction (number)',
      },
      collisionPlanes: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Collision planes. Each plane has: normal (object with x/y/z), distance (number), friction (number)',
      },
    },
    required: ['operation'],
  },
};

export async function executeropephysics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // Default config
    const defaultConfig: RopeConfig = {
      length: args.config?.length || 5,
      nodeCount: args.config?.nodeCount || 20,
      mass: args.config?.mass || 1,
      stiffness: args.config?.stiffness || 0.9,
      damping: args.config?.damping || 0.1,
      breakingTension: args.config?.breakingTension || 1000,
      thickness: args.config?.thickness || 0.02,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate': {
        if (!args.startPoint) {
          throw new Error('startPoint is required');
        }
        result = simulateRope({
          startPoint: args.startPoint,
          endPoint: args.endPoint,
          direction: args.direction,
          config: defaultConfig,
          fixedStart: args.fixedStart ?? true,
          fixedEnd: args.fixedEnd ?? false,
          fixedIndices: args.fixedIndices,
          duration: args.duration || 5,
          timestep: args.timestep || 1 / 120,
          constraintIterations: args.constraintIterations,
          collisionSpheres: args.collisionSpheres,
          collisionPlanes: args.collisionPlanes,
          wind: args.wind,
          gravity: args.gravity,
        });
        break;
      }

      case 'catenary': {
        if (!args.startPoint || !args.endPoint) {
          throw new Error('startPoint and endPoint are required for catenary calculation');
        }
        const points = calculateCatenary({
          pointA: args.startPoint,
          pointB: args.endPoint,
          ropeLength: defaultConfig.length,
          nodeCount: defaultConfig.nodeCount,
        });

        const straightDist = vec3Distance(args.startPoint, args.endPoint);
        const slack = defaultConfig.length - straightDist;

        result = {
          points,
          ropeLength: defaultConfig.length,
          straightDistance: straightDist,
          slack: Math.max(0, slack),
          isTaut: slack <= 0,
          lowestPoint: Math.min(...points.map((p) => p.y)),
          sagAmount: args.startPoint.y - Math.min(...points.map((p) => p.y)),
        };
        break;
      }

      case 'analyze': {
        if (!args.startPoint) {
          throw new Error('startPoint is required');
        }
        const simResult = simulateRope({
          startPoint: args.startPoint,
          endPoint: args.endPoint,
          direction: args.direction,
          config: defaultConfig,
          fixedStart: args.fixedStart ?? true,
          fixedEnd: args.fixedEnd ?? false,
          duration: args.duration || 5,
          timestep: args.timestep || 1 / 120,
        });

        const dt = args.timestep || 1 / 120;
        const finalState = simResult.finalState;

        result = {
          simulationTime: finalState.time,
          frameCount: simResult.frames.length,
          nodeCount: finalState.nodes.length,
          constraintCount: finalState.constraints.length,
          totalLength: simResult.totalLength,
          maxTension: simResult.maxTension,
          brokenSegments: simResult.brokenCount,
          centerOfMass: calculateCenterOfMass(finalState),
          kineticEnergy: calculateKineticEnergy(finalState, dt),
          potentialEnergy: calculatePotentialEnergy(finalState),
          isAtRest: calculateKineticEnergy(finalState, dt) < 0.001,
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: 'Rope physics simulation using Verlet integration',
          features: [
            'Verlet integration for stability',
            'Distance constraint solving',
            'Multiple fixed attachment points',
            'Tension calculation per segment',
            'Breaking threshold support',
            'Sphere and plane collision',
            'Friction modeling',
            'Wind force effects',
            'Catenary curve calculation',
          ],
          physicsModel: {
            integration: 'Verlet',
            constraintSolver: 'Position-based iterative',
            collisionResponse: 'Impulse with friction',
          },
          defaultConfig,
          constants: {
            GRAVITY,
            CONSTRAINT_ITERATIONS,
            VELOCITY_DAMPING,
          },
          operations: ['simulate', 'catenary', 'analyze', 'info'],
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isropephysicsAvailable(): boolean {
  return true;
}
