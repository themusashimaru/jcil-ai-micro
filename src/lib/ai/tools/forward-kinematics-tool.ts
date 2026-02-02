/**
 * FORWARD-KINEMATICS TOOL
 * Robot forward kinematics using DH parameters and transformation matrices
 *
 * Implements:
 * - Denavit-Hartenberg (DH) convention
 * - Transformation matrices
 * - End-effector position/orientation calculation
 * - Common robot configurations (SCARA, articulated, etc.)
 * - Jacobian matrix computation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// 4x4 transformation matrix type
type Matrix4 = number[][];

// 3D Vector
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// DH Parameters for a joint
interface DHParams {
  theta: number;  // Joint angle (radians) - rotation about z
  d: number;      // Link offset - translation along z
  a: number;      // Link length - translation along x
  alpha: number;  // Link twist (radians) - rotation about x
  jointType: 'revolute' | 'prismatic';
}

// Robot configuration
interface RobotConfig {
  name: string;
  description: string;
  dhParams: DHParams[];
  jointLimits?: { min: number; max: number }[];
}

// Matrix operations
function identityMatrix4(): Matrix4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

function multiplyMatrix4(A: Matrix4, B: Matrix4): Matrix4 {
  const result: Matrix4 = Array(4).fill(0).map(() => Array(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

// Create DH transformation matrix
function dhTransform(dh: DHParams, jointValue: number): Matrix4 {
  // For revolute joints, jointValue affects theta
  // For prismatic joints, jointValue affects d
  const theta = dh.jointType === 'revolute' ? jointValue : dh.theta;
  const d = dh.jointType === 'prismatic' ? jointValue : dh.d;
  const a = dh.a;
  const alpha = dh.alpha;

  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1]
  ];
}

// Create rotation matrix about X axis
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rotX(angle: number): Matrix4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1]
  ];
}

// Create rotation matrix about Y axis
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rotY(angle: number): Matrix4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1]
  ];
}

// Create rotation matrix about Z axis
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rotZ(angle: number): Matrix4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

// Create translation matrix
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function translate(x: number, y: number, z: number): Matrix4 {
  return [
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1]
  ];
}

// Extract position from transformation matrix
function getPosition(T: Matrix4): Vec3 {
  return {
    x: T[0][3],
    y: T[1][3],
    z: T[2][3]
  };
}

// Extract rotation matrix from transformation matrix
function getRotation(T: Matrix4): number[][] {
  return [
    [T[0][0], T[0][1], T[0][2]],
    [T[1][0], T[1][1], T[1][2]],
    [T[2][0], T[2][1], T[2][2]]
  ];
}

// Extract Euler angles (ZYX convention) from rotation matrix
function rotationToEuler(R: number[][]): { roll: number; pitch: number; yaw: number } {
  const sy = Math.sqrt(R[0][0] * R[0][0] + R[1][0] * R[1][0]);
  const singular = sy < 1e-6;

  let roll: number, pitch: number, yaw: number;

  if (!singular) {
    roll = Math.atan2(R[2][1], R[2][2]);
    pitch = Math.atan2(-R[2][0], sy);
    yaw = Math.atan2(R[1][0], R[0][0]);
  } else {
    roll = Math.atan2(-R[1][2], R[1][1]);
    pitch = Math.atan2(-R[2][0], sy);
    yaw = 0;
  }

  return { roll, pitch, yaw };
}

// Compute forward kinematics
function computeFK(dhParams: DHParams[], jointValues: number[]): {
  endEffector: Matrix4;
  intermediateFrames: Matrix4[];
  position: Vec3;
  orientation: { roll: number; pitch: number; yaw: number };
} {
  let T = identityMatrix4();
  const frames: Matrix4[] = [T];

  for (let i = 0; i < dhParams.length; i++) {
    const jointValue = jointValues[i] || 0;
    const Ti = dhTransform(dhParams[i], jointValue);
    T = multiplyMatrix4(T, Ti);
    frames.push(T.map(row => [...row]));
  }

  const position = getPosition(T);
  const rotation = getRotation(T);
  const orientation = rotationToEuler(rotation);

  return {
    endEffector: T,
    intermediateFrames: frames,
    position,
    orientation
  };
}

// Compute Jacobian matrix numerically
function computeJacobian(dhParams: DHParams[], jointValues: number[], delta: number = 1e-6): number[][] {
  const n = dhParams.length;
  const J: number[][] = Array(6).fill(0).map(() => Array(n).fill(0));

  const base = computeFK(dhParams, jointValues);
  const basePos = base.position;
  const baseEuler = base.orientation;

  for (let j = 0; j < n; j++) {
    const perturbedJoints = [...jointValues];
    perturbedJoints[j] += delta;

    const perturbed = computeFK(dhParams, perturbedJoints);
    const pertPos = perturbed.position;
    const pertEuler = perturbed.orientation;

    // Linear velocity Jacobian (position derivatives)
    J[0][j] = (pertPos.x - basePos.x) / delta;
    J[1][j] = (pertPos.y - basePos.y) / delta;
    J[2][j] = (pertPos.z - basePos.z) / delta;

    // Angular velocity Jacobian (orientation derivatives)
    J[3][j] = (pertEuler.roll - baseEuler.roll) / delta;
    J[4][j] = (pertEuler.pitch - baseEuler.pitch) / delta;
    J[5][j] = (pertEuler.yaw - baseEuler.yaw) / delta;
  }

  return J;
}

// Predefined robot configurations
const robots: Record<string, RobotConfig> = {
  '2link-planar': {
    name: '2-Link Planar Robot',
    description: 'Simple 2-DOF planar manipulator',
    dhParams: [
      { theta: 0, d: 0, a: 1.0, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0, a: 1.0, alpha: 0, jointType: 'revolute' }
    ],
    jointLimits: [
      { min: -Math.PI, max: Math.PI },
      { min: -Math.PI, max: Math.PI }
    ]
  },
  '3link-planar': {
    name: '3-Link Planar Robot',
    description: '3-DOF planar manipulator',
    dhParams: [
      { theta: 0, d: 0, a: 1.0, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0.8, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0.5, alpha: 0, jointType: 'revolute' }
    ]
  },
  'scara': {
    name: 'SCARA Robot',
    description: 'Selective Compliance Assembly Robot Arm (4-DOF)',
    dhParams: [
      { theta: 0, d: 0.4, a: 0.4, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0.3, alpha: Math.PI, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: 0, jointType: 'prismatic' },
      { theta: 0, d: 0, a: 0, alpha: 0, jointType: 'revolute' }
    ],
    jointLimits: [
      { min: -Math.PI * 0.75, max: Math.PI * 0.75 },
      { min: -Math.PI * 0.75, max: Math.PI * 0.75 },
      { min: 0, max: 0.3 },
      { min: -Math.PI, max: Math.PI }
    ]
  },
  'puma560': {
    name: 'PUMA 560',
    description: 'Classic 6-DOF industrial robot arm',
    dhParams: [
      { theta: 0, d: 0, a: 0, alpha: -Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0.4318, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0.1244, a: 0.0203, alpha: -Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0.4318, a: 0, alpha: Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: -Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: 0, jointType: 'revolute' }
    ]
  },
  'stanford': {
    name: 'Stanford Arm',
    description: 'Spherical robot with prismatic joint (6-DOF)',
    dhParams: [
      { theta: 0, d: 0.4, a: 0, alpha: -Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0.1, a: 0, alpha: Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: 0, jointType: 'prismatic' },
      { theta: 0, d: 0, a: 0, alpha: -Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: Math.PI / 2, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: 0, jointType: 'revolute' }
    ]
  },
  'cylindrical': {
    name: 'Cylindrical Robot',
    description: 'RPP configuration (3-DOF)',
    dhParams: [
      { theta: 0, d: 0.5, a: 0, alpha: 0, jointType: 'revolute' },
      { theta: 0, d: 0, a: 0, alpha: -Math.PI / 2, jointType: 'prismatic' },
      { theta: -Math.PI / 2, d: 0, a: 0, alpha: 0, jointType: 'prismatic' }
    ]
  }
};

// Generate workspace samples
function sampleWorkspace(dhParams: DHParams[], samples: number = 100): Vec3[] {
  const points: Vec3[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const n = dhParams.length;

  for (let i = 0; i < samples; i++) {
    const jointValues = dhParams.map((dh, _idx) => {
      if (dh.jointType === 'revolute') {
        return (Math.random() - 0.5) * 2 * Math.PI;
      } else {
        return Math.random() * 0.5; // Prismatic range
      }
    });

    const fk = computeFK(dhParams, jointValues);
    points.push(fk.position);
  }

  return points;
}

// Compute workspace bounds
function workspaceBounds(points: Vec3[]): {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  reach: number;
} {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2
  };

  let maxReach = 0;
  for (const p of points) {
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    maxReach = Math.max(maxReach, dist);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center,
    reach: maxReach
  };
}

// Format matrix for display
function formatMatrix(M: Matrix4): string[] {
  return M.map(row => row.map(v => v.toFixed(4).padStart(10)).join(' '));
}

export const forwardkinematicsTool: UnifiedTool = {
  name: 'forward_kinematics',
  description: 'Robot forward kinematics using DH parameters - transformation matrices, end-effector pose, Jacobian',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compute', 'jacobian', 'workspace', 'robots', 'info', 'examples'],
        description: 'Operation to perform'
      },
      robot: { type: 'string', description: 'Predefined robot name' },
      jointValues: { type: 'array', items: { type: 'number' }, description: 'Joint values (radians or meters)' },
      dhParams: { type: 'array', description: 'Custom DH parameters array' },
      samples: { type: 'number', description: 'Workspace sampling count' }
    },
    required: ['operation']
  }
};

export async function executeforwardkinematics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'forward-kinematics',
          description: 'Robot forward kinematics calculator using DH convention',
          concepts: {
            dhParameters: {
              theta: 'Joint angle - rotation about z-axis (radians)',
              d: 'Link offset - translation along z-axis',
              a: 'Link length - translation along x-axis',
              alpha: 'Link twist - rotation about x-axis (radians)'
            },
            transformationMatrix: '4x4 homogeneous transformation matrix',
            endEffector: 'Position and orientation of the tool frame',
            jacobian: 'Maps joint velocities to end-effector velocities'
          },
          predefinedRobots: Object.keys(robots),
          operations: ['compute', 'jacobian', 'workspace', 'robots', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Compute FK for 2-link planar robot',
              call: { operation: 'compute', robot: '2link-planar', jointValues: [Math.PI / 4, Math.PI / 6] }
            },
            {
              description: 'Compute Jacobian for SCARA robot',
              call: { operation: 'jacobian', robot: 'scara', jointValues: [0, Math.PI / 4, 0.1, 0] }
            },
            {
              description: 'Analyze workspace of PUMA 560',
              call: { operation: 'workspace', robot: 'puma560', samples: 200 }
            },
            {
              description: 'List available robots',
              call: { operation: 'robots' }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'robots') {
      const robotList = Object.entries(robots).map(([key, config]) => ({
        id: key,
        name: config.name,
        description: config.description,
        dof: config.dhParams.length,
        jointTypes: config.dhParams.map(dh => dh.jointType)
      }));
      return { toolCallId: id, content: JSON.stringify({ robots: robotList }, null, 2) };
    }

    if (operation === 'compute') {
      let dhParams: DHParams[];
      let robotName = 'custom';

      if (args.robot && robots[args.robot]) {
        dhParams = robots[args.robot].dhParams;
        robotName = robots[args.robot].name;
      } else if (args.dhParams) {
        dhParams = args.dhParams;
      } else {
        dhParams = robots['2link-planar'].dhParams;
        robotName = robots['2link-planar'].name;
      }

      const jointValues = args.jointValues || dhParams.map(() => 0);

      if (jointValues.length !== dhParams.length) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Joint values count (${jointValues.length}) must match DOF (${dhParams.length})`
          }),
          isError: true
        };
      }

      const result = computeFK(dhParams, jointValues);

      // Format output
      const deg = (rad: number) => (rad * 180 / Math.PI).toFixed(2);

      return {
        toolCallId: id,
        content: JSON.stringify({
          robot: robotName,
          dof: dhParams.length,
          jointValues: jointValues.map((v, i) =>
            dhParams[i].jointType === 'revolute' ? `${deg(v)}deg` : `${v.toFixed(4)}m`
          ),
          endEffectorPosition: {
            x: result.position.x.toFixed(6),
            y: result.position.y.toFixed(6),
            z: result.position.z.toFixed(6)
          },
          endEffectorOrientation: {
            roll: deg(result.orientation.roll) + 'deg',
            pitch: deg(result.orientation.pitch) + 'deg',
            yaw: deg(result.orientation.yaw) + 'deg'
          },
          transformationMatrix: formatMatrix(result.endEffector),
          intermediateFramePositions: result.intermediateFrames.slice(1).map((T, i) => ({
            frame: i + 1,
            position: {
              x: T[0][3].toFixed(4),
              y: T[1][3].toFixed(4),
              z: T[2][3].toFixed(4)
            }
          }))
        }, null, 2)
      };
    }

    if (operation === 'jacobian') {
      let dhParams: DHParams[];
      let robotName = 'custom';

      if (args.robot && robots[args.robot]) {
        dhParams = robots[args.robot].dhParams;
        robotName = robots[args.robot].name;
      } else {
        dhParams = robots['2link-planar'].dhParams;
        robotName = robots['2link-planar'].name;
      }

      const jointValues = args.jointValues || dhParams.map(() => 0);
      const J = computeJacobian(dhParams, jointValues);

      // Compute manipulability (sqrt(det(J * J^T)))
      const JJT: number[][] = Array(6).fill(0).map(() => Array(6).fill(0));
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          for (let k = 0; k < dhParams.length; k++) {
            JJT[i][j] += J[i][k] * J[j][k];
          }
        }
      }

      // Simple determinant for manipulability estimate (using linear jacobian 3x3)
      const Jv = J.slice(0, 3);
      let manipulability = 0;
      if (dhParams.length >= 3) {
        // Simplified singular value estimate
        let sumSquares = 0;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < Math.min(3, dhParams.length); j++) {
            sumSquares += Jv[i][j] * Jv[i][j];
          }
        }
        manipulability = Math.sqrt(sumSquares);
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          robot: robotName,
          jointValues,
          jacobianMatrix: {
            description: 'Linear velocity (rows 0-2), Angular velocity (rows 3-5)',
            rows: J.map((row, i) => ({
              label: ['vx', 'vy', 'vz', 'wx', 'wy', 'wz'][i],
              values: row.map(v => v.toFixed(6))
            }))
          },
          manipulabilityIndex: manipulability.toFixed(6),
          singularity: manipulability < 0.01 ? 'Near singular configuration!' : 'OK'
        }, null, 2)
      };
    }

    if (operation === 'workspace') {
      let dhParams: DHParams[];
      let robotName = 'custom';

      if (args.robot && robots[args.robot]) {
        dhParams = robots[args.robot].dhParams;
        robotName = robots[args.robot].name;
      } else {
        dhParams = robots['2link-planar'].dhParams;
        robotName = robots['2link-planar'].name;
      }

      const samples = Math.min(500, args.samples || 100);
      const points = sampleWorkspace(dhParams, samples);
      const bounds = workspaceBounds(points);

      // Sample some points for visualization
      const samplePoints = points.slice(0, 10).map(p => ({
        x: p.x.toFixed(4),
        y: p.y.toFixed(4),
        z: p.z.toFixed(4)
      }));

      return {
        toolCallId: id,
        content: JSON.stringify({
          robot: robotName,
          dof: dhParams.length,
          workspaceAnalysis: {
            sampleCount: samples,
            bounds: {
              min: { x: bounds.min.x.toFixed(4), y: bounds.min.y.toFixed(4), z: bounds.min.z.toFixed(4) },
              max: { x: bounds.max.x.toFixed(4), y: bounds.max.y.toFixed(4), z: bounds.max.z.toFixed(4) }
            },
            center: {
              x: bounds.center.x.toFixed(4),
              y: bounds.center.y.toFixed(4),
              z: bounds.center.z.toFixed(4)
            },
            maxReach: bounds.reach.toFixed(4),
            volume: ((bounds.max.x - bounds.min.x) *
                     (bounds.max.y - bounds.min.y) *
                     (bounds.max.z - bounds.min.z)).toFixed(4)
          },
          samplePoints
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isforwardkinematicsAvailable(): boolean { return true; }
