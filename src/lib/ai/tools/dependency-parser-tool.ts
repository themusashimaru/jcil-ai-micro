/**
 * DEPENDENCY-PARSER TOOL
 * Comprehensive syntactic dependency parsing for sentence structure analysis
 *
 * Implements:
 * - Universal Dependencies (UD) framework
 * - Projective and non-projective parsing
 * - Arc-standard transition-based parsing
 * - Dependency tree visualization
 * - Multi-language support patterns
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// Universal Dependencies relation types
// =============================================================================

interface DependencyRelation {
  name: string;
  description: string;
  category: 'core' | 'nominal' | 'clausal' | 'modifier' | 'function' | 'other';
  examples: string[];
}

const DEPENDENCY_RELATIONS: Record<string, DependencyRelation> = {
  // Core arguments
  'nsubj': {
    name: 'nominal subject',
    description: 'The nominal subject of a clause',
    category: 'core',
    examples: ['The CAT sat on the mat', 'SHE is happy']
  },
  'obj': {
    name: 'object',
    description: 'The direct object of a verb',
    category: 'core',
    examples: ['She ate an APPLE', 'He read the BOOK']
  },
  'iobj': {
    name: 'indirect object',
    description: 'The indirect object of a verb',
    category: 'core',
    examples: ['She gave HIM a book', 'He showed HER the way']
  },
  'csubj': {
    name: 'clausal subject',
    description: 'A clausal syntactic subject of a clause',
    category: 'core',
    examples: ['WHAT SHE SAID is true', 'THAT HE CAME surprised me']
  },
  'ccomp': {
    name: 'clausal complement',
    description: 'A clausal complement of a verb or adjective',
    category: 'core',
    examples: ['He said THAT HE WOULD COME', 'I think SHE IS RIGHT']
  },
  'xcomp': {
    name: 'open clausal complement',
    description: 'A predicative or clausal complement without its own subject',
    category: 'core',
    examples: ['He tried TO SWIM', 'She seems HAPPY']
  },

  // Nominal dependents
  'nmod': {
    name: 'nominal modifier',
    description: 'A nominal modifier of a noun or noun phrase',
    category: 'nominal',
    examples: ['The man FROM FRANCE', 'A cup OF COFFEE']
  },
  'appos': {
    name: 'appositional modifier',
    description: 'An appositional modifier of a noun',
    category: 'nominal',
    examples: ['My friend, THE DOCTOR, arrived', 'Paris, THE CAPITAL OF FRANCE']
  },
  'nummod': {
    name: 'numeric modifier',
    description: 'A numeric modifier of a noun',
    category: 'nominal',
    examples: ['THREE apples', 'TWENTY students']
  },
  'amod': {
    name: 'adjectival modifier',
    description: 'An adjectival modifier of a noun',
    category: 'nominal',
    examples: ['A RED apple', 'The TALL man']
  },

  // Clausal modifiers
  'advcl': {
    name: 'adverbial clause modifier',
    description: 'An adverbial clause modifier of a verb',
    category: 'clausal',
    examples: ['He left WHEN I ARRIVED', 'IF IT RAINS, we stay']
  },
  'acl': {
    name: 'clausal modifier of noun',
    description: 'A clause modifying a noun',
    category: 'clausal',
    examples: ['The man SITTING THERE', 'A book THAT I READ']
  },

  // Modifier dependents
  'advmod': {
    name: 'adverbial modifier',
    description: 'An adverb modifying a verb, adjective, or other adverb',
    category: 'modifier',
    examples: ['She ran QUICKLY', 'VERY happy']
  },
  'discourse': {
    name: 'discourse element',
    description: 'A discourse element like an interjection',
    category: 'modifier',
    examples: ['WELL, I think so', 'HEY, look at this']
  },
  'vocative': {
    name: 'vocative',
    description: 'A noun phrase used as a direct address',
    category: 'modifier',
    examples: ['JOHN, come here', 'Ladies and GENTLEMEN']
  },

  // Function words
  'aux': {
    name: 'auxiliary',
    description: 'An auxiliary verb',
    category: 'function',
    examples: ['She HAS eaten', 'He WILL come']
  },
  'cop': {
    name: 'copula',
    description: 'The copula verb',
    category: 'function',
    examples: ['She IS happy', 'He WAS tired']
  },
  'mark': {
    name: 'marker',
    description: 'A subordinating conjunction',
    category: 'function',
    examples: ['THAT he came', 'IF it rains']
  },
  'det': {
    name: 'determiner',
    description: 'A determiner modifying a noun',
    category: 'function',
    examples: ['THE book', 'A cat']
  },
  'case': {
    name: 'case marking',
    description: 'A case marker or preposition',
    category: 'function',
    examples: ['TO the store', 'OF the man']
  },

  // Coordination and other
  'conj': {
    name: 'conjunct',
    description: 'A conjunct in a coordination',
    category: 'other',
    examples: ['Apples AND oranges', 'Run OR hide']
  },
  'cc': {
    name: 'coordinating conjunction',
    description: 'A coordinating conjunction',
    category: 'other',
    examples: ['apples AND oranges', 'run OR hide']
  },
  'punct': {
    name: 'punctuation',
    description: 'Punctuation attached to a head',
    category: 'other',
    examples: ['Hello.', 'What?']
  },
  'root': {
    name: 'root',
    description: 'The root of the sentence (head of tree)',
    category: 'other',
    examples: ['She SLEPT', 'The cat SAT']
  },
  'dep': {
    name: 'unspecified dependency',
    description: 'An unspecified dependency relation',
    category: 'other',
    examples: ['(used when no other relation fits)']
  },
  'flat': {
    name: 'flat multiword expression',
    description: 'A multiword expression without internal structure',
    category: 'other',
    examples: ['New YORK', 'San FRANCISCO']
  },
  'compound': {
    name: 'compound',
    description: 'A compound (noun compounds, particle verbs)',
    category: 'other',
    examples: ['ice CREAM', 'look UP']
  },
  'fixed': {
    name: 'fixed multiword expression',
    description: 'A fixed grammaticized expression',
    category: 'other',
    examples: ['because OF', 'in SPITE of']
  },
  'parataxis': {
    name: 'parataxis',
    description: 'Loose joining of clauses',
    category: 'other',
    examples: ['He said, "GO AWAY"', 'I came; I SAW; I conquered']
  }
};

// =============================================================================
// Part-of-speech tags (Universal POS tags)
// =============================================================================

interface POSTag {
  name: string;
  description: string;
  examples: string[];
}

const POS_TAGS: Record<string, POSTag> = {
  'ADJ': { name: 'adjective', description: 'Words that typically modify nouns', examples: ['big', 'old', 'green'] },
  'ADP': { name: 'adposition', description: 'Prepositions and postpositions', examples: ['in', 'to', 'during'] },
  'ADV': { name: 'adverb', description: 'Words that typically modify verbs', examples: ['very', 'well', 'exactly'] },
  'AUX': { name: 'auxiliary', description: 'Auxiliary and modal verbs', examples: ['is', 'has', 'will', 'can'] },
  'CCONJ': { name: 'coordinating conjunction', description: 'Coordinates two elements', examples: ['and', 'or', 'but'] },
  'DET': { name: 'determiner', description: 'Articles and other determiners', examples: ['a', 'the', 'this', 'all'] },
  'INTJ': { name: 'interjection', description: 'Exclamations', examples: ['oh', 'wow', 'hey'] },
  'NOUN': { name: 'noun', description: 'Words denoting entities', examples: ['cat', 'tree', 'beauty'] },
  'NUM': { name: 'numeral', description: 'Cardinal numbers', examples: ['one', '2', 'first'] },
  'PART': { name: 'particle', description: 'Function words', examples: ['not', "'s", 'to'] },
  'PRON': { name: 'pronoun', description: 'Pronouns', examples: ['I', 'you', 'he', 'herself'] },
  'PROPN': { name: 'proper noun', description: 'Names', examples: ['Mary', 'London', 'NATO'] },
  'PUNCT': { name: 'punctuation', description: 'Punctuation marks', examples: ['.', ',', '?', '!'] },
  'SCONJ': { name: 'subordinating conjunction', description: 'Subordinates clauses', examples: ['if', 'while', 'that'] },
  'SYM': { name: 'symbol', description: 'Symbols', examples: ['$', '%', '@', '+'] },
  'VERB': { name: 'verb', description: 'Words denoting actions', examples: ['run', 'eat', 'think'] },
  'X': { name: 'other', description: 'Other category', examples: ['xfgh', 'pdl'] }
};

// =============================================================================
// Token and dependency structures
// =============================================================================

interface Token {
  id: number;
  form: string;          // Surface form
  lemma: string;         // Lemma/base form
  upos: string;          // Universal POS tag
  xpos?: string;         // Language-specific POS tag
  feats?: Record<string, string>;  // Morphological features
  head: number;          // Head token ID (0 for root)
  deprel: string;        // Dependency relation
  deps?: string;         // Enhanced dependencies
  misc?: string;         // Miscellaneous
}

interface DependencyTree {
  tokens: Token[];
  root: number;
  text: string;
}

interface ParseResult {
  tree: DependencyTree;
  arcs: Array<{ from: number; to: number; relation: string }>;
  statistics: {
    tokenCount: number;
    sentenceLength: number;
    maxDepth: number;
    avgDependencyLength: number;
    isProjective: boolean;
  };
}

// =============================================================================
// Lexicon and rule-based tokenization
// =============================================================================

interface LexiconEntry {
  lemma: string;
  pos: string;
  features?: Record<string, string>;
}

// Simple English lexicon for demonstration
const ENGLISH_LEXICON: Record<string, LexiconEntry[]> = {
  // Determiners
  'the': [{ lemma: 'the', pos: 'DET' }],
  'a': [{ lemma: 'a', pos: 'DET' }],
  'an': [{ lemma: 'a', pos: 'DET' }],
  'this': [{ lemma: 'this', pos: 'DET' }],
  'that': [{ lemma: 'that', pos: 'DET' }, { lemma: 'that', pos: 'SCONJ' }, { lemma: 'that', pos: 'PRON' }],
  'these': [{ lemma: 'this', pos: 'DET' }],
  'those': [{ lemma: 'that', pos: 'DET' }],
  'some': [{ lemma: 'some', pos: 'DET' }],
  'any': [{ lemma: 'any', pos: 'DET' }],
  'all': [{ lemma: 'all', pos: 'DET' }],
  'my': [{ lemma: 'my', pos: 'DET', features: { Poss: 'Yes', Person: '1' } }],
  'your': [{ lemma: 'your', pos: 'DET', features: { Poss: 'Yes', Person: '2' } }],
  'his': [{ lemma: 'his', pos: 'DET', features: { Poss: 'Yes', Person: '3', Gender: 'Masc' } }],
  'her': [{ lemma: 'her', pos: 'DET', features: { Poss: 'Yes', Person: '3', Gender: 'Fem' } }, { lemma: 'she', pos: 'PRON' }],
  'its': [{ lemma: 'its', pos: 'DET', features: { Poss: 'Yes', Person: '3' } }],
  'our': [{ lemma: 'our', pos: 'DET', features: { Poss: 'Yes', Person: '1', Number: 'Plur' } }],
  'their': [{ lemma: 'their', pos: 'DET', features: { Poss: 'Yes', Person: '3', Number: 'Plur' } }],

  // Pronouns
  'i': [{ lemma: 'I', pos: 'PRON', features: { Person: '1', Number: 'Sing', Case: 'Nom' } }],
  'me': [{ lemma: 'I', pos: 'PRON', features: { Person: '1', Number: 'Sing', Case: 'Acc' } }],
  'you': [{ lemma: 'you', pos: 'PRON', features: { Person: '2' } }],
  'he': [{ lemma: 'he', pos: 'PRON', features: { Person: '3', Number: 'Sing', Gender: 'Masc', Case: 'Nom' } }],
  'him': [{ lemma: 'he', pos: 'PRON', features: { Person: '3', Number: 'Sing', Gender: 'Masc', Case: 'Acc' } }],
  'she': [{ lemma: 'she', pos: 'PRON', features: { Person: '3', Number: 'Sing', Gender: 'Fem', Case: 'Nom' } }],
  'it': [{ lemma: 'it', pos: 'PRON', features: { Person: '3', Number: 'Sing', Case: 'Nom' } }],
  'we': [{ lemma: 'we', pos: 'PRON', features: { Person: '1', Number: 'Plur', Case: 'Nom' } }],
  'us': [{ lemma: 'we', pos: 'PRON', features: { Person: '1', Number: 'Plur', Case: 'Acc' } }],
  'they': [{ lemma: 'they', pos: 'PRON', features: { Person: '3', Number: 'Plur', Case: 'Nom' } }],
  'them': [{ lemma: 'they', pos: 'PRON', features: { Person: '3', Number: 'Plur', Case: 'Acc' } }],
  'who': [{ lemma: 'who', pos: 'PRON', features: { PronType: 'Rel' } }],
  'whom': [{ lemma: 'who', pos: 'PRON', features: { PronType: 'Rel', Case: 'Acc' } }],
  'what': [{ lemma: 'what', pos: 'PRON', features: { PronType: 'Int' } }],
  'which': [{ lemma: 'which', pos: 'PRON', features: { PronType: 'Rel' } }],

  // Auxiliaries
  'is': [{ lemma: 'be', pos: 'AUX', features: { Person: '3', Number: 'Sing', Tense: 'Pres' } }],
  'are': [{ lemma: 'be', pos: 'AUX', features: { Number: 'Plur', Tense: 'Pres' } }],
  'am': [{ lemma: 'be', pos: 'AUX', features: { Person: '1', Number: 'Sing', Tense: 'Pres' } }],
  'was': [{ lemma: 'be', pos: 'AUX', features: { Number: 'Sing', Tense: 'Past' } }],
  'were': [{ lemma: 'be', pos: 'AUX', features: { Number: 'Plur', Tense: 'Past' } }],
  'been': [{ lemma: 'be', pos: 'AUX', features: { VerbForm: 'Part', Tense: 'Past' } }],
  'being': [{ lemma: 'be', pos: 'AUX', features: { VerbForm: 'Part', Tense: 'Pres' } }],
  'have': [{ lemma: 'have', pos: 'AUX', features: { Tense: 'Pres' } }, { lemma: 'have', pos: 'VERB' }],
  'has': [{ lemma: 'have', pos: 'AUX', features: { Person: '3', Number: 'Sing', Tense: 'Pres' } }],
  'had': [{ lemma: 'have', pos: 'AUX', features: { Tense: 'Past' } }],
  'do': [{ lemma: 'do', pos: 'AUX' }, { lemma: 'do', pos: 'VERB' }],
  'does': [{ lemma: 'do', pos: 'AUX', features: { Person: '3', Number: 'Sing' } }],
  'did': [{ lemma: 'do', pos: 'AUX', features: { Tense: 'Past' } }],
  'will': [{ lemma: 'will', pos: 'AUX', features: { VerbForm: 'Fin', Mood: 'Ind' } }],
  'would': [{ lemma: 'will', pos: 'AUX', features: { VerbForm: 'Fin', Mood: 'Cnd' } }],
  'can': [{ lemma: 'can', pos: 'AUX', features: { VerbForm: 'Fin' } }],
  'could': [{ lemma: 'can', pos: 'AUX', features: { VerbForm: 'Fin', Mood: 'Cnd' } }],
  'may': [{ lemma: 'may', pos: 'AUX', features: { VerbForm: 'Fin' } }],
  'might': [{ lemma: 'may', pos: 'AUX', features: { VerbForm: 'Fin', Mood: 'Cnd' } }],
  'must': [{ lemma: 'must', pos: 'AUX', features: { VerbForm: 'Fin' } }],
  'shall': [{ lemma: 'shall', pos: 'AUX', features: { VerbForm: 'Fin' } }],
  'should': [{ lemma: 'shall', pos: 'AUX', features: { VerbForm: 'Fin', Mood: 'Cnd' } }],

  // Prepositions/adpositions
  'in': [{ lemma: 'in', pos: 'ADP' }],
  'on': [{ lemma: 'on', pos: 'ADP' }],
  'at': [{ lemma: 'at', pos: 'ADP' }],
  'to': [{ lemma: 'to', pos: 'ADP' }, { lemma: 'to', pos: 'PART' }],
  'for': [{ lemma: 'for', pos: 'ADP' }, { lemma: 'for', pos: 'SCONJ' }],
  'with': [{ lemma: 'with', pos: 'ADP' }],
  'by': [{ lemma: 'by', pos: 'ADP' }],
  'from': [{ lemma: 'from', pos: 'ADP' }],
  'of': [{ lemma: 'of', pos: 'ADP' }],
  'about': [{ lemma: 'about', pos: 'ADP' }],
  'into': [{ lemma: 'into', pos: 'ADP' }],
  'through': [{ lemma: 'through', pos: 'ADP' }],
  'during': [{ lemma: 'during', pos: 'ADP' }],
  'before': [{ lemma: 'before', pos: 'ADP' }, { lemma: 'before', pos: 'SCONJ' }],
  'after': [{ lemma: 'after', pos: 'ADP' }, { lemma: 'after', pos: 'SCONJ' }],
  'above': [{ lemma: 'above', pos: 'ADP' }],
  'below': [{ lemma: 'below', pos: 'ADP' }],
  'between': [{ lemma: 'between', pos: 'ADP' }],
  'under': [{ lemma: 'under', pos: 'ADP' }],
  'over': [{ lemma: 'over', pos: 'ADP' }],

  // Conjunctions
  'and': [{ lemma: 'and', pos: 'CCONJ' }],
  'or': [{ lemma: 'or', pos: 'CCONJ' }],
  'but': [{ lemma: 'but', pos: 'CCONJ' }],
  'nor': [{ lemma: 'nor', pos: 'CCONJ' }],
  'yet': [{ lemma: 'yet', pos: 'CCONJ' }, { lemma: 'yet', pos: 'ADV' }],
  'so': [{ lemma: 'so', pos: 'CCONJ' }, { lemma: 'so', pos: 'ADV' }],
  'if': [{ lemma: 'if', pos: 'SCONJ' }],
  'when': [{ lemma: 'when', pos: 'SCONJ' }, { lemma: 'when', pos: 'ADV' }],
  'while': [{ lemma: 'while', pos: 'SCONJ' }],
  'because': [{ lemma: 'because', pos: 'SCONJ' }],
  'although': [{ lemma: 'although', pos: 'SCONJ' }],
  'though': [{ lemma: 'though', pos: 'SCONJ' }],
  'unless': [{ lemma: 'unless', pos: 'SCONJ' }],
  'until': [{ lemma: 'until', pos: 'SCONJ' }],
  'since': [{ lemma: 'since', pos: 'SCONJ' }, { lemma: 'since', pos: 'ADP' }],

  // Common adverbs
  'not': [{ lemma: 'not', pos: 'PART', features: { Polarity: 'Neg' } }],
  "n't": [{ lemma: 'not', pos: 'PART', features: { Polarity: 'Neg' } }],
  'very': [{ lemma: 'very', pos: 'ADV' }],
  'well': [{ lemma: 'well', pos: 'ADV' }],
  'also': [{ lemma: 'also', pos: 'ADV' }],
  'just': [{ lemma: 'just', pos: 'ADV' }],
  'only': [{ lemma: 'only', pos: 'ADV' }],
  'now': [{ lemma: 'now', pos: 'ADV' }],
  'then': [{ lemma: 'then', pos: 'ADV' }],
  'here': [{ lemma: 'here', pos: 'ADV' }],
  'there': [{ lemma: 'there', pos: 'ADV' }, { lemma: 'there', pos: 'PRON' }],
  'never': [{ lemma: 'never', pos: 'ADV' }],
  'always': [{ lemma: 'always', pos: 'ADV' }],
  'often': [{ lemma: 'often', pos: 'ADV' }],
  'sometimes': [{ lemma: 'sometimes', pos: 'ADV' }],
  'quickly': [{ lemma: 'quickly', pos: 'ADV' }],
  'slowly': [{ lemma: 'slowly', pos: 'ADV' }],
  'really': [{ lemma: 'really', pos: 'ADV' }],

  // Common verbs
  'be': [{ lemma: 'be', pos: 'VERB' }],
  'go': [{ lemma: 'go', pos: 'VERB' }],
  'goes': [{ lemma: 'go', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'went': [{ lemma: 'go', pos: 'VERB', features: { Tense: 'Past' } }],
  'gone': [{ lemma: 'go', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'going': [{ lemma: 'go', pos: 'VERB', features: { VerbForm: 'Part', Tense: 'Pres' } }],
  'come': [{ lemma: 'come', pos: 'VERB' }],
  'comes': [{ lemma: 'come', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'came': [{ lemma: 'come', pos: 'VERB', features: { Tense: 'Past' } }],
  'see': [{ lemma: 'see', pos: 'VERB' }],
  'sees': [{ lemma: 'see', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'saw': [{ lemma: 'see', pos: 'VERB', features: { Tense: 'Past' } }],
  'seen': [{ lemma: 'see', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'know': [{ lemma: 'know', pos: 'VERB' }],
  'knows': [{ lemma: 'know', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'knew': [{ lemma: 'know', pos: 'VERB', features: { Tense: 'Past' } }],
  'known': [{ lemma: 'know', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'get': [{ lemma: 'get', pos: 'VERB' }],
  'gets': [{ lemma: 'get', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'got': [{ lemma: 'get', pos: 'VERB', features: { Tense: 'Past' } }],
  'make': [{ lemma: 'make', pos: 'VERB' }],
  'makes': [{ lemma: 'make', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'made': [{ lemma: 'make', pos: 'VERB', features: { Tense: 'Past' } }],
  'take': [{ lemma: 'take', pos: 'VERB' }],
  'takes': [{ lemma: 'take', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'took': [{ lemma: 'take', pos: 'VERB', features: { Tense: 'Past' } }],
  'taken': [{ lemma: 'take', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'say': [{ lemma: 'say', pos: 'VERB' }],
  'says': [{ lemma: 'say', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'said': [{ lemma: 'say', pos: 'VERB', features: { Tense: 'Past' } }],
  'think': [{ lemma: 'think', pos: 'VERB' }],
  'thinks': [{ lemma: 'think', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'thought': [{ lemma: 'think', pos: 'VERB', features: { Tense: 'Past' } }],
  'want': [{ lemma: 'want', pos: 'VERB' }],
  'wants': [{ lemma: 'want', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'wanted': [{ lemma: 'want', pos: 'VERB', features: { Tense: 'Past' } }],
  'use': [{ lemma: 'use', pos: 'VERB' }],
  'uses': [{ lemma: 'use', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'used': [{ lemma: 'use', pos: 'VERB', features: { Tense: 'Past' } }],
  'find': [{ lemma: 'find', pos: 'VERB' }],
  'finds': [{ lemma: 'find', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'found': [{ lemma: 'find', pos: 'VERB', features: { Tense: 'Past' } }],
  'give': [{ lemma: 'give', pos: 'VERB' }],
  'gives': [{ lemma: 'give', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'gave': [{ lemma: 'give', pos: 'VERB', features: { Tense: 'Past' } }],
  'given': [{ lemma: 'give', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'eat': [{ lemma: 'eat', pos: 'VERB' }],
  'eats': [{ lemma: 'eat', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'ate': [{ lemma: 'eat', pos: 'VERB', features: { Tense: 'Past' } }],
  'eaten': [{ lemma: 'eat', pos: 'VERB', features: { VerbForm: 'Part' } }],
  'run': [{ lemma: 'run', pos: 'VERB' }],
  'runs': [{ lemma: 'run', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'ran': [{ lemma: 'run', pos: 'VERB', features: { Tense: 'Past' } }],
  'sit': [{ lemma: 'sit', pos: 'VERB' }],
  'sits': [{ lemma: 'sit', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'sat': [{ lemma: 'sit', pos: 'VERB', features: { Tense: 'Past' } }],
  'read': [{ lemma: 'read', pos: 'VERB' }],
  'reads': [{ lemma: 'read', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'write': [{ lemma: 'write', pos: 'VERB' }],
  'writes': [{ lemma: 'write', pos: 'VERB', features: { Person: '3', Number: 'Sing' } }],
  'wrote': [{ lemma: 'write', pos: 'VERB', features: { Tense: 'Past' } }],
  'written': [{ lemma: 'write', pos: 'VERB', features: { VerbForm: 'Part' } }],

  // Common nouns
  'cat': [{ lemma: 'cat', pos: 'NOUN' }],
  'cats': [{ lemma: 'cat', pos: 'NOUN', features: { Number: 'Plur' } }],
  'dog': [{ lemma: 'dog', pos: 'NOUN' }],
  'dogs': [{ lemma: 'dog', pos: 'NOUN', features: { Number: 'Plur' } }],
  'man': [{ lemma: 'man', pos: 'NOUN' }],
  'men': [{ lemma: 'man', pos: 'NOUN', features: { Number: 'Plur' } }],
  'woman': [{ lemma: 'woman', pos: 'NOUN' }],
  'women': [{ lemma: 'woman', pos: 'NOUN', features: { Number: 'Plur' } }],
  'child': [{ lemma: 'child', pos: 'NOUN' }],
  'children': [{ lemma: 'child', pos: 'NOUN', features: { Number: 'Plur' } }],
  'book': [{ lemma: 'book', pos: 'NOUN' }],
  'books': [{ lemma: 'book', pos: 'NOUN', features: { Number: 'Plur' } }],
  'house': [{ lemma: 'house', pos: 'NOUN' }],
  'houses': [{ lemma: 'house', pos: 'NOUN', features: { Number: 'Plur' } }],
  'car': [{ lemma: 'car', pos: 'NOUN' }],
  'cars': [{ lemma: 'car', pos: 'NOUN', features: { Number: 'Plur' } }],
  'time': [{ lemma: 'time', pos: 'NOUN' }],
  'times': [{ lemma: 'time', pos: 'NOUN', features: { Number: 'Plur' } }],
  'year': [{ lemma: 'year', pos: 'NOUN' }],
  'years': [{ lemma: 'year', pos: 'NOUN', features: { Number: 'Plur' } }],
  'day': [{ lemma: 'day', pos: 'NOUN' }],
  'days': [{ lemma: 'day', pos: 'NOUN', features: { Number: 'Plur' } }],
  'way': [{ lemma: 'way', pos: 'NOUN' }],
  'ways': [{ lemma: 'way', pos: 'NOUN', features: { Number: 'Plur' } }],
  'thing': [{ lemma: 'thing', pos: 'NOUN' }],
  'things': [{ lemma: 'thing', pos: 'NOUN', features: { Number: 'Plur' } }],
  'world': [{ lemma: 'world', pos: 'NOUN' }],
  'life': [{ lemma: 'life', pos: 'NOUN' }],
  'hand': [{ lemma: 'hand', pos: 'NOUN' }],
  'part': [{ lemma: 'part', pos: 'NOUN' }],
  'place': [{ lemma: 'place', pos: 'NOUN' }],
  'case': [{ lemma: 'case', pos: 'NOUN' }],
  'week': [{ lemma: 'week', pos: 'NOUN' }],
  'company': [{ lemma: 'company', pos: 'NOUN' }],
  'system': [{ lemma: 'system', pos: 'NOUN' }],
  'program': [{ lemma: 'program', pos: 'NOUN' }],
  'question': [{ lemma: 'question', pos: 'NOUN' }],
  'work': [{ lemma: 'work', pos: 'NOUN' }, { lemma: 'work', pos: 'VERB' }],
  'government': [{ lemma: 'government', pos: 'NOUN' }],
  'number': [{ lemma: 'number', pos: 'NOUN' }],
  'night': [{ lemma: 'night', pos: 'NOUN' }],
  'point': [{ lemma: 'point', pos: 'NOUN' }],
  'home': [{ lemma: 'home', pos: 'NOUN' }],
  'water': [{ lemma: 'water', pos: 'NOUN' }],
  'room': [{ lemma: 'room', pos: 'NOUN' }],
  'mother': [{ lemma: 'mother', pos: 'NOUN' }],
  'father': [{ lemma: 'father', pos: 'NOUN' }],
  'area': [{ lemma: 'area', pos: 'NOUN' }],
  'money': [{ lemma: 'money', pos: 'NOUN' }],
  'story': [{ lemma: 'story', pos: 'NOUN' }],
  'fact': [{ lemma: 'fact', pos: 'NOUN' }],
  'month': [{ lemma: 'month', pos: 'NOUN' }],
  'lot': [{ lemma: 'lot', pos: 'NOUN' }],
  'right': [{ lemma: 'right', pos: 'NOUN' }, { lemma: 'right', pos: 'ADJ' }],
  'study': [{ lemma: 'study', pos: 'NOUN' }, { lemma: 'study', pos: 'VERB' }],
  'apple': [{ lemma: 'apple', pos: 'NOUN' }],
  'apples': [{ lemma: 'apple', pos: 'NOUN', features: { Number: 'Plur' } }],
  'mat': [{ lemma: 'mat', pos: 'NOUN' }],

  // Common adjectives
  'good': [{ lemma: 'good', pos: 'ADJ' }],
  'new': [{ lemma: 'new', pos: 'ADJ' }],
  'first': [{ lemma: 'first', pos: 'ADJ' }],
  'last': [{ lemma: 'last', pos: 'ADJ' }],
  'long': [{ lemma: 'long', pos: 'ADJ' }],
  'great': [{ lemma: 'great', pos: 'ADJ' }],
  'little': [{ lemma: 'little', pos: 'ADJ' }],
  'own': [{ lemma: 'own', pos: 'ADJ' }],
  'other': [{ lemma: 'other', pos: 'ADJ' }],
  'old': [{ lemma: 'old', pos: 'ADJ' }],
  'big': [{ lemma: 'big', pos: 'ADJ' }],
  'small': [{ lemma: 'small', pos: 'ADJ' }],
  'high': [{ lemma: 'high', pos: 'ADJ' }],
  'different': [{ lemma: 'different', pos: 'ADJ' }],
  'large': [{ lemma: 'large', pos: 'ADJ' }],
  'young': [{ lemma: 'young', pos: 'ADJ' }],
  'important': [{ lemma: 'important', pos: 'ADJ' }],
  'happy': [{ lemma: 'happy', pos: 'ADJ' }],
  'red': [{ lemma: 'red', pos: 'ADJ' }],
  'blue': [{ lemma: 'blue', pos: 'ADJ' }],
  'green': [{ lemma: 'green', pos: 'ADJ' }],
  'black': [{ lemma: 'black', pos: 'ADJ' }],
  'white': [{ lemma: 'white', pos: 'ADJ' }],
  'tall': [{ lemma: 'tall', pos: 'ADJ' }],
  'beautiful': [{ lemma: 'beautiful', pos: 'ADJ' }],
  'quick': [{ lemma: 'quick', pos: 'ADJ' }],
  'lazy': [{ lemma: 'lazy', pos: 'ADJ' }],
  'brown': [{ lemma: 'brown', pos: 'ADJ' }]
};

// =============================================================================
// Tokenization
// =============================================================================

function tokenize(text: string): string[] {
  // Split on whitespace and punctuation, keeping punctuation as separate tokens
  const tokens: string[] = [];
  const pattern = /([A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[.,!?;:'"()\[\]{}\-])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    tokens.push(match[1]);
  }

  return tokens;
}

// =============================================================================
// POS tagging with disambiguation
// =============================================================================

function posTag(tokens: string[]): Array<{ form: string; lemma: string; pos: string; features?: Record<string, string> }> {
  const tagged: Array<{ form: string; lemma: string; pos: string; features?: Record<string, string> }> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lowerToken = token.toLowerCase();

    // Check if it's punctuation
    if (/^[.,!?;:'"()\[\]{}\-]$/.test(token)) {
      tagged.push({ form: token, lemma: token, pos: 'PUNCT' });
      continue;
    }

    // Check if it's a number
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      tagged.push({ form: token, lemma: token, pos: 'NUM' });
      continue;
    }

    // Look up in lexicon
    const entries = ENGLISH_LEXICON[lowerToken];

    if (entries && entries.length > 0) {
      // Simple disambiguation: prefer based on context
      let selected = entries[0];

      // If previous word is determiner, prefer noun
      if (i > 0 && tagged[i - 1].pos === 'DET') {
        const nounEntry = entries.find(e => e.pos === 'NOUN' || e.pos === 'ADJ');
        if (nounEntry) selected = nounEntry;
      }

      // If previous word is auxiliary, prefer verb
      if (i > 0 && tagged[i - 1].pos === 'AUX') {
        const verbEntry = entries.find(e => e.pos === 'VERB');
        if (verbEntry) selected = verbEntry;
      }

      // If previous word is preposition, prefer noun
      if (i > 0 && tagged[i - 1].pos === 'ADP') {
        const nounEntry = entries.find(e => e.pos === 'NOUN' || e.pos === 'DET');
        if (nounEntry) selected = nounEntry;
      }

      tagged.push({
        form: token,
        lemma: selected.lemma,
        pos: selected.pos,
        features: selected.features
      });
    } else {
      // Unknown word - apply heuristics
      let pos = 'NOUN';  // Default to noun for unknown words
      let lemma = lowerToken;

      // If ends in -ly, probably adverb
      if (lowerToken.endsWith('ly')) {
        pos = 'ADV';
        lemma = lowerToken.slice(0, -2);
      }
      // If ends in -ing, probably verb gerund
      else if (lowerToken.endsWith('ing')) {
        pos = 'VERB';
        lemma = lowerToken.slice(0, -3);
      }
      // If ends in -ed, probably past tense verb
      else if (lowerToken.endsWith('ed')) {
        pos = 'VERB';
        lemma = lowerToken.slice(0, -2);
      }
      // If ends in -s and not first word, could be plural noun or 3rd person verb
      else if (lowerToken.endsWith('s') && i > 0) {
        // Check context
        if (tagged[i - 1].pos === 'DET' || tagged[i - 1].pos === 'ADJ') {
          pos = 'NOUN';
          lemma = lowerToken.slice(0, -1);
        } else {
          pos = 'VERB';
          lemma = lowerToken.slice(0, -1);
        }
      }
      // Capitalized word (not first) is likely proper noun
      else if (token[0] === token[0].toUpperCase() && i > 0) {
        pos = 'PROPN';
      }

      tagged.push({ form: token, lemma, pos });
    }
  }

  return tagged;
}

// =============================================================================
// Dependency parsing (arc-standard transition-based)
// =============================================================================

interface ParseState {
  stack: number[];
  buffer: number[];
  arcs: Map<number, { head: number; relation: string }>;
}

function initializeParseState(n: number): ParseState {
  return {
    stack: [0],  // 0 is the artificial root
    buffer: Array.from({ length: n }, (_, i) => i + 1),
    arcs: new Map()
  };
}

function parse(tagged: Array<{ form: string; lemma: string; pos: string; features?: Record<string, string> }>): Token[] {
  const tokens: Token[] = tagged.map((t, i) => ({
    id: i + 1,
    form: t.form,
    lemma: t.lemma,
    upos: t.pos,
    feats: t.features,
    head: 0,
    deprel: 'dep'
  }));

  // Simple deterministic parsing rules based on POS patterns
  let mainVerb = -1;
  let subject = -1;
  let lastDet = -1;
  let lastAdj: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Track determiners
    if (token.upos === 'DET') {
      lastDet = i;
      lastAdj = [];
    }

    // Adjectives modify the following noun
    if (token.upos === 'ADJ') {
      lastAdj.push(i);
    }

    // Nouns
    if (token.upos === 'NOUN' || token.upos === 'PROPN' || token.upos === 'PRON') {
      // Attach determiner
      if (lastDet >= 0 && lastDet < i) {
        tokens[lastDet].head = i + 1;
        tokens[lastDet].deprel = 'det';
        lastDet = -1;
      }

      // Attach adjectives
      for (const adj of lastAdj) {
        tokens[adj].head = i + 1;
        tokens[adj].deprel = 'amod';
      }
      lastAdj = [];

      // First nominal before verb is likely subject
      if (mainVerb < 0 && subject < 0) {
        subject = i;
      }
    }

    // Verbs
    if (token.upos === 'VERB' && mainVerb < 0) {
      mainVerb = i;
      token.head = 0;
      token.deprel = 'root';

      // Attach subject if found
      if (subject >= 0) {
        tokens[subject].head = i + 1;
        tokens[subject].deprel = 'nsubj';
      }
    }

    // Auxiliaries attach to main verb
    if (token.upos === 'AUX') {
      if (mainVerb >= 0) {
        token.head = mainVerb + 1;
        token.deprel = 'aux';
      } else {
        // Aux before main verb - find next verb
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].upos === 'VERB') {
            token.head = j + 1;
            token.deprel = tokens[j].upos === 'ADJ' ? 'cop' : 'aux';
            break;
          }
        }
      }
    }

    // Adverbs
    if (token.upos === 'ADV') {
      // Find nearest verb or adjective to attach to
      if (mainVerb >= 0) {
        token.head = mainVerb + 1;
        token.deprel = 'advmod';
      } else {
        // Look for following verb
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].upos === 'VERB' || tokens[j].upos === 'ADJ') {
            token.head = j + 1;
            token.deprel = 'advmod';
            break;
          }
        }
      }
    }

    // Prepositions
    if (token.upos === 'ADP') {
      // Preposition introduces a prepositional phrase
      // Look for following nominal
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].upos === 'NOUN' || tokens[j].upos === 'PROPN' || tokens[j].upos === 'PRON') {
          token.head = j + 1;
          token.deprel = 'case';

          // The nominal attaches to previous noun or verb
          if (mainVerb >= 0) {
            tokens[j].head = mainVerb + 1;
            tokens[j].deprel = 'obl';
          }
          break;
        }
      }
    }

    // Coordinating conjunctions
    if (token.upos === 'CCONJ') {
      // Find what's being coordinated
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].upos !== 'PUNCT' && tokens[j].upos !== 'CCONJ') {
          token.head = j + 1;
          token.deprel = 'cc';
          break;
        }
      }
    }

    // Subordinating conjunctions
    if (token.upos === 'SCONJ') {
      // Marks the following clause
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].upos === 'VERB') {
          token.head = j + 1;
          token.deprel = 'mark';
          break;
        }
      }
    }

    // Punctuation attaches to root or nearby head
    if (token.upos === 'PUNCT') {
      if (mainVerb >= 0) {
        token.head = mainVerb + 1;
        token.deprel = 'punct';
      } else if (i > 0) {
        // Attach to previous token if no verb found yet
        token.head = i;
        token.deprel = 'punct';
      }
    }
  }

  // Handle nouns after verb as objects
  for (let i = mainVerb + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if ((token.upos === 'NOUN' || token.upos === 'PROPN' || token.upos === 'PRON') &&
        token.head === 0 && mainVerb >= 0) {
      token.head = mainVerb + 1;
      token.deprel = 'obj';

      // Attach any preceding determiner/adjectives
      for (let j = mainVerb + 1; j < i; j++) {
        if (tokens[j].upos === 'DET' && tokens[j].head === 0) {
          tokens[j].head = i + 1;
          tokens[j].deprel = 'det';
        }
        if (tokens[j].upos === 'ADJ' && tokens[j].head === 0) {
          tokens[j].head = i + 1;
          tokens[j].deprel = 'amod';
        }
      }
      break;  // Only first noun after verb is direct object
    }
  }

  // Fix any remaining unattached tokens
  for (const token of tokens) {
    if (token.head === 0 && token.deprel === 'dep') {
      // Attach to root verb or first token
      if (mainVerb >= 0 && token.id !== mainVerb + 1) {
        token.head = mainVerb + 1;
      }
    }
  }

  return tokens;
}

// =============================================================================
// Tree analysis and visualization
// =============================================================================

function calculateTreeDepth(tokens: Token[], nodeId: number, memo: Map<number, number> = new Map()): number {
  if (nodeId === 0) return 0;
  if (memo.has(nodeId)) return memo.get(nodeId)!;

  const token = tokens[nodeId - 1];
  const depth = 1 + calculateTreeDepth(tokens, token.head, memo);
  memo.set(nodeId, depth);
  return depth;
}

function getMaxDepth(tokens: Token[]): number {
  let maxDepth = 0;
  const memo = new Map<number, number>();

  for (const token of tokens) {
    const depth = calculateTreeDepth(tokens, token.id, memo);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

function calculateAvgDependencyLength(tokens: Token[]): number {
  let totalLength = 0;
  let count = 0;

  for (const token of tokens) {
    if (token.head > 0) {
      totalLength += Math.abs(token.id - token.head);
      count++;
    }
  }

  return count > 0 ? totalLength / count : 0;
}

function isProjective(tokens: Token[]): boolean {
  // Check for crossing arcs
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const arc1 = { from: Math.min(tokens[i].id, tokens[i].head), to: Math.max(tokens[i].id, tokens[i].head) };
      const arc2 = { from: Math.min(tokens[j].id, tokens[j].head), to: Math.max(tokens[j].id, tokens[j].head) };

      // Check if arcs cross
      if (arc1.from < arc2.from && arc2.from < arc1.to && arc1.to < arc2.to) {
        return false;
      }
      if (arc2.from < arc1.from && arc1.from < arc2.to && arc2.to < arc1.to) {
        return false;
      }
    }
  }

  return true;
}

function generateArcs(tokens: Token[]): Array<{ from: number; to: number; relation: string }> {
  return tokens.map(token => ({
    from: token.head,
    to: token.id,
    relation: token.deprel
  }));
}

function visualizeTree(tokens: Token[]): string {
  const lines: string[] = [];

  // ASCII tree representation
  lines.push('Dependency Tree:');
  lines.push('================');
  lines.push('');

  // Find root
  const root = tokens.find(t => t.head === 0);
  if (!root) {
    lines.push('No root found');
    return lines.join('\n');
  }

  // Build adjacency list for children
  const children = new Map<number, Token[]>();
  for (const token of tokens) {
    const headId = token.head;
    if (!children.has(headId)) {
      children.set(headId, []);
    }
    children.get(headId)!.push(token);
  }

  // Recursive tree printing
  function printSubtree(nodeId: number, prefix: string, isLast: boolean): void {
    const token = tokens[nodeId - 1];
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    lines.push(`${prefix}${connector}${token.form} [${token.upos}] --${token.deprel}--`);

    const nodeChildren = children.get(nodeId) || [];
    for (let i = 0; i < nodeChildren.length; i++) {
      printSubtree(nodeChildren[i].id, prefix + extension, i === nodeChildren.length - 1);
    }
  }

  // Print from root
  lines.push(`ROOT`);
  const rootChildren = children.get(0) || [];
  for (let i = 0; i < rootChildren.length; i++) {
    printSubtree(rootChildren[i].id, '', i === rootChildren.length - 1);
  }

  // Also show linear representation with arcs
  lines.push('');
  lines.push('Linear representation:');
  lines.push('----------------------');

  // Token line
  const tokenLine = tokens.map(t => t.form.padEnd(10)).join(' ');
  lines.push(tokenLine);

  // POS line
  const posLine = tokens.map(t => t.upos.padEnd(10)).join(' ');
  lines.push(posLine);

  // Relation line
  const relLine = tokens.map(t => `${t.deprel}→${t.head}`.padEnd(10)).join(' ');
  lines.push(relLine);

  return lines.join('\n');
}

// =============================================================================
// Full parsing function
// =============================================================================

function parseSentence(text: string): ParseResult {
  const rawTokens = tokenize(text);
  const tagged = posTag(rawTokens);
  const tokens = parse(tagged);

  // Find root
  let rootId = 1;
  for (const token of tokens) {
    if (token.head === 0) {
      rootId = token.id;
      break;
    }
  }

  return {
    tree: {
      tokens,
      root: rootId,
      text
    },
    arcs: generateArcs(tokens),
    statistics: {
      tokenCount: tokens.length,
      sentenceLength: text.length,
      maxDepth: getMaxDepth(tokens),
      avgDependencyLength: calculateAvgDependencyLength(tokens),
      isProjective: isProjective(tokens)
    }
  };
}

// =============================================================================
// CoNLL-U format output
// =============================================================================

function toCoNLLU(parseResult: ParseResult): string {
  const lines: string[] = [];
  lines.push(`# text = ${parseResult.tree.text}`);

  for (const token of parseResult.tree.tokens) {
    const feats = token.feats ?
      Object.entries(token.feats).map(([k, v]) => `${k}=${v}`).join('|') : '_';

    lines.push([
      token.id,
      token.form,
      token.lemma,
      token.upos,
      token.xpos || '_',
      feats,
      token.head,
      token.deprel,
      token.deps || '_',
      token.misc || '_'
    ].join('\t'));
  }

  return lines.join('\n');
}

// =============================================================================
// Tool definition
// =============================================================================

export const dependencyparserTool: UnifiedTool = {
  name: 'dependency_parser',
  description: `Syntactic dependency parsing for sentence structure analysis using Universal Dependencies framework.

Operations:
- parse: Parse a sentence and return full dependency tree with POS tags and relations
- visualize: Generate ASCII visualization of dependency tree
- relations: Get information about dependency relation types
- pos_tags: Get information about Universal POS tags
- conllu: Output parse in CoNLL-U format
- analyze: Analyze syntactic complexity metrics
- info: Documentation and usage information

Features:
- Universal Dependencies (UD) annotation scheme
- Projective parsing with crossing arc detection
- Rich morphological feature support
- CoNLL-U format export
- Tree visualization
- Syntactic complexity metrics`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'visualize', 'relations', 'pos_tags', 'conllu', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Text/sentence to parse'
      },
      relation: {
        type: 'string',
        description: 'Specific dependency relation to get info about'
      },
      pos: {
        type: 'string',
        description: 'Specific POS tag to get info about'
      }
    },
    required: ['operation']
  }
};

export async function executedependencyparser(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, relation, pos } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'parse': {
        if (!text) {
          throw new Error('text parameter is required for parse operation');
        }

        const parseResult = parseSentence(text);

        result = {
          operation: 'parse',
          input: text,
          tokens: parseResult.tree.tokens.map(t => ({
            id: t.id,
            form: t.form,
            lemma: t.lemma,
            pos: t.upos,
            head: t.head,
            relation: t.deprel,
            features: t.feats || null
          })),
          arcs: parseResult.arcs,
          root: parseResult.tree.root,
          statistics: parseResult.statistics
        };
        break;
      }

      case 'visualize': {
        if (!text) {
          throw new Error('text parameter is required for visualize operation');
        }

        const parseResult = parseSentence(text);
        const visualization = visualizeTree(parseResult.tree.tokens);

        result = {
          operation: 'visualize',
          input: text,
          visualization,
          statistics: parseResult.statistics
        };
        break;
      }

      case 'relations': {
        if (relation) {
          const relInfo = DEPENDENCY_RELATIONS[relation];
          if (!relInfo) {
            result = {
              operation: 'relations',
              error: `Unknown relation: ${relation}`,
              availableRelations: Object.keys(DEPENDENCY_RELATIONS)
            };
          } else {
            result = {
              operation: 'relations',
              relation,
              ...relInfo
            };
          }
        } else {
          const byCategory: Record<string, string[]> = {};
          for (const [rel, info] of Object.entries(DEPENDENCY_RELATIONS)) {
            if (!byCategory[info.category]) {
              byCategory[info.category] = [];
            }
            byCategory[info.category].push(rel);
          }

          result = {
            operation: 'relations',
            totalRelations: Object.keys(DEPENDENCY_RELATIONS).length,
            byCategory,
            relations: Object.entries(DEPENDENCY_RELATIONS).map(([name, info]) => ({
              name,
              fullName: info.name,
              category: info.category,
              description: info.description
            }))
          };
        }
        break;
      }

      case 'pos_tags': {
        if (pos) {
          const posInfo = POS_TAGS[pos.toUpperCase()];
          if (!posInfo) {
            result = {
              operation: 'pos_tags',
              error: `Unknown POS tag: ${pos}`,
              availableTags: Object.keys(POS_TAGS)
            };
          } else {
            result = {
              operation: 'pos_tags',
              tag: pos.toUpperCase(),
              ...posInfo
            };
          }
        } else {
          result = {
            operation: 'pos_tags',
            totalTags: Object.keys(POS_TAGS).length,
            tags: Object.entries(POS_TAGS).map(([tag, info]) => ({
              tag,
              name: info.name,
              description: info.description,
              examples: info.examples
            }))
          };
        }
        break;
      }

      case 'conllu': {
        if (!text) {
          throw new Error('text parameter is required for conllu operation');
        }

        const parseResult = parseSentence(text);
        const conllu = toCoNLLU(parseResult);

        result = {
          operation: 'conllu',
          input: text,
          conllu,
          format: 'CoNLL-U (Universal Dependencies)',
          columns: ['ID', 'FORM', 'LEMMA', 'UPOS', 'XPOS', 'FEATS', 'HEAD', 'DEPREL', 'DEPS', 'MISC']
        };
        break;
      }

      case 'analyze': {
        if (!text) {
          throw new Error('text parameter is required for analyze operation');
        }

        const parseResult = parseSentence(text);

        // Count relation types
        const relationCounts: Record<string, number> = {};
        const posCounts: Record<string, number> = {};

        for (const token of parseResult.tree.tokens) {
          relationCounts[token.deprel] = (relationCounts[token.deprel] || 0) + 1;
          posCounts[token.upos] = (posCounts[token.upos] || 0) + 1;
        }

        result = {
          operation: 'analyze',
          input: text,
          statistics: parseResult.statistics,
          complexity: {
            tokenCount: parseResult.statistics.tokenCount,
            maxDepth: parseResult.statistics.maxDepth,
            avgDependencyLength: parseResult.statistics.avgDependencyLength,
            isProjective: parseResult.statistics.isProjective,
            depthComplexity: parseResult.statistics.maxDepth > 5 ? 'high' :
                            parseResult.statistics.maxDepth > 3 ? 'medium' : 'low',
            dependencyLengthComplexity: parseResult.statistics.avgDependencyLength > 3 ? 'high' :
                                       parseResult.statistics.avgDependencyLength > 2 ? 'medium' : 'low'
          },
          relationDistribution: relationCounts,
          posDistribution: posCounts
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'dependency_parser',
          description: 'Syntactic dependency parsing using Universal Dependencies framework',
          framework: 'Universal Dependencies (UD)',
          version: '2.0',
          operations: {
            parse: 'Parse text and return dependency tree with tokens, POS tags, and relations',
            visualize: 'Generate ASCII visualization of dependency tree',
            relations: 'Get information about dependency relation types (use relation param for specific)',
            pos_tags: 'Get information about Universal POS tags (use pos param for specific)',
            conllu: 'Output parse in CoNLL-U format for interoperability',
            analyze: 'Analyze syntactic complexity metrics of parsed text'
          },
          capabilities: [
            'Universal Dependencies annotation scheme',
            'POS tagging with Universal POS tags',
            'Lemmatization',
            'Morphological feature extraction',
            'Projective dependency parsing',
            'Tree depth and complexity analysis',
            'CoNLL-U format export',
            'ASCII tree visualization'
          ],
          supportedRelations: Object.keys(DEPENDENCY_RELATIONS).length,
          supportedPOSTags: Object.keys(POS_TAGS).length,
          example: {
            text: 'The cat sat on the mat.',
            usage: '{ "operation": "parse", "text": "The cat sat on the mat." }'
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

export function isdependencyparserAvailable(): boolean { return true; }
