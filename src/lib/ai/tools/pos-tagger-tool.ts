/**
 * POS-TAGGER TOOL
 * Part-of-speech tagging with rule-based and statistical approaches
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const postaggerTool: UnifiedTool = {
  name: 'pos_tagger',
  description: 'Part-of-speech tagging for natural language',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['tag', 'analyze', 'parse_sentence', 'info'], description: 'Operation' },
      text: { type: 'string', description: 'Text to tag' },
      tagset: { type: 'string', enum: ['penn', 'universal'], description: 'Tag set to use' }
    },
    required: ['operation']
  }
};

// Penn Treebank POS tags
const PENN_TAGS: { [key: string]: string } = {
  'CC': 'Coordinating conjunction',
  'CD': 'Cardinal number',
  'DT': 'Determiner',
  'EX': 'Existential there',
  'FW': 'Foreign word',
  'IN': 'Preposition or subordinating conjunction',
  'JJ': 'Adjective',
  'JJR': 'Adjective, comparative',
  'JJS': 'Adjective, superlative',
  'LS': 'List item marker',
  'MD': 'Modal',
  'NN': 'Noun, singular or mass',
  'NNS': 'Noun, plural',
  'NNP': 'Proper noun, singular',
  'NNPS': 'Proper noun, plural',
  'PDT': 'Predeterminer',
  'POS': 'Possessive ending',
  'PRP': 'Personal pronoun',
  'PRP$': 'Possessive pronoun',
  'RB': 'Adverb',
  'RBR': 'Adverb, comparative',
  'RBS': 'Adverb, superlative',
  'RP': 'Particle',
  'SYM': 'Symbol',
  'TO': 'to',
  'UH': 'Interjection',
  'VB': 'Verb, base form',
  'VBD': 'Verb, past tense',
  'VBG': 'Verb, gerund or present participle',
  'VBN': 'Verb, past participle',
  'VBP': 'Verb, non-3rd person singular present',
  'VBZ': 'Verb, 3rd person singular present',
  'WDT': 'Wh-determiner',
  'WP': 'Wh-pronoun',
  'WP$': 'Possessive wh-pronoun',
  'WRB': 'Wh-adverb',
  '.': 'Punctuation',
  ',': 'Comma',
  ':': 'Colon/semicolon',
  '(': 'Left bracket',
  ')': 'Right bracket',
  '"': 'Quote'
};

// Universal POS tags
const UNIVERSAL_TAGS: { [key: string]: string } = {
  'ADJ': 'Adjective',
  'ADP': 'Adposition',
  'ADV': 'Adverb',
  'AUX': 'Auxiliary',
  'CCONJ': 'Coordinating conjunction',
  'DET': 'Determiner',
  'INTJ': 'Interjection',
  'NOUN': 'Noun',
  'NUM': 'Numeral',
  'PART': 'Particle',
  'PRON': 'Pronoun',
  'PROPN': 'Proper noun',
  'PUNCT': 'Punctuation',
  'SCONJ': 'Subordinating conjunction',
  'SYM': 'Symbol',
  'VERB': 'Verb',
  'X': 'Other'
};

// Penn to Universal mapping
const PENN_TO_UNIVERSAL: { [key: string]: string } = {
  'CC': 'CCONJ', 'CD': 'NUM', 'DT': 'DET', 'EX': 'PRON',
  'FW': 'X', 'IN': 'ADP', 'JJ': 'ADJ', 'JJR': 'ADJ',
  'JJS': 'ADJ', 'MD': 'AUX', 'NN': 'NOUN', 'NNS': 'NOUN',
  'NNP': 'PROPN', 'NNPS': 'PROPN', 'PDT': 'DET', 'POS': 'PART',
  'PRP': 'PRON', 'PRP$': 'PRON', 'RB': 'ADV', 'RBR': 'ADV',
  'RBS': 'ADV', 'RP': 'PART', 'TO': 'PART', 'UH': 'INTJ',
  'VB': 'VERB', 'VBD': 'VERB', 'VBG': 'VERB', 'VBN': 'VERB',
  'VBP': 'VERB', 'VBZ': 'VERB', 'WDT': 'DET', 'WP': 'PRON',
  'WP$': 'PRON', 'WRB': 'ADV', '.': 'PUNCT', ',': 'PUNCT',
  ':': 'PUNCT', '(': 'PUNCT', ')': 'PUNCT', '"': 'PUNCT'
};

// Word lists for rule-based tagging
const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'all', 'both', 'few', 'many', 'much', 'most']);
const PREPOSITIONS = new Set(['in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over', 'out', 'up', 'down', 'off', 'across', 'behind', 'beside', 'near', 'toward', 'upon', 'within', 'without', 'along', 'among', 'around', 'against', 'until', 'since', 'beyond', 'except']);
const CONJUNCTIONS = new Set(['and', 'or', 'but', 'nor', 'yet', 'so', 'for', 'because', 'although', 'while', 'if', 'when', 'where', 'that', 'which', 'who', 'whom', 'whose', 'whether', 'unless', 'until', 'since', 'as', 'than', 'though', 'whereas', 'whenever', 'wherever', 'however']);
const PRONOUNS = new Set(['i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'who', 'whom', 'whose', 'which', 'what', 'this', 'that', 'these', 'those', 'one', 'ones', 'someone', 'anyone', 'everyone', 'no one', 'nobody', 'somebody', 'anybody', 'everybody', 'something', 'anything', 'everything', 'nothing']);
const MODALS = new Set(['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would']);
const BE_VERBS = new Set(['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being']);
const HAVE_VERBS = new Set(['have', 'has', 'had', 'having']);
const DO_VERBS = new Set(['do', 'does', 'did', 'doing', 'done']);

// Common word -> tag mappings
const COMMON_WORDS: { [key: string]: string } = {
  'the': 'DT', 'a': 'DT', 'an': 'DT',
  'is': 'VBZ', 'are': 'VBP', 'was': 'VBD', 'were': 'VBD', 'be': 'VB', 'been': 'VBN', 'being': 'VBG', 'am': 'VBP',
  'has': 'VBZ', 'have': 'VBP', 'had': 'VBD', 'having': 'VBG',
  'do': 'VBP', 'does': 'VBZ', 'did': 'VBD', 'doing': 'VBG', 'done': 'VBN',
  'will': 'MD', 'would': 'MD', 'could': 'MD', 'should': 'MD', 'may': 'MD', 'might': 'MD', 'must': 'MD', 'can': 'MD',
  'not': 'RB', 'very': 'RB', 'also': 'RB', 'just': 'RB', 'only': 'RB', 'even': 'RB', 'still': 'RB', 'already': 'RB',
  'to': 'TO',
  'and': 'CC', 'or': 'CC', 'but': 'CC', 'nor': 'CC', 'yet': 'CC', 'so': 'CC',
  'i': 'PRP', 'you': 'PRP', 'he': 'PRP', 'she': 'PRP', 'it': 'PRP', 'we': 'PRP', 'they': 'PRP',
  'me': 'PRP', 'him': 'PRP', 'her': 'PRP', 'us': 'PRP', 'them': 'PRP',
  'there': 'EX', 'here': 'RB',
  'this': 'DT', 'that': 'DT', 'these': 'DT', 'those': 'DT',
  'what': 'WP', 'which': 'WDT', 'who': 'WP', 'whom': 'WP', 'whose': 'WP$',
  'when': 'WRB', 'where': 'WRB', 'why': 'WRB', 'how': 'WRB'
};

// Tokenize text
function tokenize(text: string): string[] {
  // Simple tokenization - split on whitespace and punctuation
  const tokens: string[] = [];
  const pattern = /([a-zA-Z]+(?:'[a-zA-Z]+)?|[0-9]+(?:\.[0-9]+)?|[.,!?;:'"\(\)\[\]{}])/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

// Rule-based POS tagger
function tagWord(word: string, prevTag: string, prevWord: string): string {
  const lower = word.toLowerCase();

  // Check common words first
  if (COMMON_WORDS[lower]) {
    return COMMON_WORDS[lower];
  }

  // Punctuation
  if (/^[.,!?;:]$/.test(word)) return '.';
  if (/^["'`]$/.test(word)) return '"';
  if (/^[\(\[\{]$/.test(word)) return '(';
  if (/^[\)\]\}]$/.test(word)) return ')';

  // Numbers
  if (/^[0-9]+(\.[0-9]+)?$/.test(word)) return 'CD';
  if (/^(first|second|third|[0-9]+(st|nd|rd|th))$/i.test(word)) return 'JJ';

  // Determiners
  if (DETERMINERS.has(lower)) return 'DT';

  // Prepositions
  if (PREPOSITIONS.has(lower)) return 'IN';

  // Pronouns
  if (PRONOUNS.has(lower)) return 'PRP';

  // Modals
  if (MODALS.has(lower)) return 'MD';

  // Morphological rules
  if (/ing$/.test(lower)) {
    // Could be VBG or NN (gerund)
    return prevTag === 'VBZ' || prevTag === 'VBP' || prevTag === 'VBD' || prevTag === 'MD' || prevTag === 'TO' ? 'VBG' : 'NN';
  }
  if (/ed$/.test(lower)) {
    // Could be VBD or VBN
    return prevTag === 'MD' || prevTag === 'VBP' || prevTag === 'VBZ' || prevTag === 'TO' ? 'VBN' : 'VBD';
  }
  if (/ly$/.test(lower) && lower.length > 3) return 'RB';
  if (/ness$/.test(lower)) return 'NN';
  if (/ment$/.test(lower)) return 'NN';
  if (/tion$/.test(lower) || /sion$/.test(lower)) return 'NN';
  if (/ful$/.test(lower) || /less$/.test(lower) || /ous$/.test(lower) || /ive$/.test(lower) || /able$/.test(lower) || /ible$/.test(lower)) return 'JJ';
  if (/er$/.test(lower) && lower.length > 3) {
    // Could be JJR or NN
    if (prevTag === 'RB' || prevTag === 'RBR') return 'JJR';
    return 'NN';
  }
  if (/est$/.test(lower) && lower.length > 4) return 'JJS';
  if (/s$/.test(lower) && !/ss$/.test(lower)) {
    // Could be NNS or VBZ
    if (prevTag === 'DT' || prevTag === 'JJ' || prevTag === 'CD' || prevTag === 'PRP$') return 'NNS';
    if (prevTag === 'NNP' || prevTag === 'PRP') return 'VBZ';
    return 'NNS';
  }

  // Capitalized words (not at start)
  if (/^[A-Z]/.test(word) && prevTag !== '' && prevTag !== '.') return 'NNP';

  // After determiner, likely noun
  if (prevTag === 'DT' || prevTag === 'PRP$') return 'NN';

  // After preposition, likely noun
  if (prevTag === 'IN') return 'NN';

  // After adjective, likely noun
  if (prevTag === 'JJ') return 'NN';

  // After modal or 'to', likely verb base form
  if (prevTag === 'MD' || prevTag === 'TO') return 'VB';

  // After noun, could be verb or another noun
  if (prevTag === 'NN' || prevTag === 'NNS' || prevTag === 'NNP') return 'VBZ';

  // Default to noun
  return 'NN';
}

// Tag a sentence
function tagSentence(text: string): { word: string; tag: string; description: string }[] {
  const tokens = tokenize(text);
  const result: { word: string; tag: string; description: string }[] = [];

  let prevTag = '';
  let prevWord = '';

  for (const token of tokens) {
    const tag = tagWord(token, prevTag, prevWord);
    result.push({
      word: token,
      tag,
      description: PENN_TAGS[tag] || 'Unknown'
    });
    prevTag = tag;
    prevWord = token;
  }

  return result;
}

// Convert to Universal tags
function toUniversal(pennTag: string): string {
  return PENN_TO_UNIVERSAL[pennTag] || 'X';
}

// Analyze POS distribution
function analyzePOS(tagged: { word: string; tag: string }[]): {
  distribution: { [tag: string]: number };
  patterns: string[];
  nounPhrases: string[][];
  verbPhrases: string[][];
} {
  const distribution: { [tag: string]: number } = {};

  for (const { tag } of tagged) {
    distribution[tag] = (distribution[tag] || 0) + 1;
  }

  // Extract noun phrases (DT? JJ* NN+)
  const nounPhrases: string[][] = [];
  let currentNP: string[] = [];
  let inNP = false;

  for (const { word, tag } of tagged) {
    if (tag === 'DT' || tag === 'PRP$') {
      if (inNP && currentNP.length > 0) nounPhrases.push(currentNP);
      currentNP = [word];
      inNP = true;
    } else if ((tag === 'JJ' || tag === 'JJR' || tag === 'JJS') && inNP) {
      currentNP.push(word);
    } else if ((tag === 'NN' || tag === 'NNS' || tag === 'NNP' || tag === 'NNPS')) {
      if (!inNP) {
        currentNP = [];
        inNP = true;
      }
      currentNP.push(word);
    } else {
      if (inNP && currentNP.length > 0 && currentNP.some(w => ['NN', 'NNS', 'NNP', 'NNPS'].includes(tagged.find(t => t.word === w)?.tag || ''))) {
        nounPhrases.push(currentNP);
      }
      currentNP = [];
      inNP = false;
    }
  }
  if (inNP && currentNP.length > 0) nounPhrases.push(currentNP);

  // Extract verb phrases (MD? VB*)
  const verbPhrases: string[][] = [];
  let currentVP: string[] = [];
  let inVP = false;

  for (const { word, tag } of tagged) {
    if (tag === 'MD' || tag.startsWith('VB')) {
      if (!inVP) currentVP = [];
      currentVP.push(word);
      inVP = true;
    } else if (inVP && (tag === 'RB' || tag === 'TO')) {
      currentVP.push(word);
    } else {
      if (inVP && currentVP.length > 0) verbPhrases.push(currentVP);
      currentVP = [];
      inVP = false;
    }
  }
  if (inVP && currentVP.length > 0) verbPhrases.push(currentVP);

  // Find common patterns
  const tagSequence = tagged.map(t => t.tag).join(' ');
  const patterns: string[] = [];
  if (/DT JJ NN/.test(tagSequence)) patterns.push('DT JJ NN (determiner + adjective + noun)');
  if (/PRP VB/.test(tagSequence)) patterns.push('PRP VB (pronoun + verb)');
  if (/NN VBZ/.test(tagSequence)) patterns.push('NN VBZ (noun + verb)');
  if (/MD VB/.test(tagSequence)) patterns.push('MD VB (modal + verb)');
  if (/VB IN NN/.test(tagSequence)) patterns.push('VB IN NN (verb + prep + noun)');

  return { distribution, patterns, nounPhrases, verbPhrases };
}

export async function executepostagger(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'pos-tagger',
        description: 'Part-of-speech tagging assigns grammatical categories to words',

        tagsets: {
          penn: {
            name: 'Penn Treebank',
            description: 'Fine-grained tagset with 36+ tags',
            examples: PENN_TAGS
          },
          universal: {
            name: 'Universal Dependencies',
            description: 'Coarse-grained tagset with 17 tags',
            examples: UNIVERSAL_TAGS
          }
        },

        methodology: {
          rulebased: 'Uses morphological patterns and context rules',
          statistical: 'Hidden Markov Models, Maximum Entropy',
          neural: 'BiLSTM, Transformers for state-of-the-art accuracy'
        },

        applications: [
          'Syntactic parsing',
          'Named entity recognition',
          'Information extraction',
          'Machine translation',
          'Text-to-speech',
          'Grammar checking'
        ],

        accuracy: {
          note: 'State-of-the-art taggers achieve ~97% accuracy on standard benchmarks',
          challenges: ['Unknown words', 'Ambiguous words', 'Domain adaptation']
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    const text = args.text || 'The quick brown fox jumps over the lazy dog.';
    const tagset = args.tagset || 'penn';

    if (operation === 'tag') {
      const tagged = tagSentence(text);

      // Convert to universal if requested
      const result = tagset === 'universal'
        ? tagged.map(t => ({
            word: t.word,
            tag: toUniversal(t.tag),
            pennTag: t.tag,
            description: UNIVERSAL_TAGS[toUniversal(t.tag)] || 'Unknown'
          }))
        : tagged;

      // Format as table
      const table = ['Word'.padEnd(15) + 'Tag'.padEnd(8) + 'Description'];
      table.push('-'.repeat(50));
      for (const item of result) {
        table.push(
          item.word.padEnd(15) +
          item.tag.padEnd(8) +
          ((item as any).description || '')
        );
      }

      const output = {
        text,
        tagset,
        tokenCount: tagged.length,

        tagged: result,

        formattedOutput: table.join('\n'),

        tagSequence: result.map(t => t.tag).join(' '),

        summary: {
          nouns: tagged.filter(t => t.tag.startsWith('NN')).length,
          verbs: tagged.filter(t => t.tag.startsWith('VB') || t.tag === 'MD').length,
          adjectives: tagged.filter(t => t.tag.startsWith('JJ')).length,
          adverbs: tagged.filter(t => t.tag.startsWith('RB')).length,
          punctuation: tagged.filter(t => t.tag === '.' || t.tag === ',' || t.tag === '"').length
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'analyze') {
      const tagged = tagSentence(text);
      const analysis = analyzePOS(tagged);

      // Sort distribution
      const sortedDist = Object.entries(analysis.distribution)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({
          tag,
          count,
          percentage: ((count / tagged.length) * 100).toFixed(1) + '%',
          description: PENN_TAGS[tag] || 'Unknown'
        }));

      const output = {
        text,
        tokenCount: tagged.length,

        distribution: sortedDist,

        phrases: {
          nounPhrases: analysis.nounPhrases.slice(0, 5).map(np => np.join(' ')),
          verbPhrases: analysis.verbPhrases.slice(0, 5).map(vp => vp.join(' '))
        },

        patterns: analysis.patterns,

        linguisticAnalysis: {
          sentenceType: tagged.some(t => t.tag === 'WP' || t.tag === 'WRB')
            ? 'Interrogative'
            : tagged.some(t => t.tag === 'MD' && tagged[0]?.tag === 'MD')
            ? 'Imperative/Modal'
            : 'Declarative',
          complexity: tagged.filter(t => t.tag === 'IN' || t.tag === 'CC').length > 2
            ? 'Complex (multiple clauses)'
            : 'Simple',
          contentWords: tagged.filter(t =>
            t.tag.startsWith('NN') || t.tag.startsWith('VB') ||
            t.tag.startsWith('JJ') || t.tag.startsWith('RB')
          ).length,
          functionWords: tagged.filter(t =>
            t.tag === 'DT' || t.tag === 'IN' || t.tag === 'CC' ||
            t.tag === 'TO' || t.tag === 'MD'
          ).length
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'parse_sentence') {
      const tagged = tagSentence(text);
      const analysis = analyzePOS(tagged);

      // Simple constituency-like breakdown
      const constituents: string[] = [];

      // Find subject (NP before main verb)
      const firstVerbIdx = tagged.findIndex(t => t.tag.startsWith('VB') || t.tag === 'MD');
      if (firstVerbIdx > 0) {
        const subject = tagged.slice(0, firstVerbIdx).map(t => t.word).join(' ');
        constituents.push(`Subject: [${subject}]`);
      }

      // Find predicate
      if (firstVerbIdx >= 0) {
        const predicate = tagged.slice(firstVerbIdx).map(t => t.word).join(' ');
        constituents.push(`Predicate: [${predicate}]`);
      }

      const output = {
        text,

        posTagged: tagged.map(t => `${t.word}/${t.tag}`).join(' '),

        constituents,

        nounPhrases: analysis.nounPhrases.map(np => `[NP ${np.join(' ')}]`),
        verbPhrases: analysis.verbPhrases.map(vp => `[VP ${vp.join(' ')}]`),

        dependencyHint: {
          note: 'Full dependency parsing requires more sophisticated analysis',
          rootVerb: tagged.find(t => t.tag.startsWith('VB'))?.word || 'N/A'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispostaggerAvailable(): boolean { return true; }
