/**
 * TRANSFORMER-ARCHITECTURE TOOL
 * Complete Transformer Model Architecture Toolkit
 *
 * This implementation provides:
 * - Self-attention mechanism computation
 * - Multi-head attention
 * - Positional encoding (sinusoidal and learned)
 * - Layer normalization
 * - Feed-forward networks
 * - Full transformer block simulation
 * - Architecture variants (GPT, BERT, T5, ViT)
 *
 * The transformer architecture is the foundation of modern large language
 * models, including GPT, BERT, and the model powering this assistant.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MATRIX OPERATIONS
// ============================================================================

type Matrix = number[][];

function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function matmul(a: Matrix, b: Matrix): Matrix {
  const m = a.length;
  const n = b[0].length;
  const k = b.length;
  const result = zeros(m, n);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let p = 0; p < k; p++) {
        result[i][j] += a[i][p] * b[p][j];
      }
    }
  }

  return result;
}

function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0].length;
  const result = zeros(cols, rows);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = a[i][j];
    }
  }

  return result;
}

function softmax(x: number[]): number[] {
  const max = Math.max(...x);
  const exp = x.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

function softmax2D(x: Matrix): Matrix {
  return x.map((row) => softmax(row));
}

function scale(m: Matrix, scalar: number): Matrix {
  return m.map((row) => row.map((v) => v * scalar));
}

function add(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

// ============================================================================
// POSITIONAL ENCODING
// ============================================================================

/**
 * Sinusoidal positional encoding from "Attention Is All You Need"
 * PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
 * PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
 */
function sinusoidalPositionalEncoding(seqLen: number, dModel: number): Matrix {
  const pe = zeros(seqLen, dModel);

  for (let pos = 0; pos < seqLen; pos++) {
    for (let i = 0; i < dModel; i++) {
      const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / dModel);
      pe[pos][i] = i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
    }
  }

  return pe;
}

/**
 * Rotary Position Embedding (RoPE) - used in LLaMA, GPT-NeoX
 */
function rotaryPositionalEncoding(seqLen: number, dModel: number): { cos: Matrix; sin: Matrix } {
  const cos = zeros(seqLen, dModel / 2);
  const sin = zeros(seqLen, dModel / 2);

  for (let pos = 0; pos < seqLen; pos++) {
    for (let i = 0; i < dModel / 2; i++) {
      const theta = pos / Math.pow(10000, (2 * i) / dModel);
      cos[pos][i] = Math.cos(theta);
      sin[pos][i] = Math.sin(theta);
    }
  }

  return { cos, sin };
}

/**
 * ALiBi (Attention with Linear Biases) - used in BLOOM
 */
function alibiPositionalBias(seqLen: number, numHeads: number): Matrix[] {
  const biases: Matrix[] = [];

  for (let h = 0; h < numHeads; h++) {
    const m = Math.pow(2, -(8 * (h + 1)) / numHeads);
    const bias = zeros(seqLen, seqLen);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        bias[i][j] = m * (j - i);
      }
    }

    biases.push(bias);
  }

  return biases;
}

// ============================================================================
// ATTENTION MECHANISMS
// ============================================================================

/**
 * Scaled Dot-Product Attention
 * Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
 */
function scaledDotProductAttention(
  query: Matrix,
  key: Matrix,
  value: Matrix,
  mask?: Matrix
): { output: Matrix; attentionWeights: Matrix } {
  const dk = key[0].length;
  const scaleFactor = 1 / Math.sqrt(dk);

  // QK^T
  const scores = matmul(query, transpose(key));

  // Scale
  const scaledScores = scale(scores, scaleFactor);

  // Apply mask if provided (for causal attention)
  if (mask) {
    for (let i = 0; i < scaledScores.length; i++) {
      for (let j = 0; j < scaledScores[0].length; j++) {
        if (mask[i][j] === 0) {
          scaledScores[i][j] = -Infinity;
        }
      }
    }
  }

  // Softmax
  const attentionWeights = softmax2D(scaledScores);

  // Multiply by V
  const output = matmul(attentionWeights, value);

  return { output, attentionWeights };
}

