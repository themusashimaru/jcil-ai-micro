'use client';

/**
 * CODE LAB FILE BROWSER
 *
 * Browse files from a GitHub repository.
 * Features:
 * - Lazy-load directory contents
 * - Expand/collapse folders
 * - Click to view file content
 * - File type icons
 */

import { useState, useCallback } from 'react';

interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
  children?: FileNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

interface CodeLabFileBrowserProps {
  repo: {
    owner: string;
    name: string;
    branch: string;
  };
  onFileSelect?: (path: string, content: string) => void;
}

export function CodeLabFileBrowser({ repo, onFileSelect }: CodeLabFileBrowserProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Load root directory
  const loadRoot = useCallback(async () => {
    if (isLoaded || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-tree',
          owner: repo.owner,
          repo: repo.name,
          branch: repo.branch,
          recursive: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load repository');
      }

      const data = await response.json();
      const files = (data.tree || []).map(
        (item: { path: string; type: string; size?: number; sha?: string }) => ({
          path: item.path,
          name: item.path.split('/').pop() || item.path,
          type: item.type === 'tree' ? 'dir' : 'file',
          size: item.size,
          sha: item.sha,
          children: item.type === 'tree' ? [] : undefined,
          isExpanded: false,
        })
      );

      // Sort: directories first, then files
      files.sort((a: FileNode, b: FileNode) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });

      setTree(files);
      setIsLoaded(true);
    } catch (err) {
      console.error('[FileBrowser] Error loading tree:', err);
      setError('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [repo, isLoaded, isLoading]);

  // Load directory contents
  const loadDirectory = useCallback(
    async (dirPath: string) => {
      try {
        const response = await fetch('/api/connectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get-tree',
            owner: repo.owner,
            repo: repo.name,
            branch: repo.branch,
            recursive: true,
          }),
        });

        if (!response.ok) return [];

        const data = await response.json();
        const allFiles = data.tree || [];

        // Filter files in this directory
        const children = allFiles
          .filter((item: { path: string }) => {
            const parentPath = item.path.split('/').slice(0, -1).join('/');
            return parentPath === dirPath;
          })
          .map((item: { path: string; type: string; size?: number; sha?: string }) => ({
            path: item.path,
            name: item.path.split('/').pop() || item.path,
            type: item.type === 'tree' ? 'dir' : 'file',
            size: item.size,
            sha: item.sha,
            children: item.type === 'tree' ? [] : undefined,
            isExpanded: false,
          }));

        // Sort
        children.sort((a: FileNode, b: FileNode) => {
          if (a.type === 'dir' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'dir') return 1;
          return a.name.localeCompare(b.name);
        });

        return children;
      } catch (err) {
        console.error('[FileBrowser] Error loading directory:', err);
        return [];
      }
    },
    [repo]
  );

  // Toggle directory expansion
  const toggleDirectory = useCallback(
    async (path: string) => {
      setTree((prev) =>
        updateNode(prev, path, (node) => ({
          ...node,
          isLoading: !node.isExpanded && node.children?.length === 0,
          isExpanded: !node.isExpanded,
        }))
      );

      // Load children if needed
      const node = findNode(tree, path);
      if (node && !node.isExpanded && (!node.children || node.children.length === 0)) {
        const children = await loadDirectory(path);
        setTree((prev) =>
          updateNode(prev, path, (n) => ({
            ...n,
            children,
            isLoading: false,
          }))
        );
      }
    },
    [tree, loadDirectory]
  );

  // Handle file click
  const handleFileClick = useCallback(
    async (filePath: string) => {
      setSelectedFile(filePath);

      if (onFileSelect) {
        try {
          const response = await fetch('/api/connectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get-file',
              owner: repo.owner,
              repo: repo.name,
              path: filePath,
              branch: repo.branch,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            onFileSelect(filePath, data.content || '');
          }
        } catch (err) {
          console.error('[FileBrowser] Error loading file:', err);
        }
      }
    },
    [repo, onFileSelect]
  );

  // Render tree recursively
  const renderNode = (node: FileNode, depth = 0) => {
    const isDir = node.type === 'dir';

    return (
      <div
        key={node.path}
        className="file-node"
        role="treeitem"
        aria-expanded={isDir ? node.isExpanded : undefined}
        aria-selected={selectedFile === node.path}
      >
        <button
          className={`file-item ${selectedFile === node.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => (isDir ? toggleDirectory(node.path) : handleFileClick(node.path))}
          aria-label={
            isDir
              ? `${node.isExpanded ? 'Collapse' : 'Expand'} folder ${node.name}`
              : `Open file ${node.name}`
          }
        >
          {isDir ? (
            <span className={`folder-icon ${node.isExpanded ? 'expanded' : ''}`}>
              {node.isLoading ? (
                <svg
                  className="spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              ) : node.isExpanded ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          ) : (
            <span className="file-icon">{getFileIcon(node.name)}</span>
          )}
          <span className="file-name">{node.name}</span>
        </button>
        {isDir && node.isExpanded && node.children && (
          <div className="file-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-browser" role="region" aria-label="File browser">
      <div className="file-browser-header">
        <span className="file-browser-title" id="file-browser-title">
          Files
        </span>
        <button
          className="file-browser-refresh"
          onClick={() => {
            setIsLoaded(false);
            setTree([]);
            setTimeout(loadRoot, 0);
          }}
          title="Refresh file list"
          aria-label="Refresh file list"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </button>
      </div>

      {!isLoaded && !isLoading && (
        <button className="file-browser-load" onClick={loadRoot} aria-label="Load repository files">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          Browse Files
        </button>
      )}

      {isLoading && !tree.length && <div className="file-browser-loading">Loading files...</div>}

      {error && <div className="file-browser-error">{error}</div>}

      {tree.length > 0 && (
        <div className="file-tree" role="tree" aria-labelledby="file-browser-title">
          {tree.map((node) => renderNode(node))}
        </div>
      )}

      <style jsx>{`
        .file-browser {
          display: flex;
          flex-direction: column;
        }

        .file-browser-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .file-browser-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .file-browser-refresh {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 4px;
        }

        .file-browser-refresh:hover {
          color: #1e3a5f;
          background: #eef2ff;
        }

        .file-browser-refresh svg {
          width: 14px;
          height: 14px;
        }

        .file-browser-load {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: none;
          border: none;
          color: #6b7280;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .file-browser-load:hover {
          color: #1e3a5f;
          background: #f9fafb;
        }

        .file-browser-load svg {
          width: 18px;
          height: 18px;
        }

        .file-browser-loading,
        .file-browser-error {
          padding: 1rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #6b7280;
        }

        .file-browser-error {
          color: #dc2626;
        }

        .file-tree {
          flex: 1;
          overflow-y: auto;
          padding: 0.25rem 0;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          width: 100%;
          padding: 0.25rem 0.5rem;
          background: none;
          border: none;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          text-align: left;
        }

        .file-item:hover {
          background: #f3f4f6;
        }

        .file-item.selected {
          background: #eef2ff;
          color: #4f46e5;
        }

        .folder-icon,
        .file-icon {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .folder-icon svg,
        .file-icon svg {
          width: 12px;
          height: 12px;
        }

        .folder-icon {
          color: #6b7280;
        }

        .folder-icon.expanded {
          color: #1e3a5f;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-children {
          margin-left: 0;
        }
      `}</style>
    </div>
  );
}

// Helper functions
function findNode(tree: FileNode[], path: string): FileNode | null {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function updateNode(
  tree: FileNode[],
  path: string,
  updater: (node: FileNode) => FileNode
): FileNode[] {
  return tree.map((node) => {
    if (node.path === path) {
      return updater(node);
    }
    if (node.children) {
      return { ...node, children: updateNode(node.children, path, updater) };
    }
    return node;
  });
}

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();

  // JavaScript/TypeScript
  if (['js', 'jsx', 'ts', 'tsx', 'mjs'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="#f7df1e">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="10" fill="#000" textAnchor="middle" fontWeight="bold">
          JS
        </text>
      </svg>
    );
  }

  // Python
  if (ext === 'py') {
    return (
      <svg viewBox="0 0 24 24" fill="#3776ab">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">
          PY
        </text>
      </svg>
    );
  }

  // JSON
  if (ext === 'json') {
    return (
      <svg viewBox="0 0 24 24" fill="#6b7280">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="6" fill="#fff" textAnchor="middle">
          {'{}'}
        </text>
      </svg>
    );
  }

  // Markdown
  if (['md', 'mdx'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
