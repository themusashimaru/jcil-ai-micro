/**
 * RAY TRACING TOOL
 *
 * Educational ray tracing: ray-sphere intersection,
 * ray-plane intersection, reflections, and simple scenes.
 *
 * Part of TIER ADVANCED SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// VECTOR MATH
// ============================================================================

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (v: Vec3): number => Math.sqrt(dot(v, v));
const normalize = (v: Vec3): Vec3 => mul(v, 1 / length(v));
const reflect = (v: Vec3, n: Vec3): Vec3 => sub(v, mul(n, 2 * dot(v, n)));

// ============================================================================
// RAY
// ============================================================================

interface Ray {
  origin: Vec3;
  direction: Vec3;
}

function pointOnRay(ray: Ray, t: number): Vec3 {
  return add(ray.origin, mul(ray.direction, t));
}

// ============================================================================
// INTERSECTIONS
// ============================================================================

interface Hit {
  t: number;
  point: Vec3;
  normal: Vec3;
  objectType: string;
  objectId: number;
}

function raySphereIntersect(ray: Ray, center: Vec3, radius: number): number | null {
  const oc = sub(ray.origin, center);
  const a = dot(ray.direction, ray.direction);
  const b = 2 * dot(oc, ray.direction);
  const c = dot(oc, oc) - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return null;

  const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

  if (t1 > 0.001) return t1;
  if (t2 > 0.001) return t2;
  return null;
}

function rayPlaneIntersect(ray: Ray, point: Vec3, normal: Vec3): number | null {
  const denom = dot(normal, ray.direction);
  if (Math.abs(denom) < 0.0001) return null;

  const t = dot(sub(point, ray.origin), normal) / denom;
  return t > 0.001 ? t : null;
}

function rayBoxIntersect(ray: Ray, min: Vec3, max: Vec3): number | null {
  let tmin = (min.x - ray.origin.x) / ray.direction.x;
  let tmax = (max.x - ray.origin.x) / ray.direction.x;
  if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

  let tymin = (min.y - ray.origin.y) / ray.direction.y;
  let tymax = (max.y - ray.origin.y) / ray.direction.y;
  if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

  if (tmin > tymax || tymin > tmax) return null;
  if (tymin > tmin) tmin = tymin;
  if (tymax < tmax) tmax = tymax;

  let tzmin = (min.z - ray.origin.z) / ray.direction.z;
  let tzmax = (max.z - ray.origin.z) / ray.direction.z;
  if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

  if (tmin > tzmax || tzmin > tmax) return null;
  if (tzmin > tmin) tmin = tzmin;

  return tmin > 0.001 ? tmin : null;
}

function rayTriangleIntersect(ray: Ray, v0: Vec3, v1: Vec3, v2: Vec3): number | null {
  const edge1 = sub(v1, v0);
  const edge2 = sub(v2, v0);
  const h = cross(ray.direction, edge2);
  const a = dot(edge1, h);

  if (Math.abs(a) < 0.0001) return null;

  const f = 1 / a;
  const s = sub(ray.origin, v0);
  const u = f * dot(s, h);

  if (u < 0 || u > 1) return null;

  const q = cross(s, edge1);
  const v = f * dot(ray.direction, q);

  if (v < 0 || u + v > 1) return null;

  const t = f * dot(edge2, q);
  return t > 0.001 ? t : null;
}

// ============================================================================
// SCENE
// ============================================================================

interface Sphere {
  type: 'sphere';
  center: Vec3;
  radius: number;
  color: Vec3;
  reflectivity: number;
}

interface Plane {
  type: 'plane';
  point: Vec3;
  normal: Vec3;
  color: Vec3;
  reflectivity: number;
}

interface Box {
  type: 'box';
  min: Vec3;
  max: Vec3;
  color: Vec3;
  reflectivity: number;
}

type SceneObject = Sphere | Plane | Box;

interface Light {
  position: Vec3;
  intensity: number;
}

interface Scene {
  objects: SceneObject[];
  lights: Light[];
  ambient: number;
  background: Vec3;
}

function traceRay(ray: Ray, scene: Scene, depth: number = 0): Vec3 {
  if (depth > 3) return scene.background;

  let closest: Hit | null = null;
  let closestObj: SceneObject | null = null;

  for (let i = 0; i < scene.objects.length; i++) {
    const obj = scene.objects[i];
    let t: number | null = null;

    switch (obj.type) {
      case 'sphere':
        t = raySphereIntersect(ray, obj.center, obj.radius);
        if (t !== null && (closest === null || t < closest.t)) {
          const point = pointOnRay(ray, t);
          closest = {
            t,
            point,
            normal: normalize(sub(point, obj.center)),
            objectType: 'sphere',
            objectId: i,
          };
          closestObj = obj;
        }
        break;
      case 'plane':
        t = rayPlaneIntersect(ray, obj.point, obj.normal);
        if (t !== null && (closest === null || t < closest.t)) {
          closest = {
            t,
            point: pointOnRay(ray, t),
            normal: obj.normal,
            objectType: 'plane',
            objectId: i,
          };
          closestObj = obj;
        }
        break;
      case 'box':
        t = rayBoxIntersect(ray, obj.min, obj.max);
        if (t !== null && (closest === null || t < closest.t)) {
          const point = pointOnRay(ray, t);
          // Simple normal calculation for box
          let normal = vec3(0, 1, 0);
          const eps = 0.001;
          if (Math.abs(point.x - obj.min.x) < eps) normal = vec3(-1, 0, 0);
          else if (Math.abs(point.x - obj.max.x) < eps) normal = vec3(1, 0, 0);
          else if (Math.abs(point.y - obj.min.y) < eps) normal = vec3(0, -1, 0);
          else if (Math.abs(point.y - obj.max.y) < eps) normal = vec3(0, 1, 0);
          else if (Math.abs(point.z - obj.min.z) < eps) normal = vec3(0, 0, -1);
          else if (Math.abs(point.z - obj.max.z) < eps) normal = vec3(0, 0, 1);
          closest = { t, point, normal, objectType: 'box', objectId: i };
          closestObj = obj;
        }
        break;
    }
  }

  if (!closest || !closestObj) return scene.background;

  // Lighting
  let color = mul(closestObj.color, scene.ambient);

  for (const light of scene.lights) {
    const toLight = normalize(sub(light.position, closest.point));
    const shadowRay: Ray = { origin: add(closest.point, mul(closest.normal, 0.001)), direction: toLight };

    // Check shadow
    let inShadow = false;
    const lightDist = length(sub(light.position, closest.point));
    for (const obj of scene.objects) {
      let t: number | null = null;
      switch (obj.type) {
        case 'sphere':
          t = raySphereIntersect(shadowRay, obj.center, obj.radius);
          break;
        case 'plane':
          t = rayPlaneIntersect(shadowRay, obj.point, obj.normal);
          break;
        case 'box':
          t = rayBoxIntersect(shadowRay, obj.min, obj.max);
          break;
      }
      if (t !== null && t < lightDist) {
        inShadow = true;
        break;
      }
    }

    if (!inShadow) {
      const diffuse = Math.max(0, dot(closest.normal, toLight));
      color = add(color, mul(closestObj.color, diffuse * light.intensity));
    }
  }

  // Reflection
  if (closestObj.reflectivity > 0 && depth < 3) {
    const reflDir = reflect(ray.direction, closest.normal);
    const reflRay: Ray = { origin: add(closest.point, mul(closest.normal, 0.001)), direction: reflDir };
    const reflColor = traceRay(reflRay, scene, depth + 1);
    color = add(mul(color, 1 - closestObj.reflectivity), mul(reflColor, closestObj.reflectivity));
  }

  // Clamp
  return vec3(
    Math.min(1, Math.max(0, color.x)),
    Math.min(1, Math.max(0, color.y)),
    Math.min(1, Math.max(0, color.z))
  );
}

// ============================================================================
// RENDERING
// ============================================================================

function renderScene(scene: Scene, width: number, height: number, camera: { pos: Vec3; lookAt: Vec3; fov: number }): string {
  const chars = ' .:-=+*#%@';
  const aspect = width / height;
  const fovRad = camera.fov * Math.PI / 180;

  const forward = normalize(sub(camera.lookAt, camera.pos));
  const right = normalize(cross(forward, vec3(0, 1, 0)));
  const up = cross(right, forward);

  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const px = (2 * (x + 0.5) / width - 1) * Math.tan(fovRad / 2) * aspect;
      const py = (1 - 2 * (y + 0.5) / height) * Math.tan(fovRad / 2);

      const dir = normalize(add(add(forward, mul(right, px)), mul(up, py)));
      const ray: Ray = { origin: camera.pos, direction: dir };

      const color = traceRay(ray, scene);
      const brightness = 0.299 * color.x + 0.587 * color.y + 0.114 * color.z;
      const charIdx = Math.min(Math.floor(brightness * chars.length), chars.length - 1);
      line += chars[charIdx];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// ============================================================================
// DEFAULT SCENE
// ============================================================================

function createDefaultScene(): Scene {
  return {
    objects: [
      { type: 'sphere', center: vec3(0, 1, 0), radius: 1, color: vec3(1, 0.3, 0.3), reflectivity: 0.3 },
      { type: 'sphere', center: vec3(-2, 0.5, 1), radius: 0.5, color: vec3(0.3, 1, 0.3), reflectivity: 0.5 },
      { type: 'sphere', center: vec3(2, 0.7, -1), radius: 0.7, color: vec3(0.3, 0.3, 1), reflectivity: 0.2 },
      { type: 'plane', point: vec3(0, 0, 0), normal: vec3(0, 1, 0), color: vec3(0.5, 0.5, 0.5), reflectivity: 0.1 },
    ],
    lights: [
      { position: vec3(5, 10, 5), intensity: 0.8 },
      { position: vec3(-5, 5, -5), intensity: 0.4 },
    ],
    ambient: 0.1,
    background: vec3(0.1, 0.1, 0.2),
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const rayTracingTool: UnifiedTool = {
  name: 'ray_tracing',
  description: `Educational ray tracing renderer.

Operations:
- intersect_sphere: Test ray-sphere intersection
- intersect_plane: Test ray-plane intersection
- intersect_box: Test ray-box intersection
- intersect_triangle: Test ray-triangle intersection
- render: Render ASCII scene with spheres and planes
- trace: Trace single ray through scene`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['intersect_sphere', 'intersect_plane', 'intersect_box', 'intersect_triangle', 'render', 'trace'],
        description: 'Ray tracing operation',
      },
      ray_origin: { type: 'string', description: 'Ray origin [x,y,z]' },
      ray_direction: { type: 'string', description: 'Ray direction [x,y,z]' },
      sphere_center: { type: 'string', description: 'Sphere center [x,y,z]' },
      sphere_radius: { type: 'number', description: 'Sphere radius' },
      plane_point: { type: 'string', description: 'Point on plane [x,y,z]' },
      plane_normal: { type: 'string', description: 'Plane normal [x,y,z]' },
      box_min: { type: 'string', description: 'Box min corner [x,y,z]' },
      box_max: { type: 'string', description: 'Box max corner [x,y,z]' },
      triangle: { type: 'string', description: 'Triangle vertices [[x,y,z], [x,y,z], [x,y,z]]' },
      width: { type: 'number', description: 'Render width' },
      height: { type: 'number', description: 'Render height' },
      camera_pos: { type: 'string', description: 'Camera position [x,y,z]' },
      camera_lookat: { type: 'string', description: 'Camera look-at [x,y,z]' },
      fov: { type: 'number', description: 'Field of view degrees' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeRayTracing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    const parseVec = (s: string, def: Vec3 = vec3(0, 0, 0)): Vec3 => {
      try {
        const arr = JSON.parse(s);
        return vec3(arr[0], arr[1], arr[2]);
      } catch {
        return def;
      }
    };

    let result: Record<string, unknown>;

    switch (operation) {
      case 'intersect_sphere': {
        const origin = parseVec(args.ray_origin || '[0,0,-5]');
        const direction = normalize(parseVec(args.ray_direction || '[0,0,1]'));
        const center = parseVec(args.sphere_center || '[0,0,0]');
        const radius = args.sphere_radius ?? 1;

        const ray: Ray = { origin, direction };
        const t = raySphereIntersect(ray, center, radius);

        if (t !== null) {
          const point = pointOnRay(ray, t);
          const normal = normalize(sub(point, center));
          result = {
            operation: 'intersect_sphere',
            hit: true,
            t: Math.round(t * 1000) / 1000,
            intersection_point: { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000, z: Math.round(point.z * 1000) / 1000 },
            surface_normal: { x: Math.round(normal.x * 1000) / 1000, y: Math.round(normal.y * 1000) / 1000, z: Math.round(normal.z * 1000) / 1000 },
            ray: { origin, direction },
            sphere: { center, radius },
          };
        } else {
          result = { operation: 'intersect_sphere', hit: false, ray: { origin, direction }, sphere: { center, radius } };
        }
        break;
      }

      case 'intersect_plane': {
        const origin = parseVec(args.ray_origin || '[0,5,0]');
        const direction = normalize(parseVec(args.ray_direction || '[0,-1,0]'));
        const point = parseVec(args.plane_point || '[0,0,0]');
        const normal = normalize(parseVec(args.plane_normal || '[0,1,0]'));

        const ray: Ray = { origin, direction };
        const t = rayPlaneIntersect(ray, point, normal);

        if (t !== null) {
          const hitPoint = pointOnRay(ray, t);
          result = {
            operation: 'intersect_plane',
            hit: true,
            t: Math.round(t * 1000) / 1000,
            intersection_point: { x: Math.round(hitPoint.x * 1000) / 1000, y: Math.round(hitPoint.y * 1000) / 1000, z: Math.round(hitPoint.z * 1000) / 1000 },
            surface_normal: normal,
          };
        } else {
          result = { operation: 'intersect_plane', hit: false, reason: 'Ray parallel to plane or pointing away' };
        }
        break;
      }

      case 'intersect_box': {
        const origin = parseVec(args.ray_origin || '[0,0,-5]');
        const direction = normalize(parseVec(args.ray_direction || '[0,0,1]'));
        const min = parseVec(args.box_min || '[-1,-1,-1]');
        const max = parseVec(args.box_max || '[1,1,1]');

        const ray: Ray = { origin, direction };
        const t = rayBoxIntersect(ray, min, max);

        if (t !== null) {
          const point = pointOnRay(ray, t);
          result = {
            operation: 'intersect_box',
            hit: true,
            t: Math.round(t * 1000) / 1000,
            intersection_point: { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000, z: Math.round(point.z * 1000) / 1000 },
            box: { min, max },
          };
        } else {
          result = { operation: 'intersect_box', hit: false, box: { min, max } };
        }
        break;
      }

      case 'intersect_triangle': {
        const origin = parseVec(args.ray_origin || '[0,0,-5]');
        const direction = normalize(parseVec(args.ray_direction || '[0,0,1]'));
        const tri = JSON.parse(args.triangle || '[[-1,0,0], [1,0,0], [0,2,0]]');
        const v0 = vec3(tri[0][0], tri[0][1], tri[0][2]);
        const v1 = vec3(tri[1][0], tri[1][1], tri[1][2]);
        const v2 = vec3(tri[2][0], tri[2][1], tri[2][2]);

        const ray: Ray = { origin, direction };
        const t = rayTriangleIntersect(ray, v0, v1, v2);

        if (t !== null) {
          const point = pointOnRay(ray, t);
          const normal = normalize(cross(sub(v1, v0), sub(v2, v0)));
          result = {
            operation: 'intersect_triangle',
            hit: true,
            t: Math.round(t * 1000) / 1000,
            intersection_point: { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000, z: Math.round(point.z * 1000) / 1000 },
            surface_normal: { x: Math.round(normal.x * 1000) / 1000, y: Math.round(normal.y * 1000) / 1000, z: Math.round(normal.z * 1000) / 1000 },
          };
        } else {
          result = { operation: 'intersect_triangle', hit: false };
        }
        break;
      }

      case 'render': {
        const width = args.width ?? 60;
        const height = args.height ?? 25;
        const camPos = parseVec(args.camera_pos || '[0,3,-8]');
        const lookAt = parseVec(args.camera_lookat || '[0,1,0]');
        const fov = args.fov ?? 60;

        const scene = createDefaultScene();
        const camera = { pos: camPos, lookAt, fov };
        const image = renderScene(scene, width, height, camera);

        result = {
          operation: 'render',
          resolution: { width, height },
          camera: { position: camPos, lookAt, fov },
          scene: {
            objects: scene.objects.length,
            lights: scene.lights.length,
          },
          render: image,
        };
        break;
      }

      case 'trace': {
        const origin = parseVec(args.ray_origin || '[0,3,-8]');
        const direction = normalize(parseVec(args.ray_direction || '[0,-0.2,1]'));

        const scene = createDefaultScene();
        const ray: Ray = { origin, direction };
        const color = traceRay(ray, scene);

        result = {
          operation: 'trace',
          ray: { origin, direction },
          result_color: {
            r: Math.round(color.x * 255),
            g: Math.round(color.y * 255),
            b: Math.round(color.z * 255),
          },
          brightness: Math.round((0.299 * color.x + 0.587 * color.y + 0.114 * color.z) * 100) + '%',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Ray Tracing Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isRayTracingAvailable(): boolean { return true; }
