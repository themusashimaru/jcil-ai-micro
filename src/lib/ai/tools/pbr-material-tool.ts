/**
 * PBR-MATERIAL TOOL
 * Physically Based Rendering with Cook-Torrance BRDF,
 * GGX distribution, Fresnel equations, and energy conservation
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

interface PBRMaterial {
  albedo: Color;
  metallic: number;
  roughness: number;
  ao: number;
  emissive?: Color;
  emissiveIntensity?: number;
}

interface PBRLight {
  type: 'directional' | 'point' | 'spot';
  position?: Vec3;
  direction?: Vec3;
  color: Color;
  intensity: number;
  radius?: number;
}

interface PBRInput {
  position: Vec3;
  normal: Vec3;
  viewDirection: Vec3;
  material: PBRMaterial;
  lights: PBRLight[];
  ambientLight: Color;
  irradiance?: Color;
}

interface PBRResult {
  finalColor: Color;
  diffuse: Color;
  specular: Color;
  ambient: Color;
  fresnel: number;
  components: {
    light: string;
    diffuse: Color;
    specular: Color;
    F: number;
    D: number;
    G: number;
  }[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PI = Math.PI;
const EPSILON = 1e-6;

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
  if (len < EPSILON) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / len);
}

function negate(v: Vec3): Vec3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

// ============================================================================
// COLOR OPERATIONS
// ============================================================================

function color(r: number, g: number, b: number): Color {
  return { r, g, b };
}

function colorToVec3(c: Color): Vec3 {
  return { x: c.r / 255, y: c.g / 255, z: c.b / 255 };
}

function vec3ToColor(v: Vec3): Color {
  return {
    r: Math.max(0, Math.min(255, Math.round(v.x * 255))),
    g: Math.max(0, Math.min(255, Math.round(v.y * 255))),
    b: Math.max(0, Math.min(255, Math.round(v.z * 255)))
  };
}

function addColor(a: Color, b: Color): Color {
  return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
}

function scaleColor(c: Color, s: number): Color {
  return { r: c.r * s, g: c.g * s, b: c.b * s };
}

function clampColor(c: Color): Color {
  return {
    r: Math.max(0, Math.min(255, Math.round(c.r))),
    g: Math.max(0, Math.min(255, Math.round(c.g))),
    b: Math.max(0, Math.min(255, Math.round(c.b)))
  };
}

// ============================================================================
// PBR FUNCTIONS
// ============================================================================

/**
 * Fresnel-Schlick approximation
 * F(h,v) = F0 + (1 - F0)(1 - h·v)^5
 */
function fresnelSchlick(cosTheta: number, F0: Vec3): Vec3 {
  const t = Math.pow(1.0 - cosTheta, 5.0);
  return {
    x: F0.x + (1.0 - F0.x) * t,
    y: F0.y + (1.0 - F0.y) * t,
    z: F0.z + (1.0 - F0.z) * t
  };
}

/**
 * Fresnel-Schlick with roughness for ambient IBL
 */
function fresnelSchlickRoughness(cosTheta: number, F0: Vec3, roughness: number): Vec3 {
  const oneMinusRoughness = 1.0 - roughness;
  const t = Math.pow(1.0 - cosTheta, 5.0);
  return {
    x: F0.x + (Math.max(oneMinusRoughness, F0.x) - F0.x) * t,
    y: F0.y + (Math.max(oneMinusRoughness, F0.y) - F0.y) * t,
    z: F0.z + (Math.max(oneMinusRoughness, F0.z) - F0.z) * t
  };
}

/**
 * GGX/Trowbridge-Reitz Normal Distribution Function
 * D(h) = α² / (π((n·h)²(α² - 1) + 1)²)
 */
function distributionGGX(NdotH: number, roughness: number): number {
  const a = roughness * roughness;
  const a2 = a * a;
  const NdotH2 = NdotH * NdotH;

  const denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom + EPSILON);
}

/**
 * Smith's Geometry function with GGX
 * G(n,v,l) = G1(n,v) * G1(n,l)
 */
function geometrySchlickGGX(NdotV: number, roughness: number): number {
  const r = roughness + 1.0;
  const k = (r * r) / 8.0;

  return NdotV / (NdotV * (1.0 - k) + k + EPSILON);
}

function geometrySmith(NdotV: number, NdotL: number, roughness: number): number {
  const ggx1 = geometrySchlickGGX(NdotV, roughness);
  const ggx2 = geometrySchlickGGX(NdotL, roughness);
  return ggx1 * ggx2;
}

