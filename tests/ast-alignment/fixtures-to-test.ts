import glob from 'glob';
import fs from 'fs';
import path from 'path';

import jsxKnownIssues from '../jsx-known-issues';

interface Fixture {
  filename: string;
  ignoreSourceType: boolean;
}

interface FixturePatternConfig {
  pattern: string;
  ignoreSourceType: boolean;
}

interface CreateFixturePatternConfig {
  ignore?: string[];
  fileType?: string;
  ignoreSourceType?: string[];
}

const fixturesDirPath = path.join(__dirname, '../fixtures');

class FixturesTester {
  protected fixtures: FixturePatternConfig[] = [];

  constructor() {}

  public addFixturePatternConfig(
    fixturesSubPath: string,
    config: CreateFixturePatternConfig = {}
  ) {
    if (!fs.existsSync(path.join(fixturesDirPath, fixturesSubPath))) {
      throw new Error(
        `Registered path '${path.join(
          __dirname,
          fixturesSubPath
        )}' was not found`
      );
    }

    const ignore = config.ignore || [];
    const fileType = config.fileType || 'js';
    const ignoreSourceType = config.ignoreSourceType || [];

    /**
     * The TypeScript compiler gives us the "externalModuleIndicator" to allow typescript-estree do dynamically detect the "sourceType".
     * Babel has similar feature sourceType='unambiguous' but its not perfect, and in some specific cases we sill have to enforce it.
     * Known issues:
     * - https://github.com/babel/babel/issues/9213
     */
    if (ignoreSourceType.length) {
      ignore.push(...ignoreSourceType);
      for (const fixture of ignoreSourceType) {
        this.fixtures.push({
          // It needs to be the full path from within fixtures/ for the pattern
          pattern: `${fixturesSubPath}/${fixture}.src.${config.fileType}`,
          ignoreSourceType: true
        });
      }
    }

    this.fixtures.push({
      pattern: `${fixturesSubPath}/!(${ignore.join('|')}).src.${fileType}`,
      ignoreSourceType: false
    });
  }

  protected processFixtures(fixtures: FixturePatternConfig[]): Fixture[] {
    return fixtures
      .map(fixture => {
        return glob
          .sync(`${fixturesDirPath}/${fixture.pattern}`, {})
          .map(filename => {
            return {
              filename,
              ignoreSourceType: fixture.ignoreSourceType
            };
          });
      })
      .reduce((acc, x) => acc.concat(x), []);
  }

  public getFixtures(): Fixture[] {
    return this.processFixtures(this.fixtures);
  }
}

/**
 * JSX fixtures which have known issues for typescript-estree
 */
const jsxFilesWithKnownIssues = jsxKnownIssues.map(f => f.replace('jsx/', ''));

/**
 * Current random error difference on jsx/invalid-no-tag-name.src.js
 * TSEP - SyntaxError
 * Babel - RangeError
 *
 * Reported here: https://github.com/babel/babel/issues/6680
 */
jsxFilesWithKnownIssues.push('invalid-no-tag-name');

/**
 * An class with FixturePatternConfigs
 */
const tester = new FixturesTester();

tester.addFixturePatternConfig('javascript/basics');

tester.addFixturePatternConfig('comments', {
  ignore: [
    /**
     * Template strings seem to also be affected by the difference in opinion between different parsers in:
     * https://github.com/babel/babel/issues/6681
     */
    'no-comment-template', // Purely AST diffs
    'template-string-block' // Purely AST diffs
  ]
});

tester.addFixturePatternConfig('javascript/templateStrings', {
  ignore: ['**/*']
});

tester.addFixturePatternConfig('javascript/arrayLiteral');

tester.addFixturePatternConfig('javascript/simple-literals');

tester.addFixturePatternConfig('javascript/directives');

tester.addFixturePatternConfig('javascript/experimentalObjectRestSpread', {
  ignore: [
    /**
     * Trailing comma is not permitted after a "RestElement" in Babel
     */
    'invalid-rest-trailing-comma'
  ]
});

