/**
 * PENDULUM-SIM TOOL
 * Comprehensive pendulum physics simulation
 * Features: simple pendulum, double pendulum (chaotic), damped, driven/forced,
 * energy conservation, phase space visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// Type Definitions
// ============================================================================

interface SimplePendulumState {
  theta: number; // angle from vertical (radians)
  omega: number; // angular velocity (rad/s)
  length: number; // pendulum length (m)
  mass: number; // bob mass (kg)
  damping: number; // damping coefficient
}

interface DoublePendulumState {
  theta1: number; // angle of first pendulum
  theta2: number; // angle of second pendulum
  omega1: number; // angular velocity of first pendulum
  omega2: number; // angular velocity of second pendulum
  length1: number;
  length2: number;
  mass1: number;
  mass2: number;
  damping: number;
}

interface DrivenPendulumState extends SimplePendulumState {
  driveAmplitude: number; // amplitude of driving force
  driveFrequency: number; // frequency of driving force (rad/s)
  drivePhase: number; // phase of driving force
}

interface PendulumEnergy {
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  time: number;
}

interface PhaseSpacePoint {
  theta: number;
  omega: number;
  time: number;
}

interface PendulumAnalysis {
  period: number;
  frequency: number;
  maxAngle: number;
  maxVelocity: number;
  energyConservation: number; // percentage deviation
  isSmallAngle: boolean;
  theoreticalPeriod: number;
  lyapunovExponent?: number; // for double pendulum
}

interface SimulationResult {
  trajectory: PhaseSpacePoint[];
  energy: PendulumEnergy[];
  analysis: PendulumAnalysis;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  finalState: any;
}

// ============================================================================
// Physics Constants
// ============================================================================

const GRAVITY = 9.80665; // m/s²
const SMALL_ANGLE_THRESHOLD = 0.2; // radians (~11.5 degrees)

// ============================================================================
// Simple Pendulum Physics
// ============================================================================

/**
 * Calculate simple pendulum acceleration
 * θ'' = -(g/L) * sin(θ) - b * θ'
 */
function simplePendulumAcceleration(
  state: SimplePendulumState,
  gravity: number
): number {
  const { theta, omega, length, damping } = state;
  // gravitational torque + damping
  return -(gravity / length) * Math.sin(theta) - damping * omega;
}

/**
 * Runge-Kutta 4th order integration for simple pendulum
 */
function rk4SimplePendulum(
  state: SimplePendulumState,
  dt: number,
  gravity: number
): SimplePendulumState {
  const { theta, omega, length, mass, damping } = state;

  // k1
  const k1_theta = omega;
  const k1_omega = simplePendulumAcceleration(state, gravity);

  // k2
  const state2 = { ...state, theta: theta + 0.5 * dt * k1_theta, omega: omega + 0.5 * dt * k1_omega };
  const k2_theta = state2.omega;
  const k2_omega = simplePendulumAcceleration(state2, gravity);

  // k3
  const state3 = { ...state, theta: theta + 0.5 * dt * k2_theta, omega: omega + 0.5 * dt * k2_omega };
  const k3_theta = state3.omega;
  const k3_omega = simplePendulumAcceleration(state3, gravity);

  // k4
  const state4 = { ...state, theta: theta + dt * k3_theta, omega: omega + dt * k3_omega };
  const k4_theta = state4.omega;
  const k4_omega = simplePendulumAcceleration(state4, gravity);

  // Combine
  const newTheta = theta + (dt / 6) * (k1_theta + 2 * k2_theta + 2 * k3_theta + k4_theta);
  const newOmega = omega + (dt / 6) * (k1_omega + 2 * k2_omega + 2 * k3_omega + k4_omega);

  return {
    theta: newTheta,
    omega: newOmega,
    length,
    mass,
    damping
  };
}

/**
 * Calculate energy for simple pendulum
 */
