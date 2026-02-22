'use client';

import { useState, memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface SuggestedFollowupsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export const SuggestedFollowups = memo(function SuggestedFollowups({
  suggestions,
  onSelect,
  disabled,
}: SuggestedFollowupsProps) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  if (!suggestions || suggestions.length === 0) return null;

  const handleClick = (suggestion: string) => {
    if (disabled || selected) return;
    setSelected(suggestion);
    onSelect(suggestion);
  };

  const isDark = theme === 'dark';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginTop: '12px',
        paddingLeft: '4px',
        animation: 'followupsFadeIn 0.4s ease-out',
      }}
    >
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => handleClick(suggestion)}
          disabled={disabled || !!selected}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            lineHeight: '1.4',
            borderRadius: '18px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)'}`,
            backgroundColor:
              selected === suggestion
                ? isDark
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(0,0,0,0.08)'
                : 'transparent',
            color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)',
            cursor: disabled || selected ? 'default' : 'pointer',
            opacity: selected && selected !== suggestion ? 0.4 : 1,
            transition: 'all 0.2s ease',
            textAlign: 'left',
            maxWidth: '100%',
          }}
          onMouseEnter={(e) => {
            if (!disabled && !selected) {
              e.currentTarget.style.backgroundColor = isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)';
              e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
              e.currentTarget.style.borderColor = isDark
                ? 'rgba(255,255,255,0.25)'
                : 'rgba(0,0,0,0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !selected) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)';
              e.currentTarget.style.borderColor = isDark
                ? 'rgba(255,255,255,0.2)'
                : 'rgba(0,0,0,0.12)';
            }
          }}
        >
          {suggestion}
        </button>
      ))}
      <style>{`
        @keyframes followupsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

export default SuggestedFollowups;
