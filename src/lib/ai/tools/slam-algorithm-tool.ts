/**
 * SLAM-ALGORITHM TOOL
 * Simultaneous Localization and Mapping algorithms for robotics
 * Implements EKF-SLAM, FastSLAM, Graph-SLAM, and ICP scan matching
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Pose2D {
  x: number;
  y: number;
  theta: number;  // Orientation in radians
}

interface Landmark {
  id: number;
  x: number;
  y: number;
  signature?: number[];  // Feature descriptor
}

interface Observation {
  landmarkId: number;
  range: number;
  bearing: number;
  signature?: number[];
}

interface OdometryReading {
  dx: number;
  dy: number;
  dtheta: number;
}

interface LaserScan {
  ranges: number[];
  angleMin: number;
  angleMax: number;
  angleIncrement: number;
}

interface Point2D {
  x: number;
  y: number;
}

interface Particle {
  pose: Pose2D;
  weight: number;
  landmarks: Map<number, { mean: number[]; covariance: number[][] }>;
}

interface GraphNode {
  id: number;
  pose: Pose2D;
}

interface GraphEdge {
  from: number;
  to: number;
  measurement: Pose2D;
  information: number[][];
}

interface SLAMResult {
  estimatedPose: Pose2D;
  landmarks: Landmark[];
  uncertainty?: number[][];
  map?: OccupancyGrid;
}

interface OccupancyGrid {
  width: number;
  height: number;
  resolution: number;
  origin: Point2D;
  data: number[][];  // Probability of occupancy [0, 1]
}

// ============================================================================
// MATRIX OPERATIONS
// ============================================================================

class Matrix {
  data: number[][];
  rows: number;
  cols: number;

  constructor(rows: number, cols: number, fill: number = 0) {
    this.rows = rows;
    this.cols = cols;
    this.data = Array(rows).fill(null).map(() => Array(cols).fill(fill));
  }

  static fromArray(arr: number[][]): Matrix {
    const m = new Matrix(arr.length, arr[0]?.length || 0);
    m.data = arr.map(row => [...row]);
    return m;
  }

  static identity(n: number): Matrix {
    const m = new Matrix(n, n, 0);
    for (let i = 0; i < n; i++) m.data[i][i] = 1;
    return m;
  }

  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols, 0);
  }

  get(i: number, j: number): number {
    return this.data[i][j];
  }

  set(i: number, j: number, value: number): void {
    this.data[i][j] = value;
  }

  add(other: Matrix): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] + other.data[i][j];
      }
    }
    return result;
  }

  subtract(other: Matrix): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] - other.data[i][j];
      }
    }
    return result;
  }

  multiply(other: Matrix): Matrix {
    const result = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }

  scale(scalar: number): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] * scalar;
      }
    }
    return result;
  }

  transpose(): Matrix {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[j][i] = this.data[i][j];
      }
    }
    return result;
  }

  // LU decomposition for matrix inversion
  inverse(): Matrix {
    if (this.rows !== this.cols) {
      throw new Error('Matrix must be square for inversion');
    }

    const n = this.rows;
    const augmented = new Matrix(n, 2 * n);

    // Create augmented matrix [A | I]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented.data[i][j] = this.data[i][j];
      }
      augmented.data[i][i + n] = 1;
    }

    // Gaussian elimination with partial pivoting
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented.data[row][col]) > Math.abs(augmented.data[maxRow][col])) {
          maxRow = row;
        }
      }

      // Swap rows
      [augmented.data[col], augmented.data[maxRow]] = [augmented.data[maxRow], augmented.data[col]];

      const pivot = augmented.data[col][col];
      if (Math.abs(pivot) < 1e-10) {
        // Singular matrix, return pseudo-inverse approximation
        return Matrix.identity(n);
      }

      // Scale pivot row
      for (let j = 0; j < 2 * n; j++) {
        augmented.data[col][j] /= pivot;
      }

      // Eliminate column
      for (let row = 0; row < n; row++) {
        if (row !== col) {
          const factor = augmented.data[row][col];
          for (let j = 0; j < 2 * n; j++) {
            augmented.data[row][j] -= factor * augmented.data[col][j];
          }
        }
      }
    }

    // Extract inverse
    const result = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result.data[i][j] = augmented.data[i][j + n];
      }
    }

    return result;
  }

  clone(): Matrix {
    return Matrix.fromArray(this.data);
  }

  toArray(): number[][] {
    return this.data.map(row => [...row]);
  }
}

// ============================================================================
// EKF-SLAM IMPLEMENTATION
// ============================================================================

class EKFSLAM {
  private state: number[];  // [x, y, theta, lm1_x, lm1_y, ...]
  private covariance: Matrix;
  private processNoise: Matrix;
  private observationNoise: Matrix;
  private landmarkIds: Map<number, number>;  // landmark ID -> index in state
  private nextLandmarkIndex: number;

  constructor(
    initialPose: Pose2D,
    processNoise: { x: number; y: number; theta: number },
    observationNoise: { range: number; bearing: number }
  ) {
    this.state = [initialPose.x, initialPose.y, initialPose.theta];
    this.covariance = Matrix.identity(3).scale(0.01);

    this.processNoise = Matrix.fromArray([
      [processNoise.x ** 2, 0, 0],
      [0, processNoise.y ** 2, 0],
      [0, 0, processNoise.theta ** 2]
    ]);

    this.observationNoise = Matrix.fromArray([
      [observationNoise.range ** 2, 0],
      [0, observationNoise.bearing ** 2]
    ]);

    this.landmarkIds = new Map();
    this.nextLandmarkIndex = 0;
  }

  predict(odometry: OdometryReading): void {
    const [x, y, theta] = this.state;

    // Motion model
    const newTheta = this.normalizeAngle(theta + odometry.dtheta);
    const newX = x + odometry.dx * Math.cos(theta) - odometry.dy * Math.sin(theta);
    const newY = y + odometry.dx * Math.sin(theta) + odometry.dy * Math.cos(theta);

    this.state[0] = newX;
    this.state[1] = newY;
    this.state[2] = newTheta;

    // Jacobian of motion model
    const G = Matrix.identity(this.state.length);
    G.set(0, 2, -odometry.dx * Math.sin(theta) - odometry.dy * Math.cos(theta));
    G.set(1, 2, odometry.dx * Math.cos(theta) - odometry.dy * Math.sin(theta));

    // Expanded process noise
    const Q = Matrix.zeros(this.state.length, this.state.length);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        Q.set(i, j, this.processNoise.get(i, j));
      }
    }

    // Update covariance
    this.covariance = G.multiply(this.covariance).multiply(G.transpose()).add(Q);
  }

  update(observations: Observation[]): void {
    for (const obs of observations) {
      if (!this.landmarkIds.has(obs.landmarkId)) {
        this.addLandmark(obs);
      } else {
        this.updateWithObservation(obs);
      }
    }
  }

  private addLandmark(obs: Observation): void {
    const [x, y, theta] = this.state;

    // Initialize landmark position from observation
    const lmX = x + obs.range * Math.cos(theta + obs.bearing);
    const lmY = y + obs.range * Math.sin(theta + obs.bearing);

    // Extend state
    this.state.push(lmX, lmY);

    // Record landmark index
    this.landmarkIds.set(obs.landmarkId, this.nextLandmarkIndex);
    this.nextLandmarkIndex++;

    // Extend covariance matrix
    const n = this.covariance.rows;
    const newCov = Matrix.zeros(n + 2, n + 2);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newCov.set(i, j, this.covariance.get(i, j));
      }
    }

    // Initial uncertainty for new landmark
    newCov.set(n, n, 1000);
    newCov.set(n + 1, n + 1, 1000);

    this.covariance = newCov;
  }

  private updateWithObservation(obs: Observation): void {
    const [x, y, theta] = this.state;
    const lmIndex = this.landmarkIds.get(obs.landmarkId)!;
    const stateIndex = 3 + lmIndex * 2;

    const lmX = this.state[stateIndex];
    const lmY = this.state[stateIndex + 1];

    // Expected observation
    const dx = lmX - x;
    const dy = lmY - y;
    const q = dx * dx + dy * dy;
    const sqrtQ = Math.sqrt(q);

    const expectedRange = sqrtQ;
    const expectedBearing = this.normalizeAngle(Math.atan2(dy, dx) - theta);

    // Innovation
    const innovation = [
      obs.range - expectedRange,
      this.normalizeAngle(obs.bearing - expectedBearing)
    ];

    // Jacobian of observation model
    const H = Matrix.zeros(2, this.state.length);
    H.set(0, 0, -dx / sqrtQ);
    H.set(0, 1, -dy / sqrtQ);
    H.set(0, stateIndex, dx / sqrtQ);
    H.set(0, stateIndex + 1, dy / sqrtQ);

    H.set(1, 0, dy / q);
    H.set(1, 1, -dx / q);
    H.set(1, 2, -1);
    H.set(1, stateIndex, -dy / q);
    H.set(1, stateIndex + 1, dx / q);

    // Kalman gain
    const PHt = this.covariance.multiply(H.transpose());
    const S = H.multiply(PHt).add(this.observationNoise);
    const K = PHt.multiply(S.inverse());

    // Update state
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] += K.get(i, 0) * innovation[0] + K.get(i, 1) * innovation[1];
    }
    this.state[2] = this.normalizeAngle(this.state[2]);

    // Update covariance
    const I = Matrix.identity(this.state.length);
    const KH = K.multiply(H);
    this.covariance = I.subtract(KH).multiply(this.covariance);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  getResult(): SLAMResult {
    const landmarks: Landmark[] = [];

    for (const [id, index] of this.landmarkIds) {
      const stateIndex = 3 + index * 2;
      landmarks.push({
        id,
        x: this.state[stateIndex],
        y: this.state[stateIndex + 1]
      });
    }

    return {
      estimatedPose: {
        x: this.state[0],
        y: this.state[1],
        theta: this.state[2]
      },
      landmarks,
      uncertainty: this.covariance.toArray().slice(0, 3).map(row => row.slice(0, 3))
    };
  }
}

// ============================================================================
// FASTSLAM IMPLEMENTATION (Particle Filter based)
// ============================================================================

class FastSLAM {
  private particles: Particle[];
  private numParticles: number;
  private processNoise: { x: number; y: number; theta: number };
  private observationNoise: { range: number; bearing: number };

  constructor(
    initialPose: Pose2D,
    numParticles: number,
    processNoise: { x: number; y: number; theta: number },
    observationNoise: { range: number; bearing: number }
  ) {
    this.numParticles = numParticles;
    this.processNoise = processNoise;
    this.observationNoise = observationNoise;

    // Initialize particles
    this.particles = [];
    for (let i = 0; i < numParticles; i++) {
      this.particles.push({
        pose: { ...initialPose },
        weight: 1 / numParticles,
        landmarks: new Map()
      });
    }
  }

  predict(odometry: OdometryReading): void {
    for (const particle of this.particles) {
      // Sample new pose with noise
      const noiseX = this.sampleGaussian(0, this.processNoise.x);
      const noiseY = this.sampleGaussian(0, this.processNoise.y);
      const noiseTheta = this.sampleGaussian(0, this.processNoise.theta);

      const { x, y, theta } = particle.pose;

      particle.pose.x = x + (odometry.dx + noiseX) * Math.cos(theta)
                          - (odometry.dy + noiseY) * Math.sin(theta);
      particle.pose.y = y + (odometry.dx + noiseX) * Math.sin(theta)
                          + (odometry.dy + noiseY) * Math.cos(theta);
      particle.pose.theta = this.normalizeAngle(theta + odometry.dtheta + noiseTheta);
    }
  }

  update(observations: Observation[]): void {
    for (const particle of this.particles) {
      let weight = 1;

      for (const obs of observations) {
        if (!particle.landmarks.has(obs.landmarkId)) {
          // Initialize new landmark with EKF
          const { x, y, theta } = particle.pose;
          const lmX = x + obs.range * Math.cos(theta + obs.bearing);
          const lmY = y + obs.range * Math.sin(theta + obs.bearing);

          particle.landmarks.set(obs.landmarkId, {
            mean: [lmX, lmY],
            covariance: [[1000, 0], [0, 1000]]
          });
        } else {
          // Update existing landmark with EKF
          weight *= this.updateLandmarkEKF(particle, obs);
        }
      }

      particle.weight *= weight;
    }

    // Normalize weights
    const totalWeight = this.particles.reduce((sum, p) => sum + p.weight, 0);
    for (const particle of this.particles) {
      particle.weight /= totalWeight;
    }

    // Resample if effective sample size is low
    const ess = this.effectiveSampleSize();
    if (ess < this.numParticles / 2) {
      this.resample();
    }
  }

  private updateLandmarkEKF(particle: Particle, obs: Observation): number {
    const lm = particle.landmarks.get(obs.landmarkId)!;
    const { x, y, theta } = particle.pose;

    const dx = lm.mean[0] - x;
    const dy = lm.mean[1] - y;
    const q = dx * dx + dy * dy;
    const sqrtQ = Math.sqrt(q);

    // Expected observation
    const expectedRange = sqrtQ;
    const expectedBearing = this.normalizeAngle(Math.atan2(dy, dx) - theta);

    // Innovation
    const innovation = [
      obs.range - expectedRange,
      this.normalizeAngle(obs.bearing - expectedBearing)
    ];

    // Jacobian
    const H = [
      [dx / sqrtQ, dy / sqrtQ],
      [-dy / q, dx / q]
    ];

    // Observation noise
    const R = [
      [this.observationNoise.range ** 2, 0],
      [0, this.observationNoise.bearing ** 2]
    ];

    // S = H * P * H^T + R
    const P = lm.covariance;
    const HPHt = this.matMul2x2(this.matMul2x2(H, P), this.transpose2x2(H));
    const S = this.matAdd2x2(HPHt, R);

    // Kalman gain K = P * H^T * S^-1
    const Sinv = this.inverse2x2(S);
    const K = this.matMul2x2(this.matMul2x2(P, this.transpose2x2(H)), Sinv);

    // Update mean
    lm.mean[0] += K[0][0] * innovation[0] + K[0][1] * innovation[1];
    lm.mean[1] += K[1][0] * innovation[0] + K[1][1] * innovation[1];

    // Update covariance
    const I = [[1, 0], [0, 1]];
    const KH = this.matMul2x2(K, H);
    lm.covariance = this.matMul2x2(this.matSub2x2(I, KH), P);

    // Return likelihood for weight update
    const det = S[0][0] * S[1][1] - S[0][1] * S[1][0];
    const innSinvInn = innovation[0] * (Sinv[0][0] * innovation[0] + Sinv[0][1] * innovation[1])
                     + innovation[1] * (Sinv[1][0] * innovation[0] + Sinv[1][1] * innovation[1]);

    return Math.exp(-0.5 * innSinvInn) / Math.sqrt(2 * Math.PI * det);
  }

  private matMul2x2(a: number[][], b: number[][]): number[][] {
    return [
      [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
      [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]
    ];
  }

  private matAdd2x2(a: number[][], b: number[][]): number[][] {
    return [
      [a[0][0] + b[0][0], a[0][1] + b[0][1]],
      [a[1][0] + b[1][0], a[1][1] + b[1][1]]
    ];
  }

  private matSub2x2(a: number[][], b: number[][]): number[][] {
    return [
      [a[0][0] - b[0][0], a[0][1] - b[0][1]],
      [a[1][0] - b[1][0], a[1][1] - b[1][1]]
    ];
  }

  private transpose2x2(m: number[][]): number[][] {
    return [
      [m[0][0], m[1][0]],
      [m[0][1], m[1][1]]
    ];
  }

  private inverse2x2(m: number[][]): number[][] {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) < 1e-10) {
      return [[1, 0], [0, 1]];
    }
    return [
      [m[1][1] / det, -m[0][1] / det],
      [-m[1][0] / det, m[0][0] / det]
    ];
  }

  private effectiveSampleSize(): number {
    const sumSquared = this.particles.reduce((sum, p) => sum + p.weight ** 2, 0);
    return 1 / sumSquared;
  }

  private resample(): void {
    const newParticles: Particle[] = [];
    const cumulative: number[] = [];
    let sum = 0;

    for (const p of this.particles) {
      sum += p.weight;
      cumulative.push(sum);
    }

    for (let i = 0; i < this.numParticles; i++) {
      const r = Math.random();
      let idx = 0;
      while (idx < cumulative.length - 1 && cumulative[idx] < r) {
        idx++;
      }

      // Deep clone particle
      const oldParticle = this.particles[idx];
      const newLandmarks = new Map<number, { mean: number[]; covariance: number[][] }>();
      for (const [id, lm] of oldParticle.landmarks) {
        newLandmarks.set(id, {
          mean: [...lm.mean],
          covariance: lm.covariance.map(row => [...row])
        });
      }

      newParticles.push({
        pose: { ...oldParticle.pose },
        weight: 1 / this.numParticles,
        landmarks: newLandmarks
      });
    }

    this.particles = newParticles;
  }

  private sampleGaussian(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  getResult(): SLAMResult {
    // Find best particle
    let bestParticle = this.particles[0];
    for (const p of this.particles) {
      if (p.weight > bestParticle.weight) {
        bestParticle = p;
      }
    }

    // Extract landmarks from best particle
    const landmarks: Landmark[] = [];
    for (const [id, lm] of bestParticle.landmarks) {
      landmarks.push({ id, x: lm.mean[0], y: lm.mean[1] });
    }

    // Compute mean pose across particles
    let meanX = 0, meanY = 0, meanCos = 0, meanSin = 0;
    for (const p of this.particles) {
      meanX += p.weight * p.pose.x;
      meanY += p.weight * p.pose.y;
      meanCos += p.weight * Math.cos(p.pose.theta);
      meanSin += p.weight * Math.sin(p.pose.theta);
    }

    return {
      estimatedPose: {
        x: meanX,
        y: meanY,
        theta: Math.atan2(meanSin, meanCos)
      },
      landmarks
    };
  }
}

// ============================================================================
// ICP SCAN MATCHING
// ============================================================================

class ICPScanMatcher {
  private maxIterations: number;
  private convergenceThreshold: number;
  private maxCorrespondenceDistance: number;

  constructor(
    maxIterations: number = 50,
    convergenceThreshold: number = 0.001,
    maxCorrespondenceDistance: number = 1.0
  ) {
    this.maxIterations = maxIterations;
    this.convergenceThreshold = convergenceThreshold;
    this.maxCorrespondenceDistance = maxCorrespondenceDistance;
  }

  match(source: Point2D[], target: Point2D[], initialGuess: Pose2D = { x: 0, y: 0, theta: 0 }): {
    transform: Pose2D;
    error: number;
    iterations: number;
    correspondences: number;
  } {
    let transform = { ...initialGuess };
    let prevError = Infinity;
    let iterations = 0;

    // Transform source points by initial guess
    let transformedSource = this.transformPoints(source, transform);

    for (let iter = 0; iter < this.maxIterations; iter++) {
      iterations = iter + 1;

      // Find correspondences
      const correspondences = this.findCorrespondences(transformedSource, target);

      if (correspondences.length < 3) {
        break;
      }

      // Compute optimal transformation
      const deltaTransform = this.computeTransformation(
        correspondences.map(c => transformedSource[c.sourceIdx]),
        correspondences.map(c => target[c.targetIdx])
      );

      // Update total transform
      transform = this.composeTransforms(transform, deltaTransform);

      // Transform source with new total transform
      transformedSource = this.transformPoints(source, transform);

      // Compute error
      const error = this.computeError(transformedSource, target, correspondences);

      // Check convergence
      if (Math.abs(prevError - error) < this.convergenceThreshold) {
        break;
      }

      prevError = error;
    }

    const finalCorrespondences = this.findCorrespondences(transformedSource, target);

    return {
      transform,
      error: prevError,
      iterations,
      correspondences: finalCorrespondences.length
    };
  }

  private transformPoints(points: Point2D[], transform: Pose2D): Point2D[] {
    const cos = Math.cos(transform.theta);
    const sin = Math.sin(transform.theta);

    return points.map(p => ({
      x: cos * p.x - sin * p.y + transform.x,
      y: sin * p.x + cos * p.y + transform.y
    }));
  }

  private findCorrespondences(source: Point2D[], target: Point2D[]): { sourceIdx: number; targetIdx: number }[] {
    const correspondences: { sourceIdx: number; targetIdx: number }[] = [];

    for (let i = 0; i < source.length; i++) {
      let minDist = Infinity;
      let minIdx = -1;

      for (let j = 0; j < target.length; j++) {
        const dx = source[i].x - target[j].x;
        const dy = source[i].y - target[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDist && dist < this.maxCorrespondenceDistance) {
          minDist = dist;
          minIdx = j;
        }
      }

      if (minIdx >= 0) {
        correspondences.push({ sourceIdx: i, targetIdx: minIdx });
      }
    }

    return correspondences;
  }

  private computeTransformation(source: Point2D[], target: Point2D[]): Pose2D {
    // Compute centroids
    let sourceCentroid = { x: 0, y: 0 };
    let targetCentroid = { x: 0, y: 0 };

    for (let i = 0; i < source.length; i++) {
      sourceCentroid.x += source[i].x;
      sourceCentroid.y += source[i].y;
      targetCentroid.x += target[i].x;
      targetCentroid.y += target[i].y;
    }

    sourceCentroid.x /= source.length;
    sourceCentroid.y /= source.length;
    targetCentroid.x /= target.length;
    targetCentroid.y /= target.length;

    // Compute cross-covariance matrix
    let sxx = 0, sxy = 0, syx = 0, syy = 0;

    for (let i = 0; i < source.length; i++) {
      const sx = source[i].x - sourceCentroid.x;
      const sy = source[i].y - sourceCentroid.y;
      const tx = target[i].x - targetCentroid.x;
      const ty = target[i].y - targetCentroid.y;

      sxx += sx * tx;
      sxy += sx * ty;
      syx += sy * tx;
      syy += sy * ty;
    }

    // Compute rotation using SVD (closed-form for 2D)
    const theta = Math.atan2(sxy - syx, sxx + syy);

    // Compute translation
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const tx = targetCentroid.x - (cos * sourceCentroid.x - sin * sourceCentroid.y);
    const ty = targetCentroid.y - (sin * sourceCentroid.x + cos * sourceCentroid.y);

    return { x: tx, y: ty, theta };
  }

  private composeTransforms(t1: Pose2D, t2: Pose2D): Pose2D {
    const cos = Math.cos(t1.theta);
    const sin = Math.sin(t1.theta);

    return {
      x: t1.x + cos * t2.x - sin * t2.y,
      y: t1.y + sin * t2.x + cos * t2.y,
      theta: t1.theta + t2.theta
    };
  }

  private computeError(source: Point2D[], target: Point2D[],
                       correspondences: { sourceIdx: number; targetIdx: number }[]): number {
    let error = 0;

    for (const c of correspondences) {
      const dx = source[c.sourceIdx].x - target[c.targetIdx].x;
      const dy = source[c.sourceIdx].y - target[c.targetIdx].y;
      error += dx * dx + dy * dy;
    }

    return correspondences.length > 0 ? error / correspondences.length : Infinity;
  }
}

// ============================================================================
// OCCUPANCY GRID MAPPING
// ============================================================================

class OccupancyGridMapper {
  private grid: OccupancyGrid;
  private logOdds: number[][];
  private priorLogOdds: number;
  private occupiedLogOdds: number;
  private freeLogOdds: number;

  constructor(
    width: number,
    height: number,
    resolution: number,
    origin: Point2D = { x: 0, y: 0 },
    priorProbability: number = 0.5
  ) {
    this.grid = {
      width: Math.ceil(width / resolution),
      height: Math.ceil(height / resolution),
      resolution,
      origin,
      data: []
    };

    this.priorLogOdds = Math.log(priorProbability / (1 - priorProbability));
    this.occupiedLogOdds = 0.85;  // log odds of occupied given measurement
    this.freeLogOdds = -0.4;       // log odds of free given measurement

    // Initialize log odds grid
    this.logOdds = [];
    for (let i = 0; i < this.grid.height; i++) {
      this.logOdds.push(Array(this.grid.width).fill(this.priorLogOdds));
    }
  }

  update(pose: Pose2D, scan: LaserScan): void {
    const { x, y, theta } = pose;

    for (let i = 0; i < scan.ranges.length; i++) {
      const angle = scan.angleMin + i * scan.angleIncrement + theta;
      const range = scan.ranges[i];

      if (range <= 0 || !isFinite(range)) continue;

      // Ray endpoint
      const endX = x + range * Math.cos(angle);
      const endY = y + range * Math.sin(angle);

      // Trace ray using Bresenham's algorithm
      const cells = this.bresenham(x, y, endX, endY);

      // Mark cells as free except the last one
      for (let j = 0; j < cells.length - 1; j++) {
        const { gx, gy } = cells[j];
        if (this.isValidCell(gx, gy)) {
          this.logOdds[gy][gx] += this.freeLogOdds - this.priorLogOdds;
          this.logOdds[gy][gx] = Math.max(-10, Math.min(10, this.logOdds[gy][gx]));
        }
      }

      // Mark last cell as occupied
      if (cells.length > 0) {
        const { gx, gy } = cells[cells.length - 1];
        if (this.isValidCell(gx, gy)) {
          this.logOdds[gy][gx] += this.occupiedLogOdds - this.priorLogOdds;
          this.logOdds[gy][gx] = Math.max(-10, Math.min(10, this.logOdds[gy][gx]));
        }
      }
    }
  }

  private bresenham(x0: number, y0: number, x1: number, y1: number): { gx: number; gy: number }[] {
    const cells: { gx: number; gy: number }[] = [];

    // Convert to grid coordinates
    const gx0 = Math.floor((x0 - this.grid.origin.x) / this.grid.resolution);
    const gy0 = Math.floor((y0 - this.grid.origin.y) / this.grid.resolution);
    const gx1 = Math.floor((x1 - this.grid.origin.x) / this.grid.resolution);
    const gy1 = Math.floor((y1 - this.grid.origin.y) / this.grid.resolution);

    const dx = Math.abs(gx1 - gx0);
    const dy = Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx - dy;

    let gx = gx0;
    let gy = gy0;

    while (true) {
      cells.push({ gx, gy });

      if (gx === gx1 && gy === gy1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        gx += sx;
      }
      if (e2 < dx) {
        err += dx;
        gy += sy;
      }
    }

    return cells;
  }

  private isValidCell(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.grid.width && gy >= 0 && gy < this.grid.height;
  }

  getGrid(): OccupancyGrid {
    // Convert log odds to probabilities
    const data: number[][] = [];
    for (let i = 0; i < this.grid.height; i++) {
      data.push([]);
      for (let j = 0; j < this.grid.width; j++) {
        const prob = 1 / (1 + Math.exp(-this.logOdds[i][j]));
        data[i].push(prob);
      }
    }

    return {
      ...this.grid,
      data
    };
  }
}

// ============================================================================
// GRAPH-BASED SLAM
// ============================================================================

class GraphSLAM {
  private nodes: GraphNode[];
  private edges: GraphEdge[];
  private maxIterations: number;

  constructor(maxIterations: number = 100) {
    this.nodes = [];
    this.edges = [];
    this.maxIterations = maxIterations;
  }

  addNode(pose: Pose2D): number {
    const id = this.nodes.length;
    this.nodes.push({ id, pose: { ...pose } });
    return id;
  }

  addEdge(from: number, to: number, measurement: Pose2D, information: number[][]): void {
    this.edges.push({ from, to, measurement: { ...measurement }, information });
  }

  optimize(): { poses: Pose2D[]; error: number } {
    if (this.nodes.length === 0) {
      return { poses: [], error: 0 };
    }

    // Gauss-Newton optimization
    let prevError = Infinity;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Build linear system
      const { H, b, error } = this.buildLinearSystem();

      // Check convergence
      if (Math.abs(prevError - error) < 1e-6) {
        break;
      }
      prevError = error;

      // Solve H * dx = -b
      // Fix first node (anchor)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < H.cols; j++) {
          H.set(i, j, 0);
        }
        H.set(i, i, 1);
        b[i] = 0;
      }

      const dx = this.solveLinearSystem(H, b);

      // Update poses
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].pose.x += dx[i * 3];
        this.nodes[i].pose.y += dx[i * 3 + 1];
        this.nodes[i].pose.theta = this.normalizeAngle(this.nodes[i].pose.theta + dx[i * 3 + 2]);
      }
    }

    return {
      poses: this.nodes.map(n => ({ ...n.pose })),
      error: prevError
    };
  }

  private buildLinearSystem(): { H: Matrix; b: number[]; error: number } {
    const n = this.nodes.length * 3;
    const H = Matrix.zeros(n, n);
    const b = Array(n).fill(0);
    let totalError = 0;

    for (const edge of this.edges) {
      const i = edge.from;
      const j = edge.to;

      const xi = this.nodes[i].pose;
      const xj = this.nodes[j].pose;
      const zij = edge.measurement;
      const omega = Matrix.fromArray(edge.information);

      // Compute error
      const error = this.computeEdgeError(xi, xj, zij);
      const errorVec = [error.x, error.y, error.theta];

      // Compute Jacobians
      const { Ai, Aj } = this.computeJacobians(xi, xj);

      // Accumulate H and b
      const AiT = Ai.transpose();
      const AjT = Aj.transpose();

      const AiTOmega = AiT.multiply(omega);
      const AjTOmega = AjT.multiply(omega);

      // H_ii += Ai^T * Omega * Ai
      const Hii = AiTOmega.multiply(Ai);
      // H_ij += Ai^T * Omega * Aj
      const Hij = AiTOmega.multiply(Aj);
      // H_jj += Aj^T * Omega * Aj
      const Hjj = AjTOmega.multiply(Aj);

      // Add to H
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          H.set(i * 3 + r, i * 3 + c, H.get(i * 3 + r, i * 3 + c) + Hii.get(r, c));
          H.set(i * 3 + r, j * 3 + c, H.get(i * 3 + r, j * 3 + c) + Hij.get(r, c));
          H.set(j * 3 + r, i * 3 + c, H.get(j * 3 + r, i * 3 + c) + Hij.get(c, r));
          H.set(j * 3 + r, j * 3 + c, H.get(j * 3 + r, j * 3 + c) + Hjj.get(r, c));
        }
      }

      // Add to b
      for (let r = 0; r < 3; r++) {
        let bi = 0, bj = 0;
        for (let c = 0; c < 3; c++) {
          bi += AiTOmega.get(r, c) * errorVec[c];
          bj += AjTOmega.get(r, c) * errorVec[c];
        }
        b[i * 3 + r] += bi;
        b[j * 3 + r] += bj;
      }

      // Compute total error
      let e = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          e += errorVec[r] * omega.get(r, c) * errorVec[c];
        }
      }
      totalError += e;
    }

    return { H, b, error: totalError };
  }

  private computeEdgeError(xi: Pose2D, xj: Pose2D, zij: Pose2D): Pose2D {
    const cos = Math.cos(xi.theta);
    const sin = Math.sin(xi.theta);

    // Predicted measurement
    const dx = xj.x - xi.x;
    const dy = xj.y - xi.y;

    const predicted = {
      x: cos * dx + sin * dy,
      y: -sin * dx + cos * dy,
      theta: this.normalizeAngle(xj.theta - xi.theta)
    };

    return {
      x: predicted.x - zij.x,
      y: predicted.y - zij.y,
      theta: this.normalizeAngle(predicted.theta - zij.theta)
    };
  }

  private computeJacobians(xi: Pose2D, xj: Pose2D): { Ai: Matrix; Aj: Matrix } {
    const cos = Math.cos(xi.theta);
    const sin = Math.sin(xi.theta);
    const dx = xj.x - xi.x;
    const dy = xj.y - xi.y;

    const Ai = Matrix.fromArray([
      [-cos, -sin, -sin * dx + cos * dy],
      [sin, -cos, -cos * dx - sin * dy],
      [0, 0, -1]
    ]);

    const Aj = Matrix.fromArray([
      [cos, sin, 0],
      [-sin, cos, 0],
      [0, 0, 1]
    ]);

    return { Ai, Aj };
  }

  private solveLinearSystem(H: Matrix, b: number[]): number[] {
    const n = b.length;
    const aug = new Matrix(n, n + 1);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        aug.set(i, j, H.get(i, j));
      }
      aug.set(i, n, -b[i]);
    }

    // Gaussian elimination
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug.get(row, col)) > Math.abs(aug.get(maxRow, col))) {
          maxRow = row;
        }
      }

      // Swap rows
      for (let j = 0; j <= n; j++) {
        const temp = aug.get(col, j);
        aug.set(col, j, aug.get(maxRow, j));
        aug.set(maxRow, j, temp);
      }

      const pivot = aug.get(col, col);
      if (Math.abs(pivot) < 1e-10) continue;

      // Scale row
      for (let j = 0; j <= n; j++) {
        aug.set(col, j, aug.get(col, j) / pivot);
      }

      // Eliminate
      for (let row = 0; row < n; row++) {
        if (row !== col) {
          const factor = aug.get(row, col);
          for (let j = 0; j <= n; j++) {
            aug.set(row, j, aug.get(row, j) - factor * aug.get(col, j));
          }
        }
      }
    }

    const result: number[] = [];
    for (let i = 0; i < n; i++) {
      result.push(aug.get(i, n));
    }

    return result;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const slamalgorithmTool: UnifiedTool = {
  name: 'slam_algorithm',
  description: 'Simultaneous Localization and Mapping (SLAM) algorithms for robotics including EKF-SLAM, FastSLAM, Graph-SLAM, ICP scan matching, and occupancy grid mapping',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['ekf_slam', 'fast_slam', 'graph_slam', 'icp_match', 'occupancy_grid', 'info', 'examples', 'demo'],
        description: 'SLAM operation to perform'
      },
      parameters: {
        type: 'object',
        description: 'Operation-specific parameters'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeslamalgorithm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, parameters = {} } = args;

    switch (operation) {
      case 'ekf_slam': {
        const {
          initialPose = { x: 0, y: 0, theta: 0 },
          processNoise = { x: 0.1, y: 0.1, theta: 0.05 },
          observationNoise = { range: 0.2, bearing: 0.1 },
          odometrySequence = [],
          observationSequence = []
        } = parameters;

        const slam = new EKFSLAM(initialPose, processNoise, observationNoise);

        const trajectory: Pose2D[] = [{ ...initialPose }];

        for (let i = 0; i < odometrySequence.length; i++) {
          slam.predict(odometrySequence[i]);

          if (observationSequence[i] && observationSequence[i].length > 0) {
            slam.update(observationSequence[i]);
          }

          const result = slam.getResult();
          trajectory.push({ ...result.estimatedPose });
        }

        const finalResult = slam.getResult();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'ekf_slam',
            algorithm: 'Extended Kalman Filter SLAM',
            result: {
              estimatedPose: finalResult.estimatedPose,
              landmarks: finalResult.landmarks,
              poseUncertainty: finalResult.uncertainty,
              trajectory: trajectory,
              numLandmarks: finalResult.landmarks.length
            },
            description: 'EKF-SLAM maintains Gaussian belief over robot pose and landmark positions'
          }, null, 2)
        };
      }

      case 'fast_slam': {
        const {
          initialPose = { x: 0, y: 0, theta: 0 },
          numParticles = 100,
          processNoise = { x: 0.1, y: 0.1, theta: 0.05 },
          observationNoise = { range: 0.2, bearing: 0.1 },
          odometrySequence = [],
          observationSequence = []
        } = parameters;

        const slam = new FastSLAM(initialPose, numParticles, processNoise, observationNoise);

        const trajectory: Pose2D[] = [{ ...initialPose }];

        for (let i = 0; i < odometrySequence.length; i++) {
          slam.predict(odometrySequence[i]);

          if (observationSequence[i] && observationSequence[i].length > 0) {
            slam.update(observationSequence[i]);
          }

          const result = slam.getResult();
          trajectory.push({ ...result.estimatedPose });
        }

        const finalResult = slam.getResult();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'fast_slam',
            algorithm: 'Rao-Blackwellized Particle Filter SLAM',
            result: {
              estimatedPose: finalResult.estimatedPose,
              landmarks: finalResult.landmarks,
              trajectory: trajectory,
              numParticles,
              numLandmarks: finalResult.landmarks.length
            },
            description: 'FastSLAM uses particle filter for robot trajectory and EKF for landmark positions'
          }, null, 2)
        };
      }

      case 'graph_slam': {
        const {
          poses = [],
          odometryConstraints = [],
          loopClosures = [],
          information = [[500, 0, 0], [0, 500, 0], [0, 0, 500]]
        } = parameters;

        const graphSlam = new GraphSLAM();

        // Add nodes
        for (const pose of poses) {
          graphSlam.addNode(pose);
        }

        // Add odometry constraints
        for (const constraint of odometryConstraints) {
          graphSlam.addEdge(
            constraint.from,
            constraint.to,
            constraint.measurement,
            information
          );
        }

        // Add loop closure constraints
        for (const lc of loopClosures) {
          graphSlam.addEdge(
            lc.from,
            lc.to,
            lc.measurement,
            lc.information || information
          );
        }

        const result = graphSlam.optimize();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'graph_slam',
            algorithm: 'Graph-based SLAM with Gauss-Newton optimization',
            result: {
              optimizedPoses: result.poses,
              finalError: result.error,
              numNodes: poses.length,
              numEdges: odometryConstraints.length + loopClosures.length,
              numLoopClosures: loopClosures.length
            },
            description: 'Graph-SLAM optimizes all poses simultaneously using pose graph constraints'
          }, null, 2)
        };
      }

      case 'icp_match': {
        const {
          sourcePoints = [],
          targetPoints = [],
          initialGuess = { x: 0, y: 0, theta: 0 },
          maxIterations = 50,
          convergenceThreshold = 0.001,
          maxCorrespondenceDistance = 1.0
        } = parameters;

        const icp = new ICPScanMatcher(maxIterations, convergenceThreshold, maxCorrespondenceDistance);
        const result = icp.match(sourcePoints, targetPoints, initialGuess);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'icp_match',
            algorithm: 'Iterative Closest Point',
            result: {
              transform: result.transform,
              meanSquaredError: result.error,
              iterations: result.iterations,
              correspondences: result.correspondences,
              converged: result.iterations < maxIterations
            },
            description: 'ICP aligns point clouds by iteratively finding correspondences and minimizing alignment error'
          }, null, 2)
        };
      }

      case 'occupancy_grid': {
        const {
          width = 20,
          height = 20,
          resolution = 0.1,
          origin = { x: -10, y: -10 },
          poses = [],
          scans = []
        } = parameters;

        const mapper = new OccupancyGridMapper(width, height, resolution, origin);

        for (let i = 0; i < poses.length && i < scans.length; i++) {
          mapper.update(poses[i], scans[i]);
        }

        const grid = mapper.getGrid();

        // Compute statistics
        let occupiedCells = 0;
        let freeCells = 0;
        let unknownCells = 0;

        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            const p = grid.data[y][x];
            if (p > 0.65) occupiedCells++;
            else if (p < 0.35) freeCells++;
            else unknownCells++;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'occupancy_grid',
            algorithm: 'Log-odds Occupancy Grid Mapping',
            result: {
              gridDimensions: { width: grid.width, height: grid.height },
              resolution: grid.resolution,
              origin: grid.origin,
              statistics: {
                occupiedCells,
                freeCells,
                unknownCells,
                totalCells: grid.width * grid.height
              },
              map: grid.data
            },
            description: 'Occupancy grid mapping builds probabilistic 2D maps from sensor data'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'slam_algorithm',
            description: 'Simultaneous Localization and Mapping algorithms for robotics',
            algorithms: {
              ekf_slam: {
                name: 'Extended Kalman Filter SLAM',
                description: 'Maintains Gaussian belief over robot and landmark positions',
                complexity: 'O(n^2) per update where n = number of landmarks',
                advantages: ['Optimal for linear Gaussian systems', 'Provides uncertainty estimates'],
                limitations: ['Quadratic complexity', 'Linearization errors']
              },
              fast_slam: {
                name: 'FastSLAM (Rao-Blackwellized Particle Filter)',
                description: 'Uses particles for robot trajectory, EKF for landmarks',
                complexity: 'O(M * log n) per update where M = particles, n = landmarks',
                advantages: ['Better scaling', 'Non-Gaussian robot pose'],
                limitations: ['Particle depletion', 'Memory for particles']
              },
              graph_slam: {
                name: 'Graph-based SLAM',
                description: 'Optimizes pose graph using nonlinear least squares',
                complexity: 'Sparse: O(n) per iteration',
                advantages: ['Globally consistent', 'Handles loop closures well'],
                limitations: ['Batch processing', 'Requires good initialization']
              },
              icp_match: {
                name: 'Iterative Closest Point',
                description: 'Aligns point clouds for scan matching',
                complexity: 'O(n * m) per iteration',
                advantages: ['No feature extraction needed', 'Works with raw scans'],
                limitations: ['Local minima', 'Needs good initial guess']
              },
              occupancy_grid: {
                name: 'Occupancy Grid Mapping',
                description: 'Builds 2D probabilistic maps from range sensors',
                complexity: 'O(r) per ray where r = ray length in cells',
                advantages: ['Simple representation', 'Path planning friendly'],
                limitations: ['Memory for large maps', 'Assumes known poses']
              }
            },
            operations: ['ekf_slam', 'fast_slam', 'graph_slam', 'icp_match', 'occupancy_grid', 'info', 'examples', 'demo']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'EKF-SLAM with landmarks',
                operation: 'ekf_slam',
                parameters: {
                  initialPose: { x: 0, y: 0, theta: 0 },
                  processNoise: { x: 0.1, y: 0.1, theta: 0.05 },
                  observationNoise: { range: 0.2, bearing: 0.1 },
                  odometrySequence: [
                    { dx: 1, dy: 0, dtheta: 0 },
                    { dx: 1, dy: 0, dtheta: Math.PI / 4 }
                  ],
                  observationSequence: [
                    [{ landmarkId: 1, range: 2.5, bearing: Math.PI / 6 }],
                    [{ landmarkId: 1, range: 2.0, bearing: Math.PI / 4 }]
                  ]
                }
              },
              {
                name: 'ICP scan matching',
                operation: 'icp_match',
                parameters: {
                  sourcePoints: [
                    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
                  ],
                  targetPoints: [
                    { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1.5, y: 1.5 }, { x: 0.5, y: 1.5 }
                  ],
                  initialGuess: { x: 0, y: 0, theta: 0 }
                }
              },
              {
                name: 'Graph-SLAM optimization',
                operation: 'graph_slam',
                parameters: {
                  poses: [
                    { x: 0, y: 0, theta: 0 },
                    { x: 1, y: 0, theta: 0 },
                    { x: 2, y: 0, theta: Math.PI / 2 },
                    { x: 2, y: 1, theta: Math.PI }
                  ],
                  odometryConstraints: [
                    { from: 0, to: 1, measurement: { x: 1, y: 0, theta: 0 } },
                    { from: 1, to: 2, measurement: { x: 1, y: 0, theta: Math.PI / 2 } },
                    { from: 2, to: 3, measurement: { x: 0, y: 1, theta: Math.PI / 2 } }
                  ],
                  loopClosures: []
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo: Run a simple SLAM scenario
        const slam = new EKFSLAM(
          { x: 0, y: 0, theta: 0 },
          { x: 0.1, y: 0.1, theta: 0.05 },
          { range: 0.2, bearing: 0.1 }
        );

        // Simulate robot moving in a square with landmark observations
        const trajectory: Pose2D[] = [{ x: 0, y: 0, theta: 0 }];

        // Move forward, observe landmark 1
        slam.predict({ dx: 1, dy: 0, dtheta: 0 });
        slam.update([{ landmarkId: 1, range: 3, bearing: Math.PI / 4 }]);
        trajectory.push({ ...slam.getResult().estimatedPose });

        // Turn and move, observe landmarks 1 and 2
        slam.predict({ dx: 1, dy: 0, dtheta: Math.PI / 2 });
        slam.update([
          { landmarkId: 1, range: 2.5, bearing: -Math.PI / 6 },
          { landmarkId: 2, range: 2, bearing: Math.PI / 3 }
        ]);
        trajectory.push({ ...slam.getResult().estimatedPose });

        // Continue around
        slam.predict({ dx: 1, dy: 0, dtheta: Math.PI / 2 });
        slam.update([{ landmarkId: 2, range: 1.5, bearing: -Math.PI / 4 }]);
        trajectory.push({ ...slam.getResult().estimatedPose });

        const finalResult = slam.getResult();

        return {
          toolCallId: id,
          content: JSON.stringify({
            demo: 'EKF-SLAM simulation',
            description: 'Robot moving while observing landmarks',
            result: {
              finalPose: finalResult.estimatedPose,
              landmarks: finalResult.landmarks,
              trajectory: trajectory,
              poseUncertainty: finalResult.uncertainty
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['ekf_slam', 'fast_slam', 'graph_slam', 'icp_match', 'occupancy_grid', 'info', 'examples', 'demo']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({ error: errorMessage }, null, 2),
      isError: true
    };
  }
}

export function isslamalgorithmAvailable(): boolean {
  return true;
}
