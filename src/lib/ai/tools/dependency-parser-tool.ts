/**
 * DEPENDENCY-PARSER TOOL
 * Syntactic dependency parsing using Universal Dependencies
 * Implements rule-based dependency parsing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const dependencyparserTool: UnifiedTool = {
  name: 'dependency_parser',
  description: 'Syntactic dependency parsing for sentence structure',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'visualize', 'analyze', 'demo', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Sentence to parse'
      },
      format: {
        type: 'string',
        enum: ['tree', 'conll', 'json'],
        description: 'Output format (default: tree)'
      }
    },
    required: ['operation']
  }
};

// Universal Dependencies relation types
const UD_RELATIONS = {
  // Core arguments
  nsubj: 'nominal subject',
  obj: 'direct object',
  iobj: 'indirect object',
  csubj: 'clausal subject',
  ccomp: 'clausal complement',
  xcomp: 'open clausal complement',

  // Oblique arguments
  obl: 'oblique nominal',
  vocative: 'vocative',
  expl: 'expletive',
  dislocated: 'dislocated',

  // Nominal dependents
  nmod: 'nominal modifier',
  appos: 'apposition',
  nummod: 'numeric modifier',

  // Predicate dependents
  advmod: 'adverbial modifier',
  amod: 'adjectival modifier',

  // Function words
  aux: 'auxiliary',
  cop: 'copula',
  mark: 'marker',
  det: 'determiner',
  case_: 'case marking',

  // Coordination
  conj: 'conjunct',
  cc: 'coordinating conjunction',

  // MWE
  fixed: 'fixed expression',
  flat: 'flat expression',
  compound: 'compound',

  // Special
  punct: 'punctuation',
  root: 'root',
  dep: 'unspecified dependency'
};

// POS tag patterns
const DETERMINERS = ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'all', 'both', 'few', 'many', 'much', 'several'];
const PREPOSITIONS = ['in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over', 'against', 'without', 'within', 'among', 'along', 'across', 'behind', 'beyond', 'near'];
const AUXILIARIES = ['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'];
const CONJUNCTIONS = ['and', 'or', 'but', 'nor', 'yet', 'so', 'for'];
const SUBORDINATORS = ['that', 'which', 'who', 'whom', 'whose', 'where', 'when', 'while', 'if', 'although', 'because', 'since', 'unless', 'until', 'whereas', 'whether'];
const PRONOUNS = ['i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'who', 'whom', 'whose', 'what', 'which', 'that'];
const ADVERBS = ['very', 'really', 'quite', 'extremely', 'absolutely', 'completely', 'totally', 'almost', 'nearly', 'just', 'only', 'even', 'still', 'already', 'always', 'never', 'often', 'sometimes', 'usually', 'quickly', 'slowly', 'carefully', 'easily', 'well', 'badly', 'hard', 'fast', 'soon', 'now', 'then', 'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere'];

interface Token {
  id: number;
  form: string;
  lemma: string;
  upos: string;
  head: number;
  deprel: string;
}

// Simple POS tagger
function getPOS(word: string, context: { prev?: string; next?: string } = {}): string {
  const lower = word.toLowerCase();

  if (/^[.,!?;:'"()\-]$/.test(word)) return 'PUNCT';
  if (DETERMINERS.includes(lower)) return 'DET';
  if (PREPOSITIONS.includes(lower)) return 'ADP';
  if (AUXILIARIES.includes(lower)) return 'AUX';
  if (CONJUNCTIONS.includes(lower)) return 'CCONJ';
  if (SUBORDINATORS.includes(lower)) return 'SCONJ';
  if (PRONOUNS.includes(lower)) return 'PRON';
  if (ADVERBS.includes(lower)) return 'ADV';
  if (/^\d+$/.test(word)) return 'NUM';

  // Verb patterns
  if (/ing$/.test(lower) && lower.length > 4) return 'VERB';
  if (/ed$/.test(lower) && lower.length > 3) return 'VERB';
  if (/es$/.test(lower) && lower.length > 3) return 'VERB';

  // Adjective patterns
  if (/ly$/.test(lower) && lower.length > 4) return 'ADV';
  if (/ful$|ous$|ive$|able$|ible$|ent$|ant$|ish$|less$/.test(lower)) return 'ADJ';

  // Noun patterns
  if (/tion$|sion$|ment$|ness$|ity$|ance$|ence$/.test(lower)) return 'NOUN';
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) return 'PROPN';

  // Context-based guessing
  if (context.prev && DETERMINERS.includes(context.prev.toLowerCase())) return 'NOUN';
  if (context.prev && ['is', 'are', 'was', 'were'].includes(context.prev.toLowerCase())) return 'ADJ';

  // Default based on position
  return 'NOUN';
}

// Simple lemmatizer
function getLemma(word: string, pos: string): string {
  const lower = word.toLowerCase();

  if (pos === 'VERB') {
    if (lower.endsWith('ing') && lower.length > 4) {
      const base = lower.slice(0, -3);
      if (base.endsWith('e')) return base;
      if (base[base.length - 1] === base[base.length - 2]) return base.slice(0, -1);
      return base + 'e';
    }
    if (lower.endsWith('ed') && lower.length > 3) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith('es') && lower.length > 3) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith('s') && lower.length > 2) {
      return lower.slice(0, -1);
    }
  }

  if (pos === 'NOUN') {
    if (lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
    if (lower.endsWith('es') && lower.length > 3) return lower.slice(0, -2);
    if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  }

  return lower;
}

// Tokenize sentence
function tokenizeSentence(text: string): string[] {
  return text.match(/[\w']+|[.,!?;:'"()\-]/g) || [];
}

// Parse sentence
function parseSentence(text: string): Token[] {
  const words = tokenizeSentence(text);
  const tokens: Token[] = [];

  // First pass: assign POS tags
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const pos = getPOS(word, {
      prev: words[i - 1],
      next: words[i + 1]
    });

    tokens.push({
      id: i + 1,
      form: word,
      lemma: getLemma(word, pos),
      upos: pos,
      head: 0,
      deprel: 'root'
    });
  }

  // Find main verb (root)
  let rootIdx = tokens.findIndex(t => t.upos === 'VERB');
  if (rootIdx === -1) {
    // No verb? Find auxiliary
    rootIdx = tokens.findIndex(t => t.upos === 'AUX');
  }
  if (rootIdx === -1) {
    // No verb or aux? Use first non-punct
    rootIdx = tokens.findIndex(t => t.upos !== 'PUNCT');
  }
  if (rootIdx === -1) rootIdx = 0;

  const root = tokens[rootIdx];
  root.head = 0;
  root.deprel = 'root';

  // Second pass: assign dependencies
  for (let i = 0; i < tokens.length; i++) {
    if (i === rootIdx) continue;

    const token = tokens[i];

    // Punctuation attaches to root
    if (token.upos === 'PUNCT') {
      token.head = root.id;
      token.deprel = 'punct';
      continue;
    }

    // Determiners attach to following noun
    if (token.upos === 'DET') {
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].upos === 'NOUN' || tokens[j].upos === 'PROPN') {
          token.head = tokens[j].id;
          token.deprel = 'det';
          break;
        }
      }
      if (token.head === 0) {
        token.head = root.id;
        token.deprel = 'det';
      }
      continue;
    }

    // Adjectives attach to following noun or preceding noun
    if (token.upos === 'ADJ') {
      // Look forward for noun
      for (let j = i + 1; j < tokens.length && j < i + 4; j++) {
        if (tokens[j].upos === 'NOUN' || tokens[j].upos === 'PROPN') {
          token.head = tokens[j].id;
          token.deprel = 'amod';
          break;
        }
      }
      // If not found, look backward
      if (token.head === 0) {
        for (let j = i - 1; j >= 0 && j > i - 4; j--) {
          if (tokens[j].upos === 'NOUN' || tokens[j].upos === 'PROPN') {
            token.head = tokens[j].id;
            token.deprel = 'amod';
            break;
          }
        }
      }
      if (token.head === 0) {
        token.head = root.id;
        token.deprel = 'amod';
      }
      continue;
    }

    // Adverbs attach to verb
    if (token.upos === 'ADV') {
      token.head = root.id;
      token.deprel = 'advmod';
      continue;
    }

    // Auxiliaries attach to main verb
    if (token.upos === 'AUX' && i !== rootIdx) {
      token.head = root.id;
      token.deprel = 'aux';
      continue;
    }

    // Prepositions introduce oblique phrases
    if (token.upos === 'ADP') {
      // Find the noun after preposition
      let prepObj = -1;
      for (let j = i + 1; j < tokens.length && j < i + 5; j++) {
        if (tokens[j].upos === 'NOUN' || tokens[j].upos === 'PROPN' || tokens[j].upos === 'PRON') {
          prepObj = j;
          break;
        }
      }

      if (prepObj !== -1) {
        // Preposition is case marker on the noun
        token.head = tokens[prepObj].id;
        token.deprel = 'case';
        // The noun attaches to root as oblique
        if (tokens[prepObj].head === 0) {
          tokens[prepObj].head = root.id;
          tokens[prepObj].deprel = 'obl';
        }
      } else {
        token.head = root.id;
        token.deprel = 'case';
      }
      continue;
    }

    // Coordinating conjunctions
    if (token.upos === 'CCONJ') {
      // Find what follows
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].upos !== 'PUNCT' && tokens[j].upos !== 'CCONJ') {
          token.head = tokens[j].id;
          token.deprel = 'cc';
          // The conjunct attaches to something before
          if (tokens[j].head === 0) {
            for (let k = i - 1; k >= 0; k--) {
              if (tokens[k].upos === tokens[j].upos) {
                tokens[j].head = tokens[k].id;
                tokens[j].deprel = 'conj';
                break;
              }
            }
            if (tokens[j].head === 0) {
              tokens[j].head = root.id;
              tokens[j].deprel = 'conj';
            }
          }
          break;
        }
      }
      if (token.head === 0) {
        token.head = root.id;
        token.deprel = 'cc';
      }
      continue;
    }

    // Nouns before verb are likely subjects
    if ((token.upos === 'NOUN' || token.upos === 'PROPN' || token.upos === 'PRON') && i < rootIdx) {
      token.head = root.id;
      token.deprel = 'nsubj';
      continue;
    }

    // Nouns after verb are likely objects
    if ((token.upos === 'NOUN' || token.upos === 'PROPN' || token.upos === 'PRON') && i > rootIdx && token.head === 0) {
      token.head = root.id;
      token.deprel = 'obj';
      continue;
    }

    // Default: attach to root
    if (token.head === 0) {
      token.head = root.id;
      token.deprel = 'dep';
    }
  }

  return tokens;
}

// Format as CoNLL-U
function formatConLL(tokens: Token[]): string {
  const lines = ['# text = ' + tokens.map(t => t.form).join(' ')];
  tokens.forEach(t => {
    lines.push(`${t.id}\t${t.form}\t${t.lemma}\t${t.upos}\t_\t_\t${t.head}\t${t.deprel}\t_\t_`);
  });
  return lines.join('\n');
}

// Create ASCII tree visualization
function visualizeTree(tokens: Token[]): string {
  const lines: string[] = [];
  const root = tokens.find(t => t.head === 0);

  if (!root) return 'No root found';

  function getChildren(parentId: number): Token[] {
    return tokens.filter(t => t.head === parentId).sort((a, b) => a.id - b.id);
  }

  function printNode(token: Token, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└──' : '├──';
    const depLabel = token.head === 0 ? 'ROOT' : token.deprel;
    lines.push(`${prefix}${connector} ${token.form} [${token.upos}] <${depLabel}>`);

    const children = getChildren(token.id);
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    children.forEach((child, i) => {
      printNode(child, newPrefix, i === children.length - 1);
    });
  }

  lines.push(`${root.form} [${root.upos}] <ROOT>`);
  const rootChildren = getChildren(root.id);
  rootChildren.forEach((child, i) => {
    printNode(child, '', i === rootChildren.length - 1);
  });

  return lines.join('\n');
}

// Create dependency arc visualization
function visualizeArcs(tokens: Token[]): string {
  const words = tokens.map(t => t.form);
  const maxLen = Math.max(...words.map(w => w.length));

  const lines: string[] = [];

  // Words line
  lines.push(words.map(w => w.padEnd(maxLen + 2)).join(''));

  // Index line
  lines.push(tokens.map(t => String(t.id).padEnd(maxLen + 2)).join(''));

  // Relations
  lines.push('');
  tokens.forEach(t => {
    if (t.head !== 0) {
      const from = Math.min(t.id, t.head);
      const to = Math.max(t.id, t.head);
      const direction = t.head < t.id ? '→' : '←';
      lines.push(`  ${t.id} ${direction} ${t.head}: ${t.form} --${t.deprel}--> ${tokens[t.head - 1]?.form || 'ROOT'}`);
    } else {
      lines.push(`  ${t.id}: ${t.form} [ROOT]`);
    }
  });

  return lines.join('\n');
}

export async function executedependencyparser(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, format = 'tree' } = args;

    if (operation === 'info') {
      const info = {
        tool: 'dependency_parser',
        description: 'Syntactic dependency parsing using Universal Dependencies',
        operations: {
          parse: 'Parse a sentence and return dependency structure',
          visualize: 'Create visual representation of parse tree',
          analyze: 'Detailed analysis of syntactic structure',
          demo: 'Demonstrate parsing on example sentences'
        },
        formats: {
          tree: 'ASCII tree visualization',
          conll: 'CoNLL-U format (tab-separated)',
          json: 'JSON structure'
        },
        dependency_relations: UD_RELATIONS,
        pos_tags: {
          NOUN: 'Common noun',
          PROPN: 'Proper noun',
          VERB: 'Verb',
          ADJ: 'Adjective',
          ADV: 'Adverb',
          ADP: 'Adposition (preposition)',
          DET: 'Determiner',
          PRON: 'Pronoun',
          AUX: 'Auxiliary verb',
          CCONJ: 'Coordinating conjunction',
          SCONJ: 'Subordinating conjunction',
          PUNCT: 'Punctuation',
          NUM: 'Numeral'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const demoSentences = [
        'The quick brown fox jumps over the lazy dog.',
        'John gave Mary a book.',
        'She saw the man with the telescope.',
        'The students are studying hard for their exams.'
      ];

      const demos = demoSentences.map(sent => {
        const tokens = parseSentence(sent);
        return {
          sentence: sent,
          tree: visualizeTree(tokens),
          tokens: tokens.map(t => ({
            id: t.id,
            word: t.form,
            pos: t.upos,
            head: t.head,
            relation: t.deprel
          }))
        };
      });

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'demo',
          description: 'Dependency parsing demonstration',
          examples: demos,
          legend: {
            'nsubj': 'nominal subject',
            'obj': 'direct object',
            'iobj': 'indirect object',
            'amod': 'adjectival modifier',
            'det': 'determiner',
            'case': 'case marking (preposition)',
            'obl': 'oblique argument'
          }
        }, null, 2)
      };
    }

    if (!text) {
      return { toolCallId: id, content: 'Error: text parameter required', isError: true };
    }

    const tokens = parseSentence(text);

    if (operation === 'visualize') {
      const result = {
        operation: 'visualize',
        sentence: text,
        tree_visualization: visualizeTree(tokens),
        arc_visualization: visualizeArcs(tokens)
      };
      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const root = tokens.find(t => t.head === 0);
      const subjects = tokens.filter(t => t.deprel === 'nsubj');
      const objects = tokens.filter(t => t.deprel === 'obj');
      const modifiers = tokens.filter(t => ['amod', 'advmod', 'nmod'].includes(t.deprel));

      const result = {
        operation: 'analyze',
        sentence: text,
        token_count: tokens.length,
        structure: {
          root: root ? { word: root.form, pos: root.upos } : null,
          subjects: subjects.map(t => ({ word: t.form, pos: t.upos })),
          objects: objects.map(t => ({ word: t.form, pos: t.upos })),
          modifiers: modifiers.map(t => ({ word: t.form, type: t.deprel, modifies: tokens[t.head - 1]?.form }))
        },
        pos_distribution: (() => {
          const dist: Record<string, number> = {};
          tokens.forEach(t => {
            dist[t.upos] = (dist[t.upos] || 0) + 1;
          });
          return dist;
        })(),
        relation_distribution: (() => {
          const dist: Record<string, number> = {};
          tokens.forEach(t => {
            dist[t.deprel] = (dist[t.deprel] || 0) + 1;
          });
          return dist;
        })(),
        tree_depth: (() => {
          function getDepth(tokenId: number): number {
            const children = tokens.filter(t => t.head === tokenId);
            if (children.length === 0) return 1;
            return 1 + Math.max(...children.map(c => getDepth(c.id)));
          }
          return root ? getDepth(root.id) : 0;
        })(),
        tree: visualizeTree(tokens)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Default: parse operation
    if (format === 'conll') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'parse',
          format: 'conll',
          sentence: text,
          conll: formatConLL(tokens)
        }, null, 2)
      };
    }

    if (format === 'json') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'parse',
          format: 'json',
          sentence: text,
          tokens: tokens.map(t => ({
            id: t.id,
            form: t.form,
            lemma: t.lemma,
            upos: t.upos,
            head: t.head,
            deprel: t.deprel
          }))
        }, null, 2)
      };
    }

    // Default: tree format
    return {
      toolCallId: id,
      content: JSON.stringify({
        operation: 'parse',
        format: 'tree',
        sentence: text,
        tree: visualizeTree(tokens),
        summary: {
          tokens: tokens.length,
          root: tokens.find(t => t.head === 0)?.form || 'none'
        }
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdependencyparserAvailable(): boolean { return true; }
