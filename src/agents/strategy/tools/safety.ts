/**
 * BROWSER SAFETY FRAMEWORK
 *
 * COMPREHENSIVE safety measures for browser automation to prevent:
 * - Unauthorized form submissions
 * - Accessing restricted/illegal content
 * - Accessing foreign government/hostile nation sites
 * - Adult/pornographic content
 * - Criminal/extremist content
 * - Creating unwanted accounts or commitments
 * - Exposing sensitive data
 *
 * This framework uses BOTH hardcoded blocklists AND AI-powered content validation.
 * The hardcoded lists are the FIRST LINE of defense and cannot be bypassed.
 * AI validation provides nuanced judgment for edge cases.
 */

import { logger } from '@/lib/logger';

const log = logger('BrowserSafety');

// =============================================================================
// BLOCKED TLDs - Country-specific domain restrictions
// =============================================================================

/**
 * Top-level domains that should NEVER be accessed
 * These are government, military, and sanctioned country TLDs
 */
export const BLOCKED_TLDS = [
  // === US/Allied Government & Military ===
  '.gov', // US Government
  '.mil', // US Military
  '.gov.uk', // UK Government
  '.gov.au', // Australia Government
  '.gc.ca', // Canada Government
  '.gov.nz', // New Zealand Government
  '.gov.ie', // Ireland Government
  '.gov.za', // South Africa Government
  '.gob.mx', // Mexico Government
  '.gov.br', // Brazil Government
  '.gov.in', // India Government
  '.gov.sg', // Singapore Government
  '.go.jp', // Japan Government
  '.go.kr', // South Korea Government
  '.gouv.fr', // France Government
  '.bund.de', // Germany Government
  '.gov.it', // Italy Government
  '.gov.es', // Spain Government
  '.gov.nl', // Netherlands Government
  '.gov.be', // Belgium Government
  '.gov.pl', // Poland Government
  '.gov.il', // Israel Government

  // === SANCTIONED/HOSTILE NATIONS ===
  // These countries are under US/International sanctions or are adversarial
  '.kp', // North Korea (DPRK) - HEAVILY SANCTIONED
  '.ir', // Iran - SANCTIONED
  '.cu', // Cuba - SANCTIONED
  '.sy', // Syria - SANCTIONED
  '.ru', // Russia - SANCTIONED/ADVERSARIAL (use cautiously)
  '.by', // Belarus - Russian ally
  '.ve', // Venezuela - SANCTIONED
  '.mm', // Myanmar - Human rights concerns
  '.er', // Eritrea - SANCTIONED
  '.sd', // Sudan - SANCTIONED
  '.ss', // South Sudan - Unstable

  // === CHINESE GOVERNMENT & STATE-CONTROLLED ===
  '.gov.cn', // Chinese Government
  '.edu.cn', // Chinese Education (state-controlled)
  '.mil.cn', // Chinese Military

  // === RUSSIAN GOVERNMENT ===
  '.gov.ru', // Russian Government
  '.mil.ru', // Russian Military

  // === IRANIAN GOVERNMENT ===
  '.gov.ir', // Iranian Government

  // === NORTH KOREAN (if accessible) ===
  '.gov.kp', // North Korean Government
];

// =============================================================================
// BLOCKED DOMAINS - Specific dangerous sites
// =============================================================================

/**
 * Domains that should NEVER be visited
 * Organized by category for clarity
 */
