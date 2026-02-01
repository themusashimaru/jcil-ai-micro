/**
 * BIOMECHANICS TOOL
 * Human/animal mechanics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function jointMoment(f: number, d: number): number { return f * d; }
function muscleForce(m: number, d: number, theta: number): number { return m / (d * Math.sin(theta * Math.PI / 180)); }
function groundReaction(m: number, a: number): number { return m * (9.81 + a); }
function metabolicPower(vo2: number, mass: number): number { return vo2 * 20.1 / 60 * mass; }
function jointAngle(l1: number, l2: number, d: number): number { return Math.acos((l1*l1 + l2*l2 - d*d) / (2*l1*l2)) * 180 / Math.PI; }
function strideFreq(v: number, l: number): number { return v / l; }
function impactForce(m: number, v: number, t: number): number { return m * v / t; }

export const biomechanicsTool: UnifiedTool = {
  name: 'biomechanics',
  description: 'Biomechanics: joint_moment, muscle_force, ground_reaction, metabolic, joint_angle, stride_freq, impact',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['joint_moment', 'muscle_force', 'ground_reaction', 'metabolic', 'joint_angle', 'stride_freq', 'impact'] }, f: { type: 'number' }, d: { type: 'number' }, m: { type: 'number' }, theta: { type: 'number' }, a: { type: 'number' }, vo2: { type: 'number' }, mass: { type: 'number' }, l1: { type: 'number' }, l2: { type: 'number' }, v: { type: 'number' }, l: { type: 'number' }, t: { type: 'number' } }, required: ['operation'] },
};

export async function executeBiomechanics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'joint_moment': result = { Nm: jointMoment(args.f || 500, args.d || 0.3) }; break;
      case 'muscle_force': result = { N: muscleForce(args.m || 100, args.d || 0.05, args.theta || 30) }; break;
      case 'ground_reaction': result = { N: groundReaction(args.m || 70, args.a || 5) }; break;
      case 'metabolic': result = { W: metabolicPower(args.vo2 || 40, args.mass || 70) }; break;
      case 'joint_angle': result = { degrees: jointAngle(args.l1 || 0.4, args.l2 || 0.4, args.d || 0.5) }; break;
      case 'stride_freq': result = { Hz: strideFreq(args.v || 3, args.l || 1.5) }; break;
      case 'impact': result = { N: impactForce(args.m || 70, args.v || 1, args.t || 0.01) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isBiomechanicsAvailable(): boolean { return true; }
