/**
 * BERT-TOKENIZER TOOL
 * BERT and transformer model tokenization
 *
 * Implements WordPiece, BPE, and SentencePiece tokenization algorithms
 * with special token handling and attention mask generation.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type TokenizerModel = 'bert' | 'gpt2' | 'roberta' | 't5' | 'sentencepiece';

interface TokenizerConfig {
  model: TokenizerModel;
  vocabSize: number;
  maxLength: number;
  padToken: string;
  unkToken: string;
  clsToken: string;
  sepToken: string;
  maskToken: string;
  doLowercase: boolean;
  addSpecialTokens: boolean;
}

interface TokenizedOutput {
  inputIds: number[];
  attentionMask: number[];
  tokenTypeIds?: number[];
  tokens: string[];
  specialTokensMask?: number[];
  offsetMapping?: [number, number][];
}

interface Vocabulary {
  tokenToId: Map<string, number>;
  idToToken: Map<number, string>;
  specialTokens: Set<string>;
}

// ============================================================================
// VOCABULARY
// ============================================================================

// Build a basic vocabulary for demonstration
function buildVocabulary(model: TokenizerModel): Vocabulary {
  const tokenToId = new Map<string, number>();
  const idToToken = new Map<number, string>();
  const specialTokens = new Set<string>();

  // Special tokens based on model
  const specials: Record<TokenizerModel, string[]> = {
    bert: ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]'],
    gpt2: ['<|endoftext|>', '<|pad|>'],
    roberta: ['<s>', '</s>', '<pad>', '<unk>', '<mask>'],
    t5: ['<pad>', '</s>', '<unk>'],
    sentencepiece: ['<pad>', '<unk>', '<s>', '</s>']
  };

  let id = 0;

  // Add special tokens
  for (const token of specials[model]) {
    tokenToId.set(token, id);
    idToToken.set(id, token);
    specialTokens.add(token);
    id++;
  }

  // Add common subword pieces (simplified vocabulary)
  const commonPieces = [
    // Single letters
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // Common prefixes and suffixes (with ## for BERT-style continuation)
    '##s', '##ed', '##ing', '##er', '##ly', '##tion', '##ness', '##ment',
    '##able', '##ible', '##ful', '##less', '##ous', '##ive', '##al', '##ity',
    // Common words
    'the', 'of', 'and', 'a', 'to', 'in', 'is', 'it', 'for', 'on', 'that', 'this',
    'with', 'as', 'be', 'at', 'by', 'from', 'or', 'an', 'was', 'are', 'were', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'can', 'may', 'might', 'must', 'shall', 'not', 'no', 'yes', 'but', 'if', 'so',
    // Common NLP terms
    'token', 'model', 'neural', 'network', 'learn', 'train', 'data', 'input', 'output',
    'attention', 'transformer', 'embedding', 'layer', 'weight', 'bias', 'gradient',
    // Common subwords
    'un', 'pre', 're', 'dis', 'mis', 'non', 'anti', 'de', 'en', 'em', 'in', 'im',
    '##es', '##e', '##y', '##n', '##d', '##t', '##r', '##l',
    // Numbers
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Punctuation
    '.', ',', '!', '?', ';', ':', "'", '"', '-', '_', '(', ')', '[', ']', '{', '}'
  ];

  for (const piece of commonPieces) {
    if (!tokenToId.has(piece)) {
      tokenToId.set(piece, id);
      idToToken.set(id, piece);
      id++;
    }
  }

  return { tokenToId, idToToken, specialTokens };
}

// ============================================================================
// TOKENIZATION ALGORITHMS
// ============================================================================

// WordPiece tokenization (BERT-style)
function wordPieceTokenize(text: string, vocab: Vocabulary, maxWordLen: number = 100): string[] {
  const tokens: string[] = [];
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  for (const word of words) {
    if (word.length > maxWordLen) {
      tokens.push('[UNK]');
      continue;
    }

    // Try to tokenize the word using WordPiece
    const subTokens = wordPieceTokenizeWord(word, vocab);
    tokens.push(...subTokens);
  }

  return tokens;
}

function wordPieceTokenizeWord(word: string, vocab: Vocabulary): string[] {
  const tokens: string[] = [];
  let start = 0;

  while (start < word.length) {
    let end = word.length;
    let found = false;

    while (start < end) {
      let substr = word.slice(start, end);
      if (start > 0) {
        substr = '##' + substr;
      }

      if (vocab.tokenToId.has(substr)) {
        tokens.push(substr);
        found = true;
        break;
      }
      end--;
    }

    if (!found) {
      // Character not in vocabulary, use [UNK] or single character
      if (start === 0) {
        tokens.push(vocab.tokenToId.has(word[start]) ? word[start] : '[UNK]');
      } else {
        const charToken = '##' + word[start];
        tokens.push(vocab.tokenToId.has(charToken) ? charToken : '##' + word[start]);
      }
      start++;
    } else {
      start = end;
    }
  }

  return tokens;
}

// Byte-Pair Encoding (BPE) tokenization (GPT-2 style)
function bpeTokenize(text: string, vocab: Vocabulary): string[] {
  const tokens: string[] = [];

  // Split text into words with spacing preserved
  const pattern = /(\s+|\S+)/g;
  const segments = text.match(pattern) || [];

  for (const segment of segments) {
    if (/^\s+$/.test(segment)) {
      // Whitespace - add as single token or skip
      continue;
    }

    // Convert word to bytes/characters and apply BPE
    const chars = segment.split('');
    let currentTokens = chars.map(c => vocab.tokenToId.has(c) ? c : '<unk>');

    // Simplified BPE: just use character-level + common subwords
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < currentTokens.length - 1; i++) {
        const pair = currentTokens[i] + currentTokens[i + 1];
        if (vocab.tokenToId.has(pair)) {
          currentTokens = [...currentTokens.slice(0, i), pair, ...currentTokens.slice(i + 2)];
          merged = true;
          break;
        }
      }
    }

    tokens.push(...currentTokens);
  }

  return tokens;
}

// SentencePiece tokenization
function sentencePieceTokenize(text: string, vocab: Vocabulary): string[] {
  const tokens: string[] = [];

  // SentencePiece treats the input as a raw character sequence
  // and uses a unigram language model or BPE
  const normalized = text.replace(/\s+/g, '▁').replace(/^/, '▁');

  let pos = 0;
  while (pos < normalized.length) {
    let bestLen = 1;
    let bestToken = normalized[pos];

    // Find longest matching token
    for (let len = Math.min(20, normalized.length - pos); len >= 1; len--) {
      const candidate = normalized.slice(pos, pos + len);
      if (vocab.tokenToId.has(candidate)) {
        bestLen = len;
        bestToken = candidate;
        break;
      }
    }

    tokens.push(vocab.tokenToId.has(bestToken) ? bestToken : '<unk>');
    pos += bestLen;
  }

  return tokens;
}

// ============================================================================
// ENCODING AND DECODING
// ============================================================================

function encode(text: string, config: TokenizerConfig, vocab: Vocabulary): TokenizedOutput {
  // Preprocess
  const processedText = config.doLowercase ? text.toLowerCase() : text;

  // Tokenize based on model type
  let tokens: string[];
  switch (config.model) {
    case 'gpt2':
      tokens = bpeTokenize(processedText, vocab);
      break;
    case 'sentencepiece':
    case 't5':
      tokens = sentencePieceTokenize(processedText, vocab);
      break;
    case 'bert':
    case 'roberta':
    default:
      tokens = wordPieceTokenize(processedText, vocab);
  }

  // Add special tokens
  if (config.addSpecialTokens) {
    switch (config.model) {
      case 'bert':
        tokens = ['[CLS]', ...tokens, '[SEP]'];
        break;
      case 'roberta':
        tokens = ['<s>', ...tokens, '</s>'];
        break;
      case 'gpt2':
        tokens = [...tokens, '<|endoftext|>'];
        break;
      case 't5':
        tokens = [...tokens, '</s>'];
        break;
    }
  }

  // Convert tokens to IDs
  const inputIds = tokens.map(t =>
    vocab.tokenToId.get(t) ?? vocab.tokenToId.get(config.unkToken) ?? 1
  );

  // Create attention mask
  const attentionMask = new Array(inputIds.length).fill(1);

  // Create token type IDs (for BERT-style models)
  const tokenTypeIds = new Array(inputIds.length).fill(0);

  // Create special tokens mask
  const specialTokensMask = tokens.map(t => vocab.specialTokens.has(t) ? 1 : 0);

  // Truncate if necessary
  if (inputIds.length > config.maxLength) {
    inputIds.length = config.maxLength;
    attentionMask.length = config.maxLength;
    tokenTypeIds.length = config.maxLength;
    specialTokensMask.length = config.maxLength;
    tokens.length = config.maxLength;
  }

  // Pad if necessary
  while (inputIds.length < config.maxLength) {
    const padId = vocab.tokenToId.get(config.padToken) ?? 0;
    inputIds.push(padId);
    attentionMask.push(0);
    tokenTypeIds.push(0);
    specialTokensMask.push(1);
    tokens.push(config.padToken);
  }

  return {
    inputIds,
    attentionMask,
    tokenTypeIds,
    tokens,
    specialTokensMask
  };
}

function decode(inputIds: number[], vocab: Vocabulary, skipSpecialTokens: boolean = true): string {
  const tokens: string[] = [];

  for (const id of inputIds) {
    const token = vocab.idToToken.get(id);
    if (!token) continue;

    if (skipSpecialTokens && vocab.specialTokens.has(token)) continue;

    tokens.push(token);
  }

  // Reconstruct text
  let text = '';
  for (const token of tokens) {
    if (token.startsWith('##')) {
      text += token.slice(2);
    } else if (token.startsWith('▁')) {
      text += ' ' + token.slice(1);
    } else if (text.length > 0 && !text.endsWith(' ')) {
      text += ' ' + token;
    } else {
      text += token;
    }
  }

  return text.trim();
}

function encodePair(text1: string, text2: string, config: TokenizerConfig, vocab: Vocabulary): TokenizedOutput {
  const processedText1 = config.doLowercase ? text1.toLowerCase() : text1;
  const processedText2 = config.doLowercase ? text2.toLowerCase() : text2;

  const tokens1 = wordPieceTokenize(processedText1, vocab);
  const tokens2 = wordPieceTokenize(processedText2, vocab);

  // Combine with separator
  let tokens: string[];
  let tokenTypeIds: number[];

  switch (config.model) {
    case 'bert':
      tokens = ['[CLS]', ...tokens1, '[SEP]', ...tokens2, '[SEP]'];
      tokenTypeIds = [0, ...new Array(tokens1.length).fill(0), 0, ...new Array(tokens2.length).fill(1), 1];
      break;
    case 'roberta':
      tokens = ['<s>', ...tokens1, '</s>', '</s>', ...tokens2, '</s>'];
      tokenTypeIds = [0, ...new Array(tokens1.length).fill(0), 0, 0, ...new Array(tokens2.length).fill(0), 0];
      break;
    default:
      tokens = [...tokens1, ...tokens2];
      tokenTypeIds = [...new Array(tokens1.length).fill(0), ...new Array(tokens2.length).fill(1)];
  }

  const inputIds = tokens.map(t =>
    vocab.tokenToId.get(t) ?? vocab.tokenToId.get(config.unkToken) ?? 1
  );
  const attentionMask = new Array(inputIds.length).fill(1);

  // Truncate/pad
  if (inputIds.length > config.maxLength) {
    inputIds.length = config.maxLength;
    attentionMask.length = config.maxLength;
    tokenTypeIds.length = config.maxLength;
    tokens.length = config.maxLength;
  }

  const padId = vocab.tokenToId.get(config.padToken) ?? 0;
  while (inputIds.length < config.maxLength) {
    inputIds.push(padId);
    attentionMask.push(0);
    tokenTypeIds.push(0);
    tokens.push(config.padToken);
  }

  return {
    inputIds,
    attentionMask,
    tokenTypeIds,
    tokens
  };
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeTokenization(text: string, config: TokenizerConfig, vocab: Vocabulary): {
  original: string;
  tokenCount: number;
  compressionRatio: number;
  unknownTokens: number;
  subwordBreakdown: { word: string; subwords: string[] }[];
} {
  const output = encode(text, { ...config, addSpecialTokens: false }, vocab);
  const tokens = output.tokens.filter(t => !vocab.specialTokens.has(t));

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const subwordBreakdown: { word: string; subwords: string[] }[] = [];

  let tokenIdx = 0;
  for (const word of words) {
    const wordTokens: string[] = [];
    while (tokenIdx < tokens.length) {
      const token = tokens[tokenIdx];
      wordTokens.push(token);
      tokenIdx++;
      if (!tokens[tokenIdx]?.startsWith('##')) break;
    }
    subwordBreakdown.push({ word, subwords: wordTokens });
  }

  const unknownCount = tokens.filter(t =>
    t === '[UNK]' || t === '<unk>' || !vocab.tokenToId.has(t)
  ).length;

  return {
    original: text,
    tokenCount: tokens.length,
    compressionRatio: text.length / tokens.length,
    unknownTokens: unknownCount,
    subwordBreakdown: subwordBreakdown.slice(0, 20)
  };
}

function compareTokenizers(text: string): Record<string, {
  tokenCount: number;
  tokens: string[];
  compressionRatio: number;
}> {
  const results: Record<string, {
    tokenCount: number;
    tokens: string[];
    compressionRatio: number;
  }> = {};

  const models: TokenizerModel[] = ['bert', 'gpt2', 'roberta', 't5'];

  for (const model of models) {
    const config = getDefaultConfig(model);
    const vocab = buildVocabulary(model);
    const output = encode(text, { ...config, addSpecialTokens: false, maxLength: 512 }, vocab);
    const tokens = output.tokens.filter(t => !vocab.specialTokens.has(t) && t !== config.padToken);

    results[model] = {
      tokenCount: tokens.length,
      tokens: tokens.slice(0, 30),
      compressionRatio: text.length / tokens.length
    };
  }

  return results;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

function getDefaultConfig(model: TokenizerModel): TokenizerConfig {
  const configs: Record<TokenizerModel, TokenizerConfig> = {
    bert: {
      model: 'bert',
      vocabSize: 30522,
      maxLength: 512,
      padToken: '[PAD]',
      unkToken: '[UNK]',
      clsToken: '[CLS]',
      sepToken: '[SEP]',
      maskToken: '[MASK]',
      doLowercase: true,
      addSpecialTokens: true
    },
    gpt2: {
      model: 'gpt2',
      vocabSize: 50257,
      maxLength: 1024,
      padToken: '<|pad|>',
      unkToken: '<|endoftext|>',
      clsToken: '<|endoftext|>',
      sepToken: '<|endoftext|>',
      maskToken: '<|endoftext|>',
      doLowercase: false,
      addSpecialTokens: true
    },
    roberta: {
      model: 'roberta',
      vocabSize: 50265,
      maxLength: 512,
      padToken: '<pad>',
      unkToken: '<unk>',
      clsToken: '<s>',
      sepToken: '</s>',
      maskToken: '<mask>',
      doLowercase: false,
      addSpecialTokens: true
    },
    t5: {
      model: 't5',
      vocabSize: 32128,
      maxLength: 512,
      padToken: '<pad>',
      unkToken: '<unk>',
      clsToken: '<pad>',
      sepToken: '</s>',
      maskToken: '<extra_id_0>',
      doLowercase: false,
      addSpecialTokens: true
    },
    sentencepiece: {
      model: 'sentencepiece',
      vocabSize: 32000,
      maxLength: 512,
      padToken: '<pad>',
      unkToken: '<unk>',
      clsToken: '<s>',
      sepToken: '</s>',
      maskToken: '<mask>',
      doLowercase: false,
      addSpecialTokens: true
    }
  };

  return configs[model];
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const berttokenizerTool: UnifiedTool = {
  name: 'bert_tokenizer',
  description: 'BERT and transformer model tokenization - WordPiece, BPE, SentencePiece',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['tokenize', 'detokenize', 'encode', 'decode', 'encode_pair', 'analyze', 'compare', 'info'],
        description: 'Tokenization operation'
      },
      model: {
        type: 'string',
        enum: ['bert', 'gpt2', 'roberta', 't5', 'sentencepiece'],
        description: 'Tokenizer model type'
      },
      text: {
        type: 'string',
        description: 'Text to tokenize'
      },
      text_pair: {
        type: 'string',
        description: 'Second text for pair encoding'
      },
      input_ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Token IDs to decode'
      },
      max_length: {
        type: 'number',
        description: 'Maximum sequence length'
      },
      add_special_tokens: {
        type: 'boolean',
        description: 'Add special tokens (CLS, SEP, etc.)'
      },
      lowercase: {
        type: 'boolean',
        description: 'Convert text to lowercase'
      }
    },
    required: ['operation']
  }
};

export async function executeberttokenizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const model: TokenizerModel = args.model || 'bert';

    const config: TokenizerConfig = {
      ...getDefaultConfig(model),
      maxLength: args.max_length || getDefaultConfig(model).maxLength,
      addSpecialTokens: args.add_special_tokens !== false,
      doLowercase: args.lowercase !== undefined ? args.lowercase : getDefaultConfig(model).doLowercase
    };

    const vocab = buildVocabulary(model);

    switch (operation) {
      case 'tokenize': {
        const text = args.text || 'Hello, how are you doing today?';
        const output = encode(text, config, vocab);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'tokenize',
            model,
            input: text,
            tokens: output.tokens.filter(t => t !== config.padToken),
            tokenCount: output.tokens.filter(t => t !== config.padToken).length,
            inputIds: output.inputIds.slice(0, output.tokens.filter(t => t !== config.padToken).length),
            attentionMask: output.attentionMask.slice(0, output.tokens.filter(t => t !== config.padToken).length)
          }, null, 2)
        };
      }

      case 'encode': {
        const text = args.text || 'The quick brown fox jumps over the lazy dog.';
        const output = encode(text, config, vocab);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'encode',
            model,
            input: text,
            output: {
              inputIds: output.inputIds,
              attentionMask: output.attentionMask,
              tokenTypeIds: output.tokenTypeIds,
              tokens: output.tokens,
              sequenceLength: output.inputIds.length
            },
            config: {
              maxLength: config.maxLength,
              addSpecialTokens: config.addSpecialTokens,
              lowercase: config.doLowercase
            }
          }, null, 2)
        };
      }

      case 'decode':
      case 'detokenize': {
        const inputIds: number[] = args.input_ids || [101, 7592, 1010, 2129, 2024, 2017, 102];
        const decoded = decode(inputIds, vocab, true);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'decode',
            model,
            inputIds,
            tokens: inputIds.map(id => vocab.idToToken.get(id) || '[UNK]'),
            decodedText: decoded
          }, null, 2)
        };
      }

      case 'encode_pair': {
        const text1 = args.text || 'What is the capital of France?';
        const text2 = args.text_pair || 'Paris is the capital of France.';
        const output = encodePair(text1, text2, config, vocab);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'encode_pair',
            model,
            text1,
            text2,
            output: {
              inputIds: output.inputIds.slice(0, 50),
              attentionMask: output.attentionMask.slice(0, 50),
              tokenTypeIds: output.tokenTypeIds?.slice(0, 50),
              tokens: output.tokens.slice(0, 50),
              totalLength: output.inputIds.length
            },
            note: 'Token type IDs distinguish sentence A (0) from sentence B (1)'
          }, null, 2)
        };
      }

      case 'analyze': {
        const text = args.text || 'Transformers have revolutionized natural language processing.';
        const analysis = analyzeTokenization(text, config, vocab);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            model,
            ...analysis,
            interpretation: {
              compressionRatio: `~${analysis.compressionRatio.toFixed(1)} characters per token`,
              unknownRate: `${((analysis.unknownTokens / analysis.tokenCount) * 100).toFixed(1)}% unknown tokens`
            }
          }, null, 2)
        };
      }

      case 'compare': {
        const text = args.text || 'The transformer architecture uses self-attention mechanisms.';
        const comparison = compareTokenizers(text);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            input: text,
            tokenizers: comparison,
            summary: {
              mostEfficient: Object.entries(comparison)
                .sort((a, b) => a[1].tokenCount - b[1].tokenCount)[0][0],
              tokenCounts: Object.fromEntries(
                Object.entries(comparison).map(([k, v]) => [k, v.tokenCount])
              )
            }
          }, null, 2)
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'bert_tokenizer',
            description: 'Tokenization for transformer models',
            algorithms: {
              wordPiece: {
                description: 'Greedy longest-match-first algorithm (BERT)',
                prefix: '## for continuation',
                example: 'tokenization → token ##ization'
              },
              bpe: {
                description: 'Byte-Pair Encoding (GPT-2)',
                method: 'Iteratively merge most frequent character pairs',
                example: 'low lower lowest → low, low er, low est'
              },
              sentencePiece: {
                description: 'Language-independent subword tokenization (T5)',
                features: ['Unigram language model', 'BPE mode', 'Raw text input']
              }
            },
            models: {
              bert: {
                vocabSize: 30522,
                maxLength: 512,
                specialTokens: ['[CLS]', '[SEP]', '[PAD]', '[MASK]', '[UNK]']
              },
              gpt2: {
                vocabSize: 50257,
                maxLength: 1024,
                specialTokens: ['<|endoftext|>']
              },
              roberta: {
                vocabSize: 50265,
                maxLength: 512,
                specialTokens: ['<s>', '</s>', '<pad>', '<mask>']
              },
              t5: {
                vocabSize: 32128,
                maxLength: 512,
                specialTokens: ['<pad>', '</s>', '<extra_id_N>']
              }
            },
            outputFields: {
              inputIds: 'Token indices in vocabulary',
              attentionMask: '1 for real tokens, 0 for padding',
              tokenTypeIds: 'Segment IDs (sentence A vs B)',
              specialTokensMask: '1 for special tokens, 0 for content'
            },
            operations: ['tokenize', 'encode', 'decode', 'encode_pair', 'analyze', 'compare']
          }, null, 2)
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isberttokenizerAvailable(): boolean {
  return true;
}
