/**
 * MOTION-BLUR TOOL
 * Cinematic motion blur simulation for still and animated images
 *
 * Implements:
 * - Per-object motion blur from velocity vectors
 * - Camera motion blur (translation, rotation)
 * - Directional blur (linear motion)
 * - Radial/zoom blur (dolly effect)
 * - Rotational blur (pan/spin)
 * - Accumulation buffer simulation
 * - Tile-based blur optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RGBPixel {
  r: number;
  g: number;
  b: number;
}

interface Vector2 {
  x: number;
  y: number;
}

interface MotionBlurSettings {
  samples: number;          // Number of samples along motion path
  shutterAngle: number;     // Shutter angle (0-360 degrees, 180 is standard)
  exposure: number;         // Exposure time multiplier
  maxBlur: number;          // Maximum blur radius in pixels
  tileSize: number;         // Tile size for optimization
  threshold: number;        // Velocity threshold to apply blur
}

interface CameraMotion {
  translation: Vector2;     // Camera translation in pixels
  rotation: number;         // Rotation angle in degrees
  zoom: number;             // Zoom factor (1.0 = no zoom)
  center: Vector2;          // Center of rotation/zoom
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ObjectMotion {
  velocityMap: Vector2[][]; // Per-pixel velocity vectors
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BlurKernel {
  offsets: Vector2[];
  weights: number[];
}

// ============================================================================
// DIRECTIONAL BLUR
// ============================================================================

class DirectionalBlur {
  /**
   * Apply linear directional blur
   */
  static apply(
    image: RGBPixel[][],
    direction: Vector2,
    strength: number,
    samples: number
  ): RGBPixel[][] {
    const height = image.length;
    const width = image[0]?.length || 0;
    const result: RGBPixel[][] = [];

    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len === 0) return image;

    const dx = (direction.x / len) * strength;
    const dy = (direction.y / len) * strength;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        // Sample along motion path
        for (let s = 0; s < samples; s++) {
          const t = (s / (samples - 1)) - 0.5;  // -0.5 to 0.5
          const sampleX = x + dx * t;
          const sampleY = y + dy * t;

          // Bilinear interpolation
          const pixel = this.sampleBilinear(image, sampleX, sampleY, width, height);
          if (pixel) {
            // Weight samples (center has more weight)
            const weight = 1 - Math.abs(t) * 0.5;
            r += pixel.r * weight;
            g += pixel.g * weight;
            b += pixel.b * weight;
            totalWeight += weight;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : image[y][x];
      }
    }

    return result;
  }

  /**
   * Bilinear sampling helper
   */
  static sampleBilinear(
    image: RGBPixel[][],
    x: number,
    y: number,
    width: number,
    height: number
  ): RGBPixel | null {
    if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
      // Clamp to edges
      const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
      return image[cy][cx];
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const fx = x - x0;
    const fy = y - y0;

    const p00 = image[y0][x0];
    const p10 = image[y0][x1];
    const p01 = image[y1][x0];
    const p11 = image[y1][x1];

    return {
      r: p00.r * (1 - fx) * (1 - fy) + p10.r * fx * (1 - fy) + p01.r * (1 - fx) * fy + p11.r * fx * fy,
      g: p00.g * (1 - fx) * (1 - fy) + p10.g * fx * (1 - fy) + p01.g * (1 - fx) * fy + p11.g * fx * fy,
      b: p00.b * (1 - fx) * (1 - fy) + p10.b * fx * (1 - fy) + p01.b * (1 - fx) * fy + p11.b * fx * fy
    };
  }
}

// ============================================================================
// RADIAL/ZOOM BLUR
// ============================================================================

class RadialBlur {
  /**
   * Apply zoom/dolly blur (radial from center)
   */
  static applyZoom(
    image: RGBPixel[][],
    center: Vector2,
    strength: number,
    samples: number
  ): RGBPixel[][] {
    const height = image.length;
    const width = image[0]?.length || 0;
    const result: RGBPixel[][] = [];

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        // Direction from center
        const dx = x - center.x;
        const dy = y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Blur strength increases with distance from center
        const blurAmount = (dist / Math.max(width, height)) * strength;

        for (let s = 0; s < samples; s++) {
          const t = (s / (samples - 1)) - 0.5;
          const scale = 1 + t * blurAmount;

          const sampleX = center.x + dx * scale;
          const sampleY = center.y + dy * scale;

          const pixel = DirectionalBlur.sampleBilinear(image, sampleX, sampleY, width, height);
          if (pixel) {
            const weight = 1 - Math.abs(t) * 0.3;
            r += pixel.r * weight;
            g += pixel.g * weight;
            b += pixel.b * weight;
            totalWeight += weight;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : image[y][x];
      }
    }

    return result;
  }

