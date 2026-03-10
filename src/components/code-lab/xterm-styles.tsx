'use client';

import React from 'react';

export function XTermLoadingState({ className }: { className: string }) {
  return (
    <div className={`xterm-container loading ${className}`}>
      <div className="loading-spinner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
            <animate
              attributeName="stroke-dashoffset"
              dur="1s"
              repeatCount="indefinite"
              values="32;0"
            />
          </circle>
        </svg>
        <span>Loading terminal...</span>
      </div>
      <style jsx>{`
        .xterm-container.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d1117;
          min-height: 200px;
          border-radius: 8px;
        }
        .loading-spinner {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #58a6ff;
        }
        .loading-spinner svg {
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export function XTermErrorState({ className, error }: { className: string; error: string }) {
  return (
    <div className={`xterm-container error ${className}`}>
      <div className="error-message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>{error}</span>
      </div>
      <style jsx>{`
        .xterm-container.error {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d1117;
          min-height: 200px;
          border-radius: 8px;
        }
        .error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #f85149;
        }
        .error-message svg {
          width: 24px;
          height: 24px;
        }
      `}</style>
    </div>
  );
}

export function XTermGlobalStyles() {
  return (
    <style jsx global>{`
      .xterm-container {
        width: 100%;
        height: 100%;
        min-height: 200px;
        background: #0d1117;
        border-radius: 8px;
        overflow: hidden;
      }

      .xterm-container .xterm {
        padding: 12px;
        height: 100%;
      }

      .xterm-container .xterm-viewport {
        background-color: transparent !important;
      }

      .xterm-container .xterm-screen {
        padding: 0;
      }

      /* xterm.js core styles */
      .xterm {
        cursor: text;
        position: relative;
        user-select: none;
        -ms-user-select: none;
        -webkit-user-select: none;
      }

      .xterm.focus,
      .xterm:focus {
        outline: none;
      }

      .xterm .xterm-helpers {
        position: absolute;
        top: 0;
        z-index: 5;
      }

      .xterm .xterm-helper-textarea {
        padding: 0;
        border: 0;
        margin: 0;
        position: absolute;
        opacity: 0;
        left: -9999em;
        top: 0;
        width: 0;
        height: 0;
        z-index: -5;
        white-space: nowrap;
        overflow: hidden;
        resize: none;
      }

      .xterm .composition-view {
        background: #000;
        color: #fff;
        display: none;
        position: absolute;
        white-space: nowrap;
        z-index: 1;
      }

      .xterm .composition-view.active {
        display: block;
      }

      .xterm .xterm-viewport {
        background-color: #000;
        overflow-y: scroll;
        cursor: default;
        position: absolute;
        right: 0;
        left: 0;
        top: 0;
        bottom: 0;
      }

      .xterm .xterm-screen {
        position: relative;
      }

      .xterm .xterm-screen canvas {
        position: absolute;
        left: 0;
        top: 0;
      }

      .xterm .xterm-scroll-area {
        visibility: hidden;
      }

      .xterm-char-measure-element {
        display: inline-block;
        visibility: hidden;
        position: absolute;
        top: 0;
        left: -9999em;
        line-height: normal;
      }

      .xterm.enable-mouse-events {
        cursor: default;
      }

      .xterm .xterm-cursor-pointer {
        cursor: pointer;
      }

      .xterm.column-select.focus {
        cursor: crosshair;
      }

      .xterm .xterm-accessibility,
      .xterm .xterm-message {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        z-index: 10;
        color: transparent;
        pointer-events: none;
      }

      .xterm .xterm-accessibility-tree:not(.debug) {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        z-index: -5;
        clip: rect(0, 0, 0, 0);
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .xterm .live-region {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      .xterm-dim {
        opacity: 0.5;
      }

      .xterm-underline-1 {
        text-decoration: underline;
      }
      .xterm-underline-2 {
        text-decoration: double underline;
      }
      .xterm-underline-3 {
        text-decoration: wavy underline;
      }
      .xterm-underline-4 {
        text-decoration: dotted underline;
      }
      .xterm-underline-5 {
        text-decoration: dashed underline;
      }

      .xterm-overline {
        text-decoration: overline;
      }

      .xterm-overline.xterm-underline-1 {
        text-decoration: overline underline;
      }
      .xterm-overline.xterm-underline-2 {
        text-decoration: overline double underline;
      }
      .xterm-overline.xterm-underline-3 {
        text-decoration: overline wavy underline;
      }
      .xterm-overline.xterm-underline-4 {
        text-decoration: overline dotted underline;
      }
      .xterm-overline.xterm-underline-5 {
        text-decoration: overline dashed underline;
      }

      .xterm-strikethrough {
        text-decoration: line-through;
      }

      .xterm-screen .xterm-decoration-container .xterm-decoration {
        z-index: 6;
        position: absolute;
      }

      .xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
        z-index: 7;
      }

      .xterm-decoration-overview-ruler {
        z-index: 8;
        position: absolute;
        top: 0;
        right: 0;
        pointer-events: none;
      }

      .xterm-decoration-top {
        z-index: 2;
        position: relative;
      }
    `}</style>
  );
}
