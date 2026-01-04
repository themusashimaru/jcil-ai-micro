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
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { generateBusinessModel, BusinessModel } from './businessModelGenerator';

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
  // Stored business model for smart editing
  businessModel?: BusinessModel;
}

export interface WebsiteIteration {
  id: string;
  timestamp: string;
  userFeedback: string;
  changesDescription: string;
  previousHtml?: string;
}

// Research context from Perplexity web search
export interface IndustryResearch {
  industryOverview: string;
  typicalServices: string[];
  pricingInsights: string;
  locationContext?: string;
  competitorInfo?: string;
  designTrends: string;
  colorRecommendations: string[];
  keyMessages: string[];
  sources: string[];
}

// Extracted business information using AI
export interface ExtractedBusinessInfo {
  businessName: string;
  industry: string;
  services: string[];
  location?: string;
  pricing?: string;
  email?: string;
  phone?: string;
  stylePreference?: string;
  targetAudience?: string;
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
  // Research context from web search
  industryResearch?: IndustryResearch;
  // Extended business info from AI extraction
  extractedInfo?: ExtractedBusinessInfo;
  // Generated business model with structured pricing, services, testimonials
  businessModel?: BusinessModel;
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
// AI-Powered Business Info Extraction
// ============================================================================

/**
 * Extract business information using AI semantic understanding
 * Much better than regex - handles natural language input
 */
export async function extractBusinessInfoWithAI(
  userPrompt: string,
  conversationContext?: string
): Promise<ExtractedBusinessInfo> {
  console.log('[WebsitePipeline] Extracting business info with AI...');

  const extractionPrompt = `You are extracting business information from a user's message.
Parse the following message and extract structured business details.

USER MESSAGE:
${userPrompt}

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}\n` : ''}

Extract the following as JSON (use null for any field not mentioned):
{
  "businessName": "The actual business name (proper noun, not 'my business' or descriptions)",
  "industry": "The industry/type (e.g., 'tutoring', 'photography', 'dental', 'restaurant')",
  "services": ["List of specific services mentioned"],
  "location": "City, state, or area if mentioned",
  "pricing": "Any pricing mentioned (e.g., '$50/hour')",
  "email": "Email address if provided",
  "phone": "Phone number if provided",
  "stylePreference": "Design style preference (modern, elegant, bold, etc.)",
  "targetAudience": "Target audience if mentioned (e.g., 'high school students', 'families')"
}

IMPORTANT RULES:
1. For businessName: Extract ONLY the actual name. "My business name is Grand Master Tutoring and we tutor students" → "Grand Master Tutoring"
2. Don't include descriptions like "and we do X" in the name
3. For services: Be specific - "SAT prep, college prep, high school tutoring"
4. Return valid JSON only, no markdown formatting`;

  try {
    const result = await createGeminiCompletion({
      messages: [{ role: 'user', content: extractionPrompt }],
      model: 'gemini-2.0-flash-exp',
      temperature: 0,
      maxTokens: 1000,
    });

    const text = result?.text || '';
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[WebsitePipeline] Extracted business info:', parsed);
      return {
        businessName: parsed.businessName || 'Business',
        industry: parsed.industry || 'business',
        services: parsed.services || [],
        location: parsed.location || undefined,
        pricing: parsed.pricing || undefined,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        stylePreference: parsed.stylePreference || undefined,
        targetAudience: parsed.targetAudience || undefined,
      };
    }
  } catch (err) {
    console.error('[WebsitePipeline] AI extraction failed:', err);
  }

  // Fallback to basic extraction
  return {
    businessName: 'Business',
    industry: 'business',
    services: [],
  };
}

// ============================================================================
// Industry Research with Perplexity
// ============================================================================

/**
 * Research industry context using Perplexity web search
 * Gathers competitive info, pricing, design trends, and key messaging
 */
export async function researchIndustryContext(
  _businessName: string, // Not used in search query, but kept for future competitive analysis
  industry: string,
  location?: string,
  services?: string[]
): Promise<IndustryResearch | null> {
  console.log('[WebsitePipeline] Researching industry context...');

  if (!isPerplexityConfigured()) {
    console.log('[WebsitePipeline] Perplexity not configured, skipping research');
    return null;
  }

  try {
    const servicesList = services?.length ? services.join(', ') : industry;
    const locationQuery = location ? ` in ${location}` : '';

    // Build a comprehensive research query
    const researchQuery = `Research for a ${industry} business${locationQuery}:
1. What are typical services and pricing for ${servicesList}${locationQuery}?
2. What are the key selling points and value propositions for ${industry} businesses?
3. What design styles and colors work best for ${industry} websites?
4. What should a ${industry} website homepage include?
5. ${location ? `What are popular ${industry} businesses in ${location}?` : ''}

Focus on actionable information for creating a professional website.`;

    const searchResult = await perplexitySearch({
      query: researchQuery,
      model: 'sonar',
      systemPrompt: `You are a business research assistant helping gather information for website creation.
Provide specific, actionable insights about the ${industry} industry.
Focus on: pricing ranges, typical services, design recommendations, key messaging, and competitive landscape.
Be concise but comprehensive.`,
    });

    // Parse the research into structured format
    const parsePrompt = `Parse this industry research into structured JSON:

RESEARCH:
${searchResult.answer}

Return JSON:
{
  "industryOverview": "Brief overview of the ${industry} industry",
  "typicalServices": ["List of common services"],
  "pricingInsights": "Typical pricing ranges",
  "locationContext": "Local market insights if available",
  "designTrends": "Website design recommendations for this industry",
  "colorRecommendations": ["3-4 color suggestions with hex codes"],
  "keyMessages": ["3-5 key marketing messages/value propositions"]
}`;

    const parseResult = await createGeminiCompletion({
      messages: [{ role: 'user', content: parsePrompt }],
      model: 'gemini-2.0-flash-exp',
      temperature: 0,
      maxTokens: 1500,
    });

    const parseText = parseResult?.text || '';
    const jsonMatch = parseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[WebsitePipeline] Research parsed successfully');
      return {
        industryOverview: parsed.industryOverview || '',
        typicalServices: parsed.typicalServices || [],
        pricingInsights: parsed.pricingInsights || '',
        locationContext: parsed.locationContext || undefined,
        competitorInfo: parsed.competitorInfo || undefined,
        designTrends: parsed.designTrends || '',
        colorRecommendations: parsed.colorRecommendations || [],
        keyMessages: parsed.keyMessages || [],
        sources: searchResult.sources?.map(s => s.url) || [],
      };
    }
  } catch (err) {
    console.error('[WebsitePipeline] Industry research failed:', err);
  }

  return null;
}

// ============================================================================
// Asset Generation
// ============================================================================

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

// Industry-specific design guidelines
const INDUSTRY_DESIGN_GUIDES: Record<string, {
  symbols: string[];
  colors: string[];
  heroTheme: string;
  logoStyle: string;
  fallbackHero: string; // Unsplash URL for when image generation fails
}> = {
  'driving school': {
    symbols: ['steering wheel', 'car', 'road', 'traffic light', 'license'],
    colors: ['#1E40AF (trust blue)', '#10B981 (safety green)', '#F59E0B (caution yellow)', '#FFFFFF (white)'],
    heroTheme: 'Safe driving, confidence on the road, professional instruction, freedom',
    logoStyle: 'Professional, trustworthy, modern with automotive elements',
    fallbackHero: 'https://images.unsplash.com/photo-1449965408869-ebd3fee56a58?w=1920&q=80',
  },
  driving: {
    symbols: ['steering wheel', 'car', 'road', 'traffic light', 'license'],
    colors: ['#1E40AF (trust blue)', '#10B981 (safety green)', '#F59E0B (caution yellow)', '#FFFFFF (white)'],
    heroTheme: 'Safe driving, confidence on the road, professional instruction, freedom',
    logoStyle: 'Professional, trustworthy, modern with automotive elements',
    fallbackHero: 'https://images.unsplash.com/photo-1449965408869-ebd3fee56a58?w=1920&q=80',
  },
  tutoring: {
    symbols: ['graduation cap', 'book', 'lightbulb', 'pencil', 'brain'],
    colors: ['#1E3A8A (navy blue)', '#10B981 (emerald)', '#F59E0B (amber)', '#6366F1 (indigo)'],
    heroTheme: 'Academic success, bright futures, focused learning environment',
    logoStyle: 'Professional yet approachable, conveys expertise and trust',
    fallbackHero: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80',
  },
  education: {
    symbols: ['graduation cap', 'open book', 'apple', 'lightbulb'],
    colors: ['#1E40AF (royal blue)', '#059669 (green)', '#DC2626 (red accent)', '#F8FAFC (white)'],
    heroTheme: 'Knowledge, growth, academic achievement',
    logoStyle: 'Academic, trustworthy, inspiring',
    fallbackHero: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80',
  },
  photography: {
    symbols: ['camera lens', 'aperture', 'shutter', 'light burst'],
    colors: ['#1F2937 (charcoal)', '#D4AF37 (gold)', '#FFFFFF (white)', '#374151 (gray)'],
    heroTheme: 'Artistic, creative, capturing moments',
    logoStyle: 'Elegant, artistic, premium feel',
    fallbackHero: 'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=1920&q=80',
  },
  dental: {
    symbols: ['tooth', 'smile', 'dental mirror', 'shield'],
    colors: ['#0EA5E9 (dental blue)', '#22C55E (fresh green)', '#FFFFFF (white)', '#E0F2FE (light blue)'],
    heroTheme: 'Clean, trustworthy, modern healthcare, bright smiles',
    logoStyle: 'Professional, clean, medical yet friendly',
    fallbackHero: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1920&q=80',
  },
  restaurant: {
    symbols: ['fork and knife', 'chef hat', 'plate', 'flame'],
    colors: ['#DC2626 (appetizing red)', '#F59E0B (warm gold)', '#1F2937 (elegant dark)', '#FEF3C7 (cream)'],
    heroTheme: 'Delicious food, warm atmosphere, culinary excellence',
    logoStyle: 'Appetizing, warm, inviting',
    fallbackHero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80',
  },
  salon: {
    symbols: ['scissors', 'hair strand', 'mirror', 'brush'],
    colors: ['#EC4899 (pink)', '#A855F7 (purple)', '#1F2937 (black)', '#FDF2F8 (blush)'],
    heroTheme: 'Beauty, elegance, self-care, transformation',
    logoStyle: 'Elegant, trendy, luxury',
    fallbackHero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80',
  },
  fitness: {
    symbols: ['dumbbell', 'running figure', 'heart rate', 'flame'],
    colors: ['#EF4444 (energetic red)', '#1F2937 (power black)', '#F97316 (orange)', '#FFFFFF (white)'],
    heroTheme: 'Energy, strength, transformation, motivation',
    logoStyle: 'Bold, dynamic, powerful',
    fallbackHero: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80',
  },
  legal: {
    symbols: ['scales of justice', 'gavel', 'pillar', 'shield'],
    colors: ['#1E3A8A (navy)', '#B45309 (gold/bronze)', '#1F2937 (charcoal)', '#F8FAFC (white)'],
    heroTheme: 'Trust, authority, justice, professionalism',
    logoStyle: 'Authoritative, trustworthy, classic',
    fallbackHero: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80',
  },
  realestate: {
    symbols: ['house', 'key', 'building', 'roof'],
    colors: ['#1E40AF (trust blue)', '#059669 (growth green)', '#B45309 (warm gold)', '#FFFFFF (white)'],
    heroTheme: 'Dream homes, new beginnings, community, investment',
    logoStyle: 'Professional, trustworthy, aspirational',
    fallbackHero: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80',
  },
  default: {
    symbols: ['abstract geometric shape', 'professional icon'],
    colors: ['#3B82F6 (blue)', '#1F2937 (charcoal)', '#10B981 (green)', '#F8FAFC (white)'],
    heroTheme: 'Professional, modern, trustworthy',
    logoStyle: 'Clean, modern, professional',
    fallbackHero: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
  },
};

/**
 * Build design context from research and extracted info
 */
function buildDesignContext(
  industry: string,
  research?: IndustryResearch | null,
  extractedInfo?: ExtractedBusinessInfo
): {
  colors: string[];
  symbols: string[];
  heroTheme: string;
  logoStyle: string;
  services: string[];
  location?: string;
  stylePreference?: string;
  fallbackHero: string;
} {
  // Get industry-specific defaults - try multiple variations
  const industryLower = industry.toLowerCase();
  const guide = INDUSTRY_DESIGN_GUIDES[industryLower]
    || INDUSTRY_DESIGN_GUIDES[industryLower.replace(' school', '')]
    || INDUSTRY_DESIGN_GUIDES[industryLower.split(' ')[0]]
    || INDUSTRY_DESIGN_GUIDES.default;

  // Merge with research recommendations
  const colors = research?.colorRecommendations?.length
    ? research.colorRecommendations
    : guide.colors;

  return {
    colors,
    symbols: guide.symbols,
    heroTheme: research?.designTrends || guide.heroTheme,
    logoStyle: guide.logoStyle,
    services: extractedInfo?.services || research?.typicalServices || [],
    location: extractedInfo?.location,
    stylePreference: extractedInfo?.stylePreference,
    fallbackHero: guide.fallbackHero,
  };
}

/**
 * Generate essential website assets with strict timeouts
 * OPTIMIZED: Only generates logo + hero to stay under Vercel's 120s limit
 * Now includes research context for better, more relevant images
 */
export async function generateWebsiteAssets(
  businessName: string,
  industry: string,
  imageModel: string,
  research?: IndustryResearch | null,
  extractedInfo?: ExtractedBusinessInfo
): Promise<WebsiteAssets> {
  console.log('[WebsitePipeline] Generating essential website assets (fast mode)...');

  const assets: WebsiteAssets = {
    sectionImages: {},
    teamAvatars: [],
  };

  // Build design context from research
  const designContext = buildDesignContext(industry, research, extractedInfo);

  // FAST MODE: Only generate logo and hero in parallel with 30s timeout each
  // This keeps total asset generation under 35 seconds
  const ASSET_TIMEOUT = 30000; // 30 seconds max per asset

  console.log('[WebsitePipeline] Starting logo + hero generation (30s timeout each)...');
  const startTime = Date.now();

  const essentialAssets = await Promise.allSettled([
    // Logo is most important - it brands the site
    withTimeout(
      generateLogo(businessName, industry, imageModel, designContext),
      ASSET_TIMEOUT,
      null
    ),
    // Hero background adds visual impact
    withTimeout(
      generateHeroBackground(businessName, industry, imageModel, designContext),
      ASSET_TIMEOUT,
      null
    ),
  ]);

  const assetTime = Date.now() - startTime;
  console.log(`[WebsitePipeline] Asset generation completed in ${assetTime}ms`);

  // Process results
  if (essentialAssets[0].status === 'fulfilled' && essentialAssets[0].value) {
    assets.logo = essentialAssets[0].value;
    // Use logo as favicon too (simple approach)
    assets.favicon32 = essentialAssets[0].value;
    assets.favicon16 = essentialAssets[0].value;
    assets.faviconApple = essentialAssets[0].value;
    console.log('[WebsitePipeline] ✓ Logo generated (also used as favicon)');
  } else {
    // FALLBACK: Generate an SVG text logo when image generation fails
    console.log('[WebsitePipeline] ✗ Logo generation failed, using SVG text fallback');
    const primaryColor = designContext.colors[0]?.match(/#[A-Fa-f0-9]{6}/)?.[0] || '#1E40AF';
    const svgLogo = generateSVGTextLogo(businessName, primaryColor);
    assets.logo = svgLogo;
    assets.favicon32 = svgLogo;
    assets.favicon16 = svgLogo;
    assets.faviconApple = svgLogo;
  }

  if (essentialAssets[1].status === 'fulfilled' && essentialAssets[1].value) {
    assets.heroBackground = essentialAssets[1].value;
    console.log('[WebsitePipeline] ✓ Hero background generated');
  } else {
    // FALLBACK: Use high-quality Unsplash image for the industry
    console.log('[WebsitePipeline] ✗ Hero generation failed, using Unsplash fallback');
    assets.heroBackground = designContext.fallbackHero;
  }

  // SKIP section images and team avatars to stay fast
  // These can be added later via "enhance website" command
  console.log('[WebsitePipeline] Skipping secondary assets for speed (can enhance later)');

  return assets;
}

/**
 * Generate an SVG text-based logo when image generation fails
 * Creates a professional-looking logo with the business initials
 */
function generateSVGTextLogo(businessName: string, primaryColor: string): string {
  // Get initials (first letter of each word, max 2)
  const words = businessName.split(/\s+/).filter(w => w.length > 0);
  const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join('');

  // Create SVG logo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(primaryColor, -30)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="56" height="56" rx="12" fill="url(#grad)"/>
  <text x="30" y="42" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
  <text x="70" y="38" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${primaryColor}">${businessName}</text>
</svg>`;

