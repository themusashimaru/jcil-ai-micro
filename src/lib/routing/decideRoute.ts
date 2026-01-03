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
 * Comprehensive pattern matching for ALL developer workflows:
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
 */
const GITHUB_INTENT_PATTERNS = [
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