export const BLOCKED_DOMAINS = [
  // === FOREIGN STATE MEDIA / PROPAGANDA ===
  // Russian state media
  'rt.com',
  'sputniknews.com',
  'ria.ru',
  'tass.com',
  'tass.ru',
  'pravda.ru',
  'vesti.ru',
  'russia.tv',
  'gazeta.ru',

  // Chinese state media
  'xinhuanet.com',
  'chinadaily.com.cn',
  'cgtn.com',
  'globaltimes.cn',
  'people.com.cn',
  'cctv.com',
  'china.org.cn',
  'ecns.cn',
  'en.people.cn',

  // Iranian state media
  'presstv.ir',
  'irna.ir',
  'mehrnews.com',
  'farsnews.com',
  'tasnimnews.com',
  'parstoday.com',

  // North Korean state media
  'kcna.kp',
  'rodong.rep.kp',
  'uriminzokkiri.com',

  // Other state-controlled media
  'almayadeen.net', // Hezbollah-affiliated
  'telesurtv.net', // Venezuelan state
  'granma.cu', // Cuban state

  // === ADULT CONTENT (COMPREHENSIVE) ===
  'pornhub.com',
  'xvideos.com',
  'xhamster.com',
  'xnxx.com',
  'redtube.com',
  'youporn.com',
  'tube8.com',
  'spankbang.com',
  'eporner.com',
  'beeg.com',
  'pornone.com',
  'txxx.com',
  'hclips.com',
  'porn.com',
  'livejasmin.com',
  'chaturbate.com',
  'stripchat.com',
  'bongacams.com',
  'cam4.com',
  'camsoda.com',
  'onlyfans.com', // Adult content platform
  'fansly.com',
  'manyvids.com',
  'clips4sale.com',
  'brazzers.com',
  'bangbros.com',
  'realitykings.com',
  'mofos.com',
  'naughtyamerica.com',
  'blacked.com',
  'vixen.com',
  'tushy.com',
  'digitalplayground.com',
  'wicked.com',
  'adulttime.com',
  'pornpics.com',
  'hentaihaven.xxx',
  'nhentai.net',
  'rule34.xxx',
  'e-hentai.org',
  'danbooru.donmai.us',
  'gelbooru.com',
  'sankakucomplex.com',
  'fapello.com',
  'coomer.su',
  'kemono.su',
  'simpcity.su',

  // === EXTREMIST / HATE / ILLEGAL CONTENT ===
  '4chan.org', // Can contain extremist content
  '8kun.top', // Known for extremist content
  'stormfront.org', // White supremacist
  'dailystormer.name', // Neo-Nazi
  'gab.com', // Known for extremist content
  'parler.com', // Known for extremist content
  'bitchute.com', // Often hosts extremist videos
  'odysee.com', // Can host extremist content
  'rumble.com', // Can host misinformation
  'minds.com', // Can host extremist content

  // === DARK WEB DIRECTORIES/PROXIES ===
  'ahmia.fi', // Tor search engine
  'tor.link',
  'darkweblinks.com',
  'deepweblinks.com',
  'onion.live',
  'onion.ws',
  'onion.ly',
  'tor2web.org',

  // === HACKING / ILLEGAL SERVICES ===
  'hackforums.net',
  'breachforums.is',
  'raidforums.com', // Seized but watch for mirrors
  'cracked.io',
  'nulled.to',
  'leakbase.io',
  'exploit.in',
  'xss.is',

  // === MALWARE / PHISHING VECTORS ===
  'bit.ly', // URL shortener (can hide malicious links)
  'tinyurl.com',
  'goo.gl',
  't.co', // Twitter shortener
  'ow.ly',
  'buff.ly',

  // === BANKING & FINANCIAL (No automated access) ===
  'chase.com/login',
  'bankofamerica.com/login',
  'wellsfargo.com/login',
  'citi.com/login',
  'capitalone.com/login',
  'usbank.com/login',
  'pnc.com/login',
  'tdbank.com/login',
  'schwab.com/login',
  'fidelity.com/login',
  'vanguard.com/login',
  'etrade.com/login',
  'robinhood.com/login',
  'coinbase.com/login',
  'binance.com/login',
  'kraken.com/login',
  'paypal.com/signin',
  'venmo.com/login',
  'cashapp.com', // Payment app
  'zelle.com',

  // === SOCIAL MEDIA LOGIN/AUTH PAGES ===
  'facebook.com/login',
  'instagram.com/accounts',
  'twitter.com/login',
  'x.com/login',
  'tiktok.com/login',
  'linkedin.com/login',
  'reddit.com/login',
  'discord.com/login',
  'twitch.tv/login',
  'snapchat.com/login',
  'pinterest.com/login',
  'tumblr.com/login',

  // === EMAIL LOGIN PAGES ===
  'mail.google.com',
  'outlook.live.com/login',
  'mail.yahoo.com/login',
  'protonmail.com/login',
  'icloud.com/mail',

  // === GOVERNMENT SERVICES (US) ===
  'irs.gov',
  'ssa.gov',
  'uscis.gov',
  'state.gov',
  'dhs.gov',
  'fbi.gov',
  'cia.gov',
  'nsa.gov',
  'doj.gov',
  'treasury.gov',
  'sec.gov',
  'ftc.gov',
  'fcc.gov',
  'whitehouse.gov',
  'congress.gov',
  'senate.gov',
  'house.gov',
  'supremecourt.gov',
  'usa.gov',
  'usps.com/login', // Postal service
  'dmv.org',
];

