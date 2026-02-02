/**
 * SHADOW-MAPPING TOOL
 * Real-time shadow generation using depth-based shadow mapping techniques
 *
 * Implements:
 * - Basic shadow mapping with depth comparison
 * - Percentage Closer Filtering (PCF) for soft shadows
 * - Variance Shadow Maps (VSM)
 * - Cascaded Shadow Maps (CSM) for large scenes
 * - Shadow bias and acne prevention
 * - Light-space matrix calculation
 * - Multiple light types (directional, point, spot)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Matrix4 {
  m: number[][];  // 4x4 matrix
}

interface Light {
  type: 'directional' | 'point' | 'spot';
  position: Vector3;
  direction: Vector3;
  color: { r: number; g: number; b: number };
  intensity: number;
  // Spot light specific
  innerAngle?: number;  // degrees
  outerAngle?: number;  // degrees
  // Point/spot specific
  range?: number;
}

interface ShadowMapSettings {
  resolution: number;       // Shadow map size (e.g., 1024, 2048, 4096)
  nearPlane: number;        // Light frustum near plane
  farPlane: number;         // Light frustum far plane
  bias: number;             // Depth bias to prevent shadow acne
  normalBias: number;       // Normal-based bias
  softness: number;         // PCF kernel size (1, 3, 5, 7)
  cascadeCount?: number;    // Number of cascades for CSM
  cascadeSplits?: number[]; // Split distances for cascades
}

interface ShadowMap {
  resolution: number;
  depthBuffer: number[][];
  lightViewMatrix: Matrix4;
  lightProjectionMatrix: Matrix4;
  lightViewProjection: Matrix4;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

interface CascadedShadowMap {
  cascadeCount: number;
  cascades: ShadowMap[];
  splitDistances: number[];
}

// ============================================================================
// VECTOR AND MATRIX MATH
// ============================================================================

class VectorMath {
  static add(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static scale(v: Vector3, s: number): Vector3 {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static normalize(v: Vector3): Vector3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  static length(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static negate(v: Vector3): Vector3 {
    return { x: -v.x, y: -v.y, z: -v.z };
  }
}

class MatrixMath {
  static identity(): Matrix4 {
    return {
      m: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  static multiply(a: Matrix4, b: Matrix4): Matrix4 {
    const result: number[][] = [];
    for (let i = 0; i < 4; i++) {
      result[i] = [];
      for (let j = 0; j < 4; j++) {
        result[i][j] = 0;
        for (let k = 0; k < 4; k++) {
          result[i][j] += a.m[i][k] * b.m[k][j];
        }
      }
    }
    return { m: result };
  }

  static transformPoint(m: Matrix4, p: Vector3): Vector3 {
    const w = m.m[3][0] * p.x + m.m[3][1] * p.y + m.m[3][2] * p.z + m.m[3][3];
    return {
      x: (m.m[0][0] * p.x + m.m[0][1] * p.y + m.m[0][2] * p.z + m.m[0][3]) / w,
      y: (m.m[1][0] * p.x + m.m[1][1] * p.y + m.m[1][2] * p.z + m.m[1][3]) / w,
      z: (m.m[2][0] * p.x + m.m[2][1] * p.y + m.m[2][2] * p.z + m.m[2][3]) / w
    };
  }

  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const zAxis = VectorMath.normalize(VectorMath.subtract(eye, target));
    const xAxis = VectorMath.normalize(VectorMath.cross(up, zAxis));
    const yAxis = VectorMath.cross(zAxis, xAxis);

    return {
      m: [
        [xAxis.x, xAxis.y, xAxis.z, -VectorMath.dot(xAxis, eye)],
        [yAxis.x, yAxis.y, yAxis.z, -VectorMath.dot(yAxis, eye)],
        [zAxis.x, zAxis.y, zAxis.z, -VectorMath.dot(zAxis, eye)],
        [0, 0, 0, 1]
      ]
    };
  }

  static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4 {
    return {
      m: [
        [2 / (right - left), 0, 0, -(right + left) / (right - left)],
        [0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom)],
        [0, 0, -2 / (far - near), -(far + near) / (far - near)],
        [0, 0, 0, 1]
      ]
    };
  }

  static perspective(fovY: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1 / Math.tan((fovY * Math.PI / 180) / 2);
    return {
      m: [
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)],
        [0, 0, -1, 0]
      ]
    };
  }
}

// ============================================================================
// LIGHT SPACE CALCULATIONS
// ============================================================================

class LightSpaceCalculator {
  /**
   * Calculate view matrix for directional light
   */
  static directionalLightView(light: Light, sceneCenter: Vector3, sceneRadius: number): Matrix4 {
    const lightDir = VectorMath.normalize(light.direction);
    const lightPos = VectorMath.subtract(sceneCenter, VectorMath.scale(lightDir, sceneRadius * 2));

    // Choose up vector that's not parallel to light direction
    let up: Vector3 = { x: 0, y: 1, z: 0 };
    if (Math.abs(VectorMath.dot(lightDir, up)) > 0.99) {
      up = { x: 1, y: 0, z: 0 };
    }

    return MatrixMath.lookAt(lightPos, sceneCenter, up);
  }

  /**
   * Calculate orthographic projection for directional light
   */
  static directionalLightProjection(sceneRadius: number, near: number, far: number): Matrix4 {
    return MatrixMath.orthographic(
      -sceneRadius, sceneRadius,
      -sceneRadius, sceneRadius,
      near, far
    );
  }

  /**
   * Calculate view matrix for spot light
   */
  static spotLightView(light: Light): Matrix4 {
    const target = VectorMath.add(light.position, light.direction);

    let up: Vector3 = { x: 0, y: 1, z: 0 };
    const dir = VectorMath.normalize(light.direction);
    if (Math.abs(VectorMath.dot(dir, up)) > 0.99) {
      up = { x: 1, y: 0, z: 0 };
    }

    return MatrixMath.lookAt(light.position, target, up);
  }

  /**
   * Calculate perspective projection for spot light
   */
  static spotLightProjection(light: Light, near: number, far: number): Matrix4 {
    const fov = (light.outerAngle || 45) * 2;
    return MatrixMath.perspective(fov, 1, near, far);
  }

  /**
   * Calculate light-view-projection matrix
   */
  static calculateLVP(
    light: Light,
    sceneCenter: Vector3,
    sceneRadius: number,
    settings: ShadowMapSettings
  ): { view: Matrix4; projection: Matrix4; viewProjection: Matrix4 } {
    let view: Matrix4;
    let projection: Matrix4;

    switch (light.type) {
      case 'directional':
        view = this.directionalLightView(light, sceneCenter, sceneRadius);
        projection = this.directionalLightProjection(sceneRadius, settings.nearPlane, settings.farPlane);
        break;

      case 'spot':
        view = this.spotLightView(light);
        projection = this.spotLightProjection(light, settings.nearPlane, light.range || settings.farPlane);
        break;

      case 'point':
        // Point lights need 6 shadow maps (cube map) - simplified to single direction
        const dir = { x: 0, y: -1, z: 0 };  // Default down direction
        view = MatrixMath.lookAt(
          light.position,
          VectorMath.add(light.position, dir),
          { x: 0, y: 0, z: 1 }
        );
        projection = MatrixMath.perspective(90, 1, settings.nearPlane, light.range || settings.farPlane);
        break;

      default:
        view = MatrixMath.identity();
        projection = MatrixMath.identity();
    }

    const viewProjection = MatrixMath.multiply(projection, view);
    return { view, projection, viewProjection };
  }
}