/**
 * Cook-Torrance BRDF
 * f = (D * F * G) / (4 * (n·v) * (n·l))
 */
function cookTorranceBRDF(
  N: Vec3, V: Vec3, L: Vec3, H: Vec3,
  albedo: Vec3, metallic: number, roughness: number
): { specular: Vec3; kS: Vec3; D: number; G: number; F: Vec3 } {
  // Base reflectivity (F0) - dielectric = 0.04, metal = albedo
  const F0 = lerp3(vec3(0.04, 0.04, 0.04), albedo, metallic);

  const NdotH = Math.max(dot(N, H), 0.0);
  const NdotV = Math.max(dot(N, V), 0.0);
  const NdotL = Math.max(dot(N, L), 0.0);
  const HdotV = Math.max(dot(H, V), 0.0);

  // D, F, G terms
  const D = distributionGGX(NdotH, roughness);
  const F = fresnelSchlick(HdotV, F0);
  const G = geometrySmith(NdotV, NdotL, roughness);

  // Cook-Torrance specular
  const numerator = {
    x: D * G * F.x,
    y: D * G * F.y,
    z: D * G * F.z
  };
  const denominator = 4.0 * NdotV * NdotL + EPSILON;

  const specular = scale(numerator, 1.0 / denominator);

  return { specular, kS: F, D, G, F };
}

/**
 * Compute PBR lighting
 */
function computePBRLighting(input: PBRInput): PBRResult {
  const { position, normal, viewDirection, material, lights, ambientLight, irradiance } = input;

  const N = normalize(normal);
  const V = normalize(viewDirection);

  const albedo = colorToVec3(material.albedo);
  const metallic = material.metallic;
  const roughness = Math.max(0.04, material.roughness); // Prevent division issues
  const ao = material.ao;

  // F0 for ambient
  const F0 = lerp3(vec3(0.04, 0.04, 0.04), albedo, metallic);

  let totalDiffuse: Vec3 = { x: 0, y: 0, z: 0 };
  let totalSpecular: Vec3 = { x: 0, y: 0, z: 0 };
  let avgFresnel = 0;

  const components: PBRResult['components'] = [];

  // Process each light
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    let L: Vec3;
    let attenuation = 1.0;

    if (light.type === 'directional') {
      L = normalize(negate(light.direction!));
    } else {
      const toLight = sub(light.position!, position);
      const distance = length(toLight);
      L = normalize(toLight);
      // Inverse square falloff
      attenuation = 1.0 / (distance * distance + EPSILON);
    }

    const H = normalize(add(V, L));
    const NdotL = Math.max(dot(N, L), 0.0);

    if (NdotL <= 0) continue;

    // Radiance
    const lightColor = colorToVec3(light.color);
    const radiance = scale(lightColor, light.intensity * attenuation);

    // BRDF
    const brdfResult = cookTorranceBRDF(N, V, L, H, albedo, metallic, roughness);

    // Energy conservation: kD + kS = 1
    const kS = brdfResult.kS;
    const kD = {
      x: (1.0 - kS.x) * (1.0 - metallic),
      y: (1.0 - kS.y) * (1.0 - metallic),
      z: (1.0 - kS.z) * (1.0 - metallic)
    };

    // Lambertian diffuse
    const diffuse = {
      x: kD.x * albedo.x / PI,
      y: kD.y * albedo.y / PI,
      z: kD.z * albedo.z / PI
    };

    // Outgoing radiance
    const diffuseOut = {
      x: diffuse.x * radiance.x * NdotL,
      y: diffuse.y * radiance.y * NdotL,
      z: diffuse.z * radiance.z * NdotL
    };

    const specularOut = {
      x: brdfResult.specular.x * radiance.x * NdotL,
      y: brdfResult.specular.y * radiance.y * NdotL,
      z: brdfResult.specular.z * radiance.z * NdotL
    };

    totalDiffuse = add(totalDiffuse, diffuseOut);
    totalSpecular = add(totalSpecular, specularOut);
    avgFresnel += (kS.x + kS.y + kS.z) / 3;

    components.push({
      light: `${light.type} ${i}`,
      diffuse: vec3ToColor(scale(diffuseOut, 255)),
      specular: vec3ToColor(scale(specularOut, 255)),
      F: (kS.x + kS.y + kS.z) / 3,
      D: brdfResult.D,
      G: brdfResult.G
    });
  }

  // Ambient lighting (simplified IBL)
  const NdotV = Math.max(dot(N, V), 0.0);
  const F = fresnelSchlickRoughness(NdotV, F0, roughness);
  const kS = F;
  const kD = {
    x: (1.0 - kS.x) * (1.0 - metallic),
    y: (1.0 - kS.y) * (1.0 - metallic),
    z: (1.0 - kS.z) * (1.0 - metallic)
  };

  const ambientVec = colorToVec3(ambientLight);
  const irradianceVec = irradiance ? colorToVec3(irradiance) : ambientVec;

  const ambientDiffuse = {
    x: kD.x * irradianceVec.x * albedo.x,
    y: kD.y * irradianceVec.y * albedo.y,
    z: kD.z * irradianceVec.z * albedo.z
  };

  const ambientSpecular = {
    x: F.x * ambientVec.x * 0.3,
    y: F.y * ambientVec.y * 0.3,
    z: F.z * ambientVec.z * 0.3
  };

  const ambient = {
    x: (ambientDiffuse.x + ambientSpecular.x) * ao,
    y: (ambientDiffuse.y + ambientSpecular.y) * ao,
    z: (ambientDiffuse.z + ambientSpecular.z) * ao
  };

  // Final color
  let finalVec = add(add(totalDiffuse, totalSpecular), ambient);

  // Emissive
  if (material.emissive) {
    const emissive = colorToVec3(material.emissive);
    const emissiveIntensity = material.emissiveIntensity || 1.0;
    finalVec = add(finalVec, scale(emissive, emissiveIntensity));
  }

  // Tone mapping (simple Reinhard)
  finalVec = {
    x: finalVec.x / (finalVec.x + 1.0),
    y: finalVec.y / (finalVec.y + 1.0),
    z: finalVec.z / (finalVec.z + 1.0)
  };

  // Gamma correction
  finalVec = {
    x: Math.pow(finalVec.x, 1.0 / 2.2),
    y: Math.pow(finalVec.y, 1.0 / 2.2),
    z: Math.pow(finalVec.z, 1.0 / 2.2)
  };

  return {
    finalColor: vec3ToColor(finalVec),
    diffuse: vec3ToColor(totalDiffuse),
    specular: vec3ToColor(totalSpecular),
    ambient: vec3ToColor(ambient),
    fresnel: lights.length > 0 ? avgFresnel / lights.length : 0,
    components
  };
}

