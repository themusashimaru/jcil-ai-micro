/**
 * LIDAR-PROCESSING TOOL
 * LiDAR point cloud processing algorithms
 *
 * Features:
 * - Point cloud filtering (voxel grid, statistical outlier removal)
 * - Ground plane detection (RANSAC)
 * - Clustering (DBSCAN, Euclidean)
 * - Feature extraction (normals, curvature)
 * - Registration (ICP)
 * - Bounding box fitting
 * - Octree spatial indexing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Point3D {
  x: number;
  y: number;
  z: number;
  intensity?: number;
  r?: number;
  g?: number;
  b?: number;
}

interface PointCloud {
  points: Point3D[];
  width?: number;
  height?: number;
  organized?: boolean;
}

interface Normal {
  nx: number;
  ny: number;
  nz: number;
}

interface Plane {
  a: number;
  b: number;
  c: number;
  d: number;
}

interface BoundingBox {
  center: Point3D;
  dimensions: { width: number; height: number; depth: number };
  rotation?: number[][];
  corners?: Point3D[];
}

interface Cluster {
  id: number;
  points: Point3D[];
  centroid: Point3D;
  boundingBox: BoundingBox;
}

interface OctreeNode {
  center: Point3D;
  halfSize: number;
  points: number[];
  children: (OctreeNode | null)[];
  isLeaf: boolean;
}

// ============================================================================
// VECTOR/MATRIX UTILITIES
// ============================================================================

function vec3Add(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Point3D, s: number): Point3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Dot(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vec3Norm(v: Point3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Normalize(v: Point3D): Point3D {
  const n = vec3Norm(v);
  if (n < 1e-10) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / n);
}

function vec3Distance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function matmul3x3(A: number[][], B: number[][]): number[][] {
  const C: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function matvec3(M: number[][], v: Point3D): Point3D {
  return {
    x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
    y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
    z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z,
  };
}

function transpose3x3(M: number[][]): number[][] {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

// ============================================================================
// VOXEL GRID FILTERING
// ============================================================================

class VoxelGridFilter {
  private leafSize: number;

  constructor(leafSize: number = 0.1) {
    this.leafSize = leafSize;
  }

  /**
   * Downsample point cloud using voxel grid
   */
  filter(cloud: PointCloud): PointCloud {
    const { points } = cloud;
    if (points.length === 0) return { points: [] };

    // Find bounds
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    // Create voxel map
    const voxelMap = new Map<string, Point3D[]>();

    for (const p of points) {
      const vx = Math.floor((p.x - minX) / this.leafSize);
      const vy = Math.floor((p.y - minY) / this.leafSize);
      const vz = Math.floor((p.z - minZ) / this.leafSize);
      const key = `${vx},${vy},${vz}`;

      if (!voxelMap.has(key)) {
        voxelMap.set(key, []);
      }
      voxelMap.get(key)!.push(p);
    }

    // Compute centroid of each voxel
    const filtered: Point3D[] = [];

    for (const voxelPoints of voxelMap.values()) {
      let cx = 0,
        cy = 0,
        cz = 0;
      let intensity = 0;

      for (const p of voxelPoints) {
        cx += p.x;
        cy += p.y;
        cz += p.z;
        intensity += p.intensity ?? 0;
      }

      const n = voxelPoints.length;
      filtered.push({
        x: cx / n,
        y: cy / n,
        z: cz / n,
        intensity: intensity / n,
      });
    }

    return { points: filtered };
  }
}

// ============================================================================
// STATISTICAL OUTLIER REMOVAL
// ============================================================================

class StatisticalOutlierRemoval {
  private k: number;
  private stddevMult: number;

  constructor(k: number = 50, stddevMult: number = 1.0) {
    this.k = k;
    this.stddevMult = stddevMult;
  }

  /**
   * Remove statistical outliers based on mean distance to neighbors
   */
  filter(cloud: PointCloud): PointCloud {
    const { points } = cloud;
    if (points.length <= this.k) return cloud;

    // Compute mean distance to k nearest neighbors for each point
    const distances: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const dists: number[] = [];

      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          dists.push(vec3Distance(points[i], points[j]));
        }
      }

      dists.sort((a, b) => a - b);
      const kDists = dists.slice(0, this.k);
      const meanDist = kDists.reduce((a, b) => a + b, 0) / this.k;
      distances.push(meanDist);
    }

    // Compute global mean and std
    const globalMean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((a, b) => a + (b - globalMean) ** 2, 0) / distances.length;
    const stddev = Math.sqrt(variance);

    // Filter points
    const threshold = globalMean + this.stddevMult * stddev;
    const filtered: Point3D[] = [];

    for (let i = 0; i < points.length; i++) {
      if (distances[i] <= threshold) {
        filtered.push(points[i]);
      }
    }

    return { points: filtered };
  }
}

// ============================================================================
// RANSAC PLANE FITTING
// ============================================================================

class RANSACPlane {
  private maxIterations: number;
  private distanceThreshold: number;

