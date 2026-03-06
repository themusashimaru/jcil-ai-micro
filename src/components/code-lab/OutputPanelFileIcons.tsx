import React from 'react';

export function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
  };
  return langMap[ext || ''] || ext || 'text';
}

export function getFileIcon(path: string): React.ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();

  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="#f7df1e">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="10" fill="#000" textAnchor="middle" fontWeight="bold">
          {ext?.toUpperCase().substring(0, 2)}
        </text>
      </svg>
    );
  }

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

  if (ext === 'json') {
    return (
      <svg viewBox="0 0 24 24" fill="#6b7280">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="7" fill="#fff" textAnchor="middle">
          {'{}'}
        </text>
      </svg>
    );
  }

  if (['css', 'scss', 'sass'].includes(ext || '')) {
    return (
      <svg viewBox="0 0 24 24" fill="#264de4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="7" fill="#fff" textAnchor="middle" fontWeight="bold">
          CSS
        </text>
      </svg>
    );
  }

  if (ext === 'html') {
    return (
      <svg viewBox="0 0 24 24" fill="#e34c26">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <text x="12" y="16" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="bold">
          HTML
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