function simplePendulumEnergy(
  state: SimplePendulumState,
  gravity: number,
  time: number
): PendulumEnergy {
  const { theta, omega, length, mass } = state;

  // KE = (1/2) * m * v² = (1/2) * m * (L * ω)²
  const kineticEnergy = 0.5 * mass * Math.pow(length * omega, 2);

  // PE = m * g * h = m * g * L * (1 - cos(θ))
  const potentialEnergy = mass * gravity * length * (1 - Math.cos(theta));

  return {
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
    time
  };
}

// ============================================================================
// Double Pendulum Physics (Chaotic)
// ============================================================================

/**
 * Calculate double pendulum accelerations using Lagrangian mechanics
 * This is a classic chaotic system
 */
function doublePendulumAccelerations(
  state: DoublePendulumState,
  gravity: number
): { alpha1: number; alpha2: number } {
  const { theta1, theta2, omega1, omega2, length1, length2, mass1, mass2, damping } = state;

  const delta = theta2 - theta1;
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const m = mass1 + mass2;
  const l1 = length1;
  const l2 = length2;
  const m2 = mass2;

  // Denominator for both equations
  const denom = l1 * (m - m2 * cosDelta * cosDelta);

  // Angular acceleration of first pendulum
  const num1 = m2 * l1 * omega1 * omega1 * sinDelta * cosDelta +
               m2 * gravity * Math.sin(theta2) * cosDelta +
               m2 * l2 * omega2 * omega2 * sinDelta -
               m * gravity * Math.sin(theta1);
  const alpha1 = num1 / denom - damping * omega1;

  // Angular acceleration of second pendulum
  const num2 = -m2 * l2 * omega2 * omega2 * sinDelta * cosDelta +
               m * gravity * Math.sin(theta1) * cosDelta -
               m * l1 * omega1 * omega1 * sinDelta -
               m * gravity * Math.sin(theta2);
  const denom2 = l2 * (m - m2 * cosDelta * cosDelta);
  const alpha2 = num2 / denom2 - damping * omega2;

  return { alpha1, alpha2 };
}

/**
 * Runge-Kutta 4th order integration for double pendulum
 */
function rk4DoublePendulum(
  state: DoublePendulumState,
  dt: number,
  gravity: number
): DoublePendulumState {
  const { theta1, theta2, omega1, omega2, length1, length2, mass1, mass2, damping } = state;

  // Helper to create state
  const makeState = (t1: number, t2: number, o1: number, o2: number): DoublePendulumState => ({
    theta1: t1, theta2: t2, omega1: o1, omega2: o2, length1, length2, mass1, mass2, damping
  });

  // k1
  const acc1 = doublePendulumAccelerations(state, gravity);
  const k1 = { t1: omega1, t2: omega2, o1: acc1.alpha1, o2: acc1.alpha2 };

  // k2
  const s2 = makeState(
    theta1 + 0.5 * dt * k1.t1, theta2 + 0.5 * dt * k1.t2,
    omega1 + 0.5 * dt * k1.o1, omega2 + 0.5 * dt * k1.o2
  );
  const acc2 = doublePendulumAccelerations(s2, gravity);
  const k2 = { t1: s2.omega1, t2: s2.omega2, o1: acc2.alpha1, o2: acc2.alpha2 };

  // k3
  const s3 = makeState(
    theta1 + 0.5 * dt * k2.t1, theta2 + 0.5 * dt * k2.t2,
    omega1 + 0.5 * dt * k2.o1, omega2 + 0.5 * dt * k2.o2
  );
  const acc3 = doublePendulumAccelerations(s3, gravity);
  const k3 = { t1: s3.omega1, t2: s3.omega2, o1: acc3.alpha1, o2: acc3.alpha2 };

  // k4
  const s4 = makeState(
    theta1 + dt * k3.t1, theta2 + dt * k3.t2,
    omega1 + dt * k3.o1, omega2 + dt * k3.o2
  );
  const acc4 = doublePendulumAccelerations(s4, gravity);
  const k4 = { t1: s4.omega1, t2: s4.omega2, o1: acc4.alpha1, o2: acc4.alpha2 };

  // Combine
  return makeState(
    theta1 + (dt / 6) * (k1.t1 + 2 * k2.t1 + 2 * k3.t1 + k4.t1),
    theta2 + (dt / 6) * (k1.t2 + 2 * k2.t2 + 2 * k3.t2 + k4.t2),
    omega1 + (dt / 6) * (k1.o1 + 2 * k2.o1 + 2 * k3.o1 + k4.o1),
    omega2 + (dt / 6) * (k1.o2 + 2 * k2.o2 + 2 * k3.o2 + k4.o2)
  );
}

