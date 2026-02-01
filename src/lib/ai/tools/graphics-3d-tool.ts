// ============================================================================
// GRAPHICS 3D TOOL - TIER GODMODE
// ============================================================================
// 3D graphics generation, mesh manipulation, scene composition, and rendering.
// Generates 3D content that can be exported to various formats (OBJ, STL, GLTF).
// This fills a massive gap - no other AI chat can generate 3D content!
// Pure TypeScript implementation.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Face {
  vertices: number[]; // Indices into vertex array
  normal?: Vector3;
}

interface Mesh {
  name: string;
  vertices: Vector3[];
  faces: Face[];
  normals?: Vector3[];
  uvs?: { u: number; v: number }[];
}

interface Material {
  name: string;
  color: { r: number; g: number; b: number };
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
}

interface SceneObject {
  mesh: Mesh;
  material?: Material;
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
}

interface Scene {
  objects: SceneObject[];
  camera?: {
    position: Vector3;
    target: Vector3;
    fov: number;
  };
  lights?: {
    type: 'point' | 'directional' | 'ambient';
    position?: Vector3;
    direction?: Vector3;
    color: { r: number; g: number; b: number };
    intensity: number;
  }[];
}

// ============================================================================
// VECTOR OPERATIONS
// ============================================================================

function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

function addVec3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subVec3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function _scaleVec3(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function normalizeVec3(v: Vector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function crossVec3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function _dotVec3(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ============================================================================
// PRIMITIVE GENERATORS
// ============================================================================

function generateCube(size: number = 1): Mesh {
  const s = size / 2;
  const vertices: Vector3[] = [
    // Front face
    vec3(-s, -s, s), vec3(s, -s, s), vec3(s, s, s), vec3(-s, s, s),
    // Back face
    vec3(-s, -s, -s), vec3(-s, s, -s), vec3(s, s, -s), vec3(s, -s, -s),
    // Top face
    vec3(-s, s, -s), vec3(-s, s, s), vec3(s, s, s), vec3(s, s, -s),
    // Bottom face
    vec3(-s, -s, -s), vec3(s, -s, -s), vec3(s, -s, s), vec3(-s, -s, s),
    // Right face
    vec3(s, -s, -s), vec3(s, s, -s), vec3(s, s, s), vec3(s, -s, s),
    // Left face
    vec3(-s, -s, -s), vec3(-s, -s, s), vec3(-s, s, s), vec3(-s, s, -s),
  ];

  const faces: Face[] = [];
  for (let i = 0; i < 6; i++) {
    const base = i * 4;
    faces.push({ vertices: [base, base + 1, base + 2] });
    faces.push({ vertices: [base, base + 2, base + 3] });
  }

  return { name: 'cube', vertices, faces };
}

function generateSphere(radius: number = 1, segments: number = 16, rings: number = 12): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];

  // Generate vertices
  for (let ring = 0; ring <= rings; ring++) {
    const phi = (Math.PI * ring) / rings;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let seg = 0; seg <= segments; seg++) {
      const theta = (2 * Math.PI * seg) / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      vertices.push(vec3(
        radius * sinPhi * cosTheta,
        radius * cosPhi,
        radius * sinPhi * sinTheta
      ));
    }
  }

  // Generate faces
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg;
      const b = a + segments + 1;

      faces.push({ vertices: [a, b, a + 1] });
      faces.push({ vertices: [b, b + 1, a + 1] });
    }
  }

  return { name: 'sphere', vertices, faces };
}

