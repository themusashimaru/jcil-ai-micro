/**
 * CODE CHUNKER
 *
 * Intelligent code chunking that preserves semantic meaning.
 * Breaks files into functions, classes, and logical blocks.
 */

import { CodeFile, CodeChunk } from './types';

// Maximum chunk size (in characters)
const MAX_CHUNK_SIZE = 2000;
const MIN_CHUNK_SIZE = 100;

// Generate unique ID
function generateId(): string {
  return 'chunk_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Chunk a code file into semantic units
 */
export function chunkCodeFile(file: CodeFile, repoId: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = file.content.split('\n');

  // Detect language-specific patterns
  const lang = file.language.toLowerCase();

  if (['typescript', 'javascript', 'tsx', 'jsx', 'ts', 'js'].includes(lang)) {
    chunks.push(...chunkJavaScriptLike(file, repoId, lines));
  } else if (['python', 'py'].includes(lang)) {
    chunks.push(...chunkPython(file, repoId, lines));
  } else {
    // Generic chunking for other languages
    chunks.push(...chunkGeneric(file, repoId, lines));
  }

  // If file is small enough, also add as a single chunk
  if (file.content.length <= MAX_CHUNK_SIZE && chunks.length === 0) {
    chunks.push({
      id: generateId(),
      repoId,
      filePath: file.path,
      content: file.content,
      startLine: 1,
      endLine: lines.length,
      language: file.language,
      chunkType: 'file',
    });
  }

  return chunks;
}

/**
 * Chunk JavaScript/TypeScript files
 */
function chunkJavaScriptLike(file: CodeFile, repoId: string, lines: string[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // Patterns for detecting code structures
  const functionPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,  // function foo()
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,  // const foo = () =>
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/,  // const foo = function
  ];

  const classPattern = /^(?:export\s+)?class\s+(\w+)/;
  const interfacePattern = /^(?:export\s+)?interface\s+(\w+)/;
  const typePattern = /^(?:export\s+)?type\s+(\w+)/;
  const importPattern = /^import\s+/;

  // Track imports at the top
  const imports: string[] = [];
  let importEndLine = 0;

  // Find imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (importPattern.test(line)) {
      imports.push(line);
      importEndLine = i + 1;
    } else if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
      break;
    }
  }

  // Add imports chunk if present
  if (imports.length > 0) {
    chunks.push({
      id: generateId(),
      repoId,
      filePath: file.path,
      content: imports.join('\n'),
      startLine: 1,
      endLine: importEndLine,
      language: file.language,
      chunkType: 'import',
      metadata: { imports: extractImportNames(imports) },
    });
  }

  // Find functions, classes, interfaces
  let currentChunk: { startLine: number; content: string[]; type: string; name?: string } | null = null;
  let braceCount = 0;

  for (let i = importEndLine; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for function start
    for (const pattern of functionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Save previous chunk if exists
        if (currentChunk) {
          saveChunk(chunks, currentChunk, repoId, file);
        }
        currentChunk = {
          startLine: i + 1,
          content: [line],
          type: 'function',
          name: match[1],
        };
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        break;
      }
    }

    // Check for class
    const classMatch = trimmed.match(classPattern);
    if (classMatch) {
      if (currentChunk) {
        saveChunk(chunks, currentChunk, repoId, file);
      }
      currentChunk = {
        startLine: i + 1,
        content: [line],
        type: 'class',
        name: classMatch[1],
      };
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      continue;
    }

    // Check for interface/type
    const interfaceMatch = trimmed.match(interfacePattern) || trimmed.match(typePattern);
    if (interfaceMatch) {
      if (currentChunk) {
        saveChunk(chunks, currentChunk, repoId, file);
      }
      currentChunk = {
        startLine: i + 1,
        content: [line],
        type: 'block',
        name: interfaceMatch[1],
      };
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      continue;
    }

    // Continue building current chunk
    if (currentChunk) {
      currentChunk.content.push(line);
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Check if chunk is complete (all braces closed)
      if (braceCount <= 0 && currentChunk.content.length > 1) {
        saveChunk(chunks, currentChunk, repoId, file);
        currentChunk = null;
        braceCount = 0;
      }

      // Safety: don't let chunks get too big
      if (currentChunk && currentChunk.content.join('\n').length > MAX_CHUNK_SIZE * 1.5) {
        saveChunk(chunks, currentChunk, repoId, file);
        currentChunk = null;
        braceCount = 0;
      }
    }
  }

  // Save any remaining chunk
  if (currentChunk) {
    saveChunk(chunks, currentChunk, repoId, file);
  }

  return chunks;
}

/**
 * Chunk Python files
 */
