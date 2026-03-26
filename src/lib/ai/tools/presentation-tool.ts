/**
 * PRESENTATION / POWERPOINT GENERATION TOOL
 *
 * Creates professional PowerPoint presentations (.pptx) using pptxgenjs.
 *
 * Features:
 * - Multiple slide layouts (title, content, two-column, image, comparison, blank)
 * - Embedded charts (bar, line, pie, doughnut, radar)
 * - Tables with styling
 * - Images from URLs
 * - Speaker notes
 * - Brand color theming
 * - Custom fonts and sizing
 * - Shapes and decorative elements
 * - Slide transitions
 * - Master slide backgrounds
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { uploadDocument } from '@/lib/documents/storage';

const log = logger('PresentationTool');

// ============================================================================
// LAZY LOADING
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PptxGenJS: any = null;

async function initPptx(): Promise<boolean> {
  if (PptxGenJS) return true;
  try {
    PptxGenJS = (await import('pptxgenjs')).default;
    return true;
  } catch (error) {
    log.error('Failed to load pptxgenjs', { error: (error as Error).message });
    return false;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const presentationTool: UnifiedTool = {
  name: 'create_presentation',
  description: `Create professional PowerPoint presentations (.pptx). Use this when:
- User asks to create a presentation, slide deck, or PowerPoint
- User needs slides for a meeting, pitch, report, or training
- User says "make me a presentation about..."

Capabilities:
- Slide layouts: title, content, two_column, image_slide, comparison, section_header, blank
- Embedded charts: bar, line, pie, doughnut, radar
- Tables with header styling
- Images from URLs
- Speaker notes per slide
- Brand colors and themes
- Shapes and decorative elements

Returns a downloadable .pptx file as base64.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Presentation title (shown on title slide)',
      },
      subtitle: {
        type: 'string',
        description: 'Subtitle for title slide',
      },
      author: {
        type: 'string',
        description: 'Author name for metadata',
      },
      theme: {
        type: 'object',
        description:
          'Theme settings: { primaryColor: hex, secondaryColor: hex, fontFace: string, backgroundColor: hex }',
      },
      layout: {
        type: 'string',
        description: 'Slide dimensions: "16x9" (default), "16x10", "4x3", "wide"',
      },
      slides: {
        type: 'array',
        description: `Array of slide objects. Each slide has:
- layout: "title" | "content" | "two_column" | "image_slide" | "comparison" | "section_header" | "blank"
- title: Slide title text
- content: Main text content (supports bullet points separated by \\n)
- bullets: Array of bullet point strings
- image_url: URL of image to embed
- image_caption: Caption for image
- left_content: Left column text (two_column layout)
- right_content: Right column text (two_column layout)
- table: { headers: string[], rows: string[][] } — table data
- chart: { type: "bar"|"line"|"pie"|"doughnut"|"radar", labels: string[], data: number[], title: string }
- notes: Speaker notes for this slide
- background_color: Override background for this slide
- transition: "fade"|"push"|"wipe"|"zoom" — slide transition effect`,
        items: { type: 'object' },
      },
    },
    required: ['title', 'slides'],
  },
};

// ============================================================================
// IMAGE FETCHING
// ============================================================================

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'JCIL-AI-PresentationGenerator/1.0' },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) return null;

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpeg';
    return `image/${ext};base64,${base64}`;
  } catch {
    return null;
  }
}

// ============================================================================
// SLIDE BUILDERS
// ============================================================================

interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFace: string;
  backgroundColor: string;
}

interface SlideConfig {
  layout?: string;
  title?: string;
  content?: string;
  bullets?: string[];
  image_url?: string;
  image_caption?: string;
  left_content?: string;
  right_content?: string;
  table?: { headers: string[]; rows: string[][] };
  chart?: { type: string; labels: string[]; data: number[]; title?: string };
  notes?: string;
  background_color?: string;
  transition?: string;
}

const TRANSITION_MAP: Record<string, string> = {
  fade: 'fade',
  push: 'push',
  wipe: 'wipe',
  zoom: 'zoom',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function addTitleSlide(
  pptx: any,
  slide: any,
  title: string,
  subtitle: string | undefined,
  theme: ThemeConfig
) {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  // Background accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.08,
    fill: { color: theme.primaryColor.replace('#', '') },
  });

  // Title
  slide.addText(title, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1.5,
    fontSize: 36,
    fontFace: theme.fontFace,
    color: '333333',
    bold: true,
    align: 'center',
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 1,
      fontSize: 18,
      fontFace: theme.fontFace,
      color: '666666',
      align: 'center',
    });
  }

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 5.45,
    w: '100%',
    h: 0.08,
    fill: { color: theme.secondaryColor.replace('#', '') },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addContentSlide(pptx: any, slide: any, config: SlideConfig, theme: ThemeConfig) {
  // Header bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.6,
    fill: { color: theme.primaryColor.replace('#', '') },
  });

  if (config.title) {
    slide.addText(config.title, {
      x: 0.4,
      y: 0.05,
      w: 9.2,
      h: 0.5,
      fontSize: 22,
      fontFace: theme.fontFace,
      color: 'FFFFFF',
      bold: true,
    });
  }

  // Content area
  const contentY = 0.9;
  const contentH = 4.3;

  if (config.bullets && config.bullets.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textItems = config.bullets.map((bullet: string) => ({
      text: bullet,
      options: {
        fontSize: 16,
        fontFace: theme.fontFace,
        color: '333333',
        bullet: { type: 'bullet' as const },
        paraSpaceAfter: 8,
      },
    }));
    slide.addText(textItems, {
      x: 0.5,
      y: contentY,
      w: 9,
      h: contentH,
      valign: 'top',
    });
  } else if (config.content) {
    slide.addText(config.content, {
      x: 0.5,
      y: contentY,
      w: 9,
      h: contentH,
      fontSize: 16,
      fontFace: theme.fontFace,
      color: '333333',
      valign: 'top',
      paraSpaceAfter: 8,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTwoColumnSlide(pptx: any, slide: any, config: SlideConfig, theme: ThemeConfig) {
  // Header bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.6,
    fill: { color: theme.primaryColor.replace('#', '') },
  });

  if (config.title) {
    slide.addText(config.title, {
      x: 0.4,
      y: 0.05,
      w: 9.2,
      h: 0.5,
      fontSize: 22,
      fontFace: theme.fontFace,
      color: 'FFFFFF',
      bold: true,
    });
  }

  // Left column
  if (config.left_content) {
    slide.addText(config.left_content, {
      x: 0.3,
      y: 0.9,
      w: 4.5,
      h: 4.3,
      fontSize: 14,
      fontFace: theme.fontFace,
      color: '333333',
      valign: 'top',
    });
  }

  // Divider
  slide.addShape(pptx.ShapeType.line, {
    x: 5,
    y: 0.9,
    w: 0,
    h: 4.3,
    line: { color: 'CCCCCC', width: 1 },
  });

  // Right column
  if (config.right_content) {
    slide.addText(config.right_content, {
      x: 5.2,
      y: 0.9,
      w: 4.5,
      h: 4.3,
      fontSize: 14,
      fontFace: theme.fontFace,
      color: '333333',
      valign: 'top',
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addImageSlide(pptx: any, slide: any, config: SlideConfig, theme: ThemeConfig) {
  // Header bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.6,
    fill: { color: theme.primaryColor.replace('#', '') },
  });

  if (config.title) {
    slide.addText(config.title, {
      x: 0.4,
      y: 0.05,
      w: 9.2,
      h: 0.5,
      fontSize: 22,
      fontFace: theme.fontFace,
      color: 'FFFFFF',
      bold: true,
    });
  }

  if (config.image_url) {
    const imageData = await fetchImageAsBase64(config.image_url);
    if (imageData) {
      slide.addImage({
        data: imageData,
        x: 1.5,
        y: 0.9,
        w: 7,
        h: 3.8,
        sizing: { type: 'contain', w: 7, h: 3.8 },
      });
    } else {
      slide.addText('[Image could not be loaded]', {
        x: 1.5,
        y: 2.5,
        w: 7,
        h: 0.5,
        fontSize: 14,
        color: '999999',
        align: 'center',
        italic: true,
      });
    }
  }

  if (config.image_caption) {
    slide.addText(config.image_caption, {
      x: 0.5,
      y: 4.8,
      w: 9,
      h: 0.4,
      fontSize: 12,
      fontFace: theme.fontFace,
      color: '666666',
      align: 'center',
      italic: true,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSectionHeaderSlide(pptx: any, slide: any, config: SlideConfig, theme: ThemeConfig) {
  // Full color background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: theme.primaryColor.replace('#', '') },
  });

  if (config.title) {
    slide.addText(config.title, {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 1.5,
      fontSize: 32,
      fontFace: theme.fontFace,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
    });
  }

  if (config.content) {
    slide.addText(config.content, {
      x: 0.5,
      y: 3.3,
      w: 9,
      h: 1,
      fontSize: 16,
      fontFace: theme.fontFace,
      color: 'EEEEEE',
      align: 'center',
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTableToSlide(slide: any, config: SlideConfig, theme: ThemeConfig) {
  if (!config.table || !config.table.headers) return;

  const headerRow = config.table.headers.map((h: string) => ({
    text: h,
    options: {
      bold: true,
      color: 'FFFFFF',
      fontSize: 12,
      fill: { color: theme.primaryColor.replace('#', '') },
      align: 'center' as const,
      border: { pt: 0.5, color: 'CCCCCC' },
    },
  }));

  const dataRows = (config.table.rows || []).map((row: string[], rowIdx: number) =>
    row.map((cell: string) => ({
      text: cell,
      options: {
        fontSize: 11,
        color: '333333',
        fill: { color: rowIdx % 2 === 0 ? 'F8F8F8' : 'FFFFFF' },
        border: { pt: 0.5, color: 'DDDDDD' },
      },
    }))
  );

  const tableRows = [headerRow, ...dataRows];
  const colW = Math.min(9 / config.table.headers.length, 3);

  slide.addTable(tableRows, {
    x: 0.5,
    y: config.title ? 1.2 : 0.5,
    w: Math.min(colW * config.table.headers.length, 9),
    fontFace: theme.fontFace,
    border: { pt: 0.5, color: 'CCCCCC' },
    autoPage: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addChartToSlide(pptx: any, slide: any, config: SlideConfig, theme: ThemeConfig) {
  if (!config.chart || !config.chart.labels || !config.chart.data) return;

  const chartTypeMap: Record<string, string> = {
    bar: 'bar',
    line: 'line',
    pie: 'pie',
    doughnut: 'doughnut',
    radar: 'radar',
  };

  const pptxChartType = chartTypeMap[config.chart.type] || 'bar';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartType = (pptx.ChartType as any)[pptxChartType];
  if (!chartType) return;

  const chartData = [
    {
      name: config.chart.title || 'Data',
      labels: config.chart.labels,
      values: config.chart.data,
    },
  ];

  slide.addChart(chartType, chartData, {
    x: 0.5,
    y: config.title ? 1.0 : 0.5,
    w: 9,
    h: config.title ? 4.0 : 4.5,
    showTitle: !!config.chart.title,
    title: config.chart.title || '',
    titleColor: '333333',
    titleFontFace: theme.fontFace,
    titleFontSize: 14,
    showLegend: true,
    legendPos: 'b',
    chartColors: [
      theme.primaryColor.replace('#', ''),
      theme.secondaryColor.replace('#', ''),
      '4CAF50',
      'FF9800',
      '9C27B0',
      '00BCD4',
      'F44336',
    ],
  });
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

interface PresentationArgs {
  title: string;
  subtitle?: string;
  author?: string;
  theme?: Partial<ThemeConfig>;
  layout?: string;
  slides: SlideConfig[];
}

async function generatePresentation(args: PresentationArgs): Promise<{
  success: boolean;
  data?: string;
  filename?: string;
  slideCount?: number;
  error?: string;
}> {
  const theme: ThemeConfig = {
    primaryColor: args.theme?.primaryColor || '#1a73e8',
    secondaryColor: args.theme?.secondaryColor || '#34a853',
    fontFace: args.theme?.fontFace || 'Arial',
    backgroundColor: args.theme?.backgroundColor || '#FFFFFF',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pptx = new (PptxGenJS as any)();

  // Layout
  const layoutMap: Record<string, string> = {
    '16x9': 'LAYOUT_16x9',
    '16x10': 'LAYOUT_16x10',
    '4x3': 'LAYOUT_4x3',
    wide: 'LAYOUT_WIDE',
  };
  pptx.layout = layoutMap[args.layout || '16x9'] || 'LAYOUT_16x9';

  // Metadata
  if (args.author) pptx.author = args.author;
  pptx.title = args.title;
  pptx.subject = args.title;

  // Build slides
  let slideCount = 0;

  for (const slideConfig of args.slides) {
    const slide = pptx.addSlide();
    slideCount++;

    // Background
    const bgColor = slideConfig.background_color || theme.backgroundColor;
    if (bgColor && slideConfig.layout !== 'section_header') {
      slide.background = { fill: bgColor.replace('#', '') };
    }

    // Transition
    if (slideConfig.transition && TRANSITION_MAP[slideConfig.transition]) {
      slide.transition = { type: TRANSITION_MAP[slideConfig.transition] };
    }

    // Build by layout
    const layout = slideConfig.layout || 'content';
    switch (layout) {
      case 'title':
        addTitleSlide(
          pptx,
          slide,
          slideConfig.title || args.title,
          slideConfig.content || args.subtitle,
          theme
        );
        break;
      case 'two_column':
        addTwoColumnSlide(pptx, slide, slideConfig, theme);
        break;
      case 'image_slide':
        await addImageSlide(pptx, slide, slideConfig, theme);
        break;
      case 'section_header':
        addSectionHeaderSlide(pptx, slide, slideConfig, theme);
        break;
      case 'comparison':
        addTwoColumnSlide(pptx, slide, slideConfig, theme);
        break;
      case 'blank':
        // Just background, user can add custom elements
        break;
      case 'content':
      default:
        addContentSlide(pptx, slide, slideConfig, theme);
        break;
    }

    // Table (any layout can have one)
    if (slideConfig.table) {
      addTableToSlide(slide, slideConfig, theme);
    }

    // Chart (any layout can have one)
    if (slideConfig.chart) {
      addChartToSlide(pptx, slide, slideConfig, theme);
    }

    // Speaker notes
    if (slideConfig.notes) {
      slide.addNotes(slideConfig.notes);
    }

    // Slide number
    slide.addText(`${slideCount}`, {
      x: 9.2,
      y: 5.2,
      w: 0.5,
      h: 0.3,
      fontSize: 8,
      color: '999999',
      align: 'right',
    });
  }

  // Generate output
  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  const base64 = buffer.toString('base64');

  const safeName = args.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const filename = `${safeName}.pptx`;

  return { success: true, data: base64, filename, slideCount };
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePresentation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'create_presentation') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

  if (!args.title) {
    return { toolCallId: id, content: 'Presentation title is required', isError: true };
  }
  if (!args.slides || !Array.isArray(args.slides) || args.slides.length === 0) {
    return { toolCallId: id, content: 'At least one slide is required', isError: true };
  }
  if (args.slides.length > 100) {
    return { toolCallId: id, content: 'Maximum 100 slides per presentation', isError: true };
  }

  const available = await initPptx();
  if (!available) {
    return { toolCallId: id, content: 'pptxgenjs library not available', isError: true };
  }

  log.info('Creating presentation', { title: args.title, slideCount: args.slides.length });

  try {
    const result = await generatePresentation(args as PresentationArgs);

    if (!result.success) {
      return {
        toolCallId: id,
        content: result.error || 'Presentation generation failed',
        isError: true,
      };
    }

    const filename = result.filename || `${args.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const buffer = Buffer.from(result.data!, 'base64');

    // Upload to Supabase storage if userId is available
    const userId = (toolCall as unknown as Record<string, unknown>).userId as string | undefined;
    let downloadUrl: string | null = null;
    if (userId) {
      try {
        const uploadResult = await uploadDocument(userId, buffer, filename, mimeType);
        if (uploadResult.storage === 'supabase') {
          downloadUrl = uploadResult.url;
        }
      } catch (uploadError) {
        log.warn('Presentation upload failed, using data URL fallback', {
          error: (uploadError as Error).message,
        });
      }
    }

    const url = downloadUrl || `data:${mimeType};base64,${result.data}`;
    const content =
      `Presentation created successfully!\n\n` +
      `**Title:** ${args.title}\n` +
      `**Slides:** ${result.slideCount}\n` +
      `**Format:** PPTX\n` +
      `**Filename:** ${filename}\n\n` +
      `[Download ${filename}](${url})`;

    return { toolCallId: id, content, isError: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Presentation generation failed', { error: msg });
    return { toolCallId: id, content: `Presentation generation failed: ${msg}`, isError: true };
  }
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export function isPresentationAvailable(): boolean {
  try {
    require.resolve('pptxgenjs');
    return true;
  } catch {
    return false;
  }
}