// ============================================================================
// SHADOW MAP GENERATION
// ============================================================================

class ShadowMapGenerator {
  /**
   * Create empty shadow map
   */
  static createShadowMap(resolution: number): number[][] {
    const map: number[][] = [];
    for (let y = 0; y < resolution; y++) {
      map[y] = [];
      for (let x = 0; x < resolution; x++) {
        map[y][x] = 1.0;  // Far plane (maximum depth)
      }
    }
    return map;
  }

  /**
   * Render depth to shadow map from a set of triangles
   */
  static renderDepth(
    triangles: { v0: Vector3; v1: Vector3; v2: Vector3 }[],
    lightViewProjection: Matrix4,
    resolution: number
  ): number[][] {
    const depthBuffer = this.createShadowMap(resolution);

    for (const tri of triangles) {
      // Transform vertices to light space
      const p0 = MatrixMath.transformPoint(lightViewProjection, tri.v0);
      const p1 = MatrixMath.transformPoint(lightViewProjection, tri.v1);
      const p2 = MatrixMath.transformPoint(lightViewProjection, tri.v2);

      // Convert from NDC to screen space
      const toScreen = (p: Vector3) => ({
        x: ((p.x + 1) / 2) * resolution,
        y: ((p.y + 1) / 2) * resolution,
        z: (p.z + 1) / 2  // Depth 0-1
      });

      const s0 = toScreen(p0);
      const s1 = toScreen(p1);
      const s2 = toScreen(p2);

      // Simple triangle rasterization
      this.rasterizeTriangle(depthBuffer, s0, s1, s2, resolution);
    }

    return depthBuffer;
  }