  constructor(maxIterations: number = 1000, distanceThreshold: number = 0.02) {
    this.maxIterations = maxIterations;
    this.distanceThreshold = distanceThreshold;
  }

  /**
   * Fit plane using RANSAC
   */
  fit(cloud: PointCloud): { plane: Plane; inliers: number[]; outliers: number[] } {
    const { points } = cloud;
    if (points.length < 3) {
      return {
        plane: { a: 0, b: 0, c: 1, d: 0 },
        inliers: [],
        outliers: points.map((_, i) => i),
      };
    }

    let bestPlane: Plane = { a: 0, b: 0, c: 1, d: 0 };
    let bestInliers: number[] = [];

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Randomly select 3 points
      const indices = this.randomSample(points.length, 3);
      const p1 = points[indices[0]];
      const p2 = points[indices[1]];
      const p3 = points[indices[2]];

      // Compute plane from 3 points
      const v1 = vec3Sub(p2, p1);
      const v2 = vec3Sub(p3, p1);
      const normal = vec3Normalize(vec3Cross(v1, v2));

      if (vec3Norm(normal) < 1e-10) continue;

      const plane: Plane = {
        a: normal.x,
        b: normal.y,
        c: normal.z,
        d: -(normal.x * p1.x + normal.y * p1.y + normal.z * p1.z),
      };

      // Count inliers
      const inliers: number[] = [];

      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(
          plane.a * points[i].x + plane.b * points[i].y + plane.c * points[i].z + plane.d
        );

        if (dist < this.distanceThreshold) {
          inliers.push(i);
        }
      }

      if (inliers.length > bestInliers.length) {
        bestInliers = inliers;
        bestPlane = plane;
      }
    }

    // Compute outliers
    const inlierSet = new Set(bestInliers);
    const outliers = points.map((_, i) => i).filter((i) => !inlierSet.has(i));

    return { plane: bestPlane, inliers: bestInliers, outliers };
  }

  private randomSample(n: number, k: number): number[] {
    const indices: number[] = [];
    const available = Array.from({ length: n }, (_, i) => i);

    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * available.length);
      indices.push(available[idx]);
      available.splice(idx, 1);
    }

    return indices;
  }
}

// ============================================================================
// DBSCAN CLUSTERING
// ============================================================================

class DBSCANClustering {
  private eps: number;
  private minPts: number;

  constructor(eps: number = 0.5, minPts: number = 10) {
    this.eps = eps;
    this.minPts = minPts;
  }

  /**
   * Cluster points using DBSCAN
   */
  cluster(cloud: PointCloud): Cluster[] {
    const { points } = cloud;
    const n = points.length;

    // Labels: -1 = noise, 0+ = cluster id
    const labels = new Array(n).fill(-2); // -2 = unvisited
    let currentCluster = 0;

    for (let i = 0; i < n; i++) {
      if (labels[i] !== -2) continue;

      // Find neighbors
      const neighbors = this.regionQuery(points, i);

      if (neighbors.length < this.minPts) {
        labels[i] = -1; // Noise
        continue;
      }

      // Start new cluster
      labels[i] = currentCluster;
      const seed = [...neighbors];

      for (let j = 0; j < seed.length; j++) {
        const q = seed[j];

        if (labels[q] === -1) {
          labels[q] = currentCluster;
        }

        if (labels[q] !== -2) continue;

        labels[q] = currentCluster;

        const qNeighbors = this.regionQuery(points, q);
        if (qNeighbors.length >= this.minPts) {
          for (const n of qNeighbors) {
            if (!seed.includes(n)) {
              seed.push(n);
            }
          }
        }
      }

      currentCluster++;
    }

    // Build cluster objects
    const clusters: Cluster[] = [];

    for (let c = 0; c < currentCluster; c++) {
      const clusterPoints: Point3D[] = [];
      for (let i = 0; i < n; i++) {
        if (labels[i] === c) {
          clusterPoints.push(points[i]);
        }
      }

      if (clusterPoints.length > 0) {
        const centroid = this.computeCentroid(clusterPoints);
        const boundingBox = this.computeBoundingBox(clusterPoints);

        clusters.push({
          id: c,
          points: clusterPoints,
          centroid,
          boundingBox,
        });
      }
    }

    return clusters;
  }

