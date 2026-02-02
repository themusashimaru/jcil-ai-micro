/**
 * PHYSICS ENGINE TOOL
 * 2D physics simulation: forces, collisions, rigid bodies
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Vector2 { x: number; y: number; }
interface Body { id: string; position: Vector2; velocity: Vector2; mass: number; radius: number; restitution: number; }
interface World { bodies: Body[]; gravity: Vector2; friction: number; }

function vec2Add(a: Vector2, b: Vector2): Vector2 { return { x: a.x + b.x, y: a.y + b.y }; }
function vec2Sub(a: Vector2, b: Vector2): Vector2 { return { x: a.x - b.x, y: a.y - b.y }; }
function vec2Scale(v: Vector2, s: number): Vector2 { return { x: v.x * s, y: v.y * s }; }
function vec2Length(v: Vector2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vec2Normalize(v: Vector2): Vector2 { const len = vec2Length(v); return len > 0 ? vec2Scale(v, 1 / len) : { x: 0, y: 0 }; }
function vec2Dot(a: Vector2, b: Vector2): number { return a.x * b.x + a.y * b.y; }

function createWorld(gravity: Vector2 = { x: 0, y: 9.81 }, friction: number = 0.1): World {
  return { bodies: [], gravity, friction };
}

function addBody(world: World, body: Partial<Body>): Body {
  const newBody: Body = {
    id: body.id || `body_${world.bodies.length}`,
    position: body.position || { x: 0, y: 0 },
    velocity: body.velocity || { x: 0, y: 0 },
    mass: body.mass || 1,
    radius: body.radius || 10,
    restitution: body.restitution || 0.8
  };
  world.bodies.push(newBody);
  return newBody;
}

function applyForce(body: Body, force: Vector2): void {
  const acceleration = vec2Scale(force, 1 / body.mass);
  body.velocity = vec2Add(body.velocity, acceleration);
}

function checkCollision(a: Body, b: Body): { colliding: boolean; normal: Vector2; depth: number } {
  const diff = vec2Sub(b.position, a.position);
  const dist = vec2Length(diff);
  const minDist = a.radius + b.radius;
  if (dist < minDist) {
    return { colliding: true, normal: vec2Normalize(diff), depth: minDist - dist };
  }
  return { colliding: false, normal: { x: 0, y: 0 }, depth: 0 };
}

function resolveCollision(a: Body, b: Body, normal: Vector2): void {
  const relVel = vec2Sub(a.velocity, b.velocity);
  const velAlongNormal = vec2Dot(relVel, normal);
  if (velAlongNormal > 0) return;
  const e = Math.min(a.restitution, b.restitution);
  const j = -(1 + e) * velAlongNormal / (1 / a.mass + 1 / b.mass);
  const impulse = vec2Scale(normal, j);
  a.velocity = vec2Sub(a.velocity, vec2Scale(impulse, 1 / a.mass));
  b.velocity = vec2Add(b.velocity, vec2Scale(impulse, 1 / b.mass));
}

function stepWorld(world: World, dt: number = 1/60): void {
  for (const body of world.bodies) {
    applyForce(body, vec2Scale(world.gravity, body.mass));
    body.velocity = vec2Scale(body.velocity, 1 - world.friction);
    body.position = vec2Add(body.position, vec2Scale(body.velocity, dt));
  }
  for (let i = 0; i < world.bodies.length; i++) {
    for (let j = i + 1; j < world.bodies.length; j++) {
      const collision = checkCollision(world.bodies[i], world.bodies[j]);
      if (collision.colliding) {
        resolveCollision(world.bodies[i], world.bodies[j], collision.normal);
        const correction = vec2Scale(collision.normal, collision.depth / 2);
        world.bodies[i].position = vec2Sub(world.bodies[i].position, correction);
        world.bodies[j].position = vec2Add(world.bodies[j].position, correction);
      }
    }
  }
}

function simulateProjectile(v0: number, angle: number, g: number = 9.81): Record<string, unknown> {
  const rad = angle * Math.PI / 180;
  const vx = v0 * Math.cos(rad);
  const vy = v0 * Math.sin(rad);
  const timeOfFlight = 2 * vy / g;
  const maxHeight = (vy * vy) / (2 * g);
  const range = vx * timeOfFlight;
  const trajectory: Vector2[] = [];
  for (let t = 0; t <= timeOfFlight; t += timeOfFlight / 20) {
    trajectory.push({ x: vx * t, y: vy * t - 0.5 * g * t * t });
  }
  return { initialVelocity: v0, angle, timeOfFlight, maxHeight, range, trajectory };
}

function simulatePendulum(length: number, angle0: number, steps: number = 100): Array<{ time: number; angle: number; velocity: number }> {
  const g = 9.81;
  let angle = angle0 * Math.PI / 180;
  let omega = 0;
  const dt = 0.05;
  const result: Array<{ time: number; angle: number; velocity: number }> = [];
  for (let i = 0; i < steps; i++) {
    const alpha = -g / length * Math.sin(angle);
    omega += alpha * dt;
    angle += omega * dt;
    result.push({ time: i * dt, angle: angle * 180 / Math.PI, velocity: omega });
  }
  return result;
}

function simulateSpring(mass: number, k: number, x0: number, steps: number = 100): Array<{ time: number; position: number; velocity: number }> {
  let x = x0;
  let v = 0;
  const dt = 0.05;
  const result: Array<{ time: number; position: number; velocity: number }> = [];
  for (let i = 0; i < steps; i++) {
    const a = -k / mass * x;
    v += a * dt;
    x += v * dt;
    result.push({ time: i * dt, position: x, velocity: v });
  }
  return result;
}

export const physicsEngineTool: UnifiedTool = {
  name: 'physics_engine',
  description: 'Physics Engine: simulate, projectile, pendulum, spring, collision',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['simulate', 'projectile', 'pendulum', 'spring', 'collision', 'create_world'] },
      bodies: { type: 'array' },
      steps: { type: 'number' },
      velocity: { type: 'number' },
      angle: { type: 'number' },
      length: { type: 'number' },
      mass: { type: 'number' },
      springConstant: { type: 'number' },
      displacement: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executePhysicsEngine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'simulate':
        const world = createWorld();
        for (const b of (args.bodies || [{ position: { x: 100, y: 0 } }, { position: { x: 100, y: 100 } }])) {
          addBody(world, b);
        }
        const history: Array<Record<string, unknown>> = [];
        for (let i = 0; i < (args.steps || 60); i++) {
          stepWorld(world);
          history.push({ step: i, bodies: world.bodies.map(b => ({ ...b })) });
        }
        result = { simulation: history.slice(-10), totalSteps: args.steps || 60 };
        break;
      case 'projectile':
        result = simulateProjectile(args.velocity || 50, args.angle || 45);
        break;
      case 'pendulum':
        result = { pendulum: simulatePendulum(args.length || 1, args.angle || 30, args.steps || 100) };
        break;
      case 'spring':
        result = { spring: simulateSpring(args.mass || 1, args.springConstant || 10, args.displacement || 1, args.steps || 100) };
        break;
      case 'collision':
        const a: Body = { id: 'a', position: { x: 0, y: 0 }, velocity: { x: 5, y: 0 }, mass: 1, radius: 10, restitution: 1 };
        const b: Body = { id: 'b', position: { x: 30, y: 0 }, velocity: { x: -5, y: 0 }, mass: 1, radius: 10, restitution: 1 };
        const before = { a: { ...a }, b: { ...b } };
        const collision = checkCollision(a, b);
        if (collision.colliding) resolveCollision(a, b, collision.normal);
        result = { before, after: { a, b }, collision };
        break;
      case 'create_world':
        result = { world: createWorld(), info: 'Use simulate operation to run physics' };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPhysicsEngineAvailable(): boolean { return true; }
