/** Message attachments — image thumbnails and file type icons */

'use client';

import type { Message } from '@/app/chat/types';

interface MessageAttachmentsProps {
  attachments: NonNullable<Message['attachments']>;
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  return (
    <div className="flex flex-wrap gap-2 max-w-full overflow-hidden">
      {attachments.map((attachment) => {
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
          <div
            key={attachment.id}
            className="group relative overflow-hidden rounded-lg border border-white/10"
          >
            {attachment.thumbnail && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.thumbnail}
                alt={attachment.name}
                className="h-16 w-16 object-cover"
              />
            ) : (
              <div className="flex h-16 min-w-[80px] max-w-[120px] flex-col items-center justify-center gap-1 bg-white/5 px-2 py-1">
                <AttachmentIcon isPdf={isPdf} isExcel={isExcel || isCsv} isText={isText} />
                <span className="truncate text-[10px] text-gray-300 max-w-full px-1">
                  {attachment.name}
                </span>
              </div>
            )}
            {isImage && attachment.thumbnail && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="truncate px-2 text-xs text-white">{attachment.name}</span>
              </div>
            )}
          </div>
        );
      })}
      {attachments.length > 4 && (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 text-xs text-gray-400">
          +{attachments.length - 4}
        </div>
      )}
    </div>
  );
}

function AttachmentIcon({
  isPdf,
  isExcel,
  isText,
}: {
  isPdf: boolean;
  isExcel: boolean;
  isText: boolean;
}) {
  const color = isPdf
    ? 'text-red-400'
    : isExcel
      ? 'text-green-400'
      : isText
        ? 'text-blue-400'
        : 'text-gray-400';
  if (isPdf) {
    return (
      <svg className={`h-6 w-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v6h6" />
        <text x="7" y="17" fontSize="6" fill="currentColor" fontWeight="bold">
          PDF
        </text>
      </svg>
    );
  }
  if (isExcel) {
    return (
      <svg className={`h-6 w-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <svg className={`h-6 w-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <svg className={`h-6 w-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}
