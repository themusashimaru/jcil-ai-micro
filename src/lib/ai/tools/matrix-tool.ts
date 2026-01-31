/**
 * MATRIX MATH TOOL
 *
 * Linear algebra operations using ml-matrix.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Matrix operations (add, subtract, multiply)
 * - Matrix decomposition (LU, QR, SVD, eigendecomposition)
 * - Matrix inversion and determinant
 * - Solve linear systems
 * - Eigenvalues and eigenvectors
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Matrix: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mlMatrix: any = null;

async function initMatrix(): Promise<boolean> {
  if (Matrix) return true;
  try {
    const mod = await import('ml-matrix');
    Matrix = mod.Matrix;
    mlMatrix = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const matrixTool: UnifiedTool = {
  name: 'matrix_compute',
  description: `Perform linear algebra and matrix operations.

Operations:
- multiply: Matrix multiplication (A × B)
- add: Matrix addition (A + B)
- subtract: Matrix subtraction (A - B)
- inverse: Matrix inverse (A⁻¹)
- determinant: Calculate determinant
- transpose: Matrix transpose (Aᵀ)
- eigenvalues: Calculate eigenvalues and eigenvectors
- solve: Solve linear system Ax = b
- lu: LU decomposition
- qr: QR decomposition
- svd: Singular value decomposition
- rank: Matrix rank
- norm: Matrix norm (Frobenius)

Use cases:
- Solving systems of equations
- Quantum mechanics calculations
- Machine learning preprocessing
- Physics simulations
- Engineering computations`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'multiply',
          'add',
          'subtract',
          'inverse',
          'determinant',
          'transpose',
          'eigenvalues',
          'solve',
          'lu',
          'qr',
          'svd',
          'rank',
          'norm',
        ],
        description: 'Matrix operation to perform',
      },
      matrix_a: {
        type: 'array',
        items: { type: 'object' },
        description: 'First matrix as 2D array of numbers: [[1,2,3], [4,5,6]]',
      },
      matrix_b: {
        type: 'array',
        items: { type: 'object' },
        description: 'Second matrix for binary operations: [[1,2], [3,4]]',
      },
      vector_b: {
        type: 'array',
        items: { type: 'number' },
        description: 'Vector b for solving Ax = b',
      },
    },
    required: ['operation', 'matrix_a'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMatrixAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeMatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, matrix_a, matrix_b, vector_b } = args;

  if (!matrix_a || !Array.isArray(matrix_a) || matrix_a.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Matrix A is required',
      isError: true,
    };
  }

  // Initialize library
  const initialized = await initMatrix();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Matrix library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    const A = new Matrix(matrix_a);
    let result: Record<string, unknown>;

    switch (operation) {
      case 'multiply': {
        if (!matrix_b) {
          throw new Error('Matrix B required for multiplication');
        }
        const B = new Matrix(matrix_b);
        if (A.columns !== B.rows) {
          throw new Error(`Cannot multiply: A columns (${A.columns}) ≠ B rows (${B.rows})`);
        }
        const product = A.mmul(B);
        result = {
          operation: 'multiply',
          dimensionsA: `${A.rows}×${A.columns}`,
          dimensionsB: `${B.rows}×${B.columns}`,
          resultDimensions: `${product.rows}×${product.columns}`,
          result: product.to2DArray(),
        };
        break;
      }

      case 'add': {
        if (!matrix_b) {
          throw new Error('Matrix B required for addition');
        }
        const B = new Matrix(matrix_b);
        if (A.rows !== B.rows || A.columns !== B.columns) {
          throw new Error('Matrices must have same dimensions for addition');
        }
        const sum = Matrix.add(A, B);
        result = {
          operation: 'add',
          dimensions: `${A.rows}×${A.columns}`,
          result: sum.to2DArray(),
        };
        break;
      }

      case 'subtract': {
        if (!matrix_b) {
          throw new Error('Matrix B required for subtraction');
        }
        const B = new Matrix(matrix_b);
        if (A.rows !== B.rows || A.columns !== B.columns) {
          throw new Error('Matrices must have same dimensions for subtraction');
        }
        const diff = Matrix.sub(A, B);
        result = {
          operation: 'subtract',
          dimensions: `${A.rows}×${A.columns}`,
          result: diff.to2DArray(),
        };
        break;
      }

      case 'inverse': {
        if (A.rows !== A.columns) {
          throw new Error('Matrix must be square for inversion');
        }
        const det = mlMatrix.determinant(A);
        if (Math.abs(det) < 1e-10) {
          throw new Error('Matrix is singular (determinant ≈ 0), cannot invert');
        }
        const inv = mlMatrix.inverse(A);
        result = {
          operation: 'inverse',
          dimensions: `${A.rows}×${A.columns}`,
          determinant: det,
          result: inv.to2DArray(),
          verification: 'A × A⁻¹ should equal identity matrix',
        };
        break;
      }

      case 'determinant': {
        if (A.rows !== A.columns) {
          throw new Error('Matrix must be square for determinant');
        }
        const det = mlMatrix.determinant(A);
        result = {
          operation: 'determinant',
          dimensions: `${A.rows}×${A.columns}`,
          determinant: det,
          isSingular: Math.abs(det) < 1e-10,
          interpretation:
            Math.abs(det) < 1e-10
              ? 'Matrix is singular (no inverse exists)'
              : det > 0
                ? 'Positive determinant (orientation preserved)'
                : 'Negative determinant (orientation reversed)',
        };
        break;
      }

      case 'transpose': {
        const trans = A.transpose();
        result = {
          operation: 'transpose',
          originalDimensions: `${A.rows}×${A.columns}`,
          resultDimensions: `${trans.rows}×${trans.columns}`,
          result: trans.to2DArray(),
        };
        break;
      }

      case 'eigenvalues': {
        if (A.rows !== A.columns) {
          throw new Error('Matrix must be square for eigendecomposition');
        }
        const evd = new mlMatrix.EigenvalueDecomposition(A);
        const realEigenvalues = evd.realEigenvalues;
        const imaginaryEigenvalues = evd.imaginaryEigenvalues;
        const eigenvectors = evd.eigenvectorMatrix.to2DArray();

        result = {
          operation: 'eigenvalues',
          dimensions: `${A.rows}×${A.columns}`,
          realEigenvalues,
          imaginaryEigenvalues,
          hasComplexEigenvalues: imaginaryEigenvalues.some((v: number) => Math.abs(v) > 1e-10),
          eigenvectors,
          interpretation: 'Each column of eigenvectors corresponds to an eigenvalue',
        };
        break;
      }

      case 'solve': {
        if (!vector_b) {
          throw new Error('Vector b required for solving Ax = b');
        }
        if (A.rows !== A.columns) {
          throw new Error('Matrix A must be square');
        }
        if (vector_b.length !== A.rows) {
          throw new Error(
            `Vector b length (${vector_b.length}) must equal matrix rows (${A.rows})`
          );
        }

        const B = Matrix.columnVector(vector_b);
        const solution = mlMatrix.solve(A, B);

        result = {
          operation: 'solve',
          system: 'Ax = b',
          matrixDimensions: `${A.rows}×${A.columns}`,
          vectorLength: vector_b.length,
          solution: solution.to1DArray(),
          verification: 'Substitute x back into Ax to verify = b',
        };
        break;
      }

      case 'lu': {
        if (A.rows !== A.columns) {
          throw new Error('Matrix must be square for LU decomposition');
        }
        const lu = new mlMatrix.LuDecomposition(A);
        result = {
          operation: 'lu',
          description: 'A = LU (Lower × Upper triangular)',
          dimensions: `${A.rows}×${A.columns}`,
          L: lu.lowerTriangularMatrix.to2DArray(),
          U: lu.upperTriangularMatrix.to2DArray(),
          pivotVector: lu.pivotVector,
          isSingular: lu.isSingular,
        };
        break;
      }

      case 'qr': {
        const qr = new mlMatrix.QrDecomposition(A);
        result = {
          operation: 'qr',
          description: 'A = QR (Orthogonal × Upper triangular)',
          dimensions: `${A.rows}×${A.columns}`,
          Q: qr.orthogonalMatrix.to2DArray(),
          R: qr.upperTriangularMatrix.to2DArray(),
        };
        break;
      }

      case 'svd': {
        const svd = new mlMatrix.SingularValueDecomposition(A);
        result = {
          operation: 'svd',
          description: 'A = UΣVᵀ (Singular Value Decomposition)',
          dimensions: `${A.rows}×${A.columns}`,
          singularValues: svd.diagonal,
          rank: svd.rank,
          U: svd.leftSingularVectors.to2DArray(),
          V: svd.rightSingularVectors.to2DArray(),
          condition: svd.condition,
          norm: svd.norm,
        };
        break;
      }

      case 'rank': {
        const svd = new mlMatrix.SingularValueDecomposition(A);
        result = {
          operation: 'rank',
          dimensions: `${A.rows}×${A.columns}`,
          rank: svd.rank,
          maxPossibleRank: Math.min(A.rows, A.columns),
          isFullRank: svd.rank === Math.min(A.rows, A.columns),
          singularValues: svd.diagonal,
        };
        break;
      }

      case 'norm': {
        // Frobenius norm
        let sum = 0;
        for (let i = 0; i < A.rows; i++) {
          for (let j = 0; j < A.columns; j++) {
            sum += A.get(i, j) ** 2;
          }
        }
        const frobeniusNorm = Math.sqrt(sum);

        // Spectral norm (largest singular value)
        const svd = new mlMatrix.SingularValueDecomposition(A);
        const spectralNorm = svd.diagonal[0] || 0;

        result = {
          operation: 'norm',
          dimensions: `${A.rows}×${A.columns}`,
          frobeniusNorm,
          spectralNorm,
          infinityNorm: Math.max(
            ...A.to2DArray().map((row: number[]) =>
              row.reduce((sum, val) => sum + Math.abs(val), 0)
            )
          ),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Matrix error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