/**
 * Calculate energy for double pendulum
 */
function doublePendulumEnergy(
  state: DoublePendulumState,
  gravity: number,
  time: number
): PendulumEnergy {
  const { theta1, theta2, omega1, omega2, length1, length2, mass1, mass2 } = state;

  // Position of mass 1
  const _x1 = length1 * Math.sin(theta1);
  void _x1; // Used for visualization
  const y1 = -length1 * Math.cos(theta1);

  // Position of mass 2
  const y2 = y1 - length2 * Math.cos(theta2);

  // Velocity of mass 1
  const vx1 = length1 * omega1 * Math.cos(theta1);
  const vy1 = length1 * omega1 * Math.sin(theta1);
  const v1sq = vx1 * vx1 + vy1 * vy1;

  // Velocity of mass 2
  const vx2 = vx1 + length2 * omega2 * Math.cos(theta2);
  const vy2 = vy1 + length2 * omega2 * Math.sin(theta2);
  const v2sq = vx2 * vx2 + vy2 * vy2;

  // Kinetic energy
  const kineticEnergy = 0.5 * mass1 * v1sq + 0.5 * mass2 * v2sq;

  // Potential energy (measured from lowest point)
  const potentialEnergy = mass1 * gravity * (y1 + length1) +
                         mass2 * gravity * (y2 + length1 + length2);

  return {
    kineticEnergy,
    potentialEnergy,
    totalEnergy: kineticEnergy + potentialEnergy,
    time
  };
}

/**
 * Estimate Lyapunov exponent for double pendulum (chaos indicator)
 */
function estimateLyapunovExponent(
  trajectories: DoublePendulumState[][],
  dt: number
): number {
  if (trajectories.length < 2) return 0;

  const t1 = trajectories[0];
  const t2 = trajectories[1];

  let sumLog = 0;
  let count = 0;

  for (let i = 0; i < Math.min(t1.length, t2.length); i++) {
    const d = Math.sqrt(
      Math.pow(t1[i].theta1 - t2[i].theta1, 2) +
      Math.pow(t1[i].theta2 - t2[i].theta2, 2)
    );
    if (d > 1e-10) {
      sumLog += Math.log(d);
      count++;
    }
  }

  return count > 0 ? sumLog / (count * dt) : 0;
}

// ============================================================================
// Driven (Forced) Pendulum
// ============================================================================

/**
 * Calculate driven pendulum acceleration
 * θ'' = -(g/L) * sin(θ) - b * θ' + A * cos(ω_d * t + φ)
 */
function drivenPendulumAcceleration(
  state: DrivenPendulumState,
  time: number,
  gravity: number
): number {
  const { theta, omega, length, damping, driveAmplitude, driveFrequency, drivePhase } = state;

  // Natural dynamics + damping + driving force
  const natural = -(gravity / length) * Math.sin(theta);
  const dampingTerm = -damping * omega;
  const drivingTerm = driveAmplitude * Math.cos(driveFrequency * time + drivePhase);

  return natural + dampingTerm + drivingTerm;
}

/**
 * Runge-Kutta 4th order integration for driven pendulum
 */
