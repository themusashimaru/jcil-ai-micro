/** Generated image display — with download, verification badge, regenerate */

'use client';

import type { Message } from '@/app/chat/types';

interface GeneratedImageBlockProps {
  image: NonNullable<Message['generatedImage']>;
  onRegenerate?: (generationId: string, originalPrompt: string, feedback: string) => void;
}

export function GeneratedImageBlock({ image, onRegenerate }: GeneratedImageBlockProps) {
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-white/10 max-w-md relative group">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt={image.prompt} className="w-full h-auto" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
          <p className="text-xs text-white/90 line-clamp-2">{image.prompt}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-white/60">
              {image.dimensions.width} x {image.dimensions.height}
            </span>
            <div className="flex items-center gap-2">
              {image.verification && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${image.verification.matches ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                >
                  {image.verification.matches ? 'Verified' : 'Review'}
                </span>
              )}
              {image.verification && !image.verification.matches && onRegenerate && (
                <button
                  onClick={() => onRegenerate(image.id, image.prompt, image.verification!.feedback)}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-500/80 text-white hover:bg-blue-500 transition-colors"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
        <a
          href={image.imageUrl}
          download={`${image.type}-${image.id}.png`}
          className="absolute top-2 right-2 rounded-full bg-black/70 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-black/90"
          title="Download image"
          aria-label="Download image"
        >
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </a>
      </div>
      <div className="absolute top-2 left-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800/90 text-white border border-gray-600">
          {image.type === 'edit' ? 'Edited' : 'Created'}
        </span>
      </div>
    </div>
  );
}
