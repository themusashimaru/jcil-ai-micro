/**
 * PHONETICS TOOL
 * Comprehensive phonetic analysis - IPA transcription, articulation, phonemes
 *
 * Implements:
 * - IPA (International Phonetic Alphabet) transcription
 * - Articulatory phonetics (place, manner, voicing)
 * - Phoneme inventory analysis
 * - Syllable structure
 * - Phonological processes
 * - Cross-linguistic comparison
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// IPA consonant and vowel databases
// =============================================================================

interface ConsonantInfo {
  symbol: string;
  name: string;
  place: string;
  manner: string;
  voicing: 'voiced' | 'voiceless';
  description: string;
  examples: { language: string; word: string; meaning?: string }[];
}

interface VowelInfo {
  symbol: string;
  name: string;
  height: 'close' | 'near-close' | 'close-mid' | 'mid' | 'open-mid' | 'near-open' | 'open';
  backness: 'front' | 'central' | 'back';
  roundness: 'rounded' | 'unrounded';
  description: string;
  examples: { language: string; word: string; meaning?: string }[];
}

const IPA_CONSONANTS: Record<string, ConsonantInfo> = {
  // Plosives (Stops)
  'p': {
    symbol: 'p',
    name: 'voiceless bilabial plosive',
    place: 'bilabial',
    manner: 'plosive',
    voicing: 'voiceless',
    description: 'Both lips come together to completely block airflow, then release',
    examples: [
      { language: 'English', word: 'pin', meaning: 'a thin pointed piece' },
      { language: 'Spanish', word: 'padre', meaning: 'father' }
    ]
  },
  'b': {
    symbol: 'b',
    name: 'voiced bilabial plosive',
    place: 'bilabial',
    manner: 'plosive',
    voicing: 'voiced',
    description: 'Like [p] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'bin', meaning: 'container' },
      { language: 'French', word: 'bon', meaning: 'good' }
    ]
  },
  't': {
    symbol: 't',
    name: 'voiceless alveolar plosive',
    place: 'alveolar',
    manner: 'plosive',
    voicing: 'voiceless',
    description: 'Tongue tip touches alveolar ridge, blocks then releases airflow',
    examples: [
      { language: 'English', word: 'tin', meaning: 'a metal' },
      { language: 'German', word: 'Tag', meaning: 'day' }
    ]
  },
  'd': {
    symbol: 'd',
    name: 'voiced alveolar plosive',
    place: 'alveolar',
    manner: 'plosive',
    voicing: 'voiced',
    description: 'Like [t] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'din', meaning: 'loud noise' },
      { language: 'Spanish', word: 'dos', meaning: 'two' }
    ]
  },
  'k': {
    symbol: 'k',
    name: 'voiceless velar plosive',
    place: 'velar',
    manner: 'plosive',
    voicing: 'voiceless',
    description: 'Back of tongue touches soft palate, blocks then releases airflow',
    examples: [
      { language: 'English', word: 'kin', meaning: 'family' },
      { language: 'Italian', word: 'casa', meaning: 'house' }
    ]
  },
  'g': {
    symbol: 'g',
    name: 'voiced velar plosive',
    place: 'velar',
    manner: 'plosive',
    voicing: 'voiced',
    description: 'Like [k] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'go', meaning: 'to move' },
      { language: 'German', word: 'gut', meaning: 'good' }
    ]
  },
  'ʔ': {
    symbol: 'ʔ',
    name: 'glottal stop',
    place: 'glottal',
    manner: 'plosive',
    voicing: 'voiceless',
    description: 'Vocal cords come together briefly to stop airflow',
    examples: [
      { language: 'English', word: "uh-oh", meaning: 'interjection' },
      { language: 'Arabic', word: 'hamza', meaning: 'glottal stop letter' }
    ]
  },

  // Nasals
  'm': {
    symbol: 'm',
    name: 'bilabial nasal',
    place: 'bilabial',
    manner: 'nasal',
    voicing: 'voiced',
    description: 'Lips together, air flows through nose',
    examples: [
      { language: 'English', word: 'man', meaning: 'adult male' },
      { language: 'Japanese', word: 'mizu', meaning: 'water' }
    ]
  },
  'n': {
    symbol: 'n',
    name: 'alveolar nasal',
    place: 'alveolar',
    manner: 'nasal',
    voicing: 'voiced',
    description: 'Tongue tip at alveolar ridge, air flows through nose',
    examples: [
      { language: 'English', word: 'no', meaning: 'negative' },
      { language: 'Spanish', word: 'no', meaning: 'no' }
    ]
  },
  'ŋ': {
    symbol: 'ŋ',
    name: 'velar nasal',
    place: 'velar',
    manner: 'nasal',
    voicing: 'voiced',
    description: 'Back of tongue at soft palate, air flows through nose',
    examples: [
      { language: 'English', word: 'sing', meaning: 'to vocalize music' },
      { language: 'Vietnamese', word: 'ngay', meaning: 'immediately' }
    ]
  },
  'ɲ': {
    symbol: 'ɲ',
    name: 'palatal nasal',
    place: 'palatal',
    manner: 'nasal',
    voicing: 'voiced',
    description: 'Tongue body at hard palate, air flows through nose',
    examples: [
      { language: 'Spanish', word: 'año', meaning: 'year' },
      { language: 'Italian', word: 'gnocchi', meaning: 'potato dumplings' }
    ]
  },

  // Fricatives
  'f': {
    symbol: 'f',
    name: 'voiceless labiodental fricative',
    place: 'labiodental',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Lower lip touches upper teeth, air creates friction',
    examples: [
      { language: 'English', word: 'fin', meaning: 'fish appendage' },
      { language: 'French', word: 'femme', meaning: 'woman' }
    ]
  },
  'v': {
    symbol: 'v',
    name: 'voiced labiodental fricative',
    place: 'labiodental',
    manner: 'fricative',
    voicing: 'voiced',
    description: 'Like [f] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'vine', meaning: 'climbing plant' },
      { language: 'German', word: 'Wasser', meaning: 'water (in some dialects)' }
    ]
  },
  'θ': {
    symbol: 'θ',
    name: 'voiceless dental fricative',
    place: 'dental',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Tongue tip between teeth, air creates friction',
    examples: [
      { language: 'English', word: 'thin', meaning: 'not thick' },
      { language: 'Greek', word: 'θεός', meaning: 'god' }
    ]
  },
  'ð': {
    symbol: 'ð',
    name: 'voiced dental fricative',
    place: 'dental',
    manner: 'fricative',
    voicing: 'voiced',
    description: 'Like [θ] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'this', meaning: 'demonstrative' },
      { language: 'Icelandic', word: 'faðir', meaning: 'father' }
    ]
  },
  's': {
    symbol: 's',
    name: 'voiceless alveolar fricative',
    place: 'alveolar',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Tongue tip near alveolar ridge, air creates hissing',
    examples: [
      { language: 'English', word: 'sin', meaning: 'transgression' },
      { language: 'Spanish', word: 'sol', meaning: 'sun' }
    ]
  },
  'z': {
    symbol: 'z',
    name: 'voiced alveolar fricative',
    place: 'alveolar',
    manner: 'fricative',
    voicing: 'voiced',
    description: 'Like [s] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'zoo', meaning: 'animal park' },
      { language: 'French', word: 'zone', meaning: 'zone' }
    ]
  },
  'ʃ': {
    symbol: 'ʃ',
    name: 'voiceless postalveolar fricative',
    place: 'postalveolar',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Tongue blade near postalveolar region, lip rounding',
    examples: [
      { language: 'English', word: 'shin', meaning: 'front of leg' },
      { language: 'French', word: 'chat', meaning: 'cat' }
    ]
  },
  'ʒ': {
    symbol: 'ʒ',
    name: 'voiced postalveolar fricative',
    place: 'postalveolar',
    manner: 'fricative',
    voicing: 'voiced',
    description: 'Like [ʃ] but with vocal cord vibration',
    examples: [
      { language: 'English', word: 'measure', meaning: 'to determine size' },
      { language: 'French', word: 'je', meaning: 'I' }
    ]
  },
  'x': {
    symbol: 'x',
    name: 'voiceless velar fricative',
    place: 'velar',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Back of tongue near soft palate, air creates friction',
    examples: [
      { language: 'German', word: 'Bach', meaning: 'stream' },
      { language: 'Scottish', word: 'loch', meaning: 'lake' }
    ]
  },
  'h': {
    symbol: 'h',
    name: 'voiceless glottal fricative',
    place: 'glottal',
    manner: 'fricative',
    voicing: 'voiceless',
    description: 'Open glottis with friction from outgoing air',
    examples: [
      { language: 'English', word: 'hat', meaning: 'head covering' },
      { language: 'German', word: 'Haus', meaning: 'house' }
    ]
  },

  // Affricates
  'tʃ': {
    symbol: 'tʃ',
    name: 'voiceless postalveolar affricate',
    place: 'postalveolar',
    manner: 'affricate',
    voicing: 'voiceless',
    description: 'Starts as [t] and releases into [ʃ]',
    examples: [
      { language: 'English', word: 'chin', meaning: 'lower face' },
      { language: 'Spanish', word: 'mucho', meaning: 'much' }
    ]
  },
  'dʒ': {
    symbol: 'dʒ',
    name: 'voiced postalveolar affricate',
    place: 'postalveolar',
    manner: 'affricate',
    voicing: 'voiced',
    description: 'Starts as [d] and releases into [ʒ]',
    examples: [
      { language: 'English', word: 'gin', meaning: 'alcoholic drink' },
      { language: 'Italian', word: 'giorno', meaning: 'day' }
    ]
  },
  'ts': {
    symbol: 'ts',
    name: 'voiceless alveolar affricate',
    place: 'alveolar',
    manner: 'affricate',
    voicing: 'voiceless',
    description: 'Starts as [t] and releases into [s]',
    examples: [
      { language: 'German', word: 'Zeit', meaning: 'time' },
      { language: 'Japanese', word: 'tsunami', meaning: 'harbor wave' }
    ]
  },

  // Approximants
  'w': {
    symbol: 'w',
    name: 'voiced labio-velar approximant',
    place: 'labio-velar',
    manner: 'approximant',
    voicing: 'voiced',
    description: 'Lips rounded, back of tongue raised toward velum',
    examples: [
      { language: 'English', word: 'win', meaning: 'to succeed' },
      { language: 'French', word: 'oui', meaning: 'yes' }
    ]
  },
  'j': {
    symbol: 'j',
    name: 'voiced palatal approximant',
    place: 'palatal',
    manner: 'approximant',
    voicing: 'voiced',
    description: 'Tongue body raised toward hard palate',
    examples: [
      { language: 'English', word: 'yes', meaning: 'affirmative' },
      { language: 'German', word: 'ja', meaning: 'yes' }
    ]
  },
  'ɹ': {
    symbol: 'ɹ',
    name: 'voiced alveolar approximant',
    place: 'alveolar',
    manner: 'approximant',
    voicing: 'voiced',
    description: 'Tongue tip approaches but does not touch alveolar ridge',
    examples: [
      { language: 'English', word: 'run', meaning: 'to move quickly' }
    ]
  },
  'l': {
    symbol: 'l',
    name: 'voiced alveolar lateral approximant',
    place: 'alveolar',
    manner: 'lateral approximant',
    voicing: 'voiced',
    description: 'Tongue tip at alveolar ridge, air flows around sides',
    examples: [
      { language: 'English', word: 'let', meaning: 'to allow' },
      { language: 'Spanish', word: 'luz', meaning: 'light' }
    ]
  },

  // Trills and Flaps
  'r': {
    symbol: 'r',
    name: 'voiced alveolar trill',
    place: 'alveolar',
    manner: 'trill',
    voicing: 'voiced',
    description: 'Tongue tip vibrates against alveolar ridge',
    examples: [
      { language: 'Spanish', word: 'perro', meaning: 'dog' },
      { language: 'Italian', word: 'rosso', meaning: 'red' }
    ]
  },
  'ɾ': {
    symbol: 'ɾ',
    name: 'voiced alveolar tap/flap',
    place: 'alveolar',
    manner: 'flap',
    voicing: 'voiced',
    description: 'Tongue tip briefly taps alveolar ridge',
    examples: [
      { language: 'Spanish', word: 'pero', meaning: 'but' },
      { language: 'American English', word: 'butter', meaning: 'dairy product' }
    ]
  },
  'ʀ': {
    symbol: 'ʀ',
    name: 'voiced uvular trill',
    place: 'uvular',
    manner: 'trill',
    voicing: 'voiced',
    description: 'Uvula vibrates against back of tongue',
    examples: [
      { language: 'French', word: 'rouge', meaning: 'red' },
      { language: 'German', word: 'rot', meaning: 'red (in some dialects)' }
    ]
  }
};

const IPA_VOWELS: Record<string, VowelInfo> = {
  // Close vowels
  'i': {
    symbol: 'i',
    name: 'close front unrounded vowel',
    height: 'close',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Tongue high and front, lips spread',
    examples: [
      { language: 'English', word: 'see', meaning: 'to perceive with eyes' },
      { language: 'Spanish', word: 'mi', meaning: 'my' }
    ]
  },
  'y': {
    symbol: 'y',
    name: 'close front rounded vowel',
    height: 'close',
    backness: 'front',
    roundness: 'rounded',
    description: 'Like [i] but with rounded lips',
    examples: [
      { language: 'French', word: 'tu', meaning: 'you' },
      { language: 'German', word: 'über', meaning: 'over' }
    ]
  },
  'ɨ': {
    symbol: 'ɨ',
    name: 'close central unrounded vowel',
    height: 'close',
    backness: 'central',
    roundness: 'unrounded',
    description: 'Tongue high and central, lips neutral',
    examples: [
      { language: 'Russian', word: 'ты', meaning: 'you' },
      { language: 'Welsh', word: 'un', meaning: 'one' }
    ]
  },
  'u': {
    symbol: 'u',
    name: 'close back rounded vowel',
    height: 'close',
    backness: 'back',
    roundness: 'rounded',
    description: 'Tongue high and back, lips rounded',
    examples: [
      { language: 'English', word: 'too', meaning: 'also' },
      { language: 'Spanish', word: 'tu', meaning: 'your' }
    ]
  },

  // Near-close vowels
  'ɪ': {
    symbol: 'ɪ',
    name: 'near-close near-front unrounded vowel',
    height: 'near-close',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Slightly lower and more central than [i]',
    examples: [
      { language: 'English', word: 'bit', meaning: 'small piece' },
      { language: 'German', word: 'mit', meaning: 'with' }
    ]
  },
  'ʊ': {
    symbol: 'ʊ',
    name: 'near-close near-back rounded vowel',
    height: 'near-close',
    backness: 'back',
    roundness: 'rounded',
    description: 'Slightly lower and more central than [u]',
    examples: [
      { language: 'English', word: 'put', meaning: 'to place' },
      { language: 'German', word: 'Butter', meaning: 'butter' }
    ]
  },

  // Close-mid vowels
  'e': {
    symbol: 'e',
    name: 'close-mid front unrounded vowel',
    height: 'close-mid',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Tongue mid-high and front, lips spread',
    examples: [
      { language: 'Spanish', word: 'mesa', meaning: 'table' },
      { language: 'French', word: 'été', meaning: 'summer' }
    ]
  },
  'ø': {
    symbol: 'ø',
    name: 'close-mid front rounded vowel',
    height: 'close-mid',
    backness: 'front',
    roundness: 'rounded',
    description: 'Like [e] but with rounded lips',
    examples: [
      { language: 'French', word: 'feu', meaning: 'fire' },
      { language: 'German', word: 'schön', meaning: 'beautiful' }
    ]
  },
  'o': {
    symbol: 'o',
    name: 'close-mid back rounded vowel',
    height: 'close-mid',
    backness: 'back',
    roundness: 'rounded',
    description: 'Tongue mid-high and back, lips rounded',
    examples: [
      { language: 'Spanish', word: 'no', meaning: 'no' },
      { language: 'French', word: 'beau', meaning: 'beautiful' }
    ]
  },

  // Mid vowels
  'ə': {
    symbol: 'ə',
    name: 'mid central vowel (schwa)',
    height: 'mid',
    backness: 'central',
    roundness: 'unrounded',
    description: 'Neutral tongue position, most common vowel',
    examples: [
      { language: 'English', word: 'about', meaning: 'concerning' },
      { language: 'English', word: 'sofa', meaning: 'couch' }
    ]
  },

  // Open-mid vowels
  'ɛ': {
    symbol: 'ɛ',
    name: 'open-mid front unrounded vowel',
    height: 'open-mid',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Tongue mid-low and front, lips spread',
    examples: [
      { language: 'English', word: 'bed', meaning: 'furniture for sleeping' },
      { language: 'French', word: 'père', meaning: 'father' }
    ]
  },
  'œ': {
    symbol: 'œ',
    name: 'open-mid front rounded vowel',
    height: 'open-mid',
    backness: 'front',
    roundness: 'rounded',
    description: 'Like [ɛ] but with rounded lips',
    examples: [
      { language: 'French', word: 'peur', meaning: 'fear' },
      { language: 'German', word: 'öffnen', meaning: 'to open' }
    ]
  },
  'ʌ': {
    symbol: 'ʌ',
    name: 'open-mid back unrounded vowel',
    height: 'open-mid',
    backness: 'back',
    roundness: 'unrounded',
    description: 'Tongue mid-low and back, lips unrounded',
    examples: [
      { language: 'English', word: 'cup', meaning: 'drinking vessel' },
      { language: 'English', word: 'but', meaning: 'however' }
    ]
  },
  'ɔ': {
    symbol: 'ɔ',
    name: 'open-mid back rounded vowel',
    height: 'open-mid',
    backness: 'back',
    roundness: 'rounded',
    description: 'Tongue mid-low and back, lips rounded',
    examples: [
      { language: 'English', word: 'thought', meaning: 'idea' },
      { language: 'French', word: 'port', meaning: 'harbor' }
    ]
  },

  // Near-open vowels
  'æ': {
    symbol: 'æ',
    name: 'near-open front unrounded vowel',
    height: 'near-open',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Tongue low-front, mouth fairly open',
    examples: [
      { language: 'English', word: 'cat', meaning: 'feline animal' },
      { language: 'English', word: 'bad', meaning: 'not good' }
    ]
  },

  // Open vowels
  'a': {
    symbol: 'a',
    name: 'open front unrounded vowel',
    height: 'open',
    backness: 'front',
    roundness: 'unrounded',
    description: 'Tongue low and front, mouth open',
    examples: [
      { language: 'Spanish', word: 'casa', meaning: 'house' },
      { language: 'Italian', word: 'pasta', meaning: 'pasta' }
    ]
  },
  'ɑ': {
    symbol: 'ɑ',
    name: 'open back unrounded vowel',
    height: 'open',
    backness: 'back',
    roundness: 'unrounded',
    description: 'Tongue low and back, mouth open',
    examples: [
      { language: 'English', word: 'father', meaning: 'male parent' },
      { language: 'English', word: 'spa', meaning: 'health resort' }
    ]
  },
  'ɒ': {
    symbol: 'ɒ',
    name: 'open back rounded vowel',
    height: 'open',
    backness: 'back',
    roundness: 'rounded',
    description: 'Tongue low and back, lips rounded',
    examples: [
      { language: 'British English', word: 'lot', meaning: 'group' },
      { language: 'British English', word: 'cot', meaning: 'small bed' }
    ]
  }
};

// =============================================================================
// English word to IPA transcription
// =============================================================================

const ENGLISH_IPA_DICTIONARY: Record<string, string> = {
  // Common words
  'the': 'ðə',
  'a': 'ə',
  'an': 'æn',
  'is': 'ɪz',
  'are': 'ɑːr',
  'was': 'wʌz',
  'were': 'wɜːr',
  'be': 'biː',
  'been': 'biːn',
  'being': 'biːɪŋ',
  'have': 'hæv',
  'has': 'hæz',
  'had': 'hæd',
  'do': 'duː',
  'does': 'dʌz',
  'did': 'dɪd',
  'will': 'wɪl',
  'would': 'wʊd',
  'can': 'kæn',
  'could': 'kʊd',
  'should': 'ʃʊd',
  'may': 'meɪ',
  'might': 'maɪt',
  'must': 'mʌst',

  // Pronouns
  'i': 'aɪ',
  'you': 'juː',
  'he': 'hiː',
  'she': 'ʃiː',
  'it': 'ɪt',
  'we': 'wiː',
  'they': 'ðeɪ',
  'me': 'miː',
  'him': 'hɪm',
  'her': 'hɜːr',
  'us': 'ʌs',
  'them': 'ðem',

  // Common nouns
  'cat': 'kæt',
  'dog': 'dɒɡ',
  'house': 'haʊs',
  'car': 'kɑːr',
  'book': 'bʊk',
  'water': 'wɔːtər',
  'food': 'fuːd',
  'time': 'taɪm',
  'day': 'deɪ',
  'night': 'naɪt',
  'year': 'jɪər',
  'man': 'mæn',
  'woman': 'wʊmən',
  'child': 'tʃaɪld',
  'world': 'wɜːrld',
  'life': 'laɪf',
  'hand': 'hænd',
  'part': 'pɑːrt',
  'place': 'pleɪs',
  'case': 'keɪs',
  'week': 'wiːk',
  'company': 'kʌmpəni',
  'system': 'sɪstəm',
  'program': 'proʊɡræm',
  'question': 'kwɛstʃən',
  'work': 'wɜːrk',
  'government': 'ɡʌvərnmənt',
  'number': 'nʌmbər',
  'school': 'skuːl',
  'family': 'fæmɪli',
  'country': 'kʌntri',
  'point': 'pɔɪnt',
  'home': 'hoʊm',
  'mother': 'mʌðər',
  'father': 'fɑːðər',

  // Common verbs
  'go': 'ɡoʊ',
  'come': 'kʌm',
  'see': 'siː',
  'know': 'noʊ',
  'get': 'ɡet',
  'make': 'meɪk',
  'take': 'teɪk',
  'say': 'seɪ',
  'think': 'θɪŋk',
  'look': 'lʊk',
  'want': 'wɒnt',
  'use': 'juːz',
  'find': 'faɪnd',
  'give': 'ɡɪv',
  'tell': 'tel',
  'work': 'wɜːrk',
  'call': 'kɔːl',
  'try': 'traɪ',
  'ask': 'æsk',
  'need': 'niːd',
  'feel': 'fiːl',
  'become': 'bɪkʌm',
  'leave': 'liːv',
  'put': 'pʊt',
  'mean': 'miːn',
  'keep': 'kiːp',
  'let': 'let',
  'begin': 'bɪɡɪn',
  'seem': 'siːm',
  'help': 'help',
  'show': 'ʃoʊ',
  'hear': 'hɪər',
  'play': 'pleɪ',
  'run': 'rʌn',
  'move': 'muːv',
  'live': 'lɪv',
  'believe': 'bɪliːv',

  // Common adjectives
  'good': 'ɡʊd',
  'new': 'njuː',
  'first': 'fɜːrst',
  'last': 'læst',
  'long': 'lɒŋ',
  'great': 'ɡreɪt',
  'little': 'lɪtl',
  'other': 'ʌðər',
  'old': 'oʊld',
  'right': 'raɪt',
  'big': 'bɪɡ',
  'high': 'haɪ',
  'different': 'dɪfərənt',
  'small': 'smɔːl',
  'large': 'lɑːrdʒ',
  'next': 'nekst',
  'early': 'ɜːrli',
  'young': 'jʌŋ',
  'important': 'ɪmpɔːrtənt',
  'few': 'fjuː',
  'public': 'pʌblɪk',
  'bad': 'bæd',
  'same': 'seɪm',
  'able': 'eɪbl',

  // Demonstratives
  'this': 'ðɪs',
  'that': 'ðæt',
  'these': 'ðiːz',
  'those': 'ðoʊz',

  // Question words
  'what': 'wɒt',
  'which': 'wɪtʃ',
  'who': 'huː',
  'when': 'wen',
  'where': 'weər',
  'why': 'waɪ',
  'how': 'haʊ',

  // Prepositions
  'in': 'ɪn',
  'on': 'ɒn',
  'at': 'æt',
  'to': 'tuː',
  'for': 'fɔːr',
  'with': 'wɪð',
  'by': 'baɪ',
  'from': 'frɒm',
  'of': 'ɒv',
  'about': 'əbaʊt',

  // Example words for phonetics
  'hello': 'həloʊ',
  'phonetics': 'fənetɪks',
  'language': 'læŋɡwɪdʒ',
  'pronunciation': 'prənʌnsieɪʃən',
  'beautiful': 'bjuːtɪfʊl',
  'interesting': 'ɪntrəstɪŋ',
  'computer': 'kəmpjuːtər',
  'example': 'ɪɡzæmpl',
  'through': 'θruː',
  'thought': 'θɔːt',
  'enough': 'ɪnʌf',
  'although': 'ɔːlðoʊ'
};

// =============================================================================
// Phonological processes
// =============================================================================

interface PhonologicalProcess {
  name: string;
  description: string;
  examples: Array<{ input: string; output: string; explanation: string }>;
}

const PHONOLOGICAL_PROCESSES: Record<string, PhonologicalProcess> = {
  'assimilation': {
    name: 'Assimilation',
    description: 'A sound becomes more similar to a neighboring sound',
    examples: [
      { input: 'in- + possible', output: 'impossible', explanation: 'n → m before bilabial' },
      { input: 'ten bats', output: '[tem bæts]', explanation: 'n → m before b' },
      { input: 'good boy', output: '[gʊb bɔɪ]', explanation: 'd → b before b' }
    ]
  },
  'dissimilation': {
    name: 'Dissimilation',
    description: 'A sound becomes less similar to a neighboring sound',
    examples: [
      { input: 'Latin: arbor', output: 'Spanish: árbol', explanation: 'r...r → r...l' },
      { input: 'pilgrim', output: 'pilgrim (from peregrinus)', explanation: 'r...r → l...r' }
    ]
  },
  'elision': {
    name: 'Elision (Deletion)',
    description: 'A sound is deleted',
    examples: [
      { input: 'different', output: '[dɪfrənt]', explanation: 'Middle vowel often deleted' },
      { input: 'probably', output: '[prɒbli]', explanation: 'Second syllable often reduced' },
      { input: 'I am', output: "I'm", explanation: 'Vowel deletion in contractions' }
    ]
  },
  'epenthesis': {
    name: 'Epenthesis (Insertion)',
    description: 'A sound is inserted',
    examples: [
      { input: 'hamster', output: '[hæmpstər]', explanation: 'p inserted between m and s' },
      { input: 'something', output: '[sʌmpθɪŋ]', explanation: 'p inserted' },
      { input: 'sense', output: '[sents]', explanation: 't inserted between n and s' }
    ]
  },
  'metathesis': {
    name: 'Metathesis',
    description: 'Sounds change position',
    examples: [
      { input: 'ask', output: '[æks]', explanation: 'Historical/dialectal switch of s and k' },
      { input: 'comfortable', output: '[kʌmftəbl]', explanation: 'Reordering and reduction' },
      { input: 'nuclear', output: '[nukjələr]', explanation: 'Common metathesis (nonstandard)' }
    ]
  },
  'palatalization': {
    name: 'Palatalization',
    description: 'A consonant becomes palatal before front vowels',
    examples: [
      { input: 'did you', output: '[dɪdʒu]', explanation: 'd + j → dʒ' },
      { input: 'nature', output: '[neɪtʃər]', explanation: 't + j → tʃ' },
      { input: "what's your", output: '[wɒtʃər]', explanation: 't + j → tʃ' }
    ]
  },
  'voicing': {
    name: 'Voicing/Devoicing',
    description: 'Voiced sounds become voiceless or vice versa',
    examples: [
      { input: 'dogs', output: '[dɒgz]', explanation: 's → z after voiced sound' },
      { input: 'cats', output: '[kæts]', explanation: 's stays voiceless after voiceless' },
      { input: 'have to', output: '[hæf tuː]', explanation: 'v → f before voiceless t' }
    ]
  },
  'reduction': {
    name: 'Vowel Reduction',
    description: 'Unstressed vowels become schwa',
    examples: [
      { input: 'photograph', output: '[foʊtəgræf]', explanation: 'First o → [oʊ], second o → [ə]' },
      { input: 'photography', output: '[fətɒgrəfi]', explanation: 'Different syllable stressed' },
      { input: 'the', output: '[ðə]', explanation: 'Vowel reduces to schwa' }
    ]
  },
  'flapping': {
    name: 'Flapping',
    description: 't and d become flap [ɾ] between vowels (American English)',
    examples: [
      { input: 'butter', output: '[bʌɾər]', explanation: 't → ɾ between vowels' },
      { input: 'ladder', output: '[læɾər]', explanation: 'd → ɾ between vowels' },
      { input: 'water', output: '[wɔːɾər]', explanation: 't → ɾ after vowel' }
    ]
  },
  'aspiration': {
    name: 'Aspiration',
    description: 'A puff of air follows voiceless stops',
    examples: [
      { input: 'pin', output: '[pʰɪn]', explanation: 'p aspirated word-initially' },
      { input: 'spin', output: '[spɪn]', explanation: 'p not aspirated after s' },
      { input: 'top', output: '[tʰɒp]', explanation: 't aspirated word-initially' }
    ]
  }
};

// =============================================================================
// Places and manners of articulation
// =============================================================================

const PLACES_OF_ARTICULATION = [
  { name: 'Bilabial', description: 'Both lips', examples: ['p', 'b', 'm'] },
  { name: 'Labiodental', description: 'Lower lip and upper teeth', examples: ['f', 'v'] },
  { name: 'Dental', description: 'Tongue and teeth', examples: ['θ', 'ð'] },
  { name: 'Alveolar', description: 'Tongue and alveolar ridge', examples: ['t', 'd', 's', 'z', 'n', 'l'] },
  { name: 'Postalveolar', description: 'Behind alveolar ridge', examples: ['ʃ', 'ʒ', 'tʃ', 'dʒ'] },
  { name: 'Retroflex', description: 'Tongue tip curled back', examples: ['ɻ', 'ʈ', 'ɖ'] },
  { name: 'Palatal', description: 'Tongue body and hard palate', examples: ['j', 'ɲ'] },
  { name: 'Velar', description: 'Tongue back and soft palate', examples: ['k', 'g', 'ŋ'] },
  { name: 'Uvular', description: 'Tongue back and uvula', examples: ['q', 'ʀ'] },
  { name: 'Pharyngeal', description: 'Pharynx', examples: ['ħ', 'ʕ'] },
  { name: 'Glottal', description: 'Vocal cords', examples: ['h', 'ʔ'] }
];

const MANNERS_OF_ARTICULATION = [
  { name: 'Plosive (Stop)', description: 'Complete closure then release', examples: ['p', 'b', 't', 'd', 'k', 'g'] },
  { name: 'Nasal', description: 'Air through nose', examples: ['m', 'n', 'ŋ'] },
  { name: 'Trill', description: 'Vibration of articulator', examples: ['r', 'ʀ'] },
  { name: 'Tap/Flap', description: 'Brief contact', examples: ['ɾ'] },
  { name: 'Fricative', description: 'Turbulent airflow', examples: ['f', 'v', 's', 'z', 'ʃ', 'ʒ'] },
  { name: 'Lateral Fricative', description: 'Friction around tongue sides', examples: ['ɬ', 'ɮ'] },
  { name: 'Approximant', description: 'Narrowing without turbulence', examples: ['w', 'j', 'ɹ'] },
  { name: 'Lateral Approximant', description: 'Air around tongue sides', examples: ['l'] },
  { name: 'Affricate', description: 'Stop + fricative', examples: ['tʃ', 'dʒ', 'ts'] }
];

// =============================================================================
// Functions
// =============================================================================

function transcribeWord(word: string): { word: string; ipa: string; found: boolean } {
  const lowerWord = word.toLowerCase();
  const ipa = ENGLISH_IPA_DICTIONARY[lowerWord];

  if (ipa) {
    return { word, ipa: `/${ipa}/`, found: true };
  }

  // Try simple phonetic approximation for unknown words
  let approximation = '';
  for (const char of lowerWord) {
    const mapping: Record<string, string> = {
      'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɒ', 'u': 'ʌ',
      'b': 'b', 'c': 'k', 'd': 'd', 'f': 'f', 'g': 'ɡ',
      'h': 'h', 'j': 'dʒ', 'k': 'k', 'l': 'l', 'm': 'm',
      'n': 'n', 'p': 'p', 'q': 'kw', 'r': 'ɹ', 's': 's',
      't': 't', 'v': 'v', 'w': 'w', 'x': 'ks', 'y': 'j', 'z': 'z'
    };
    approximation += mapping[char] || char;
  }

  return {
    word,
    ipa: `[${approximation}]`,
    found: false
  };
}

function getArticulation(symbol: string): Record<string, unknown> | null {
  const consonant = IPA_CONSONANTS[symbol];
  if (consonant) {
    return {
      type: 'consonant',
      symbol: consonant.symbol,
      name: consonant.name,
      place: consonant.place,
      manner: consonant.manner,
      voicing: consonant.voicing,
      description: consonant.description,
      examples: consonant.examples
    };
  }

  const vowel = IPA_VOWELS[symbol];
  if (vowel) {
    return {
      type: 'vowel',
      symbol: vowel.symbol,
      name: vowel.name,
      height: vowel.height,
      backness: vowel.backness,
      roundness: vowel.roundness,
      description: vowel.description,
      examples: vowel.examples
    };
  }

  return null;
}

function analyzePhonemes(word: string): Record<string, unknown> {
  const lowerWord = word.toLowerCase();
  const ipa = ENGLISH_IPA_DICTIONARY[lowerWord];

  if (!ipa) {
    return {
      word,
      error: 'Word not found in dictionary',
      suggestion: 'Use transcribe operation for approximation'
    };
  }

  const phonemes: Array<Record<string, unknown>> = [];
  const symbols = [...ipa];

  for (let i = 0; i < symbols.length; i++) {
    let symbol = symbols[i];

    // Check for digraphs/diacritics
    if (i < symbols.length - 1) {
      const digraph = symbol + symbols[i + 1];
      if (IPA_CONSONANTS[digraph]) {
        symbol = digraph;
        i++;
      }
    }

    const info = getArticulation(symbol);
    if (info) {
      phonemes.push(info);
    } else if (symbol === 'ː') {
      // Length mark - modify previous
      if (phonemes.length > 0) {
        (phonemes[phonemes.length - 1] as Record<string, unknown>).length = 'long';
      }
    }
  }

  return {
    word,
    ipa: `/${ipa}/`,
    phonemeCount: phonemes.length,
    consonants: phonemes.filter(p => p.type === 'consonant').length,
    vowels: phonemes.filter(p => p.type === 'vowel').length,
    phonemes
  };
}

function comparePhonemes(sound1: string, sound2: string): Record<string, unknown> {
  const info1 = getArticulation(sound1);
  const info2 = getArticulation(sound2);

  if (!info1) {
    return { error: `Unknown IPA symbol: ${sound1}` };
  }
  if (!info2) {
    return { error: `Unknown IPA symbol: ${sound2}` };
  }

  const differences: string[] = [];
  const similarities: string[] = [];

  if (info1.type !== info2.type) {
    differences.push(`Type: ${info1.type} vs ${info2.type}`);
  } else {
    similarities.push(`Both are ${info1.type}s`);

    if (info1.type === 'consonant') {
      if (info1.place === info2.place) {
        similarities.push(`Same place of articulation: ${info1.place}`);
      } else {
        differences.push(`Place: ${info1.place} vs ${info2.place}`);
      }

      if (info1.manner === info2.manner) {
        similarities.push(`Same manner of articulation: ${info1.manner}`);
      } else {
        differences.push(`Manner: ${info1.manner} vs ${info2.manner}`);
      }

      if (info1.voicing === info2.voicing) {
        similarities.push(`Same voicing: ${info1.voicing}`);
      } else {
        differences.push(`Voicing: ${info1.voicing} vs ${info2.voicing}`);
      }
    } else {
      if (info1.height === info2.height) {
        similarities.push(`Same height: ${info1.height}`);
      } else {
        differences.push(`Height: ${info1.height} vs ${info2.height}`);
      }

      if (info1.backness === info2.backness) {
        similarities.push(`Same backness: ${info1.backness}`);
      } else {
        differences.push(`Backness: ${info1.backness} vs ${info2.backness}`);
      }

      if (info1.roundness === info2.roundness) {
        similarities.push(`Same roundness: ${info1.roundness}`);
      } else {
        differences.push(`Roundness: ${info1.roundness} vs ${info2.roundness}`);
      }
    }
  }

  return {
    sound1: { symbol: sound1, ...info1 },
    sound2: { symbol: sound2, ...info2 },
    similarities,
    differences,
    minimalPairPotential: differences.length === 1
  };
}

// =============================================================================
// Tool definition
// =============================================================================

export const phoneticsTool: UnifiedTool = {
  name: 'phonetics',
  description: `Phonetic analysis - IPA transcription, articulation, phonemes.

Operations:
- transcribe: Convert English word to IPA transcription
- articulation: Get articulatory description of IPA symbol
- phoneme_analysis: Analyze phonemes in a word
- compare: Compare two IPA sounds
- consonants: List IPA consonant chart
- vowels: List IPA vowel chart
- processes: Get information about phonological processes
- places: List places of articulation
- manners: List manners of articulation
- info: Documentation and usage information

Features:
- IPA symbol database with descriptions
- Articulatory phonetics (place, manner, voicing)
- Vowel chart (height, backness, roundness)
- Phonological processes
- Cross-linguistic examples`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['transcribe', 'articulation', 'phoneme_analysis', 'compare', 'consonants', 'vowels', 'processes', 'places', 'manners', 'info'],
        description: 'Operation to perform'
      },
      word: {
        type: 'string',
        description: 'Word to transcribe or analyze'
      },
      symbol: {
        type: 'string',
        description: 'IPA symbol to look up'
      },
      sound1: {
        type: 'string',
        description: 'First IPA sound for comparison'
      },
      sound2: {
        type: 'string',
        description: 'Second IPA sound for comparison'
      },
      process: {
        type: 'string',
        description: 'Phonological process to get info about'
      }
    },
    required: ['operation']
  }
};

export async function executephonetics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, word, symbol, sound1, sound2, process } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'transcribe': {
        if (!word) {
          throw new Error('word parameter is required for transcribe operation');
        }

        const words = word.split(/\s+/);
        const transcriptions = words.map((w: string) => transcribeWord(w));

        result = {
          operation: 'transcribe',
          input: word,
          transcription: transcriptions.map(t => t.ipa).join(' '),
          details: transcriptions,
          notation: 'Slashes // indicate phonemic transcription (from dictionary), brackets [] indicate approximation'
        };
        break;
      }

      case 'articulation': {
        if (!symbol) {
          throw new Error('symbol parameter is required for articulation operation');
        }

        const info = getArticulation(symbol);
        if (!info) {
          result = {
            operation: 'articulation',
            error: `Unknown IPA symbol: ${symbol}`,
            availableConsonants: Object.keys(IPA_CONSONANTS),
            availableVowels: Object.keys(IPA_VOWELS)
          };
        } else {
          result = {
            operation: 'articulation',
            ...info
          };
        }
        break;
      }

      case 'phoneme_analysis': {
        if (!word) {
          throw new Error('word parameter is required for phoneme_analysis operation');
        }

        result = {
          operation: 'phoneme_analysis',
          ...analyzePhonemes(word)
        };
        break;
      }

      case 'compare': {
        if (!sound1 || !sound2) {
          throw new Error('sound1 and sound2 parameters are required for compare operation');
        }

        result = {
          operation: 'compare',
          ...comparePhonemes(sound1, sound2)
        };
        break;
      }

      case 'consonants': {
        const consonantsByPlace: Record<string, Array<{ symbol: string; name: string; manner: string; voicing: string }>> = {};

        for (const [sym, info] of Object.entries(IPA_CONSONANTS)) {
          if (!consonantsByPlace[info.place]) {
            consonantsByPlace[info.place] = [];
          }
          consonantsByPlace[info.place].push({
            symbol: sym,
            name: info.name,
            manner: info.manner,
            voicing: info.voicing
          });
        }

        result = {
          operation: 'consonants',
          totalConsonants: Object.keys(IPA_CONSONANTS).length,
          byPlace: consonantsByPlace,
          places: PLACES_OF_ARTICULATION.map(p => p.name),
          manners: MANNERS_OF_ARTICULATION.map(m => m.name)
        };
        break;
      }

      case 'vowels': {
        const vowelsByHeight: Record<string, Array<{ symbol: string; name: string; backness: string; roundness: string }>> = {};

        for (const [sym, info] of Object.entries(IPA_VOWELS)) {
          if (!vowelsByHeight[info.height]) {
            vowelsByHeight[info.height] = [];
          }
          vowelsByHeight[info.height].push({
            symbol: sym,
            name: info.name,
            backness: info.backness,
            roundness: info.roundness
          });
        }

        result = {
          operation: 'vowels',
          totalVowels: Object.keys(IPA_VOWELS).length,
          byHeight: vowelsByHeight,
          heights: ['close', 'near-close', 'close-mid', 'mid', 'open-mid', 'near-open', 'open'],
          backness: ['front', 'central', 'back']
        };
        break;
      }

      case 'processes': {
        if (process) {
          const processInfo = PHONOLOGICAL_PROCESSES[process.toLowerCase()];
          if (!processInfo) {
            result = {
              operation: 'processes',
              error: `Unknown phonological process: ${process}`,
              availableProcesses: Object.keys(PHONOLOGICAL_PROCESSES)
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
            totalProcesses: Object.keys(PHONOLOGICAL_PROCESSES).length,
            processes: Object.entries(PHONOLOGICAL_PROCESSES).map(([name, info]) => ({
              name,
              description: info.description,
              exampleCount: info.examples.length
            }))
          };
        }
        break;
      }

      case 'places': {
        result = {
          operation: 'places',
          description: 'Places of articulation - where in the vocal tract constriction occurs',
          places: PLACES_OF_ARTICULATION
        };
        break;
      }

      case 'manners': {
        result = {
          operation: 'manners',
          description: 'Manners of articulation - how airflow is modified',
          manners: MANNERS_OF_ARTICULATION
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'phonetics',
          description: 'Phonetic analysis using International Phonetic Alphabet (IPA)',
          operations: {
            transcribe: 'Convert English word to IPA transcription',
            articulation: 'Get articulatory description of IPA symbol',
            phoneme_analysis: 'Analyze all phonemes in a word',
            compare: 'Compare two IPA sounds',
            consonants: 'List IPA consonant inventory',
            vowels: 'List IPA vowel inventory',
            processes: 'Get information about phonological processes',
            places: 'List places of articulation',
            manners: 'List manners of articulation'
          },
          capabilities: [
            'IPA transcription',
            'Articulatory phonetics',
            'Vowel and consonant charts',
            'Phonological processes',
            'Cross-linguistic examples'
          ],
          stats: {
            consonants: Object.keys(IPA_CONSONANTS).length,
            vowels: Object.keys(IPA_VOWELS).length,
            dictionaryEntries: Object.keys(ENGLISH_IPA_DICTIONARY).length,
            phonologicalProcesses: Object.keys(PHONOLOGICAL_PROCESSES).length
          },
          examples: [
            { usage: '{"operation": "transcribe", "word": "hello"}' },
            { usage: '{"operation": "articulation", "symbol": "θ"}' },
            { usage: '{"operation": "compare", "sound1": "p", "sound2": "b"}' }
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

export function isphoneticsAvailable(): boolean { return true; }