/**
 * Multi-Head Attention
 */
function multiHeadAttention(
  query: Matrix,
  key: Matrix,
  value: Matrix,
  numHeads: number,
  dModel: number,
  mask?: Matrix
): { output: Matrix; attentionWeights: Matrix[] } {
  const headDim = dModel / numHeads;
  const attentionWeights: Matrix[] = [];

  // Split into heads and compute attention
  const headOutputs: Matrix[] = [];

  for (let h = 0; h < numHeads; h++) {
    // Extract head slice (simplified - would normally use learned projections)
    const startIdx = h * headDim;
    const endIdx = startIdx + headDim;

    const qHead = query.map((row) => row.slice(startIdx, endIdx));
    const kHead = key.map((row) => row.slice(startIdx, endIdx));
    const vHead = value.map((row) => row.slice(startIdx, endIdx));

    const { output, attentionWeights: weights } = scaledDotProductAttention(
      qHead,
      kHead,
      vHead,
      mask
    );

    headOutputs.push(output);
    attentionWeights.push(weights);
  }

  // Concatenate heads
  const output = query.map((_, i) => {
    return headOutputs.flatMap((head) => head[i]);
  });

  return { output, attentionWeights };
}

/**
 * Create causal mask (lower triangular)
 */
function createCausalMask(seqLen: number): Matrix {
  const mask = zeros(seqLen, seqLen);
  for (let i = 0; i < seqLen; i++) {
    for (let j = 0; j <= i; j++) {
      mask[i][j] = 1;
    }
  }
  return mask;
}

// ============================================================================
// LAYER NORMALIZATION
// ============================================================================

/**
 * Layer Normalization
 * LN(x) = gamma * (x - mean) / sqrt(var + eps) + beta
 */
function layerNorm(
  x: Matrix,
  eps: number = 1e-5
): { normalized: Matrix; mean: number[]; variance: number[] } {
  const normalized = zeros(x.length, x[0].length);
  const means: number[] = [];
  const variances: number[] = [];

  for (let i = 0; i < x.length; i++) {
    const row = x[i];
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    const variance = row.reduce((sum, v) => sum + (v - mean) ** 2, 0) / row.length;

    means.push(mean);
    variances.push(variance);

    for (let j = 0; j < row.length; j++) {
      normalized[i][j] = (row[j] - mean) / Math.sqrt(variance + eps);
    }
  }

  return { normalized, mean: means, variance: variances };
}

/**
 * RMSNorm - Root Mean Square Layer Normalization (used in LLaMA)
 */
function rmsNorm(x: Matrix, eps: number = 1e-5): Matrix {
  return x.map((row) => {
    const rms = Math.sqrt(row.reduce((sum, v) => sum + v * v, 0) / row.length + eps);
    return row.map((v) => v / rms);
  });
}

// ============================================================================
// FEED-FORWARD NETWORK
// ============================================================================

/**
 * GELU activation function
 */
function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

/**
 * SwiGLU activation (used in LLaMA)
 */
export function swiglu(x: number, gate: number): number {
  return x * (gate / (1 + Math.exp(-gate)));
}

/**
 * Feed-Forward Network
 * FFN(x) = max(0, xW1 + b1)W2 + b2
 */
function feedForward(
  x: Matrix,
  dModel: number,
  dFF: number,
  activation: 'relu' | 'gelu' = 'gelu'
): Matrix {
  // Simplified FFN computation
  const intermediate = x.map((row) => {
    const expanded = new Array(dFF)
      .fill(0)
      .map((_, i) => row.reduce((sum, v, j) => sum + v * Math.sin(i * j + 1), 0) / row.length);

    return expanded.map((v) => (activation === 'gelu' ? gelu(v) : Math.max(0, v)));
  });

  // Project back to dModel
  return intermediate.map((row) => {
    return new Array(dModel)
      .fill(0)
      .map((_, i) => row.reduce((sum, v, j) => sum + v * Math.cos(i * j + 1), 0) / row.length);
  });
}

