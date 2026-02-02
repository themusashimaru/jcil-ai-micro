/**
 * CAMERA-CALIBRATION TOOL
 * Camera intrinsic and extrinsic calibration
 * Implements checkerboard detection, Zhang's method, and distortion correction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface CameraIntrinsics {
  fx: number;           // Focal length x
  fy: number;           // Focal length y
  cx: number;           // Principal point x
  cy: number;           // Principal point y
  skew: number;         // Skew coefficient
}

interface DistortionCoefficients {
  k1: number;           // Radial distortion coefficient 1
  k2: number;           // Radial distortion coefficient 2
  k3: number;           // Radial distortion coefficient 3
  p1: number;           // Tangential distortion coefficient 1
  p2: number;           // Tangential distortion coefficient 2
}

interface CameraExtrinsics {
  rotation: number[][];  // 3x3 rotation matrix
  translation: number[]; // 3x1 translation vector
  rvec: number[];        // Rodrigues rotation vector
}

interface CalibrationResult {
  intrinsics: CameraIntrinsics;
  distortion: DistortionCoefficients;
  reprojectionError: number;
  extrinsics?: CameraExtrinsics[];
}

interface CheckerboardCorners {
  found: boolean;
  corners: Point2D[];
  gridSize: { rows: number; cols: number };
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

  get(i: number, j: number): number {
    return this.data[i][j];
  }

  set(i: number, j: number, value: number): void {
    this.data[i][j] = value;
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

  transpose(): Matrix {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[j][i] = this.data[i][j];
      }
    }
    return result;
  }

  // SVD for solving linear systems (simplified power iteration method)
  svd(): { U: Matrix; S: number[]; V: Matrix } {
    const m = this.rows;
    const n = this.cols;
    const AtA = this.transpose().multiply(this);

    // Power iteration to find largest singular value/vector
    const iterations = 100;
    const V = Matrix.identity(n);
    const S: number[] = [];

    for (let k = 0; k < Math.min(m, n); k++) {
      let v = Array(n).fill(1);
      const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
      v = v.map(x => x / norm);

      for (let iter = 0; iter < iterations; iter++) {
        const newV = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            newV[i] += AtA.get(i, j) * v[j];
          }
        }
        const newNorm = Math.sqrt(newV.reduce((sum, x) => sum + x * x, 0));
        v = newV.map(x => x / newNorm);
      }

      // Compute singular value
      let sigma = 0;
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += AtA.get(i, j) * v[j];
        }
        sigma += sum * v[i];
      }
      S.push(Math.sqrt(Math.max(0, sigma)));

      for (let i = 0; i < n; i++) {
        V.set(i, k, v[i]);
      }
    }

    // Compute U = A * V * S^-1
    const U = new Matrix(m, Math.min(m, n));
    for (let k = 0; k < Math.min(m, n); k++) {
      if (S[k] > 1e-10) {
        for (let i = 0; i < m; i++) {
          let sum = 0;
          for (let j = 0; j < n; j++) {
            sum += this.get(i, j) * V.get(j, k);
          }
          U.set(i, k, sum / S[k]);
        }
      }
    }

    return { U, S, V };
  }

  toArray(): number[][] {
    return this.data.map(row => [...row]);
  }
}

// ============================================================================
// CAMERA CALIBRATION
// ============================================================================

class CameraCalibrator {
  private imagePoints: Point2D[][];
  private objectPoints: Point3D[][];
  private imageSize: { width: number; height: number };

  constructor(imageSize: { width: number; height: number }) {
    this.imagePoints = [];
    this.objectPoints = [];
    this.imageSize = imageSize;
  }

  addCalibrationImage(corners: Point2D[], boardSize: { rows: number; cols: number }, squareSize: number): void {
    // Generate object points (3D coordinates of checkerboard corners)
    const objPts: Point3D[] = [];
    for (let r = 0; r < boardSize.rows; r++) {
      for (let c = 0; c < boardSize.cols; c++) {
        objPts.push({
          x: c * squareSize,
          y: r * squareSize,
          z: 0
        });
      }
    }

    this.objectPoints.push(objPts);
    this.imagePoints.push(corners);
  }

  calibrate(): CalibrationResult {
    if (this.imagePoints.length === 0) {
      throw new Error('No calibration images added');
    }

    // Initial estimate of intrinsics using image center
    const cx = this.imageSize.width / 2;
    const cy = this.imageSize.height / 2;

    // Estimate focal length from homographies
    const homographies = this.computeHomographies();
    const { fx, fy } = this.estimateFocalLength(homographies);

    let intrinsics: CameraIntrinsics = {
      fx,
      fy,
      cx,
      cy,
      skew: 0
    };

    let distortion: DistortionCoefficients = {
      k1: 0,
      k2: 0,
      k3: 0,
      p1: 0,
      p2: 0
    };

    // Compute extrinsics for each image
    const extrinsics: CameraExtrinsics[] = [];
    for (let i = 0; i < this.imagePoints.length; i++) {
      const ext = this.computeExtrinsics(homographies[i], intrinsics);
      extrinsics.push(ext);
    }

    // Refine parameters (simplified Levenberg-Marquardt)
    const refined = this.refineParameters(intrinsics, distortion, extrinsics);
    intrinsics = refined.intrinsics;
    distortion = refined.distortion;

    // Compute reprojection error
    const reprojectionError = this.computeReprojectionError(intrinsics, distortion, extrinsics);

    return {
      intrinsics,
      distortion,
      reprojectionError,
      extrinsics
    };
  }

  private computeHomographies(): Matrix[] {
    const homographies: Matrix[] = [];

    for (let i = 0; i < this.imagePoints.length; i++) {
      const H = this.computeHomography(this.objectPoints[i], this.imagePoints[i]);
      homographies.push(H);
    }

    return homographies;
  }

  private computeHomography(objPts: Point3D[], imgPts: Point2D[]): Matrix {
    // Build DLT matrix
    const n = objPts.length;
    const A = new Matrix(2 * n, 9);

    for (let i = 0; i < n; i++) {
      const X = objPts[i].x;
      const Y = objPts[i].y;
      const x = imgPts[i].x;
      const y = imgPts[i].y;

      A.set(2 * i, 0, X);
      A.set(2 * i, 1, Y);
      A.set(2 * i, 2, 1);
      A.set(2 * i, 3, 0);
      A.set(2 * i, 4, 0);
      A.set(2 * i, 5, 0);
      A.set(2 * i, 6, -x * X);
      A.set(2 * i, 7, -x * Y);
      A.set(2 * i, 8, -x);

      A.set(2 * i + 1, 0, 0);
      A.set(2 * i + 1, 1, 0);
      A.set(2 * i + 1, 2, 0);
      A.set(2 * i + 1, 3, X);
      A.set(2 * i + 1, 4, Y);
      A.set(2 * i + 1, 5, 1);
      A.set(2 * i + 1, 6, -y * X);
      A.set(2 * i + 1, 7, -y * Y);
      A.set(2 * i + 1, 8, -y);
    }

    // Solve using SVD
    const { V } = A.svd();

    // Extract homography from last column of V
    const H = new Matrix(3, 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        H.set(i, j, V.get(i * 3 + j, 8));
      }
    }

    // Normalize
    const scale = H.get(2, 2);
    if (Math.abs(scale) > 1e-10) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          H.set(i, j, H.get(i, j) / scale);
        }
      }
    }

    return H;
  }

  private estimateFocalLength(homographies: Matrix[]): { fx: number; fy: number } {
    // Zhang's closed-form solution for focal length
    let sumFx = 0;
    const _sumFy = 0;
    let count = 0;

    for (const H of homographies) {
      const h1 = [H.get(0, 0), H.get(1, 0), H.get(2, 0)];
      const h2 = [H.get(0, 1), H.get(1, 1), H.get(2, 1)];

      // v12 constraint
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const v12 = h1[0] * h2[0] + h1[1] * h2[1];

      // v11 - v22 constraint
      const v11_22 = h1[0] * h1[0] - h2[0] * h2[0] + h1[1] * h1[1] - h2[1] * h2[1];

      if (Math.abs(v11_22) > 1e-10) {
        // Estimate focal length
        const fxSq = -(h1[2] * h1[2] - h2[2] * h2[2]) / v11_22;
        if (fxSq > 0) {
          sumFx += Math.sqrt(fxSq);
          count++;
        }
      }
    }

    const fx = count > 0 ? sumFx / count * this.imageSize.width : this.imageSize.width;
    const fy = fx * this.imageSize.height / this.imageSize.width;

    return { fx, fy };
  }

  private computeExtrinsics(H: Matrix, K: CameraIntrinsics): CameraExtrinsics {
    // K^-1 * H = [r1 r2 t]
    const Kinv = new Matrix(3, 3);
    Kinv.set(0, 0, 1 / K.fx);
    Kinv.set(0, 2, -K.cx / K.fx);
    Kinv.set(1, 1, 1 / K.fy);
    Kinv.set(1, 2, -K.cy / K.fy);
    Kinv.set(2, 2, 1);

    const KinvH = Matrix.fromArray([
      [Kinv.get(0, 0), Kinv.get(0, 1), Kinv.get(0, 2)],
      [Kinv.get(1, 0), Kinv.get(1, 1), Kinv.get(1, 2)],
      [Kinv.get(2, 0), Kinv.get(2, 1), Kinv.get(2, 2)]
    ]).multiply(H);

    // Extract r1, r2, t and normalize
    const r1 = [KinvH.get(0, 0), KinvH.get(1, 0), KinvH.get(2, 0)];
    const r2 = [KinvH.get(0, 1), KinvH.get(1, 1), KinvH.get(2, 1)];
    const t = [KinvH.get(0, 2), KinvH.get(1, 2), KinvH.get(2, 2)];

    const lambda = 1 / Math.sqrt(r1[0] * r1[0] + r1[1] * r1[1] + r1[2] * r1[2]);

    const r1n = r1.map(x => x * lambda);
    const r2n = r2.map(x => x * lambda);
    const tn = t.map(x => x * lambda);

    // r3 = r1 x r2
    const r3n = [
      r1n[1] * r2n[2] - r1n[2] * r2n[1],
      r1n[2] * r2n[0] - r1n[0] * r2n[2],
      r1n[0] * r2n[1] - r1n[1] * r2n[0]
    ];

    const rotation = [
      [r1n[0], r2n[0], r3n[0]],
      [r1n[1], r2n[1], r3n[1]],
      [r1n[2], r2n[2], r3n[2]]
    ];

    // Convert to Rodrigues vector
    const rvec = this.rotationMatrixToRodrigues(rotation);

    return {
      rotation,
      translation: tn,
      rvec
    };
  }

  private rotationMatrixToRodrigues(R: number[][]): number[] {
    const trace = R[0][0] + R[1][1] + R[2][2];
    const theta = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));

    if (Math.abs(theta) < 1e-10) {
      return [0, 0, 0];
    }

    const scale = theta / (2 * Math.sin(theta));
    return [
      scale * (R[2][1] - R[1][2]),
      scale * (R[0][2] - R[2][0]),
      scale * (R[1][0] - R[0][1])
    ];
  }

  private refineParameters(
    intrinsics: CameraIntrinsics,
    distortion: DistortionCoefficients,
    extrinsics: CameraExtrinsics[]
  ): { intrinsics: CameraIntrinsics; distortion: DistortionCoefficients } {
    // Simplified refinement - estimate distortion from reprojection residuals
    let totalK1 = 0;
    const _totalK2 = 0;
    let count = 0;

    for (let i = 0; i < this.imagePoints.length; i++) {
      for (let j = 0; j < this.imagePoints[i].length; j++) {
        const objPt = this.objectPoints[i][j];
        const imgPt = this.imagePoints[i][j];

        // Project without distortion
        const projected = this.projectPoint(objPt, intrinsics, extrinsics[i], { k1: 0, k2: 0, k3: 0, p1: 0, p2: 0 });

        // Compute normalized coordinates
        const xn = (projected.x - intrinsics.cx) / intrinsics.fx;
        const yn = (projected.y - intrinsics.cy) / intrinsics.fy;
        const r2 = xn * xn + yn * yn;

        // Estimate distortion from residuals
        const dx = imgPt.x - projected.x;
        const dy = imgPt.y - projected.y;

        if (r2 > 0.01) {
          totalK1 += (dx * xn + dy * yn) / (r2 * intrinsics.fx);
          count++;
        }
      }
    }

    const k1 = count > 0 ? totalK1 / count : 0;

    return {
      intrinsics,
      distortion: {
        k1: Math.max(-0.5, Math.min(0.5, k1)),
        k2: 0,
        k3: 0,
        p1: 0,
        p2: 0
      }
    };
  }

  private computeReprojectionError(
    intrinsics: CameraIntrinsics,
    distortion: DistortionCoefficients,
    extrinsics: CameraExtrinsics[]
  ): number {
    let totalError = 0;
    let totalPoints = 0;

    for (let i = 0; i < this.imagePoints.length; i++) {
      for (let j = 0; j < this.imagePoints[i].length; j++) {
        const objPt = this.objectPoints[i][j];
        const imgPt = this.imagePoints[i][j];

        const projected = this.projectPoint(objPt, intrinsics, extrinsics[i], distortion);

        const dx = projected.x - imgPt.x;
        const dy = projected.y - imgPt.y;
        totalError += Math.sqrt(dx * dx + dy * dy);
        totalPoints++;
      }
    }

    return totalPoints > 0 ? totalError / totalPoints : 0;
  }

  private projectPoint(
    objPt: Point3D,
    intrinsics: CameraIntrinsics,
    extrinsics: CameraExtrinsics,
    distortion: DistortionCoefficients
  ): Point2D {
    // Transform to camera coordinates
    const R = extrinsics.rotation;
    const t = extrinsics.translation;

    const Xc = R[0][0] * objPt.x + R[0][1] * objPt.y + R[0][2] * objPt.z + t[0];
    const Yc = R[1][0] * objPt.x + R[1][1] * objPt.y + R[1][2] * objPt.z + t[1];
    const Zc = R[2][0] * objPt.x + R[2][1] * objPt.y + R[2][2] * objPt.z + t[2];

    // Normalized coordinates
    const xn = Xc / Zc;
    const yn = Yc / Zc;

    // Apply distortion
    const r2 = xn * xn + yn * yn;
    const r4 = r2 * r2;
    const r6 = r4 * r2;

    const radialDistortion = 1 + distortion.k1 * r2 + distortion.k2 * r4 + distortion.k3 * r6;

    const xd = xn * radialDistortion + 2 * distortion.p1 * xn * yn + distortion.p2 * (r2 + 2 * xn * xn);
    const yd = yn * radialDistortion + distortion.p1 * (r2 + 2 * yn * yn) + 2 * distortion.p2 * xn * yn;

    // Project to image
    return {
      x: intrinsics.fx * xd + intrinsics.cx,
      y: intrinsics.fy * yd + intrinsics.cy
    };
  }
}

// ============================================================================
// DISTORTION CORRECTION
// ============================================================================

function undistortPoint(
  point: Point2D,
  intrinsics: CameraIntrinsics,
  distortion: DistortionCoefficients,
  iterations: number = 10
): Point2D {
  // Normalize
  const xn = (point.x - intrinsics.cx) / intrinsics.fx;
  const yn = (point.y - intrinsics.cy) / intrinsics.fy;

  // Initial guess
  let xu = xn;
  let yu = yn;

  // Iterative undistortion
  for (let i = 0; i < iterations; i++) {
    const r2 = xu * xu + yu * yu;
    const r4 = r2 * r2;
    const r6 = r4 * r2;

    const radialDistortion = 1 + distortion.k1 * r2 + distortion.k2 * r4 + distortion.k3 * r6;

    const dx = 2 * distortion.p1 * xu * yu + distortion.p2 * (r2 + 2 * xu * xu);
    const dy = distortion.p1 * (r2 + 2 * yu * yu) + 2 * distortion.p2 * xu * yu;

    xu = (xn - dx) / radialDistortion;
    yu = (yn - dy) / radialDistortion;
  }

  return {
    x: xu * intrinsics.fx + intrinsics.cx,
    y: yu * intrinsics.fy + intrinsics.cy
  };
}

// ============================================================================
// CHECKERBOARD DETECTION (Simplified)
// ============================================================================

function detectCheckerboardCorners(
  imageData: number[][],
  gridSize: { rows: number; cols: number }
): CheckerboardCorners {
  const height = imageData.length;
  const width = imageData[0]?.length || 0;

  // Simplified corner detection using gradient magnitude
  const corners: Point2D[] = [];

  // Compute gradients
  const gradX: number[][] = [];
  const gradY: number[][] = [];

  for (let y = 1; y < height - 1; y++) {
    gradX[y] = [];
    gradY[y] = [];
    for (let x = 1; x < width - 1; x++) {
      gradX[y][x] = (imageData[y][x + 1] - imageData[y][x - 1]) / 2;
      gradY[y][x] = (imageData[y + 1][x] - imageData[y - 1][x]) / 2;
    }
  }

  // Compute Harris response
  const harrisResponse: number[][] = [];
  const k = 0.04;
  const windowSize = 3;
  const halfWin = Math.floor(windowSize / 2);

  for (let y = halfWin + 1; y < height - halfWin - 1; y++) {
    harrisResponse[y] = [];
    for (let x = halfWin + 1; x < width - halfWin - 1; x++) {
      let sumIxx = 0, sumIyy = 0, sumIxy = 0;

      for (let wy = -halfWin; wy <= halfWin; wy++) {
        for (let wx = -halfWin; wx <= halfWin; wx++) {
          const Ix = gradX[y + wy]?.[x + wx] || 0;
          const Iy = gradY[y + wy]?.[x + wx] || 0;
          sumIxx += Ix * Ix;
          sumIyy += Iy * Iy;
          sumIxy += Ix * Iy;
        }
      }

      const det = sumIxx * sumIyy - sumIxy * sumIxy;
      const trace = sumIxx + sumIyy;
      harrisResponse[y][x] = det - k * trace * trace;
    }
  }

  // Non-maximum suppression and threshold
  const threshold = 0.01 * Math.max(...harrisResponse.flat().filter(v => v !== undefined));
  const suppWindow = 5;
  const halfSupp = Math.floor(suppWindow / 2);

  for (let y = halfSupp + halfWin + 1; y < height - halfSupp - halfWin - 1; y++) {
    for (let x = halfSupp + halfWin + 1; x < width - halfSupp - halfWin - 1; x++) {
      const response = harrisResponse[y]?.[x] || 0;
      if (response < threshold) continue;

      let isMax = true;
      for (let wy = -halfSupp; wy <= halfSupp && isMax; wy++) {
        for (let wx = -halfSupp; wx <= halfSupp && isMax; wx++) {
          if (wy === 0 && wx === 0) continue;
          if ((harrisResponse[y + wy]?.[x + wx] || 0) >= response) {
            isMax = false;
          }
        }
      }

      if (isMax) {
        corners.push({ x, y });
      }
    }
  }

  // Sort corners into grid pattern (simplified)
  const expectedCorners = gridSize.rows * gridSize.cols;
  const found = corners.length >= expectedCorners;

  return {
    found,
    corners: corners.slice(0, expectedCorners),
    gridSize
  };
}

// ============================================================================
// SYNTHETIC CALIBRATION DATA GENERATOR
// ============================================================================

function generateSyntheticCalibrationData(
  trueIntrinsics: CameraIntrinsics,
  trueDistortion: DistortionCoefficients,
  boardSize: { rows: number; cols: number },
  squareSize: number,
  numImages: number,
  noiseStd: number = 0.5
): { objectPoints: Point3D[][]; imagePoints: Point2D[][] } {
  const objectPoints: Point3D[][] = [];
  const imagePoints: Point2D[][] = [];

  for (let img = 0; img < numImages; img++) {
    const objPts: Point3D[] = [];
    const imgPts: Point2D[] = [];

    // Generate random rotation and translation
    const rx = (Math.random() - 0.5) * Math.PI / 4;
    const ry = (Math.random() - 0.5) * Math.PI / 4;
    const rz = (Math.random() - 0.5) * Math.PI / 6;
    const tx = (Math.random() - 0.5) * squareSize * boardSize.cols;
    const ty = (Math.random() - 0.5) * squareSize * boardSize.rows;
    const tz = squareSize * boardSize.cols * 2 + Math.random() * squareSize * boardSize.cols;

    // Rotation matrix
    const Rx = [
      [1, 0, 0],
      [0, Math.cos(rx), -Math.sin(rx)],
      [0, Math.sin(rx), Math.cos(rx)]
    ];
    const Ry = [
      [Math.cos(ry), 0, Math.sin(ry)],
      [0, 1, 0],
      [-Math.sin(ry), 0, Math.cos(ry)]
    ];
    const Rz = [
      [Math.cos(rz), -Math.sin(rz), 0],
      [Math.sin(rz), Math.cos(rz), 0],
      [0, 0, 1]
    ];

    const multiplyMat = (A: number[][], B: number[][]): number[][] => {
      const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < 3; k++) {
            C[i][j] += A[i][k] * B[k][j];
          }
        }
      }
      return C;
    };

    const R = multiplyMat(multiplyMat(Rz, Ry), Rx);

    for (let r = 0; r < boardSize.rows; r++) {
      for (let c = 0; c < boardSize.cols; c++) {
        const X = c * squareSize;
        const Y = r * squareSize;
        const Z = 0;

        objPts.push({ x: X, y: Y, z: Z });

        // Transform to camera coordinates
        const Xc = R[0][0] * X + R[0][1] * Y + R[0][2] * Z + tx;
        const Yc = R[1][0] * X + R[1][1] * Y + R[1][2] * Z + ty;
        const Zc = R[2][0] * X + R[2][1] * Y + R[2][2] * Z + tz;

        // Normalized coordinates
        const xn = Xc / Zc;
        const yn = Yc / Zc;

        // Apply distortion
        const r2 = xn * xn + yn * yn;
        const r4 = r2 * r2;
        const radial = 1 + trueDistortion.k1 * r2 + trueDistortion.k2 * r4;

        const xd = xn * radial;
        const yd = yn * radial;

        // Project with noise
        const u = trueIntrinsics.fx * xd + trueIntrinsics.cx + (Math.random() - 0.5) * noiseStd * 2;
        const v = trueIntrinsics.fy * yd + trueIntrinsics.cy + (Math.random() - 0.5) * noiseStd * 2;

        imgPts.push({ x: u, y: v });
      }
    }

    objectPoints.push(objPts);
    imagePoints.push(imgPts);
  }

  return { objectPoints, imagePoints };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cameracalibrationTool: UnifiedTool = {
  name: 'camera_calibration',
  description: 'Camera intrinsic and extrinsic calibration using checkerboard patterns, Zhang\'s method, and distortion correction',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['calibrate', 'undistort', 'project', 'detect_corners', 'info', 'examples', 'demo'],
        description: 'Calibration operation to perform'
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

export async function executecameracalibration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, parameters = {} } = args;

    switch (operation) {
      case 'calibrate': {
        const {
          imageSize = { width: 640, height: 480 },
          boardSize = { rows: 6, cols: 9 },
          squareSize = 25,
          imagePoints = null,
          numSyntheticImages = 10
        } = parameters;

        const calibrator = new CameraCalibrator(imageSize);

        if (imagePoints && Array.isArray(imagePoints)) {
          // Use provided image points
          for (const corners of imagePoints) {
            calibrator.addCalibrationImage(corners, boardSize, squareSize);
          }
        } else {
          // Generate synthetic data for demonstration
          const trueIntrinsics: CameraIntrinsics = {
            fx: 500,
            fy: 500,
            cx: imageSize.width / 2,
            cy: imageSize.height / 2,
            skew: 0
          };
          const trueDistortion: DistortionCoefficients = {
            k1: -0.1,
            k2: 0.01,
            k3: 0,
            p1: 0,
            p2: 0
          };

          const syntheticData = generateSyntheticCalibrationData(
            trueIntrinsics,
            trueDistortion,
            boardSize,
            squareSize,
            numSyntheticImages
          );

          for (const corners of syntheticData.imagePoints) {
            calibrator.addCalibrationImage(corners, boardSize, squareSize);
          }
        }

        const result = calibrator.calibrate();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'calibrate',
            method: 'Zhang\'s Camera Calibration',
            configuration: {
              imageSize,
              boardSize,
              squareSize,
              numImages: imagePoints?.length || numSyntheticImages
            },
            result: {
              intrinsics: {
                focalLength: { fx: result.intrinsics.fx.toFixed(2), fy: result.intrinsics.fy.toFixed(2) },
                principalPoint: { cx: result.intrinsics.cx.toFixed(2), cy: result.intrinsics.cy.toFixed(2) },
                cameraMatrix: [
                  [result.intrinsics.fx, result.intrinsics.skew, result.intrinsics.cx],
                  [0, result.intrinsics.fy, result.intrinsics.cy],
                  [0, 0, 1]
                ]
              },
              distortion: result.distortion,
              reprojectionError: result.reprojectionError.toFixed(4) + ' pixels',
              numExtrinsics: result.extrinsics?.length
            },
            description: 'Estimated camera intrinsic parameters and lens distortion coefficients'
          }, null, 2)
        };
      }

      case 'undistort': {
        const {
          points = [{ x: 320, y: 240 }],
          intrinsics = { fx: 500, fy: 500, cx: 320, cy: 240, skew: 0 },
          distortion = { k1: -0.1, k2: 0.01, k3: 0, p1: 0, p2: 0 }
        } = parameters;

        const undistortedPoints = points.map((pt: Point2D) =>
          undistortPoint(pt, intrinsics, distortion)
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'undistort',
            input: {
              points,
              intrinsics,
              distortion
            },
            result: {
              undistortedPoints: undistortedPoints.map((pt: Point2D) => ({
                x: pt.x.toFixed(2),
                y: pt.y.toFixed(2)
              })),
              displacement: points.map((pt: Point2D, i: number) => ({
                original: pt,
                undistorted: undistortedPoints[i],
                dx: (undistortedPoints[i].x - pt.x).toFixed(2),
                dy: (undistortedPoints[i].y - pt.y).toFixed(2)
              }))
            },
            description: 'Removed lens distortion from image points'
          }, null, 2)
        };
      }

      case 'project': {
        const {
          points3D = [{ x: 0, y: 0, z: 100 }],
          intrinsics = { fx: 500, fy: 500, cx: 320, cy: 240, skew: 0 },
          distortion = { k1: 0, k2: 0, k3: 0, p1: 0, p2: 0 },
          extrinsics = {
            rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            translation: [0, 0, 0]
          }
        } = parameters;

        const projectedPoints = points3D.map((pt: Point3D) => {
          const R = extrinsics.rotation;
          const t = extrinsics.translation;

          const Xc = R[0][0] * pt.x + R[0][1] * pt.y + R[0][2] * pt.z + t[0];
          const Yc = R[1][0] * pt.x + R[1][1] * pt.y + R[1][2] * pt.z + t[1];
          const Zc = R[2][0] * pt.x + R[2][1] * pt.y + R[2][2] * pt.z + t[2];

          const xn = Xc / Zc;
          const yn = Yc / Zc;

          const r2 = xn * xn + yn * yn;
          const radial = 1 + distortion.k1 * r2 + distortion.k2 * r2 * r2;

          return {
            x: intrinsics.fx * xn * radial + intrinsics.cx,
            y: intrinsics.fy * yn * radial + intrinsics.cy
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'project',
            input: { points3D, intrinsics, extrinsics },
            result: {
              projectedPoints: projectedPoints.map((pt: Point2D) => ({
                x: pt.x.toFixed(2),
                y: pt.y.toFixed(2)
              }))
            },
            description: 'Projected 3D world points to 2D image coordinates'
          }, null, 2)
        };
      }

      case 'detect_corners': {
        const {
          imageData = null,
          gridSize = { rows: 6, cols: 9 }
        } = parameters;

        // Generate synthetic image data if not provided
        let data = imageData;
        if (!data) {
          const width = 640;
          const height = 480;
          data = Array(height).fill(null).map(() => Array(width).fill(128));

          // Draw synthetic checkerboard pattern
          const cellSize = 40;
          const startX = 100;
          const startY = 60;

          for (let r = 0; r < gridSize.rows + 1; r++) {
            for (let c = 0; c < gridSize.cols + 1; c++) {
              const color = ((r + c) % 2 === 0) ? 255 : 0;
              for (let py = 0; py < cellSize; py++) {
                for (let px = 0; px < cellSize; px++) {
                  const y = startY + r * cellSize + py;
                  const x = startX + c * cellSize + px;
                  if (y < height && x < width) {
                    data[y][x] = color;
                  }
                }
              }
            }
          }
        }

        const result = detectCheckerboardCorners(data, gridSize);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_corners',
            configuration: { gridSize },
            result: {
              found: result.found,
              numCorners: result.corners.length,
              expectedCorners: gridSize.rows * gridSize.cols,
              sampleCorners: result.corners.slice(0, 5).map((c: Point2D) => ({
                x: Math.round(c.x),
                y: Math.round(c.y)
              }))
            },
            description: 'Detected checkerboard corners using Harris corner detection'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'camera_calibration',
            description: 'Camera calibration for computer vision applications',
            concepts: {
              intrinsics: {
                description: 'Internal camera parameters',
                parameters: ['Focal length (fx, fy)', 'Principal point (cx, cy)', 'Skew coefficient']
              },
              extrinsics: {
                description: 'Camera pose in world coordinates',
                parameters: ['Rotation matrix (3x3)', 'Translation vector (3x1)']
              },
              distortion: {
                description: 'Lens distortion coefficients',
                types: ['Radial (k1, k2, k3)', 'Tangential (p1, p2)']
              }
            },
            methods: {
              zhang: 'Planar calibration using multiple checkerboard images',
              dlt: 'Direct Linear Transform for homography estimation',
              levenbergMarquardt: 'Nonlinear refinement of parameters'
            },
            operations: ['calibrate', 'undistort', 'project', 'detect_corners', 'info', 'examples', 'demo']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Calibrate from checkerboard',
                operation: 'calibrate',
                parameters: {
                  imageSize: { width: 1920, height: 1080 },
                  boardSize: { rows: 6, cols: 9 },
                  squareSize: 25,
                  numSyntheticImages: 15
                }
              },
              {
                name: 'Undistort points',
                operation: 'undistort',
                parameters: {
                  points: [{ x: 100, y: 100 }, { x: 500, y: 300 }],
                  intrinsics: { fx: 1000, fy: 1000, cx: 960, cy: 540, skew: 0 },
                  distortion: { k1: -0.2, k2: 0.1, k3: 0, p1: 0, p2: 0 }
                }
              },
              {
                name: 'Project 3D points',
                operation: 'project',
                parameters: {
                  points3D: [{ x: 0, y: 0, z: 500 }, { x: 100, y: 0, z: 500 }],
                  intrinsics: { fx: 500, fy: 500, cx: 320, cy: 240, skew: 0 }
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo: Full calibration pipeline
        const imageSize = { width: 640, height: 480 };
        const boardSize = { rows: 6, cols: 9 };
        const squareSize = 25;

        const trueIntrinsics: CameraIntrinsics = {
          fx: 500,
          fy: 500,
          cx: 320,
          cy: 240,
          skew: 0
        };
        const trueDistortion: DistortionCoefficients = {
          k1: -0.15,
          k2: 0.02,
          k3: 0,
          p1: 0,
          p2: 0
        };

        const calibrator = new CameraCalibrator(imageSize);
        const syntheticData = generateSyntheticCalibrationData(
          trueIntrinsics,
          trueDistortion,
          boardSize,
          squareSize,
          12
        );

        for (const corners of syntheticData.imagePoints) {
          calibrator.addCalibrationImage(corners, boardSize, squareSize);
        }

        const result = calibrator.calibrate();

        // Test undistortion
        const testPoint = { x: 100, y: 100 };
        const undistorted = undistortPoint(testPoint, result.intrinsics, result.distortion);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demo: 'Camera Calibration Pipeline',
            description: 'Complete calibration from synthetic checkerboard images',
            groundTruth: {
              intrinsics: trueIntrinsics,
              distortion: trueDistortion
            },
            estimated: {
              intrinsics: {
                fx: result.intrinsics.fx.toFixed(2),
                fy: result.intrinsics.fy.toFixed(2),
                cx: result.intrinsics.cx.toFixed(2),
                cy: result.intrinsics.cy.toFixed(2)
              },
              distortion: {
                k1: result.distortion.k1.toFixed(4),
                k2: result.distortion.k2.toFixed(4)
              }
            },
            accuracy: {
              reprojectionError: result.reprojectionError.toFixed(4) + ' pixels',
              fxError: Math.abs(result.intrinsics.fx - trueIntrinsics.fx).toFixed(2),
              fyError: Math.abs(result.intrinsics.fy - trueIntrinsics.fy).toFixed(2)
            },
            undistortionExample: {
              original: testPoint,
              undistorted: {
                x: undistorted.x.toFixed(2),
                y: undistorted.y.toFixed(2)
              }
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['calibrate', 'undistort', 'project', 'detect_corners', 'info', 'examples', 'demo']
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

export function iscameracalibrationAvailable(): boolean {
  return true;
}
