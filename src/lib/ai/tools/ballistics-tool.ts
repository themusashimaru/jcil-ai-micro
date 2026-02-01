// ============================================================================
// BALLISTICS TOOL - TIER INFINITY
// ============================================================================
// Projectile motion calculations: trajectory with drag, wind effects,
// terminal velocity, Coriolis effect, and range estimation.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const G = 9.80665; // Standard gravity (m/s²)
const RHO_SL = 1.225; // Air density at sea level (kg/m³)
const EARTH_ANGULAR_VEL = 7.2921e-5; // Earth rotation (rad/s)

// Common projectile drag coefficients
const PROJECTILE_CD: Record<string, { cd: number; bc: number; name: string }> = {
  sphere: { cd: 0.47, bc: 0.1, name: 'Smooth Sphere' },
  bullet_blunt: { cd: 0.35, bc: 0.3, name: 'Blunt Bullet' },
  bullet_spitzer: { cd: 0.295, bc: 0.45, name: 'Spitzer Bullet' },
  bullet_boat_tail: { cd: 0.25, bc: 0.55, name: 'Boat Tail Bullet' },
  arrow: { cd: 0.35, bc: 0.02, name: 'Arrow' },
  baseball: { cd: 0.35, bc: 0.05, name: 'Baseball' },
  golf_ball: { cd: 0.25, bc: 0.02, name: 'Golf Ball (dimpled)' },
  artillery: { cd: 0.3, bc: 0.5, name: 'Artillery Shell' },
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

// Air density at altitude (simplified ISA)
function airDensity(altitude: number): number {
  return RHO_SL * Math.exp(-altitude / 8500);
}

// Terminal velocity
function terminalVelocity(mass: number, cd: number, area: number, rho: number = RHO_SL): number {
  return Math.sqrt((2 * mass * G) / (rho * cd * area));
}

// Cross-sectional area from diameter
function crossSectionArea(diameter: number): number {
  return Math.PI * Math.pow(diameter / 2, 2);
}

// Trajectory simulation with drag
interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  v: number;
}

function simulateTrajectory(
  v0: number,
  angleDeg: number,
  azimuthDeg: number,
  mass: number,
  cd: number,
  area: number,
  altitude: number,
  windX: number = 0,
  windZ: number = 0,
  dt: number = 0.01,
  maxTime: number = 300
): TrajectoryPoint[] {
  const trajectory: TrajectoryPoint[] = [];

  // Initial conditions
  const angleRad = (angleDeg * Math.PI) / 180;
  const azimuthRad = (azimuthDeg * Math.PI) / 180;

  let x = 0,
    y = altitude,
    z = 0;
  let vx = v0 * Math.cos(angleRad) * Math.cos(azimuthRad);
  let vy = v0 * Math.sin(angleRad);
  let vz = v0 * Math.cos(angleRad) * Math.sin(azimuthRad);

  let t = 0;

  while (y >= 0 && t < maxTime) {
    // Store point
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
    trajectory.push({ t, x, y, z, vx, vy, vz, v });

    // Air density at current altitude
    const rho = airDensity(y);

    // Relative velocity (accounting for wind)
    const vRelX = vx - windX;
    const vRelZ = vz - windZ;
    const vRel = Math.sqrt(vRelX * vRelX + vy * vy + vRelZ * vRelZ);

    // Drag acceleration
    const dragAcc = (0.5 * rho * vRel * vRel * cd * area) / mass;
    const ax = -dragAcc * (vRelX / vRel);
    const ay = -G - dragAcc * (vy / vRel);
    const az = -dragAcc * (vRelZ / vRel);

    // Update velocity
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    // Update position
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;

    t += dt;
  }

  // Interpolate final landing point
  if (trajectory.length > 1) {
    const last = trajectory[trajectory.length - 1];
    const prev = trajectory[trajectory.length - 2];
    if (last.y < 0 && prev.y >= 0) {
      const ratio = prev.y / (prev.y - last.y);
      const v = Math.sqrt(last.vx * last.vx + last.vy * last.vy + last.vz * last.vz);
      trajectory.push({
        t: prev.t + ratio * dt,
        x: prev.x + ratio * (last.x - prev.x),
        y: 0,
        z: prev.z + ratio * (last.z - prev.z),
        vx: last.vx,
        vy: last.vy,
        vz: last.vz,
        v,
      });
    }
  }

  return trajectory;
}

