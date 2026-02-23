/** Video job progress — queued, in-progress, completed, failed states */

'use client';

import type { Message } from '@/app/chat/types';

const SpinnerIcon = () => (
  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const DownloadIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

interface MessageVideoJobProps {
  videoJob: NonNullable<Message['videoJob']>;
}

export function MessageVideoJob({ videoJob }: MessageVideoJobProps) {
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-md p-4 bg-white/5">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl">🎬</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">
            {videoJob.status === 'queued' && 'Video Queued'}
            {videoJob.status === 'in_progress' && 'Generating Video...'}
            {videoJob.status === 'completed' && 'Video Ready!'}
            {videoJob.status === 'failed' && 'Generation Failed'}
          </div>
          <div className="text-xs text-gray-400">
            {videoJob.model} - {videoJob.seconds}s - {videoJob.size}
            {videoJob.segment && (
              <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                Segment {videoJob.segment.current}/{videoJob.segment.total}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {(videoJob.status === 'queued' || videoJob.status === 'in_progress') && (
        <div className="mb-3">
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${videoJob.progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">
            {videoJob.progress}%
            {videoJob.segment && (
              <span className="ml-2">
                ({videoJob.segment.total_seconds - videoJob.segment.seconds_remaining}s /{' '}
                {videoJob.segment.total_seconds}s total)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Completed segments */}
      {videoJob.completed_segments && videoJob.completed_segments.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="text-xs text-gray-400">Completed segments:</div>
          {videoJob.completed_segments.map((url, idx) => (
            <a
              key={url}
              href={url}
              download={`segment-${idx + 1}.mp4`}
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
            >
              <span>✓ Segment {idx + 1}</span>
              <DownloadIcon className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}

      {/* Error */}
      {videoJob.status === 'failed' && videoJob.error && (
        <div className="text-sm text-red-400 mb-2">{videoJob.error.message}</div>
      )}

      {/* Download completed video */}
      {videoJob.status === 'completed' && (
        <a
          href={videoJob.download_url}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition"
        >
          <DownloadIcon className="h-4 w-4" />
          Download Video
        </a>
      )}

      {/* Processing indicator */}
      {(videoJob.status === 'queued' || videoJob.status === 'in_progress') && (
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <SpinnerIcon />
          {videoJob.segment ? (
            <span>
              Generating segment {videoJob.segment.current} of {videoJob.segment.total}...
            </span>
          ) : (
            <span>Video generation typically takes 1-3 minutes</span>
          )}
        </div>
      )}
    </div>
  );
}
