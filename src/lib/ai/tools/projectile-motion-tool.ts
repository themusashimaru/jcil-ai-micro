/**
 * PROJECTILE-MOTION TOOL
 * Comprehensive projectile motion simulation with realistic physics
 * Features: air resistance, drag coefficients, wind effects, Coriolis effect,
 * multiple projectile types, trajectory analysis
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

interface ProjectileState {
  position: Vector3;
  velocity: Vector3;
  mass: number; // kg
  crossSectionalArea: number; // m²
  dragCoefficient: number;
  time: number;
}

interface EnvironmentConfig {
  gravity: number; // m/s²
  airDensity: number; // kg/m³
  wind: Vector3; // m/s
  temperature: number; // Kelvin
  pressure: number; // Pa
  humidity: number; // 0-1
  latitude: number; // degrees (for Coriolis)
  enableCoriolis: boolean;
  enableMagnusEffect: boolean;
  spinRate: Vector3; // rad/s (for Magnus effect)
}

interface ProjectileType {
  name: string;
  mass: number;
  diameter: number; // m
  dragCoefficient: number;
  spinDecay: number; // how fast spin decays
}

interface TrajectoryPoint {
  time: number;
  position: Vector3;
  velocity: Vector3;
  speed: number;
  acceleration: Vector3;
  dragForce: number;
  machNumber: number;
}

interface TrajectoryAnalysis {
  maxHeight: number;
  maxHeightTime: number;
  range: number;
  totalTime: number;
  impactVelocity: number;
  impactAngle: number; // degrees from horizontal
  maxSpeed: number;
  averageSpeed: number;
  initialKineticEnergy: number;
  finalKineticEnergy: number;
  energyLostToDrag: number;
  lateralDrift: number; // due to wind/Coriolis
}

interface SimulationResult {
  trajectory: TrajectoryPoint[];
  analysis: TrajectoryAnalysis;
  finalState: ProjectileState;
  environment: EnvironmentConfig;
}

// ============================================================================
// Physics Constants
// ============================================================================

const STANDARD_GRAVITY = 9.80665; // m/s²
const EARTH_ROTATION_RATE = 7.2921e-5; // rad/s
const STANDARD_AIR_DENSITY = 1.225; // kg/m³ at sea level, 15°C
const STANDARD_PRESSURE = 101325; // Pa
const STANDARD_TEMPERATURE = 288.15; // K (15°C)
const SPEED_OF_SOUND = 343; // m/s at 20°C
const GAS_CONSTANT = 287.058; // J/(kg·K) for dry air

// ============================================================================
// Projectile Presets
// ============================================================================

const PROJECTILE_PRESETS: { [key: string]: ProjectileType } = {
  baseball: {
    name: 'Baseball',
    mass: 0.145,
    diameter: 0.074,
    dragCoefficient: 0.35,
    spinDecay: 0.1
  },
  golfBall: {
    name: 'Golf Ball',
    mass: 0.0459,
    diameter: 0.0427,
    dragCoefficient: 0.25, // dimpled surface
    spinDecay: 0.05
  },
  cannonball: {
    name: 'Cannonball',
    mass: 4.0,
    diameter: 0.1,
    dragCoefficient: 0.47, // smooth sphere
    spinDecay: 0.01
  },
  bullet9mm: {
    name: '9mm Bullet',
    mass: 0.008,
    diameter: 0.009,
    dragCoefficient: 0.295,
    spinDecay: 0.001
  },
  arrow: {
    name: 'Arrow',
    mass: 0.025,
    diameter: 0.008,
    dragCoefficient: 0.05, // streamlined
    spinDecay: 0.2
  },
  football: {
    name: 'Football',
    mass: 0.425,
    diameter: 0.11, // short axis
    dragCoefficient: 0.1, // spinning stabilized
    spinDecay: 0.15
  },
  tennisball: {
    name: 'Tennis Ball',
    mass: 0.058,
    diameter: 0.067,
    dragCoefficient: 0.55, // fuzzy surface
    spinDecay: 0.2
  },
  soccerball: {
    name: 'Soccer Ball',
    mass: 0.43,
    diameter: 0.22,
    dragCoefficient: 0.25,
    spinDecay: 0.1
  }
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
    z: a.x * b.y - a.y * b.x
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ============================================================================
// Air Density Calculations
// ============================================================================

/**
 * Calculate air density based on temperature, pressure, and humidity
 * Using the ideal gas law with humidity correction
 */
