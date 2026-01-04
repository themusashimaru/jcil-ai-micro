/**
 * FORGE & MUSASHI: Template RAG Service
 * =====================================
 *
 * The most comprehensive website template system ever built.
 * Makes Arnold look like he never lifted a weight.
 *
 * Features:
 * - 50+ professional templates for every business type
 * - AI-powered template selection
 * - Dynamic placeholder replacement
 * - Image slot injection for AI-generated assets
 * - Full responsive design (mobile, tablet, desktop)
 */

import { createServerClient } from '@/lib/supabase/client';

// Template category type (matches the database enum)
export type TemplateCategory =
  // Business & Professional
  | 'restaurant' | 'cafe' | 'bar' | 'food-truck' | 'catering'
  | 'salon' | 'spa' | 'barbershop' | 'beauty' | 'wellness'
  | 'gym' | 'fitness' | 'yoga' | 'martial-arts' | 'personal-trainer'
  | 'dental' | 'medical' | 'healthcare' | 'pharmacy' | 'veterinary'
  | 'law-firm' | 'accounting' | 'consulting' | 'financial' | 'insurance'
  | 'real-estate' | 'property' | 'construction' | 'architecture' | 'interior-design'
  | 'auto-detailing' | 'car-wash' | 'mechanic' | 'auto-dealer' | 'towing'
  | 'plumbing' | 'electrical' | 'hvac' | 'roofing' | 'landscaping'
  | 'cleaning' | 'maid-service' | 'pest-control' | 'moving' | 'storage'
  // Creative & Agency
  | 'agency' | 'marketing' | 'advertising' | 'pr' | 'branding'
  | 'photography' | 'videography' | 'film' | 'studio' | 'production'
  | 'design' | 'graphic-design' | 'ui-ux' | 'web-design' | 'illustration'
  | 'music' | 'band' | 'dj' | 'producer' | 'record-label'
  | 'art' | 'gallery' | 'artist' | 'sculptor' | 'painter'
  // Tech & SaaS
  | 'saas' | 'startup' | 'tech' | 'app' | 'software'
  | 'ai' | 'machine-learning' | 'data' | 'analytics' | 'cloud'
  | 'devtools' | 'api' | 'platform' | 'marketplace' | 'fintech'
  // E-commerce & Retail
  | 'ecommerce' | 'shop' | 'boutique' | 'fashion' | 'jewelry'
  | 'electronics' | 'furniture' | 'home-goods' | 'sports' | 'outdoor'
  // Events & Entertainment
  | 'wedding' | 'event-planning' | 'party' | 'venue'
  | 'entertainment' | 'comedy' | 'theater' | 'cinema' | 'gaming'
  // Education & Non-profit
  | 'education' | 'school' | 'tutoring' | 'online-course' | 'coaching'
  | 'nonprofit' | 'charity' | 'foundation' | 'church' | 'community'
  // Personal & Portfolio
  | 'portfolio' | 'resume' | 'personal-brand' | 'blog' | 'writer'
  | 'developer' | 'freelancer' | 'creator' | 'influencer' | 'podcast'
  // Other
  | 'landing-page' | 'coming-soon' | 'waitlist' | 'launch' | 'general';

export type DesignStyle =
  | 'modern' | 'minimal' | 'bold' | 'elegant' | 'playful'
  | 'corporate' | 'creative' | 'dark' | 'light' | 'colorful'
  | 'glassmorphism' | 'neumorphism' | 'brutalist' | 'retro' | 'futuristic';

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface WebsiteTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: TemplateCategory;
  subcategories: string[];
  tags: string[];
  style: DesignStyle;
  layout: string;
  color_scheme: ColorScheme;
  fonts: { heading: string; body: string };
  html_template: string;
  css_template: string;
  js_template: string;
  has_mobile: boolean;
  has_tablet: boolean;
  has_desktop: boolean;
  features: string[];
  sections: string[];
  placeholder_mappings: Record<string, string>;
  image_slots: Record<string, { description: string; size: string }>;
  customization_hints: string;
  thumbnail_url: string;
  preview_url: string;
  times_used: number;
  rating: number;
  is_active: boolean;
  is_premium: boolean;
}

