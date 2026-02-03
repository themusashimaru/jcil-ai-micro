/**
 * BUOYANCY-SIM TOOL
 * Comprehensive buoyancy and fluid dynamics simulation implementing Archimedes' principle
 * Features: multi-fluid layers, metacentric height, floating stability, partial submersion
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

interface FluidLayer {
  id: string;
  density: number; // kg/m³
  heightTop: number; // meters from bottom
  heightBottom: number;
  viscosity: number; // Pa·s
  temperature: number; // Kelvin
  name: string;
}

interface FloatingObject {
  id: string;
  name: string;
  mass: number; // kg
  volume: number; // m³
  density: number; // kg/m³
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
  orientation: Vector3; // Euler angles
  dimensions: Vector3; // bounding box
  centerOfMass: Vector3; // relative to geometric center
  centerOfBuoyancy: Vector3;
  shape: 'box' | 'sphere' | 'cylinder' | 'custom';
  dragCoefficient: number;
  waterlineArea: number; // m²
}

interface BuoyancyState {
  objects: FloatingObject[];
  fluidLayers: FluidLayer[];
  gravity: number;
  time: number;
  ambientPressure: number; // Pa (atmospheric pressure at surface)
}

interface BuoyancyForces {
  buoyantForce: Vector3;
  gravitationalForce: Vector3;
  dragForce: Vector3;
  netForce: Vector3;
  torque: Vector3;
  submergedVolume: number;
  submergedFraction: number;
  displacedFluidMass: number;
}

interface StabilityAnalysis {
  objectId: string;
  isStable: boolean;
  metacentricHeight: number; // GM
  centerOfBuoyancy: Vector3;
  centerOfGravity: Vector3;
  metacenter: Vector3;
  rightingMoment: number;
  heelAngle: number;
  rollPeriod: number;
  stabilityType: 'stable' | 'neutral' | 'unstable';
  criticalAngle: number; // angle at which it would capsize
}

interface SubmergedCalculation {
  objectId: string;
  totalVolume: number;
  submergedVolume: number;
  submergedFraction: number;
  waterlineDepth: number;
  fluidLayersInContact: string[];
  volumePerLayer: { [layerId: string]: number };
  pressureAtCenterOfBuoyancy: number;
}

// ============================================================================
// Physics Constants
// ============================================================================

export const WATER_DENSITY = 1000; // kg/m³ (fresh water at 20°C)
export const SEAWATER_DENSITY = 1025; // kg/m³
export const AIR_DENSITY = 1.225; // kg/m³
export const STANDARD_GRAVITY = 9.80665; // m/s²
const ATMOSPHERIC_PRESSURE = 101325; // Pa

// ============================================================================
// Common Fluid Presets
// ============================================================================

const FLUID_PRESETS: { [key: string]: Omit<FluidLayer, 'id' | 'heightTop' | 'heightBottom'> } = {
  freshWater: { density: 1000, viscosity: 0.001, temperature: 293, name: 'Fresh Water' },
  seaWater: { density: 1025, viscosity: 0.00108, temperature: 288, name: 'Sea Water' },
  oil: { density: 850, viscosity: 0.03, temperature: 293, name: 'Oil' },
  mercury: { density: 13600, viscosity: 0.00155, temperature: 293, name: 'Mercury' },
  glycerin: { density: 1260, viscosity: 1.5, temperature: 293, name: 'Glycerin' },
  air: { density: 1.225, viscosity: 0.0000181, temperature: 293, name: 'Air' },
  honey: { density: 1420, viscosity: 10, temperature: 293, name: 'Honey' },
  gasoline: { density: 750, viscosity: 0.0006, temperature: 293, name: 'Gasoline' },
};

// ============================================================================
// Vector Math Utilities
// ============================================================================

function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Normalize(v: Vector3): Vector3 {
  const mag = vec3Magnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / mag);
}

function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ============================================================================
// Core Physics Calculations
// ============================================================================

/**
 * Calculate submerged volume for a box shape
 */