function calculateAirDensity(
  temperature: number, // K
  pressure: number, // Pa
  humidity: number // 0-1
): number {
  // Saturation vapor pressure (Tetens equation)
  const tempC = temperature - 273.15;
  const satVaporPressure = 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3));

  // Actual vapor pressure
  const vaporPressure = humidity * satVaporPressure;

  // Partial pressure of dry air
  const dryAirPressure = pressure - vaporPressure;

  // Density using ideal gas law with humidity correction
  // ρ = (p_d / R_d + p_v / R_v) / T
  const R_d = 287.058; // Gas constant for dry air
  const R_v = 461.495; // Gas constant for water vapor

  return (dryAirPressure / (R_d * temperature)) + (vaporPressure / (R_v * temperature));
}

/**
 * Calculate speed of sound based on temperature
 */
function calculateSpeedOfSound(temperature: number): number {
  // c = sqrt(γ * R * T) where γ = 1.4 for air
  return Math.sqrt(1.4 * GAS_CONSTANT * temperature);
}

/**
 * Calculate drag coefficient variation with Mach number
 * Drag increases significantly near and above Mach 1
 */
function getDragCoefficientAtMach(baseCd: number, machNumber: number): number {
  if (machNumber < 0.8) {
    // Subsonic - constant drag
    return baseCd;
  } else if (machNumber < 1.2) {
    // Transonic - drag increases rapidly
    const transitionFactor = (machNumber - 0.8) / 0.4;
    return baseCd * (1 + 1.5 * transitionFactor);
  } else if (machNumber < 2.0) {
    // Supersonic - drag decreases gradually
    return baseCd * (2.5 - 0.5 * (machNumber - 1.2));
  } else {
    // Hypersonic
    return baseCd * 1.5;
  }
}

// ============================================================================
// Force Calculations
// ============================================================================

/**
 * Calculate gravitational force
 */
function calculateGravityForce(mass: number, gravity: number): Vector3 {
  return { x: 0, y: -mass * gravity, z: 0 };
}

/**
 * Calculate drag force
 * F_d = 0.5 * ρ * v² * C_d * A
 */
function calculateDragForce(
  state: ProjectileState,
  env: EnvironmentConfig
): Vector3 {
  // Velocity relative to air (accounting for wind)
  const relativeVelocity = vec3Sub(state.velocity, env.wind);
  const speed = vec3Magnitude(relativeVelocity);

  if (speed < 0.001) return { x: 0, y: 0, z: 0 };

  // Calculate Mach number and adjust drag coefficient
  const soundSpeed = calculateSpeedOfSound(env.temperature);
  const machNumber = speed / soundSpeed;
  const cd = getDragCoefficientAtMach(state.dragCoefficient, machNumber);

  // Drag magnitude
  const dragMagnitude = 0.5 * env.airDensity * speed * speed * cd * state.crossSectionalArea;

  // Drag direction (opposite to relative velocity)
  const dragDirection = vec3Normalize(vec3Scale(relativeVelocity, -1));

  return vec3Scale(dragDirection, dragMagnitude);
}

/**
 * Calculate Coriolis force
 * F_c = -2m(Ω × v)
 * where Ω is Earth's rotation vector
 */
function calculateCoriolisForce(
  state: ProjectileState,
  env: EnvironmentConfig
): Vector3 {
  if (!env.enableCoriolis) return { x: 0, y: 0, z: 0 };

  const latRad = env.latitude * Math.PI / 180;

  // Earth's rotation vector in local coordinates
  // Ω = ω * (0, cos(lat), sin(lat)) in local East-North-Up frame
  const omega: Vector3 = {
    x: 0,
    y: EARTH_ROTATION_RATE * Math.cos(latRad),
    z: EARTH_ROTATION_RATE * Math.sin(latRad)
  };

  // Coriolis acceleration: -2(Ω × v)
  const cross = vec3Cross(omega, state.velocity);
  return vec3Scale(cross, -2 * state.mass);
}