export interface BusinessInfo {
  name: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  services?: string[];
  testimonials?: Array<{ name: string; text: string; role?: string }>;
  pricing?: Array<{ name: string; price: string; features: string[] }>;
  socialLinks?: Record<string, string>;
  ctaText?: string;
  ctaLink?: string;
}

/**
 * Category detection patterns for auto-categorizing user requests
 */
const CATEGORY_PATTERNS: Record<TemplateCategory, RegExp[]> = {
  // Restaurants & Food
  'restaurant': [/restaurant/i, /dining/i, /eatery/i, /bistro/i, /grill/i],
  'cafe': [/cafe/i, /coffee\s*shop/i, /coffee\s*house/i, /bakery/i],
  'bar': [/\bbar\b/i, /pub/i, /lounge/i, /nightclub/i, /tavern/i],
  'food-truck': [/food\s*truck/i, /street\s*food/i, /mobile\s*food/i],
  'catering': [/catering/i, /event\s*food/i, /private\s*chef/i],

  // Beauty & Wellness
  'salon': [/salon/i, /hair\s*salon/i, /nail/i, /beauty\s*salon/i],
  'spa': [/\bspa\b/i, /massage/i, /wellness\s*center/i, /relaxation/i],
  'barbershop': [/barber/i, /men'?s\s*grooming/i, /haircut/i],
  'beauty': [/beauty/i, /cosmetic/i, /makeup/i, /esthetic/i],
  'wellness': [/wellness/i, /holistic/i, /healing/i, /meditation/i],

  // Fitness
  'gym': [/\bgym\b/i, /fitness\s*center/i, /workout/i, /weight\s*training/i],
  'fitness': [/fitness/i, /exercise/i, /training/i, /crossfit/i],
  'yoga': [/yoga/i, /pilates/i, /stretching/i, /mindfulness/i],
  'martial-arts': [/martial\s*arts/i, /karate/i, /mma/i, /boxing/i, /jiu\s*jitsu/i],
  'personal-trainer': [/personal\s*train/i, /pt\b/i, /coach/i, /1-on-1\s*training/i],

  // Medical & Healthcare
  'dental': [/dental/i, /dentist/i, /orthodont/i, /teeth/i, /oral/i],
  'medical': [/medical/i, /clinic/i, /doctor/i, /physician/i, /healthcare/i],
  'healthcare': [/healthcare/i, /health\s*care/i, /patient/i, /medical\s*practice/i],
  'pharmacy': [/pharmacy/i, /drugstore/i, /prescription/i, /medication/i],
  'veterinary': [/vet/i, /animal\s*hospital/i, /pet\s*clinic/i, /animal\s*care/i],

  // Professional Services
  'law-firm': [/law\s*firm/i, /attorney/i, /lawyer/i, /legal/i, /litigation/i],
  'accounting': [/accounting/i, /accountant/i, /cpa\b/i, /bookkeeping/i, /tax/i],
  'consulting': [/consulting/i, /consultant/i, /advisory/i, /strategy/i],
  'financial': [/financial/i, /investment/i, /wealth/i, /finance\b/i, /advisor/i],
  'insurance': [/insurance/i, /coverage/i, /policy/i, /claims/i],

  // Real Estate & Construction
  'real-estate': [/real\s*estate/i, /realtor/i, /property\s*sales/i, /home\s*sales/i],
  'property': [/property/i, /apartment/i, /rental/i, /lease/i],
  'construction': [/construction/i, /contractor/i, /builder/i, /building/i],
  'architecture': [/architect/i, /design\s*firm/i, /structural/i],
  'interior-design': [/interior\s*design/i, /home\s*decor/i, /decorat/i],

  // Automotive
  'auto-detailing': [/auto\s*detail/i, /car\s*detail/i, /vehicle\s*detail/i, /ceramic\s*coat/i],
  'car-wash': [/car\s*wash/i, /auto\s*wash/i, /vehicle\s*wash/i],
  'mechanic': [/mechanic/i, /auto\s*repair/i, /car\s*repair/i, /garage/i],
  'auto-dealer': [/auto\s*dealer/i, /car\s*dealer/i, /vehicle\s*sales/i],
  'towing': [/towing/i, /tow\s*truck/i, /roadside/i],

  // Home Services
  'plumbing': [/plumb/i, /pipe/i, /drain/i, /water\s*heater/i],
  'electrical': [/electric/i, /wiring/i, /outlet/i, /electrician/i],
  'hvac': [/hvac/i, /heating/i, /cooling/i, /air\s*condition/i, /furnace/i],
  'roofing': [/roof/i, /shingle/i, /gutter/i],
  'landscaping': [/landscap/i, /lawn/i, /garden/i, /yard/i, /mowing/i],
  'cleaning': [/cleaning/i, /janitorial/i, /housekeep/i, /saniti/i],
  'maid-service': [/maid/i, /house\s*clean/i, /domestic/i],
  'pest-control': [/pest/i, /exterminator/i, /bug/i, /rodent/i],
  'moving': [/moving/i, /mover/i, /relocation/i, /hauling/i],
  'storage': [/storage/i, /warehouse/i, /self-storage/i],

  // Creative & Agency
  'agency': [/agency/i, /creative\s*agency/i, /digital\s*agency/i],
  'marketing': [/marketing/i, /seo\b/i, /digital\s*market/i, /growth/i],
  'advertising': [/advertis/i, /ads?\b/i, /campaign/i, /media\s*buy/i],
  'pr': [/\bpr\b/i, /public\s*relations/i, /press/i, /communications/i],
  'branding': [/brand/i, /identity/i, /logo\s*design/i],
  'photography': [/photo/i, /portrait/i, /headshot/i, /event\s*photo/i],
  'videography': [/video/i, /film/i, /cinemat/i, /drone/i],
  'film': [/film\s*production/i, /movie/i, /documentary/i],
  'studio': [/studio/i, /production\s*house/i, /creative\s*space/i],
  'production': [/production/i, /media\s*production/i],
  'design': [/design\s*studio/i, /design\s*agency/i, /creative\s*design/i],
  'graphic-design': [/graphic\s*design/i, /visual\s*design/i, /print\s*design/i],
  'ui-ux': [/ui\s*ux/i, /user\s*experience/i, /user\s*interface/i, /product\s*design/i],
  'web-design': [/web\s*design/i, /website\s*design/i],
  'illustration': [/illustrat/i, /drawing/i, /artwork/i],
  'music': [/music/i, /musician/i, /composer/i, /sound/i],
  'band': [/\bband\b/i, /group/i, /ensemble/i, /orchestra/i],
  'dj': [/\bdj\b/i, /disc\s*jockey/i, /turntable/i],
  'producer': [/producer/i, /beat/i, /track/i],
  'record-label': [/record\s*label/i, /music\s*label/i, /label/i],
  'art': [/\bart\b/i, /artwork/i, /fine\s*art/i],
  'gallery': [/gallery/i, /exhibit/i, /art\s*show/i],
  'artist': [/artist/i, /creative/i],
  'sculptor': [/sculpt/i, /3d\s*art/i],
  'painter': [/paint/i, /canvas/i, /oil\s*paint/i],

  // Tech & SaaS
  'saas': [/saas/i, /software\s*as\s*a\s*service/i, /subscription\s*software/i],
  'startup': [/startup/i, /start-up/i, /new\s*venture/i, /entrepreneur/i],
  'tech': [/tech/i, /technology/i, /digital/i, /innovation/i],
  'app': [/\bapp\b/i, /mobile\s*app/i, /application/i],
  'software': [/software/i, /program/i, /solution/i],
  'ai': [/\bai\b/i, /artificial\s*intelligence/i, /machine\s*learning/i, /ml\b/i],
  'machine-learning': [/machine\s*learning/i, /deep\s*learning/i, /neural/i],
  'data': [/data/i, /analytics/i, /insights/i, /business\s*intelligence/i],
  'analytics': [/analytics/i, /metrics/i, /dashboard/i, /reporting/i],
  'cloud': [/cloud/i, /aws/i, /azure/i, /infrastructure/i],
  'devtools': [/devtools/i, /developer\s*tools/i, /dev\s*tools/i, /sdk/i],
  'api': [/\bapi\b/i, /integration/i, /webhook/i],
  'platform': [/platform/i, /ecosystem/i],
  'marketplace': [/marketplace/i, /market\s*place/i, /exchange/i],
  'fintech': [/fintech/i, /financial\s*tech/i, /payment/i, /banking/i],

  // E-commerce & Retail
  'ecommerce': [/e-?commerce/i, /online\s*store/i, /web\s*store/i, /shop/i],
  'shop': [/\bshop\b/i, /store/i, /retail/i],
  'boutique': [/boutique/i, /specialty/i, /artisan/i],
  'fashion': [/fashion/i, /clothing/i, /apparel/i, /wear/i],
  'jewelry': [/jewelry/i, /jewel/i, /accessories/i, /watch/i],
  'electronics': [/electronics/i, /gadget/i, /tech\s*store/i],
  'furniture': [/furniture/i, /home\s*furnish/i, /decor/i],
  'home-goods': [/home\s*goods/i, /household/i, /kitchen/i],
  'sports': [/sports/i, /athletic/i, /gear/i, /equipment/i],
  'outdoor': [/outdoor/i, /camping/i, /hiking/i, /adventure/i],

  // Events & Entertainment
  'wedding': [/wedding/i, /bridal/i, /matrimon/i, /nuptial/i],
  'event-planning': [/event\s*plan/i, /party\s*plan/i, /celebration/i],
  'party': [/party/i, /celebration/i, /gathering/i],
  'venue': [/venue/i, /location/i, /hall/i, /space\s*rental/i],
  'entertainment': [/entertainment/i, /performer/i, /show/i],
  'comedy': [/comedy/i, /comedian/i, /stand-?up/i, /improv/i],
  'theater': [/theater/i, /theatre/i, /drama/i, /stage/i],
  'cinema': [/cinema/i, /movie\s*theater/i, /screening/i],
  'gaming': [/gaming/i, /esports/i, /video\s*game/i, /gamer/i],

  // Education & Non-profit
  'education': [/education/i, /learning/i, /academic/i, /school/i],
  'school': [/school/i, /academy/i, /institute/i, /college/i],
  'tutoring': [/tutor/i, /lesson/i, /teaching/i, /instruction/i],
  'online-course': [/online\s*course/i, /e-?learning/i, /course/i, /class/i],
  'coaching': [/coach/i, /mentor/i, /life\s*coach/i, /business\s*coach/i],
  'nonprofit': [/nonprofit/i, /non-?profit/i, /ngo/i, /cause/i],
  'charity': [/charity/i, /donation/i, /fundrais/i, /give/i],
  'foundation': [/foundation/i, /endowment/i, /grant/i],
  'church': [/church/i, /ministry/i, /faith/i, /worship/i, /religious/i],
  'community': [/community/i, /neighborhood/i, /local/i, /civic/i],

  // Personal & Portfolio
  'portfolio': [/portfolio/i, /work/i, /projects/i, /showcase/i],
  'resume': [/resume/i, /cv\b/i, /curriculum/i],
  'personal-brand': [/personal\s*brand/i, /personal\s*site/i, /about\s*me/i],
  'blog': [/blog/i, /journal/i, /articles/i, /posts/i],
  'writer': [/writer/i, /author/i, /copywriter/i, /content\s*creator/i],
  'developer': [/developer/i, /programmer/i, /coder/i, /engineer/i],
  'freelancer': [/freelancer/i, /freelance/i, /independent/i, /contract/i],
  'creator': [/creator/i, /creative/i, /maker/i],
  'influencer': [/influencer/i, /social\s*media/i, /content/i],
  'podcast': [/podcast/i, /show/i, /episode/i, /listen/i],

  // Other
  'landing-page': [/landing\s*page/i, /lp\b/i, /conversion/i],
  'coming-soon': [/coming\s*soon/i, /launching/i, /pre-?launch/i],
  'waitlist': [/waitlist/i, /wait\s*list/i, /sign\s*up/i, /notify/i],
  'launch': [/launch/i, /release/i, /announce/i],
  'general': [/website/i, /site/i, /page/i, /business/i],
};

/**
 * Detect the most likely template category from user input
 */
export function detectCategory(input: string): TemplateCategory {
  const normalizedInput = input.toLowerCase();

  // Check each category's patterns
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedInput)) {
        return category as TemplateCategory;
      }
    }
  }

  // Default to general landing page
  return 'landing-page';
}