// Maximum range angle (with drag, approximate)
function optimalAngle(cd: number, v0: number, mass: number, area: number): number {
  // For high drag, optimal angle is less than 45°
  const dragFactor = (RHO_SL * cd * area * v0 * v0) / (2 * mass * G);
  // Approximate formula
  return 45 - 5 * Math.min(dragFactor, 5);
}

// Coriolis deflection
function coriolisDeflection(v0: number, range: number, latitude: number, azimuth: number): number {
  const latRad = (latitude * Math.PI) / 180;
  const azRad = (azimuth * Math.PI) / 180;
  const flightTime = range / v0;

  // Simplified Coriolis deflection
  const deflection = 2 * EARTH_ANGULAR_VEL * v0 * flightTime * Math.sin(latRad) * Math.sin(azRad);
  return deflection;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const ballisticsTool: UnifiedTool = {
  name: 'ballistics',
  description: `Ballistics and projectile motion calculations.

Operations:
- trajectory: Full trajectory simulation with drag
- simple: Basic projectile motion (no drag)
- terminal: Terminal velocity calculation
- range: Quick range estimation
- coriolis: Coriolis effect deflection
- projectiles: List projectile types and drag coefficients`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['trajectory', 'simple', 'terminal', 'range', 'coriolis', 'projectiles'],
        description: 'Calculation to perform',
      },
      v0: { type: 'number', description: 'Initial velocity (m/s)' },
      angle: { type: 'number', description: 'Launch angle (degrees)' },
      azimuth: { type: 'number', description: 'Azimuth angle (degrees, 0=North)' },
      mass: { type: 'number', description: 'Projectile mass (kg)' },
      diameter: { type: 'number', description: 'Projectile diameter (m)' },
      cd: { type: 'number', description: 'Drag coefficient' },
      projectile_type: { type: 'string', description: 'Projectile type key' },
      altitude: { type: 'number', description: 'Initial altitude (m)' },
      wind_x: { type: 'number', description: 'Headwind (+) or tailwind (-) (m/s)' },
      wind_z: { type: 'number', description: 'Crosswind (m/s)' },
      latitude: { type: 'number', description: 'Latitude for Coriolis (degrees)' },
      target_distance: { type: 'number', description: 'Distance to target (m)' },
      target_height: { type: 'number', description: 'Target height (m)' },
      dt: { type: 'number', description: 'Time step for simulation (s)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBallistics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // Get projectile properties
    let cd = args.cd || 0.47;
    if (args.projectile_type && PROJECTILE_CD[args.projectile_type]) {
      cd = PROJECTILE_CD[args.projectile_type].cd;
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'trajectory': {
        const { v0, angle, azimuth, mass, diameter, altitude, wind_x, wind_z, dt } = args;
        if (!v0 || !mass || !diameter) {
          throw new Error('trajectory requires v0, mass, and diameter');
        }

        const area = crossSectionArea(diameter);
        const launchAngle = angle || 45;
        const launchAzimuth = azimuth || 0;
        const startAlt = altitude || 0;

        const trajectory = simulateTrajectory(
          v0,
          launchAngle,
          launchAzimuth,
          mass,
          cd,
          area,
          startAlt,
          wind_x || 0,
          wind_z || 0,
          dt || 0.01
        );

        const landing = trajectory[trajectory.length - 1];
        const apex = trajectory.reduce((max, p) => (p.y > max.y ? p : max), trajectory[0]);

        // Sample trajectory for output
        const sampleRate = Math.max(1, Math.floor(trajectory.length / 50));
        const sampledTrajectory = trajectory.filter((_, i) => i % sampleRate === 0);

        result = {
          operation: 'trajectory',
          inputs: {
            v0_m_s: v0,
            angle_deg: launchAngle,
            azimuth_deg: launchAzimuth,
            mass_kg: mass,
            diameter_m: diameter,
            cd,
          },
          results: {
            range_m: Math.sqrt(landing.x * landing.x + landing.z * landing.z),
            range_x_m: landing.x,
            range_z_m: landing.z,
            flight_time_s: landing.t,
            max_height_m: apex.y,
            time_to_apex_s: apex.t,
            impact_velocity_m_s: landing.v,
            impact_angle_deg:
              (Math.atan2(
                -landing.vy,
                Math.sqrt(landing.vx * landing.vx + landing.vz * landing.vz)
              ) *
                180) /
              Math.PI,
          },
          trajectory_sample: sampledTrajectory.map((p) => ({
            t: p.t.toFixed(2),
            x: p.x.toFixed(1),
            y: p.y.toFixed(1),
            v: p.v.toFixed(1),
          })),
        };
        break;
      }

      case 'simple': {
        const { v0, angle, altitude } = args;
        if (!v0) {
          throw new Error('simple requires v0');
        }

        const launchAngle = angle || 45;
        const angleRad = (launchAngle * Math.PI) / 180;
        const h0 = altitude || 0;

        const vx = v0 * Math.cos(angleRad);
        const vy = v0 * Math.sin(angleRad);

        // Time of flight (solving quadratic for y = 0)
        const tFlight = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G;

        // Range
        const range = vx * tFlight;

        // Max height
        const maxHeight = h0 + (vy * vy) / (2 * G);

        // Time to max height
        const tApex = vy / G;

        result = {
          operation: 'simple',
          inputs: { v0_m_s: v0, angle_deg: launchAngle, altitude_m: h0 },
          results: {
            range_m: range,
            max_height_m: maxHeight,
            flight_time_s: tFlight,
            time_to_apex_s: tApex,
            impact_velocity_m_s: Math.sqrt(vx * vx + Math.pow(vy - G * tFlight, 2)),
          },
          note: 'No air resistance - actual range will be shorter',
        };
        break;
      }

      case 'terminal': {
        const { mass, diameter } = args;
        if (!mass || !diameter) {
          throw new Error('terminal requires mass and diameter');
        }

        const area = crossSectionArea(diameter);
        const vTerm = terminalVelocity(mass, cd, area);

        // Time to reach 99% terminal velocity (approximate)
        const tChar = vTerm / G;
        const t99 = 4.6 * tChar;

        result = {
          operation: 'terminal',
          inputs: { mass_kg: mass, diameter_m: diameter, cd },
          results: {
            terminal_velocity_m_s: vTerm,
            terminal_velocity_km_h: vTerm * 3.6,
            terminal_velocity_mph: vTerm * 2.237,
            time_to_99pct_s: t99,
            characteristic_time_s: tChar,
          },
        };
        break;
      }

      case 'range': {
        const { v0, angle, mass, diameter } = args;
        if (!v0) {
          throw new Error('range requires v0');
        }

        const launchAngle = angle || 45;
        const angleRad = (launchAngle * Math.PI) / 180;

        // Vacuum range
        const vacuumRange = (v0 * v0 * Math.sin(2 * angleRad)) / G;

        // Estimate drag reduction
        let dragFactor = 1;
        if (mass && diameter) {
          const area = crossSectionArea(diameter);
          const dragParam = (RHO_SL * cd * area * v0 * v0) / (2 * mass * G);
          dragFactor = Math.exp(-0.15 * dragParam);
        }

        const estimatedRange = vacuumRange * dragFactor;
        const optAngle =
          mass && diameter ? optimalAngle(cd, v0, mass, crossSectionArea(diameter)) : 45;

        result = {
          operation: 'range',
          inputs: { v0_m_s: v0, angle_deg: launchAngle },
          results: {
            vacuum_range_m: vacuumRange,
            estimated_actual_range_m: estimatedRange,
            optimal_angle_deg: optAngle,
            drag_reduction_factor: dragFactor,
          },
          note: 'Use trajectory simulation for accurate results',
        };
        break;
      }

      case 'coriolis': {
        const { v0, target_distance, latitude, azimuth } = args;
        if (!v0 || !target_distance || latitude === undefined) {
          throw new Error('coriolis requires v0, target_distance, and latitude');
        }

        const deflection = coriolisDeflection(v0, target_distance, latitude, azimuth || 90);
        const flightTime = target_distance / v0;

        result = {
          operation: 'coriolis',
          inputs: {
            v0_m_s: v0,
            distance_m: target_distance,
            latitude_deg: latitude,
            azimuth_deg: azimuth || 90,
          },
          results: {
            deflection_m: Math.abs(deflection),
            deflection_direction: deflection > 0 ? 'right' : 'left',
            flight_time_s: flightTime,
            deflection_moa: (Math.abs(deflection) / target_distance) * 3438,
          },
          note: 'Northern hemisphere: deflection is to the right. Southern: to the left.',
        };
        break;
      }

      case 'projectiles': {
        result = {
          operation: 'projectiles',
          available: Object.entries(PROJECTILE_CD).map(([key, val]) => ({
            key,
            name: val.name,
            drag_coefficient: val.cd,
            ballistic_coefficient: val.bc,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isBallisticsAvailable(): boolean {
  return true;
}
