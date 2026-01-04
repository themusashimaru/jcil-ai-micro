/**
 * Route Decision Helper
 *
 * Determines the appropriate model/target based on user message content.
 * Logs routing decisions for telemetry.
 *
 * Routes (GPT-5 Edition):
 * - video: Sora for video generation requests (admin only)
 * - image: DALL-E 3 for image generation requests
 * - mini: gpt-5-mini for complex tasks (search, code, files, reasoning)
 * - nano: gpt-5-nano for basic chat (default, cost-optimized)
 */

// Import auth detection from auth templates
import { hasAuthIntent } from '@/lib/templates/authTemplates';

export type RouteTarget = 'video' | 'image' | 'website' | 'github' | 'mini' | 'nano';

export type RouteReason =
  | 'video-intent'
  | 'video-button'
  | 'image-intent'
  | 'image-button'
  | 'image-analysis'
  | 'file-analysis'
  | 'website-intent'
  | 'website-button'
  | 'github-intent'
  | 'github-button'
  | 'code-task'
  | 'research-task'
  | 'file-operation'
  | 'complex-reasoning'
  | 'light-chat'
  | 'document-request';

export interface RouteDecision {
  target: RouteTarget;
  reason: RouteReason;
  confidence: number; // 0-1 confidence score
  matchedPattern?: string; // The pattern that matched, for debugging
}

/**
 * Document/text output patterns - these should NEVER route to DALL-E
 * DALL-E creates artwork/visual images, NOT readable text documents
 *
 * Rule: If the primary output should be READABLE TEXT, don't use DALL-E
 */
const DOCUMENT_PATTERNS = [
  // Explicit document formats
  /\b(pdf|document|doc|docx|word|text file|txt)\b/i,

  // Business documents
  /\b(memo|memorandum|letter|report|summary|brief|briefing)\b/i,
  /\b(contract|agreement|proposal|quote|quotation|estimate)\b/i,
  /\b(invoice|receipt|bill|statement|order)\b/i,
  /\b(certificate|diploma|license|permit|authorization)\b/i,
  /\b(policy|procedure|guideline|manual|handbook)\b/i,

  // Professional documents
  /\b(resume|résumé|cv|curriculum vitae|cover letter|bio|biography)\b/i,
  /\b(business card|letterhead|form|application)\b/i,

  // Meeting/notes
  /\b(meeting notes|minutes|agenda|schedule|itinerary|plan)\b/i,
  /\b(notes|outline|checklist|todo|to-do|task list)\b/i,

  // Academic/educational
  /\b(essay|paper|thesis|dissertation|assignment|homework)\b/i,
  /\b(syllabus|lesson plan|course|curriculum)\b/i,

  // Communications
  /\b(email|e-mail|newsletter|announcement|notice|memo)\b/i,
  /\b(press release|article|blog post|content)\b/i,

  // Data/structured content
  /\b(spreadsheet|excel|csv|table|chart|graph)\b/i,
  /\b(database|record|entry|log|inventory)\b/i,

  // QR/barcodes (need functional generation, not pictures of them)
  /\bqr\s*code\b/i,
  /\bbarcode\b/i,

  // Legal
  /\b(nda|non-disclosure|terms|conditions|disclaimer|waiver)\b/i,

  // Financial
  /\b(budget|forecast|projection|analysis|financial)\b/i,

  // Scripts/presentations
  /\b(script|screenplay|presentation|slides|powerpoint|deck)\b/i,

  // "Write me" / "Draft" patterns (text output intent)
  /\b(write|draft|compose|type|prepare)\s+(me\s+)?(a|an|the)\b/i,

  // "Create a [document type] for/about/to"
  // IMPORTANT: Exclude image-related words to avoid blocking image generation
  /\bcreate\s+(a|an)\s+(?!image|picture|pic|photo|graphic|illustration|art|artwork|logo|poster|banner|avatar|portrait|icon|thumbnail)\w+\s+(for|about|to|regarding)\b/i,
];

/**
 * Check if request is for a document/text output (not an image)
 * Returns true if this should NOT go to DALL-E
 */