// =============================================================================
// BLOCKED URL PATTERNS - Regex patterns for dangerous content
// =============================================================================

/**
 * URL patterns that indicate dangerous content
 */
export const BLOCKED_URL_PATTERNS = [
  // Login/Auth patterns
  /\/login\/?$/i,
  /\/signin\/?$/i,
  /\/sign-in\/?$/i,
  /\/authenticate\/?$/i,
  /\/auth\/?$/i,
  /\/oauth\/?$/i,
  /\/sso\/?$/i,

  // Account creation
  /\/signup\/?$/i,
  /\/sign-up\/?$/i,
  /\/register\/?$/i,
  /\/create-account\/?$/i,
  /\/join\/?$/i,
  /\/enroll\/?$/i,

  // Payment/Financial
  /\/checkout\/?$/i,
  /\/payment\/?$/i,
  /\/pay\/?$/i,
  /\/billing\/?$/i,
  /\/subscribe\/?$/i,
  /\/purchase\/?$/i,
  /\/order\/?$/i,
  /\/cart\/?$/i,
  /\/basket\/?$/i,

  // Admin/Dashboard (potential sensitive areas)
  /\/admin\/?$/i,
  /\/dashboard\/?$/i,
  /\/panel\/?$/i,
  /\/control-panel\/?$/i,
  /\/manage\/?$/i,
  /\/settings\/?$/i,
  /\/account\/?$/i,

  // Potentially dangerous file downloads
  /\.exe$/i,
  /\.msi$/i,
  /\.dmg$/i,
  /\.pkg$/i,
  /\.deb$/i,
  /\.rpm$/i,
  /\.sh$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.ps1$/i,
  /\.vbs$/i,
  /\.jar$/i,
  /\.apk$/i,
  /\.ipa$/i,

  // Onion addresses (Tor)
  /\.onion\/?/i,

  // IP addresses (could be malicious)
  /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
];

// =============================================================================
// ADULT CONTENT KEYWORDS - For content-based detection
// =============================================================================

/**
 * Keywords that indicate adult content in URLs or page content
 */
export const ADULT_KEYWORDS = [
  'porn',
  'xxx',
  'adult',
  'nsfw',
  'nude',
  'naked',
  'sex',
  'erotic',
  'hentai',
  'fetish',
  'bdsm',
  'escort',
  'stripper',
  'webcam',
  'camgirl',
  'onlyfan',
  'fansly',
  'lewd',
  'r18',
  'r-18',
  '18+',
  'explicit',
  'mature',
  'x-rated',
  'xrated',
];

// =============================================================================
// FORM SAFETY
// =============================================================================

/**
 * Form actions that are NEVER allowed
 */
export const BLOCKED_FORM_ACTIONS = [
  // Payment/Financial
  'checkout',
  'payment',
  'pay',
  'purchase',
  'buy',
  'order',
  'subscribe',
  'billing',
  'credit-card',
  'creditcard',
  'donate',
  'contribution',

  // Account creation
  'signup',
  'sign-up',
  'register',
  'create-account',
  'join',
  'enroll',
  'apply',

  // Authentication
  'login',
  'signin',
  'sign-in',
  'authenticate',
  'password',
  'reset-password',
  'forgot-password',
  'verify',
  'confirm',

  // Destructive
  'delete',
  'remove',
  'cancel',
  'unsubscribe',
  'deactivate',
  'terminate',

  // Communication (could be used for spam)
  'send-message',
  'contact-form',
  'submit-application',
  'message',
  'email',
  'contact',
  'feedback',
  'report',
];