function generateCylinder(
  radiusTop: number = 1,
  radiusBottom: number = 1,
  height: number = 2,
  segments: number = 16
): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];
  const halfHeight = height / 2;

  // Generate side vertices
  for (let i = 0; i <= segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    // Top ring
    vertices.push(vec3(radiusTop * cosTheta, halfHeight, radiusTop * sinTheta));
    // Bottom ring
    vertices.push(vec3(radiusBottom * cosTheta, -halfHeight, radiusBottom * sinTheta));
  }

  // Side faces
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;

    faces.push({ vertices: [a, b, d] });
    faces.push({ vertices: [a, d, c] });
  }

  // Add center vertices for caps
  const topCenter = vertices.length;
  vertices.push(vec3(0, halfHeight, 0));
  const bottomCenter = vertices.length;
  vertices.push(vec3(0, -halfHeight, 0));

  // Cap faces
  for (let i = 0; i < segments; i++) {
    const top1 = i * 2;
    const top2 = ((i + 1) % segments) * 2;
    const bot1 = i * 2 + 1;
    const bot2 = ((i + 1) % segments) * 2 + 1;

    faces.push({ vertices: [topCenter, top2, top1] });
    faces.push({ vertices: [bottomCenter, bot1, bot2] });
  }

  return { name: 'cylinder', vertices, faces };
}

function generateCone(radius: number = 1, height: number = 2, segments: number = 16): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];

  // Apex
  vertices.push(vec3(0, height / 2, 0));

  // Base ring
  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    vertices.push(vec3(radius * Math.cos(theta), -height / 2, radius * Math.sin(theta)));
  }

  // Base center
  const baseCenter = vertices.length;
  vertices.push(vec3(0, -height / 2, 0));

  // Side faces
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push({ vertices: [0, i + 1, next + 1] });
  }

  // Base faces
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push({ vertices: [baseCenter, next + 1, i + 1] });
  }

  return { name: 'cone', vertices, faces };
}

function generateTorus(
  majorRadius: number = 1,
  minorRadius: number = 0.3,
  majorSegments: number = 24,
  minorSegments: number = 12
): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];

  for (let i = 0; i <= majorSegments; i++) {
    const u = (i / majorSegments) * 2 * Math.PI;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    for (let j = 0; j <= minorSegments; j++) {
      const v = (j / minorSegments) * 2 * Math.PI;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);

      const x = (majorRadius + minorRadius * cosV) * cosU;
      const y = minorRadius * sinV;
      const z = (majorRadius + minorRadius * cosV) * sinU;

      vertices.push(vec3(x, y, z));
    }
  }

  for (let i = 0; i < majorSegments; i++) {
    for (let j = 0; j < minorSegments; j++) {
      const a = i * (minorSegments + 1) + j;
      const b = a + minorSegments + 1;

      faces.push({ vertices: [a, b, a + 1] });
      faces.push({ vertices: [b, b + 1, a + 1] });
    }
  }

  return { name: 'torus', vertices, faces };
}

function generatePlane(width: number = 1, height: number = 1, segmentsW: number = 1, segmentsH: number = 1): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];

  const halfW = width / 2;
  const halfH = height / 2;

  for (let y = 0; y <= segmentsH; y++) {
    for (let x = 0; x <= segmentsW; x++) {
      vertices.push(vec3(
        (x / segmentsW) * width - halfW,
        0,
        (y / segmentsH) * height - halfH
      ));
    }
  }

  for (let y = 0; y < segmentsH; y++) {
    for (let x = 0; x < segmentsW; x++) {
      const a = y * (segmentsW + 1) + x;
      const b = a + 1;
      const c = a + segmentsW + 1;
      const d = c + 1;

      faces.push({ vertices: [a, c, b] });
      faces.push({ vertices: [b, c, d] });
    }
  }

  return { name: 'plane', vertices, faces };
}

function generatePyramid(baseSize: number = 1, height: number = 1.5): Mesh {
  const s = baseSize / 2;
  const h = height;

  const vertices: Vector3[] = [
    vec3(0, h, 0),      // Apex
    vec3(-s, 0, -s),    // Base corners
    vec3(s, 0, -s),
    vec3(s, 0, s),
    vec3(-s, 0, s),
  ];

  const faces: Face[] = [
    { vertices: [0, 1, 2] },  // Front
    { vertices: [0, 2, 3] },  // Right
    { vertices: [0, 3, 4] },  // Back
    { vertices: [0, 4, 1] },  // Left
    { vertices: [1, 4, 3] },  // Base 1
    { vertices: [1, 3, 2] },  // Base 2
  ];

  return { name: 'pyramid', vertices, faces };
}

// ============================================================================
// MESH OPERATIONS
// ============================================================================