  /**
   * Apply spin/rotational blur
   */
  static applySpin(
    image: RGBPixel[][],
    center: Vector2,
    angleDegrees: number,
    samples: number
  ): RGBPixel[][] {
    const height = image.length;
    const width = image[0]?.length || 0;
    const result: RGBPixel[][] = [];

    const angleRad = (angleDegrees * Math.PI) / 180;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        const dx = x - center.x;
        const dy = y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Rotation amount increases with distance from center
        const rotationScale = dist / Math.max(width, height);

        for (let s = 0; s < samples; s++) {
          const t = (s / (samples - 1)) - 0.5;
          const rotation = t * angleRad * rotationScale;

          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);

          const sampleX = center.x + dx * cos - dy * sin;
          const sampleY = center.y + dx * sin + dy * cos;

          const pixel = DirectionalBlur.sampleBilinear(image, sampleX, sampleY, width, height);
          if (pixel) {
            const weight = 1 - Math.abs(t) * 0.3;
            r += pixel.r * weight;
            g += pixel.g * weight;
            b += pixel.b * weight;
            totalWeight += weight;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : image[y][x];
      }
    }

    return result;
  }
}

// ============================================================================
// VELOCITY-BASED MOTION BLUR
// ============================================================================

class VelocityBlur {
  /**
   * Apply per-pixel motion blur using velocity map
   */
  static apply(
    image: RGBPixel[][],
    velocityMap: Vector2[][],
    settings: MotionBlurSettings
  ): RGBPixel[][] {
    const height = image.length;
    const width = image[0]?.length || 0;
    const result: RGBPixel[][] = [];

    // Shutter angle factor (180 = half rotation = standard)
    const shutterFactor = settings.shutterAngle / 360;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        const velocity = velocityMap[y]?.[x] || { x: 0, y: 0 };
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

        // Skip if velocity below threshold
        if (speed < settings.threshold) {
          result[y][x] = image[y][x];
          continue;
        }

        // Clamp velocity magnitude
        const clampedSpeed = Math.min(speed, settings.maxBlur);
        const scale = speed > 0 ? (clampedSpeed / speed) * shutterFactor * settings.exposure : 0;

        const vx = velocity.x * scale;
        const vy = velocity.y * scale;

        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        for (let s = 0; s < settings.samples; s++) {
          const t = (s / (settings.samples - 1)) - 0.5;

          const sampleX = x + vx * t;
          const sampleY = y + vy * t;

          const pixel = DirectionalBlur.sampleBilinear(image, sampleX, sampleY, width, height);
          if (pixel) {
            // Gaussian-like weight distribution
            const weight = Math.exp(-t * t * 4);
            r += pixel.r * weight;
            g += pixel.g * weight;
            b += pixel.b * weight;
            totalWeight += weight;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : image[y][x];
      }
    }

    return result;
  }

