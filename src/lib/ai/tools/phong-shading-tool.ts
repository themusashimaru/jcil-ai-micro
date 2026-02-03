/**
 * PHONG-SHADING TOOL
 * Comprehensive Phong illumination model with ambient, diffuse, specular components,
 * multiple light types, and shading variations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface Material {
  ambient: Color;
  diffuse: Color;
  specular: Color;
  shininess: number;
  emissive?: Color;
}

interface Light {
  type: 'directional' | 'point' | 'spot';
  position?: Vec3;
  direction?: Vec3;
  color: Color;
  intensity: number;
  attenuation?: {
    constant: number;
    linear: number;
    quadratic: number;
  };
  spotAngle?: number;
  spotExponent?: number;
}

interface ShadingInput {
  position: Vec3;
  normal: Vec3;
  viewDirection: Vec3;
  material: Material;
  lights: Light[];
  ambientLight: Color;
}

interface ShadingResult {
  finalColor: Color;
  ambient: Color;
  diffuse: Color;
  specular: Color;
  components: {
    light: string;
    ambient: Color;
    diffuse: Color;
    specular: Color;
  }[];
}

// ============================================================================
// VECTOR OPERATIONS
// ============================================================================

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / len);
}

function reflect(incident: Vec3, normal: Vec3): Vec3 {
  // R = I - 2(N·I)N
  const d = dot(normal, incident);
  return sub(incident, scale(normal, 2 * d));
}

function negate(v: Vec3): Vec3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// ============================================================================
// COLOR OPERATIONS
// ============================================================================

function colorVec(r: number, g: number, b: number): Color {
  return { r, g, b };
}

function addColor(a: Color, b: Color): Color {
  return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
}

function scaleColor(c: Color, s: number): Color {
  return { r: c.r * s, g: c.g * s, b: c.b * s };
}

function multiplyColors(a: Color, b: Color): Color {
  return {
    r: (a.r / 255) * b.r,
    g: (a.g / 255) * b.g,
    b: (a.b / 255) * b.b
  };
}

function clampColor(c: Color): Color {
  return {
    r: Math.max(0, Math.min(255, Math.round(c.r))),
    g: Math.max(0, Math.min(255, Math.round(c.g))),
    b: Math.max(0, Math.min(255, Math.round(c.b)))
  };
}

// ============================================================================
// PHONG ILLUMINATION
// ============================================================================

function computeAttenuation(light: Light, distance: number): number {
  if (!light.attenuation || light.type === 'directional') {
    return 1.0;
  }

  const { constant, linear, quadratic } = light.attenuation;
  return 1.0 / (constant + linear * distance + quadratic * distance * distance);
}

function computeSpotFactor(light: Light, lightDir: Vec3): number {
  if (light.type !== 'spot' || !light.direction) {
    return 1.0;
  }

  const spotDir = normalize(light.direction);
  const cosAngle = dot(negate(lightDir), spotDir);
  const cosLimit = Math.cos((light.spotAngle || 45) * Math.PI / 180);

  if (cosAngle < cosLimit) {
    return 0.0;
  }

  return Math.pow(cosAngle, light.spotExponent || 1);
}

function computePhongLighting(input: ShadingInput): ShadingResult {
  const { position, normal, viewDirection, material, lights, ambientLight } = input;

  const N = normalize(normal);
  const V = normalize(viewDirection);

  // Total components
  let totalAmbient: Color = { r: 0, g: 0, b: 0 };
  let totalDiffuse: Color = { r: 0, g: 0, b: 0 };
  let totalSpecular: Color = { r: 0, g: 0, b: 0 };

  const components: ShadingResult['components'] = [];

  // Global ambient
  const globalAmbient = multiplyColors(ambientLight, material.ambient);
  totalAmbient = addColor(totalAmbient, globalAmbient);

  // Process each light
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    let L: Vec3;
    let distance = 1.0;

    // Compute light direction
    if (light.type === 'directional') {
      L = normalize(negate(light.direction!));
    } else {
      const toLight = sub(light.position!, position);
      distance = length(toLight);
      L = normalize(toLight);
    }

    // Compute attenuation
    const attenuation = computeAttenuation(light, distance);
    const spotFactor = computeSpotFactor(light, L);
    const factor = attenuation * spotFactor * light.intensity;

    if (factor <= 0) continue;

    // Ambient component
    const ambient = scaleColor(multiplyColors(light.color, material.ambient), factor * 0.1);

    // Diffuse component (Lambertian)
    const NdotL = Math.max(0, dot(N, L));
    const diffuse = scaleColor(multiplyColors(light.color, material.diffuse), NdotL * factor);

    // Specular component (Phong)
    let specular: Color = { r: 0, g: 0, b: 0 };
    if (NdotL > 0) {
      const R = reflect(negate(L), N);
      const RdotV = Math.max(0, dot(R, V));
      const specFactor = Math.pow(RdotV, material.shininess);
      specular = scaleColor(multiplyColors(light.color, material.specular), specFactor * factor);
    }

    totalAmbient = addColor(totalAmbient, ambient);
    totalDiffuse = addColor(totalDiffuse, diffuse);
    totalSpecular = addColor(totalSpecular, specular);

    components.push({
      light: `${light.type} ${i}`,
      ambient: clampColor(ambient),
      diffuse: clampColor(diffuse),
      specular: clampColor(specular)
    });
  }

  // Add emissive
  let finalColor = addColor(addColor(totalAmbient, totalDiffuse), totalSpecular);
  if (material.emissive) {
    finalColor = addColor(finalColor, material.emissive);
  }

  return {
    finalColor: clampColor(finalColor),
    ambient: clampColor(totalAmbient),
    diffuse: clampColor(totalDiffuse),
    specular: clampColor(totalSpecular),
    components
  };
}

// ============================================================================
// BLINN-PHONG VARIANT
// ============================================================================

function computeBlinnPhongLighting(input: ShadingInput): ShadingResult {
  const { position, normal, viewDirection, material, lights, ambientLight } = input;

  const N = normalize(normal);
  const V = normalize(viewDirection);

  let totalAmbient: Color = { r: 0, g: 0, b: 0 };
  let totalDiffuse: Color = { r: 0, g: 0, b: 0 };
  let totalSpecular: Color = { r: 0, g: 0, b: 0 };

  const components: ShadingResult['components'] = [];

  const globalAmbient = multiplyColors(ambientLight, material.ambient);
  totalAmbient = addColor(totalAmbient, globalAmbient);

  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    let L: Vec3;
    let distance = 1.0;

    if (light.type === 'directional') {
      L = normalize(negate(light.direction!));
    } else {
      const toLight = sub(light.position!, position);
      distance = length(toLight);
      L = normalize(toLight);
    }

    const attenuation = computeAttenuation(light, distance);
    const spotFactor = computeSpotFactor(light, L);
    const factor = attenuation * spotFactor * light.intensity;

    if (factor <= 0) continue;

    const ambient = scaleColor(multiplyColors(light.color, material.ambient), factor * 0.1);
    const NdotL = Math.max(0, dot(N, L));
    const diffuse = scaleColor(multiplyColors(light.color, material.diffuse), NdotL * factor);

    let specular: Color = { r: 0, g: 0, b: 0 };
    if (NdotL > 0) {
      // Blinn-Phong uses half-vector instead of reflection
      const H = normalize(add(L, V));
      const NdotH = Math.max(0, dot(N, H));
      // Blinn-Phong typically needs higher shininess for similar result
      const specFactor = Math.pow(NdotH, material.shininess * 4);
      specular = scaleColor(multiplyColors(light.color, material.specular), specFactor * factor);
    }

    totalAmbient = addColor(totalAmbient, ambient);
    totalDiffuse = addColor(totalDiffuse, diffuse);
    totalSpecular = addColor(totalSpecular, specular);

    components.push({
      light: `${light.type} ${i}`,
      ambient: clampColor(ambient),
      diffuse: clampColor(diffuse),
      specular: clampColor(specular)
    });
  }

  let finalColor = addColor(addColor(totalAmbient, totalDiffuse), totalSpecular);
  if (material.emissive) {
    finalColor = addColor(finalColor, material.emissive);
  }

  return {
    finalColor: clampColor(finalColor),
    ambient: clampColor(totalAmbient),
    diffuse: clampColor(totalDiffuse),
    specular: clampColor(totalSpecular),
    components
  };
}

// ============================================================================
// FLAT VS GOURAUD VS PHONG SHADING COMPARISON
// ============================================================================

interface ShadingComparison {
  type: 'flat' | 'gouraud' | 'phong';
  description: string;
  characteristics: string[];
  computationLevel: string;
}

function compareShadingMethods(): ShadingComparison[] {
  return [
    {
      type: 'flat',
      description: 'One color per face/primitive',
      characteristics: [
        'Single normal per triangle',
        'Constant color across face',
        'Fastest computation',
        'Faceted appearance'
      ],
      computationLevel: 'Per-primitive'
    },
    {
      type: 'gouraud',
      description: 'Compute lighting at vertices, interpolate colors',
      characteristics: [
        'Normals at vertices',
        'Colors interpolated across face',
        'Smooth appearance',
        'May miss specular highlights'
      ],
      computationLevel: 'Per-vertex'
    },
    {
      type: 'phong',
      description: 'Interpolate normals, compute lighting per pixel',
      characteristics: [
        'Normals interpolated across face',
        'Full lighting at each pixel',
        'Best quality',
        'Captures specular highlights'
      ],
      computationLevel: 'Per-pixel'
    }
  ];
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function generateSphereShading(
  model: 'phong' | 'blinn',
  material: Material,
  lights: Light[],
  width: number = 30,
  height: number = 15
): string[] {
  const lines: string[] = [];
  const shades = ' .:-=+*#%@';
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.9;

  const viewDir = vec3(0, 0, 1);
  const ambientLight = colorVec(30, 30, 30);

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const px = (x - centerX) / radius;
      const py = (y - centerY) / radius;
      const dist = px * px + py * py;

      if (dist > 1) {
        line += ' ';
        continue;
      }

      const pz = Math.sqrt(1 - dist);
      const normal = vec3(px, py, pz);
      const pos = scale(normal, 1);

      const input: ShadingInput = {
        position: pos,
        normal: normal,
        viewDirection: viewDir,
        material,
        lights,
        ambientLight
      };

      const result = model === 'blinn'
        ? computeBlinnPhongLighting(input)
        : computePhongLighting(input);

      const brightness = (result.finalColor.r + result.finalColor.g + result.finalColor.b) / 3 / 255;
      const charIdx = Math.floor(brightness * (shades.length - 1));
      line += shades[Math.max(0, Math.min(shades.length - 1, charIdx))];
    }
    lines.push(line);
  }

  return lines;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const phongshadingTool: UnifiedTool = {
  name: 'phong_shading',
  description: 'Comprehensive Phong illumination model with ambient, diffuse, specular components, Blinn-Phong variant, and multiple light types',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compute', 'blinn', 'compare', 'visualize', 'analyze', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      position: { type: 'object', description: 'Surface position {x,y,z}' },
      normal: { type: 'object', description: 'Surface normal {x,y,z}' },
      viewDirection: { type: 'object', description: 'View direction {x,y,z}' },
      material: { type: 'object', description: 'Material properties' },
      lights: { type: 'array', description: 'Array of lights' },
      ambientLight: { type: 'object', description: 'Global ambient light color' },
      shininess: { type: 'number', description: 'Specular shininess exponent' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executephongshading(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, position, normal, viewDirection, material, lights, ambientLight, shininess = 32 } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Phong Illumination Model',
            description: 'Classic empirical lighting model for computer graphics',
            capabilities: [
              'Ambient, diffuse, specular components',
              'Phong and Blinn-Phong variants',
              'Directional, point, and spot lights',
              'Distance attenuation',
              'Multiple light sources',
              'Emissive materials'
            ],
            formula: {
              phong: 'I = Ia·ka + Id·kd·(N·L) + Is·ks·(R·V)^n',
              blinn: 'I = Ia·ka + Id·kd·(N·L) + Is·ks·(N·H)^n',
              where: {
                'Ia, Id, Is': 'Light ambient/diffuse/specular intensity',
                'ka, kd, ks': 'Material ambient/diffuse/specular coefficients',
                'N': 'Surface normal',
                'L': 'Light direction',
                'V': 'View direction',
                'R': 'Reflection of -L about N',
                'H': 'Half-vector between L and V',
                'n': 'Shininess exponent'
              }
            },
            operations: ['compute', 'blinn', 'compare', 'visualize', 'analyze', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Compute Phong Lighting',
                params: {
                  operation: 'compute',
                  position: { x: 0, y: 0, z: 0 },
                  normal: { x: 0, y: 0, z: 1 },
                  viewDirection: { x: 0, y: 0, z: 1 },
                  material: {
                    ambient: { r: 50, g: 50, b: 50 },
                    diffuse: { r: 200, g: 100, b: 100 },
                    specular: { r: 255, g: 255, b: 255 },
                    shininess: 64
                  },
                  lights: [{
                    type: 'directional',
                    direction: { x: -1, y: -1, z: -1 },
                    color: { r: 255, g: 255, b: 255 },
                    intensity: 1.0
                  }],
                  ambientLight: { r: 30, g: 30, b: 30 }
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'compute': {
        const defaultMaterial: Material = material || {
          ambient: colorVec(50, 50, 50),
          diffuse: colorVec(200, 100, 100),
          specular: colorVec(255, 255, 255),
          shininess: shininess
        };

        const defaultLights: Light[] = lights || [{
          type: 'directional',
          direction: vec3(-1, -1, -1),
          color: colorVec(255, 255, 255),
          intensity: 1.0
        }];

        const input: ShadingInput = {
          position: position || vec3(0, 0, 0),
          normal: normal || vec3(0, 0, 1),
          viewDirection: viewDirection || vec3(0, 0, 1),
          material: defaultMaterial,
          lights: defaultLights,
          ambientLight: ambientLight || colorVec(30, 30, 30)
        };

        const result = computePhongLighting(input);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compute',
            model: 'Phong',
            input: {
              normal: input.normal,
              viewDirection: input.viewDirection,
              material: input.material,
              lightCount: input.lights.length
            },
            result: {
              finalColor: result.finalColor,
              components: {
                ambient: result.ambient,
                diffuse: result.diffuse,
                specular: result.specular
              },
              perLight: result.components
            }
          }, null, 2)
        };
      }

      case 'blinn': {
        const defaultMaterial: Material = material || {
          ambient: colorVec(50, 50, 50),
          diffuse: colorVec(200, 100, 100),
          specular: colorVec(255, 255, 255),
          shininess: shininess
        };

        const defaultLights: Light[] = lights || [{
          type: 'directional',
          direction: vec3(-1, -1, -1),
          color: colorVec(255, 255, 255),
          intensity: 1.0
        }];

        const input: ShadingInput = {
          position: position || vec3(0, 0, 0),
          normal: normal || vec3(0, 0, 1),
          viewDirection: viewDirection || vec3(0, 0, 1),
          material: defaultMaterial,
          lights: defaultLights,
          ambientLight: ambientLight || colorVec(30, 30, 30)
        };

        const result = computeBlinnPhongLighting(input);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'blinn',
            model: 'Blinn-Phong',
            description: 'Uses half-vector H instead of reflection R',
            input: {
              normal: input.normal,
              viewDirection: input.viewDirection,
              material: input.material
            },
            result: {
              finalColor: result.finalColor,
              components: {
                ambient: result.ambient,
                diffuse: result.diffuse,
                specular: result.specular
              }
            },
            advantages: [
              'Faster than Phong (no reflection calculation)',
              'More physically plausible highlights',
              'Industry standard (OpenGL, DirectX)'
            ]
          }, null, 2)
        };
      }

      case 'compare': {
        const comparison = compareShadingMethods();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            title: 'Shading Method Comparison',
            methods: comparison,
            specularComparison: {
              phong: {
                formula: '(R·V)^n where R is reflection of L',
                characteristics: 'Classic model, reflection based'
              },
              blinn: {
                formula: '(N·H)^n where H is half-vector',
                characteristics: 'Faster, more widely used, needs higher n'
              }
            }
          }, null, 2)
        };
      }

      case 'visualize': {
        const defaultMaterial: Material = material || {
          ambient: colorVec(30, 30, 50),
          diffuse: colorVec(100, 100, 200),
          specular: colorVec(255, 255, 255),
          shininess: shininess
        };

        const defaultLights: Light[] = lights || [{
          type: 'directional',
          direction: vec3(-1, -0.5, -1),
          color: colorVec(255, 255, 255),
          intensity: 1.0
        }];

        const phongViz = generateSphereShading('phong', defaultMaterial, defaultLights, 40, 20);
        const blinnViz = generateSphereShading('blinn', defaultMaterial, defaultLights, 40, 20);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            title: 'Phong vs Blinn-Phong Shaded Sphere',
            phong: phongViz,
            blinn: blinnViz,
            material: {
              diffuse: defaultMaterial.diffuse,
              shininess: defaultMaterial.shininess
            },
            light: {
              direction: defaultLights[0].direction
            }
          }, null, 2)
        };
      }

      case 'analyze': {
        const testMaterial: Material = {
          ambient: colorVec(50, 50, 50),
          diffuse: colorVec(200, 50, 50),
          specular: colorVec(255, 255, 255),
          shininess: 32
        };

        const testLight: Light = {
          type: 'directional',
          direction: vec3(-1, 0, -1),
          color: colorVec(255, 255, 255),
          intensity: 1.0
        };

        // Test at different angles
        const angles = [0, 30, 45, 60, 90];
        const results = angles.map(angle => {
          const rad = angle * Math.PI / 180;
          const normal = vec3(Math.sin(rad), 0, Math.cos(rad));

          const input: ShadingInput = {
            position: vec3(0, 0, 0),
            normal,
            viewDirection: vec3(0, 0, 1),
            material: testMaterial,
            lights: [testLight],
            ambientLight: colorVec(20, 20, 20)
          };

          const result = computePhongLighting(input);
          return {
            angle,
            normal: { x: normal.x.toFixed(2), y: '0', z: normal.z.toFixed(2) },
            brightness: Math.round((result.finalColor.r + result.finalColor.g + result.finalColor.b) / 3),
            diffuse: Math.round((result.diffuse.r + result.diffuse.g + result.diffuse.b) / 3),
            specular: Math.round((result.specular.r + result.specular.g + result.specular.b) / 3)
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            title: 'Lighting vs Surface Angle Analysis',
            material: testMaterial,
            light: { direction: testLight.direction },
            angleAnalysis: results,
            insights: [
              'Diffuse peaks when N·L = 1 (facing light)',
              'Specular peaks when reflected light aligns with view',
              'Brightness drops off with increasing angle',
              'Higher shininess = sharper specular falloff'
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        const demoMaterial: Material = {
          ambient: colorVec(30, 30, 50),
          diffuse: colorVec(100, 100, 200),
          specular: colorVec(255, 255, 255),
          shininess: 64
        };

        const demoLights: Light[] = [
          {
            type: 'directional',
            direction: vec3(-1, -0.5, -1),
            color: colorVec(255, 255, 255),
            intensity: 0.8
          },
          {
            type: 'point',
            position: vec3(2, 2, 2),
            color: colorVec(255, 200, 150),
            intensity: 0.4,
            attenuation: { constant: 1, linear: 0.1, quadratic: 0.01 }
          }
        ];

        const input: ShadingInput = {
          position: vec3(0, 0, 0),
          normal: vec3(0, 0, 1),
          viewDirection: vec3(0, 0, 1),
          material: demoMaterial,
          lights: demoLights,
          ambientLight: colorVec(20, 20, 30)
        };

        const phongResult = computePhongLighting(input);
        const blinnResult = computeBlinnPhongLighting(input);

        const visualization = generateSphereShading('phong', demoMaterial, demoLights, 50, 25);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'Phong Illumination Model Demo',
            description: 'Blue material with white directional and warm point lights',
            material: {
              ambient: demoMaterial.ambient,
              diffuse: demoMaterial.diffuse,
              specular: demoMaterial.specular,
              shininess: demoMaterial.shininess
            },
            lights: demoLights.map(l => ({
              type: l.type,
              color: l.color,
              intensity: l.intensity
            })),
            results: {
              phong: {
                final: phongResult.finalColor,
                ambient: phongResult.ambient,
                diffuse: phongResult.diffuse,
                specular: phongResult.specular
              },
              blinn: {
                final: blinnResult.finalColor
              }
            },
            visualization,
            concepts: [
              'Ambient: constant base illumination',
              'Diffuse: Lambertian reflection (N·L)',
              'Specular: shiny highlight (R·V or N·H)',
              'Shininess: controls highlight sharpness',
              'Multiple lights combine additively'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isphongshadingAvailable(): boolean {
  return true;
}