/**
 * Calculate Magnus force (due to spin)
 * F_m = 0.5 * ρ * A * C_L * |v|² * (ω̂ × v̂)
 */
function calculateMagnusForce(
  state: ProjectileState,
  env: EnvironmentConfig
): Vector3 {
  if (!env.enableMagnusEffect || vec3Magnitude(env.spinRate) < 0.001) {
    return { x: 0, y: 0, z: 0 };
  }

  const relativeVelocity = vec3Sub(state.velocity, env.wind);
  const speed = vec3Magnitude(relativeVelocity);

  if (speed < 0.001) return { x: 0, y: 0, z: 0 };

  // Lift coefficient depends on spin parameter S = rω/v
  const radius = Math.sqrt(state.crossSectionalArea / Math.PI);
  const spinMagnitude = vec3Magnitude(env.spinRate);
  const spinParameter = radius * spinMagnitude / speed;

  // Empirical lift coefficient (simplified)
  const liftCoefficient = 0.5 * spinParameter;

  // Magnus force direction: spin axis × velocity direction
  const spinDirection = vec3Normalize(env.spinRate);
  const velocityDirection = vec3Normalize(relativeVelocity);
  const magnusDirection = vec3Cross(spinDirection, velocityDirection);

  const magnusMagnitude = 0.5 * env.airDensity * state.crossSectionalArea *
                         liftCoefficient * speed * speed;

  return vec3Scale(magnusDirection, magnusMagnitude);
}

/**
 * Calculate total acceleration
 */
function calculateTotalAcceleration(
  state: ProjectileState,
  env: EnvironmentConfig
): Vector3 {
  const gravityForce = calculateGravityForce(state.mass, env.gravity);
  const dragForce = calculateDragForce(state, env);
  const coriolisForce = calculateCoriolisForce(state, env);
  const magnusForce = calculateMagnusForce(state, env);

  const totalForce = vec3Add(
    vec3Add(gravityForce, dragForce),
    vec3Add(coriolisForce, magnusForce)
  );

  return vec3Scale(totalForce, 1 / state.mass);
}

// ============================================================================
// Integration Methods
// ============================================================================

/**
 * Runge-Kutta 4th order integration
 */
function rk4Step(
  state: ProjectileState,
  env: EnvironmentConfig,
  dt: number
): ProjectileState {
  // k1
  const a1 = calculateTotalAcceleration(state, env);
  const k1_v = a1;
  const k1_p = state.velocity;

  // k2
  const state2: ProjectileState = {
    ...state,
    position: vec3Add(state.position, vec3Scale(k1_p, 0.5 * dt)),
    velocity: vec3Add(state.velocity, vec3Scale(k1_v, 0.5 * dt))
  };
  const a2 = calculateTotalAcceleration(state2, env);
  const k2_v = a2;
  const k2_p = state2.velocity;

  // k3
  const state3: ProjectileState = {
    ...state,
    position: vec3Add(state.position, vec3Scale(k2_p, 0.5 * dt)),
    velocity: vec3Add(state.velocity, vec3Scale(k2_v, 0.5 * dt))
  };
  const a3 = calculateTotalAcceleration(state3, env);
  const k3_v = a3;
  const k3_p = state3.velocity;

  // k4
  const state4: ProjectileState = {
    ...state,
    position: vec3Add(state.position, vec3Scale(k3_p, dt)),
    velocity: vec3Add(state.velocity, vec3Scale(k3_v, dt))
  };
  const a4 = calculateTotalAcceleration(state4, env);
  const k4_v = a4;
  const k4_p = state4.velocity;

  // Combine
  const newPosition = vec3Add(
    state.position,
    vec3Scale(vec3Add(vec3Add(k1_p, vec3Scale(k2_p, 2)), vec3Add(vec3Scale(k3_p, 2), k4_p)), dt / 6)
  );

  const newVelocity = vec3Add(
    state.velocity,
    vec3Scale(vec3Add(vec3Add(k1_v, vec3Scale(k2_v, 2)), vec3Add(vec3Scale(k3_v, 2), k4_v)), dt / 6)
  );

  return {
    ...state,
    position: newPosition,
    velocity: newVelocity,
    time: state.time + dt
  };
}

