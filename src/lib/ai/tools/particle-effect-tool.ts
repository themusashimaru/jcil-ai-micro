/**
 * PARTICLE EFFECT TOOL
 * Design and simulate particle effects
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface ParticleConfig {
  count: number;
  lifetime: { min: number; max: number };
  speed: { min: number; max: number };
  size: { start: number; end: number };
  color: { start: string; end: string };
  gravity: number;
  spread: number;
  emission: 'burst' | 'continuous';
}

const EFFECTS: Record<string, ParticleConfig> = {
  fire: { count: 50, lifetime: { min: 0.5, max: 1.5 }, speed: { min: 50, max: 150 }, size: { start: 20, end: 5 }, color: { start: '#ff4400', end: '#ffcc00' }, gravity: -100, spread: 0.5, emission: 'continuous' },
  smoke: { count: 30, lifetime: { min: 1, max: 3 }, speed: { min: 20, max: 60 }, size: { start: 10, end: 40 }, color: { start: '#444444', end: '#888888' }, gravity: -30, spread: 0.8, emission: 'continuous' },
  explosion: { count: 100, lifetime: { min: 0.3, max: 0.8 }, speed: { min: 200, max: 500 }, size: { start: 15, end: 3 }, color: { start: '#ffff00', end: '#ff0000' }, gravity: 100, spread: Math.PI * 2, emission: 'burst' },
  sparks: { count: 20, lifetime: { min: 0.2, max: 0.5 }, speed: { min: 100, max: 300 }, size: { start: 3, end: 1 }, color: { start: '#ffffff', end: '#ffaa00' }, gravity: 200, spread: 1, emission: 'burst' },
  snow: { count: 100, lifetime: { min: 5, max: 10 }, speed: { min: 20, max: 50 }, size: { start: 5, end: 5 }, color: { start: '#ffffff', end: '#ffffff' }, gravity: 30, spread: 0.3, emission: 'continuous' },
  rain: { count: 200, lifetime: { min: 1, max: 2 }, speed: { min: 400, max: 600 }, size: { start: 2, end: 2 }, color: { start: '#aaddff', end: '#aaddff' }, gravity: 500, spread: 0.1, emission: 'continuous' },
  confetti: { count: 50, lifetime: { min: 2, max: 4 }, speed: { min: 100, max: 200 }, size: { start: 10, end: 10 }, color: { start: '#ff0000', end: '#00ff00' }, gravity: 100, spread: Math.PI, emission: 'burst' },
  dust: { count: 40, lifetime: { min: 2, max: 5 }, speed: { min: 10, max: 30 }, size: { start: 3, end: 8 }, color: { start: '#c4a35a', end: '#d4b36a' }, gravity: -5, spread: Math.PI * 2, emission: 'continuous' },
  magic: { count: 30, lifetime: { min: 0.5, max: 1.5 }, speed: { min: 50, max: 100 }, size: { start: 8, end: 2 }, color: { start: '#aa00ff', end: '#00ffff' }, gravity: -50, spread: Math.PI * 2, emission: 'continuous' },
  blood: { count: 15, lifetime: { min: 0.3, max: 0.6 }, speed: { min: 100, max: 250 }, size: { start: 8, end: 4 }, color: { start: '#cc0000', end: '#880000' }, gravity: 300, spread: 0.8, emission: 'burst' }
};

function generateShaderCode(config: ParticleConfig): string {
  return `// Particle Vertex Shader
attribute vec3 position;
attribute float lifetime;
attribute float age;
uniform mat4 modelViewProjection;
uniform float time;

varying float vAge;
varying float vLifetime;

void main() {
  vAge = age;
  vLifetime = lifetime;

  float t = age / lifetime;
  float size = mix(${config.size.start.toFixed(1)}, ${config.size.end.toFixed(1)}, t);

  vec3 pos = position;
  pos.y += ${config.gravity.toFixed(1)} * age * age * 0.5;

  gl_Position = modelViewProjection * vec4(pos, 1.0);
  gl_PointSize = size;
}

// Particle Fragment Shader
precision mediump float;
varying float vAge;
varying float vLifetime;

void main() {
  float t = vAge / vLifetime;
  vec3 startColor = vec3(${parseInt(config.color.start.slice(1, 3), 16) / 255}, ${parseInt(config.color.start.slice(3, 5), 16) / 255}, ${parseInt(config.color.start.slice(5, 7), 16) / 255});
  vec3 endColor = vec3(${parseInt(config.color.end.slice(1, 3), 16) / 255}, ${parseInt(config.color.end.slice(3, 5), 16) / 255}, ${parseInt(config.color.end.slice(5, 7), 16) / 255});

  vec3 color = mix(startColor, endColor, t);
  float alpha = 1.0 - t;

  // Circular particle
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  gl_FragColor = vec4(color, alpha * (1.0 - dist * 2.0));
}`;
}

function generateCSSAnimation(config: ParticleConfig): string {
  return `/* CSS Particle Animation */
