/**
 * Text Overlay for Slide Generation
 *
 * Renders text on top of AI-generated slide backgrounds using Sharp's SVG composite.
 * This approach works reliably on serverless (Vercel) without requiring system fonts.
 */

import sharp from 'sharp';
import { logger } from '@/lib/logger';

const log = logger('TextOverlay');

// Slide dimensions (16:9 aspect ratio)
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// Text styling
const TITLE_FONT_SIZE = 72;
const BULLET_FONT_SIZE = 42;
const LINE_HEIGHT = 1.4;
const PADDING_X = 120;
const PADDING_TOP = 180;
const BULLET_START_Y = 340;
const BULLET_SPACING = 30;
const MAX_TEXT_WIDTH = SLIDE_WIDTH - PADDING_X * 2;

// Colors
const TEXT_COLOR_LIGHT = '#FFFFFF';
const TEXT_COLOR_DARK = '#1A1A2E';

// Font stack for SVG (browser-safe fonts that work in librsvg)
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

interface SlideTextContent {
  title: string;
  bullets?: string[];
}

interface TextOverlayOptions {
  /** Use dark text on light backgrounds */
  darkText?: boolean;
  /** Add semi-transparent overlay behind text for readability */
  addOverlay?: boolean;
  /** Overlay color (default: black or white based on darkText) */
  overlayColor?: string;
  /** Overlay opacity 0-1 (default: 0.5) */
  overlayOpacity?: number;
}

/**
 * Check if fonts are loaded (always true for Sharp/SVG approach)
 */
export function areFontsLoaded(): boolean {
  return true; // SVG approach doesn't need system fonts
}

/**
 * Get font info (minimal for SVG approach)
 */
export function getFontInfo(): { loaded: boolean; count: number; paths: string[] } {
  return { loaded: true, count: 0, paths: ['SVG inline fonts'] };
}

/**
 * Escape special XML characters for safe SVG text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap text to fit within max width (approximate character-based wrapping)
 */
