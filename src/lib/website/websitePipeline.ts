/**
 * FORGE & MUSASHI Website Pipeline
 * =================================
 *
 * Elite website generation system that creates complete, production-ready websites
 * with all assets: favicon, logo, hero images, section images, and full HTML/CSS/JS.
 *
 * Features:
 * - Comprehensive asset generation (favicon, logo, hero, sections, team photos)
 * - Industry-intelligent content generation
 * - Iteration support for user feedback
 * - GitHub push integration
 * - Vercel deployment
 */

import { createClient } from '@supabase/supabase-js';
import { createGeminiCompletion, createGeminiImageGeneration } from '@/lib/gemini/client';
import type { ToolType } from '@/lib/openai/types';
import { searchUserDocuments } from '@/lib/documents/userSearch';

// ============================================================================
// Types
// ============================================================================

export interface WebsiteAssets {
  favicon16?: string;      // 16x16 favicon data URL
  favicon32?: string;      // 32x32 favicon data URL
  faviconApple?: string;   // Apple touch icon (180x180)
  logo?: string;           // Main logo data URL
  logoLight?: string;      // Light version for dark backgrounds
  logoDark?: string;       // Dark version for light backgrounds
  heroBackground?: string; // Hero section background
  sectionImages: {
    about?: string;
    services?: string;
    testimonials?: string;
    contact?: string;
    [key: string]: string | undefined;
  };
  teamAvatars: string[];   // Team member photos/avatars
}

export interface WebsiteSession {
  id: string;
  userId: string;
  businessName: string;
  industry: string;
  originalPrompt: string;
  currentHtml: string;
  assets: WebsiteAssets;
  iterations: WebsiteIteration[];
  createdAt: string;
  updatedAt: string;
  status: 'generating' | 'ready' | 'iterating' | 'deployed';
  githubRepo?: string;
  vercelUrl?: string;
}

export interface WebsiteIteration {
  id: string;
  timestamp: string;
  userFeedback: string;
  changesDescription: string;
  previousHtml?: string;
}

export interface GenerationContext {
  businessName: string;
  industry: string;
  userPrompt: string;
  existingSession?: WebsiteSession;
  isModification?: boolean;
  modificationRequest?: string;
  // Brand context from user's uploaded documents
  userBrandContext?: {
    content: string;
    hasLogo?: boolean;
    hasBrandGuidelines?: boolean;
    hasContent?: boolean;
    documentNames: string[];
  };
}

export interface GenerationResult {
  success: boolean;
  html: string;
  assets: WebsiteAssets;
  sessionId: string;
  title: string;
  description: string;
  error?: string;
}

// ============================================================================
// Supabase Client
// ============================================================================

const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
};

// ============================================================================
// Website Session Management
// ============================================================================

/**
 * Get or create a website session for a user
 */
export async function getActiveWebsiteSession(userId: string): Promise<WebsiteSession | null> {
  const supabase = getSupabaseClient();

  try {
    // Get the most recent non-deployed session for this user
    const { data, error } = await supabase
      .from('website_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['generating', 'ready', 'iterating'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[WebsitePipeline] Error fetching session:', error);
      return null;
    }

    return data ? mapSessionFromDb(data) : null;
  } catch (err) {
    console.error('[WebsitePipeline] Error getting session:', err);
    return null;
  }
}

/**
 * Create a new website session
 */
