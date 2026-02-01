/**
 * ORBITAL MECHANICS TOOL
 *
 * Celestial mechanics and space mission calculations.
 * Essential for aerospace engineering and astrophysics.
 *
 * Features:
 * - Kepler's laws and orbital elements
 * - Hohmann transfer calculations
 * - Delta-v budgets
 * - Orbital period and velocity
 * - Escape velocity
 * - Orbital element conversions
 * - Vis-viva equation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const AU = 1.496e11; // Astronomical unit (m)

// Central body properties
const BODIES: Record<string, { mass: number; radius: number; mu: number }> = {
  sun: { mass: 1.989e30, radius: 6.96e8, mu: 1.327e20 },
  earth: { mass: 5.972e24, radius: 6.371e6, mu: 3.986e14 },
  moon: { mass: 7.342e22, radius: 1.737e6, mu: 4.905e12 },
  mars: { mass: 6.417e23, radius: 3.39e6, mu: 4.283e13 },
  jupiter: { mass: 1.898e27, radius: 6.991e7, mu: 1.267e17 },
  venus: { mass: 4.867e24, radius: 6.052e6, mu: 3.249e14 },
  saturn: { mass: 5.683e26, radius: 5.823e7, mu: 3.793e16 },
};

// ============================================================================
// ORBITAL CALCULATIONS
// ============================================================================

// Orbital velocity (vis-viva equation)
function orbitalVelocity(r: number, a: number, mu: number): number {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

// Circular orbital velocity
function circularVelocity(r: number, mu: number): number {
  return Math.sqrt(mu / r);
}

// Escape velocity
function escapeVelocity(r: number, mu: number): number {
  return Math.sqrt((2 * mu) / r);
}

// Orbital period (Kepler's 3rd law)
function orbitalPeriod(a: number, mu: number): number {
  return 2 * Math.PI * Math.sqrt(a ** 3 / mu);
}

// Hohmann transfer calculations
function hohmannTransfer(
  r1: number,
  r2: number,
  mu: number
): {
  deltaV1: number;
  deltaV2: number;
  totalDeltaV: number;
  transferTime: number;
  transferSemiMajor: number;
} {
  // Transfer orbit semi-major axis
  const aTransfer = (r1 + r2) / 2;

  // Velocities at r1
  const v1Circular = circularVelocity(r1, mu);
  const v1Transfer = orbitalVelocity(r1, aTransfer, mu);

  // Velocities at r2
  const v2Circular = circularVelocity(r2, mu);
  const v2Transfer = orbitalVelocity(r2, aTransfer, mu);

  // Delta-v
  const deltaV1 = Math.abs(v1Transfer - v1Circular);
  const deltaV2 = Math.abs(v2Circular - v2Transfer);

  // Transfer time (half the transfer orbit period)
  const transferTime = orbitalPeriod(aTransfer, mu) / 2;

  return {
    deltaV1,
    deltaV2,
    totalDeltaV: deltaV1 + deltaV2,
    transferTime,
    transferSemiMajor: aTransfer,
  };
}

// Bi-elliptic transfer
function biEllipticTransfer(
  r1: number,
  r2: number,
  rb: number,
  mu: number
): {
  deltaV1: number;
  deltaV2: number;
  deltaV3: number;
  totalDeltaV: number;
  transferTime: number;
} {
  // First transfer orbit
  const a1 = (r1 + rb) / 2;
  const v1_circular = circularVelocity(r1, mu);
  const v1_transfer1 = orbitalVelocity(r1, a1, mu);
  const deltaV1 = v1_transfer1 - v1_circular;

  // At apoapsis of first transfer
  const v_at_rb_1 = orbitalVelocity(rb, a1, mu);

  // Second transfer orbit
  const a2 = (rb + r2) / 2;
  const v_at_rb_2 = orbitalVelocity(rb, a2, mu);
  const deltaV2 = v_at_rb_2 - v_at_rb_1;

  // At periapsis of second transfer
  const v_at_r2 = orbitalVelocity(r2, a2, mu);
  const v2_circular = circularVelocity(r2, mu);
  const deltaV3 = v2_circular - v_at_r2;

  // Total transfer time
  const time1 = orbitalPeriod(a1, mu) / 2;
  const time2 = orbitalPeriod(a2, mu) / 2;

  return {
    deltaV1: Math.abs(deltaV1),
    deltaV2: Math.abs(deltaV2),
    deltaV3: Math.abs(deltaV3),
    totalDeltaV: Math.abs(deltaV1) + Math.abs(deltaV2) + Math.abs(deltaV3),
    transferTime: time1 + time2,
  };
}

// Orbital elements from state vectors
function stateToElements(
  r: [number, number, number],
  v: [number, number, number],
  mu: number
): {
  a: number;
  e: number;
  i: number;
  omega: number;
  Omega: number;
  nu: number;
} {
  // Position and velocity magnitudes
  const rMag = Math.sqrt(r[0] ** 2 + r[1] ** 2 + r[2] ** 2);
  const vMag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);

  // Specific angular momentum
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hMag = Math.sqrt(h[0] ** 2 + h[1] ** 2 + h[2] ** 2);

  // Node vector
  const n = [-h[1], h[0], 0];
  const nMag = Math.sqrt(n[0] ** 2 + n[1] ** 2);

  // Eccentricity vector
  const eVec = [
    ((vMag ** 2 - mu / rMag) * r[0] - (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) * v[0]) / mu,
    ((vMag ** 2 - mu / rMag) * r[1] - (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) * v[1]) / mu,
    ((vMag ** 2 - mu / rMag) * r[2] - (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) * v[2]) / mu,
  ];
  const e = Math.sqrt(eVec[0] ** 2 + eVec[1] ** 2 + eVec[2] ** 2);

  // Semi-major axis
  const a = 1 / (2 / rMag - vMag ** 2 / mu);

  // Inclination
  const i = (Math.acos(h[2] / hMag) * 180) / Math.PI;

  // Right ascension of ascending node
  let Omega = (Math.acos(n[0] / nMag) * 180) / Math.PI;
  if (n[1] < 0) Omega = 360 - Omega;

  // Argument of periapsis
  let omega = (Math.acos((n[0] * eVec[0] + n[1] * eVec[1]) / (nMag * e)) * 180) / Math.PI;
  if (eVec[2] < 0) omega = 360 - omega;

  // True anomaly
  let nu =
    (Math.acos((eVec[0] * r[0] + eVec[1] * r[1] + eVec[2] * r[2]) / (e * rMag)) * 180) / Math.PI;
  if (r[0] * v[0] + r[1] * v[1] + r[2] * v[2] < 0) nu = 360 - nu;

  return { a, e, i, omega, Omega, nu };
}

// Specific orbital energy
function specificOrbitalEnergy(r: number, v: number, mu: number): number {
  return v ** 2 / 2 - mu / r;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const orbitalMechanicsTool: UnifiedTool = {
  name: 'orbital_calc',
  description: `Orbital mechanics calculations for space missions and celestial mechanics.

Available operations:
- circular_orbit: Calculate circular orbit parameters
- elliptical_orbit: Calculate elliptical orbit parameters
- hohmann_transfer: Calculate Hohmann transfer between orbits
- bielliptic_transfer: Calculate bi-elliptic transfer
- escape_velocity: Calculate escape velocity
- orbital_elements: Convert state vectors to orbital elements
- compare_transfers: Compare Hohmann vs bi-elliptic
- mission_deltav: Calculate total mission delta-v

Central bodies: sun, earth, moon, mars, jupiter, venus, saturn`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'circular_orbit',
          'elliptical_orbit',
          'hohmann_transfer',
          'bielliptic_transfer',
          'escape_velocity',
          'orbital_elements',
          'compare_transfers',
          'mission_deltav',
        ],
        description: 'Orbital calculation',
      },
      central_body: {
        type: 'string',
        enum: ['sun', 'earth', 'moon', 'mars', 'jupiter', 'venus', 'saturn'],
        description: 'Central body (default: earth)',
      },
      altitude: {
        type: 'number',
        description: 'Orbital altitude above surface (km)',
      },
      r1: {
        type: 'number',
        description: 'Initial orbital radius (km)',
      },
      r2: {
        type: 'number',
        description: 'Final orbital radius (km)',
      },
      rb: {
        type: 'number',
        description: 'Intermediate radius for bi-elliptic transfer (km)',
      },
      periapsis: {
        type: 'number',
        description: 'Periapsis altitude (km)',
      },
      apoapsis: {
        type: 'number',
        description: 'Apoapsis altitude (km)',
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        description: 'Position vector [x, y, z] in km',
      },
      velocity: {
        type: 'array',
        items: { type: 'number' },
        description: 'Velocity vector [vx, vy, vz] in km/s',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isOrbitalMechanicsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeOrbitalMechanics(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    central_body?: string;
    altitude?: number;
    r1?: number;
    r2?: number;
    rb?: number;
    periapsis?: number;
    apoapsis?: number;
    position?: number[];
    velocity?: number[];
  };

  const {
    operation,
    central_body = 'earth',
    altitude,
    r1,
    r2,
    rb,
    periapsis,
    apoapsis,
    position,
    velocity,
  } = args;

  try {
    const body = BODIES[central_body] || BODIES.earth;
    const mu = body.mu;
    const bodyRadius = body.radius;
    const result: Record<string, unknown> = { operation, central_body };

    switch (operation) {
      case 'circular_orbit': {
        if (altitude === undefined) throw new Error('altitude is required (km)');

        const r = bodyRadius + altitude * 1000; // Convert km to m
        const v = circularVelocity(r, mu);
        const T = orbitalPeriod(r, mu);
        const vEsc = escapeVelocity(r, mu);

        result.altitude_km = altitude;
        result.orbital_radius_km = r / 1000;
        result.orbital_velocity_km_s = v / 1000;
        result.orbital_period_hours = T / 3600;
        result.orbital_period_minutes = T / 60;
        result.escape_velocity_km_s = vEsc / 1000;
        result.specific_energy = specificOrbitalEnergy(r, v, mu);

        // Special orbits
        if (central_body === 'earth') {
          const geoAlt = 35786; // km
          result.comparison = {
            is_LEO: altitude < 2000,
            is_MEO: altitude >= 2000 && altitude < 35786,
            is_GEO: Math.abs(altitude - geoAlt) < 100,
            is_HEO: altitude > geoAlt,
          };
        }
        break;
      }

      case 'elliptical_orbit': {
        if (periapsis === undefined || apoapsis === undefined) {
          throw new Error('periapsis and apoapsis altitudes required (km)');
        }

        const rp = bodyRadius + periapsis * 1000;
        const ra = bodyRadius + apoapsis * 1000;
        const a = (rp + ra) / 2;
        const e = (ra - rp) / (ra + rp);
        const T = orbitalPeriod(a, mu);

        const vp = orbitalVelocity(rp, a, mu);
        const va = orbitalVelocity(ra, a, mu);

        result.periapsis_altitude_km = periapsis;
        result.apoapsis_altitude_km = apoapsis;
        result.semi_major_axis_km = a / 1000;
        result.eccentricity = e;
        result.orbital_period_hours = T / 3600;
        result.periapsis_velocity_km_s = vp / 1000;
        result.apoapsis_velocity_km_s = va / 1000;
        result.orbit_type = e < 1 ? 'elliptical' : e === 1 ? 'parabolic' : 'hyperbolic';
        break;
      }

      case 'hohmann_transfer': {
        if (r1 === undefined || r2 === undefined) {
          throw new Error('r1 and r2 orbital radii required (km)');
        }

        const r1_m = r1 * 1000;
        const r2_m = r2 * 1000;
        const transfer = hohmannTransfer(r1_m, r2_m, mu);

        result.initial_radius_km = r1;
        result.final_radius_km = r2;
        result.delta_v1_km_s = transfer.deltaV1 / 1000;
        result.delta_v2_km_s = transfer.deltaV2 / 1000;
        result.total_delta_v_km_s = transfer.totalDeltaV / 1000;
        result.transfer_time_hours = transfer.transferTime / 3600;
        result.transfer_time_days = transfer.transferTime / 86400;
        result.transfer_semi_major_axis_km = transfer.transferSemiMajor / 1000;

        // Phase angle
        const phaseAngle = 180 * (1 - Math.pow((r1 + r2) / (2 * r2), 1.5));
        result.phase_angle_deg = phaseAngle;
        break;
      }

      case 'bielliptic_transfer': {
        if (r1 === undefined || r2 === undefined || rb === undefined) {
          throw new Error('r1, r2, and rb required (km)');
        }

        const r1_m = r1 * 1000;
        const r2_m = r2 * 1000;
        const rb_m = rb * 1000;
        const transfer = biEllipticTransfer(r1_m, r2_m, rb_m, mu);

        result.initial_radius_km = r1;
        result.final_radius_km = r2;
        result.intermediate_radius_km = rb;
        result.delta_v1_km_s = transfer.deltaV1 / 1000;
        result.delta_v2_km_s = transfer.deltaV2 / 1000;
        result.delta_v3_km_s = transfer.deltaV3 / 1000;
        result.total_delta_v_km_s = transfer.totalDeltaV / 1000;
        result.transfer_time_days = transfer.transferTime / 86400;
        break;
      }

      case 'escape_velocity': {
        if (altitude === undefined) throw new Error('altitude required (km)');

        const r = bodyRadius + altitude * 1000;
        const vEsc = escapeVelocity(r, mu);
        const vCirc = circularVelocity(r, mu);

        result.altitude_km = altitude;
        result.escape_velocity_km_s = vEsc / 1000;
        result.circular_velocity_km_s = vCirc / 1000;
        result.delta_v_to_escape_km_s = (vEsc - vCirc) / 1000;

        // Interesting comparisons
        result.comparison = {
          vs_surface_escape: vEsc / escapeVelocity(bodyRadius, mu),
          orbital_energy_ratio: 2, // Escape velocity is √2 times circular
        };
        break;
      }

      case 'orbital_elements': {
        if (!position || !velocity || position.length !== 3 || velocity.length !== 3) {
          throw new Error('position and velocity vectors required (km and km/s)');
        }

        const r = position.map((x) => x * 1000) as [number, number, number];
        const v = velocity.map((x) => x * 1000) as [number, number, number];
        const elements = stateToElements(r, v, mu);

        result.orbital_elements = {
          semi_major_axis_km: elements.a / 1000,
          eccentricity: elements.e,
          inclination_deg: elements.i,
          argument_of_periapsis_deg: elements.omega,
          right_ascension_deg: elements.Omega,
          true_anomaly_deg: elements.nu,
        };

        result.orbit_type =
          elements.e < 1
            ? 'bound (elliptical)'
            : elements.e === 1
              ? 'parabolic'
              : 'unbound (hyperbolic)';
        break;
      }

      case 'compare_transfers': {
        if (r1 === undefined || r2 === undefined) {
          throw new Error('r1 and r2 required (km)');
        }

        const r1_m = r1 * 1000;
        const r2_m = r2 * 1000;

        // Hohmann
        const hohmann = hohmannTransfer(r1_m, r2_m, mu);

        // Bi-elliptic with various intermediate radii
        const rbValues = [r2 * 1.5, r2 * 2, r2 * 3, r2 * 5].filter((x) => x > r2);
        const biElliptics = rbValues.map((rb) => ({
          rb_km: rb,
          ...biEllipticTransfer(r1_m, r2_m, rb * 1000, mu),
        }));

        result.hohmann = {
          total_delta_v_km_s: hohmann.totalDeltaV / 1000,
          transfer_time_days: hohmann.transferTime / 86400,
        };

        result.bielliptic_options = biElliptics.map((bi) => ({
          intermediate_radius_km: bi.rb_km,
          total_delta_v_km_s: bi.totalDeltaV / 1000,
          transfer_time_days: bi.transferTime / 86400,
          savings_vs_hohmann: (hohmann.totalDeltaV - bi.totalDeltaV) / 1000,
        }));

        // Bi-elliptic is more efficient when r2/r1 > 11.94
        result.recommendation =
          r2 / r1 > 11.94
            ? 'Bi-elliptic transfer may be more fuel-efficient'
            : 'Hohmann transfer is recommended';
        break;
      }

      case 'mission_deltav': {
        // Calculate total delta-v for Earth to Mars mission
        const earthAlt = altitude || 200; // km LEO
        const marsAlt = 300; // km Mars orbit

        const earthR = BODIES.earth.radius + earthAlt * 1000;
        const marsR = BODIES.mars.radius + marsAlt * 1000;

        // Earth orbital radius around Sun
        const earthOrbit = 1 * AU;
        const marsOrbit = 1.524 * AU;

        // Escape from Earth
        const vEscEarth = escapeVelocity(earthR, BODIES.earth.mu);
        const vCircEarth = circularVelocity(earthR, BODIES.earth.mu);

        // Heliocentric transfer
        const helioTransfer = hohmannTransfer(earthOrbit, marsOrbit, BODIES.sun.mu);

        // Mars capture
        const vEscMars = escapeVelocity(marsR, BODIES.mars.mu);

        result.mission = 'Earth LEO to Mars orbit';
        const phases = {
          earth_departure: (vEscEarth - vCircEarth) / 1000,
          heliocentric_transfer: helioTransfer.totalDeltaV / 1000,
          mars_capture: (vEscMars / 1000) * 0.5, // Approximate
        };
        result.phases = phases;
        result.total_delta_v_km_s =
          phases.earth_departure + phases.heliocentric_transfer + phases.mars_capture;
        result.transfer_time_days = helioTransfer.transferTime / 86400;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
