/**
 * GLASS BUBBLE COMPONENT
 * PURPOSE: Reusable glassmorphism chat bubble with tail/curvature
 * TODO: Implement bubble with variants (left/right), animations
 */

import React from 'react';

interface GlassBubbleProps {
  children: React.ReactNode;
  side?: 'left' | 'right';
}

export function GlassBubble({ children, side = 'left' }: GlassBubbleProps) {
  return (
    <div className={`chat-bubble chat-bubble-tail ${side}`}>
      {children}
    </div>
  );
}