function calculateBoxSubmergedVolume(
  obj: FloatingObject,
  fluidSurfaceHeight: number
): { volume: number; centerOfBuoyancy: Vector3 } {
  const bottomY = obj.position.y - obj.dimensions.y / 2;
  const topY = obj.position.y + obj.dimensions.y / 2;

  if (topY <= fluidSurfaceHeight) {
    // Fully submerged
    return {
      volume: obj.volume,
      centerOfBuoyancy: { ...obj.position },
    };
  } else if (bottomY >= fluidSurfaceHeight) {
    // Not submerged
    return {
      volume: 0,
      centerOfBuoyancy: { ...obj.position },
    };
  } else {
    // Partially submerged
    const submergedHeight = fluidSurfaceHeight - bottomY;
    const submergedFraction = submergedHeight / obj.dimensions.y;
    const submergedVolume = obj.volume * submergedFraction;

    // Center of buoyancy is at centroid of submerged portion
    const cobY = bottomY + submergedHeight / 2;

    return {
      volume: submergedVolume,
      centerOfBuoyancy: { x: obj.position.x, y: cobY, z: obj.position.z },
    };
  }
}

/**
 * Calculate submerged volume for a sphere
 */
function calculateSphereSubmergedVolume(
  obj: FloatingObject,
  fluidSurfaceHeight: number
): { volume: number; centerOfBuoyancy: Vector3 } {
  const radius = obj.dimensions.x / 2; // Assume uniform sphere
  const centerY = obj.position.y;
  const bottomY = centerY - radius;
  const topY = centerY + radius;

  if (topY <= fluidSurfaceHeight) {
    // Fully submerged
    return {
      volume: obj.volume,
      centerOfBuoyancy: { ...obj.position },
    };
  } else if (bottomY >= fluidSurfaceHeight) {
    // Not submerged
    return {
      volume: 0,
      centerOfBuoyancy: { ...obj.position },
    };
  } else {
    // Partially submerged - use spherical cap formula
    const h = fluidSurfaceHeight - bottomY; // depth of submersion
    const submergedVolume = ((Math.PI * h * h) / 3) * (3 * radius - h);

    // Center of buoyancy for spherical cap
    const cobY = bottomY + (3 * (2 * radius - h) * (2 * radius - h)) / (4 * (3 * radius - h));

    return {
      volume: submergedVolume,
      centerOfBuoyancy: { x: obj.position.x, y: cobY, z: obj.position.z },
    };
  }
}

/**
 * Calculate submerged volume for a cylinder (vertical orientation)
 */
function calculateCylinderSubmergedVolume(
  obj: FloatingObject,
  fluidSurfaceHeight: number
): { volume: number; centerOfBuoyancy: Vector3 } {
  const radius = obj.dimensions.x / 2;
  const height = obj.dimensions.y;
  const bottomY = obj.position.y - height / 2;
  const topY = obj.position.y + height / 2;

  if (topY <= fluidSurfaceHeight) {
    return {
      volume: obj.volume,
      centerOfBuoyancy: { ...obj.position },
    };
  } else if (bottomY >= fluidSurfaceHeight) {
    return {
      volume: 0,
      centerOfBuoyancy: { ...obj.position },
    };
  } else {
    const submergedHeight = fluidSurfaceHeight - bottomY;
    const submergedVolume = Math.PI * radius * radius * submergedHeight;
    const cobY = bottomY + submergedHeight / 2;

    return {
      volume: submergedVolume,
      centerOfBuoyancy: { x: obj.position.x, y: cobY, z: obj.position.z },
    };
  }
}

/**
 * Calculate submerged volume based on object shape
 */
function calculateSubmergedVolume(
  obj: FloatingObject,
  fluidSurfaceHeight: number
): { volume: number; centerOfBuoyancy: Vector3 } {
  switch (obj.shape) {
    case 'sphere':
      return calculateSphereSubmergedVolume(obj, fluidSurfaceHeight);
    case 'cylinder':
      return calculateCylinderSubmergedVolume(obj, fluidSurfaceHeight);
    case 'box':
    default:
      return calculateBoxSubmergedVolume(obj, fluidSurfaceHeight);
  }
}

/**
 * Calculate buoyancy forces using Archimedes' principle
 */
