/**
 * Available voice options for real-time voice conversation.
 * Uses OpenAI Realtime API voices.
 */

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
}

export const VOICES: VoiceOption[] = [
  { id: 'verse', name: 'Verse', description: 'Warm and conversational', gender: 'male' },
  { id: 'alloy', name: 'Alloy', description: 'Balanced and clear', gender: 'neutral' },
  { id: 'echo', name: 'Echo', description: 'Deep and authoritative', gender: 'male' },
  { id: 'fable', name: 'Fable', description: 'Storytelling and expressive', gender: 'male' },
  { id: 'onyx', name: 'Onyx', description: 'Rich and resonant', gender: 'male' },
  { id: 'nova', name: 'Nova', description: 'Bright and friendly', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Gentle and soothing', gender: 'female' },
];

export const DEFAULT_VOICE = 'verse';
