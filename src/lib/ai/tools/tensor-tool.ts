/**
 * TENSOR/N-DIMENSIONAL ARRAY TOOL
 *
 * N-dimensional array operations using ndarray.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - N-dimensional array creation and manipulation
 * - Slicing and indexing
 * - Broadcasting operations
 * - Reshaping
 * - Basic tensor math
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ndarray: any = null;

async function initNdarray(): Promise<boolean> {
  if (ndarray) return true;
  try {
    const mod = await import('ndarray');
    ndarray = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const tensorTool: UnifiedTool = {
  name: 'tensor_ops',
  description: `Perform N-dimensional array (tensor) operations.

Operations:
- create: Create a tensor from data with shape
- zeros/ones: Create tensor filled with zeros/ones
- reshape: Reshape tensor to new dimensions
- transpose: Transpose dimensions
- slice: Extract a slice of the tensor
- get/set: Get or set values at indices
- info: Get tensor information (shape, size, etc.)
- elementwise: Element-wise operations (add, multiply, etc.)
- reduce: Reduction operations (sum, mean, max, min)

Use cases:
- Image data manipulation
- Scientific computing
- Machine learning data prep
- Multi-dimensional data analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create',
          'zeros',
          'ones',
          'reshape',
          'transpose',
          'slice',
          'get',
          'set',
          'info',
          'elementwise',
          'reduce',
        ],
        description: 'Tensor operation',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Flat array of tensor data',
      },
      shape: {
        type: 'array',
        items: { type: 'number' },
        description: 'Tensor shape (e.g., [3, 4] for 3x4 matrix)',
      },
      new_shape: {
        type: 'array',
        items: { type: 'number' },
        description: 'New shape for reshape operation',
      },
      indices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Indices for get/set operations',
      },
      value: {
        type: 'number',
        description: 'Value for set operation',
      },
      slice_start: {
        type: 'array',
        items: { type: 'number' },
        description: 'Start indices for slice',
      },
      slice_end: {
        type: 'array',
        items: { type: 'number' },
        description: 'End indices for slice',
      },
      axis: {
        type: 'number',
        description: 'Axis for reduction operations',
      },
      op: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide', 'sum', 'mean', 'max', 'min'],
        description: 'Element-wise or reduction operation',
      },
      scalar: {
        type: 'number',
        description: 'Scalar value for element-wise operations',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isTensorAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeTensor(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    data?: number[];
    shape?: number[];
    new_shape?: number[];
    indices?: number[];
    value?: number;
    slice_start?: number[];
    slice_end?: number[];
    axis?: number;
    op?: string;
    scalar?: number;
  };

  const { operation } = args;

  try {
    const initialized = await initNdarray();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize ndarray library' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'create': {
        const { data, shape } = args;
        if (!data || !shape) {
          throw new Error('data and shape required for create');
        }

        const expectedSize = shape.reduce((a, b) => a * b, 1);
        if (data.length !== expectedSize) {
          throw new Error(
            `Data length ${data.length} doesn't match shape ${shape.join('x')} (expected ${expectedSize})`
          );
        }

        // Create ndarray to validate shape/data compatibility
        ndarray(new Float64Array(data), shape);

        result = {
          operation: 'create',
          shape: shape,
          size: data.length,
          dtype: 'float64',
          ndim: shape.length,
          sample_data: data.slice(0, 20),
        };
        break;
      }

      case 'zeros':
      case 'ones': {
        const { shape } = args;
        if (!shape) {
          throw new Error('shape required');
        }

        const size = shape.reduce((a, b) => a * b, 1);
        const fillValue = operation === 'ones' ? 1 : 0;
        const data = new Float64Array(size).fill(fillValue);

        result = {
          operation,
          shape,
          size,
          fill_value: fillValue,
          sample_data: Array.from(data.slice(0, 20)),
        };
        break;
      }

      case 'reshape': {
        const { data, shape, new_shape } = args;
        if (!data || !shape || !new_shape) {
          throw new Error('data, shape, and new_shape required');
        }

        const oldSize = shape.reduce((a, b) => a * b, 1);
        const newSize = new_shape.reduce((a, b) => a * b, 1);

        if (oldSize !== newSize) {
          throw new Error(
            `Cannot reshape ${shape.join('x')} (${oldSize}) to ${new_shape.join('x')} (${newSize})`
          );
        }

        result = {
          operation: 'reshape',
          old_shape: shape,
          new_shape,
          size: oldSize,
          data: data.slice(0, 20),
        };
        break;
      }

      case 'transpose': {
        const { data, shape } = args;
        if (!data || !shape) {
          throw new Error('data and shape required');
        }

        if (shape.length !== 2) {
          throw new Error('Transpose currently supports 2D arrays only');
        }

        const [rows, cols] = shape;
        const transposed: number[] = [];

        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            transposed.push(data[r * cols + c]);
          }
        }

        result = {
          operation: 'transpose',
          old_shape: shape,
          new_shape: [cols, rows],
          transposed_data: transposed.slice(0, 20),
        };
        break;
      }

      case 'slice': {
        const { data, shape, slice_start, slice_end } = args;
        if (!data || !shape) {
          throw new Error('data and shape required');
        }

        const start = slice_start || shape.map(() => 0);
        const end = slice_end || shape;

        // For 2D arrays
        if (shape.length === 2) {
          const [rows, cols] = shape;
          const sliced: number[] = [];

          for (let r = start[0]; r < Math.min(end[0], rows); r++) {
            for (let c = start[1]; c < Math.min(end[1], cols); c++) {
              sliced.push(data[r * cols + c]);
            }
          }

          const newShape = [Math.min(end[0], rows) - start[0], Math.min(end[1], cols) - start[1]];

          result = {
            operation: 'slice',
            original_shape: shape,
            slice_range: { start, end },
            new_shape: newShape,
            sliced_data: sliced,
          };
        } else {
          // 1D slice
          const sliced = data.slice(start[0], end[0]);
          result = {
            operation: 'slice',
            original_shape: shape,
            slice_range: { start, end },
            new_shape: [sliced.length],
            sliced_data: sliced,
          };
        }
        break;
      }

      case 'get': {
        const { data, shape, indices } = args;
        if (!data || !shape || !indices) {
          throw new Error('data, shape, and indices required');
        }

        // Calculate flat index
        let flatIndex = 0;
        let multiplier = 1;
        for (let i = shape.length - 1; i >= 0; i--) {
          flatIndex += indices[i] * multiplier;
          multiplier *= shape[i];
        }

        result = {
          operation: 'get',
          indices,
          value: data[flatIndex],
          flat_index: flatIndex,
        };
        break;
      }

      case 'set': {
        const { data, shape, indices, value } = args;
        if (!data || !shape || !indices || value === undefined) {
          throw new Error('data, shape, indices, and value required');
        }

        // Calculate flat index
        let flatIndex = 0;
        let multiplier = 1;
        for (let i = shape.length - 1; i >= 0; i--) {
          flatIndex += indices[i] * multiplier;
          multiplier *= shape[i];
        }

        const newData = [...data];
        const oldValue = newData[flatIndex];
        newData[flatIndex] = value;

        result = {
          operation: 'set',
          indices,
          old_value: oldValue,
          new_value: value,
          flat_index: flatIndex,
        };
        break;
      }

      case 'info': {
        const { data, shape } = args;
        if (!data || !shape) {
          throw new Error('data and shape required');
        }

        const size = shape.reduce((a, b) => a * b, 1);

        result = {
          operation: 'info',
          shape,
          ndim: shape.length,
          size,
          dtype: 'float64',
          min: Math.min(...data),
          max: Math.max(...data),
          mean: data.reduce((a, b) => a + b, 0) / data.length,
          memory_bytes: data.length * 8, // 64-bit floats
        };
        break;
      }

      case 'elementwise': {
        const { data, op, scalar } = args;
        if (!data || !op) {
          throw new Error('data and op required');
        }

        let resultData: number[];
        switch (op) {
          case 'add':
            resultData = data.map((v) => v + (scalar || 0));
            break;
          case 'subtract':
            resultData = data.map((v) => v - (scalar || 0));
            break;
          case 'multiply':
            resultData = data.map((v) => v * (scalar || 1));
            break;
          case 'divide':
            resultData = data.map((v) => v / (scalar || 1));
            break;
          default:
            throw new Error(`Unknown elementwise op: ${op}`);
        }

        result = {
          operation: 'elementwise',
          op,
          scalar,
          result_sample: resultData.slice(0, 20),
        };
        break;
      }

      case 'reduce': {
        const { data, op, shape, axis } = args;
        if (!data || !op) {
          throw new Error('data and op required');
        }

        let reduceResult: number | number[];

        if (axis === undefined) {
          // Full reduction
          switch (op) {
            case 'sum':
              reduceResult = data.reduce((a, b) => a + b, 0);
              break;
            case 'mean':
              reduceResult = data.reduce((a, b) => a + b, 0) / data.length;
              break;
            case 'max':
              reduceResult = Math.max(...data);
              break;
            case 'min':
              reduceResult = Math.min(...data);
              break;
            default:
              throw new Error(`Unknown reduce op: ${op}`);
          }
        } else {
          // Axis reduction (simplified for 2D)
          if (!shape || shape.length !== 2) {
            throw new Error('Axis reduction requires 2D shape');
          }
          const [rows, cols] = shape;
          reduceResult = [];

          if (axis === 0) {
            // Reduce along rows
            for (let c = 0; c < cols; c++) {
              const colData = [];
              for (let r = 0; r < rows; r++) {
                colData.push(data[r * cols + c]);
              }
              switch (op) {
                case 'sum':
                  reduceResult.push(colData.reduce((a, b) => a + b, 0));
                  break;
                case 'mean':
                  reduceResult.push(colData.reduce((a, b) => a + b, 0) / colData.length);
                  break;
                case 'max':
                  reduceResult.push(Math.max(...colData));
                  break;
                case 'min':
                  reduceResult.push(Math.min(...colData));
                  break;
              }
            }
          } else {
            // Reduce along columns
            for (let r = 0; r < rows; r++) {
              const rowData = data.slice(r * cols, (r + 1) * cols);
              switch (op) {
                case 'sum':
                  reduceResult.push(rowData.reduce((a, b) => a + b, 0));
                  break;
                case 'mean':
                  reduceResult.push(rowData.reduce((a, b) => a + b, 0) / rowData.length);
                  break;
                case 'max':
                  reduceResult.push(Math.max(...rowData));
                  break;
                case 'min':
                  reduceResult.push(Math.min(...rowData));
                  break;
              }
            }
          }
        }

        result = {
          operation: 'reduce',
          op,
          axis: axis ?? 'all',
          result: reduceResult,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