function calculateBuoyancyForces(obj: FloatingObject, state: BuoyancyState): BuoyancyForces {
  // Find the highest fluid layer (surface)
  const sortedLayers = [...state.fluidLayers].sort((a, b) => b.heightTop - a.heightTop);

  const totalBuoyantForce: Vector3 = { x: 0, y: 0, z: 0 };
  let totalSubmergedVolume = 0;
  let totalDisplacedMass = 0;
  let weightedCOB: Vector3 = { x: 0, y: 0, z: 0 };

  // Calculate buoyancy contribution from each fluid layer
  for (const layer of sortedLayers) {
    const { volume, centerOfBuoyancy } = calculateSubmergedVolume(obj, layer.heightTop);

    // Only count volume within this layer
    const volumeAboveBottom = calculateSubmergedVolume(obj, layer.heightBottom).volume;
    const volumeInLayer = Math.max(0, volume - volumeAboveBottom);

    if (volumeInLayer > 0) {
      // Buoyant force = ρ * g * V (Archimedes' principle)
      const layerBuoyancy = layer.density * state.gravity * volumeInLayer;
      totalBuoyantForce.y += layerBuoyancy;
      totalSubmergedVolume += volumeInLayer;
      totalDisplacedMass += layer.density * volumeInLayer;

      // Weighted center of buoyancy
      weightedCOB = vec3Add(weightedCOB, vec3Scale(centerOfBuoyancy, volumeInLayer));
    }
  }

  // Normalize center of buoyancy
  if (totalSubmergedVolume > 0) {
    weightedCOB = vec3Scale(weightedCOB, 1 / totalSubmergedVolume);
  } else {
    weightedCOB = { ...obj.position };
  }

  // Gravitational force
  const gravitationalForce: Vector3 = {
    x: 0,
    y: -obj.mass * state.gravity,
    z: 0,
  };

  // Drag force (simplified - based on velocity through fluid)
  const velocity = obj.velocity;
  const speed = vec3Magnitude(velocity);
  let dragForce: Vector3 = { x: 0, y: 0, z: 0 };

  if (speed > 0 && totalSubmergedVolume > 0) {
    // Get dominant fluid density for drag calculation
    const dominantDensity = sortedLayers[0]?.density || WATER_DENSITY;
    // Drag = 0.5 * ρ * v² * Cd * A
    const dragMagnitude =
      0.5 * dominantDensity * speed * speed * obj.dragCoefficient * obj.waterlineArea;
    const dragDirection = vec3Normalize(vec3Scale(velocity, -1));
    dragForce = vec3Scale(dragDirection, dragMagnitude);
  }

  // Net force
  const netForce = vec3Add(vec3Add(totalBuoyantForce, gravitationalForce), dragForce);

  // Calculate torque due to misalignment of COB and COG
  const cogWorld = vec3Add(obj.position, obj.centerOfMass);
  const leverArm = vec3Sub(weightedCOB, cogWorld);
  const torque = vec3Cross(leverArm, totalBuoyantForce);

  return {
    buoyantForce: totalBuoyantForce,
    gravitationalForce,
    dragForce,
    netForce,
    torque,
    submergedVolume: totalSubmergedVolume,
    submergedFraction: totalSubmergedVolume / obj.volume,
    displacedFluidMass: totalDisplacedMass,
  };
}

/**
 * Calculate metacentric height and stability analysis
 */
function analyzeStability(obj: FloatingObject, state: BuoyancyState): StabilityAnalysis {
  const forces = calculateBuoyancyForces(obj, state);

  // Find waterline height
  const sortedLayers = [...state.fluidLayers].sort((a, b) => b.heightTop - a.heightTop);
  const fluidSurfaceHeight = sortedLayers[0]?.heightTop || 0;

  // Calculate moment of inertia of waterplane area
  // For a rectangular waterline: I = (L * B³) / 12
  const L = obj.dimensions.z; // length
  const B = obj.dimensions.x; // beam (width)
  const I = (L * B * B * B) / 12; // second moment of area

  // Calculate BM (distance from center of buoyancy to metacenter)
  // BM = I / V_submerged
  const BM = forces.submergedVolume > 0 ? I / forces.submergedVolume : 0;

  // Center of gravity (G)
  const G = vec3Add(obj.position, obj.centerOfMass);

  // Center of buoyancy (B)
  const { centerOfBuoyancy: B_point } = calculateSubmergedVolume(obj, fluidSurfaceHeight);

  // KB = distance from keel to center of buoyancy
  const keel = obj.position.y - obj.dimensions.y / 2;
  const KB = B_point.y - keel;

  // KG = distance from keel to center of gravity
  const KG = G.y - keel;

  // GM = KB + BM - KG (metacentric height)
  const GM = KB + BM - KG;

  // Metacenter position
  const metacenter: Vector3 = {
    x: B_point.x,
    y: B_point.y + BM,
    z: B_point.z,
  };

  // Current heel angle (rotation about longitudinal axis)
  const heelAngle = obj.orientation.z;

  // Righting moment = W * GM * sin(heel)
  const weight = obj.mass * state.gravity;
  const rightingMoment = weight * GM * Math.sin(heelAngle);

  // Roll period (approximate): T = 2π * k / √(g * GM)
  // where k is radius of gyration, approximated as 0.4 * beam
  const k = 0.4 * B;
  const rollPeriod = GM > 0 ? (2 * Math.PI * k) / Math.sqrt(state.gravity * GM) : Infinity;

  // Stability determination
  let stabilityType: 'stable' | 'neutral' | 'unstable';
  if (GM > 0.01) {
    stabilityType = 'stable';
  } else if (GM < -0.01) {
    stabilityType = 'unstable';
  } else {
    stabilityType = 'neutral';
  }

  // Critical angle (angle at which it would capsize) - simplified estimate
  // Assuming capsizing occurs when deck edge submerges
  const freeboard = obj.position.y + obj.dimensions.y / 2 - fluidSurfaceHeight;
  const criticalAngle = freeboard > 0 ? Math.atan((2 * freeboard) / B) : 0;

  return {
    objectId: obj.id,
    isStable: GM > 0,
    metacentricHeight: GM,
    centerOfBuoyancy: B_point,
    centerOfGravity: G,
    metacenter,
    rightingMoment,
    heelAngle,
    rollPeriod,
    stabilityType,
    criticalAngle,
  };
}