  private regionQuery(points: Point3D[], idx: number): number[] {
    const neighbors: number[] = [];
    const p = points[idx];

    for (let i = 0; i < points.length; i++) {
      if (vec3Distance(p, points[i]) <= this.eps) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  private computeCentroid(points: Point3D[]): Point3D {
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    const n = points.length;
    return { x: cx / n, y: cy / n, z: cz / n };
  }

  private computeBoundingBox(points: Point3D[]): BoundingBox {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    return {
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
      dimensions: {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      },
    };
  }
}

// ============================================================================
// EUCLIDEAN CLUSTERING
// ============================================================================

class EuclideanClustering {
  private tolerance: number;
  private minClusterSize: number;
  private maxClusterSize: number;

  constructor(
    tolerance: number = 0.5,
    minClusterSize: number = 10,
    maxClusterSize: number = 25000
  ) {
    this.tolerance = tolerance;
    this.minClusterSize = minClusterSize;
    this.maxClusterSize = maxClusterSize;
  }

  /**
   * Cluster points using Euclidean distance
   */
  cluster(cloud: PointCloud): Cluster[] {
    const { points } = cloud;
    const n = points.length;
    const visited = new Array(n).fill(false);
    const clusters: Cluster[] = [];
    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      const clusterIndices: number[] = [];
      const queue: number[] = [i];

      while (queue.length > 0) {
        const idx = queue.shift()!;

        if (visited[idx]) continue;
        visited[idx] = true;
        clusterIndices.push(idx);

        if (clusterIndices.length >= this.maxClusterSize) break;

        // Find neighbors within tolerance
        for (let j = 0; j < n; j++) {
          if (!visited[j] && vec3Distance(points[idx], points[j]) <= this.tolerance) {
            queue.push(j);
          }
        }
      }

      if (
        clusterIndices.length >= this.minClusterSize &&
        clusterIndices.length <= this.maxClusterSize
      ) {
        const clusterPoints = clusterIndices.map((idx) => points[idx]);
        const centroid = this.computeCentroid(clusterPoints);
        const boundingBox = this.computeBoundingBox(clusterPoints);

        clusters.push({
          id: clusterId++,
          points: clusterPoints,
          centroid,
          boundingBox,
        });
      }
    }

    return clusters;
  }

  private computeCentroid(points: Point3D[]): Point3D {
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    const n = points.length;
    return { x: cx / n, y: cy / n, z: cz / n };
  }

  private computeBoundingBox(points: Point3D[]): BoundingBox {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    return {
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
      dimensions: {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      },
    };
  }
}

// ============================================================================
// NORMAL ESTIMATION
// ============================================================================

class NormalEstimator {
  private k: number;

  constructor(k: number = 20) {
    this.k = k;
  }

  /**
   * Estimate normals using PCA on local neighborhoods
   */
  estimate(cloud: PointCloud): Normal[] {
    const { points } = cloud;
    const normals: Normal[] = [];

    for (let i = 0; i < points.length; i++) {
      const neighbors = this.findKNearest(points, i, this.k);
      const normal = this.estimateNormalPCA(points, neighbors);
      normals.push(normal);
    }

    return normals;
  }

  private findKNearest(points: Point3D[], idx: number, k: number): number[] {
    const p = points[idx];
    const distances: { idx: number; dist: number }[] = [];

    for (let i = 0; i < points.length; i++) {
      if (i !== idx) {
        distances.push({ idx: i, dist: vec3Distance(p, points[i]) });
      }
    }

    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, k).map((d) => d.idx);
  }

  private estimateNormalPCA(points: Point3D[], indices: number[]): Normal {
    // Compute centroid
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const i of indices) {
      cx += points[i].x;
      cy += points[i].y;
      cz += points[i].z;
    }
    cx /= indices.length;
    cy /= indices.length;
    cz /= indices.length;

    // Compute covariance matrix
    let cxx = 0,
      cxy = 0,
      cxz = 0;
    let cyy = 0,
      cyz = 0,
      czz = 0;

    for (const i of indices) {
      const dx = points[i].x - cx;
      const dy = points[i].y - cy;
      const dz = points[i].z - cz;

      cxx += dx * dx;
      cxy += dx * dy;
      cxz += dx * dz;
      cyy += dy * dy;
      cyz += dy * dz;
      czz += dz * dz;
    }

    const n = indices.length;
    const cov = [
      [cxx / n, cxy / n, cxz / n],
      [cxy / n, cyy / n, cyz / n],
      [cxz / n, cyz / n, czz / n],
    ];

    // Find smallest eigenvector using power iteration
    const normal = this.smallestEigenvector(cov);

    return { nx: normal.x, ny: normal.y, nz: normal.z };
  }

  private smallestEigenvector(cov: number[][]): Point3D {
    // Use inverse power iteration
    let v: Point3D = { x: 1, y: 0, z: 0 };

    // Compute inverse of cov using Cramer's rule
    const det =
      cov[0][0] * (cov[1][1] * cov[2][2] - cov[1][2] * cov[2][1]) -
      cov[0][1] * (cov[1][0] * cov[2][2] - cov[1][2] * cov[2][0]) +
      cov[0][2] * (cov[1][0] * cov[2][1] - cov[1][1] * cov[2][0]);

    if (Math.abs(det) < 1e-10) {
      // Matrix is singular, return default normal
      return { x: 0, y: 0, z: 1 };
    }

    const invDet = 1 / det;
    const inv = [
      [
        (cov[1][1] * cov[2][2] - cov[1][2] * cov[2][1]) * invDet,
        (cov[0][2] * cov[2][1] - cov[0][1] * cov[2][2]) * invDet,
        (cov[0][1] * cov[1][2] - cov[0][2] * cov[1][1]) * invDet,
      ],
      [
        (cov[1][2] * cov[2][0] - cov[1][0] * cov[2][2]) * invDet,
        (cov[0][0] * cov[2][2] - cov[0][2] * cov[2][0]) * invDet,
        (cov[0][2] * cov[1][0] - cov[0][0] * cov[1][2]) * invDet,
      ],
      [
        (cov[1][0] * cov[2][1] - cov[1][1] * cov[2][0]) * invDet,
        (cov[0][1] * cov[2][0] - cov[0][0] * cov[2][1]) * invDet,
        (cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0]) * invDet,
      ],
    ];

    // Power iteration on inverse
    for (let iter = 0; iter < 20; iter++) {
      const vNew = matvec3(inv, v);
      v = vec3Normalize(vNew);
    }

    return v;
  }
}