function rk4DrivenPendulum(
  state: DrivenPendulumState,
  time: number,
  dt: number,
  gravity: number
): DrivenPendulumState {
  const { theta, omega, length, mass, damping, driveAmplitude, driveFrequency, drivePhase } = state;

  const makeState = (t: number, o: number): DrivenPendulumState => ({
    theta: t, omega: o, length, mass, damping, driveAmplitude, driveFrequency, drivePhase
  });

  // k1
  const k1_theta = omega;
  const k1_omega = drivenPendulumAcceleration(state, time, gravity);

  // k2
  const state2 = makeState(theta + 0.5 * dt * k1_theta, omega + 0.5 * dt * k1_omega);
  const k2_theta = state2.omega;
  const k2_omega = drivenPendulumAcceleration(state2, time + 0.5 * dt, gravity);

  // k3
  const state3 = makeState(theta + 0.5 * dt * k2_theta, omega + 0.5 * dt * k2_omega);
  const k3_theta = state3.omega;
  const k3_omega = drivenPendulumAcceleration(state3, time + 0.5 * dt, gravity);

  // k4
  const state4 = makeState(theta + dt * k3_theta, omega + dt * k3_omega);
  const k4_theta = state4.omega;
  const k4_omega = drivenPendulumAcceleration(state4, time + dt, gravity);

  // Combine
  return makeState(
    theta + (dt / 6) * (k1_theta + 2 * k2_theta + 2 * k3_theta + k4_theta),
    omega + (dt / 6) * (k1_omega + 2 * k2_omega + 2 * k3_omega + k4_omega)
  );
}

// ============================================================================
// Period and Frequency Calculations
// ============================================================================

/**
 * Calculate theoretical period for simple pendulum (small angle approximation)
 * T = 2π * sqrt(L/g)
 */
function theoreticalPeriodSmallAngle(length: number, gravity: number): number {
  return 2 * Math.PI * Math.sqrt(length / gravity);
}

/**
 * Calculate theoretical period for large angles (elliptic integral approximation)
 * T = T_0 * (1 + θ_0²/16 + 11*θ_0⁴/3072 + ...)
 */
function theoreticalPeriodLargeAngle(
  length: number,
  gravity: number,
  theta0: number
): number {
  const T0 = theoreticalPeriodSmallAngle(length, gravity);
  const theta2 = theta0 * theta0;
  const theta4 = theta2 * theta2;
  const theta6 = theta4 * theta2;

  // Series expansion of complete elliptic integral
  const correction = 1 +
    theta2 / 16 +
    11 * theta4 / 3072 +
    173 * theta6 / 737280;

  return T0 * correction;
}

/**
 * Measure actual period from simulation trajectory
 */
function measurePeriodFromTrajectory(trajectory: PhaseSpacePoint[]): number {
  const zeroCrossings: number[] = [];

  // Find positive-going zero crossings
  for (let i = 1; i < trajectory.length; i++) {
    if (trajectory[i - 1].theta < 0 && trajectory[i].theta >= 0) {
      // Linear interpolation for precise crossing time
      const t1 = trajectory[i - 1].time;
      const t2 = trajectory[i].time;
      const th1 = trajectory[i - 1].theta;
      const th2 = trajectory[i].theta;
      const crossTime = t1 + (t2 - t1) * (-th1) / (th2 - th1);
      zeroCrossings.push(crossTime);
    }
  }

  if (zeroCrossings.length < 2) return 0;

  // Average period from consecutive crossings
  let totalPeriod = 0;
  for (let i = 1; i < zeroCrossings.length; i++) {
    totalPeriod += zeroCrossings[i] - zeroCrossings[i - 1];
  }

  return totalPeriod / (zeroCrossings.length - 1);
}

// ============================================================================
// Simulation Functions
// ============================================================================

/**
 * Simulate simple pendulum
 */
