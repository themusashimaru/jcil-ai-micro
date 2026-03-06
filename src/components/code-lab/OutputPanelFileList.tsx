'use client';

import { getFileIcon } from './OutputPanelFileIcons';

interface GeneratedFile {
  path: string;
  content: string;
  language?: string;
  isNew?: boolean;
  oldContent?: string;
}

interface OutputPanelFileListProps {
  files: GeneratedFile[];
  selectedFile: string | null;
  copiedFile: string | null;
  onSelectFile: (path: string) => void;
  onCopyFile: (path: string) => void;
}

export function OutputPanelFileList({
  files,
  selectedFile,
  copiedFile,
  onSelectFile,
  onCopyFile,
}: OutputPanelFileListProps) {
  return (
    <div className="output-files">
      {files.map((file) => (
        <button
          key={file.path}
          className={`file-item ${selectedFile === file.path ? 'selected' : ''}`}
          onClick={() => onSelectFile(file.path)}
        >
          <span className="file-icon">{getFileIcon(file.path)}</span>
          <span className="file-path">{file.path}</span>
          {file.isNew && <span className="file-badge new">new</span>}
          {file.oldContent && <span className="file-badge modified">modified</span>}
          <button
            className="file-copy"
            onClick={(e) => {
              e.stopPropagation();
              onCopyFile(file.path);
            }}
          >
            {copiedFile === file.path ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </button>
      ))}
    </div>
  );
}
