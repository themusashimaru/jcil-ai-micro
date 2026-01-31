/**
 * CHEMISTRY TOOL
 *
 * Molecular structure analysis using OpenChemLib.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Parse SMILES notation
 * - Calculate molecular properties (weight, formula)
 * - Validate chemical structures
 * - Generate canonical SMILES
 * - Count atoms and bonds
 * - Detect functional groups
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let OCL: any = null;

async function initOCL(): Promise<boolean> {
  if (OCL) return true;
  try {
    const mod = await import('openchemlib');
    OCL = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const chemistryTool: UnifiedTool = {
  name: 'analyze_molecule',
  description: `Analyze molecular structures using SMILES notation.

Operations:
- parse: Parse SMILES and get molecular information
- properties: Calculate molecular properties (weight, formula, atoms, bonds)
- validate: Check if a SMILES string is valid
- canonical: Get the canonical SMILES representation
- compare: Compare two molecules for similarity

SMILES (Simplified Molecular Input Line Entry System) is a notation for molecules:
- C = carbon, N = nitrogen, O = oxygen, S = sulfur
- Lowercase = aromatic (c, n, o)
- Numbers indicate ring connections
- = double bond, # triple bond
- () branching, [] for charges and isotopes

Common examples:
- Water: O
- Ethanol: CCO
- Aspirin: CC(=O)OC1=CC=CC=C1C(=O)O
- Caffeine: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
- Ibuprofen: CC(C)CC1=CC=C(C=C1)C(C)C(=O)O

Use cases:
- Drug discovery and analysis
- Chemical structure validation
- Molecular weight calculations
- Structure-activity relationship studies`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'properties', 'validate', 'canonical', 'compare'],
        description: 'Chemistry operation to perform',
      },
      smiles: {
        type: 'string',
        description: 'SMILES notation of the molecule',
      },
      smiles2: {
        type: 'string',
        description: 'Second SMILES for comparison',
      },
      name: {
        type: 'string',
        description: 'Common name of the molecule (for reference)',
      },
    },
    required: ['operation', 'smiles'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isChemistryAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeChemistry(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, smiles, smiles2, name } = args;

  // Initialize library
  const initialized = await initOCL();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Chemistry library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'parse':
      case 'properties': {
        const molecule = OCL.Molecule.fromSmiles(smiles);
        if (!molecule) {
          throw new Error('Could not parse SMILES notation');
        }

        // Get molecular formula
        const formula = molecule.getMolecularFormula().formula;
        const weight = molecule.getMolecularFormula().absoluteWeight;

        // Count atoms
        const atomCounts: Record<string, number> = {};
        for (let i = 0; i < molecule.getAllAtoms(); i++) {
          const atomicNo = molecule.getAtomicNo(i);
          const symbol = OCL.Molecule.cAtomLabel[atomicNo] || `Atom${atomicNo}`;
          atomCounts[symbol] = (atomCounts[symbol] || 0) + 1;
        }

        // Count bonds
        const bondCounts = {
          single: 0,
          double: 0,
          triple: 0,
          aromatic: 0,
          total: molecule.getAllBonds(),
        };

        for (let i = 0; i < molecule.getAllBonds(); i++) {
          const order = molecule.getBondOrder(i);
          if (molecule.isAromaticBond(i)) {
            bondCounts.aromatic++;
          } else if (order === 1) {
            bondCounts.single++;
          } else if (order === 2) {
            bondCounts.double++;
          } else if (order === 3) {
            bondCounts.triple++;
          }
        }

        // Get rings
        const ringCount = molecule.getRingSet()?.getSize() || 0;

        // Check for common functional groups
        const functionalGroups = detectFunctionalGroups(smiles);

        result = {
          operation: 'properties',
          input: smiles,
          name: name || null,
          molecularFormula: formula,
          molecularWeight: weight.toFixed(4),
          molecularWeightUnit: 'g/mol',
          atomCount: molecule.getAllAtoms(),
          atomBreakdown: atomCounts,
          bondCount: bondCounts,
          ringCount,
          functionalGroups,
          canonicalSmiles: molecule.toSmiles(),
          isValid: true,
        };
        break;
      }

      case 'validate': {
        let isValid = false;
        let error = null;
        let molecule = null;

        try {
          molecule = OCL.Molecule.fromSmiles(smiles);
          isValid = molecule !== null && molecule.getAllAtoms() > 0;
        } catch (e) {
          error = (e as Error).message;
        }

        result = {
          operation: 'validate',
          input: smiles,
          isValid,
          error,
          atomCount: isValid && molecule ? molecule.getAllAtoms() : 0,
          suggestion: !isValid
            ? 'Check SMILES syntax: use uppercase for atoms (C,N,O,S), () for branches, numbers for rings'
            : null,
        };
        break;
      }

      case 'canonical': {
        const molecule = OCL.Molecule.fromSmiles(smiles);
        if (!molecule) {
          throw new Error('Could not parse SMILES notation');
        }

        const canonical = molecule.toSmiles();

        result = {
          operation: 'canonical',
          input: smiles,
          canonical,
          isAlreadyCanonical: smiles === canonical,
          atomCount: molecule.getAllAtoms(),
        };
        break;
      }

      case 'compare': {
        if (!smiles2) {
          throw new Error('Second SMILES (smiles2) required for comparison');
        }

        const mol1 = OCL.Molecule.fromSmiles(smiles);
        const mol2 = OCL.Molecule.fromSmiles(smiles2);

        if (!mol1 || !mol2) {
          throw new Error('Could not parse one or both SMILES notations');
        }

        const canonical1 = mol1.toSmiles();
        const canonical2 = mol2.toSmiles();
        const isIdentical = canonical1 === canonical2;

        // Calculate Tanimoto similarity using fingerprints
        const fp1 = mol1.getFragmentNumbers(OCL.Molecule.cFragmentTypeRedFP);
        const fp2 = mol2.getFragmentNumbers(OCL.Molecule.cFragmentTypeRedFP);

        let intersection = 0;
        let union = 0;
        const maxLen = Math.max(fp1.length, fp2.length);
        for (let i = 0; i < maxLen; i++) {
          const v1 = fp1[i] || 0;
          const v2 = fp2[i] || 0;
          intersection += Math.min(v1, v2);
          union += Math.max(v1, v2);
        }
        const similarity = union > 0 ? intersection / union : 0;

        result = {
          operation: 'compare',
          molecule1: {
            input: smiles,
            canonical: canonical1,
            atoms: mol1.getAllAtoms(),
            formula: mol1.getMolecularFormula().formula,
          },
          molecule2: {
            input: smiles2,
            canonical: canonical2,
            atoms: mol2.getAllAtoms(),
            formula: mol2.getMolecularFormula().formula,
          },
          isIdentical,
          similarity: similarity.toFixed(4),
          similarityPercent: `${(similarity * 100).toFixed(1)}%`,
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
      content: `Chemistry error: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// Helper function to detect common functional groups
function detectFunctionalGroups(smiles: string): string[] {
  const groups: string[] = [];

  // Simple pattern matching for common groups
  if (smiles.includes('O') && !smiles.includes('=O')) groups.push('Hydroxyl (-OH)');
  if (smiles.includes('C=O') || smiles.includes('C(=O)')) groups.push('Carbonyl (C=O)');
  if (smiles.includes('C(=O)O') || smiles.includes('C(O)=O'))
    groups.push('Carboxylic acid (-COOH)');
  if (smiles.includes('C(=O)N') || smiles.includes('NC=O')) groups.push('Amide (-CONH-)');
  if (smiles.includes('N') && !smiles.includes('=N') && !smiles.includes('#N'))
    groups.push('Amine (-NH-)');
  if (smiles.includes('C#N')) groups.push('Nitrile (-CN)');
  if (smiles.includes('N=O') || smiles.includes('[N+](=O)[O-]')) groups.push('Nitro (-NO2)');
  if (smiles.includes('S')) groups.push('Thiol/Sulfide (-S-)');
  if (
    smiles.includes('F') ||
    smiles.includes('Cl') ||
    smiles.includes('Br') ||
    smiles.includes('I')
  ) {
    groups.push('Halogen');
  }
  if (smiles.includes('c') || smiles.includes('C1=CC=CC=C1')) groups.push('Aromatic ring');
  if (smiles.includes('C=C') && !smiles.includes('c')) groups.push('Alkene (C=C)');
  if (smiles.includes('C#C')) groups.push('Alkyne (C≡C)');
  if (smiles.includes('COC') || smiles.includes('C-O-C')) groups.push('Ether (-O-)');
  if (smiles.includes('C(=O)OC')) groups.push('Ester (-COO-)');

  return groups.length > 0 ? groups : ['No common functional groups detected'];
}
