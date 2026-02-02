/**
 * INVERSE-KINEMATICS TOOL
 * Comprehensive robot inverse kinematics solver
 * Implements analytical IK, numerical IK (Jacobian), and FABRIK algorithm
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const inversekinematicsTool: UnifiedTool = {
  name: 'inverse_kinematics',
  description: 'Robot inverse kinematics solver with analytical, Jacobian, and FABRIK methods',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'analytical_2dof', 'analytical_3dof', 'jacobian', 'fabrik', 'forward_kinematics', 'analyze_workspace'],
        description: 'Operation to perform'
      },
      targetPosition: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' }
        },
        description: 'Target end-effector position'
      },
      targetOrientation: {
        type: 'object',
        properties: {
          roll: { type: 'number' },
          pitch: { type: 'number' },
          yaw: { type: 'number' }
        },
        description: 'Target end-effector orientation (radians)'
      },
      linkLengths: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of link lengths'
      },
      jointAngles: {
        type: 'array',
        items: { type: 'number' },
        description: 'Current or initial joint angles (radians)'
      },
      jointLimits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' }
          }
        },
        description: 'Joint angle limits'
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum iterations for iterative methods (default: 100)'
      },
      tolerance: {
        type: 'number',
        description: 'Convergence tolerance (default: 0.001)'
      }
    },
    required: ['operation']
  }
};

// 3D vector operations
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function addVec(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subVec(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scaleVec(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vector3): Vector3 {
  const mag = magnitude(v);
  if (mag < 1e-10) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

function distance(a: Vector3, b: Vector3): number {
  return magnitude(subVec(a, b));
}

// 2-DOF planar arm analytical IK
function analytical2DOF(
  target: { x: number; y: number },
  L1: number,
  L2: number,
  elbowUp: boolean = true
): { success: boolean; theta1: number; theta2: number; analysis: object } {
  const x = target.x;
  const y = target.y;

  // Distance to target
  const D = Math.sqrt(x * x + y * y);

  // Check reachability
  if (D > L1 + L2) {
    return {
      success: false,
      theta1: 0,
      theta2: 0,
      analysis: {
        error: 'Target unreachable - outside workspace',
        maxReach: L1 + L2,
        targetDistance: D
      }
    };
  }

  if (D < Math.abs(L1 - L2)) {
    return {
      success: false,
      theta1: 0,
      theta2: 0,
      analysis: {
        error: 'Target unreachable - inside minimum reach',
        minReach: Math.abs(L1 - L2),
        targetDistance: D
      }
    };
  }

  // Cosine law for elbow angle
  const cosTheta2 = (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const theta2 = elbowUp ? Math.acos(cosTheta2) : -Math.acos(cosTheta2);

  // Shoulder angle
  const k1 = L1 + L2 * Math.cos(theta2);
  const k2 = L2 * Math.sin(theta2);
  const theta1 = Math.atan2(y, x) - Math.atan2(k2, k1);

  return {
    success: true,
    theta1,
    theta2,
    analysis: {
      configuration: elbowUp ? 'Elbow up' : 'Elbow down',
      targetDistance: D.toFixed(4),
      workspaceUtilization: ((D / (L1 + L2)) * 100).toFixed(1) + '%',
      jointAngles: {
        theta1Deg: (theta1 * 180 / Math.PI).toFixed(2),
        theta2Deg: (theta2 * 180 / Math.PI).toFixed(2)
      }
    }
  };
}

// 3-DOF arm with 2 planar joints and 1 wrist
function analytical3DOF(
  target: Vector3,
  L1: number,
  L2: number,
  L3: number,
  elbowUp: boolean = true
): { success: boolean; angles: number[]; analysis: object } {
  // Base rotation (around Z axis)
  const theta1 = Math.atan2(target.y, target.x);

  // Project to planar problem
  const r = Math.sqrt(target.x * target.x + target.y * target.y);
  const wristZ = target.z - L3; // Assume wrist points down

  // Distance to wrist in r-z plane
  const D = Math.sqrt(r * r + wristZ * wristZ);

  // Check reachability
  if (D > L1 + L2) {
    return {
      success: false,
      angles: [0, 0, 0],
      analysis: { error: 'Target unreachable', maxReach: L1 + L2, targetDistance: D }
    };
  }

  // Elbow angle
  const cosTheta3 = (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const clampedCos = Math.max(-1, Math.min(1, cosTheta3));
  const theta3 = elbowUp ? Math.acos(clampedCos) : -Math.acos(clampedCos);

  // Shoulder angle
  const alpha = Math.atan2(wristZ, r);
  const beta = Math.atan2(L2 * Math.sin(theta3), L1 + L2 * Math.cos(theta3));
  const theta2 = alpha - (elbowUp ? beta : -beta);

  return {
    success: true,
    angles: [theta1, theta2, theta3],
    analysis: {
      configuration: elbowUp ? 'Elbow up' : 'Elbow down',
      jointAnglesDeg: {
        base: (theta1 * 180 / Math.PI).toFixed(2),
        shoulder: (theta2 * 180 / Math.PI).toFixed(2),
        elbow: (theta3 * 180 / Math.PI).toFixed(2)
      }
    }
  };
}

// Jacobian-based numerical IK
function jacobianIK(
  target: Vector3,
  linkLengths: number[],
  initialAngles: number[],
  jointLimits: { min: number; max: number }[] | null,
  maxIterations: number,
  tolerance: number
): { success: boolean; angles: number[]; iterations: number; error: number; analysis: object } {
  const n = linkLengths.length;
  const angles = [...initialAngles];

  // Ensure we have enough initial angles
  while (angles.length < n) {
    angles.push(0);
  }

  // Forward kinematics for current position
  function forwardKinematics(theta: number[]): Vector3 {
    const pos: Vector3 = { x: 0, y: 0, z: 0 };
    let cumAngle = 0;

    for (let i = 0; i < n; i++) {
      cumAngle += theta[i];
      pos.x += linkLengths[i] * Math.cos(cumAngle);
      pos.y += linkLengths[i] * Math.sin(cumAngle);
    }

    return pos;
  }

  // Compute Jacobian
  function computeJacobian(theta: number[]): number[][] {
    const J: number[][] = [[], []];

    for (let j = 0; j < n; j++) {
      let cumAngle = 0;
      for (let k = 0; k <= j; k++) {
        cumAngle += theta[k];
      }

      let dx = 0, dy = 0;
      let partialAngle = cumAngle;
      for (let k = j; k < n; k++) {
        dx -= linkLengths[k] * Math.sin(partialAngle);
        dy += linkLengths[k] * Math.cos(partialAngle);
        if (k < n - 1) partialAngle += theta[k + 1];
      }

      J[0][j] = dx;
      J[1][j] = dy;
    }

    return J;
  }

  // Damped least squares (pseudoinverse with damping)
  function dampedPseudoinverse(J: number[][], lambda: number = 0.01): number[][] {
    const m = J.length;
    const n = J[0].length;

    // J^T
    const JT: number[][] = [];
    for (let j = 0; j < n; j++) {
      JT[j] = [];
      for (let i = 0; i < m; i++) {
        JT[j][i] = J[i][j];
      }
    }

    // J * J^T + lambda^2 * I
    const JJT: number[][] = [];
    for (let i = 0; i < m; i++) {
      JJT[i] = [];
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += J[i][k] * JT[k][j];
        }
        JJT[i][j] = sum + (i === j ? lambda * lambda : 0);
      }
    }

    // Invert 2x2 matrix (assuming 2D case)
    const det = JJT[0][0] * JJT[1][1] - JJT[0][1] * JJT[1][0];
    if (Math.abs(det) < 1e-10) {
      // Singular, return small movement
      return JT.map(row => row.map(v => v * 0.01));
    }

    const invJJT = [
      [JJT[1][1] / det, -JJT[0][1] / det],
      [-JJT[1][0] / det, JJT[0][0] / det]
    ];

    // J^T * inv(J * J^T)
    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      result[i] = [];
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
          sum += JT[i][k] * invJJT[k][j];
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  const iterationHistory: { iteration: number; error: number }[] = [];
  let iteration = 0;
  let currentError = Infinity;

  while (iteration < maxIterations) {
    const currentPos = forwardKinematics(angles);
    const error = [target.x - currentPos.x, target.y - currentPos.y];
    currentError = Math.sqrt(error[0] * error[0] + error[1] * error[1]);

    if (iteration % 10 === 0) {
      iterationHistory.push({ iteration, error: currentError });
    }

    if (currentError < tolerance) {
      break;
    }

    const J = computeJacobian(angles);
    const Jinv = dampedPseudoinverse(J);

    // Update angles
    for (let i = 0; i < n; i++) {
      angles[i] += Jinv[i][0] * error[0] + Jinv[i][1] * error[1];

      // Apply joint limits
      if (jointLimits && jointLimits[i]) {
        angles[i] = Math.max(jointLimits[i].min, Math.min(jointLimits[i].max, angles[i]));
      }
    }

    iteration++;
  }

  return {
    success: currentError < tolerance,
    angles,
    iterations: iteration,
    error: currentError,
    analysis: {
      method: 'Damped Least Squares (Jacobian Pseudoinverse)',
      converged: currentError < tolerance,
      finalError: currentError.toFixed(6),
      iterationsUsed: iteration,
      jointAnglesDeg: angles.map(a => (a * 180 / Math.PI).toFixed(2)),
      convergenceHistory: iterationHistory
    }
  };
}

// FABRIK (Forward And Backward Reaching Inverse Kinematics)
function fabrikIK(
  target: Vector3,
  linkLengths: number[],
  basePosition: Vector3,
  maxIterations: number,
  tolerance: number
): { success: boolean; jointPositions: Vector3[]; iterations: number; error: number; analysis: object } {
  const n = linkLengths.length;

  // Initialize joint positions along X axis
  const joints: Vector3[] = [{ ...basePosition }];
  let currentPos = { ...basePosition };
  for (let i = 0; i < n; i++) {
    currentPos = { x: currentPos.x + linkLengths[i], y: currentPos.y, z: currentPos.z };
    joints.push({ ...currentPos });
  }

  // Total chain length
  const totalLength = linkLengths.reduce((a, b) => a + b, 0);
  const targetDist = distance(basePosition, target);

  // Check if target is reachable
  if (targetDist > totalLength) {
    // Target unreachable, stretch toward it
    const direction = normalize(subVec(target, basePosition));
    let pos = { ...basePosition };
    joints[0] = pos;
    for (let i = 0; i < n; i++) {
      pos = addVec(pos, scaleVec(direction, linkLengths[i]));
      joints[i + 1] = pos;
    }
    return {
      success: false,
      jointPositions: joints,
      iterations: 0,
      error: targetDist - totalLength,
      analysis: {
        error: 'Target unreachable',
        totalLength,
        targetDistance: targetDist
      }
    };
  }

  let iteration = 0;
  let error = distance(joints[n], target);

  while (iteration < maxIterations && error > tolerance) {
    // Forward reaching (from end effector to base)
    joints[n] = { ...target };
    for (let i = n - 1; i >= 0; i--) {
      const direction = normalize(subVec(joints[i], joints[i + 1]));
      joints[i] = addVec(joints[i + 1], scaleVec(direction, linkLengths[i]));
    }

    // Backward reaching (from base to end effector)
    joints[0] = { ...basePosition };
    for (let i = 0; i < n; i++) {
      const direction = normalize(subVec(joints[i + 1], joints[i]));
      joints[i + 1] = addVec(joints[i], scaleVec(direction, linkLengths[i]));
    }

    error = distance(joints[n], target);
    iteration++;
  }

  // Calculate joint angles from positions
  const angles: number[] = [];
  for (let i = 0; i < n; i++) {
    const direction = subVec(joints[i + 1], joints[i]);
    const angle = Math.atan2(direction.y, direction.x);
    angles.push(i === 0 ? angle : angle - angles.slice(0, i).reduce((a, b) => a + b, 0));
  }

  return {
    success: error <= tolerance,
    jointPositions: joints,
    iterations: iteration,
    error,
    analysis: {
      method: 'FABRIK',
      converged: error <= tolerance,
      finalError: error.toFixed(6),
      iterationsUsed: iteration,
      jointAnglesRad: angles.map(a => a.toFixed(4)),
      jointAnglesDeg: angles.map(a => (a * 180 / Math.PI).toFixed(2))
    }
  };
}

// Forward kinematics
function forwardKinematics(
  linkLengths: number[],
  jointAngles: number[]
): { endEffector: Vector3; jointPositions: Vector3[] } {
  const joints: Vector3[] = [{ x: 0, y: 0, z: 0 }];
  let cumAngle = 0;
  let currentPos: Vector3 = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < linkLengths.length; i++) {
    cumAngle += jointAngles[i] || 0;
    currentPos = {
      x: currentPos.x + linkLengths[i] * Math.cos(cumAngle),
      y: currentPos.y + linkLengths[i] * Math.sin(cumAngle),
      z: 0
    };
    joints.push({ ...currentPos });
  }

  return {
    endEffector: currentPos,
    jointPositions: joints
  };
}

// Workspace analysis
function analyzeWorkspace(
  linkLengths: number[],
  jointLimits: { min: number; max: number }[] | null,
  resolution: number = 36
): object {
  const totalLength = linkLengths.reduce((a, b) => a + b, 0);
  const minReach = Math.abs(linkLengths.reduce((a, b, i) =>
    i === 0 ? b : (i % 2 === 0 ? a + b : a - b), 0
  ));

  // Sample workspace points
  const workspacePoints: { x: number; y: number }[] = [];
  const n = linkLengths.length;

  // Generate angle combinations
  function sampleAngles(limits: { min: number; max: number }[]): number[][] {
    const samples: number[][] = [[]];

    for (let i = 0; i < n; i++) {
      const newSamples: number[][] = [];
      const min = limits[i]?.min ?? -Math.PI;
      const max = limits[i]?.max ?? Math.PI;
      const step = (max - min) / resolution;

      for (const sample of samples) {
        for (let angle = min; angle <= max; angle += step) {
          newSamples.push([...sample, angle]);
        }
      }
      samples.length = 0;
      samples.push(...newSamples);
      if (samples.length > 10000) break; // Limit samples
    }

    return samples;
  }

  const limits = jointLimits || linkLengths.map(() => ({ min: -Math.PI, max: Math.PI }));
  const angleSamples = sampleAngles(limits.slice(0, Math.min(n, 3))); // Limit to 3 joints for performance

  for (const angles of angleSamples.slice(0, 5000)) {
    const fk = forwardKinematics(linkLengths, angles);
    workspacePoints.push({ x: fk.endEffector.x, y: fk.endEffector.y });
  }

  // Find workspace bounds
  const xMin = Math.min(...workspacePoints.map(p => p.x));
  const xMax = Math.max(...workspacePoints.map(p => p.x));
  const yMin = Math.min(...workspacePoints.map(p => p.y));
  const yMax = Math.max(...workspacePoints.map(p => p.y));

  // Calculate manipulability (rough estimate)
  const workspaceArea = (xMax - xMin) * (yMax - yMin);
  const theoreticalMaxArea = Math.PI * totalLength * totalLength;

  return {
    links: linkLengths.length,
    linkLengths,
    reach: {
      maximum: totalLength.toFixed(4),
      minimum: minReach.toFixed(4)
    },
    workspaceBounds: {
      x: { min: xMin.toFixed(4), max: xMax.toFixed(4) },
      y: { min: yMin.toFixed(4), max: yMax.toFixed(4) }
    },
    workspaceAnalysis: {
      sampledPoints: workspacePoints.length,
      approximateArea: workspaceArea.toFixed(4),
      theoreticalMaxArea: theoreticalMaxArea.toFixed(4),
      workspaceUtilization: ((workspaceArea / theoreticalMaxArea) * 100).toFixed(1) + '%'
    },
    jointLimits: limits.map((l, i) => ({
      joint: i + 1,
      minDeg: (l.min * 180 / Math.PI).toFixed(1),
      maxDeg: (l.max * 180 / Math.PI).toFixed(1)
    }))
  };
}

export async function executeinversekinematics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      targetPosition = { x: 0, y: 0, z: 0 },
      linkLengths = [1, 1],
      jointAngles = [],
      jointLimits = null,
      maxIterations = 100,
      tolerance = 0.001
    } = args;

    let result: object = {};

    switch (operation) {
      case 'info':
        result = {
          tool: 'inverse_kinematics',
          description: 'Comprehensive inverse kinematics solver for robot manipulators',
          methods: {
            analytical_2dof: 'Closed-form solution for 2-link planar arm',
            analytical_3dof: 'Closed-form solution for 3-link arm with base rotation',
            jacobian: 'Numerical IK using Jacobian pseudoinverse with damping',
            fabrik: 'FABRIK algorithm - fast iterative method'
          },
          parameters: {
            targetPosition: 'Desired end-effector position {x, y, z}',
            linkLengths: 'Array of link lengths',
            jointAngles: 'Initial angles for iterative methods',
            jointLimits: 'Array of {min, max} for each joint',
            tolerance: 'Convergence threshold for iterative methods'
          },
          operations: [
            'analytical_2dof - 2-DOF planar IK',
            'analytical_3dof - 3-DOF spatial IK',
            'jacobian - Jacobian-based numerical IK',
            'fabrik - FABRIK iterative IK',
            'forward_kinematics - Compute end-effector from angles',
            'analyze_workspace - Analyze reachable workspace'
          ]
        };
        break;

      case 'examples':
        result = {
          planar2DOF: {
            description: '2-link planar arm IK',
            parameters: {
              operation: 'analytical_2dof',
              targetPosition: { x: 1.5, y: 0.5 },
              linkLengths: [1, 1]
            }
          },
          jacobianIK: {
            description: 'Multi-joint Jacobian IK',
            parameters: {
              operation: 'jacobian',
              targetPosition: { x: 2, y: 1 },
              linkLengths: [1, 0.8, 0.6],
              jointAngles: [0, 0, 0]
            }
          },
          fabrikIK: {
            description: 'FABRIK algorithm',
            parameters: {
              operation: 'fabrik',
              targetPosition: { x: 1.8, y: 0.8 },
              linkLengths: [1, 1, 0.5, 0.5]
            }
          }
        };
        break;

      case 'demo':
        const demoTarget = { x: 1.2, y: 0.8 };
        const demoLinks = [1, 0.8];
        const demoResult = analytical2DOF(demoTarget, demoLinks[0], demoLinks[1], true);

        // Verify with forward kinematics
        const fkResult = forwardKinematics(demoLinks, [demoResult.theta1, demoResult.theta2]);

        result = {
          demo: '2-DOF planar arm inverse kinematics',
          target: demoTarget,
          linkLengths: demoLinks,
          solution: {
            theta1: (demoResult.theta1 * 180 / Math.PI).toFixed(2) + '°',
            theta2: (demoResult.theta2 * 180 / Math.PI).toFixed(2) + '°'
          },
          verification: {
            computedEndEffector: {
              x: fkResult.endEffector.x.toFixed(4),
              y: fkResult.endEffector.y.toFixed(4)
            },
            error: distance(
              { x: demoTarget.x, y: demoTarget.y, z: 0 },
              fkResult.endEffector
            ).toFixed(6)
          },
          analysis: demoResult.analysis
        };
        break;

      case 'analytical_2dof':
        if (linkLengths.length < 2) {
          throw new Error('Need at least 2 link lengths for 2-DOF IK');
        }

        const ik2dof = analytical2DOF(
          { x: targetPosition.x, y: targetPosition.y },
          linkLengths[0],
          linkLengths[1],
          args.elbowUp !== false
        );

        result = {
          operation: 'analytical_2dof',
          success: ik2dof.success,
          jointAngles: {
            theta1Rad: ik2dof.theta1.toFixed(6),
            theta2Rad: ik2dof.theta2.toFixed(6),
            theta1Deg: (ik2dof.theta1 * 180 / Math.PI).toFixed(2),
            theta2Deg: (ik2dof.theta2 * 180 / Math.PI).toFixed(2)
          },
          analysis: ik2dof.analysis
        };
        break;

      case 'analytical_3dof':
        if (linkLengths.length < 3) {
          throw new Error('Need at least 3 link lengths for 3-DOF IK');
        }

        const ik3dof = analytical3DOF(
          targetPosition,
          linkLengths[0],
          linkLengths[1],
          linkLengths[2],
          args.elbowUp !== false
        );

        result = {
          operation: 'analytical_3dof',
          success: ik3dof.success,
          jointAngles: ik3dof.angles.map((a, i) => ({
            joint: i + 1,
            radians: a.toFixed(6),
            degrees: (a * 180 / Math.PI).toFixed(2)
          })),
          analysis: ik3dof.analysis
        };
        break;

      case 'jacobian':
        const jacobianResult = jacobianIK(
          targetPosition,
          linkLengths,
          jointAngles.length > 0 ? jointAngles : linkLengths.map(() => 0),
          jointLimits,
          maxIterations,
          tolerance
        );

        result = {
          operation: 'jacobian',
          success: jacobianResult.success,
          jointAngles: jacobianResult.angles.map((a, i) => ({
            joint: i + 1,
            radians: a.toFixed(6),
            degrees: (a * 180 / Math.PI).toFixed(2)
          })),
          iterations: jacobianResult.iterations,
          finalError: jacobianResult.error.toFixed(6),
          analysis: jacobianResult.analysis
        };
        break;

      case 'fabrik':
        const fabrikResult = fabrikIK(
          targetPosition,
          linkLengths,
          { x: 0, y: 0, z: 0 },
          maxIterations,
          tolerance
        );

        result = {
          operation: 'fabrik',
          success: fabrikResult.success,
          jointPositions: fabrikResult.jointPositions.map((p, i) => ({
            joint: i,
            x: p.x.toFixed(4),
            y: p.y.toFixed(4),
            z: p.z.toFixed(4)
          })),
          iterations: fabrikResult.iterations,
          finalError: fabrikResult.error.toFixed(6),
          analysis: fabrikResult.analysis
        };
        break;

      case 'forward_kinematics':
        const fk = forwardKinematics(linkLengths, jointAngles);

        result = {
          operation: 'forward_kinematics',
          endEffector: {
            x: fk.endEffector.x.toFixed(6),
            y: fk.endEffector.y.toFixed(6),
            z: fk.endEffector.z.toFixed(6)
          },
          jointPositions: fk.jointPositions.map((p, i) => ({
            joint: i,
            x: p.x.toFixed(4),
            y: p.y.toFixed(4)
          })),
          inputAngles: jointAngles.map((a, i) => ({
            joint: i + 1,
            radians: a.toFixed(4),
            degrees: (a * 180 / Math.PI).toFixed(2)
          }))
        };
        break;

      case 'analyze_workspace':
        result = {
          operation: 'analyze_workspace',
          analysis: analyzeWorkspace(linkLengths, jointLimits)
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'analytical_2dof', 'analytical_3dof', 'jacobian', 'fabrik', 'forward_kinematics', 'analyze_workspace']
        };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error: ${err}`,
      isError: true
    };
  }
}

export function isinversekinematicsAvailable(): boolean {
  return true;
}