// ============================================================================
// CURVATURE ESTIMATION
// ============================================================================

function estimateCurvature(points: Point3D[], normals: Normal[], k: number = 20): number[] {
  const curvatures: number[] = [];

  for (let i = 0; i < points.length; i++) {
    // Find k nearest neighbors
    const distances: { idx: number; dist: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        distances.push({ idx: j, dist: vec3Distance(points[i], points[j]) });
      }
    }
    distances.sort((a, b) => a.dist - b.dist);
    const neighbors = distances.slice(0, k).map((d) => d.idx);

    // Compute curvature as variation of normals
    const ni = normals[i];
    let sumAngle = 0;

    for (const j of neighbors) {
      const nj = normals[j];
      const dotProduct = ni.nx * nj.nx + ni.ny * nj.ny + ni.nz * nj.nz;
      const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      sumAngle += angle;
    }

    curvatures.push(sumAngle / neighbors.length);
  }

  return curvatures;
}

// ============================================================================
// ICP REGISTRATION
// ============================================================================

class ICPRegistration {
  private maxIterations: number;
  private tolerance: number;

  constructor(maxIterations: number = 50, tolerance: number = 1e-6) {
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * Register source cloud to target using ICP
   */
  register(
    source: PointCloud,
    target: PointCloud
  ): { rotation: number[][]; translation: Point3D; error: number; iterations: number } {
    let R = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    let t: Point3D = { x: 0, y: 0, z: 0 };

    // Transform source points
    let transformedSource = source.points.map((p) => ({ ...p }));
    let prevError = Infinity;

    let iter = 0;
    for (iter = 0; iter < this.maxIterations; iter++) {
      // Find correspondences (nearest neighbor)
      const correspondences: { src: Point3D; tgt: Point3D }[] = [];

      for (const sp of transformedSource) {
        let minDist = Infinity;
        let closest: Point3D | null = null;

        for (const tp of target.points) {
          const dist = vec3Distance(sp, tp);
          if (dist < minDist) {
            minDist = dist;
            closest = tp;
          }
        }

        if (closest) {
          correspondences.push({ src: sp, tgt: closest });
        }
      }

      if (correspondences.length === 0) break;

      // Compute centroids
      let srcCentroid: Point3D = { x: 0, y: 0, z: 0 };
      let tgtCentroid: Point3D = { x: 0, y: 0, z: 0 };

      for (const c of correspondences) {
        srcCentroid = vec3Add(srcCentroid, c.src);
        tgtCentroid = vec3Add(tgtCentroid, c.tgt);
      }

      srcCentroid = vec3Scale(srcCentroid, 1 / correspondences.length);
      tgtCentroid = vec3Scale(tgtCentroid, 1 / correspondences.length);

      // Compute cross-covariance matrix
      const H: number[][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      for (const c of correspondences) {
        const srcCentered = vec3Sub(c.src, srcCentroid);
        const tgtCentered = vec3Sub(c.tgt, tgtCentroid);

        H[0][0] += srcCentered.x * tgtCentered.x;
        H[0][1] += srcCentered.x * tgtCentered.y;
        H[0][2] += srcCentered.x * tgtCentered.z;
        H[1][0] += srcCentered.y * tgtCentered.x;
        H[1][1] += srcCentered.y * tgtCentered.y;
        H[1][2] += srcCentered.y * tgtCentered.z;
        H[2][0] += srcCentered.z * tgtCentered.x;
        H[2][1] += srcCentered.z * tgtCentered.y;
        H[2][2] += srcCentered.z * tgtCentered.z;
      }

      // Compute rotation using SVD (simplified)
      const { U, V } = this.svd3x3(H);
      const Rnew = matmul3x3(V, transpose3x3(U));

      // Ensure proper rotation (det = 1)
      const det = this.det3x3(Rnew);
      if (det < 0) {
        V[0][2] *= -1;
        V[1][2] *= -1;
        V[2][2] *= -1;
      }

      // Compute translation
      const tNew: Point3D = vec3Sub(tgtCentroid, matvec3(Rnew, srcCentroid));

      // Update total transformation
      R = matmul3x3(Rnew, R);
      t = vec3Add(matvec3(Rnew, t), tNew);

      // Transform source points
      transformedSource = source.points.map((p) => vec3Add(matvec3(R, p), t));

      // Compute error
      let error = 0;
      for (let i = 0; i < correspondences.length; i++) {
        error += vec3Distance(transformedSource[i], correspondences[i].tgt);
      }
      error /= correspondences.length;

      if (Math.abs(prevError - error) < this.tolerance) {
        break;
      }
      prevError = error;
    }

    return { rotation: R, translation: t, error: prevError, iterations: iter };
  }

  private svd3x3(A: number[][]): { U: number[][]; S: number[]; V: number[][] } {
    // Simplified SVD using Jacobi rotations
    const AtA = matmul3x3(transpose3x3(A), A);

    // Eigendecomposition of AtA
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const M = AtA.map((row) => [...row]);

    for (let sweep = 0; sweep < 20; sweep++) {
      for (let i = 0; i < 2; i++) {
        for (let j = i + 1; j < 3; j++) {
          if (Math.abs(M[i][j]) < 1e-10) continue;

          const theta = 0.5 * Math.atan2(2 * M[i][j], M[i][i] - M[j][j]);
          const c = Math.cos(theta);
          const s = Math.sin(theta);

          // Apply rotation to M
          const Mii = M[i][i],
            Mjj = M[j][j],
            Mij = M[i][j];
          M[i][i] = c * c * Mii + 2 * c * s * Mij + s * s * Mjj;
          M[j][j] = s * s * Mii - 2 * c * s * Mij + c * c * Mjj;
          M[i][j] = 0;
          M[j][i] = 0;

          for (let k = 0; k < 3; k++) {
            if (k !== i && k !== j) {
              const Mik = M[i][k],
                Mjk = M[j][k];
              M[i][k] = c * Mik + s * Mjk;
              M[k][i] = M[i][k];
              M[j][k] = -s * Mik + c * Mjk;
              M[k][j] = M[j][k];
            }
          }

          // Update V
          for (let k = 0; k < 3; k++) {
            const Vki = V[k][i],
              Vkj = V[k][j];
            V[k][i] = c * Vki + s * Vkj;
            V[k][j] = -s * Vki + c * Vkj;
          }
        }
      }
    }

    const S = [
      Math.sqrt(Math.max(0, M[0][0])),
      Math.sqrt(Math.max(0, M[1][1])),
      Math.sqrt(Math.max(0, M[2][2])),
    ];

    // U = A * V * S^-1
    const U: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const AV = matmul3x3(A, V);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        U[i][j] = S[j] > 1e-10 ? AV[i][j] / S[j] : 0;
      }
    }

    return { U, S, V };
  }

