'use client';

/**
 * CODE LAB VISUAL TO CODE
 *
 * Revolutionary screenshot-to-code generation.
 * Upload any screenshot/design and get React/HTML code.
 *
 * Features:
 * - Drag & drop image upload
 * - Paste from clipboard
 * - Framework selection (React, Vue, HTML, Tailwind)
 * - Live preview
 * - Code export
 * - Iterative refinement
 */

import { useState, useCallback, useRef, useEffect } from 'react';

type Framework = 'react-tailwind' | 'react-css' | 'vue' | 'html-css' | 'nextjs';

interface GenerationResult {
  code: string;
  framework: Framework;
  language: string;
  preview?: string;
}

interface CodeLabVisualToCodeProps {
  onGenerate: (
    imageBase64: string,
    framework: Framework,
    instructions?: string
  ) => Promise<GenerationResult>;
  onInsertCode?: (code: string) => void;
  className?: string;
}

const FRAMEWORKS: { id: Framework; name: string; icon: string; description: string }[] = [
  {
    id: 'react-tailwind',
    name: 'React + Tailwind',
    icon: '⚛️',
    description: 'React components with Tailwind CSS',
  },
  {
    id: 'react-css',
    name: 'React + CSS',
    icon: '⚛️',
    description: 'React components with CSS modules',
  },
  { id: 'nextjs', name: 'Next.js', icon: '▲', description: 'Next.js App Router components' },
  { id: 'vue', name: 'Vue 3', icon: '💚', description: 'Vue 3 Composition API' },
  { id: 'html-css', name: 'HTML + CSS', icon: '🌐', description: 'Plain HTML with CSS' },
];