export async function createWebsiteSession(
  userId: string,
  context: GenerationContext
): Promise<WebsiteSession> {
  const supabase = getSupabaseClient();
  const sessionId = crypto.randomUUID();

  const session: WebsiteSession = {
    id: sessionId,
    userId,
    businessName: context.businessName,
    industry: context.industry,
    originalPrompt: context.userPrompt,
    currentHtml: '',
    assets: {
      sectionImages: {},
      teamAvatars: [],
    },
    iterations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'generating',
  };

  try {
    await supabase.from('website_sessions').insert({
      id: session.id,
      user_id: session.userId,
      business_name: session.businessName,
      industry: session.industry,
      original_prompt: session.originalPrompt,
      current_html: session.currentHtml,
      assets: session.assets,
      iterations: session.iterations,
      status: session.status,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
  } catch {
    console.log('[WebsitePipeline] Session table may not exist, using in-memory session');
  }

  return session;
}

/**
 * Update a website session
 */
export async function updateWebsiteSession(session: WebsiteSession): Promise<void> {
  const supabase = getSupabaseClient();
  session.updatedAt = new Date().toISOString();

  try {
    await supabase.from('website_sessions').upsert({
      id: session.id,
      user_id: session.userId,
      business_name: session.businessName,
      industry: session.industry,
      original_prompt: session.originalPrompt,
      current_html: session.currentHtml,
      assets: session.assets,
      iterations: session.iterations,
      status: session.status,
      github_repo: session.githubRepo,
      vercel_url: session.vercelUrl,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
  } catch {
    console.log('[WebsitePipeline] Could not persist session update');
  }
}

function mapSessionFromDb(data: Record<string, unknown>): WebsiteSession {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    businessName: data.business_name as string,
    industry: data.industry as string,
    originalPrompt: data.original_prompt as string,
    currentHtml: data.current_html as string,
    assets: data.assets as WebsiteAssets,
    iterations: data.iterations as WebsiteIteration[],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    status: data.status as WebsiteSession['status'],
    githubRepo: data.github_repo as string | undefined,
    vercelUrl: data.vercel_url as string | undefined,
  };
}

// ============================================================================
// User Brand Context
// ============================================================================

/**
 * Fetch user's uploaded documents for brand context
 * Searches for brand guidelines, logos, company info, content docs
 */
async function fetchUserBrandContext(
  userId: string,
  businessName: string,
  industry: string
): Promise<{
  content: string;
  hasLogo: boolean;
  hasBrandGuidelines: boolean;
  hasContent: boolean;
  documentNames: string[];
}> {
  const emptyResult = {
    content: '',
    hasLogo: false,
    hasBrandGuidelines: false,
    hasContent: false,
    documentNames: [],
  };

  try {
    // Search for brand-related content
    const brandQuery = `${businessName} brand guidelines colors fonts logo style design company about services ${industry}`;
    const { results, contextString } = await searchUserDocuments(userId, brandQuery, {
      matchCount: 10,
      matchThreshold: 0.25, // Lower threshold to catch more brand-related content
    });

    if (!results || results.length === 0) {
      console.log('[WebsitePipeline] No user documents found for brand context');
      return emptyResult;
    }

    // Analyze what types of content we found
    const documentNames = [...new Set(results.map(r => r.document_name))];
    const contentLower = contextString.toLowerCase();

    const hasLogo = contentLower.includes('logo') ||
                    documentNames.some(n => n.toLowerCase().includes('logo'));
    const hasBrandGuidelines = contentLower.includes('brand') ||
                                contentLower.includes('guideline') ||
                                contentLower.includes('style guide') ||
                                documentNames.some(n => n.toLowerCase().includes('brand'));
    const hasContent = contentLower.includes('about') ||
                       contentLower.includes('service') ||
                       contentLower.includes('mission') ||
                       contentLower.includes('vision');

    console.log(`[WebsitePipeline] Brand context: logo=${hasLogo}, guidelines=${hasBrandGuidelines}, content=${hasContent}`);
    console.log(`[WebsitePipeline] Found documents: ${documentNames.join(', ')}`);

    return {
      content: contextString,
      hasLogo,
      hasBrandGuidelines,
      hasContent,
      documentNames,
    };
  } catch (error) {
    console.error('[WebsitePipeline] Error fetching brand context:', error);
    return emptyResult;
  }
}

// ============================================================================
// Asset Generation
// ============================================================================

/**
 * Generate all website assets in parallel
 */
export async function generateWebsiteAssets(
  businessName: string,
  industry: string,
  imageModel: string
): Promise<WebsiteAssets> {
  console.log('[WebsitePipeline] Generating comprehensive website assets...');

  const assets: WebsiteAssets = {
    sectionImages: {},
    teamAvatars: [],
  };

  // Generate assets in parallel batches for speed
  const batch1 = await Promise.allSettled([
    // Favicon generation
    generateFavicon(businessName, industry, imageModel, 32),
    // Main logo
    generateLogo(businessName, industry, imageModel),
    // Hero background
    generateHeroBackground(businessName, industry, imageModel),
  ]);

  // Process batch 1 results
  if (batch1[0].status === 'fulfilled' && batch1[0].value) {
    assets.favicon32 = batch1[0].value;
    assets.favicon16 = batch1[0].value; // Same image, browser will resize
    assets.faviconApple = batch1[0].value;
    console.log('[WebsitePipeline] ✓ Favicon generated');
  }

  if (batch1[1].status === 'fulfilled' && batch1[1].value) {
    assets.logo = batch1[1].value;
    console.log('[WebsitePipeline] ✓ Logo generated');
  }

  if (batch1[2].status === 'fulfilled' && batch1[2].value) {
    assets.heroBackground = batch1[2].value;
    console.log('[WebsitePipeline] ✓ Hero background generated');
  }

  // Generate section images (batch 2)
  const batch2 = await Promise.allSettled([
    generateSectionImage(businessName, industry, 'about', imageModel),
    generateSectionImage(businessName, industry, 'services', imageModel),
    generateTeamAvatars(industry, imageModel, 3),
  ]);

  if (batch2[0].status === 'fulfilled' && batch2[0].value) {
    assets.sectionImages.about = batch2[0].value;
    console.log('[WebsitePipeline] ✓ About section image generated');
  }

  if (batch2[1].status === 'fulfilled' && batch2[1].value) {
    assets.sectionImages.services = batch2[1].value;
    console.log('[WebsitePipeline] ✓ Services section image generated');
  }

  if (batch2[2].status === 'fulfilled' && batch2[2].value) {
    assets.teamAvatars = batch2[2].value;
    console.log('[WebsitePipeline] ✓ Team avatars generated');
  }

  return assets;
}

async function generateFavicon(
  businessName: string,
  industry: string,
  model: string,
  size: number = 32
): Promise<string | null> {
  try {
    const result = await createGeminiImageGeneration({
      prompt: `Simple, iconic favicon for "${businessName}" - a ${industry} business.
        Requirements:
        - Single recognizable symbol or letter
        - Very simple design that works at ${size}x${size} pixels
        - Bold, clear shapes
        - High contrast
        - NO text (except maybe one letter)
        - Professional, modern style`,
      systemPrompt: 'Create a simple favicon icon. Must be recognizable at tiny sizes. Think Twitter bird, Apple apple, or a single letter logo.',
      model,
    });
    return result ? `data:${result.mimeType};base64,${result.imageData}` : null;
  } catch (err) {
    console.log('[WebsitePipeline] Favicon generation failed:', err);
    return null;
  }
}

async function generateLogo(
  businessName: string,
  industry: string,
  model: string
): Promise<string | null> {
  try {
    const result = await createGeminiImageGeneration({
      prompt: `Professional logo for "${businessName}" - a ${industry} business.
        Requirements:
        - Modern, clean design
        - Works on both light and dark backgrounds
        - Memorable and unique
        - Professional quality that would cost $500+ from a design agency
        - Include business name in stylized text OR pure icon
        - Appropriate style for ${industry} industry`,
      systemPrompt: 'You are a world-class logo designer. Create a logo that communicates professionalism and trust.',
      model,
    });
    return result ? `data:${result.mimeType};base64,${result.imageData}` : null;
  } catch (err) {
    console.log('[WebsitePipeline] Logo generation failed:', err);
    return null;
  }
}

async function generateHeroBackground(
  businessName: string,
  industry: string,
  model: string
): Promise<string | null> {
  try {
    const result = await createGeminiImageGeneration({
      prompt: `Hero section background for "${businessName}" website - ${industry} industry.
        Requirements:
        - Subtle and elegant, not busy
        - Perfect for overlaying white or light text
        - Modern gradients, abstract patterns, or relevant imagery
        - High-end, premium feel
        - Works well darkened for text overlay
        - Wide aspect ratio suitable for hero sections`,
      systemPrompt: 'Create a premium hero background. Think $10,000+ website quality. Subtle enough for text overlay.',
      model,
    });
    return result ? `data:${result.mimeType};base64,${result.imageData}` : null;
  } catch (err) {
    console.log('[WebsitePipeline] Hero background generation failed:', err);
    return null;
  }
}

async function generateSectionImage(
  businessName: string,
  industry: string,
  section: string,
  model: string
): Promise<string | null> {
  const sectionPrompts: Record<string, string> = {
    about: `Professional image for "About Us" section of ${businessName} - ${industry}.
      Show teamwork, professional environment, or company culture. Warm and inviting.`,
    services: `Image showcasing ${industry} services for ${businessName}.
      Professional, action-oriented, showing the value provided.`,
    testimonials: `Background for testimonials section - subtle, professional pattern or
      soft imagery that makes customer quotes stand out.`,
    contact: `Professional background for contact section. Subtle, inviting,
      conveys accessibility and professionalism.`,
  };

  try {
    const result = await createGeminiImageGeneration({
      prompt: sectionPrompts[section] || `Professional image for ${section} section`,
      systemPrompt: 'Create high-quality website imagery that looks premium and professional.',
      model,
    });
    return result ? `data:${result.mimeType};base64,${result.imageData}` : null;
  } catch (err) {
    console.log(`[WebsitePipeline] Section image (${section}) generation failed:`, err);
    return null;
  }
}

async function generateTeamAvatars(
  industry: string,
  model: string,
  count: number = 3
): Promise<string[]> {
  const roles = ['CEO/Founder', 'Lead Specialist', 'Client Success Manager'];
  const avatars: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const result = await createGeminiImageGeneration({
        prompt: `Professional headshot/avatar for a ${roles[i]} in the ${industry} industry.
          Requirements:
          - Friendly, approachable expression
          - Professional attire appropriate for ${industry}
          - Clean background (solid or subtle gradient)
          - High-quality portrait style
          - Diverse representation`,
        systemPrompt: 'Create a professional corporate headshot that would appear on a company website.',
        model,
      });
      if (result) {
        avatars.push(`data:${result.mimeType};base64,${result.imageData}`);
      }
    } catch (err) {
      console.log(`[WebsitePipeline] Team avatar ${i} generation failed:`, err);
    }
  }

  return avatars;
}

// ============================================================================
// Website HTML Generation
// ============================================================================

/**
 * Generate the complete website HTML with all assets integrated
 */
export async function generateWebsiteHtml(
  context: GenerationContext,
  assets: WebsiteAssets,
  geminiModel: string
): Promise<string> {
  console.log('[WebsitePipeline] Generating complete website HTML...');

  // Build asset context for the AI
  const assetContext = buildAssetContext(assets);

  // Build user brand context section if available
  const brandContextSection = context.userBrandContext?.content
    ? `
USER'S BRAND DOCUMENTS (CRITICAL - USE THIS INFO):
The user has uploaded brand documents. Incorporate this information into the website:
${context.userBrandContext.content}

${context.userBrandContext.hasBrandGuidelines ? '⚠️ BRAND GUIDELINES DETECTED - Follow any color, font, and style guidelines mentioned above.' : ''}
${context.userBrandContext.hasContent ? '⚠️ COMPANY CONTENT DETECTED - Use the about text, mission, services mentioned above.' : ''}
Documents found: ${context.userBrandContext.documentNames.join(', ')}
`
    : '';

  const systemPrompt = `You are FORGE & MUSASHI - the most elite web development AI team ever created.
You build websites that make $15,000+ agencies jealous.

BUSINESS CONTEXT:
- Business Name: "${context.businessName}"
- Industry: ${context.industry}
- User Request: "${context.userPrompt}"
${brandContextSection}
AVAILABLE ASSETS (already generated, use these exact URLs):
${assetContext}

YOUR MISSION: Create a COMPLETE, STUNNING, PRODUCTION-READY website.

CRITICAL RULES:
1. Use the EXACT asset URLs provided above - they are valid data URLs
2. Build a COMPLETE HTML document with <!DOCTYPE html>
3. Include ALL CSS inline in <style> tags
4. Include ALL JavaScript inline in <script> tags
5. Make it FULLY RESPONSIVE (mobile-first)
6. Add smooth animations and transitions
7. Make it look like a $10,000+ website

REQUIRED SECTIONS:
1. HEADER/NAV - Sticky, with logo (use provided), menu, CTA button, hamburger for mobile
2. HERO - Powerful headline, subheadline, CTAs, use hero background if provided
3. FEATURES/SERVICES - 3-6 items with icons, descriptions
4. PRICING - 3 tiers with realistic prices for ${context.industry}
5. ABOUT - Company story, stats, team photos (use provided avatars)
6. TESTIMONIALS - 3 realistic reviews with photos
7. FAQ - 5-6 common questions for ${context.industry}
8. CONTACT - Form, contact info, hours, map placeholder
9. FOOTER - Links, social icons, newsletter, copyright

TECHNICAL REQUIREMENTS:
- Mobile-first CSS with min-width media queries
- CSS Grid + Flexbox layouts
- CSS custom properties for colors/spacing
- Touch-friendly (44px min tap targets)
- Smooth scroll behavior
- Intersection Observer for scroll animations
- Hamburger menu with smooth animation
- Google Fonts (Inter or Poppins)
- Form validation (HTML5 + JS)

VISUAL DESIGN:
- Modern glassmorphism (backdrop-blur on nav/cards)
- Subtle gradients and shadows
- Micro-animations on hover
- Professional color palette for ${context.industry}
- Consistent 8px spacing grid
- Beautiful typography hierarchy

OUTPUT: Raw HTML only. No markdown. No code blocks. Complete document.`;

  const result = await createGeminiCompletion({
    messages: [{ role: 'user', content: context.userPrompt }],
    tool: 'code' as ToolType,
    systemPrompt,
    userId: context.existingSession?.userId || 'system',
    model: geminiModel,
  });

  let html = result.text || '';

  // Clean up the HTML
  html = cleanGeneratedHtml(html);

  // Inject any missing assets
  html = injectMissingAssets(html, assets, context.businessName);

  return html;
}

function buildAssetContext(assets: WebsiteAssets): string {
  const lines: string[] = [];

  if (assets.favicon32) {
    lines.push(`- FAVICON: ${assets.favicon32.substring(0, 100)}... (use this for <link rel="icon">)`);
  }
  if (assets.logo) {
    lines.push(`- LOGO: ${assets.logo.substring(0, 100)}... (use this for header logo <img>)`);
  }
  if (assets.heroBackground) {
    lines.push(`- HERO BACKGROUND: ${assets.heroBackground.substring(0, 100)}... (use as background-image)`);
  }
  if (assets.sectionImages.about) {
    lines.push(`- ABOUT IMAGE: ${assets.sectionImages.about.substring(0, 100)}...`);
  }
  if (assets.sectionImages.services) {
    lines.push(`- SERVICES IMAGE: ${assets.sectionImages.services.substring(0, 100)}...`);
  }
  if (assets.teamAvatars.length > 0) {
    lines.push(`- TEAM PHOTOS: ${assets.teamAvatars.length} professional headshots available`);
    assets.teamAvatars.forEach((avatar, i) => {
      lines.push(`  - Avatar ${i + 1}: ${avatar.substring(0, 80)}...`);
    });
  }

  return lines.join('\n') || '- No pre-generated assets (create CSS-based alternatives)';
}

function cleanGeneratedHtml(html: string): string {
  html = html.trim();

  // Remove markdown code blocks
  if (html.startsWith('```html')) html = html.slice(7);
  if (html.startsWith('```')) html = html.slice(3);
  if (html.endsWith('```')) html = html.slice(0, -3);

  html = html.trim();

  // Ensure proper HTML structure
  if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website</title>
</head>
<body>
${html}
</body>
</html>`;
  }

  return html;
}

function injectMissingAssets(
  html: string,
  assets: WebsiteAssets,
  businessName: string
): string {
  // Inject favicon if missing
  if (assets.favicon32 && !html.includes('rel="icon"')) {
    html = html.replace(
      '</head>',
      `  <link rel="icon" type="image/png" sizes="32x32" href="${assets.favicon32}">
  <link rel="apple-touch-icon" href="${assets.faviconApple || assets.favicon32}">
</head>`
    );
  }

  // Inject logo into header/nav if placeholder detected
  if (assets.logo) {
    html = html.replace(
      /src=["'](?:logo\.png|placeholder|#logo|LOGO_URL|\.\.\.)[^"']*["']/gi,
      `src="${assets.logo}"`
    );

    // If no logo found in nav, add it
    if (!html.includes(assets.logo)) {
      const navMatch = html.match(/(<nav[^>]*>.*?)(<\/nav>)/is);
      if (navMatch && !navMatch[1].includes('<img')) {
        html = html.replace(
          navMatch[0],
          navMatch[1].replace(
            /(<nav[^>]*>)/i,
            `$1<a href="#" class="logo"><img src="${assets.logo}" alt="${businessName}" style="height:50px;width:auto;"></a>`
          ) + navMatch[2]
        );
      }
    }
  }

  // Inject hero background
  if (assets.heroBackground) {
    // Try to find hero section and add background
    if (!html.includes(assets.heroBackground)) {
      // Add to .hero class
      html = html.replace(
        /\.hero\s*\{([^}]*)\}/i,
        `.hero { $1; background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${assets.heroBackground}'); background-size: cover; background-position: center; }`
      );
    }
  }

  // Inject team avatars for testimonials
  if (assets.teamAvatars.length > 0) {
    assets.teamAvatars.forEach((avatar, i) => {
      const placeholderPattern = new RegExp(
        `src=["'](?:avatar${i + 1}|person${i + 1}|team${i + 1}|placeholder|user-placeholder)[^"']*["']`,
        'gi'
      );
      html = html.replace(placeholderPattern, `src="${avatar}"`);
    });
  }

  return html;
}

