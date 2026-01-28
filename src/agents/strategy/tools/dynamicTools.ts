/**
 * DYNAMIC TOOL CREATION SYSTEM
 *
 * Allows scouts to create custom tools on-the-fly when the 13 hardcoded tools
 * aren't sufficient for a specific task. This is the "extend when needed" capability.
 *
 * IMPORTANT: All dynamically created tools go through multiple safety gates:
 * 1. Intent validation - Is the purpose legitimate?
 * 2. Code analysis - Does the code contain dangerous patterns?
 * 3. Sandbox execution - Run in isolated E2B environment
 * 4. Output sanitization - Remove any sensitive data from results
 *
 * This system is designed to be ADDITIVE to the 13 core tools, not a replacement.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Sandbox } from '@e2b/code-interpreter';
import { logger } from '@/lib/logger';
import {
  isUrlSafe,
  sanitizeOutput,
  checkContentForWarnings,
  AI_SAFETY_PROMPT,
  SafetyCheckResult,
  logBlockedAction,
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  ADULT_KEYWORDS,
} from './safety';

const log = logger('DynamicTools');

// =============================================================================
// TYPES
// =============================================================================

export interface DynamicToolRequest {
  /** What the tool should accomplish */
  purpose: string;
  /** Why the existing tools aren't sufficient */
  justification: string;
  /** Expected inputs */
  inputs: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
  }>;
  /** Expected output type */
  outputType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'mixed';
  /** Suggested implementation approach */
  approach?: string;
  /** Session ID for tracking */
  sessionId: string;
}

export interface DynamicToolDefinition {
  id: string;
  name: string;
  description: string;
  purpose: string;
  inputSchema: object;
  code: string;
  language: 'python' | 'javascript';
  approved: boolean;
  approvalReason?: string;
  rejectionReason?: string;
  createdAt: number;
  usageCount: number;
  lastUsed?: number;
  safetyScore: number; // 0-100
}

export interface DynamicToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  sanitized: boolean;
}

// =============================================================================
// SAFETY GATES
// =============================================================================

/**
 * DANGEROUS PATTERNS - Code patterns that are NEVER allowed
 */