// ============================================================================
// Trajectory Simulation
// ============================================================================

/**
 * Run full trajectory simulation
 */
function simulateTrajectory(params: {
  initialPosition?: Vector3;
  initialSpeed: number;
  launchAngle: number; // degrees from horizontal
  launchAzimuth?: number; // degrees from north (for 3D)
  projectileType?: string;
  mass?: number;
  diameter?: number;
  dragCoefficient?: number;
  environment?: Partial<EnvironmentConfig>;
  maxTime?: number;
  timestep?: number;
}): SimulationResult {
  // Setup environment
  const env: EnvironmentConfig = {
    gravity: params.environment?.gravity ?? STANDARD_GRAVITY,
    airDensity: params.environment?.airDensity ??
      calculateAirDensity(
        params.environment?.temperature ?? STANDARD_TEMPERATURE,
        params.environment?.pressure ?? STANDARD_PRESSURE,
        params.environment?.humidity ?? 0.5
      ),
    wind: params.environment?.wind ?? { x: 0, y: 0, z: 0 },
    temperature: params.environment?.temperature ?? STANDARD_TEMPERATURE,
    pressure: params.environment?.pressure ?? STANDARD_PRESSURE,
    humidity: params.environment?.humidity ?? 0.5,
    latitude: params.environment?.latitude ?? 45,
    enableCoriolis: params.environment?.enableCoriolis ?? false,
    enableMagnusEffect: params.environment?.enableMagnusEffect ?? false,
    spinRate: params.environment?.spinRate ?? { x: 0, y: 0, z: 0 }
  };

  // Setup projectile
  let projectile: ProjectileType;
  if (params.projectileType && PROJECTILE_PRESETS[params.projectileType]) {
    projectile = PROJECTILE_PRESETS[params.projectileType];
  } else {
    projectile = {
      name: 'Custom',
      mass: params.mass || 1,
      diameter: params.diameter || 0.1,
      dragCoefficient: params.dragCoefficient || 0.47,
      spinDecay: 0.1
    };
  }

  // Override with custom values if provided
  const mass = params.mass ?? projectile.mass;
  const diameter = params.diameter ?? projectile.diameter;
  const dragCoefficient = params.dragCoefficient ?? projectile.dragCoefficient;
  const crossSectionalArea = Math.PI * (diameter / 2) * (diameter / 2);

  // Calculate initial velocity components
  const angleRad = params.launchAngle * Math.PI / 180;
  const azimuthRad = (params.launchAzimuth ?? 0) * Math.PI / 180;

  const horizontalSpeed = params.initialSpeed * Math.cos(angleRad);
  const initialVelocity: Vector3 = {
    x: horizontalSpeed * Math.sin(azimuthRad),
    y: params.initialSpeed * Math.sin(angleRad),
    z: horizontalSpeed * Math.cos(azimuthRad)
  };

  // Initial state
  let state: ProjectileState = {
    position: params.initialPosition ?? { x: 0, y: 0, z: 0 },
    velocity: initialVelocity,
    mass,
    crossSectionalArea,
    dragCoefficient,
    time: 0
  };

  // Simulation parameters
  const dt = params.timestep || 0.001;
  const maxTime = params.maxTime || 1000;
  const recordInterval = Math.max(1, Math.floor(0.01 / dt)); // Record every ~0.01s

  // Trajectory storage
  const trajectory: TrajectoryPoint[] = [];

  // Analysis variables
  let maxHeight = state.position.y;
  let maxHeightTime = 0;
  let maxSpeed = vec3Magnitude(state.velocity);
  let totalSpeed = maxSpeed;
  let speedCount = 1;

  const initialKE = 0.5 * mass * Math.pow(vec3Magnitude(initialVelocity), 2);

  // Simulation loop
  let step = 0;
  while (state.position.y >= 0 && state.time < maxTime) {
    const speed = vec3Magnitude(state.velocity);
    const soundSpeed = calculateSpeedOfSound(env.temperature);
    const machNumber = speed / soundSpeed;
    const acceleration = calculateTotalAcceleration(state, env);
    const dragForce = vec3Magnitude(calculateDragForce(state, env));

    // Record trajectory point
    if (step % recordInterval === 0) {
      trajectory.push({
        time: state.time,
        position: { ...state.position },
        velocity: { ...state.velocity },
        speed,
        acceleration: { ...acceleration },
        dragForce,
        machNumber
      });
    }

    // Track analysis metrics
    if (state.position.y > maxHeight) {
      maxHeight = state.position.y;
      maxHeightTime = state.time;
    }
    maxSpeed = Math.max(maxSpeed, speed);
    totalSpeed += speed;
    speedCount++;

    // Update spin (decay over time)
    if (env.enableMagnusEffect) {
      env.spinRate = vec3Scale(env.spinRate, 1 - projectile.spinDecay * dt);
    }

    // Step forward
    state = rk4Step(state, env, dt);
    step++;
  }

  // Interpolate exact impact point
  if (trajectory.length >= 2) {
    const last = trajectory[trajectory.length - 1];
    const prev = trajectory[trajectory.length - 2];
    if (last.position.y < 0 && prev.position.y >= 0) {
      // Linear interpolation to ground
      const t = -prev.position.y / (last.position.y - prev.position.y);
      const impactPos: Vector3 = {
        x: prev.position.x + t * (last.position.x - prev.position.x),
        y: 0,
        z: prev.position.z + t * (last.position.z - prev.position.z)
      };
      const impactVel: Vector3 = {
        x: prev.velocity.x + t * (last.velocity.x - prev.velocity.x),
        y: prev.velocity.y + t * (last.velocity.y - prev.velocity.y),
        z: prev.velocity.z + t * (last.velocity.z - prev.velocity.z)
      };
      const impactTime = prev.time + t * (last.time - prev.time);

      trajectory[trajectory.length - 1] = {
        time: impactTime,
        position: impactPos,
        velocity: impactVel,
        speed: vec3Magnitude(impactVel),
        acceleration: last.acceleration,
        dragForce: last.dragForce,
        machNumber: last.machNumber
      };
    }
  }

  // Calculate final analysis
  const finalPoint = trajectory[trajectory.length - 1];
  const range = Math.sqrt(
    Math.pow(finalPoint.position.x, 2) + Math.pow(finalPoint.position.z, 2)
  );
  const impactVelocity = finalPoint.speed;
  const impactAngle = Math.atan2(-finalPoint.velocity.y,
    Math.sqrt(finalPoint.velocity.x * finalPoint.velocity.x +
              finalPoint.velocity.z * finalPoint.velocity.z)) * 180 / Math.PI;
  const finalKE = 0.5 * mass * impactVelocity * impactVelocity;
  const lateralDrift = finalPoint.position.x; // Drift perpendicular to initial direction

  const analysis: TrajectoryAnalysis = {
    maxHeight,
    maxHeightTime,
    range,
    totalTime: finalPoint.time,
    impactVelocity,
    impactAngle,
    maxSpeed,
    averageSpeed: totalSpeed / speedCount,
    initialKineticEnergy: initialKE,
    finalKineticEnergy: finalKE,
    energyLostToDrag: initialKE - finalKE,
    lateralDrift
  };

  return {
    trajectory,
    analysis,
    finalState: state,
    environment: env
  };
}