  /**
   * Generate velocity map from two frames (optical flow approximation)
   */
  static generateVelocityMap(
    frame1: RGBPixel[][],
    frame2: RGBPixel[][],
    windowSize: number = 5
  ): Vector2[][] {
    const height = frame1.length;
    const width = frame1[0]?.length || 0;
    const velocityMap: Vector2[][] = [];

    const getLuminance = (p: RGBPixel) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
    const half = Math.floor(windowSize / 2);

    // Simple block matching (not true optical flow, but approximation)
    for (let y = 0; y < height; y++) {
      velocityMap[y] = [];
      for (let x = 0; x < width; x++) {
        let bestDx = 0, bestDy = 0;
        let bestScore = Infinity;

        // Search in local neighborhood
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            let score = 0;

            // Compare windows
            for (let wy = -1; wy <= 1; wy++) {
              for (let wx = -1; wx <= 1; wx++) {
                const y1 = Math.max(0, Math.min(height - 1, y + wy));
                const x1 = Math.max(0, Math.min(width - 1, x + wx));
                const y2 = Math.max(0, Math.min(height - 1, y + wy + dy));
                const x2 = Math.max(0, Math.min(width - 1, x + wx + dx));

                const l1 = getLuminance(frame1[y1][x1]);
                const l2 = getLuminance(frame2[y2][x2]);
                score += (l1 - l2) * (l1 - l2);
              }
            }

            if (score < bestScore) {
              bestScore = score;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        velocityMap[y][x] = { x: bestDx, y: bestDy };
      }
    }

    return velocityMap;
  }
}

// ============================================================================
// CAMERA MOTION BLUR
// ============================================================================

class CameraMotionBlur {
  /**
   * Apply combined camera motion blur
   */
  static apply(
    image: RGBPixel[][],
    motion: CameraMotion,
    samples: number
  ): RGBPixel[][] {
    const height = image.length;
    const width = image[0]?.length || 0;
    const result: RGBPixel[][] = [];

    const angleRad = (motion.rotation * Math.PI) / 180;

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        for (let s = 0; s < samples; s++) {
          const t = (s / (samples - 1)) - 0.5;

          // Apply inverse camera transformation
          // Translation
          let sampleX = x - motion.translation.x * t;
          let sampleY = y - motion.translation.y * t;

          // Rotation around center
          const rotation = -angleRad * t;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          const dx = sampleX - motion.center.x;
          const dy = sampleY - motion.center.y;
          sampleX = motion.center.x + dx * cos - dy * sin;
          sampleY = motion.center.y + dx * sin + dy * cos;

          // Zoom
          const zoomFactor = 1 / (1 + (motion.zoom - 1) * t);
          sampleX = motion.center.x + (sampleX - motion.center.x) * zoomFactor;
          sampleY = motion.center.y + (sampleY - motion.center.y) * zoomFactor;

          const pixel = DirectionalBlur.sampleBilinear(image, sampleX, sampleY, width, height);
          if (pixel) {
            const weight = Math.exp(-t * t * 2);
            r += pixel.r * weight;
            g += pixel.g * weight;
            b += pixel.b * weight;
            totalWeight += weight;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : image[y][x];
      }
    }

    return result;
  }
}

// ============================================================================
// ACCUMULATION BUFFER
// ============================================================================

class AccumulationBuffer {
  /**
   * Simulate motion blur via accumulation of sub-frames
   */
  static accumulate(
    frames: RGBPixel[][][],
    weights?: number[]
  ): RGBPixel[][] {
    if (frames.length === 0) {
      return [];
    }

    const height = frames[0].length;
    const width = frames[0][0]?.length || 0;
    const result: RGBPixel[][] = [];

    // Default equal weights if not provided
    const frameWeights = weights || frames.map(() => 1 / frames.length);

    for (let y = 0; y < height; y++) {
      result[y] = [];
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        let totalWeight = 0;

        for (let f = 0; f < frames.length; f++) {
          const pixel = frames[f][y]?.[x];
          if (pixel) {
            const w = frameWeights[f];
            r += pixel.r * w;
            g += pixel.g * w;
            b += pixel.b * w;
            totalWeight += w;
          }
        }

        result[y][x] = totalWeight > 0
          ? { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight }
          : { r: 0, g: 0, b: 0 };
      }
    }

    return result;
  }

  /**
   * Generate sub-frames with interpolated motion
   */
  static generateSubFrames(
    startFrame: RGBPixel[][],
    endFrame: RGBPixel[][],
    subFrameCount: number
  ): RGBPixel[][][] {
    const height = startFrame.length;
    const width = startFrame[0]?.length || 0;
    const frames: RGBPixel[][][] = [];

    for (let f = 0; f < subFrameCount; f++) {
      const t = f / (subFrameCount - 1);
      const frame: RGBPixel[][] = [];

      for (let y = 0; y < height; y++) {
        frame[y] = [];
        for (let x = 0; x < width; x++) {
          const p1 = startFrame[y][x];
          const p2 = endFrame[y][x];

          // Linear interpolation
          frame[y][x] = {
            r: p1.r * (1 - t) + p2.r * t,
            g: p1.g * (1 - t) + p2.g * t,
            b: p1.b * (1 - t) + p2.b * t
          };
        }
      }

      frames.push(frame);
    }

    return frames;
  }
}