// ============================================================================
// MATERIAL PRESETS
// ============================================================================

const MATERIAL_PRESETS: Record<string, PBRMaterial> = {
  gold: {
    albedo: color(255, 215, 0),
    metallic: 1.0,
    roughness: 0.3,
    ao: 1.0
  },
  silver: {
    albedo: color(192, 192, 192),
    metallic: 1.0,
    roughness: 0.2,
    ao: 1.0
  },
  copper: {
    albedo: color(184, 115, 51),
    metallic: 1.0,
    roughness: 0.4,
    ao: 1.0
  },
  iron: {
    albedo: color(86, 86, 86),
    metallic: 1.0,
    roughness: 0.6,
    ao: 1.0
  },
  plastic_red: {
    albedo: color(200, 50, 50),
    metallic: 0.0,
    roughness: 0.4,
    ao: 1.0
  },
  plastic_white: {
    albedo: color(240, 240, 240),
    metallic: 0.0,
    roughness: 0.3,
    ao: 1.0
  },
  rubber: {
    albedo: color(30, 30, 30),
    metallic: 0.0,
    roughness: 0.9,
    ao: 1.0
  },
  ceramic: {
    albedo: color(220, 220, 220),
    metallic: 0.0,
    roughness: 0.1,
    ao: 1.0
  },
  wood: {
    albedo: color(139, 90, 43),
    metallic: 0.0,
    roughness: 0.7,
    ao: 0.9
  },
  concrete: {
    albedo: color(128, 128, 128),
    metallic: 0.0,
    roughness: 0.95,
    ao: 0.8
  }
};

// ============================================================================
// VISUALIZATION
// ============================================================================