  /**
   * Rasterize triangle to depth buffer
   */
  static rasterizeTriangle(
    depthBuffer: number[][],
    v0: { x: number; y: number; z: number },
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number },
    resolution: number
  ): void {
    // Bounding box
    const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
    const maxX = Math.min(resolution - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
    const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
    const maxY = Math.min(resolution - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

    // Edge function for barycentric coordinates
    const edge = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
      (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);

    const area = edge(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
    if (Math.abs(area) < 0.0001) return;  // Degenerate triangle

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;

        // Barycentric coordinates
        const w0 = edge(v1.x, v1.y, v2.x, v2.y, px, py);
        const w1 = edge(v2.x, v2.y, v0.x, v0.y, px, py);
        const w2 = edge(v0.x, v0.y, v1.x, v1.y, px, py);

        // Check if inside triangle
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          // Interpolate depth
          const depth = (w0 * v0.z + w1 * v1.z + w2 * v2.z) / (w0 + w1 + w2);

          // Depth test (closer wins)
          if (depth < depthBuffer[y][x]) {
            depthBuffer[y][x] = depth;
          }
        }
      }
    }
  }

  /**
   * Generate demo scene triangles
   */
  static createDemoScene(): { v0: Vector3; v1: Vector3; v2: Vector3 }[] {
    // Ground plane
    const ground = [
      { v0: { x: -10, y: 0, z: -10 }, v1: { x: 10, y: 0, z: -10 }, v2: { x: 10, y: 0, z: 10 } },
      { v0: { x: -10, y: 0, z: -10 }, v1: { x: 10, y: 0, z: 10 }, v2: { x: -10, y: 0, z: 10 } }
    ];

    // Box (simplified - just top and one side)
    const box = [
      // Top
      { v0: { x: -2, y: 3, z: -2 }, v1: { x: 2, y: 3, z: -2 }, v2: { x: 2, y: 3, z: 2 } },
      { v0: { x: -2, y: 3, z: -2 }, v1: { x: 2, y: 3, z: 2 }, v2: { x: -2, y: 3, z: 2 } },
      // Front
      { v0: { x: -2, y: 0, z: 2 }, v1: { x: 2, y: 0, z: 2 }, v2: { x: 2, y: 3, z: 2 } },
      { v0: { x: -2, y: 0, z: 2 }, v1: { x: 2, y: 3, z: 2 }, v2: { x: -2, y: 3, z: 2 } }
    ];

    return [...ground, ...box];
  }
}

// ============================================================================
// SHADOW SAMPLING
// ============================================================================

class ShadowSampler {
  /**
   * Basic shadow map lookup with bias
   */
  static sample(
    shadowMap: number[][],
    lightSpacePos: Vector3,
    resolution: number,
    bias: number
  ): number {
    // Convert from NDC to texture coordinates
    const u = (lightSpacePos.x + 1) / 2;
    const v = (lightSpacePos.y + 1) / 2;
    const depth = (lightSpacePos.z + 1) / 2;

    // Check bounds
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return 1.0;  // Outside shadow map = lit
    }

    // Sample shadow map
    const x = Math.floor(u * resolution);
    const y = Math.floor(v * resolution);
    const shadowDepth = shadowMap[Math.min(y, resolution - 1)]?.[Math.min(x, resolution - 1)] ?? 1;

