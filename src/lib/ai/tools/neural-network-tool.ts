/**
 * NEURAL NETWORK VISUALIZATION TOOL
 *
 * Educational neural network demonstrations and visualizations.
 * Forward/backward propagation, activation functions, and training.
 *
 * Part of TIER AI MASTERY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// ACTIVATION FUNCTIONS
// ============================================================================

const ACTIVATIONS: Record<string, { fn: (x: number) => number; derivative: (x: number) => number; name: string }> = {
  sigmoid: {
    fn: (x) => 1 / (1 + Math.exp(-x)),
    derivative: (x) => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); },
    name: 'Sigmoid σ(x) = 1/(1+e^-x)',
  },
  tanh: {
    fn: (x) => Math.tanh(x),
    derivative: (x) => 1 - Math.tanh(x) ** 2,
    name: 'Tanh',
  },
  relu: {
    fn: (x) => Math.max(0, x),
    derivative: (x) => x > 0 ? 1 : 0,
    name: 'ReLU max(0, x)',
  },
  leaky_relu: {
    fn: (x) => x > 0 ? x : 0.01 * x,
    derivative: (x) => x > 0 ? 1 : 0.01,
    name: 'Leaky ReLU',
  },
  elu: {
    fn: (x) => x > 0 ? x : Math.exp(x) - 1,
    derivative: (x) => x > 0 ? 1 : Math.exp(x),
    name: 'ELU',
  },
  softplus: {
    fn: (x) => Math.log(1 + Math.exp(x)),
    derivative: (x) => 1 / (1 + Math.exp(-x)),
    name: 'Softplus ln(1+e^x)',
  },
  swish: {
    fn: (x) => x / (1 + Math.exp(-x)),
    derivative: (x) => {
      const s = 1 / (1 + Math.exp(-x));
      return s + x * s * (1 - s);
    },
    name: 'Swish x·σ(x)',
  },
  gelu: {
    fn: (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3))),
    derivative: (x) => {
      const cdf = 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
      return cdf + x * 0.5 * (1 - Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)) ** 2) *
        Math.sqrt(2 / Math.PI) * (1 + 0.134145 * x ** 2);
    },
    name: 'GELU (used in GPT/BERT)',
  },
};

// ============================================================================
// SIMPLE NEURAL NETWORK
// ============================================================================

interface Layer {
  weights: number[][];
  biases: number[];
  activation: string;
}

interface Network {
  layers: Layer[];
}

function createNetwork(layerSizes: number[], activation: string = 'relu'): Network {
  const layers: Layer[] = [];

  for (let i = 0; i < layerSizes.length - 1; i++) {
    const inputSize = layerSizes[i];
    const outputSize = layerSizes[i + 1];

    // Xavier initialization
    const scale = Math.sqrt(2 / (inputSize + outputSize));
    const weights: number[][] = [];
    for (let j = 0; j < outputSize; j++) {
      weights.push(Array.from({ length: inputSize }, () => (Math.random() * 2 - 1) * scale));
    }

    const biases = Array(outputSize).fill(0);
    const act = i === layerSizes.length - 2 ? 'sigmoid' : activation;

    layers.push({ weights, biases, activation: act });
  }

  return { layers };
}

function forward(network: Network, input: number[]): { outputs: number[][]; activations: number[][] } {
  const outputs: number[][] = [input];
  const activations: number[][] = [];

  let current = input;

  for (const layer of network.layers) {
    const preActivation: number[] = [];
    const activation: number[] = [];
    const actFn = ACTIVATIONS[layer.activation]?.fn || ACTIVATIONS.relu.fn;

    for (let j = 0; j < layer.weights.length; j++) {
      let sum = layer.biases[j];
      for (let k = 0; k < current.length; k++) {
        sum += layer.weights[j][k] * current[k];
      }
      preActivation.push(sum);
      activation.push(actFn(sum));
    }

    activations.push(preActivation);
    outputs.push(activation);
    current = activation;
  }

  return { outputs, activations };
}

function backward(
  network: Network,
  input: number[],
  target: number[],
  learningRate: number = 0.1
): { loss: number; gradients: number[][][] } {
  const { outputs, activations } = forward(network, input);
  const output = outputs[outputs.length - 1];

  // MSE Loss
  let loss = 0;
  const outputError: number[] = [];
  for (let i = 0; i < output.length; i++) {
    const error = output[i] - target[i];
    loss += error ** 2;
    outputError.push(error);
  }
  loss /= output.length;

  // Backpropagation
  const gradients: number[][][] = [];
  let delta = outputError;

  for (let l = network.layers.length - 1; l >= 0; l--) {
    const layer = network.layers[l];
    const prevOutput = outputs[l];
    const derivFn = ACTIVATIONS[layer.activation]?.derivative || ACTIVATIONS.relu.derivative;

    // Apply activation derivative
    const activationDeriv = activations[l].map(derivFn);
    delta = delta.map((d, i) => d * activationDeriv[i]);

    // Calculate weight gradients
    const layerGradients: number[][] = [];
    for (let j = 0; j < layer.weights.length; j++) {
      const neuronGradients: number[] = [];
      for (let k = 0; k < prevOutput.length; k++) {
        const grad = delta[j] * prevOutput[k];
        neuronGradients.push(grad);
        // Update weight
        layer.weights[j][k] -= learningRate * grad;
      }
      layerGradients.push(neuronGradients);
      // Update bias
      layer.biases[j] -= learningRate * delta[j];
    }
    gradients.unshift(layerGradients);

    // Propagate error to previous layer
    if (l > 0) {
      const newDelta: number[] = Array(prevOutput.length).fill(0);
      for (let j = 0; j < layer.weights.length; j++) {
        for (let k = 0; k < prevOutput.length; k++) {
          newDelta[k] += delta[j] * layer.weights[j][k];
        }
      }
      delta = newDelta;
    }
  }

  return { loss, gradients };
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeNetwork(layerSizes: number[], width: number = 50): string {
  const height = Math.max(...layerSizes) * 2 + 1;
  const canvas: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  const layerX = layerSizes.map((_, i) => Math.floor((i + 0.5) * width / layerSizes.length));

  for (let l = 0; l < layerSizes.length; l++) {
    const neurons = layerSizes[l];
    const startY = Math.floor((height - neurons * 2 + 1) / 2);

    for (let n = 0; n < neurons; n++) {
      const y = startY + n * 2;
      const x = layerX[l];
      if (y >= 0 && y < height && x >= 0 && x < width) {
        canvas[y][x] = '●';
      }

      // Draw connections to next layer
      if (l < layerSizes.length - 1) {
        const nextNeurons = layerSizes[l + 1];
        const nextStartY = Math.floor((height - nextNeurons * 2 + 1) / 2);
        const nextX = layerX[l + 1];

        for (let nn = 0; nn < nextNeurons; nn++) {
          const nextY = nextStartY + nn * 2;
          // Draw line
          const steps = Math.abs(nextX - x);
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const px = Math.round(x + t * (nextX - x));
            const py = Math.round(y + t * (nextY - y));
            if (py >= 0 && py < height && px >= 0 && px < width && canvas[py][px] === ' ') {
              canvas[py][px] = '·';
            }
          }
        }
      }
    }
  }

  // Labels
  const labels = ['Input', ...layerSizes.slice(1, -1).map((_, i) => `Hidden ${i + 1}`), 'Output'];
  let labelRow = '';
  for (let l = 0; l < layerSizes.length; l++) {
    const pos = layerX[l] - Math.floor(labels[l].length / 2);
    while (labelRow.length < pos) labelRow += ' ';
    labelRow += labels[l];
  }

  return canvas.map(row => row.join('')).join('\n') + '\n' + labelRow;
}

function visualizeActivation(name: string, width: number = 40, height: number = 10): string {
  const act = ACTIVATIONS[name];
  if (!act) return 'Unknown activation';

  const canvas: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  // Draw axis
  for (let x = 0; x < width; x++) canvas[height - 1][x] = '─';
  for (let y = 0; y < height; y++) canvas[y][0] = '│';
  canvas[height - 1][0] = '└';

  // Plot function from -4 to 4
  for (let x = 1; x < width; x++) {
    const xVal = (x / width) * 8 - 4;
    const yVal = act.fn(xVal);
    const yNorm = (yVal + 1) / 2; // Normalize to 0-1 for most activations
    const y = Math.round((1 - Math.min(1, Math.max(0, yNorm))) * (height - 2));
    if (y >= 0 && y < height - 1) {
      canvas[y][x] = '●';
    }
  }

  return `${act.name}\n` + canvas.map(row => row.join('')).join('\n');
}

function visualizeGradientFlow(gradients: number[][][]): string {
  const lines: string[] = ['Gradient Flow (magnitude):'];

  for (let l = 0; l < gradients.length; l++) {
    const layerGrad = gradients[l];
    const avgMag = layerGrad.flat().reduce((sum, g) => sum + Math.abs(g), 0) / layerGrad.flat().length;
    const bar = '█'.repeat(Math.min(40, Math.round(avgMag * 100)));
    lines.push(`Layer ${l + 1}: ${bar} ${avgMag.toFixed(4)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const neuralNetworkTool: UnifiedTool = {
  name: 'neural_network',
  description: `Educational neural network demonstrations.

Operations:
- create: Create neural network architecture
- forward: Forward propagation
- backward: Backpropagation with gradient calculation
- train: Train on simple dataset (XOR, AND, OR)
- activation: Visualize activation function
- visualize: ASCII network visualization
- list_activations: List available activations

Supports: sigmoid, tanh, relu, leaky_relu, elu, softplus, swish, gelu`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'forward', 'backward', 'train', 'activation', 'visualize', 'list_activations'],
        description: 'Neural network operation',
      },
      layers: { type: 'string', description: 'Layer sizes as JSON array [2, 4, 1]' },
      activation: { type: 'string', description: 'Activation function' },
      input: { type: 'string', description: 'Input vector as JSON array' },
      target: { type: 'string', description: 'Target output as JSON array' },
      dataset: { type: 'string', description: 'Dataset name (xor, and, or)' },
      epochs: { type: 'number', description: 'Training epochs' },
      learning_rate: { type: 'number', description: 'Learning rate' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

const DATASETS: Record<string, { inputs: number[][]; targets: number[][] }> = {
  xor: {
    inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
    targets: [[0], [1], [1], [0]],
  },
  and: {
    inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
    targets: [[0], [0], [0], [1]],
  },
  or: {
    inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
    targets: [[0], [1], [1], [1]],
  },
};

export async function executeNeuralNetwork(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'create': {
        const layersStr = args.layers || '[2, 4, 1]';
        const layers: number[] = JSON.parse(layersStr);
        const activation = args.activation || 'relu';

        const network = createNetwork(layers, activation);

        result = {
          operation: 'create',
          architecture: layers,
          activation,
          total_parameters: network.layers.reduce((sum, l) =>
            sum + l.weights.flat().length + l.biases.length, 0),
          visualization: visualizeNetwork(layers),
        };
        break;
      }

      case 'forward': {
        const layersStr = args.layers || '[2, 4, 1]';
        const layers: number[] = JSON.parse(layersStr);
        const inputStr = args.input || '[0.5, 0.5]';
        const input: number[] = JSON.parse(inputStr);

        const network = createNetwork(layers, args.activation || 'relu');
        const { outputs } = forward(network, input);

        result = {
          operation: 'forward',
          input,
          layer_outputs: outputs.map((o, i) => ({
            layer: i === 0 ? 'input' : i === outputs.length - 1 ? 'output' : `hidden_${i}`,
            values: o.map(v => Math.round(v * 1000) / 1000),
          })),
          final_output: outputs[outputs.length - 1].map(v => Math.round(v * 1000) / 1000),
        };
        break;
      }

      case 'backward': {
        const layersStr = args.layers || '[2, 4, 1]';
        const layers: number[] = JSON.parse(layersStr);
        const inputStr = args.input || '[1, 0]';
        const targetStr = args.target || '[1]';
        const input: number[] = JSON.parse(inputStr);
        const target: number[] = JSON.parse(targetStr);

        const network = createNetwork(layers, args.activation || 'relu');
        const { loss, gradients } = backward(network, input, target);

        result = {
          operation: 'backward',
          input,
          target,
          loss: Math.round(loss * 10000) / 10000,
          gradient_flow: visualizeGradientFlow(gradients),
        };
        break;
      }

      case 'train': {
        const { dataset = 'xor', epochs = 1000, learning_rate = 0.5 } = args;
        const data = DATASETS[dataset];
        if (!data) throw new Error(`Unknown dataset: ${dataset}`);

        const layers = [data.inputs[0].length, 4, data.targets[0].length];
        const network = createNetwork(layers, 'sigmoid');

        const lossHistory: number[] = [];
        for (let e = 0; e < epochs; e++) {
          let epochLoss = 0;
          for (let i = 0; i < data.inputs.length; i++) {
            const { loss } = backward(network, data.inputs[i], data.targets[i], learning_rate);
            epochLoss += loss;
          }
          if (e % (epochs / 10) === 0) {
            lossHistory.push(epochLoss / data.inputs.length);
          }
        }

        // Test
        const predictions = data.inputs.map(input => {
          const { outputs } = forward(network, input);
          return outputs[outputs.length - 1].map(v => Math.round(v * 100) / 100);
        });

        result = {
          operation: 'train',
          dataset,
          epochs,
          learning_rate,
          loss_history: lossHistory.map(l => Math.round(l * 10000) / 10000),
          predictions: data.inputs.map((input, i) => ({
            input,
            target: data.targets[i],
            prediction: predictions[i],
          })),
          final_loss: lossHistory[lossHistory.length - 1],
        };
        break;
      }

      case 'activation': {
        const name = args.activation || 'relu';
        const act = ACTIVATIONS[name];
        if (!act) throw new Error(`Unknown activation: ${name}`);

        const samples = Array.from({ length: 21 }, (_, i) => {
          const x = (i - 10) / 2.5;
          return { x, y: Math.round(act.fn(x) * 1000) / 1000, dy: Math.round(act.derivative(x) * 1000) / 1000 };
        });

        result = {
          operation: 'activation',
          name: act.name,
          visualization: visualizeActivation(name),
          samples,
          properties: {
            range: name === 'sigmoid' ? '[0, 1]' : name === 'tanh' ? '[-1, 1]' : name.includes('relu') ? '[0, ∞)' : '(-∞, ∞)',
            differentiable: !name.includes('relu') || name === 'leaky_relu',
            vanishing_gradient_risk: name === 'sigmoid' || name === 'tanh',
          },
        };
        break;
      }

      case 'visualize': {
        const layersStr = args.layers || '[2, 8, 4, 1]';
        const layers: number[] = JSON.parse(layersStr);

        result = {
          operation: 'visualize',
          architecture: layers,
          total_neurons: layers.reduce((a, b) => a + b, 0),
          total_connections: layers.slice(0, -1).reduce((sum, l, i) => sum + l * layers[i + 1], 0),
          visualization: visualizeNetwork(layers, 60),
        };
        break;
      }

      case 'list_activations': {
        result = {
          operation: 'list_activations',
          activations: Object.entries(ACTIVATIONS).map(([key, val]) => ({
            name: key,
            formula: val.name,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Neural Network Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isNeuralNetworkAvailable(): boolean { return true; }
