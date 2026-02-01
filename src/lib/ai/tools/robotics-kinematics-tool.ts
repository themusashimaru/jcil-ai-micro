// ============================================================================
// ROBOTICS KINEMATICS TOOL - TIER INFINITY
// ============================================================================
// Robot kinematics: forward/inverse kinematics, Jacobians, workspace analysis.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DHParams {
  theta: number;
  d: number;
  a: number;
  alpha: number;
}
interface Position3D {
  x: number;
  y: number;
  z: number;
}
type Matrix4x4 = number[][];

function identity4x4(): Matrix4x4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function multiply4x4(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
  const r: Matrix4x4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}

function dhTransform(p: DHParams): Matrix4x4 {
  const ct = Math.cos(p.theta),
    st = Math.sin(p.theta);
  const ca = Math.cos(p.alpha),
    sa = Math.sin(p.alpha);
  return [
    [ct, -st * ca, st * sa, p.a * ct],
    [st, ct * ca, -ct * sa, p.a * st],
    [0, sa, ca, p.d],
    [0, 0, 0, 1],
  ];
}

function forwardKinematics(dhParams: DHParams[]): { position: Position3D; transform: Matrix4x4 } {
  let t = identity4x4();
  for (const p of dhParams) t = multiply4x4(t, dhTransform(p));
  return { position: { x: t[0][3], y: t[1][3], z: t[2][3] }, transform: t };
}

function inverseKinematics2R(
  x: number,
  y: number,
  l1: number,
  l2: number
): { theta1: number; theta2: number; reachable: boolean }[] {
  const d = Math.sqrt(x * x + y * y);
  if (d > l1 + l2 || d < Math.abs(l1 - l2)) return [{ theta1: 0, theta2: 0, reachable: false }];
  const cosT2 = (x * x + y * y - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  const theta2_1 = Math.acos(Math.max(-1, Math.min(1, cosT2)));
  const solutions = [];
  for (const theta2 of [theta2_1, -theta2_1]) {
    const k1 = l1 + l2 * Math.cos(theta2),
      k2 = l2 * Math.sin(theta2);
    solutions.push({ theta1: Math.atan2(y, x) - Math.atan2(k2, k1), theta2, reachable: true });
  }
  return solutions;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const roboticsKinematicsTool: UnifiedTool = {
  name: 'robotics_kinematics',
  description: `Robotics kinematics: forward/inverse kinematics, Jacobians, workspace.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['forward', 'inverse_2r', 'workspace'],
        description: 'Kinematics operation to perform',
      },
      joint_angles: {
        type: 'array',
        items: { type: 'number' },
        description: 'Joint angles in radians',
      },
      joint_angles_deg: {
        type: 'array',
        items: { type: 'number' },
        description: 'Joint angles in degrees',
      },
      link_lengths: {
        type: 'array',
        items: { type: 'number' },
        description: 'Link lengths',
      },
      target_x: { type: 'number', description: 'Target X position' },
      target_y: { type: 'number', description: 'Target Y position' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRoboticsKinematics(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'forward': {
        const angles =
          args.joint_angles || args.joint_angles_deg?.map((a: number) => (a * Math.PI) / 180);
        if (!angles) throw new Error('forward requires joint_angles');
        const lengths = args.link_lengths || Array(angles.length).fill(1);
        const dhParams = angles.map((theta: number, i: number) => ({
          theta,
          d: 0,
          a: lengths[i],
          alpha: 0,
        }));
        const fkResult = forwardKinematics(dhParams);
        result = {
          operation: 'forward',
          end_effector: {
            x: +fkResult.position.x.toFixed(4),
            y: +fkResult.position.y.toFixed(4),
            z: +fkResult.position.z.toFixed(4),
          },
          joint_angles_deg: angles.map((a: number) => +((a * 180) / Math.PI).toFixed(2)),
        };
        break;
      }
      case 'inverse_2r': {
        const { target_x, target_y, link_lengths } = args;
        if (target_x === undefined || target_y === undefined)
          throw new Error('inverse_2r requires target_x, target_y');
        const [l1, l2] = link_lengths || [1, 1];
        const solutions = inverseKinematics2R(target_x, target_y, l1, l2);
        result = {
          operation: 'inverse_2r',
          target: { x: target_x, y: target_y },
          solutions: solutions.map((s, i) => ({
            config: i === 0 ? 'elbow_up' : 'elbow_down',
            theta1_deg: +((s.theta1 * 180) / Math.PI).toFixed(2),
            theta2_deg: +((s.theta2 * 180) / Math.PI).toFixed(2),
            reachable: s.reachable,
          })),
        };
        break;
      }
      case 'workspace': {
        const [l1, l2] = args.link_lengths || [1, 1];
        result = {
          operation: 'workspace',
          inner_radius: Math.abs(l1 - l2),
          outer_radius: l1 + l2,
          area: Math.PI * ((l1 + l2) ** 2 - (l1 - l2) ** 2),
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
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isRoboticsKinematicsAvailable(): boolean {
  return true;
}