    // Depth comparison with bias
    return depth - bias > shadowDepth ? 0.0 : 1.0;
  }

  /**
   * Percentage Closer Filtering (PCF) for soft shadows
   */
  static samplePCF(
    shadowMap: number[][],
    lightSpacePos: Vector3,
    resolution: number,
    bias: number,
    kernelSize: number
  ): number {
    const u = (lightSpacePos.x + 1) / 2;
    const v = (lightSpacePos.y + 1) / 2;
    const depth = (lightSpacePos.z + 1) / 2;

    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return 1.0;
    }

    const halfKernel = Math.floor(kernelSize / 2);
    const texelSize = 1 / resolution;
    let shadow = 0;
    let count = 0;

    for (let ky = -halfKernel; ky <= halfKernel; ky++) {
      for (let kx = -halfKernel; kx <= halfKernel; kx++) {
        const sampleU = u + kx * texelSize;
        const sampleV = v + ky * texelSize;

        if (sampleU >= 0 && sampleU <= 1 && sampleV >= 0 && sampleV <= 1) {
          const x = Math.floor(sampleU * resolution);
          const y = Math.floor(sampleV * resolution);
          const shadowDepth = shadowMap[Math.min(y, resolution - 1)]?.[Math.min(x, resolution - 1)] ?? 1;

          shadow += depth - bias > shadowDepth ? 0.0 : 1.0;
          count++;
        }
      }
    }

    return count > 0 ? shadow / count : 1.0;
  }

  /**
   * Poisson disk sampling for smoother PCF
   */
  static samplePoissonPCF(
    shadowMap: number[][],
    lightSpacePos: Vector3,
    resolution: number,
    bias: number,
    radius: number
  ): number {
    // Poisson disk sample offsets (pre-computed)
    const poissonDisk = [
      { x: -0.94201624, y: -0.39906216 },
      { x: 0.94558609, y: -0.76890725 },
      { x: -0.094184101, y: -0.92938870 },
      { x: 0.34495938, y: 0.29387760 },
      { x: -0.91588581, y: 0.45771432 },
      { x: -0.81544232, y: -0.87912464 },
      { x: -0.38277543, y: 0.27676845 },
      { x: 0.97484398, y: 0.75648379 },
      { x: 0.44323325, y: -0.97511554 },
      { x: 0.53742981, y: -0.47373420 },
      { x: -0.26496911, y: -0.41893023 },
      { x: 0.79197514, y: 0.19090188 },
      { x: -0.24188840, y: 0.99706507 },
      { x: -0.81409955, y: 0.91437590 },
      { x: 0.19984126, y: 0.78641367 },
      { x: 0.14383161, y: -0.14100790 }
    ];

    const u = (lightSpacePos.x + 1) / 2;
    const v = (lightSpacePos.y + 1) / 2;
    const depth = (lightSpacePos.z + 1) / 2;

    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return 1.0;
    }

    const texelSize = radius / resolution;
    let shadow = 0;

    for (const offset of poissonDisk) {
      const sampleU = u + offset.x * texelSize;
      const sampleV = v + offset.y * texelSize;

      if (sampleU >= 0 && sampleU <= 1 && sampleV >= 0 && sampleV <= 1) {
        const x = Math.floor(sampleU * resolution);
        const y = Math.floor(sampleV * resolution);
        const shadowDepth = shadowMap[Math.min(y, resolution - 1)]?.[Math.min(x, resolution - 1)] ?? 1;

        shadow += depth - bias > shadowDepth ? 0.0 : 1.0;
      } else {
        shadow += 1.0;
      }
    }

    return shadow / poissonDisk.length;
  }
}

// ============================================================================
// VARIANCE SHADOW MAPS
// ============================================================================

class VarianceShadowMap {
  /**
   * Generate VSM (stores depth and depth^2)
   */
  static generate(
    triangles: { v0: Vector3; v1: Vector3; v2: Vector3 }[],
    lightViewProjection: Matrix4,
    resolution: number
  ): { depth: number[][]; depthSq: number[][] } {
    const depth = ShadowMapGenerator.createShadowMap(resolution);
    const depthSq = ShadowMapGenerator.createShadowMap(resolution);

    // Render depth (similar to regular shadow map but store both)
    for (const tri of triangles) {
      const p0 = MatrixMath.transformPoint(lightViewProjection, tri.v0);
      const p1 = MatrixMath.transformPoint(lightViewProjection, tri.v1);
      const p2 = MatrixMath.transformPoint(lightViewProjection, tri.v2);

      const toScreen = (p: Vector3) => ({
        x: ((p.x + 1) / 2) * resolution,
        y: ((p.y + 1) / 2) * resolution,
        z: (p.z + 1) / 2
      });

      this.rasterizeVSM(depth, depthSq, toScreen(p0), toScreen(p1), toScreen(p2), resolution);
    }

    // Apply blur for soft shadows (simplified box blur)
    const blurredDepth = this.blur(depth, resolution, 3);
    const blurredDepthSq = this.blur(depthSq, resolution, 3);

    return { depth: blurredDepth, depthSq: blurredDepthSq };
  }

