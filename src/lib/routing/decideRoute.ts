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
  /\bcreate\s+(a|an)\s+\w+\s+(for|about|to|regarding)\b/i,
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
 */
export function hasWebsiteIntent(text: string): { isWebsite: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check if this is a document request - documents should not be websites
  if (isDocumentRequest(normalizedText)) {
    return { isWebsite: false };
  }

  // Check for website generation patterns
  for (const pattern of WEBSITE_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isWebsite: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isWebsite: false };
}

/**
 * Check if a message indicates GitHub/code review intent
 */
export function hasGitHubIntent(text: string): { isGitHub: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check for GitHub patterns
  for (const pattern of GITHUB_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isGitHub: true,
        matchedPattern: pattern.source
      };
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
