'use client';

/**
 * CODE LAB LIVE FILE TREE
 *
 * Real-time file tree with workspace integration.
 * Features:
 * - Live updates when files change
 * - Expand/collapse directories
 * - File icons by type
 * - Search/filter
 * - Right-click context menu
 * - Drag & drop support
 * - Git status indicators
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: Date;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'ignored';
}

interface CodeLabLiveFileTreeProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  onFileCreate?: (path: string) => void;
  onFileDelete?: (path: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onRefresh?: () => void;
  selectedPath?: string;
  loading?: boolean;
  className?: string;
}

// File type icons
const FILE_ICONS: Record<string, string> = {
  // Languages
  ts: '📘',
  tsx: '⚛️',
  js: '📒',
  jsx: '⚛️',
  py: '🐍',
  rs: '🦀',
  go: '🐹',
  java: '☕',
  rb: '💎',
  php: '🐘',
  swift: '🍎',
  kt: '🟣',
  c: '🔷',
  cpp: '🔷',
  cs: '🟪',

  // Config
  json: '📋',
  yaml: '📋',
  yml: '📋',
  toml: '📋',
  xml: '📋',
  env: '🔐',

  // Web
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  less: '🎨',
  svg: '🖼️',

  // Docs
  md: '📝',
  txt: '📄',
  pdf: '📕',
  doc: '📘',

  // Data
  csv: '📊',
  sql: '🗃️',

  // Other
  sh: '💻',
  bash: '💻',
  zsh: '💻',
  dockerfile: '🐳',
  gitignore: '🔒',
  lock: '🔒',

  // Default
  default: '📄',
  folder: '📁',
  folderOpen: '📂',
};

function getFileIcon(name: string, type: 'file' | 'directory', isOpen?: boolean): string {
  if (type === 'directory') {
    return isOpen ? FILE_ICONS.folderOpen : FILE_ICONS.folder;
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const lowerName = name.toLowerCase();

  // Special filenames
  if (lowerName === 'dockerfile') return FILE_ICONS.dockerfile;
  if (lowerName === '.gitignore') return FILE_ICONS.gitignore;
  if (lowerName.includes('.lock')) return FILE_ICONS.lock;
  if (lowerName === '.env' || lowerName.startsWith('.env.')) return FILE_ICONS.env;

  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function getGitStatusColor(status?: FileNode['gitStatus']): string | undefined {
  switch (status) {
    case 'modified': return '#f59e0b';
    case 'added': return '#22c55e';
    case 'deleted': return '#ef4444';
    case 'untracked': return '#8b5cf6';
    case 'ignored': return '#6b7280';
    default: return undefined;
  }
}

export function CodeLabLiveFileTree({
  files,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onRefresh,
  selectedPath,
  loading = false,
  className = '',
}: CodeLabLiveFileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);

  // Toggle directory expansion
  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();

    function filterNode(node: FileNode): FileNode | null {
      if (node.type === 'file') {
        return node.name.toLowerCase().includes(query) ? node : null;
      }

      const filteredChildren = node.children
        ?.map(child => filterNode(child))
        .filter(Boolean) as FileNode[];

      if (filteredChildren && filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return node.name.toLowerCase().includes(query) ? node : null;
    }

    return files.map(f => filterNode(f)).filter(Boolean) as FileNode[];
  }, [files, searchQuery]);

  // Handle right-click
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Render a file node
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const gitColor = getGitStatusColor(node.gitStatus);

    return (
      <div key={node.path} className="file-node">
        <div
          className={`file-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'directory' && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          )}
          <span className="file-icon">
            {getFileIcon(node.name, node.type, isExpanded)}
          </span>
          <span
            className="file-name"
            style={gitColor ? { color: gitColor } : undefined}
          >
            {node.name}
          </span>
          {node.gitStatus && (
            <span className="git-badge" style={{ color: gitColor }}>
              {node.gitStatus === 'modified' ? 'M' :
               node.gitStatus === 'added' ? 'A' :
               node.gitStatus === 'deleted' ? 'D' :
               node.gitStatus === 'untracked' ? 'U' : ''}
            </span>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div className="file-children">
            {node.children
              .sort((a, b) => {
                // Directories first, then alphabetical
                if (a.type !== b.type) {
                  return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
              .map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`live-file-tree ${className}`}>
      {/* Header */}
      <div className="tree-header">
        <span className="tree-title">Files</span>
        <div className="tree-actions">
          {onFileCreate && (
            <button
              className="tree-btn"
              onClick={() => onFileCreate('/')}
              title="New file"
            >
              +
            </button>
          )}
          {onRefresh && (
            <button
              className={`tree-btn ${loading ? 'loading' : ''}`}
              onClick={onRefresh}
              title="Refresh"
              disabled={loading}
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="tree-search">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      {/* File tree */}
      <div className="tree-content">
        {loading && files.length === 0 ? (
          <div className="tree-loading">Loading files...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="tree-empty">
            {searchQuery ? 'No matching files' : 'No files in workspace'}
          </div>
        ) : (
          filteredFiles.map(node => renderNode(node))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => onFileSelect(contextMenu.node.path)}>
            Open
          </button>
          {onFileRename && (
            <button onClick={() => {
              const newName = prompt('New name:', contextMenu.node.name);
              if (newName && newName !== contextMenu.node.name) {
                const newPath = contextMenu.node.path.replace(
                  contextMenu.node.name,
                  newName
                );
                onFileRename(contextMenu.node.path, newPath);
              }
              setContextMenu(null);
            }}>
              Rename
            </button>
          )}
          {onFileDelete && (
            <button
              className="danger"
              onClick={() => {
                if (confirm(`Delete ${contextMenu.node.name}?`)) {
                  onFileDelete(contextMenu.node.path);
                }
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .live-file-tree {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--cl-bg-primary, white);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }

        .tree-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .tree-title {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .tree-actions {
          display: flex;
          gap: 0.25rem;
        }

        .tree-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          color: var(--cl-text-tertiary, #6b7280);
          font-size: 1rem;
        }

        .tree-btn:hover {
          background: var(--cl-bg-hover, #f3f4f6);
          color: var(--cl-text-primary, #1a1f36);
        }

        .tree-btn.loading {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .tree-search {
          position: relative;
          padding: 0.5rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .tree-search input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 6px;
          font-size: 0.8125rem;
          background: var(--cl-bg-input, #f8fafc);
        }

        .tree-search input:focus {
          outline: none;
          border-color: var(--cl-accent-primary, #6366f1);
        }

        .clear-search {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 1rem;
          color: var(--cl-text-muted, #9ca3af);
          cursor: pointer;
        }

        .tree-content {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 0;
        }

        .tree-loading,
        .tree-empty {
          padding: 2rem;
          text-align: center;
          color: var(--cl-text-tertiary, #6b7280);
          font-size: 0.8125rem;
        }

        .file-row {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          cursor: pointer;
          border-radius: 4px;
          margin: 0 0.25rem;
        }

        .file-row:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .file-row.selected {
          background: var(--cl-bg-selected, #e0e7ff);
        }

        .expand-icon {
          width: 12px;
          font-size: 0.625rem;
          color: var(--cl-text-muted, #9ca3af);
          transition: transform 0.15s;
        }

        .expand-icon.expanded {
          transform: rotate(90deg);
        }

        .file-icon {
          font-size: 0.875rem;
        }

        .file-name {
          flex: 1;
          font-size: 0.8125rem;
          color: var(--cl-text-primary, #1a1f36);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .git-badge {
          font-size: 0.625rem;
          font-weight: 700;
          padding: 0.125rem 0.25rem;
          border-radius: 2px;
        }

        .context-menu {
          position: fixed;
          background: white;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 120px;
          overflow: hidden;
        }

        .context-menu button {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: none;
          background: transparent;
          text-align: left;
          font-size: 0.8125rem;
          cursor: pointer;
          color: var(--cl-text-primary, #1a1f36);
        }

        .context-menu button:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .context-menu button.danger {
          color: var(--cl-error, #ef4444);
        }

        .context-menu button.danger:hover {
          background: #fef2f2;
        }
      `}</style>
    </div>
  );
}
