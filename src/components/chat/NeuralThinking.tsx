/**
 * NEURAL THINKING COMPONENT
 *
 * PURPOSE:
 * - Display impressive, technical "thinking" visualization
 * - Show real AI query analysis in terminal/hacker aesthetic
 * - Progressive reveal of processing steps
 *
 * VISUAL STYLE:
 * - Terminal-like output with colored prefixes
 * - Typewriter effect for each line
 * - Technical details: tokens, entities, confidence scores
 * - Memory addresses and hex values for hacker feel
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// Analysis data from the API
export interface ThinkingAnalysis {
  tokens: number;
  entities: string[];
  queryType: string;
  confidence: number;
  domains: string[];
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  responseStructure: string[];
  memoryPatterns: number;
}

interface NeuralThinkingProps {
  userMessage: string;
  onComplete?: () => void;
  sessionId?: string;
}

// Generate a random hex string for memory addresses
function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Processing line with prefix and content
interface ProcessingLine {
  prefix: string;
  prefixColor: string;
  content: string;
  delay: number;
}

export function NeuralThinking({ userMessage, onComplete, sessionId }: NeuralThinkingProps) {
  const [lines, setLines] = useState<ProcessingLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [analysis, setAnalysis] = useState<ThinkingAnalysis | null>(null);
  const [phase, setPhase] = useState<'init' | 'loading' | 'displaying' | 'complete'>('init');

  // Fetch analysis from API
  useEffect(() => {
    if (!userMessage || phase !== 'init') return;

    setPhase('loading');

    const fetchAnalysis = async () => {
      try {
        // Get CSRF token
        const csrfToken =
          document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        const response = await fetch('/api/chat/think', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (response.ok) {
          const data = await response.json();
          setAnalysis(data);
        } else {
          // Use fallback on error
          setAnalysis({
            tokens: userMessage.split(/\s+/).length,
            entities: ['query', 'processing'],
            queryType: 'GENERAL',
            confidence: 0.8,
            domains: ['general'],
            complexity: 'MEDIUM',
            responseStructure: ['analysis', 'response'],
            memoryPatterns: 2,
          });
        }
      } catch {
        // Use fallback on network error
        setAnalysis({
          tokens: userMessage.split(/\s+/).length,
          entities: ['query'],
          queryType: 'GENERAL',
          confidence: 0.75,
          domains: ['general'],
          complexity: 'MEDIUM',
          responseStructure: ['response'],
          memoryPatterns: 1,
        });
      }
    };

    fetchAnalysis();
  }, [userMessage, phase]);

  // Build processing lines when analysis is ready
  useEffect(() => {
    if (!analysis || phase !== 'loading') return;

    const memAddr = randomHex(8);
    const sessionRef = sessionId?.slice(0, 8) || randomHex(8);

    const newLines: ProcessingLine[] = [
      {
        prefix: '[SYS]',
        prefixColor: 'var(--primary)',
        content: `Incoming query stream @ 0x${memAddr}`,
        delay: 80,
      },
      {
        prefix: '[LEX]',
        prefixColor: '#22d3ee', // cyan
        content: `Tokenizing: ${analysis.tokens} tokens extracted`,
        delay: 60,
      },
      {
        prefix: '[SEM]',
        prefixColor: '#a78bfa', // violet
        content: `Entities: {${analysis.entities.join(', ')}}`,
        delay: 70,
      },
      {
        prefix: '[CLS]',
        prefixColor: '#fbbf24', // amber
        content: `Query type: ${analysis.queryType} (confidence: ${analysis.confidence.toFixed(2)})`,
        delay: 65,
      },
      {
        prefix: '[CTX]',
        prefixColor: '#34d399', // emerald
        content: `Loading domains: ${analysis.domains.join(', ')}`,
        delay: 75,
      },
      {
        prefix: '[MEM]',
        prefixColor: '#f472b6', // pink
        content: `Pattern match: ${analysis.memoryPatterns} similar ${analysis.memoryPatterns === 1 ? 'solution' : 'solutions'} cached`,
        delay: 70,
      },
      {
        prefix: '[GEN]',
        prefixColor: '#60a5fa', // blue
        content: `Planning response structure...`,
        delay: 80,
      },
    ];

    // Add response structure tree
    if (analysis.responseStructure.length > 0) {
      const structureLines = analysis.responseStructure.map((section, idx) => {
        const isLast = idx === analysis.responseStructure.length - 1;
        const prefix = isLast ? '└─' : '├─';
        return `      ${prefix} ${section}`;
      });

      newLines.push({
        prefix: '',
        prefixColor: 'transparent',
        content: structureLines.join('\n'),
        delay: 50,
      });
    }

    // Final execution line
    newLines.push({
      prefix: '[EXEC]',
      prefixColor: '#22c55e', // green
      content: `Streaming response... [ref:${sessionRef}]`,
      delay: 60,
    });

    setLines(newLines);
    setPhase('displaying');
    setCurrentLineIndex(0);
    setCurrentCharIndex(0);
  }, [analysis, phase, sessionId]);

  // Typewriter effect for current line
  useEffect(() => {
    if (phase !== 'displaying' || lines.length === 0) return;

    const currentLine = lines[currentLineIndex];
    if (!currentLine) {
      setPhase('complete');
      onComplete?.();
      return;
    }

    const fullText = currentLine.content;

    if (currentCharIndex < fullText.length) {
      const timer = setTimeout(
        () => {
          setCurrentCharIndex((prev) => prev + 1);
        },
        currentLine.content.includes('\n') ? 15 : currentLine.delay / 2
      );
      return () => clearTimeout(timer);
    } else {
      // Move to next line
      const timer = setTimeout(() => {
        if (currentLineIndex < lines.length - 1) {
          setCurrentLineIndex((prev) => prev + 1);
          setCurrentCharIndex(0);
        } else {
          setPhase('complete');
          onComplete?.();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [phase, lines, currentLineIndex, currentCharIndex, onComplete]);

  // Render a single line
  const renderLine = useCallback(
    (line: ProcessingLine, index: number) => {
      const isCurrentLine = index === currentLineIndex;
      const isPastLine = index < currentLineIndex;
      const isFutureLine = index > currentLineIndex;

      if (isFutureLine) return null;

      const displayText = isPastLine ? line.content : line.content.slice(0, currentCharIndex);

      // Handle multi-line content (structure tree)
      if (line.content.includes('\n')) {
        const contentLines = displayText.split('\n');
        return (
          <div key={index} className="font-mono text-xs leading-relaxed">
            {contentLines.map((contentLine, i) => (
              <div key={i} style={{ color: 'var(--text-secondary)' }}>
                {contentLine}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div key={index} className="font-mono text-xs flex items-start gap-1.5">
          {line.prefix && (
            <span className="font-bold shrink-0" style={{ color: line.prefixColor }}>
              {line.prefix}
            </span>
          )}
          <span style={{ color: 'var(--text-secondary)' }}>
            {displayText}
            {isCurrentLine && currentCharIndex < line.content.length && (
              <span
                className="inline-block ml-0.5"
                style={{
                  color: 'var(--primary)',
                  animation: 'blink 1s step-end infinite',
                }}
              >
                ▋
              </span>
            )}
          </span>
        </div>
      );
    },
    [currentLineIndex, currentCharIndex]
  );

  // Initial loading state
  if (phase === 'init' || phase === 'loading') {
    return (
      <div className="font-mono text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: 'var(--primary)' }}>
            [SYS]
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Initializing neural processing
            <span
              className="inline-block ml-0.5"
              style={{
                color: 'var(--primary)',
                animation: 'blink 1s step-end infinite',
              }}
            >
              ▋
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line, index) => renderLine(line, index))}
      {phase === 'complete' && (
        <div className="font-mono text-xs mt-1">
          <span style={{ color: 'var(--text-muted)' }}>{'>'} _</span>
        </div>
      )}
    </div>
  );
}