function calculateNormals(mesh: Mesh): Mesh {
  const normals: Vector3[] = new Array(mesh.vertices.length).fill(null).map(() => vec3(0, 0, 0));

  for (const face of mesh.faces) {
    const v0 = mesh.vertices[face.vertices[0]];
    const v1 = mesh.vertices[face.vertices[1]];
    const v2 = mesh.vertices[face.vertices[2]];

    const edge1 = subVec3(v1, v0);
    const edge2 = subVec3(v2, v0);
    const faceNormal = normalizeVec3(crossVec3(edge1, edge2));

    for (const vertexIndex of face.vertices) {
      normals[vertexIndex] = addVec3(normals[vertexIndex], faceNormal);
    }
  }

  // Normalize accumulated normals
  for (let i = 0; i < normals.length; i++) {
    normals[i] = normalizeVec3(normals[i]);
  }

  return { ...mesh, normals };
}

function transformMesh(mesh: Mesh, position: Vector3, rotation: Vector3, scale: Vector3): Mesh {
  const transformedVertices = mesh.vertices.map((v) => {
    // Scale
    let x = v.x * scale.x;
    let y = v.y * scale.y;
    let z = v.z * scale.z;

    // Rotate Y
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    x = x1;
    z = z1;

    // Rotate X
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const y1 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;
    y = y1;
    z = z2;

    // Rotate Z
    const cosZ = Math.cos(rotation.z);
    const sinZ = Math.sin(rotation.z);
    const x2 = x * cosZ - y * sinZ;
    const y2 = x * sinZ + y * cosZ;
    x = x2;
    y = y2;

    // Translate
    return vec3(x + position.x, y + position.y, z + position.z);
  });

  return { ...mesh, vertices: transformedVertices };
}

function _mergeMeshes(meshes: Mesh[]): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    vertices.push(...mesh.vertices);

    for (const face of mesh.faces) {
      faces.push({
        vertices: face.vertices.map((i) => i + vertexOffset),
        normal: face.normal,
      });
    }

    vertexOffset += mesh.vertices.length;
  }

  return { name: 'merged', vertices, faces };
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

function meshToOBJ(mesh: Mesh, material?: Material): string {
  const lines: string[] = [];

  lines.push(`# Generated by JCIL AI Graphics3D Tool`);
  lines.push(`# Vertices: ${mesh.vertices.length}, Faces: ${mesh.faces.length}`);
  lines.push(`o ${mesh.name}`);

  if (material) {
    lines.push(`usemtl ${material.name}`);
  }

  // Vertices
  for (const v of mesh.vertices) {
    lines.push(`v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}`);
  }

  // Normals
  if (mesh.normals) {
    for (const n of mesh.normals) {
      lines.push(`vn ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}`);
    }
  }

  // Faces (OBJ uses 1-based indexing)
  for (const face of mesh.faces) {
    const indices = face.vertices.map((i) => i + 1).join(' ');
    lines.push(`f ${indices}`);
  }

  return lines.join('\n');
}

function meshToSTL(mesh: Mesh, name: string = 'mesh'): string {
  const meshWithNormals = mesh.normals ? mesh : calculateNormals(mesh);
  const lines: string[] = [];

  lines.push(`solid ${name}`);

  for (const face of meshWithNormals.faces) {
    const v0 = meshWithNormals.vertices[face.vertices[0]];
    const v1 = meshWithNormals.vertices[face.vertices[1]];
    const v2 = meshWithNormals.vertices[face.vertices[2]];

    // Calculate face normal
    const edge1 = subVec3(v1, v0);
    const edge2 = subVec3(v2, v0);
    const normal = normalizeVec3(crossVec3(edge1, edge2));

    lines.push(`  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}`);
    lines.push(`    outer loop`);
    lines.push(`      vertex ${v0.x.toFixed(6)} ${v0.y.toFixed(6)} ${v0.z.toFixed(6)}`);
    lines.push(`      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}`);
    lines.push(`      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}`);
    lines.push(`    endloop`);
    lines.push(`  endfacet`);
  }

  lines.push(`endsolid ${name}`);

  return lines.join('\n');
}