/**
 * Form types that ARE allowed (whitelist approach)
 */
export const ALLOWED_FORM_TYPES = [
  // Search and filters
  'search',
  'filter',
  'sort',
  'refine',
  'find',
  'lookup',

  // Quote requests (read-only info gathering)
  'quote',
  'estimate',
  'calculator',
  'pricing',
  'compare',

  // Location/preference selectors
  'location',
  'zip',
  'zipcode',
  'city',
  'state',
  'country',
  'region',
  'area',
  'date',
  'checkin',
  'checkout',
  'guests',
  'rooms',
  'beds',
  'baths',
  'price-range',
  'min-price',
  'max-price',
  'budget',
];

/**
 * Input types that should NEVER be filled
 */
export const BLOCKED_INPUT_TYPES = [
  'password',
  'credit-card',
  'card-number',
  'cvv',
  'cvc',
  'ssn',
  'social-security',
  'bank-account',
  'routing-number',
  'pin',
  'secret',
  'token',
];

/**
 * Input fields that should NEVER be filled (by name/id patterns)
 */
export const BLOCKED_INPUT_PATTERNS = [
  /password/i,
  /passwd/i,
  /credit.?card/i,
  /card.?number/i,
  /card.?num/i,
  /cvv|cvc|csv/i,
  /ssn|social.?security/i,
  /bank.?account/i,
  /routing/i,
  /secret/i,
  /token/i,
  /api.?key/i,
  /private.?key/i,
  /auth/i,
  /session/i,
  /cookie/i,
  /pin.?code/i,
];

// =============================================================================
// RATE LIMITS
// =============================================================================

export const RATE_LIMITS = {
  // Max pages to visit per domain per session
  maxPagesPerDomain: 20,

  // Max forms to submit per session
  maxFormSubmissions: 5,

  // Max clicks per page
  maxClicksPerPage: 10,

  // Delay between actions (ms)
  actionDelayMs: 500,

  // Max total pages per strategy execution
  maxTotalPages: 100,

  // Max screenshots per session
  maxScreenshots: 50,

  // Max downloads per session
  maxDownloads: 10,

  // Max code executions per session
  maxCodeExecutions: 50,
};

// =============================================================================
// TRUSTED DOMAINS - Sites safe for deeper interaction
// =============================================================================

/**
 * Domains that are safe for deeper interaction (forms, etc.)
 */
export const TRUSTED_DOMAINS = [
  // Real estate
  'zillow.com',
  'redfin.com',
  'realtor.com',
  'trulia.com',
  'apartments.com',
  'streeteasy.com',
  'homes.com',
  'hotpads.com',
  'rent.com',
  'padmapper.com',

  // Jobs
  'linkedin.com/jobs',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'ziprecruiter.com',
  'dice.com',
  'careerbuilder.com',
  'simplyhired.com',
  'flexjobs.com',

  // E-commerce (for price research)
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'costco.com',
  'homedepot.com',
  'lowes.com',
  'wayfair.com',
  'overstock.com',
  'newegg.com',
  'bhphotovideo.com',

  // Travel
  'kayak.com',
  'expedia.com',
  'priceline.com',
  'booking.com',
  'hotels.com',
  'airbnb.com',
  'vrbo.com',
  'tripadvisor.com',
  'skyscanner.com',
  'google.com/flights',
  'google.com/travel',

  // Business info
  'yelp.com',
  'google.com/maps',
  'crunchbase.com',
  'bloomberg.com',
  'forbes.com',
  'reuters.com',

  // General research
  'wikipedia.org',
  'github.com',
  'stackoverflow.com',
  'medium.com',
  'arxiv.org',
  'scholar.google.com',
  'pubmed.ncbi.nlm.nih.gov',

  // News (reputable sources)
  'nytimes.com',
  'wsj.com',
  'washingtonpost.com',
  'bbc.com',
  'cnn.com',
  'apnews.com',
  'reuters.com',
  'npr.org',
  'theguardian.com',
  'economist.com',

  // Tech
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'zdnet.com',
  'cnet.com',
];

