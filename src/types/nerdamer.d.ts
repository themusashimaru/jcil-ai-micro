declare module 'nerdamer' {
  interface NerdamerExpression {
    text(): string;
    toString(): string;
    toTeX(): string;
    evaluate(values?: Record<string, number>): NerdamerExpression;
    expand(): NerdamerExpression;
    simplify(): NerdamerExpression;
    factor(): NerdamerExpression;
  }

  interface Nerdamer {
    (
      expression: string,
      subs?: Record<string, string | number>,
      option?: string
    ): NerdamerExpression;
    setVar(name: string, value: string | number): void;
    getVars(): Record<string, string>;
    clearVars(): void;
    convertToLaTeX(expression: string): string;
    diff(expression: string, variable?: string, times?: number): NerdamerExpression;
    integrate(expression: string, variable?: string): NerdamerExpression;
    solve(equation: string, variable?: string): NerdamerExpression;
    solveEquations(
      equations: string[] | string,
      variables?: string[]
    ): NerdamerExpression | Record<string, string>;
    simplify(expression: string): NerdamerExpression;
    expand(expression: string): NerdamerExpression;
    factor(expression: string): NerdamerExpression;
    calculus: {
      diff(expression: string, variable?: string, times?: number): NerdamerExpression;
      integrate(expression: string, variable?: string): NerdamerExpression;
      sum(expression: string, variable: string, from: number, to: number): NerdamerExpression;
    };
  }

  const nerdamer: Nerdamer;
  export default nerdamer;
}

declare module 'nerdamer/Algebra' {
  // Algebra module extends nerdamer with additional algebraic functionality
  const _: void;
  export default _;
}

declare module 'nerdamer/Calculus' {
  // Calculus module extends nerdamer with calculus operations
  const _: void;
  export default _;
}

declare module 'nerdamer/Solve' {
  // Solve module extends nerdamer with equation solving
  const _: void;
  export default _;
}