function simulateSimplePendulum(params: {
  initialAngle: number;
  initialVelocity?: number;
  length: number;
  mass?: number;
  damping?: number;
  duration: number;
  timestep: number;
  gravity?: number;
}): SimulationResult {
  const gravity = params.gravity ?? GRAVITY;
  const dt = params.timestep || 0.001;
  const steps = Math.floor(params.duration / dt);

  let state: SimplePendulumState = {
    theta: params.initialAngle,
    omega: params.initialVelocity || 0,
    length: params.length,
    mass: params.mass || 1,
    damping: params.damping || 0
  };

  const trajectory: PhaseSpacePoint[] = [];
  const energy: PendulumEnergy[] = [];
  let maxAngle = Math.abs(state.theta);
  let maxVelocity = Math.abs(state.omega);

  const recordInterval = Math.max(1, Math.floor(steps / 1000));

  for (let i = 0; i < steps; i++) {
    const time = i * dt;

    if (i % recordInterval === 0) {
      trajectory.push({ theta: state.theta, omega: state.omega, time });
      energy.push(simplePendulumEnergy(state, gravity, time));
    }

    maxAngle = Math.max(maxAngle, Math.abs(state.theta));
    maxVelocity = Math.max(maxVelocity, Math.abs(state.omega));

    state = rk4SimplePendulum(state, dt, gravity);
  }

  // Analysis
  const period = measurePeriodFromTrajectory(trajectory);
  const theoreticalPeriod = theoreticalPeriodLargeAngle(state.length, gravity, params.initialAngle);
  const initialEnergy = energy[0]?.totalEnergy || 0;
  const finalEnergy = energy[energy.length - 1]?.totalEnergy || 0;
  const energyConservation = initialEnergy > 0 ?
    Math.abs(finalEnergy - initialEnergy) / initialEnergy * 100 : 0;

  return {
    trajectory,
    energy,
    analysis: {
      period,
      frequency: period > 0 ? 1 / period : 0,
      maxAngle,
      maxVelocity,
      energyConservation,
      isSmallAngle: maxAngle < SMALL_ANGLE_THRESHOLD,
      theoreticalPeriod
    },
    finalState: state
  };
}

/**
 * Simulate double pendulum (chaotic system)
 */
function simulateDoublePendulum(params: {
  theta1: number;
  theta2: number;
  omega1?: number;
  omega2?: number;
  length1: number;
  length2: number;
  mass1?: number;
  mass2?: number;
  damping?: number;
  duration: number;
  timestep: number;
  gravity?: number;
  perturbation?: number; // for Lyapunov calculation
}): SimulationResult & { trajectory2?: PhaseSpacePoint[]; lyapunovExponent?: number } {
  const gravity = params.gravity ?? GRAVITY;
  const dt = params.timestep || 0.0001; // Smaller timestep for chaotic system
  const steps = Math.floor(params.duration / dt);

  let state: DoublePendulumState = {
    theta1: params.theta1,
    theta2: params.theta2,
    omega1: params.omega1 || 0,
    omega2: params.omega2 || 0,
    length1: params.length1,
    length2: params.length2,
    mass1: params.mass1 || 1,
    mass2: params.mass2 || 1,
    damping: params.damping || 0
  };

  // Perturbed state for Lyapunov calculation
  let perturbedState: DoublePendulumState | null = null;
  if (params.perturbation) {
    perturbedState = {
      ...state,
      theta1: state.theta1 + params.perturbation
    };
  }

  const trajectory: PhaseSpacePoint[] = [];
  const trajectory2: PhaseSpacePoint[] = [];
  const energy: PendulumEnergy[] = [];
  const states: DoublePendulumState[] = [];
  const perturbedStates: DoublePendulumState[] = [];

  let maxAngle = Math.max(Math.abs(state.theta1), Math.abs(state.theta2));
  let maxVelocity = Math.max(Math.abs(state.omega1), Math.abs(state.omega2));

  const recordInterval = Math.max(1, Math.floor(steps / 1000));

  for (let i = 0; i < steps; i++) {
    const time = i * dt;

    if (i % recordInterval === 0) {
      // Record combined angle for phase space (theta1)
      trajectory.push({ theta: state.theta1, omega: state.omega1, time });
      trajectory2.push({ theta: state.theta2, omega: state.omega2, time });
      energy.push(doublePendulumEnergy(state, gravity, time));
      states.push({ ...state });
      if (perturbedState) {
        perturbedStates.push({ ...perturbedState });
      }
    }

    maxAngle = Math.max(maxAngle, Math.abs(state.theta1), Math.abs(state.theta2));
    maxVelocity = Math.max(maxVelocity, Math.abs(state.omega1), Math.abs(state.omega2));

    state = rk4DoublePendulum(state, dt, gravity);
    if (perturbedState) {
      perturbedState = rk4DoublePendulum(perturbedState, dt, gravity);
    }
  }

  // Calculate Lyapunov exponent if we have perturbed trajectory
  let lyapunovExponent: number | undefined;
  if (perturbedStates.length > 0) {
    lyapunovExponent = estimateLyapunovExponent([states, perturbedStates], dt * recordInterval);
  }

  // Analysis
  const initialEnergy = energy[0]?.totalEnergy || 0;
  const finalEnergy = energy[energy.length - 1]?.totalEnergy || 0;
  const energyConservation = initialEnergy > 0 ?
    Math.abs(finalEnergy - initialEnergy) / initialEnergy * 100 : 0;

  return {
    trajectory,
    trajectory2,
    energy,
    analysis: {
      period: 0, // Double pendulum may not have regular period
      frequency: 0,
      maxAngle,
      maxVelocity,
      energyConservation,
      isSmallAngle: maxAngle < SMALL_ANGLE_THRESHOLD,
      theoreticalPeriod: 0, // No simple formula for double pendulum
      lyapunovExponent
    },
    finalState: state,
    lyapunovExponent
  };
}

