/**
 * VOICE CODING ENGINE
 *
 * Code by talking. Hands-free development for the future.
 *
 * Features:
 * - Natural language to code conversion
 * - Voice commands (save, run, debug, undo)
 * - Context-aware code generation
 * - Multi-language support
 * - Continuous listening mode
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export interface VoiceCommand {
  type: 'code' | 'command' | 'navigation' | 'edit' | 'query';
  transcript: string;
  confidence: number;
  timestamp: number;
}

export interface VoiceCodeResult {
  success: boolean;
  action: string;
  code?: string;
  language?: string;
  explanation?: string;
  cursorPosition?: { line: number; column: number };
  error?: string;
}

export interface VoiceContext {
  currentFile: string;
  currentCode: string;
  cursorLine: number;
  selectedText?: string;
  recentCommands: VoiceCommand[];
  projectType: string;
  language: string;
}

export interface VoiceCommandHandler {
  pattern: RegExp;
  handler: (match: RegExpMatchArray, context: VoiceContext) => Promise<VoiceCodeResult>;
}

// ============================================
// VOICE COMMAND PATTERNS
// ============================================

const COMMAND_PATTERNS = {
  // Code generation
  CREATE_FUNCTION: /^(?:create|make|write|add)\s+(?:a\s+)?(?:new\s+)?function\s+(?:called\s+|named\s+)?(\w+)(?:\s+that\s+(.+))?$/i,
  CREATE_CLASS: /^(?:create|make|write|add)\s+(?:a\s+)?(?:new\s+)?class\s+(?:called\s+|named\s+)?(\w+)(?:\s+that\s+(.+))?$/i,
  CREATE_COMPONENT: /^(?:create|make|write|add)\s+(?:a\s+)?(?:new\s+)?(?:react\s+)?component\s+(?:called\s+|named\s+)?(\w+)(?:\s+that\s+(.+))?$/i,
  CREATE_INTERFACE: /^(?:create|make|write|add)\s+(?:a\s+)?(?:new\s+)?(?:interface|type)\s+(?:called\s+|named\s+)?(\w+)(?:\s+with\s+(.+))?$/i,
  CREATE_API: /^(?:create|make|write|add)\s+(?:a\s+)?(?:new\s+)?(?:api\s+)?(?:endpoint|route)\s+(?:for\s+)?(.+)$/i,

  // Editing
  RENAME: /^rename\s+(\w+)\s+to\s+(\w+)$/i,
  DELETE_LINE: /^delete\s+(?:this\s+)?line(?:\s+(\d+))?$/i,
  DELETE_FUNCTION: /^delete\s+(?:the\s+)?function\s+(\w+)$/i,
  ADD_IMPORT: /^(?:add|import)\s+(?:import\s+)?(.+?)(?:\s+from\s+(.+))?$/i,
  FIX_ERROR: /^fix\s+(?:this\s+|the\s+)?(?:error|bug|issue)(?:\s+on\s+line\s+(\d+))?$/i,
  REFACTOR: /^refactor\s+(?:this\s+|the\s+)?(.+)$/i,

  // Navigation
  GO_TO_LINE: /^go\s+to\s+line\s+(\d+)$/i,
  GO_TO_FUNCTION: /^go\s+to\s+(?:function\s+)?(\w+)$/i,
  GO_TO_FILE: /^(?:open|go\s+to)\s+(?:file\s+)?(.+)$/i,
  SEARCH: /^(?:search|find)\s+(?:for\s+)?(.+)$/i,

  // Commands
  SAVE: /^save(?:\s+(?:file|all))?$/i,
  UNDO: /^undo(?:\s+(\d+)\s+times?)?$/i,
  REDO: /^redo(?:\s+(\d+)\s+times?)?$/i,
  RUN: /^run(?:\s+(?:the\s+)?(?:code|file|tests?))?$/i,
  BUILD: /^build(?:\s+(?:the\s+)?project)?$/i,
  COMMIT: /^commit(?:\s+with\s+message\s+)?(.+)?$/i,

  // Queries
  EXPLAIN: /^explain\s+(?:this\s+|the\s+)?(.+)?$/i,
  WHAT_DOES: /^what\s+does\s+(?:this\s+|the\s+)?(.+?)(?:\s+do)?$/i,
  HOW_TO: /^how\s+(?:do\s+i\s+|to\s+)(.+)$/i,
};

// ============================================
// VOICE CODING ENGINE CLASS
// ============================================

export class VoiceCodingEngine {
  private anthropic: Anthropic;
  private commandHistory: VoiceCommand[] = [];

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Process a voice transcript and convert to code/action
   */
  async processVoiceInput(
    transcript: string,
    context: VoiceContext
  ): Promise<VoiceCodeResult> {
    const command: VoiceCommand = {
      type: this.classifyCommand(transcript),
      transcript,
      confidence: 1.0, // Would come from speech recognition
      timestamp: Date.now(),
    };

    this.commandHistory.push(command);

    // Check for built-in command patterns first
    const builtInResult = await this.tryBuiltInCommand(transcript, context);
    if (builtInResult) {
      return builtInResult;
    }

    // Fall back to AI interpretation
    return await this.aiInterpretCommand(transcript, context);
  }

  /**
   * Classify the type of voice command
   */
  private classifyCommand(transcript: string): VoiceCommand['type'] {
    const lower = transcript.toLowerCase();

    if (COMMAND_PATTERNS.SAVE.test(lower) ||
        COMMAND_PATTERNS.UNDO.test(lower) ||
        COMMAND_PATTERNS.REDO.test(lower) ||
        COMMAND_PATTERNS.RUN.test(lower) ||
        COMMAND_PATTERNS.BUILD.test(lower) ||
        COMMAND_PATTERNS.COMMIT.test(lower)) {
      return 'command';
    }

    if (COMMAND_PATTERNS.GO_TO_LINE.test(lower) ||
        COMMAND_PATTERNS.GO_TO_FUNCTION.test(lower) ||
        COMMAND_PATTERNS.GO_TO_FILE.test(lower) ||
        COMMAND_PATTERNS.SEARCH.test(lower)) {
      return 'navigation';
    }

    if (COMMAND_PATTERNS.RENAME.test(lower) ||
        COMMAND_PATTERNS.DELETE_LINE.test(lower) ||
        COMMAND_PATTERNS.DELETE_FUNCTION.test(lower) ||
        COMMAND_PATTERNS.FIX_ERROR.test(lower) ||
        COMMAND_PATTERNS.REFACTOR.test(lower)) {
      return 'edit';
    }

    if (COMMAND_PATTERNS.EXPLAIN.test(lower) ||
        COMMAND_PATTERNS.WHAT_DOES.test(lower) ||
        COMMAND_PATTERNS.HOW_TO.test(lower)) {
      return 'query';
    }

    return 'code';
  }

  /**
   * Try to match and execute a built-in command
   */
  private async tryBuiltInCommand(
    transcript: string,
    _context: VoiceContext
  ): Promise<VoiceCodeResult | null> {
    const lower = transcript.toLowerCase();

    // Save command
    if (COMMAND_PATTERNS.SAVE.test(lower)) {
      return {
        success: true,
        action: 'save',
        explanation: 'Saving file...',
      };
    }

    // Undo command
    const undoMatch = lower.match(COMMAND_PATTERNS.UNDO);
    if (undoMatch) {
      const times = undoMatch[1] ? parseInt(undoMatch[1]) : 1;
      return {
        success: true,
        action: 'undo',
        explanation: `Undoing ${times} change${times > 1 ? 's' : ''}...`,
      };
    }

    // Redo command
    const redoMatch = lower.match(COMMAND_PATTERNS.REDO);
    if (redoMatch) {
      const times = redoMatch[1] ? parseInt(redoMatch[1]) : 1;
      return {
        success: true,
        action: 'redo',
        explanation: `Redoing ${times} change${times > 1 ? 's' : ''}...`,
      };
    }

    // Go to line
    const goToLineMatch = lower.match(COMMAND_PATTERNS.GO_TO_LINE);
    if (goToLineMatch) {
      const line = parseInt(goToLineMatch[1]);
      return {
        success: true,
        action: 'navigate',
        cursorPosition: { line, column: 0 },
        explanation: `Going to line ${line}`,
      };
    }

    // Run command
    if (COMMAND_PATTERNS.RUN.test(lower)) {
      return {
        success: true,
        action: 'run',
        explanation: 'Running code...',
      };
    }

    // Build command
    if (COMMAND_PATTERNS.BUILD.test(lower)) {
      return {
        success: true,
        action: 'build',
        explanation: 'Building project...',
      };
    }

    return null;
  }

  /**
   * Use AI to interpret complex voice commands
   */
  private async aiInterpretCommand(
    transcript: string,
    context: VoiceContext
  ): Promise<VoiceCodeResult> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a voice-to-code AI assistant. Convert natural language commands into code.

