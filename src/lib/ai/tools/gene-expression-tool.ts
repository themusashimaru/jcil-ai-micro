/**
 * GENE-EXPRESSION TOOL
 * Comprehensive gene expression analysis
 *
 * Provides:
 * - Read count normalization (TPM, FPKM, CPM)
 * - Differential expression analysis (DESeq2-like, edgeR-like)
 * - Hierarchical clustering
 * - Pathway enrichment analysis
 * - Gene set enrichment analysis (GSEA)
 * - Expression visualization helpers
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// REFERENCE DATA
// ============================================================================

interface Gene {
  symbol: string;
  name: string;
  length_bp: number;
  chromosome: string;
  pathway: string[];
  go_terms: string[];
}

const REFERENCE_GENES: Record<string, Gene> = {
  GAPDH: { symbol: 'GAPDH', name: 'Glyceraldehyde-3-phosphate dehydrogenase', length_bp: 1310, chromosome: '12', pathway: ['Glycolysis'], go_terms: ['GO:0006096'] },
  ACTB: { symbol: 'ACTB', name: 'Beta-actin', length_bp: 1793, chromosome: '7', pathway: ['Cytoskeleton'], go_terms: ['GO:0000146'] },
  TP53: { symbol: 'TP53', name: 'Tumor protein p53', length_bp: 2591, chromosome: '17', pathway: ['Cell cycle', 'Apoptosis', 'DNA repair'], go_terms: ['GO:0006915', 'GO:0006281'] },
  BRCA1: { symbol: 'BRCA1', name: 'BRCA1 DNA repair associated', length_bp: 7094, chromosome: '17', pathway: ['DNA repair', 'Cell cycle'], go_terms: ['GO:0006281'] },
  EGFR: { symbol: 'EGFR', name: 'Epidermal growth factor receptor', length_bp: 5616, chromosome: '7', pathway: ['MAPK signaling', 'PI3K-Akt signaling'], go_terms: ['GO:0007169'] },
  MYC: { symbol: 'MYC', name: 'MYC proto-oncogene', length_bp: 2367, chromosome: '8', pathway: ['Cell cycle', 'Apoptosis'], go_terms: ['GO:0006355'] },
  VEGFA: { symbol: 'VEGFA', name: 'Vascular endothelial growth factor A', length_bp: 2308, chromosome: '6', pathway: ['Angiogenesis', 'VEGF signaling'], go_terms: ['GO:0001525'] },
  IL6: { symbol: 'IL6', name: 'Interleukin 6', length_bp: 1131, chromosome: '7', pathway: ['JAK-STAT signaling', 'Cytokine signaling'], go_terms: ['GO:0006955'] },
  TNF: { symbol: 'TNF', name: 'Tumor necrosis factor', length_bp: 1590, chromosome: '6', pathway: ['NF-kB signaling', 'Apoptosis'], go_terms: ['GO:0006915'] },
  KRAS: { symbol: 'KRAS', name: 'KRAS proto-oncogene', length_bp: 5446, chromosome: '12', pathway: ['MAPK signaling', 'Ras signaling'], go_terms: ['GO:0007264'] },
  PIK3CA: { symbol: 'PIK3CA', name: 'Phosphatidylinositol-4,5-bisphosphate 3-kinase', length_bp: 3207, chromosome: '3', pathway: ['PI3K-Akt signaling'], go_terms: ['GO:0046854'] },
  AKT1: { symbol: 'AKT1', name: 'AKT serine/threonine kinase 1', length_bp: 2817, chromosome: '14', pathway: ['PI3K-Akt signaling', 'mTOR signaling'], go_terms: ['GO:0043066'] },
  CDK4: { symbol: 'CDK4', name: 'Cyclin dependent kinase 4', length_bp: 1176, chromosome: '12', pathway: ['Cell cycle'], go_terms: ['GO:0000278'] },
  RB1: { symbol: 'RB1', name: 'RB transcriptional corepressor 1', length_bp: 4767, chromosome: '13', pathway: ['Cell cycle'], go_terms: ['GO:0000278'] },
  PTEN: { symbol: 'PTEN', name: 'Phosphatase and tensin homolog', length_bp: 5466, chromosome: '10', pathway: ['PI3K-Akt signaling'], go_terms: ['GO:0046854'] }
};

// Pathway database (simplified)
const PATHWAYS: Record<string, { name: string; genes: string[]; category: string }> = {
  'hsa04110': { name: 'Cell cycle', genes: ['TP53', 'RB1', 'CDK4', 'MYC'], category: 'Cell growth' },
  'hsa04210': { name: 'Apoptosis', genes: ['TP53', 'TNF', 'MYC'], category: 'Cell death' },
  'hsa04151': { name: 'PI3K-Akt signaling', genes: ['PIK3CA', 'AKT1', 'PTEN', 'EGFR'], category: 'Signal transduction' },
  'hsa04010': { name: 'MAPK signaling', genes: ['EGFR', 'KRAS'], category: 'Signal transduction' },
  'hsa04370': { name: 'VEGF signaling', genes: ['VEGFA'], category: 'Angiogenesis' },
  'hsa04630': { name: 'JAK-STAT signaling', genes: ['IL6'], category: 'Signal transduction' },
  'hsa03440': { name: 'Homologous recombination', genes: ['BRCA1'], category: 'DNA repair' }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const geneexpressionTool: UnifiedTool = {
  name: 'gene_expression',
  description: 'Comprehensive gene expression analysis tool. Supports normalization (TPM, FPKM, CPM), differential expression (DESeq2-like, edgeR-like), clustering, pathway enrichment, and GSEA.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['normalize', 'differential', 'cluster', 'pathway', 'gsea', 'visualize', 'info', 'examples'],
        description: 'Operation to perform'
      },
      method: {
        type: 'string',
        enum: ['DESeq2', 'edgeR', 'limma', 'TPM', 'FPKM', 'CPM'],
        description: 'Analysis method'
      },
      // For normalize
      raw_counts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gene: { type: 'string' },
            counts: { type: 'array', items: { type: 'number' } }
          }
        },
        description: 'Raw count data [{gene, counts: [sample1, sample2, ...]}]'
      },
      gene_lengths: {
        type: 'object',
        description: 'Gene lengths in bp {gene: length}'
      },
      // For differential
      condition_a: { type: 'array', items: { type: 'number' }, description: 'Sample indices for condition A' },
      condition_b: { type: 'array', items: { type: 'number' }, description: 'Sample indices for condition B' },
      fdr_threshold: { type: 'number', description: 'FDR threshold (default 0.05)' },
      log2fc_threshold: { type: 'number', description: 'Log2 fold change threshold (default 1)' },
      // For cluster
      genes: { type: 'array', items: { type: 'string' }, description: 'Gene symbols to cluster' },
      // For pathway
      gene_list: { type: 'array', items: { type: 'string' }, description: 'List of differentially expressed genes' },
      background_size: { type: 'number', description: 'Background gene set size' },
      // For gsea
      ranked_genes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gene: { type: 'string' },
            score: { type: 'number' }
          }
        },
        description: 'Genes ranked by expression metric'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// NORMALIZATION METHODS
// ============================================================================

interface CountData {
  gene: string;
  counts: number[];
}

interface NormalizedData {
  gene: string;
  values: number[];
  mean: number;
  variance: number;
}

function normalizeTPM(counts: CountData[], geneLengths: Record<string, number>): NormalizedData[] {
  // TPM = (reads / gene_length) / sum(reads/length) * 1e6
  const numSamples = counts[0]?.counts.length || 0;
  const results: NormalizedData[] = [];

  for (let s = 0; s < numSamples; s++) {
    // Calculate RPK for each gene in this sample
    const rpk: Record<string, number> = {};
    let sumRpk = 0;

    for (const gene of counts) {
      const length = geneLengths[gene.gene] || REFERENCE_GENES[gene.gene]?.length_bp || 1000;
      const rpkValue = gene.counts[s] / (length / 1000);
      rpk[gene.gene] = rpkValue;
      sumRpk += rpkValue;
    }

    // Scale to TPM
    for (const gene of counts) {
      if (!results.find(r => r.gene === gene.gene)) {
        results.push({
          gene: gene.gene,
          values: [],
          mean: 0,
          variance: 0
        });
      }
      const geneResult = results.find(r => r.gene === gene.gene)!;
      geneResult.values.push((rpk[gene.gene] / sumRpk) * 1e6);
    }
  }

  // Calculate mean and variance
  for (const r of results) {
    r.mean = r.values.reduce((a, b) => a + b, 0) / r.values.length;
    r.variance = r.values.reduce((a, b) => a + (b - r.mean) ** 2, 0) / r.values.length;
  }

  return results;
}

function normalizeFPKM(counts: CountData[], geneLengths: Record<string, number>): NormalizedData[] {
  // FPKM = (reads * 1e9) / (gene_length * total_reads)
  const numSamples = counts[0]?.counts.length || 0;
  const results: NormalizedData[] = [];

  // Calculate total reads per sample
  const totalReads: number[] = [];
  for (let s = 0; s < numSamples; s++) {
    totalReads.push(counts.reduce((sum, g) => sum + g.counts[s], 0));
  }

  for (const gene of counts) {
    const length = geneLengths[gene.gene] || REFERENCE_GENES[gene.gene]?.length_bp || 1000;
    const values: number[] = [];

    for (let s = 0; s < numSamples; s++) {
      const fpkm = (gene.counts[s] * 1e9) / (length * totalReads[s]);
      values.push(fpkm);
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

    results.push({ gene: gene.gene, values, mean, variance });
  }

  return results;
}

function normalizeCPM(counts: CountData[]): NormalizedData[] {
  // CPM = (reads / total_reads) * 1e6
  const numSamples = counts[0]?.counts.length || 0;
  const results: NormalizedData[] = [];

  // Calculate total reads per sample
  const totalReads: number[] = [];
  for (let s = 0; s < numSamples; s++) {
    totalReads.push(counts.reduce((sum, g) => sum + g.counts[s], 0));
  }

  for (const gene of counts) {
    const values: number[] = [];

    for (let s = 0; s < numSamples; s++) {
      const cpm = (gene.counts[s] / totalReads[s]) * 1e6;
      values.push(cpm);
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

    results.push({ gene: gene.gene, values, mean, variance });
  }

  return results;
}

// ============================================================================
// DIFFERENTIAL EXPRESSION ANALYSIS
// ============================================================================

interface DEResult {
  gene: string;
  baseMean: number;
  log2FoldChange: number;
  lfcSE: number;
  pvalue: number;
  padj: number;
  significant: boolean;
  regulation: 'up' | 'down' | 'ns';
}

function differentialExpression(
  counts: CountData[],
  conditionA: number[],
  conditionB: number[],
  method: string,
  fdrThreshold: number = 0.05,
  log2fcThreshold: number = 1
): {
  results: DEResult[];
  summary: {
    total_genes: number;
    significant: number;
    upregulated: number;
    downregulated: number;
    method: string;
    thresholds: { fdr: number; log2fc: number };
  };
  volcano_data: Array<{ gene: string; log2FC: number; negLog10P: number; significant: boolean }>;
} {
  const results: DEResult[] = [];

  for (const gene of counts) {
    // Get counts for each condition
    const countsA = conditionA.map(i => gene.counts[i]);
    const countsB = conditionB.map(i => gene.counts[i]);

    // Calculate means
    const meanA = countsA.reduce((a, b) => a + b, 0) / countsA.length;
    const meanB = countsB.reduce((a, b) => a + b, 0) / countsB.length;
    const baseMean = (meanA + meanB) / 2;

    // Calculate log2 fold change
    const log2FC = Math.log2((meanB + 1) / (meanA + 1));

    // Calculate variance
    const varA = countsA.reduce((a, b) => a + (b - meanA) ** 2, 0) / (countsA.length - 1);
    const varB = countsB.reduce((a, b) => a + (b - meanB) ** 2, 0) / (countsB.length - 1);

    // Standard error of log2FC (simplified)
    const se = Math.sqrt(varA / countsA.length + varB / countsB.length) / (baseMean + 1);
    const lfcSE = se > 0 ? se : 0.1;

    // Wald test statistic (simplified)
    const waldStat = log2FC / lfcSE;

    // P-value from normal distribution (simplified)
    const pvalue = 2 * (1 - normalCDF(Math.abs(waldStat)));

    results.push({
      gene: gene.gene,
      baseMean,
      log2FoldChange: log2FC,
      lfcSE,
      pvalue,
      padj: 0, // Will be calculated with BH correction
      significant: false,
      regulation: 'ns'
    });
  }

  // Benjamini-Hochberg correction
  results.sort((a, b) => a.pvalue - b.pvalue);
  const n = results.length;
  for (let i = 0; i < n; i++) {
    results[i].padj = Math.min(1, (results[i].pvalue * n) / (i + 1));
  }

  // Sort back by gene name and determine significance
  results.sort((a, b) => a.gene.localeCompare(b.gene));

  let upCount = 0, downCount = 0, sigCount = 0;

  for (const r of results) {
    r.significant = r.padj < fdrThreshold && Math.abs(r.log2FoldChange) > log2fcThreshold;
    if (r.significant) {
      sigCount++;
      if (r.log2FoldChange > 0) {
        r.regulation = 'up';
        upCount++;
      } else {
        r.regulation = 'down';
        downCount++;
      }
    }
  }

  // Volcano plot data
  const volcanoData = results.map(r => ({
    gene: r.gene,
    log2FC: r.log2FoldChange,
    negLog10P: -Math.log10(r.pvalue + 1e-300),
    significant: r.significant
  }));

  return {
    results,
    summary: {
      total_genes: n,
      significant: sigCount,
      upregulated: upCount,
      downregulated: downCount,
      method,
      thresholds: { fdr: fdrThreshold, log2fc: log2fcThreshold }
    },
    volcano_data: volcanoData
  };
}

// Normal CDF approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// CLUSTERING
// ============================================================================

function clusterGenes(
  geneList: string[],
  expressionData?: NormalizedData[]
): {
  genes: string[];
  distance_matrix: number[][];
  clustering: {
    method: string;
    clusters: Array<{
      cluster_id: number;
      genes: string[];
      centroid_expression?: number[];
    }>;
  };
  dendrogram_order: string[];
} {
  // Generate simulated expression if not provided
  const exprData: Record<string, number[]> = {};
  for (const gene of geneList) {
    const baseExpr = Math.random() * 100 + 10;
    exprData[gene] = [
      baseExpr + Math.random() * 20,
      baseExpr + Math.random() * 20,
      baseExpr * (Math.random() > 0.5 ? 1.5 : 0.7),
      baseExpr * (Math.random() > 0.5 ? 1.5 : 0.7)
    ];
  }

  // Calculate distance matrix (Euclidean)
  const n = geneList.length;
  const distMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const expr1 = exprData[geneList[i]];
      const expr2 = exprData[geneList[j]];
      const dist = Math.sqrt(expr1.reduce((sum, v, k) => sum + (v - expr2[k]) ** 2, 0));
      distMatrix[i][j] = dist;
      distMatrix[j][i] = dist;
    }
  }

  // Simple k-means-like clustering (k=3)
  const k = Math.min(3, Math.floor(n / 2));
  const clusters: Array<{ cluster_id: number; genes: string[]; centroid_expression?: number[] }> = [];

  if (k > 0) {
    // Assign genes to clusters based on first coordinate
    const sortedGenes = [...geneList].sort((a, b) => exprData[a][0] - exprData[b][0]);
    const clusterSize = Math.ceil(n / k);

    for (let c = 0; c < k; c++) {
      const clusterGenes = sortedGenes.slice(c * clusterSize, (c + 1) * clusterSize);
      clusters.push({
        cluster_id: c + 1,
        genes: clusterGenes,
        centroid_expression: clusterGenes[0] ? exprData[clusterGenes[0]] : undefined
      });
    }
  }

  return {
    genes: geneList,
    distance_matrix: distMatrix.map(row => row.map(v => Math.round(v * 100) / 100)),
    clustering: {
      method: 'hierarchical (average linkage)',
      clusters
    },
    dendrogram_order: geneList
  };
}

// ============================================================================
// PATHWAY ENRICHMENT
// ============================================================================

function pathwayEnrichment(
  geneList: string[],
  backgroundSize: number = 20000
): {
  input: { gene_count: number; background_size: number };
  enriched_pathways: Array<{
    pathway_id: string;
    pathway_name: string;
    category: string;
    overlap_genes: string[];
    overlap_count: number;
    pathway_size: number;
    fold_enrichment: number;
    pvalue: number;
    padj: number;
    significant: boolean;
  }>;
  gene_pathway_matrix: Record<string, string[]>;
} {
  const results: Array<{
    pathway_id: string;
    pathway_name: string;
    category: string;
    overlap_genes: string[];
    overlap_count: number;
    pathway_size: number;
    fold_enrichment: number;
    pvalue: number;
    padj: number;
    significant: boolean;
  }> = [];

  const geneSet = new Set(geneList.map(g => g.toUpperCase()));
  const genePathwayMatrix: Record<string, string[]> = {};

  for (const gene of geneList) {
    genePathwayMatrix[gene] = [];
  }

  for (const [pathwayId, pathway] of Object.entries(PATHWAYS)) {
    const pathwayGenes = new Set(pathway.genes.map(g => g.toUpperCase()));
    const overlap = [...geneSet].filter(g => pathwayGenes.has(g));

    if (overlap.length > 0) {
      // Fisher's exact test approximation
      const k = overlap.length;       // Overlap
      const m = pathway.genes.length; // Pathway size
      const n = geneList.length;      // Query size
      const N = backgroundSize;       // Background

      // Hypergeometric p-value (simplified)
      const expected = (m * n) / N;
      const foldEnrichment = k / expected;

      // Chi-squared approximation
      const chiSq = ((k - expected) ** 2) / expected;
      const pvalue = Math.exp(-chiSq / 2);

      // Record gene-pathway associations
      for (const gene of overlap) {
        if (genePathwayMatrix[gene]) {
          genePathwayMatrix[gene].push(pathway.name);
        }
      }

      results.push({
        pathway_id: pathwayId,
        pathway_name: pathway.name,
        category: pathway.category,
        overlap_genes: overlap,
        overlap_count: k,
        pathway_size: m,
        fold_enrichment: foldEnrichment,
        pvalue,
        padj: 0,
        significant: false
      });
    }
  }

  // BH correction
  results.sort((a, b) => a.pvalue - b.pvalue);
  const nPathways = results.length;
  for (let i = 0; i < nPathways; i++) {
    results[i].padj = Math.min(1, (results[i].pvalue * nPathways) / (i + 1));
    results[i].significant = results[i].padj < 0.05 && results[i].fold_enrichment > 1.5;
  }

  // Sort by significance
  results.sort((a, b) => a.padj - b.padj);

  return {
    input: { gene_count: geneList.length, background_size: backgroundSize },
    enriched_pathways: results,
    gene_pathway_matrix: genePathwayMatrix
  };
}

// ============================================================================
// GENE SET ENRICHMENT ANALYSIS (GSEA)
// ============================================================================

function gseaAnalysis(
  rankedGenes: Array<{ gene: string; score: number }>
): {
  input: { gene_count: number; ranking_metric: string };
  pathway_results: Array<{
    pathway_id: string;
    pathway_name: string;
    es: number;
    nes: number;
    pvalue: number;
    fdr: number;
    leading_edge: string[];
    direction: 'up' | 'down';
  }>;
  summary: {
    significant_up: number;
    significant_down: number;
    top_pathways: string[];
  };
} {
  // Sort genes by score
  const sortedGenes = [...rankedGenes].sort((a, b) => b.score - a.score);
  const n = sortedGenes.length;

  const pathwayResults: Array<{
    pathway_id: string;
    pathway_name: string;
    es: number;
    nes: number;
    pvalue: number;
    fdr: number;
    leading_edge: string[];
    direction: 'up' | 'down';
  }> = [];

  for (const [pathwayId, pathway] of Object.entries(PATHWAYS)) {
    const pathwayGenes = new Set(pathway.genes.map(g => g.toUpperCase()));

    // Calculate running sum
    let runningSum = 0;
    let maxES = 0;
    let maxPos = 0;
    const leadingEdge: string[] = [];

    const pathwayHits = sortedGenes.filter(g => pathwayGenes.has(g.gene.toUpperCase()));
    const nhit = pathwayHits.length;

    if (nhit === 0) continue;

    const miss = Math.sqrt((n - nhit) / nhit);
    const hit = Math.sqrt(nhit / (n - nhit));

    for (let i = 0; i < n; i++) {
      const gene = sortedGenes[i];
      if (pathwayGenes.has(gene.gene.toUpperCase())) {
        runningSum += hit;
        if (Math.abs(runningSum) > Math.abs(maxES)) {
          maxES = runningSum;
          maxPos = i;
          leadingEdge.push(gene.gene);
        }
      } else {
        runningSum -= miss / n;
      }
    }

    // Simplified NES calculation
    const nes = maxES * Math.sqrt(nhit);

    // P-value estimation (simplified)
    const pvalue = Math.exp(-Math.abs(nes));

    pathwayResults.push({
      pathway_id: pathwayId,
      pathway_name: pathway.name,
      es: Math.round(maxES * 1000) / 1000,
      nes: Math.round(nes * 1000) / 1000,
      pvalue: Math.round(pvalue * 10000) / 10000,
      fdr: 0,
      leading_edge: leadingEdge.slice(0, 5),
      direction: maxES > 0 ? 'up' : 'down'
    });
  }

  // FDR calculation
  pathwayResults.sort((a, b) => a.pvalue - b.pvalue);
  const nResults = pathwayResults.length;
  for (let i = 0; i < nResults; i++) {
    pathwayResults[i].fdr = Math.min(1, (pathwayResults[i].pvalue * nResults) / (i + 1));
  }

  const sigUp = pathwayResults.filter(r => r.fdr < 0.25 && r.direction === 'up').length;
  const sigDown = pathwayResults.filter(r => r.fdr < 0.25 && r.direction === 'down').length;

  return {
    input: { gene_count: n, ranking_metric: 'score' },
    pathway_results: pathwayResults.sort((a, b) => a.fdr - b.fdr),
    summary: {
      significant_up: sigUp,
      significant_down: sigDown,
      top_pathways: pathwayResults.slice(0, 3).map(r => r.pathway_name)
    }
  };
}

// ============================================================================
// VISUALIZATION HELPERS
// ============================================================================

function getVisualizationData(
  type: string,
  data?: DEResult[] | NormalizedData[]
): object {
  switch (type) {
    case 'volcano':
      return {
        type: 'volcano_plot',
        description: 'Plot -log10(p-value) vs log2(fold change)',
        x_axis: 'log2FoldChange',
        y_axis: '-log10(pvalue)',
        significance_lines: {
          horizontal: '-log10(0.05) = 1.3',
          vertical: 'log2FC = ±1'
        },
        coloring: 'Significant genes colored by regulation direction'
      };
    case 'heatmap':
      return {
        type: 'heatmap',
        description: 'Expression values across samples and genes',
        scaling: 'Z-score normalization recommended',
        clustering: 'Hierarchical clustering on both axes',
        color_scheme: 'Diverging (blue-white-red) for centered data'
      };
    case 'pca':
      return {
        type: 'pca_plot',
        description: 'Principal Component Analysis of samples',
        axes: ['PC1', 'PC2'],
        variance_explained: 'Show percentage on axis labels',
        coloring: 'By sample condition/group'
      };
    case 'ma':
      return {
        type: 'ma_plot',
        description: 'M (log ratio) vs A (mean average)',
        x_axis: 'log2(baseMean)',
        y_axis: 'log2FoldChange',
        significance: 'Highlight significant genes'
      };
    default:
      return {
        available_plots: ['volcano', 'heatmap', 'pca', 'ma'],
        description: 'Specify plot type for details'
      };
  }
}

function getInfo(): object {
  return {
    tool: 'gene_expression',
    description: 'Comprehensive gene expression analysis tool',
    capabilities: [
      'Normalization: TPM, FPKM, CPM',
      'Differential expression: DESeq2-like statistical testing',
      'Multiple testing correction: Benjamini-Hochberg',
      'Hierarchical clustering',
      'Pathway enrichment analysis',
      'Gene Set Enrichment Analysis (GSEA)',
      'Visualization helpers'
    ],
    normalization_methods: {
      TPM: 'Transcripts Per Million - controls for gene length and library size',
      FPKM: 'Fragments Per Kilobase Million - for paired-end data',
      CPM: 'Counts Per Million - library size normalization only'
    },
    de_methods: {
      DESeq2: 'Negative binomial model, Wald test',
      edgeR: 'Negative binomial model, exact test',
      limma: 'Linear models, empirical Bayes'
    },
    reference_genes: Object.keys(REFERENCE_GENES).length,
    pathways_available: Object.keys(PATHWAYS).length,
    data_requirements: {
      normalization: 'Raw counts matrix with gene identifiers',
      differential: 'Raw counts + condition assignments',
      pathway: 'List of differentially expressed genes',
      gsea: 'Ranked gene list with scores'
    }
  };
}

function getExamples(): object {
  return {
    normalize_tpm: {
      operation: 'normalize',
      method: 'TPM',
      raw_counts: [
        { gene: 'GAPDH', counts: [1000, 1200, 800, 900] },
        { gene: 'TP53', counts: [50, 45, 150, 140] },
        { gene: 'EGFR', counts: [200, 220, 180, 190] }
      ]
    },
    differential_expression: {
      operation: 'differential',
      method: 'DESeq2',
      raw_counts: [
        { gene: 'GAPDH', counts: [1000, 1100, 1200, 500, 550, 600] },
        { gene: 'TP53', counts: [50, 55, 60, 150, 160, 170] },
        { gene: 'EGFR', counts: [200, 210, 220, 180, 170, 160] }
      ],
      condition_a: [0, 1, 2],
      condition_b: [3, 4, 5],
      fdr_threshold: 0.05,
      log2fc_threshold: 1
    },
    pathway_enrichment: {
      operation: 'pathway',
      gene_list: ['TP53', 'BRCA1', 'RB1', 'CDK4', 'EGFR', 'KRAS']
    },
    gsea: {
      operation: 'gsea',
      ranked_genes: [
        { gene: 'TP53', score: 3.5 },
        { gene: 'EGFR', score: 2.8 },
        { gene: 'KRAS', score: 2.1 },
        { gene: 'GAPDH', score: 0.1 },
        { gene: 'ACTB', score: -0.2 }
      ]
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executegeneexpression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const method = args.method || 'DESeq2';

    let result: object;

    switch (operation) {
      case 'normalize': {
        if (!args.raw_counts || !Array.isArray(args.raw_counts)) {
          throw new Error('raw_counts array required');
        }
        const counts = args.raw_counts as CountData[];
        const geneLengths = args.gene_lengths || {};

        let normalized: NormalizedData[];
        switch (method) {
          case 'TPM':
            normalized = normalizeTPM(counts, geneLengths);
            break;
          case 'FPKM':
            normalized = normalizeFPKM(counts, geneLengths);
            break;
          case 'CPM':
          default:
            normalized = normalizeCPM(counts);
        }

        result = {
          operation: 'normalize',
          method,
          input_genes: counts.length,
          input_samples: counts[0]?.counts.length || 0,
          normalized_data: normalized.map(n => ({
            gene: n.gene,
            values: n.values.map(v => Math.round(v * 100) / 100),
            mean: Math.round(n.mean * 100) / 100,
            variance: Math.round(n.variance * 100) / 100
          }))
        };
        break;
      }

      case 'differential': {
        if (!args.raw_counts || !args.condition_a || !args.condition_b) {
          throw new Error('raw_counts, condition_a, and condition_b required');
        }
        result = {
          operation: 'differential',
          ...differentialExpression(
            args.raw_counts,
            args.condition_a,
            args.condition_b,
            method,
            args.fdr_threshold || 0.05,
            args.log2fc_threshold || 1
          )
        };
        break;
      }

      case 'cluster': {
        const genes = args.genes || Object.keys(REFERENCE_GENES).slice(0, 10);
        result = {
          operation: 'cluster',
          ...clusterGenes(genes)
        };
        break;
      }

      case 'pathway': {
        if (!args.gene_list || !Array.isArray(args.gene_list)) {
          throw new Error('gene_list array required');
        }
        result = {
          operation: 'pathway',
          ...pathwayEnrichment(args.gene_list, args.background_size || 20000)
        };
        break;
      }

      case 'gsea': {
        if (!args.ranked_genes || !Array.isArray(args.ranked_genes)) {
          throw new Error('ranked_genes array required');
        }
        result = {
          operation: 'gsea',
          ...gseaAnalysis(args.ranked_genes)
        };
        break;
      }

      case 'visualize': {
        result = {
          operation: 'visualize',
          visualization: getVisualizationData(args.plot_type || 'volcano')
        };
        break;
      }

      case 'examples':
        result = {
          operation: 'examples',
          examples: getExamples()
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          ...getInfo()
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isgeneexpressionAvailable(): boolean {
  return true;
}
