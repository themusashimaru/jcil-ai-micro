export interface EditorFile {
  id: string;
  path: string;
  name: string;
  content: string;
  originalContent?: string; // For diff view
  language: string;
  isDirty: boolean;
  isNew: boolean;
}

export interface DiffHunk {
  id: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EditorChange {
  path: string;
  hunks: DiffHunk[];
}

export interface CodeLabEditorProps {
  files: EditorFile[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onFileClose: (fileId: string) => void;
  onFileSave: (fileId: string, content: string) => void;
  onFileCreate: (path: string, content: string) => void;
  onAcceptChange: (fileId: string, hunkId: string) => void;
  onRejectChange: (fileId: string, hunkId: string) => void;
  onAcceptAllChanges: (fileId: string) => void;
  onRejectAllChanges: (fileId: string) => void;
  pendingChanges?: EditorChange[];
  readOnly?: boolean;
  theme?: 'light' | 'dark';
}

// Language detection from file extension
export const _getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',
    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    // Data
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    toml: 'toml',
    // Config
    md: 'markdown',
    mdx: 'markdown',
    env: 'ini',
    ini: 'ini',
    conf: 'ini',
    // Languages
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    // Shell
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    // Database
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    // Docker/K8s
    dockerfile: 'dockerfile',
    // Other
    vue: 'vue',
    svelte: 'svelte',
    astro: 'astro',
  };
  return languageMap[ext] || 'plaintext';
};

// Syntax highlighting tokens (simplified for SSR compatibility)
export const _getTokenClass = (type: string): string => {
  const tokenClasses: Record<string, string> = {
    keyword: 'token-keyword',
    string: 'token-string',
    number: 'token-number',
    comment: 'token-comment',
    operator: 'token-operator',
    function: 'token-function',
    variable: 'token-variable',
    type: 'token-type',
    property: 'token-property',
    punctuation: 'token-punctuation',
  };
  return tokenClasses[type] || '';
};

// Helper: Get file icon based on language
export function getFileIcon(language: string): string {
  const icons: Record<string, string> = {
    typescript: '📘',
    javascript: '📒',
    python: '🐍',
    rust: '🦀',
    go: '🐹',
    java: '☕',
    ruby: '💎',
    html: '🌐',
    css: '🎨',
    json: '📋',
    markdown: '📝',
    yaml: '⚙️',
    shell: '🐚',
    sql: '🗃️',
    dockerfile: '🐳',
    default: '📄',
  };
  return icons[language] || icons.default;
}