CONTEXT:
- Current file: ${context.currentFile}
- Language: ${context.language}
- Project type: ${context.projectType}
- Cursor at line: ${context.cursorLine}
${context.selectedText ? `- Selected text: ${context.selectedText}` : ''}

RULES:
1. Generate clean, idiomatic code for the specified language
2. Match the style of existing code when possible
3. Include necessary imports
4. Add brief comments only when the logic is complex
5. If the command is ambiguous, make reasonable assumptions

RESPONSE FORMAT (JSON):
{
  "action": "insert" | "replace" | "delete" | "explain" | "navigate",
  "code": "the generated code (if applicable)",
  "language": "detected language",
  "explanation": "brief explanation of what was done",
  "insertPosition": "cursor" | "end" | "start" | { "line": number },
  "imports": ["any required imports"]
}`,
        messages: [
          {
            role: 'user',
            content: `Current code context:
\`\`\`${context.language}
${context.currentCode}
\`\`\`

Voice command: "${transcript}"

Generate the appropriate code or action.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON, treat the whole response as code
        return {
          success: true,
          action: 'insert',
          code: content.text,
          language: context.language,
          explanation: 'Generated code from voice command',
        };
      }

      const result = JSON.parse(jsonMatch[0]);

      // Build the final code with imports if needed
      let finalCode = result.code || '';
      if (result.imports && result.imports.length > 0) {
        const importStatements = result.imports.join('\n');
        finalCode = importStatements + '\n\n' + finalCode;
      }

      return {
        success: true,
        action: result.action,
        code: finalCode,
        language: result.language || context.language,
        explanation: result.explanation,
        cursorPosition: result.insertPosition?.line
          ? { line: result.insertPosition.line, column: 0 }
          : undefined,
      };
    } catch (error) {
      console.error('[VoiceCoding] AI interpretation error:', error);
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Failed to interpret voice command',
      };
    }
  }

  /**
   * Generate code from a natural language description
   */
  async generateCodeFromDescription(
    description: string,
    context: VoiceContext
  ): Promise<VoiceCodeResult> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are an expert programmer. Generate production-ready code from natural language descriptions.

TARGET LANGUAGE: ${context.language}
PROJECT TYPE: ${context.projectType}
CURRENT FILE: ${context.currentFile}

Generate clean, well-structured code. Include:
- Proper error handling
- Type annotations (for TypeScript)
- Brief documentation
- Necessary imports

Return ONLY the code, no explanations.`,
        messages: [
          {
            role: 'user',
            content: description,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Extract code from markdown if present
      const codeMatch = content.text.match(/```[\w]*\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        success: true,
        action: 'insert',
        code,
        language: context.language,
        explanation: `Generated from: "${description.substring(0, 50)}..."`,
      };
    } catch (error) {
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Code generation failed',
      };
    }
  }

  /**
   * Fix code errors via voice command
   */
  async fixError(
    errorMessage: string,
    context: VoiceContext
  ): Promise<VoiceCodeResult> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a debugging expert. Fix the code error and return the corrected code.

Return JSON:
{
  "fixedCode": "the complete fixed code",
  "explanation": "what was wrong and how you fixed it",
  "lineNumber": the line number where the fix was applied (if specific)
}`,
        messages: [
          {
            role: 'user',
            content: `Error: ${errorMessage}

Code:
\`\`\`${context.language}
${context.currentCode}
\`\`\`

Fix this error.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          action: 'error',
          error: 'Could not parse fix response',
        };
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        action: 'replace',
        code: result.fixedCode,
        language: context.language,
        explanation: result.explanation,
        cursorPosition: result.lineNumber
          ? { line: result.lineNumber, column: 0 }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Fix failed',
      };
    }
  }

  /**
   * Explain code via voice
   */
  async explainCode(
    code: string,
    specificQuestion?: string
  ): Promise<VoiceCodeResult> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `You are a patient coding teacher. Explain code clearly and concisely.
Keep explanations brief but informative - suitable for text-to-speech.
Use simple language and avoid jargon where possible.`,
        messages: [
          {
            role: 'user',
            content: specificQuestion
              ? `${specificQuestion}\n\nCode:\n${code}`
              : `Explain this code:\n${code}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return {
        success: true,
        action: 'explain',
        explanation: content.text,
      };
    } catch (error) {
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Explanation failed',
      };
    }
  }

  /**
   * Get voice command suggestions based on context
   */
  getCommandSuggestions(context: VoiceContext): string[] {
    const suggestions: string[] = [];

    // Context-aware suggestions
    if (context.language === 'typescript' || context.language === 'javascript') {
      suggestions.push(
        'Create a function called...',
        'Add a React component named...',
        'Create an interface for...',
        'Add an API endpoint for...',
      );
    }

    if (context.language === 'python') {
      suggestions.push(
        'Create a class called...',
        'Add a function that...',
        'Create a FastAPI route for...',
      );
    }

    // Universal suggestions
    suggestions.push(
      'Explain this code',
      'Fix the error',
      'Refactor this function',
      'Add error handling',
      'Add tests for this',
      'Go to line...',
      'Search for...',
      'Save file',
      'Run tests',
    );

    return suggestions;
  }

  /**
   * Convert spoken numbers and symbols
   */
  normalizeTranscript(transcript: string): string {
    return transcript
      // Numbers
      .replace(/\bone\b/gi, '1')
      .replace(/\btwo\b/gi, '2')
      .replace(/\bthree\b/gi, '3')
      .replace(/\bfour\b/gi, '4')
      .replace(/\bfive\b/gi, '5')
      .replace(/\bsix\b/gi, '6')
      .replace(/\bseven\b/gi, '7')
      .replace(/\beight\b/gi, '8')
      .replace(/\bnine\b/gi, '9')
      .replace(/\bten\b/gi, '10')
      .replace(/\bzero\b/gi, '0')
      // Symbols
      .replace(/\bopen paren\b/gi, '(')
      .replace(/\bclose paren\b/gi, ')')
      .replace(/\bopen bracket\b/gi, '[')
      .replace(/\bclose bracket\b/gi, ']')
      .replace(/\bopen brace\b/gi, '{')
      .replace(/\bclose brace\b/gi, '}')
      .replace(/\bequals\b/gi, '=')
      .replace(/\bplus\b/gi, '+')
      .replace(/\bminus\b/gi, '-')
      .replace(/\btimes\b/gi, '*')
      .replace(/\bdivided by\b/gi, '/')
      .replace(/\bgreater than\b/gi, '>')
      .replace(/\bless than\b/gi, '<')
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!')
      .replace(/\barrow\b/gi, '=>')
      .replace(/\bcolon\b/gi, ':')
      .replace(/\bsemicolon\b/gi, ';')
      .replace(/\bcomma\b/gi, ',')
      .replace(/\bdot\b/gi, '.')
      .replace(/\bquote\b/gi, '"')
      .replace(/\bsingle quote\b/gi, "'")
      .replace(/\bbacktick\b/gi, '`')
      .replace(/\bnew line\b/gi, '\n')
      .replace(/\btab\b/gi, '\t');
  }
}

// ============================================
// EXPORTS
// ============================================

export const voiceCoding = new VoiceCodingEngine();

/**
 * Quick function to process voice input
 */
export async function processVoice(
  transcript: string,
  context: VoiceContext
): Promise<VoiceCodeResult> {
  const normalized = voiceCoding.normalizeTranscript(transcript);
  return voiceCoding.processVoiceInput(normalized, context);
}

/**
 * Quick function for voice-to-code
 */
export async function voiceToCode(
  description: string,
  language: string = 'typescript'
): Promise<string> {
  const result = await voiceCoding.generateCodeFromDescription(description, {
    currentFile: 'untitled',
    currentCode: '',
    cursorLine: 0,
    recentCommands: [],
    projectType: 'general',
    language,
  });

  return result.code || '';
}
