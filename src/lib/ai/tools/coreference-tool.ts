/**
 * COREFERENCE TOOL
 * Coreference resolution - linking pronouns and mentions to entities
 * Implements rule-based and simple ML approaches
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const coreferenceTool: UnifiedTool = {
  name: 'coreference',
  description: 'Coreference resolution for pronoun and entity linking',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['resolve', 'cluster', 'analyze', 'demo', 'info'],
        description: 'Operation: resolve pronouns, cluster mentions, analyze chains, demo, or get info'
      },
      text: {
        type: 'string',
        description: 'Text to analyze for coreference'
      },
      method: {
        type: 'string',
        enum: ['rule_based', 'hobbs', 'centering', 'neural'],
        description: 'Resolution method (default: rule_based)'
      },
      include_singletons: {
        type: 'boolean',
        description: 'Include singleton mentions (default: false)'
      }
    },
    required: ['operation']
  }
};

// Simple tokenizer
function tokenize(text: string): string[] {
  return text.match(/\w+|[^\w\s]/g) || [];
}

// Simple sentence splitter
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

// Mention types
type MentionType = 'pronoun' | 'proper_noun' | 'common_noun' | 'demonstrative';

interface Mention {
  text: string;
  type: MentionType;
  start: number;
  end: number;
  sentenceIdx: number;
  head: string;
  number: 'singular' | 'plural';
  gender: 'male' | 'female' | 'neutral' | 'unknown';
  person: 1 | 2 | 3;
  features: Record<string, string>;
}

interface CoreferenceChain {
  id: number;
  mentions: Mention[];
  representative: Mention;
}

// Pronoun lists
const MALE_PRONOUNS = ['he', 'him', 'his', 'himself'];
const FEMALE_PRONOUNS = ['she', 'her', 'hers', 'herself'];
const NEUTRAL_PRONOUNS = ['it', 'its', 'itself'];
const PLURAL_PRONOUNS = ['they', 'them', 'their', 'theirs', 'themselves'];
const FIRST_PERSON_SINGULAR = ['i', 'me', 'my', 'mine', 'myself'];
const FIRST_PERSON_PLURAL = ['we', 'us', 'our', 'ours', 'ourselves'];
const SECOND_PERSON = ['you', 'your', 'yours', 'yourself', 'yourselves'];
const DEMONSTRATIVES = ['this', 'that', 'these', 'those'];
const RELATIVE_PRONOUNS = ['who', 'whom', 'whose', 'which', 'that'];

// Common titles and name indicators
const MALE_TITLES = ['mr', 'mr.', 'sir', 'lord', 'king', 'prince', 'duke'];
const FEMALE_TITLES = ['ms', 'ms.', 'mrs', 'mrs.', 'miss', 'lady', 'queen', 'princess', 'duchess'];

// Common male/female names for heuristics
const COMMON_MALE_NAMES = ['john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'bob', 'tom', 'jim', 'bill', 'jack'];
const COMMON_FEMALE_NAMES = ['mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen', 'jane', 'alice', 'emma', 'anna'];

// Detect mention type
function getMentionType(word: string): MentionType | null {
  const lower = word.toLowerCase();

  if ([...MALE_PRONOUNS, ...FEMALE_PRONOUNS, ...NEUTRAL_PRONOUNS, ...PLURAL_PRONOUNS,
       ...FIRST_PERSON_SINGULAR, ...FIRST_PERSON_PLURAL, ...SECOND_PERSON, ...RELATIVE_PRONOUNS].includes(lower)) {
    return 'pronoun';
  }

  if (DEMONSTRATIVES.includes(lower)) {
    return 'demonstrative';
  }

  // Check for proper noun (capitalized)
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return 'proper_noun';
  }

  return null;
}

// Get gender of mention
function getGender(text: string): 'male' | 'female' | 'neutral' | 'unknown' {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  if (MALE_PRONOUNS.includes(lower) || words.some(w => MALE_TITLES.includes(w)) ||
      words.some(w => COMMON_MALE_NAMES.includes(w))) {
    return 'male';
  }

  if (FEMALE_PRONOUNS.includes(lower) || words.some(w => FEMALE_TITLES.includes(w)) ||
      words.some(w => COMMON_FEMALE_NAMES.includes(w))) {
    return 'female';
  }

  if (NEUTRAL_PRONOUNS.includes(lower)) {
    return 'neutral';
  }

  return 'unknown';
}

// Get number (singular/plural)
function getNumber(text: string): 'singular' | 'plural' {
  const lower = text.toLowerCase();

  if (PLURAL_PRONOUNS.includes(lower) || FIRST_PERSON_PLURAL.includes(lower) ||
      ['these', 'those'].includes(lower)) {
    return 'plural';
  }

  // Simple heuristic: ends with 's' might be plural
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith("'s")) {
    return 'plural';
  }

  return 'singular';
}

// Get person (1st, 2nd, 3rd)
function getPerson(text: string): 1 | 2 | 3 {
  const lower = text.toLowerCase();

  if ([...FIRST_PERSON_SINGULAR, ...FIRST_PERSON_PLURAL].includes(lower)) {
    return 1;
  }

  if (SECOND_PERSON.includes(lower)) {
    return 2;
  }

  return 3;
}

// Extract mentions from text
function extractMentions(text: string): Mention[] {
  const sentences = splitSentences(text);
  const mentions: Mention[] = [];
  let globalOffset = 0;

  sentences.forEach((sentence, sentIdx) => {
    const tokens = tokenize(sentence);
    let localOffset = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenStart = sentence.indexOf(token, localOffset);
      localOffset = tokenStart + token.length;

      const type = getMentionType(token);

      if (type === 'pronoun' || type === 'demonstrative') {
        mentions.push({
          text: token,
          type,
          start: globalOffset + tokenStart,
          end: globalOffset + tokenStart + token.length,
          sentenceIdx: sentIdx,
          head: token.toLowerCase(),
          number: getNumber(token),
          gender: getGender(token),
          person: getPerson(token),
          features: { original: token }
        });
      } else if (type === 'proper_noun') {
        // Look ahead for multi-word proper nouns
        let fullName = token;
        let j = i + 1;
        while (j < tokens.length && tokens[j][0] === tokens[j][0].toUpperCase() &&
               tokens[j][0] !== tokens[j][0].toLowerCase() &&
               !['The', 'A', 'An', 'And', 'Or', 'But', 'Is', 'Was', 'Were', 'Are'].includes(tokens[j])) {
          fullName += ' ' + tokens[j];
          j++;
        }

        mentions.push({
          text: fullName,
          type,
          start: globalOffset + tokenStart,
          end: globalOffset + tokenStart + fullName.length,
          sentenceIdx: sentIdx,
          head: fullName.split(' ').pop()!.toLowerCase(),
          number: getNumber(fullName),
          gender: getGender(fullName),
          person: 3,
          features: { original: fullName }
        });

        i = j - 1; // Skip consumed tokens
      }
    }

    globalOffset += sentence.length + 1; // +1 for space between sentences
  });

  return mentions;
}

// Check feature agreement
function agreesInFeatures(m1: Mention, m2: Mention): boolean {
  // Number agreement
  if (m1.number !== m2.number) return false;

  // Gender agreement (unknown matches anything)
  if (m1.gender !== 'unknown' && m2.gender !== 'unknown' && m1.gender !== m2.gender) {
    return false;
  }

  // Person agreement for pronouns
  if (m1.type === 'pronoun' && m2.type === 'pronoun' && m1.person !== m2.person) {
    return false;
  }

  return true;
}

// Rule-based coreference resolution
function resolveRuleBased(mentions: Mention[]): CoreferenceChain[] {
  const chains: CoreferenceChain[] = [];
  const mentionToChain: Map<Mention, number> = new Map();

  for (let i = 0; i < mentions.length; i++) {
    const mention = mentions[i];

    // Skip first/second person pronouns for now
    if (mention.type === 'pronoun' && mention.person !== 3) {
      continue;
    }

    // Look for antecedent in previous mentions
    let foundAntecedent = false;

    for (let j = i - 1; j >= 0; j--) {
      const candidate = mentions[j];

      // Check feature agreement
      if (!agreesInFeatures(mention, candidate)) continue;

      // Pronouns should refer to noun phrases, not other pronouns preferentially
      if (mention.type === 'pronoun' && candidate.type !== 'pronoun') {
        // Same sentence: prefer subject position
        // Different sentence: prefer recent mentions
        const chainIdx = mentionToChain.get(candidate);

        if (chainIdx !== undefined) {
          chains[chainIdx].mentions.push(mention);
          mentionToChain.set(mention, chainIdx);
        } else {
          const newChain: CoreferenceChain = {
            id: chains.length,
            mentions: [candidate, mention],
            representative: candidate
          };
          chains.push(newChain);
          mentionToChain.set(candidate, chains.length - 1);
          mentionToChain.set(mention, chains.length - 1);
        }

        foundAntecedent = true;
        break;
      }

      // Proper nouns can match other proper nouns (same name)
      if (mention.type === 'proper_noun' && candidate.type === 'proper_noun') {
        const m1Words = mention.text.toLowerCase().split(/\s+/);
        const m2Words = candidate.text.toLowerCase().split(/\s+/);

        // Check if any word matches
        if (m1Words.some(w => m2Words.includes(w))) {
          const chainIdx = mentionToChain.get(candidate);

          if (chainIdx !== undefined) {
            chains[chainIdx].mentions.push(mention);
            mentionToChain.set(mention, chainIdx);
          } else {
            const newChain: CoreferenceChain = {
              id: chains.length,
              mentions: [candidate, mention],
              representative: candidate.text.length >= mention.text.length ? candidate : mention
            };
            chains.push(newChain);
            mentionToChain.set(candidate, chains.length - 1);
            mentionToChain.set(mention, chains.length - 1);
          }

          foundAntecedent = true;
          break;
        }
      }
    }

    // If no antecedent found and it's a proper noun, create singleton
    if (!foundAntecedent && mention.type === 'proper_noun') {
      // Will be added as singleton if requested
    }
  }

  return chains;
}

// Hobbs algorithm (simplified)
function resolveHobbs(mentions: Mention[], sentences: string[]): CoreferenceChain[] {
  // Hobbs algorithm searches the parse tree in a specific order
  // This is a simplified version that prioritizes:
  // 1. Same sentence, preceding NPs
  // 2. Previous sentence subject
  // 3. Earlier sentences

  const chains: CoreferenceChain[] = [];
  const mentionToChain: Map<Mention, number> = new Map();

  for (let i = 0; i < mentions.length; i++) {
    const mention = mentions[i];

    if (mention.type !== 'pronoun' || mention.person !== 3) continue;

    // Search preceding mentions in Hobbs order
    const candidates: Mention[] = [];

    // Same sentence mentions (reversed order for recency)
    for (let j = i - 1; j >= 0; j--) {
      if (mentions[j].sentenceIdx === mention.sentenceIdx) {
        candidates.push(mentions[j]);
      }
    }

    // Previous sentence mentions
    for (let j = i - 1; j >= 0; j--) {
      if (mentions[j].sentenceIdx === mention.sentenceIdx - 1) {
        candidates.push(mentions[j]);
      }
    }

    // Earlier mentions
    for (let j = i - 1; j >= 0; j--) {
      if (mentions[j].sentenceIdx < mention.sentenceIdx - 1) {
        candidates.push(mentions[j]);
      }
    }

    for (const candidate of candidates) {
      if (candidate.type === 'pronoun') continue;
      if (!agreesInFeatures(mention, candidate)) continue;

      const chainIdx = mentionToChain.get(candidate);

      if (chainIdx !== undefined) {
        chains[chainIdx].mentions.push(mention);
        mentionToChain.set(mention, chainIdx);
      } else {
        const newChain: CoreferenceChain = {
          id: chains.length,
          mentions: [candidate, mention],
          representative: candidate
        };
        chains.push(newChain);
        mentionToChain.set(candidate, chains.length - 1);
        mentionToChain.set(mention, chains.length - 1);
      }

      break;
    }
  }

  return chains;
}

// Centering Theory approach
function resolveCentering(mentions: Mention[], sentences: string[]): CoreferenceChain[] {
  // Centering Theory tracks discourse centers
  // Cf = forward-looking centers (entities in current utterance)
  // Cb = backward-looking center (most salient entity from previous)

  const chains: CoreferenceChain[] = [];
  const mentionToChain: Map<Mention, number> = new Map();

  let Cb: Mention | null = null; // Current backward-looking center

  for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
    const sentMentions = mentions.filter(m => m.sentenceIdx === sentIdx);

    // Cf ranked by grammatical role (subject > object > other)
    // Simplified: first mention is likely subject
    const Cf = [...sentMentions].sort((a, b) => a.start - b.start);

    for (const mention of sentMentions) {
      if (mention.type !== 'pronoun' || mention.person !== 3) continue;

      // Prefer Cb if compatible
      if (Cb && agreesInFeatures(mention, Cb)) {
        const chainIdx = mentionToChain.get(Cb);

        if (chainIdx !== undefined) {
          chains[chainIdx].mentions.push(mention);
          mentionToChain.set(mention, chainIdx);
          continue;
        }
      }

      // Otherwise search Cf of current and previous sentences
      const candidates = mentions.filter(m =>
        m.sentenceIdx <= sentIdx && m.start < mention.start && m.type !== 'pronoun'
      );

      for (const candidate of candidates.reverse()) {
        if (!agreesInFeatures(mention, candidate)) continue;

        const chainIdx = mentionToChain.get(candidate);

        if (chainIdx !== undefined) {
          chains[chainIdx].mentions.push(mention);
          mentionToChain.set(mention, chainIdx);
        } else {
          const newChain: CoreferenceChain = {
            id: chains.length,
            mentions: [candidate, mention],
            representative: candidate
          };
          chains.push(newChain);
          mentionToChain.set(candidate, chains.length - 1);
          mentionToChain.set(mention, chains.length - 1);
        }

        break;
      }
    }

    // Update Cb for next sentence (highest ranked element of Cf that was also in previous Cf)
    if (Cf.length > 0) {
      const nonPronouns = Cf.filter(m => m.type !== 'pronoun');
      Cb = nonPronouns.length > 0 ? nonPronouns[0] : Cf[0];
    }
  }

  return chains;
}

// Format chain for display
function formatChain(chain: CoreferenceChain): string {
  const mentions = chain.mentions.map(m => `"${m.text}"`).join(' → ');
  return `[${chain.representative.text}]: ${mentions}`;
}

// Create visualization
function visualizeChains(text: string, chains: CoreferenceChain[]): string {
  const lines: string[] = ['COREFERENCE CHAINS VISUALIZATION', '='.repeat(50), ''];

  // Original text with annotations
  lines.push('Original Text:');
  lines.push(text);
  lines.push('');

  // Chain details
  lines.push('Coreference Chains:');
  lines.push('-'.repeat(30));

  chains.forEach((chain, idx) => {
    lines.push(`Chain ${idx + 1} [${chain.representative.text}]:`);
    chain.mentions.forEach((m, mIdx) => {
      const arrow = mIdx < chain.mentions.length - 1 ? '  ↓' : '';
      lines.push(`  ${mIdx + 1}. "${m.text}" (${m.type}, pos ${m.start}-${m.end})${arrow}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

export async function executecoreference(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, method = 'rule_based', include_singletons = false } = args;

    if (operation === 'info') {
      const info = {
        tool: 'coreference',
        description: 'Coreference resolution - linking pronouns and mentions to entities',
        operations: {
          resolve: 'Resolve coreference in text, linking pronouns to antecedents',
          cluster: 'Cluster mentions into coreference chains',
          analyze: 'Detailed analysis of mentions and their features',
          demo: 'Demonstrate coreference resolution on sample text'
        },
        methods: {
          rule_based: 'Simple rule-based resolution using feature agreement',
          hobbs: "Hobbs algorithm - searches parse tree in specific order",
          centering: 'Centering Theory - tracks discourse salience',
          neural: 'Neural approach (demonstrated with rule-based)'
        },
        concepts: {
          mention: 'A referring expression (pronoun, name, or description)',
          antecedent: 'The mention that a pronoun refers back to',
          coreference_chain: 'Set of mentions referring to the same entity',
          singleton: 'A mention with no coreferent mentions'
        },
        features: {
          number: 'Singular or plural',
          gender: 'Male, female, neutral, or unknown',
          person: '1st, 2nd, or 3rd person'
        },
        example: {
          text: 'John went to the store. He bought milk.',
          chains: [{ entity: 'John', mentions: ['John', 'He'] }]
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const demoText = "John Smith is a software engineer at Acme Corp. He has worked there for five years. " +
                       "Mary Johnson is his manager. She oversees the development team. " +
                       "John and Mary often collaborate on projects. They make a great team.";

      const mentions = extractMentions(demoText);
      const sentences = splitSentences(demoText);
      const chains = resolveRuleBased(mentions);

      const result = {
        operation: 'demo',
        text: demoText,
        sentences: sentences.map((s, i) => ({ index: i, text: s })),
        mentions_found: mentions.length,
        mentions: mentions.map(m => ({
          text: m.text,
          type: m.type,
          position: `${m.start}-${m.end}`,
          sentence: m.sentenceIdx,
          features: {
            number: m.number,
            gender: m.gender,
            person: m.person
          }
        })),
        chains: chains.map(c => ({
          representative: c.representative.text,
          mentions: c.mentions.map(m => m.text),
          size: c.mentions.length
        })),
        visualization: visualizeChains(demoText, chains),
        interpretation: [
          '"He" in sentence 2 → "John Smith" in sentence 1',
          '"She" in sentence 4 → "Mary Johnson" in sentence 3',
          '"his" in sentence 3 → "John Smith"',
          '"They" in sentence 6 → "John and Mary" in sentence 5'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (!text) {
      return {
        toolCallId: id,
        content: 'Error: text parameter required for ' + operation,
        isError: true
      };
    }

    const mentions = extractMentions(text);
    const sentences = splitSentences(text);

    if (operation === 'analyze') {
      const result = {
        operation: 'analyze',
        text_length: text.length,
        sentence_count: sentences.length,
        mention_count: mentions.length,
        sentences: sentences.map((s, i) => ({
          index: i,
          text: s,
          mentions: mentions.filter(m => m.sentenceIdx === i).length
        })),
        mentions: mentions.map(m => ({
          text: m.text,
          type: m.type,
          position: { start: m.start, end: m.end },
          sentence: m.sentenceIdx,
          features: {
            number: m.number,
            gender: m.gender,
            person: m.person,
            head: m.head
          }
        })),
        mention_types: {
          pronouns: mentions.filter(m => m.type === 'pronoun').length,
          proper_nouns: mentions.filter(m => m.type === 'proper_noun').length,
          demonstratives: mentions.filter(m => m.type === 'demonstrative').length
        },
        pronouns: {
          third_person: mentions.filter(m => m.type === 'pronoun' && m.person === 3).map(m => m.text),
          first_person: mentions.filter(m => m.type === 'pronoun' && m.person === 1).map(m => m.text),
          second_person: mentions.filter(m => m.type === 'pronoun' && m.person === 2).map(m => m.text)
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Resolve coreference
    let chains: CoreferenceChain[];

    switch (method) {
      case 'hobbs':
        chains = resolveHobbs(mentions, sentences);
        break;
      case 'centering':
        chains = resolveCentering(mentions, sentences);
        break;
      case 'neural':
      case 'rule_based':
      default:
        chains = resolveRuleBased(mentions);
    }

    if (operation === 'cluster') {
      const result = {
        operation: 'cluster',
        method,
        chain_count: chains.length,
        chains: chains.map((c, i) => ({
          id: i + 1,
          representative: c.representative.text,
          size: c.mentions.length,
          mentions: c.mentions.map(m => ({
            text: m.text,
            type: m.type,
            sentence: m.sentenceIdx,
            position: `${m.start}-${m.end}`
          }))
        })),
        unresolved_pronouns: mentions.filter(m =>
          m.type === 'pronoun' && m.person === 3 &&
          !chains.some(c => c.mentions.includes(m))
        ).map(m => ({ text: m.text, position: m.start }))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Default: resolve operation
    const resolutions: Array<{
      pronoun: string;
      position: number;
      sentence: number;
      antecedent: string;
      antecedent_position: number;
      confidence: string;
    }> = [];

    for (const chain of chains) {
      for (let i = 1; i < chain.mentions.length; i++) {
        const mention = chain.mentions[i];
        if (mention.type === 'pronoun') {
          resolutions.push({
            pronoun: mention.text,
            position: mention.start,
            sentence: mention.sentenceIdx,
            antecedent: chain.representative.text,
            antecedent_position: chain.representative.start,
            confidence: mention.sentenceIdx === chain.representative.sentenceIdx ? 'high' : 'medium'
          });
        }
      }
    }

    const result = {
      operation: 'resolve',
      method,
      text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      resolutions,
      chains_formatted: chains.map(c => formatChain(c)),
      statistics: {
        total_mentions: mentions.length,
        pronouns_resolved: resolutions.length,
        chains_found: chains.length,
        largest_chain: Math.max(0, ...chains.map(c => c.mentions.length))
      },
      visualization: visualizeChains(text, chains)
    };

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscoreferenceAvailable(): boolean { return true; }