/**
 * Calculate detailed submersion information
 */
function calculateSubmersion(obj: FloatingObject, state: BuoyancyState): SubmergedCalculation {
  const sortedLayers = [...state.fluidLayers].sort((a, b) => b.heightTop - a.heightTop);

  const volumePerLayer: { [layerId: string]: number } = {};
  const fluidLayersInContact: string[] = [];
  let totalSubmergedVolume = 0;

  for (const layer of sortedLayers) {
    const volumeToTop = calculateSubmergedVolume(obj, layer.heightTop).volume;
    const volumeToBottom = calculateSubmergedVolume(obj, layer.heightBottom).volume;
    const volumeInLayer = Math.max(0, volumeToTop - volumeToBottom);

    if (volumeInLayer > 0) {
      volumePerLayer[layer.id] = volumeInLayer;
      fluidLayersInContact.push(layer.id);
      totalSubmergedVolume += volumeInLayer;
    }
  }

  // Calculate waterline depth
  const fluidSurfaceHeight = sortedLayers[0]?.heightTop || 0;
  const objectBottom = obj.position.y - obj.dimensions.y / 2;
  const waterlineDepth = Math.max(0, fluidSurfaceHeight - objectBottom);

  // Pressure at center of buoyancy
  const { centerOfBuoyancy } = calculateSubmergedVolume(obj, fluidSurfaceHeight);
  let pressure = state.ambientPressure;

  for (const layer of sortedLayers) {
    if (centerOfBuoyancy.y < layer.heightTop) {
      const depthInLayer = Math.min(
        layer.heightTop - centerOfBuoyancy.y,
        layer.heightTop - layer.heightBottom
      );
      pressure += layer.density * state.gravity * depthInLayer;
    }
  }

  return {
    objectId: obj.id,
    totalVolume: obj.volume,
    submergedVolume: totalSubmergedVolume,
    submergedFraction: totalSubmergedVolume / obj.volume,
    waterlineDepth,
    fluidLayersInContact,
    volumePerLayer,
    pressureAtCenterOfBuoyancy: pressure,
  };
}

/**
 * Simulate one timestep of buoyancy dynamics
 */
