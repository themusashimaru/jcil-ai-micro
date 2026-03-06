export interface ThinkingStep {
  id: string;
  type: 'analysis' | 'reasoning' | 'decision' | 'planning' | 'verification';
  content: string;
  confidence: number; // 0-100
  timestamp: number;
  duration?: number;
  tokens?: number;
  children?: ThinkingStep[];
}

export interface ThinkingSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalTokens: number;
  steps: ThinkingStep[];
  summary?: string;
  confidence: number;
}

export interface ThinkingStats {
  duration: number;
  stepCounts: Record<string, number>;
  avgConfidence: number;
}

// Step type icons and colors
export const stepTypeConfig: Record<
  ThinkingStep['type'],
  { icon: string; color: string; label: string }
> = {
  analysis: { icon: '🔍', color: 'var(--cl-info)', label: 'Analysis' },
  reasoning: { icon: '🧠', color: 'var(--cl-purple)', label: 'Reasoning' },
  decision: { icon: '⚡', color: 'var(--cl-warning)', label: 'Decision' },
  planning: { icon: '📋', color: 'var(--cl-success)', label: 'Planning' },
  verification: { icon: '✓', color: 'var(--cl-cyan)', label: 'Verification' },
};
