'use client';

import { useState, useEffect } from 'react';

const PLACEHOLDER_SUGGESTIONS = [
  'Type your message...',
  'Write a resume...',
  'Draft an email...',
  'Analyze data...',
  'Generate an invoice...',
  'Translate text...',
  'Research a topic...',
  'Write code...',
  'Plan a trip...',
];

export function useTypewriterPlaceholder(isFocused: boolean, message: string) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [initialDelayComplete, setInitialDelayComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setInitialDelayComplete(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialDelayComplete || isFocused || message) return;
    const currentText = PLACEHOLDER_SUGGESTIONS[placeholderIndex % PLACEHOLDER_SUGGESTIONS.length];
    if (charIndex < currentText.length) {
      const timer = setTimeout(() => {
        setDisplayedText(currentText.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
        setDisplayedText('');
        setCharIndex(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [charIndex, placeholderIndex, isFocused, message, initialDelayComplete]);

  return { displayedText };
}
