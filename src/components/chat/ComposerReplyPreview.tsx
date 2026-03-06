'use client';

import type { Message } from '@/app/chat/types';

interface ComposerReplyPreviewProps {
  replyingTo: Message;
  onClearReply?: () => void;
}

export function ComposerReplyPreview({ replyingTo, onClearReply }: ComposerReplyPreviewProps) {
  return (
    <div className="mb-2 flex items-start gap-2 p-3 rounded-lg border border-primary bg-primary-hover">
      <svg
        className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-primary">Replying to:</span>
        <p className="text-sm mt-1 line-clamp-2 text-text-primary">
          {replyingTo.content.length > 150
            ? replyingTo.content.slice(0, 150) + '...'
            : replyingTo.content}
        </p>
      </div>
      <button
        onClick={onClearReply}
        className="p-1.5 rounded-full transition-colors flex-shrink-0 text-text-muted"
        aria-label="Cancel reply"
        title="Cancel reply"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
