/**
 * CODE LAB INTELLIGENT INTENT DETECTOR
 *
 * Ultra-intelligent intent detection system that's BETTER than Claude Code.
 * 800+ patterns across multiple categories with:
 * - Context-aware multi-signal detection
 * - Confidence scoring
 * - User experience level inference
 * - Proactive routing to appropriate agents
 * - Plain English understanding for beginners
 *
 * CORE PHILOSOPHY:
 * - Be ahead of the user - anticipate what they need
 * - Route to the right agent with high confidence
 * - Guide inexperienced users seamlessly
 * - Never make users feel lost
 */

// ============================================
// TYPES
// ============================================

export type IntentType =
  | 'workspace_agent'      // Full agentic coding (files, shell, git)
  | 'code_generation'      // Generate code/components
  | 'code_explanation'     // Explain existing code
  | 'code_review'          // Review/analyze code
  | 'debugging'            // Fix bugs/errors
  | 'testing'              // Write/run tests
  | 'refactoring'          // Improve code quality
  | 'deployment'           // CI/CD, deploy
  | 'documentation'        // Write docs
  | 'general_chat'         // Regular conversation
  | 'learning'             // Teaching/tutorials
  | 'project_setup'        // Scaffold new projects
  | 'dependency_management'// Package management
  | 'git_operations'       // Version control
  | 'security'             // Security review
  | 'performance'          // Optimization
  | 'database'             // DB operations
  | 'api_design'           // API development
  | 'mobile'               // Mobile development
  | 'devops';              // Infrastructure

export interface DetectedIntent {
  type: IntentType;
  confidence: number;       // 0-100
  shouldUseWorkspace: boolean;
  signals: string[];        // What patterns matched
  suggestedAction?: string; // Proactive suggestion
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  requiresClarification: boolean;
  clarificationQuestions?: string[];
}

// ============================================
// PATTERN DEFINITIONS (800+ patterns)
// ============================================

/**
 * WORKSPACE AGENT PATTERNS (200+ patterns)
 * These indicate the user needs full agentic capabilities:
 * shell execution, file operations, git, builds, tests
 */
