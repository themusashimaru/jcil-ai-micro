import { describe, it, expect } from 'vitest';
import { executeDnaBio, isDnaBioAvailable, dnaBioTool } from './dna-bio-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'analyze_sequence', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeDnaBio(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('dnaBioTool metadata', () => {
  it('should have correct name', () => {
    expect(dnaBioTool.name).toBe('analyze_sequence');
  });

  it('should require operation and sequence', () => {
    expect(dnaBioTool.parameters.required).toContain('operation');
    expect(dnaBioTool.parameters.required).toContain('sequence');
  });
});

describe('isDnaBioAvailable', () => {
  it('should return true', () => {
    expect(isDnaBioAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// complement operation
// -------------------------------------------------------------------
describe('executeDnaBio - complement', () => {
  it('should complement DNA sequence', async () => {
    const result = await getResult({
      operation: 'complement',
      sequence: 'ATGC',
    });
    expect(result.complement).toBe('TACG');
    expect(result.sequenceType).toBe('dna');
  });

  it('should complement longer DNA', async () => {
    const result = await getResult({
      operation: 'complement',
      sequence: 'AATTGGCC',
    });
    expect(result.complement).toBe('TTAACCGG');
  });

  it('should error on protein sequences', async () => {
    const res = await executeDnaBio(
      makeCall({ operation: 'complement', sequence: 'MFPQLR', sequence_type: 'protein' })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// reverse_complement operation
// -------------------------------------------------------------------
describe('executeDnaBio - reverse_complement', () => {
  it('should reverse complement DNA', async () => {
    const result = await getResult({
      operation: 'reverse_complement',
      sequence: 'ATGC',
    });
    expect(result.reverseComplement).toBe('GCAT');
  });

  it('should return correct length', async () => {
    const result = await getResult({
      operation: 'reverse_complement',
      sequence: 'AATTGGCC',
    });
    expect(result.length).toBe(8);
    expect(result.reverseComplement).toBe('GGCCAATT');
  });
});

// -------------------------------------------------------------------
// transcribe operation
// -------------------------------------------------------------------
describe('executeDnaBio - transcribe', () => {
  it('should transcribe DNA to RNA', async () => {
    const result = await getResult({
      operation: 'transcribe',
      sequence: 'ATGCATGC',
    });
    expect(result.rna).toBe('AUGCAUGC');
    expect(result.note).toContain('T replaced with U');
  });

  it('should error on RNA input', async () => {
    const res = await executeDnaBio(
      makeCall({ operation: 'transcribe', sequence: 'AUGCAUGC', sequence_type: 'rna' })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// translate operation
// -------------------------------------------------------------------
describe('executeDnaBio - translate', () => {
  it('should translate DNA to protein', async () => {
    const result = await getResult({
      operation: 'translate',
      sequence: 'ATGTTTCCC',
    });
    expect(result.protein).toBe('MFP');
    expect(result.totalCodons).toBe(3);
  });

  it('should translate RNA directly', async () => {
    const result = await getResult({
      operation: 'translate',
      sequence: 'AUGUUUCCC',
      sequence_type: 'rna',
    });
    expect(result.protein).toBe('MFP');
  });

  it('should detect start and stop codons', async () => {
    const result = await getResult({
      operation: 'translate',
      sequence: 'ATGAAATAA',
    });
    expect(result.protein).toContain('M');
    expect(result.protein).toContain('*');
    expect(result.startCodon).toContain('Found');
    expect(result.stopCodon).toContain('Found');
  });

  it('should handle different reading frames', async () => {
    const result = await getResult({
      operation: 'translate',
      sequence: 'AATGTTTCCC',
      reading_frame: 2,
    });
    expect(result.readingFrame).toBe(2);
    expect(result.protein).toBe('MFP');
  });
});

// -------------------------------------------------------------------
// gc_content operation
// -------------------------------------------------------------------
describe('executeDnaBio - gc_content', () => {
  it('should calculate GC content', async () => {
    const result = await getResult({
      operation: 'gc_content',
      sequence: 'GGCC',
    });
    expect(result.gcContent).toBe('100.00');
    expect(result.gcCount).toBe(4);
  });

  it('should calculate 50% GC content', async () => {
    const result = await getResult({
      operation: 'gc_content',
      sequence: 'AATTGGCC',
    });
    expect(result.gcContent).toBe('50.00');
    expect(result.atContent).toBe('50.00');
  });

  it('should calculate 0% GC content for AT only', async () => {
    const result = await getResult({
      operation: 'gc_content',
      sequence: 'AATT',
    });
    expect(result.gcContent).toBe('0.00');
  });

  it('should include interpretation', async () => {
    const result = await getResult({
      operation: 'gc_content',
      sequence: 'GGCGGCGGCG',
    });
    expect(result.interpretation).toBe('High GC content');
  });
});

// -------------------------------------------------------------------
// stats operation
// -------------------------------------------------------------------
describe('executeDnaBio - stats', () => {
  it('should compute base composition', async () => {
    const result = await getResult({
      operation: 'stats',
      sequence: 'AATTGGCC',
    });
    expect(result.length).toBe(8);
    expect(result.composition.A).toBe(2);
    expect(result.composition.T).toBe(2);
    expect(result.composition.G).toBe(2);
    expect(result.composition.C).toBe(2);
  });

  it('should compute GC content percentage', async () => {
    const result = await getResult({
      operation: 'stats',
      sequence: 'AATTGGCC',
    });
    expect(result.gcContent).toBe('50.00%');
  });

  it('should estimate molecular weight for DNA', async () => {
    const result = await getResult({
      operation: 'stats',
      sequence: 'ATGCATGC',
    });
    expect(result.molecularWeight).toContain('Da');
  });
});

// -------------------------------------------------------------------
// codon_usage operation
// -------------------------------------------------------------------
describe('executeDnaBio - codon_usage', () => {
  it('should analyze codon frequency', async () => {
    const result = await getResult({
      operation: 'codon_usage',
      sequence: 'ATGATGATG',
    });
    expect(result.totalCodons).toBe(3);
    expect(result.uniqueCodons).toBe(1);
    expect(result.usage.AUG).toBeDefined();
    expect(result.usage.AUG.aminoAcid).toBe('M');
    expect(result.usage.AUG.aminoAcidName).toBe('Methionine');
  });

  it('should handle mixed codons', async () => {
    const result = await getResult({
      operation: 'codon_usage',
      sequence: 'ATGAAATTT',
    });
    expect(result.totalCodons).toBe(3);
    expect(result.uniqueCodons).toBe(3);
  });
});

// -------------------------------------------------------------------
// find_orf operation
// -------------------------------------------------------------------
describe('executeDnaBio - find_orf', () => {
  it('should find open reading frames', async () => {
    // Create a sequence with a clear ORF: ATG + 30 codons + TAA
    const codons = 'ATG' + 'AAA'.repeat(35) + 'TAA';
    const result = await getResult({
      operation: 'find_orf',
      sequence: codons,
      min_orf_length: 30,
    });
    expect(result.orfsFound).toBeGreaterThanOrEqual(1);
  });

  it('should respect minimum ORF length', async () => {
    const codons = 'ATG' + 'AAA'.repeat(5) + 'TAA';
    const result = await getResult({
      operation: 'find_orf',
      sequence: codons,
      min_orf_length: 30,
    });
    expect(result.orfsFound).toBe(0);
  });

  it('should search all 3 reading frames', async () => {
    const result = await getResult({
      operation: 'find_orf',
      sequence: 'A' + 'ATG' + 'AAA'.repeat(35) + 'TAA',
      min_orf_length: 30,
    });
    expect(result.operation).toBe('find_orf');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeDnaBio - errors', () => {
  it('should error without sequence', async () => {
    const res = await executeDnaBio(makeCall({ operation: 'complement' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error for unknown operation', async () => {
    const res = await executeDnaBio(makeCall({ operation: 'xyz', sequence: 'ATGC' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeDnaBio({
      id: 'my-id',
      name: 'analyze_sequence',
      arguments: { operation: 'complement', sequence: 'ATGC' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
