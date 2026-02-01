/**
 * SVG GENERATOR TOOL
 *
 * Creates and manipulates SVG (Scalable Vector Graphics) directly in chat.
 * Generates complete SVG markup that can be rendered in browsers.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SVG PRIMITIVES
// ============================================================================

interface SVGElement {
  type: string;
  attrs: Record<string, string | number>;
  children?: SVGElement[];
  content?: string;
}

function rect(x: number, y: number, width: number, height: number, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'rect', attrs: { x, y, width, height, ...attrs } };
}

function circle(cx: number, cy: number, r: number, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'circle', attrs: { cx, cy, r, ...attrs } };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'ellipse', attrs: { cx, cy, rx, ry, ...attrs } };
}

function line(x1: number, y1: number, x2: number, y2: number, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'line', attrs: { x1, y1, x2, y2, ...attrs } };
}

function polyline(points: [number, number][], attrs: Record<string, string | number> = {}): SVGElement {
  const pointsStr = points.map(([x, y]) => `${x},${y}`).join(' ');
  return { type: 'polyline', attrs: { points: pointsStr, ...attrs } };
}

function polygon(points: [number, number][], attrs: Record<string, string | number> = {}): SVGElement {
  const pointsStr = points.map(([x, y]) => `${x},${y}`).join(' ');
  return { type: 'polygon', attrs: { points: pointsStr, ...attrs } };
}

function path(d: string, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'path', attrs: { d, ...attrs } };
}

function text(x: number, y: number, content: string, attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'text', attrs: { x, y, ...attrs }, content };
}

function group(children: SVGElement[], attrs: Record<string, string | number> = {}): SVGElement {
  return { type: 'g', attrs, children };
}

// ============================================================================
// PATH COMMANDS
// ============================================================================

class PathBuilder {
  private commands: string[] = [];

  moveTo(x: number, y: number): PathBuilder {
    this.commands.push(`M ${x} ${y}`);
    return this;
  }

  lineTo(x: number, y: number): PathBuilder {
    this.commands.push(`L ${x} ${y}`);
    return this;
  }

  horizontalLine(x: number): PathBuilder {
    this.commands.push(`H ${x}`);
    return this;
  }

  verticalLine(y: number): PathBuilder {
    this.commands.push(`V ${y}`);
    return this;
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): PathBuilder {
    this.commands.push(`C ${x1} ${y1}, ${x2} ${y2}, ${x} ${y}`);
    return this;
  }

  smoothCurveTo(x2: number, y2: number, x: number, y: number): PathBuilder {
    this.commands.push(`S ${x2} ${y2}, ${x} ${y}`);
    return this;
  }

  quadraticCurveTo(x1: number, y1: number, x: number, y: number): PathBuilder {
    this.commands.push(`Q ${x1} ${y1}, ${x} ${y}`);
    return this;
  }

  arc(rx: number, ry: number, rotation: number, largeArc: boolean, sweep: boolean, x: number, y: number): PathBuilder {
    this.commands.push(`A ${rx} ${ry} ${rotation} ${largeArc ? 1 : 0} ${sweep ? 1 : 0} ${x} ${y}`);
    return this;
  }

  closePath(): PathBuilder {
    this.commands.push('Z');
    return this;
  }

  build(): string {
    return this.commands.join(' ');
  }
}

// ============================================================================
// SVG GENERATORS
// ============================================================================

function elementToSVG(el: SVGElement, indent: number = 0): string {
  const pad = '  '.repeat(indent);
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  if (el.children && el.children.length > 0) {
    const childrenSVG = el.children.map(c => elementToSVG(c, indent + 1)).join('\n');
    return `${pad}<${el.type} ${attrs}>\n${childrenSVG}\n${pad}</${el.type}>`;
  } else if (el.content) {
    return `${pad}<${el.type} ${attrs}>${el.content}</${el.type}>`;
  } else {
    return `${pad}<${el.type} ${attrs}/>`;
  }
}

function wrapSVG(elements: SVGElement[], width: number, height: number, viewBox?: string): string {
  const vb = viewBox || `0 0 ${width} ${height}`;
  const content = elements.map(el => elementToSVG(el, 1)).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vb}">
${content}
</svg>`;
}

// ============================================================================
// SHAPE GENERATORS
// ============================================================================

function generateStar(cx: number, cy: number, outerR: number, innerR: number, points: number): SVGElement {
  const pathPoints: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pathPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return polygon(pathPoints, { fill: 'currentColor' });
}

function generateHeart(cx: number, cy: number, size: number): SVGElement {
  const d = new PathBuilder()
    .moveTo(cx, cy + size * 0.3)
    .curveTo(cx, cy - size * 0.3, cx - size * 0.5, cy - size * 0.3, cx - size * 0.5, cy)
    .curveTo(cx - size * 0.5, cy + size * 0.3, cx, cy + size * 0.6, cx, cy + size * 0.8)
    .curveTo(cx, cy + size * 0.6, cx + size * 0.5, cy + size * 0.3, cx + size * 0.5, cy)
    .curveTo(cx + size * 0.5, cy - size * 0.3, cx, cy - size * 0.3, cx, cy + size * 0.3)
    .closePath()
    .build();
  return path(d, { fill: 'currentColor' });
}

function generateSpiral(cx: number, cy: number, maxR: number, turns: number, points: number = 100): SVGElement {
  const pathPoints: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * turns * 2 * Math.PI;
    const r = (i / points) * maxR;
    pathPoints.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return polyline(pathPoints, { fill: 'none', stroke: 'currentColor', 'stroke-width': 2 });
}

function generateRegularPolygon(cx: number, cy: number, r: number, sides: number): SVGElement {
  const points: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return polygon(points, { fill: 'currentColor' });
}

function generateArrow(x1: number, y1: number, x2: number, y2: number, headSize: number = 10): SVGElement {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowHead: [number, number][] = [
    [x2, y2],
    [
      x2 - headSize * Math.cos(angle - Math.PI / 6),
      y2 - headSize * Math.sin(angle - Math.PI / 6),
    ],
    [
      x2 - headSize * Math.cos(angle + Math.PI / 6),
      y2 - headSize * Math.sin(angle + Math.PI / 6),
    ],
  ];
  return group([
    line(x1, y1, x2, y2, { stroke: 'currentColor', 'stroke-width': 2 }),
    polygon(arrowHead, { fill: 'currentColor' }),
  ]);
}

function generateGrid(width: number, height: number, cellSize: number): SVGElement {
  const lines: SVGElement[] = [];
  for (let x = 0; x <= width; x += cellSize) {
    lines.push(line(x, 0, x, height, { stroke: '#ddd', 'stroke-width': 1 }));
  }
  for (let y = 0; y <= height; y += cellSize) {
    lines.push(line(0, y, width, y, { stroke: '#ddd', 'stroke-width': 1 }));
  }
  return group(lines);
}

function generateWave(width: number, amplitude: number, frequency: number, yOffset: number): SVGElement {
  const points: [number, number][] = [];
  for (let x = 0; x <= width; x += 2) {
    const y = yOffset + amplitude * Math.sin((x / width) * frequency * 2 * Math.PI);
    points.push([x, y]);
  }
  return polyline(points, { fill: 'none', stroke: 'currentColor', 'stroke-width': 2 });
}

// ============================================================================
// CHART GENERATORS
// ============================================================================

function generateBarChart(
  data: { label: string; value: number }[],
  width: number,
  height: number,
  colors: string[] = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981']
): SVGElement {
  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = (width - 60) / data.length - 10;
  const chartHeight = height - 60;

  const elements: SVGElement[] = [];

  // Bars
  data.forEach((d, i) => {
    const barHeight = (d.value / maxValue) * chartHeight;
    const x = 50 + i * (barWidth + 10);
    const y = 20 + chartHeight - barHeight;
    elements.push(rect(x, y, barWidth, barHeight, { fill: colors[i % colors.length], rx: 4 }));
    elements.push(text(x + barWidth / 2, height - 20, d.label, {
      'text-anchor': 'middle',
      'font-size': 12,
      fill: '#666',
    }));
    elements.push(text(x + barWidth / 2, y - 5, d.value.toString(), {
      'text-anchor': 'middle',
      'font-size': 11,
      fill: '#333',
    }));
  });

  return group(elements);
}

function generatePieChart(
  data: { label: string; value: number }[],
  cx: number,
  cy: number,
  r: number,
  colors: string[] = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#06B6D4']
): SVGElement {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let startAngle = -Math.PI / 2;

  const elements: SVGElement[] = [];

  data.forEach((d, i) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const largeArc = sliceAngle > Math.PI;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const pathD = new PathBuilder()
      .moveTo(cx, cy)
      .lineTo(x1, y1)
      .arc(r, r, 0, largeArc, true, x2, y2)
      .closePath()
      .build();

    elements.push(path(pathD, { fill: colors[i % colors.length] }));

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = r * 0.7;
    elements.push(text(
      cx + labelR * Math.cos(midAngle),
      cy + labelR * Math.sin(midAngle),
      `${Math.round((d.value / total) * 100)}%`,
      { 'text-anchor': 'middle', 'font-size': 12, fill: 'white', 'font-weight': 'bold' }
    ));

    startAngle = endAngle;
  });

  return group(elements);
}

function generateLineChart(
  data: number[],
  width: number,
  height: number,
  color: string = '#4F46E5'
): SVGElement {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  const chartWidth = width - 60;
  const chartHeight = height - 40;
  const xStep = chartWidth / (data.length - 1);

  const points: [number, number][] = data.map((v, i) => [
    40 + i * xStep,
    20 + chartHeight - ((v - minValue) / range) * chartHeight,
  ]);

  const elements: SVGElement[] = [
    // Grid lines
    ...Array.from({ length: 5 }, (_, i) => {
      const y = 20 + (i / 4) * chartHeight;
      return line(40, y, width - 20, y, { stroke: '#eee', 'stroke-width': 1 });
    }),
    // Line
    polyline(points, { fill: 'none', stroke: color, 'stroke-width': 2 }),
    // Points
    ...points.map(([x, y]) => circle(x, y, 4, { fill: color })),
  ];

  return group(elements);
}

// ============================================================================
// ICON GENERATOR
// ============================================================================

const ICONS: Record<string, (size: number) => SVGElement> = {
  check: (s) => path(new PathBuilder()
    .moveTo(s * 0.2, s * 0.5)
    .lineTo(s * 0.4, s * 0.7)
    .lineTo(s * 0.8, s * 0.3)
    .build(), { fill: 'none', stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round' }),

  x: (s) => group([
    line(s * 0.2, s * 0.2, s * 0.8, s * 0.8, { stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round' }),
    line(s * 0.8, s * 0.2, s * 0.2, s * 0.8, { stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round' }),
  ]),

  plus: (s) => group([
    line(s * 0.5, s * 0.2, s * 0.5, s * 0.8, { stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round' }),
    line(s * 0.2, s * 0.5, s * 0.8, s * 0.5, { stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round' }),
  ]),

  minus: (s) => line(s * 0.2, s * 0.5, s * 0.8, s * 0.5, {
    stroke: 'currentColor', 'stroke-width': s * 0.1, 'stroke-linecap': 'round',
  }),

  arrow_right: (s) => generateArrow(s * 0.2, s * 0.5, s * 0.8, s * 0.5, s * 0.15),

  arrow_up: (s) => generateArrow(s * 0.5, s * 0.8, s * 0.5, s * 0.2, s * 0.15),

  home: (s) => group([
    polygon([[s * 0.5, s * 0.15], [s * 0.85, s * 0.45], [s * 0.15, s * 0.45]], { fill: 'currentColor' }),
    rect(s * 0.25, s * 0.45, s * 0.5, s * 0.4, { fill: 'currentColor' }),
    rect(s * 0.4, s * 0.6, s * 0.2, s * 0.25, { fill: 'white' }),
  ]),

  star: (s) => generateStar(s * 0.5, s * 0.5, s * 0.4, s * 0.15, 5),

  heart: (s) => generateHeart(s * 0.5, s * 0.45, s * 0.4),

  sun: (s) => group([
    circle(s * 0.5, s * 0.5, s * 0.2, { fill: 'currentColor' }),
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4;
      return line(
        s * 0.5 + s * 0.3 * Math.cos(angle),
        s * 0.5 + s * 0.3 * Math.sin(angle),
        s * 0.5 + s * 0.4 * Math.cos(angle),
        s * 0.5 + s * 0.4 * Math.sin(angle),
        { stroke: 'currentColor', 'stroke-width': s * 0.06, 'stroke-linecap': 'round' }
      );
    }),
  ]),

  moon: (s) => path(new PathBuilder()
    .moveTo(s * 0.7, s * 0.2)
    .arc(s * 0.3, s * 0.3, 0, true, false, s * 0.7, s * 0.8)
    .arc(s * 0.25, s * 0.25, 0, true, true, s * 0.7, s * 0.2)
    .build(), { fill: 'currentColor' }),
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const svgGeneratorTool: UnifiedTool = {
  name: 'svg_generator',
  description: `Generate SVG graphics and visualizations directly in chat.

Operations:
- shape: Generate basic shapes (rect, circle, ellipse, line, polygon)
- star: Create star shape with configurable points
- heart: Create heart shape
- spiral: Create spiral pattern
- regular_polygon: Create regular polygon (pentagon, hexagon, etc.)
- arrow: Create directional arrow
- grid: Generate grid pattern
- wave: Create sine wave
- bar_chart: Generate bar chart from data
- pie_chart: Generate pie chart from data
- line_chart: Generate line chart from data
- icon: Generate common icons (check, x, plus, minus, arrow, home, star, heart, sun, moon)
- custom: Build custom SVG with multiple elements
- path: Generate SVG from path commands

Returns complete SVG markup ready for rendering.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'shape', 'star', 'heart', 'spiral', 'regular_polygon', 'arrow',
          'grid', 'wave', 'bar_chart', 'pie_chart', 'line_chart', 'icon', 'custom', 'path',
        ],
        description: 'Type of SVG to generate',
      },
      width: { type: 'number', description: 'SVG width (default 200)' },
      height: { type: 'number', description: 'SVG height (default 200)' },
      // Shape parameters
      shape_type: { type: 'string', enum: ['rect', 'circle', 'ellipse', 'line', 'polygon'] },
      x: { type: 'number', description: 'X position' },
      y: { type: 'number', description: 'Y position' },
      r: { type: 'number', description: 'Radius' },
      rx: { type: 'number', description: 'X radius for ellipse' },
      ry: { type: 'number', description: 'Y radius for ellipse' },
      x1: { type: 'number', description: 'Line start X' },
      y1: { type: 'number', description: 'Line start Y' },
      x2: { type: 'number', description: 'Line end X' },
      y2: { type: 'number', description: 'Line end Y' },
      // Star/polygon parameters
      points: { type: 'number', description: 'Number of points (star) or sides (polygon)' },
      inner_radius: { type: 'number', description: 'Inner radius for star' },
      outer_radius: { type: 'number', description: 'Outer radius' },
      // Wave/spiral parameters
      amplitude: { type: 'number', description: 'Wave amplitude' },
      frequency: { type: 'number', description: 'Wave frequency' },
      turns: { type: 'number', description: 'Spiral turns' },
      // Chart parameters
      data: { type: 'string', description: 'Chart data as JSON array' },
      // Icon parameters
      icon_name: { type: 'string', description: 'Icon name' },
      // Style parameters
      fill: { type: 'string', description: 'Fill color' },
      stroke: { type: 'string', description: 'Stroke color' },
      stroke_width: { type: 'number', description: 'Stroke width' },
      // Path commands
      path_commands: { type: 'string', description: 'SVG path d attribute' },
      // Custom elements
      elements: { type: 'string', description: 'Array of elements as JSON for custom SVG' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSVGGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 200, height = 200 } = args;

    let svg = '';
    let elements: SVGElement[] = [];

    switch (operation) {
      case 'shape': {
        const { shape_type, x = 50, y = 50, r = 40, rx = 40, ry = 25, x1 = 20, y1 = 20, x2 = 180, y2 = 180 } = args;
        const { fill = '#4F46E5', stroke = 'none', stroke_width = 0 } = args;
        const style: Record<string, string | number> = { fill, stroke, 'stroke-width': stroke_width };

        switch (shape_type) {
          case 'rect':
            elements = [rect(x, y, args.width || 100, args.height || 60, style)];
            break;
          case 'circle':
            elements = [circle(x, y, r, style)];
            break;
          case 'ellipse':
            elements = [ellipse(x, y, rx, ry, style)];
            break;
          case 'line':
            elements = [line(x1, y1, x2, y2, { stroke: stroke === 'none' ? '#333' : stroke, 'stroke-width': stroke_width || 2 })];
            break;
          default:
            elements = [circle(width / 2, height / 2, r, style)];
        }
        break;
      }

      case 'star': {
        const { x = width / 2, y = height / 2, outer_radius = 80, inner_radius = 30, points = 5 } = args;
        const { fill = '#F59E0B' } = args;
        const star = generateStar(x, y, outer_radius, inner_radius, points);
        star.attrs.fill = fill;
        elements = [star];
        break;
      }

      case 'heart': {
        const { x = width / 2, y = height / 2, r = 60, fill = '#EC4899' } = args;
        const heartEl = generateHeart(x, y, r);
        heartEl.attrs.fill = fill;
        elements = [heartEl];
        break;
      }

      case 'spiral': {
        const { x = width / 2, y = height / 2, r = 80, turns = 3, stroke = '#4F46E5' } = args;
        const spiralEl = generateSpiral(x, y, r, turns);
        spiralEl.attrs.stroke = stroke;
        elements = [spiralEl];
        break;
      }

      case 'regular_polygon': {
        const { x = width / 2, y = height / 2, r = 60, points = 6, fill = '#10B981' } = args;
        const polyEl = generateRegularPolygon(x, y, r, points);
        polyEl.attrs.fill = fill;
        elements = [polyEl];
        break;
      }

      case 'arrow': {
        const { x1 = 30, y1 = height / 2, x2 = width - 30, y2 = height / 2 } = args;
        elements = [generateArrow(x1, y1, x2, y2)];
        break;
      }

      case 'grid': {
        const cellSize = args.cell_size || 20;
        elements = [generateGrid(width, height, cellSize)];
        break;
      }

      case 'wave': {
        const { amplitude = 30, frequency = 2, y: yOffset = height / 2, stroke = '#4F46E5' } = args;
        const waveEl = generateWave(width, amplitude, frequency, yOffset);
        waveEl.attrs.stroke = stroke;
        elements = [waveEl];
        break;
      }

      case 'bar_chart': {
        const dataStr = args.data || '[{"label":"A","value":30},{"label":"B","value":50},{"label":"C","value":20}]';
        const data = JSON.parse(dataStr);
        elements = [generateBarChart(data, width, height)];
        break;
      }

      case 'pie_chart': {
        const dataStr = args.data || '[{"label":"A","value":30},{"label":"B","value":50},{"label":"C","value":20}]';
        const data = JSON.parse(dataStr);
        elements = [generatePieChart(data, width / 2, height / 2, Math.min(width, height) * 0.4)];
        break;
      }

      case 'line_chart': {
        const dataStr = args.data || '[10, 25, 15, 30, 20, 35, 25]';
        const data = JSON.parse(dataStr);
        elements = [generateLineChart(data, width, height)];
        break;
      }

      case 'icon': {
        const { icon_name = 'check', fill = 'currentColor' } = args;
        const iconFn = ICONS[icon_name];
        if (!iconFn) {
          throw new Error(`Unknown icon: ${icon_name}. Available: ${Object.keys(ICONS).join(', ')}`);
        }
        const iconEl = iconFn(Math.min(width, height));
        if (iconEl.attrs) iconEl.attrs.fill = fill;
        elements = [iconEl];
        break;
      }

      case 'path': {
        const { path_commands, fill = 'none', stroke = '#333', stroke_width = 2 } = args;
        if (!path_commands) throw new Error('path_commands required');
        elements = [path(path_commands, { fill, stroke, 'stroke-width': stroke_width })];
        break;
      }

      case 'custom': {
        const elementsStr = args.elements || '[]';
        const customElements = JSON.parse(elementsStr);
        elements = customElements.map((e: SVGElement) => e);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    svg = wrapSVG(elements, width, height);

    return {
      toolCallId: id,
      content: JSON.stringify({
        operation,
        width,
        height,
        svg,
        element_count: elements.length,
        usage: 'Embed this SVG directly in HTML or save as .svg file',
      }, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `SVG Generator Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isSVGGeneratorAvailable(): boolean {
  return true;
}
