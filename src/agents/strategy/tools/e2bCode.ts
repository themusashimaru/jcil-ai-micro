/**
 * E2B CODE EXECUTION TOOL
 *
 * Uses E2B sandbox to execute Python or JavaScript code.
 * Useful for data processing, calculations, and analysis.
 */

import { Sandbox } from '@e2b/code-interpreter';
import type { RunCodeInput, RunCodeOutput } from './types';
import { logger } from '@/lib/logger';

const log = logger('E2BCode');

// Sandbox pool for reuse
let sharedSandbox: Sandbox | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000; // 5 minutes
const SANDBOX_IDLE_CLEANUP_MS = 60000; // Clean up after 1 min idle

/**
 * Get or create a shared sandbox for code execution
 */
async function getSandbox(): Promise<Sandbox> {
  const now = Date.now();

  // If we have a sandbox that's been idle too long, clean it up
  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await sharedSandbox.kill();
    } catch {
      // Ignore cleanup errors
    }
    sharedSandbox = null;
  }

  // Create new sandbox if needed
  if (!sharedSandbox) {
    log.info('Creating new E2B sandbox for code execution');
    sharedSandbox = await Sandbox.create({
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    // Pre-install common packages
    await sharedSandbox.commands.run('pip install pandas numpy requests beautifulsoup4 lxml', {
      timeoutMs: 120000,
    });

    log.info('Code sandbox ready with packages installed');
  }

  sandboxLastUsed = now;
  return sharedSandbox;
}

/**
 * Execute code in the E2B sandbox
 */
export async function runCode(input: RunCodeInput): Promise<RunCodeOutput> {
  const startTime = Date.now();
  const { code, language, timeout = 30000 } = input;

  try {
    const sandbox = await getSandbox();

    log.info('Executing code', { language, codeLength: code.length });

    if (language === 'python') {
      // Use E2B's built-in Python execution
      const result = await sandbox.runCode(code);

      const stdout = result.logs.stdout.join('\n');
      const stderr = result.logs.stderr.join('\n');

      if (result.error) {
        log.warn('Python code execution error', { error: result.error });
        return {
          success: false,
          stdout,
          stderr,
          error: result.error.value || result.error.name || 'Execution failed',
        };
      }

      log.info('Python code executed', { timeMs: Date.now() - startTime });

      return {
        success: true,
        stdout,
        stderr,
        result: result.results?.[0]?.text || result.results?.[0]?.data,
      };
    } else {
      // JavaScript execution via Node
      // Write the code to a temp file and run it
      const tempFile = `/tmp/scout_code_${Date.now()}.js`;

      await sandbox.files.write(tempFile, code);

      const result = await sandbox.commands.run(`node ${tempFile}`, {
        timeoutMs: timeout,
      });

      // Clean up
      await sandbox.files.remove(tempFile).catch(() => {});

      log.info('JavaScript code executed', { timeMs: Date.now() - startTime });

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.exitCode !== 0 ? `Exit code: ${result.exitCode}` : undefined,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Code execution failed', { language, error: errMsg });

    return {
      success: false,
      stdout: '',
      stderr: '',
      error: errMsg,
    };
  }
}

/**
 * Pre-built code snippets for common tasks
 */
export const CODE_SNIPPETS = {
  /**
   * Scrape a webpage and extract data
   */
  scrapeWebpage: (url: string, selector?: string) => `
import requests
from bs4 import BeautifulSoup
import json

response = requests.get('${url}', headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
soup = BeautifulSoup(response.text, 'lxml')

${
  selector
    ? `
# Extract specific content
elements = soup.select('${selector}')
result = [el.get_text(strip=True) for el in elements]
`
    : `
# Extract all text
result = soup.get_text(separator=' ', strip=True)[:20000]
`
}

print(json.dumps(result))
`,

  /**
   * Analyze data with pandas
   */
  analyzeData: (jsonData: string) => `
import pandas as pd
import json

data = ${jsonData}
df = pd.DataFrame(data)

analysis = {
    'shape': list(df.shape),
    'columns': list(df.columns),
    'dtypes': {k: str(v) for k, v in df.dtypes.items()},
    'describe': df.describe().to_dict(),
    'head': df.head().to_dict(),
}

print(json.dumps(analysis))
`,

  /**
   * Calculate statistics
   */
  calculateStats: (numbers: number[]) => `
import statistics
import json

numbers = ${JSON.stringify(numbers)}

stats = {
    'mean': statistics.mean(numbers),
    'median': statistics.median(numbers),
    'stdev': statistics.stdev(numbers) if len(numbers) > 1 else 0,
    'min': min(numbers),
    'max': max(numbers),
    'count': len(numbers),
}

print(json.dumps(stats))
`,

  /**
   * Extract prices from text
   */
  extractPrices: (text: string) => `
import re
import json

text = '''${text.replace(/'/g, "\\'")}'''

# Find all price patterns
patterns = [
    r'\\$[\\d,]+(?:\\.\\d{2})?',  # $1,234.56
    r'[\\d,]+(?:\\.\\d{2})?\\s*(?:USD|dollars?)',  # 1234 USD
]

prices = []
for pattern in patterns:
    prices.extend(re.findall(pattern, text, re.IGNORECASE))

# Clean and dedupe
prices = list(set(prices))
print(json.dumps(prices[:50]))
`,
};

/**
 * Clean up the shared sandbox
 */
export async function cleanupCodeSandbox(): Promise<void> {
  if (sharedSandbox) {
    try {
      await sharedSandbox.kill();
      log.info('Code sandbox cleaned up');
    } catch (error) {
      log.warn('Failed to cleanup code sandbox', { error });
    }
    sharedSandbox = null;
  }
}