/**
 * Extract business information from user prompt
 * STRICT: Only extract actual business names, not descriptions like "my photography business"
 */
export function extractBusinessInfo(prompt: string): Partial<BusinessInfo> {
  const info: Partial<BusinessInfo> = {};

  // Common words that indicate a description, NOT a business name
  const descriptionWords = ['my', 'a', 'an', 'the', 'our', 'their', 'your', 'some'];
  const businessTypes = ['business', 'company', 'shop', 'store', 'service', 'services', 'agency', 'firm', 'practice'];

  // Try to extract business name - STRICT patterns only
  const namePatterns = [
    // Quoted names are most reliable - "Lens & Light Studios"
    /"([^"]+)"/,
    /'([^']+)'/,
    // Explicit naming - "called Acme Corp" or "named Smith Photography"
    /(?:called|named)\s+([A-Z][A-Za-z0-9\s&'.-]+?)(?:\s*[,.]|\s+(?:website|landing|page|site|is|which)|$)/i,
    // "for [ProperName] Studio/Photography" - but NOT "for my X business"
    /for\s+([A-Z][A-Za-z0-9&'.-]+(?:\s+[A-Z][A-Za-z0-9&'.-]+)*)\s+(?:studio|photography|salon|gym|restaurant|cafe|clinic|dental|law|firm|agency|shop|store)/i,
    // "Business Name: X" or "Name: X" patterns
    /(?:business\s+name|company\s+name|name)[:\s]+([A-Z][A-Za-z0-9\s&'.-]+?)(?:\s*[,.]|$)/i,
  ];

  for (const pattern of namePatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1].trim();

      // Reject if it starts with common description words
      const firstWord = potentialName.split(/\s+/)[0].toLowerCase();
      if (descriptionWords.includes(firstWord)) {
        continue; // Skip this match, try next pattern
      }

      // Reject if it ends with generic business type words (indicates description)
      const lastWord = potentialName.split(/\s+/).pop()?.toLowerCase() || '';
      if (businessTypes.includes(lastWord) && potentialName.split(/\s+/).length <= 2) {
        // "photography business" = description, but "Smith Photography Services" = valid name
        continue;
      }

      // Reject very short names or common words
      if (potentialName.length < 3) continue;
      if (['website', 'site', 'page', 'landing'].includes(potentialName.toLowerCase())) continue;

      info.name = potentialName;
      break;
    }
  }

  // Extract phone number
  const phoneMatch = prompt.match(/(\+?1?\s*[-.(]?\d{3}[-.)]\s*\d{3}[-.]?\d{4})/);
  if (phoneMatch) {
    info.phone = phoneMatch[1];
  }

  // Extract email
  const emailMatch = prompt.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    info.email = emailMatch[1];
  }

  return info;
}