/**
 * Simulate driven/forced pendulum
 */
function simulateDrivenPendulum(params: {
  initialAngle: number;
  initialVelocity?: number;
  length: number;
  mass?: number;
  damping: number;
  driveAmplitude: number;
  driveFrequency: number;
  drivePhase?: number;
  duration: number;
  timestep: number;
  gravity?: number;
}): SimulationResult {
  const gravity = params.gravity ?? GRAVITY;
  const dt = params.timestep || 0.001;
  const steps = Math.floor(params.duration / dt);

  let state: DrivenPendulumState = {
    theta: params.initialAngle,
    omega: params.initialVelocity || 0,
    length: params.length,
    mass: params.mass || 1,
    damping: params.damping,
    driveAmplitude: params.driveAmplitude,
    driveFrequency: params.driveFrequency,
    drivePhase: params.drivePhase || 0
  };

  const trajectory: PhaseSpacePoint[] = [];
  const energy: PendulumEnergy[] = [];
  let maxAngle = Math.abs(state.theta);
  let maxVelocity = Math.abs(state.omega);

  const recordInterval = Math.max(1, Math.floor(steps / 1000));

  for (let i = 0; i < steps; i++) {
    const time = i * dt;

    if (i % recordInterval === 0) {
      trajectory.push({ theta: state.theta, omega: state.omega, time });
      // For driven pendulum, energy is not conserved
      energy.push({
        kineticEnergy: 0.5 * state.mass * Math.pow(state.length * state.omega, 2),
        potentialEnergy: state.mass * gravity * state.length * (1 - Math.cos(state.theta)),
        totalEnergy: 0,
        time
      });
      energy[energy.length - 1].totalEnergy =
        energy[energy.length - 1].kineticEnergy + energy[energy.length - 1].potentialEnergy;
    }

    maxAngle = Math.max(maxAngle, Math.abs(state.theta));
    maxVelocity = Math.max(maxVelocity, Math.abs(state.omega));

    state = rk4DrivenPendulum(state, time, dt, gravity);
  }

  // Analysis
  const period = measurePeriodFromTrajectory(trajectory);
  const naturalFrequency = Math.sqrt(gravity / state.length);
  const theoreticalPeriod = 2 * Math.PI / naturalFrequency;

  return {
    trajectory,
    energy,
    analysis: {
      period,
      frequency: period > 0 ? 1 / period : 0,
      maxAngle,
      maxVelocity,
      energyConservation: NaN, // Energy not conserved for driven pendulum
      isSmallAngle: maxAngle < SMALL_ANGLE_THRESHOLD,
      theoreticalPeriod
    },
    finalState: state
  };
}

