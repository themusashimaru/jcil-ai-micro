/**
 * Text Overlay for Slide Generation
 *
 * Renders actual text on top of AI-generated slide backgrounds
 * using @napi-rs/canvas for proper, readable text.
 */

import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import { existsSync } from 'fs';

// Slide dimensions (16:9 aspect ratio)
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// Text styling
const TITLE_FONT_SIZE = 72;
const BULLET_FONT_SIZE = 42;
const LINE_HEIGHT_MULTIPLIER = 1.4;
const PADDING_X = 120;
const PADDING_TOP = 180;
const BULLET_START_Y = 340;
const BULLET_SPACING = 80;

// Colors
const TEXT_COLOR_LIGHT = '#FFFFFF';
const TEXT_COLOR_DARK = '#1A1A2E';
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';

// Try to register system fonts
function registerFonts() {
  const fontPaths = [
    // Common Linux paths
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    // macOS paths
    '/System/Library/Fonts/Helvetica.ttc',
    '/Library/Fonts/Arial.ttf',
  ];

  for (const fontPath of fontPaths) {
    if (existsSync(fontPath)) {
      try {
        GlobalFonts.registerFromPath(fontPath);
      } catch {
        // Font registration failed, continue with defaults
      }
    }
  }
}

// Register fonts on module load
registerFonts();

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
  /** Overlay opacity 0-1 (default: 0.6) */
  overlayOpacity?: number;
}

/**
 * Analyzes an image to determine if it's predominantly light or dark
 * Returns true if the image is light (should use dark text)
 */
async function analyzeImageBrightness(imageBuffer: Buffer): Promise<boolean> {
  try {
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(100, 100); // Sample at low res for speed
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0, 100, 100);
    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;

    let totalBrightness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      // Calculate perceived brightness using luminance formula
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const avgBrightness = totalBrightness / pixelCount;
    return avgBrightness > 127; // Light image if brightness > 50%
  } catch {
    return false; // Default to dark background assumption
  }
}

/**
 * Wraps text to fit within a maximum width
 */
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
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
 * Renders text with a shadow for better readability
 */
