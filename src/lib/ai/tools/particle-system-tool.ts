/**
 * PARTICLE SYSTEM TOOL
 *
 * Physics-based particle simulation and visualization.
 * Create fire, smoke, explosions, rain, snow, and custom effects.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Vector2 {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

interface EmitterConfig {
  x: number;
  y: number;
  rate: number;           // Particles per frame
  spread: number;         // Emission angle spread in degrees
  direction: number;      // Base direction in degrees
  speed: { min: number; max: number };
  life: { min: number; max: number };
  size: { min: number; max: number };
  gravity: Vector2;
  friction: number;
  colors: string[];
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

class ParticleSystem {
  particles: Particle[] = [];
  config: EmitterConfig;

  constructor(config: Partial<EmitterConfig> = {}) {
    this.config = {
      x: 40,
      y: 20,
      rate: 5,
      spread: 30,
      direction: -90, // Up
      speed: { min: 1, max: 3 },
      life: { min: 10, max: 30 },
      size: { min: 1, max: 3 },
      gravity: { x: 0, y: 0.1 },
      friction: 0.98,
      colors: ['█', '▓', '▒', '░'],
      ...config,
    };
  }

  random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  emit(): void {
    for (let i = 0; i < this.config.rate; i++) {
      const angle = (this.config.direction + this.random(-this.config.spread, this.config.spread)) * Math.PI / 180;
      const speed = this.random(this.config.speed.min, this.config.speed.max);

      this.particles.push({
        x: this.config.x,
        y: this.config.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: this.random(this.config.life.min, this.config.life.max),
        maxLife: this.random(this.config.life.min, this.config.life.max),
        size: this.random(this.config.size.min, this.config.size.max),
        color: this.config.colors[Math.floor(Math.random() * this.config.colors.length)],
        alpha: 1,
      });
    }
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Apply physics
      p.vx += this.config.gravity.x;
      p.vy += this.config.gravity.y;
      p.vx *= this.config.friction;
      p.vy *= this.config.friction;

      p.x += p.vx;
      p.y += p.vy;

      // Age particle
      p.life--;
      p.alpha = p.life / p.maxLife;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  simulate(frames: number): Particle[][] {
    const history: Particle[][] = [];

    for (let f = 0; f < frames; f++) {
      this.emit();
      this.update();
      history.push([...this.particles]);
    }

    return history;
  }

  render(width: number, height: number): string {
    const canvas: string[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ' ')
    );

    for (const p of this.particles) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);

      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Use different characters based on alpha
        const charIndex = Math.floor((1 - p.alpha) * (this.config.colors.length - 1));
        canvas[y][x] = this.config.colors[charIndex];
      }
    }

    return canvas.map(row => row.join('')).join('\n');
  }
}

// ============================================================================
// PRESET EFFECTS
// ============================================================================

const PRESETS: Record<string, Partial<EmitterConfig>> = {
  fire: {
    direction: -90,
    spread: 20,
    speed: { min: 0.5, max: 2 },
    life: { min: 15, max: 40 },
    gravity: { x: 0, y: -0.05 },
    friction: 0.99,
    colors: ['█', '▓', '▒', '░', '·'],
  },
  smoke: {
    direction: -90,
    spread: 40,
    speed: { min: 0.2, max: 0.8 },
    life: { min: 30, max: 60 },
    gravity: { x: 0, y: -0.02 },
    friction: 0.995,
    colors: ['█', '▓', '▒', '░'],
  },
  explosion: {
    spread: 180,
    speed: { min: 2, max: 5 },
    life: { min: 10, max: 25 },
    gravity: { x: 0, y: 0.15 },
    friction: 0.95,
    rate: 50,
    colors: ['*', '✱', '✲', '+', '·'],
  },
  rain: {
    direction: 100,
    spread: 5,
    speed: { min: 1, max: 2 },
    life: { min: 20, max: 30 },
    gravity: { x: 0, y: 0.1 },
    friction: 1,
    colors: ['|', '│', '¦'],
  },
  snow: {
    direction: 90,
    spread: 30,
    speed: { min: 0.3, max: 0.8 },
    life: { min: 40, max: 80 },
    gravity: { x: 0, y: 0.02 },
    friction: 0.995,
    colors: ['*', '❄', '·', '°'],
  },
  confetti: {
    direction: -90,
    spread: 60,
    speed: { min: 2, max: 4 },
    life: { min: 30, max: 50 },
    gravity: { x: 0, y: 0.1 },
    friction: 0.98,
    colors: ['■', '●', '◆', '▲', '★'],
  },
  sparks: {
    spread: 45,
    speed: { min: 2, max: 4 },
    life: { min: 5, max: 15 },
    gravity: { x: 0, y: 0.2 },
    friction: 0.95,
    colors: ['·', '∙', '*', '✧'],
  },
  fountain: {
    direction: -90,
    spread: 15,
    speed: { min: 2, max: 3 },
    life: { min: 30, max: 50 },
    gravity: { x: 0, y: 0.1 },
    friction: 0.99,
    colors: ['○', '◌', '·'],
  },
  bubbles: {
    direction: -90,
    spread: 30,
    speed: { min: 0.5, max: 1.5 },
    life: { min: 40, max: 60 },
    gravity: { x: 0, y: -0.03 },
    friction: 0.99,
    colors: ['○', '◯', '◌', '°'],
  },
  stars: {
    spread: 180,
    speed: { min: 0.5, max: 2 },
    life: { min: 20, max: 40 },
    gravity: { x: 0, y: 0 },
    friction: 0.99,
    colors: ['★', '☆', '✦', '✧', '·'],
  },
};

// ============================================================================
// PHYSICS SIMULATION
// ============================================================================

interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
}

function simulateGravity(bodies: PhysicsBody[], G: number = 0.1): void {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) continue;

      const force = G * bodies[i].mass * bodies[j].mass / (dist * dist);
      const fx = force * dx / dist;
      const fy = force * dy / dist;

      bodies[i].vx += fx / bodies[i].mass;
      bodies[i].vy += fy / bodies[i].mass;
      bodies[j].vx -= fx / bodies[j].mass;
      bodies[j].vy -= fy / bodies[j].mass;
    }
  }

  for (const body of bodies) {
    body.x += body.vx;
    body.y += body.vy;
  }
}

function renderBodies(bodies: PhysicsBody[], width: number, height: number): string {
  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  for (const body of bodies) {
    const x = Math.round(body.x);
    const y = Math.round(body.y);
    const symbol = body.mass > 10 ? '●' : body.mass > 5 ? '◉' : '○';

    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = symbol;
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

// ============================================================================
// ATTRACTOR FIELDS
// ============================================================================

function attractorField(
  width: number,
  height: number,
  attractors: { x: number; y: number; strength: number }[]
): string {
  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  const arrows = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 3) {
      let fx = 0, fy = 0;

      for (const a of attractors) {
        const dx = a.x - x;
        const dy = a.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
        fx += a.strength * dx / (dist * dist);
        fy += a.strength * dy / (dist * dist);
      }

      const angle = Math.atan2(fy, fx);
      const idx = Math.round(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
      canvas[y][x] = arrows[idx];
    }
  }

  // Draw attractors
  for (const a of attractors) {
    const ax = Math.round(a.x);
    const ay = Math.round(a.y);
    if (ax >= 0 && ax < width && ay >= 0 && ay < height) {
      canvas[ay][ax] = a.strength > 0 ? '◉' : '◎';
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const particleSystemTool: UnifiedTool = {
  name: 'particle_system',
  description: `Physics-based particle simulation and visualization.

Operations:
- simulate: Run particle simulation and show frames
- preset: Use preset effect (fire, smoke, explosion, rain, snow, confetti, sparks, fountain, bubbles, stars)
- custom: Create custom particle effect
- nbody: N-body gravitational simulation
- field: Visualize attractor/repeller field
- list_presets: List available presets

Features:
- Physics: gravity, friction, velocity
- Lifecycle: spawn, age, fade, die
- ASCII visualization of particle motion`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'preset', 'custom', 'nbody', 'field', 'list_presets'],
        description: 'Type of simulation',
      },
      preset_name: { type: 'string', description: 'Preset effect name' },
      frames: { type: 'number', description: 'Number of frames to simulate' },
      width: { type: 'number', description: 'Canvas width' },
      height: { type: 'number', description: 'Canvas height' },
      // Emitter parameters
      x: { type: 'number', description: 'Emitter X position' },
      y: { type: 'number', description: 'Emitter Y position' },
      rate: { type: 'number', description: 'Particles per frame' },
      direction: { type: 'number', description: 'Emission direction in degrees' },
      spread: { type: 'number', description: 'Spread angle in degrees' },
      speed_min: { type: 'number', description: 'Minimum particle speed' },
      speed_max: { type: 'number', description: 'Maximum particle speed' },
      gravity_x: { type: 'number', description: 'Gravity X component' },
      gravity_y: { type: 'number', description: 'Gravity Y component' },
      friction: { type: 'number', description: 'Velocity friction (0-1)' },
      // N-body parameters
      bodies: { type: 'string', description: 'Bodies as JSON array [{x,y,vx,vy,mass}]' },
      // Field parameters
      attractors: { type: 'string', description: 'Attractors as JSON array [{x,y,strength}]' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeParticleSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 60, height = 25 } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'simulate':
      case 'preset':
      case 'custom': {
        const { preset_name = 'fire', frames = 20 } = args;
        let config: Partial<EmitterConfig> = {};

        if (operation === 'preset' || operation === 'simulate') {
          const presetConfig = PRESETS[preset_name];
          if (!presetConfig) {
            throw new Error(`Unknown preset: ${preset_name}. Use list_presets to see available options.`);
          }
          config = { ...presetConfig };
        }

        // Apply custom parameters
        if (args.x !== undefined) config.x = args.x;
        if (args.y !== undefined) config.y = args.y;
        else config.y = height - 5;
        if (args.rate !== undefined) config.rate = args.rate;
        if (args.direction !== undefined) config.direction = args.direction;
        if (args.spread !== undefined) config.spread = args.spread;
        if (args.speed_min !== undefined || args.speed_max !== undefined) {
          config.speed = {
            min: args.speed_min ?? 1,
            max: args.speed_max ?? 3,
          };
        }
        if (args.gravity_x !== undefined || args.gravity_y !== undefined) {
          config.gravity = {
            x: args.gravity_x ?? 0,
            y: args.gravity_y ?? 0.1,
          };
        }
        if (args.friction !== undefined) config.friction = args.friction;

        // Set default position if not specified
        if (config.x === undefined) config.x = width / 2;

        const system = new ParticleSystem(config);

        // Simulate
        const frameResults: string[] = [];
        for (let f = 0; f < Math.min(frames, 5); f++) {
          for (let s = 0; s < 4; s++) { // 4 sub-steps per frame shown
            system.emit();
            system.update();
          }
          frameResults.push(`Frame ${f + 1}:\n${system.render(width, height)}`);
        }

        // Final state
        for (let f = 0; f < frames - 5; f++) {
          system.emit();
          system.update();
        }

        result = {
          operation,
          preset: preset_name,
          frames_simulated: frames,
          particle_count: system.particles.length,
          config: {
            position: { x: config.x, y: config.y },
            direction: config.direction,
            spread: config.spread,
            speed: config.speed,
            gravity: config.gravity,
          },
          preview: frameResults.join('\n\n'),
          final_state: system.render(width, height),
        };
        break;
      }

      case 'nbody': {
        const { frames = 50 } = args;
        const bodiesStr = args.bodies || '[{"x":30,"y":15,"vx":0,"vy":0.5,"mass":20},{"x":40,"y":15,"vx":0,"vy":-0.5,"mass":20}]';
        const bodies: PhysicsBody[] = JSON.parse(bodiesStr).map((b: PhysicsBody) => ({
          ...b,
          radius: 1,
        }));

        const snapshots: string[] = [];
        for (let f = 0; f < frames; f++) {
          if (f % 10 === 0) {
            snapshots.push(`Step ${f}:\n${renderBodies(bodies, width, height)}`);
          }
          simulateGravity(bodies, 0.5);
        }

        result = {
          operation: 'nbody',
          frames_simulated: frames,
          body_count: bodies.length,
          snapshots: snapshots.slice(0, 3).join('\n\n'),
          final_state: renderBodies(bodies, width, height),
          final_positions: bodies.map((b, i) => ({
            body: i,
            x: Math.round(b.x * 10) / 10,
            y: Math.round(b.y * 10) / 10,
            vx: Math.round(b.vx * 100) / 100,
            vy: Math.round(b.vy * 100) / 100,
          })),
        };
        break;
      }

      case 'field': {
        const attractorsStr = args.attractors || '[{"x":30,"y":12,"strength":10},{"x":50,"y":12,"strength":-5}]';
        const attractors = JSON.parse(attractorsStr);

        const field = attractorField(width, height, attractors);

        result = {
          operation: 'field',
          attractors: attractors.map((a: { x: number; y: number; strength: number }) => ({
            position: { x: a.x, y: a.y },
            type: a.strength > 0 ? 'attractor' : 'repeller',
            strength: Math.abs(a.strength),
          })),
          visualization: field,
          legend: '◉ = attractor, ◎ = repeller, arrows show force direction',
        };
        break;
      }

      case 'list_presets': {
        result = {
          operation: 'list_presets',
          presets: Object.entries(PRESETS).map(([name, config]) => ({
            name,
            direction: config.direction,
            gravity: config.gravity,
            colors: config.colors,
          })),
          usage: 'Use preset_name parameter with simulate or preset operation',
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
      content: `Particle System Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isParticleSystemAvailable(): boolean {
  return true;
}