/**
 * Get the best template for a given category
 */
export async function getTemplateByCategory(category: TemplateCategory): Promise<WebsiteTemplate | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('website_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .order('times_used', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return data as WebsiteTemplate;
  } catch {
    return null;
  }
}

/**
 * Search templates by text query
 */
export async function searchTemplates(query: string): Promise<WebsiteTemplate[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('website_templates')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)
      .order('rating', { ascending: false })
      .limit(10);

    if (error || !data) return [];

    return data as WebsiteTemplate[];
  } catch {
    return [];
  }
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<WebsiteTemplate | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('website_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return data as WebsiteTemplate;
  } catch {
    return null;
  }
}

/**
 * Increment template usage counter
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  try {
    // Type assertion needed as RPC functions aren't in generated types yet
    await (supabase.rpc as CallableFunction)('increment_template_usage', { template_id: templateId });
  } catch {
    // Silently fail - function may not exist in all environments
  }
}

/**
 * Apply business info to a template
 */
export function applyBusinessInfo(
  template: WebsiteTemplate,
  businessInfo: BusinessInfo,
  generatedImages?: { logo?: string; hero?: string }
): string {
  let html = template.html_template;

  // Replace business name
  html = html.replace(/\{\{business_name\}\}/gi, businessInfo.name);
  html = html.replace(/\{\{name\}\}/gi, businessInfo.name);

  // Replace tagline
  if (businessInfo.tagline) {
    html = html.replace(/\{\{tagline\}\}/gi, businessInfo.tagline);
  }

  // Replace description
  if (businessInfo.description) {
    html = html.replace(/\{\{description\}\}/gi, businessInfo.description);
  }

  // Replace contact info
  if (businessInfo.phone) {
    html = html.replace(/\{\{phone\}\}/gi, businessInfo.phone);
  }
  if (businessInfo.email) {
    html = html.replace(/\{\{email\}\}/gi, businessInfo.email);
  }
  if (businessInfo.address) {
    html = html.replace(/\{\{address\}\}/gi, businessInfo.address);
  }

  // Replace CTA
  if (businessInfo.ctaText) {
    html = html.replace(/\{\{cta_text\}\}/gi, businessInfo.ctaText);
  }
  if (businessInfo.ctaLink) {
    html = html.replace(/\{\{cta_link\}\}/gi, businessInfo.ctaLink);
  }

  // Inject generated images
  if (generatedImages?.logo) {
    html = html.replace(/\{\{logo_url\}\}/gi, generatedImages.logo);
    // Also replace common logo placeholders
    html = html.replace(/src=["'](?:logo\.png|placeholder|#logo|\/logo)[^"']*["']/gi, `src="${generatedImages.logo}"`);
  }
  if (generatedImages?.hero) {
    html = html.replace(/\{\{hero_url\}\}/gi, generatedImages.hero);
    // Also replace common hero placeholders
    html = html.replace(/src=["'](?:hero\.jpg|hero\.png|placeholder|#hero|\/hero)[^"']*["']/gi, `src="${generatedImages.hero}"`);
    html = html.replace(/background-image:\s*url\(["']?(?:hero\.jpg|hero\.png|placeholder|#hero|\/hero)[^)]*\)/gi, `background-image: url('${generatedImages.hero}')`);
  }

  return html;
}

/**
 * Save a generated site record
 */
export async function saveGeneratedSite(
  userId: string,
  templateId: string | null,
  businessName: string,
  businessType: string,
  generatedHtml: string
): Promise<string | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('generated_sites')
      .insert({
        user_id: userId,
        template_id: templateId,
        business_name: businessName,
        business_type: businessType,
        generated_html: generatedHtml,
      })
      .select('id')
      .single();

    if (error || !data) return null;

    // Increment template usage if we used one
    if (templateId) {
      await incrementTemplateUsage(templateId);
    }

    return data.id;
  } catch {
    return null;
  }
}

/**
 * Get all active templates
 */
export async function getAllTemplates(): Promise<WebsiteTemplate[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('website_templates')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('rating', { ascending: false });

    if (error || !data) return [];

    return data as WebsiteTemplate[];
  } catch {
    return [];
  }
}