// ============================================================================
// TRANSFORMER BLOCK
// ============================================================================

interface TransformerBlockConfig {
  dModel: number;
  numHeads: number;
  dFF: number;
  dropout?: number;
  preNorm?: boolean;
  causal?: boolean;
}

function transformerBlock(
  x: Matrix,
  config: TransformerBlockConfig
): { output: Matrix; attentionWeights: Matrix[] } {
  const { dModel, numHeads, dFF, preNorm = true, causal = true } = config;
  const seqLen = x.length;

  let residual = x;
  let current = x;

  // Self-attention sub-layer
  if (preNorm) {
    current = layerNorm(current).normalized;
  }

  const mask = causal ? createCausalMask(seqLen) : undefined;
  const { output: attnOutput, attentionWeights } = multiHeadAttention(
    current,
    current,
    current,
    numHeads,
    dModel,
    mask
  );

  current = add(residual, attnOutput);

  if (!preNorm) {
    current = layerNorm(current).normalized;
  }

  // Feed-forward sub-layer
  residual = current;

  if (preNorm) {
    current = layerNorm(current).normalized;
  }

  current = feedForward(current, dModel, dFF);
  current = add(residual, current);

  if (!preNorm) {
    current = layerNorm(current).normalized;
  }

  return { output: current, attentionWeights };
}

// ============================================================================
// ARCHITECTURE VARIANTS
// ============================================================================

interface ArchitectureConfig {
  name: string;
  dModel: number;
  numLayers: number;
  numHeads: number;
  dFF: number;
  vocabSize: number;
  maxSeqLen: number;
  features: string[];
  parameters: string;
}

const ARCHITECTURES: Record<string, ArchitectureConfig> = {
  'GPT-2-small': {
    name: 'GPT-2 Small',
    dModel: 768,
    numLayers: 12,
    numHeads: 12,
    dFF: 3072,
    vocabSize: 50257,
    maxSeqLen: 1024,
    features: ['Causal attention', 'Learned positional embeddings', 'Pre-norm', 'GELU activation'],
    parameters: '124M',
  },
  'GPT-2-medium': {
    name: 'GPT-2 Medium',
    dModel: 1024,
    numLayers: 24,
    numHeads: 16,
    dFF: 4096,
    vocabSize: 50257,
    maxSeqLen: 1024,
    features: ['Causal attention', 'Learned positional embeddings', 'Pre-norm', 'GELU activation'],
    parameters: '355M',
  },
  'GPT-3': {
    name: 'GPT-3 175B',
    dModel: 12288,
    numLayers: 96,
    numHeads: 96,
    dFF: 49152,
    vocabSize: 50257,
    maxSeqLen: 2048,
    features: ['Causal attention', 'Learned positional embeddings', 'Sparse attention patterns'],
    parameters: '175B',
  },
  'BERT-base': {
    name: 'BERT Base',
    dModel: 768,
    numLayers: 12,
    numHeads: 12,
    dFF: 3072,
    vocabSize: 30522,
    maxSeqLen: 512,
    features: [
      'Bidirectional attention',
      'Learned positional embeddings',
      'Post-norm',
      'MLM + NSP training',
    ],
    parameters: '110M',
  },
  'T5-base': {
    name: 'T5 Base',
    dModel: 768,
    numLayers: 12,
    numHeads: 12,
    dFF: 3072,
    vocabSize: 32128,
    maxSeqLen: 512,
    features: ['Encoder-decoder', 'Relative positional bias', 'Pre-norm', 'Text-to-text format'],
    parameters: '220M',
  },
  'LLaMA-7B': {
    name: 'LLaMA 7B',
    dModel: 4096,
    numLayers: 32,
    numHeads: 32,
    dFF: 11008,
    vocabSize: 32000,
    maxSeqLen: 2048,
    features: ['RoPE', 'SwiGLU activation', 'RMSNorm', 'No bias terms'],
    parameters: '7B',
  },
  'ViT-base': {
    name: 'Vision Transformer Base',
    dModel: 768,
    numLayers: 12,
    numHeads: 12,
    dFF: 3072,
    vocabSize: 0,
    maxSeqLen: 197, // 196 patches + 1 CLS token for 224x224 with 16x16 patches
    features: ['Patch embedding', 'Learned position + CLS token', 'Image classification'],
    parameters: '86M',
  },
};

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const transformerarchitectureTool: UnifiedTool = {
  name: 'transformer_architecture',
  description: 'Transformer architecture - attention, positional encoding, layer design',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'attention',
          'positional',
          'layer_norm',
          'ffn',
          'block',
          'architecture',
          'compare',
          'info',
        ],
        description: 'Operation to perform',
      },
      variant: {
        type: 'string',
        enum: [
          'GPT-2-small',
          'GPT-2-medium',
          'GPT-3',
          'BERT-base',
          'T5-base',
          'LLaMA-7B',
          'ViT-base',
        ],
        description: 'Architecture variant',
      },
      seq_len: {
        type: 'number',
        description: 'Sequence length',
      },
      d_model: {
        type: 'number',
        description: 'Model dimension',
      },
      num_heads: {
        type: 'number',
        description: 'Number of attention heads',
      },
      input: {
        type: 'array',
        items: { type: 'array' },
        description: 'Input matrix for computation (2D array of numbers)',
      },
      encoding_type: {
        type: 'string',
        enum: ['sinusoidal', 'rotary', 'alibi'],
        description: 'Type of positional encoding',
      },
    },
    required: ['operation'],
  },
};

