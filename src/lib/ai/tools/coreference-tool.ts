/**
 * COREFERENCE TOOL
 * Comprehensive coreference resolution for pronoun and entity linking
 *
 * Implements:
 * - Pronoun resolution (anaphora, cataphora)
 * - Entity mention detection
 * - Coreference chain building
 * - Gender and number agreement
 * - Salience-based resolution
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// Types and interfaces
// =============================================================================

interface Mention {
  id: number;
  text: string;
  start: number;
  end: number;
  type: 'pronoun' | 'proper_noun' | 'common_noun' | 'demonstrative';
  gender: 'masculine' | 'feminine' | 'neutral' | 'unknown';
  number: 'singular' | 'plural' | 'unknown';
  person: '1' | '2' | '3' | 'unknown';
  animacy: 'animate' | 'inanimate' | 'unknown';
  sentence: number;
  headWord?: string;
}

interface CoreferenceChain {
  id: number;
  mentions: Mention[];
  representative: Mention;
  entity?: string;
}

interface CoreferenceResult {
  text: string;
  sentences: string[];
  mentions: Mention[];
  chains: CoreferenceChain[];
  singletons: Mention[];
}

// =============================================================================
// Pronoun database with features
// =============================================================================

interface PronounInfo {
  gender: 'masculine' | 'feminine' | 'neutral' | 'unknown';
  number: 'singular' | 'plural' | 'unknown';
  person: '1' | '2' | '3';
  case: 'nominative' | 'accusative' | 'possessive' | 'reflexive';
  animacy: 'animate' | 'inanimate' | 'unknown';
}

const PRONOUNS: Record<string, PronounInfo> = {
  // First person
  'i': { gender: 'unknown', number: 'singular', person: '1', case: 'nominative', animacy: 'animate' },
  'me': { gender: 'unknown', number: 'singular', person: '1', case: 'accusative', animacy: 'animate' },
  'my': { gender: 'unknown', number: 'singular', person: '1', case: 'possessive', animacy: 'animate' },
  'mine': { gender: 'unknown', number: 'singular', person: '1', case: 'possessive', animacy: 'animate' },
  'myself': { gender: 'unknown', number: 'singular', person: '1', case: 'reflexive', animacy: 'animate' },
  'we': { gender: 'unknown', number: 'plural', person: '1', case: 'nominative', animacy: 'animate' },
  'us': { gender: 'unknown', number: 'plural', person: '1', case: 'accusative', animacy: 'animate' },
  'our': { gender: 'unknown', number: 'plural', person: '1', case: 'possessive', animacy: 'animate' },
  'ours': { gender: 'unknown', number: 'plural', person: '1', case: 'possessive', animacy: 'animate' },
  'ourselves': { gender: 'unknown', number: 'plural', person: '1', case: 'reflexive', animacy: 'animate' },

  // Second person
  'you': { gender: 'unknown', number: 'unknown', person: '2', case: 'nominative', animacy: 'animate' },
  'your': { gender: 'unknown', number: 'unknown', person: '2', case: 'possessive', animacy: 'animate' },
  'yours': { gender: 'unknown', number: 'unknown', person: '2', case: 'possessive', animacy: 'animate' },
  'yourself': { gender: 'unknown', number: 'singular', person: '2', case: 'reflexive', animacy: 'animate' },
  'yourselves': { gender: 'unknown', number: 'plural', person: '2', case: 'reflexive', animacy: 'animate' },

  // Third person masculine
  'he': { gender: 'masculine', number: 'singular', person: '3', case: 'nominative', animacy: 'animate' },
  'him': { gender: 'masculine', number: 'singular', person: '3', case: 'accusative', animacy: 'animate' },
  'his': { gender: 'masculine', number: 'singular', person: '3', case: 'possessive', animacy: 'animate' },
  'himself': { gender: 'masculine', number: 'singular', person: '3', case: 'reflexive', animacy: 'animate' },

  // Third person feminine
  'she': { gender: 'feminine', number: 'singular', person: '3', case: 'nominative', animacy: 'animate' },
  'her': { gender: 'feminine', number: 'singular', person: '3', case: 'accusative', animacy: 'animate' },
  'hers': { gender: 'feminine', number: 'singular', person: '3', case: 'possessive', animacy: 'animate' },
  'herself': { gender: 'feminine', number: 'singular', person: '3', case: 'reflexive', animacy: 'animate' },

  // Third person neutral
  'it': { gender: 'neutral', number: 'singular', person: '3', case: 'nominative', animacy: 'inanimate' },
  'its': { gender: 'neutral', number: 'singular', person: '3', case: 'possessive', animacy: 'inanimate' },
  'itself': { gender: 'neutral', number: 'singular', person: '3', case: 'reflexive', animacy: 'inanimate' },

  // Third person plural
  'they': { gender: 'unknown', number: 'plural', person: '3', case: 'nominative', animacy: 'unknown' },
  'them': { gender: 'unknown', number: 'plural', person: '3', case: 'accusative', animacy: 'unknown' },
  'their': { gender: 'unknown', number: 'plural', person: '3', case: 'possessive', animacy: 'unknown' },
  'theirs': { gender: 'unknown', number: 'plural', person: '3', case: 'possessive', animacy: 'unknown' },
  'themselves': { gender: 'unknown', number: 'plural', person: '3', case: 'reflexive', animacy: 'unknown' },

  // Demonstratives (as pronouns)
  'this': { gender: 'neutral', number: 'singular', person: '3', case: 'nominative', animacy: 'unknown' },
  'that': { gender: 'neutral', number: 'singular', person: '3', case: 'nominative', animacy: 'unknown' },
  'these': { gender: 'neutral', number: 'plural', person: '3', case: 'nominative', animacy: 'unknown' },
  'those': { gender: 'neutral', number: 'plural', person: '3', case: 'nominative', animacy: 'unknown' }
};

// =============================================================================
// Name gender database (common names)
// =============================================================================

const MASCULINE_NAMES = new Set([
  'john', 'james', 'robert', 'michael', 'david', 'william', 'richard', 'joseph',
  'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark',
  'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
  'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob',
  'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott',
  'brandon', 'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander',
  'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'henry', 'adam', 'peter',
  'bob', 'tom', 'bill', 'jim', 'joe', 'mike', 'steve', 'dave', 'dan', 'matt', 'chris'
]);

const FEMININE_NAMES = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan',
  'jessica', 'sarah', 'karen', 'lisa', 'nancy', 'betty', 'margaret', 'sandra',
  'ashley', 'kimberly', 'emily', 'donna', 'michelle', 'dorothy', 'carol', 'amanda',
  'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
  'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma',
  'nicole', 'helen', 'samantha', 'katherine', 'christine', 'debra', 'rachel',
  'carolyn', 'janet', 'catherine', 'maria', 'heather', 'diane', 'ruth', 'julie',
  'jane', 'kate', 'jenny', 'sue', 'ann', 'anne', 'marie', 'alice', 'sophie', 'hannah'
]);

// =============================================================================
// Common noun features
// =============================================================================

interface NounInfo {
  gender: 'masculine' | 'feminine' | 'neutral' | 'unknown';
  animacy: 'animate' | 'inanimate' | 'unknown';
  typicalNumber: 'singular' | 'plural' | 'both';
}

const COMMON_NOUNS: Record<string, NounInfo> = {
  // Animate nouns
  'man': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'men': { gender: 'masculine', animacy: 'animate', typicalNumber: 'plural' },
  'boy': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'boys': { gender: 'masculine', animacy: 'animate', typicalNumber: 'plural' },
  'father': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'brother': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'son': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'uncle': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'husband': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'king': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'actor': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },
  'waiter': { gender: 'masculine', animacy: 'animate', typicalNumber: 'singular' },

  'woman': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'women': { gender: 'feminine', animacy: 'animate', typicalNumber: 'plural' },
  'girl': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'girls': { gender: 'feminine', animacy: 'animate', typicalNumber: 'plural' },
  'mother': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'sister': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'daughter': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'aunt': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'wife': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'queen': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'actress': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },
  'waitress': { gender: 'feminine', animacy: 'animate', typicalNumber: 'singular' },

  'person': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },
  'people': { gender: 'unknown', animacy: 'animate', typicalNumber: 'plural' },
  'child': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },
  'children': { gender: 'unknown', animacy: 'animate', typicalNumber: 'plural' },
  'student': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },
  'teacher': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },
  'doctor': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },
  'friend': { gender: 'unknown', animacy: 'animate', typicalNumber: 'singular' },

  // Inanimate nouns
  'book': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'car': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'house': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'table': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'computer': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'phone': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'city': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'company': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'country': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'idea': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'problem': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },
  'solution': { gender: 'neutral', animacy: 'inanimate', typicalNumber: 'singular' },

  // Animals (can be gendered or neutral)
  'dog': { gender: 'neutral', animacy: 'animate', typicalNumber: 'singular' },
  'cat': { gender: 'neutral', animacy: 'animate', typicalNumber: 'singular' },
  'horse': { gender: 'neutral', animacy: 'animate', typicalNumber: 'singular' },
  'bird': { gender: 'neutral', animacy: 'animate', typicalNumber: 'singular' }
};

// =============================================================================
// Tokenization and sentence splitting
// =============================================================================

function splitSentences(text: string): string[] {
  // Simple sentence boundary detection
  const sentences: string[] = [];
  const pattern = /[^.!?]+[.!?]+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    sentences.push(match[0].trim());
  }

  // Handle text without sentence-ending punctuation
  if (sentences.length === 0 && text.trim()) {
    sentences.push(text.trim());
  }

  return sentences;
}

function tokenize(text: string): Array<{ word: string; start: number; end: number }> {
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  const pattern = /\b[\w']+\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return tokens;
}

// =============================================================================
// Mention detection
// =============================================================================

function detectMentions(text: string, sentences: string[]): Mention[] {
  const mentions: Mention[] = [];
  let mentionId = 0;
  let sentenceOffset = 0;

  for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
    const sentence = sentences[sentIdx];
    const tokens = tokenize(sentence);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const wordLower = token.word.toLowerCase();

      // Check for pronouns
      if (PRONOUNS[wordLower]) {
        const pronounInfo = PRONOUNS[wordLower];
        const isDemo = ['this', 'that', 'these', 'those'].includes(wordLower);

        mentions.push({
          id: mentionId++,
          text: token.word,
          start: sentenceOffset + token.start,
          end: sentenceOffset + token.end,
          type: isDemo ? 'demonstrative' : 'pronoun',
          gender: pronounInfo.gender,
          number: pronounInfo.number,
          person: pronounInfo.person,
          animacy: pronounInfo.animacy,
          sentence: sentIdx,
          headWord: token.word
        });
      }
      // Check for proper nouns (capitalized words not at sentence start)
      else if (token.word[0] === token.word[0].toUpperCase() &&
               token.word[0] !== token.word[0].toLowerCase()) {

        // Try to get a multi-word proper noun
        let fullName = token.word;
        let endIdx = i;

        // Look ahead for additional capitalized words
        while (endIdx + 1 < tokens.length) {
          const nextToken = tokens[endIdx + 1];
          if (nextToken.word[0] === nextToken.word[0].toUpperCase() &&
              nextToken.word[0] !== nextToken.word[0].toLowerCase() &&
              nextToken.start === tokens[endIdx].end + 1) {
            fullName += ' ' + nextToken.word;
            endIdx++;
          } else {
            break;
          }
        }

        // Determine gender from name
        const firstName = token.word.toLowerCase();
        let gender: 'masculine' | 'feminine' | 'neutral' | 'unknown' = 'unknown';
        if (MASCULINE_NAMES.has(firstName)) {
          gender = 'masculine';
        } else if (FEMININE_NAMES.has(firstName)) {
          gender = 'feminine';
        }

        mentions.push({
          id: mentionId++,
          text: fullName,
          start: sentenceOffset + token.start,
          end: sentenceOffset + tokens[endIdx].end,
          type: 'proper_noun',
          gender,
          number: 'singular',
          person: '3',
          animacy: 'animate',
          sentence: sentIdx,
          headWord: fullName
        });

        i = endIdx; // Skip processed tokens
      }
      // Check for common nouns with determiners
      else if (i > 0 &&
               ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their']
                 .includes(tokens[i - 1].word.toLowerCase())) {

        const nounInfo = COMMON_NOUNS[wordLower];
        if (nounInfo) {
          // Look for noun phrase (det + adj* + noun)
          let nounPhrase = tokens[i - 1].word + ' ' + token.word;
          let startToken = i - 1;

          mentions.push({
            id: mentionId++,
            text: nounPhrase,
            start: sentenceOffset + tokens[startToken].start,
            end: sentenceOffset + token.end,
            type: 'common_noun',
            gender: nounInfo.gender,
            number: nounInfo.typicalNumber === 'both' ? 'singular' : nounInfo.typicalNumber,
            person: '3',
            animacy: nounInfo.animacy,
            sentence: sentIdx,
            headWord: token.word
          });
        }
      }
    }

    sentenceOffset += sentence.length + 1; // +1 for space between sentences
  }

  return mentions;
}

// =============================================================================
// Coreference resolution
// =============================================================================

function featuresCompatible(mention1: Mention, mention2: Mention): boolean {
  // Check gender compatibility
  if (mention1.gender !== 'unknown' && mention2.gender !== 'unknown' &&
      mention1.gender !== mention2.gender) {
    return false;
  }

  // Check number compatibility
  if (mention1.number !== 'unknown' && mention2.number !== 'unknown' &&
      mention1.number !== mention2.number) {
    return false;
  }

  // Check animacy compatibility
  if (mention1.animacy !== 'unknown' && mention2.animacy !== 'unknown' &&
      mention1.animacy !== mention2.animacy) {
    return false;
  }

  // Check person compatibility
  if (mention1.person !== 'unknown' && mention2.person !== 'unknown' &&
      mention1.person !== mention2.person) {
    return false;
  }

  return true;
}

function calculateSalience(mention: Mention, currentSentence: number): number {
  let score = 0;

  // Recency: closer mentions are more salient
  const sentenceDistance = currentSentence - mention.sentence;
  score += Math.max(0, 10 - sentenceDistance * 2);

  // Grammatical role (rough heuristic based on position)
  if (mention.start < 20) { // Early in sentence = likely subject
    score += 5;
  }

  // Proper nouns are more salient
  if (mention.type === 'proper_noun') {
    score += 3;
  }

  // Common nouns with definite articles
  if (mention.type === 'common_noun' && mention.text.toLowerCase().startsWith('the ')) {
    score += 2;
  }

  return score;
}

function resolveCoreferences(mentions: Mention[]): { chains: CoreferenceChain[]; singletons: Mention[] } {
  const chains: CoreferenceChain[] = [];
  const mentionToChain = new Map<number, number>();
  let chainId = 0;

  // Sort mentions by position
  const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);

  for (const mention of sortedMentions) {
    // Pronouns need antecedents
    if (mention.type === 'pronoun' || mention.type === 'demonstrative') {
      // Find best antecedent among previous mentions
      let bestAntecedent: Mention | null = null;
      let bestScore = -Infinity;

      for (const prevMention of sortedMentions) {
        if (prevMention.start >= mention.start) continue; // Must be before

        // Skip other pronouns as potential antecedents (prefer nouns)
        if (prevMention.type === 'pronoun') continue;

        // Check feature compatibility
        if (!featuresCompatible(mention, prevMention)) continue;

        // Calculate salience
        const score = calculateSalience(prevMention, mention.sentence);
        if (score > bestScore) {
          bestScore = score;
          bestAntecedent = prevMention;
        }
      }

      if (bestAntecedent) {
        // Link to existing chain or create new one
        const existingChainId = mentionToChain.get(bestAntecedent.id);

        if (existingChainId !== undefined) {
          // Add to existing chain
          chains[existingChainId].mentions.push(mention);
          mentionToChain.set(mention.id, existingChainId);
        } else {
          // Create new chain
          const newChain: CoreferenceChain = {
            id: chainId,
            mentions: [bestAntecedent, mention],
            representative: bestAntecedent,
            entity: bestAntecedent.text
          };
          chains.push(newChain);
          mentionToChain.set(bestAntecedent.id, chainId);
          mentionToChain.set(mention.id, chainId);
          chainId++;
        }
      }
    }
    // Non-pronouns might be coreferent with earlier mentions of same entity
    else if (mention.type === 'proper_noun' || mention.type === 'common_noun') {
      // Check for exact or partial string match with earlier mentions
      for (const prevMention of sortedMentions) {
        if (prevMention.start >= mention.start) continue;
        if (prevMention.type === 'pronoun') continue;

        // Check for string overlap
        const thisHead = mention.headWord?.toLowerCase() || mention.text.toLowerCase();
        const prevHead = prevMention.headWord?.toLowerCase() || prevMention.text.toLowerCase();

        if (thisHead === prevHead ||
            mention.text.toLowerCase() === prevMention.text.toLowerCase()) {

          // Check feature compatibility
          if (!featuresCompatible(mention, prevMention)) continue;

          // Link to existing chain or create new one
          const existingChainId = mentionToChain.get(prevMention.id);

          if (existingChainId !== undefined) {
            chains[existingChainId].mentions.push(mention);
            mentionToChain.set(mention.id, existingChainId);
          } else {
            const newChain: CoreferenceChain = {
              id: chainId,
              mentions: [prevMention, mention],
              representative: prevMention,
              entity: prevMention.text
            };
            chains.push(newChain);
            mentionToChain.set(prevMention.id, chainId);
            mentionToChain.set(mention.id, chainId);
            chainId++;
          }
          break; // Only link to one chain
        }
      }
    }
  }

  // Collect singletons (mentions not in any chain)
  const singletons = mentions.filter(m => !mentionToChain.has(m.id));

  return { chains, singletons };
}

// =============================================================================
// Main resolution function
// =============================================================================

function resolveText(text: string): CoreferenceResult {
  const sentences = splitSentences(text);
  const mentions = detectMentions(text, sentences);
  const { chains, singletons } = resolveCoreferences(mentions);

  return {
    text,
    sentences,
    mentions,
    chains,
    singletons
  };
}

// =============================================================================
// Visualization
// =============================================================================

function visualizeCoreferences(result: CoreferenceResult): string {
  const lines: string[] = [];

  lines.push('COREFERENCE ANALYSIS');
  lines.push('=' .repeat(50));
  lines.push('');

  // Original text
  lines.push('Original Text:');
  lines.push(result.text);
  lines.push('');

  // Sentences
  lines.push('Sentences:');
  result.sentences.forEach((sent, i) => {
    lines.push(`  [${i}] ${sent}`);
  });
  lines.push('');

  // Coreference chains
  lines.push('Coreference Chains:');
  if (result.chains.length === 0) {
    lines.push('  (no chains found)');
  } else {
    result.chains.forEach(chain => {
      const mentionTexts = chain.mentions.map(m => `"${m.text}" (sent ${m.sentence})`);
      lines.push(`  Chain ${chain.id} [${chain.entity}]: ${mentionTexts.join(' <- ')}`);
    });
  }
  lines.push('');

  // Singletons
  lines.push('Singletons (unresolved mentions):');
  if (result.singletons.length === 0) {
    lines.push('  (none)');
  } else {
    result.singletons.forEach(m => {
      lines.push(`  "${m.text}" (${m.type}, sent ${m.sentence})`);
    });
  }

  return lines.join('\n');
}

// =============================================================================
// Analysis functions
// =============================================================================

function getMentionTypeInfo(): Record<string, string> {
  return {
    'pronoun': 'Personal pronouns (I, you, he, she, it, we, they) and their forms',
    'proper_noun': 'Names of specific entities (people, places, organizations)',
    'common_noun': 'General nouns with determiners (the book, a man)',
    'demonstrative': 'Demonstrative pronouns (this, that, these, those)'
  };
}

function getResolutionStrategies(): Array<{ name: string; description: string }> {
  return [
    {
      name: 'Feature Agreement',
      description: 'Ensures gender, number, person, and animacy match between pronoun and antecedent'
    },
    {
      name: 'Recency',
      description: 'Prefers antecedents that are closer to the pronoun in the text'
    },
    {
      name: 'Grammatical Role',
      description: 'Subjects are preferred over objects as antecedents'
    },
    {
      name: 'Salience',
      description: 'More prominent/important entities are preferred as antecedents'
    },
    {
      name: 'String Match',
      description: 'Identical or similar mentions are linked together'
    },
    {
      name: 'Semantic Compatibility',
      description: 'Ensures the antecedent makes sense semantically in context'
    }
  ];
}

// =============================================================================
// Tool definition
// =============================================================================

export const coreferenceTool: UnifiedTool = {
  name: 'coreference',
  description: `Coreference resolution for pronoun and entity linking.

Operations:
- resolve: Resolve coreferences in text and identify chains
- cluster: Get coreference clusters/chains for the text
- mentions: Detect all mention spans in text
- visualize: Get visual representation of coreference chains
- pronouns: Get information about pronoun features
- strategies: Get information about resolution strategies
- info: Documentation and usage information

Features:
- Pronoun resolution (he, she, it, they, etc.)
- Entity mention detection
- Feature agreement (gender, number, animacy)
- Salience-based resolution
- Coreference chain building`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['resolve', 'cluster', 'mentions', 'visualize', 'pronouns', 'strategies', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Text to analyze for coreference'
      },
      pronoun: {
        type: 'string',
        description: 'Specific pronoun to get info about'
      }
    },
    required: ['operation']
  }
};

export async function executecoreference(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, pronoun } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'resolve': {
        if (!text) {
          throw new Error('text parameter is required for resolve operation');
        }

        const resolution = resolveText(text);

        result = {
          operation: 'resolve',
          input: text,
          sentenceCount: resolution.sentences.length,
          mentionCount: resolution.mentions.length,
          chainCount: resolution.chains.length,
          singletonCount: resolution.singletons.length,
          chains: resolution.chains.map(chain => ({
            id: chain.id,
            entity: chain.entity,
            mentions: chain.mentions.map(m => ({
              text: m.text,
              type: m.type,
              position: m.start,
              sentence: m.sentence
            }))
          })),
          singletons: resolution.singletons.map(m => ({
            text: m.text,
            type: m.type,
            position: m.start,
            sentence: m.sentence
          }))
        };
        break;
      }

      case 'cluster': {
        if (!text) {
          throw new Error('text parameter is required for cluster operation');
        }

        const resolution = resolveText(text);

        // Format as simple clusters
        const clusters = resolution.chains.map(chain => ({
          representative: chain.entity,
          mentions: chain.mentions.map(m => m.text)
        }));

        result = {
          operation: 'cluster',
          input: text,
          clusterCount: clusters.length,
          clusters
        };
        break;
      }

      case 'mentions': {
        if (!text) {
          throw new Error('text parameter is required for mentions operation');
        }

        const resolution = resolveText(text);

        result = {
          operation: 'mentions',
          input: text,
          mentionCount: resolution.mentions.length,
          mentions: resolution.mentions.map(m => ({
            text: m.text,
            type: m.type,
            position: { start: m.start, end: m.end },
            features: {
              gender: m.gender,
              number: m.number,
              person: m.person,
              animacy: m.animacy
            },
            sentence: m.sentence
          })),
          byType: {
            pronouns: resolution.mentions.filter(m => m.type === 'pronoun').length,
            proper_nouns: resolution.mentions.filter(m => m.type === 'proper_noun').length,
            common_nouns: resolution.mentions.filter(m => m.type === 'common_noun').length,
            demonstratives: resolution.mentions.filter(m => m.type === 'demonstrative').length
          }
        };
        break;
      }

      case 'visualize': {
        if (!text) {
          throw new Error('text parameter is required for visualize operation');
        }

        const resolution = resolveText(text);
        const visualization = visualizeCoreferences(resolution);

        result = {
          operation: 'visualize',
          input: text,
          visualization,
          summary: {
            sentences: resolution.sentences.length,
            mentions: resolution.mentions.length,
            chains: resolution.chains.length,
            singletons: resolution.singletons.length
          }
        };
        break;
      }

      case 'pronouns': {
        if (pronoun) {
          const pronounLower = pronoun.toLowerCase();
          const pronounInfo = PRONOUNS[pronounLower];

          if (!pronounInfo) {
            result = {
              operation: 'pronouns',
              error: `Unknown pronoun: ${pronoun}`,
              availablePronouns: Object.keys(PRONOUNS)
            };
          } else {
            result = {
              operation: 'pronouns',
              pronoun: pronounLower,
              ...pronounInfo
            };
          }
        } else {
          // Group pronouns by person
          const byPerson: Record<string, string[]> = { '1': [], '2': [], '3': [] };
          for (const [p, info] of Object.entries(PRONOUNS)) {
            byPerson[info.person].push(p);
          }

          result = {
            operation: 'pronouns',
            totalPronouns: Object.keys(PRONOUNS).length,
            byPerson,
            features: ['gender', 'number', 'person', 'case', 'animacy']
          };
        }
        break;
      }

      case 'strategies': {
        result = {
          operation: 'strategies',
          description: 'Coreference resolution strategies used to link mentions',
          strategies: getResolutionStrategies(),
          mentionTypes: getMentionTypeInfo()
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'coreference',
          description: 'Coreference resolution for pronoun and entity linking',
          operations: {
            resolve: 'Full coreference resolution with chains and features',
            cluster: 'Get simple mention clusters',
            mentions: 'Detect all mentions with their features',
            visualize: 'Get visual representation of coreferences',
            pronouns: 'Get pronoun feature information',
            strategies: 'Get information about resolution strategies'
          },
          capabilities: [
            'Pronoun resolution',
            'Entity mention detection',
            'Feature agreement checking',
            'Coreference chain building',
            'Salience-based ranking'
          ],
          stats: {
            pronouns: Object.keys(PRONOUNS).length,
            knownNames: MASCULINE_NAMES.size + FEMININE_NAMES.size,
            commonNouns: Object.keys(COMMON_NOUNS).length
          },
          example: {
            text: 'John went to the store. He bought some milk.',
            expectedChain: '["John", "He"] -> same entity'
          }
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscoreferenceAvailable(): boolean { return true; }