// ============================================================================
// Iteration Handling
// ============================================================================

/**
 * Apply user modifications to an existing website
 */
export async function applyWebsiteModification(
  session: WebsiteSession,
  userFeedback: string,
  geminiModel: string
): Promise<{ success: boolean; html: string; changesDescription: string }> {
  console.log('[WebsitePipeline] Applying website modification...');

  const systemPrompt = `You are an expert web developer tasked with modifying an existing website based on user feedback.

CURRENT WEBSITE HTML:
\`\`\`html
${session.currentHtml.substring(0, 30000)}
\`\`\`

USER MODIFICATION REQUEST:
"${userFeedback}"

YOUR TASK:
1. Understand what the user wants to change
2. Make ONLY the requested changes
3. Keep everything else exactly the same
4. Maintain all existing styling and functionality
5. Return the COMPLETE modified HTML

IMPORTANT:
- Do NOT remove or break existing features
- Keep all existing assets and images
- Preserve the overall structure
- Only modify what was specifically requested

OUTPUT: Complete HTML document with modifications applied. No markdown. No code blocks.`;

  try {
    const result = await createGeminiCompletion({
      messages: [{ role: 'user', content: `Modify this website: ${userFeedback}` }],
      tool: 'code' as ToolType,
      systemPrompt,
      userId: session.userId,
      model: geminiModel,
    });

    let html = result.text || '';
    html = cleanGeneratedHtml(html);

    // Create iteration record
    const iteration: WebsiteIteration = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userFeedback,
      changesDescription: `Applied modifications: ${userFeedback.substring(0, 100)}...`,
      previousHtml: session.currentHtml,
    };

    // Update session
    session.iterations.push(iteration);
    session.currentHtml = html;
    session.status = 'ready';
    await updateWebsiteSession(session);

    return {
      success: true,
      html,
      changesDescription: iteration.changesDescription,
    };
  } catch (err) {
    console.error('[WebsitePipeline] Modification failed:', err);
    return {
      success: false,
      html: session.currentHtml,
      changesDescription: 'Failed to apply modifications',
    };
  }
}

