/**
 * STEERING BEHAVIORS TOOL
 * AI movement behaviors: seek, flee, arrive, wander, pursue, evade, flocking
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Vector { x: number; y: number; }
interface Agent { position: Vector; velocity: Vector; maxSpeed: number; maxForce: number; mass: number; }

function add(a: Vector, b: Vector): Vector { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Vector, b: Vector): Vector { return { x: a.x - b.x, y: a.y - b.y }; }
function mult(v: Vector, n: number): Vector { return { x: v.x * n, y: v.y * n }; }
function div(v: Vector, n: number): Vector { return n !== 0 ? { x: v.x / n, y: v.y / n } : v; }
function mag(v: Vector): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
function normalize(v: Vector): Vector { const m = mag(v); return m > 0 ? div(v, m) : v; }
function limit(v: Vector, max: number): Vector { const m = mag(v); return m > max ? mult(normalize(v), max) : v; }
function dist(a: Vector, b: Vector): number { return mag(sub(a, b)); }
function setMag(v: Vector, m: number): Vector { return mult(normalize(v), m); }

// Seek: steer towards target
function seek(agent: Agent, target: Vector): Vector {
  const desired = sub(target, agent.position);
  const desiredNorm = setMag(desired, agent.maxSpeed);
  const steer = sub(desiredNorm, agent.velocity);
  return limit(steer, agent.maxForce);
}

// Flee: steer away from target
function flee(agent: Agent, target: Vector): Vector {
  const desired = sub(agent.position, target);
  const desiredNorm = setMag(desired, agent.maxSpeed);
  const steer = sub(desiredNorm, agent.velocity);
  return limit(steer, agent.maxForce);
}

// Arrive: slow down as approaching target
function arrive(agent: Agent, target: Vector, slowRadius: number = 100): Vector {
  const desired = sub(target, agent.position);
  const d = mag(desired);

  let speed = agent.maxSpeed;
  if (d < slowRadius) {
    speed = (d / slowRadius) * agent.maxSpeed;
  }

  const desiredNorm = setMag(desired, speed);
  const steer = sub(desiredNorm, agent.velocity);
  return limit(steer, agent.maxForce);
}

// Wander: random steering
function wander(agent: Agent, wanderRadius: number = 50, wanderDistance: number = 80, wanderAngle: number = 0): { force: Vector; newAngle: number } {
  const circleCenter = setMag(agent.velocity, wanderDistance);
  const angleChange = 0.5;
  const newAngle = wanderAngle + (Math.random() - 0.5) * angleChange;

  const displacement = {
    x: Math.cos(newAngle) * wanderRadius,
    y: Math.sin(newAngle) * wanderRadius
  };

  const wanderForce = add(circleCenter, displacement);
  return { force: limit(wanderForce, agent.maxForce), newAngle };
}

// Pursue: predict target's future position
function pursue(agent: Agent, target: Agent, lookAhead: number = 10): Vector {
  const prediction = mult(target.velocity, lookAhead);
  const futurePos = add(target.position, prediction);
  return seek(agent, futurePos);
}

// Evade: flee from predicted position
function evade(agent: Agent, target: Agent, lookAhead: number = 10): Vector {
  const prediction = mult(target.velocity, lookAhead);
  const futurePos = add(target.position, prediction);
  return flee(agent, futurePos);
}

// Separation: steer away from nearby agents
function separation(agent: Agent, neighbors: Agent[], desiredSeparation: number = 50): Vector {
  let steer: Vector = { x: 0, y: 0 };
  let count = 0;

  for (const other of neighbors) {
    const d = dist(agent.position, other.position);
    if (d > 0 && d < desiredSeparation) {
      const diff = normalize(sub(agent.position, other.position));
      steer = add(steer, div(diff, d));
      count++;
    }
  }

  if (count > 0) {
    steer = div(steer, count);
    steer = setMag(steer, agent.maxSpeed);
    steer = sub(steer, agent.velocity);
    steer = limit(steer, agent.maxForce);
  }

  return steer;
}

// Alignment: steer towards average heading
function alignment(agent: Agent, neighbors: Agent[], neighborDist: number = 100): Vector {
  let sum: Vector = { x: 0, y: 0 };
  let count = 0;

  for (const other of neighbors) {
    const d = dist(agent.position, other.position);
    if (d > 0 && d < neighborDist) {
      sum = add(sum, other.velocity);
      count++;
    }
  }

  if (count > 0) {
    sum = div(sum, count);
    sum = setMag(sum, agent.maxSpeed);
    const steer = sub(sum, agent.velocity);
    return limit(steer, agent.maxForce);
  }

  return { x: 0, y: 0 };
}

// Cohesion: steer towards center of neighbors
function cohesion(agent: Agent, neighbors: Agent[], neighborDist: number = 100): Vector {
  let sum: Vector = { x: 0, y: 0 };
  let count = 0;

  for (const other of neighbors) {
    const d = dist(agent.position, other.position);
    if (d > 0 && d < neighborDist) {
      sum = add(sum, other.position);
      count++;
    }
  }

  if (count > 0) {
    sum = div(sum, count);
    return seek(agent, sum);
  }

  return { x: 0, y: 0 };
}

// Flock: combine separation, alignment, cohesion
function flock(agent: Agent, neighbors: Agent[], weights: { sep: number; ali: number; coh: number } = { sep: 1.5, ali: 1, coh: 1 }): Vector {
  const sep = mult(separation(agent, neighbors), weights.sep);
  const ali = mult(alignment(agent, neighbors), weights.ali);
  const coh = mult(cohesion(agent, neighbors), weights.coh);

  return add(add(sep, ali), coh);
}

// Obstacle avoidance
function avoidObstacle(agent: Agent, obstacle: { position: Vector; radius: number }, lookAhead: number = 100): Vector {
  const ahead = add(agent.position, setMag(agent.velocity, lookAhead));
  const toObstacle = sub(obstacle.position, ahead);
  const distance = mag(toObstacle);

  if (distance < obstacle.radius + 20) {
    const avoidance = normalize(sub(ahead, obstacle.position));
    return mult(avoidance, agent.maxForce);
  }

  return { x: 0, y: 0 };
}

export const steeringBehaviorsTool: UnifiedTool = {
  name: 'steering_behaviors',
  description: 'Steering Behaviors: seek, flee, arrive, wander, pursue, evade, separation, alignment, cohesion, flock, avoid',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['seek', 'flee', 'arrive', 'wander', 'pursue', 'evade', 'separation', 'alignment', 'cohesion', 'flock', 'avoid', 'demo'] },
      agent: { type: 'object' },
      target: { type: 'object' },
      neighbors: { type: 'array' },
      obstacle: { type: 'object' },
      params: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeSteeringBehaviors(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    const defaultAgent: Agent = {
      position: { x: 100, y: 100 },
      velocity: { x: 2, y: 1 },
      maxSpeed: 5,
      maxForce: 0.3,
      mass: 1
    };

    const agent: Agent = args.agent || defaultAgent;
    const target: Vector = args.target || { x: 300, y: 200 };
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'seek':
        result = { behavior: 'seek', force: seek(agent, target), description: 'Steer towards target at max speed' };
        break;
      case 'flee':
        result = { behavior: 'flee', force: flee(agent, target), description: 'Steer away from target at max speed' };
        break;
      case 'arrive':
        result = { behavior: 'arrive', force: arrive(agent, target, args.params?.slowRadius || 100), description: 'Slow down as approaching target' };
        break;
      case 'wander':
        const wanderResult = wander(agent, args.params?.wanderRadius || 50, args.params?.wanderDistance || 80, args.params?.angle || 0);
        result = { behavior: 'wander', ...wanderResult, description: 'Random steering for natural movement' };
        break;
      case 'pursue':
        const targetAgent = args.target || { ...defaultAgent, position: { x: 300, y: 200 } };
        result = { behavior: 'pursue', force: pursue(agent, targetAgent), description: 'Predict and intercept moving target' };
        break;
      case 'evade':
        const predator = args.target || { ...defaultAgent, position: { x: 150, y: 150 } };
        result = { behavior: 'evade', force: evade(agent, predator), description: 'Flee from predicted position' };
        break;
      case 'separation':
        const sepNeighbors = args.neighbors || [{ ...defaultAgent, position: { x: 110, y: 105 } }];
        result = { behavior: 'separation', force: separation(agent, sepNeighbors), description: 'Maintain distance from neighbors' };
        break;
      case 'alignment':
        const aliNeighbors = args.neighbors || [{ ...defaultAgent, position: { x: 110, y: 105 }, velocity: { x: 3, y: 2 } }];
        result = { behavior: 'alignment', force: alignment(agent, aliNeighbors), description: 'Match neighbors heading' };
        break;
      case 'cohesion':
        const cohNeighbors = args.neighbors || [{ ...defaultAgent, position: { x: 150, y: 150 } }];
        result = { behavior: 'cohesion', force: cohesion(agent, cohNeighbors), description: 'Steer towards center of group' };
        break;
      case 'flock':
        const flockNeighbors = args.neighbors || [
          { ...defaultAgent, position: { x: 110, y: 105 } },
          { ...defaultAgent, position: { x: 90, y: 110 } }
        ];
        result = { behavior: 'flock', force: flock(agent, flockNeighbors, args.params?.weights), description: 'Combined separation + alignment + cohesion' };
        break;
      case 'avoid':
        const obstacle = args.obstacle || { position: { x: 200, y: 150 }, radius: 30 };
        result = { behavior: 'avoid', force: avoidObstacle(agent, obstacle), description: 'Steer around obstacles' };
        break;
      case 'demo':
        result = {
          behaviors: ['seek', 'flee', 'arrive', 'wander', 'pursue', 'evade', 'separation', 'alignment', 'cohesion', 'flock', 'avoid'],
          agentFormat: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, maxSpeed: 5, maxForce: 0.3, mass: 1 },
          usage: 'Each behavior returns a steering force vector to be applied to the agent'
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSteeringBehaviorsAvailable(): boolean { return true; }
