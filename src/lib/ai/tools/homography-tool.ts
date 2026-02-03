/**
 * HOMOGRAPHY TOOL
 * Homography estimation and perspective transforms
 *
 * Features:
 * - Direct Linear Transform (DLT) for homography estimation
 * - RANSAC for robust estimation with outlier rejection
 * - Normalized DLT for numerical stability
 * - Perspective warping
 * - Homography decomposition into rotation/translation
 * - Point and line transformation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HomographyMatrix {
  data: number[][]; // 3x3 matrix
}

interface Point2D {
  x: number;
  y: number;
}

interface PointCorrespondence {
  src: Point2D;
  dst: Point2D;
}

interface HomographyResult {
  H: number[][];
  Hinv?: number[][];
  inliers?: number[];
  error?: number;
  numIterations?: number;
}

interface NormalizationParams {
  T: number[][]; // Normalization transform
  centroid: Point2D;
  scale: number;
}

interface DecompositionResult {
  R: number[][]; // Rotation matrix (3x3)
  t: number[]; // Translation vector
  n: number[]; // Normal vector
  d: number; // Distance to plane
  valid: boolean;
}

// ============================================================================
// MATRIX UTILITIES
// ============================================================================

/**
 * Create identity matrix
 */
function eye(n: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = i === j ? 1 : 0;
    }
  }
  return result;
}

/**
 * Create zero matrix
 */
function zeros(rows: number, cols: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    result[i] = new Array(cols).fill(0);
  }
  return result;
}

/**
 * Matrix multiplication
 */
function matmul(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result = zeros(rowsA, colsB);

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

/**
 * Matrix-vector multiplication
 */
function matvec(A: number[][], v: number[]): number[] {
  const rows = A.length;
  const cols = A[0].length;
  const result = new Array(rows).fill(0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i] += A[i][j] * v[j];
    }
  }

  return result;
}

/**
 * Matrix transpose
 */
function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const result = zeros(cols, rows);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }

  return result;
}

/**
 * Frobenius norm
 */
export function frobeniusNorm(A: number[][]): number {
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[i].length; j++) {
      sum += A[i][j] * A[i][j];
    }
  }
  return Math.sqrt(sum);
}

/**
 * Vector norm
 */
function vectorNorm(v: number[]): number {
  let sum = 0;
  for (const val of v) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Normalize vector
 */
function normalizeVector(v: number[]): number[] {
  const norm = vectorNorm(v);
  if (norm < 1e-10) return v.slice();
  return v.map((x) => x / norm);
}

/**
 * Cross product of 3D vectors
 */
function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Dot product
 */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ============================================================================
// SVD IMPLEMENTATION
// ============================================================================

/**
 * Compute SVD using Jacobi rotations
 * Returns U, S (diagonal values), V such that A = U * diag(S) * V^T
 */
function computeSVD(A: number[][]): { U: number[][]; S: number[]; V: number[][] } {
  const m = A.length;
  const n = A[0].length;

  // Work with A^T * A for V
  const AtA = matmul(transpose(A), A);

  // Eigendecomposition of A^T * A using Jacobi
  const { eigenvalues, eigenvectors } = jacobiEigen(AtA);

  // Sort by eigenvalue descending
  const indices = eigenvalues.map((v, i) => ({ v, i }));
  indices.sort((a, b) => b.v - a.v);

  const S = indices.map((x) => Math.sqrt(Math.max(0, x.v)));
  const V: number[][] = [];

  for (let i = 0; i < n; i++) {
    V[i] = [];
    for (let j = 0; j < n; j++) {
      V[i][j] = eigenvectors[i][indices[j].i];
    }
  }

  // Compute U = A * V * S^-1
  const U = zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (S[j] > 1e-10) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += A[i][k] * V[k][j];
        }
        U[i][j] = sum / S[j];
      }
    }
  }

  // Orthonormalize U columns
  for (let j = 0; j < n; j++) {
    let norm = 0;
    for (let i = 0; i < m; i++) {
      norm += U[i][j] * U[i][j];
    }
    norm = Math.sqrt(norm);
    if (norm > 1e-10) {
      for (let i = 0; i < m; i++) {
        U[i][j] /= norm;
      }
    }
  }

  return { U, S, V };
}

