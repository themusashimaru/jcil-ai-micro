import { describe, it, expect } from 'vitest';
import {
  scaleVec3,
  dotVec3,
  mergeMeshes,
  sceneToGLTF,
  executeGraphics3D,
  isGraphics3DAvailable,
  graphics3dTool,
} from './graphics-3d-tool';

// Helper types
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Face {
  vertices: number[];
  normal?: Vector3;
}

interface Mesh {
  name: string;
  vertices: Vector3[];
  faces: Face[];
}

// Helper to create a tool call
function makeCall(args: Record<string, unknown>) {
  return { id: 'test-call', name: 'graphics_3d', arguments: args };
}

// Helper to parse result content
async function getResult(args: Record<string, unknown>) {
  const res = await executeGraphics3D(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Tool metadata
// -------------------------------------------------------------------
describe('graphics3dTool metadata', () => {
  it('should have name graphics_3d', () => {
    expect(graphics3dTool.name).toBe('graphics_3d');
  });

  it('should have operation as required parameter', () => {
    expect(graphics3dTool.parameters.required).toContain('operation');
  });
});

describe('isGraphics3DAvailable', () => {
  it('should return true', () => {
    expect(isGraphics3DAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Vector operations
// -------------------------------------------------------------------
describe('scaleVec3', () => {
  it('should scale vector by scalar', () => {
    const result = scaleVec3({ x: 1, y: 2, z: 3 }, 2);
    expect(result).toEqual({ x: 2, y: 4, z: 6 });
  });

  it('should handle zero scalar', () => {
    const result = scaleVec3({ x: 5, y: 10, z: 15 }, 0);
    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('should handle negative scalar', () => {
    const result = scaleVec3({ x: 1, y: 2, z: 3 }, -1);
    expect(result).toEqual({ x: -1, y: -2, z: -3 });
  });

  it('should handle fractional scalar', () => {
    const result = scaleVec3({ x: 10, y: 20, z: 30 }, 0.5);
    expect(result).toEqual({ x: 5, y: 10, z: 15 });
  });
});

describe('dotVec3', () => {
  it('should compute dot product', () => {
    expect(dotVec3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
  });

  it('should compute dot product of parallel vectors', () => {
    expect(dotVec3({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(1);
  });

  it('should compute dot product of arbitrary vectors', () => {
    expect(dotVec3({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32);
  });

  it('should compute dot product of anti-parallel vectors', () => {
    expect(dotVec3({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBe(-1);
  });

  it('should return 0 for zero vectors', () => {
    expect(dotVec3({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 })).toBe(0);
  });
});

// -------------------------------------------------------------------
// mergeMeshes
// -------------------------------------------------------------------
describe('mergeMeshes', () => {
  it('should merge two simple meshes', () => {
    const mesh1: Mesh = {
      name: 'a',
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      faces: [{ vertices: [0, 1, 2] }],
    };
    const mesh2: Mesh = {
      name: 'b',
      vertices: [
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
        { x: 2, y: 1, z: 0 },
      ],
      faces: [{ vertices: [0, 1, 2] }],
    };

    const merged = mergeMeshes([mesh1, mesh2]);
    expect(merged.vertices).toHaveLength(6);
    expect(merged.faces).toHaveLength(2);
    // Second mesh's face indices should be offset by 3
    expect(merged.faces[1].vertices).toEqual([3, 4, 5]);
  });

  it('should return named merged mesh', () => {
    const mesh: Mesh = {
      name: 'single',
      vertices: [{ x: 0, y: 0, z: 0 }],
      faces: [],
    };
    const merged = mergeMeshes([mesh]);
    expect(merged.name).toBe('merged');
  });

  it('should handle empty array', () => {
    const merged = mergeMeshes([]);
    expect(merged.vertices).toHaveLength(0);
    expect(merged.faces).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Primitive generation via executeGraphics3D
// -------------------------------------------------------------------
describe('executeGraphics3D - primitives', () => {
  it('should generate a cube', async () => {
    const result = await getResult({ operation: 'cube', size: 2 });
    expect(result.operation).toBe('cube');
    expect(result.mesh).toBeDefined();
    expect(result.obj_preview).toContain('v ');
  });

  it('should generate a sphere', async () => {
    const result = await getResult({ operation: 'sphere', radius: 1 });
    expect(result.operation).toBe('sphere');
    expect(result.mesh).toBeDefined();
  });

  it('should generate a cylinder', async () => {
    const result = await getResult({ operation: 'cylinder', radius: 1, height: 2 });
    expect(result.operation).toBe('cylinder');
    expect(result.mesh).toBeDefined();
  });

  it('should generate a cone', async () => {
    const result = await getResult({ operation: 'cone', radius: 1, height: 2 });
    expect(result.operation).toBe('cone');
  });

  it('should generate a torus', async () => {
    const result = await getResult({ operation: 'torus' });
    expect(result.operation).toBe('torus');
    expect(result.mesh).toBeDefined();
  });

  it('should generate a plane', async () => {
    const result = await getResult({ operation: 'plane', width: 5, height: 5 });
    expect(result.operation).toBe('plane');
    expect(result.mesh).toBeDefined();
  });

  it('should generate a pyramid', async () => {
    const result = await getResult({ operation: 'pyramid', size: 1, height: 1.5 });
    expect(result.operation).toBe('pyramid');
    expect(result.mesh).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Export formats
// -------------------------------------------------------------------
describe('executeGraphics3D - export', () => {
  it('should export to OBJ format', async () => {
    const result = await getResult({ operation: 'export_obj', primitive: 'cube', size: 1 });
    expect(result.content).toContain('v ');
    expect(result.content).toContain('f ');
  });

  it('should export to STL format', async () => {
    const result = await getResult({ operation: 'export_stl', primitive: 'cube', size: 1 });
    expect(result.content).toContain('solid');
  });
});

// -------------------------------------------------------------------
// Scene to GLTF
// -------------------------------------------------------------------
describe('sceneToGLTF', () => {
  it('should create valid GLTF structure', () => {
    const scene = {
      objects: [
        {
          mesh: {
            name: 'box',
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            faces: [{ vertices: [0, 1, 2] }],
          },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      ],
    };

    const gltf = sceneToGLTF(scene) as Record<string, unknown>;
    expect(gltf).toHaveProperty('asset');
    expect(gltf).toHaveProperty('scenes');
    expect(gltf).toHaveProperty('nodes');
    expect(gltf).toHaveProperty('meshes');
  });

  it('should handle empty scene', () => {
    const gltf = sceneToGLTF({ objects: [] }) as Record<string, unknown>;
    expect(gltf).toHaveProperty('asset');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeGraphics3D - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeGraphics3D(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
  });

  it('should handle string arguments', async () => {
    const res = await executeGraphics3D({
      id: 'test',
      name: 'graphics_3d',
      arguments: JSON.stringify({ operation: 'cube' }),
    });
    expect(res.isError).toBeUndefined();
  });

  it('should return toolCallId', async () => {
    const res = await executeGraphics3D({
      id: 'my-id',
      name: 'graphics_3d',
      arguments: { operation: 'cube' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
