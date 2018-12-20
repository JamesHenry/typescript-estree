import jsxKnownIssues from '../jsx-known-issues';
import { FixturesTester } from './fixtures-tester';

/**
 * JSX fixtures which have known issues for typescript-estree
 */
const jsxFilesWithKnownIssues: string[] = jsxKnownIssues.map(f =>
  f.replace('jsx/', '')
);

const tester = new FixturesTester();

tester.registerTest('comments', {
  ignoreBabel: [
    /**
     * Template strings seem to also be affected by the difference in opinion between different parsers in:
     * https://github.com/babel/babel/issues/6681
     */
    'no-comment-template', // Purely AST diffs
    'template-string-block' // Purely AST diffs
  ]
});

tester.registerTest('javascript/basics');

tester.registerTest('javascript/templateStrings', {
  ignoreBabel: ['**/*']
});

tester.registerTest('javascript/experimentalObjectRestSpread', {
  ignoreBabel: [
    /**
     * Trailing comma is not permitted after a "RestElement" in Babylon
     */
    'invalid-rest-trailing-comma'
  ]
});

tester.registerTest('javascript/arrowFunctions', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-dup-params', // babel parse errors
    'error-dup-params', // babel parse errors
    'error-strict-dup-params', // babel parse errors
    'error-strict-octal', // babel parse errors
    'error-two-lines' // babel parse errors
  ]
});

tester.registerTest('javascript/bigIntLiterals');
tester.registerTest('javascript/binaryLiterals');
tester.registerTest('javascript/blockBindings');

tester.registerTest('javascript/classes', {
  ignoreBabel: [
    /**
     * super() is being used outside of constructor. Other parsers (e.g. espree, acorn) do not error on this.
     */
    'class-one-method-super', // babel parse errors
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-class-declaration', // babel parse errors
    'invalid-class-setter-declaration' // babel parse errors
  ]
});

tester.registerTest('javascript/defaultParams');

tester.registerTest('javascript/destructuring', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-defaults-object-assign' // babel parse errors
  ]
});

tester.registerTest('javascript/destructuring-and-arrowFunctions');
tester.registerTest('javascript/destructuring-and-blockBindings');
tester.registerTest('javascript/destructuring-and-defaultParams');
tester.registerTest('javascript/destructuring-and-forOf');

tester.registerTest('javascript/destructuring-and-spread', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-complex-destructured-spread-first' // babel parse errors
  ]
});

tester.registerTest('javascript/experimentalAsyncIteration');
tester.registerTest('javascript/experimentalDynamicImport');
tester.registerTest('javascript/exponentiationOperators');

tester.registerTest('javascript/forOf', {
  ignoreBabel: [
    /**
     * TypeScript, espree and acorn parse this fine - esprima, flow and babylon do not...
     */
    'for-of-with-function-initializer' // babel parse errors
  ]
});

tester.registerTest('javascript/generators');
tester.registerTest('javascript/globalReturn');

tester.registerTest('javascript/modules', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-export-named-default', // babel parse errors
    'invalid-import-default-module-specifier', // babel parse errors
    'invalid-import-module-specifier', // babel parse errors
    /**
     * Deleting local variable in strict mode
     */
    'error-delete', // babel parse errors
    /**
     * 'with' in strict mode
     */
    'error-strict' // babel parse errors
  ],
  ignoreSourceType: ['error-function']
});

tester.registerTest('javascript/newTarget', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'invalid-new-target', // babel parse errors
    'invalid-unknown-property' // babel parse errors
  ]
});

tester.registerTest('javascript/objectLiteralComputedProperties');

tester.registerTest('javascript/objectLiteralDuplicateProperties', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-proto-property', // babel parse errors
    'error-proto-string-property' // babel parse errors
  ],
  ignoreEspree: [
    /**
     * TSEP - missing directive field
     */
    'strict-duplicate-properties', // "directive": "use strict",
    'strict-duplicate-string-properties' // "directive": "use strict",
  ]
});

tester.registerTest('javascript/objectLiteralShorthandMethods');
tester.registerTest('javascript/objectLiteralShorthandProperties');
tester.registerTest('javascript/octalLiterals', {
  ignoreEspree: [
    /**
     * TSEP - missing directive field
     */
    'strict-uppercase' // "directive": "use strict",
  ]
});
tester.registerTest('javascript/regex');
tester.registerTest('javascript/regexUFlag');
tester.registerTest('javascript/regexYFlag');

tester.registerTest('javascript/restParams', {
  ignoreBabel: [
    /**
     * Expected babylon parse errors - all of these files below produce parse errors in espree
     * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
     * does not actually error on them and will produce an AST.
     */
    'error-no-default', // babel parse errors
    'error-not-last' // babel parse errors
  ]
});

tester.registerTest('javascript/spread');
tester.registerTest('javascript/unicodeCodePointEscapes', {
  ignoreEspree: [
    /**
     * TSEP - missing directive field
     */
    'basic-string-literal', // "directive": "\\u{714E}\\u{8336}",
    'complex-string-literal' // "directive": "\\u{20BB7}\\u{10FFFF}\\u{1}",
  ]
});

/* ================================================== */