  static rasterizeVSM(
    depth: number[][],
    depthSq: number[][],
    v0: { x: number; y: number; z: number },
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number },
    resolution: number
  ): void {
    const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
    const maxX = Math.min(resolution - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
    const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
    const maxY = Math.min(resolution - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

    const edge = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
      (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);

    const area = edge(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
    if (Math.abs(area) < 0.0001) return;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;

        const w0 = edge(v1.x, v1.y, v2.x, v2.y, px, py);
        const w1 = edge(v2.x, v2.y, v0.x, v0.y, px, py);
        const w2 = edge(v0.x, v0.y, v1.x, v1.y, px, py);

        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          const d = (w0 * v0.z + w1 * v1.z + w2 * v2.z) / (w0 + w1 + w2);

          if (d < depth[y][x]) {
            depth[y][x] = d;
            depthSq[y][x] = d * d;
          }
        }
      }
    }
  }

  static blur(map: number[][], resolution: number, kernelSize: number): number[][] {
    const result: number[][] = [];
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < resolution; y++) {
      result[y] = [];
      for (let x = 0; x < resolution; x++) {
        let sum = 0;
        let count = 0;

        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const sy = Math.min(Math.max(y + ky, 0), resolution - 1);
            const sx = Math.min(Math.max(x + kx, 0), resolution - 1);
            sum += map[sy][sx];
            count++;
          }
        }

        result[y][x] = sum / count;
      }
    }

    return result;
  }

  /**
   * Sample VSM with Chebyshev inequality
   */
  static sample(
    vsmDepth: number[][],
    vsmDepthSq: number[][],
    lightSpacePos: Vector3,
    resolution: number,
    minVariance: number = 0.00002
  ): number {
    const u = (lightSpacePos.x + 1) / 2;
    const v = (lightSpacePos.y + 1) / 2;
    const depth = (lightSpacePos.z + 1) / 2;

    if (u < 0 || u > 1 || v < 0 || v > 1) {
      return 1.0;
    }

    const x = Math.floor(u * resolution);
    const y = Math.floor(v * resolution);

    const E_x = vsmDepth[Math.min(y, resolution - 1)]?.[Math.min(x, resolution - 1)] ?? 1;
    const E_x2 = vsmDepthSq[Math.min(y, resolution - 1)]?.[Math.min(x, resolution - 1)] ?? 1;

    // Variance = E(x^2) - E(x)^2
    const variance = Math.max(E_x2 - E_x * E_x, minVariance);

    // Chebyshev's inequality
    const d = depth - E_x;
    if (d <= 0) {
      return 1.0;  // Definitely lit
    }

    const pMax = variance / (variance + d * d);
    return Math.max(pMax, depth <= E_x ? 1.0 : 0.0);
  }
}

// ============================================================================
// CASCADED SHADOW MAPS
// ============================================================================

class CascadedShadowMaps {
  /**
   * Calculate cascade split distances
   */
  static calculateSplits(near: number, far: number, cascadeCount: number, lambda: number = 0.5): number[] {
    const splits: number[] = [];

    for (let i = 0; i <= cascadeCount; i++) {
      const ratio = i / cascadeCount;

      // Practical split scheme (mix of logarithmic and uniform)
      const logSplit = near * Math.pow(far / near, ratio);
      const uniformSplit = near + (far - near) * ratio;
      const split = lambda * logSplit + (1 - lambda) * uniformSplit;

      splits.push(split);
    }

    return splits;
  }

  /**
   * Determine which cascade to use for a given depth
   */
  static selectCascade(depth: number, splits: number[]): number {
    for (let i = 0; i < splits.length - 1; i++) {
      if (depth < splits[i + 1]) {
        return i;
      }
    }
    return splits.length - 2;
  }

