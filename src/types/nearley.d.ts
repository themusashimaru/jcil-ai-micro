declare module 'nearley' {
  export interface Grammar {
    rules: Rule[];
    start: string;
    byName: { [key: string]: Rule[] };
    ParserRules?: Rule[];
    ParserStart?: string;
    Lexer?: unknown;
  }

  export interface Rule {
    name: string;
    symbols: (string | RegExp | { literal: string } | { test: (x: string) => boolean })[];
    postprocess?: (d: unknown[], location: number, reject: symbol) => unknown;
  }

  export interface ParserState {
    results: unknown[];
    lexerState: unknown;
  }

  export class Parser {
    constructor(grammar: Grammar, options?: { keepHistory?: boolean });

    /** Feed input to the parser */
    feed(chunk: string): Parser;

    /** Current parse results */
    results: unknown[];

    /** Save the current state */
    save(): ParserState;

    /** Restore a saved state */
    restore(state: ParserState): void;

    /** The grammar used by this parser */
    grammar: Grammar;

    /** Current position in the input */
    current: number;

    /** Finish parsing and return results */
    finish(): unknown[];
  }

  export namespace Grammar {
    function fromCompiled(rules: {
      Lexer?: unknown;
      ParserRules: Rule[];
      ParserStart: string;
    }): Grammar;
  }
}