function drawTextWithShadow(ctx: SKRSContext2D, text: string, x: number, y: number, color: string) {
  // Draw shadow
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fillText(text, x + 3, y + 3);

  // Draw main text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Overlays text on a slide background image
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
  // Fetch the background image
  const response = await fetch(backgroundImageUrl, {
    headers: { 'User-Agent': 'JCIL-SlideRenderer/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch background image: ${response.status}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const backgroundImage = await loadImage(imageBuffer);

  // Analyze brightness to determine text color
  const isLightImage = options.darkText ?? (await analyzeImageBrightness(imageBuffer));
  const textColor = isLightImage ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;

  // Create canvas
  const canvas = createCanvas(SLIDE_WIDTH, SLIDE_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Draw background image (scaled to fit)
  ctx.drawImage(backgroundImage, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  // Add semi-transparent overlay for text readability
  if (options.addOverlay !== false) {
    const overlayColor = options.overlayColor || (isLightImage ? 'white' : 'black');
    const overlayOpacity = options.overlayOpacity ?? 0.4;

    ctx.fillStyle =
      overlayColor === 'white'
        ? `rgba(255, 255, 255, ${overlayOpacity})`
        : `rgba(0, 0, 0, ${overlayOpacity})`;

    // Overlay on the text area (left side or full depending on content)
    if (content.bullets && content.bullets.length > 0) {
      // Full overlay for slides with bullets
      ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    } else {
      // Bottom gradient overlay for title-only slides
      const gradient = ctx.createLinearGradient(0, SLIDE_HEIGHT * 0.5, 0, SLIDE_HEIGHT);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(0, 0, 0, ${overlayOpacity + 0.2})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    }
  }

  // Set up text rendering
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxTextWidth = SLIDE_WIDTH - PADDING_X * 2;

  // Render title
  ctx.font = `bold ${TITLE_FONT_SIZE}px "DejaVu Sans", "Liberation Sans", "Helvetica", "Arial", sans-serif`;

  const titleLines = wrapText(ctx, content.title, maxTextWidth);
  let currentY = PADDING_TOP;

  for (const line of titleLines) {
    drawTextWithShadow(ctx, line, PADDING_X, currentY, textColor);
    currentY += TITLE_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
  }

  // Render bullets
  if (content.bullets && content.bullets.length > 0) {
    ctx.font = `${BULLET_FONT_SIZE}px "DejaVu Sans", "Liberation Sans", "Helvetica", "Arial", sans-serif`;

    currentY = Math.max(currentY + 40, BULLET_START_Y);
    const bulletIndent = 40;
    const bulletMaxWidth = maxTextWidth - bulletIndent;

    for (const bullet of content.bullets) {
      // Draw bullet point
      drawTextWithShadow(ctx, '•', PADDING_X, currentY, textColor);

      // Wrap and draw bullet text
      const bulletLines = wrapText(ctx, bullet, bulletMaxWidth);

      for (let i = 0; i < bulletLines.length; i++) {
        const lineY = currentY + i * BULLET_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
        drawTextWithShadow(ctx, bulletLines[i], PADDING_X + bulletIndent, lineY, textColor);
      }

      currentY += bulletLines.length * BULLET_FONT_SIZE * LINE_HEIGHT_MULTIPLIER + BULLET_SPACING;
    }
  }

  // Export as PNG buffer
  return canvas.toBuffer('image/png');
}

/**
 * Overlays text on a slide from a buffer instead of URL
 */
export async function overlayTextOnSlideBuffer(
  backgroundBuffer: Buffer,
  content: SlideTextContent,
  options: TextOverlayOptions = {}
): Promise<Buffer> {
  const backgroundImage = await loadImage(backgroundBuffer);

  // Analyze brightness to determine text color
  const isLightImage = options.darkText ?? (await analyzeImageBrightness(backgroundBuffer));
  const textColor = isLightImage ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;

  // Create canvas
  const canvas = createCanvas(SLIDE_WIDTH, SLIDE_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Draw background image (scaled to fit)
  ctx.drawImage(backgroundImage, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  // Add semi-transparent overlay for text readability
  if (options.addOverlay !== false) {
    const overlayColor = options.overlayColor || (isLightImage ? 'white' : 'black');
    const overlayOpacity = options.overlayOpacity ?? 0.4;

    ctx.fillStyle =
      overlayColor === 'white'
        ? `rgba(255, 255, 255, ${overlayOpacity})`
        : `rgba(0, 0, 0, ${overlayOpacity})`;

    if (content.bullets && content.bullets.length > 0) {
      ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    } else {
      const gradient = ctx.createLinearGradient(0, SLIDE_HEIGHT * 0.5, 0, SLIDE_HEIGHT);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(0, 0, 0, ${overlayOpacity + 0.2})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    }
  }

  // Set up text rendering
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const maxTextWidth = SLIDE_WIDTH - PADDING_X * 2;

  // Render title
  ctx.font = `bold ${TITLE_FONT_SIZE}px "DejaVu Sans", "Liberation Sans", "Helvetica", "Arial", sans-serif`;

  const titleLines = wrapText(ctx, content.title, maxTextWidth);
  let currentY = PADDING_TOP;

  for (const line of titleLines) {
    drawTextWithShadow(ctx, line, PADDING_X, currentY, textColor);
    currentY += TITLE_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
  }

  // Render bullets
  if (content.bullets && content.bullets.length > 0) {
    ctx.font = `${BULLET_FONT_SIZE}px "DejaVu Sans", "Liberation Sans", "Helvetica", "Arial", sans-serif`;

    currentY = Math.max(currentY + 40, BULLET_START_Y);
    const bulletIndent = 40;
    const bulletMaxWidth = maxTextWidth - bulletIndent;

    for (const bullet of content.bullets) {
      drawTextWithShadow(ctx, '•', PADDING_X, currentY, textColor);

      const bulletLines = wrapText(ctx, bullet, bulletMaxWidth);

      for (let i = 0; i < bulletLines.length; i++) {
        const lineY = currentY + i * BULLET_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
        drawTextWithShadow(ctx, bulletLines[i], PADDING_X + bulletIndent, lineY, textColor);
      }

      currentY += bulletLines.length * BULLET_FONT_SIZE * LINE_HEIGHT_MULTIPLIER + BULLET_SPACING;
    }
  }

  return canvas.toBuffer('image/png');
}