  /**
   * Generate all cascade shadow maps
   */
  static generate(
    triangles: { v0: Vector3; v1: Vector3; v2: Vector3 }[],
    light: Light,
    settings: ShadowMapSettings,
    cameraFar: number
  ): CascadedShadowMap {
    const cascadeCount = settings.cascadeCount || 4;
    const splits = settings.cascadeSplits || this.calculateSplits(0.1, cameraFar, cascadeCount);
    const cascades: ShadowMap[] = [];

    for (let i = 0; i < cascadeCount; i++) {
      const cascadeNear = splits[i];
      const cascadeFar = splits[i + 1];
      const cascadeRadius = (cascadeFar - cascadeNear) / 2;
      const cascadeCenter = { x: 0, y: 0, z: -(cascadeNear + cascadeFar) / 2 };

      const cascadeSettings: ShadowMapSettings = {
        ...settings,
        nearPlane: 0.1,
        farPlane: cascadeRadius * 4
      };

      const { view, projection, viewProjection } = LightSpaceCalculator.calculateLVP(
        light,
        cascadeCenter,
        cascadeRadius,
        cascadeSettings
      );

      const depthBuffer = ShadowMapGenerator.renderDepth(triangles, viewProjection, settings.resolution);

      cascades.push({
        resolution: settings.resolution,
        depthBuffer,
        lightViewMatrix: view,
        lightProjectionMatrix: projection,
        lightViewProjection: viewProjection,
        bounds: {
          minX: -cascadeRadius, maxX: cascadeRadius,
          minY: -cascadeRadius, maxY: cascadeRadius,
          minZ: cascadeNear, maxZ: cascadeFar
        }
      });
    }

    return {
      cascadeCount,
      cascades,
      splitDistances: splits
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const shadowmappingTool: UnifiedTool = {
  name: 'shadow_mapping',
  description: 'Real-time shadow generation using depth-based shadow mapping. Supports basic shadow maps, PCF soft shadows, Variance Shadow Maps (VSM), and Cascaded Shadow Maps (CSM) for large scenes.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'sample', 'generate_vsm', 'sample_vsm', 'generate_csm', 'calculate_lvp', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      light: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['directional', 'point', 'spot'] },
          position: { type: 'object' },
          direction: { type: 'object' },
          color: { type: 'object' },
          intensity: { type: 'number' },
          innerAngle: { type: 'number' },
          outerAngle: { type: 'number' },
          range: { type: 'number' }
        },
        description: 'Light configuration'
      },
      settings: {
        type: 'object',
        properties: {
          resolution: { type: 'number', description: 'Shadow map resolution (default: 1024)' },
          nearPlane: { type: 'number', description: 'Near plane distance (default: 0.1)' },
          farPlane: { type: 'number', description: 'Far plane distance (default: 100)' },
          bias: { type: 'number', description: 'Depth bias (default: 0.005)' },
          normalBias: { type: 'number', description: 'Normal-based bias (default: 0.02)' },
          softness: { type: 'number', description: 'PCF kernel size (default: 3)' },
          cascadeCount: { type: 'number', description: 'Number of CSM cascades (default: 4)' }
        },
        description: 'Shadow map settings'
      },
      triangles: {
        type: 'array',
        description: 'Scene geometry as array of triangles {v0, v1, v2}'
      },
      worldPosition: {
        type: 'object',
        description: 'World position to test shadow at'
      },
      shadowMap: {
        type: 'array',
        description: 'Existing shadow map for sampling'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeshadowmapping(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, light, settings, triangles, worldPosition, shadowMap } = args;

    // Default settings
    const shadowSettings: ShadowMapSettings = {
      resolution: settings?.resolution ?? 1024,
      nearPlane: settings?.nearPlane ?? 0.1,
      farPlane: settings?.farPlane ?? 100,
      bias: settings?.bias ?? 0.005,
      normalBias: settings?.normalBias ?? 0.02,
      softness: settings?.softness ?? 3,
      cascadeCount: settings?.cascadeCount ?? 4
    };

    // Default light
    const defaultLight: Light = light || {
      type: 'directional',
      position: { x: 10, y: 20, z: 10 },
      direction: { x: -0.5, y: -1, z: -0.5 },
      color: { r: 1, g: 1, b: 1 },
      intensity: 1
    };

    let result: Record<string, unknown>;

    switch (operation) {
      case 'info': {
        result = {
          tool: 'shadow_mapping',
          description: 'Real-time shadow generation using depth-based techniques',
          techniques: {
            basicShadowMap: {
              description: 'Render scene from light perspective, compare depths',
              pros: ['Fast', 'Simple implementation'],
              cons: ['Hard shadow edges', 'Shadow acne']
            },
            pcf: {
              description: 'Percentage Closer Filtering for soft edges',
              pros: ['Soft shadows', 'Reduced aliasing'],
              cons: ['More texture samples', 'Still some banding']
            },
            vsm: {
              description: 'Variance Shadow Maps using statistical moments',
              pros: ['Very soft shadows', 'Hardware filterable'],
              cons: ['Light bleeding in high-contrast areas']
            },
            csm: {
              description: 'Cascaded Shadow Maps for large scenes',
              pros: ['High detail near camera', 'Good for outdoor scenes'],
              cons: ['Multiple shadow maps', 'Cascade transitions visible']
            }
          },
          lightTypes: ['directional', 'point', 'spot'],
          operations: ['generate', 'sample', 'generate_vsm', 'sample_vsm', 'generate_csm', 'calculate_lvp', 'demo', 'info', 'examples']
        };
        break;
      }

      case 'examples': {
        result = {
          examples: [
            {
              name: 'Directional light shadow',
              light: { type: 'directional', direction: { x: -1, y: -1, z: -1 } },
              settings: { resolution: 2048, bias: 0.005 }
            },
            {
              name: 'Soft PCF shadows',
              light: { type: 'directional', direction: { x: 0, y: -1, z: 0 } },
              settings: { resolution: 1024, softness: 5 }
            },
            {
              name: 'Spot light shadow',
              light: { type: 'spot', position: { x: 0, y: 5, z: 0 }, direction: { x: 0, y: -1, z: 0 }, outerAngle: 45 },
              settings: { resolution: 1024 }
            },
            {
              name: 'Cascaded shadows (outdoor)',
              light: { type: 'directional', direction: { x: -0.3, y: -1, z: -0.3 } },
              settings: { cascadeCount: 4, resolution: 2048 }
            }
          ]
        };
        break;
      }

      case 'demo': {
        const scene = ShadowMapGenerator.createDemoScene();
        const sceneCenter = { x: 0, y: 1.5, z: 0 };
        const sceneRadius = 15;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { view: _view, projection: _projection, viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        // Use smaller resolution for demo
        const demoResolution = 32;
        const depthBuffer = ShadowMapGenerator.renderDepth(scene, viewProjection, demoResolution);

        // Test shadow at a few points
        const testPoints = [
          { name: 'center_floor', pos: { x: 0, y: 0.01, z: 0 } },
          { name: 'under_box', pos: { x: 0, y: 0.01, z: 3 } },
          { name: 'beside_box', pos: { x: 5, y: 0.01, z: 0 } }
        ];

        const shadowTests = testPoints.map(({ name, pos }) => {
          const lightSpacePos = MatrixMath.transformPoint(viewProjection, pos);
          const shadow = ShadowSampler.samplePCF(depthBuffer, lightSpacePos, demoResolution, shadowSettings.bias, 3);
          return { name, position: pos, shadow: shadow.toFixed(2), lit: shadow > 0.5 };
        });

        result = {
          operation: 'demo',
          description: 'Shadow mapping demo with ground plane and box',
          light: defaultLight,
          settings: { ...shadowSettings, resolution: demoResolution },
          sceneInfo: {
            triangleCount: scene.length,
            center: sceneCenter,
            radius: sceneRadius
          },
          shadowMapPreview: {
            resolution: demoResolution,
            depthRange: {
              min: Math.min(...depthBuffer.flat()),
              max: Math.max(...depthBuffer.flat().filter(d => d < 1))
            }
          },
          shadowTests,
          message: 'Shadow map generated and sampled at test points'
        };
        break;
      }

      case 'generate': {
        const scene = triangles || ShadowMapGenerator.createDemoScene();
        const sceneCenter = { x: 0, y: 1.5, z: 0 };
        const sceneRadius = 15;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { view: _view, projection: _projection, viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        const resolution = Math.min(shadowSettings.resolution, 64);  // Limit for response
        const depthBuffer = ShadowMapGenerator.renderDepth(scene, viewProjection, resolution);

        result = {
          operation: 'generate',
          light: defaultLight,
          resolution,
          triangleCount: scene.length,
          lightViewProjection: viewProjection,
          depthBuffer: resolution <= 32 ? depthBuffer : 'Depth buffer truncated',
          depthStats: {
            min: Math.min(...depthBuffer.flat()),
            max: Math.max(...depthBuffer.flat().filter(d => d < 1)),
            avgNonFar: depthBuffer.flat().filter(d => d < 1).reduce((a, b) => a + b, 0) /
                       depthBuffer.flat().filter(d => d < 1).length || 0
          }
        };
        break;
      }

      case 'sample': {
        if (!shadowMap || !worldPosition) {
          throw new Error('shadowMap and worldPosition required for sampling');
        }

        const sceneCenter = { x: 0, y: 1.5, z: 0 };
        const sceneRadius = 15;
        const { viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        const lightSpacePos = MatrixMath.transformPoint(viewProjection, worldPosition);
        const resolution = shadowMap.length;

        const hardShadow = ShadowSampler.sample(shadowMap, lightSpacePos, resolution, shadowSettings.bias);
        const pcfShadow = ShadowSampler.samplePCF(shadowMap, lightSpacePos, resolution, shadowSettings.bias, shadowSettings.softness);
        const poissonShadow = ShadowSampler.samplePoissonPCF(shadowMap, lightSpacePos, resolution, shadowSettings.bias, 2);

        result = {
          operation: 'sample',
          worldPosition,
          lightSpacePosition: lightSpacePos,
          shadowResults: {
            hard: hardShadow.toFixed(2),
            pcf: pcfShadow.toFixed(2),
            poisson: poissonShadow.toFixed(2)
          },
          isLit: pcfShadow > 0.5
        };
        break;
      }

      case 'generate_vsm': {
        const scene = triangles || ShadowMapGenerator.createDemoScene();
        const sceneCenter = { x: 0, y: 1.5, z: 0 };
        const sceneRadius = 15;

        const { viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        const resolution = Math.min(shadowSettings.resolution, 32);
        const vsm = VarianceShadowMap.generate(scene, viewProjection, resolution);

        result = {
          operation: 'generate_vsm',
          light: defaultLight,
          resolution,
          triangleCount: scene.length,
          vsmMoments: {
            firstMoment: vsm.depth.length <= 16 ? vsm.depth : 'Truncated',
            secondMoment: vsm.depthSq.length <= 16 ? vsm.depthSq : 'Truncated'
          },
          description: 'VSM stores depth (E[x]) and depth squared (E[x^2]) for Chebyshev inequality'
        };
        break;
      }

      case 'sample_vsm': {
        if (!args.vsmDepth || !args.vsmDepthSq || !worldPosition) {
          throw new Error('vsmDepth, vsmDepthSq, and worldPosition required');
        }

        const sceneCenter = { x: 0, y: 1.5, z: 0 };
        const sceneRadius = 15;
        const { viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        const lightSpacePos = MatrixMath.transformPoint(viewProjection, worldPosition);
        const resolution = args.vsmDepth.length;

        const vsmShadow = VarianceShadowMap.sample(
          args.vsmDepth,
          args.vsmDepthSq,
          lightSpacePos,
          resolution
        );

        result = {
          operation: 'sample_vsm',
          worldPosition,
          lightSpacePosition: lightSpacePos,
          vsmShadow: vsmShadow.toFixed(3),
          isLit: vsmShadow > 0.5,
          description: 'VSM uses Chebyshev inequality for probabilistic shadow testing'
        };
        break;
      }

      case 'generate_csm': {
        const scene = triangles || ShadowMapGenerator.createDemoScene();
        const cameraFar = settings?.cameraFar || 100;

        // Use smaller resolution for response
        const csmSettings = { ...shadowSettings, resolution: Math.min(shadowSettings.resolution, 32) };
        const csm = CascadedShadowMaps.generate(scene, defaultLight, csmSettings, cameraFar);

        result = {
          operation: 'generate_csm',
          light: defaultLight,
          cascadeCount: csm.cascadeCount,
          splitDistances: csm.splitDistances.map(d => d.toFixed(2)),
          cascades: csm.cascades.map((c, i) => ({
            index: i,
            resolution: c.resolution,
            bounds: c.bounds,
            depthRange: {
              min: Math.min(...c.depthBuffer.flat()),
              max: Math.max(...c.depthBuffer.flat().filter(d => d < 1))
            }
          }))
        };
        break;
      }

      case 'calculate_lvp': {
        const sceneCenter = args.sceneCenter || { x: 0, y: 0, z: 0 };
        const sceneRadius = args.sceneRadius || 10;

        const { view, projection, viewProjection } = LightSpaceCalculator.calculateLVP(
          defaultLight,
          sceneCenter,
          sceneRadius,
          shadowSettings
        );

        result = {
          operation: 'calculate_lvp',
          light: defaultLight,
          sceneCenter,
          sceneRadius,
          matrices: {
            view: view.m,
            projection: projection.m,
            viewProjection: viewProjection.m
          }
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${error}`, isError: true };
  }
}

export function isshadowmappingAvailable(): boolean {
  return true;
}