function wrapTextSimple(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Analyze image brightness using Sharp
 */
async function analyzeImageBrightness(imageBuffer: Buffer): Promise<boolean> {
  try {
    const { dominant } = await sharp(imageBuffer).stats();
    // Calculate perceived brightness
    const brightness = 0.299 * dominant.r + 0.587 * dominant.g + 0.114 * dominant.b;
    return brightness > 127;
  } catch {
    return false; // Default to dark background
  }
}

/**
 * Generate SVG text overlay
 */
function generateTextOverlaySvg(
  content: SlideTextContent,
  textColor: string,
  addOverlay: boolean,
  overlayColor: string,
  overlayOpacity: number
): string {
  const elements: string[] = [];

  // Add semi-transparent overlay rectangle if requested
  if (addOverlay) {
    const overlayRgba =
      overlayColor === 'white'
        ? `rgba(255, 255, 255, ${overlayOpacity})`
        : `rgba(0, 0, 0, ${overlayOpacity})`;
    elements.push(
      `<rect x="0" y="0" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="${overlayRgba}"/>`
    );
  }

  // Calculate approximate max chars per line based on font size
  const titleMaxChars = Math.floor(MAX_TEXT_WIDTH / (TITLE_FONT_SIZE * 0.5));
  const bulletMaxChars = Math.floor((MAX_TEXT_WIDTH - 60) / (BULLET_FONT_SIZE * 0.5));

  // Text shadow filter for better readability
  const shadowFilter = `
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="3" stdDeviation="2" flood-color="rgba(0,0,0,0.7)"/>
      </filter>
    </defs>
  `;
  elements.push(shadowFilter);

  let currentY = PADDING_TOP;

  // Render title
  const titleLines = wrapTextSimple(content.title, titleMaxChars);
  for (const line of titleLines) {
    elements.push(
      `<text x="${PADDING_X}" y="${currentY}"
        font-family="${FONT_FAMILY}"
        font-size="${TITLE_FONT_SIZE}px"
        font-weight="bold"
        fill="${textColor}"
        filter="url(#shadow)">${escapeXml(line)}</text>`
    );
    currentY += TITLE_FONT_SIZE * LINE_HEIGHT;
  }

  // Render bullets
  if (content.bullets && content.bullets.length > 0) {
    currentY = Math.max(currentY + 40, BULLET_START_Y);

    for (const bullet of content.bullets) {
      // Draw bullet point
      elements.push(
        `<text x="${PADDING_X}" y="${currentY}"
          font-family="${FONT_FAMILY}"
          font-size="${BULLET_FONT_SIZE}px"
          fill="${textColor}"
          filter="url(#shadow)">•</text>`
      );

      // Wrap and draw bullet text
      const bulletLines = wrapTextSimple(bullet, bulletMaxChars);
      for (let i = 0; i < bulletLines.length; i++) {
        const lineY = currentY + i * BULLET_FONT_SIZE * LINE_HEIGHT;
        elements.push(
          `<text x="${PADDING_X + 50}" y="${lineY}"
            font-family="${FONT_FAMILY}"
            font-size="${BULLET_FONT_SIZE}px"
            fill="${textColor}"
            filter="url(#shadow)">${escapeXml(bulletLines[i])}</text>`
        );
      }

      currentY += bulletLines.length * BULLET_FONT_SIZE * LINE_HEIGHT + BULLET_SPACING;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}">
    ${elements.join('\n    ')}
  </svg>`;
}

/**
 * Overlays text on a slide background image using Sharp SVG composite
 *
 * @param backgroundImageUrl - URL of the background image
 * @param content - Title and bullet points to render
 * @param options - Styling options
 * @returns Buffer of the composited image (PNG)
 */
export async function overlayTextOnSlide(
  backgroundImageUrl: string,
  content: SlideTextContent,
  options: TextOverlayOptions = {}
): Promise<Buffer> {
  log.info('Starting text overlay (Sharp/SVG)', {
    title: content.title,
    bulletCount: content.bullets?.length || 0,
  });

  // Fetch the background image
  const response = await fetch(backgroundImageUrl, {
    headers: { 'User-Agent': 'JCIL-SlideRenderer/1.0' },
  });

  if (!response.ok) {
    log.error('Failed to fetch background image', { status: response.status });
    throw new Error(`Failed to fetch background image: ${response.status}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  log.info('Background image fetched', { sizeBytes: imageBuffer.length });

  // Analyze brightness to determine text color
  const isLightImage = options.darkText ?? (await analyzeImageBrightness(imageBuffer));
  const textColor = isLightImage ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;
  const overlayColor = options.overlayColor || (isLightImage ? 'white' : 'black');
  const overlayOpacity = options.overlayOpacity ?? 0.5;
  const addOverlay = options.addOverlay !== false;

  log.info('Text styling determined', { isLightImage, textColor, addOverlay });

  // Generate SVG overlay
  const svgOverlay = generateTextOverlaySvg(
    content,
    textColor,
    addOverlay,
    overlayColor,
    overlayOpacity
  );

  // Resize background and composite SVG
  const outputBuffer = await sharp(imageBuffer)
    .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  log.info('Text overlay complete (Sharp/SVG)', {
    title: content.title,
    outputSizeBytes: outputBuffer.length,
  });

  return outputBuffer;
}

/**
 * Overlays text on a slide from a buffer instead of URL
 */
export async function overlayTextOnSlideBuffer(
  backgroundBuffer: Buffer,
  content: SlideTextContent,
  options: TextOverlayOptions = {}
): Promise<Buffer> {
  // Analyze brightness to determine text color
  const isLightImage = options.darkText ?? (await analyzeImageBrightness(backgroundBuffer));
  const textColor = isLightImage ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;
  const overlayColor = options.overlayColor || (isLightImage ? 'white' : 'black');
  const overlayOpacity = options.overlayOpacity ?? 0.5;
  const addOverlay = options.addOverlay !== false;

  // Generate SVG overlay
  const svgOverlay = generateTextOverlaySvg(
    content,
    textColor,
    addOverlay,
    overlayColor,
    overlayOpacity
  );

  // Resize background and composite SVG
  return sharp(backgroundBuffer)
    .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}