/**
 * Jacobi eigendecomposition for symmetric matrices
 */
function jacobiEigen(A: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = A.length;
  const maxIter = 100;
  const tolerance = 1e-10;

  // Copy A
  const M: number[][] = A.map((row) => [...row]);
  const V = eye(n);

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0;
    let p = 0,
      q = 1;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(M[i][j]) > maxVal) {
          maxVal = Math.abs(M[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < tolerance) break;

    // Compute rotation
    const theta = (M[q][q] - M[p][p]) / (2 * M[p][q]);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    // Apply rotation to M
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const temp = M[i][p];
        M[i][p] = c * temp - s * M[i][q];
        M[p][i] = M[i][p];
        M[i][q] = s * temp + c * M[i][q];
        M[q][i] = M[i][q];
      }
    }

    const Mpp = M[p][p];
    const Mqq = M[q][q];
    const Mpq = M[p][q];

    M[p][p] = c * c * Mpp - 2 * s * c * Mpq + s * s * Mqq;
    M[q][q] = s * s * Mpp + 2 * s * c * Mpq + c * c * Mqq;
    M[p][q] = 0;
    M[q][p] = 0;

    // Update eigenvectors
    for (let i = 0; i < n; i++) {
      const temp = V[i][p];
      V[i][p] = c * temp - s * V[i][q];
      V[i][q] = s * temp + c * V[i][q];
    }
  }

  const eigenvalues = [];
  for (let i = 0; i < n; i++) {
    eigenvalues.push(M[i][i]);
  }

  return { eigenvalues, eigenvectors: V };
}

/**
 * Compute 3x3 matrix inverse
 */
function inverse3x3(M: number[][]): number[][] | null {
  const det =
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

  if (Math.abs(det) < 1e-10) return null;

  const invDet = 1 / det;

  return [
    [
      (M[1][1] * M[2][2] - M[1][2] * M[2][1]) * invDet,
      (M[0][2] * M[2][1] - M[0][1] * M[2][2]) * invDet,
      (M[0][1] * M[1][2] - M[0][2] * M[1][1]) * invDet,
    ],
    [
      (M[1][2] * M[2][0] - M[1][0] * M[2][2]) * invDet,
      (M[0][0] * M[2][2] - M[0][2] * M[2][0]) * invDet,
      (M[0][2] * M[1][0] - M[0][0] * M[1][2]) * invDet,
    ],
    [
      (M[1][0] * M[2][1] - M[1][1] * M[2][0]) * invDet,
      (M[0][1] * M[2][0] - M[0][0] * M[2][1]) * invDet,
      (M[0][0] * M[1][1] - M[0][1] * M[1][0]) * invDet,
    ],
  ];
}

// ============================================================================
// POINT NORMALIZATION
// ============================================================================

/**
 * Normalize points for numerical stability
 * Centers points at origin and scales so average distance from origin is sqrt(2)
 */
function normalizePoints(points: Point2D[]): {
  normalized: Point2D[];
  params: NormalizationParams;
} {
  const n = points.length;

  // Compute centroid
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  // Compute average distance from centroid
  let avgDist = 0;
  for (const p of points) {
    avgDist += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
  }
  avgDist /= n;

  // Scale factor to make average distance sqrt(2)
  const scale = avgDist > 1e-10 ? Math.sqrt(2) / avgDist : 1;

  // Normalization transform
  const T = [
    [scale, 0, -scale * cx],
    [0, scale, -scale * cy],
    [0, 0, 1],
  ];

  // Apply normalization
  const normalized: Point2D[] = points.map((p) => ({
    x: scale * (p.x - cx),
    y: scale * (p.y - cy),
  }));

  return {
    normalized,
    params: { T, centroid: { x: cx, y: cy }, scale },
  };
}

// ============================================================================
// HOMOGRAPHY ESTIMATION
// ============================================================================

/**
 * Direct Linear Transform (DLT) for homography estimation
 * Requires at least 4 point correspondences
 */
