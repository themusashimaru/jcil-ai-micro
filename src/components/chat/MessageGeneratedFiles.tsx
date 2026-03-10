/** Generated files download section — with save-to-My-Files functionality */

'use client';

import { useState, useCallback } from 'react';
import type { Message } from '@/app/chat/types';

function getFileInfo(mimeType: string, filename: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('xlsx') || filename.endsWith('.xlsx')) {
    return { icon: '📊', label: 'Excel Spreadsheet' };
  }
  if (
    mimeType.includes('presentation') ||
    mimeType.includes('pptx') ||
    filename.endsWith('.pptx')
  ) {
    return { icon: '📽️', label: 'PowerPoint' };
  }
  if (mimeType.includes('document') || mimeType.includes('docx') || filename.endsWith('.docx')) {
    return { icon: '📄', label: 'Word Document' };
  }
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
    return { icon: '📑', label: 'PDF' };
  }
  return { icon: '📁', label: 'Document' };
}

const DownloadIcon = () => (
  <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

interface MessageGeneratedFilesProps {
  files: NonNullable<Message['files']>;
}

export function MessageGeneratedFiles({ files }: MessageGeneratedFilesProps) {
  const [savingFiles, setSavingFiles] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});

  const handleSaveToMyFiles = useCallback(
    async (fileIndex: number, downloadUrl: string, filename: string) => {
      setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'saving' }));

      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('Failed to fetch file');

        const blob = await response.blob();
        const formData = new FormData();
        formData.append('file', blob, filename);

        const uploadResponse = await fetch('/api/documents/user/files', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const err = await uploadResponse.json();
          throw new Error(err.error || 'Upload failed');
        }

        const { document } = await uploadResponse.json();
        await fetch('/api/documents/user/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id }),
        });

        setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'saved' }));
        setTimeout(() => {
          setSavingFiles((prev) => {
            const updated = { ...prev };
            delete updated[fileIndex];
            return updated;
          });
        }, 3000);
      } catch (error) {
        console.error('Failed to save to My Files:', error);
        setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'error' }));
        setTimeout(() => {
          setSavingFiles((prev) => {
            const updated = { ...prev };
            delete updated[fileIndex];
            return updated;
          });
        }, 3000);
      }
    },
    []
  );

  return (
    <div className="mt-3 pt-3 border-t border-theme">
      <div className="text-xs font-medium mb-2 text-text-muted">📎 Your document is ready:</div>
      <div className="flex flex-col gap-2">
        {files.map((file, index) => {
          const { icon, label } = getFileInfo(file.mime_type, file.filename);

          return (
            <div
              key={file.download_url || `${file.filename}-${index}`}
              className="flex flex-col gap-1"
            >
              {/* Download to Device */}
              <button
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left bg-primary text-white"
                title={`Download ${file.filename}`}
                onClick={async () => {
                  try {
                    const response = await fetch(file.download_url);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = file.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Download failed:', err);
                    window.open(file.download_url, '_blank');
                  }
                }}
              >
                <span className="text-lg">{icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">Download {label}</div>
                  <div className="text-xs opacity-80 truncate max-w-[200px]">{file.filename}</div>
                </div>
                <DownloadIcon />
              </button>

              {/* Save to My Files */}
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.01] cursor-pointer w-full text-left disabled:opacity-50 disabled:cursor-not-allowed bg-glass border border-theme text-text-primary"
                title="Save to My Files for AI recall"
                disabled={savingFiles[index] === 'saving'}
                onClick={() => handleSaveToMyFiles(index, file.download_url, file.filename)}
              >
                <SaveStatusIcon status={savingFiles[index]} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SaveStatusIcon({ status }: { status?: 'saving' | 'saved' | 'error' }) {
  if (status === 'saving') {
    return (
      <>
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Saving...</span>
      </>
    );
  }
  if (status === 'saved') {
    return (
      <>
        <svg
          className="h-4 w-4 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-green-500">Saved to My Files!</span>
      </>
    );
  }
  if (status === 'error') {
    return (
      <>
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <span className="text-red-500">Failed to save</span>
      </>
    );
  }
  return (
    <>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      </svg>
      <span>Save to My Files</span>
      <span className="text-[10px] opacity-60">(for AI recall)</span>
    </>
  );
}