  private det3x3(M: number[][]): number {
    return (
      M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
    );
  }
}

// ============================================================================
// OCTREE SPATIAL INDEX
// ============================================================================

class Octree {
  private root: OctreeNode;
  private maxDepth: number;
  private maxPointsPerNode: number;

  constructor(points: Point3D[], maxDepth: number = 8, maxPointsPerNode: number = 10) {
    this.maxDepth = maxDepth;
    this.maxPointsPerNode = maxPointsPerNode;

    // Find bounds
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    const center: Point3D = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    };

    const halfSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 0.001;

    this.root = this.buildNode(
      points.map((_, i) => i),
      points,
      center,
      halfSize,
      0
    );
  }

  private buildNode(
    indices: number[],
    points: Point3D[],
    center: Point3D,
    halfSize: number,
    depth: number
  ): OctreeNode {
    const node: OctreeNode = {
      center,
      halfSize,
      points: [],
      children: [null, null, null, null, null, null, null, null],
      isLeaf: true,
    };

    if (indices.length <= this.maxPointsPerNode || depth >= this.maxDepth) {
      node.points = indices;
      return node;
    }

    // Split into octants
    const octants: number[][] = [[], [], [], [], [], [], [], []];

    for (const idx of indices) {
      const p = points[idx];
      const octant =
        (p.x >= center.x ? 1 : 0) + (p.y >= center.y ? 2 : 0) + (p.z >= center.z ? 4 : 0);
      octants[octant].push(idx);
    }

    node.isLeaf = false;
    const newHalfSize = halfSize / 2;

    for (let i = 0; i < 8; i++) {
      if (octants[i].length > 0) {
        const newCenter: Point3D = {
          x: center.x + (i & 1 ? newHalfSize : -newHalfSize),
          y: center.y + (i & 2 ? newHalfSize : -newHalfSize),
          z: center.z + (i & 4 ? newHalfSize : -newHalfSize),
        };
        node.children[i] = this.buildNode(octants[i], points, newCenter, newHalfSize, depth + 1);
      }
    }

    return node;
  }

  /**
   * Find all points within radius of query point
   */
  radiusSearch(points: Point3D[], query: Point3D, radius: number): number[] {
    const results: number[] = [];
    this.radiusSearchNode(this.root, points, query, radius, results);
    return results;
  }

  private radiusSearchNode(
    node: OctreeNode,
    points: Point3D[],
    query: Point3D,
    radius: number,
    results: number[]
  ): void {
    // Check if node intersects search sphere
    const dx = Math.max(0, Math.abs(query.x - node.center.x) - node.halfSize);
    const dy = Math.max(0, Math.abs(query.y - node.center.y) - node.halfSize);
    const dz = Math.max(0, Math.abs(query.z - node.center.z) - node.halfSize);

    if (dx * dx + dy * dy + dz * dz > radius * radius) {
      return;
    }

    if (node.isLeaf) {
      for (const idx of node.points) {
        if (vec3Distance(points[idx], query) <= radius) {
          results.push(idx);
        }
      }
    } else {
      for (const child of node.children) {
        if (child) {
          this.radiusSearchNode(child, points, query, radius, results);
        }
      }
    }
  }

  /**
   * Get octree statistics
   */
  getStatistics(): { depth: number; nodeCount: number; leafCount: number } {
    let maxDepth = 0;
    let nodeCount = 0;
    let leafCount = 0;

    const traverse = (node: OctreeNode, depth: number) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);

      if (node.isLeaf) {
        leafCount++;
      } else {
        for (const child of node.children) {
          if (child) {
            traverse(child, depth + 1);
          }
        }
      }
    };

    traverse(this.root, 0);
    return { depth: maxDepth, nodeCount, leafCount };
  }
}