// ============================================================================
// Website Modification Detection
// ============================================================================

/**
 * Check if a message is requesting modification to an existing website
 */
export function isWebsiteModificationRequest(text: string): boolean {
  const modificationPatterns = [
    /\b(change|modify|update|edit|adjust|fix|tweak|alter)\b.*\b(website|page|site|section|color|font|text|image|layout|header|footer|nav|hero|pricing|about|contact)\b/i,
    /\b(make|can you make)\b.*\b(bigger|smaller|darker|lighter|different|bold|italic)\b/i,
    /\b(remove|delete|get rid of|hide)\b.*\b(section|element|button|image|text)\b/i,
    /\b(add|include|insert|put)\b.*\b(section|button|image|text|feature)\b/i,
    /\b(move|reposition|relocate)\b.*\b(section|element|button)\b/i,
    /\b(the|that|this)\s+(website|page|site)\b.*\b(needs|should|could)\b/i,
    /\bi\s*(don'?t|do not)\s*like\b.*\b(color|font|layout|design)\b/i,
    /\b(instead|rather|prefer)\b.*\b(color|font|style|design)\b/i,
    /\bchange\s+the\b/i,
    /\bmake\s+it\b/i,
    /\bupdate\s+the\b/i,
  ];

  return modificationPatterns.some(pattern => pattern.test(text));
}

// ============================================================================
// Main Pipeline Entry Point
// ============================================================================

/**
 * Generate a complete website with all assets
 */
export async function generateCompleteWebsite(
  userId: string,
  context: GenerationContext,
  geminiModel: string,
  imageModel: string
): Promise<GenerationResult> {
  console.log('[WebsitePipeline] Starting complete website generation...');
  console.log(`[WebsitePipeline] Business: ${context.businessName}, Industry: ${context.industry}`);

  try {
    // Check for existing session (for modifications)
    let session = context.existingSession;

    if (context.isModification && session) {
      // This is a modification to an existing website
      console.log('[WebsitePipeline] Processing modification request...');
      const modResult = await applyWebsiteModification(
        session,
        context.modificationRequest || context.userPrompt,
        geminiModel
      );

      return {
        success: modResult.success,
        html: modResult.html,
        assets: session.assets,
        sessionId: session.id,
        title: session.businessName,
        description: modResult.changesDescription,
      };
    }

    // Fetch user's brand documents for context
    console.log('[WebsitePipeline] Searching user documents for brand context...');
    const brandContext = await fetchUserBrandContext(userId, context.businessName, context.industry);
    if (brandContext.content) {
      context.userBrandContext = brandContext;
      console.log(`[WebsitePipeline] Found brand context from ${brandContext.documentNames.length} documents`);
    }

    // Create new session
    session = await createWebsiteSession(userId, context);
    console.log(`[WebsitePipeline] Created session: ${session.id}`);

    // Generate all assets in parallel
    console.log('[WebsitePipeline] Generating assets...');
    const assets = await generateWebsiteAssets(
      context.businessName,
      context.industry,
      imageModel
    );
    session.assets = assets;

    // Generate the complete HTML
    console.log('[WebsitePipeline] Generating HTML...');
    const html = await generateWebsiteHtml(context, assets, geminiModel);
    session.currentHtml = html;
    session.status = 'ready';

    // Persist the session
    await updateWebsiteSession(session);

    // Extract title from HTML
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : `${context.businessName} - Website`;

    // Count generated assets
    const assetCount = [
      assets.favicon32 ? 1 : 0,
      assets.logo ? 1 : 0,
      assets.heroBackground ? 1 : 0,
      Object.values(assets.sectionImages).filter(Boolean).length,
      assets.teamAvatars.length,
    ].reduce((a, b) => a + b, 0);

    console.log(`[WebsitePipeline] Generation complete! ${assetCount} assets generated.`);

    return {
      success: true,
      html,
      assets,
      sessionId: session.id,
      title,
      description: `Generated ${assetCount} custom assets including favicon, logo, hero background, section images, and team photos.`,
    };
  } catch (err) {
    console.error('[WebsitePipeline] Generation failed:', err);
    return {
      success: false,
      html: '',
      assets: { sectionImages: {}, teamAvatars: [] },
      sessionId: '',
      title: '',
      description: '',
      error: err instanceof Error ? err.message : 'Website generation failed',
    };
  }
}

// ============================================================================
// GitHub Push
// ============================================================================

export interface GitHubPushResult {
  success: boolean;
  repoUrl?: string;
  commitSha?: string;
  error?: string;
}

/**
 * Check if a message is requesting to push to GitHub
 */
export function isGitHubPushRequest(text: string): boolean {
  const patterns = [
    /\b(push|save|commit|upload)\b.*\b(to|on)\s+(github|git|repo|repository)\b/i,
    /\bgithub\b.*\b(push|save|commit|upload)\b/i,
    /\bpush\s+(this|the|it|my)\s+(to\s+)?github\b/i,
    /\bsave\s+(this|the|it)\s+to\s+github\b/i,
    /\bcreate\s+(a\s+)?(github\s+)?repo(sitory)?\b/i,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Push a generated website to GitHub
 */
export async function pushWebsiteToGitHub(
  session: WebsiteSession,
  githubToken: string,
  repoName?: string
): Promise<GitHubPushResult> {
  console.log('[WebsitePipeline] Pushing website to GitHub...');

  try {
    // Import the GitHub connector functions
    const { pushFiles, createRepository } = await import('@/lib/connectors');

    // Generate a repo name from the business name
    const normalizedName = (repoName || session.businessName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const repoFullName = `${normalizedName}-website`;

    // Try to create the repo (may already exist)
    try {
      await createRepository(githubToken, {
        name: repoFullName,
        description: `Website for ${session.businessName} - Generated by FORGE & MUSASHI`,
        private: false,
        autoInit: true,
      });
      console.log(`[WebsitePipeline] Created new repo: ${repoFullName}`);
    } catch {
      // Repo might already exist, which is fine
      console.log(`[WebsitePipeline] Repo may already exist: ${repoFullName}`);
    }

    // Get GitHub username from token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const userData = await userResponse.json();
    const owner = userData.login;

    // Prepare files for push
    const files = [
      {
        path: 'index.html',
        content: session.currentHtml,
      },
      {
        path: 'README.md',
        content: `# ${session.businessName} Website

Generated by FORGE & MUSASHI AI Website Pipeline.

## About

- **Business**: ${session.businessName}
- **Industry**: ${session.industry}
- **Generated**: ${new Date().toISOString()}

## Preview

Open \`index.html\` in your browser to preview the website.

## Deployment

This website is ready to be deployed on:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Customization

The website includes:
- Fully responsive design
- Custom AI-generated assets
- Modern CSS animations
- Working contact form (needs backend integration)

---

*Built with [FORGE & MUSASHI](https://github.com/themusashimaru/jcil-ai-micro) - AI Website Generation Pipeline*
`,
      },
    ];

    // Push the files
    const pushResult = await pushFiles(githubToken, {
      owner,
      repo: repoFullName,
      branch: 'main',
      message: `Initial website deployment for ${session.businessName}`,
      files,
    });

    if (!pushResult.success) {
      throw new Error(pushResult.error || 'Failed to push files');
    }

    // Update session with GitHub repo info
    session.githubRepo = `https://github.com/${owner}/${repoFullName}`;
    await updateWebsiteSession(session);

    console.log(`[WebsitePipeline] Successfully pushed to GitHub: ${session.githubRepo}`);

    return {
      success: true,
      repoUrl: session.githubRepo,
      commitSha: pushResult.commitSha,
    };
  } catch (err) {
    console.error('[WebsitePipeline] GitHub push failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to push to GitHub',
    };
  }
}

// ============================================================================
// Vercel Deployment
// ============================================================================

export interface VercelDeployResult {
  success: boolean;
  deploymentUrl?: string;
  projectId?: string;
  error?: string;
}

/**
 * Check if a message is requesting Vercel deployment
 */
export function isVercelDeployRequest(text: string): boolean {
  const patterns = [
    /\b(deploy|launch|publish|go\s+live)\b.*\b(to|on)\s+vercel\b/i,
    /\bvercel\b.*\b(deploy|launch|publish)\b/i,
    /\bdeploy\s+(this|the|it|my)\s+(to\s+)?vercel\b/i,
    /\bgo\s+live\s+(on|with)\s+vercel\b/i,
    /\bhost\s+(this|it)\s+(on\s+)?vercel\b/i,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Deploy a website to Vercel
 */
export async function deployWebsiteToVercel(
  session: WebsiteSession,
  vercelToken?: string
): Promise<VercelDeployResult> {
  console.log('[WebsitePipeline] Deploying website to Vercel...');

  const token = vercelToken || process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      success: false,
      error: 'Vercel deployment not configured. Please add VERCEL_TOKEN to environment or connect your Vercel account.',
    };
  }

  try {
    // Generate project name
    const projectName = session.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    // Prepare files for Vercel deployment
    const files = [
      {
        file: 'index.html',
        data: Buffer.from(session.currentHtml).toString('base64'),
        encoding: 'base64',
      },
    ];

    // Deploy to Vercel
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files,
        projectSettings: {
          framework: null, // Static HTML
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Vercel deployment failed');
    }

    const data = await response.json();
    const deploymentUrl = `https://${data.url}`;

    // Update session with Vercel URL
    session.vercelUrl = deploymentUrl;
    session.status = 'deployed';
    await updateWebsiteSession(session);

    console.log(`[WebsitePipeline] Successfully deployed to Vercel: ${deploymentUrl}`);

    return {
      success: true,
      deploymentUrl,
      projectId: data.id,
    };
  } catch (err) {
    console.error('[WebsitePipeline] Vercel deployment failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Vercel deployment failed',
    };
  }
}

/**
 * Check if a message is requesting any deployment action (GitHub or Vercel)
 */
export function isDeploymentRequest(text: string): { isDeployment: boolean; target?: 'github' | 'vercel' } {
  if (isGitHubPushRequest(text)) {
    return { isDeployment: true, target: 'github' };
  }
  if (isVercelDeployRequest(text)) {
    return { isDeployment: true, target: 'vercel' };
  }
  return { isDeployment: false };
}