function simulateStep(state: BuoyancyState, dt: number): BuoyancyState {
  const newObjects = state.objects.map((obj) => {
    const forces = calculateBuoyancyForces(obj, state);

    // Linear acceleration: F = ma
    const acceleration = vec3Scale(forces.netForce, 1 / obj.mass);

    // Update velocity (semi-implicit Euler)
    const newVelocity = vec3Add(obj.velocity, vec3Scale(acceleration, dt));

    // Apply damping for stability
    const dampedVelocity = vec3Scale(newVelocity, 0.995);

    // Update position
    const newPosition = vec3Add(obj.position, vec3Scale(dampedVelocity, dt));

    // Angular dynamics (simplified)
    // τ = I * α, assuming uniform density I ≈ m * r²/6 for a box
    const momentOfInertia =
      (obj.mass * (obj.dimensions.x * obj.dimensions.x + obj.dimensions.y * obj.dimensions.y)) / 12;
    const angularAcceleration = vec3Scale(forces.torque, 1 / momentOfInertia);

    const newAngularVelocity = vec3Add(obj.angularVelocity, vec3Scale(angularAcceleration, dt));
    const dampedAngularVelocity = vec3Scale(newAngularVelocity, 0.98);

    const newOrientation = vec3Add(obj.orientation, vec3Scale(dampedAngularVelocity, dt));

    // Update center of buoyancy
    const sortedLayers = [...state.fluidLayers].sort((a, b) => b.heightTop - a.heightTop);
    const fluidSurfaceHeight = sortedLayers[0]?.heightTop || 0;
    const { centerOfBuoyancy } = calculateSubmergedVolume(
      { ...obj, position: newPosition },
      fluidSurfaceHeight
    );

    return {
      ...obj,
      position: newPosition,
      velocity: dampedVelocity,
      angularVelocity: dampedAngularVelocity,
      orientation: newOrientation,
      centerOfBuoyancy,
    };
  });

  return {
    ...state,
    objects: newObjects,
    time: state.time + dt,
  };
}

/**
 * Create a floating object
 */
function createFloatingObject(params: {
  id?: string;
  name?: string;
  mass: number;
  dimensions: Vector3;
  position?: Vector3;
  shape?: 'box' | 'sphere' | 'cylinder';
  material?: string;
}): FloatingObject {
  const dimensions = params.dimensions;
  let volume: number;

  switch (params.shape || 'box') {
    case 'sphere':
      volume = (4 / 3) * Math.PI * Math.pow(dimensions.x / 2, 3);
      break;
    case 'cylinder':
      volume = Math.PI * Math.pow(dimensions.x / 2, 2) * dimensions.y;
      break;
    default:
      volume = dimensions.x * dimensions.y * dimensions.z;
  }

  const density = params.mass / volume;

  return {
    id: params.id || `obj_${Date.now()}`,
    name: params.name || 'Floating Object',
    mass: params.mass,
    volume,
    density,
    position: params.position || { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0 },
    dimensions,
    centerOfMass: { x: 0, y: 0, z: 0 },
    centerOfBuoyancy: { x: 0, y: 0, z: 0 },
    shape: params.shape || 'box',
    dragCoefficient: 1.0,
    waterlineArea: dimensions.x * dimensions.z,
  };
}

/**
 * Create a fluid layer from preset
 */
function createFluidLayer(params: {
  id?: string;
  fluidType: string;
  heightTop: number;
  heightBottom: number;
}): FluidLayer {
  const preset = FLUID_PRESETS[params.fluidType] || FLUID_PRESETS.freshWater;

  return {
    id: params.id || `layer_${Date.now()}`,
    ...preset,
    heightTop: params.heightTop,
    heightBottom: params.heightBottom,
  };
}

