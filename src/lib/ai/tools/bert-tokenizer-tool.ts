/**
 * BERT-TOKENIZER TOOL
 * BERT and transformer model tokenization
 * Implements WordPiece and BPE tokenization algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const berttokenizerTool: UnifiedTool = {
  name: 'bert_tokenizer',
  description: 'BERT and transformer model tokenization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['tokenize', 'detokenize', 'encode', 'decode', 'vocab', 'demo', 'info'],
        description: 'Operation to perform'
      },
      model: {
        type: 'string',
        enum: ['bert', 'gpt2', 'roberta', 't5'],
        description: 'Tokenizer model (default: bert)'
      },
      text: {
        type: 'string',
        description: 'Text to tokenize'
      },
      tokens: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tokens to detokenize'
      },
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Token IDs to decode'
      },
      add_special_tokens: {
        type: 'boolean',
        description: 'Add special tokens like [CLS] and [SEP] (default: true)'
      },
      max_length: {
        type: 'number',
        description: 'Maximum sequence length (default: 512)'
      }
    },
    required: ['operation']
  }
};

// WordPiece vocabulary (simplified - common subwords)
const BERT_VOCAB: Map<string, number> = new Map([
  // Special tokens
  ['[PAD]', 0], ['[UNK]', 100], ['[CLS]', 101], ['[SEP]', 102], ['[MASK]', 103],
  // Common words
  ['the', 1996], ['a', 1037], ['an', 2019], ['and', 1998], ['or', 2030],
  ['is', 2003], ['are', 2024], ['was', 2001], ['were', 2020], ['be', 2022],
  ['been', 2042], ['being', 2108], ['have', 2031], ['has', 2038], ['had', 2018],
  ['do', 2079], ['does', 2515], ['did', 2106], ['will', 2097], ['would', 2052],
  ['could', 2071], ['should', 2323], ['may', 2089], ['might', 2453], ['must', 2442],
  ['can', 2064], ['shall', 4618], ['to', 2000], ['of', 1997], ['in', 1999],
  ['for', 2005], ['on', 2006], ['with', 2007], ['at', 2012], ['by', 2011],
  ['from', 2013], ['as', 2004], ['this', 2023], ['that', 2008], ['it', 2009],
  ['i', 1045], ['you', 2017], ['he', 2002], ['she', 2016], ['we', 2057],
  ['they', 2027], ['not', 2025], ['but', 2021], ['all', 2035], ['my', 2026],
  // WordPiece subwords (## prefix)
  ['##s', 2015], ['##ed', 2098], ['##ing', 2075], ['##ly', 2135], ['##er', 2121],
  ['##tion', 3775], ['##al', 2389], ['##ment', 3672], ['##ness', 2791], ['##ity', 3012],
  ['##able', 3085], ['##ible', 6321], ['##ous', 3560], ['##ive', 3512], ['##ful', 3993],
  ['##less', 3238], ['##ship', 4049], ['##hood', 6865], ['##ward', 4276], ['##wise', 7058],
  ['##es', 2229], ['##en', 2368], ['##er', 2121], ['##est', 4355], ['##man', 2386],
  ['##men', 2273], ['##work', 4497], ['##book', 4874], ['##one', 5765], ['##time', 4069],
  // Common prefixes
  ['un', 4895], ['re', 2128], ['pre', 3653], ['dis', 4487], ['mis', 8072],
  ['non', 3989], ['anti', 3424], ['de', 2139], ['over', 2058], ['under', 2104],
  // Letters (for character-level fallback)
  ['a', 1037], ['b', 1038], ['c', 1039], ['d', 1040], ['e', 1041],
  ['f', 1042], ['g', 1043], ['h', 1044], ['i', 1045], ['j', 1046],
  ['k', 1047], ['l', 1048], ['m', 1049], ['n', 1050], ['o', 1051],
  ['p', 1052], ['q', 1053], ['r', 1054], ['s', 1055], ['t', 1056],
  ['u', 1057], ['v', 1058], ['w', 1059], ['x', 1060], ['y', 1061], ['z', 1062],
  // Numbers
  ['0', 1014], ['1', 1015], ['2', 1016], ['3', 1017], ['4', 1018],
  ['5', 1019], ['6', 1020], ['7', 1021], ['8', 1022], ['9', 1023],
  // Punctuation
  ['.', 1012], [',', 1010], ['?', 1029], ['!', 999], [';', 1025],
  [':', 1024], ['-', 1011], ['(', 1006], [')', 1007], ['[', 1031],
  [']', 1033], ['{', 1063], ['}', 1065], ['"', 1000], ["'", 1005],
  // Additional common words
  ['hello', 7592], ['world', 2088], ['machine', 3698], ['learning', 4083],
  ['neural', 15756], ['network', 2897], ['data', 2951], ['model', 2944],
  ['train', 3848], ['test', 3231], ['input', 7953], ['output', 6434],
  ['computer', 3274], ['science', 2671], ['program', 2565], ['code', 3642],
  ['language', 2653], ['process', 2832], ['system', 2291], ['algorithm', 9896]
]);

// Reverse vocabulary
const BERT_ID_TO_TOKEN: Map<number, string> = new Map(
  Array.from(BERT_VOCAB.entries()).map(([token, id]) => [id, token])
);

// GPT-2 style BPE vocabulary (simplified)
const GPT2_VOCAB: Map<string, number> = new Map([
  ['<|endoftext|>', 50256], ['<|pad|>', 50257],
  ['the', 1169], ['a', 64], ['an', 281], ['and', 290], ['or', 273],
  ['is', 318], ['are', 389], ['was', 373], ['were', 547], ['be', 307],
  ['to', 284], ['of', 286], ['in', 287], ['for', 329], ['on', 319],
  ['with', 351], ['at', 379], ['by', 416], ['from', 422], ['as', 355],
  ['Ġthe', 262], ['Ġa', 257], ['Ġand', 290], ['Ġto', 284], ['Ġof', 286],
  ['Ġin', 287], ['Ġis', 318], ['Ġfor', 329], ['Ġon', 319], ['Ġwith', 351],
  ['Ġthat', 326], ['Ġit', 340], ['Ġthis', 428], ['Ġare', 389], ['Ġwas', 373],
  ['ing', 278], ['ed', 276], ['er', 263], ['ly', 306], ['tion', 1159],
  ['s', 82], ['t', 83], ['n', 77], ['e', 68], ['r', 81],
  // More common tokens
  ['hello', 31373], ['world', 6894], ['machine', 4572], ['learning', 4673],
  ['neural', 40227], ['network', 3127], ['data', 7890], ['model', 2746]
]);

const GPT2_ID_TO_TOKEN: Map<number, string> = new Map(
  Array.from(GPT2_VOCAB.entries()).map(([token, id]) => [id, token])
);

// Tokenizer class
class WordPieceTokenizer {
  private vocab: Map<string, number>;
  private idToToken: Map<number, string>;
  private unkToken: string;
  private maxWordLength: number;

  constructor(vocab: Map<string, number>, idToToken: Map<number, string>, unkToken = '[UNK]') {
    this.vocab = vocab;
    this.idToToken = idToToken;
    this.unkToken = unkToken;
    this.maxWordLength = 200;
  }

  // Basic text preprocessing
  preprocess(text: string): string[] {
    // Lowercase and split on whitespace and punctuation
    return text.toLowerCase()
      .replace(/([.,!?;:'"()\[\]{}])/g, ' $1 ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  // WordPiece tokenization
  tokenize(text: string): string[] {
    const words = this.preprocess(text);
    const tokens: string[] = [];

    for (const word of words) {
      if (word.length > this.maxWordLength) {
        tokens.push(this.unkToken);
        continue;
      }

      // Check if whole word is in vocab
      if (this.vocab.has(word)) {
        tokens.push(word);
        continue;
      }

      // WordPiece: try to break into subwords
      const subTokens = this.wordPieceTokenize(word);
      tokens.push(...subTokens);
    }

    return tokens;
  }

  // WordPiece algorithm for a single word
  private wordPieceTokenize(word: string): string[] {
    const tokens: string[] = [];
    let start = 0;

    while (start < word.length) {
      let end = word.length;
      let foundSubword = false;

      while (start < end) {
        let subword = word.slice(start, end);
        if (start > 0) {
          subword = '##' + subword;
        }

        if (this.vocab.has(subword)) {
          tokens.push(subword);
          foundSubword = true;
          break;
        }

        end--;
      }

      if (!foundSubword) {
        // Character-level fallback
        const char = word[start];
        if (start > 0) {
          tokens.push('##' + char);
        } else {
          tokens.push(this.vocab.has(char) ? char : this.unkToken);
        }
        start++;
      } else {
        start = end;
      }
    }

    return tokens;
  }

  // Convert tokens to IDs
  encode(tokens: string[]): number[] {
    return tokens.map(t => this.vocab.get(t) ?? this.vocab.get(this.unkToken) ?? 100);
  }

  // Convert IDs to tokens
  decode(ids: number[]): string[] {
    return ids.map(id => this.idToToken.get(id) ?? this.unkToken);
  }

  // Full encode with special tokens
  encodeWithSpecialTokens(text: string, maxLength = 512): {
    tokens: string[];
    ids: number[];
    attention_mask: number[];
    token_type_ids: number[];
  } {
    let tokens = this.tokenize(text);

    // Add special tokens
    tokens = ['[CLS]', ...tokens, '[SEP]'];

    // Truncate if needed
    if (tokens.length > maxLength) {
      tokens = tokens.slice(0, maxLength - 1);
      tokens.push('[SEP]');
    }

    const ids = this.encode(tokens);
    const attentionMask = new Array(ids.length).fill(1);
    const tokenTypeIds = new Array(ids.length).fill(0);

    // Pad to maxLength if needed
    while (ids.length < maxLength) {
      tokens.push('[PAD]');
      ids.push(0);
      attentionMask.push(0);
      tokenTypeIds.push(0);
    }

    return {
      tokens,
      ids,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds
    };
  }

  // Detokenize
  detokenize(tokens: string[]): string {
    let text = '';
    for (const token of tokens) {
      if (token.startsWith('##')) {
        text += token.slice(2);
      } else if (['[CLS]', '[SEP]', '[PAD]', '[UNK]', '[MASK]'].includes(token)) {
        continue;
      } else if (['.', ',', '!', '?', ';', ':', ')', ']', '}', '"', "'"].includes(token)) {
        text += token;
      } else {
        if (text.length > 0 && !text.endsWith(' ') && !text.endsWith('(') && !text.endsWith('[') && !text.endsWith('{')) {
          text += ' ';
        }
        text += token;
      }
    }
    return text.trim();
  }

  getVocabSize(): number {
    return this.vocab.size;
  }
}

// BPE Tokenizer for GPT-2 style
class BPETokenizer {
  private vocab: Map<string, number>;
  private idToToken: Map<number, string>;
  private specialToken: string;

  constructor(vocab: Map<string, number>, idToToken: Map<number, string>) {
    this.vocab = vocab;
    this.idToToken = idToToken;
    this.specialToken = '<|endoftext|>';
  }

  // GPT-2 style preprocessing (preserve case, use Ġ for space)
  preprocess(text: string): string[] {
    const tokens: string[] = [];
    const words = text.split(/(\s+)/);

    for (const word of words) {
      if (/^\s+$/.test(word)) {
        continue; // Skip whitespace, it's encoded in Ġ prefix
      }

      // Add space prefix for non-first words
      const withSpace = tokens.length > 0 ? 'Ġ' + word : word;
      tokens.push(withSpace);
    }

    return tokens;
  }

  tokenize(text: string): string[] {
    const words = this.preprocess(text);
    const tokens: string[] = [];

    for (const word of words) {
      // Try whole word first
      if (this.vocab.has(word)) {
        tokens.push(word);
        continue;
      }

      // BPE: character-level fallback with merges
      const chars = word.split('');
      for (const char of chars) {
        tokens.push(this.vocab.has(char) ? char : '<|endoftext|>');
      }
    }

    return tokens;
  }

  encode(tokens: string[]): number[] {
    return tokens.map(t => this.vocab.get(t) ?? this.vocab.get(this.specialToken) ?? 50256);
  }

  decode(ids: number[]): string[] {
    return ids.map(id => this.idToToken.get(id) ?? this.specialToken);
  }

  detokenize(tokens: string[]): string {
    return tokens.join('')
      .replace(/Ġ/g, ' ')
      .replace(/<\|endoftext\|>/g, '')
      .trim();
  }

  getVocabSize(): number {
    return this.vocab.size;
  }
}

// Create tokenizers
const bertTokenizer = new WordPieceTokenizer(BERT_VOCAB, BERT_ID_TO_TOKEN);
const gpt2Tokenizer = new BPETokenizer(GPT2_VOCAB, GPT2_ID_TO_TOKEN);

function getTokenizer(model: string): WordPieceTokenizer | BPETokenizer {
  switch (model) {
    case 'gpt2':
      return gpt2Tokenizer;
    case 'roberta':
      return gpt2Tokenizer; // RoBERTa uses BPE like GPT-2
    case 't5':
    case 'bert':
    default:
      return bertTokenizer;
  }
}

export async function executeberttokenizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      model = 'bert',
      text,
      tokens: inputTokens,
      ids: inputIds,
      add_special_tokens = true,
      max_length = 512
    } = args;

    if (operation === 'info') {
      const info = {
        tool: 'bert_tokenizer',
        description: 'BERT and transformer model tokenization',
        operations: {
          tokenize: 'Convert text to tokens',
          detokenize: 'Convert tokens back to text',
          encode: 'Convert text to token IDs with attention masks',
          decode: 'Convert token IDs back to tokens',
          vocab: 'Get vocabulary information',
          demo: 'Demonstrate tokenization'
        },
        models: {
          bert: 'WordPiece tokenization with [CLS], [SEP], [PAD] tokens',
          gpt2: 'Byte-Pair Encoding (BPE) with Ġ space markers',
          roberta: 'BPE tokenization (similar to GPT-2)',
          t5: 'SentencePiece tokenization (simulated as WordPiece)'
        },
        special_tokens: {
          bert: ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]'],
          gpt2: ['<|endoftext|>', '<|pad|>']
        },
        algorithms: {
          wordpiece: 'Greedy longest-match-first subword tokenization',
          bpe: 'Byte-Pair Encoding merges frequent character pairs'
        },
        example: {
          text: 'Hello world!',
          bert_tokens: ['[CLS]', 'hello', 'world', '!', '[SEP]'],
          gpt2_tokens: ['Hello', 'Ġworld', '!']
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const demoTexts = [
        'Hello world!',
        'Machine learning is transforming technology.',
        'The quick brown fox jumps over the lazy dog.',
        'BERT uses WordPiece tokenization.'
      ];

      const demos = demoTexts.map(t => {
        const bertResult = bertTokenizer.tokenize(t);
        const gpt2Result = gpt2Tokenizer.tokenize(t);

        return {
          text: t,
          bert: {
            tokens: bertResult,
            token_count: bertResult.length,
            with_special: ['[CLS]', ...bertResult, '[SEP]'],
            ids: bertTokenizer.encode(['[CLS]', ...bertResult, '[SEP]'])
          },
          gpt2: {
            tokens: gpt2Result,
            token_count: gpt2Result.length,
            ids: gpt2Tokenizer.encode(gpt2Result)
          }
        };
      });

      // Subword tokenization demo
      const subwordDemo = {
        word: 'unbelievable',
        bert_subwords: bertTokenizer.tokenize('unbelievable'),
        explanation: 'WordPiece breaks unknown words into known subwords with ## prefix'
      };

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'demo',
          description: 'Tokenization demonstration comparing BERT and GPT-2',
          examples: demos,
          subword_demo: subwordDemo,
          key_differences: {
            bert: 'Uses ## for continuation subwords, lowercase, [CLS]/[SEP] special tokens',
            gpt2: 'Uses Ġ for space-prefixed tokens, preserves case, <|endoftext|> special token'
          }
        }, null, 2)
      };
    }

    if (operation === 'vocab') {
      const tokenizer = getTokenizer(model);

      // Get sample vocabulary entries
      const sampleVocab = model === 'gpt2' || model === 'roberta'
        ? Array.from(GPT2_VOCAB.entries()).slice(0, 50)
        : Array.from(BERT_VOCAB.entries()).slice(0, 50);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'vocab',
          model,
          vocab_size: tokenizer.getVocabSize(),
          note: 'This is a simplified vocabulary for demonstration',
          special_tokens: model === 'gpt2' || model === 'roberta'
            ? ['<|endoftext|>', '<|pad|>']
            : ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]'],
          sample_entries: sampleVocab.map(([token, id]) => ({ token, id }))
        }, null, 2)
      };
    }

    if (operation === 'tokenize') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      const tokenizer = getTokenizer(model);
      const tokens = tokenizer.tokenize(text);
      const finalTokens = add_special_tokens && (model === 'bert' || model === 't5')
        ? ['[CLS]', ...tokens, '[SEP]']
        : tokens;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'tokenize',
          model,
          text,
          tokens: finalTokens,
          token_count: finalTokens.length,
          subword_splits: tokens.filter(t => t.startsWith('##')).length,
          add_special_tokens
        }, null, 2)
      };
    }

    if (operation === 'detokenize') {
      if (!inputTokens || !Array.isArray(inputTokens)) {
        return { toolCallId: id, content: 'Error: tokens array required', isError: true };
      }

      const tokenizer = getTokenizer(model);
      const reconstructed = tokenizer.detokenize(inputTokens);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'detokenize',
          model,
          tokens: inputTokens,
          text: reconstructed
        }, null, 2)
      };
    }

    if (operation === 'encode') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      if (model === 'bert' || model === 't5') {
        const result = bertTokenizer.encodeWithSpecialTokens(text, max_length);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'encode',
            model,
            text,
            max_length,
            tokens: result.tokens.slice(0, Math.min(50, result.tokens.length)),
            input_ids: result.ids.slice(0, Math.min(50, result.ids.length)),
            attention_mask: result.attention_mask.slice(0, Math.min(50, result.attention_mask.length)),
            token_type_ids: result.token_type_ids.slice(0, Math.min(50, result.token_type_ids.length)),
            total_length: result.ids.length,
            note: result.ids.length > 50 ? 'Showing first 50 tokens only' : undefined
          }, null, 2)
        };
      } else {
        const tokenizer = getTokenizer(model);
        const tokens = tokenizer.tokenize(text);
        const ids = tokenizer.encode(tokens);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'encode',
            model,
            text,
            tokens,
            input_ids: ids,
            total_length: ids.length
          }, null, 2)
        };
      }
    }

    if (operation === 'decode') {
      if (!inputIds || !Array.isArray(inputIds)) {
        return { toolCallId: id, content: 'Error: ids array required', isError: true };
      }

      const tokenizer = getTokenizer(model);
      const tokens = tokenizer.decode(inputIds);
      const text_result = tokenizer.detokenize(tokens);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'decode',
          model,
          input_ids: inputIds,
          tokens,
          text: text_result
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isberttokenizerAvailable(): boolean { return true; }