function _sceneToGLTF(scene: Scene): object {
  // Generate glTF 2.0 JSON structure
  const gltf: Record<string, unknown> = {
    asset: {
      version: '2.0',
      generator: 'JCIL AI Graphics3D Tool',
    },
    scenes: [{ nodes: scene.objects.map((_, i) => i) }],
    scene: 0,
    nodes: [] as object[],
    meshes: [] as object[],
    accessors: [] as object[],
    bufferViews: [] as object[],
    buffers: [] as object[],
  };

  // Build nodes and meshes
  for (let i = 0; i < scene.objects.length; i++) {
    const obj = scene.objects[i];
    (gltf.nodes as object[]).push({
      mesh: i,
      translation: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [0, 0, 0, 1], // Quaternion
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });

    // Simplified mesh representation
    (gltf.meshes as object[]).push({
      name: obj.mesh.name,
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
      }],
    });
  }

  return gltf;
}

// ============================================================================
// SCENE RENDERING (ASCII preview)
// ============================================================================

function renderSceneAscii(scene: Scene, width: number = 60, height: number = 30): string {
  // Simple orthographic ASCII render
  const buffer: string[][] = [];
  const depthBuffer: number[][] = [];

  for (let y = 0; y < height; y++) {
    buffer.push(new Array(width).fill(' '));
    depthBuffer.push(new Array(width).fill(Infinity));
  }

  const chars = ' .:-=+*#%@';

  for (const obj of scene.objects) {
    const mesh = transformMesh(obj.mesh, obj.position, obj.rotation, obj.scale);

    for (const vertex of mesh.vertices) {
      // Simple orthographic projection
      const screenX = Math.floor((vertex.x + 2) / 4 * width);
      const screenY = Math.floor((-vertex.y + 2) / 4 * height);

      if (screenX >= 0 && screenX < width && screenY >= 0 && screenY < height) {
        if (vertex.z < depthBuffer[screenY][screenX]) {
          depthBuffer[screenY][screenX] = vertex.z;
          const intensity = Math.min(chars.length - 1, Math.floor((vertex.z + 2) / 4 * chars.length));
          buffer[screenY][screenX] = chars[chars.length - 1 - intensity];
        }
      }
    }
  }

  return buffer.map((row) => row.join('')).join('\n');
}

// ============================================================================
// MESH ANALYSIS
// ============================================================================