function chunkPython(file: CodeFile, repoId: string, lines: string[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  const functionPattern = /^(?:async\s+)?def\s+(\w+)\s*\(/;
  const classPattern = /^class\s+(\w+)/;
  const importPattern = /^(?:import|from)\s+/;

  // Track imports
  const imports: string[] = [];
  let importEndLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (importPattern.test(line)) {
      imports.push(line);
      importEndLine = i + 1;
    } else if (line.trim() && !line.trim().startsWith('#')) {
      break;
    }
  }

  if (imports.length > 0) {
    chunks.push({
      id: generateId(),
      repoId,
      filePath: file.path,
      content: imports.join('\n'),
      startLine: 1,
      endLine: importEndLine,
      language: file.language,
      chunkType: 'import',
    });
  }

  // Find functions and classes
  let currentChunk: { startLine: number; content: string[]; type: string; name?: string; indent: number } | null = null;

  for (let i = importEndLine; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);

    // Check for function
    const funcMatch = line.match(functionPattern);
    if (funcMatch && indent === 0) {
      if (currentChunk) {
        saveChunk(chunks, currentChunk, repoId, file);
      }
      currentChunk = {
        startLine: i + 1,
        content: [line],
        type: 'function',
        name: funcMatch[1],
        indent: 0,
      };
      continue;
    }

    // Check for class
    const classMatch = line.match(classPattern);
    if (classMatch && indent === 0) {
      if (currentChunk) {
        saveChunk(chunks, currentChunk, repoId, file);
      }
      currentChunk = {
        startLine: i + 1,
        content: [line],
        type: 'class',
        name: classMatch[1],
        indent: 0,
      };
      continue;
    }

    // Continue building chunk
    if (currentChunk) {
      // Check if we've exited the block (back to zero indent with content)
      if (indent === 0 && line.trim() && !line.trim().startsWith('#')) {
        saveChunk(chunks, currentChunk, repoId, file);
        currentChunk = null;
        i--; // Re-process this line
        continue;
      }
      currentChunk.content.push(line);
    }
  }

  if (currentChunk) {
    saveChunk(chunks, currentChunk, repoId, file);
  }

  return chunks;
}

/**
 * Generic chunking for other languages
 */
function chunkGeneric(file: CodeFile, repoId: string, lines: string[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // Simple line-based chunking
  let currentChunk: string[] = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    currentChunk.push(lines[i]);

    const chunkContent = currentChunk.join('\n');

    // Create chunk when we reach max size or end of file
    if (chunkContent.length >= MAX_CHUNK_SIZE || i === lines.length - 1) {
      if (chunkContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          id: generateId(),
          repoId,
          filePath: file.path,
          content: chunkContent,
          startLine,
          endLine: i + 1,
          language: file.language,
          chunkType: 'block',
        });
      }
      currentChunk = [];
      startLine = i + 2;
    }
  }

  return chunks;
}

/**
 * Helper to save a chunk
 */
function saveChunk(
  chunks: CodeChunk[],
  chunk: { startLine: number; content: string[]; type: string; name?: string },
  repoId: string,
  file: CodeFile
) {
  const content = chunk.content.join('\n');
  if (content.length >= MIN_CHUNK_SIZE) {
    chunks.push({
      id: generateId(),
      repoId,
      filePath: file.path,
      content,
      startLine: chunk.startLine,
      endLine: chunk.startLine + chunk.content.length - 1,
      language: file.language,
      chunkType: chunk.type as CodeChunk['chunkType'],
      metadata: chunk.name ? { functionName: chunk.name } : undefined,
    });
  }
}

/**
 * Extract import names from import statements
 */
function extractImportNames(imports: string[]): string[] {
  const names: string[] = [];

  for (const imp of imports) {
    // import { foo, bar } from 'module'
    const namedMatch = imp.match(/import\s+\{([^}]+)\}/);
    if (namedMatch) {
      names.push(...namedMatch[1].split(',').map(n => n.trim().split(' ')[0]));
    }

    // import foo from 'module'
    const defaultMatch = imp.match(/import\s+(\w+)\s+from/);
    if (defaultMatch) {
      names.push(defaultMatch[1]);
    }

    // import * as foo from 'module'
    const namespaceMatch = imp.match(/import\s+\*\s+as\s+(\w+)/);
    if (namespaceMatch) {
      names.push(namespaceMatch[1]);
    }
  }

  return names;
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    html: 'html',
    vue: 'vue',
    svelte: 'svelte',
  };

  return languageMap[ext] || 'text';
}

/**
 * Check if a file should be indexed
 */
export function shouldIndexFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  // Indexable extensions
  const indexableExtensions = [
    'ts', 'tsx', 'js', 'jsx', 'mjs',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
    'cs', 'cpp', 'c', 'h', 'hpp', 'php',
    'sql', 'sh', 'bash',
    'css', 'scss', 'sass', 'less',
    'html', 'vue', 'svelte',
    'yaml', 'yml', 'json', 'md', 'mdx',
  ];

  // Skip patterns
  const skipPatterns = [
    /node_modules/,
    /\.next/,
    /\.git/,
    /dist\//,
    /build\//,
    /\.min\./,
    /\.map$/,
    /\.lock$/,
    /package-lock\.json/,
    /yarn\.lock/,
    /pnpm-lock\.yaml/,
  ];

  if (skipPatterns.some(p => p.test(filePath))) {
    return false;
  }

  return indexableExtensions.includes(ext);
}