.particle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  animation: particle-move ${(config.lifetime.min + config.lifetime.max) / 2}s ease-out forwards;
}

@keyframes particle-move {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(${config.size.start / 10});
    background: ${config.color.start};
  }
  100% {
    opacity: 0;
    transform: translate(
      calc(var(--dx) * ${config.speed.max}px),
      calc(var(--dy) * ${config.speed.max}px + ${config.gravity}px)
    ) scale(${config.size.end / 10});
    background: ${config.color.end};
  }
}

/* JavaScript to spawn particles */
function spawnParticle(x, y) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.style.left = x + 'px';
  particle.style.top = y + 'px';
  particle.style.setProperty('--dx', (Math.random() - 0.5) * 2);
  particle.style.setProperty('--dy', (Math.random() - 0.5) * 2);
  document.body.appendChild(particle);
  setTimeout(() => particle.remove(), ${((config.lifetime.min + config.lifetime.max) / 2 * 1000).toFixed(0)});
}`;
}

function generateUnityCode(config: ParticleConfig): string {
  return `// Unity ParticleSystem Configuration
using UnityEngine;

public class ${config.emission === 'burst' ? 'Burst' : 'Continuous'}Effect : MonoBehaviour
{
    void Start()
    {
        var ps = GetComponent<ParticleSystem>();
        var main = ps.main;
        main.startLifetime = new ParticleSystem.MinMaxCurve(${config.lifetime.min}f, ${config.lifetime.max}f);
        main.startSpeed = new ParticleSystem.MinMaxCurve(${config.speed.min}f, ${config.speed.max}f);
        main.startSize = ${config.size.start}f;
        main.gravityModifier = ${(config.gravity / 100).toFixed(2)}f;

        var colorOverLifetime = ps.colorOverLifetime;
        colorOverLifetime.enabled = true;
        var gradient = new Gradient();
        gradient.SetKeys(
            new GradientColorKey[] {
                new GradientColorKey(HexToColor("${config.color.start}"), 0f),
                new GradientColorKey(HexToColor("${config.color.end}"), 1f)
            },
            new GradientAlphaKey[] {
                new GradientAlphaKey(1f, 0f),
                new GradientAlphaKey(0f, 1f)
            }
        );
        colorOverLifetime.color = gradient;

        var sizeOverLifetime = ps.sizeOverLifetime;
        sizeOverLifetime.enabled = true;
        sizeOverLifetime.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(
            new Keyframe(0f, 1f),
            new Keyframe(1f, ${(config.size.end / config.size.start).toFixed(2)}f)
        ));

        var emission = ps.emission;
        emission.rateOverTime = ${config.emission === 'continuous' ? config.count : 0};
        ${config.emission === 'burst' ? `emission.SetBurst(0, new ParticleSystem.Burst(0f, ${config.count}));` : ''}

        var shape = ps.shape;
        shape.shapeType = ParticleSystemShapeType.Cone;
        shape.angle = ${(config.spread * 180 / Math.PI).toFixed(1)}f;
    }

    Color HexToColor(string hex) => ColorUtility.TryParseHtmlString(hex, out Color c) ? c : Color.white;
}`;
}

export const particleEffectTool: UnifiedTool = {
  name: 'particle_effect',
  description: 'Particle Effect: effects, shader, css, unity, custom, blend',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['effects', 'shader', 'css', 'unity', 'custom', 'blend'] },
      effect: { type: 'string' },
      config: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeParticleEffect(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const config = args.effect ? EFFECTS[args.effect] : (args.config || EFFECTS.fire);
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'effects':
        result = { effects: Object.keys(EFFECTS), configs: EFFECTS };
        break;
      case 'shader':
        result = { shader: generateShaderCode(config), effect: args.effect || 'custom' };
        break;
      case 'css':
        result = { css: generateCSSAnimation(config), effect: args.effect || 'custom' };
        break;
      case 'unity':
        result = { unity: generateUnityCode(config), effect: args.effect || 'custom' };
        break;
      case 'custom':
        result = { config, template: EFFECTS.fire };
        break;
      case 'blend':
        const effect1 = EFFECTS[args.effect || 'fire'];
        const effect2 = EFFECTS[args.config?.blendWith || 'smoke'];
        const blended: ParticleConfig = {
          count: Math.round((effect1.count + effect2.count) / 2),
          lifetime: { min: (effect1.lifetime.min + effect2.lifetime.min) / 2, max: (effect1.lifetime.max + effect2.lifetime.max) / 2 },
          speed: { min: (effect1.speed.min + effect2.speed.min) / 2, max: (effect1.speed.max + effect2.speed.max) / 2 },
          size: { start: (effect1.size.start + effect2.size.start) / 2, end: (effect1.size.end + effect2.size.end) / 2 },
          color: effect1.color,
          gravity: (effect1.gravity + effect2.gravity) / 2,
          spread: (effect1.spread + effect2.spread) / 2,
          emission: effect1.emission
        };
        result = { blended, original1: effect1, original2: effect2 };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isParticleEffectAvailable(): boolean { return true; }