// =============================================================================
// SAFETY CHECK FUNCTIONS
// =============================================================================

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
}

/**
 * Comprehensive URL safety check
 * Returns detailed information about why a URL might be unsafe
 */
export function isUrlSafe(url: string): SafetyCheckResult {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Check 1: Blocked TLDs (highest priority - hostile nations)
    for (const tld of BLOCKED_TLDS) {
      if (hostname.endsWith(tld)) {
        return {
          safe: false,
          reason: `Blocked TLD: ${tld} (government/military/sanctioned)`,
          severity: 'critical',
          category: 'government_military',
        };
      }
    }

    // Check 2: Blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked) || fullUrl.includes(blocked)) {
        // Determine category based on the blocked domain
        let category = 'restricted';
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'high';

        // Categorize the block
        const adultDomains = ['pornhub', 'xvideos', 'xhamster', 'xnxx', 'onlyfans', 'chaturbate'];
        const stateDomains = ['rt.com', 'sputnik', 'xinhua', 'cgtn', 'presstv', 'kcna'];
        const extremistDomains = ['4chan', '8kun', 'stormfront', 'dailystormer'];

        if (adultDomains.some((d) => blocked.includes(d))) {
          category = 'adult_content';
          severity = 'critical';
        } else if (stateDomains.some((d) => blocked.includes(d))) {
          category = 'state_propaganda';
          severity = 'critical';
        } else if (extremistDomains.some((d) => blocked.includes(d))) {
          category = 'extremist_content';
          severity = 'critical';
        }

        return {
          safe: false,
          reason: `Blocked domain: ${blocked}`,
          severity,
          category,
        };
      }
    }

    // Check 3: URL patterns
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(fullUrl) || pattern.test(pathname)) {
        return {
          safe: false,
          reason: `Blocked URL pattern: ${pattern.toString()}`,
          severity: 'high',
          category: 'restricted_path',
        };
      }
    }

    // Check 4: Adult keywords in URL
    for (const keyword of ADULT_KEYWORDS) {
      if (hostname.includes(keyword) || pathname.includes(keyword)) {
        return {
          safe: false,
          reason: `Adult content keyword detected: ${keyword}`,
          severity: 'critical',
          category: 'adult_content',
        };
      }
    }

    // Check 5: Suspicious URL characteristics
    // Check for excessive subdomains (potential phishing)
    const subdomainCount = hostname.split('.').length - 2;
    if (subdomainCount > 3) {
      return {
        safe: false,
        reason: 'Suspicious URL: excessive subdomains (potential phishing)',
        severity: 'medium',
        category: 'suspicious',
      };
    }

    return { safe: true };
  } catch {
    return {
      safe: false,
      reason: 'Invalid URL format',
      severity: 'medium',
      category: 'invalid',
    };
  }
}

/**
 * Check if a form action is safe
 */
export function isFormActionSafe(
  formAction: string,
  formId?: string,
  formClass?: string
): SafetyCheckResult {
  const combined = `${formAction} ${formId || ''} ${formClass || ''}`.toLowerCase();

  // Check blocked actions
  for (const blocked of BLOCKED_FORM_ACTIONS) {
    if (combined.includes(blocked)) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
      let category = 'form_action';

      // Payment-related forms are critical
      if (['checkout', 'payment', 'pay', 'purchase', 'billing'].includes(blocked)) {
        severity = 'critical';
        category = 'payment';
      }

      // Auth-related forms are high
      if (['login', 'signin', 'password', 'authenticate'].includes(blocked)) {
        severity = 'high';
        category = 'authentication';
      }

      return {
        safe: false,
        reason: `Blocked form action: ${blocked}`,
        severity,
        category,
      };
    }
  }

  // Check if it matches allowed types
  const isAllowed = ALLOWED_FORM_TYPES.some((allowed) => combined.includes(allowed));

  if (!isAllowed) {
    // Not explicitly allowed - be cautious
    log.warn('Form not in whitelist, requiring extra caution', { formAction, formId, formClass });
    return {
      safe: true,
      reason: 'Form not in whitelist - proceed with caution',
      severity: 'low',
      category: 'unknown',
    };
  }

  return { safe: true };
}