  // Convert to base64 data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Adjust color brightness (positive = lighter, negative = darker)
 */
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

async function generateLogo(
  businessName: string,
  industry: string,
  model: string,
  designContext?: {
    colors: string[];
    symbols: string[];
    logoStyle: string;
    stylePreference?: string;
  }
): Promise<string | null> {
  // Build industry-aware prompt
  const symbolHints = designContext?.symbols?.slice(0, 3).join(', ') || 'professional icon';
  const colorHints = designContext?.colors?.slice(0, 2).join(' or ') || 'professional colors';
  const styleHint = designContext?.stylePreference || designContext?.logoStyle || 'modern and professional';

  const prompt = `Professional logo design for "${businessName}" - a ${industry} business.

DESIGN DIRECTION:
- Style: ${styleHint}
- Icon inspiration: ${symbolHints} (choose ONE that best represents the business)
- Color palette: Use ${colorHints}

REQUIREMENTS:
- Clean, modern design that works at any size
- Works on BOTH dark and light backgrounds
- Include the business name "${businessName}" in stylized typography
- ${industry}-appropriate imagery or iconography
- Premium quality ($1000+ agency design)
- NO clipart or generic icons - unique and memorable

Create a logo that immediately communicates: "This is a trusted ${industry} business."`;

  try {
    const result = await createGeminiImageGeneration({
      prompt,
      systemPrompt: `You are an elite logo designer who creates $5000+ logos for Fortune 500 companies.
Your logos are clean, memorable, and perfectly capture the essence of each brand.
For ${industry} businesses, you understand what builds trust and attracts customers.`,
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
  model: string,
  designContext?: {
    colors: string[];
    heroTheme: string;
    services: string[];
    location?: string;
    stylePreference?: string;
  }
): Promise<string | null> {
  // Build contextual prompt
  const themeHint = designContext?.heroTheme || 'professional and trustworthy';
  const colorHints = designContext?.colors?.slice(0, 2).join(' and ') || 'professional blue tones';
  const servicesHint = designContext?.services?.length
    ? `Services: ${designContext.services.slice(0, 3).join(', ')}`
    : '';
  const locationHint = designContext?.location ? `Location: ${designContext.location}` : '';

  const prompt = `Hero section background image for "${businessName}" - a ${industry} business website.

VISUAL THEME: ${themeHint}
${servicesHint}
${locationHint}

COLOR DIRECTION:
- Primary colors: ${colorHints}
- Create a cohesive color palette that matches the brand

COMPOSITION REQUIREMENTS:
- Wide panoramic aspect ratio (16:9)
- Subtle enough for WHITE TEXT OVERLAY (very important!)
- Left side should be slightly darker for text placement
- NOT too busy - elegant negative space
- High-end, premium feel ($10,000+ website quality)
- ${industry}-appropriate imagery

TECHNICAL:
- High resolution, sharp details
- Subtle gradient or vignette to help text readability
- NO text or watermarks in the image
- Professional stock photo quality or better`;

  try {
    const result = await createGeminiImageGeneration({
      prompt,
      systemPrompt: `You create stunning hero backgrounds for premium websites.
Your images are the quality of $50,000 brand photoshoots.
For ${industry}: convey ${themeHint}.
CRITICAL: The image must work with white text overlay - ensure proper contrast.`,
      model,
    });
    return result ? `data:${result.mimeType};base64,${result.imageData}` : null;
  } catch (err) {
    console.log('[WebsitePipeline] Hero background generation failed:', err);
    return null;
  }
}

// ============================================================================
// Website HTML Generation
// ============================================================================

/**
 * Generate the complete website HTML with all assets integrated
 * Enhanced with industry research for richer, more relevant content
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

  // Build industry research context section
  const researchSection = buildResearchSection(context);

  // Build extracted info section
  const extractedInfoSection = buildExtractedInfoSection(context);

  // Build business model section - THE SECRET SAUCE with structured data
  const businessModelSection = buildBusinessModelSection(context);

  const systemPrompt = `You are FORGE & MUSASHI - the most elite web development AI team ever created.
You build websites that make $15,000+ agencies jealous.

BUSINESS CONTEXT:
- Business Name: "${context.businessName}"
- Industry: ${context.industry}
- User Request: "${context.userPrompt}"
${extractedInfoSection}
${researchSection}
${brandContextSection}
${businessModelSection}
AVAILABLE ASSETS (already generated, use these exact URLs):
${assetContext}

YOUR MISSION: Create a COMPLETE, STUNNING, PRODUCTION-READY website that is SPECIFIC to this business.

CRITICAL RULES:
1. Use the EXACT asset URLs provided above - they are valid data URLs
2. Build a COMPLETE HTML document with <!DOCTYPE html>
3. Include ALL CSS inline in <style> tags
4. Include ALL JavaScript inline in <script> tags
5. Make it FULLY RESPONSIVE (mobile-first)
6. Add smooth animations and transitions
7. Make it look like a $10,000+ website
8. USE THE RESEARCH DATA - make content specific to this industry and location

REQUIRED SECTIONS (customize based on industry research):
1. HEADER/NAV - Sticky, with logo (use provided), menu, CTA button, hamburger for mobile
2. HERO - Powerful headline using KEY MESSAGES from research, subheadline, CTAs, hero background
3. SERVICES - Use SPECIFIC services from research/extracted info (not generic placeholders)
4. PRICING - Use pricing insights from research OR user-provided rates
5. ABOUT - Company story, location if provided, target audience
6. TESTIMONIALS - 3 realistic reviews SPECIFIC to ${context.industry} services
7. FAQ - 5-6 REAL questions that ${context.industry} customers ask
8. CONTACT - Form, contact info (use provided email/phone), location, hours
9. FOOTER - Links, social icons, newsletter, copyright

CONTENT SPECIFICITY RULES:
- NEVER use generic placeholder text like "Lorem ipsum" or "Service 1"
- Use the ACTUAL services mentioned (e.g., "SAT Prep", "College Counseling", not "Service A")
- Include the ACTUAL location in content (e.g., "Serving Hicksville, Long Island")
- Use REAL pricing if provided (e.g., "$50/hour tutoring sessions")
- Reference the TARGET AUDIENCE (e.g., "helping high school students succeed")

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
- LIGHT/WHITE base background (body background: #ffffff or very light gray)
- Dark text on light backgrounds for readability
- Use the COLOR RECOMMENDATIONS from research if available
- Modern glassmorphism (backdrop-blur on nav/cards)
- Subtle gradients and shadows
- Micro-animations on hover
- Consistent 8px spacing grid
- Beautiful typography hierarchy

CRITICAL COLOR RULES:
- body { background-color: #ffffff; color: #1a1a1a; }
- Sections can have colored backgrounds, but ensure contrast
- NO fully dark/black pages - users need to see content
- Hero can be darker with light text, rest of page should be light

🚨 ABSOLUTELY FORBIDDEN - DO NOT DO THESE:
- NEVER use emoji as image placeholders (no 📷, 🖼️, 👤, etc.)
- NEVER use empty divs where images should go
- NEVER use "Coming Soon" or "Image Here" placeholders
- NEVER leave any section incomplete or stubbed out
- NEVER use non-functional buttons or links (all must work)

FOR IMAGES:
- Use the provided asset URLs (logo, hero background)
- For any additional images, use professional Unsplash URLs:
  - Team photos: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop (vary the photo ID)
  - Service images: Use relevant Unsplash URLs for the industry
- For icons, use inline SVG icons (heroicons style) - NOT emoji
- Example inline SVG: <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">...</svg>

INTERACTIVITY REQUIREMENTS (ALL MUST WORK):
- Navigation links must smooth-scroll to sections with scroll-behavior: smooth
- Mobile hamburger menu MUST toggle open/close with JavaScript
- All buttons must have hover effects (transform, shadow, color change)
- Form must have client-side validation and show success message
- Cards should have hover lift effect (translateY + shadow)
- Add scroll-triggered fade-in animations using IntersectionObserver

MOBILE MENU JAVASCRIPT (INCLUDE THIS):
\`\`\`
const menuBtn = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-menu');
menuBtn?.addEventListener('click', () => {
  nav?.classList.toggle('active');
  menuBtn?.classList.toggle('active');
});
\`\`\`

OUTPUT: Raw HTML only. No markdown. No code blocks. Complete document.`;

  // Helper function to build research section
  function buildResearchSection(ctx: GenerationContext): string {
    if (!ctx.industryResearch) return '';

    const r = ctx.industryResearch;
    let section = '\n📊 INDUSTRY RESEARCH (USE THIS DATA):\n';

    if (r.industryOverview) {
      section += `Industry Overview: ${r.industryOverview}\n`;
    }
    if (r.typicalServices?.length) {
      section += `Typical Services: ${r.typicalServices.join(', ')}\n`;
    }
    if (r.pricingInsights) {
      section += `Pricing Insights: ${r.pricingInsights}\n`;
    }
    if (r.locationContext) {
      section += `Local Market: ${r.locationContext}\n`;
    }
    if (r.designTrends) {
      section += `Design Trends: ${r.designTrends}\n`;
    }
    if (r.colorRecommendations?.length) {
      section += `Recommended Colors: ${r.colorRecommendations.join(', ')}\n`;
    }
    if (r.keyMessages?.length) {
      section += `Key Marketing Messages:\n${r.keyMessages.map(m => `  - ${m}`).join('\n')}\n`;
    }

    return section;
  }

  // Helper function to build extracted info section
  function buildExtractedInfoSection(ctx: GenerationContext): string {
    if (!ctx.extractedInfo) return '';

    const e = ctx.extractedInfo;
    let section = '\n🏢 BUSINESS DETAILS (EXTRACTED):\n';

    if (e.services?.length) {
      section += `Services Offered: ${e.services.join(', ')}\n`;
    }
    if (e.location) {
      section += `Location: ${e.location}\n`;
    }
    if (e.pricing) {
      section += `Pricing: ${e.pricing}\n`;
    }
    if (e.email) {
      section += `Email: ${e.email}\n`;
    }
    if (e.phone) {
      section += `Phone: ${e.phone}\n`;
    }
    if (e.targetAudience) {
      section += `Target Audience: ${e.targetAudience}\n`;
    }
    if (e.stylePreference) {
      section += `Style Preference: ${e.stylePreference}\n`;
    }

    return section;
  }

  // Helper function to build business model section - THE SECRET SAUCE
  function buildBusinessModelSection(ctx: GenerationContext): string {
    if (!ctx.businessModel) return '';

    const bm = ctx.businessModel;
    let section = '\n💎 GENERATED BUSINESS MODEL (USE THIS EXACT DATA):\n';
    section += '=' .repeat(60) + '\n';

    // Tagline and pitch
    section += `\nTAGLINE: "${bm.tagline}"\n`;
    section += `ELEVATOR PITCH: ${bm.elevatorPitch}\n`;
    section += `UNIQUE VALUE: ${bm.uniqueValueProposition}\n`;

    // Pricing tiers - CRITICAL: Use these exact tiers
    if (bm.pricingTiers.length > 0) {
      section += `\n💰 PRICING TIERS (CREATE PRICING SECTION WITH THESE EXACT TIERS):\n`;
      bm.pricingTiers.forEach((tier, i) => {
        section += `\nTier ${i + 1}: ${tier.name}${tier.highlighted ? ' ⭐ FEATURED' : ''}\n`;
        section += `  Price: ${tier.price}${tier.period ? ` ${tier.period}` : ''}\n`;
        section += `  Description: ${tier.description}\n`;
        section += `  Features:\n`;
        tier.features.forEach(f => section += `    ✓ ${f}\n`);
        section += `  Button: "${tier.ctaText}"\n`;
      });
    }

    // Services
    if (bm.services.length > 0) {
      section += `\n🛠️ SERVICES (CREATE SERVICES SECTION WITH THESE):\n`;
      bm.services.forEach((svc, i) => {
        section += `\nService ${i + 1}: ${svc.name}\n`;
        section += `  Description: ${svc.description}\n`;
        if (svc.price) section += `  Price: ${svc.price}\n`;
        if (svc.duration) section += `  Duration: ${svc.duration}\n`;
        section += `  Features: ${svc.features.join(', ')}\n`;
        if (svc.icon) section += `  Icon suggestion: ${svc.icon}\n`;
      });
    }

    // Testimonials
    if (bm.testimonials.length > 0) {
      section += `\n⭐ TESTIMONIALS (USE THESE EXACT TESTIMONIALS):\n`;
      bm.testimonials.forEach((t, i) => {
        section += `\nTestimonial ${i + 1}:\n`;
        section += `  Name: ${t.name}\n`;
        section += `  Role: ${t.role}\n`;
        if (t.location) section += `  Location: ${t.location}\n`;
        section += `  Quote: "${t.quote}"\n`;
        section += `  Rating: ${'⭐'.repeat(t.rating)}\n`;
        if (t.avatar) section += `  Avatar URL: ${t.avatar}\n`;
      });
    }

    // Stats
    if (bm.stats && bm.stats.length > 0) {
      section += `\n📊 STATS (DISPLAY THESE IN STATS SECTION):\n`;
      bm.stats.forEach(s => section += `  ${s.value} - ${s.label}\n`);
    }

    // FAQs
    if (bm.faqs.length > 0) {
      section += `\n❓ FAQs (CREATE FAQ SECTION WITH THESE EXACT Q&As):\n`;
      bm.faqs.forEach((faq, i) => {
        section += `\nQ${i + 1}: ${faq.question}\n`;
        section += `A: ${faq.answer}\n`;
      });
    }

    // About content
    section += `\n📖 ABOUT CONTENT:\n`;
    section += `Story: ${bm.aboutContent.story}\n`;
    if (bm.aboutContent.values.length > 0) {
      section += `Values: ${bm.aboutContent.values.join(', ')}\n`;
    }
    if (bm.aboutContent.teamDescription) {
      section += `Team: ${bm.aboutContent.teamDescription}\n`;
    }

    // Contact info
    section += `\n📞 CONTACT INFO:\n`;
    if (bm.contactInfo.email) section += `  Email: ${bm.contactInfo.email}\n`;
    if (bm.contactInfo.phone) section += `  Phone: ${bm.contactInfo.phone}\n`;
    if (bm.contactInfo.address) section += `  Address: ${bm.contactInfo.address}\n`;
    if (bm.contactInfo.hours) {
      section += `  Hours:\n`;
      bm.contactInfo.hours.forEach(h => section += `    ${h.days}: ${h.hours}\n`);
    }

    // SEO
    section += `\n🔍 SEO:\n`;
    section += `  Title: ${bm.seoTitle}\n`;
    section += `  Description: ${bm.seoDescription}\n`;
    section += `  Keywords: ${bm.keywords.join(', ')}\n`;

    section += '\n' + '='.repeat(60) + '\n';
    section += 'CRITICAL: Use the EXACT data above. Do NOT make up different prices, services, or testimonials.\n';

    return section;
  }

  const result = await createGeminiCompletion({
    messages: [{ role: 'user', content: context.userPrompt }],
    tool: 'code' as ToolType,
    systemPrompt,
    userId: context.existingSession?.userId || 'system',
    model: geminiModel,
  });

  let html = result.text || '';

  // CRITICAL: Log raw response for debugging
  console.log('[WebsitePipeline] Raw Gemini response length:', html.length);
  console.log('[WebsitePipeline] Response starts with:', html.substring(0, 200));

  // Validate that we got actual HTML content
  const hasHtmlContent = html.includes('<body') || html.includes('<div') || html.includes('<section') || html.includes('<header');
  const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<html');

  if (!html || html.length < 500 || (!hasHtmlContent && !hasDoctype)) {
    console.error('[WebsitePipeline] ⚠️ INVALID RESPONSE FROM GEMINI - generating fallback');
    console.error('[WebsitePipeline] Response preview:', html.substring(0, 500));

    // Generate a fallback website
    html = generateFallbackWebsite(context.businessName, context.industry, assets);
  }

  // Clean up the HTML
  html = cleanGeneratedHtml(html);

  // Validate again after cleaning
  if (!validateHtmlHasContent(html)) {
    console.error('[WebsitePipeline] ⚠️ HTML still empty after cleaning - using fallback');
    html = generateFallbackWebsite(context.businessName, context.industry, assets);
  }

  // Inject any missing assets
  html = injectMissingAssets(html, assets, context.businessName);

  console.log('[WebsitePipeline] Final HTML length:', html.length);
  console.log('[WebsitePipeline] HTML body check:', html.includes('<body') ? 'OK' : 'MISSING');

  return html;
}

/**
 * Validate that HTML has actual body content
 */
function validateHtmlHasContent(html: string): boolean {
  // Check for body tag with content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;

  const bodyContent = bodyMatch[1].trim();
  // Body should have at least 100 chars of actual content
  return bodyContent.length > 100;
}

/**
 * Generate a fallback website when AI fails
 */
function generateFallbackWebsite(businessName: string, industry: string, assets: WebsiteAssets): string {
  console.log('[WebsitePipeline] Generating fallback website for:', businessName);

  const logoImg = assets.logo ? `<img src="${assets.logo}" alt="${businessName}" style="max-height: 60px; width: auto;">` : `<h1 style="margin: 0; font-size: 1.5rem; font-weight: bold;">${businessName}</h1>`;
  const heroStyle = assets.heroBackground
    ? `background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${assets.heroBackground}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - ${industry}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${assets.favicon32 ? `<link rel="icon" type="image/png" href="${assets.favicon32}">` : ''}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #ffffff; }

    /* Navigation */
    nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(0,0,0,0.1); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    nav a { color: inherit; text-decoration: none; }
    .nav-menu { display: flex; gap: 2rem; list-style: none; }
    .nav-menu li a { color: #555; font-weight: 500; transition: color 0.3s; }
    .nav-menu li a:hover { color: #8b5cf6; }
    .desktop-cta { display: block; }
    .cta-btn { background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); color: white; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; transition: transform 0.2s, box-shadow 0.2s; }
    .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3); }

    /* Hero */
    .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: white; padding: 2rem; ${heroStyle} }
    .hero h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 1rem; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
    .hero p { font-size: 1.25rem; max-width: 600px; margin-bottom: 2rem; opacity: 0.9; }
    .hero-buttons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
    .hero-buttons .cta-btn { font-size: 1.1rem; padding: 1rem 2rem; }
    .secondary-btn { background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 2px solid white; }

    /* Sections */
    section { padding: 5rem 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h2 { font-size: 2.5rem; font-weight: 700; text-align: center; margin-bottom: 3rem; }

    /* Services */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    .service-card { background: #f8fafc; border-radius: 16px; padding: 2rem; text-align: center; transition: transform 0.3s, box-shadow 0.3s; }
    .service-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .service-card .icon { margin-bottom: 1rem; display: flex; justify-content: center; }
    .service-card h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .service-card p { color: #666; }

    /* About */
    .about { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); }
    .about-content { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
    .about-text h2 { text-align: left; }
    .about-text p { color: #555; margin-bottom: 1rem; }
    .about-image { border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.15); }
    .about-image img { width: 100%; height: auto; }

    /* Contact */
    .contact { background: #1a1a2e; color: white; }
    .contact h2 { color: white; }
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
    .contact-form { background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 16px; }
    .contact-form input, .contact-form textarea { width: 100%; padding: 1rem; margin-bottom: 1rem; border: none; border-radius: 8px; background: rgba(255,255,255,0.9); font-family: inherit; }
    .contact-form textarea { min-height: 150px; resize: vertical; }
    .contact-form button { width: 100%; }
    .contact-info h3 { font-size: 1.5rem; margin-bottom: 1.5rem; }
    .contact-info p { color: rgba(255,255,255,0.8); margin-bottom: 1rem; }

    /* Footer */
    footer { background: #0f0f1a; color: rgba(255,255,255,0.6); padding: 3rem 2rem; text-align: center; }
    footer p { margin-bottom: 1rem; }
    footer a { color: #8b5cf6; }

    /* Mobile Menu */
    .menu-toggle { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 10px; z-index: 101; }
    .menu-toggle span { display: block; width: 25px; height: 3px; background: #333; border-radius: 3px; transition: all 0.3s ease; }
    .menu-toggle.active span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
    .menu-toggle.active span:nth-child(2) { opacity: 0; }
    .menu-toggle.active span:nth-child(3) { transform: rotate(-45deg) translate(7px, -6px); }

    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 { font-size: 2.5rem; }
      .menu-toggle { display: flex; }
      .desktop-cta { display: none; }
      .nav-menu {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        background: white;
        padding: 1rem;
        gap: 0;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      }
      .nav-menu.active { display: flex; }
      .nav-menu li { padding: 0.75rem 0; border-bottom: 1px solid #eee; }
      .nav-menu li:last-child { border-bottom: none; }
      .about-content, .contact-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    ${logoImg}
    <button class="menu-toggle" aria-label="Toggle menu">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <ul class="nav-menu">
      <li><a href="#services">Services</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
    <a href="#contact" class="cta-btn desktop-cta">Get Started</a>
  </nav>

  <!-- Hero Section -->
  <section class="hero">
    <h1>Welcome to ${businessName}</h1>
    <p>Your trusted partner in ${industry}. We deliver excellence, innovation, and results that exceed expectations.</p>
    <div class="hero-buttons">
      <a href="#contact" class="cta-btn">Get a Free Quote</a>
      <a href="#services" class="cta-btn secondary-btn">Our Services</a>
    </div>
  </section>

  <!-- Services Section -->
  <section id="services">
    <div class="container">
      <h2>Our Services</h2>
      <div class="services-grid">
        <div class="service-card">
          <div class="icon">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:48px;height:48px;color:#8b5cf6;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h3>Premium Service</h3>
          <p>Experience top-tier ${industry} solutions tailored to your unique needs.</p>
        </div>
        <div class="service-card">
          <div class="icon">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:48px;height:48px;color:#8b5cf6;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3>Expert Consultation</h3>
          <p>Get personalized advice from our team of industry experts.</p>
        </div>
        <div class="service-card">
          <div class="icon">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:48px;height:48px;color:#8b5cf6;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <h3>Fast Delivery</h3>
          <p>We pride ourselves on quick turnaround without compromising quality.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- About Section -->
  <section id="about" class="about">
    <div class="container about-content">
      <div class="about-text">
        <h2>About ${businessName}</h2>
        <p>We are a dedicated team of ${industry} professionals committed to delivering exceptional results for our clients.</p>
        <p>With years of experience and a passion for excellence, we've helped countless customers achieve their goals.</p>
        <p>Our mission is to provide the highest quality service while building lasting relationships with our clients.</p>
      </div>
      <div class="about-image">
        ${assets.sectionImages.about
          ? `<img src="${assets.sectionImages.about}" alt="About ${businessName}">`
          : `<img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop" alt="Our team at work" style="width:100%;height:auto;border-radius:16px;">`}
      </div>
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="contact">
    <div class="container contact-grid">
      <div class="contact-form">
        <h3 style="color: white; margin-bottom: 1.5rem;">Send Us a Message</h3>
        <form onsubmit="event.preventDefault(); alert('Thank you! We\\'ll be in touch soon.');">
          <input type="text" name="name" placeholder="Your Name" required>
          <input type="email" name="email" placeholder="Your Email" required>
          <input type="tel" name="phone" placeholder="Your Phone">
          <textarea name="message" placeholder="How can we help you?" required></textarea>
          <button type="submit" class="cta-btn" style="border: none; cursor: pointer; font-size: 1rem;">Send Message</button>
        </form>
      </div>
      <div class="contact-info">
        <h3>Get in Touch</h3>
        <p>📍 Contact us for location details</p>
        <p>📞 Call us for immediate assistance</p>
        <p>✉️ Email us anytime</p>
        <p>🕐 We're here to help!</p>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
      <p>Built with ❤️ by FORGE & MUSASHI</p>
    </div>
  </footer>

  <script>
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    menuToggle?.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu?.classList.toggle('active');
    });

    // Close menu when clicking a link
    navMenu?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle?.classList.remove('active');
        navMenu?.classList.remove('active');
      });
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  </script>
</body>
</html>`;
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

  // CRITICAL: Force visible background - inject base styles if not present
  // This ensures the website is always visible, not black
  const forceVisibleStyles = `
    <style id="force-visible-styles">
      html, body {
        background-color: #ffffff !important;
        min-height: 100vh;
      }
      body:empty::before {
        content: 'Loading website...';
        display: block;
        padding: 20px;
        color: #666;
      }
    </style>
  `;

  // Inject force-visible styles right after <head> or at start of document
  if (html.includes('<head>') && !html.includes('force-visible-styles')) {
    html = html.replace('<head>', '<head>' + forceVisibleStyles);
  } else if (!html.includes('force-visible-styles')) {
    html = forceVisibleStyles + html;
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

/**
 * Detect which section the user wants to edit
 * Returns the section type for smart business model updates
 */
export function detectEditSection(text: string): 'pricing' | 'services' | 'testimonials' | 'faqs' | 'about' | 'contact' | 'general' {
  const lowerText = text.toLowerCase();

  // Pricing section detection
  if (/\b(pric(e|ing|es)|cost|rate|tier|package|plan|fee|\$\d+|dollar|per\s*(hour|session|month))\b/i.test(lowerText)) {
    return 'pricing';
  }

  // Services section detection
  if (/\b(service|offering|feature|what\s*(we|you)\s*offer|product)\b/i.test(lowerText)) {
    return 'services';
  }

  // Testimonials section detection
  if (/\b(testimonial|review|quote|customer\s*say|feedback|rating)\b/i.test(lowerText)) {
    return 'testimonials';
  }

  // FAQ section detection
  if (/\b(faq|question|answer|q\s*&\s*a)\b/i.test(lowerText)) {
    return 'faqs';
  }

  // About section detection
  if (/\b(about|story|mission|team|who\s*we\s*are|company|history)\b/i.test(lowerText)) {
    return 'about';
  }

  // Contact section detection
  if (/\b(contact|email|phone|address|location|hours|reach\s*us)\b/i.test(lowerText)) {
    return 'contact';
  }

  return 'general';
}

/**
 * Smart section-level website modification
 * Uses business model for intelligent updates when possible
 */
export async function applySmartModification(
  session: WebsiteSession,
  userFeedback: string,
  geminiModel: string
): Promise<{ success: boolean; html: string; changesDescription: string; updatedSection?: string }> {
  console.log('[WebsitePipeline] Applying smart modification...');

  const section = detectEditSection(userFeedback);
  console.log(`[WebsitePipeline] Detected section for edit: ${section}`);

  // If we have a business model and it's a content section, update the model first
  if (session.businessModel && section !== 'general') {
    console.log('[WebsitePipeline] Using business model for smart update');

    try {
      const { updateBusinessModelSection } = await import('./businessModelGenerator');
      const updatedModel = await updateBusinessModelSection(
        session.businessModel,
        section,
        userFeedback,
        geminiModel
      );

      session.businessModel = updatedModel;
      console.log(`[WebsitePipeline] Business model ${section} section updated`);

      // Now regenerate HTML with updated model
      const context: GenerationContext = {
        businessName: session.businessName,
        industry: session.industry,
        userPrompt: session.originalPrompt,
        businessModel: updatedModel,
      };

      const html = await generateWebsiteHtml(context, session.assets, geminiModel);

      // Create iteration record
      const iteration: WebsiteIteration = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        userFeedback,
        changesDescription: `Smart update to ${section}: ${userFeedback.substring(0, 80)}...`,
        previousHtml: session.currentHtml,
      };

      session.iterations.push(iteration);
      session.currentHtml = html;
      session.status = 'ready';
      await updateWebsiteSession(session);

      return {
        success: true,
        html,
        changesDescription: `Updated ${section} section with your changes`,
        updatedSection: section,
      };
    } catch (err) {
      console.error('[WebsitePipeline] Smart modification failed, falling back:', err);
      // Fall through to regular modification
    }
  }

  // Fallback to full HTML modification for general changes or if no business model
  return applyWebsiteModification(session, userFeedback, geminiModel);
}

// ============================================================================
// Main Pipeline Entry Point
// ============================================================================

/**
 * Generate a complete website with all assets
 * Enhanced with AI extraction and industry research
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

    // STEP 1: Extract business info with AI for better parsing
    console.log('[WebsitePipeline] Extracting business info with AI...');
    const extractedInfo = await extractBusinessInfoWithAI(context.userPrompt);
    context.extractedInfo = extractedInfo;

    // Update context with better extracted values
    if (extractedInfo.businessName && extractedInfo.businessName !== 'Business') {
      console.log(`[WebsitePipeline] AI extracted business name: "${extractedInfo.businessName}"`);
      context.businessName = extractedInfo.businessName;
    }
    if (extractedInfo.industry && extractedInfo.industry !== 'business') {
      context.industry = extractedInfo.industry;
    }

    // STEP 2: Research industry context with Perplexity (runs in parallel with brand fetch)
    console.log('[WebsitePipeline] Starting industry research...');
    const [research, brandContext] = await Promise.all([
      researchIndustryContext(
        context.businessName,
        context.industry,
        extractedInfo.location,
        extractedInfo.services
      ),
      fetchUserBrandContext(userId, context.businessName, context.industry),
    ]);

    // Store research in context
    if (research) {
      context.industryResearch = research;
      console.log('[WebsitePipeline] Industry research completed');
      console.log(`[WebsitePipeline] - Services found: ${research.typicalServices?.length || 0}`);
      console.log(`[WebsitePipeline] - Color recommendations: ${research.colorRecommendations?.length || 0}`);
    }

    // Store brand context
    if (brandContext.content) {
      context.userBrandContext = brandContext;
      console.log(`[WebsitePipeline] Found brand context from ${brandContext.documentNames.length} documents`);
    }

    // STEP 2.5: Generate Business Model (THE SECRET SAUCE)
    // This creates structured pricing, services, testimonials, FAQs using research
    console.log('[WebsitePipeline] Generating business model with competitive intelligence...');
    try {
      const businessModel = await generateBusinessModel({
        businessName: context.businessName,
        industry: context.industry,
        location: extractedInfo.location,
        services: extractedInfo.services,
        pricing: extractedInfo.pricing,
        email: extractedInfo.email,
        phone: extractedInfo.phone,
        targetAudience: extractedInfo.targetAudience,
        stylePreference: extractedInfo.stylePreference,
        additionalContext: context.userPrompt,
      }, geminiModel);

      context.businessModel = businessModel;
      console.log('[WebsitePipeline] Business model generated:');
      console.log(`[WebsitePipeline] - Pricing tiers: ${businessModel.pricingTiers.length}`);
      console.log(`[WebsitePipeline] - Services: ${businessModel.services.length}`);
      console.log(`[WebsitePipeline] - Testimonials: ${businessModel.testimonials.length}`);
      console.log(`[WebsitePipeline] - FAQs: ${businessModel.faqs.length}`);
    } catch (bmError) {
      console.error('[WebsitePipeline] Business model generation failed (non-fatal):', bmError);
      // Continue without business model - will fall back to generic content
    }

    // Create new session with updated context
    session = await createWebsiteSession(userId, context);
    console.log(`[WebsitePipeline] Created session: ${session.id}`);

    // Store business model in session for later editing
    if (context.businessModel) {
      session.businessModel = context.businessModel;
    }

    // STEP 3: Generate assets with research context
    console.log('[WebsitePipeline] Generating assets with industry context...');
    const assets = await generateWebsiteAssets(
      context.businessName,
      context.industry,
      imageModel,
      research,
      extractedInfo
    );
    session.assets = assets;

    // STEP 4: Generate the complete HTML with full context
    console.log('[WebsitePipeline] Generating HTML with research context...');
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