tester.registerTest('jsx', {
  ignoreBabel: jsxFilesWithKnownIssues.concat([
    /**
     * Current random error difference on jsx/invalid-no-tag-name.src.js
     * TSEP - SyntaxError
     * Babylon - RangeError
     *
     * Reported here: https://github.com/babel/babel/issues/6680
     */
    'invalid-no-tag-name'
  ]),
  ignoreEspree: jsxFilesWithKnownIssues.concat([
    /**
     * TSEP: missing fields
     * attributes: Array [],
     * selfClosing: false,
     */
    'shorthand-fragment-with-child',
    'shorthand-fragment'
  ])
});
tester.registerTest('jsx-useJSXTextNode');

/* ================================================== */

/**
 * TSX-SPECIFIC FILES
 */

tester.registerTest('tsx', {
  fileType: 'tsx',
  ignoreBabel: [
    /**
     * currently babylon not supported
     */
    'generic-jsx-element'
  ]
});

/* ================================================== */

/**
 * TYPESCRIPT-SPECIFIC FILES
 */

tester.registerTest('typescript/babylon-convergence', {
  fileType: 'ts'
});

tester.registerTest('typescript/basics', {
  fileType: 'ts',
  ignoreBabel: [
    /**
     * Other babylon parse errors relating to invalid syntax.
     */
    'abstract-class-with-abstract-constructor', // babel parse errors
    'class-with-export-parameter-properties', // babel parse errors
    'class-with-optional-methods', // babel parse errors
    'class-with-static-parameter-properties', // babel parse errors
    'interface-with-all-property-types', // babel parse errors
    'interface-with-construct-signature-with-parameter-accessibility', // babel parse errors
    'class-with-implements-and-extends', // babel parse errors
    /**
     * typescript-estree erroring, but babylon not.
     */
    'arrow-function-with-type-parameters', // typescript-estree parse errors
    /**
     * Babylon: ClassDeclaration + abstract: true
     * tsep: TSAbstractClassDeclaration
     */
    'abstract-class-with-abstract-properties',
    /**
     * Babylon: ClassProperty + abstract: true
     * tsep: TSAbstractClassProperty
     */
    'abstract-class-with-abstract-readonly-property',
    /**
     * Babylon: TSExpressionWithTypeArguments
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
    'keyof-operator',
    /**
     * tsep bug - Program.body[0].expression.left.properties[0].value.right is currently showing up
     * as `ArrayPattern`, babylon, acorn and espree say it should be `ArrayExpression`
     * TODO: Fix this
     */
    'destructuring-assignment',
    /**
     * Babylon bug for optional or abstract methods?
     */
    'abstract-class-with-abstract-method', // babel parse errors
    'abstract-class-with-optional-method', // babel parse errors
    'declare-class-with-optional-method', // babel parse errors
    /**
     * Awaiting feedback on Babylon issue https://github.com/babel/babel/issues/6679
     */
    'class-with-private-parameter-properties',
    'class-with-protected-parameter-properties',
    'class-with-public-parameter-properties',
    'class-with-readonly-parameter-properties',
    /**
     * Not yet supported in Babylon https://github.com/babel/babel/issues/7749
     */
    'import-type',
    'import-type-with-type-parameters-in-type-reference'
  ],
  ignoreSourceType: [
    // https://github.com/babel/babel/issues/9213
    'export-assignment'
  ]
});

tester.registerTest('typescript/decorators/accessor-decorators', {
  fileType: 'ts'
});
tester.registerTest('typescript/decorators/class-decorators', {
  fileType: 'ts'
});
tester.registerTest('typescript/decorators/method-decorators', {
  fileType: 'ts'
});
tester.registerTest('typescript/decorators/parameter-decorators', {
  fileType: 'ts'
});
tester.registerTest('typescript/decorators/property-decorators', {
  fileType: 'ts'
});

tester.registerTest('typescript/expressions', {
  fileType: 'ts',
  ignoreBabel: [
    /**
     * there is difference in range between babel and tsep
     */
    'tagged-template-expression-type-arguments'
  ]
});

tester.registerTest('typescript/errorRecovery', {
  fileType: 'ts',
  ignoreBabel: [
    /**
     * AST difference
     */
    'interface-empty-extends',
    /**
     * TypeScript-specific tests taken from "errorRecovery". Babylon is not being as forgiving as the TypeScript compiler here.
     */
    'class-empty-extends-implements', // babel parse errors
    'class-empty-extends', // babel parse errors
    'decorator-on-enum-declaration', // babel parse errors
    'decorator-on-interface-declaration', // babel parse errors
    'interface-property-modifiers', // babel parse errors
    'enum-with-keywords' // babel parse errors
  ]
});

tester.registerTest('typescript/declare', {
  fileType: 'ts',
  ignoreBabel: [
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

tester.registerTest('typescript/namespaces-and-modules', {
  fileType: 'ts',
  ignoreBabel: [
    /**
     * Minor AST difference
     */
    'nested-internal-module',
    /**
     * Babylon: TSDeclareFunction
     * tsep: TSNamespaceFunctionDeclaration
     */
    'declare-namespace-with-exported-function'
  ],
  ignoreSourceType: [
    'module-with-default-exports',
    'ambient-module-declaration-with-import'
  ]
});

export { tester };
