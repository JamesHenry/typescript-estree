declare module 'espree' {
  import { Program } from 'estree';

  // https://github.com/eslint/espree#usage
  export interface ParserOptions {
    // attach range information to each node
    range?: boolean;
    // attach line/column location information to each node
    loc?: boolean;
    // create a top-level comments array containing all comments
    comment?: boolean;
    // create a top-level tokens array containing all tokens
    tokens?: boolean;
    // Set to 3, 5 (default), 6, 7, 8, 9, or 10 to specify the version of ECMAScript syntax you want to use.
    // You can also set to 2015 (same as 6), 2016 (same as 7), 2017 (same as 8), 2018 (same as 9), or 2019 (same as 10) to use the year-based naming.
    ecmaVersion?: number;
    // specify which type of script you're parsing ("script" or "module")
    sourceType?: 'script' | 'module';
    // specify additional language features
    ecmaFeatures?: {
      // enable JSX parsing
      jsx?: boolean;
      // enable return in global scope
      globalReturn?: boolean;
      // enable implied strict mode (if ecmaVersion >= 5)
      impliedStrict?: boolean;
    };
  }

  export function parse(
    code: string | Buffer,
    options?: ParserOptions
  ): Program;
  // ....
  // VisitorKeys
  // Syntax
  // tokenize
  // version
}