// ============================================================================
// TEST DATA GENERATION
// ============================================================================

function generateTestPointCloud(
  pattern: 'plane' | 'sphere' | 'cylinder' | 'random' | 'scene',
  numPoints: number = 1000
): PointCloud {
  const points: Point3D[] = [];

  switch (pattern) {
    case 'plane':
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          z: Math.random() * 0.1,
          intensity: Math.random() * 100,
        });
      }
      break;

    case 'sphere':
      for (let i = 0; i < numPoints; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2 + Math.random() * 0.1;
        points.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          intensity: Math.random() * 100,
        });
      }
      break;

    case 'cylinder':
      for (let i = 0; i < numPoints; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 0.05;
        points.push({
          x: r * Math.cos(theta),
          y: r * Math.sin(theta),
          z: (Math.random() - 0.5) * 5,
          intensity: Math.random() * 100,
        });
      }
      break;

    case 'scene':
      // Ground plane
      for (let i = 0; i < numPoints * 0.5; i++) {
        points.push({
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20,
          z: Math.random() * 0.05,
          intensity: 50,
        });
      }

      // Objects (boxes)
      const objects = [
        { cx: 3, cy: 2, size: 1 },
        { cx: -2, cy: 4, size: 0.8 },
        { cx: -4, cy: -3, size: 1.2 },
      ];

      for (const obj of objects) {
        const objPoints = Math.floor(numPoints * 0.1);
        for (let i = 0; i < objPoints; i++) {
          points.push({
            x: obj.cx + (Math.random() - 0.5) * obj.size,
            y: obj.cy + (Math.random() - 0.5) * obj.size,
            z: Math.random() * obj.size + 0.05,
            intensity: 80,
          });
        }
      }
      break;

    case 'random':
    default:
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          z: (Math.random() - 0.5) * 10,
          intensity: Math.random() * 100,
        });
      }
  }

  return { points };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lidarprocessingTool: UnifiedTool = {
  name: 'lidar_processing',
  description: 'LiDAR point cloud processing: filtering, segmentation, clustering, registration',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'voxel_filter',
          'outlier_removal',
          'ground_detection',
          'clustering_dbscan',
          'clustering_euclidean',
          'estimate_normals',
          'estimate_curvature',
          'register_icp',
          'build_octree',
          'demo',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      cloud: {
        type: 'object',
        description: 'Point cloud with points array: { points: [{ x, y, z, intensity? }, ...] }',
      },
      target: {
        type: 'object',
        description: 'Target point cloud for registration',
      },
      params: {
        type: 'object',
        description:
          'Algorithm-specific parameters: leafSize (voxel size), k (neighbors), stddevMult (std dev multiplier), distanceThreshold (RANSAC), eps (DBSCAN epsilon), minPts (DBSCAN min), tolerance (clustering), minClusterSize, maxClusterSize, maxIterations',
      },
      testPattern: {
        type: 'string',
        enum: ['plane', 'sphere', 'cylinder', 'random', 'scene'],
        description: 'Test pattern for demo',
      },
      numPoints: {
        type: 'number',
        description: 'Number of points for test data',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executelidarprocessing(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, cloud, target, params, testPattern, numPoints } = args;

    let result: unknown;

    switch (operation) {
      case 'voxel_filter': {
        if (!cloud) throw new Error('Point cloud required');

        const leafSize = params?.leafSize ?? 0.1;
        const filter = new VoxelGridFilter(leafSize);
        const filtered = filter.filter(cloud);

        result = {
          operation: 'voxel_filter',
          leafSize,
          inputPoints: cloud.points.length,
          outputPoints: filtered.points.length,
          reductionRatio: (1 - filtered.points.length / cloud.points.length).toFixed(3),
          samplePoints: filtered.points.slice(0, 10),
        };
        break;
      }

      case 'outlier_removal': {
        if (!cloud) throw new Error('Point cloud required');

        const k = params?.k ?? 50;
        const stddevMult = params?.stddevMult ?? 1.0;
        const filter = new StatisticalOutlierRemoval(k, stddevMult);
        const filtered = filter.filter(cloud);

        result = {
          operation: 'outlier_removal',
          k,
          stddevMult,
          inputPoints: cloud.points.length,
          outputPoints: filtered.points.length,
          removedPoints: cloud.points.length - filtered.points.length,
        };
        break;
      }

      case 'ground_detection': {
        if (!cloud) throw new Error('Point cloud required');

        const maxIterations = params?.maxIterations ?? 1000;
        const distanceThreshold = params?.distanceThreshold ?? 0.02;
        const ransac = new RANSACPlane(maxIterations, distanceThreshold);
        const { plane, inliers, outliers } = ransac.fit(cloud);

        result = {
          operation: 'ground_detection',
          plane: {
            a: plane.a.toFixed(4),
            b: plane.b.toFixed(4),
            c: plane.c.toFixed(4),
            d: plane.d.toFixed(4),
            equation: `${plane.a.toFixed(4)}x + ${plane.b.toFixed(4)}y + ${plane.c.toFixed(4)}z + ${plane.d.toFixed(4)} = 0`,
          },
          inlierCount: inliers.length,
          outlierCount: outliers.length,
          inlierRatio: (inliers.length / cloud.points.length).toFixed(3),
        };
        break;
      }

      case 'clustering_dbscan': {
        if (!cloud) throw new Error('Point cloud required');

        const eps = params?.eps ?? 0.5;
        const minPts = params?.minPts ?? 10;
        const dbscan = new DBSCANClustering(eps, minPts);
        const clusters = dbscan.cluster(cloud);

        result = {
          operation: 'clustering_dbscan',
          eps,
          minPts,
          inputPoints: cloud.points.length,
          numClusters: clusters.length,
          clusters: clusters.slice(0, 10).map((c) => ({
            id: c.id,
            size: c.points.length,
            centroid: {
              x: c.centroid.x.toFixed(3),
              y: c.centroid.y.toFixed(3),
              z: c.centroid.z.toFixed(3),
            },
            boundingBox: c.boundingBox,
          })),
        };
        break;
      }

      case 'clustering_euclidean': {
        if (!cloud) throw new Error('Point cloud required');

        const tolerance = params?.tolerance ?? 0.5;
        const minClusterSize = params?.minClusterSize ?? 10;
        const maxClusterSize = params?.maxClusterSize ?? 25000;

        const clustering = new EuclideanClustering(tolerance, minClusterSize, maxClusterSize);
        const clusters = clustering.cluster(cloud);

        result = {
          operation: 'clustering_euclidean',
          tolerance,
          minClusterSize,
          maxClusterSize,
          inputPoints: cloud.points.length,
          numClusters: clusters.length,
          clusters: clusters.slice(0, 10).map((c) => ({
            id: c.id,
            size: c.points.length,
            centroid: {
              x: c.centroid.x.toFixed(3),
              y: c.centroid.y.toFixed(3),
              z: c.centroid.z.toFixed(3),
            },
            boundingBox: c.boundingBox,
          })),
        };
        break;
      }

      case 'estimate_normals': {
        if (!cloud) throw new Error('Point cloud required');

        const k = params?.k ?? 20;
        const estimator = new NormalEstimator(k);
        const normals = estimator.estimate(cloud);

        result = {
          operation: 'estimate_normals',
          k,
          numPoints: cloud.points.length,
          numNormals: normals.length,
          sampleNormals: normals.slice(0, 10).map((n) => ({
            nx: n.nx.toFixed(4),
            ny: n.ny.toFixed(4),
            nz: n.nz.toFixed(4),
          })),
        };
        break;
      }

      case 'estimate_curvature': {
        if (!cloud) throw new Error('Point cloud required');

        const k = params?.k ?? 20;
        const estimator = new NormalEstimator(k);
        const normals = estimator.estimate(cloud);
        const curvatures = estimateCurvature(cloud.points, normals, k);

        const stats = {
          min: Math.min(...curvatures),
          max: Math.max(...curvatures),
          mean: curvatures.reduce((a, b) => a + b, 0) / curvatures.length,
        };

        result = {
          operation: 'estimate_curvature',
          k,
          numPoints: cloud.points.length,
          statistics: {
            min: stats.min.toFixed(4),
            max: stats.max.toFixed(4),
            mean: stats.mean.toFixed(4),
          },
          sampleCurvatures: curvatures.slice(0, 20).map((c) => c.toFixed(4)),
        };
        break;
      }

      case 'register_icp': {
        if (!cloud || !target) throw new Error('Source and target point clouds required');

        const maxIterations = params?.maxIterations ?? 50;
        const tolerance = params?.tolerance ?? 1e-6;

        const icp = new ICPRegistration(maxIterations, tolerance);
        const registration = icp.register(cloud, target);

        result = {
          operation: 'register_icp',
          maxIterations,
          tolerance,
          sourcePoints: cloud.points.length,
          targetPoints: target.points.length,
          iterations: registration.iterations,
          error: registration.error.toFixed(6),
          rotation: registration.rotation.map((row) => row.map((v) => v.toFixed(4))),
          translation: {
            x: registration.translation.x.toFixed(4),
            y: registration.translation.y.toFixed(4),
            z: registration.translation.z.toFixed(4),
          },
        };
        break;
      }

      case 'build_octree': {
        if (!cloud) throw new Error('Point cloud required');

        const octree = new Octree(cloud.points);
        const stats = octree.getStatistics();

        // Test radius search
        if (cloud.points.length > 0) {
          const query = cloud.points[0];
          const radius = params?.radius ?? 1.0;
          const neighbors = octree.radiusSearch(cloud.points, query, radius);

          result = {
            operation: 'build_octree',
            numPoints: cloud.points.length,
            octreeStats: stats,
            radiusSearchTest: {
              query: { x: query.x.toFixed(3), y: query.y.toFixed(3), z: query.z.toFixed(3) },
              radius,
              neighborsFound: neighbors.length,
            },
          };
        } else {
          result = {
            operation: 'build_octree',
            numPoints: 0,
            octreeStats: stats,
          };
        }
        break;
      }

      case 'demo': {
        const pattern = testPattern || 'scene';
        const nPoints = numPoints || 500;
        const testCloud = generateTestPointCloud(pattern, nPoints);

        // Run pipeline
        const voxelFilter = new VoxelGridFilter(0.2);
        const filtered = voxelFilter.filter(testCloud);

        const ransac = new RANSACPlane(500, 0.05);
        const { plane, inliers, outliers } = ransac.fit(filtered);

        // Cluster non-ground points
        const nonGroundPoints: Point3D[] = outliers.map((i) => filtered.points[i]);
        const dbscan = new DBSCANClustering(0.3, 5);
        const clusters = dbscan.cluster({ points: nonGroundPoints });

        result = {
          operation: 'demo',
          testPattern: pattern,
          originalPoints: testCloud.points.length,
          pipeline: [
            {
              step: 'Voxel Grid Filter',
              leafSize: 0.2,
              outputPoints: filtered.points.length,
            },
            {
              step: 'Ground Detection (RANSAC)',
              groundPoints: inliers.length,
              objectPoints: outliers.length,
              plane: {
                a: plane.a.toFixed(4),
                b: plane.b.toFixed(4),
                c: plane.c.toFixed(4),
                d: plane.d.toFixed(4),
              },
            },
            {
              step: 'Object Clustering (DBSCAN)',
              numClusters: clusters.length,
              clusterSizes: clusters.map((c) => c.points.length),
            },
          ],
        };
        break;
      }

      case 'examples': {
        result = {
          operation: 'examples',
          examples: [
            {
              name: 'Voxel grid downsampling',
              code: `{
  "operation": "voxel_filter",
  "cloud": { "points": [{ "x": 1, "y": 2, "z": 3 }, ...] },
  "params": { "leafSize": 0.1 }
}`,
            },
            {
              name: 'Ground plane detection',
              code: `{
  "operation": "ground_detection",
  "cloud": { "points": [...] },
  "params": { "distanceThreshold": 0.02 }
}`,
            },
            {
              name: 'DBSCAN clustering',
              code: `{
  "operation": "clustering_dbscan",
  "cloud": { "points": [...] },
  "params": { "eps": 0.5, "minPts": 10 }
}`,
            },
            {
              name: 'ICP registration',
              code: `{
  "operation": "register_icp",
  "cloud": { "points": [...] },
  "target": { "points": [...] },
  "params": { "maxIterations": 50 }
}`,
            },
            {
              name: 'Normal estimation',
              code: `{
  "operation": "estimate_normals",
  "cloud": { "points": [...] },
  "params": { "k": 20 }
}`,
            },
            {
              name: 'Demo pipeline',
              code: `{
  "operation": "demo",
  "testPattern": "scene",
  "numPoints": 1000
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
          tool: 'lidar_processing',
          description: 'LiDAR point cloud processing algorithms',
          capabilities: {
            filtering: ['Voxel grid downsampling', 'Statistical outlier removal'],
            segmentation: [
              'RANSAC ground plane detection',
              'DBSCAN clustering',
              'Euclidean clustering',
            ],
            features: ['Normal estimation (PCA)', 'Curvature estimation'],
            registration: ['Iterative Closest Point (ICP)'],
            indexing: ['Octree spatial index', 'Radius search'],
          },
          pointCloudFormat: {
            required: ['x', 'y', 'z'],
            optional: ['intensity', 'r', 'g', 'b'],
          },
          operations: [
            'voxel_filter',
            'outlier_removal',
            'ground_detection',
            'clustering_dbscan',
            'clustering_euclidean',
            'estimate_normals',
            'estimate_curvature',
            'register_icp',
            'build_octree',
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
      content: `Error in lidar_processing: ${error}`,
      isError: true,
    };
  }
}

export function islidarprocessingAvailable(): boolean {
  return true;
}