// ============================================================================
// TILE-BASED OPTIMIZATION
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TileBasedBlur {
  /**
   * Compute maximum velocity per tile for optimization
   */
  static computeTileMaxVelocity(
    velocityMap: Vector2[][],
    tileSize: number
  ): { velocity: Vector2; maxSpeed: number }[][] {
    const height = velocityMap.length;
    const width = velocityMap[0]?.length || 0;
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    const tileVelocities: { velocity: Vector2; maxSpeed: number }[][] = [];

    for (let ty = 0; ty < tilesY; ty++) {
      tileVelocities[ty] = [];
      for (let tx = 0; tx < tilesX; tx++) {
        let maxSpeed = 0;
        let maxVelocity: Vector2 = { x: 0, y: 0 };

        // Find max velocity in tile
        for (let py = 0; py < tileSize; py++) {
          for (let px = 0; px < tileSize; px++) {
            const y = ty * tileSize + py;
            const x = tx * tileSize + px;

            if (y < height && x < width) {
              const v = velocityMap[y][x];
              const speed = Math.sqrt(v.x * v.x + v.y * v.y);

              if (speed > maxSpeed) {
                maxSpeed = speed;
                maxVelocity = v;
              }
            }
          }
        }

        tileVelocities[ty][tx] = { velocity: maxVelocity, maxSpeed };
      }
    }

    return tileVelocities;
  }

  /**
   * Check if a tile needs neighbor contribution
   */
  static getTileNeighborInfluence(
    tileVelocities: { velocity: Vector2; maxSpeed: number }[][],
    tx: number,
    ty: number,
    tileSize: number
  ): Vector2[] {
    const neighbors: Vector2[] = [];
    const maxTileY = tileVelocities.length - 1;
    const maxTileX = tileVelocities[0]?.length - 1 || 0;

    // Check 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = tx + dx;
        const ny = ty + dy;

        if (nx >= 0 && nx <= maxTileX && ny >= 0 && ny <= maxTileY) {
          const neighborTile = tileVelocities[ny][nx];

          // Check if neighbor's blur could reach this tile
          if (neighborTile.maxSpeed > tileSize * 0.5) {
            neighbors.push(neighborTile.velocity);
          }
        }
      }
    }

    return neighbors;
  }
}

// ============================================================================
// MOTION BLUR PROCESSOR
// ============================================================================

class MotionBlurProcessor {
  /**
   * Create demo image with moving objects
   */
  static createDemoImage(): RGBPixel[][] {
    const width = 32;
    const height = 32;
    const image: RGBPixel[][] = [];

    for (let y = 0; y < height; y++) {
      image[y] = [];
      for (let x = 0; x < width; x++) {
        // Background gradient
        image[y][x] = {
          r: 0.2 + y / height * 0.1,
          g: 0.2 + x / width * 0.1,
          b: 0.3
        };

        // Moving ball (red circle)
        const ballCx = 16, ballCy = 16, ballR = 4;
        const dist = Math.sqrt((x - ballCx) ** 2 + (y - ballCy) ** 2);
        if (dist < ballR) {
          image[y][x] = { r: 0.9, g: 0.2, b: 0.2 };
        }

        // Vertical stripe
        if (x >= 8 && x <= 10) {
          image[y][x] = { r: 0.2, g: 0.8, b: 0.2 };
        }
      }
    }

    return image;
  }