export function CodeLabVisualToCode({
  onGenerate,
  onInsertCode,
  className = '',
}: CodeLabVisualToCodeProps) {
  const [image, setImage] = useState<string | null>(null);
  const [framework, setFramework] = useState<Framework>('react-tailwind');
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setError(null);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle paste event from global listeners
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  // Handle drag & drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // Generate code
  const handleGenerate = async () => {
    if (!image) return;

    setIsGenerating(true);
    setError(null);

    try {
      const generatedResult = await onGenerate(image, framework, instructions || undefined);
      setResult(generatedResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy code
  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.code);
    }
  };

  // Insert into editor
  const handleInsert = () => {
    if (result && onInsertCode) {
      onInsertCode(result.code);
    }
  };

  // Clear and reset
  const handleClear = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setInstructions('');
  };

  return (
    <div className={`visual-to-code ${className}`}>
      {/* Header */}
      <div className="vtc-header">
        <div className="vtc-title">
          <span className="vtc-icon">🎨</span>
          <h3>Visual to Code</h3>
        </div>
        <p className="vtc-subtitle">Upload a screenshot or design and get production-ready code</p>
      </div>

      <div className="vtc-content">
        {/* Left side: Image upload */}
        <div className="vtc-upload-section">
          {!image ? (
            <div
              ref={dropZoneRef}
              className="drop-zone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              <div className="drop-icon">📸</div>
              <p className="drop-text">Drop an image here</p>
              <p className="drop-hint">or click to browse • paste from clipboard</p>
            </div>
          ) : (
            <div className="image-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Uploaded design" />
              <button className="remove-image" onClick={handleClear}>
                ×
              </button>
            </div>
          )}

          {/* Framework selection */}
          <div className="framework-select">
            <label>Output Framework</label>
            <div className="framework-grid">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw.id}
                  className={`framework-option ${framework === fw.id ? 'selected' : ''}`}
                  onClick={() => setFramework(fw.id)}
                >
                  <span className="fw-icon">{fw.icon}</span>
                  <span className="fw-name">{fw.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Additional instructions */}
          <div className="instructions-input">
            <label>Additional Instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Make it responsive, use specific colors, add animations..."
              rows={3}
            />
          </div>

          {/* Generate button */}
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={!image || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate Code
              </>
            )}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Right side: Generated code */}
        <div className="vtc-result-section">
          {result ? (
            <>
              <div className="result-header">
                <div className="result-info">
                  <span className="result-framework">
                    {FRAMEWORKS.find((f) => f.id === result.framework)?.icon}
                    {FRAMEWORKS.find((f) => f.id === result.framework)?.name}
                  </span>
                  <span className="result-lang">{result.language}</span>
                </div>
                <div className="result-actions">
                  <button onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? '📝 Code' : '👁️ Preview'}
                  </button>
                  <button onClick={handleCopy}>📋 Copy</button>
                  {onInsertCode && (
                    <button onClick={handleInsert} className="primary">
                      ➕ Insert
                    </button>
                  )}
                </div>
              </div>

              <div className="result-content">
                {showPreview && result.preview ? (
                  <iframe srcDoc={result.preview} title="Preview" className="preview-frame" />
                ) : (
                  <pre className="code-output">
                    <code>{result.code}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="result-placeholder">
              <div className="placeholder-icon">💻</div>
              <p>Generated code will appear here</p>
              <p className="placeholder-hint">Upload an image and click Generate to start</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .visual-to-code {
          background: var(--cl-bg-primary, white);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 16px;
          overflow: hidden;
        }

        .vtc-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          background: linear-gradient(135deg, #f9fafb 0%, #eef2ff 100%);
        }

        .vtc-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .vtc-icon {
          font-size: 1.5rem;
        }

        .vtc-title h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .vtc-subtitle {
          margin: 0.375rem 0 0;
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .vtc-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 500px;
        }

        .vtc-upload-section {
          padding: 1.5rem;
          border-right: 1px solid var(--cl-border-primary, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .drop-zone {
          flex: 1;
          min-height: 200px;
          border: 2px dashed var(--cl-border-secondary, #d1d5db);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .drop-zone:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
          background: #f8f9ff;
        }

        .drop-icon {
          font-size: 3rem;
          margin-bottom: 0.75rem;
        }

        .drop-text {
          font-size: 1rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
          margin: 0;
        }

        .drop-hint {
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #6b7280);
          margin: 0.25rem 0 0;
        }

        .image-preview {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .image-preview img {
          width: 100%;
          height: auto;
          max-height: 300px;
          object-fit: contain;
        }

        .remove-image {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .framework-select label,
        .instructions-input label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-secondary, #4b5563);
          margin-bottom: 0.5rem;
        }

        .framework-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .framework-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.625rem;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
        }

        .framework-option:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .framework-option.selected {
          border-color: var(--cl-accent-primary, #1e3a5f);
          background: #eef2ff;
        }

        .fw-icon {
          font-size: 1.25rem;
        }

        .fw-name {
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
        }

        .instructions-input textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          font-size: 0.875rem;
          resize: none;
          font-family: inherit;
        }

        .instructions-input textarea:focus {
          outline: none;
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .generate-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .generate-btn:hover:not(:disabled) {
          background: #4f46e5;
          transform: translateY(-1px);
        }

        .generate-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #991b1b;
          font-size: 0.8125rem;
        }

        .vtc-result-section {
          display: flex;
          flex-direction: column;
          background: var(--cl-bg-code, #1e1e1e);
        }

        .result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #2d2d2d;
          border-bottom: 1px solid #3d3d3d;
        }

        .result-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .result-framework {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          color: #d4d4d4;
        }

        .result-lang {
          padding: 0.125rem 0.5rem;
          background: #3d3d3d;
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #9ca3af;
        }

        .result-actions {
          display: flex;
          gap: 0.5rem;
        }

        .result-actions button {
          padding: 0.375rem 0.75rem;
          background: #3d3d3d;
          border: none;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #d4d4d4;
          cursor: pointer;
        }

        .result-actions button:hover {
          background: #4d4d4d;
        }

        .result-actions button.primary {
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .result-content {
          flex: 1;
          overflow: auto;
        }

        .code-output {
          margin: 0;
          padding: 1rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #d4d4d4;
        }

        .preview-frame {
          width: 100%;
          height: 100%;
          border: none;
          background: white;
        }

        .result-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7280;
        }

        .placeholder-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .result-placeholder p {
          margin: 0;
          font-size: 0.875rem;
        }

        .placeholder-hint {
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: #4b5563;
        }

        @media (max-width: 900px) {
          .vtc-content {
            grid-template-columns: 1fr;
          }

          .vtc-upload-section {
            border-right: none;
            border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          }

          .framework-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
