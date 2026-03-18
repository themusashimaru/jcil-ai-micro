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
import './code-lab-visual-to-code.css';

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

    </div>
  );
}