const DANGEROUS_CODE_PATTERNS = [
  // Network requests to blocked domains
  ...BLOCKED_DOMAINS.map((d) => new RegExp(d.replace('.', '\\.'), 'i')),
  ...BLOCKED_TLDS.map((t) => new RegExp(t.replace('.', '\\.'), 'i')),

  // Filesystem access outside sandbox
  /os\.system/i,
  /subprocess\./i,
  /exec\(/i,
  /eval\(/i,
  /spawn\(/i,
  /fork\(/i,
  /execSync/i,
  /spawnSync/i,
  /child_process/i,

  // Environment/secrets access
  /process\.env/i,
  /os\.environ/i,
  /getenv\(/i,
  /\.env\b/i,
  /secrets?\./i,
  /credentials?\./i,
  /api[_-]?key/i,
  /auth[_-]?token/i,

  // Network attacks
  /socket\./i,
  /DDOS/i,
  /flood/i,
  /brute[_-]?force/i,

  // Malware patterns
  /keylog/i,
  /screenshot\s*grab/i,
  /clipboard/i,
  /webcam/i,
  /microphone/i,
  /screen[_-]?capture/i,

  // Crypto mining
  /miner/i,
  /mining/i,
  /crypto[_-]?jacking/i,
  /monero/i,
  /xmr/i,

  // Data exfiltration
  /base64[_-]?encode.*http/i,
  /http.*base64/i,
  /upload.*credential/i,
  /send.*password/i,
  /post.*secret/i,

  // Reverse shells
  /reverse[_-]?shell/i,
  /bind[_-]?shell/i,
  /nc\s+-e/i,
  /netcat/i,
  /bash\s+-i/i,

  // SQL injection helpers
  /sql[_-]?inject/i,
  /union\s+select/i,
  /drop\s+table/i,
  /delete\s+from/i,

  // XSS helpers
  /<script/i,
  /document\.cookie/i,
  /innerHTML\s*=/i,
  /onclick\s*=/i,

  // File operations on sensitive paths
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\.ssh\//i,
  /\.aws\//i,
  /\.kube\//i,
  /\.docker\//i,

  // Windows-specific dangerous
  /reg\s+add/i,
  /reg\s+delete/i,
  /powershell/i,
  /cmd\.exe/i,

  // Dangerous imports
  /import\s+pickle/i,
  /import\s+marshal/i,
  /import\s+ctypes/i,
  /from\s+ctypes/i,
];

/**
 * DANGEROUS PURPOSE PATTERNS - Intents that are NEVER allowed
 */
const DANGEROUS_PURPOSE_PATTERNS = [
  // Criminal activities
  /hack/i,
  /crack/i,
  /exploit/i,
  /bypass/i,
  /brute[_-]?force/i,
  /phish/i,
  /scam/i,
  /fraud/i,
  /steal/i,
  /theft/i,

  // Violence/harm
  /weapon/i,
  /bomb/i,
  /explosive/i,
  /kill/i,
  /murder/i,
  /assassin/i,
  /terror/i,
  /harm/i,
  /hurt/i,

  // Drugs
  /drug/i,
  /narcotic/i,
  /cocaine/i,
  /heroin/i,
  /meth/i,
  /fentanyl/i,
  /carfentanil/i,

  // Human trafficking
  /traffic/i,
  /slave/i,
  /forced\s*labor/i,
  /human\s*smuggl/i,

  // Child exploitation
  /child\s*(porn|abuse|exploit)/i,
  /minor/i,
  /underage/i,
  /csam/i,
  /pedo/i,

  // Adult content
  ...ADULT_KEYWORDS.map((k) => new RegExp(k, 'i')),

  // Surveillance/stalking
  /stalk/i,
  /track\s*person/i,
  /spy/i,
  /surveil/i,
  /doxx/i,

  // Misinformation
  /fake\s*news/i,
  /disinform/i,
  /propagan/i,

  // Financial crimes
  /launder/i,
  /counterfeit/i,
  /ponzi/i,
  /pyramid\s*scheme/i,
];

/**
 * Validate the purpose/intent of a dynamic tool request
 */
export function validateToolPurpose(request: DynamicToolRequest): SafetyCheckResult {
  const purposeLower = (request.purpose + ' ' + request.justification).toLowerCase();

  // Check against dangerous purpose patterns
  for (const pattern of DANGEROUS_PURPOSE_PATTERNS) {
    if (pattern.test(purposeLower)) {
      return {
        safe: false,
        reason: `Blocked purpose pattern: ${pattern.toString()}`,
        severity: 'critical',
        category: 'malicious_intent',
      };
    }
  }

  // Check for warning keywords
  const warnings = checkContentForWarnings(purposeLower);
  if (warnings.requiresReview) {
    return {
      safe: false,
      reason: `Purpose contains multiple warning keywords: ${warnings.keywords.join(', ')}`,
      severity: 'high',
      category: 'suspicious_intent',
    };
  }

  return { safe: true };
}

/**
 * Validate generated code for a dynamic tool
 */
export function validateToolCode(code: string, language: string): SafetyCheckResult {
  // Check against dangerous code patterns (patterns are case-insensitive)
  for (const pattern of DANGEROUS_CODE_PATTERNS) {
    if (pattern.test(code)) {
      return {
        safe: false,
        reason: `Dangerous code pattern detected: ${pattern.toString()}`,
        severity: 'critical',
        category: 'malicious_code',
      };
    }
  }

  // Check for URLs in the code
  const urlPattern = /https?:\/\/[^\s'"]+/gi;
  const urls = code.match(urlPattern) || [];
  for (const url of urls) {
    const urlCheck = isUrlSafe(url);
    if (!urlCheck.safe) {
      return {
        safe: false,
        reason: `Code contains blocked URL: ${url} - ${urlCheck.reason}`,
        severity: 'critical',
        category: 'blocked_url',
      };
    }
  }

  // Language-specific checks
  if (language === 'python') {
    // Check for dangerous Python patterns
    const pythonDangerousPatterns = [
      /__import__/i,
      /importlib/i,
      /builtins/i,
      /globals\(\)/i,
      /locals\(\)/i,
      /compile\(/i,
      /open\(.*(\/etc|\/var|\/root|\/home)/i,
    ];

    for (const pattern of pythonDangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Dangerous Python pattern: ${pattern.toString()}`,
          severity: 'high',
          category: 'dangerous_python',
        };
      }
    }
  }

  if (language === 'javascript') {
    // Check for dangerous JavaScript patterns
    const jsDangerousPatterns = [
      /Function\(/i,
      /require\(.*(child_process|fs|net|http|https)/i,
      /import\(.*(child_process|fs|net)/i,
      /global\./i,
      /process\./i,
      /Buffer\.from/i, // Could be used for encoding malicious data
    ];

    for (const pattern of jsDangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Dangerous JavaScript pattern: ${pattern.toString()}`,
          severity: 'high',
          category: 'dangerous_javascript',
        };
      }
    }
  }

  return { safe: true };
}

// =============================================================================
// DYNAMIC TOOL GENERATOR
// =============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

/**
 * Generate a dynamic tool based on a request
 * This uses Claude to generate safe, sandboxed code
 */
export async function generateDynamicTool(
  request: DynamicToolRequest
): Promise<DynamicToolDefinition | null> {
  const startTime = Date.now();

  log.info('Dynamic tool request received', {
    purpose: request.purpose,
    sessionId: request.sessionId,
  });

  // GATE 1: Validate purpose/intent
  const purposeCheck = validateToolPurpose(request);
  if (!purposeCheck.safe) {
    logBlockedAction(request.sessionId, 'dynamic_tool_creation', purposeCheck, {
      purpose: request.purpose,
    });

    log.error('Dynamic tool creation blocked - dangerous purpose', {
      reason: purposeCheck.reason,
      sessionId: request.sessionId,
    });

    return null;
  }

  // Generate tool code using Claude
  const client = getAnthropicClient();

  const systemPrompt = `You are a code generation assistant that creates safe, sandboxed tools.
Your tools run in an E2B sandbox with NO internet access except through approved APIs.

${AI_SAFETY_PROMPT}

CRITICAL RULES FOR CODE GENERATION:
1. NEVER include code that accesses:
   - Environment variables
   - File system outside /tmp
   - Network/socket connections
   - System commands (os.system, subprocess, exec)
   - Eval or dynamic code execution

2. ONLY use these approved libraries:
   Python: requests (for approved APIs only), json, re, math, datetime, collections
   JavaScript: fetch (for approved APIs only), JSON, Math, Date

3. All URLs must be to approved domains (Zillow, LinkedIn, Wikipedia, etc.)

4. ALWAYS return results as JSON-serializable data

5. Include error handling for all operations

6. Keep code simple and focused on the stated purpose

Return your response in this exact JSON format:
{
  "name": "tool_name_snake_case",
  "description": "What this tool does",
  "code": "the actual code",
  "language": "python" or "javascript",
  "safe": true or false,
  "safetyNotes": "explanation of safety considerations"
}`;

  const userPrompt = `Create a safe tool for the following purpose:

PURPOSE: ${request.purpose}

JUSTIFICATION: ${request.justification}

EXPECTED INPUTS:
${request.inputs.map((i) => `- ${i.name} (${i.type}${i.required ? ', required' : ', optional'}): ${i.description}`).join('\n')}

EXPECTED OUTPUT TYPE: ${request.outputType}

${request.approach ? `SUGGESTED APPROACH: ${request.approach}` : ''}

Generate a safe, sandboxed implementation. Remember:
- No network access except approved APIs
- No file system access except /tmp
- No system commands
- Return JSON-serializable results`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Use Sonnet for code generation
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.error('Failed to parse dynamic tool response', { response: textContent });
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // GATE 2: Validate generated code
    const codeCheck = validateToolCode(parsed.code, parsed.language);
    if (!codeCheck.safe) {
      logBlockedAction(request.sessionId, 'dynamic_tool_code', codeCheck, {
        purpose: request.purpose,
        codeSnippet: parsed.code.slice(0, 200),
      });

      log.error('Dynamic tool code blocked - dangerous patterns', {
        reason: codeCheck.reason,
        sessionId: request.sessionId,
      });

      return null;
    }

    // Check if Claude itself flagged the code as unsafe
    if (!parsed.safe) {
      log.warn('Claude flagged generated code as potentially unsafe', {
        safetyNotes: parsed.safetyNotes,
        sessionId: request.sessionId,
      });
      return null;
    }

    // Build input schema from request
    const inputSchema = {
      type: 'object',
      properties: Object.fromEntries(
        request.inputs.map((i) => [
          i.name,
          {
            type: i.type,
            description: i.description,
          },
        ])
      ),
      required: request.inputs.filter((i) => i.required).map((i) => i.name),
    };

    const toolDef: DynamicToolDefinition = {
      id: `dynamic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: parsed.name,
      description: parsed.description,
      purpose: request.purpose,
      inputSchema,
      code: parsed.code,
      language: parsed.language,
      approved: true,
      approvalReason: 'Passed automated safety checks',
      createdAt: Date.now(),
      usageCount: 0,
      safetyScore: 85, // Base score for auto-approved tools
    };

    log.info('Dynamic tool created successfully', {
      toolId: toolDef.id,
      toolName: toolDef.name,
      sessionId: request.sessionId,
      creationTimeMs: Date.now() - startTime,
    });

    return toolDef;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Dynamic tool generation failed', {
      error: errMsg,
      sessionId: request.sessionId,
    });
    return null;
  }
}

// =============================================================================
// DYNAMIC TOOL EXECUTOR
// =============================================================================

let dynamicSandbox: Sandbox | null = null;

/**
 * Execute a dynamic tool in an isolated sandbox
 */
export async function executeDynamicTool(
  tool: DynamicToolDefinition,
  inputs: Record<string, unknown>,
  sessionId: string
): Promise<DynamicToolResult> {
  const startTime = Date.now();

  log.info('Executing dynamic tool', {
    toolId: tool.id,
    toolName: tool.name,
    sessionId,
  });

  // Final safety check on inputs
  const inputStr = JSON.stringify(inputs);
  for (const pattern of DANGEROUS_CODE_PATTERNS) {
    if (pattern.test(inputStr)) {
      logBlockedAction(
        sessionId,
        'dynamic_tool_input',
        {
          safe: false,
          reason: `Dangerous input pattern: ${pattern.toString()}`,
          severity: 'high',
          category: 'malicious_input',
        },
        { toolId: tool.id }
      );

      return {
        success: false,
        error: 'Input contains blocked patterns',
        executionTimeMs: Date.now() - startTime,
        sanitized: false,
      };
    }
  }

  try {
    // Create or reuse sandbox
    if (!dynamicSandbox) {
      dynamicSandbox = await Sandbox.create({ timeoutMs: 30000 });
    }

    // Prepare the execution code
    let execCode: string;
    if (tool.language === 'python') {
      execCode = `
import json

# Inputs
inputs = json.loads('''${JSON.stringify(inputs)}''')

# Tool code
${tool.code}

# Execute and print result
try:
    result = main(**inputs)
    print(json.dumps({"success": True, "result": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;
    } else {
      execCode = `
const inputs = ${JSON.stringify(inputs)};

${tool.code}

// Execute and print result
try {
  const result = await main(inputs);
  console.log(JSON.stringify({ success: true, result }));
} catch (e) {
  console.log(JSON.stringify({ success: false, error: e.message }));
}
`;
    }

    // Execute in sandbox
    const execution =
      tool.language === 'python'
        ? await dynamicSandbox.runCode(execCode)
        : await dynamicSandbox.runCode(execCode, { language: 'javascript' as const });

    const executionTimeMs = Date.now() - startTime;

    // Parse result
    const stdout = execution.logs.stdout.join('\n');
    const stderr = execution.logs.stderr.join('\n');

    if (stderr) {
      log.warn('Dynamic tool stderr', { toolId: tool.id, stderr });
    }

    // Try to parse JSON output
    try {
      const lastLine = stdout.trim().split('\n').pop() || '';
      const result = JSON.parse(lastLine);

      // Sanitize output
      const sanitizedOutput =
        typeof result.result === 'string' ? sanitizeOutput(result.result) : result.result;

      // Update usage stats
      tool.usageCount++;
      tool.lastUsed = Date.now();

      return {
        success: result.success,
        output: sanitizedOutput,
        error: result.error,
        executionTimeMs,
        sanitized: typeof result.result === 'string',
      };
    } catch {
      // If JSON parsing fails, return raw output (sanitized)
      const sanitizedOutput = sanitizeOutput(stdout);

      return {
        success: true,
        output: sanitizedOutput,
        executionTimeMs,
        sanitized: true,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Dynamic tool execution failed', {
      toolId: tool.id,
      error: errMsg,
      sessionId,
    });

    return {
      success: false,
      error: errMsg,
      executionTimeMs: Date.now() - startTime,
      sanitized: false,
    };
  }
}

/**
 * Cleanup dynamic tool sandbox
 */
export async function cleanupDynamicSandbox(): Promise<void> {
  if (dynamicSandbox) {
    await dynamicSandbox.kill();
    dynamicSandbox = null;
  }
}

// =============================================================================
// DYNAMIC TOOL REGISTRY
// =============================================================================

// In-memory registry of created dynamic tools (per session)
const dynamicToolRegistry = new Map<string, DynamicToolDefinition[]>();

/**
 * Register a dynamic tool for a session
 */
export function registerDynamicTool(sessionId: string, tool: DynamicToolDefinition): void {
  const tools = dynamicToolRegistry.get(sessionId) || [];
  tools.push(tool);
  dynamicToolRegistry.set(sessionId, tools);
}

/**
 * Get all dynamic tools for a session
 */
export function getDynamicTools(sessionId: string): DynamicToolDefinition[] {
  return dynamicToolRegistry.get(sessionId) || [];
}

/**
 * Get a specific dynamic tool by ID
 */
export function getDynamicToolById(
  sessionId: string,
  toolId: string
): DynamicToolDefinition | undefined {
  const tools = dynamicToolRegistry.get(sessionId) || [];
  return tools.find((t) => t.id === toolId);
}

/**
 * Clear dynamic tools for a session
 */
export function clearDynamicTools(sessionId: string): void {
  dynamicToolRegistry.delete(sessionId);
}

// =============================================================================
// CLAUDE TOOL DEFINITION FOR DYNAMIC TOOL CREATION
// =============================================================================

/**
 * Get the Claude tool definition for creating dynamic tools
 * This allows scouts to request new tools through the normal tool calling interface
 */
export function getDynamicToolCreationDefinition(): {
  name: string;
  description: string;
  input_schema: object;
} {
  return {
    name: 'create_custom_tool',
    description: `Create a custom tool when the existing 13 tools are insufficient. Use this ONLY when you've determined that none of the existing tools can accomplish your task. The tool will be reviewed for safety before execution.

IMPORTANT: Custom tools are sandboxed and have LIMITED capabilities:
- No direct internet access (only through approved APIs)
- No file system access outside /tmp
- No system commands

Custom tools are best for:
- Data transformation/processing
- Complex calculations
- Custom parsing logic
- Specialized formatting`,
    input_schema: {
      type: 'object',
      properties: {
        purpose: {
          type: 'string',
          description: 'What the tool should accomplish (be specific)',
        },
        justification: {
          type: 'string',
          description:
            'Why existing tools (search, browser, code, screenshot, etc.) cannot do this',
        },
        inputs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Input parameter name' },
              type: {
                type: 'string',
                enum: ['string', 'number', 'boolean', 'array', 'object'],
              },
              description: { type: 'string' },
              required: { type: 'boolean' },
            },
            required: ['name', 'type', 'description'],
          },
          description: 'Expected input parameters',
        },
        outputType: {
          type: 'string',
          enum: ['string', 'number', 'boolean', 'array', 'object', 'mixed'],
          description: 'Expected output type',
        },
        approach: {
          type: 'string',
          description: 'Suggested implementation approach (optional)',
        },
      },
      required: ['purpose', 'justification', 'inputs', 'outputType'],
    },
  };
}
