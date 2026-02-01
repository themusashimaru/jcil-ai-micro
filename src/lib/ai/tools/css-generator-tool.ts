/**
 * CSS GENERATOR TOOL
 * Generate CSS for flexbox, grid, animations, gradients, shadows
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Flexbox generator
function generateFlexbox(config: {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  wrap?: boolean;
  gap?: string;
}): string {
  const justifyMap: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly' };
  const alignMap: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', baseline: 'baseline' };

  return `.flex-container {
  display: flex;
  flex-direction: ${config.direction || 'row'};
  justify-content: ${justifyMap[config.justify || 'start']};
  align-items: ${alignMap[config.align || 'stretch']};
  ${config.wrap ? 'flex-wrap: wrap;' : ''}
  ${config.gap ? `gap: ${config.gap};` : ''}
}`;
}

// Grid generator
function generateGrid(config: {
  columns?: number | string;
  rows?: number | string;
  gap?: string;
  areas?: string[][];
  autoFlow?: 'row' | 'column' | 'dense';
}): string {
  const cols = typeof config.columns === 'number' ? `repeat(${config.columns}, 1fr)` : (config.columns || 'repeat(3, 1fr)');
  const rows = typeof config.rows === 'number' ? `repeat(${config.rows}, 1fr)` : (config.rows || 'auto');

  let css = `.grid-container {
  display: grid;
  grid-template-columns: ${cols};
  grid-template-rows: ${rows};
  ${config.gap ? `gap: ${config.gap};` : ''}
  ${config.autoFlow ? `grid-auto-flow: ${config.autoFlow};` : ''}`;

  if (config.areas) {
    css += `\n  grid-template-areas:\n${config.areas.map(row => `    "${row.join(' ')}"`).join('\n')};`;
  }

  css += '\n}';
  return css;
}

// Gradient generator
function generateGradient(config: {
  type?: 'linear' | 'radial' | 'conic';
  colors: string[];
  angle?: number;
  positions?: number[];
}): string {
  const positions = config.positions || config.colors.map((_, i) => (i / (config.colors.length - 1)) * 100);
  const colorStops = config.colors.map((c, i) => `${c} ${positions[i]}%`).join(', ');

  switch (config.type) {
    case 'radial':
      return `background: radial-gradient(circle, ${colorStops});`;
    case 'conic':
      return `background: conic-gradient(from ${config.angle || 0}deg, ${colorStops});`;
    default:
      return `background: linear-gradient(${config.angle || 90}deg, ${colorStops});`;
  }
}

// Shadow generator
function generateShadow(config: {
  type?: 'box' | 'text' | 'drop';
  layers?: Array<{ x: number; y: number; blur: number; spread?: number; color: string; inset?: boolean }>;
  preset?: 'soft' | 'hard' | 'glow' | 'inset' | 'layered';
}): string {
  const presets: Record<string, Array<{ x: number; y: number; blur: number; spread?: number; color: string; inset?: boolean }>> = {
    soft: [{ x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(0,0,0,0.1)' }, { x: 0, y: 2, blur: 4, spread: -2, color: 'rgba(0,0,0,0.1)' }],
    hard: [{ x: 4, y: 4, blur: 0, spread: 0, color: 'rgba(0,0,0,0.25)' }],
    glow: [{ x: 0, y: 0, blur: 20, spread: 5, color: 'rgba(66,153,225,0.5)' }],
    inset: [{ x: 0, y: 2, blur: 4, color: 'rgba(0,0,0,0.1)', inset: true }],
    layered: [
      { x: 0, y: 1, blur: 3, color: 'rgba(0,0,0,0.12)' },
      { x: 0, y: 1, blur: 2, color: 'rgba(0,0,0,0.24)' }
    ]
  };

  const layers = config.layers || presets[config.preset || 'soft'];
  const shadowValue = layers.map(l =>
    `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread !== undefined ? l.spread + 'px ' : ''}${l.color}`
  ).join(', ');

  switch (config.type) {
    case 'text': return `text-shadow: ${shadowValue};`;
    case 'drop': return `filter: drop-shadow(${layers[0].x}px ${layers[0].y}px ${layers[0].blur}px ${layers[0].color});`;
    default: return `box-shadow: ${shadowValue};`;
  }
}

// Animation generator
function generateAnimation(config: {
  name?: string;
  duration?: string;
  easing?: string;
  keyframes: Record<string, Record<string, string>>;
  infinite?: boolean;
}): string {
  const name = config.name || 'custom-animation';
  const keyframesCSS = Object.entries(config.keyframes)
    .map(([key, props]) => `  ${key} {\n${Object.entries(props).map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n  }`)
    .join('\n');

  return `@keyframes ${name} {
${keyframesCSS}
}

.animated {
  animation: ${name} ${config.duration || '1s'} ${config.easing || 'ease'} ${config.infinite ? 'infinite' : ''};
}`;
}

// Button generator
function generateButton(config: {
  variant?: 'solid' | 'outline' | 'ghost' | 'gradient';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}): string {
  const sizes = { sm: { padding: '0.5rem 1rem', fontSize: '0.875rem' }, md: { padding: '0.75rem 1.5rem', fontSize: '1rem' }, lg: { padding: '1rem 2rem', fontSize: '1.125rem' } };
  const radii = { none: '0', sm: '0.25rem', md: '0.5rem', lg: '1rem', full: '9999px' };
  const color = config.color || '#3b82f6';

  const size = sizes[config.size || 'md'];
  const radius = radii[config.rounded || 'md'];

  let base = `.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${size.padding};
  font-size: ${size.fontSize};
  font-weight: 500;
  border-radius: ${radius};
  cursor: pointer;
  transition: all 0.2s ease;
`;

  switch (config.variant) {
    case 'outline':
      base += `  background: transparent;
  border: 2px solid ${color};
  color: ${color};
}
.btn:hover {
  background: ${color};
  color: white;
}`;
      break;
    case 'ghost':
      base += `  background: transparent;
  border: none;
  color: ${color};
}
.btn:hover {
  background: ${color}15;
}`;
      break;
    case 'gradient':
      base += `  background: linear-gradient(135deg, ${color}, ${color}dd);
  border: none;
  color: white;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px ${color}40;
}`;
      break;
    default:
      base += `  background: ${color};
  border: none;
  color: white;
}
.btn:hover {
  background: ${color}dd;
}`;
  }

  return base;
}

// Card generator
function generateCard(config: {
  padding?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: string;
  border?: boolean;
  hover?: boolean;
}): string {
  const shadows = {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
  };

  let css = `.card {
  padding: ${config.padding || '1.5rem'};
  background: white;
  border-radius: ${config.rounded || '0.5rem'};
  box-shadow: ${shadows[config.shadow || 'md']};
  ${config.border ? 'border: 1px solid #e5e7eb;' : ''}
}`;

  if (config.hover) {
    css += `

.card:hover {
  box-shadow: ${shadows['lg']};
  transform: translateY(-2px);
  transition: all 0.2s ease;
}`;
  }

  return css;
}

export const cssGeneratorTool: UnifiedTool = {
  name: 'css_generator',
  description: 'CSS Generator: flexbox, grid, gradient, shadow, animation, button, card, responsive',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['flexbox', 'grid', 'gradient', 'shadow', 'animation', 'button', 'card', 'responsive'] },
      config: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeCssGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const config = args.config || {};
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'flexbox':
        result = { css: generateFlexbox(config) };
        break;
      case 'grid':
        result = { css: generateGrid(config) };
        break;
      case 'gradient':
        result = { css: generateGradient({ colors: ['#667eea', '#764ba2'], ...config }) };
        break;
      case 'shadow':
        result = { css: generateShadow(config) };
        break;
      case 'animation':
        result = { css: generateAnimation({
          keyframes: config.keyframes || { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)' } },
          ...config
        })};
        break;
      case 'button':
        result = { css: generateButton(config) };
        break;
      case 'card':
        result = { css: generateCard(config) };
        break;
      case 'responsive':
        result = { css: `/* Responsive Breakpoints */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }

/* Container */
.container {
  width: 100%;
  margin: 0 auto;
  padding: 0 1rem;
}
@media (min-width: 640px) { .container { max-width: 640px; } }
@media (min-width: 768px) { .container { max-width: 768px; } }
@media (min-width: 1024px) { .container { max-width: 1024px; } }
@media (min-width: 1280px) { .container { max-width: 1280px; } }` };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCssGeneratorAvailable(): boolean { return true; }