function computeHomographyDLT(correspondences: PointCorrespondence[]): number[][] | null {
  const n = correspondences.length;
  if (n < 4) return null;

  // Build the constraint matrix A (2n x 9)
  const A: number[][] = [];

  for (const { src, dst } of correspondences) {
    const x = src.x,
      y = src.y;
    const xp = dst.x,
      yp = dst.y;

    A.push([-x, -y, -1, 0, 0, 0, x * xp, y * xp, xp]);
    A.push([0, 0, 0, -x, -y, -1, x * yp, y * yp, yp]);
  }

  // Solve using SVD: find null space of A
  const { V } = computeSVD(A);

  // Last column of V is the solution (null space)
  const h: number[] = [];
  for (let i = 0; i < 9; i++) {
    h.push(V[i][8]);
  }

  // Reshape to 3x3 matrix
  const H = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], h[8]],
  ];

  // Normalize so H[2][2] = 1
  const scale = H[2][2];
  if (Math.abs(scale) > 1e-10) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        H[i][j] /= scale;
      }
    }
  }

  return H;
}

/**
 * Normalized DLT for better numerical stability
 */
function computeHomographyNormalizedDLT(correspondences: PointCorrespondence[]): number[][] | null {
  const srcPoints = correspondences.map((c) => c.src);
  const dstPoints = correspondences.map((c) => c.dst);

  // Normalize points
  const { normalized: normSrc, params: paramsSrc } = normalizePoints(srcPoints);
  const { normalized: normDst, params: paramsDst } = normalizePoints(dstPoints);

  // Create normalized correspondences
  const normCorrespondences: PointCorrespondence[] = [];
  for (let i = 0; i < correspondences.length; i++) {
    normCorrespondences.push({
      src: normSrc[i],
      dst: normDst[i],
    });
  }

  // Compute homography on normalized points
  const Hnorm = computeHomographyDLT(normCorrespondences);
  if (!Hnorm) return null;

  // Denormalize: H = T2^-1 * Hnorm * T1
  const T1 = paramsSrc.T;
  const T2inv = inverse3x3(paramsDst.T);
  if (!T2inv) return null;

  const H = matmul(matmul(T2inv, Hnorm), T1);

  // Normalize
  const scale = H[2][2];
  if (Math.abs(scale) > 1e-10) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        H[i][j] /= scale;
      }
    }
  }

  return H;
}

/**
 * Transform point using homography
 */