/**
 * Check if an input field is safe to fill
 */
export function isInputSafe(
  inputName: string,
  inputId?: string,
  inputType?: string
): SafetyCheckResult {
  // Check input type
  if (inputType && BLOCKED_INPUT_TYPES.includes(inputType.toLowerCase())) {
    return {
      safe: false,
      reason: `Blocked input type: ${inputType}`,
      severity: 'critical',
      category: 'sensitive_input',
    };
  }

  // Check input name/id against patterns
  const toCheck = `${inputName} ${inputId || ''}`;
  for (const pattern of BLOCKED_INPUT_PATTERNS) {
    if (pattern.test(toCheck)) {
      return {
        safe: false,
        reason: `Blocked input pattern: ${pattern.toString()}`,
        severity: 'critical',
        category: 'sensitive_input',
      };
    }
  }

  return { safe: true };
}

/**
 * Check if a domain is trusted for deeper interaction
 */
export function isDomainTrusted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(
      (trusted) => hostname.includes(trusted) || hostname.endsWith(trusted.replace('www.', ''))
    );
  } catch {
    return false;
  }
}

/**
 * Sanitize data before returning (remove any accidentally captured sensitive info)
 */
export function sanitizeOutput(data: string): string {
  // Remove anything that looks like a credit card number
  let sanitized = data.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CARD]');

  // Remove anything that looks like an SSN
  sanitized = sanitized.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, '[REDACTED_SSN]');

  // Remove phone numbers
  sanitized = sanitized.replace(
    /\b(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '[REDACTED_PHONE]'
  );

  // Remove anything that looks like an API key
  sanitized = sanitized.replace(/\b(sk|pk|api|key)[-_]?[a-zA-Z0-9]{20,}\b/gi, '[REDACTED_API_KEY]');

  // Remove JWT tokens
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
    '[REDACTED_JWT]'
  );

  // Remove email addresses from logs (privacy)
  // sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  return sanitized;
}

// =============================================================================
// CONTENT ANALYSIS - AI-assisted safety checks
// =============================================================================

/**
 * Keywords that might indicate dangerous content that needs AI review
 */
export const CONTENT_WARNING_KEYWORDS = [
  // Violence
  'terrorism',
  'bomb',
  'explosive',
  'weapon',
  'firearm',
  'assassination',
  'murder',
  'torture',

  // Illegal activities
  'drug',
  'narcotic',
  'cocaine',
  'heroin',
  'meth',
  'fentanyl',
  'trafficking',
  'smuggling',
  'counterfeit',
  'fraud',
  'scam',
  'phishing',
  'hack',
  'malware',
  'ransomware',

  // Extremism
  'supremacist',
  'extremist',
  'radical',
  'jihad',
  'terrorist',
  'nazi',
  'fascist',
  'antifa',

  // Self-harm
  'suicide',
  'self-harm',
  'cutting',
  'overdose',

  // Child safety
  'child abuse',
  'csam',
  'minor',
  'underage',
  'pedophile',
];

/**
 * Check content for warning keywords
 * This is a PRE-filter before sending to AI for nuanced analysis
 */
export function checkContentForWarnings(content: string): {
  hasWarnings: boolean;
  keywords: string[];
  requiresReview: boolean;
} {
  const foundKeywords: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const keyword of CONTENT_WARNING_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  return {
    hasWarnings: foundKeywords.length > 0,
    keywords: foundKeywords,
    requiresReview: foundKeywords.length >= 2, // Multiple keywords = needs review
  };
}

