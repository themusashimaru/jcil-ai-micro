/**
 * ROBOTICS TOOL
 * Robot motion and control
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function forwardKin2R(l1: number, l2: number, t1: number, t2: number): {x: number, y: number} {
  const r1 = t1 * Math.PI / 180, r2 = t2 * Math.PI / 180;
  return { x: l1 * Math.cos(r1) + l2 * Math.cos(r1 + r2), y: l1 * Math.sin(r1) + l2 * Math.sin(r1 + r2) };
}
function inverseKin2R(l1: number, l2: number, x: number, y: number): {t1: number, t2: number} {
  const c2 = (x*x + y*y - l1*l1 - l2*l2) / (2*l1*l2);
  const s2 = Math.sqrt(1 - c2*c2);
  const t2 = Math.atan2(s2, c2);
  const t1 = Math.atan2(y, x) - Math.atan2(l2*s2, l1 + l2*c2);
  return { t1: t1 * 180/Math.PI, t2: t2 * 180/Math.PI };
}
function jointVelocity(omega: number, r: number): number { return omega * r; }
function torque(f: number, r: number): number { return f * r; }
function pidController(kp: number, ki: number, kd: number, e: number, ei: number, de: number): number { return kp*e + ki*ei + kd*de; }

export const roboticsTool: UnifiedTool = {
  name: 'robotics',
  description: 'Robotics: forward_kin, inverse_kin, joint_velocity, torque, pid_control',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['forward_kin', 'inverse_kin', 'joint_velocity', 'torque', 'pid_control'] }, l1: { type: 'number' }, l2: { type: 'number' }, t1: { type: 'number' }, t2: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, omega: { type: 'number' }, r: { type: 'number' }, f: { type: 'number' }, kp: { type: 'number' }, ki: { type: 'number' }, kd: { type: 'number' }, e: { type: 'number' }, ei: { type: 'number' }, de: { type: 'number' } }, required: ['operation'] },
};

export async function executeRobotics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'forward_kin': result = forwardKin2R(args.l1 || 1, args.l2 || 1, args.t1 || 45, args.t2 || 45); break;
      case 'inverse_kin': result = inverseKin2R(args.l1 || 1, args.l2 || 1, args.x || 1, args.y || 1); break;
      case 'joint_velocity': result = { v_m_s: jointVelocity(args.omega || 10, args.r || 0.1) }; break;
      case 'torque': result = { tau_Nm: torque(args.f || 100, args.r || 0.5) }; break;
      case 'pid_control': result = { output: pidController(args.kp || 1, args.ki || 0.1, args.kd || 0.01, args.e || 10, args.ei || 5, args.de || -2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isRoboticsAvailable(): boolean { return true; }