/**
 * Generate Poincare section for driven pendulum
 */
function generatePoincareSection(params: {
  initialAngle: number;
  length: number;
  damping: number;
  driveAmplitude: number;
  driveFrequency: number;
  duration: number;
  timestep: number;
  gravity?: number;
}): PhaseSpacePoint[] {
  const gravity = params.gravity ?? GRAVITY;
  const dt = params.timestep || 0.001;
  const steps = Math.floor(params.duration / dt);
  const drivePeriod = 2 * Math.PI / params.driveFrequency;

  let state: DrivenPendulumState = {
    theta: params.initialAngle,
    omega: 0,
    length: params.length,
    mass: 1,
    damping: params.damping,
    driveAmplitude: params.driveAmplitude,
    driveFrequency: params.driveFrequency,
    drivePhase: 0
  };

  const poincarePoints: PhaseSpacePoint[] = [];
  let nextSampleTime = drivePeriod;

  for (let i = 0; i < steps; i++) {
    const time = i * dt;

    // Sample at each drive period
    if (time >= nextSampleTime) {
      // Normalize theta to [-π, π]
      let theta = state.theta % (2 * Math.PI);
      if (theta > Math.PI) theta -= 2 * Math.PI;
      if (theta < -Math.PI) theta += 2 * Math.PI;

      poincarePoints.push({ theta, omega: state.omega, time });
      nextSampleTime += drivePeriod;
    }

    state = rk4DrivenPendulum(state, time, dt, gravity);
  }

  return poincarePoints;
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const pendulumsimTool: UnifiedTool = {
  name: 'pendulum_sim',
  description: 'Comprehensive pendulum physics simulation. Supports simple pendulum, double pendulum (chaotic), damped oscillations, and driven/forced pendulum. Includes energy conservation analysis and phase space visualization.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simple', 'double', 'driven', 'poincare', 'analyze_period', 'info'],
        description: 'Type of pendulum simulation'
      },
      initialAngle: { type: 'number', description: 'Initial angle in radians (simple/driven)' },
      initialVelocity: { type: 'number', description: 'Initial angular velocity (rad/s)' },
      theta1: { type: 'number', description: 'Initial angle of first pendulum (double)' },
      theta2: { type: 'number', description: 'Initial angle of second pendulum (double)' },
      omega1: { type: 'number', description: 'Initial angular velocity of first pendulum' },
      omega2: { type: 'number', description: 'Initial angular velocity of second pendulum' },
      length: { type: 'number', description: 'Pendulum length in meters (simple/driven)' },
      length1: { type: 'number', description: 'First pendulum length (double)' },
      length2: { type: 'number', description: 'Second pendulum length (double)' },
      mass: { type: 'number', description: 'Bob mass in kg' },
      mass1: { type: 'number', description: 'First bob mass (double)' },
      mass2: { type: 'number', description: 'Second bob mass (double)' },
      damping: { type: 'number', description: 'Damping coefficient' },
      driveAmplitude: { type: 'number', description: 'Driving force amplitude (driven)' },
      driveFrequency: { type: 'number', description: 'Driving frequency in rad/s (driven)' },
      drivePhase: { type: 'number', description: 'Driving force phase (driven)' },
      duration: { type: 'number', description: 'Simulation duration in seconds' },
      timestep: { type: 'number', description: 'Simulation timestep in seconds' },
      gravity: { type: 'number', description: 'Gravitational acceleration (default: 9.80665)' },
      perturbation: { type: 'number', description: 'Initial perturbation for Lyapunov calculation (double)' }
    },
    required: ['operation']
  }
};

