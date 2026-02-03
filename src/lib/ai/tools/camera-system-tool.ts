/**
 * CAMERA SYSTEM TOOL
 * 2D/3D camera math: viewport, projection, frustum, follow
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Vec2 { x: number; y: number; }
interface Vec3 { x: number; y: number; z: number; }
interface Camera2D { position: Vec2; zoom: number; rotation: number; viewport: { width: number; height: number }; }
interface Camera3D { position: Vec3; target: Vec3; up: Vec3; fov: number; aspect: number; near: number; far: number; }

function createCamera2D(width: number, height: number): Camera2D {
  return { position: { x: 0, y: 0 }, zoom: 1, rotation: 0, viewport: { width, height } };
}

function worldToScreen2D(camera: Camera2D, worldPos: Vec2): Vec2 {
  const cos = Math.cos(-camera.rotation);
  const sin = Math.sin(-camera.rotation);
  const dx = worldPos.x - camera.position.x;
  const dy = worldPos.y - camera.position.y;
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return {
    x: (rx * camera.zoom) + camera.viewport.width / 2,
    y: (ry * camera.zoom) + camera.viewport.height / 2
  };
}

function screenToWorld2D(camera: Camera2D, screenPos: Vec2): Vec2 {
  const cos = Math.cos(camera.rotation);
  const sin = Math.sin(camera.rotation);
  const sx = (screenPos.x - camera.viewport.width / 2) / camera.zoom;
  const sy = (screenPos.y - camera.viewport.height / 2) / camera.zoom;
  const rx = sx * cos - sy * sin;
  const ry = sx * sin + sy * cos;
  return { x: rx + camera.position.x, y: ry + camera.position.y };
}

function getVisibleBounds(camera: Camera2D): { minX: number; maxX: number; minY: number; maxY: number } {
  const halfW = camera.viewport.width / 2 / camera.zoom;
  const halfH = camera.viewport.height / 2 / camera.zoom;
  return {
    minX: camera.position.x - halfW,
    maxX: camera.position.x + halfW,
    minY: camera.position.y - halfH,
    maxY: camera.position.y + halfH
  };
}

function followTarget(camera: Camera2D, target: Vec2, smoothing: number = 0.1): Camera2D {
  return {
    ...camera,
    position: {
      x: camera.position.x + (target.x - camera.position.x) * smoothing,
      y: camera.position.y + (target.y - camera.position.y) * smoothing
    }
  };
}

function createCamera3D(aspect: number = 16/9): Camera3D {
  return {
    position: { x: 0, y: 0, z: 10 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 60,
    aspect,
    near: 0.1,
    far: 1000
  };
}

function perspectiveMatrix(fov: number, aspect: number, near: number, far: number): number[][] {
  const f = 1.0 / Math.tan(fov * Math.PI / 360);
  return [
    [f / aspect, 0, 0, 0],
    [0, f, 0, 0],
    [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)],
    [0, 0, -1, 0]
  ];
}

function orthographicMatrix(left: number, right: number, bottom: number, top: number, near: number, far: number): number[][] {
  return [
    [2 / (right - left), 0, 0, -(right + left) / (right - left)],
    [0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom)],
    [0, 0, -2 / (far - near), -(far + near) / (far - near)],
    [0, 0, 0, 1]
  ];
}

function lookAtMatrix(eye: Vec3, target: Vec3, up: Vec3): number[][] {
  const zAxis = normalize({ x: eye.x - target.x, y: eye.y - target.y, z: eye.z - target.z });
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);
  return [
    [xAxis.x, xAxis.y, xAxis.z, -dot(xAxis, eye)],
    [yAxis.x, yAxis.y, yAxis.z, -dot(yAxis, eye)],
    [zAxis.x, zAxis.y, zAxis.z, -dot(zAxis, eye)],
    [0, 0, 0, 1]
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 0 };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function frustumPlanes(camera: Camera3D): Array<{ normal: Vec3; distance: number }> {
  // Frustum dimensions can be calculated from FOV and aspect ratio if needed
  // const nearH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.near;
  // const nearW = nearH * camera.aspect;
  return [
    { normal: { x: 0, y: 0, z: -1 }, distance: camera.near },
    { normal: { x: 0, y: 0, z: 1 }, distance: camera.far },
    { normal: { x: 1, y: 0, z: 0 }, distance: 0 },
    { normal: { x: -1, y: 0, z: 0 }, distance: 0 },
    { normal: { x: 0, y: 1, z: 0 }, distance: 0 },
    { normal: { x: 0, y: -1, z: 0 }, distance: 0 }
  ];
}

export const cameraSystemTool: UnifiedTool = {
  name: 'camera_system',
  description: 'Camera System: create2d, create3d, transform, follow, projection, frustum',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create2d', 'create3d', 'world_to_screen', 'screen_to_world', 'follow', 'perspective', 'orthographic', 'lookat', 'frustum', 'bounds'] },
      width: { type: 'number' },
      height: { type: 'number' },
      position: { type: 'object' },
      target: { type: 'object' },
      zoom: { type: 'number' },
      fov: { type: 'number' },
      aspect: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeCameraSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'create2d':
        result = { camera: createCamera2D(args.width || 800, args.height || 600) };
        break;
      case 'create3d':
        result = { camera: createCamera3D(args.aspect || 16/9) };
        break;
      case 'world_to_screen':
        const cam2d = createCamera2D(args.width || 800, args.height || 600);
        cam2d.position = args.cameraPos || { x: 0, y: 0 };
        cam2d.zoom = args.zoom || 1;
        const worldPos = args.position || { x: 100, y: 100 };
        result = { worldPosition: worldPos, screenPosition: worldToScreen2D(cam2d, worldPos), camera: cam2d };
        break;
      case 'screen_to_world':
        const cam2 = createCamera2D(args.width || 800, args.height || 600);
        cam2.position = args.cameraPos || { x: 0, y: 0 };
        cam2.zoom = args.zoom || 1;
        const screenPos = args.position || { x: 400, y: 300 };
        result = { screenPosition: screenPos, worldPosition: screenToWorld2D(cam2, screenPos), camera: cam2 };
        break;
      case 'follow':
        let followCam = createCamera2D(args.width || 800, args.height || 600);
        const targetPos = args.target || { x: 200, y: 150 };
        for (let i = 0; i < 10; i++) {
          followCam = followTarget(followCam, targetPos, 0.2);
        }
        result = { target: targetPos, finalPosition: followCam.position, camera: followCam };
        break;
      case 'perspective':
        result = { matrix: perspectiveMatrix(args.fov || 60, args.aspect || 16/9, args.near || 0.1, args.far || 1000) };
        break;
      case 'orthographic':
        result = { matrix: orthographicMatrix(-10, 10, -10, 10, args.near || 0.1, args.far || 1000) };
        break;
      case 'lookat':
        const eye = args.position || { x: 0, y: 0, z: 10 };
        const lookTarget = args.target || { x: 0, y: 0, z: 0 };
        result = { eye, target: lookTarget, matrix: lookAtMatrix(eye, lookTarget, { x: 0, y: 1, z: 0 }) };
        break;
      case 'frustum':
        const cam3d = createCamera3D(args.aspect || 16/9);
        if (args.fov) cam3d.fov = args.fov;
        result = { camera: cam3d, planes: frustumPlanes(cam3d) };
        break;
      case 'bounds':
        const boundsCam = createCamera2D(args.width || 800, args.height || 600);
        boundsCam.position = args.position || { x: 0, y: 0 };
        boundsCam.zoom = args.zoom || 1;
        result = { camera: boundsCam, bounds: getVisibleBounds(boundsCam) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCameraSystemAvailable(): boolean { return true; }