/**
 * Calculate trajectory without air resistance (analytical)
 */
function calculateIdealTrajectory(params: {
  initialSpeed: number;
  launchAngle: number;
  gravity?: number;
  initialHeight?: number;
}): {
  maxHeight: number;
  range: number;
  totalTime: number;
  trajectoryEquation: string;
} {
  const g = params.gravity ?? STANDARD_GRAVITY;
  const v0 = params.initialSpeed;
  const theta = params.launchAngle * Math.PI / 180;
  const h0 = params.initialHeight ?? 0;

  const v0x = v0 * Math.cos(theta);
  const v0y = v0 * Math.sin(theta);

  // Max height: h_max = h0 + v0y² / (2g)
  const maxHeight = h0 + (v0y * v0y) / (2 * g);

  // Time to max height: t_max = v0y / g
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _timeToMax = v0y / g;

  // Total time: solve h0 + v0y*t - 0.5*g*t² = 0
  // t = (v0y + sqrt(v0y² + 2*g*h0)) / g
  const totalTime = (v0y + Math.sqrt(v0y * v0y + 2 * g * h0)) / g;

  // Range: R = v0x * totalTime
  const range = v0x * totalTime;

  return {
    maxHeight,
    range,
    totalTime,
    trajectoryEquation: `y = ${h0.toFixed(2)} + ${v0y.toFixed(2)}t - ${(0.5*g).toFixed(2)}t²`
  };
}

