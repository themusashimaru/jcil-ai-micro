/**
 * GITHUB REPOSITORY DROPDOWN
 * ==========================
 *
 * Compact dropdown for selecting a GitHub repository
 * to work with in the current chat session.
 *
 * Shows in the chat composer action bar when GitHub is connected.
 * The selected repo is used for:
 * - Code review requests
 * - Push operations
 * - Repository context in AI responses
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCodeExecution, GitHubRepo } from '@/contexts/CodeExecutionContext';

interface RepoDropdownProps {
  disabled?: boolean;
}

export function RepoDropdown({ disabled }: RepoDropdownProps) {
  const {
    githubConnected,
    repos,
    selectedRepo,
    loadingRepos,
    selectRepo,
    fetchRepos,
  } = useCodeExecution();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mount state for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch repos when dropdown opens
  useEffect(() => {
    if (isOpen && githubConnected && repos.length === 0) {
      fetchRepos();
    }
  }, [isOpen, githubConnected, repos.length, fetchRepos]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter repos by search
  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Don't show if GitHub not connected
  if (!githubConnected) return null;

  const handleSelect = (repo: GitHubRepo) => {
    selectRepo(repo);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectRepo(null);
  };

  // Calculate dropdown position
  const getDropdownPosition = () => {
    if (!buttonRef.current) return { bottom: 80, left: 16 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
    };
  };

  return (
    <>
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`rounded-lg px-2 py-1 md:px-3 md:py-1.5 disabled:opacity-50 shrink-0 flex items-center gap-1.5 transition-all text-xs md:text-sm font-medium ${
          selectedRepo
            ? 'text-purple-400'
            : 'hover:bg-white/5'
        }`}
        style={{ color: selectedRepo ? '#a855f7' : 'var(--text-secondary)' }}
        title={selectedRepo ? `Working with ${selectedRepo.fullName}` : 'Select repository'}
      >
        {/* GitHub icon */}
        <svg className="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span className="max-w-[100px] truncate">
          {selectedRepo ? selectedRepo.name : 'Repo'}
        </span>
        {/* Clear button or chevron */}
        {selectedRepo ? (
          <button
            onClick={handleClear}
            className="p-0.5 hover:bg-white/10 rounded"
            title="Clear selection"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu - via Portal */}
      {isOpen && isMounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          />
          {/* Dropdown */}
          <div
            ref={dropdownRef}
            className="fixed z-[9999] w-72 rounded-lg border border-white/10 bg-zinc-900 shadow-xl overflow-hidden"
            style={{
              bottom: getDropdownPosition().bottom,
              left: Math.min(getDropdownPosition().left, window.innerWidth - 300),
            }}
          >
            {/* Search */}
            <div className="p-2 border-b border-white/10">
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-md bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus
              />
            </div>

            {/* Repository List */}
            <div className="max-h-64 overflow-y-auto">
              {loadingRepos ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-purple-400" />
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-400">
                  {searchQuery ? 'No matching repositories' : 'No repositories found'}
                </div>
              ) : (
                filteredRepos.slice(0, 20).map((repo) => (
                  <button
                    key={repo.fullName}
                    onClick={() => handleSelect(repo)}
                    className={`w-full px-3 py-2 flex items-start gap-2 hover:bg-white/5 transition-colors text-left ${
                      selectedRepo?.fullName === repo.fullName ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    {/* Repo icon */}
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      style={{ color: repo.private ? '#ffc107' : 'var(--text-muted)' }}
                    >
                      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white truncate">
                          {repo.name}
                        </span>
                        {repo.private && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    {/* Checkmark for selected */}
                    {selectedRepo?.fullName === repo.fullName && (
                      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {repos.length} repos
              </span>
              <button
                onClick={() => fetchRepos()}
                disabled={loadingRepos}
                className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default RepoDropdown;