export async function executetransformerarchitecture(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      variant = 'GPT-2-small',
      seq_len = 8,
      d_model = 64,
      num_heads = 4,
      input,
      encoding_type = 'sinusoidal',
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Transformer Architecture Tool',
        description: 'Understand and compute transformer model components',
        operations: {
          attention: 'Compute scaled dot-product attention',
          positional: 'Generate positional encodings',
          layer_norm: 'Apply layer normalization',
          ffn: 'Compute feed-forward network output',
          block: 'Run full transformer block',
          architecture: 'Get architecture specifications',
          compare: 'Compare different architectures',
        },
        architectures: Object.keys(ARCHITECTURES),
        positionalEncodings: {
          sinusoidal: 'Original transformer encoding using sin/cos',
          rotary: 'RoPE - Rotary Position Embedding (LLaMA)',
          alibi: 'Attention with Linear Biases (BLOOM)',
        },
        keyComponents: {
          attention: 'Core mechanism: Attention(Q,K,V) = softmax(QK^T/sqrt(d_k))V',
          multiHead: 'Parallel attention heads with different learned projections',
          layerNorm: 'Stabilizes training by normalizing activations',
          ffn: 'Expands and contracts representations through MLP',
          residual: 'Skip connections for gradient flow',
        },
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Architecture operation
    if (operation === 'architecture') {
      const arch = ARCHITECTURES[variant];
      if (!arch) {
        return { toolCallId: id, content: `Error: Unknown architecture ${variant}`, isError: true };
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'architecture',
            architecture: arch,
            computations: {
              attentionPerLayer: `${arch.numHeads} heads × (${arch.maxSeqLen}² × ${arch.dModel / arch.numHeads})`,
              ffnPerLayer: `2 × ${arch.dModel} × ${arch.dFF}`,
              totalAttentionFLOPs: `~${Math.round((arch.numLayers * arch.numHeads * arch.maxSeqLen ** 2 * (arch.dModel / arch.numHeads)) / 1e9)}G per forward pass`,
            },
            design: {
              headDim: arch.dModel / arch.numHeads,
              ffnRatio: arch.dFF / arch.dModel,
              layersToHeadsRatio: arch.numLayers / arch.numHeads,
            },
          },
          null,
          2
        ),
      };
    }

    // Compare operation
    if (operation === 'compare') {
      const comparison = Object.entries(ARCHITECTURES).map(([key, arch]) => ({
        variant: key,
        parameters: arch.parameters,
        dModel: arch.dModel,
        layers: arch.numLayers,
        heads: arch.numHeads,
        headDim: arch.dModel / arch.numHeads,
        ffnRatio: (arch.dFF / arch.dModel).toFixed(2),
        maxSeq: arch.maxSeqLen,
        vocab: arch.vocabSize,
      }));

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'compare',
            architectures: comparison,
            scalingLaws: {
              note: 'Parameters scale roughly as: 12 × L × d² where L=layers, d=dModel',
              observation: 'Head dimension typically 64-128 regardless of model size',
            },
          },
          null,
          2
        ),
      };
    }

    // Positional encoding operation
    if (operation === 'positional') {
      let encoding: unknown;

      if (encoding_type === 'sinusoidal') {
        const pe = sinusoidalPositionalEncoding(seq_len, d_model);
        encoding = {
          type: 'sinusoidal',
          formula: 'PE(pos,2i) = sin(pos/10000^(2i/d)), PE(pos,2i+1) = cos(...)',
          encoding: pe
            .slice(0, 5)
            .map((row) => row.slice(0, 8).map((v) => Math.round(v * 1000) / 1000)),
          properties: {
            periodicPattern: true,
            infiniteExtrapolation: true,
            relativePosInfo: 'PE(pos+k) can be expressed as linear function of PE(pos)',
          },
        };
      } else if (encoding_type === 'rotary') {
        const { cos, sin } = rotaryPositionalEncoding(seq_len, d_model);
        encoding = {
          type: 'rotary (RoPE)',
          formula: 'Apply rotation matrix to Q,K based on position',
          cos: cos
            .slice(0, 4)
            .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
          sin: sin
            .slice(0, 4)
            .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
          properties: {
            relativePosEncoding: true,
            decayWithDistance: true,
            extrapolation: 'Better long-context extrapolation than learned',
          },
        };
      } else if (encoding_type === 'alibi') {
        const biases = alibiPositionalBias(seq_len, num_heads);
        encoding = {
          type: 'ALiBi (Attention with Linear Biases)',
          formula: 'Add bias m*(j-i) to attention scores where m varies by head',
          biases: biases
            .slice(0, 2)
            .map((b) =>
              b.slice(0, 5).map((row) => row.slice(0, 5).map((v) => Math.round(v * 100) / 100))
            ),
          properties: {
            noLearnedParams: true,
            linearComplexity: true,
            extrapolation: 'Excellent length extrapolation',
          },
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'positional',
            seqLen: seq_len,
            dModel: d_model,
            encoding,
          },
          null,
          2
        ),
      };
    }

    // Attention operation
    if (operation === 'attention') {
      // Generate or use provided input
      const inputMatrix =
        input ||
        Array.from({ length: seq_len }, () =>
          Array.from({ length: d_model }, () => Math.random() * 2 - 1)
        );

      const mask = createCausalMask(inputMatrix.length);
      const { output, attentionWeights } = multiHeadAttention(
        inputMatrix,
        inputMatrix,
        inputMatrix,
        num_heads,
        d_model,
        mask
      );

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'attention',
            config: {
              seqLen: inputMatrix.length,
              dModel: d_model,
              numHeads: num_heads,
              headDim: d_model / num_heads,
              causal: true,
            },
            output: {
              shape: [output.length, output[0].length],
              sample: output
                .slice(0, 3)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
            },
            attentionPattern: {
              numPatterns: attentionWeights.length,
              head0Sample: attentionWeights[0]
                ?.slice(0, 4)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 100) / 100)),
            },
            explanation: {
              formula: 'Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) × V',
              scaling: 'Division by sqrt(d_k) prevents softmax saturation',
              mask: 'Causal mask ensures position i only attends to positions <= i',
            },
          },
          null,
          2
        ),
      };
    }

    // Layer normalization operation
    if (operation === 'layer_norm') {
      const inputMatrix =
        input ||
        Array.from({ length: seq_len }, () =>
          Array.from({ length: d_model }, () => Math.random() * 10 - 5)
        );

      const { normalized, mean, variance } = layerNorm(inputMatrix);
      const rmsNormalized = rmsNorm(inputMatrix);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'layer_norm',
            input: {
              shape: [inputMatrix.length, inputMatrix[0].length],
              sample: inputMatrix
                .slice(0, 2)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 100) / 100)),
            },
            layerNorm: {
              formula: 'LN(x) = (x - mean) / sqrt(var + eps)',
              normalized: normalized
                .slice(0, 2)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
              mean: mean.slice(0, 4).map((v) => Math.round(v * 1000) / 1000),
              variance: variance.slice(0, 4).map((v) => Math.round(v * 1000) / 1000),
            },
            rmsNorm: {
              formula: 'RMSNorm(x) = x / sqrt(mean(x²) + eps)',
              normalized: rmsNormalized
                .slice(0, 2)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
              note: 'No mean subtraction, used in LLaMA for stability',
            },
          },
          null,
          2
        ),
      };
    }

    // FFN operation
    if (operation === 'ffn') {
      const inputMatrix =
        input ||
        Array.from({ length: seq_len }, () =>
          Array.from({ length: d_model }, () => Math.random() * 2 - 1)
        );

      const dFF = d_model * 4;
      const output = feedForward(inputMatrix, d_model, dFF, 'gelu');

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'ffn',
            config: {
              dModel: d_model,
              dFF,
              expansionRatio: dFF / d_model,
              activation: 'GELU',
            },
            input: {
              shape: [inputMatrix.length, inputMatrix[0].length],
            },
            output: {
              shape: [output.length, output[0].length],
              sample: output
                .slice(0, 2)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
            },
            explanation: {
              structure: 'Two linear layers with activation between',
              formula: 'FFN(x) = GELU(xW₁ + b₁)W₂ + b₂',
              purpose: 'Provides non-linearity and capacity for memorization',
            },
            variants: {
              original: 'ReLU activation, 4x expansion',
              gpt: 'GELU activation',
              llama: 'SwiGLU activation, 8/3x expansion',
              mixture: 'MoE uses multiple sparse FFN experts',
            },
          },
          null,
          2
        ),
      };
    }

    // Full block operation
    if (operation === 'block') {
      const inputMatrix =
        input ||
        Array.from({ length: seq_len }, () =>
          Array.from({ length: d_model }, () => Math.random() * 2 - 1)
        );

      const config: TransformerBlockConfig = {
        dModel: d_model,
        numHeads: num_heads,
        dFF: d_model * 4,
        preNorm: true,
        causal: true,
      };

      const { output, attentionWeights } = transformerBlock(inputMatrix, config);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'block',
            config,
            input: {
              shape: [inputMatrix.length, inputMatrix[0].length],
            },
            output: {
              shape: [output.length, output[0].length],
              sample: output
                .slice(0, 3)
                .map((row) => row.slice(0, 4).map((v) => Math.round(v * 1000) / 1000)),
            },
            structure: {
              sublayers: ['Multi-Head Self-Attention', 'Feed-Forward Network'],
              normalization: config.preNorm ? 'Pre-LayerNorm' : 'Post-LayerNorm',
              residuals: 'x + SubLayer(Norm(x))',
            },
            attentionHeads: attentionWeights.length,
          },
          null,
          2
        ),
      };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function istransformerarchitectureAvailable(): boolean {
  return true;
}