// =============================================================================
// ACTION TRACKING
// =============================================================================

interface SessionTracker {
  pagesPerDomain: Map<string, number>;
  formSubmissions: number;
  totalPages: number;
  screenshots: number;
  downloads: number;
  codeExecutions: number;
  blockedAttempts: Array<{
    url: string;
    reason: string;
    timestamp: number;
  }>;
  // TTL tracking
  createdAt: number;
  lastAccessedAt: number;
}

const sessionTrackers = new Map<string, SessionTracker>();

// TTL configuration
const SESSION_TRACKER_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the session tracker cleanup interval
 * Called automatically on first tracker creation
 */
function startSessionCleanupInterval(): void {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, tracker] of sessionTrackers) {
      if (now - tracker.lastAccessedAt > SESSION_TRACKER_TTL_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      sessionTrackers.delete(sessionId);
      log.info('Session tracker expired and cleaned up', { sessionId });
    }

    if (expiredSessions.length > 0) {
      log.info('Session tracker cleanup complete', {
        cleaned: expiredSessions.length,
        remaining: sessionTrackers.size,
      });
    }
  }, SESSION_CLEANUP_INTERVAL_MS);

  // Don't prevent the process from exiting
  cleanupIntervalId.unref();
}

/**
 * Stop the session tracker cleanup interval (for testing)
 */
export function stopSessionCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Get or create session tracker
 * Automatically starts the cleanup interval on first call
 */
export function getSessionTracker(sessionId: string): SessionTracker {
  // Start cleanup interval on first use
  startSessionCleanupInterval();

  const now = Date.now();

  if (!sessionTrackers.has(sessionId)) {
    sessionTrackers.set(sessionId, {
      pagesPerDomain: new Map(),
      formSubmissions: 0,
      totalPages: 0,
      screenshots: 0,
      downloads: 0,
      codeExecutions: 0,
      blockedAttempts: [],
      createdAt: now,
      lastAccessedAt: now,
    });
  }

  // Update last accessed time
  const tracker = sessionTrackers.get(sessionId)!;
  tracker.lastAccessedAt = now;

  return tracker;
}

/**
 * Check if we can visit another page
 */
export function canVisitPage(sessionId: string, url: string): SafetyCheckResult {
  // First check URL safety
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    // Record blocked attempt
    const tracker = getSessionTracker(sessionId);
    tracker.blockedAttempts.push({
      url,
      reason: urlCheck.reason || 'Unknown',
      timestamp: Date.now(),
    });
    return urlCheck;
  }

  const tracker = getSessionTracker(sessionId);

  // Check total pages
  if (tracker.totalPages >= RATE_LIMITS.maxTotalPages) {
    return {
      safe: false,
      reason: 'Max total pages reached for this session',
      severity: 'medium',
      category: 'rate_limit',
    };
  }

  // Check pages per domain
  try {
    const domain = new URL(url).hostname;
    const domainCount = tracker.pagesPerDomain.get(domain) || 0;
    if (domainCount >= RATE_LIMITS.maxPagesPerDomain) {
      return {
        safe: false,
        reason: `Max pages for ${domain} reached`,
        severity: 'low',
        category: 'rate_limit',
      };
    }
  } catch {
    return {
      safe: false,
      reason: 'Invalid URL',
      severity: 'medium',
      category: 'invalid',
    };
  }

  return { safe: true };
}

/**
 * Record a page visit
 */
export function recordPageVisit(sessionId: string, url: string): void {
  const tracker = getSessionTracker(sessionId);
  tracker.totalPages++;

  try {
    const domain = new URL(url).hostname;
    tracker.pagesPerDomain.set(domain, (tracker.pagesPerDomain.get(domain) || 0) + 1);
  } catch {
    // Ignore invalid URLs
  }
}

/**
 * Check if we can submit another form
 */
