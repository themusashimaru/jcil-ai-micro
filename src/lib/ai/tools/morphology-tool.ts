/**
 * MORPHOLOGY TOOL
 * Comprehensive linguistic morphology analysis - word structure, affixes, derivation, inflection
 *
 * Implements:
 * - Morpheme identification and segmentation
 * - Prefix, suffix, infix, circumfix analysis
 * - Derivational and inflectional morphology
 * - Word formation processes
 * - Allomorphy and morphophonology
 * - Cross-linguistic morphological typology
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// Morpheme types and structures
// =============================================================================

interface Morpheme {
  form: string;
  type: 'root' | 'prefix' | 'suffix' | 'infix' | 'circumfix';
  category: 'lexical' | 'derivational' | 'inflectional';
  meaning?: string;
  function?: string;
  allomorphs?: string[];
}

interface MorphologicalAnalysis {
  word: string;
  morphemes: Morpheme[];
  structure: string;
  wordClass: string;
  derivationHistory?: string[];
  inflectionalFeatures?: Record<string, string>;
}

// =============================================================================
// English affix databases
// =============================================================================

interface AffixEntry {
  form: string;
  type: 'prefix' | 'suffix';
  category: 'derivational' | 'inflectional';
  meaning: string;
  function: string;
  inputClass: string[];
  outputClass: string;
  allomorphs?: string[];
  examples: string[];
  restrictions?: string;
}

const ENGLISH_PREFIXES: Record<string, AffixEntry> = {
  // Negative prefixes
  'un-': {
    form: 'un-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'not, opposite of',
    function: 'negation',
    inputClass: ['adjective', 'verb'],
    outputClass: 'same',
    examples: ['unhappy', 'undo', 'unfair'],
    allomorphs: ['un-']
  },
  'in-': {
    form: 'in-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'not',
    function: 'negation',
    inputClass: ['adjective'],
    outputClass: 'adjective',
    allomorphs: ['in-', 'im-', 'il-', 'ir-'],
    examples: ['inactive', 'impossible', 'illegal', 'irregular'],
    restrictions: 'im- before b, m, p; il- before l; ir- before r'
  },
  'dis-': {
    form: 'dis-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'not, opposite, remove',
    function: 'negation/reversal',
    inputClass: ['verb', 'adjective', 'noun'],
    outputClass: 'same',
    examples: ['disagree', 'dislike', 'disconnect']
  },
  'non-': {
    form: 'non-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'not',
    function: 'negation',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['nonsense', 'nonfiction', 'nonviolent']
  },
  'a-': {
    form: 'a-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'not, without',
    function: 'negation',
    inputClass: ['adjective', 'noun'],
    outputClass: 'adjective',
    examples: ['amoral', 'atypical', 'asymmetric'],
    allomorphs: ['a-', 'an-'],
    restrictions: 'an- before vowels'
  },
  'anti-': {
    form: 'anti-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'against, opposite',
    function: 'opposition',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['antibody', 'antiwar', 'antisocial']
  },

  // Size/degree prefixes
  'super-': {
    form: 'super-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'above, beyond, superior',
    function: 'intensification',
    inputClass: ['noun', 'adjective', 'verb'],
    outputClass: 'same',
    examples: ['superhero', 'supernatural', 'supercharge']
  },
  'ultra-': {
    form: 'ultra-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'beyond, extreme',
    function: 'intensification',
    inputClass: ['adjective', 'noun'],
    outputClass: 'same',
    examples: ['ultramodern', 'ultraviolet', 'ultrasound']
  },
  'hyper-': {
    form: 'hyper-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'excessive, over',
    function: 'intensification',
    inputClass: ['adjective', 'noun'],
    outputClass: 'same',
    examples: ['hyperactive', 'hypersensitive', 'hypertext']
  },
  'sub-': {
    form: 'sub-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'under, below, lesser',
    function: 'diminution',
    inputClass: ['noun', 'adjective', 'verb'],
    outputClass: 'same',
    examples: ['submarine', 'substandard', 'subdivide']
  },
  'mini-': {
    form: 'mini-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'small',
    function: 'diminution',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ['miniskirt', 'minivan', 'miniseries']
  },
  'micro-': {
    form: 'micro-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'very small',
    function: 'diminution',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['microscope', 'microwave', 'microorganism']
  },
  'macro-': {
    form: 'macro-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'large',
    function: 'augmentation',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['macroeconomics', 'macroscopic']
  },

  // Time/order prefixes
  'pre-': {
    form: 'pre-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'before',
    function: 'temporal',
    inputClass: ['noun', 'verb', 'adjective'],
    outputClass: 'same',
    examples: ['preview', 'prewar', 'precondition']
  },
  'post-': {
    form: 'post-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'after',
    function: 'temporal',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['postwar', 'postmodern', 'postgraduate']
  },
  'ex-': {
    form: 'ex-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'former',
    function: 'temporal',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ['ex-president', 'ex-wife', 'ex-employee']
  },
  'neo-': {
    form: 'neo-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'new, modern',
    function: 'temporal',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['neoclassical', 'neoliberal', 'neonatal']
  },

  // Location/direction prefixes
  'inter-': {
    form: 'inter-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'between, among',
    function: 'locative',
    inputClass: ['noun', 'adjective', 'verb'],
    outputClass: 'same',
    examples: ['international', 'interact', 'interconnect']
  },
  'trans-': {
    form: 'trans-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'across, beyond',
    function: 'locative',
    inputClass: ['noun', 'verb', 'adjective'],
    outputClass: 'same',
    examples: ['transport', 'transatlantic', 'transform']
  },
  'extra-': {
    form: 'extra-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'outside, beyond',
    function: 'locative',
    inputClass: ['adjective', 'noun'],
    outputClass: 'same',
    examples: ['extraordinary', 'extracurricular', 'extraterrestrial']
  },
  'intra-': {
    form: 'intra-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'within',
    function: 'locative',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['intravenous', 'intramural', 'intrastate']
  },

  // Repetition/reversal
  're-': {
    form: 're-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'again, back',
    function: 'repetition',
    inputClass: ['verb'],
    outputClass: 'verb',
    examples: ['redo', 'rewrite', 'return', 'rebuild']
  },

  // Number prefixes
  'uni-': {
    form: 'uni-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'one',
    function: 'numeral',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['unicycle', 'uniform', 'unilateral']
  },
  'bi-': {
    form: 'bi-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'two',
    function: 'numeral',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['bicycle', 'bilingual', 'biannual']
  },
  'tri-': {
    form: 'tri-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'three',
    function: 'numeral',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['triangle', 'trilingual', 'triathlon']
  },
  'multi-': {
    form: 'multi-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'many',
    function: 'numeral',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['multicultural', 'multimedia', 'multilingual']
  },
  'poly-': {
    form: 'poly-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'many',
    function: 'numeral',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['polygon', 'polyglot', 'polysyllabic']
  },

  // Other derivational
  'co-': {
    form: 'co-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'together, with',
    function: 'associative',
    inputClass: ['noun', 'verb'],
    outputClass: 'same',
    examples: ['cooperate', 'coexist', 'co-author']
  },
  'auto-': {
    form: 'auto-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'self',
    function: 'reflexive',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['automobile', 'autobiography', 'automatic']
  },
  'semi-': {
    form: 'semi-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'half, partly',
    function: 'degree',
    inputClass: ['noun', 'adjective'],
    outputClass: 'same',
    examples: ['semicircle', 'semifinal', 'semiautomatic']
  },
  'mis-': {
    form: 'mis-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'wrong, bad',
    function: 'evaluative',
    inputClass: ['verb', 'noun'],
    outputClass: 'same',
    examples: ['misunderstand', 'misbehave', 'misfortune']
  },
  'over-': {
    form: 'over-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'excessive, above',
    function: 'intensification',
    inputClass: ['verb', 'adjective', 'noun'],
    outputClass: 'same',
    examples: ['overeat', 'overconfident', 'overlap']
  },
  'under-': {
    form: 'under-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'insufficient, below',
    function: 'diminution',
    inputClass: ['verb', 'adjective', 'noun'],
    outputClass: 'same',
    examples: ['underestimate', 'underpaid', 'underground']
  },
  'out-': {
    form: 'out-',
    type: 'prefix',
    category: 'derivational',
    meaning: 'surpass, external',
    function: 'comparative',
    inputClass: ['verb', 'noun'],
    outputClass: 'same',
    examples: ['outrun', 'outperform', 'outdoor']
  }
};

const ENGLISH_SUFFIXES: Record<string, AffixEntry> = {
  // Noun-forming suffixes (from verbs)
  '-tion': {
    form: '-tion',
    type: 'suffix',
    category: 'derivational',
    meaning: 'act/process of',
    function: 'nominalization',
    inputClass: ['verb'],
    outputClass: 'noun',
    allomorphs: ['-tion', '-sion', '-ation', '-ition'],
    examples: ['creation', 'decision', 'imagination', 'addition']
  },
  '-ment': {
    form: '-ment',
    type: 'suffix',
    category: 'derivational',
    meaning: 'act/result of',
    function: 'nominalization',
    inputClass: ['verb'],
    outputClass: 'noun',
    examples: ['development', 'agreement', 'movement']
  },
  '-er': {
    form: '-er',
    type: 'suffix',
    category: 'derivational',
    meaning: 'agent, one who',
    function: 'agentive',
    inputClass: ['verb'],
    outputClass: 'noun',
    allomorphs: ['-er', '-or', '-ar'],
    examples: ['teacher', 'actor', 'liar']
  },
  '-ee': {
    form: '-ee',
    type: 'suffix',
    category: 'derivational',
    meaning: 'recipient, one who receives',
    function: 'patient',
    inputClass: ['verb'],
    outputClass: 'noun',
    examples: ['employee', 'trainee', 'addressee']
  },
  '-ance': {
    form: '-ance',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/quality of',
    function: 'nominalization',
    inputClass: ['verb', 'adjective'],
    outputClass: 'noun',
    allomorphs: ['-ance', '-ence'],
    examples: ['importance', 'appearance', 'difference']
  },
  '-al': {
    form: '-al',
    type: 'suffix',
    category: 'derivational',
    meaning: 'act of',
    function: 'nominalization',
    inputClass: ['verb'],
    outputClass: 'noun',
    examples: ['arrival', 'refusal', 'approval']
  },

  // Noun-forming suffixes (from adjectives)
  '-ness': {
    form: '-ness',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/quality of',
    function: 'nominalization',
    inputClass: ['adjective'],
    outputClass: 'noun',
    examples: ['happiness', 'darkness', 'kindness']
  },
  '-ity': {
    form: '-ity',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/quality of',
    function: 'nominalization',
    inputClass: ['adjective'],
    outputClass: 'noun',
    examples: ['reality', 'possibility', 'activity']
  },
  '-th': {
    form: '-th',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/quality of',
    function: 'nominalization',
    inputClass: ['adjective'],
    outputClass: 'noun',
    examples: ['warmth', 'depth', 'length', 'width']
  },

  // Noun-forming suffixes (from nouns)
  '-hood': {
    form: '-hood',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/condition of',
    function: 'status',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ['childhood', 'neighborhood', 'brotherhood']
  },
  '-ship': {
    form: '-ship',
    type: 'suffix',
    category: 'derivational',
    meaning: 'state/condition/skill',
    function: 'status',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ['friendship', 'leadership', 'citizenship']
  },
  '-dom': {
    form: '-dom',
    type: 'suffix',
    category: 'derivational',
    meaning: 'domain/state of',
    function: 'status',
    inputClass: ['noun', 'adjective'],
    outputClass: 'noun',
    examples: ['kingdom', 'freedom', 'wisdom', 'boredom']
  },
  '-ist': {
    form: '-ist',
    type: 'suffix',
    category: 'derivational',
    meaning: 'one who practices/believes',
    function: 'agentive',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ['scientist', 'artist', 'capitalist']
  },
  '-ism': {
    form: '-ism',
    type: 'suffix',
    category: 'derivational',
    meaning: 'doctrine/practice/condition',
    function: 'abstract',
    inputClass: ['noun', 'adjective'],
    outputClass: 'noun',
    examples: ['capitalism', 'racism', 'criticism']
  },

  // Adjective-forming suffixes
  '-ful': {
    form: '-ful',
    type: 'suffix',
    category: 'derivational',
    meaning: 'full of',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    examples: ['beautiful', 'helpful', 'careful']
  },
  '-less': {
    form: '-less',
    type: 'suffix',
    category: 'derivational',
    meaning: 'without',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    examples: ['homeless', 'careless', 'hopeless']
  },
  '-able': {
    form: '-able',
    type: 'suffix',
    category: 'derivational',
    meaning: 'capable of being',
    function: 'adjectivization',
    inputClass: ['verb'],
    outputClass: 'adjective',
    allomorphs: ['-able', '-ible'],
    examples: ['readable', 'possible', 'flexible']
  },
  '-ous': {
    form: '-ous',
    type: 'suffix',
    category: 'derivational',
    meaning: 'having quality of',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    allomorphs: ['-ous', '-ious', '-eous'],
    examples: ['famous', 'spacious', 'gorgeous']
  },
  '-ive': {
    form: '-ive',
    type: 'suffix',
    category: 'derivational',
    meaning: 'having tendency/quality',
    function: 'adjectivization',
    inputClass: ['verb', 'noun'],
    outputClass: 'adjective',
    allomorphs: ['-ive', '-ative', '-itive'],
    examples: ['creative', 'talkative', 'competitive']
  },
  '-ic': {
    form: '-ic',
    type: 'suffix',
    category: 'derivational',
    meaning: 'pertaining to',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    allomorphs: ['-ic', '-ical'],
    examples: ['historic', 'historical', 'economic']
  },
  '-ish': {
    form: '-ish',
    type: 'suffix',
    category: 'derivational',
    meaning: 'somewhat, like',
    function: 'adjectivization',
    inputClass: ['noun', 'adjective'],
    outputClass: 'adjective',
    examples: ['childish', 'reddish', 'foolish']
  },
  '-y': {
    form: '-y',
    type: 'suffix',
    category: 'derivational',
    meaning: 'characterized by',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    examples: ['rainy', 'dirty', 'windy']
  },
  '-ly': {
    form: '-ly',
    type: 'suffix',
    category: 'derivational',
    meaning: 'having quality of',
    function: 'adjectivization',
    inputClass: ['noun'],
    outputClass: 'adjective',
    examples: ['friendly', 'lovely', 'cowardly']
  },

  // Adverb-forming suffix
  '-ly_adv': {
    form: '-ly',
    type: 'suffix',
    category: 'derivational',
    meaning: 'in manner of',
    function: 'adverbialization',
    inputClass: ['adjective'],
    outputClass: 'adverb',
    examples: ['quickly', 'happily', 'carefully']
  },

  // Verb-forming suffixes
  '-ize': {
    form: '-ize',
    type: 'suffix',
    category: 'derivational',
    meaning: 'make/become',
    function: 'verbalization',
    inputClass: ['noun', 'adjective'],
    outputClass: 'verb',
    allomorphs: ['-ize', '-ise'],
    examples: ['modernize', 'realize', 'organize']
  },
  '-ify': {
    form: '-ify',
    type: 'suffix',
    category: 'derivational',
    meaning: 'make/cause to be',
    function: 'verbalization',
    inputClass: ['noun', 'adjective'],
    outputClass: 'verb',
    examples: ['simplify', 'beautify', 'clarify']
  },
  '-en': {
    form: '-en',
    type: 'suffix',
    category: 'derivational',
    meaning: 'make/become',
    function: 'verbalization',
    inputClass: ['adjective'],
    outputClass: 'verb',
    examples: ['shorten', 'widen', 'strengthen']
  },

  // Inflectional suffixes
  '-s_plural': {
    form: '-s',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'plural',
    function: 'number',
    inputClass: ['noun'],
    outputClass: 'noun',
    allomorphs: ['-s', '-es', '-ies'],
    examples: ['cats', 'boxes', 'babies']
  },
  '-s_3sg': {
    form: '-s',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'third person singular present',
    function: 'agreement',
    inputClass: ['verb'],
    outputClass: 'verb',
    allomorphs: ['-s', '-es', '-ies'],
    examples: ['walks', 'watches', 'carries']
  },
  '-ed': {
    form: '-ed',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'past tense',
    function: 'tense',
    inputClass: ['verb'],
    outputClass: 'verb',
    allomorphs: ['-ed', '-d', '-t'],
    examples: ['walked', 'loved', 'kept']
  },
  '-ing': {
    form: '-ing',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'progressive/gerund',
    function: 'aspect',
    inputClass: ['verb'],
    outputClass: 'verb',
    examples: ['walking', 'running', 'singing']
  },
  '-er_comp': {
    form: '-er',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'comparative',
    function: 'comparison',
    inputClass: ['adjective'],
    outputClass: 'adjective',
    examples: ['taller', 'faster', 'bigger']
  },
  '-est': {
    form: '-est',
    type: 'suffix',
    category: 'inflectional',
    meaning: 'superlative',
    function: 'comparison',
    inputClass: ['adjective'],
    outputClass: 'adjective',
    examples: ['tallest', 'fastest', 'biggest']
  },
  "'s": {
    form: "'s",
    type: 'suffix',
    category: 'inflectional',
    meaning: 'possessive',
    function: 'case',
    inputClass: ['noun'],
    outputClass: 'noun',
    examples: ["John's", "the cat's", "my friend's"]
  }
};

// =============================================================================
// Word formation processes
// =============================================================================

interface WordFormation {
  name: string;
  description: string;
  mechanism: string;
  examples: Array<{ input: string; output: string; explanation: string }>;
}

const WORD_FORMATION_PROCESSES: Record<string, WordFormation> = {
  'derivation': {
    name: 'Derivation',
    description: 'Creating new words by adding derivational affixes',
    mechanism: 'Adding prefixes or suffixes to change word class or meaning',
    examples: [
      { input: 'happy', output: 'unhappy', explanation: 'prefix un- (negation)' },
      { input: 'happy', output: 'happiness', explanation: 'suffix -ness (nominalization)' },
      { input: 'teach', output: 'teacher', explanation: 'suffix -er (agentive)' }
    ]
  },
  'inflection': {
    name: 'Inflection',
    description: 'Modifying words to express grammatical features',
    mechanism: 'Adding inflectional suffixes for number, tense, case, etc.',
    examples: [
      { input: 'cat', output: 'cats', explanation: 'plural -s' },
      { input: 'walk', output: 'walked', explanation: 'past tense -ed' },
      { input: 'tall', output: 'taller', explanation: 'comparative -er' }
    ]
  },
  'compounding': {
    name: 'Compounding',
    description: 'Combining two or more free morphemes',
    mechanism: 'Joining words to create new compound words',
    examples: [
      { input: 'black + bird', output: 'blackbird', explanation: 'N+N compound' },
      { input: 'book + shelf', output: 'bookshelf', explanation: 'N+N compound' },
      { input: 'high + light', output: 'highlight', explanation: 'Adj+N compound' }
    ]
  },
  'conversion': {
    name: 'Conversion (Zero Derivation)',
    description: 'Changing word class without adding affixes',
    mechanism: 'Functional shift without overt morphological marking',
    examples: [
      { input: 'email (N)', output: 'email (V)', explanation: 'noun to verb' },
      { input: 'clean (Adj)', output: 'clean (V)', explanation: 'adjective to verb' },
      { input: 'run (V)', output: 'run (N)', explanation: 'verb to noun' }
    ]
  },
  'blending': {
    name: 'Blending',
    description: 'Combining parts of two words',
    mechanism: 'Merging beginnings/endings of words',
    examples: [
      { input: 'breakfast + lunch', output: 'brunch', explanation: 'br- + -unch' },
      { input: 'motor + hotel', output: 'motel', explanation: 'mo- + -tel' },
      { input: 'smoke + fog', output: 'smog', explanation: 'sm- + -og' }
    ]
  },
  'clipping': {
    name: 'Clipping',
    description: 'Shortening a word',
    mechanism: 'Removing part of a word',
    examples: [
      { input: 'advertisement', output: 'ad', explanation: 'back clipping' },
      { input: 'telephone', output: 'phone', explanation: 'fore clipping' },
      { input: 'influenza', output: 'flu', explanation: 'middle clipping' }
    ]
  },
  'backformation': {
    name: 'Back-formation',
    description: 'Creating a word by removing an affix',
    mechanism: 'Reverse derivation',
    examples: [
      { input: 'editor', output: 'edit', explanation: 'removing assumed -or' },
      { input: 'television', output: 'televise', explanation: 'removing assumed -ion' },
      { input: 'enthusiasm', output: 'enthuse', explanation: 'removing assumed -iasm' }
    ]
  },
  'acronym': {
    name: 'Acronym',
    description: 'Word formed from initial letters',
    mechanism: 'Using first letters of phrase words',
    examples: [
      { input: 'North Atlantic Treaty Organization', output: 'NATO', explanation: 'pronounced as word' },
      { input: 'self-contained underwater breathing apparatus', output: 'scuba', explanation: 'pronounced as word' },
      { input: 'radio detecting and ranging', output: 'radar', explanation: 'pronounced as word' }
    ]
  },
  'initialism': {
    name: 'Initialism',
    description: 'Abbreviation using initial letters',
    mechanism: 'Using first letters, pronounced separately',
    examples: [
      { input: 'Federal Bureau of Investigation', output: 'FBI', explanation: 'letters pronounced separately' },
      { input: 'United Nations', output: 'UN', explanation: 'letters pronounced separately' },
      { input: 'as soon as possible', output: 'ASAP', explanation: 'letters pronounced separately' }
    ]
  },
  'reduplication': {
    name: 'Reduplication',
    description: 'Repeating all or part of a word',
    mechanism: 'Full or partial repetition for emphasis or meaning change',
    examples: [
      { input: 'so-so', output: 'so-so', explanation: 'full reduplication' },
      { input: 'chitchat', output: 'chitchat', explanation: 'partial (ablaut) reduplication' },
      { input: 'teeny-weeny', output: 'teeny-weeny', explanation: 'rhyming reduplication' }
    ]
  }
};

// =============================================================================
// Morphological typology
// =============================================================================

interface LanguageTypology {
  type: string;
  description: string;
  characteristics: string[];
  examples: string[];
  morphemeWordRatio: string;
}

const MORPHOLOGICAL_TYPOLOGY: Record<string, LanguageTypology> = {
  'isolating': {
    type: 'Isolating (Analytic)',
    description: 'Languages with minimal morphology - mostly free morphemes',
    characteristics: [
      'One morpheme per word',
      'No inflectional affixes',
      'Grammatical relations expressed by word order and particles',
      'Few or no bound morphemes'
    ],
    examples: ['Mandarin Chinese', 'Vietnamese', 'Thai'],
    morphemeWordRatio: 'Close to 1:1'
  },
  'agglutinative': {
    type: 'Agglutinative',
    description: 'Languages with clearly segmentable morphemes',
    characteristics: [
      'Multiple morphemes per word',
      'Clear morpheme boundaries',
      'One meaning per morpheme',
      'Regular, predictable combinations'
    ],
    examples: ['Turkish', 'Japanese', 'Swahili', 'Finnish', 'Hungarian'],
    morphemeWordRatio: 'High (many morphemes per word)'
  },
  'fusional': {
    type: 'Fusional (Inflectional)',
    description: 'Languages where morphemes are fused together',
    characteristics: [
      'Multiple morphemes per word',
      'Morpheme boundaries not clear',
      'One morpheme may express multiple meanings',
      'Irregular allomorphy'
    ],
    examples: ['Latin', 'Russian', 'Spanish', 'German', 'Arabic'],
    morphemeWordRatio: 'Moderate to high'
  },
  'polysynthetic': {
    type: 'Polysynthetic',
    description: 'Languages with complex words expressing entire sentences',
    characteristics: [
      'Very many morphemes per word',
      'Incorporation of nouns into verbs',
      'Single words can express complete thoughts',
      'High degree of synthesis'
    ],
    examples: ['Mohawk', 'Inuktitut', 'Yupik'],
    morphemeWordRatio: 'Very high'
  }
};

// =============================================================================
// Morphological analysis functions
// =============================================================================

function segmentWord(word: string): MorphologicalAnalysis {
  const lowerWord = word.toLowerCase();
  const morphemes: Morpheme[] = [];
  const remaining = lowerWord;
  let wordClass = 'unknown';
  const derivationHistory: string[] = [];

  // Check for prefixes
  const prefixesFound: string[] = [];
  let prefixRemaining = remaining;

  for (const [prefixKey, prefix] of Object.entries(ENGLISH_PREFIXES)) {
    const prefixForm = prefixKey.replace('-', '');
    if (prefixRemaining.startsWith(prefixForm) && prefixRemaining.length > prefixForm.length) {
      prefixesFound.push(prefixKey);
      morphemes.push({
        form: prefixForm,
        type: 'prefix',
        category: prefix.category,
        meaning: prefix.meaning,
        function: prefix.function
      });
      prefixRemaining = prefixRemaining.slice(prefixForm.length);
      derivationHistory.push(`Added prefix ${prefixKey}: ${prefix.meaning}`);
    }
  }

  // Check for suffixes (from the end)
  let root = prefixRemaining;
  const suffixesFound: Array<{ key: string; entry: AffixEntry }> = [];

  // Try to find suffixes
  for (const [suffixKey, suffix] of Object.entries(ENGLISH_SUFFIXES)) {
    const suffixForm = suffixKey.replace(/-/g, '').replace(/_.*$/, '').replace("'", '');

    if (root.endsWith(suffixForm) && root.length > suffixForm.length) {
      const potentialRoot = root.slice(0, -suffixForm.length);
      // Only accept if root is at least 2 characters
      if (potentialRoot.length >= 2) {
        suffixesFound.push({ key: suffixKey, entry: suffix });
        root = potentialRoot;
      }
    }
  }

  // Add root morpheme
  morphemes.push({
    form: root,
    type: 'root',
    category: 'lexical',
    meaning: `Base form: ${root}`
  });

  // Add suffixes in correct order (closest to root first)
  for (const { key, entry } of suffixesFound.reverse()) {
    const suffixForm = key.replace(/-/g, '').replace(/_.*$/, '').replace("'", '');
    morphemes.push({
      form: suffixForm,
      type: 'suffix',
      category: entry.category,
      meaning: entry.meaning,
      function: entry.function
    });
    wordClass = entry.outputClass;
    derivationHistory.push(`Added suffix ${key}: ${entry.meaning}`);
  }

  // Build structure string
  const structureParts: string[] = [];
  for (const m of morphemes) {
    if (m.type === 'prefix') structureParts.push(`[${m.form}-]`);
    else if (m.type === 'root') structureParts.push(`[${m.form}]`);
    else if (m.type === 'suffix') structureParts.push(`[-${m.form}]`);
  }

  // Determine inflectional features
  const inflectionalFeatures: Record<string, string> = {};
  for (const m of morphemes) {
    if (m.category === 'inflectional') {
      if (m.form === 's' || m.form === 'es' || m.form === 'ies') {
        if (wordClass === 'verb') {
          inflectionalFeatures['Person'] = '3';
          inflectionalFeatures['Number'] = 'Singular';
          inflectionalFeatures['Tense'] = 'Present';
        } else {
          inflectionalFeatures['Number'] = 'Plural';
        }
      }
      if (m.form === 'ed') {
        inflectionalFeatures['Tense'] = 'Past';
      }
      if (m.form === 'ing') {
        inflectionalFeatures['Aspect'] = 'Progressive';
      }
      if (m.form === 'er') {
        inflectionalFeatures['Degree'] = 'Comparative';
      }
      if (m.form === 'est') {
        inflectionalFeatures['Degree'] = 'Superlative';
      }
    }
  }

  return {
    word,
    morphemes,
    structure: structureParts.join(' + '),
    wordClass: wordClass !== 'unknown' ? wordClass : 'noun',
    derivationHistory: derivationHistory.length > 0 ? derivationHistory : undefined,
    inflectionalFeatures: Object.keys(inflectionalFeatures).length > 0 ? inflectionalFeatures : undefined
  };
}

function derivationalAnalysis(base: string, targetAffix: string): Record<string, unknown> {
  const affixLower = targetAffix.toLowerCase().replace(/-/g, '');

  // Check prefixes
  const prefix = ENGLISH_PREFIXES[targetAffix] || ENGLISH_PREFIXES[`${targetAffix}-`];
  if (prefix) {
    const derived = affixLower + base;
    return {
      base,
      affix: targetAffix,
      affixType: 'prefix',
      derived,
      meaning: prefix.meaning,
      function: prefix.function,
      inputClass: prefix.inputClass,
      outputClass: prefix.outputClass,
      examples: prefix.examples
    };
  }

  // Check suffixes
  const suffix = ENGLISH_SUFFIXES[targetAffix] || ENGLISH_SUFFIXES[`-${targetAffix}`];
  if (suffix) {
    const derived = base + affixLower;
    return {
      base,
      affix: targetAffix,
      affixType: 'suffix',
      derived,
      meaning: suffix.meaning,
      function: suffix.function,
      inputClass: suffix.inputClass,
      outputClass: suffix.outputClass,
      examples: suffix.examples
    };
  }

  return {
    error: `Unknown affix: ${targetAffix}`,
    availablePrefixes: Object.keys(ENGLISH_PREFIXES),
    availableSuffixes: Object.keys(ENGLISH_SUFFIXES)
  };
}

function inflect(word: string, features: Record<string, string>): Record<string, unknown> {
  const results: Record<string, string> = {};

  // Number inflection for nouns
  if (features.number === 'plural') {
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
        word.endsWith('ch') || word.endsWith('sh')) {
      results.plural = word + 'es';
    } else if (word.endsWith('y') && !/[aeiou]y$/.test(word)) {
      results.plural = word.slice(0, -1) + 'ies';
    } else if (word.endsWith('f')) {
      results.plural = word.slice(0, -1) + 'ves';
    } else if (word.endsWith('fe')) {
      results.plural = word.slice(0, -2) + 'ves';
    } else {
      results.plural = word + 's';
    }
  }

  // Verb inflections
  if (features.tense === 'past') {
    if (word.endsWith('e')) {
      results.past = word + 'd';
    } else if (word.endsWith('y') && !/[aeiou]y$/.test(word)) {
      results.past = word.slice(0, -1) + 'ied';
    } else if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(word)) {
      results.past = word + word.slice(-1) + 'ed';
    } else {
      results.past = word + 'ed';
    }
  }

  if (features.tense === 'present' && features.person === '3' && features.number === 'singular') {
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
        word.endsWith('ch') || word.endsWith('sh')) {
      results['3sg'] = word + 'es';
    } else if (word.endsWith('y') && !/[aeiou]y$/.test(word)) {
      results['3sg'] = word.slice(0, -1) + 'ies';
    } else {
      results['3sg'] = word + 's';
    }
  }

  if (features.aspect === 'progressive') {
    if (word.endsWith('e') && !word.endsWith('ee')) {
      results.progressive = word.slice(0, -1) + 'ing';
    } else if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(word) && word.length <= 4) {
      results.progressive = word + word.slice(-1) + 'ing';
    } else {
      results.progressive = word + 'ing';
    }
  }

  // Adjective comparison
  if (features.degree === 'comparative') {
    if (word.endsWith('e')) {
      results.comparative = word + 'r';
    } else if (word.endsWith('y')) {
      results.comparative = word.slice(0, -1) + 'ier';
    } else if (/[aeiou][bcdfghjklmnpqrstvwxz]$/.test(word)) {
      results.comparative = word + word.slice(-1) + 'er';
    } else {
      results.comparative = word + 'er';
    }
  }

  if (features.degree === 'superlative') {
    if (word.endsWith('e')) {
      results.superlative = word + 'st';
    } else if (word.endsWith('y')) {
      results.superlative = word.slice(0, -1) + 'iest';
    } else if (/[aeiou][bcdfghjklmnpqrstvwxz]$/.test(word)) {
      results.superlative = word + word.slice(-1) + 'est';
    } else {
      results.superlative = word + 'est';
    }
  }

  return {
    base: word,
    requestedFeatures: features,
    inflectedForms: results,
    morphologicalRules: [
      'Regular English inflection rules applied',
      'Note: Irregular forms require lexical lookup'
    ]
  };
}

// =============================================================================
// Tool definition
// =============================================================================

export const morphologyTool: UnifiedTool = {
  name: 'morphology',
  description: `Linguistic morphology analysis - word structure, affixes, derivation, inflection.

Operations:
- parse: Segment a word into morphemes and analyze structure
- decompose: Break down word into prefix-root-suffix components
- derive: Apply derivational affix to create new word
- inflect: Generate inflected forms of a word
- affixes: Get information about English affixes (prefixes/suffixes)
- processes: Get information about word formation processes
- typology: Get information about morphological typology
- info: Documentation and usage information

Features:
- Morpheme segmentation and identification
- Derivational and inflectional morphology
- Word formation process analysis
- Cross-linguistic typology information
- Comprehensive affix databases`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'decompose', 'derive', 'inflect', 'affixes', 'processes', 'typology', 'info'],
        description: 'Operation to perform'
      },
      word: {
        type: 'string',
        description: 'Word to analyze'
      },
      affix: {
        type: 'string',
        description: 'Affix to apply (for derive operation)'
      },
      affixType: {
        type: 'string',
        enum: ['prefix', 'suffix', 'all'],
        description: 'Type of affix to look up'
      },
      features: {
        type: 'object',
        description: 'Grammatical features for inflection (e.g., {number: "plural", tense: "past"})'
      },
      process: {
        type: 'string',
        description: 'Word formation process to get info about'
      },
      languageType: {
        type: 'string',
        description: 'Morphological typology type to get info about'
      }
    },
    required: ['operation']
  }
};

export async function executemorphology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, word, affix, affixType, features, process, languageType } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'parse':
      case 'decompose': {
        if (!word) {
          throw new Error('word parameter is required for parse/decompose operation');
        }

        const analysis = segmentWord(word);

        result = {
          operation,
          ...analysis,
          morphemeCount: analysis.morphemes.length,
          hasPrefixes: analysis.morphemes.some(m => m.type === 'prefix'),
          hasSuffixes: analysis.morphemes.some(m => m.type === 'suffix'),
          derivationalCount: analysis.morphemes.filter(m => m.category === 'derivational').length,
          inflectionalCount: analysis.morphemes.filter(m => m.category === 'inflectional').length
        };
        break;
      }

      case 'derive': {
        if (!word || !affix) {
          throw new Error('word and affix parameters are required for derive operation');
        }

        result = {
          operation: 'derive',
          ...derivationalAnalysis(word, affix)
        };
        break;
      }

      case 'inflect': {
        if (!word || !features) {
          throw new Error('word and features parameters are required for inflect operation');
        }

        result = {
          operation: 'inflect',
          ...inflect(word, features as Record<string, string>)
        };
        break;
      }

      case 'affixes': {
        const type = affixType || 'all';

        if (affix) {
          // Look up specific affix
          const prefixEntry = ENGLISH_PREFIXES[affix] || ENGLISH_PREFIXES[`${affix}-`];
          const suffixEntry = ENGLISH_SUFFIXES[affix] || ENGLISH_SUFFIXES[`-${affix}`];

          if (prefixEntry) {
            result = {
              operation: 'affixes',
              affix,
              ...prefixEntry
            };
          } else if (suffixEntry) {
            result = {
              operation: 'affixes',
              affix,
              ...suffixEntry
            };
          } else {
            result = {
              operation: 'affixes',
              error: `Unknown affix: ${affix}`,
              availablePrefixes: Object.keys(ENGLISH_PREFIXES),
              availableSuffixes: Object.keys(ENGLISH_SUFFIXES)
            };
          }
        } else {
          // List all affixes
          const prefixes = type === 'all' || type === 'prefix' ?
            Object.entries(ENGLISH_PREFIXES).map(([name, entry]) => ({
              name,
              meaning: entry.meaning,
              function: entry.function,
              category: entry.category,
              outputClass: entry.outputClass
            })) : [];

          const suffixes = type === 'all' || type === 'suffix' ?
            Object.entries(ENGLISH_SUFFIXES).map(([name, entry]) => ({
              name,
              meaning: entry.meaning,
              function: entry.function,
              category: entry.category,
              outputClass: entry.outputClass
            })) : [];

          result = {
            operation: 'affixes',
            type,
            prefixCount: Object.keys(ENGLISH_PREFIXES).length,
            suffixCount: Object.keys(ENGLISH_SUFFIXES).length,
            prefixes,
            suffixes
          };
        }
        break;
      }

      case 'processes': {
        if (process) {
          const processInfo = WORD_FORMATION_PROCESSES[process.toLowerCase()];
          if (!processInfo) {
            result = {
              operation: 'processes',
              error: `Unknown word formation process: ${process}`,
              availableProcesses: Object.keys(WORD_FORMATION_PROCESSES)
            };
          } else {
            result = {
              operation: 'processes',
              process,
              ...processInfo
            };
          }
        } else {
          result = {
            operation: 'processes',
            totalProcesses: Object.keys(WORD_FORMATION_PROCESSES).length,
            processes: Object.entries(WORD_FORMATION_PROCESSES).map(([name, info]) => ({
              name,
              description: info.description,
              mechanism: info.mechanism,
              exampleCount: info.examples.length
            }))
          };
        }
        break;
      }

      case 'typology': {
        if (languageType) {
          const typeInfo = MORPHOLOGICAL_TYPOLOGY[languageType.toLowerCase()];
          if (!typeInfo) {
            result = {
              operation: 'typology',
              error: `Unknown typology: ${languageType}`,
              availableTypes: Object.keys(MORPHOLOGICAL_TYPOLOGY)
            };
          } else {
            result = {
              operation: 'typology',
              ...typeInfo
            };
          }
        } else {
          result = {
            operation: 'typology',
            description: 'Morphological typology classifies languages by their word structure',
            types: Object.entries(MORPHOLOGICAL_TYPOLOGY).map(([key, info]) => ({
              key,
              type: info.type,
              description: info.description,
              examples: info.examples,
              morphemeWordRatio: info.morphemeWordRatio
            }))
          };
        }
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'morphology',
          description: 'Linguistic morphology analysis for word structure and formation',
          operations: {
            parse: 'Segment word into morphemes with full analysis',
            decompose: 'Same as parse - break down word structure',
            derive: 'Apply derivational affix to create new word',
            inflect: 'Generate inflected forms with grammatical features',
            affixes: 'Get information about English affixes',
            processes: 'Get information about word formation processes',
            typology: 'Get information about morphological typology'
          },
          capabilities: [
            'Morpheme segmentation',
            'Prefix and suffix identification',
            'Derivational morphology',
            'Inflectional morphology',
            'Word formation processes',
            'Cross-linguistic typology'
          ],
          stats: {
            prefixes: Object.keys(ENGLISH_PREFIXES).length,
            suffixes: Object.keys(ENGLISH_SUFFIXES).length,
            wordFormationProcesses: Object.keys(WORD_FORMATION_PROCESSES).length,
            typologyTypes: Object.keys(MORPHOLOGICAL_TYPOLOGY).length
          },
          examples: [
            { usage: '{"operation": "parse", "word": "unhappiness"}' },
            { usage: '{"operation": "derive", "word": "happy", "affix": "un-"}' },
            { usage: '{"operation": "inflect", "word": "walk", "features": {"tense": "past"}}' }
          ]
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismorphologyAvailable(): boolean { return true; }