function generateMaterialSphere(
  material: PBRMaterial,
  light: PBRLight,
  width: number = 30,
  height: number = 15
): string[] {
  const lines: string[] = [];
  const shades = ' .:-=+*#%@';
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.9;

  const viewDir = vec3(0, 0, 1);
  const ambientLight = color(30, 30, 40);

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

      const input: PBRInput = {
        position: pos,
        normal,
        viewDirection: viewDir,
        material,
        lights: [light],
        ambientLight
      };

      const result = computePBRLighting(input);
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

export const pbrmaterialTool: UnifiedTool = {
  name: 'pbr_material',
  description: 'Physically Based Rendering with Cook-Torrance BRDF, GGX distribution, Fresnel equations, energy conservation, and material presets',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compute', 'preset', 'compare', 'visualize', 'analyze', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      position: { type: 'object', description: 'Surface position' },
      normal: { type: 'object', description: 'Surface normal' },
      viewDirection: { type: 'object', description: 'View direction' },
      material: { type: 'object', description: 'PBR material (albedo, metallic, roughness, ao)' },
      materialPreset: { type: 'string', description: 'Material preset name' },
      lights: { type: 'array', description: 'Array of lights' },
      ambientLight: { type: 'object', description: 'Ambient light color' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executepbrmaterial(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, position, normal, viewDirection, material, materialPreset, lights, ambientLight } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'PBR Material System',
            description: 'Physically Based Rendering for realistic materials',
            capabilities: [
              'Cook-Torrance BRDF',
              'GGX/Trowbridge-Reitz microfacet distribution',
              'Fresnel-Schlick approximation',
              'Smith geometry function',
              'Energy conservation',
              'Metallic-roughness workflow',
              'HDR tone mapping',
              'Material presets'
            ],
            equations: {
              BRDF: 'f = (D * F * G) / (4 * (n·v) * (n·l))',
              D: 'GGX Distribution: α² / (π((n·h)²(α² - 1) + 1)²)',
              F: 'Fresnel-Schlick: F0 + (1-F0)(1-h·v)^5',
              G: 'Smith-GGX: G1(n,v) * G1(n,l)'
            },
            materialParameters: {
              albedo: 'Base color (RGB)',
              metallic: '0 = dielectric, 1 = metal',
              roughness: '0 = smooth, 1 = rough',
              ao: 'Ambient occlusion (0-1)'
            },
            presets: Object.keys(MATERIAL_PRESETS),
            operations: ['compute', 'preset', 'compare', 'visualize', 'analyze', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Compute PBR Lighting',
                params: {
                  operation: 'compute',
                  normal: { x: 0, y: 0, z: 1 },
                  viewDirection: { x: 0, y: 0, z: 1 },
                  material: {
                    albedo: { r: 255, g: 215, b: 0 },
                    metallic: 1.0,
                    roughness: 0.3,
                    ao: 1.0
                  },
                  lights: [{
                    type: 'directional',
                    direction: { x: -1, y: -1, z: -1 },
                    color: { r: 255, g: 255, b: 255 },
                    intensity: 3.0
                  }]
                }
              },
              {
                name: 'Use Material Preset',
                params: {
                  operation: 'preset',
                  materialPreset: 'gold'
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'compute': {
        const mat: PBRMaterial = material || {
          albedo: color(200, 100, 100),
          metallic: 0.5,
          roughness: 0.5,
          ao: 1.0
        };

        const defaultLights: PBRLight[] = lights || [{
          type: 'directional',
          direction: vec3(-1, -1, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        }];

        const input: PBRInput = {
          position: position || vec3(0, 0, 0),
          normal: normal || vec3(0, 0, 1),
          viewDirection: viewDirection || vec3(0, 0, 1),
          material: mat,
          lights: defaultLights,
          ambientLight: ambientLight || color(30, 30, 40)
        };

        const result = computePBRLighting(input);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compute',
            input: {
              material: mat,
              lightCount: defaultLights.length
            },
            result: {
              finalColor: result.finalColor,
              components: {
                diffuse: result.diffuse,
                specular: result.specular,
                ambient: result.ambient
              },
              fresnel: result.fresnel.toFixed(3),
              perLight: result.components.map(c => ({
                ...c,
                F: c.F.toFixed(3),
                D: c.D.toFixed(3),
                G: c.G.toFixed(3)
              }))
            }
          }, null, 2)
        };
      }

      case 'preset': {
        const presetName = materialPreset || 'gold';
        const preset = MATERIAL_PRESETS[presetName];

        if (!preset) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown preset: ${presetName}`,
              availablePresets: Object.keys(MATERIAL_PRESETS)
            }, null, 2),
            isError: true
          };
        }

        const light: PBRLight = {
          type: 'directional',
          direction: vec3(-1, -0.5, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        };

        const visualization = generateMaterialSphere(preset, light, 40, 20);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'preset',
            name: presetName,
            material: preset,
            description: {
              isMetallic: preset.metallic > 0.5 ? 'Yes' : 'No',
              roughnessLevel: preset.roughness < 0.3 ? 'Smooth' : preset.roughness < 0.7 ? 'Medium' : 'Rough'
            },
            visualization
          }, null, 2)
        };
      }

      case 'compare': {
        const light: PBRLight = {
          type: 'directional',
          direction: vec3(-1, -0.5, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        };

        const comparisons = ['gold', 'silver', 'plastic_red', 'rubber'].map(name => {
          const mat = MATERIAL_PRESETS[name];
          return {
            name,
            material: mat,
            visualization: generateMaterialSphere(mat, light, 25, 12)
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            title: 'Material Comparison',
            materials: comparisons,
            insights: [
              'Metals have colored specular highlights (albedo affects F0)',
              'Dielectrics have white specular highlights (F0 ≈ 0.04)',
              'Higher roughness = larger, dimmer highlights',
              'Lower roughness = sharp, bright highlights'
            ]
          }, null, 2)
        };
      }

      case 'visualize': {
        const mat: PBRMaterial = material || MATERIAL_PRESETS[materialPreset || 'gold'];

        const light: PBRLight = (lights && lights[0]) || {
          type: 'directional',
          direction: vec3(-1, -0.5, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        };

        const visualization = generateMaterialSphere(mat, light, 50, 25);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            material: mat,
            visualization,
            legend: {
              '@': 'Brightest (specular highlight)',
              '#': 'High intensity',
              ' ': 'Background/shadow'
            }
          }, null, 2)
        };
      }

      case 'analyze': {
        // Analyze roughness and metallic effects
        const roughnessLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
        const metallicLevels = [0.0, 0.5, 1.0];

        const light: PBRLight = {
          type: 'directional',
          direction: vec3(-1, -1, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        };

        const analysis = roughnessLevels.map(roughness => {
          return metallicLevels.map(metallic => {
            const mat: PBRMaterial = {
              albedo: color(200, 100, 100),
              metallic,
              roughness,
              ao: 1.0
            };

            const input: PBRInput = {
              position: vec3(0, 0, 0),
              normal: vec3(0, 0, 1),
              viewDirection: vec3(0, 0, 1),
              material: mat,
              lights: [light],
              ambientLight: color(30, 30, 40)
            };

            const result = computePBRLighting(input);

            return {
              roughness,
              metallic,
              brightness: Math.round((result.finalColor.r + result.finalColor.g + result.finalColor.b) / 3),
              specularIntensity: Math.round((result.specular.r + result.specular.g + result.specular.b) / 3)
            };
          });
        }).flat();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            title: 'Roughness and Metallic Analysis',
            data: analysis,
            findings: [
              'Lower roughness = higher specular intensity',
              'Metallic materials have colored specular',
              'Dielectric (metallic=0) preserves diffuse color',
              'Metallic (metallic=1) has no diffuse, only specular'
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        const goldMat = MATERIAL_PRESETS['gold'];
        const plasticMat = MATERIAL_PRESETS['plastic_red'];

        const light: PBRLight = {
          type: 'directional',
          direction: vec3(-1, -0.5, -1),
          color: color(255, 255, 255),
          intensity: 3.0
        };

        const goldInput: PBRInput = {
          position: vec3(0, 0, 0),
          normal: vec3(0, 0, 1),
          viewDirection: vec3(0, 0, 1),
          material: goldMat,
          lights: [light],
          ambientLight: color(30, 30, 40)
        };

        const plasticInput: PBRInput = {
          position: vec3(0, 0, 0),
          normal: vec3(0, 0, 1),
          viewDirection: vec3(0, 0, 1),
          material: plasticMat,
          lights: [light],
          ambientLight: color(30, 30, 40)
        };

        const goldResult = computePBRLighting(goldInput);
        const plasticResult = computePBRLighting(plasticInput);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'PBR Material Demo: Metal vs Dielectric',
            gold: {
              material: goldMat,
              result: goldResult,
              visualization: generateMaterialSphere(goldMat, light, 35, 17),
              explanation: 'Metal: High Fresnel, colored specular, no diffuse'
            },
            plastic: {
              material: plasticMat,
              result: plasticResult,
              visualization: generateMaterialSphere(plasticMat, light, 35, 17),
              explanation: 'Dielectric: Low F0 (0.04), white specular, colored diffuse'
            },
            concepts: [
              'PBR uses physically-derived equations',
              'Energy conservation: kD + kS = 1',
              'Microfacet theory models surface roughness',
              'Fresnel effect: more reflective at grazing angles',
              'Metallic materials have no diffuse reflection',
              'Cook-Torrance BRDF combines D, F, G terms'
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

export function ispbrmaterialAvailable(): boolean {
  return true;
}