export function canSubmitForm(sessionId: string): SafetyCheckResult {
  const tracker = getSessionTracker(sessionId);

  if (tracker.formSubmissions >= RATE_LIMITS.maxFormSubmissions) {
    return {
      safe: false,
      reason: 'Max form submissions reached for this session',
      severity: 'medium',
      category: 'rate_limit',
    };
  }

  return { safe: true };
}

/**
 * Record a form submission
 */
export function recordFormSubmission(sessionId: string): void {
  const tracker = getSessionTracker(sessionId);
  tracker.formSubmissions++;
}

/**
 * Get blocked attempts for a session (for audit)
 */
export function getBlockedAttempts(
  sessionId: string
): Array<{ url: string; reason: string; timestamp: number }> {
  const tracker = sessionTrackers.get(sessionId);
  return tracker?.blockedAttempts || [];
}

/**
 * Cleanup session tracker
 */
export function cleanupSessionTracker(sessionId: string): void {
  sessionTrackers.delete(sessionId);
}

// =============================================================================
// LOGGING & AUDIT
// =============================================================================

/**
 * Log a potentially risky action for audit
 */
export function logRiskyAction(
  sessionId: string,
  action: string,
  details: Record<string, unknown>
): void {
  log.warn('Risky browser action', {
    sessionId,
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a blocked action for audit
 */
export function logBlockedAction(
  sessionId: string,
  action: string,
  result: SafetyCheckResult,
  details: Record<string, unknown>
): void {
  log.error('BLOCKED browser action', {
    sessionId,
    action,
    reason: result.reason,
    severity: result.severity,
    category: result.category,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// AI GUARDRAILS PROMPT - For scouts and agents
// =============================================================================

/**
 * Safety instructions to include in AI agent prompts
 * These are the "soft" guardrails that rely on AI judgment
 */
export const AI_SAFETY_PROMPT = `
## CRITICAL SAFETY GUIDELINES

You are operating within strict ethical and legal boundaries. Follow these rules ABSOLUTELY:

### NEVER Access:
1. **Government/Military Sites**: Any .gov, .mil, or foreign government domains
2. **Sanctioned Nations**: North Korea (.kp), Iran (.ir), Cuba (.cu), Syria (.sy), or Russian government sites
3. **Adult Content**: Pornographic sites, adult platforms, explicit content
4. **Extremist Content**: Hate speech sites, terrorist content, radical propaganda
5. **Foreign State Media**: RT, Sputnik, CGTN, Xinhua, PressTV, KCNA (state propaganda)
6. **Dark Web**: .onion addresses, Tor proxies, dark web directories
7. **Hacking/Illegal**: Hacking forums, stolen data sites, malware distribution
8. **Financial Logins**: Bank accounts, cryptocurrency exchanges, payment processors

### NEVER Do:
1. Fill in passwords, credit cards, SSN, or any sensitive information
2. Create accounts on any platform
3. Submit payment or checkout forms
4. Send messages or emails on behalf of users
5. Access someone else's private data
6. Download executable files (.exe, .dmg, .sh, etc.)
7. Bypass security measures or CAPTCHAs
8. Impersonate humans or organizations

### ALWAYS:
1. Use reputable commercial sources (Zillow, LinkedIn, major news, Wikipedia, etc.)
2. Respect robots.txt and rate limits
3. Stop if you encounter unexpected login prompts
4. Report any suspicious or concerning content you find
5. Prioritize US-based and allied nation sources
6. Be transparent about what sites you're visiting

### American Context:
You are operating from a US-based system. Be mindful of:
- US laws and regulations apply
- Respect international sanctions (OFAC compliance)
- Avoid actions that could create diplomatic incidents
- Protect user privacy per US standards

If you're unsure whether something is safe, DO NOT proceed. Ask for clarification.
`;

/**
 * Get condensed safety instructions for tool system prompts
 */
export function getCondensedSafetyPrompt(): string {
  return `SAFETY: Never access .gov/.mil/foreign government, adult sites, extremist content, state media (RT/Xinhua/etc), .onion, or financial logins. Never fill passwords/cards/SSN. Only use reputable commercial sources.`;
}
