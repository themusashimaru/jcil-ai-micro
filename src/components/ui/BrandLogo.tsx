'use client';

/**
 * BRAND LOGO COMPONENT
 *
 * Displays official brand logos for app integrations.
 * Uses embedded SVGs for reliability - no external dependencies.
 */

import { useState } from 'react';
import Image from 'next/image';
import { EMBEDDED_SVGS, BRAND_COLORS } from './brand-logo-data';

interface BrandLogoProps {
  toolkitId: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BrandLogo({
  toolkitId,
  displayName,
  size = 'md',
  className = '',
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);
  const upperToolkitId = toolkitId.toUpperCase();
  const embeddedSvg = EMBEDDED_SVGS[upperToolkitId];
  const brandColor = BRAND_COLORS[upperToolkitId] || '#6B7280';

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const fontSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Get initials from display name (max 2 characters)
  const getInitials = (name: string) => {
    const words = name.split(/[\s_-]+/);
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return (words[0][0] + (words[1]?.[0] || '')).toUpperCase();
  };

  // Priority 1: Use embedded SVG (100% reliable, no network needed)
  if (embeddedSvg) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg overflow-hidden flex items-center justify-center bg-white p-1 ${className}`}
      >
        {embeddedSvg}
      </div>
    );
  }

  // Priority 2: Try Simple Icons CDN as fallback for less common icons
  const simpleIconSlug = toolkitId.toLowerCase().replace(/_/g, '');
  const cdnUrl = `https://cdn.simpleicons.org/${simpleIconSlug}`;

  if (!imgError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg overflow-hidden flex items-center justify-center bg-white/10 ${className}`}
      >
        <Image
          src={cdnUrl}
          alt={displayName}
          width={48}
          height={48}
          className="object-contain w-3/4 h-3/4"
          onError={() => setImgError(true)}
          loading="lazy"
          unoptimized
        />
      </div>
    );
  }

  // Priority 3: Fallback to styled initials with brand color
  return (
    <div
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center font-bold ${fontSizes[size]} text-white ${className}`}
      style={{ backgroundColor: brandColor }}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}
