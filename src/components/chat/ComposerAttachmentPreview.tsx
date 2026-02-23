/** Attachment preview thumbnails for ChatComposer */

'use client';

import type { Attachment } from '@/app/chat/types';

interface ComposerAttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function ComposerAttachmentPreview({
  attachments,
  onRemove,
}: ComposerAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 md:mb-3 flex flex-wrap gap-2 md:gap-3">
      {attachments.slice(0, 4).map((attachment) => {
        const isImage = attachment.type?.startsWith('image/');
        const isPdf = attachment.type === 'application/pdf';
        const isExcel =
          attachment.type?.includes('spreadsheet') ||
          attachment.type?.includes('excel') ||
          attachment.name?.endsWith('.xlsx') ||
          attachment.name?.endsWith('.xls');
        const isCsv = attachment.type === 'text/csv' || attachment.name?.endsWith('.csv');
        const isText = attachment.type === 'text/plain' || attachment.name?.endsWith('.txt');

        return (
          <button
            key={attachment.id}
            onClick={() => onRemove(attachment.id)}
            className="relative h-16 w-16 md:h-20 md:w-20 overflow-hidden rounded-lg border border-white/20 bg-white/5 cursor-pointer hover:border-red-400/50 hover:bg-red-500/10 transition-colors group"
            title="Tap to remove"
            aria-label={`Remove ${attachment.name}`}
          >
            {attachment.thumbnail && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.thumbnail}
                alt={attachment.name}
                className="h-full w-full object-cover group-hover:opacity-70 transition-opacity"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 group-hover:opacity-70 transition-opacity">
                <FileTypeIcon isPdf={isPdf} isExcel={isExcel || isCsv} isText={isText} />
                <span className="truncate text-[8px] md:text-[10px] text-gray-300 max-w-full px-0.5 text-center leading-tight">
                  {attachment.name.length > 12
                    ? attachment.name.slice(0, 10) + '...'
                    : attachment.name}
                </span>
              </div>
            )}
          </button>
        );
      })}
      {attachments.length > 4 && (
        <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-lg bg-white/5 text-sm text-gray-400 border border-white/20">
          +{attachments.length - 4}
        </div>
      )}
    </div>
  );
}

function FileTypeIcon({
  isPdf,
  isExcel,
  isText,
}: {
  isPdf: boolean;
  isExcel: boolean;
  isText: boolean;
}) {
  if (isPdf) {
    return (
      <svg
        className="h-6 w-6 md:h-8 md:w-8 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v6h6" />
      </svg>
    );
  }
  if (isExcel) {
    return (
      <svg
        className="h-6 w-6 md:h-8 md:w-8 text-green-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 10h18M3 14h18M9 4v16M15 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
        />
      </svg>
    );
  }
  if (isText) {
    return (
      <svg
        className="h-6 w-6 md:h-8 md:w-8 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-6 w-6 md:h-8 md:w-8 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}