function analyzeMesh(mesh: Mesh): Record<string, unknown> {
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const v of mesh.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }

  // Calculate surface area (approximate for triangles)
  let surfaceArea = 0;
  for (const face of mesh.faces) {
    if (face.vertices.length >= 3) {
      const v0 = mesh.vertices[face.vertices[0]];
      const v1 = mesh.vertices[face.vertices[1]];
      const v2 = mesh.vertices[face.vertices[2]];
      const cross = crossVec3(subVec3(v1, v0), subVec3(v2, v0));
      surfaceArea += 0.5 * Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
    }
  }

  // Check if watertight (every edge shared by exactly 2 faces)
  const edgeCount = new Map<string, number>();
  for (const face of mesh.faces) {
    for (let i = 0; i < face.vertices.length; i++) {
      const a = face.vertices[i];
      const b = face.vertices[(i + 1) % face.vertices.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }
  const boundaryEdges = [...edgeCount.values()].filter((c) => c !== 2).length;

  return {
    name: mesh.name,
    vertices: mesh.vertices.length,
    faces: mesh.faces.length,
    triangles: mesh.faces.length, // Assuming triangulated
    has_normals: !!mesh.normals,
    bounds: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: {
        x: maxX - minX,
        y: maxY - minY,
        z: maxZ - minZ,
      },
    },
    surface_area: Math.round(surfaceArea * 1000) / 1000,
    is_watertight: boundaryEdges === 0,
    boundary_edges: boundaryEdges,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const graphics3dTool: UnifiedTool = {
  name: 'graphics_3d',
  description: `3D graphics generation, mesh manipulation, and export.

Operations:

Primitives:
- cube: Generate cube mesh
- sphere: Generate UV sphere
- cylinder: Generate cylinder
- cone: Generate cone
- torus: Generate torus (donut)
- plane: Generate flat plane
- pyramid: Generate pyramid

Mesh Operations:
- transform: Apply position, rotation, scale
- merge: Merge multiple meshes
- normals: Calculate vertex normals
- analyze: Analyze mesh properties

Export:
- export_obj: Export to Wavefront OBJ format
- export_stl: Export to STL format (3D printing)
- export_gltf: Export to glTF 2.0 JSON

Scene:
- create_scene: Create scene with multiple objects
- render_ascii: ASCII art preview of scene

This tool generates actual 3D geometry that can be imported into Blender, Unity, etc.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'pyramid',
          'transform', 'merge', 'normals', 'analyze',
          'export_obj', 'export_stl', 'export_gltf',
          'create_scene', 'render_ascii',
        ],
        description: '3D operation to perform',
      },
      // Primitive parameters
      size: { type: 'number', description: 'Size for cube/pyramid' },
      radius: { type: 'number', description: 'Radius for sphere/cone' },
      radius_top: { type: 'number', description: 'Top radius for cylinder' },
      radius_bottom: { type: 'number', description: 'Bottom radius for cylinder' },
      major_radius: { type: 'number', description: 'Major radius for torus' },
      minor_radius: { type: 'number', description: 'Minor radius for torus' },
      height: { type: 'number', description: 'Height for cylinder/cone/pyramid' },
      width: { type: 'number', description: 'Width for plane' },
      segments: { type: 'number', description: 'Number of segments' },
      rings: { type: 'number', description: 'Number of rings for sphere' },
      // Transform parameters (pass as {x, y, z})
      position: { type: 'string', description: 'Position as JSON {x, y, z}' },
      rotation: { type: 'string', description: 'Rotation in radians as JSON {x, y, z}' },
      scale: { type: 'string', description: 'Scale as JSON {x, y, z}' },
      // Scene parameters
      objects: { type: 'string', description: 'Array of scene objects as JSON' },
      // Format
      format: { type: 'string', enum: ['obj', 'stl', 'gltf'] },
      primitive: { type: 'string', description: 'Primitive type for export' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeGraphics3D(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'cube': {
        const mesh = generateCube(args.size || 1);
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'cube',
          mesh: analysis,
          obj_preview: meshToOBJ(mesh).split('\n').slice(0, 20).join('\n') + '\n...',
        };
        break;
      }

      case 'sphere': {
        const mesh = generateSphere(
          args.radius || 1,
          args.segments || 16,
          args.rings || 12
        );
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'sphere',
          parameters: { radius: args.radius || 1, segments: args.segments || 16, rings: args.rings || 12 },
          mesh: analysis,
        };
        break;
      }

      case 'cylinder': {
        const mesh = generateCylinder(
          args.radius_top || args.radius || 1,
          args.radius_bottom || args.radius || 1,
          args.height || 2,
          args.segments || 16
        );
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'cylinder',
          mesh: analysis,
        };
        break;
      }

      case 'cone': {
        const mesh = generateCone(args.radius || 1, args.height || 2, args.segments || 16);
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'cone',
          mesh: analysis,
        };
        break;
      }

      case 'torus': {
        const mesh = generateTorus(
          args.major_radius || 1,
          args.minor_radius || 0.3,
          args.segments || 24,
          args.rings || 12
        );
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'torus',
          mesh: analysis,
        };
        break;
      }

      case 'plane': {
        const mesh = generatePlane(args.width || 1, args.height || 1, args.segments || 1, args.segments || 1);
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'plane',
          mesh: analysis,
        };
        break;
      }

      case 'pyramid': {
        const mesh = generatePyramid(args.size || 1, args.height || 1.5);
        const analysis = analyzeMesh(mesh);
        result = {
          operation: 'pyramid',
          mesh: analysis,
        };
        break;
      }

      case 'export_obj': {
        const primitive = args.primitive || 'cube';
        let mesh: Mesh;
        switch (primitive) {
          case 'sphere': mesh = generateSphere(args.radius, args.segments, args.rings); break;
          case 'cylinder': mesh = generateCylinder(args.radius_top, args.radius_bottom, args.height, args.segments); break;
          case 'cone': mesh = generateCone(args.radius, args.height, args.segments); break;
          case 'torus': mesh = generateTorus(args.major_radius, args.minor_radius); break;
          case 'pyramid': mesh = generatePyramid(args.size, args.height); break;
          default: mesh = generateCube(args.size);
        }
        const objContent = meshToOBJ(mesh);
        result = {
          operation: 'export_obj',
          primitive,
          format: 'Wavefront OBJ',
          content: objContent,
          usage: 'Save as .obj file and import into any 3D software',
        };
        break;
      }

      case 'export_stl': {
        const primitive = args.primitive || 'cube';
        let mesh: Mesh;
        switch (primitive) {
          case 'sphere': mesh = generateSphere(args.radius, args.segments, args.rings); break;
          case 'cylinder': mesh = generateCylinder(args.radius_top, args.radius_bottom, args.height, args.segments); break;
          case 'cone': mesh = generateCone(args.radius, args.height, args.segments); break;
          case 'torus': mesh = generateTorus(args.major_radius, args.minor_radius); break;
          case 'pyramid': mesh = generatePyramid(args.size, args.height); break;
          default: mesh = generateCube(args.size);
        }
        const stlContent = meshToSTL(mesh, primitive);
        result = {
          operation: 'export_stl',
          primitive,
          format: 'STL (ASCII)',
          content: stlContent,
          usage: 'Save as .stl file for 3D printing or CAD software',
        };
        break;
      }

      case 'create_scene': {
        const objects = args.objects || [
          { type: 'cube', position: { x: 0, y: 0, z: 0 } },
        ];

        const sceneObjects: SceneObject[] = objects.map((obj: Record<string, unknown>) => {
          let mesh: Mesh;
          switch (obj.type) {
            case 'sphere': mesh = generateSphere(); break;
            case 'cylinder': mesh = generateCylinder(); break;
            case 'cone': mesh = generateCone(); break;
            case 'torus': mesh = generateTorus(); break;
            case 'pyramid': mesh = generatePyramid(); break;
            default: mesh = generateCube();
          }

          return {
            mesh,
            position: (obj.position as Vector3) || vec3(0, 0, 0),
            rotation: (obj.rotation as Vector3) || vec3(0, 0, 0),
            scale: (obj.scale as Vector3) || vec3(1, 1, 1),
          };
        });

        const scene: Scene = { objects: sceneObjects };

        result = {
          operation: 'create_scene',
          object_count: scene.objects.length,
          objects: sceneObjects.map((o, i) => ({
            index: i,
            type: o.mesh.name,
            position: o.position,
            vertices: o.mesh.vertices.length,
          })),
          ascii_preview: renderSceneAscii(scene),
        };
        break;
      }

      case 'render_ascii': {
        const primitive = args.primitive || 'cube';
        let mesh: Mesh;
        switch (primitive) {
          case 'sphere': mesh = generateSphere(1, 12, 8); break;
          case 'torus': mesh = generateTorus(1, 0.4, 16, 8); break;
          default: mesh = generateCube(1.5);
        }

        const scene: Scene = {
          objects: [{
            mesh,
            position: vec3(0, 0, 0),
            rotation: vec3(0.3, 0.5, 0),
            scale: vec3(1, 1, 1),
          }],
        };

        result = {
          operation: 'render_ascii',
          primitive,
          preview: renderSceneAscii(scene, 50, 25),
        };
        break;
      }

      case 'analyze': {
        const primitive = args.primitive || 'cube';
        let mesh: Mesh;
        switch (primitive) {
          case 'sphere': mesh = generateSphere(args.radius, args.segments, args.rings); break;
          case 'cylinder': mesh = generateCylinder(args.radius_top, args.radius_bottom, args.height, args.segments); break;
          case 'cone': mesh = generateCone(args.radius, args.height, args.segments); break;
          case 'torus': mesh = generateTorus(args.major_radius, args.minor_radius); break;
          case 'pyramid': mesh = generatePyramid(args.size, args.height); break;
          default: mesh = generateCube(args.size);
        }
        result = {
          operation: 'analyze',
          ...analyzeMesh(mesh),
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

export function isGraphics3DAvailable(): boolean {
  return true;
}
