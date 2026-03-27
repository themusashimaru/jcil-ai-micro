'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface Artifact {
  type: 'html' | 'svg' | 'code';
  content: string;
  language: string;
  title: string;
}

interface ArtifactContextType {
  artifact: Artifact | null;
  isOpen: boolean;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
}

const ArtifactContext = createContext<ArtifactContextType>({
  artifact: null,
  isOpen: false,
  openArtifact: () => {},
  closeArtifact: () => {},
});

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openArtifact = useCallback((a: Artifact) => {
    setArtifact(a);
    setIsOpen(true);
  }, []);

  const closeArtifact = useCallback(() => {
    setIsOpen(false);
    // Delay clearing content so close animation can play
    setTimeout(() => setArtifact(null), 300);
  }, []);

  return (
    <ArtifactContext.Provider value={{ artifact, isOpen, openArtifact, closeArtifact }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact() {
  return useContext(ArtifactContext);
}