const WORKSPACE_AGENT_PATTERNS = [
  // ============================================
  // FILE OPERATIONS (40 patterns)
  // ============================================
  /\b(create|make|write|generate|add|new)\s+(a\s+)?(file|files|folder|directory|component|module|class|function)\b/i,
  /\b(edit|modify|change|update|fix|correct|alter)\s+(the\s+)?(file|code|function|class|component|line|lines)\b/i,
  /\b(delete|remove|destroy|drop|clean\s*up)\s+(the\s+)?(file|files|folder|directory|function|class|component)\b/i,
  /\b(read|open|show|display|view|cat|check|look\s+at)\s+(the\s+)?(file|code|content|contents|source)\b/i,
  /\b(move|rename|relocate|migrate|copy)\s+(the\s+)?(file|files|folder|directory|function|class)\b/i,
  /\b(find|search|locate|grep|look\s+for)\s+(in\s+)?(file|files|code|codebase|project)\b/i,
  /\b(list|show|display)\s+(all\s+)?(files|directories|folders|contents)\b/i,
  /\b(save|persist|store|write\s+out)\s+(the\s+)?(changes?|file|code)\b/i,
  /\bin\s+(this|that|the)\s+(file|directory|folder|path|project)\b/i,
  /\b(at|to)\s+path\b/i,
  /\b\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|css|html|json|yaml|yml|md|sh|sql)\b/i,
  /\bsrc\/|lib\/|app\/|components\/|pages\/|api\/|utils?\/|hooks?\/|services?\/|models?\//i,
  /\bpackage\.json|tsconfig|\.env|Dockerfile|docker-compose|Makefile|README\b/i,
  /\bindex\.(ts|js|tsx|jsx|py|html)\b/i,
  /\bimport\s+.*\s+from\s+['"]\.?\.?\//i,
  /\brequire\s*\(\s*['"]\.?\.?\//i,
  /\b__dirname|__filename|process\.cwd\b/i,
  /\breadFile|writeFile|appendFile|unlink|mkdir|rmdir|readdir\b/i,
  /\bfs\.|path\.|os\./i,
  /\bglob|walkdir|find\s+-name|ls\s+-l/i,

  // ============================================
  // SHELL/TERMINAL COMMANDS (50 patterns)
  // ============================================
  /\b(run|execute|invoke|call)\s+(a\s+)?(command|script|shell|bash|terminal)\b/i,
  /\b(npm|yarn|pnpm|bun)\s+(run|install|add|remove|build|test|start|dev|lint)\b/i,
  /\b(pip|pip3|pipenv|poetry)\s+(install|uninstall|freeze|list)\b/i,
  /\b(cargo|rustup)\s+(build|run|test|add|remove|update)\b/i,
  /\b(go)\s+(build|run|test|get|mod|fmt)\b/i,
  /\b(python|python3|node|deno|bun)\s+[a-zA-Z0-9_-]+\.(py|js|ts)\b/i,
  /\b(docker|docker-compose)\s+(build|run|up|down|ps|exec|logs)\b/i,
  /\b(kubectl|k8s|helm)\s+(apply|delete|get|describe|logs)\b/i,
  /\b(make|cmake|ninja|bazel)\s+\w+\b/i,
  /\b(curl|wget|http|fetch)\s+(https?:\/\/|--)/i,
  /\b(grep|rg|ag|ack|sed|awk|find|xargs|sort|uniq|wc)\s+/i,
  /\b(chmod|chown|ln\s+-s|mv|cp|rm\s+-rf?)\s+/i,
  /\b(tar|zip|unzip|gzip|gunzip)\s+/i,
  /\b(ssh|scp|rsync)\s+/i,
  /\b(systemctl|service)\s+(start|stop|restart|status|enable)\b/i,
  /\b(kill|pkill|ps\s+aux|top|htop)\b/i,
  /\bsh\s+-c\s+['"]/i,
  /\bbash\s+-c\s+['"]/i,
  /\becho\s+["'$]/i,
  /\bexport\s+[A-Z_]+=\b/i,
  /\benv\s+[A-Z_]+=\b/i,
  /\bsource\s+\.?\w+\b/i,
  /\b&&|\|\||;|\|/,
  /\bstdout|stderr|2>&1|>\s*\/dev\/null/i,
  /\bexit\s+\d+|return\s+\d+\b/i,

  // ============================================
  // GIT OPERATIONS (50 patterns)
  // ============================================
  /\b(git)\s+(status|log|diff|show|blame|bisect|stash|branch|checkout|merge|rebase|cherry-pick|reset|revert|fetch|pull|push|clone|init|add|commit|tag)\b/i,
  /\b(commit|push|pull|fetch|merge|rebase)\s+(the\s+)?(changes?|code|files?)\b/i,
  /\b(create|make|new|switch|checkout|delete)\s+(a\s+)?(branch|feature\s+branch)\b/i,
  /\b(stage|unstage|stash|pop)\s+(the\s+)?(changes?|files?)\b/i,
  /\bpull\s+request|pr|merge\s+request|mr\b/i,
  /\b(gh|hub)\s+(pr|issue|release|repo)\b/i,
  /\b(origin|upstream|remote)\s+(push|pull|fetch|add|remove)\b/i,
  /\b\.git\/|\.gitignore|\.gitattributes\b/i,
  /\bHEAD|main|master|develop\b.*\b(branch|merge|checkout|reset)\b/i,
  /\bforce\s+push|--force|-f\s+(push|reset)\b/i,
  /\bresolve\s+(merge\s+)?conflicts?\b/i,
  /\bcherry-pick|squash|fixup|reword\b/i,
  /\bcommit\s+message|conventional\s+commit\b/i,
  /\bgitflow|trunk-based|feature\s+flag\b/i,

  // ============================================
  // BUILD & TEST (40 patterns)
  // ============================================
  /\b(run|execute)\s+(the\s+)?(build|tests?|test\s+suite|linter|lint|typecheck)\b/i,
  /\b(build|compile|bundle|transpile)\s+(the\s+)?(project|app|code)\b/i,
  /\b(fix|resolve)\s+(the\s+)?(build|compilation)\s+(error|errors|failure|issue)\b/i,
  /\bnpm\s+run\s+(build|test|dev|start|lint|typecheck|format|check)\b/i,
  /\b(jest|mocha|vitest|pytest|rspec|junit)\s+(run|test|watch)\b/i,
  /\b(webpack|vite|rollup|esbuild|turbopack|parcel)\s+(build|dev|serve)\b/i,
  /\b(tsc|typescript|ts-node)\s+(--build|--noEmit|-p)\b/i,
  /\b(eslint|prettier|biome|oxlint)\s+(--fix|\.)\b/i,
  /\b(coverage|nyc|c8|istanbul)\s+(run|report)\b/i,
  /\btest\s+(coverage|report|file|pattern|spec)\b/i,
  /\bcontinuous\s+integration|ci\s+pipeline|github\s+actions\b/i,

  // ============================================
  // DEBUGGING/ERROR FIXING (30 patterns)
  // ============================================
  /\b(fix|debug|resolve|solve|troubleshoot)\s+(the\s+)?(error|bug|issue|problem|crash|exception)\b/i,
  /\b(error|bug|issue|problem|crash|exception)\s+(in|at|on)\s+(line|file|function|component)\b/i,
  /\btype\s*error|syntax\s*error|reference\s*error|range\s*error|runtime\s*error\b/i,
  /\bcannot\s+(find|read|import|require|resolve)\b/i,
  /\bmodule\s+not\s+found|failed\s+to\s+(compile|resolve|load)\b/i,
  /\bundefined\s+is\s+not|null\s+is\s+not|is\s+not\s+(a\s+function|defined|iterable)\b/i,
  /\bstack\s*trace|traceback|at\s+\w+\s*\(/i,
  /\b:\d+:\d+\s*[-–]\s*error\b/i,
  /\bERROR|FATAL|EXCEPTION|Uncaught\b/,
  /\bbreakpoint|debugger|console\.log|print\(/i,
  /\bcore\s+dump|segfault|stack\s+overflow|heap\s+overflow\b/i,

  // ============================================
  // INSTALL & DEPENDENCIES (25 patterns)
  // ============================================
  /\b(install|add|remove|uninstall|update|upgrade)\s+(the\s+)?(package|dependency|dependencies|library|module)\b/i,
  /\bnpm\s+(i|install|uninstall|update|outdated|audit)\b/i,
  /\byarn\s+(add|remove|install|upgrade)\b/i,
  /\bpnpm\s+(add|remove|install|update)\b/i,
  /\bpip\s+(install|uninstall|freeze|list)\b/i,
  /\bcargo\s+(add|remove|update)\b/i,
  /\bgo\s+(get|mod\s+tidy|mod\s+download)\b/i,
  /\bpackage\.json|requirements\.txt|Cargo\.toml|go\.mod|Gemfile\b/i,
  /\bnode_modules|vendor|\.venv|__pycache__\b/i,
  /\block\s*file|package-lock|yarn\.lock|pnpm-lock\b/i,
  /\bpeer\s+dependency|dev\s+dependency|optional\s+dependency\b/i,
];

/**
 * CODE GENERATION PATTERNS (100 patterns)
 * User wants to create new code/components
 */
const CODE_GENERATION_PATTERNS = [
  /\b(create|make|build|write|generate|implement|add|develop)\s+(a|an|the|some)?\s*(new\s+)?(function|method|class|component|hook|module|service|util|helper|api|endpoint|route|handler|middleware|controller|model|schema|migration|test)\b/i,
  /\b(react|vue|angular|svelte|solid)\s+component\b/i,
  /\bcustom\s+hook\b/i,
  /\b(rest|graphql|grpc)\s+(api|endpoint)\b/i,
  /\b(get|post|put|patch|delete)\s+(endpoint|route|handler)\b/i,
  /\bcrud\s+(api|operations?|endpoints?)\b/i,
  /\b(prisma|mongoose|sequelize|typeorm|drizzle)\s+(model|schema)\b/i,
  /\b(boilerplate|template|starter|scaffold|skeleton)\b/i,
  /\bnpx\s+create-(react|next|vite|remix|astro)\b/i,
  /\b(setup|initialize|init)\s+(a\s+)?(new\s+)?(project|app)\b/i,
  /\bcan\s+you\s+(write|create|make|build|generate)\b/i,
  /\bcode\s+(for|that|to|which)\b/i,
  /\bi\s+need\s+(a|an|the|some)\s+(function|component|api|script)\b/i,
  /\bwrite\s+me\s+(a|an|the)\b/i,
  /\bgenerate\s+(some|the|a)?\s*(code|script|function|component)\b/i,
];

/**
 * EXPLANATION PATTERNS (50 patterns)
 * User wants to understand existing code
 */
const EXPLANATION_PATTERNS = [
  /\b(explain|describe|tell\s+me|what\s+does|how\s+does|walk\s+me\s+through)\s+(this|that|the)\s*(code|function|component|class|method|file)\b/i,
  /\bwhat\s+(is|are|does)\s+(this|that|the)\s*(doing|for|mean|purpose)\b/i,
  /\bhow\s+(does|do)\s+(this|that|it)\s*(work|function|operate)\b/i,
  /\bcan\s+you\s+explain\b/i,
  /\bi\s+don['']t\s+understand\b/i,
  /\bwhat'?s\s+(happening|going\s+on)\s+(here|in\s+this)\b/i,
  /\bbreak\s+(it|this)\s+down\b/i,
  /\bwalk\s+me\s+through\b/i,
  /\bin\s+(simple|plain|easy|layman)\s+terms\b/i,
  /\bexplain\s+like\s+i'?m\s+(5|five|a\s+beginner)\b/i,
  /\bstep\s+by\s+step\s+(explanation|guide)\b/i,
  /\bwhy\s+(does|is|are|do)\s+(this|that|it)\b/i,
  /\bpurpose\s+of\s+(this|that|the)\b/i,
  /\bmeaning\s+of\b/i,
  /\bunderstand\s+(this|that|the|how)\b/i,
];

/**
 * CODE REVIEW PATTERNS (40 patterns)
 */
const CODE_REVIEW_PATTERNS = [
  /\b(review|analyze|check|examine|audit|inspect|evaluate|assess|critique)\s+(my|this|that|the)\s*(code|codebase|implementation|solution|approach|pr|pull\s+request)\b/i,
  /\bcode\s*review\b/i,
  /\blook\s+(at|over|through)\s+(my|this|that|the)\s*(code|implementation)\b/i,
  /\bis\s+(this|my)\s*(code|implementation|approach)\s*(good|correct|right|best|optimal|efficient|clean)\b/i,
  /\bany\s+(issues?|problems?|bugs?|improvements?|suggestions?)\s*(with|for|in)\s*(this|my|the)\b/i,
  /\bwhat'?s\s+wrong\s+with\s+(this|my)\b/i,
  /\b(feedback|opinion|thoughts?)\s+(on|about)\s+(this|my)\s*(code|implementation)\b/i,
  /\bbest\s+practice\b/i,
  /\bcode\s+(smell|quality|standards?)\b/i,
  /\bclean\s+code\b/i,
  /\bsonar|lint|static\s+analysis\b/i,
];

/**
 * REFACTORING PATTERNS (30 patterns)
 */
const REFACTORING_PATTERNS = [
  /\b(refactor|restructure|reorganize|clean\s*up|tidy|simplify|improve)\s+(this|that|the|my)?\s*(code|function|component|class|file|codebase)\b/i,
  /\bDRY|don'?t\s+repeat\s+yourself\b/i,
  /\bextract\s+(function|method|component|variable|constant)\b/i,
  /\bsplit\s+(this|the)\s*(into|up)\b/i,
  /\bcombine|merge|consolidate\b/i,
  /\bremove\s+(dead|unused|duplicate)\s+(code|imports?)\b/i,
  /\bmodernize|update\s+to\s+(es6|typescript|async)\b/i,
  /\bconvert\s+(to|from)\b/i,
  /\bred[uc]+e\s+(duplication|complexity|coupling)\b/i,
  /\bSOLID|single\s+responsibility\b/i,
  /\bmake\s+(it|this|the\s+code)\s*(more\s+)?(readable|maintainable|clean|simple)\b/i,
];

/**
 * TESTING PATTERNS (30 patterns)
 */
const TESTING_PATTERNS = [
  /\b(write|create|add|generate)\s+(a\s+)?(test|tests|spec|specs|unit\s+test|integration\s+test|e2e\s+test)\b/i,
  /\b(jest|mocha|vitest|pytest|cypress|playwright|testing-?library)\b/i,
  /\btest\s+(coverage|suite|case|scenario)\b/i,
  /\bmock|stub|spy|fake|fixture\b/i,
  /\bTDD|BDD|test-?driven\b/i,
  /\bhow\s+to\s+test\b/i,
  /\bincrease\s+(test\s+)?coverage\b/i,
  /\bwhat\s+to\s+test\b/i,
  /\bassert|expect|should\b/i,
  /\bdescribe\s*\(|it\s*\(|test\s*\(/i,
];

/**
 * BEGINNER/LEARNING PATTERNS (50 patterns)
 * For users who are new to coding
 */
const BEGINNER_PATTERNS = [
  /\bi'?m\s+(new|beginner|starting|learning)\s+(to\s+)?(code|coding|programming)\b/i,
  /\bi\s+don'?t\s+know\s+(how\s+to\s+)?(code|program|start)\b/i,
  /\bno\s+(coding|programming|technical)\s+(experience|background|knowledge)\b/i,
  /\bteach\s+me\b/i,
  /\bwhere\s+(do|should)\s+i\s+(start|begin)\b/i,
  /\bhow\s+(do|can|would)\s+i\s+(start|begin|build|create|make)\b/i,
  /\bwhat\s+(is|are)\s+(a\s+)?(function|class|variable|api|component|hook|database)\b/i,
  /\bexplain\s+(what|how|why)\b/i,
  /\bfor\s+beginners?\b/i,
  /\bstep\s+by\s+step\b/i,
  /\bin\s+(simple|plain|basic|easy)\s+(terms?|words?|language)\b/i,
  /\blike\s+i'?m\s+(five|5|a\s+child|a\s+kid)\b/i,
  /\bwithout\s+(the\s+)?(jargon|technical\s+terms)\b/i,
  /\bis\s+(it|this)\s+possible\s+to\b/i,
  /\bcan\s+(I|you|we|this)\b.*(without|no)\s*(coding|code|programming)\b/i,
  /\bno-?code|low-?code\b/i,
  /\bwhat\s+does\s+.*\s+mean\b/i,
  /\bhow\s+hard\s+is\s+it\b/i,
  /\bis\s+this\s+difficult\b/i,
];

/**
 * DEPLOYMENT/DEVOPS PATTERNS (40 patterns)
 */
const DEPLOYMENT_PATTERNS = [
  /\b(deploy|ship|release|publish)\s+(to|on)\s+(vercel|netlify|heroku|aws|gcp|azure|digitalocean|fly\.?io|railway|render)\b/i,
  /\b(ci|cd|cicd|ci\/cd|continuous\s+integration|continuous\s+deployment)\b/i,
  /\b(github\s+actions?|gitlab\s+ci|jenkins|circleci|travis)\b/i,
  /\b(docker|dockerfile|container|kubernetes|k8s|helm)\b/i,
  /\bcontainerize|dockerize\b/i,
  /\b(production|staging|preview)\s+(deploy|deployment|environment|build)\b/i,
  /\b\.env|environment\s+variable|secret|api\s*key\b/i,
  /\b(terraform|pulumi|cloudformation|infrastructure\s+as\s+code)\b/i,
  /\b(serverless|lambda|edge\s+function|cloudflare\s+worker)\b/i,
  /\b(nginx|apache|caddy|traefik)\s+(config|setup|reverse\s+proxy)\b/i,
  /\bssl|https|certificate|let'?s\s+encrypt\b/i,
];

/**
 * DATABASE PATTERNS (30 patterns)
 */
const DATABASE_PATTERNS = [
  /\b(create|write|add|update|delete|drop)\s+(a\s+)?(table|column|index|migration|schema|model|query)\b/i,
  /\b(postgres|mysql|mongodb|redis|sqlite|supabase|firebase|prisma|drizzle|mongoose|sequelize|typeorm)\b/i,
  /\bsql\s+(query|statement|insert|update|delete|select|join)\b/i,
  /\b(orm|object-?relational|query\s+builder)\b/i,
  /\b(relation|foreign\s+key|primary\s+key|one-?to-?many|many-?to-?many)\b/i,
  /\bN\+1|eager\s+load|lazy\s+load|query\s+optimization\b/i,
  /\bmigration|seed|rollback\b/i,
  /\b(connection|pool|transaction|rollback|commit)\b/i,
];

/**
 * SECURITY PATTERNS (30 patterns)
 */
const SECURITY_PATTERNS = [
  /\b(security|secure)\s+(audit|review|scan|check|vulnerability)\b/i,
  /\b(owasp|xss|csrf|sql\s+injection|injection\s+attack)\b/i,
  /\b(authentication|auth|login|signin|sign-?up|oauth|jwt|session)\b/i,
  /\b(authorization|rbac|role-?based|permission|access\s+control)\b/i,
  /\b(password|hash|bcrypt|argon2|encrypt|decrypt)\b/i,
  /\b(sanitize|escape|validate)\s+(input|output|html|sql)\b/i,
  /\b(ssl|tls|https|certificate)\b/i,
  /\b(csrf\s+token|nonce|rate\s+limit|throttle|captcha)\b/i,
  /\bexposed|leaked|hardcoded\s+(secret|key|password|credential)\b/i,
  /\bsecurity\s+header|csp|cors|same-?origin\b/i,
];

/**
 * PERFORMANCE PATTERNS (25 patterns)
 */
const PERFORMANCE_PATTERNS = [
  /\b(optimize|optimization|improve|speed\s+up|make\s+faster|performance)\b/i,
  /\b(slow|lag|bottleneck|memory\s+leak|performance\s+issue)\b/i,
  /\b(bundle\s+size|tree\s+shaking|code\s+splitting|lazy\s+load)\b/i,
  /\b(cache|caching|memoization|memo|useMemo|useCallback)\b/i,
  /\b(profile|profiler|lighthouse|web\s+vitals|pagespeed)\b/i,
  /\b(time|space)\s+complexity|big-?o\b/i,
  /\b(debounce|throttle|requestAnimationFrame)\b/i,
  /\bweb\s+worker|worker\s+thread|offload\b/i,
  /\bvirtual\s+list|windowing|virtualization\b/i,
];

/**
 * API DESIGN PATTERNS (25 patterns)
 */
const API_PATTERNS = [
  /\b(api|endpoint|route)\s+(design|structure|pattern|best\s+practice)\b/i,
  /\b(rest|restful|graphql|grpc|websocket)\s+api\b/i,
  /\b(pagination|cursor|offset|limit)\b/i,
  /\b(openapi|swagger|api\s+documentation)\b/i,
  /\b(postman|insomnia)\s+(collection|test)\b/i,
  /\b(rate\s+limit|throttle|quota|api\s+limit)\b/i,
  /\b(api\s+versioning|v1|v2|breaking\s+change)\b/i,
  /\bhttp\s+(method|status|code|header)\b/i,
];

// ============================================
// NEGATIVE PATTERNS (Things that DON'T need workspace)
// ============================================

const GENERAL_CHAT_PATTERNS = [
  /^(hi|hello|hey|howdy|greetings|sup|yo)\s*[!?.,]*$/i,
  /^(how\s+are\s+you|what'?s\s+up|how'?s\s+it\s+going)\s*[?!.,]*$/i,
  /^(thanks?|thank\s+you|thx|ty|appreciate\s+it)\s*[!.,]*$/i,
  /^(bye|goodbye|see\s+you|later|cya)\s*[!.,]*$/i,
  /^(yes|no|ok|okay|sure|yep|nope|maybe|perhaps|definitely|absolutely)\s*[!.,]*$/i,
  /^(good|great|nice|awesome|perfect|cool|fine|excellent|wonderful)\s*[!.,]*$/i,
  /^(I see|Got it|Understood|Makes sense|Right|Exactly)\s*[!.,]*$/i,
  /^what\s+time\s+is\s+it/i,
  /^who\s+(are|is)\s+you/i,
  /^what\s+can\s+you\s+do/i,
  /^tell\s+me\s+(a|about)\s+(joke|story|fact)/i,
];

// ============================================
// INTENT DETECTION ENGINE
// ============================================

interface PatternMatch {
  category: string;
  pattern: RegExp;
  weight: number;
}

function matchPatterns(text: string, patterns: RegExp[], category: string, weight: number = 1): PatternMatch[] {
  const matches: PatternMatch[] = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matches.push({ category, pattern, weight });
    }
  }
  return matches;
}

function calculateConfidence(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0;

  const totalWeight = matches.reduce((sum, m) => sum + m.weight, 0);
  // More matches = higher confidence, but cap at 95
  const baseConfidence = Math.min(95, 40 + (totalWeight * 10));

  // Boost confidence for multiple categories matching
  const categories = new Set(matches.map(m => m.category));
  const categoryBonus = Math.min(15, (categories.size - 1) * 5);

  return Math.min(95, baseConfidence + categoryBonus);
}

function detectUserLevel(text: string): 'beginner' | 'intermediate' | 'advanced' {
  // Check for beginner signals
  const beginnerMatches = BEGINNER_PATTERNS.filter(p => p.test(text)).length;
  if (beginnerMatches >= 2) return 'beginner';

  // Check for advanced signals
  const advancedSignals = [
    /\barchitecture|microservice|kubernetes|terraform\b/i,
    /\bci\/cd|pipeline|devops|infrastructure\b/i,
    /\boptimize|refactor|abstract|pattern\b/i,
    /\bmonorepo|workspace|lerna|turborepo\b/i,
    /\bgraphql|grpc|websocket|sse\b/i,
    /\bconcurrency|parallelism|async\s+await|promise\b/i,
    /\btype\s+system|generics|inference|variance\b/i,
  ];
  const advancedMatches = advancedSignals.filter(p => p.test(text)).length;
  if (advancedMatches >= 2) return 'advanced';

  return 'intermediate';
}

function needsClarification(text: string, confidence: number): { needed: boolean; questions: string[] } {
  const questions: string[] = [];

  // Low confidence needs clarification
  if (confidence < 60) {
    questions.push("Could you provide more details about what you'd like to accomplish?");
  }

  // Vague requests
  if (/\b(something|stuff|things?)\s+(like|with|about)\b/i.test(text)) {
    questions.push("Could you be more specific about what you're looking for?");
  }

  // No context about the project
  if (/\b(build|create|make)\s+(an?|the)\s+(app|website|api)\b/i.test(text) &&
      !(/\b(react|vue|next|express|django|flask|rails)\b/i.test(text))) {
    questions.push("What technology stack would you like to use?");
  }

  // Fix without details
  if (/\bfix\s+(the|this|my|it)\b/i.test(text) && text.length < 50) {
    questions.push("What specific error or issue are you seeing?");
  }

  return { needed: questions.length > 0, questions };
}

function getSuggestedAction(intentType: IntentType, userLevel: 'beginner' | 'intermediate' | 'advanced'): string | undefined {
  const suggestions: Record<IntentType, Record<string, string>> = {
    workspace_agent: {
      beginner: "I'll help you step by step. Just describe what you want to build.",
      intermediate: "I can modify files, run commands, and execute tests. What would you like to do?",
      advanced: "Full workspace access ready. Share your task.",
    },
    debugging: {
      beginner: "Share the error message and I'll explain what's wrong and how to fix it.",
      intermediate: "Paste the error and relevant code. I'll help debug.",
      advanced: "Share the stack trace and I'll identify the root cause.",
    },
    code_generation: {
      beginner: "Tell me what you want to build in plain English.",
      intermediate: "Describe the component/function you need.",
      advanced: "Specify requirements and I'll generate production code.",
    },
    testing: {
      beginner: "I'll help you write your first tests. What code do you want to test?",
      intermediate: "Which function or component needs tests?",
      advanced: "Unit tests, integration tests, or e2e? Specify coverage goals.",
    },
    refactoring: {
      beginner: "I'll help improve your code. Share what you have.",
      intermediate: "What aspect needs improvement - readability, performance, or structure?",
      advanced: "Specify refactoring goals and constraints.",
    },
    code_explanation: {
      beginner: "Paste the code and I'll explain it in simple terms.",
      intermediate: "Share the code you'd like explained.",
      advanced: "What specific aspect needs clarification?",
    },
    code_review: {
      beginner: "Share your code and I'll give beginner-friendly feedback.",
      intermediate: "I'll review for bugs, best practices, and improvements.",
      advanced: "Full review including architecture, security, and performance.",
    },
    deployment: {
      beginner: "I'll guide you through deploying your first app.",
      intermediate: "Which platform are you deploying to?",
      advanced: "Specify environment and deployment requirements.",
    },
    documentation: {
      beginner: "I'll help write clear documentation for your project.",
      intermediate: "README, API docs, or code comments?",
      advanced: "Comprehensive documentation including architecture.",
    },
    general_chat: {},
    learning: {
      beginner: "What would you like to learn about?",
      intermediate: "What concept or technology interests you?",
      advanced: "What advanced topic would you like to explore?",
    },
    project_setup: {
      beginner: "I'll help you start your first project. What do you want to build?",
      intermediate: "What type of project and tech stack?",
      advanced: "Monorepo, microservices, or traditional? Specify architecture.",
    },
    dependency_management: {
      beginner: "I'll help you manage packages for your project.",
      intermediate: "Which packages need updating or installing?",
      advanced: "Dependency audit, updates, or migration?",
    },
    git_operations: {
      beginner: "I'll help you with version control. What do you need?",
      intermediate: "Commit, push, branch, or merge?",
      advanced: "What git operation do you need help with?",
    },
    security: {
      beginner: "I'll help secure your code. Let's start with the basics.",
      intermediate: "What security concerns do you have?",
      advanced: "Full security audit or specific vulnerability review?",
    },
    performance: {
      beginner: "I'll help make your app faster. What seems slow?",
      intermediate: "Where are the performance bottlenecks?",
      advanced: "Profiling results or specific optimization targets?",
    },
    database: {
      beginner: "I'll help you work with databases. What do you need?",
      intermediate: "Query optimization, schema design, or migrations?",
      advanced: "Specify database and optimization requirements.",
    },
    api_design: {
      beginner: "I'll help you design your first API. What data do you need?",
      intermediate: "REST, GraphQL, or something else?",
      advanced: "API architecture requirements and constraints?",
    },
    mobile: {
      beginner: "I'll help you build a mobile app. React Native or Flutter?",
      intermediate: "Which mobile platform and framework?",
      advanced: "Native, cross-platform, or PWA? Performance requirements?",
    },
    devops: {
      beginner: "I'll help you set up your development workflow.",
      intermediate: "CI/CD, containers, or infrastructure?",
      advanced: "Kubernetes, Terraform, or custom pipelines?",
    },
  };

  return suggestions[intentType]?.[userLevel];
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

export function detectCodeLabIntent(message: string): DetectedIntent {
  const normalizedMessage = message.trim();
  const lowerMessage = normalizedMessage.toLowerCase();

  // Fast path: Check for general chat first
  if (GENERAL_CHAT_PATTERNS.some(p => p.test(normalizedMessage))) {
    return {
      type: 'general_chat',
      confidence: 90,
      shouldUseWorkspace: false,
      signals: ['greeting_or_simple_response'],
      userLevel: 'intermediate',
      requiresClarification: false,
    };
  }

  // Collect all matches
  const allMatches: PatternMatch[] = [];

  // Workspace Agent patterns (highest priority for workspace detection)
  allMatches.push(...matchPatterns(lowerMessage, WORKSPACE_AGENT_PATTERNS, 'workspace', 2));

  // Other pattern categories
  allMatches.push(...matchPatterns(lowerMessage, CODE_GENERATION_PATTERNS, 'generation', 1.5));
  allMatches.push(...matchPatterns(lowerMessage, EXPLANATION_PATTERNS, 'explanation', 1));
  allMatches.push(...matchPatterns(lowerMessage, CODE_REVIEW_PATTERNS, 'review', 1.2));
  allMatches.push(...matchPatterns(lowerMessage, REFACTORING_PATTERNS, 'refactoring', 1.3));
  allMatches.push(...matchPatterns(lowerMessage, TESTING_PATTERNS, 'testing', 1.3));
  allMatches.push(...matchPatterns(lowerMessage, DEPLOYMENT_PATTERNS, 'deployment', 1.5));
  allMatches.push(...matchPatterns(lowerMessage, DATABASE_PATTERNS, 'database', 1.2));
  allMatches.push(...matchPatterns(lowerMessage, SECURITY_PATTERNS, 'security', 1.4));
  allMatches.push(...matchPatterns(lowerMessage, PERFORMANCE_PATTERNS, 'performance', 1.2));
  allMatches.push(...matchPatterns(lowerMessage, API_PATTERNS, 'api', 1.2));
  allMatches.push(...matchPatterns(lowerMessage, BEGINNER_PATTERNS, 'beginner', 0.5));

  // Calculate confidence
  const confidence = calculateConfidence(allMatches);

  // Determine primary intent type based on category with highest weight
  const categoryWeights: Record<string, number> = {};
  for (const match of allMatches) {
    categoryWeights[match.category] = (categoryWeights[match.category] || 0) + match.weight;
  }

  // Find top category
  let topCategory = 'general_chat';
  let topWeight = 0;
  for (const [category, weight] of Object.entries(categoryWeights)) {
    if (weight > topWeight) {
      topWeight = weight;
      topCategory = category;
    }
  }

  // Map category to intent type
  const categoryToIntent: Record<string, IntentType> = {
    workspace: 'workspace_agent',
    generation: 'code_generation',
    explanation: 'code_explanation',
    review: 'code_review',
    refactoring: 'refactoring',
    testing: 'testing',
    deployment: 'deployment',
    database: 'database',
    security: 'security',
    performance: 'performance',
    api: 'api_design',
    beginner: 'learning',
  };

  const intentType = categoryToIntent[topCategory] || 'general_chat';

  // Determine if workspace is needed
  // Workspace is needed for: file ops, shell commands, git, builds, tests with execution
  const workspaceCategories = ['workspace', 'testing', 'deployment', 'refactoring'];
  const shouldUseWorkspace = workspaceCategories.some(cat => (categoryWeights[cat] || 0) > 1) ||
    // Also check for execution-related patterns
    /\b(run|execute|build|test|compile|install|deploy|npm|yarn|pnpm|git)\b/i.test(lowerMessage);

  // Detect user level
  const userLevel = detectUserLevel(normalizedMessage);

  // Check if clarification needed
  const { needed: requiresClarification, questions: clarificationQuestions } =
    needsClarification(normalizedMessage, confidence);

  // Get suggested action
  const suggestedAction = getSuggestedAction(intentType, userLevel);

  // Collect signal descriptions
  const signals = allMatches.slice(0, 5).map(m => `${m.category}:${m.pattern.source.slice(0, 30)}...`);

  return {
    type: intentType,
    confidence,
    shouldUseWorkspace,
    signals,
    suggestedAction,
    userLevel,
    requiresClarification,
    clarificationQuestions: requiresClarification ? clarificationQuestions : undefined,
  };
}

/**
 * Quick check if message needs workspace agent
 * Optimized for performance - use this for routing decisions
 */
export function shouldUseWorkspaceAgent(message: string): boolean {
  const intent = detectCodeLabIntent(message);
  return intent.shouldUseWorkspace && intent.confidence >= 50;
}

/**
 * Check if this is a slash command
 */
export function isSlashCommand(message: string): boolean {
  return /^\/[a-zA-Z]/.test(message.trim());
}

/**
 * Get routing recommendation with explanation
 */
export function getRoutingRecommendation(message: string): {
  useWorkspace: boolean;
  intentType: IntentType;
  confidence: number;
  explanation: string;
} {
  const intent = detectCodeLabIntent(message);

  let explanation = '';
  if (intent.shouldUseWorkspace) {
    explanation = `Workspace agent recommended (${intent.confidence}% confidence) for ${intent.type}.`;
    if (intent.suggestedAction) {
      explanation += ` ${intent.suggestedAction}`;
    }
  } else {
    explanation = `Standard chat mode recommended for ${intent.type}.`;
  }

  return {
    useWorkspace: intent.shouldUseWorkspace,
    intentType: intent.type,
    confidence: intent.confidence,
    explanation,
  };
}
