/**
 * Text Overlay for Slide Generation
 *
 * Renders actual text on top of AI-generated slide backgrounds
 * using @napi-rs/canvas for proper, readable text.
 */

import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';

const log = logger('TextOverlay');

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

// Font family string - uses system fonts with robust fallback chain
// The canvas will try each font in order until one works
const FONT_FAMILY =
  '"DejaVu Sans", "Liberation Sans", "Noto Sans", "Roboto", "Helvetica Neue", "Arial", "FreeSans", sans-serif';

/**
 * Register system fonts from various common locations
 * Supports multiple environments: local dev, Docker, Vercel, AWS Lambda, CI
 */
function registerFonts(): { registered: number; paths: string[] } {
  const registeredPaths: string[] = [];

  // Font paths organized by priority and environment
  const fontPaths = [
    // ============================================
    // PROJECT-BUNDLED FONTS (highest priority)
    // ============================================
    // Bundled fonts in the project (for Vercel/production)
    join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'),
    join(process.cwd(), 'fonts', 'DejaVuSans-Bold.ttf'),
    join(process.cwd(), 'fonts', 'DejaVuSans.ttf'),

    // ============================================
    // VERCEL / AWS LAMBDA PATHS
    // ============================================
    '/var/task/fonts/DejaVuSans-Bold.ttf',
    '/var/task/fonts/DejaVuSans.ttf',
    '/var/task/public/fonts/DejaVuSans-Bold.ttf',
    '/var/task/public/fonts/DejaVuSans.ttf',

    // ============================================
    // LINUX SYSTEM FONTS (common distros)
    // ============================================
    // DejaVu (most common, wide unicode support)
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    // Liberation (metric-compatible with Arial/Helvetica)
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    // Noto (Google's universal font)
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/noto/NotoSans-Regular.ttf',
    // FreeFonts
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    // Ubuntu fonts
    '/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf',
    '/usr/share/fonts/truetype/ubuntu/Ubuntu-Regular.ttf',
    // Alternative Linux paths (some distros)
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',

    // ============================================
    // DOCKER / ALPINE LINUX PATHS
    // ============================================
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',

    // ============================================
    // macOS PATHS
    // ============================================
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/SFNSText.ttf',
    '/System/Library/Fonts/SFNSDisplay.ttf',
    '/Library/Fonts/Arial.ttf',
    '/Library/Fonts/Arial Bold.ttf',

    // ============================================
    // WINDOWS PATHS (for local dev on Windows)
    // ============================================
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\segoeuib.ttf',
  ];

  for (const fontPath of fontPaths) {
    try {
      if (existsSync(fontPath)) {
        GlobalFonts.registerFromPath(fontPath);
        registeredPaths.push(fontPath);
        log.debug('Font registered', { path: fontPath });
      }
    } catch (err) {
      // Log at debug level to avoid noise in production logs
      log.debug('Font registration failed', {
        path: fontPath,
        error: (err as Error).message,
      });
    }
  }

  // Log summary
  if (registeredPaths.length > 0) {
    log.info('Fonts registered for text overlay', {
      count: registeredPaths.length,
      fonts: registeredPaths.slice(0, 3), // Log first 3 to avoid noise
    });
  } else {
    log.warn('No fonts registered - text overlay will use canvas default font', {
      searchedPaths: fontPaths.length,
      hint: 'To fix: install fonts package (apt-get install fonts-dejavu) or bundle fonts in public/fonts/',
    });
  }

  return { registered: registeredPaths.length, paths: registeredPaths };
}

// Register fonts on module load and track status
const fontRegistration = registerFonts();
const fontsLoaded = fontRegistration.registered > 0;

/**
 * Check if fonts are properly loaded for text rendering
 */
export function areFontsLoaded(): boolean {
  return fontsLoaded;
}

/**
 * Get information about registered fonts
 */
export function getFontInfo(): { loaded: boolean; count: number; paths: string[] } {
  return {
    loaded: fontsLoaded,
    count: fontRegistration.registered,
    paths: fontRegistration.paths,
  };
}

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
  log.info('Starting text overlay', {
    title: content.title,
    bulletCount: content.bullets?.length || 0,
    url: backgroundImageUrl.substring(0, 50) + '...',
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

  let backgroundImage;
  try {
    backgroundImage = await loadImage(imageBuffer);
    log.info('Image loaded into canvas', {
      width: backgroundImage.width,
      height: backgroundImage.height,
    });
  } catch (err) {
    log.error('Failed to load image into canvas', { error: (err as Error).message });
    throw err;
  }

  // Analyze brightness to determine text color
  const isLightImage = options.darkText ?? (await analyzeImageBrightness(imageBuffer));
  const textColor = isLightImage ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;
  log.info('Text color determined', { isLightImage, textColor });

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
  ctx.font = `bold ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;

  const titleLines = wrapText(ctx, content.title, maxTextWidth);
  let currentY = PADDING_TOP;

  for (const line of titleLines) {
    drawTextWithShadow(ctx, line, PADDING_X, currentY, textColor);
    currentY += TITLE_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
  }

  // Render bullets
  if (content.bullets && content.bullets.length > 0) {
    ctx.font = `${BULLET_FONT_SIZE}px ${FONT_FAMILY}`;

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
  log.info('Rendering canvas to buffer', {
    title: content.title,
    bulletCount: content.bullets?.length || 0,
  });

  const outputBuffer = canvas.toBuffer('image/png');
  log.info('Text overlay complete', {
    title: content.title,
    outputSizeBytes: outputBuffer.length,
    fontsLoaded,
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
  ctx.font = `bold ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;

  const titleLines = wrapText(ctx, content.title, maxTextWidth);
  let currentY = PADDING_TOP;

  for (const line of titleLines) {
    drawTextWithShadow(ctx, line, PADDING_X, currentY, textColor);
    currentY += TITLE_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
  }

  // Render bullets
  if (content.bullets && content.bullets.length > 0) {
    ctx.font = `${BULLET_FONT_SIZE}px ${FONT_FAMILY}`;

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
