'use client';

/**
 * PROJECT VIEW COMPONENT (Enhancement #5)
 *
 * Displays multi-file project output from build_project tool.
 * Features:
 * - File tree navigation
 * - Syntax-highlighted code preview
 * - Expand/collapse files
 * - Download as ZIP
 * - Copy individual files
 */

import { useState, useMemo } from 'react';

interface ProjectFile {
  path: string;
  content: string;
  language?: string;
}

interface ProjectViewProps {
  projectName: string;
  files: ProjectFile[];
  onDownload?: () => void;
}

// Get icon for file type
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '📘',
    tsx: '📘',
    js: '📒',
    jsx: '📒',
    json: '📋',
    md: '📝',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    py: '🐍',
    go: '🐹',
    rs: '🦀',
    java: '☕',
    rb: '💎',
    yml: '⚙️',
    yaml: '⚙️',
    toml: '⚙️',
    env: '🔐',
    gitignore: '📁',
    dockerfile: '🐳',
  };
  return icons[ext] || '📄';
}

// Get language from file extension
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    rb: 'ruby',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
  };
  return languages[ext] || 'plaintext';
}

// Build tree structure from flat file list
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  content?: string;
  language?: string;
}

function buildFileTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = {
    name: 'root',
    path: '',
    isDirectory: true,
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          content: isLast ? file.content : undefined,
          language: isLast ? file.language || getLanguage(part) : undefined,
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort children: directories first, then alphabetically
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root;
}

// Tree Node Component
function TreeNodeView({
  node,
  depth,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;

  if (node.name === 'root') {
    return (
      <>
        {node.children.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-gray-700/50 rounded ${
          isSelected ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.isDirectory) {
            onToggleExpand(node.path);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {node.isDirectory ? (
          <span className="text-sm">{isExpanded ? '📂' : '📁'}</span>
        ) : (
          <span className="text-sm">{getFileIcon(node.name)}</span>
        )}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {node.isDirectory && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectView({ projectName, files, onDownload }: ProjectViewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const tree = useMemo(() => buildFileTree(files), [files]);

  const selectedFile = useMemo(() => {
    if (!selectedPath) return null;
    return files.find((f) => f.path === selectedPath);
  }, [selectedPath, files]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allDirPaths = new Set<string>();
    const collectDirs = (node: TreeNode) => {
      if (node.isDirectory && node.path) {
        allDirPaths.add(node.path);
      }
      node.children.forEach(collectDirs);
    };
    collectDirs(tree);
    setExpandedPaths(allDirPaths);
  };

  const handleCollapseAll = () => {
    setExpandedPaths(new Set());
  };

  const handleCopyFile = async () => {
    if (selectedFile) {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border bg-[#0d1117] border-[#30363d]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-[rgba(56,139,253,0.1)] border-[#30363d]">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 3h7l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          </svg>
          <span className="font-medium text-gray-200">{projectName}</span>
          <span className="text-xs text-gray-500">{files.length} files</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-white/10"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-white/10"
          >
            Collapse
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-white/10"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              ZIP
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-[300px] max-h-[500px]">
        {/* File Tree */}
        <div className="w-56 border-r overflow-y-auto border-[#30363d] bg-[#161b22]">
          <div className="py-2">
            <TreeNodeView
              node={tree}
              depth={0}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        </div>

        {/* File Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedFile ? (
            <>
              {/* File header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] bg-[#161b22]">
                <span className="text-sm text-gray-300">{selectedFile.path}</span>
                <button
                  onClick={handleCopyFile}
                  className="p-1 rounded hover:bg-white/10 text-gray-400"
                  title="Copy file"
                >
                  {copied ? (
                    <svg
                      className="w-4 h-4 text-green-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Code content */}
              <div className="flex-1 overflow-auto">
                <pre className="text-sm font-mono p-3 leading-relaxed text-[#c9d1d9] m-0">
                  <code>{selectedFile.content}</code>
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-2 opacity-50"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
                <p>Select a file to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse build_project output into ProjectFile array
 */
export function parseBuildProjectOutput(output: string): ProjectFile[] {
  try {
    const data = JSON.parse(output);
    if (data.files && Array.isArray(data.files)) {
      return data.files;
    }
    if (data.project?.files && Array.isArray(data.project.files)) {
      return data.project.files;
    }
    // Handle flat structure
    if (typeof data === 'object') {
      const files: ProjectFile[] = [];
      for (const [path, content] of Object.entries(data)) {
        if (typeof content === 'string') {
          files.push({ path, content });
        }
      }
      if (files.length > 0) return files;
    }
  } catch {
    // Not JSON, try to parse as formatted output
  }

  // Parse non-JSON output (file blocks)
  const files: ProjectFile[] = [];
  const fileBlockRegex = /(?:^|\n)(?:File:|###?\s*)\s*`?([^\n`]+)`?\n```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = fileBlockRegex.exec(output)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[3],
      language: match[2],
    });
  }

  return files;
}

export default ProjectView;