tester.addFixturePatternConfig('javascript/arrowFunctions', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-dup-params', // babel parse errors
    'error-strict-dup-params', // babel parse errors
    'error-strict-octal', // babel parse errors
    'error-two-lines' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/bigIntLiterals');
tester.addFixturePatternConfig('javascript/binaryLiterals');
tester.addFixturePatternConfig('javascript/blockBindings');

tester.addFixturePatternConfig('javascript/classes', {
  ignore: [
    /**
     * super() is being used outside of constructor. Other parsers (e.g. espree, acorn) do not error on this.
     */
    'class-one-method-super', // babel parse errors
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-class-declaration', // babel parse errors
    'invalid-class-setter-declaration' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/defaultParams');

tester.addFixturePatternConfig('javascript/destructuring', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-defaults-object-assign' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/destructuring-and-arrowFunctions');
tester.addFixturePatternConfig('javascript/destructuring-and-blockBindings');
tester.addFixturePatternConfig('javascript/destructuring-and-defaultParams');
tester.addFixturePatternConfig('javascript/destructuring-and-forOf');

tester.addFixturePatternConfig('javascript/destructuring-and-spread', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-complex-destructured-spread-first', // babel parse errors
    'not-final-array' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/experimentalAsyncIteration');
tester.addFixturePatternConfig('javascript/experimentalDynamicImport');
tester.addFixturePatternConfig('javascript/exponentiationOperators');
tester.addFixturePatternConfig('javascript/experimentalOptionalCatchBinding');

tester.addFixturePatternConfig('javascript/forOf', {
  ignore: [
    /**
     * TypeScript, espree and acorn parse this fine - esprima, flow and babel do not...
     */
    'for-of-with-function-initializer' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/generators');
tester.addFixturePatternConfig('javascript/globalReturn');

tester.addFixturePatternConfig('javascript/modules', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-export-named-default', // babel parse errors
    'invalid-import-default-module-specifier', // babel parse errors
    'invalid-import-module-specifier' // babel parse errors
  ],
  ignoreSourceType: ['error-function', 'error-strict', 'error-delete']
});

tester.addFixturePatternConfig('javascript/newTarget', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-new-target', // babel parse errors
    'invalid-unknown-property' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/objectLiteral');
tester.addFixturePatternConfig('javascript/objectLiteralComputedProperties');

tester.addFixturePatternConfig('javascript/objectLiteralDuplicateProperties', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-proto-property', // babel parse errors
    'error-proto-string-property' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/objectLiteralShorthandMethods');
tester.addFixturePatternConfig('javascript/objectLiteralShorthandProperties');
tester.addFixturePatternConfig('javascript/octalLiterals');
tester.addFixturePatternConfig('javascript/regex');
tester.addFixturePatternConfig('javascript/regexUFlag');
tester.addFixturePatternConfig('javascript/regexYFlag');

tester.addFixturePatternConfig('javascript/restParams', {
  ignore: [
    /**
     * Expected babel parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-no-default', // babel parse errors
    'error-not-last' // babel parse errors
  ]
});

tester.addFixturePatternConfig('javascript/spread');
tester.addFixturePatternConfig('javascript/unicodeCodePointEscapes');

/* ================================================== */

tester.addFixturePatternConfig('jsx', {
  ignore: jsxFilesWithKnownIssues
});
tester.addFixturePatternConfig('jsx-useJSXTextNode');

/* ================================================== */

/**
 * TSX-SPECIFIC FILES
 */

tester.addFixturePatternConfig('tsx', {
  fileType: 'tsx'
});

/* ================================================== */

/**
 * TYPESCRIPT-SPECIFIC FILES
 */

tester.addFixturePatternConfig('typescript/babylon-convergence', {
  fileType: 'ts'
});

tester.addFixturePatternConfig('typescript/basics', {
  fileType: 'ts',
  ignore: [
    /**
     * Other babel parse errors relating to invalid syntax.
     */
    'abstract-class-with-abstract-constructor', // babel parse errors
    'class-with-export-parameter-properties', // babel parse errors
    'class-with-implements-and-extends', // babel parse errors
    'class-with-optional-methods', // babel parse errors
    'class-with-static-parameter-properties', // babel parse errors
    'interface-with-all-property-types', // babel parse errors
    'interface-with-construct-signature-with-parameter-accessibility', // babel parse errors
    /**
     * typescript-estree erroring, but babel not.
     */
    'arrow-function-with-type-parameters', // typescript-estree parse errors
    /**
     * Babel: ClassDeclaration + abstract: true
     * tsep: TSAbstractClassDeclaration
     */
    'abstract-class-with-abstract-properties',
    /**
     * Babel: ClassProperty + abstract: true
     * tsep: TSAbstractClassProperty
     */
    'abstract-class-with-abstract-readonly-property',
    /**
     * Babel: TSExpressionWithTypeArguments
     * tsep: ClassImplements
     */
    'class-with-implements-generic-multiple',
    'class-with-implements-generic',
    'class-with-implements',
    'class-with-extends-and-implements',
    /**
     * Other major AST differences (e.g. fundamentally different node types)
     */
    'class-with-mixin',
    'function-with-types-assignation',
    'interface-extends-multiple',
    'interface-extends',
    'interface-type-parameters',
    'interface-with-extends-type-parameters',
    'interface-with-generic',
    'interface-with-jsdoc',
    'interface-with-optional-properties',
    'interface-without-type-annotation',
    'typed-this',
    'export-type-function-declaration',
    'abstract-interface',
    /**
     * Babel bug for optional or abstract methods?
     */
    'abstract-class-with-abstract-method', // babel parse errors
    'abstract-class-with-optional-method', // babel parse errors
    'declare-class-with-optional-method', // babel parse errors
    /**
     * Awaiting feedback on Babel issue https://github.com/babel/babel/issues/6679
     */
    'class-with-private-parameter-properties',
    'class-with-protected-parameter-properties',
    'class-with-public-parameter-properties',
    'class-with-readonly-parameter-properties',
    /**
     * Not yet supported in Babel https://github.com/babel/babel/issues/7749
     */
    'import-type',
    'import-type-with-type-parameters-in-type-reference',
    /**
     * babel is not supporting it yet https://github.com/babel/babel/pull/9230
     * Babel: TSTypeReference -> Identifier
     * tsep: TSBigIntKeyword
     */
    'typed-keyword-bigint',
    /**
     * Awaiting feedback on Babel issue https://github.com/babel/babel/issues/9228
     * Babel: BooleanLiteral
     * tsep: Literal
     */
    'typed-keyword-true',
    /**
     * Not yet supported in Babel https://github.com/babel/babel/issues/9228
     * Babel: BooleanLiteral
     * tsep: Literal
     */
    'typed-keyword-false',
    /**
     * Not yet supported in Babel https://github.com/babel/babel/issues/9228
     * Directive field is not added to module and namespace
     */
    'directive-in-module',
    /**
     * Not yet supported in Babel https://github.com/babel/babel/issues/9228
     * Directive field is not added to module and namespace
     */
    'directive-in-namespace'
  ],
  ignoreSourceType: [
    // https://github.com/babel/babel/issues/9213
    'export-assignment'
  ]
});

tester.addFixturePatternConfig('typescript/decorators/accessor-decorators', {
  fileType: 'ts'
});
tester.addFixturePatternConfig('typescript/decorators/class-decorators', {
  fileType: 'ts'
});
tester.addFixturePatternConfig('typescript/decorators/method-decorators', {
  fileType: 'ts'
});
tester.addFixturePatternConfig('typescript/decorators/parameter-decorators', {
  fileType: 'ts'
});
tester.addFixturePatternConfig('typescript/decorators/property-decorators', {
  fileType: 'ts'
});

tester.addFixturePatternConfig('typescript/expressions', {
  fileType: 'ts',
  ignore: [
    /**
     * there is difference in range between babel and tsep
     */
    'tagged-template-expression-type-arguments'
  ]
});

tester.addFixturePatternConfig('typescript/errorRecovery', {
  fileType: 'ts',
  ignore: [
    /**
     * AST difference
     */
    'interface-empty-extends',
    /**
     * TypeScript-specific tests taken from "errorRecovery". Babel is not being as forgiving as the TypeScript compiler here.
     */
    'class-empty-extends-implements', // babel parse errors
    'class-empty-extends', // babel parse errors
    'decorator-on-enum-declaration', // babel parse errors
    'decorator-on-interface-declaration', // babel parse errors
    'interface-property-modifiers', // babel parse errors
    'enum-with-keywords', // babel parse errors
    'solo-const' // babel parse errors
  ]
});

tester.addFixturePatternConfig('typescript/types', {
  fileType: 'ts'
});

tester.addFixturePatternConfig('typescript/declare', {
  fileType: 'ts',
  ignore: [
    /**
     * AST difference
     * tsep: heritage = []
     * babel: heritage = undefined
     */
    'interface',
    /**
     * AST difference
     * tsep: TSAbstractClassDeclaration
     * babel: ClassDeclaration[abstract=true]
     */
    'abstract-class'
  ]
});

tester.addFixturePatternConfig('typescript/namespaces-and-modules', {
  fileType: 'ts',
  ignore: [
    /**
     * Minor AST difference
     */
    'nested-internal-module',
    /**
     * Babel: TSDeclareFunction
     * tsep: TSNamespaceFunctionDeclaration
     */
    'declare-namespace-with-exported-function'
  ],
  ignoreSourceType: [
    'module-with-default-exports',
    'ambient-module-declaration-with-import'
  ]
});

const fixturesToTest = tester.getFixtures();

export { fixturesToTest };
