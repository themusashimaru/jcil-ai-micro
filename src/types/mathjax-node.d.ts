/**
 * Type declarations for mathjax-node
 * LaTeX to MathML/SVG conversion
 */

declare module 'mathjax-node' {
  interface MathJaxConfig {
    MathJax?: {
      loader?: {
        load?: string[];
      };
      [key: string]: unknown;
    };
  }

  interface TypesetOptions {
    math: string;
    format: 'TeX' | 'MathML' | 'AsciiMath';
    mml?: boolean;
    svg?: boolean;
    html?: boolean;
    css?: boolean;
    width?: number;
    ex?: number;
    em?: number;
    speakText?: boolean;
    timeout?: number;
  }

  interface TypesetResult {
    errors?: string[];
    mml?: string;
    svg?: string;
    html?: string;
    css?: string;
    speakText?: string;
    width?: string;
    height?: string;
  }

  type TypesetCallback = (result: TypesetResult) => void;

  function config(config: MathJaxConfig): void;
  function start(): void;
  function typeset(options: TypesetOptions, callback: TypesetCallback): void;

  export { config, start, typeset, MathJaxConfig, TypesetOptions, TypesetResult, TypesetCallback };
}