function transformPoint(H: number[][], p: Point2D): Point2D {
  const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
  if (Math.abs(w) < 1e-10) {
    return { x: Infinity, y: Infinity };
  }
  return {
    x: (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / w,
    y: (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / w,
  };
}

/**
 * Compute reprojection error for a correspondence
 */
function computeReprojectionError(H: number[][], correspondence: PointCorrespondence): number {
  const projected = transformPoint(H, correspondence.src);
  const dx = projected.x - correspondence.dst.x;
  const dy = projected.y - correspondence.dst.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * RANSAC for robust homography estimation
 */
function computeHomographyRANSAC(
  correspondences: PointCorrespondence[],
  threshold: number = 3.0,
  maxIterations: number = 1000,
  confidence: number = 0.99
): HomographyResult | null {
  const n = correspondences.length;
  if (n < 4) return null;

  let bestH: number[][] | null = null;
  let bestInliers: number[] = [];
  let bestError = Infinity;

  // Adaptive number of iterations
  let numIterations = maxIterations;

  for (let iter = 0; iter < numIterations; iter++) {
    // Randomly select 4 correspondences
    const indices = selectRandomSample(n, 4);
    const sample = indices.map((i) => correspondences[i]);

    // Check if points are not collinear
    if (
      arePointsCollinear(sample.map((c) => c.src)) ||
      arePointsCollinear(sample.map((c) => c.dst))
    ) {
      continue;
    }

    // Compute homography from sample
    const H = computeHomographyNormalizedDLT(sample);
    if (!H) continue;

    // Find inliers
    const inliers: number[] = [];
    let totalError = 0;

    for (let i = 0; i < n; i++) {
      const error = computeReprojectionError(H, correspondences[i]);
      if (error < threshold) {
        inliers.push(i);
        totalError += error;
      }
    }

    if (
      inliers.length > bestInliers.length ||
      (inliers.length === bestInliers.length && totalError < bestError)
    ) {
      bestH = H;
      bestInliers = inliers;
      bestError = totalError;

      // Update number of iterations
      const inlierRatio = inliers.length / n;
      if (inlierRatio > 0) {
        const p = Math.pow(inlierRatio, 4);
        numIterations = Math.min(
          maxIterations,
          Math.ceil(Math.log(1 - confidence) / Math.log(1 - p))
        );
      }
    }
  }

  if (!bestH || bestInliers.length < 4) return null;

  // Refine using all inliers
  const inlierCorrespondences = bestInliers.map((i) => correspondences[i]);
  const refinedH = computeHomographyNormalizedDLT(inlierCorrespondences);

  if (refinedH) {
    bestH = refinedH;

    // Recompute error
    bestError = 0;
    for (const idx of bestInliers) {
      bestError += computeReprojectionError(bestH, correspondences[idx]);
    }
  }

  const Hinv = inverse3x3(bestH);

  return {
    H: bestH,
    Hinv: Hinv || undefined,
    inliers: bestInliers,
    error: bestError / bestInliers.length,
    numIterations,
  };
}

/**
 * Select random sample without replacement
 */
function selectRandomSample(n: number, k: number): number[] {
  const indices: number[] = [];
  const available = Array.from({ length: n }, (_, i) => i);

  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * available.length);
    indices.push(available[idx]);
    available.splice(idx, 1);
  }

  return indices;
}

/**
 * Check if points are approximately collinear
 */
function arePointsCollinear(points: Point2D[], tolerance: number = 1e-6): boolean {
  if (points.length < 3) return true;

  const p0 = points[0];
  const p1 = points[1];

  for (let i = 2; i < points.length; i++) {
    const p2 = points[i];
    const area = Math.abs((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y));
    if (area > tolerance) return false;
  }

  return true;
}

// ============================================================================
// HOMOGRAPHY DECOMPOSITION
// ============================================================================

/**
 * Decompose homography into rotation, translation, and plane normal
 * H = R + t * n^T / d
 * where R is rotation, t is translation, n is plane normal, d is distance
 */
function decomposeHomography(H: number[][], K?: number[][]): DecompositionResult[] {
  // If no intrinsics provided, assume identity
  const Kinv = K ? inverse3x3(K) : eye(3);
  if (!Kinv) {
    return [{ R: eye(3), t: [0, 0, 0], n: [0, 0, 1], d: 1, valid: false }];
  }

  // Normalize homography: H' = K^-1 * H * K
  const Hnorm = K ? matmul(matmul(Kinv, H), K) : H;

  // Compute SVD of normalized homography
  const { U, S, V } = computeSVD(Hnorm);

  // Scale to make middle singular value = 1
  const s = S[1];
  if (Math.abs(s) < 1e-10) {
    return [{ R: eye(3), t: [0, 0, 0], n: [0, 0, 1], d: 1, valid: false }];
  }

  const d1 = S[0] / s;
  const d3 = S[2] / s;

  const results: DecompositionResult[] = [];

  // Check if this is a pure rotation
  if (Math.abs(d1 - 1) < 0.01 && Math.abs(d3 - 1) < 0.01) {
    // Pure rotation, no translation
    results.push({
      R: Hnorm,
      t: [0, 0, 0],
      n: [0, 0, 1],
      d: Infinity,
      valid: true,
    });
    return results;
  }

  // General case: 4 possible decompositions
  const x1 = Math.sqrt((1 - d3 * d3) / (d1 * d1 - d3 * d3));
  const x3 = Math.sqrt((d1 * d1 - 1) / (d1 * d1 - d3 * d3));

  const sin_theta = Math.sqrt((d1 * d1 - 1) * (1 - d3 * d3)) / ((d1 + d3) * x1 * x3);
  const cos_theta = (x1 * x1 + d1 * d3 * x3 * x3) / ((d1 + d3) * x1 * x3);

  // Four possible solutions
  const signs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (const [s1, s3] of signs) {
    const n_prime = [s1 * x1, 0, s3 * x3];
    const t_prime = [(d1 - d3) * s1 * x1, 0, (d1 - d3) * s3 * x3];

    // Transform back
    const n = matvec(V, n_prime);
    const t = matvec(U, t_prime);

    // Compute R
    const R = matmul(
      U,
      matmul(
        [
          [cos_theta, 0, -sin_theta * s1 * s3],
          [0, 1, 0],
          [sin_theta * s1 * s3, 0, cos_theta],
        ],
        transpose(V)
      )
    );

    // Check validity: n[2] should be positive (normal pointing towards camera)
    // and t[2] can be either positive or negative
    const valid = n[2] > 0;

    results.push({
      R,
      t,
      n: normalizeVector(n),
      d: 1, // Normalized distance
      valid,
    });
  }

  return results;
}

// ============================================================================
// PERSPECTIVE WARPING
// ============================================================================

/**
 * Warp image using homography
 */
function warpPerspective(
  src: number[][],
  H: number[][],
  dstWidth: number,
  dstHeight: number,
  interpolation: 'nearest' | 'bilinear' = 'bilinear'
): number[][] {
  const dst: number[][] = [];
  const Hinv = inverse3x3(H);

  if (!Hinv) {
    // Return empty image
    for (let y = 0; y < dstHeight; y++) {
      dst[y] = new Array(dstWidth).fill(0);
    }
    return dst;
  }

  const srcHeight = src.length;
  const srcWidth = src[0].length;

  for (let y = 0; y < dstHeight; y++) {
    dst[y] = [];
    for (let x = 0; x < dstWidth; x++) {
      // Transform destination to source
      const srcPt = transformPoint(Hinv, { x, y });

      if (srcPt.x < 0 || srcPt.x >= srcWidth - 1 || srcPt.y < 0 || srcPt.y >= srcHeight - 1) {
        dst[y][x] = 0;
        continue;
      }

      if (interpolation === 'nearest') {
        const sx = Math.round(srcPt.x);
        const sy = Math.round(srcPt.y);
        dst[y][x] = src[sy][sx];
      } else {
        // Bilinear interpolation
        const x0 = Math.floor(srcPt.x);
        const y0 = Math.floor(srcPt.y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const dx = srcPt.x - x0;
        const dy = srcPt.y - y0;

        const v00 = src[y0][x0];
        const v10 = src[y0][x1];
        const v01 = src[y1][x0];
        const v11 = src[y1][x1];

        dst[y][x] =
          v00 * (1 - dx) * (1 - dy) + v10 * dx * (1 - dy) + v01 * (1 - dx) * dy + v11 * dx * dy;
      }
    }
  }

  return dst;
}

/**
 * Compute output bounds for warped image
 */
function computeWarpBounds(
  srcWidth: number,
  srcHeight: number,
  H: number[][]
): { minX: number; minY: number; maxX: number; maxY: number } {
  const corners = [
    { x: 0, y: 0 },
    { x: srcWidth, y: 0 },
    { x: srcWidth, y: srcHeight },
    { x: 0, y: srcHeight },
  ];

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const corner of corners) {
    const transformed = transformPoint(H, corner);
    minX = Math.min(minX, transformed.x);
    minY = Math.min(minY, transformed.y);
    maxX = Math.max(maxX, transformed.x);
    maxY = Math.max(maxY, transformed.y);
  }

  return { minX, minY, maxX, maxY };
}

// ============================================================================
// LINE TRANSFORMATION
// ============================================================================

/**
 * Transform line using homography
 * Line in homogeneous coords: ax + by + c = 0 represented as [a, b, c]
 * l' = H^-T * l
 */
function transformLine(H: number[][], line: number[]): number[] | null {
  const HinvT = transpose(inverse3x3(H) || eye(3));
  if (!HinvT) return null;
  return matvec(HinvT, line);
}

/**
 * Compute line from two points
 */
export function lineFromPoints(p1: Point2D, p2: Point2D): number[] {
  // Cross product of homogeneous points
  const h1 = [p1.x, p1.y, 1];
  const h2 = [p2.x, p2.y, 1];
  return cross(h1, h2);
}

/**
 * Compute intersection of two lines
 */
export function lineIntersection(l1: number[], l2: number[]): Point2D | null {
  const h = cross(l1, l2);
  if (Math.abs(h[2]) < 1e-10) return null; // Parallel lines
  return {
    x: h[0] / h[2],
    y: h[1] / h[2],
  };
}

// ============================================================================
// TEST DATA GENERATION
// ============================================================================

function generateTestCorrespondences(
  numPoints: number,
  transform: 'perspective' | 'affine' | 'rotation',
  noiseLevel: number = 0
): { correspondences: PointCorrespondence[]; groundTruth: number[][] } {
  const correspondences: PointCorrespondence[] = [];
  let H: number[][];

  switch (transform) {
    case 'perspective':
      H = [
        [1.2, 0.1, 50],
        [0.15, 1.1, 30],
        [0.001, 0.0005, 1],
      ];
      break;
    case 'affine':
      H = [
        [Math.cos(0.2), -Math.sin(0.2), 20],
        [Math.sin(0.2), Math.cos(0.2), 15],
        [0, 0, 1],
      ];
      break;
    case 'rotation':
    default:
      const theta = 0.3;
      H = [
        [Math.cos(theta), -Math.sin(theta), 0],
        [Math.sin(theta), Math.cos(theta), 0],
        [0, 0, 1],
      ];
  }

  for (let i = 0; i < numPoints; i++) {
    const src = {
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
    };

    const dstExact = transformPoint(H, src);
    const dst = {
      x: dstExact.x + (Math.random() - 0.5) * noiseLevel,
      y: dstExact.y + (Math.random() - 0.5) * noiseLevel,
    };

    correspondences.push({ src, dst });
  }

  return { correspondences, groundTruth: H };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const homographyTool: UnifiedTool = {
  name: 'homography',
  description: 'Homography estimation, perspective transforms, RANSAC, and decomposition',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'estimate',
          'estimate_ransac',
          'transform_points',
          'transform_line',
          'warp_image',
          'decompose',
          'compute_bounds',
          'demo',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      correspondences: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Point correspondences. Each entry has: src (object with x, y), dst (object with x, y)',
      },
      H: {
        type: 'array',
        description: 'Homography matrix (3x3)',
      },
      points: {
        type: 'array',
        description: 'Points to transform [{x, y}, ...]',
      },
      line: {
        type: 'array',
        description: 'Line coefficients [a, b, c] for ax + by + c = 0',
      },
      image: {
        type: 'object',
        description: 'Image data { width, height, data: number[][] }',
      },
      outputSize: {
        type: 'object',
        description: 'Output size { width, height }',
      },
      ransacParams: {
        type: 'object',
        description:
          'RANSAC parameters: threshold (number), maxIterations (number), confidence (number)',
      },
      intrinsics: {
        type: 'array',
        description: 'Camera intrinsic matrix (3x3) for decomposition',
      },
      testParams: {
        type: 'object',
        description:
          'Demo parameters: numPoints (number), transform (perspective/affine/rotation), noiseLevel (number)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executehomography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      correspondences,
      H,
      points,
      line,
      image,
      outputSize,
      ransacParams,
      intrinsics,
      testParams,
    } = args;

    let result: unknown;

    switch (operation) {
      case 'estimate': {
        if (!correspondences || correspondences.length < 4) {
          throw new Error('At least 4 point correspondences required');
        }

        const homography = computeHomographyNormalizedDLT(correspondences);
        if (!homography) {
          throw new Error('Failed to compute homography');
        }

        // Compute reprojection errors
        const errors = correspondences.map((c: PointCorrespondence) =>
          computeReprojectionError(homography, c)
        );

        result = {
          operation: 'estimate',
          method: 'normalized_DLT',
          H: homography,
          Hinv: inverse3x3(homography),
          statistics: {
            numPoints: correspondences.length,
            meanError: errors.reduce((a: number, b: number) => a + b, 0) / errors.length,
            maxError: Math.max(...errors),
            minError: Math.min(...errors),
          },
        };
        break;
      }

      case 'estimate_ransac': {
        if (!correspondences || correspondences.length < 4) {
          throw new Error('At least 4 point correspondences required');
        }

        const threshold = ransacParams?.threshold ?? 3.0;
        const maxIterations = ransacParams?.maxIterations ?? 1000;
        const confidence = ransacParams?.confidence ?? 0.99;

        const ransacResult = computeHomographyRANSAC(
          correspondences,
          threshold,
          maxIterations,
          confidence
        );

        if (!ransacResult) {
          throw new Error('RANSAC failed to find valid homography');
        }

        result = {
          operation: 'estimate_ransac',
          H: ransacResult.H,
          Hinv: ransacResult.Hinv,
          inlierCount: ransacResult.inliers?.length,
          inlierRatio: (ransacResult.inliers?.length || 0) / correspondences.length,
          inlierIndices: ransacResult.inliers,
          meanError: ransacResult.error,
          numIterations: ransacResult.numIterations,
          parameters: { threshold, maxIterations, confidence },
        };
        break;
      }

      case 'transform_points': {
        if (!H || !points) {
          throw new Error('Homography matrix and points required');
        }

        const transformed = points.map((p: Point2D) => transformPoint(H, p));

        result = {
          operation: 'transform_points',
          numPoints: points.length,
          original: points,
          transformed,
        };
        break;
      }

      case 'transform_line': {
        if (!H || !line) {
          throw new Error('Homography matrix and line required');
        }

        const transformedLine = transformLine(H, line);

        result = {
          operation: 'transform_line',
          original: line,
          transformed: transformedLine,
          explanation: 'Line [a,b,c] represents ax + by + c = 0',
        };
        break;
      }

      case 'warp_image': {
        if (!H || !image) {
          throw new Error('Homography matrix and image required');
        }

        const dstWidth = outputSize?.width ?? image.width;
        const dstHeight = outputSize?.height ?? image.height;

        const warped = warpPerspective(image.data, H, dstWidth, dstHeight);

        result = {
          operation: 'warp_image',
          inputSize: { width: image.width, height: image.height },
          outputSize: { width: dstWidth, height: dstHeight },
          // Return downsampled for output
          sampleData: warped
            .filter((_: number[], i: number) => i % 4 === 0)
            .map((row: number[]) =>
              row.filter((_: number, i: number) => i % 4 === 0).map((v: number) => Math.round(v))
            ),
        };
        break;
      }

      case 'decompose': {
        if (!H) {
          throw new Error('Homography matrix required');
        }

        const decompositions = decomposeHomography(H, intrinsics);
        const validDecomps = decompositions.filter((d) => d.valid);

        result = {
          operation: 'decompose',
          totalSolutions: decompositions.length,
          validSolutions: validDecomps.length,
          decompositions: validDecomps.map((d, i) => ({
            solutionIndex: i,
            rotation: d.R,
            translation: d.t,
            planeNormal: d.n,
            distance: d.d,
          })),
          note: 'Multiple valid solutions possible; use additional constraints to disambiguate',
        };
        break;
      }

      case 'compute_bounds': {
        if (!H || !image) {
          throw new Error('Homography matrix and image required');
        }

        const bounds = computeWarpBounds(image.width, image.height, H);

        result = {
          operation: 'compute_bounds',
          inputSize: { width: image.width, height: image.height },
          bounds,
          outputSize: {
            width: Math.ceil(bounds.maxX - bounds.minX),
            height: Math.ceil(bounds.maxY - bounds.minY),
          },
          offset: { x: -bounds.minX, y: -bounds.minY },
        };
        break;
      }

      case 'demo': {
        const numPoints = testParams?.numPoints ?? 20;
        const transform = testParams?.transform ?? 'perspective';
        const noiseLevel = testParams?.noiseLevel ?? 1.0;

        const { correspondences: testCorr, groundTruth } = generateTestCorrespondences(
          numPoints,
          transform,
          noiseLevel
        );

        // Estimate with DLT
        const estimatedH = computeHomographyNormalizedDLT(testCorr);

        // Estimate with RANSAC
        const ransacResult = computeHomographyRANSAC(testCorr, 5.0);

        // Compute errors
        const dltErrors = testCorr.map((c) =>
          estimatedH ? computeReprojectionError(estimatedH, c) : Infinity
        );
        const ransacErrors = testCorr.map((c) =>
          ransacResult ? computeReprojectionError(ransacResult.H, c) : Infinity
        );

        result = {
          operation: 'demo',
          testParameters: { numPoints, transform, noiseLevel },
          groundTruth: {
            H: groundTruth,
          },
          dltEstimate: {
            H: estimatedH,
            meanError: dltErrors.reduce((a, b) => a + b, 0) / dltErrors.length,
            maxError: Math.max(...dltErrors),
          },
          ransacEstimate: {
            H: ransacResult?.H,
            inlierCount: ransacResult?.inliers?.length,
            meanError: ransacErrors.reduce((a, b) => a + b, 0) / ransacErrors.length,
            maxError: Math.max(...ransacErrors),
          },
          sampleCorrespondences: testCorr.slice(0, 5).map((c) => ({
            src: { x: c.src.x.toFixed(2), y: c.src.y.toFixed(2) },
            dst: { x: c.dst.x.toFixed(2), y: c.dst.y.toFixed(2) },
          })),
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Estimate homography from correspondences',
              code: `{
  "operation": "estimate",
  "correspondences": [
    { "src": { "x": 0, "y": 0 }, "dst": { "x": 10, "y": 5 } },
    { "src": { "x": 100, "y": 0 }, "dst": { "x": 115, "y": 8 } },
    { "src": { "x": 100, "y": 100 }, "dst": { "x": 120, "y": 110 } },
    { "src": { "x": 0, "y": 100 }, "dst": { "x": 12, "y": 108 } }
  ]
}`,
            },
            {
              name: 'RANSAC with outlier rejection',
              code: `{
  "operation": "estimate_ransac",
  "correspondences": [...],
  "ransacParams": { "threshold": 3.0, "maxIterations": 1000 }
}`,
            },
            {
              name: 'Transform points',
              code: `{
  "operation": "transform_points",
  "H": [[1.2, 0.1, 50], [0.15, 1.1, 30], [0.001, 0.0005, 1]],
  "points": [{ "x": 100, "y": 100 }, { "x": 200, "y": 150 }]
}`,
            },
            {
              name: 'Decompose homography',
              code: `{
  "operation": "decompose",
  "H": [[1.2, 0.1, 50], [0.15, 1.1, 30], [0.001, 0.0005, 1]]
}`,
            },
            {
              name: 'Demo with test data',
              code: `{
  "operation": "demo",
  "testParams": { "numPoints": 50, "transform": "perspective", "noiseLevel": 2.0 }
}`,
            },
          ],
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'homography',
          description: 'Homography estimation and perspective transforms',
          capabilities: [
            'Direct Linear Transform (DLT) estimation',
            'Normalized DLT for numerical stability',
            'RANSAC for robust estimation with outliers',
            'Point transformation',
            'Line transformation',
            'Image warping with bilinear interpolation',
            'Homography decomposition (R, t, n)',
            'Output bounds computation',
          ],
          mathematicalBackground: {
            homography: "H is a 3x3 matrix relating points: x' ~ H * x",
            dlt: 'Solves A*h = 0 using SVD null space',
            ransac: 'Random Sample Consensus for outlier rejection',
            decomposition: 'H = R + t*n^T/d decomposes into rotation, translation, plane normal',
          },
          minimumPoints: 4,
          operations: [
            'estimate',
            'estimate_ransac',
            'transform_points',
            'transform_line',
            'warp_image',
            'decompose',
            'compute_bounds',
            'demo',
            'info',
            'examples',
          ],
        };
      }
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in homography: ${error}`,
      isError: true,
    };
  }
}

export function ishomographyAvailable(): boolean {
  return true;
}