/**
 * Initialize buoyancy simulation state
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function initializeState(params: {
  objects?: any[];
  fluidLayers?: any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  gravity?: number;
}): BuoyancyState {
  const fluidLayers = params.fluidLayers?.map((layer, i) =>
    createFluidLayer({
      id: layer.id || `layer_${i}`,
      fluidType: layer.fluidType || 'freshWater',
      heightTop: layer.heightTop ?? 10,
      heightBottom: layer.heightBottom ?? 0,
    })
  ) || [createFluidLayer({ fluidType: 'freshWater', heightTop: 10, heightBottom: 0 })];

  const objects =
    params.objects?.map((obj, i) =>
      createFloatingObject({
        id: obj.id || `obj_${i}`,
        name: obj.name,
        mass: obj.mass || 100,
        dimensions: obj.dimensions || { x: 1, y: 1, z: 1 },
        position: obj.position || { x: 0, y: fluidLayers[0].heightTop, z: 0 },
        shape: obj.shape,
      })
    ) || [];

  return {
    objects,
    fluidLayers,
    gravity: params.gravity ?? STANDARD_GRAVITY,
    time: 0,
    ambientPressure: ATMOSPHERIC_PRESSURE,
  };
}

/**
 * Run full simulation
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function runSimulation(params: {
  objects: any[];
  fluidLayers?: any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  duration: number;
  timestep: number;
  gravity?: number;
}): {
  finalState: BuoyancyState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trajectory: { time: number; objects: any[] }[];
  analysis: {
    forces: BuoyancyForces;
    stability: StabilityAnalysis;
    submersion: SubmergedCalculation;
  }[];
} {
  let state = initializeState({
    objects: params.objects,
    fluidLayers: params.fluidLayers,
    gravity: params.gravity,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trajectory: { time: number; objects: any[] }[] = [];
  const dt = params.timestep || 0.01;
  const steps = Math.floor(params.duration / dt);
  const recordInterval = Math.max(1, Math.floor(steps / 100)); // Record ~100 frames

  for (let i = 0; i < steps; i++) {
    state = simulateStep(state, dt);

    if (i % recordInterval === 0) {
      trajectory.push({
        time: state.time,
        objects: state.objects.map((obj) => ({
          id: obj.id,
          position: { ...obj.position },
          velocity: { ...obj.velocity },
          orientation: { ...obj.orientation },
        })),
      });
    }
  }

  // Final analysis
  const analysis = state.objects.map((obj) => ({
    forces: calculateBuoyancyForces(obj, state),
    stability: analyzeStability(obj, state),
    submersion: calculateSubmersion(obj, state),
  }));

  return {
    finalState: state,
    trajectory,
    analysis,
  };
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const buoyancysimTool: UnifiedTool = {
  name: 'buoyancy_sim',
  description:
    "Comprehensive buoyancy and fluid dynamics simulation using Archimedes' principle. Supports multi-fluid layers, metacentric height calculation, floating stability analysis, and partial submersion calculations.",
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'simulate',
          'step',
          'analyze_forces',
          'analyze_stability',
          'calculate_submersion',
          'info',
        ],
        description: 'Operation to perform',
      },
      objects: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Objects to simulate. Each object has: id (string), name (string), mass (number, kg), dimensions (object with x/y/z), position (object with x/y/z), shape (box|sphere|cylinder)',
      },
      fluidLayers: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Fluid layers (from bottom to top). Each layer has: id (string), fluidType (freshWater|seaWater|oil|mercury|glycerin|air|honey|gasoline), heightTop (number), heightBottom (number)',
      },
      duration: { type: 'number', description: 'Simulation duration in seconds' },
      timestep: { type: 'number', description: 'Simulation timestep in seconds' },
      gravity: {
        type: 'number',
        description: 'Gravitational acceleration (default: 9.80665 m/s²)',
      },
    },
    required: ['operation'],
  },
};

export async function executebuoyancysim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, objects, fluidLayers, duration, timestep, gravity } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate': {
        if (!objects || objects.length === 0) {
          throw new Error('At least one object is required for simulation');
        }
        result = runSimulation({
          objects,
          fluidLayers,
          duration: duration || 10,
          timestep: timestep || 0.01,
          gravity,
        });
        break;
      }

      case 'step': {
        let state = initializeState({ objects, fluidLayers, gravity });
        state = simulateStep(state, timestep || 0.01);
        result = {
          state,
          forces: state.objects.map((obj) => calculateBuoyancyForces(obj, state)),
        };
        break;
      }

      case 'analyze_forces': {
        const state = initializeState({ objects, fluidLayers, gravity });
        result = {
          forces: state.objects.map((obj) => ({
            objectId: obj.id,
            ...calculateBuoyancyForces(obj, state),
          })),
        };
        break;
      }

      case 'analyze_stability': {
        const state = initializeState({ objects, fluidLayers, gravity });
        result = {
          stability: state.objects.map((obj) => analyzeStability(obj, state)),
        };
        break;
      }

      case 'calculate_submersion': {
        const state = initializeState({ objects, fluidLayers, gravity });
        result = {
          submersion: state.objects.map((obj) => calculateSubmersion(obj, state)),
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: "Buoyancy simulation tool implementing Archimedes' principle",
          features: [
            'Multi-fluid layer support (oil/water/etc.)',
            'Metacentric height calculation',
            'Floating stability analysis',
            'Partial/full submersion calculations',
            'Multiple object shapes (box, sphere, cylinder)',
            'Drag force modeling',
            'Roll period estimation',
          ],
          fluidPresets: Object.keys(FLUID_PRESETS).map((key) => ({
            type: key,
            ...FLUID_PRESETS[key],
          })),
          constants: {
            WATER_DENSITY,
            SEAWATER_DENSITY,
            STANDARD_GRAVITY,
            ATMOSPHERIC_PRESSURE,
          },
          operations: [
            'simulate',
            'step',
            'analyze_forces',
            'analyze_stability',
            'calculate_submersion',
            'info',
          ],
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isbuoyancysimAvailable(): boolean {
  return true;
}
