/**
 * SHADER GENERATOR TOOL
 *
 * Generate GLSL shaders for visual effects, procedural textures,
 * and GPU-accelerated graphics. Educational shader programming.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SHADER TEMPLATES
// ============================================================================

const VERTEX_SHADER_BASIC = `
attribute vec4 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = a_position;
    v_texCoord = a_texCoord;
}
`.trim();

const FRAGMENT_HEADERS = `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

#define PI 3.14159265359
#define TAU 6.28318530718
`.trim();

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

const NOISE_FUNCTIONS = `
// Random
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Value noise
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion
float fbm(vec2 st, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Simplex-like gradient noise
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash(i), f),
                   dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
`.trim();

// ============================================================================
// SHADER PRESETS
// ============================================================================

const SHADER_PRESETS: Record<string, { name: string; fragment: string; description: string }> = {
  gradient: {
    name: 'Animated Gradient',
    description: 'Smooth color gradient that shifts over time',
    fragment: `
void main() {
    vec2 uv = v_texCoord;
    vec3 color1 = vec3(0.2, 0.4, 0.8);
    vec3 color2 = vec3(0.8, 0.2, 0.5);
    float t = sin(u_time * 0.5) * 0.5 + 0.5;
    vec3 color = mix(color1, color2, uv.x + t * 0.3);
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  plasma: {
    name: 'Plasma Effect',
    description: 'Classic demoscene plasma with sine waves',
    fragment: `
void main() {
    vec2 uv = v_texCoord * 10.0;
    float v1 = sin(uv.x + u_time);
    float v2 = sin(uv.y + u_time);
    float v3 = sin(uv.x + uv.y + u_time);
    float v4 = sin(sqrt(uv.x * uv.x + uv.y * uv.y) + u_time);
    float v = v1 + v2 + v3 + v4;
    vec3 color = vec3(sin(v), sin(v + PI/3.0), sin(v + 2.0*PI/3.0)) * 0.5 + 0.5;
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  fractalNoise: {
    name: 'Fractal Noise',
    description: 'Multi-octave fractal Brownian motion',
    fragment: `
${NOISE_FUNCTIONS}

void main() {
    vec2 uv = v_texCoord * 4.0;
    uv += u_time * 0.1;
    float n = fbm(uv, 6);
    vec3 color = vec3(n * 0.8, n * 0.6, n * 0.4);
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  fire: {
    name: 'Fire Effect',
    description: 'Procedural fire with noise and color mapping',
    fragment: `
${NOISE_FUNCTIONS}

void main() {
    vec2 uv = v_texCoord;
    uv.y = 1.0 - uv.y;

    float n1 = noise(uv * 8.0 + vec2(0.0, -u_time * 2.0));
    float n2 = noise(uv * 16.0 + vec2(0.0, -u_time * 3.0));
    float n = n1 * 0.7 + n2 * 0.3;

    float fire = pow(1.0 - uv.y, 2.0) + n * 0.5;
    fire = clamp(fire, 0.0, 1.0);

    vec3 color = vec3(fire, fire * 0.4, fire * 0.1);
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  water: {
    name: 'Water Ripples',
    description: 'Animated water surface with caustics',
    fragment: `
void main() {
    vec2 uv = v_texCoord;
    vec2 center = vec2(0.5);

    float dist = length(uv - center);
    float wave1 = sin(dist * 30.0 - u_time * 3.0) * 0.5 + 0.5;
    float wave2 = sin(dist * 40.0 - u_time * 4.0 + 1.0) * 0.5 + 0.5;

    float waves = wave1 * 0.5 + wave2 * 0.5;
    waves *= 1.0 - dist;

    vec3 waterColor = vec3(0.1, 0.4, 0.7);
    vec3 highlight = vec3(0.8, 0.9, 1.0);
    vec3 color = mix(waterColor, highlight, waves * 0.5);

    gl_FragColor = vec4(color, 1.0);
}`,
  },

  voronoi: {
    name: 'Voronoi Cells',
    description: 'Procedural Voronoi diagram / cell noise',
    fragment: `
vec2 randomVec(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord * 6.0;
    vec2 i_uv = floor(uv);
    vec2 f_uv = fract(uv);

    float minDist = 1.0;
    vec2 minPoint;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = randomVec(i_uv + neighbor);
            point = 0.5 + 0.5 * sin(u_time + 6.2831 * point);

            float dist = length(neighbor + point - f_uv);
            if (dist < minDist) {
                minDist = dist;
                minPoint = point;
            }
        }
    }

    vec3 color = vec3(minDist);
    color = mix(vec3(0.2, 0.5, 0.8), vec3(0.9, 0.4, 0.2), minPoint.x);
    color *= 1.0 - minDist * 0.5;

    gl_FragColor = vec4(color, 1.0);
}`,
  },

  raymarching: {
    name: 'Raymarching Sphere',
    description: 'Basic raymarching with signed distance function',
    fragment: `
float sphereSDF(vec3 p, float r) {
    return length(p) - r;
}

float sceneSDF(vec3 p) {
    return sphereSDF(p - vec3(0.0, 0.0, 3.0), 1.0);
}

vec3 getNormal(vec3 p) {
    float eps = 0.001;
    return normalize(vec3(
        sceneSDF(p + vec3(eps, 0, 0)) - sceneSDF(p - vec3(eps, 0, 0)),
        sceneSDF(p + vec3(0, eps, 0)) - sceneSDF(p - vec3(0, eps, 0)),
        sceneSDF(p + vec3(0, 0, eps)) - sceneSDF(p - vec3(0, 0, eps))
    ));
}

void main() {
    vec2 uv = v_texCoord * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 ro = vec3(0.0, 0.0, 0.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    float t = 0.0;
    for (int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = sceneSDF(p);
        if (d < 0.001) {
            vec3 normal = getNormal(p);
            vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 color = vec3(0.4, 0.6, 0.8) * (diff * 0.7 + 0.3);
            gl_FragColor = vec4(color, 1.0);
            return;
        }
        t += d;
        if (t > 100.0) break;
    }

    gl_FragColor = vec4(0.1, 0.1, 0.15, 1.0);
}`,
  },

  kaleidoscope: {
    name: 'Kaleidoscope',
    description: 'Symmetric kaleidoscope pattern',
    fragment: `
void main() {
    vec2 uv = v_texCoord - 0.5;
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    float segments = 8.0;
    angle = mod(angle, TAU / segments);
    angle = abs(angle - PI / segments);

    uv = vec2(cos(angle), sin(angle)) * radius;
    uv += u_time * 0.1;

    float pattern = sin(uv.x * 20.0) * sin(uv.y * 20.0);
    pattern += sin((uv.x + uv.y) * 15.0 + u_time);

    vec3 color = 0.5 + 0.5 * cos(pattern + vec3(0.0, 2.0, 4.0));
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  matrix: {
    name: 'Matrix Rain',
    description: 'Digital rain effect',
    fragment: `
${NOISE_FUNCTIONS}

void main() {
    vec2 uv = v_texCoord;
    uv.x *= 30.0;

    float column = floor(uv.x);
    float speed = random(vec2(column, 0.0)) * 2.0 + 1.0;
    float offset = random(vec2(column, 1.0));

    float y = fract(uv.y - u_time * speed * 0.5 + offset);

    float brightness = pow(y, 3.0);
    brightness *= step(0.5, random(vec2(column, floor(u_time * 10.0 + offset * 100.0))));

    vec3 color = vec3(0.0, brightness, brightness * 0.3);
    gl_FragColor = vec4(color, 1.0);
}`,
  },

  tunnel: {
    name: '3D Tunnel',
    description: 'Infinite tunnel effect',
    fragment: `
void main() {
    vec2 uv = v_texCoord - 0.5;
    uv.x *= u_resolution.x / u_resolution.y;

    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    float tunnel = 0.2 / radius;
    tunnel += u_time * 2.0;

    float pattern = sin(tunnel * 10.0 + angle * 8.0);
    pattern = step(0.0, pattern);

    float fade = 1.0 - radius * 1.5;
    vec3 color = mix(vec3(0.8, 0.2, 0.4), vec3(0.2, 0.4, 0.8), pattern);
    color *= fade;

    gl_FragColor = vec4(color, 1.0);
}`,
  },
};

// ============================================================================
// SHADER GENERATOR FUNCTIONS
// ============================================================================

function generateColorShader(colors: string[], direction: 'horizontal' | 'vertical' | 'radial' = 'horizontal'): string {
  const colorVecs = colors.map((c, i) => {
    const hex = c.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return `vec3 c${i} = vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)});`;
  });

  let mixCode = '';
  if (colors.length === 2) {
    let coord = direction === 'horizontal' ? 'uv.x' : direction === 'vertical' ? 'uv.y' : 'length(uv - 0.5) * 2.0';
    mixCode = `vec3 color = mix(c0, c1, ${coord});`;
  } else {
    mixCode = `vec3 color = c0;`;
  }

  return `
void main() {
    vec2 uv = v_texCoord;
    ${colorVecs.join('\n    ')}
    ${mixCode}
    gl_FragColor = vec4(color, 1.0);
}`;
}

function generatePatternShader(pattern: 'stripes' | 'checkers' | 'dots' | 'grid', scale: number = 10): string {
  const patterns: Record<string, string> = {
    stripes: `float p = step(0.5, fract(uv.x * ${scale.toFixed(1)}));`,
    checkers: `float p = mod(floor(uv.x * ${scale.toFixed(1)}) + floor(uv.y * ${scale.toFixed(1)}), 2.0);`,
    dots: `
    vec2 cell = fract(uv * ${scale.toFixed(1)}) - 0.5;
    float p = 1.0 - step(0.3, length(cell));`,
    grid: `
    vec2 grid = abs(fract(uv * ${scale.toFixed(1)}) - 0.5);
    float p = step(0.45, max(grid.x, grid.y));`,
  };

  return `
void main() {
    vec2 uv = v_texCoord;
    ${patterns[pattern]}
    vec3 color = mix(vec3(0.2), vec3(0.8), p);
    gl_FragColor = vec4(color, 1.0);
}`;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const shaderGeneratorTool: UnifiedTool = {
  name: 'shader_generator',
  description: `Generate GLSL shaders for visual effects.

Operations:
- preset: Get preset shader (gradient, plasma, fire, water, voronoi, raymarching, kaleidoscope, matrix, tunnel)
- gradient: Generate gradient shader
- pattern: Generate pattern shader (stripes, checkers, dots, grid)
- noise: Generate noise shader
- custom: Generate custom shader from description
- list: List all presets

Returns complete GLSL vertex and fragment shaders.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['preset', 'gradient', 'pattern', 'noise', 'custom', 'list'],
        description: 'Shader operation',
      },
      preset_name: { type: 'string', description: 'Preset shader name' },
      colors: { type: 'string', description: 'Colors as JSON array ["#ff0000", "#0000ff"]' },
      direction: { type: 'string', description: 'Gradient direction' },
      pattern_type: { type: 'string', description: 'Pattern type' },
      scale: { type: 'number', description: 'Pattern scale' },
      animated: { type: 'boolean', description: 'Include animation' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeShaderGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'preset': {
        const { preset_name = 'plasma' } = args;
        const preset = SHADER_PRESETS[preset_name];
        if (!preset) throw new Error(`Unknown preset: ${preset_name}`);

        result = {
          operation: 'preset',
          name: preset.name,
          description: preset.description,
          vertex_shader: VERTEX_SHADER_BASIC,
          fragment_shader: FRAGMENT_HEADERS + '\n\n' + preset.fragment.trim(),
          uniforms: ['u_time (float)', 'u_resolution (vec2)'],
        };
        break;
      }

      case 'gradient': {
        const colorsStr = args.colors || '["#4F46E5", "#EC4899"]';
        const colors: string[] = JSON.parse(colorsStr);
        const direction = args.direction || 'horizontal';
        const fragment = generateColorShader(colors, direction);

        result = {
          operation: 'gradient',
          colors,
          direction,
          vertex_shader: VERTEX_SHADER_BASIC,
          fragment_shader: FRAGMENT_HEADERS + '\n\n' + fragment.trim(),
        };
        break;
      }

      case 'pattern': {
        const { pattern_type = 'checkers', scale = 10 } = args;
        const fragment = generatePatternShader(pattern_type, scale);

        result = {
          operation: 'pattern',
          pattern: pattern_type,
          scale,
          vertex_shader: VERTEX_SHADER_BASIC,
          fragment_shader: FRAGMENT_HEADERS + '\n\n' + fragment.trim(),
        };
        break;
      }

      case 'noise': {
        const { scale = 4, octaves = 6, animated = true } = args;
        const fragment = `
${NOISE_FUNCTIONS}

void main() {
    vec2 uv = v_texCoord * ${scale.toFixed(1)};
    ${animated ? 'uv += u_time * 0.1;' : ''}
    float n = fbm(uv, ${octaves});
    gl_FragColor = vec4(vec3(n), 1.0);
}`;

        result = {
          operation: 'noise',
          scale,
          octaves,
          animated,
          vertex_shader: VERTEX_SHADER_BASIC,
          fragment_shader: FRAGMENT_HEADERS + '\n\n' + fragment.trim(),
        };
        break;
      }

      case 'list': {
        result = {
          operation: 'list',
          presets: Object.entries(SHADER_PRESETS).map(([key, val]) => ({
            name: key,
            display_name: val.name,
            description: val.description,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Shader Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isShaderGeneratorAvailable(): boolean { return true; }