  /**
   * Create demo velocity map
   */
  static createDemoVelocityMap(): Vector2[][] {
    const width = 32;
    const height = 32;
    const velocityMap: Vector2[][] = [];

    for (let y = 0; y < height; y++) {
      velocityMap[y] = [];
      for (let x = 0; x < width; x++) {
        // Ball moves right
        const ballCx = 16, ballCy = 16, ballR = 5;
        const dist = Math.sqrt((x - ballCx) ** 2 + (y - ballCy) ** 2);
        if (dist < ballR) {
          velocityMap[y][x] = { x: 8, y: 0 };  // Moving right
        }
        // Stripe moves down
        else if (x >= 7 && x <= 11) {
          velocityMap[y][x] = { x: 0, y: 6 };  // Moving down
        }
        // Background static
        else {
          velocityMap[y][x] = { x: 0, y: 0 };
        }
      }
    }

    return velocityMap;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const motionblurTool: UnifiedTool = {
  name: 'motion_blur',
  description: 'Cinematic motion blur simulation supporting directional blur, radial/zoom blur, rotational blur, per-pixel velocity-based blur, camera motion blur, and accumulation buffer techniques.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['directional', 'radial_zoom', 'radial_spin', 'velocity', 'camera', 'accumulate', 'demo', 'info', 'examples'],
        description: 'Type of motion blur to apply'
      },
      image: {
        type: 'array',
        description: 'Input image as 2D array of {r, g, b} pixels'
      },
      direction: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        description: 'Blur direction for directional blur'
      },
      strength: {
        type: 'number',
        description: 'Blur strength/amount in pixels'
      },
      samples: {
        type: 'number',
        description: 'Number of samples for blur quality (default: 16)'
      },
      center: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        description: 'Center point for radial blur effects'
      },
      angle: {
        type: 'number',
        description: 'Rotation angle in degrees for spin blur'
      },
      velocityMap: {
        type: 'array',
        description: 'Per-pixel velocity vectors for velocity blur'
      },
      cameraMotion: {
        type: 'object',
        properties: {
          translation: { type: 'object' },
          rotation: { type: 'number' },
          zoom: { type: 'number' },
          center: { type: 'object' }
        },
        description: 'Camera motion parameters'
      },
      settings: {
        type: 'object',
        properties: {
          samples: { type: 'number', description: 'Number of samples (default: 16)' },
          shutterAngle: { type: 'number', description: 'Shutter angle 0-360 (default: 180)' },
          exposure: { type: 'number', description: 'Exposure multiplier (default: 1)' },
          maxBlur: { type: 'number', description: 'Maximum blur radius (default: 50)' },
          threshold: { type: 'number', description: 'Velocity threshold (default: 0.5)' }
        },
        description: 'Motion blur settings'
      },
      frames: {
        type: 'array',
        description: 'Array of frames for accumulation buffer'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executemotionblur(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, direction, strength, samples, center, angle, velocityMap, cameraMotion, settings, frames } = args;

    // Default settings
    const blurSettings: MotionBlurSettings = {
      samples: settings?.samples ?? 16,
      shutterAngle: settings?.shutterAngle ?? 180,
      exposure: settings?.exposure ?? 1,
      maxBlur: settings?.maxBlur ?? 50,
      tileSize: settings?.tileSize ?? 32,
      threshold: settings?.threshold ?? 0.5
    };

    const sampleCount = samples || blurSettings.samples;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'info': {
        result = {
          tool: 'motion_blur',
          description: 'Cinematic motion blur simulation',
          techniques: {
            directional: {
              description: 'Linear blur in a single direction',
              useCase: 'Fast-moving objects in one direction'
            },
            radialZoom: {
              description: 'Zoom/dolly blur radiating from center',
              useCase: 'Camera zoom effects, warp speed'
            },
            radialSpin: {
              description: 'Rotational blur around center point',
              useCase: 'Spinning objects, camera rotation'
            },
            velocity: {
              description: 'Per-pixel blur using velocity vectors',
              useCase: 'Complex scenes with multiple moving objects'
            },
            camera: {
              description: 'Combined camera motion (translation, rotation, zoom)',
              useCase: 'Handheld camera shake, dolly shots'
            },
            accumulation: {
              description: 'Sub-frame accumulation for accurate blur',
              useCase: 'High-quality offline rendering'
            }
          },
          parameters: {
            shutterAngle: 'Film shutter angle (180 = standard, 360 = maximum blur)',
            samples: 'More samples = smoother blur, slower processing',
            maxBlur: 'Clamps maximum blur length to prevent artifacts'
          },
          operations: ['directional', 'radial_zoom', 'radial_spin', 'velocity', 'camera', 'accumulate', 'demo', 'info', 'examples']
        };
        break;
      }

      case 'examples': {
        result = {
          examples: [
            {
              name: 'Horizontal motion blur',
              operation: 'directional',
              direction: { x: 20, y: 0 },
              strength: 15,
              samples: 16
            },
            {
              name: 'Zoom blur',
              operation: 'radial_zoom',
              center: { x: 512, y: 384 },
              strength: 0.3,
              samples: 24
            },
            {
              name: 'Spin blur',
              operation: 'radial_spin',
              center: { x: 512, y: 384 },
              angle: 15,
              samples: 24
            },
            {
              name: 'Camera shake',
              operation: 'camera',
              cameraMotion: {
                translation: { x: 5, y: 3 },
                rotation: 0.5,
                zoom: 1.02,
                center: { x: 512, y: 384 }
              },
              samples: 16
            },
            {
              name: 'Velocity-based blur',
              operation: 'velocity',
              settings: { shutterAngle: 180, samples: 16, maxBlur: 30 }
            }
          ]
        };
        break;
      }

      case 'demo': {
        const demoImage = MotionBlurProcessor.createDemoImage();
        const demoVelocity = MotionBlurProcessor.createDemoVelocityMap();

        // Apply velocity blur to demo
        const blurred = VelocityBlur.apply(demoImage, demoVelocity, blurSettings);

        result = {
          operation: 'demo',
          description: 'Motion blur demo with moving red ball and vertical stripe',
          imageSize: { width: 32, height: 32 },
          settings: blurSettings,
          objects: [
            { type: 'ball', position: { x: 16, y: 16 }, velocity: { x: 8, y: 0 }, color: 'red' },
            { type: 'stripe', position: { x: 8 }, velocity: { x: 0, y: 6 }, color: 'green' }
          ],
          sampleOutput: {
            original: {
              center: demoImage[16]?.[16],
              ball: demoImage[16]?.[16],
              stripe: demoImage[16]?.[9]
            },
            blurred: {
              center: blurred[16]?.[16],
              ballTrail: blurred[16]?.[20],  // Where blur extends
              stripeTrail: blurred[19]?.[9]  // Where blur extends
            }
          },
          message: 'Motion blur applied - ball blurs horizontally, stripe blurs vertically'
        };
        break;
      }

      case 'directional': {
        if (!image) {
          throw new Error('Image required for directional blur');
        }

        const dir = direction || { x: 10, y: 0 };
        const str = strength || 10;

        const blurred = DirectionalBlur.apply(image, dir, str, sampleCount);

        result = {
          operation: 'directional',
          direction: dir,
          strength: str,
          samples: sampleCount,
          inputSize: { width: image[0]?.length || 0, height: image.length },
          output: blurred.length <= 16 ? blurred : 'Output truncated'
        };
        break;
      }

      case 'radial_zoom': {
        if (!image) {
          throw new Error('Image required for radial zoom blur');
        }

        const height = image.length;
        const width = image[0]?.length || 0;
        const c = center || { x: width / 2, y: height / 2 };
        const str = strength || 0.2;

        const blurred = RadialBlur.applyZoom(image, c, str, sampleCount);

        result = {
          operation: 'radial_zoom',
          center: c,
          strength: str,
          samples: sampleCount,
          inputSize: { width, height },
          output: blurred.length <= 16 ? blurred : 'Output truncated'
        };
        break;
      }

      case 'radial_spin': {
        if (!image) {
          throw new Error('Image required for spin blur');
        }

        const height = image.length;
        const width = image[0]?.length || 0;
        const c = center || { x: width / 2, y: height / 2 };
        const ang = angle || 10;

        const blurred = RadialBlur.applySpin(image, c, ang, sampleCount);

        result = {
          operation: 'radial_spin',
          center: c,
          angle: ang,
          samples: sampleCount,
          inputSize: { width, height },
          output: blurred.length <= 16 ? blurred : 'Output truncated'
        };
        break;
      }

      case 'velocity': {
        if (!image) {
          throw new Error('Image required for velocity blur');
        }

        const velMap = velocityMap || MotionBlurProcessor.createDemoVelocityMap();
        const blurred = VelocityBlur.apply(image, velMap, blurSettings);

        result = {
          operation: 'velocity',
          settings: blurSettings,
          inputSize: { width: image[0]?.length || 0, height: image.length },
          velocityMapProvided: !!velocityMap,
          output: blurred.length <= 16 ? blurred : 'Output truncated'
        };
        break;
      }

      case 'camera': {
        if (!image) {
          throw new Error('Image required for camera motion blur');
        }

        const height = image.length;
        const width = image[0]?.length || 0;

        const motion: CameraMotion = cameraMotion || {
          translation: { x: 5, y: 2 },
          rotation: 1,
          zoom: 1.02,
          center: { x: width / 2, y: height / 2 }
        };

        const blurred = CameraMotionBlur.apply(image, motion, sampleCount);

        result = {
          operation: 'camera',
          cameraMotion: motion,
          samples: sampleCount,
          inputSize: { width, height },
          output: blurred.length <= 16 ? blurred : 'Output truncated'
        };
        break;
      }

      case 'accumulate': {
        if (!frames || !Array.isArray(frames) || frames.length === 0) {
          throw new Error('Frames array required for accumulation');
        }

        const accumulated = AccumulationBuffer.accumulate(frames);

        result = {
          operation: 'accumulate',
          frameCount: frames.length,
          inputSize: { width: frames[0][0]?.length || 0, height: frames[0].length },
          output: accumulated.length <= 16 ? accumulated : 'Output truncated',
          description: 'Frames accumulated with equal weighting'
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

export function ismotionblurAvailable(): boolean {
  return true;
}
