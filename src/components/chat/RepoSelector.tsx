/**
 * GITHUB REPOSITORY SELECTOR
 * ==========================
 *
 * Modal component for selecting a GitHub repository
 * to push code to. Displays user's repositories with
 * search and filtering capabilities.
 *
 * Features:
 * - Search repositories by name
 * - Show public/private status
 * - Display last update time
 * - Create new repository option
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCodeExecution, GitHubRepo } from '@/contexts/CodeExecutionContext';

interface RepoSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (repo: GitHubRepo) => void;
}

export function RepoSelector({ isOpen, onClose, onSelect }: RepoSelectorProps) {
  const { repos, loadingRepos, fetchRepos, githubConnected } = useCodeExecution();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch repos when modal opens
  useEffect(() => {
    if (isOpen && githubConnected && repos.length === 0) {
      fetchRepos();
    }
  }, [isOpen, githubConnected, repos.length, fetchRepos]);

  // Filter repos by search query
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const query = searchQuery.toLowerCase();
    return repos.filter(repo =>
      repo.name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query)
    );
  }, [repos, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--glass-bg)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <GitHubIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Select Repository
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <CloseIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        </div>

        {/* Repository List */}
        <div className="max-h-80 overflow-y-auto">
          {!githubConnected ? (
            <div className="px-4 py-8 text-center">
              <GitHubIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Connect your GitHub account to push code
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Go to Settings → Connectors → GitHub
              </p>
            </div>
          ) : loadingRepos ? (
            <div className="px-4 py-8 text-center">
              <LoadingSpinner className="w-8 h-8 mx-auto mb-3" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading repositories...
              </p>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FolderIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? 'No repositories match your search' : 'No repositories found'}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.fullName}
                  onClick={() => {
                    onSelect(repo);
                    onClose();
                  }}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left"
                >
                  <RepoIcon
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    isPrivate={repo.private}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {repo.name}
                      </span>
                      {repo.private && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(255, 193, 7, 0.2)',
                            color: '#ffc107',
                          }}
                        >
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {repo.description}
                      </p>
                    )}
                    <div
                      className="text-xs mt-1 flex items-center gap-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{repo.owner}</span>
                      <span>•</span>
                      <span>{repo.defaultBranch}</span>
                    </div>
                  </div>
                  <ChevronRightIcon
                    className="w-5 h-5 flex-shrink-0 opacity-50"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {repos.length} repositories
          </p>
          <button
            onClick={() => fetchRepos()}
            disabled={loadingRepos}
            className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            style={{ color: 'var(--primary)' }}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-primary)' }}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function CloseIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function RepoIcon({ className, isPrivate }: { className?: string; isPrivate?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" style={{ color: isPrivate ? '#ffc107' : 'var(--text-muted)' }}>
      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
    </svg>
  );
}

function ChevronRightIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" style={{ color: 'var(--primary)' }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default RepoSelector;