export async function executependulumsim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simple': {
        if (args.initialAngle === undefined || !args.length) {
          throw new Error('initialAngle and length are required for simple pendulum');
        }
        result = simulateSimplePendulum({
          initialAngle: args.initialAngle,
          initialVelocity: args.initialVelocity,
          length: args.length,
          mass: args.mass,
          damping: args.damping || 0,
          duration: args.duration || 10,
          timestep: args.timestep || 0.001,
          gravity: args.gravity
        });
        break;
      }

      case 'double': {
        if (args.theta1 === undefined || args.theta2 === undefined ||
            !args.length1 || !args.length2) {
          throw new Error('theta1, theta2, length1, and length2 are required for double pendulum');
        }
        result = simulateDoublePendulum({
          theta1: args.theta1,
          theta2: args.theta2,
          omega1: args.omega1,
          omega2: args.omega2,
          length1: args.length1,
          length2: args.length2,
          mass1: args.mass1,
          mass2: args.mass2,
          damping: args.damping,
          duration: args.duration || 10,
          timestep: args.timestep || 0.0001,
          gravity: args.gravity,
          perturbation: args.perturbation
        });
        break;
      }

      case 'driven': {
        if (args.initialAngle === undefined || !args.length ||
            !args.driveAmplitude || !args.driveFrequency) {
          throw new Error('initialAngle, length, driveAmplitude, and driveFrequency are required');
        }
        result = simulateDrivenPendulum({
          initialAngle: args.initialAngle,
          initialVelocity: args.initialVelocity,
          length: args.length,
          mass: args.mass,
          damping: args.damping || 0.1,
          driveAmplitude: args.driveAmplitude,
          driveFrequency: args.driveFrequency,
          drivePhase: args.drivePhase,
          duration: args.duration || 30,
          timestep: args.timestep || 0.001,
          gravity: args.gravity
        });
        break;
      }

      case 'poincare': {
        if (args.initialAngle === undefined || !args.length ||
            !args.driveAmplitude || !args.driveFrequency) {
          throw new Error('initialAngle, length, driveAmplitude, and driveFrequency are required');
        }
        result = {
          poincareSection: generatePoincareSection({
            initialAngle: args.initialAngle,
            length: args.length,
            damping: args.damping || 0.5,
            driveAmplitude: args.driveAmplitude,
            driveFrequency: args.driveFrequency,
            duration: args.duration || 100,
            timestep: args.timestep || 0.001,
            gravity: args.gravity
          })
        };
        break;
      }

      case 'analyze_period': {
        if (!args.length) {
          throw new Error('length is required for period analysis');
        }
        const gravity = args.gravity ?? GRAVITY;
        const angle = args.initialAngle ?? 0.1;

        result = {
          smallAnglePeriod: theoreticalPeriodSmallAngle(args.length, gravity),
          largeAnglePeriod: theoreticalPeriodLargeAngle(args.length, gravity, angle),
          naturalFrequency: Math.sqrt(gravity / args.length),
          angularFrequency: Math.sqrt(gravity / args.length),
          smallAngleApproximationValid: Math.abs(angle) < SMALL_ANGLE_THRESHOLD,
          periodCorrection: theoreticalPeriodLargeAngle(args.length, gravity, angle) /
                           theoreticalPeriodSmallAngle(args.length, gravity)
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: 'Pendulum physics simulation tool',
          pendulumTypes: {
            simple: 'Single pendulum with optional damping',
            double: 'Chaotic double pendulum system',
            driven: 'Externally forced pendulum with resonance behavior'
          },
          features: [
            'Runge-Kutta 4th order integration',
            'Energy conservation tracking',
            'Phase space trajectories',
            'Period calculation (theoretical and measured)',
            'Lyapunov exponent estimation (double pendulum)',
            'Poincare section generation',
            'Large angle corrections'
          ],
          equations: {
            simple: 'theta\'\' = -(g/L)*sin(theta) - b*theta\'',
            driven: 'theta\'\' = -(g/L)*sin(theta) - b*theta\' + A*cos(omega_d*t)',
            doublePendulum: 'Lagrangian mechanics with coupled equations'
          },
          constants: {
            gravity: GRAVITY,
            smallAngleThreshold: SMALL_ANGLE_THRESHOLD
          },
          operations: ['simple', 'double', 'driven', 'poincare', 'analyze_period', 'info']
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispendulumsimAvailable(): boolean { return true; }
