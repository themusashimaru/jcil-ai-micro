declare module 'logic-solver' {
  class Solver {
    require(...clauses: (string | string[])[]): void;
    forbid(...clauses: (string | string[])[]): void;
    solve(): Solution | null;
    solveAssuming(variable: string): Solution | null;
    minimizeWeightedSum(solution: Solution, formulas: string[], weights: number[]): Solution | null;
  }

  interface Solution {
    getMap(): Record<string, boolean>;
    getTrueVars(): string[];
    getFalseVars(): string[];
    evaluate(formula: string): boolean;
    getFormula(): string;
    getWeightedSum(formulas: string[], weights: number[]): number;
  }

  // Static methods
  function or(...args: (string | string[])[]): string;
  function and(...args: (string | string[])[]): string;
  function not(variable: string): string;
  function implies(a: string, b: string): string;
  function equiv(a: string, b: string): string;
  function exactlyOne(...args: (string | string[])[]): string[];
  function atMostOne(...args: (string | string[])[]): string[];

  export { Solver, Solution, or, and, not, implies, equiv, exactlyOne, atMostOne };
}
