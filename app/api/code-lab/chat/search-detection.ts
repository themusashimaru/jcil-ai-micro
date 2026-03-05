/**
 * Search Detection for Code Lab Chat
 *
 * Detects when a user's message should trigger a web search
 * via Perplexity, focusing on rapidly-changing developer information
 * (AI/ML APIs, framework versions, pricing, etc.)
 */

// Search detection - enhanced patterns for developer queries
// Especially focused on rapidly-changing AI/ML APIs and developer tools
export function shouldUseSearch(message: string): boolean {
  const lower = message.toLowerCase();

  // ========================================
  // DIRECT SEARCH REQUESTS (user explicitly asks for search)
  // ========================================
  const directSearchPatterns = [
    /\b(search|look up|find|google|lookup|research)\b.*\b(web|online|internet)\b/i,
    /\bsearch (for|the|web|online)\b/i,
    /\b(can you|please|could you)\b.*\b(search|look up|find)\b/i,
    /\bsearch.*\b(technical|documentation|docs|api|info)/i,
  ];

  // ========================================
  // AI/ML API DOCUMENTATION (changes VERY fast - always search)
  // ========================================
  const aiApiPatterns = [
    // OpenAI / GPT
    /\b(openai|gpt-?[345o]|chatgpt|gpt|o[1-9]|davinci|turbo)\b.*\b(api|sdk|docs?|documentation|endpoint|model|version|release)/i,
    /\b(api|docs?|documentation)\b.*\b(openai|gpt|chatgpt)/i,
    /\bopenai\b.*\b(latest|current|new|pricing|rate.?limit)/i,

    // Anthropic / Claude
    /\b(anthropic|claude|sonnet|opus|haiku)\b.*\b(api|sdk|docs?|documentation|endpoint|model|version)/i,
    /\b(api|docs?|documentation)\b.*\b(anthropic|claude)/i,
    /\bclaude\b.*\b(latest|current|new|model|version|api)/i,

    // Other AI providers
    /\b(gemini|bard|palm|google.?ai)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(llama|meta.?ai|mistral|cohere)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(deepseek|xai|grok)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(hugging.?face|transformers)\b.*\b(api|model|version|latest)/i,

    // AI SDK / Vercel AI
    /\b(vercel.?ai|ai.?sdk)\b.*\b(docs?|documentation|api|version)/i,
    /\b(langchain|llamaindex|semantic.?kernel)\b.*\b(docs?|api|version)/i,
  ];

  // ========================================
  // FRAMEWORK/LIBRARY VERSIONS (change frequently)
  // ========================================
  const frameworkPatterns = [
    // React ecosystem
    /\b(react|next\.?js|remix|gatsby)\b.*\b(latest|current|new|version|release|[0-9]+\.[0-9]+)/i,
    /\b(latest|current|new)\b.*\b(react|next\.?js|version)/i,

    // Other frontend
    /\b(vue|nuxt|svelte|angular|astro)\b.*\b(latest|current|version|release)/i,

    // Backend
    /\b(node\.?js|deno|bun)\b.*\b(latest|current|version|release|lts)/i,
    /\b(express|fastify|hono|elysia|nest\.?js)\b.*\b(version|docs?|api)/i,

    // Languages
    /\b(typescript|python|rust|go)\b.*\b(latest|current|version|release|what'?s.?new)/i,

    // Package managers
    /\b(npm|yarn|pnpm|bun|pip|cargo)\b.*\b(version|release|latest|update)/i,
  ];

  // ========================================
  // LATEST/CURRENT INFORMATION REQUESTS
  // ========================================
  const latestInfoPatterns = [
    /\bwhat('s| is)\b.*\b(latest|current|newest|recent)\b.*\b(version|release|update)/i,
    /\b(latest|current|newest|recent)\b.*\b(version|release|update|documentation|docs)/i,
    /\bhow to\b.*\b(latest|current|new|updated)\b/i,
    /\bwhat'?s.?new\b.*\b(in|with|for)\b/i,
    /\b(released|updated|changed)\b.*\b(recently|today|this.?(week|month|year))/i,
    /\b(deprecat|breaking.?change|migration|upgrade)\b/i,
  ];

  // ========================================
  // DOCUMENTATION REQUESTS
  // ========================================
  const docPatterns = [
    /\b(official|api|sdk)\b.*\b(documentation|docs|reference|guide)/i,
    /\b(documentation|docs|reference)\b.*\b(for|about|on)\b/i,
    /\bwhere.?(can|do).?(i|we)\b.*\b(find|get)\b.*\b(docs?|documentation)/i,
    /\b(link|url)\b.*\b(docs?|documentation|api|reference)/i,
  ];

  // ========================================
  // PACKAGE/LIBRARY INFORMATION
  // ========================================
  const packagePatterns = [
    /\b(npm|yarn|pip|cargo|composer)\b.*\b(package|library|module|install)/i,
    /\b(install|setup|configure)\b.*\b(guide|instructions|docs|latest)/i,
    /\bpackage\.json\b.*\b(version|dependency|update)/i,
  ];

  // ========================================
  // TROUBLESHOOTING CURRENT ISSUES
  // ========================================
  const troubleshootPatterns = [
    /\b(error|issue|problem|bug)\b.*\b(fix|solve|resolve|solution|workaround)/i,
    /\bwhy (does|is|am|do)\b.*\b(not working|failing|broken|error)/i,
    /\b(known.?issue|bug.?report|github.?issue)/i,
  ];

  // ========================================
  // COMPARISON/EVALUATION
  // ========================================
  const comparisonPatterns = [
    /\b(compare|vs\.?|versus|difference.?between|which is better)\b/i,
    /\b(pros.?and.?cons|advantages|disadvantages|trade.?offs?)\b/i,
    /\b(benchmark|performance|comparison)\b.*\b(latest|current|[0-9]+)/i,
  ];

  // ========================================
  // PRICING/LIMITS (change without notice)
  // ========================================
  const pricingPatterns = [
    /\b(pricing|cost|price|rate.?limit|quota|tier)\b.*\b(api|service|cloud)/i,
    /\bhow much\b.*\b(cost|charge|price)/i,
    /\b(free.?tier|free.?plan|pricing.?table)/i,
  ];

  // ========================================
  // MODEL NAMES/IDs (change with every release - CRITICAL for API setup)
  // Examples: claude-sonnet-4-6, gpt-4-turbo-2024-04-09, claude-opus-4-6
  // ========================================
  const modelNamePatterns = [
    // Direct model name/ID queries
    /\b(model|models?)\b.*\b(name|names?|id|ids?|identifier|string|code)\b/i,
    /\bwhat('s| is)\b.*\b(model|models?)\b.*\b(name|id|call|use|string)\b/i,
    /\bmodel.?(name|id|string|identifier)\b/i,

    // Available/supported models
    /\b(latest|current|newest|available|supported)\b.*\b(model|models)\b/i,
    /\b(model|models)\b.*\b(list|available|supported|options|choices)\b/i,
    /\bwhat.?models?\b.*\b(available|support|can.?i.?use|exist)/i,

    // Model versions/releases
    /\bmodel\b.*\b(version|release|update|date|[0-9]{8})\b/i,
    /\b(claude|gpt|gemini|llama|mistral)\b.*\b(version|release|model.?id)\b/i,

    // API model parameter
    /\b(api|sdk|endpoint)\b.*\bmodel\b.*\b(parameter|argument|value|set)\b/i,
    /\bmodel\b.*\b(parameter|argument)\b.*\b(api|sdk|client)\b/i,

    // Environment variable setup for models
    /\b(env|environment|\.env)\b.*\b(model|models?)\b/i,
    /\bmodel\b.*\b(env|environment|config|variable)\b/i,

    // Specific model ID patterns (dated versions)
    /\b(claude|gpt|gemini)-[\w-]+-[0-9]{8}\b/i,
    /\bmodel.?id\b.*\b(format|example|syntax)\b/i,

    // Model deprecation/migration
    /\bmodel\b.*\b(deprecat|obsolete|retire|sunset|migrat|replac)\b/i,
    /\b(deprecat|sunset|replac)\b.*\bmodel/i,
  ];

  // Check all pattern groups
  const allPatterns = [
    ...directSearchPatterns,
    ...aiApiPatterns,
    ...frameworkPatterns,
    ...latestInfoPatterns,
    ...docPatterns,
    ...packagePatterns,
    ...troubleshootPatterns,
    ...comparisonPatterns,
    ...pricingPatterns,
    ...modelNamePatterns,
  ];

  // Check regex patterns
  if (allPatterns.some((p) => p.test(message))) {
    return true;
  }

  // ========================================
  // KEYWORD-BASED DETECTION
  // High-signal keywords that suggest real-time info needed
  // ========================================
  const highSignalKeywords = [
    'latest version',
    'current version',
    'new release',
    'just released',
    'recently updated',
    'breaking changes',
    'migration guide',
    'upgrade guide',
    'release notes',
    'changelog',
    "what's new",
    'official docs',
    'api reference',
    'rate limits',
    'pricing',
  ];

  if (highSignalKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  // ========================================
  // AI-SPECIFIC KEYWORDS (always search - changes too fast)
  // ========================================
  const aiKeywordsWithContext = [
    'openai api',
    'anthropic api',
    'claude api',
    'gpt-4',
    'gpt-5',
    'claude 4',
    'claude opus',
    'claude sonnet',
    'gemini api',
    'ai sdk',
    'langchain',
    'llamaindex',
  ];

  // If AI keyword + version/api/docs context, search
  if (aiKeywordsWithContext.some((kw) => lower.includes(kw))) {
    return true;
  }

  // ========================================
  // MODEL NAME/ID KEYWORDS (critical for API setup)
  // ========================================
  const modelKeywords = [
    'model name',
    'model names',
    'model id',
    'model ids',
    'model identifier',
    'model string',
    'model list',
    'available models',
    'supported models',
    'model parameter',
    'model version',
    'model release',
    'which model',
    'what model',
    'latest model',
    'current model',
    'model deprecated',
    'model sunset',
  ];

  if (modelKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  return false;
}
