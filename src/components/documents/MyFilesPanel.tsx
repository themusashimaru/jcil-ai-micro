'use client';

/**
 * MY FILES PANEL
 *
 * Collapsible panel in sidebar for managing user's RAG documents.
 * Upload PDFs, Word docs, Excel files - AI can reference them in chat.
 *
 * Admin-only for now (testing phase).
 */

import { useState, useEffect, useRef } from 'react';

interface Folder {
  id: string;
  name: string;
  color: string;
  parent_folder_id: string | null;
}

interface Document {
  id: string;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  folder_id: string | null;
  created_at: string;
}

interface UserStats {
  total_documents: number;
  total_folders: number;
  total_size_bytes: number;
  total_chunks: number;
}

export default function MyFilesPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data when panel expands
  useEffect(() => {
    if (isExpanded) {
      loadData();
    }
  }, [isExpanded]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        fetch('/api/documents/user/folders'),
        fetch('/api/documents/user/files'),
      ]);

      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }

      if (filesRes.ok) {
        const data = await filesRes.json();
        setDocuments(data.documents || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('[MyFiles] Error loading data:', err);
      setError('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        setUploadProgress(`Uploading ${file.name}...`);

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        // Upload file
        const uploadRes = await fetch('/api/documents/user/files', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload failed');
        }

        const { document } = await uploadRes.json();

        // Trigger processing
        setUploadProgress(`Processing ${file.name}...`);
        await fetch('/api/documents/user/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id }),
        });

      } catch (err) {
        console.error('[MyFiles] Upload error:', err);
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    setIsUploading(false);
    setUploadProgress('');

    // Clear input and reload
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadData();
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/documents/user/files?id=${docId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      loadData();
    } catch (err) {
      console.error('[MyFiles] Delete error:', err);
      setError('Failed to delete file');
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
      case 'doc':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'xlsx':
      case 'xls':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <span className="text-xs text-green-500">Ready</span>;
      case 'processing':
        return <span className="text-xs text-yellow-500 animate-pulse">Processing...</span>;
      case 'pending':
        return <span className="text-xs text-gray-500">Pending</span>;
      case 'error':
        return <span className="text-xs text-red-500">Error</span>;
      default:
        return null;
    }
  };

  // Group documents by folder
  const rootDocs = documents.filter(d => !d.folder_id);
  const folderDocs = (folderId: string) => documents.filter(d => d.folder_id === folderId);

  return (
    <div className="relative" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Header Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setShowInfoTooltip(true)}
        onMouseLeave={() => setShowInfoTooltip(false)}
        className="w-full p-3 flex items-center justify-between hover:bg-opacity-50 transition-colors"
        style={{ backgroundColor: isExpanded ? 'var(--glass-bg)' : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            My Files
          </span>
          {stats && stats.total_documents > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
              {stats.total_documents}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Info icon */}
          <div
            className="p-1 rounded-full hover:bg-opacity-20"
            style={{ backgroundColor: 'var(--glass-bg)' }}
            onClick={(e) => {
              e.stopPropagation();
              setShowInfoTooltip(!showInfoTooltip);
            }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {/* Chevron */}
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Info Tooltip */}
      {showInfoTooltip && (
        <div
          className="absolute left-3 right-3 z-50 p-3 rounded-lg shadow-lg text-sm"
          style={{
            top: '100%',
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}
        >
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <p className="font-medium mb-1">Your Personal Knowledge Base</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Upload PDFs, Word docs, or Excel files. The AI can then search and reference your documents when answering questions!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {/* Upload Button */}
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px dashed var(--border)',
                color: 'var(--text-primary)'
              }}
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">{uploadProgress || 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm">Upload Files</span>
                </>
              )}
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-2 rounded-lg text-sm text-red-500" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && documents.length === 0 && (
            <div className="text-center py-4">
              <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No files yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Upload PDFs, Word, or Excel
              </p>
            </div>
          )}

          {/* Files List */}
          {!isLoading && documents.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {/* Folders */}
              {folders.map(folder => (
                <div key={folder.id}>
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-opacity-50 transition-colors text-left"
                    style={{ backgroundColor: expandedFolders.has(folder.id) ? 'var(--glass-bg)' : 'transparent' }}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-90' : ''}`}
                      style={{ color: 'var(--text-muted)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-4 h-4" style={{ color: folder.color }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {folder.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {folderDocs(folder.id).length}
                    </span>
                  </button>

                  {/* Folder Contents */}
                  {expandedFolders.has(folder.id) && (
                    <div className="ml-6 space-y-1">
                      {folderDocs(folder.id).map(doc => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 p-2 rounded-lg group"
                          style={{ backgroundColor: 'var(--glass-bg)' }}
                        >
                          {getFileIcon(doc.file_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {doc.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {formatFileSize(doc.file_size)}
                              </span>
                              {getStatusBadge(doc.status)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Root Documents (no folder) */}
              {rootDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg group"
                  style={{ backgroundColor: 'var(--glass-bg)' }}
                >
                  {getFileIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatFileSize(doc.file_size)}
                      </span>
                      {getStatusBadge(doc.status)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          {stats && stats.total_documents > 0 && (
            <div className="mt-3 pt-2 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {stats.total_documents} files · {formatFileSize(stats.total_size_bytes)} total
            </div>
          )}
        </div>
      )}
    </div>
  );
}
