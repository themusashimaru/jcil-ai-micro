/**
 * POWERPOINT PRESENTATION GENERATOR
 * Creates .pptx files from JSON presentation data
 *
 * Uses pptxgenjs library to generate editable PowerPoint files
 * Supports slides with titles, bullets, tables, images, and speaker notes
 */

import { logger } from '@/lib/logger';
import type { PresentationDocument, PresentationSlide } from './types';
import { fetchImageBuffer } from './imageFetcher';

const log = logger('PresentationGenerator');

// Lazy-load pptxgenjs to reduce cold start
let PptxGenJS: typeof import('pptxgenjs').default | null = null;

async function loadPptxGenJS() {
  if (!PptxGenJS) {
    const mod = await import('pptxgenjs');
    PptxGenJS = mod.default;
  }
  return PptxGenJS;
}

// ============================================================================
// STYLING CONSTANTS
// ============================================================================

const COLORS = {
  primary: '1e3a5f', // Dark navy
  secondary: '2563eb', // Blue
  accent: '059669', // Green
  dark: '1f2937', // Near-black
  medium: '4b5563', // Gray
  light: '9ca3af', // Light gray
  white: 'FFFFFF',
  background: 'F8FAFC', // Light background
};

const FONTS = {
  heading: 'Calibri',
  body: 'Calibri',
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a PowerPoint presentation from JSON data
 * Returns a Buffer containing the .pptx file
 */
export async function generatePresentationPptx(doc: PresentationDocument): Promise<Buffer> {
  const Pptx = await loadPptxGenJS();
  const pptx = new Pptx();

  // Set presentation metadata
  pptx.title = doc.title;
  pptx.author = 'JCIL AI';
  pptx.subject = doc.title;

  // Set layout (default widescreen 16:9)
  pptx.layout = 'LAYOUT_WIDE';

  const primaryColor = doc.format?.primaryColor?.replace('#', '') || COLORS.primary;
  const accentColor = doc.format?.accentColor?.replace('#', '') || COLORS.secondary;

  // Pre-fetch all slide images
  const imageCache = new Map<string, string>(); // URL -> base64 data string
  for (const slideData of doc.slides) {
    if (slideData.imageUrl) {
      const result = await fetchImageBuffer(slideData.imageUrl);
      if (result) {
        // pptxgenjs needs data:mime;base64,... format
        const b64 = result.buffer.toString('base64');
        imageCache.set(slideData.imageUrl, `data:${result.mimeType};base64,${b64}`);
      }
    }
  }

  // Generate each slide
  for (let i = 0; i < doc.slides.length; i++) {
    const slideData = doc.slides[i];
    const slide = pptx.addSlide();

    // Set slide background
    if (slideData.backgroundColor) {
      slide.background = { color: slideData.backgroundColor.replace('#', '') };
    }

    // Render based on slide layout
    switch (slideData.layout) {
      case 'title':
        renderTitleSlide(slide, slideData, primaryColor);
        break;
      case 'section':
        renderSectionSlide(slide, slideData, primaryColor, accentColor);
        break;
      case 'two_column':
        renderTwoColumnSlide(slide, slideData, primaryColor);
        break;
      case 'image_left':
      case 'image_right':
        renderImageSlide(slide, slideData, primaryColor, imageCache);
        break;
      case 'blank':
        renderBlankSlide(slide, slideData);
        break;
      case 'content':
      default:
        renderContentSlide(slide, slideData, primaryColor);
        break;
    }

    // Add speaker notes if provided
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }

    // Add slide number (skip title slide)
    if (i > 0) {
      slide.addText(`${i + 1}`, {
        x: 12.0,
        y: 7.0,
        w: 0.8,
        h: 0.4,
        fontSize: 10,
        color: COLORS.medium,
        align: 'right',
        fontFace: FONTS.body,
      });
    }
  }

  // Generate the file
  const output = await pptx.write({ outputType: 'nodebuffer' });
  log.info('Generated presentation', {
    title: doc.title,
    slideCount: doc.slides.length,
  });

  return Buffer.from(output as ArrayBuffer);
}

// ============================================================================
// SLIDE RENDERERS
// ============================================================================

function renderTitleSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide,
  primaryColor: string
): void {
  // Background accent bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.15,
    fill: { color: primaryColor },
  });

  // Title
  slide.addText(data.title, {
    x: 0.8,
    y: 2.0,
    w: 11.5,
    h: 1.5,
    fontSize: 36,
    fontFace: FONTS.heading,
    color: COLORS.dark,
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.5,
      y: 3.8,
      w: 10.0,
      h: 0.8,
      fontSize: 20,
      fontFace: FONTS.body,
      color: COLORS.medium,
      align: 'center',
      valign: 'top',
    });
  }

  // Bottom accent bar
  slide.addShape('rect', {
    x: 0,
    y: 7.35,
    w: '100%',
    h: 0.15,
    fill: { color: primaryColor },
  });

  // Date/author line
  const bottomText =
    data.bullets?.[0] ||
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  slide.addText(bottomText, {
    x: 1.5,
    y: 6.5,
    w: 10.0,
    h: 0.5,
    fontSize: 14,
    fontFace: FONTS.body,
    color: COLORS.light,
    align: 'center',
  });
}

function renderContentSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide,
  primaryColor: string
): void {
  // Header bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 1.2,
    fill: { color: primaryColor },
  });

  // Slide title on header
  slide.addText(data.title, {
    x: 0.6,
    y: 0.15,
    w: 11.8,
    h: 0.9,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.white,
    bold: true,
    valign: 'middle',
  });

  // Content area - bullets or body text
  let yPos = 1.6;

  if (data.body) {
    slide.addText(data.body, {
      x: 0.8,
      y: yPos,
      w: 11.4,
      h: 1.0,
      fontSize: 16,
      fontFace: FONTS.body,
      color: COLORS.dark,
      lineSpacingMultiple: 1.3,
    });
    yPos += 1.2;
  }

  if (data.bullets && data.bullets.length > 0) {
    const bulletRows = data.bullets.map((bullet) => ({
      text: bullet,
      options: {
        fontSize: 16,
        fontFace: FONTS.body,
        color: COLORS.dark,
        bullet: { type: 'bullet' as const, code: '2022' },
        paraSpaceAfter: 8,
        lineSpacingMultiple: 1.3,
        indentLevel: 0,
      },
    }));

    slide.addText(bulletRows, {
      x: 0.8,
      y: yPos,
      w: 11.4,
      h: 5.2 - (yPos - 1.6),
      valign: 'top',
    });
  }

  // Table if provided
  if (data.table) {
    renderTable(slide, data.table, yPos + (data.bullets?.length || 0) * 0.5, primaryColor);
  }
}

function renderSectionSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide,
  primaryColor: string,
  accentColor: string
): void {
  // Full colored background
  slide.background = { color: primaryColor };

  // Accent line
  slide.addShape('rect', {
    x: 1.5,
    y: 3.2,
    w: 2.0,
    h: 0.06,
    fill: { color: accentColor },
  });

  // Section title
  slide.addText(data.title, {
    x: 1.5,
    y: 3.5,
    w: 10.0,
    h: 1.5,
    fontSize: 32,
    fontFace: FONTS.heading,
    color: COLORS.white,
    bold: true,
    valign: 'top',
  });

  // Optional subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.5,
      y: 5.0,
      w: 10.0,
      h: 0.8,
      fontSize: 18,
      fontFace: FONTS.body,
      color: COLORS.background,
    });
  }
}

function renderTwoColumnSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide,
  primaryColor: string
): void {
  // Header bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 1.2,
    fill: { color: primaryColor },
  });

  // Title
  slide.addText(data.title, {
    x: 0.6,
    y: 0.15,
    w: 11.8,
    h: 0.9,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.white,
    bold: true,
    valign: 'middle',
  });

  // Split bullets into two columns
  const bullets = data.bullets || [];
  const midpoint = Math.ceil(bullets.length / 2);
  const leftBullets = bullets.slice(0, midpoint);
  const rightBullets = bullets.slice(midpoint);

  // Left column
  if (leftBullets.length > 0) {
    const leftRows = leftBullets.map((b) => ({
      text: b,
      options: {
        fontSize: 14,
        fontFace: FONTS.body,
        color: COLORS.dark,
        bullet: { type: 'bullet' as const, code: '2022' },
        paraSpaceAfter: 6,
        lineSpacingMultiple: 1.2,
      },
    }));
    slide.addText(leftRows, {
      x: 0.6,
      y: 1.6,
      w: 5.8,
      h: 5.2,
      valign: 'top',
    });
  }

  // Right column
  if (rightBullets.length > 0) {
    const rightRows = rightBullets.map((b) => ({
      text: b,
      options: {
        fontSize: 14,
        fontFace: FONTS.body,
        color: COLORS.dark,
        bullet: { type: 'bullet' as const, code: '2022' },
        paraSpaceAfter: 6,
        lineSpacingMultiple: 1.2,
      },
    }));
    slide.addText(rightRows, {
      x: 6.8,
      y: 1.6,
      w: 5.8,
      h: 5.2,
      valign: 'top',
    });
  }

  // Vertical divider
  slide.addShape('rect', {
    x: 6.4,
    y: 1.8,
    w: 0.02,
    h: 4.5,
    fill: { color: COLORS.light },
  });
}

function renderImageSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide,
  primaryColor: string,
  imageCache: Map<string, string> = new Map()
): void {
  const isLeft = data.layout === 'image_left';

  // Header bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 1.2,
    fill: { color: primaryColor },
  });

  // Title
  slide.addText(data.title, {
    x: 0.6,
    y: 0.15,
    w: 11.8,
    h: 0.9,
    fontSize: 24,
    fontFace: FONTS.heading,
    color: COLORS.white,
    bold: true,
    valign: 'middle',
  });

  const imgX = isLeft ? 0.6 : 7.0;
  const textX = isLeft ? 6.6 : 0.6;

  // Use pre-fetched image data if available
  const cachedImage = data.imageUrl ? imageCache.get(data.imageUrl) : null;

  if (cachedImage) {
    // Embed the pre-fetched image as base64 data
    slide.addImage({
      data: cachedImage,
      x: imgX,
      y: 1.6,
      w: 5.8,
      h: 5.2,
      sizing: { type: 'contain', w: 5.8, h: 5.2 },
    });
  } else if (data.imageUrl) {
    // Try direct path as fallback (works for local files)
    try {
      slide.addImage({
        path: data.imageUrl,
        x: imgX,
        y: 1.6,
        w: 5.8,
        h: 5.2,
        sizing: { type: 'contain', w: 5.8, h: 5.2 },
      });
    } catch {
      // Fallback: placeholder box
      slide.addShape('rect', {
        x: imgX,
        y: 1.6,
        w: 5.8,
        h: 5.2,
        fill: { color: COLORS.background },
        line: { color: COLORS.light, width: 1 },
      });
      slide.addText('[Image]', {
        x: imgX,
        y: 3.5,
        w: 5.8,
        h: 1.0,
        fontSize: 16,
        color: COLORS.light,
        align: 'center',
        fontFace: FONTS.body,
      });
    }
  } else {
    // Placeholder
    slide.addShape('rect', {
      x: imgX,
      y: 1.6,
      w: 5.8,
      h: 5.2,
      fill: { color: COLORS.background },
      line: { color: COLORS.light, width: 1 },
    });
    slide.addText('[Image Placeholder]', {
      x: imgX,
      y: 3.5,
      w: 5.8,
      h: 1.0,
      fontSize: 14,
      color: COLORS.light,
      align: 'center',
      fontFace: FONTS.body,
    });
  }

  // Text content on the other side
  if (data.bullets && data.bullets.length > 0) {
    const bulletRows = data.bullets.map((b) => ({
      text: b,
      options: {
        fontSize: 14,
        fontFace: FONTS.body,
        color: COLORS.dark,
        bullet: { type: 'bullet' as const, code: '2022' },
        paraSpaceAfter: 6,
        lineSpacingMultiple: 1.3,
      },
    }));
    slide.addText(bulletRows, {
      x: textX,
      y: 1.6,
      w: 5.6,
      h: 5.2,
      valign: 'top',
    });
  } else if (data.body) {
    slide.addText(data.body, {
      x: textX,
      y: 1.6,
      w: 5.6,
      h: 5.2,
      fontSize: 14,
      fontFace: FONTS.body,
      color: COLORS.dark,
      valign: 'top',
      lineSpacingMultiple: 1.3,
    });
  }
}

function renderBlankSlide(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  data: PresentationSlide
): void {
  // Minimal slide with just a title and optional body
  if (data.title) {
    slide.addText(data.title, {
      x: 0.8,
      y: 0.5,
      w: 11.4,
      h: 1.0,
      fontSize: 28,
      fontFace: FONTS.heading,
      color: COLORS.dark,
      bold: true,
    });
  }

  if (data.body) {
    slide.addText(data.body, {
      x: 0.8,
      y: 1.8,
      w: 11.4,
      h: 5.0,
      fontSize: 16,
      fontFace: FONTS.body,
      color: COLORS.dark,
      lineSpacingMultiple: 1.3,
    });
  }
}

// ============================================================================
// TABLE RENDERER
// ============================================================================

function renderTable(
  slide: ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>,
  table: { headers?: string[]; rows: string[][] },
  yPos: number,
  primaryColor: string
): void {
  const tableData: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [];

  // Header row
  if (table.headers) {
    tableData.push(
      table.headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          color: COLORS.white,
          fill: { color: primaryColor },
          fontSize: 12,
          fontFace: FONTS.body,
        },
      }))
    );
  }

  // Data rows
  for (let i = 0; i < table.rows.length; i++) {
    tableData.push(
      table.rows[i].map((cell) => ({
        text: cell,
        options: {
          fontSize: 11,
          fontFace: FONTS.body,
          color: COLORS.dark,
          fill: { color: i % 2 === 0 ? COLORS.white : COLORS.background },
        },
      }))
    );
  }

  if (tableData.length > 0) {
    const colCount = tableData[0].length;
    const colW = Math.min(11.4 / colCount, 3.0);

    slide.addTable(tableData, {
      x: 0.8,
      y: yPos,
      w: colW * colCount,
      colW,
      border: { type: 'solid', pt: 0.5, color: COLORS.light },
      autoPage: false,
    });
  }
}