/**
 * Find optimal launch angle for maximum range (with or without drag)
 */
function findOptimalAngle(params: {
  initialSpeed: number;
  projectileType?: string;
  environment?: Partial<EnvironmentConfig>;
  includeAirResistance?: boolean;
}): { optimalAngle: number; maxRange: number; idealAngle: number } {
  if (!params.includeAirResistance) {
    // Without air resistance, optimal angle is 45 degrees
    const idealResult = calculateIdealTrajectory({
      initialSpeed: params.initialSpeed,
      launchAngle: 45
    });
    return {
      optimalAngle: 45,
      maxRange: idealResult.range,
      idealAngle: 45
    };
  }

  // With air resistance, search for optimal angle
  let maxRange = 0;
  let optimalAngle = 45;

  for (let angle = 20; angle <= 70; angle += 1) {
    const result = simulateTrajectory({
      initialSpeed: params.initialSpeed,
      launchAngle: angle,
      projectileType: params.projectileType,
      environment: params.environment
    });

    if (result.analysis.range > maxRange) {
      maxRange = result.analysis.range;
      optimalAngle = angle;
    }
  }

  // Fine-tune with smaller steps
  for (let angle = optimalAngle - 1; angle <= optimalAngle + 1; angle += 0.1) {
    const result = simulateTrajectory({
      initialSpeed: params.initialSpeed,
      launchAngle: angle,
      projectileType: params.projectileType,
      environment: params.environment
    });

    if (result.analysis.range > maxRange) {
      maxRange = result.analysis.range;
      optimalAngle = angle;
    }
  }

  return {
    optimalAngle: Math.round(optimalAngle * 10) / 10,
    maxRange,
    idealAngle: 45
  };
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const projectilemotionTool: UnifiedTool = {
  name: 'projectile_motion',
  description: 'Comprehensive projectile motion simulation with realistic physics. Supports air resistance, drag coefficients, wind effects, Coriolis effect, Magnus effect (spin), and multiple projectile types.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'ideal', 'optimal_angle', 'compare', 'info'],
        description: 'Operation type'
      },
      initialSpeed: { type: 'number', description: 'Initial speed in m/s' },
      launchAngle: { type: 'number', description: 'Launch angle in degrees from horizontal' },
      launchAzimuth: { type: 'number', description: 'Launch direction in degrees from north' },
      projectileType: {
        type: 'string',
        enum: ['baseball', 'golfBall', 'cannonball', 'bullet9mm', 'arrow', 'football', 'tennisball', 'soccerball'],
        description: 'Preset projectile type'
      },
      mass: { type: 'number', description: 'Projectile mass in kg' },
      diameter: { type: 'number', description: 'Projectile diameter in meters' },
      dragCoefficient: { type: 'number', description: 'Drag coefficient' },
      initialPosition: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' }
        },
        description: 'Initial position'
      },
      environment: {
        type: 'object',
        properties: {
          gravity: { type: 'number' },
          airDensity: { type: 'number' },
          wind: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
          },
          temperature: { type: 'number', description: 'Temperature in Kelvin' },
          pressure: { type: 'number', description: 'Pressure in Pa' },
          humidity: { type: 'number', description: 'Relative humidity (0-1)' },
          latitude: { type: 'number', description: 'Latitude for Coriolis calculation' },
          enableCoriolis: { type: 'boolean' },
          enableMagnusEffect: { type: 'boolean' },
          spinRate: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
          }
        }
      },
      maxTime: { type: 'number', description: 'Maximum simulation time in seconds' },
      timestep: { type: 'number', description: 'Simulation timestep in seconds' },
      includeAirResistance: { type: 'boolean', description: 'Include air resistance in calculation' }
    },
    required: ['operation']
  }
};

