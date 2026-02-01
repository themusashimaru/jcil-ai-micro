/**
 * LINGUISTICS TOOL
 *
 * Language analysis: phonetics, morphology, syntax trees,
 * IPA transcription, etymology patterns, and linguistic metrics.
 *
 * Part of TIER LANGUAGE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// IPA PHONETICS
// ============================================================================

const ENGLISH_TO_IPA: Record<string, string> = {
  // Common patterns (simplified)
  'th': 'θ', 'TH': 'ð', 'sh': 'ʃ', 'ch': 'tʃ', 'ng': 'ŋ',
  'zh': 'ʒ', 'j': 'dʒ', 'y': 'j', 'r': 'ɹ',
  'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɑ', 'u': 'ʌ',
  'ee': 'iː', 'oo': 'uː', 'ar': 'ɑːɹ', 'er': 'ɜːɹ', 'or': 'ɔːɹ',
  'aw': 'ɔː', 'ow': 'aʊ', 'oy': 'ɔɪ', 'ay': 'eɪ', 'ai': 'eɪ',
};

function basicIPA(text: string): string {
  let result = text.toLowerCase();
  // Apply longest matches first
  const sorted = Object.entries(ENGLISH_TO_IPA).sort((a, b) => b[0].length - a[0].length);
  for (const [pattern, ipa] of sorted) {
    result = result.replace(new RegExp(pattern, 'g'), ipa);
  }
  return `/${result}/`;
}

// ============================================================================
// SYLLABLE ANALYSIS
// ============================================================================

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;

  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Adjust for silent e
  if (w.endsWith('e') && count > 1) count--;
  // Adjust for -le endings
  if (w.endsWith('le') && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;

  return Math.max(1, count);
}

function syllabify(word: string): string[] {
  // Simple syllabification (approximation)
  const syllables: string[] = [];
  let current = '';
  const vowels = 'aeiouy';
  const w = word.toLowerCase();

  for (let i = 0; i < w.length; i++) {
    current += w[i];
    const isVowel = vowels.includes(w[i]);
    const nextIsConsonant = i + 1 < w.length && !vowels.includes(w[i + 1]);
    const nextNextIsVowel = i + 2 < w.length && vowels.includes(w[i + 2]);

    if (isVowel && nextIsConsonant && nextNextIsVowel && current.length > 0) {
      syllables.push(current);
      current = '';
    }
  }

  if (current) syllables.push(current);
  return syllables.length > 0 ? syllables : [word];
}

// ============================================================================
// MORPHOLOGICAL ANALYSIS
// ============================================================================

const PREFIXES = ['un', 'dis', 're', 'pre', 'mis', 'non', 'anti', 'de', 'over', 'under', 'sub', 'super', 'trans', 'inter', 'semi', 'ex', 'co', 'counter'];
const SUFFIXES = ['ing', 'ed', 'er', 'est', 'ly', 'ness', 'ment', 'tion', 'sion', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'al', 'ity', 'ize', 'ify'];

function analyzeMorphemes(word: string): { root: string; prefixes: string[]; suffixes: string[] } {
  const w = word.toLowerCase();
  const prefixes: string[] = [];
  const suffixes: string[] = [];
  let root = w;

  // Find prefixes
  for (const prefix of PREFIXES.sort((a, b) => b.length - a.length)) {
    if (root.startsWith(prefix) && root.length > prefix.length + 2) {
      prefixes.push(prefix);
      root = root.slice(prefix.length);
      break;
    }
  }

  // Find suffixes
  for (const suffix of SUFFIXES.sort((a, b) => b.length - a.length)) {
    if (root.endsWith(suffix) && root.length > suffix.length + 2) {
      suffixes.unshift(suffix);
      root = root.slice(0, -suffix.length);
      break;
    }
  }

  return { root, prefixes, suffixes };
}

// ============================================================================
// READABILITY METRICS
// ============================================================================

function fleschKincaid(text: string): { gradeLevel: number; readingEase: number } {
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w: string) => w.match(/[a-z]/i));
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wordsPerSentence = words.length / Math.max(1, sentences.length);
  const syllablesPerWord = syllables / Math.max(1, words.length);

  const gradeLevel = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const readingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

  return {
    gradeLevel: Math.max(0, Math.round(gradeLevel * 10) / 10),
    readingEase: Math.max(0, Math.min(100, Math.round(readingEase * 10) / 10)),
  };
}

function lexicalDiversity(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter((w: string) => w.match(/[a-z]/));
  const unique = new Set(words);
  return words.length > 0 ? unique.size / words.length : 0;
}

// ============================================================================
// WORD FREQUENCY ANALYSIS
// ============================================================================

function wordFrequency(text: string): Array<{ word: string; count: number; percent: number }> {
  const words = text.toLowerCase().split(/\s+/).filter((w: string) => w.match(/^[a-z]+$/));
  const freq: Record<string, number> = {};

  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .map(([word, count]) => ({ word, count, percent: Math.round(count / words.length * 10000) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ============================================================================
// SENTENCE STRUCTURE
// ============================================================================

function sentenceStructure(sentence: string): { type: string; clauses: number; complexity: string } {
  const words = sentence.split(/\s+/).length;
  const commas = (sentence.match(/,/g) || []).length;
  const conjunctions = (sentence.match(/\b(and|but|or|nor|for|yet|so|because|although|while|if|when|where|which|that)\b/gi) || []).length;

  const clauses = 1 + Math.min(commas, conjunctions);

  let type = 'Simple';
  if (clauses === 2) type = 'Compound';
  else if (clauses > 2) type = 'Complex';
  if (conjunctions > 2) type = 'Compound-Complex';

  let complexity = 'Low';
  if (words > 20 || clauses > 2) complexity = 'Medium';
  if (words > 35 || clauses > 3) complexity = 'High';

  return { type, clauses, complexity };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const linguisticsTool: UnifiedTool = {
  name: 'linguistics',
  description: `Linguistic analysis and language processing.

Operations:
- phonetics: IPA transcription and phonetic analysis
- syllables: Syllable counting and syllabification
- morphology: Analyze word structure (prefixes, roots, suffixes)
- readability: Flesch-Kincaid and readability metrics
- frequency: Word frequency analysis
- structure: Sentence structure analysis`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['phonetics', 'syllables', 'morphology', 'readability', 'frequency', 'structure'],
        description: 'Linguistics operation',
      },
      text: { type: 'string', description: 'Text to analyze' },
      word: { type: 'string', description: 'Word to analyze' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeLinguistics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text = '', word = '' } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'phonetics': {
        const w = word || text.split(/\s+/)[0] || 'hello';
        const ipa = basicIPA(w);

        result = {
          operation: 'phonetics',
          word: w,
          ipa_transcription: ipa,
          note: 'Simplified IPA approximation for English',
          consonants: w.replace(/[aeiou]/gi, '').split('').filter((c: string, i: number, a: string[]) => a.indexOf(c) === i),
          vowels: w.replace(/[^aeiou]/gi, '').split('').filter((c: string, i: number, a: string[]) => a.indexOf(c) === i),
        };
        break;
      }

      case 'syllables': {
        const w = word || text.split(/\s+/)[0] || 'example';
        const count = countSyllables(w);
        const syllables = syllabify(w);

        result = {
          operation: 'syllables',
          word: w,
          syllable_count: count,
          syllables: syllables,
          syllable_pattern: syllables.join('-'),
        };
        break;
      }

      case 'morphology': {
        const w = word || text.split(/\s+/)[0] || 'unhappiness';
        const morphemes = analyzeMorphemes(w);

        result = {
          operation: 'morphology',
          word: w,
          analysis: {
            prefixes: morphemes.prefixes.length > 0 ? morphemes.prefixes : ['(none)'],
            root: morphemes.root,
            suffixes: morphemes.suffixes.length > 0 ? morphemes.suffixes : ['(none)'],
          },
          morpheme_count: 1 + morphemes.prefixes.length + morphemes.suffixes.length,
          word_formation: morphemes.prefixes.concat([morphemes.root], morphemes.suffixes).join(' + '),
        };
        break;
      }

      case 'readability': {
        const t = text || 'The quick brown fox jumps over the lazy dog. It was a simple sentence for testing.';
        const fk = fleschKincaid(t);
        const diversity = lexicalDiversity(t);
        const words = t.split(/\s+/).filter((w: string) => w.match(/[a-z]/i));
        const sentences = t.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);

        let level = 'College';
        if (fk.gradeLevel <= 6) level = 'Elementary';
        else if (fk.gradeLevel <= 9) level = 'Middle School';
        else if (fk.gradeLevel <= 12) level = 'High School';

        result = {
          operation: 'readability',
          text_stats: {
            word_count: words.length,
            sentence_count: sentences.length,
            avg_words_per_sentence: Math.round(words.length / Math.max(1, sentences.length) * 10) / 10,
          },
          flesch_kincaid: {
            grade_level: fk.gradeLevel,
            reading_ease: fk.readingEase,
            reading_level: level,
          },
          lexical_diversity: Math.round(diversity * 1000) / 1000,
          ease_interpretation: fk.readingEase >= 80 ? 'Very Easy' : fk.readingEase >= 60 ? 'Standard' : fk.readingEase >= 40 ? 'Difficult' : 'Very Difficult',
        };
        break;
      }

      case 'frequency': {
        const t = text || 'The quick brown fox jumps over the lazy dog. The dog was not amused by the fox.';
        const freq = wordFrequency(t);
        const words = t.toLowerCase().split(/\s+/).filter((w: string) => w.match(/^[a-z]+$/));

        result = {
          operation: 'frequency',
          total_words: words.length,
          unique_words: new Set(words).size,
          top_words: freq.slice(0, 10),
          hapax_legomena: freq.filter((f: { count: number }) => f.count === 1).length,
        };
        break;
      }

      case 'structure': {
        const t = text || 'Although it was raining, the children played outside, and they had a great time.';
        const sentences = t.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);

        const analyses = sentences.map((s: string) => ({
          sentence: s.trim(),
          ...sentenceStructure(s),
          word_count: s.split(/\s+/).length,
        }));

        result = {
          operation: 'structure',
          sentence_count: sentences.length,
          analyses: analyses,
          summary: {
            simple: analyses.filter((a: { type: string }) => a.type === 'Simple').length,
            compound: analyses.filter((a: { type: string }) => a.type === 'Compound').length,
            complex: analyses.filter((a: { type: string }) => a.type === 'Complex').length,
            compound_complex: analyses.filter((a: { type: string }) => a.type === 'Compound-Complex').length,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Linguistics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isLinguisticsAvailable(): boolean { return true; }