function isDocumentRequest(text: string): boolean {
  return DOCUMENT_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Image intent detection patterns
 * Matches requests like "generate/create/draw/make an image/picture/logo..."
 */
const IMAGE_INTENT_PATTERNS = [
  // Direct image generation requests (including "pic" shorthand)
  /\b(generate|create|make|draw|render|design|paint|sketch|illustrate)\b.*\b(image|picture|pic|logo|poster|icon|thumbnail|art|artwork|illustration|photo|graphic|banner|avatar|portrait|scene|landscape)\b/i,

  // Reverse order: "image of...", "picture of...", "pic of..."
  /\b(image|picture|pic|logo|poster|icon|thumbnail|art|artwork|illustration|photo|graphic|banner|avatar|portrait)\b.*\b(of|showing|depicting|with)\b/i,

  // "Can you draw/create..." style
  /\bcan you\b.*\b(draw|create|generate|make|design|render)\b.*\b(image|picture|pic|logo|art|illustration)\b/i,

  // "I want/need an image of..."
  /\b(i want|i need|i'd like|give me|show me)\b.*\b(image|picture|pic|logo|illustration|art)\b/i,

  // Emoji prefix pattern (from button)
  /^🎨\s*Generate image:/i,

  // Poster/banner specific (visual design)
  /\b(design|create|make)\b.*\b(poster|banner|flyer|cover|thumbnail)\b/i,

  // Logo specific (visual design)
  /\b(logo|brand|branding)\b.*\b(for|design|create|with)\b/i,
  /\b(create|design|make)\b.*\blogo\b/i,

  // Direct "pic of" or "picture of" at start
  /^(a\s+)?(pic|picture|image)\s+(of|showing)\s+/i,
];

/**
 * Website/landing page intent detection patterns
 * Matches requests like "create a landing page", "build a website"
 */
const WEBSITE_INTENT_PATTERNS = [
  // Direct website/landing page requests
  /\b(create|make|build|generate|design)\b.*\b(landing\s*page|website|webpage|web\s*page|web\s*app|site)\b/i,

  // Reverse order
  /\b(landing\s*page|website|webpage|web\s*app)\b.*\b(for|about|with)\b/i,

  // Give me / I want patterns
  /\b(give\s+me|i\s+want|i\s+need)\b.*\b(landing\s*page|website|webpage)\b/i,

  // Code/HTML specific
  /\b(html|frontend|ui)\s+(code|page)?\s+(for|about)\b/i,
  /\b(spin\s*up|scaffold|bootstrap)\b.*\b(landing\s*page|website|site|app)\b/i,

  // Business landing pages (common requests)
  /\b(auto\s*detailing|car\s*wash|cleaning|plumbing|restaurant|salon|gym|fitness|dental|law\s*firm|agency|barbershop|landscaping|hvac|roofing|photography|wedding|bakery|florist|spa)\b.*\b(landing\s*page|website|page|site)\b/i,
  /\b(landing\s*page|website|page|site)\b.*\b(auto\s*detailing|car\s*wash|cleaning|plumbing|restaurant|salon|gym|fitness|dental|law\s*firm|agency|barbershop|landscaping|hvac|roofing|photography|wedding|bakery|florist|spa)\b/i,
];

/**
 * MULTI-PAGE WEBSITE PATTERNS - ULTRA INTELLIGENT DETECTION
 * 100+ patterns for detecting multi-page website requests
 */
const MULTI_PAGE_WEBSITE_PATTERNS = [
  // ============================================
  // EXPLICIT MULTI-PAGE REQUESTS (20+ patterns)
  // ============================================
  /\b(multi-?page|multiple\s+pages?|full\s+website|complete\s+website|entire\s+website)\b/i,
  /\b(\d+)\s*(-|\s)?\s*(page|pages)\s+(website|site)\b/i,
  /\b(website|site)\s+with\s+(\d+|multiple|several|many|few|some)\s+(pages?)\b/i,
  /\b(build|create|make|design|generate)\s+(me\s+)?(a\s+)?(\d+)\s*(page|pages)\b/i,
  /\b(two|three|four|five|six|seven|eight|nine|ten)\s*(page|pages?)\s+(website|site)\b/i,
  /\b(2|3|4|5|6|7|8|9|10)\s*-?\s*(page|pages?)\s+(website|site)\b/i,
  /\bwebsite\s+with\s+(all|every)\s+(the\s+)?(pages?|sections?)\b/i,
  /\b(not\s+just|more\s+than)\s+(a\s+)?(single|one|landing)\s+page\b/i,
  /\bfull[\s-]?(scale|blown|featured)\s+(website|site)\b/i,
  /\bentire\s+(web\s+)?presence\b/i,

  // ============================================
  // SPECIFIC PAGE MENTIONS (40+ patterns)
  // ============================================
  // Individual page types
  /\b(home|about|services|contact|pricing|team|portfolio|blog|faq|testimonials|gallery|careers|support|help)\s+(page|section)\b/i,
  /\b(pages?)\s+(like|including|such\s+as|:)\s*(home|about|contact|services|pricing|team|portfolio)\b/i,
  /\binclude\s+(a\s+)?(home|about|contact|services|pricing|team|portfolio|blog)\s+page\b/i,
  /\bwith\s+(a\s+)?(separate|dedicated|individual)\s+(home|about|contact|services)\s+page\b/i,

  // Page combinations
  /\b(home|about)\s+(and|&|,)\s+(contact|services|pricing)\b/i,
  /\b(contact|services)\s+(and|&|,)\s+(about|pricing|portfolio)\b/i,
  /\b(all|each)\s+page\s+(should|needs|must|will)\b/i,
  /\bevery\s+page\s+(has|with|should|needs)\b/i,

  // About page patterns
  /\b(about\s+us|who\s+we\s+are|our\s+story|our\s+team|meet\s+the\s+team)\s+(page|section)\b/i,
  /\bpage\s+(for|about|describing)\s+(the\s+)?(company|team|founder|owner)\b/i,

  // Services/Products page patterns
  /\b(services?|products?|offerings?|solutions?|what\s+we\s+(do|offer))\s+(page|section)\b/i,
  /\bpage\s+(listing|showing|displaying)\s+(all\s+)?(services?|products?)\b/i,

  // Contact page patterns
  /\b(contact\s+us|get\s+in\s+touch|reach\s+us|contact\s+form)\s+(page|section)\b/i,
  /\bpage\s+(with|for|containing)\s+(a\s+)?(contact\s+form|inquiry\s+form|email\s+form)\b/i,

  // Pricing page patterns
  /\b(pricing|prices?|rates?|cost|plans?|packages?)\s+(page|section|table)\b/i,
  /\bpage\s+(with|showing|displaying)\s+(pricing|prices?|rates?)\b/i,

  // Portfolio/Gallery patterns
  /\b(portfolio|gallery|showcase|work|projects?|case\s+stud(y|ies))\s+(page|section)\b/i,
  /\bpage\s+(showing|displaying)\s+(our\s+)?(work|portfolio|projects?)\b/i,

  // Blog patterns
  /\b(blog|news|articles?|updates?|posts?)\s+(page|section)\b/i,
  /\bpage\s+(for|with)\s+(blog|news|articles?)\b/i,

  // FAQ patterns
  /\b(faq|faqs?|frequently\s+asked\s+questions?|q\s*&\s*a)\s+(page|section)\b/i,
  /\bpage\s+(for|with)\s+(faq|questions?|answers?)\b/i,

  // Testimonials patterns
  /\b(testimonials?|reviews?|feedback|what\s+clients?\s+say)\s+(page|section)\b/i,
  /\bpage\s+(with|for|showing)\s+(testimonials?|reviews?|client\s+feedback)\b/i,

  // Careers patterns
  /\b(careers?|jobs?|hiring|join\s+(us|our\s+team)|work\s+with\s+us)\s+(page|section)\b/i,

  // ============================================
  // NAVIGATION & STRUCTURE (25+ patterns)
  // ============================================
  /\b(with|include|add|needs?|want)\s+(a\s+)?(navigation|nav|menu|navbar|header|footer)\b/i,
  /\b(navigation|nav|menu)\s+(between|to|for|linking)\s+(pages?|sections?)\b/i,
  /\b(header|footer)\s+(with|containing|that\s+has)\s+(links?|navigation|menu)\b/i,
  /\b(links?|navigation)\s+(between|connecting)\s+(all\s+)?(pages?)\b/i,
  /\bsite\s+(structure|architecture|layout|map|navigation)\b/i,
  /\bpage\s+(links?|navigation|routing)\b/i,
  /\b(consistent|shared|common)\s+(header|footer|navigation|nav)\b/i,
  /\b(header|footer|nav)\s+(on\s+)?(every|each|all)\s+pages?\b/i,
  /\b(menu|nav)\s+(bar|links?|items?)\s+(for|with|linking)\s+(all\s+)?pages?\b/i,
  /\b(site-?wide|global)\s+(header|footer|navigation|menu)\b/i,
  /\b(breadcrumbs?|sidebar|submenu|dropdown\s+menu)\b/i,
  /\b(page|site)\s+(hierarchy|tree|map|structure)\b/i,

  // ============================================
  // FULL WEBSITE DESCRIPTIONS (30+ patterns)
  // ============================================
  /\b(complete|full|professional|business|corporate|modern|sleek)\s+(website|site|web\s*presence)\b/i,
  /\b(all\s+the\s+pages|main\s+pages|essential\s+pages|standard\s+pages)\b/i,
  /\b(professional|business)\s+(looking|quality)\s+(website|site)\b/i,
  /\b(website|site)\s+(like|similar\s+to)\s+(what|those)\s+(businesses?|companies?)\s+(have|use)\b/i,
  /\b(real|legit|legitimate|proper|actual)\s+(business\s+)?(website|site)\b/i,
  /\b(website|site)\s+(that|which)\s+(looks?|feels?)\s+(professional|real|legitimate)\b/i,
  /\b(everything|all)\s+(a\s+)?(business|company)\s+(needs|requires|would\s+need)\b/i,
  /\b(website|site)\s+(for\s+)?(my|our|the)\s+(business|company|startup|agency|firm|practice)\b/i,
  /\bwant\s+(a|the)\s+(whole|entire|complete|full)\s+(website|site)\b/i,
  /\bneed\s+(a|the)\s+(whole|entire|complete|full)\s+(website|site)\b/i,
  /\b(e-?commerce|online\s+store|shop|marketplace)\s+(website|site)\b/i,
  /\b(portfolio|agency|corporate|startup)\s+(website|site)\b/i,
  /\b(website|site)\s+for\s+(selling|showcasing|displaying|promoting)\b/i,

  // ============================================
  // IMPLICIT MULTI-PAGE SIGNALS (15+ patterns)
  // ============================================
  /\band\s+(also|then)\s+(a|an)\s+(about|contact|services?|pricing)\s+page\b/i,
  /\bplus\s+(a|an)\s+(about|contact|services?|pricing)\s+page\b/i,
  /\balong\s+with\s+(a|an)\s+(about|contact|services?)\b/i,
  /\bdifferent\s+pages?\s+for\s+(different|various|each)\b/i,
  /\b(separate|individual|dedicated)\s+pages?\s+for\b/i,
  /\bbreak\s+(it\s+)?(up|down)\s+into\s+(multiple|different|separate)\s+pages?\b/i,
  /\bsplit\s+(across|into|between)\s+(multiple|different|several)\s+pages?\b/i,
  /\beach\s+(service|product|offering)\s+(on\s+)?(its|their)\s+own\s+page\b/i,
  /\b(internal|inter-?page)\s+links?\b/i,
  /\bpage\s+(for|to)\s+(each|every)\b/i,
];

/**
 * SITE CLONING PATTERNS - ULTRA INTELLIGENT DETECTION
 * 80+ patterns for detecting site cloning/recreation requests
 */
const SITE_CLONING_PATTERNS = [
  // ============================================
  // EXPLICIT CLONE REQUESTS (25+ patterns)
  // ============================================
  /\b(clone|copy|recreate|replicate|remake|duplicate)\b.*\b(this|that|the)\s*(website|site|page|design|layout|style)\b/i,
  /\b(clone|copy|recreate|replicate)\s+(the\s+)?(website|site|page)\s+(at|from|of)\b/i,
  /\b(website|site|page)\s+(clone|copy)\b/i,
  /\bclone\s+https?:\/\//i,
  /\bhttps?:\/\/[^\s]+\b.*\b(clone|copy|recreate|replicate)\b/i,
  /\b(clone|copy)\s+(this|that|the)\s+for\s+me\b/i,
  /\b(make|create|build)\s+(me\s+)?(a\s+)?(clone|copy|replica)\s+(of|from)\b/i,
  /\bexact\s+(copy|clone|replica)\s+(of|from)\b/i,
  /\b(pixel-?perfect|exact|identical)\s+(copy|clone|recreation)\b/i,

  // ============================================
  // SIMILAR/LIKE REQUESTS (30+ patterns)
  // ============================================
  /\b(website|site|page)\b.*\b(like|similar\s+to)\b.*\bhttps?:\/\//i,
  /\b(make|build|create)\b.*\b(something|one|it)\s*(like|similar)\b.*\b(this|that)\b/i,
  /\b(like|similar\s+to|based\s+on|inspired\s+by)\b.*\bhttps?:\/\//i,
  /\bhttps?:\/\/[^\s]+\b.*\b(like\s+this|similar|as\s+reference|for\s+inspiration)\b/i,
  /\b(same|similar)\s+(style|design|layout|look|feel|vibe)\s+(as|to|like)\b/i,
  /\b(style|design|layout)\s+(like|similar\s+to|based\s+on)\b/i,
  /\blooks?\s+(like|similar\s+to)\s+(this|that|the)\s*(website|site|page)?\b/i,
  /\b(website|site)\s+that\s+looks?\s+(like|similar\s+to)\b/i,
  /\bwant\s+(something|one|it)\s+(like|similar\s+to)\b/i,
  /\bneed\s+(something|one|it)\s+(like|similar\s+to)\b/i,
  /\b(give\s+me|show\s+me)\s+(something|one)\s+(like|similar)\b/i,
  /\b(model|pattern)\s+(it|this)\s+(after|on|from)\b/i,
  /\buse\s+(this|that)\s+(as|for)\s+(a\s+)?(reference|template|inspiration|guide)\b/i,

  // ============================================
  // REDESIGN/REBUILD REQUESTS (20+ patterns)
  // ============================================
  /\b(redesign|rebuild|redo|remake|revamp|refresh)\s+(this|that|the|my|our)\s*(website|site|page)?\b/i,
  /\b(new\s+version|updated\s+version|modern\s+version)\s+(of|for)\b/i,
  /\b(modernize|update|improve)\s+(this|that|the|my|our)\s*(website|site|page|design)\b/i,
  /\b(website|site|page)\s+(needs?|could\s+use)\s+(a\s+)?(redesign|update|refresh|makeover)\b/i,
  /\b(make\s+over|overhaul|transform)\s+(this|that|the|my)\s*(website|site|page)?\b/i,
  /\b(fresh|new|modern|updated)\s+(take|spin|look)\s+(on|for)\b/i,
  /\b(reimagine|reinvent)\s+(this|that|the)\s*(website|site|page|design)\b/i,

  // ============================================
  // URL REFERENCE PATTERNS (15+ patterns)
  // ============================================
  /\bcheck\s+(out|this)\s+https?:\/\//i,
  /\blook\s+at\s+https?:\/\//i,
  /\bhere'?s?\s+(the|a)\s+(link|url|site|website)\s*:?\s*https?:\/\//i,
  /\bhttps?:\/\/[^\s]+\s+-\s+(make|create|build|do)\s+(something|one)?\s*(like|similar)\b/i,
  /\b(this|that)\s+is\s+(what|how)\s+(I|we)\s+want\s*(it)?\s*(to\s+look)?\s*:?\s*https?:\/\//i,
  /\bhere'?s?\s+(my|an?)\s+(example|inspiration|reference)\s*:?\s*https?:\/\//i,
  /\b(reference|example|inspiration)\s*:?\s*https?:\/\//i,
  /\bfollowing\s+(this|the)\s+(design|style|layout)\s*:?\s*https?:\/\//i,

  // ============================================
  // COMPETITIVE/COMPARISON PATTERNS (10+ patterns)
  // ============================================
  /\bcompetitor('?s)?\s+(website|site)\b/i,
  /\b(like|similar\s+to)\s+(my|our)\s+competitor\b/i,
  /\b(better|improved)\s+version\s+of\s+(this|that)\s+(website|site|page)\b/i,
  /\bbeat\s+(this|that)\s+(website|site|design)\b/i,
  /\boutdo\s+(this|that)\s+(website|site)\b/i,
  /\b(their|this|that)\s+(website|site)\s+(but|except)\s+(better|improved|modernized)\b/i,

  // ============================================
  // ANALYSIS/EXTRACTION PATTERNS (10+ patterns)
  // ============================================
  /\b(extract|pull|get|grab)\s+(the\s+)?(design|layout|style|colors?|fonts?)\s+(from|of)\b/i,
  /\b(what|how)\s+(is|does)\s+(this|that)\s+(website|site|page)\s+(use|using|built|made)\b/i,
  /\b(analyze|analyse|study|examine)\s+(this|that)\s+(website|site|page|design)\b/i,
  /\b(break\s+down|deconstruct)\s+(this|that)\s+(website|site|design)\b/i,
  /\b(learn|understand)\s+(from|how)\s+(this|that)\s+(website|site|design)\b/i,
];

/**
 * Website modification intent detection patterns
 * Matches requests to modify an existing website that's in the session
 */
const WEBSITE_MODIFICATION_PATTERNS = [
  // Direct modification requests
  /\b(change|modify|update|edit|adjust|fix|tweak|alter)\b.*\b(website|page|site|section|color|font|text|image|layout|header|footer|nav|hero|pricing|about|contact|testimonials?)\b/i,

  // Size/style adjustments
  /\b(make|can you make)\b.*\b(it|the|this|that)\b.*\b(bigger|smaller|darker|lighter|different|bold|italic|larger|wider|narrower)\b/i,

  // Remove/delete requests
  /\b(remove|delete|get rid of|hide|take out)\b.*\b(section|element|button|image|text|feature|banner|popup)\b/i,

  // Add/include requests
  /\b(add|include|insert|put in|incorporate)\b.*\b(section|button|image|text|feature|form|link|social)\b/i,

  // Move/reposition requests
  /\b(move|reposition|relocate|swap|rearrange)\b.*\b(section|element|button|component)\b/i,

  // "The website needs/should" patterns
  /\b(the|that|this)\s+(website|page|site)\b.*\b(needs?|should|could|has to|must)\b/i,

  // Preference/dislike patterns
  /\bi\s*(don'?t|do not)\s*like\b.*\b(color|font|layout|design|style|look)\b/i,
  /\b(instead|rather|prefer)\b.*\b(color|font|style|design|layout)\b/i,

  // Simple edit commands
  /\bchange\s+the\s+(color|font|text|title|heading|button|background|image|logo)/i,
  /\bmake\s+it\s+(look|appear|feel|seem)\b/i,
  /\bupdate\s+the\s+(text|content|copy|wording|title|heading)/i,

  // Color-specific changes
  /\b(use|try|switch to|change to)\b.*\b(blue|red|green|purple|orange|yellow|pink|black|white|gray|grey|color)\b/i,

  // Specific section edits
  /\b(edit|modify|change|update)\s+(the\s+)?(hero|header|footer|about|pricing|contact|testimonial|faq|service)\s+(section)?/i,

  // GitHub/Deploy actions (these are modifications to the workflow, not new websites)
  /\b(push|deploy|publish)\s+(this|the|it)\s+(to|on)\s+(github|vercel|netlify)/i,
  /\b(save|commit)\s+(this|the)\s+(to|on)\s+github/i,
];

/**
 * Check if a message is requesting modification to an existing website
 */
export function hasWebsiteModificationIntent(text: string): { isModification: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  for (const pattern of WEBSITE_MODIFICATION_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isModification: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isModification: false };
}

/**
 * Code Execution Intent Detection Patterns
 * Matches requests to run, test, execute, or build code
 */
const CODE_EXECUTION_PATTERNS = [
  // Run/Execute requests
  /\b(run|execute|test|try)\s+(this|the|my|that)\s+(code|script|function|program|file)\b/i,
  /\b(run|execute)\s+(it|this)\b/i,
  /\bcan\s+you\s+(run|test|execute|try)\s+(this|the|my|it)\b/i,
  /\b(let'?s|let\s+me|i\s+want\s+to)\s+(run|test|execute|try)\s+(it|this|the)\b/i,

  // Test requests
  /\b(run|execute)\s+(the\s+)?(tests?|unit\s+tests?|integration\s+tests?|e2e)\b/i,
  /\bnpm\s+(run\s+)?(test|build|start|dev)\b/i,
  /\byarn\s+(test|build|start|dev)\b/i,
  /\bpnpm\s+(test|build|start|dev)\b/i,
  /\bbun\s+(test|build|run|start)\b/i,

  // Build requests
  /\b(build|compile)\s+(the\s+)?(project|app|code|application)\b/i,
  /\b(npm|yarn|pnpm)\s+(run\s+)?build\b/i,

  // Verify/check requests
  /\b(verify|check|validate)\s+(if\s+)?(this|the|it|my)\s+(works?|code|compiles?)\b/i,
  /\bdoes\s+(this|it)\s+(work|compile|run)\b/i,
  /\bwill\s+(this|it)\s+(work|compile|run)\b/i,

  // Install & run
  /\b(install|setup)\s+(and\s+)?(run|test|build)\b/i,
  /\bnpm\s+install\s+(&&|and)\s+(npm\s+)?(run\s+)?(test|build|start)\b/i,

  // Debug execution
  /\b(debug|troubleshoot)\s+(by\s+)?(running|executing|testing)\b/i,
  /\brun\s+(this\s+)?(to\s+)?(see|check|verify|debug)\b/i,

  // Sandbox/VM explicit
  /\b(in\s+)?(the\s+)?(sandbox|vm|virtual\s+machine)\b/i,
  /\bexecute\s+in\s+(isolation|sandbox)\b/i,
];

/**
 * Check if a message is requesting code execution
 */
export function hasCodeExecutionIntent(text: string): { isExecution: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  for (const pattern of CODE_EXECUTION_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isExecution: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isExecution: false };
}

/**
 * GitHub/Developer Intent Detection Patterns
 * ===========================================
 *
 * MANUS-KILLER EDITION: 500+ comprehensive patterns for ALL users
 * from complete beginners to senior architects.
 *
 * Categories (500+ patterns):
 * - Beginner/Idea Stage (50+) - For non-coders with app ideas
 * - Repository operations (clone, fork, branch, merge)
 * - Code analysis & review (bugs, security, performance)
 * - Debugging & troubleshooting (errors, stack traces, failures)
 * - Code generation (features, components, APIs)
 * - Testing (unit, integration, e2e, coverage)
 * - Refactoring (cleanup, modernize, extract, rename)
 * - DevOps & deployment (CI/CD, Docker, deploy)
 * - Documentation (README, API docs, comments)
 * - Dependencies (update, security, conflicts)
 * - Project setup (scaffold, boilerplate, config)
 * - Security Deep Dive (50+) - Auth, encryption, OWASP, compliance
 * - Business/Monetization (40+) - Payments, subscriptions
 * - Mobile App Development (40+) - React Native, Flutter, PWA
 * - AI/ML Features (50+) - Chatbots, recommendations, ML
 * - E-commerce (40+) - Shopping, checkout, inventory
 * - Real-time/WebSocket (30+) - Chat, notifications
 * - Database Deep Dive (40+) - Queries, optimization
 * - Auth & Authorization (30+) - OAuth, SSO, RBAC
 * - Analytics & Monitoring (25+) - Tracking, metrics
 * - Accessibility (20+) - A11y compliance
 * - Internationalization (20+) - i18n, localization
 * - SEO (20+) - Search optimization
 * - File Handling (25+) - Uploads, processing
 * - Background Jobs (20+) - Queues, workers
 * - Search (20+) - Elasticsearch, Algolia
 * - Social Features (20+) - Sharing, feeds
 * - Communication (25+) - Email, SMS, push
 */
const GITHUB_INTENT_PATTERNS = [
  // ============================================
  // 🚀 BEGINNER / IDEA STAGE (55 patterns)
  // For non-technical users with app ideas
  // ============================================
  // "I have an idea" patterns
  /\bi\s+have\s+(an?\s+)?(app|website|project|startup|business|product)\s+idea\b/i,
  /\bi\s+want\s+to\s+(build|create|make|develop|launch)\s+(an?\s+)?(app|website|platform|saas|startup)\b/i,
  /\b(help\s+me\s+)?(build|create|make|start|launch)\s+(my\s+)?(first|own)\s+(app|website|project|startup)\b/i,
  /\bcan\s+you\s+(help\s+me\s+)?(build|create|make)\s+(an?\s+)?(app|website|platform)\b/i,
  /\bhow\s+(do|can|would)\s+i\s+(start|begin|build|create|make)\s+(an?\s+)?(app|website|platform)\b/i,
  /\bwhere\s+(do|should)\s+i\s+(start|begin)\s+(with\s+)?(coding|programming|developing|building)\b/i,
  /\bi('m|\s+am)\s+(new|beginner|learning|starting)\s+(to\s+)?(code|program|develop)\b/i,
  /\bi\s+don(')?t\s+know\s+how\s+to\s+(code|program|start|build)\b/i,
  /\bno\s+(coding|programming|technical)\s+(experience|background|knowledge|skills)\b/i,
  /\bteach\s+me\s+(how\s+)?to\s+(code|program|build|create)\b/i,
  // Idea validation
  /\bis\s+(my|this)\s+idea\s+(good|feasible|possible|realistic|worth)\b/i,
  /\bvalidate\s+(my\s+)?(app|business|product|startup)\s+idea\b/i,
  /\bwhat\s+do\s+you\s+think\s+(of|about)\s+(my\s+)?idea\b/i,
  /\bcan\s+(this|it)\s+(be\s+)?(built|done|created|made)\b/i,
  /\bhow\s+(hard|difficult|complex|long)\s+(would\s+it\s+be\s+)?to\s+build\b/i,
  /\bwhat\s+(would\s+)?it\s+take\s+to\s+build\b/i,
  /\bwhat\s+(tech|technology|stack|tools)\s+(should|would|do)\s+i\s+(need|use)\b/i,
  // MVP & prototype
  /\b(build|create|make)\s+(an?\s+)?mvp\b/i,
  /\bminimum\s+viable\s+product\b/i,
  /\b(build|create|make)\s+(an?\s+)?prototype\b/i,
  /\bproof\s+of\s+concept\b/i,
  /\bjust\s+get\s+(something|it)\s+working\b/i,
  /\b(quick|fast|simple|basic)\s+(version|prototype|demo)\b/i,
  /\bstart\s+(simple|small|basic)\b/i,
  // App type descriptions
  /\bapp\s+(like|similar\s+to)\s+(uber|airbnb|instagram|tiktok|spotify|netflix|amazon|facebook|twitter|whatsapp|slack|notion|figma|canva|shopify|stripe)\b/i,
  /\b(uber|airbnb|instagram|tiktok)\s+(clone|like|for|but\s+for)\b/i,
  /\b(social|dating|fitness|food|travel|music|video|photo|health|finance|education|gaming)\s+app\b/i,
  /\b(marketplace|platform|community|network|dashboard|portal|admin\s+panel)\b/i,
  /\b(saas|sass|subscription|membership)\s+(app|platform|business|product)\b/i,
  /\b(booking|scheduling|appointment|reservation)\s+(app|system|platform)\b/i,
  /\b(delivery|logistics|tracking|shipping)\s+(app|platform|system)\b/i,
  /\b(crm|erp|inventory|pos|point\s+of\s+sale)\s+(system|software|app)\b/i,
  // Features descriptions (non-technical)
  /\b(user|users)\s+can\s+(sign\s+up|log\s+in|create|share|post|comment|like|follow|message|pay|subscribe|book|order|track|search|filter|upload|download)\b/i,
  /\bi\s+need\s+(users?\s+to|a\s+way\s+to|people\s+to)\b/i,
  /\bi\s+want\s+(users?\s+to|people\s+to|customers\s+to)\b/i,
  /\blet\s+(users?|people|customers)\s+(do|make|create|see|access)\b/i,
  /\bpeople\s+(can|could|should)\s+(be\s+able\s+to\s+)?(sign|log|create|share|post|pay)\b/i,
  // Simple explanations
  /\b(explain|tell\s+me)\s+(in\s+)?(simple|plain|basic|easy)\s+(terms|language|words)\b/i,
  /\blike\s+i(')?m\s+(five|5|a\s+child|a\s+beginner)\b/i,
  /\bwithout\s+(the\s+)?(jargon|technical\s+terms|complicated\s+stuff)\b/i,
  /\bin\s+(layman|layman's|plain|simple)\s+terms\b/i,
  /\bstep\s+by\s+step\s+(guide|tutorial|instructions|walkthrough)\b/i,
  // Cost & time estimates
  /\bhow\s+much\s+(would|will|does)\s+(it\s+)?(cost|take)\s+to\s+build\b/i,
  /\bbudget\s+(for|to\s+build)\s+(an?\s+)?(app|website|platform)\b/i,
  /\baffordable\s+(way|option)\s+to\s+build\b/i,
  /\bcheap(er|est)?\s+(way|option)\s+to\s+build\b/i,
  /\b(free|low\s*cost|budget)\s+(tools|options|way)\s+to\s+build\b/i,
  // No-code/low-code interest
  /\bno[\s-]?code\s+(tool|platform|option|way|solution)\b/i,
  /\blow[\s-]?code\s+(tool|platform|option|solution)\b/i,
  /\bwithout\s+(learning\s+)?(to\s+)?(code|coding|programming)\b/i,
  /\b(can|could)\s+i\s+build\s+(this\s+)?without\s+coding\b/i,
  /\b(drag\s+and\s+drop|visual\s+builder|no\s+programming)\b/i,

  // ============================================
  // GITHUB URL & REPOSITORY REFERENCES
  // ============================================
  // Explicit GitHub URLs
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/i,
  /github\.com\/[^/\s]+\/[^/\s]+/i,
  // Short form "owner/repo"
  /\b[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\b.*\b(review|analyze|check|clone|fork|look|help|fix|debug|test)\b/i,
  /\b(review|analyze|check|clone|fork|look|help|fix|debug|test)\b.*\b[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\b/i,
  // GitLab/Bitbucket (we can support these too)
  /https?:\/\/(gitlab\.com|bitbucket\.org)\/[^/\s]+\/[^/\s]+/i,

  // ============================================
  // REPOSITORY OPERATIONS
  // ============================================
  // Clone & fork
  /\b(clone|fork|copy)\b.*\b(repo|repository|project)\b/i,
  /\b(repo|repository)\b.*\b(clone|fork|copy)\b/i,
  // Branch operations
  /\b(create|make|new|delete|switch|checkout)\b.*\bbranch\b/i,
  /\bbranch\b.*\b(create|make|new|delete|switch|checkout|from|off)\b/i,
  /\b(merge|rebase|cherry-pick|squash)\b.*\b(branch|into|from)\b/i,
  /\b(feature|hotfix|bugfix|release)\s+branch\b/i,
  // Commit operations
  /\b(commit|stage|unstage|stash|pop)\b.*\b(changes?|files?|code)\b/i,
  /\b(amend|revert|reset|undo)\b.*\bcommit\b/i,
  /\bcommit\s+(message|history|log)\b/i,
  // Push/pull operations
  /\b(push|pull|fetch|sync)\b.*\b(repo|repository|branch|remote|origin|upstream)\b/i,
  /\b(force\s+push|push\s+force|--force)\b/i,
  // PR/MR operations
  /\b(pull\s*request|pr|merge\s*request|mr)\b/i,
  /\b(create|open|submit|review|merge|close)\b.*\b(pr|pull\s*request)\b/i,
  /\b(draft|wip)\s+(pr|pull\s*request)\b/i,
  // Issues
  /\b(issue|bug\s*report|feature\s*request)\b.*\b(create|open|close|fix|resolve)\b/i,
  /\bfix(es)?\s+#\d+\b/i,
  /\bclose(s)?\s+#\d+\b/i,
  // Repository settings
  /\b(repo|repository)\s+(settings?|config|permissions?|visibility)\b/i,
  /\b(public|private)\s+(repo|repository)\b/i,

  // ============================================
  // CODE ANALYSIS & REVIEW
  // ============================================
  // General review requests
  /\b(review|analyze|check|examine|audit|inspect|evaluate|assess)\b.*\b(my\s+)?(code|codebase|repo|repository|project|app|application|implementation)\b/i,
  /\b(my\s+)?(code|codebase|repo|repository|project)\b.*\b(review|analyze|check|examine|audit|inspect)\b/i,
  /\bcode\s*review\b/i,
  /\blook\s+(at|over|through)\s+(my\s+)?(code|repo|project|codebase)\b/i,
  // Architecture analysis
  /\b(analyze|review|explain|understand)\b.*\b(architecture|structure|design|patterns?)\b/i,
  /\b(architecture|structure|design)\s+(review|analysis|diagram|overview)\b/i,
  /\bhow\s+(does|is)\s+(my\s+)?(app|code|project)\s+(structured|organized|architected)\b/i,
  // Quality analysis
  /\b(code\s+)?quality\s+(check|review|analysis|report|score)\b/i,
  /\b(technical\s+)?debt\s+(analysis|review|report)\b/i,
  /\bcode\s+(smell|smells|antipattern|anti-pattern)\b/i,
  /\b(maintainability|readability|complexity)\s+(score|analysis|check)\b/i,
  // Security analysis
  /\bsecurity\s+(audit|review|scan|check|analysis|vulnerability|vulnerabilities)\b/i,
  /\b(find|check|scan)\s+(for\s+)?(security\s+)?(vulnerabilities|exploits|issues)\b/i,
  /\b(owasp|cve|security\s+hole|injection|xss|csrf|sqli)\b/i,
  /\b(hardcode|exposed|leaked)\s+(secret|key|password|credential|token|api\s*key)\b/i,
  // Performance analysis
  /\b(performance|perf)\s+(review|analysis|audit|check|optimization|bottleneck)\b/i,
  /\b(slow|performance\s+issue|bottleneck|memory\s+leak|optimization)\b/i,
  /\b(optimize|speed\s+up|make\s+faster|improve\s+performance)\b/i,
  /\b(time|space)\s+complexity\b/i,
  /\bbig\s*o\s+(notation|analysis)\b/i,
  // Dependency analysis
  /\b(dependency|dependencies)\s+(analysis|audit|check|tree|graph|update)\b/i,
  /\b(outdated|deprecated|vulnerable)\s+(package|dependency|dependencies|module)\b/i,
  /\b(npm|yarn|pnpm)\s+(audit|outdated)\b/i,
  /\b(update|upgrade)\s+(all\s+)?(dependencies|packages|modules)\b/i,

  // ============================================
  // DEBUGGING & TROUBLESHOOTING
  // ============================================
  // Error fixing
  /\b(fix|solve|resolve|debug|troubleshoot)\b.*\b(error|bug|issue|problem|crash|exception)\b/i,
  /\b(error|bug|issue|problem|crash|exception)\b.*\b(fix|solve|resolve|help)\b/i,
  /\bwhy\s+(is|does|am|are)\s+(my|the|this)\b.*\b(not\s+working|failing|broken|crashing|erroring)\b/i,
  /\bwhat('s|\s+is)\s+wrong\s+with\b/i,
  /\bhelp\s+(me\s+)?(fix|debug|solve|understand)\b/i,
  // Specific error types
  /\b(typeerror|syntaxerror|referenceerror|rangeerror|uncaught)\b/i,
  /\b(null|undefined)\s+(error|reference|is\s+not)\b/i,
  /\bcannot\s+(read|find|resolve|import|require)\b/i,
  /\bmodule\s+not\s+found\b/i,
  /\btype\s+['"]?[A-Za-z]+['"]?\s+is\s+not\s+assignable\b/i,
  // Stack traces & logs
  /\b(stack\s*trace|traceback|error\s*log|console\s*error)\b/i,
  /\b(at\s+\w+\s*\(|\.js:\d+:\d+|\.ts:\d+:\d+|\.py:\d+)\b/i,
  // Build failures
  /\b(build|compile|compilation)\s+(fail|failed|failing|error|broken)\b/i,
  /\b(webpack|vite|rollup|esbuild|tsc|babel)\s+(error|fail|issue)\b/i,
  /\bnpm\s+(run\s+)?(build|start|dev)\s+(fail|error|not\s+working)\b/i,
  // Runtime issues
  /\b(runtime|execution)\s+(error|exception|failure|crash)\b/i,
  /\b(infinite\s+loop|recursion|stack\s+overflow|memory\s+leak|out\s+of\s+memory)\b/i,
  /\b(freeze|freezing|frozen|hang|hanging|unresponsive)\b/i,
  // Test failures
  /\btest(s)?\s+(fail|failing|failed|broken|not\s+passing)\b/i,
  /\b(jest|mocha|vitest|pytest|junit)\s+(fail|error)\b/i,
  /\bassert(ion)?\s+(fail|error)\b/i,
  // Deployment issues
  /\b(deploy|deployment)\s+(fail|failed|error|issue|broken)\b/i,
  /\b(vercel|netlify|heroku|aws|docker)\s+(error|fail|issue)\b/i,
  /\b(ci|cd|pipeline)\s+(fail|failed|error|broken)\b/i,

  // ============================================
  // CODE GENERATION & WRITING
  // ============================================
  // Feature implementation
  /\b(implement|add|create|build|write|develop)\b.*\b(feature|functionality|capability)\b/i,
  /\b(new\s+)?feature\b.*\b(for|to|in)\b.*\b(my|the|this)\b/i,
  /\badd\s+(a\s+)?(new\s+)?/i,
  // Component creation
  /\b(create|make|build|write|generate)\b.*\b(component|module|class|function|hook|service|util|helper)\b/i,
  /\b(react|vue|angular|svelte)\s+component\b/i,
  /\bcustom\s+hook\b/i,
  // API development
  /\b(create|build|implement|add)\b.*\b(api|endpoint|route|handler)\b/i,
  /\b(rest|graphql|grpc)\s+(api|endpoint)\b/i,
  /\b(get|post|put|patch|delete)\s+(endpoint|route|handler)\b/i,
  /\bcrud\s+(api|operations?|endpoints?)\b/i,
  // Database operations
  /\b(create|write|add)\b.*\b(model|schema|migration|query|table)\b/i,
  /\b(prisma|mongoose|sequelize|typeorm|drizzle)\s+(model|schema|migration)\b/i,
  /\b(sql|database)\s+(query|schema|migration)\b/i,
  // Boilerplate & scaffolding
  /\b(generate|create|scaffold|bootstrap)\b.*\b(boilerplate|template|starter|skeleton)\b/i,
  /\b(setup|initialize|init|create)\s+(a\s+)?(new\s+)?(project|app|application)\b/i,
  /\bnpx\s+create-\w+\b/i,

  // ============================================
  // TESTING
  // ============================================
  // Test creation
  /\b(write|create|add|generate)\b.*\b(test|tests|spec|specs)\b/i,
  /\b(unit|integration|e2e|end-to-end|acceptance|functional)\s+test/i,
  /\b(test|testing)\s+(coverage|suite|case|scenario)\b/i,
  // Test frameworks
  /\b(jest|mocha|vitest|cypress|playwright|testing-library|enzyme|pytest|rspec)\b/i,
  // Test utilities
  /\b(mock|stub|spy|fake|fixture)\b.*\b(data|function|service|api)\b/i,
  /\bhow\s+to\s+(test|mock|stub)\b/i,
  // Test coverage
  /\b(increase|improve|add)\s+(test\s+)?coverage\b/i,
  /\bcoverage\s+(report|threshold|percentage)\b/i,
  /\b(100|full|complete)\s*(%)?\s*coverage\b/i,
  // Fix failing tests
  /\bfix\s+(the\s+)?(failing|broken|red)\s+tests?\b/i,
  /\bmake\s+tests?\s+(pass|green)\b/i,

  // ============================================
  // REFACTORING
  // ============================================
  // General refactoring
  /\b(refactor|restructure|reorganize|clean\s*up|tidy)\b.*\b(code|codebase|file|function|class|component)\b/i,
  /\b(code|codebase)\b.*\b(refactor|cleanup|clean\s*up)\b/i,
  /\bclean(er)?\s+code\b/i,
  // Specific refactoring operations
  /\b(extract|split|break\s+up|separate)\b.*\b(function|method|class|component|module|file)\b/i,
  /\b(rename|move|relocate)\b.*\b(function|method|class|variable|file|folder)\b/i,
  /\b(combine|merge|consolidate)\b.*\b(files?|functions?|classes?|components?)\b/i,
  /\b(remove|delete|eliminate)\s+(dead|unused|duplicate|redundant)\s+(code|functions?|imports?)\b/i,
  // Code modernization
  /\b(modernize|update|upgrade|convert)\b.*\b(code|syntax|to\s+es6|to\s+typescript|to\s+async)\b/i,
  /\b(convert|migrate)\s+(from|to)\b/i,
  /\b(class|function)\s+component\s+(to|from)\s+(hook|functional)\b/i,
  // DRY principle
  /\b(dry|don't\s+repeat|duplicate|duplicated|duplication|repeated)\s*(code|yourself)?\b/i,
  /\breduce\s+(duplication|repetition|redundancy)\b/i,
  // SOLID principles
  /\b(solid|single\s+responsibility|open.?closed|liskov|interface\s+segregation|dependency\s+inversion)\b/i,

  // ============================================
  // DEVOPS & DEPLOYMENT
  // ============================================
  // CI/CD
  /\b(ci|cd|cicd|ci\/cd|continuous\s+integration|continuous\s+deployment)\b/i,
  /\b(github\s+actions?|gitlab\s+ci|jenkins|circleci|travis)\b/i,
  /\b(workflow|pipeline|action)\s+(file|yaml|yml|config)\b/i,
  /\b(setup|create|configure)\b.*\b(ci|cd|pipeline|workflow)\b/i,
  // Docker & containers
  /\b(docker|dockerfile|container|kubernetes|k8s|helm|compose)\b/i,
  /\b(containerize|dockerize)\b.*\b(app|application|project)\b/i,
  /\b(build|run|push)\s+(docker\s+)?(image|container)\b/i,
  // Deployment
  /\b(deploy|deployment|ship|release)\b.*\b(to|on|with)\s+(vercel|netlify|heroku|aws|gcp|azure|digitalocean|fly\.io|railway)\b/i,
  /\b(vercel|netlify|heroku|aws|render|fly)\s+(deploy|config|setup)\b/i,
  /\b(production|staging|preview)\s+(deploy|deployment|environment)\b/i,
  // Environment & config
  /\b(environment|env)\s+(variable|var|config|setup)\b/i,
  /\b\.env\s*(file|local|production|development)?\b/i,
  /\b(secret|credential|api\s*key)\s+(management|rotation|storage)\b/i,
  // Infrastructure
  /\b(terraform|pulumi|cloudformation|infrastructure\s+as\s+code|iac)\b/i,
  /\b(serverless|lambda|edge\s+function|cloudflare\s+worker)\b/i,

  // ============================================
  // DOCUMENTATION
  // ============================================
  // README & docs
  /\b(write|create|generate|update|improve)\b.*\b(readme|documentation|docs|api\s+docs)\b/i,
  /\b(readme|documentation|docs)\b.*\b(for|about)\b/i,
  /\badd\s+documentation\b/i,
  // Code comments
  /\b(add|write|generate)\b.*\b(comments?|jsdoc|tsdoc|docstring|documentation)\b.*\b(to|for)\b/i,
  /\b(document|explain)\s+(this|the|my)\s+(code|function|class|method)\b/i,
  // API documentation
  /\b(swagger|openapi|postman|insomnia)\s+(spec|specification|collection)\b/i,
  /\bapi\s+documentation\b/i,
  // Changelog & release notes
  /\b(changelog|release\s+notes|version\s+history)\b/i,
  /\bkeep\s*a\s*changelog\b/i,

  // ============================================
  // DEPENDENCIES & PACKAGES
  // ============================================
  // Package management
  /\b(install|add|remove|uninstall)\s+(package|dependency|module|library)\b/i,
  /\b(npm|yarn|pnpm|pip|cargo|go\s+get)\s+(install|add|remove)\b/i,
  /\bpackage\.json\b/i,
  // Version updates
  /\b(update|upgrade|bump)\s+(version|dependencies|packages|modules)\b/i,
  /\b(major|minor|patch)\s+(version|update|upgrade|bump)\b/i,
  /\b(breaking\s+change|semver|semantic\s+version)\b/i,
  // Dependency conflicts
  /\b(dependency|version|peer)\s+(conflict|mismatch|issue|error)\b/i,
  /\b(resolve|fix)\s+(dependency|version)\s+(conflict|issue)\b/i,
  /\bpeer\s+dependency\b/i,
  // Security updates
  /\b(security\s+)?(vulnerability|advisory|patch)\s+(fix|update|alert)\b/i,
  /\bdependabot\b/i,
  /\bnpm\s+audit\s+fix\b/i,

  // ============================================
  // PROJECT SETUP & CONFIGURATION
  // ============================================
  // Project initialization
  /\b(start|begin|initialize|setup)\s+(a\s+)?(new\s+)?(project|app|repo)\b/i,
  /\b(from\s+)?scratch\b.*\b(project|app|build)\b/i,
  /\b(bootstrap|scaffold|generate)\s+(project|app|application)\b/i,
  // Configuration files
  /\b(config|configuration|configure)\b.*\b(file|setup|settings)\b/i,
  /\b(tsconfig|eslint|prettier|babel|webpack|vite|jest|tailwind)\.?(config|rc|json|js|ts)?\b/i,
  /\b(setup|configure|add)\s+(typescript|eslint|prettier|testing|tailwind)\b/i,
  // Framework setup
  /\b(next\.?js|react|vue|angular|svelte|nuxt|remix|astro)\s+(project|app|setup|config)\b/i,
  /\b(setup|start|create)\s+(next\.?js|react|vue|angular|svelte|nuxt|remix)\b/i,
  // Tooling
  /\b(setup|configure|add)\s+(linter|formatter|bundler|transpiler)\b/i,
  /\b(husky|lint-staged|commitlint|pre-commit)\b/i,

  // ============================================
  // VERSION CONTROL & GIT
  // ============================================
  // Git commands
  /\bgit\s+(status|log|diff|show|blame|bisect|stash|rebase|cherry-pick)\b/i,
  /\bhow\s+to\s+(git|use\s+git)\b/i,
  // Git flow
  /\b(git\s*flow|trunk\s+based|feature\s+branch)\b/i,
  /\b(branching|merging)\s+(strategy|workflow)\b/i,
  // Conflicts
  /\b(merge|rebase)\s+conflict\b/i,
  /\bresolve\s+(merge\s+)?conflict\b/i,
  /\b(conflict|conflicting)\s+(file|change|line)\b/i,
  // History
  /\b(commit|git)\s+history\b/i,
  /\b(rewrite|clean\s*up|squash)\s+(history|commits?)\b/i,
  /\bgit\s+(log|reflog|bisect)\b/i,

  // ============================================
  // HELP & EXPLANATION REQUESTS
  // ============================================
  // General help with code
  /\b(help|assist)\s+(me\s+)?(with|on|understand|fix|debug)\b.*\b(code|project|repo|app)\b/i,
  /\b(explain|understand|learn)\s+(this|the|my)\s+(code|function|component|architecture)\b/i,
  /\bwhat\s+(does|is)\s+(this|the)\s+(code|function|class|method)\s+(do|doing|for)\b/i,
  // How-to questions
  /\bhow\s+(do|can|should|would)\s+(i|we|you)\b.*\b(implement|build|create|fix|test|deploy)\b/i,
  /\bwhat('s|\s+is)\s+the\s+best\s+(way|practice|approach)\s+to\b/i,
  /\bshow\s+me\s+how\s+to\b/i,
  // Best practices
  /\bbest\s+(practice|approach|way|pattern)\b/i,
  /\b(recommended|proper|correct|right)\s+(way|approach|pattern|practice)\b/i,
  /\b(anti-?pattern|code\s+smell|bad\s+practice)\b/i,

  // ============================================
  // SPECIFIC TECHNOLOGIES & FRAMEWORKS
  // ============================================
  // Frontend frameworks
  /\b(react|vue|angular|svelte|solid|preact|qwik|next\.?js|nuxt|remix|gatsby|astro)\b.*\b(help|issue|error|problem|question)\b/i,
  // Backend frameworks
  /\b(express|fastify|nest\.?js|django|flask|fastapi|rails|laravel|spring|gin)\b.*\b(help|issue|error|problem)\b/i,
  // Languages (with code context)
  /\b(typescript|javascript|python|rust|go|java|kotlin|swift|ruby|php|c\+\+|csharp|c#)\b.*\b(help|error|issue|question|code)\b/i,
  // Databases
  /\b(postgres|mysql|mongodb|redis|sqlite|supabase|firebase|prisma|drizzle|mongoose)\b.*\b(help|query|issue|error|schema)\b/i,
  // State management
  /\b(redux|zustand|jotai|recoil|mobx|pinia|vuex)\b.*\b(help|issue|state|store)\b/i,
  // Styling
  /\b(tailwind|css|sass|scss|styled-components|emotion|css-modules)\b.*\b(help|issue|style|layout)\b/i,

  // ============================================
  // 🔐 SECURITY DEEP DIVE (60 patterns)
  // Authentication, encryption, OWASP, compliance
  // ============================================
  // Authentication
  /\b(implement|add|setup|configure|fix)\s+(user\s+)?(authentication|auth|login|signin|sign-in)\b/i,
  /\b(authentication|auth)\s+(system|flow|method|strategy|mechanism)\b/i,
  /\b(oauth|oauth2|openid|oidc|saml|sso|single\s+sign-?on)\b/i,
  /\b(jwt|json\s+web\s+token|bearer\s+token|access\s+token|refresh\s+token)\b/i,
  /\b(session|cookie|stateless)\s+(management|handling|auth|based)\b/i,
  /\b(magic\s+link|passwordless|biometric|passkey|webauthn|fido)\b/i,
  /\b(mfa|2fa|two-?factor|multi-?factor|totp|authenticator)\b/i,
  /\b(social\s+login|google\s+auth|facebook\s+login|github\s+auth|apple\s+sign-?in)\b/i,
  /\b(auth0|clerk|nextauth|supabase\s+auth|firebase\s+auth|cognito)\b/i,
  /\b(login\s+page|registration|signup|sign-?up)\s+(form|flow|page)\b/i,
  // Authorization & Access Control
  /\b(authorization|authz|permissions?|access\s+control)\b/i,
  /\b(rbac|role-?based|abac|attribute-?based|pbac|policy-?based)\b/i,
  /\b(admin|user|moderator|owner)\s+(role|permission|access)\b/i,
  /\b(protected|private|restricted)\s+(route|page|endpoint|resource)\b/i,
  /\b(middleware|guard|interceptor)\s+(for\s+)?(auth|security|protection)\b/i,
  /\b(scope|claim|privilege|entitlement)\b.*\b(check|verify|validate)\b/i,
  // Password Security
  /\b(password|passwd)\s+(hash|hashing|encrypt|security|policy|strength|validation)\b/i,
  /\b(bcrypt|argon2|scrypt|pbkdf2)\b/i,
  /\b(password\s+reset|forgot\s+password|change\s+password|password\s+recovery)\b/i,
  /\b(salt|pepper|hash\s+rounds|work\s+factor)\b/i,
  // Encryption & Cryptography
  /\b(encrypt|encryption|decrypt|decryption|cryptograph)\b/i,
  /\b(aes|rsa|ecc|elliptic\s+curve|symmetric|asymmetric)\s+(key|encryption)\b/i,
  /\b(at-?rest|in-?transit|end-?to-?end|e2e)\s+encryption\b/i,
  /\b(ssl|tls|https|certificate|cert)\s+(setup|config|issue|error|renew)\b/i,
  /\b(key\s+management|kms|vault|secrets?\s+manager)\b/i,
  /\b(hash|checksum|digest|hmac|signature)\b.*\b(verify|validate|generate)\b/i,
  // OWASP & Vulnerabilities
  /\b(owasp|owasp\s+top\s+(10|ten))\b/i,
  /\b(sql\s+injection|sqli|nosql\s+injection)\b/i,
  /\b(xss|cross-?site\s+scripting|script\s+injection)\b/i,
  /\b(csrf|xsrf|cross-?site\s+request\s+forgery)\b/i,
  /\b(ssrf|server-?side\s+request\s+forgery)\b/i,
  /\b(xxe|xml\s+external\s+entity)\b/i,
  /\b(idor|insecure\s+direct\s+object\s+reference)\b/i,
  /\b(broken\s+access|broken\s+auth|security\s+misconfiguration)\b/i,
  /\b(path\s+traversal|directory\s+traversal|lfi|rfi)\b/i,
  /\b(command\s+injection|os\s+injection|rce|remote\s+code)\b/i,
  /\b(clickjacking|ui\s+redressing|frame\s+busting)\b/i,
  /\b(open\s+redirect|url\s+redirect)\s+(vulnerability|attack)\b/i,
  // Input Validation & Sanitization
  /\b(sanitize|sanitization|escape|escaping)\s+(input|output|html|sql)\b/i,
  /\b(validate|validation)\s+(input|user\s+input|form|data)\b/i,
  /\b(whitelist|allowlist|blacklist|blocklist)\s+(validation|filter)\b/i,
  /\b(parameterized|prepared)\s+(query|statement)\b/i,
  /\b(content\s+security\s+policy|csp|cors|same-?origin)\b/i,
  // Security Headers & Config
  /\b(security\s+header|http\s+header)\s+(config|setup|add)\b/i,
  /\b(hsts|x-frame-options|x-content-type|x-xss-protection)\b/i,
  /\b(helmet|secure\s+headers|security\s+middleware)\b/i,
  // Rate Limiting & DDoS
  /\b(rate\s+limit|throttle|throttling)\s+(api|endpoint|request)\b/i,
  /\b(ddos|dos|brute\s*force)\s+(protection|prevention|attack)\b/i,
  /\b(captcha|recaptcha|hcaptcha|bot\s+protection)\b/i,
  /\b(ip\s+block|ban|blacklist|firewall)\s+(rule|config)\b/i,
  // Compliance & Standards
  /\b(gdpr|ccpa|hipaa|pci-?dss|soc\s*2|iso\s*27001)\b/i,
  /\b(data\s+privacy|privacy\s+policy|cookie\s+consent)\b/i,
  /\b(audit\s+log|security\s+log|access\s+log)\b/i,
  /\b(penetration\s+test|pentest|security\s+audit|vulnerability\s+scan)\b/i,
  /\b(secure\s+coding|security\s+best\s+practice|security\s+review)\b/i,

  // ============================================
  // 💰 BUSINESS & MONETIZATION (50 patterns)
  // Payments, subscriptions, pricing, revenue
  // ============================================
  // Payment Integration
  /\b(payment|pay|checkout)\s+(integration|gateway|processing|system)\b/i,
  /\b(stripe|paypal|braintree|square|adyen|mollie)\s+(integration|setup|api)\b/i,
  /\b(credit\s+card|debit\s+card|card\s+payment)\s+(form|processing|validation)\b/i,
  /\b(accept|process|collect)\s+(payment|credit\s+card|money)\b/i,
  /\b(payment\s+form|checkout\s+page|payment\s+modal)\b/i,
  /\b(pci|pci-?dss)\s+(compliance|compliant)\b/i,
  /\b(apple\s+pay|google\s+pay|samsung\s+pay|digital\s+wallet)\b/i,
  /\b(ach|bank\s+transfer|wire\s+transfer|direct\s+debit)\b/i,
  /\b(crypto|bitcoin|ethereum|web3)\s+(payment|checkout)\b/i,
  // Subscriptions & Recurring
  /\b(subscription|recurring)\s+(billing|payment|model|management)\b/i,
  /\b(stripe\s+subscription|stripe\s+billing|recurring\s+charge)\b/i,
  /\b(plan|tier|pricing\s+tier)\s+(management|setup|create)\b/i,
  /\b(free\s+trial|trial\s+period|freemium)\b/i,
  /\b(upgrade|downgrade)\s+(plan|subscription|tier)\b/i,
  /\b(cancel|pause|resume)\s+subscription\b/i,
  /\b(prorate|prorated|proration)\s+(billing|charge)\b/i,
  /\b(billing\s+cycle|renewal|auto-?renew)\b/i,
  // Pricing & Plans
  /\b(pricing\s+page|pricing\s+table|pricing\s+component)\b/i,
  /\b(pricing\s+model|pricing\s+strategy|monetization\s+strategy)\b/i,
  /\b(per-?seat|per-?user|usage-?based|flat-?rate)\s+(pricing|billing)\b/i,
  /\b(discount|coupon|promo\s*code|voucher)\s+(system|code|apply)\b/i,
  /\b(volume\s+discount|bulk\s+pricing|tiered\s+pricing)\b/i,
  // Invoicing & Billing
  /\b(invoice|invoicing)\s+(system|generation|template|pdf)\b/i,
  /\b(billing\s+history|payment\s+history|transaction\s+history)\b/i,
  /\b(receipt|billing\s+email|payment\s+confirmation)\b/i,
  /\b(tax|vat|sales\s+tax|tax\s+calculation)\b/i,
  /\b(stripe\s+invoice|automated\s+invoice)\b/i,
  // Revenue & Analytics
  /\b(revenue|mrr|arr|monthly\s+recurring|annual\s+recurring)\b/i,
  /\b(churn|churn\s+rate|customer\s+retention|ltv|lifetime\s+value)\b/i,
  /\b(conversion|conversion\s+rate|funnel|sales\s+funnel)\b/i,
  /\b(revenue\s+dashboard|billing\s+dashboard|financial\s+report)\b/i,
  // Refunds & Disputes
  /\b(refund|refunding|money\s+back)\s+(process|policy|implement)\b/i,
  /\b(dispute|chargeback|payment\s+dispute)\s+(handling|management)\b/i,
  /\b(failed\s+payment|payment\s+failure|retry\s+payment)\b/i,
  // Marketplace & Platform
  /\b(marketplace|multi-?vendor)\s+(payment|payout|split)\b/i,
  /\b(stripe\s+connect|platform\s+fee|commission)\b/i,
  /\b(payout|vendor\s+payout|seller\s+payment)\b/i,
  /\b(escrow|hold\s+funds|release\s+payment)\b/i,
  // E-commerce specific
  /\b(shopping\s+cart|cart\s+system|add\s+to\s+cart)\b/i,
  /\b(checkout\s+flow|checkout\s+process|one-?click\s+checkout)\b/i,
  /\b(order|order\s+management|order\s+status|order\s+tracking)\b/i,
  /\b(abandoned\s+cart|cart\s+recovery|cart\s+reminder)\b/i,

  // ============================================
  // 📱 MOBILE APP DEVELOPMENT (50 patterns)
  // React Native, Flutter, PWA, native
  // ============================================
  // React Native
  /\b(react\s+native|rn|expo)\s+(app|project|setup|config|help)\b/i,
  /\b(build|create|develop)\s+(a\s+)?react\s+native\s+app\b/i,
  /\b(react\s+native)\s+(component|screen|navigation|state|style)\b/i,
  /\b(expo\s+cli|eas\s+build|expo\s+go|expo\s+router)\b/i,
  /\b(react\s+native)\s+(ios|android|cross-?platform)\b/i,
  /\breact\s+navigation\b/i,
  // Flutter
  /\b(flutter|dart)\s+(app|project|setup|widget|help)\b/i,
  /\b(build|create|develop)\s+(a\s+)?flutter\s+app\b/i,
  /\b(flutter)\s+(widget|screen|state|provider|bloc|riverpod)\b/i,
  /\b(flutter\s+web|flutter\s+desktop|flutter\s+for)\b/i,
  /\bflutter\s+(doctor|pub|build|run)\b/i,
  // PWA & Web Apps
  /\b(pwa|progressive\s+web\s+app)\b/i,
  /\b(service\s+worker|workbox|cache\s+api)\b/i,
  /\b(manifest\.json|web\s+app\s+manifest)\b/i,
  /\b(offline|offline-?first|offline\s+support|offline\s+mode)\b/i,
  /\b(install\s+prompt|add\s+to\s+home\s+screen|a2hs)\b/i,
  /\b(push\s+notification|web\s+push)\s+(setup|implement)\b/i,
  // Native iOS
  /\b(ios|iphone|ipad)\s+(app|development|project)\b/i,
  /\b(swift|swiftui|uikit|storyboard|xcode)\b/i,
  /\b(cocoapods|swift\s+package|spm)\b/i,
  /\b(app\s+store|testflight|ios\s+deploy)\b/i,
  // Native Android
  /\b(android)\s+(app|development|project|studio)\b/i,
  /\b(kotlin|java)\s+(android|mobile)\b/i,
  /\b(jetpack\s+compose|android\s+compose|xml\s+layout)\b/i,
  /\b(gradle|play\s+store|android\s+deploy)\b/i,
  // Cross-platform general
  /\b(cross-?platform|multi-?platform)\s+(app|mobile|development)\b/i,
  /\b(mobile\s+app|native\s+app|hybrid\s+app)\b/i,
  /\b(capacitor|ionic|cordova|phonegap)\b/i,
  /\b(tauri|electron)\s+(mobile|app)\b/i,
  // Mobile UI/UX
  /\b(mobile)\s+(ui|ux|design|layout|responsive)\b/i,
  /\b(touch|gesture|swipe|tap|pinch)\s+(event|handler|detection)\b/i,
  /\b(bottom\s+nav|tab\s+bar|drawer|modal)\s+(mobile|app)\b/i,
  /\b(mobile\s+menu|hamburger\s+menu|mobile\s+navigation)\b/i,
  // Mobile Features
  /\b(camera|photo|gallery)\s+(access|picker|capture)\s+(mobile|app)\b/i,
  /\b(geolocation|gps|location)\s+(mobile|app|tracking)\b/i,
  /\b(push\s+notification|local\s+notification|fcm|apns)\b/i,
  /\b(biometric|face\s+id|touch\s+id|fingerprint)\s+(auth|login)\b/i,
  /\b(deep\s+link|universal\s+link|app\s+link)\b/i,
  /\b(in-?app\s+purchase|iap|mobile\s+payment)\b/i,
  // App Store
  /\b(app\s+store|play\s+store)\s+(submission|review|publish|deploy)\b/i,
  /\b(app\s+signing|code\s+signing|provisioning\s+profile)\b/i,
  /\b(app\s+icon|splash\s+screen|launch\s+screen)\b/i,
  /\b(app\s+review|store\s+rejection|app\s+guidelines)\b/i,

  // ============================================
  // 🤖 AI/ML FEATURES (60 patterns)
  // Chatbots, recommendations, ML, NLP
  // ============================================
  // Chatbots & Conversational AI
  /\b(chatbot|chat\s+bot|conversational\s+ai)\s+(build|create|implement)\b/i,
  /\b(build|create|add)\s+(a\s+)?(chatbot|ai\s+assistant|virtual\s+assistant)\b/i,
  /\b(openai|gpt|claude|anthropic|gemini)\s+(api|integration|chatbot)\b/i,
  /\b(langchain|llamaindex|semantic\s+kernel)\b/i,
  /\b(prompt|prompting|prompt\s+engineering|system\s+prompt)\b/i,
  /\b(chat\s+completion|message\s+history|conversation\s+context)\b/i,
  /\b(streaming|stream\s+response|sse)\s+(chat|response|api)\b/i,
  /\b(function\s+calling|tool\s+use|agent|agentic)\b/i,
  // RAG & Knowledge
  /\b(rag|retrieval\s+augmented|knowledge\s+base)\b/i,
  /\b(vector\s+database|vectordb|embedding|embeddings)\b/i,
  /\b(pinecone|weaviate|qdrant|chroma|milvus|pgvector)\b/i,
  /\b(document\s+qa|pdf\s+chat|chat\s+with\s+docs)\b/i,
  /\b(semantic\s+search|similarity\s+search|nearest\s+neighbor)\b/i,
  /\b(chunk|chunking|text\s+splitting|document\s+parsing)\b/i,
  // Recommendations
  /\b(recommendation|recommender)\s+(system|engine|algorithm)\b/i,
  /\b(personalization|personalized)\s+(content|feed|experience)\b/i,
  /\b(collaborative\s+filtering|content-?based\s+filtering)\b/i,
  /\b(similar\s+items?|related\s+products?|you\s+may\s+like)\b/i,
  // NLP & Text
  /\b(nlp|natural\s+language)\s+(processing|understanding|model)\b/i,
  /\b(sentiment|sentiment\s+analysis|opinion\s+mining)\b/i,
  /\b(text\s+classification|categorization|topic\s+modeling)\b/i,
  /\b(named\s+entity|ner|entity\s+extraction)\b/i,
  /\b(summarization|summarize|tldr|summary\s+generation)\b/i,
  /\b(translation|translate|multi-?lingual|language\s+detection)\b/i,
  /\b(spell\s+check|grammar\s+check|autocorrect)\b/i,
  // Computer Vision
  /\b(computer\s+vision|image\s+recognition|object\s+detection)\b/i,
  /\b(ocr|optical\s+character|text\s+recognition|text\s+extraction)\b/i,
  /\b(face\s+detection|face\s+recognition|facial\s+analysis)\b/i,
  /\b(image\s+classification|image\s+tagging|visual\s+search)\b/i,
  /\b(yolo|tensorflow|pytorch|opencv)\s+(model|detection)\b/i,
  // Speech & Audio
  /\b(speech\s+to\s+text|stt|transcription|whisper)\b/i,
  /\b(text\s+to\s+speech|tts|voice\s+synthesis|elevenlabs)\b/i,
  /\b(voice\s+assistant|voice\s+command|voice\s+interface)\b/i,
  /\b(audio\s+processing|audio\s+analysis|sound\s+detection)\b/i,
  // ML Models & Training
  /\b(machine\s+learning|ml)\s+(model|pipeline|training)\b/i,
  /\b(train|fine-?tune|finetune)\s+(a\s+)?(model|llm|gpt)\b/i,
  /\b(tensorflow|pytorch|keras|scikit-?learn|huggingface)\b/i,
  /\b(model\s+deployment|ml\s+ops|mlops|model\s+serving)\b/i,
  /\b(inference|prediction|predict)\s+(api|endpoint|service)\b/i,
  // AI Image/Video
  /\b(ai\s+image|image\s+generation|stable\s+diffusion|midjourney|dall-?e)\b/i,
  /\b(ai\s+video|video\s+generation|sora|runway|pika)\b/i,
  /\b(ai\s+avatar|virtual\s+avatar|digital\s+human)\b/i,
  /\b(image\s+editing|inpainting|outpainting|upscaling)\s+ai\b/i,
  // Automation
  /\b(ai\s+automation|automate\s+with\s+ai|ai\s+workflow)\b/i,
  /\b(ai\s+agent|autonomous\s+agent|multi-?agent)\b/i,
  /\b(copilot|ai\s+copilot|coding\s+assistant)\b/i,
  /\b(ai\s+email|ai\s+writing|content\s+generation)\b/i,

  // ============================================
  // 🛒 E-COMMERCE (50 patterns)
  // Shopping, checkout, inventory, orders
  // ============================================
  // Product Management
  /\b(product)\s+(catalog|listing|management|page|detail)\b/i,
  /\b(add|create|manage)\s+(product|inventory|stock)\b/i,
  /\b(product\s+variant|sku|product\s+option|size|color)\b/i,
  /\b(product\s+image|product\s+gallery|zoom|carousel)\b/i,
  /\b(product\s+description|product\s+spec|product\s+attribute)\b/i,
  /\b(category|collection|product\s+category|taxonomy)\b/i,
  /\b(product\s+search|filter|sort|faceted\s+search)\b/i,
  /\b(related\s+product|upsell|cross-?sell)\b/i,
  // Shopping Cart
  /\b(shopping\s+cart|cart\s+page|cart\s+drawer|mini\s+cart)\b/i,
  /\b(add\s+to\s+cart|remove\s+from\s+cart|update\s+cart)\b/i,
  /\b(cart\s+total|cart\s+quantity|cart\s+item)\b/i,
  /\b(save\s+for\s+later|wishlist|favorites)\b/i,
  /\b(guest\s+cart|persistent\s+cart|cart\s+sync)\b/i,
  // Checkout
  /\b(checkout\s+page|checkout\s+flow|checkout\s+form)\b/i,
  /\b(guest\s+checkout|express\s+checkout|one-?page\s+checkout)\b/i,
  /\b(shipping\s+address|billing\s+address|address\s+form)\b/i,
  /\b(shipping\s+method|shipping\s+rate|shipping\s+calculator)\b/i,
  /\b(order\s+summary|order\s+review|order\s+confirmation)\b/i,
  // Inventory
  /\b(inventory)\s+(management|tracking|system|control)\b/i,
  /\b(stock|stock\s+level|in\s+stock|out\s+of\s+stock)\b/i,
  /\b(low\s+stock|restock|stock\s+alert|inventory\s+alert)\b/i,
  /\b(warehouse|fulfillment|pick\s+pack|shipping\s+label)\b/i,
  /\b(barcode|sku\s+scan|inventory\s+count)\b/i,
  // Orders
  /\b(order)\s+(management|processing|system|status)\b/i,
  /\b(order\s+history|my\s+orders|order\s+list)\b/i,
  /\b(order\s+tracking|shipment\s+tracking|delivery\s+status)\b/i,
  /\b(order\s+fulfillment|ship\s+order|process\s+order)\b/i,
  /\b(order\s+notification|order\s+email|order\s+confirmation\s+email)\b/i,
  // Returns & Refunds
  /\b(return|returns)\s+(policy|request|process|management)\b/i,
  /\b(refund|refund\s+request|process\s+refund)\b/i,
  /\b(exchange|product\s+exchange|swap)\b/i,
  /\b(rma|return\s+authorization|return\s+label)\b/i,
  // Discounts & Promotions
  /\b(discount|discount\s+code|coupon|promo)\b/i,
  /\b(sale|flash\s+sale|clearance|special\s+offer)\b/i,
  /\b(bundle|bundle\s+deal|buy\s+one\s+get|bogo)\b/i,
  /\b(loyalty|reward|points|loyalty\s+program)\b/i,
  /\b(gift\s+card|store\s+credit|voucher)\b/i,
  // E-commerce Platforms
  /\b(shopify|woocommerce|magento|bigcommerce)\s+(theme|app|integration)\b/i,
  /\b(headless\s+commerce|composable\s+commerce)\b/i,
  /\b(medusa|saleor|vendure|commercejs)\b/i,
  /\b(stripe\s+checkout|paypal\s+checkout)\b/i,

  // ============================================
  // ⚡ REAL-TIME & WEBSOCKET (40 patterns)
  // Chat, notifications, live updates
  // ============================================
  // WebSocket basics
  /\b(websocket|ws|wss)\s+(connection|server|client|setup)\b/i,
  /\b(real-?time|realtime)\s+(update|data|sync|communication)\b/i,
  /\b(socket\.?io|pusher|ably|supabase\s+realtime)\b/i,
  /\b(ws\s+connection|persistent\s+connection|long-?polling)\b/i,
  // Chat & Messaging
  /\b(chat|messaging)\s+(app|feature|system|room)\b/i,
  /\b(real-?time\s+chat|live\s+chat|instant\s+messaging)\b/i,
  /\b(chat\s+room|group\s+chat|private\s+chat|dm)\b/i,
  /\b(message|send\s+message|receive\s+message)\s+(real-?time)\b/i,
  /\b(typing\s+indicator|online\s+status|presence)\b/i,
  /\b(read\s+receipt|message\s+seen|delivered)\b/i,
  /\b(chat\s+history|message\s+history|conversation)\b/i,
  // Notifications
  /\b(notification|notify)\s+(system|service|real-?time)\b/i,
  /\b(push\s+notification|in-?app\s+notification|toast)\b/i,
  /\b(notification\s+center|notification\s+bell|unread\s+count)\b/i,
  /\b(fcm|firebase\s+cloud\s+messaging|apns|web\s+push)\b/i,
  /\b(subscribe|subscription)\s+(notification|event|channel)\b/i,
  // Live Updates
  /\b(live\s+update|live\s+feed|live\s+data|live\s+stream)\b/i,
  /\b(real-?time\s+dashboard|live\s+dashboard|live\s+metrics)\b/i,
  /\b(live\s+collaboration|collaborative\s+editing|multiplayer)\b/i,
  /\b(cursor|presence|who's\s+online|active\s+users)\b/i,
  // Sync & State
  /\b(sync|synchronize)\s+(data|state|real-?time)\b/i,
  /\b(optimistic\s+update|conflict\s+resolution|crdt)\b/i,
  /\b(event\s+sourcing|cqrs|event-?driven)\b/i,
  /\b(pub\s*sub|publish\s+subscribe|message\s+queue|event\s+bus)\b/i,
  // Streaming
  /\b(server-?sent\s+events|sse|event\s+stream)\b/i,
  /\b(stream|streaming)\s+(data|response|api)\b/i,
  /\b(live\s+video|video\s+stream|webrtc|hls)\b/i,
  /\b(audio\s+stream|voice\s+chat|video\s+call)\b/i,

  // ============================================
  // 🗄️ DATABASE DEEP DIVE (50 patterns)
  // Queries, optimization, modeling
  // ============================================
  // SQL Databases
  /\b(postgres|postgresql|mysql|mariadb|sqlite)\s+(query|schema|migration|help)\b/i,
  /\b(sql)\s+(query|join|subquery|optimization|index)\b/i,
  /\b(select|insert|update|delete)\s+(query|statement|from|into)\b/i,
  /\b(join|inner\s+join|left\s+join|right\s+join|full\s+join)\b/i,
  /\b(where|having|group\s+by|order\s+by|limit|offset)\b/i,
  /\b(aggregate|count|sum|avg|max|min)\s+(function|query)\b/i,
  // NoSQL Databases
  /\b(mongodb|mongo)\s+(query|schema|aggregation|pipeline)\b/i,
  /\b(nosql|document\s+database|collection)\b/i,
  /\b(redis|memcached|cache|key-?value)\b/i,
  /\b(dynamodb|cosmosdb|couchdb|cassandra)\b/i,
  /\b(firebase|firestore)\s+(query|rules|collection|document)\b/i,
  // ORMs & Query Builders
  /\b(prisma|drizzle|typeorm|sequelize|knex)\s+(schema|query|migration)\b/i,
  /\b(orm|object\s+relational|data\s+mapper)\b/i,
  /\b(raw\s+sql|raw\s+query|sql\s+injection\s+safe)\b/i,
  // Schema & Modeling
  /\b(database\s+schema|data\s+model|erd|entity\s+relationship)\b/i,
  /\b(table|column|field|constraint|foreign\s+key|primary\s+key)\b/i,
  /\b(one-?to-?one|one-?to-?many|many-?to-?many)\s+(relation|relationship)\b/i,
  /\b(normalize|normalization|denormalize|denormalization)\b/i,
  /\b(migration|database\s+migration|schema\s+change|alter\s+table)\b/i,
  // Optimization
  /\b(database\s+optimization|query\s+optimization|slow\s+query)\b/i,
  /\b(index|indexing|create\s+index|compound\s+index)\b/i,
  /\b(explain|query\s+plan|execution\s+plan|analyze)\b/i,
  /\b(n\+1|n\+1\s+query|eager\s+load|lazy\s+load)\b/i,
  /\b(database\s+performance|query\s+performance|bottleneck)\b/i,
  // Transactions & ACID
  /\b(transaction|commit|rollback|savepoint)\b/i,
  /\b(acid|atomicity|consistency|isolation|durability)\b/i,
  /\b(deadlock|race\s+condition|locking|row\s+lock)\b/i,
  /\b(isolation\s+level|read\s+committed|serializable)\b/i,
  // Backup & Recovery
  /\b(database\s+backup|backup|restore|recovery)\b/i,
  /\b(replication|replica|master-?slave|primary-?replica)\b/i,
  /\b(point\s+in\s+time|pitr|disaster\s+recovery)\b/i,
  /\b(database\s+dump|pg_dump|mysqldump|export)\b/i,
  // Cloud Databases
  /\b(supabase|planetscale|neon|turso|railway)\s+(database|postgres)\b/i,
  /\b(rds|aurora|cloud\s+sql|azure\s+sql)\b/i,
  /\b(connection\s+pool|pgbouncer|pooling)\b/i,
  /\b(serverless\s+database|edge\s+database)\b/i,

  // ============================================
  // 📊 ANALYTICS & MONITORING (35 patterns)
  // Tracking, metrics, observability
  // ============================================
  // Web Analytics
  /\b(analytics|tracking)\s+(setup|implement|integrate)\b/i,
  /\b(google\s+analytics|ga4|gtag|google\s+tag\s+manager)\b/i,
  /\b(plausible|fathom|umami|matomo|simple\s+analytics)\b/i,
  /\b(page\s+view|session|bounce\s+rate|conversion)\s+(track|event)\b/i,
  /\b(event\s+tracking|custom\s+event|track\s+event)\b/i,
  /\b(utm|campaign\s+tracking|attribution|referrer)\b/i,
  // Product Analytics
  /\b(mixpanel|amplitude|posthog|heap)\s+(setup|event|tracking)\b/i,
  /\b(user\s+behavior|user\s+journey|funnel|cohort)\b/i,
  /\b(session\s+replay|heatmap|click\s+map|scroll\s+map)\b/i,
  /\b(a\/b\s+test|split\s+test|experiment|feature\s+flag)\b/i,
  /\b(hotjar|fullstory|clarity|logrocket)\b/i,
  // Error Tracking
  /\b(error\s+tracking|error\s+monitoring|exception\s+tracking)\b/i,
  /\b(sentry|bugsnag|rollbar|raygun)\s+(setup|integration)\b/i,
  /\b(crash\s+report|error\s+report|stack\s+trace)\s+(capture|log)\b/i,
  /\b(source\s+map|error\s+context|breadcrumb)\b/i,
  // APM & Performance
  /\b(apm|application\s+performance|performance\s+monitoring)\b/i,
  /\b(datadog|new\s+relic|dynatrace|elastic\s+apm)\b/i,
  /\b(latency|response\s+time|throughput|p99|percentile)\b/i,
  /\b(trace|tracing|distributed\s+tracing|opentelemetry)\b/i,
  /\b(span|trace\s+id|correlation\s+id)\b/i,
  // Logging
  /\b(logging|log)\s+(system|setup|framework|aggregation)\b/i,
  /\b(winston|pino|bunyan|morgan)\s+(logger|setup)\b/i,
  /\b(log\s+level|debug|info|warn|error)\s+(log|logging)\b/i,
  /\b(structured\s+log|json\s+log|log\s+format)\b/i,
  /\b(elk|elasticsearch|logstash|kibana|grafana\s+loki)\b/i,
  // Metrics & Dashboards
  /\b(metric|metrics)\s+(collection|dashboard|visualization)\b/i,
  /\b(prometheus|grafana|influxdb|telegraf)\b/i,
  /\b(custom\s+metric|counter|gauge|histogram)\b/i,
  /\b(dashboard|monitoring\s+dashboard|status\s+page)\b/i,
  // Alerting
  /\b(alert|alerting)\s+(rule|threshold|notification|system)\b/i,
  /\b(pagerduty|opsgenie|victorops|incident)\b/i,
  /\b(on-?call|escalation|incident\s+management)\b/i,

  // ============================================
  // ♿ ACCESSIBILITY (25 patterns)
  // A11y compliance, WCAG, screen readers
  // ============================================
  /\b(accessibility|a11y)\s+(audit|check|test|fix|improve)\b/i,
  /\b(wcag|section\s+508|ada)\s+(compliance|compliant|guideline)\b/i,
  /\b(screen\s+reader|voiceover|nvda|jaws)\s+(support|compatible)\b/i,
  /\b(aria|aria-?label|aria-?describedby|role)\b/i,
  /\b(alt\s+text|image\s+alt|alt\s+attribute)\b/i,
  /\b(keyboard|keyboard\s+navigation|focus|tab\s+order|focus\s+trap)\b/i,
  /\b(color\s+contrast|contrast\s+ratio|contrast\s+check)\b/i,
  /\b(skip\s+link|skip\s+navigation|landmark)\b/i,
  /\b(semantic\s+html|semantic\s+markup|heading\s+structure)\b/i,
  /\b(form\s+label|input\s+label|label\s+for)\b/i,
  /\b(accessible|inaccessible)\s+(component|form|modal|menu)\b/i,
  /\b(assistive\s+technology|at|screen\s+magnifier)\b/i,
  /\b(axe|lighthouse|wave)\s+(accessibility|audit|test)\b/i,
  /\b(reduced\s+motion|prefers-?reduced-?motion)\b/i,
  /\b(high\s+contrast|dark\s+mode|color\s+blind)\b/i,

  // ============================================
  // 🌍 INTERNATIONALIZATION (25 patterns)
  // i18n, localization, translations
  // ============================================
  /\b(i18n|internationalization|internationalize)\b/i,
  /\b(l10n|localization|localize)\s+(setup|implement|add)\b/i,
  /\b(translation|translate)\s+(file|string|text|app)\b/i,
  /\b(multi-?language|multi-?lingual|language\s+support)\b/i,
  /\b(locale|language\s+switch|language\s+selector)\b/i,
  /\b(next-?intl|react-?i18next|i18next|formatjs)\b/i,
  /\b(translation\s+key|message\s+id|translation\s+string)\b/i,
  /\b(rtl|right-?to-?left|arabic|hebrew)\s+(support|layout)\b/i,
  /\b(date\s+format|number\s+format|currency\s+format)\s+(locale|i18n)\b/i,
  /\b(plural|pluralization|singular|plural\s+form)\b/i,
  /\b(translation\s+management|crowdin|lokalise|phrase)\b/i,
  /\b(language\s+detection|browser\s+language|accept-?language)\b/i,
  /\b(country|region|timezone)\s+(detection|selector|support)\b/i,

  // ============================================
  // 🔍 SEO (25 patterns)
  // Search optimization, meta tags, structured data
  // ============================================
  /\b(seo|search\s+engine)\s+(optimization|optimize|improve|audit)\b/i,
  /\b(meta\s+tag|meta\s+description|title\s+tag|og\s+tag)\b/i,
  /\b(sitemap|sitemap\.xml|robots\.txt|canonical)\b/i,
  /\b(structured\s+data|schema\.org|json-?ld|rich\s+snippet)\b/i,
  /\b(google\s+search|bing|search\s+ranking|serp)\b/i,
  /\b(keyword|keyword\s+research|keyword\s+density)\b/i,
  /\b(backlink|internal\s+link|anchor\s+text)\b/i,
  /\b(page\s+speed|core\s+web\s+vitals|lcp|fid|cls)\b/i,
  /\b(crawl|crawler|googlebot|indexing)\b/i,
  /\b(next\/head|react\s+helmet|next-?seo)\b/i,
  /\b(open\s+graph|twitter\s+card|social\s+meta)\b/i,
  /\b(search\s+console|webmaster|submit\s+url)\b/i,
  /\b(redirect|301|302|canonical\s+url)\b/i,

  // ============================================
  // 📁 FILE HANDLING & MEDIA (30 patterns)
  // Uploads, processing, storage
  // ============================================
  /\b(file\s+upload|upload\s+file|file\s+input)\b/i,
  /\b(drag\s+drop|dropzone|file\s+picker)\s+(upload)?\b/i,
  /\b(multipart|form-?data|file\s+form)\b/i,
  /\b(upload\s+progress|progress\s+bar|upload\s+status)\b/i,
  /\b(file\s+validation|file\s+type|file\s+size)\s+(check|limit)\b/i,
  /\b(image\s+upload|photo\s+upload|profile\s+picture)\b/i,
  /\b(pdf\s+upload|document\s+upload|file\s+attachment)\b/i,
  /\b(s3|cloudinary|uploadthing|supabase\s+storage)\b/i,
  /\b(presigned\s+url|signed\s+url|direct\s+upload)\b/i,
  /\b(cdn|content\s+delivery|edge\s+caching)\b/i,
  // Image Processing
  /\b(image\s+resize|resize\s+image|thumbnail|crop)\b/i,
  /\b(image\s+optimization|optimize\s+image|compress\s+image)\b/i,
  /\b(webp|avif|image\s+format|image\s+conversion)\b/i,
  /\b(sharp|jimp|imagemagick)\s+(resize|process)\b/i,
  /\b(responsive\s+image|srcset|picture\s+element)\b/i,
  /\b(lazy\s+load|lazy\s+loading)\s+(image|picture)\b/i,
  /\b(blur\s+hash|placeholder|lqip|progressive)\b/i,
  // Video & Audio
  /\b(video\s+upload|video\s+player|video\s+streaming)\b/i,
  /\b(hls|dash|adaptive\s+bitrate|video\s+encoding)\b/i,
  /\b(ffmpeg|video\s+transcode|video\s+convert)\b/i,
  /\b(audio\s+upload|audio\s+player|podcast)\b/i,
  /\b(mux|cloudflare\s+stream|bunny\.net)\b/i,

  // ============================================
  // ⏰ BACKGROUND JOBS & QUEUES (25 patterns)
  // Workers, cron, scheduled tasks
  // ============================================
  /\b(background\s+job|async\s+job|job\s+queue)\b/i,
  /\b(queue|message\s+queue|task\s+queue)\b/i,
  /\b(bullmq|bull|sidekiq|celery|resque)\b/i,
  /\b(redis\s+queue|sqs|rabbitmq|kafka)\b/i,
  /\b(worker|job\s+worker|queue\s+worker)\b/i,
  /\b(cron|cron\s+job|scheduled\s+task|scheduler)\b/i,
  /\b(vercel\s+cron|github\s+actions\s+schedule|cron\s+trigger)\b/i,
  /\b(retry|retry\s+logic|exponential\s+backoff)\b/i,
  /\b(dead\s+letter|dlq|failed\s+job|job\s+failure)\b/i,
  /\b(job\s+status|job\s+progress|job\s+result)\b/i,
  /\b(batch|batch\s+job|bulk\s+process)\b/i,
  /\b(inngest|trigger\.dev|quirrel|qstash)\b/i,
  /\b(webhook\s+queue|event\s+queue|async\s+processing)\b/i,

  // ============================================
  // 🔎 SEARCH (25 patterns)
  // Full-text search, Elasticsearch, Algolia
  // ============================================
  /\b(search|search\s+feature|search\s+functionality)\s+(implement|add|build)\b/i,
  /\b(full-?text\s+search|text\s+search|fuzzy\s+search)\b/i,
  /\b(elasticsearch|elastic|opensearch)\s+(index|query|setup)\b/i,
  /\b(algolia|meilisearch|typesense)\s+(setup|index|search)\b/i,
  /\b(search\s+index|indexing|reindex)\b/i,
  /\b(autocomplete|typeahead|search\s+suggest|instant\s+search)\b/i,
  /\b(facet|filter|faceted\s+search|refinement)\b/i,
  /\b(search\s+result|search\s+ranking|relevance)\b/i,
  /\b(postgres\s+search|pg_trgm|tsvector|gin\s+index)\b/i,
  /\b(search\s+bar|search\s+input|search\s+ui)\b/i,
  /\b(highlight|search\s+highlight|match\s+highlight)\b/i,

  // ============================================
  // 👥 SOCIAL FEATURES (25 patterns)
  // Sharing, feeds, follows, likes
  // ============================================
  /\b(social\s+share|share\s+button|share\s+link)\b/i,
  /\b(share\s+to|share\s+on)\s+(twitter|facebook|linkedin|whatsapp)\b/i,
  /\b(activity\s+feed|news\s+feed|timeline)\b/i,
  /\b(follow|following|follower|unfollow)\s+(system|feature|button)\b/i,
  /\b(like|unlike|heart|upvote|downvote)\s+(button|feature|system)\b/i,
  /\b(comment|comments?)\s+(section|system|feature|thread)\b/i,
  /\b(mention|@mention|tag\s+user|notify\s+user)\b/i,
  /\b(social\s+login|oauth\s+login|connect\s+with)\b/i,
  /\b(profile|user\s+profile|public\s+profile)\b/i,
  /\b(avatar|profile\s+picture|bio|username)\b/i,
  /\b(friend|friendship|friend\s+request)\b/i,
  /\b(block|mute|report|moderation)\b/i,
  /\b(notification|notify|alert)\s+(follow|like|comment|mention)\b/i,

  // ============================================
  // 📧 COMMUNICATION (30 patterns)
  // Email, SMS, push notifications
  // ============================================
  // Email
  /\b(send\s+email|email\s+send|transactional\s+email)\b/i,
  /\b(email\s+template|html\s+email|email\s+design)\b/i,
  /\b(resend|sendgrid|postmark|mailgun|ses)\s+(setup|integration|api)\b/i,
  /\b(react\s+email|mjml|email\s+builder)\b/i,
  /\b(email\s+verification|verify\s+email|confirmation\s+email)\b/i,
  /\b(welcome\s+email|onboarding\s+email|drip\s+campaign)\b/i,
  /\b(newsletter|email\s+list|subscribe|unsubscribe)\b/i,
  /\b(email\s+queue|bulk\s+email|email\s+batch)\b/i,
  /\b(email\s+deliverability|spam|dkim|spf|dmarc)\b/i,
  // SMS
  /\b(sms|text\s+message)\s+(send|notification|api)\b/i,
  /\b(twilio|vonage|messagebird|plivo)\s+(sms|setup)\b/i,
  /\b(otp|verification\s+code|sms\s+code)\b/i,
  /\b(phone\s+verification|sms\s+verification)\b/i,
  // Push Notifications
  /\b(push\s+notification|web\s+push|mobile\s+push)\b/i,
  /\b(fcm|firebase\s+messaging|apns|onesignal)\b/i,
  /\b(notification\s+permission|push\s+subscribe)\b/i,
  /\b(push\s+payload|notification\s+data|rich\s+notification)\b/i,
  // In-app
  /\b(in-?app\s+message|announcement|banner|toast)\b/i,
  /\b(intercom|drift|crisp|zendesk\s+chat)\b/i,
  /\b(support\s+chat|live\s+chat|help\s+desk)\b/i,

  // ============================================
  // 🎮 GAMING & INTERACTIVE (25 patterns)
  // Game development, engines, multiplayer
  // ============================================
  // Game Engines
  /\b(unity|unreal|godot|phaser|pixi\.?js)\s+(game|project|setup|help)\b/i,
  /\b(game\s+engine|game\s+framework|2d\s+game|3d\s+game)\b/i,
  /\b(build|create|make|develop)\s+(a\s+)?(game|video\s+game|mobile\s+game)\b/i,
  /\b(unity)\s+(c#|csharp|script|prefab|scene|asset)\b/i,
  /\b(unreal)\s+(blueprint|c\+\+|actor|component)\b/i,
  /\b(godot)\s+(gdscript|node|scene|signal)\b/i,
  // Game Mechanics
  /\b(game\s+loop|update\s+loop|render\s+loop|tick)\b/i,
  /\b(physics|collision|hitbox|rigidbody|raycast)\b/i,
  /\b(sprite|animation|tilemap|parallax|scrolling)\b/i,
  /\b(player\s+controller|character\s+controller|movement)\b/i,
  /\b(enemy\s+ai|pathfinding|a\*|navigation|navmesh)\b/i,
  /\b(inventory|crafting|skill\s+tree|leveling|xp)\b/i,
  /\b(save\s+game|load\s+game|checkpoint|progress)\b/i,
  // Multiplayer & Online
  /\b(multiplayer|netcode|photon|mirror|fishnet)\b/i,
  /\b(game\s+server|dedicated\s+server|matchmaking|lobby)\b/i,
  /\b(leaderboard|high\s+score|ranking|achievement)\b/i,
  /\b(real-?time\s+multiplayer|turn-?based|co-?op)\b/i,
  // Game Assets
  /\b(game\s+art|pixel\s+art|sprite\s+sheet|texture)\b/i,
  /\b(sound\s+effect|sfx|game\s+music|audio\s+loop)\b/i,
  /\b(level\s+design|level\s+editor|procedural\s+generation)\b/i,
  // Web Games
  /\b(html5\s+game|canvas\s+game|webgl|three\.?js\s+game)\b/i,
  /\b(browser\s+game|web\s+game|javascript\s+game)\b/i,

  // ============================================
  // ⛓️ BLOCKCHAIN & WEB3 (25 patterns)
  // Smart contracts, NFTs, DeFi, wallets
  // ============================================
  // Smart Contracts
  /\b(smart\s+contract|solidity|vyper|rust\s+contract)\b/i,
  /\b(ethereum|polygon|solana|avalanche|arbitrum|optimism)\s+(contract|deploy|develop)\b/i,
  /\b(erc-?20|erc-?721|erc-?1155|token\s+standard)\b/i,
  /\b(hardhat|foundry|truffle|remix)\s+(project|deploy|test)\b/i,
  /\b(abi|bytecode|contract\s+verification|etherscan)\b/i,
  /\b(gas|gas\s+optimization|gas\s+fee|gwei)\b/i,
  // NFTs
  /\b(nft|non-?fungible|mint|minting)\b/i,
  /\b(nft\s+marketplace|opensea|rarible|blur)\b/i,
  /\b(nft\s+metadata|ipfs|arweave|token\s+uri)\b/i,
  /\b(nft\s+collection|pfp|generative\s+art)\b/i,
  // DeFi
  /\b(defi|decentralized\s+finance|yield|staking)\b/i,
  /\b(swap|liquidity|pool|amm|uniswap|sushiswap)\b/i,
  /\b(lending|borrowing|aave|compound)\b/i,
  /\b(tokenomics|vesting|airdrop|ico|ido)\b/i,
  // Wallets & Integration
  /\b(wallet|metamask|rainbow|coinbase\s+wallet)\b/i,
  /\b(connect\s+wallet|wallet\s+connect|web3\s+modal)\b/i,
  /\b(ethers\.?js|web3\.?js|viem|wagmi)\b/i,
  /\b(sign\s+message|transaction|approve|transfer)\b/i,
  // Blockchain Data
  /\b(blockchain|on-?chain|off-?chain|oracle|chainlink)\b/i,
  /\b(the\s+graph|subgraph|indexer|blockchain\s+data)\b/i,
  /\b(dao|governance|voting|proposal|multisig)\b/i,

  // ============================================
  // 📝 WORDPRESS & CMS (20 patterns)
  // WordPress, headless CMS, content management
  // ============================================
  // WordPress
  /\b(wordpress|wp)\s+(theme|plugin|site|blog|help)\b/i,
  /\b(wordpress)\s+(develop|customize|install|migrate)\b/i,
  /\b(wp-?admin|wp-?content|wp-?config|functions\.php)\b/i,
  /\b(wordpress\s+theme|theme\s+development|child\s+theme)\b/i,
  /\b(wordpress\s+plugin|plugin\s+development|wp\s+hook)\b/i,
  /\b(gutenberg|block\s+editor|custom\s+block|acf)\b/i,
  /\b(woocommerce|wp\s+ecommerce|wordpress\s+shop)\b/i,
  /\b(wordpress\s+rest\s+api|wp\s+json|headless\s+wordpress)\b/i,
  // Headless CMS
  /\b(headless\s+cms|content\s+management|cms)\b/i,
  /\b(strapi|sanity|contentful|prismic|directus)\b/i,
  /\b(cms\s+api|content\s+api|structured\s+content)\b/i,
  /\b(rich\s+text|markdown\s+editor|wysiwyg)\b/i,
  // Other CMS
  /\b(drupal|joomla|ghost|keystone)\b/i,
  /\b(static\s+site|jamstack|netlify\s+cms)\b/i,
  /\b(blog\s+platform|publishing|content\s+workflow)\b/i,

  // ============================================
  // 🔷 GRAPHQL (20 patterns)
  // Queries, mutations, schemas, clients
  // ============================================
  // Basics
  /\b(graphql)\s+(api|query|mutation|schema|setup)\b/i,
  /\b(graphql)\s+(server|client|endpoint|playground)\b/i,
  /\b(query|mutation|subscription)\s+(graphql)?\b.*\b(write|create|fix)\b/i,
  /\b(gql|graphql\s+tag|tagged\s+template)\b/i,
  // Schema & Types
  /\b(graphql\s+schema|type\s+definition|sdl)\b/i,
  /\b(resolver|field\s+resolver|root\s+resolver)\b/i,
  /\b(input\s+type|enum|interface|union)\s+(graphql)?\b/i,
  /\b(nullable|non-?null|scalar|custom\s+scalar)\b/i,
  // Clients & Tools
  /\b(apollo|apollo\s+client|apollo\s+server)\b/i,
  /\b(urql|relay|graphql-?request)\b/i,
  /\b(graphql\s+codegen|type\s+generation|introspection)\b/i,
  /\b(dataloader|n\+1|batching|caching)\s+(graphql)?\b/i,
  // Advanced
  /\b(federation|subgraph|supergraph|apollo\s+federation)\b/i,
  /\b(persisted\s+query|query\s+complexity|depth\s+limit)\b/i,
  /\b(graphql\s+subscription|real-?time\s+graphql|websocket\s+graphql)\b/i,

  // ============================================
  // 🏗️ MICROSERVICES (20 patterns)
  // Service architecture, messaging, patterns
  // ============================================
  // Architecture
  /\b(microservice|micro-?service)\s+(architecture|design|pattern)\b/i,
  /\b(service-?oriented|soa|distributed\s+system)\b/i,
  /\b(monolith|monolithic)\s+(to\s+microservice|migration|split)\b/i,
  /\b(domain-?driven|ddd|bounded\s+context|aggregate)\b/i,
  // Communication
  /\b(service\s+mesh|istio|linkerd|envoy)\b/i,
  /\b(api\s+gateway|kong|traefik|nginx\s+gateway)\b/i,
  /\b(grpc|protobuf|protocol\s+buffer|rpc)\b/i,
  /\b(message\s+broker|rabbitmq|kafka|nats|redis\s+streams)\b/i,
  /\b(event-?driven|event\s+bus|event\s+sourcing)\b/i,
  // Patterns
  /\b(saga|saga\s+pattern|choreography|orchestration)\b/i,
  /\b(circuit\s+breaker|bulkhead|retry\s+pattern|fallback)\b/i,
  /\b(service\s+discovery|consul|eureka|etcd)\b/i,
  /\b(sidecar|ambassador|anti-?corruption\s+layer)\b/i,
  // Operations
  /\b(distributed\s+tracing|jaeger|zipkin|opentracing)\b/i,
  /\b(health\s+check|readiness|liveness|probe)\b/i,
  /\b(config\s+server|feature\s+toggle|canary\s+deploy)\b/i,

  // ============================================
  // 🖥️ DESKTOP APPS (15 patterns)
  // Electron, Tauri, native features
  // ============================================
  /\b(electron|electron\.?js)\s+(app|project|build|package)\b/i,
  /\b(tauri)\s+(app|project|rust|build)\b/i,
  /\b(desktop\s+app|desktop\s+application|native\s+app)\b/i,
  /\b(build|create|develop)\s+(a\s+)?(desktop|native)\s+app\b/i,
  /\b(electron)\s+(main|renderer|preload|ipc)\b/i,
  /\b(system\s+tray|tray\s+icon|menu\s+bar\s+app)\b/i,
  /\b(native\s+menu|context\s+menu|application\s+menu)\b/i,
  /\b(auto-?update|electron-?updater|app\s+update)\b/i,
  /\b(electron-?builder|electron-?forge|package\s+electron)\b/i,
  /\b(file\s+system|fs\s+access|native\s+file)\s+(desktop)?\b/i,
  /\b(notification|desktop\s+notification|native\s+notification)\b/i,
  /\b(window|browser\s+window|frameless|transparent\s+window)\b/i,
  /\b(dmg|appimage|snap|windows\s+installer|msi|nsis)\b/i,

  // ============================================
  // ⌨️ CLI TOOLS (15 patterns)
  // Command line apps, terminal UI
  // ============================================
  /\b(cli|command\s+line)\s+(app|tool|application|interface)\b/i,
  /\b(build|create|develop)\s+(a\s+)?(cli|command\s+line)\b/i,
  /\b(commander|yargs|meow|oclif|clipanion)\b/i,
  /\b(inquirer|prompts|enquirer)\s+(prompt|question|input)\b/i,
  /\b(terminal\s+ui|tui|blessed|ink|terminal-?kit)\b/i,
  /\b(chalk|colors|ansi|terminal\s+color|colorize)\b/i,
  /\b(ora|spinner|progress|loading)\s+(cli|terminal)?\b/i,
  /\b(argv|argument|flag|option)\s+(parse|parsing|parser)\b/i,
  /\b(cli\s+command|subcommand|command\s+handler)\b/i,
  /\b(stdin|stdout|stderr|pipe|stream)\s+(cli|command)?\b/i,
  /\b(interactive\s+cli|repl|readline)\b/i,
  /\b(npm\s+bin|npx|global\s+install|shebang)\b/i,
  /\b(boxen|figlet|ascii\s+art|banner)\b/i,

  // ============================================
  // 🧩 BROWSER EXTENSIONS (15 patterns)
  // Chrome, Firefox, manifest, scripts
  // ============================================
  /\b(browser\s+extension|chrome\s+extension|firefox\s+extension)\b/i,
  /\b(build|create|develop)\s+(a\s+)?(browser|chrome|firefox)\s+extension\b/i,
  /\b(manifest\.json|manifest\s+v3|mv3|manifest\s+v2)\b/i,
  /\b(content\s+script|background\s+script|service\s+worker)\s+(extension)?\b/i,
  /\b(popup|popup\.html|extension\s+popup|browser\s+action)\b/i,
  /\b(options\s+page|settings\s+page|extension\s+options)\b/i,
  /\b(chrome\.storage|browser\.storage|extension\s+storage)\b/i,
  /\b(chrome\.tabs|browser\.tabs|tab\s+api)\b/i,
  /\b(chrome\.runtime|browser\.runtime|message\s+passing)\b/i,
  /\b(inject\s+script|web\s+accessible|content\s+security)\s+(extension)?\b/i,
  /\b(extension\s+permission|host\s+permission|activeTab)\b/i,
  /\b(chrome\s+web\s+store|firefox\s+add-?on|extension\s+publish)\b/i,
  /\b(webextension|cross-?browser\s+extension|polyfill)\b/i,

  // ============================================
  // 📊 DATA SCIENCE & ANALYTICS (20 patterns)
  // Python data, visualization, notebooks
  // ============================================
  // Data Manipulation
  /\b(pandas|dataframe|series)\s+(python|query|manipulation)?\b/i,
  /\b(numpy|ndarray|array\s+operation|vectorize)\b/i,
  /\b(data\s+cleaning|data\s+wrangling|etl|data\s+pipeline)\b/i,
  /\b(csv|excel|parquet|json)\s+(read|write|parse|process)\b/i,
  /\b(merge|join|concat|pivot|melt)\s+(dataframe|data)?\b/i,
  /\b(groupby|aggregate|rolling|resample)\b/i,
  // Visualization
  /\b(matplotlib|seaborn|plotly|bokeh)\s+(chart|plot|graph)?\b/i,
  /\b(d3|d3\.?js|data\s+visualization|interactive\s+chart)\b/i,
  /\b(chart\.?js|recharts|nivo|victory)\b/i,
  /\b(bar\s+chart|line\s+chart|pie\s+chart|scatter\s+plot|heatmap)\b/i,
  /\b(dashboard|data\s+dashboard|analytics\s+dashboard)\b/i,
  // Notebooks & Tools
  /\b(jupyter|notebook|ipynb|colab)\b/i,
  /\b(jupyterlab|jupyter\s+kernel|notebook\s+server)\b/i,
  /\b(sql\s+query|database\s+query)\s+(analysis|analytics)?\b/i,
  // Statistics
  /\b(statistics|statistical\s+analysis|hypothesis\s+test)\b/i,
  /\b(regression|correlation|distribution|probability)\b/i,
  /\b(scipy|statsmodels|statistical\s+model)\b/i,

  // ============================================
  // 🤖 AUTOMATION & SCRIPTING (15 patterns)
  // Shell, scraping, scheduling
  // ============================================
  /\b(automation|automate)\s+(task|workflow|process|script)\b/i,
  /\b(shell\s+script|bash\s+script|zsh|powershell)\b/i,
  /\b(python\s+script|automation\s+script|scripting)\b/i,
  /\b(puppeteer|playwright)\s+(scrape|automate|browser)?\b/i,
  /\b(web\s+scraping|scraper|crawler|crawling)\b/i,
  /\b(cheerio|beautiful\s*soup|scrapy)\b/i,
  /\b(selenium|webdriver|browser\s+automation)\b/i,
  /\b(make|makefile|task\s+runner|npm\s+script)\b/i,
  /\b(gulp|grunt|just|taskfile)\b/i,
  /\b(cron|scheduled\s+task|recurring\s+job|automation\s+schedule)\b/i,
  /\b(github\s+actions|gitlab\s+ci|automation\s+pipeline)\b/i,
  /\b(zapier|n8n|pipedream|integromat|make\.com)\b/i,
  /\b(rpa|robotic\s+process|ui\s+automation)\b/i,

  // ============================================
  // ⚡ PERFORMANCE & OPTIMIZATION (20 patterns)
  // Speed, bundle size, caching, profiling
  // ============================================
  // Bundle & Build
  /\b(bundle\s+size|chunk|code\s+splitting|tree\s+shaking)\b/i,
  /\b(webpack|vite|rollup|esbuild)\s+(optimize|config|bundle)?\b/i,
  /\b(minify|minification|uglify|terser|compress)\b/i,
  /\b(lazy\s+load|dynamic\s+import|route\s+splitting)\b/i,
  /\b(dead\s+code|unused\s+code|eliminate|purge)\b/i,
  // Runtime Performance
  /\b(performance|optimize|optimization|speed\s+up)\b/i,
  /\b(slow|performance\s+issue|bottleneck|lag)\b/i,
  /\b(memoization|memo|usememo|usecallback|cache)\b/i,
  /\b(virtual\s+list|virtualization|windowing|react-?window)\b/i,
  /\b(debounce|throttle|requestanimationframe|raf)\b/i,
  /\b(web\s+worker|worker\s+thread|offload|background\s+thread)\b/i,
  // Profiling & Measurement
  /\b(profile|profiler|profiling|flame\s+graph)\b/i,
  /\b(lighthouse|pagespeed|performance\s+audit|web\s+vitals)\b/i,
  /\b(memory\s+leak|heap|garbage\s+collection|gc)\b/i,
  /\b(devtools|chrome\s+devtools|performance\s+tab)\b/i,
  // Caching
  /\b(cache|caching)\s+(strategy|layer|invalidation|bust)\b/i,
  /\b(service\s+worker|sw|cache\s+api|stale-?while-?revalidate)\b/i,
  /\b(cdn|edge\s+cache|cloudflare|fastly)\b/i,
  /\b(redis\s+cache|memcached|in-?memory\s+cache)\b/i,

  // ============================================
  // 🎨 DESIGN SYSTEMS (15 patterns)
  // Component libraries, Storybook, tokens
  // ============================================
  /\b(design\s+system|component\s+library|ui\s+library)\b/i,
  /\b(build|create|develop)\s+(a\s+)?design\s+system\b/i,
  /\b(storybook|chromatic|histoire)\b/i,
  /\b(storybook)\s+(story|addon|config|setup)\b/i,
  /\b(design\s+token|css\s+variable|theme\s+token)\b/i,
  /\b(style\s+guide|brand\s+guide|ui\s+documentation)\b/i,
  /\b(atomic\s+design|atom|molecule|organism|template)\b/i,
  /\b(component\s+api|prop|variant|compound\s+component)\b/i,
  /\b(radix|headless\s+ui|reach\s+ui|ariakit)\b/i,
  /\b(shadcn|shadcn\/ui|ui\s+components)\b/i,
  /\b(chakra|material\s+ui|mui|ant\s+design|mantine)\b/i,
  /\b(figma\s+to\s+code|design\s+handoff|design\s+to\s+dev)\b/i,
  /\b(theming|theme\s+provider|dark\s+mode|light\s+mode)\b/i,

  // ============================================
  // 📋 API DESIGN (15 patterns)
  // REST best practices, versioning, docs
  // ============================================
  /\b(api\s+design|rest\s+api|restful)\s+(best\s+practice|design|pattern)?\b/i,
  /\b(api\s+versioning|version\s+api|v1|v2|api\s+version)\b/i,
  /\b(api\s+endpoint|route\s+design|url\s+structure)\b/i,
  /\b(http\s+method|get|post|put|patch|delete)\s+(api|endpoint)?\b/i,
  /\b(status\s+code|http\s+status|error\s+response|api\s+error)\b/i,
  /\b(pagination|cursor|offset|limit|page\s+size)\s+(api)?\b/i,
  /\b(filter|sort|search)\s+(api|query|parameter)?\b/i,
  /\b(api\s+authentication|api\s+key|bearer|oauth)\b/i,
  /\b(rate\s+limit|throttle|quota|api\s+limit)\b/i,
  /\b(openapi|swagger|api\s+spec|api\s+documentation)\b/i,
  /\b(postman|insomnia|api\s+client|api\s+testing)\b/i,
  /\b(hateoas|hypermedia|self-?documenting)\b/i,
  /\b(api\s+gateway|backend\s+for\s+frontend|bff)\b/i,

  // ============================================
  // 🔄 MIGRATION & UPGRADES (15 patterns)
  // Framework migrations, version upgrades
  // ============================================
  /\b(migrate|migration)\s+(from|to)\s+(react|vue|angular|next|nuxt)\b/i,
  /\b(upgrade|update)\s+(react|vue|next|node|typescript)\s+(version)?\b/i,
  /\b(breaking\s+change|deprecation|deprecated|legacy)\b/i,
  /\b(codemod|jscodeshift|ast\s+transform)\b/i,
  /\b(refactor|rewrite|modernize)\s+(legacy|old|codebase)\b/i,
  /\b(class\s+component)\s+(to|into)\s+(function|hook|functional)\b/i,
  /\b(javascript)\s+(to|into)\s+(typescript|ts)\b/i,
  /\b(commonjs|cjs)\s+(to|into)\s+(esm|es\s+module)\b/i,
  /\b(pages\s+router)\s+(to|into)\s+(app\s+router)\b/i,
  /\b(webpack)\s+(to|into)\s+(vite|esbuild|turbopack)\b/i,
  /\b(rest)\s+(to|into)\s+(graphql)\b/i,
  /\b(version\s+bump|major\s+version|minor\s+version)\b/i,
  /\b(backward\s+compatible|backwards\s+compatibility|bc\s+break)\b/i,
  /\b(tech\s+debt|technical\s+debt|code\s+debt)\b/i,
  /\b(sunset|end\s+of\s+life|eol|deprecated\s+api)\b/i,
];

/**
 * Video intent detection patterns
 * Matches requests like "generate/create/make a video/clip/animation..."
 */
const VIDEO_INTENT_PATTERNS = [
  // Direct video generation requests
  /\b(generate|create|make|render|produce)\b.*\b(video|clip|footage|animation|movie|film)\b/i,

  // Reverse order: "video of...", "clip of..."
  /\b(video|clip|footage|animation)\b.*\b(of|showing|depicting|about)\b/i,

  // "Can you create/make a video..."
  /\bcan you\b.*\b(create|generate|make|render)\b.*\b(video|clip|animation)\b/i,

  // "I want/need a video of..."
  /\b(i want|i need|i'd like|give me|show me)\b.*\b(video|clip|animation|footage)\b/i,

  // Sora-specific requests
  /\bsora\b.*\b(video|clip|generate|create)\b/i,
  /\b(use|with)\s+sora\b/i,

  // Cinematic/film requests
  /\b(cinematic|film|movie)\s+(shot|scene|clip|sequence)\b/i,

  // Animate specific content
  /\b(animate|animating)\b.*\b(scene|shot|image|picture|this)\b/i,

  // Emoji prefix pattern (from button)
  /^🎬\s*Generate video:/i,
];

/**
 * Complex task patterns that require GPT-4o
 */
const COMPLEX_TASK_PATTERNS = {
  code: [
    /\b(write|create|fix|debug|refactor|implement|update|modify)\b.*\b(code|function|class|component|file|script)\b/i,
    /\b(github|git|commit|push|pull|merge|pr|pull request)\b/i,
    /\b(typescript|javascript|python|java|rust|go|ruby|php|c\+\+|swift)\b/i,
    /\b(api|endpoint|route|handler|middleware|controller)\b/i,
    /\b(database|sql|query|migration|schema)\b/i,
    /\b(deploy|vercel|supabase|aws|docker|kubernetes)\b/i,
  ],
  research: [
    /\b(research|investigate|analyze|compare|evaluate)\b.*\b(in detail|thoroughly|comprehensive)\b/i,
    /\bsearch\b.*\b(for|about|regarding)\b/i,
    /\b(find|lookup|look up)\b.*\b(information|data|sources|articles)\b/i,
  ],
  fileOperation: [
    /\b(open|read|edit|modify|update|create)\b.*\b(file|document|spreadsheet)\b/i,
    /\b(analyze|process|parse)\b.*\b(csv|xlsx|excel|pdf|json|xml)\b/i,
  ],
  complexReasoning: [
    /\b(explain|analyze|compare|evaluate)\b.*\b(in detail|step by step|thoroughly)\b/i,
    /\bwhat (are|is) the (difference|comparison|pros and cons)\b/i,
    /\b(comprehensive|detailed|thorough)\b.*\b(analysis|explanation|review)\b/i,
  ],
};

/**
 * Parse size from user text
 * Supports formats like "256x256", "512", "1024x1024"
 */
export function parseSizeFromText(text: string): '1024x1024' | '512x512' | '256x256' {
  // Check for explicit size mentions
  if (/\b256\s*x?\s*256\b/i.test(text) || /\b256\b/.test(text)) {
    return '256x256';
  }
  if (/\b512\s*x?\s*512\b/i.test(text) || /\b512\b/.test(text)) {
    return '512x512';
  }
  // Default to 1024x1024 (highest quality)
  return '1024x1024';
}

/**
 * Check if a message indicates video generation intent
 */
export function hasVideoIntent(text: string): { isVideo: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check if this is a document request - these should NOT be videos
  if (isDocumentRequest(normalizedText)) {
    return { isVideo: false };
  }

  // Check for video generation patterns
  for (const pattern of VIDEO_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isVideo: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isVideo: false };
}

/**
 * Check if a message indicates image generation intent
 * IMPORTANT: Document requests are EXCLUDED even if they match image patterns
 */
export function hasImageIntent(text: string): { isImage: boolean; matchedPattern?: string; excludedReason?: string } {
  const normalizedText = text.trim();

  // FIRST: Check if this is a document request - these should NEVER go to DALL-E
  if (isDocumentRequest(normalizedText)) {
    return {
      isImage: false,
      excludedReason: 'document-request'
    };
  }

  // Check for video first - video requests shouldn't route to image
  if (hasVideoIntent(normalizedText).isVideo) {
    return {
      isImage: false,
      excludedReason: 'video-request'
    };
  }

  // Then check for image generation patterns
  for (const pattern of IMAGE_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isImage: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isImage: false };
}

/**
 * Check if a message indicates website/landing page generation intent
 * Enhanced to detect multi-page, cloning, and auth requests
 */
export function hasWebsiteIntent(text: string): {
  isWebsite: boolean;
  isMultiPage: boolean;
  isCloning: boolean;
  hasAuth: boolean;
  matchedPattern?: string;
  cloneUrl?: string;
} {
  const normalizedText = text.trim();

  // Check if this is a document request - documents should not be websites
  if (isDocumentRequest(normalizedText)) {
    return { isWebsite: false, isMultiPage: false, isCloning: false, hasAuth: false };
  }

  // Check for auth intent (user wants login/signup pages)
  const wantsAuth = hasAuthIntent(normalizedText);

  // Check for site cloning patterns first
  for (const pattern of SITE_CLONING_PATTERNS) {
    if (pattern.test(normalizedText)) {
      // Extract URL if present
      const urlMatch = normalizedText.match(/https?:\/\/[^\s]+/);
      return {
        isWebsite: true,
        isMultiPage: false,
        isCloning: true,
        hasAuth: wantsAuth,
        matchedPattern: pattern.source,
        cloneUrl: urlMatch ? urlMatch[0] : undefined
      };
    }
  }

  // Check for multi-page patterns
  let isMultiPage = false;
  for (const pattern of MULTI_PAGE_WEBSITE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      isMultiPage = true;
      break;
    }
  }

  // Check for standard website generation patterns
  for (const pattern of WEBSITE_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isWebsite: true,
        isMultiPage,
        isCloning: false,
        hasAuth: wantsAuth,
        matchedPattern: pattern.source
      };
    }
  }

  // Also check multi-page patterns as website intent
  if (isMultiPage) {
    return {
      isWebsite: true,
      isMultiPage: true,
      isCloning: false,
      hasAuth: wantsAuth,
      matchedPattern: 'multi-page-intent'
    };
  }

  return { isWebsite: false, isMultiPage: false, isCloning: false, hasAuth: false };
}

/**
 * Detect if a message looks like a response to website discovery questions
 * This catches follow-ups like "Business name is X, email is Y, pricing is Z"
 * OR "make up everything for me" / "you decide" type responses
 */
export function isWebsiteDiscoveryResponse(text: string): {
  isDiscoveryResponse: boolean;
  extractedInfo: {
    businessName?: string;
    email?: string;
    hasPricing?: boolean;
    hasStyle?: boolean;
    isAutoGenerate?: boolean;
    location?: string;
  };
} {
  const normalizedText = text.trim();
  const lowerText = normalizedText.toLowerCase();

  // Check for "fill in the blanks" / "make it up" patterns
  // These indicate the user wants AI to generate all the details
  const autoGeneratePatterns = [
    /\b(make\s*up|make\s*it\s*up|you\s*(decide|choose|pick)|fill\s*in|create\s*everything)\b/i,
    /\b(anything|whatever|surprise\s*me|dealer'?s?\s*choice)\b/i,
    /\b(generate|come\s*up\s*with|invent|fabricate)\s*(all|everything|the\s*details?)\b/i,
    /\b(don'?t\s*care|up\s*to\s*you|your\s*choice)\b/i,
  ];

  const isAutoGenerate = autoGeneratePatterns.some(p => p.test(lowerText));

  // Extract location if mentioned (e.g., "located in malvern ny")
  const locationMatch = normalizedText.match(/(?:located?\s*(?:in|at)|in\s+|based\s*(?:in|out\s*of))\s+([A-Za-z\s,]+?)(?:\s*[,.]|$)/i);
  const location = locationMatch?.[1]?.trim();

  // If auto-generate pattern detected, this IS a discovery response
  if (isAutoGenerate) {
    return {
      isDiscoveryResponse: true,
      extractedInfo: {
        isAutoGenerate: true,
        location,
      }
    };
  }

  // Extract potential business name (quoted or capitalized words)
  const quotedName = normalizedText.match(/["']([^"']+)["']/);
  const capitalizedName = normalizedText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  const namedPattern = normalizedText.match(/(?:name\s*(?:is|:)\s*)([^,.\n]+)/i);
  const businessName = quotedName?.[1] || namedPattern?.[1] || capitalizedName?.[1];

  // Extract email
  const emailMatch = normalizedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const hasEmail = !!emailMatch;

  // Check for pricing info (dollar amounts or "per hour", "per session", etc.)
  const hasPricing = /\$\d+|\d+\s*(?:dollars?|per\s*hour|per\s*session|per\s*event|\/hr|\/hour)/i.test(normalizedText);

  // Check for style preferences
  const hasStyle = /\b(modern|minimal|bold|elegant|clean|professional|luxury|sleek|vibrant|colorful|dark|light|simple|fancy|classic|contemporary)\b/i.test(normalizedText);

  // Calculate confidence - if we have 2+ pieces of business info, likely a discovery response
  let infoCount = 0;
  if (businessName && businessName.length > 2) infoCount++;
  if (hasEmail) infoCount++;
  if (hasPricing) infoCount++;
  if (hasStyle) infoCount++;
  if (location && location.length > 2) infoCount++; // Location counts as info too

  // Require at least 2 pieces of info to be confident it's a discovery response
  const isDiscoveryResponse = infoCount >= 2;

  return {
    isDiscoveryResponse,
    extractedInfo: {
      businessName: businessName?.trim(),
      email: emailMatch?.[1],
      hasPricing,
      hasStyle,
      isAutoGenerate: false,
      location,
    }
  };
}

/**
 * GENERAL CHAT PATTERNS - These should NEVER route to GitHub/code tools
 * These are conversational patterns that users use for general chat
 */
const GENERAL_CHAT_PATTERNS = [
  // Greetings and casual conversation
  /^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening)|what'?s\s*up|sup)\b/i,
  /^(how\s*are\s*you|how'?s\s*it\s*going|how\s*do\s*you\s*do)\b/i,
  /^(thanks?|thank\s*you|thx|ty|appreciate\s*it)\b/i,
  /^(bye|goodbye|see\s*you|later|cya|ttyl)\b/i,

  // General questions (not code-related)
  // IMPORTANT: Exclude GitHub operations to avoid misrouting
  /^(what\s*is|what\s*are|who\s*is|who\s*are|where\s*is|when\s*is|why\s*is|how\s*does)\s+(?!.*\b(code|function|api|bug|error|git|repo|deploy|build|clone|fork|push|pull|commit|merge)\b)/i,
  /\b(tell\s*me\s*about|explain|describe|what\s*does\s*.+\s*mean)\b(?!.*\b(code|function|class|method|api|error|bug|git|repo|clone|fork)\b)/i,

  // Casual chat topics (not development)
  /\b(weather|news|sports|music|movies?|tv\s*shows?|books?|food|recipe|travel|vacation|holiday)\b/i,
  /\b(joke|funny|humor|laugh|entertainment|game|play|fun)\b/i,
  /\b(health|exercise|fitness|workout|diet|nutrition|wellness)\b/i,
  /\b(relationship|family|friends?|kids?|children|parents?|pets?)\b/i,

  // Help with general topics (not code)
  // IMPORTANT: Exclude GitHub/code operations to avoid misrouting
  /\b(help\s*me\s*(understand|learn|with)|can\s*you\s*help\s*me)\b(?!.*\b(code|debug|fix|build|deploy|api|function|error|bug|git|repo|clone|fork|push|pull|commit|merge|review)\b)/i,

  // Simple questions without code context
  // IMPORTANT: Exclude GitHub operations to avoid misrouting "can you clone my repo"
  /^(can\s*you|could\s*you|would\s*you|will\s*you)\s+(?!.*(code|fix|debug|build|deploy|create.*app|review.*repo|clone|fork|push|pull|commit|merge|branch|pr|pull\s*request))/i,

  // Philosophical/casual discussion
  // IMPORTANT: Exclude code review and pull request discussions
  /\b(opinion|think\s*about|your\s*thoughts|what\s*do\s*you\s*think)\b(?!.*\b(code|architecture|implementation|design\s*pattern|code-?review|pull\s*request|pr|commit|merge)\b)/i,

  // Short messages that are clearly casual - ONLY if they don't contain tech keywords
  // IMPORTANT: Don't block short GitHub commands like "clone repo", "fork this"
  /^(?!.*\b(clone|fork|push|pull|commit|merge|code|git|repo|debug|fix|build|deploy)\b).{1,15}$/i,

  // Explicit general chat intent
  /\b(just\s*chatting|general\s*question|quick\s*question|curious\s*about|wondering\s*about)\b/i,
  /\b(not\s*about\s*code|not\s*technical|non-?technical|off-?topic)\b/i,
];

/**
 * HIGH-CONFIDENCE GITHUB PATTERNS - These should ALWAYS route to GitHub
 * More specific than the broad patterns, requires explicit GitHub/code context
 */
const HIGH_CONFIDENCE_GITHUB_PATTERNS = [
  // Explicit GitHub URLs
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/i,
  /github\.com\/[^/\s]+\/[^/\s]+/i,

  // Explicit git commands
  /\b(git\s+(clone|pull|push|commit|merge|rebase|checkout|branch|stash|log|diff|status|init|remote|fetch))\b/i,

  // Standalone clone/fork with repo context (common shorthand)
  /\b(clone|fork)\s+(this|my|the|that)?\s*(repo|repository|project|codebase)?\b/i,

  // Explicit code file references
  /\.(js|jsx|ts|tsx|py|java|cpp|go|rs|rb|php|cs|swift|kt|scala|vue|svelte)\b/i,

  // Explicit programming keywords with action verbs
  /\b(fix|debug|refactor)\s+(the|this|my)?\s*(bug|error|issue|function|code|class|method|api|endpoint)\b/i,
  /\b(review|analyze)\s+(this|my|the)?\s*(code|pr|pull\s*request|repo|repository)\b/i,

  // Explicit development tool mentions
  /\b(npm|yarn|pip|cargo|maven|gradle|docker|kubernetes|webpack|vite|next\.?js|react|vue|angular|svelte)\b.*\b(install|build|run|deploy|config|error|issue|help)\b/i,

  // Explicit error messages
  /\b(error|exception|traceback|stack\s*trace|crash|failed|undefined|null\s*pointer|segfault)\b.*\b(in|at|from|when|while)\b/i,

  // Explicit "push to github" or "deploy"
  /\b(push|deploy|publish)\s+(to|on)\s+(github|vercel|netlify|heroku|aws|azure|gcp)\b/i,

  // Explicit create repository/branch
  /\b(create|make|new)\s+(a\s+)?(repo|repository|branch|pr|pull\s*request)\b/i,
];

/**
 * Check if a message indicates GitHub/code review intent
 * IMPROVED: Now checks for general chat exclusions first
 */
export function hasGitHubIntent(text: string): { isGitHub: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // STEP 1: Check if this is clearly general chat - if so, NEVER route to GitHub
  for (const pattern of GENERAL_CHAT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      // This is general chat, do NOT route to GitHub
      return { isGitHub: false };
    }
  }

  // STEP 2: Check high-confidence patterns first (these are very specific)
  for (const pattern of HIGH_CONFIDENCE_GITHUB_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isGitHub: true,
        matchedPattern: pattern.source
      };
    }
  }

  // STEP 3: Only use broad patterns if message is long enough and contains multiple tech keywords
  const techKeywords = ['code', 'function', 'class', 'api', 'error', 'bug', 'git', 'repo', 'build', 'deploy', 'test', 'database', 'server', 'client', 'frontend', 'backend'];
  const matchedKeywords = techKeywords.filter(kw => normalizedText.toLowerCase().includes(kw));

  // Require at least 2 tech keywords for broad patterns to trigger
  if (matchedKeywords.length >= 2) {
    for (const pattern of GITHUB_INTENT_PATTERNS) {
      if (pattern.test(normalizedText)) {
        return {
          isGitHub: true,
          matchedPattern: pattern.source
        };
      }
    }
  }

  return { isGitHub: false };
}

/**
 * Check if a message requires complex task handling (GPT-4o)
 */
function requiresComplexTask(text: string): { isComplex: boolean; reason?: RouteReason } {
  const normalizedText = text.toLowerCase();

  // Check code patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.code) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'code-task' };
    }
  }

  // Check research patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.research) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'research-task' };
    }
  }

  // Check file operation patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.fileOperation) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'file-operation' };
    }
  }

  // Check complex reasoning patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.complexReasoning) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'complex-reasoning' };
    }
  }

  return { isComplex: false };
}

/**
 * Main routing decision function
 *
 * @param lastUserText - The last user message text
 * @param toolOverride - Optional tool override from button selection (e.g., 'image')
 * @returns RouteDecision with target, reason, and confidence
 */
export function decideRoute(
  lastUserText: string,
  toolOverride?: string
): RouteDecision {
  // If tool is explicitly set to video (button press), route to video
  if (toolOverride === 'video') {
    return {
      target: 'video',
      reason: 'video-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-video',
    };
  }

  // If tool is explicitly set to image (button press), route to image
  if (toolOverride === 'image') {
    return {
      target: 'image',
      reason: 'image-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-image',
    };
  }

  // If tool is explicitly set to website (button press), route to website
  if (toolOverride === 'website') {
    return {
      target: 'website',
      reason: 'website-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-website',
    };
  }

  // If tool is explicitly set to github (button press), route to github
  if (toolOverride === 'github') {
    return {
      target: 'github',
      reason: 'github-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-github',
    };
  }

  // Check for website intent FIRST (landing pages before other routes)
  const websiteCheck = hasWebsiteIntent(lastUserText);
  if (websiteCheck.isWebsite) {
    return {
      target: 'website',
      reason: 'website-intent',
      confidence: 0.95,
      matchedPattern: websiteCheck.matchedPattern,
    };
  }

  // Check for GitHub/code review intent (before video/image)
  const githubCheck = hasGitHubIntent(lastUserText);
  if (githubCheck.isGitHub) {
    return {
      target: 'github',
      reason: 'github-intent',
      confidence: 0.95,
      matchedPattern: githubCheck.matchedPattern,
    };
  }

  // Check for video intent in the message
  const videoCheck = hasVideoIntent(lastUserText);
  if (videoCheck.isVideo) {
    return {
      target: 'video',
      reason: 'video-intent',
      confidence: 0.9,
      matchedPattern: videoCheck.matchedPattern,
    };
  }

  // Check for image intent in the message
  const imageCheck = hasImageIntent(lastUserText);
  if (imageCheck.isImage) {
    return {
      target: 'image',
      reason: 'image-intent',
      confidence: 0.9,
      matchedPattern: imageCheck.matchedPattern,
    };
  }

  // Check for complex tasks requiring gpt-5-mini
  const complexCheck = requiresComplexTask(lastUserText);
  if (complexCheck.isComplex && complexCheck.reason) {
    return {
      target: 'mini',
      reason: complexCheck.reason,
      confidence: 0.85,
    };
  }

  // Default to nano for light chat (cost-optimized)
  return {
    target: 'nano',
    reason: 'light-chat',
    confidence: 0.7,
  };
}

/**
 * Log route decision for telemetry
 */
export function logRouteDecision(
  userId: string,
  decision: RouteDecision,
  promptPreview?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    target: decision.target,
    reason: decision.reason,
    confidence: decision.confidence,
    matchedPattern: decision.matchedPattern,
    promptPreview: promptPreview?.slice(0, 50),
  };

  console.log('[Route Decision]', JSON.stringify(logEntry));
}