export async function executeprojectilemotion(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate': {
        if (!args.initialSpeed || args.launchAngle === undefined) {
          throw new Error('initialSpeed and launchAngle are required');
        }
        result = simulateTrajectory({
          initialPosition: args.initialPosition,
          initialSpeed: args.initialSpeed,
          launchAngle: args.launchAngle,
          launchAzimuth: args.launchAzimuth,
          projectileType: args.projectileType,
          mass: args.mass,
          diameter: args.diameter,
          dragCoefficient: args.dragCoefficient,
          environment: args.environment,
          maxTime: args.maxTime,
          timestep: args.timestep
        });
        break;
      }

      case 'ideal': {
        if (!args.initialSpeed || args.launchAngle === undefined) {
          throw new Error('initialSpeed and launchAngle are required');
        }
        result = calculateIdealTrajectory({
          initialSpeed: args.initialSpeed,
          launchAngle: args.launchAngle,
          gravity: args.environment?.gravity,
          initialHeight: args.initialPosition?.y
        });
        break;
      }

      case 'optimal_angle': {
        if (!args.initialSpeed) {
          throw new Error('initialSpeed is required');
        }
        result = findOptimalAngle({
          initialSpeed: args.initialSpeed,
          projectileType: args.projectileType,
          environment: args.environment,
          includeAirResistance: args.includeAirResistance ?? true
        });
        break;
      }

      case 'compare': {
        if (!args.initialSpeed || args.launchAngle === undefined) {
          throw new Error('initialSpeed and launchAngle are required');
        }
        const withDrag = simulateTrajectory({
          initialSpeed: args.initialSpeed,
          launchAngle: args.launchAngle,
          projectileType: args.projectileType,
          environment: args.environment
        });
        const noDrag = calculateIdealTrajectory({
          initialSpeed: args.initialSpeed,
          launchAngle: args.launchAngle,
          gravity: args.environment?.gravity,
          initialHeight: args.initialPosition?.y
        });
        result = {
          withAirResistance: withDrag.analysis,
          withoutAirResistance: noDrag,
          rangeReduction: ((noDrag.range - withDrag.analysis.range) / noDrag.range * 100).toFixed(1) + '%',
          timeReduction: ((noDrag.totalTime - withDrag.analysis.totalTime) / noDrag.totalTime * 100).toFixed(1) + '%'
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: 'Projectile motion simulation with comprehensive physics',
          features: [
            'Air resistance with drag coefficient',
            'Variable drag with Mach number',
            'Wind effects',
            'Coriolis effect (Earth rotation)',
            'Magnus effect (spin)',
            'Multiple projectile presets',
            'Humidity/temperature/pressure effects on air density',
            'RK4 integration'
          ],
          projectilePresets: Object.keys(PROJECTILE_PRESETS).map(key => ({
            type: key,
            ...PROJECTILE_PRESETS[key]
          })),
          constants: {
            STANDARD_GRAVITY,
            STANDARD_AIR_DENSITY,
            SPEED_OF_SOUND,
            EARTH_ROTATION_RATE
          },
          operations: ['simulate', 'ideal', 'optimal_angle', 'compare', 'info']
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isprojectilemotionAvailable(): boolean { return true; }
