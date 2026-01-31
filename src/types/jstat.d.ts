declare module 'jstat' {
  export const jStat: {
    // Distributions
    normal: {
      pdf: (x: number, mean: number, std: number) => number;
      cdf: (x: number, mean: number, std: number) => number;
      inv: (p: number, mean: number, std: number) => number;
      sample: (mean: number, std: number) => number;
    };
    studentt: {
      pdf: (x: number, df: number) => number;
      cdf: (x: number, df: number) => number;
      inv: (p: number, df: number) => number;
    };
    chisquare: {
      pdf: (x: number, df: number) => number;
      cdf: (x: number, df: number) => number;
      inv: (p: number, df: number) => number;
    };
    ftest: {
      cdf: (x: number, df1: number, df2: number) => number;
    };
    // Statistical functions
    mean: (arr: number[]) => number;
    median: (arr: number[]) => number;
    mode: (arr: number[]) => number;
    variance: (arr: number[], flag?: boolean) => number;
    stdev: (arr: number[], flag?: boolean) => number;
    ttest: (sample1: number[], sample2: number[], sides?: number) => number;
    anovafscore: (...samples: number[][]) => number;
    anovaftest: (...samples: number[][]) => number;
  };
  export default { jStat };
}
