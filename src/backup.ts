/**
 * @fileoverview Converts TypeScript AST into ESTree format.
 * @author Nicholas C. Zakas
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */
import ts from 'typescript';
import * as es from 'estree';

import nodeUtils from './node-utils';
import { AST_NODE_TYPES } from './ast-node-types';

import { TSNode } from './ts-nodes';
import { ESNode } from './es-nodes';

const SyntaxKind = ts.SyntaxKind;

let esTreeNodeToTSNodeMap = new WeakMap();
let tsNodeToESTreeNodeMap = new WeakMap();

export function resetASTMaps() {
  esTreeNodeToTSNodeMap = new WeakMap();
  tsNodeToESTreeNodeMap = new WeakMap();
}

export function getASTMaps() {
  return { esTreeNodeToTSNodeMap, tsNodeToESTreeNodeMap };
}

interface ConvertAdditionalOptions {
  errorOnUnknownASTType: boolean;
  useJSXTextNode: boolean;
  shouldProvideParserServices: boolean;
}

interface ConvertConfig {
  node: ts.Node;
  parent?: ts.Node | null;
  ast: ts.SourceFile;
  additionalOptions: ConvertAdditionalOptions;
}

/**
 * Converts a TypeScript node into an ESTree node
 * @param  {Object} config configuration options for the conversion
 * @param  {TSNode} config.node   the ts.Node
 * @param  {ts.Node} config.parent the parent ts.Node
 * @param  {ts.SourceFile} config.ast the full TypeScript AST
 * @param  {Object} config.additionalOptions additional options for the conversion
 * @returns {ESNode|null}        the converted ESNode
 */
export default function convert(config: ConvertConfig): ESNode | null {
  const node: TSNode = config.node as TSNode;
  const parent = config.parent;
  const ast = config.ast;
  const additionalOptions = config.additionalOptions || {};

  /**
   * Exit early for null and undefined
   */
  if (!node) {
    return null;
  }

  /**
   * Create a new ESTree node
   */
  let result: ESNode = {
    type: '',
    range: [node.getStart(ast), node.end],
    loc: nodeUtils.getLoc(node, ast)
  };

  /**
   * Copies the result object into an ESTree node with just a type property.
   * This is used only for leaf nodes that have no other properties.
   * @returns {void}
   */
  function simplyCopy(): void {
    Object.assign(result, {
      type: SyntaxKind[node.kind]
    });
  }

  /**
   * Converts a TypeScript node into an ESTree node.
   * @param  {R} child the child ts.Node
   * @returns {T|null}       the converted ESTree node
   */
  function convertChild<T = any, R extends ts.Node = ts.Node>(child: R): T {
    return convert({ node: child, parent: node, ast, additionalOptions });
  }

  /**
   * Converts a TypeScript node into an ESTree node.
   * @param  {ts.Node} child the child ts.Node
   * @returns {T|null}       the converted ESTree node
   */
  function tryConvertChild<T = any, R extends ts.Node = ts.Node>(
    child?: R
  ): T | null {
    if (!child) {
      return null;
    }
    return convert({ node: child, parent: node, ast, additionalOptions });
  }

  /**
   * Converts a child into a type annotation. This creates an intermediary
   * TypeAnnotation node to match what Flow does.
   * @param {ts.TypeNode} child The TypeScript AST node to convert.
   * @returns {es.TSTypeAnnotation} The type annotation node.
   */
  function convertTypeAnnotation(child: ts.TypeNode): es.TSTypeAnnotation {
    const annotation = convertChild(child);
    const annotationStartCol = child.getFullStart() - 1;
    const loc = nodeUtils.getLocFor(annotationStartCol, child.end, ast);
    return {
      type: AST_NODE_TYPES.TSTypeAnnotation,
      loc,
      range: [annotationStartCol, child.end],
      typeAnnotation: annotation
    };
  }

  /**
   * Converts a ts.Node's typeArguments ts.NodeArray to a flow-like typeParameters node
   * @param {ts.NodeArray<any>} typeArguments ts.Node typeArguments
   * @returns {es.TSTypeParameterDeclaration} TypeParameterInstantiation node
   */
  function convertTypeArgumentsToTypeParameters(
    typeArguments: ts.NodeArray<any>
  ): es.TSTypeParameterDeclaration {
    /**
     * Even if typeArguments is an empty array, TypeScript sets a `pos` and `end`
     * property on the array object so we can safely read the values here
     */
    const start = typeArguments.pos - 1;
    let end = typeArguments.end + 1;
    if (typeArguments && typeArguments.length) {
      const firstTypeArgument = typeArguments[0];
      const typeArgumentsParent = firstTypeArgument.parent;
      /**
       * In the case of the parent being a CallExpression or a TypeReference we have to use
       * slightly different logic to calculate the correct end position
       */
      if (
        typeArgumentsParent &&
        (typeArgumentsParent.kind === SyntaxKind.CallExpression ||
          typeArgumentsParent.kind === SyntaxKind.TypeReference)
      ) {
        const lastTypeArgument = typeArguments[typeArguments.length - 1];
        const greaterThanToken = nodeUtils.findNextToken(
          lastTypeArgument,
          ast,
          ast
        );
        end = greaterThanToken!.end;
      }
    }
    return {
      type: AST_NODE_TYPES.TSTypeParameterInstantiation,
      range: [start, end],
      loc: nodeUtils.getLocFor(start, end, ast),
      params: typeArguments.map(typeArgument => {
        if (nodeUtils.isTypeKeyword(typeArgument.kind)) {
          return {
            type: AST_NODE_TYPES[`TS${SyntaxKind[typeArgument.kind]}`],
            range: [typeArgument.getStart(ast), typeArgument.getEnd()],
            loc: nodeUtils.getLoc(typeArgument, ast)
          };
        }
        if (typeArgument.kind === SyntaxKind.ImportType) {
          return convert({
            node: typeArgument,
            parent: null,
            ast,
            additionalOptions
          });
        }
        return {
          type: AST_NODE_TYPES.TSTypeReference,
          range: [typeArgument.getStart(ast), typeArgument.getEnd()],
          loc: nodeUtils.getLoc(typeArgument, ast),
          typeName: convertChild(typeArgument.typeName || typeArgument),
          typeParameters: typeArgument.typeArguments
            ? convertTypeArgumentsToTypeParameters(typeArgument.typeArguments)
            : undefined
        };
      })
    };
  }

  /**
   * Converts a ts.Node's typeParameters ts.ts.NodeArray to a flow-like TypeParameterDeclaration node
   * @param {ts.NodeArray} typeParameters ts.Node typeParameters
   * @returns {es.TSTypeParameterDeclaration} TypeParameterDeclaration node
   */
  function convertTSTypeParametersToTypeParametersDeclaration(
    typeParameters: ts.NodeArray<any>
  ): es.TSTypeParameterDeclaration {
    const firstTypeParameter = typeParameters[0];
    const lastTypeParameter = typeParameters[typeParameters.length - 1];

    const greaterThanToken = nodeUtils.findNextToken(
      lastTypeParameter,
      ast,
      ast
    );

    return {
      type: AST_NODE_TYPES.TSTypeParameterDeclaration,
      range: [firstTypeParameter.pos - 1, greaterThanToken!.end],
      loc: nodeUtils.getLocFor(
        firstTypeParameter.pos - 1,
        greaterThanToken!.end,
        ast
      ),
      params: typeParameters.map(typeParameter => {
        const name = typeParameter.name.text;

        const constraint = typeParameter.constraint
          ? convert({
              node: typeParameter.constraint,
              parent: typeParameter,
              ast,
              additionalOptions
            })
          : undefined;

        const defaultParameter = typeParameter.default
          ? convert({
              node: typeParameter.default,
              parent: typeParameter,
              ast,
              additionalOptions
            })
          : typeParameter.default;

        return {
          type: AST_NODE_TYPES.TSTypeParameter,
          range: [typeParameter.getStart(ast), typeParameter.getEnd()],
          loc: nodeUtils.getLoc(typeParameter, ast),
          name,
          constraint,
          default: defaultParameter
        };
      })
    };
  }

  /**
   * Converts a child into a class implements node. This creates an intermediary
   * ClassImplements node to match what Flow does.
   * @param {ts.ExpressionWithTypeArguments} child The TypeScript AST node to convert.
   * @returns {es.ClassImplements} The type annotation node.
   */
  function convertClassImplements(
    child: ts.ExpressionWithTypeArguments
  ): es.ClassImplements {
    const id: es.Identifier = convertChild(child.expression);
    const classImplementsNode: es.ClassImplements = {
      type: AST_NODE_TYPES.ClassImplements,
      loc: id.loc,
      range: id.range,
      id
    };
    if (child.typeArguments && child.typeArguments.length) {
      classImplementsNode.typeParameters = convertTypeArgumentsToTypeParameters(
        child.typeArguments
      );
    }
    return classImplementsNode;
  }

  /**
   * Converts a child into a interface heritage node.
   * @param {ts.ExpressionWithTypeArguments} child The TypeScript AST node to convert.
   * @returns {es.TSInterfaceHeritage} The type annotation node.
   */
  function convertInterfaceHeritageClause(
    child: ts.ExpressionWithTypeArguments
  ): es.TSInterfaceHeritage {
    const id = convertChild<es.Identifier>(child.expression);
    const classImplementsNode: es.TSInterfaceHeritage = {
      type: AST_NODE_TYPES.TSInterfaceHeritage,
      loc: id.loc,
      range: id.range,
      id
    };

    if (child.typeArguments && child.typeArguments.length) {
      classImplementsNode.typeParameters = convertTypeArgumentsToTypeParameters(
        child.typeArguments
      );
    }
    return classImplementsNode;
  }

  /**
   * Converts a ts.NodeArray of ts.Decorators into an array of ESNode decorators
   * @param  {ts.NodeArray<ts.Decorator>} decorators A ts.NodeArray of ts.Decorators to be converted
   * @returns {es.Decorator[]}       an array of converted ESNode decorators
   */
  function convertDecorators(
    decorators: ts.NodeArray<ts.Decorator>
  ): es.Decorator[] {
    if (!decorators || !decorators.length) {
      return [];
    }
    return decorators.map(decorator => {
      const expression = convertChild<es.Expression>(decorator.expression);
      return {
        type: AST_NODE_TYPES.Decorator,
        range: [decorator.getStart(ast), decorator.end],
        loc: nodeUtils.getLoc(decorator, ast),
        expression
      };
    });
  }

  /**
   * Converts an array of ts.Node parameters into an array of ESNode params
   * @param  {ts.Node[]} parameters An array of ts.Node params to be converted
   * @returns {es.Pattern[]}       an array of converted ESNode params
   */
  function convertParameters(parameters: ts.NodeArray<ts.Node>): es.Pattern[] {
    if (!parameters || !parameters.length) {
      return [];
    }
    return parameters.map(param => {
      const convertedParam = convertChild<es.Pattern>(param);
      if (!param.decorators || !param.decorators.length) {
        return convertedParam;
      }
      convertedParam.decorators = convertDecorators(param.decorators);
      return convertedParam!;
    });
  }

  /**
   * For nodes that are copied directly from the TypeScript AST into
   * ESTree mostly as-is. The only difference is the addition of a type
   * property instead of a kind property. Recursively copies all children.
   * @returns {void}
   */
  function deeplyCopy(): void {
    const customType = `TS${SyntaxKind[node.kind]}`;
    /**
     * If the "errorOnUnknownASTType" option is set to true, throw an error,
     * otherwise fallback to just including the unknown type as-is.
     */
    if (
      additionalOptions.errorOnUnknownASTType &&
      !AST_NODE_TYPES[customType]
    ) {
      throw new Error(`Unknown AST_NODE_TYPE: "${customType}"`);
    }
    result.type = customType;
    Object.keys(node)
      .filter(
        key =>
          !/^(?:_children|kind|parent|pos|end|flags|modifierFlagsCache|jsDoc)$/.test(
            key
          )
      )
      .forEach(key => {
        if (key === 'type') {
          result.typeAnnotation = (node as any).type
            ? convertTypeAnnotation((node as any).type)
            : null;
        } else if (key === 'typeArguments') {
          result.typeParameters = (node as any).typeArguments
            ? convertTypeArgumentsToTypeParameters((node as any).typeArguments)
            : null;
        } else if (key === 'typeParameters') {
          result.typeParameters = (node as any).typeParameters
            ? convertTSTypeParametersToTypeParametersDeclaration(
                (node as any).typeParameters
              )
            : null;
        } else if (key === 'decorators') {
          const decorators = convertDecorators((node as any).decorators);
          if (decorators && decorators.length) {
            result.decorators = decorators;
          }
        } else {
          if (Array.isArray((node as any)[key])) {
            (result as any)[key] = (node as any)[key].map(convertChild);
          } else if (
            (node as any)[key] &&
            typeof (node as any)[key] === 'object' &&
            (node as any)[key].kind
          ) {
            // need to check node[key].kind to ensure we don't try to convert a symbol
            (result as any)[key] = convertChild((node as any)[key]);
          } else {
            (result as any)[key] = (node as any)[key];
          }
        }
      });
  }

  /**
   * Converts a TypeScript JSX node.tagName into an ESTree node.name
   * @param {ts.JsxTagNameExpression} tagName  the tagName object from a JSX ts.Node
   * @returns {Object}    the converted ESTree name object
   */
  function convertTypeScriptJSXTagNameToESTreeName(
    tagName: ts.JsxTagNameExpression
  ): ESNode {
    const tagNameToken = nodeUtils.convertToken(tagName, ast);

    if (tagNameToken.type === AST_NODE_TYPES.JSXMemberExpression) {
      const isNestedMemberExpression =
        (node as any).tagName.expression.kind ===
        SyntaxKind.PropertyAccessExpression;

      // Convert TSNode left and right objects into ESNode object
      // and property objects
      tagNameToken.object = convertChild((node as any).tagName.expression);
      tagNameToken.property = convertChild((node as any).tagName.name);

      // Assign the appropriate types
      tagNameToken.object.type = isNestedMemberExpression
        ? AST_NODE_TYPES.JSXMemberExpression
        : AST_NODE_TYPES.JSXIdentifier;
      tagNameToken.property.type = AST_NODE_TYPES.JSXIdentifier;
      if ((tagName as any).expression.kind === SyntaxKind.ThisKeyword) {
        tagNameToken.object.name = 'this';
      }
    } else {
      tagNameToken.type = AST_NODE_TYPES.JSXIdentifier;
      tagNameToken.name = tagNameToken.value;
    }

    delete tagNameToken.value;

    return tagNameToken;
  }

  /**
   * Applies the given TS modifiers to the given result object.
   * @param {ts.ModifiersArray} modifiers original ts.Nodes from the node.modifiers array
   * @returns {void} (the current result object will be mutated)
   */
  function applyModifiersToResult(modifiers?: ts.ModifiersArray): void {
    if (!modifiers || !modifiers.length) {
      return;
    }
    /**
     * Some modifiers are explicitly handled by applying them as
     * boolean values on the result node. As well as adding them
     * to the result, we remove them from the array, so that they
     * are not handled twice.
     */
    const handledModifierIndices: { [key: number]: boolean } = {};
    for (let i = 0; i < modifiers.length; i++) {
      const modifier = modifiers[i];
      switch (modifier.kind) {
        /**
         * Ignore ExportKeyword and DefaultKeyword, they are handled
         * via the fixExports utility function
         */
        case SyntaxKind.ExportKeyword:
        case SyntaxKind.DefaultKeyword:
          handledModifierIndices[i] = true;
          break;
        case SyntaxKind.ConstKeyword:
          result.const = true;
          handledModifierIndices[i] = true;
          break;
        case SyntaxKind.DeclareKeyword:
          result.declare = true;
          handledModifierIndices[i] = true;
          break;
        default:
      }
    }
    /**
     * If there are still valid modifiers available which have
     * not been explicitly handled above, we just convert and
     * add the modifiers array to the result node.
     */
    const remainingModifiers = modifiers.filter(
      (_, i) => !handledModifierIndices[i]
    );
    if (!remainingModifiers || !remainingModifiers.length) {
      return;
    }
    result.modifiers = remainingModifiers.map(convertChild);
  }

  /**
   * Uses the current TSNode's end location for its `type` to adjust the location data of the given
   * ESNode, which should be the parent of the final typeAnnotation node
   * @param {ESNode} typeAnnotationParent The node that will have its location data mutated
   * @returns {void}
   */
  function fixTypeAnnotationParentLocation(
    typeAnnotationParent: es.BaseTypeAnnotationNode
  ): void {
    const end = (node as any).type.getEnd();
    typeAnnotationParent.range[1] = end;
    const loc = nodeUtils.getLocFor(
      typeAnnotationParent.range[0],
      typeAnnotationParent.range[1],
      ast
    );
    typeAnnotationParent.loc = loc;
  }

  /**
   * The core of the conversion logic:
   * Identify and convert each relevant TypeScript SyntaxKind
   */
  function buildEsNode(node: TSNode, parent?: ts.Node): ESNode {
    switch (node.kind) {
      case SyntaxKind.SourceFile: {
        const result: es.Program = {
          type: AST_NODE_TYPES.Program,
          body: [],
          // externalModuleIndicator is internal field in TSC
          sourceType: (node as any).externalModuleIndicator
            ? 'module'
            : 'script'
        };

        // filter out unknown nodes for now
        node.statements.forEach(statement => {
          const convertedStatement = convertChild(statement);
          if (convertedStatement) {
            result.body.push(convertedStatement);
          }
        });

        result.range[1] = (node.endOfFileToken as ts.Node).end;
        result.loc = nodeUtils.getLocFor(
          node.getStart(ast),
          result.range[1],
          ast
        );
        return result;
      }
      case SyntaxKind.Block: {
        const result: es.BlockStatement = {
          type: AST_NODE_TYPES.BlockStatement,
          body: node.statements.map(convertChild)
        };
        return result;
      }
      case SyntaxKind.Identifier: {
        const result: es.Identifier = {
          type: AST_NODE_TYPES.Identifier,
          name: node.text
        };
        return result;
      }
      case SyntaxKind.WithStatement: {
        const result: es.WithStatement = {
          type: AST_NODE_TYPES.WithStatement,
          object: convertChild(node.expression),
          body: convertChild(node.statement)
        };
        return result;
      }

      // Control Flow
      case SyntaxKind.ReturnStatement: {
        const result: es.ReturnStatement = {
          type: AST_NODE_TYPES.ReturnStatement,
          argument: tryConvertChild(node.expression)
        };
        return result;
      }

      case SyntaxKind.LabeledStatement: {
        const result: es.LabeledStatement = {
          type: AST_NODE_TYPES.LabeledStatement,
          label: convertChild(node.label),
          body: convertChild(node.statement)
        };
        return result;
      }

      case SyntaxKind.ContinueStatement: {
        const result: es.ContinueStatement = {
          type: AST_NODE_TYPES.ContinueStatement,
          label: tryConvertChild(node.label)
        };
        return result;
      }

      case SyntaxKind.BreakStatement: {
        const result: es.BreakStatement = {
          type: AST_NODE_TYPES.BreakStatement,
          label: tryConvertChild(node.label)
        };
        return result;
      }

      // Choice
      case SyntaxKind.IfStatement: {
        const result: es.IfStatement = {
          type: AST_NODE_TYPES.IfStatement,
          test: convertChild(node.expression),
          consequent: convertChild(node.thenStatement),
          alternate: tryConvertChild(node.elseStatement)
        };
        return result;
      }

      case SyntaxKind.SwitchStatement: {
        const result: es.SwitchStatement = {
          type: AST_NODE_TYPES.SwitchStatement,
          discriminant: convertChild(node.expression),
          cases: node.caseBlock.clauses.map(convertChild)
        };
        return result;
      }

      case SyntaxKind.CaseClause:
      case SyntaxKind.DefaultClause: {
        const result: es.SwitchCase = {
          type: AST_NODE_TYPES.SwitchCase,
          // expression is present in case only
          test:
            node.kind === SyntaxKind.CaseClause
              ? convertChild(node.expression)
              : null,
          consequent: node.statements.map(convertChild)
        };
        return result;
      }

      // Exceptions

      case SyntaxKind.ThrowStatement: {
        const result: es.ThrowStatement = {
          type: AST_NODE_TYPES.ThrowStatement,
          argument: tryConvertChild(node.expression)
        };
        return result;
      }

      case SyntaxKind.TryStatement: {
        const result: es.TryStatement = {
          type: AST_NODE_TYPES.TryStatement,
          block: convert({
            node: node.tryBlock,
            ast,
            additionalOptions
          }),
          handler: tryConvertChild(node.catchClause),
          finalizer: tryConvertChild(node.finallyBlock)
        };
        return result;
      }

      case SyntaxKind.CatchClause: {
        const result: es.CatchClause = {
          type: AST_NODE_TYPES.CatchClause,
          param: node.variableDeclaration
            ? tryConvertChild(node.variableDeclaration.name)
            : null,
          body: convertChild(node.block)
        };
        return result;
      }

      // Loops

      case SyntaxKind.WhileStatement: {
        const result: es.WhileStatement = {
          type: AST_NODE_TYPES.WhileStatement,
          test: convertChild(node.expression),
          body: convertChild(node.statement)
        };
        return result;
      }

      /**
       * Unlike other parsers, TypeScript calls a "DoWhileStatement"
       * a "DoStatement"
       */
      case SyntaxKind.DoStatement: {
        const result: es.DoWhileStatement = {
          type: AST_NODE_TYPES.DoWhileStatement,
          test: convertChild(node.expression),
          body: convertChild(node.statement)
        };
        return result;
      }

      case SyntaxKind.ForStatement: {
        const result: es.ForStatement = {
          type: AST_NODE_TYPES.ForStatement,
          init: tryConvertChild(node.initializer),
          test: tryConvertChild(node.condition),
          update: tryConvertChild(node.incrementor),
          body: convertChild(node.statement)
        };
        return result;
      }

      case SyntaxKind.ForInStatement: {
        const result: es.ForInStatement = {
          type: AST_NODE_TYPES.ForInStatement,
          left: convertChild(node.initializer),
          right: convertChild(node.expression),
          body: convertChild(node.statement)
        };
        return result;
      }

      case SyntaxKind.ForOfStatement: {
        const result: es.ForOfStatement = {
          type: AST_NODE_TYPES.ForOfStatement,
          left: convertChild(node.initializer),
          right: convertChild(node.expression),
          body: convertChild(node.statement)
        };

        // await is only available in for of statement
        result.await = Boolean(
          node.awaitModifier &&
            node.awaitModifier.kind === SyntaxKind.AwaitKeyword
        );
        return result;
      }

      // Declarations

      case SyntaxKind.FunctionDeclaration: {
        let functionDeclarationType = AST_NODE_TYPES.FunctionDeclaration;

        if (node.modifiers && node.modifiers.length) {
          const isDeclareFunction = nodeUtils.hasModifier(
            SyntaxKind.DeclareKeyword,
            node
          );
          if (isDeclareFunction) {
            functionDeclarationType = AST_NODE_TYPES.DeclareFunction;
          }
        }

        const result: es.FunctionDeclaration | es.DeclareFunction = {
          type: functionDeclarationType,
          id: tryConvertChild(node.name),
          generator: !!node.asteriskToken,
          expression: false,
          async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
          params: convertParameters(node.parameters),
          body: tryConvertChild(node.body)
        };

        // Process returnType
        if (node.type) {
          result.returnType = convertTypeAnnotation(node.type);
        }

        // Process typeParameters
        if (node.typeParameters && node.typeParameters.length) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        // check for exports
        return nodeUtils.fixExports(node, result as any, ast);
      }

      case SyntaxKind.VariableDeclaration: {
        const result: es.VariableDeclarator = {
          type: AST_NODE_TYPES.VariableDeclarator,
          id: convertChild(node.name),
          init: tryConvertChild(node.initializer)
        };

        if (node.exclamationToken) {
          result.definite = true;
        }

        if (node.type) {
          result.id.typeAnnotation = convertTypeAnnotation(node.type);
          fixTypeAnnotationParentLocation(result.id);
        }
        return result;
      }

      case SyntaxKind.VariableStatement: {
        const result: es.VariableDeclaration = {
          type: AST_NODE_TYPES.VariableDeclaration,
          declarations: node.declarationList.declarations.map(convertChild),
          kind: nodeUtils.getDeclarationKind(node.declarationList)
        };

        // check for exports
        return nodeUtils.fixExports(node, result as any, ast);
      }

      // mostly for for-of, for-in
      case SyntaxKind.VariableDeclarationList: {
        const result: es.VariableDeclaration = {
          type: AST_NODE_TYPES.VariableDeclaration,
          declarations: node.declarations.map(convertChild),
          kind: nodeUtils.getDeclarationKind(node)
        };
        return result;
      }

      // Expressions

      case SyntaxKind.ExpressionStatement: {
        const result: es.ExpressionStatement = {
          type: AST_NODE_TYPES.ExpressionStatement,
          expression: convertChild(node.expression)
        };
        return result;
      }

      case SyntaxKind.ThisKeyword: {
        const result: es.ThisExpression = {
          type: AST_NODE_TYPES.ThisExpression
        };
        return result;
      }

      case SyntaxKind.ArrayLiteralExpression: {
        const arrayAssignNode = nodeUtils.findAncestorOfKind(
          node,
          SyntaxKind.BinaryExpression
        );
        const arrayIsInForOf =
          node.parent && node.parent.kind === SyntaxKind.ForOfStatement;
        const arrayIsInForIn =
          node.parent && node.parent.kind === SyntaxKind.ForInStatement;
        let arrayIsInAssignment;

        if (arrayAssignNode) {
          if (node.parent.kind === SyntaxKind.CallExpression) {
            arrayIsInAssignment = false;
          } else if (
            nodeUtils.getBinaryExpressionType(
              (arrayAssignNode as any).operatorToken
            ) === AST_NODE_TYPES.AssignmentExpression
          ) {
            arrayIsInAssignment =
              nodeUtils.findChildOfKind(
                (arrayAssignNode as any).left,
                SyntaxKind.ArrayLiteralExpression,
                ast
              ) === node || (arrayAssignNode as any).left === node;
          } else {
            arrayIsInAssignment = false;
          }
        }

        // TypeScript uses ArrayLiteralExpression in destructuring assignment, too
        if (arrayIsInAssignment || arrayIsInForOf || arrayIsInForIn) {
          const result: es.ArrayPattern = {
            type: AST_NODE_TYPES.ArrayPattern,
            elements: node.elements.map(convertChild)
          };
          return result;
        } else {
          const result: es.ArrayExpression = {
            type: AST_NODE_TYPES.ArrayExpression,
            elements: node.elements.map(convertChild)
          };
          return result;
        }
      }

      case SyntaxKind.ObjectLiteralExpression: {
        const ancestorNode = nodeUtils.findFirstMatchingAncestor(
          node,
          parentNode =>
            parentNode.kind === SyntaxKind.BinaryExpression ||
            parentNode.kind === SyntaxKind.ArrowFunction
        );
        const objectAssignNode =
          ancestorNode &&
          ancestorNode.kind === SyntaxKind.BinaryExpression &&
          (ancestorNode as any).operatorToken.kind ===
            SyntaxKind.FirstAssignment
            ? ancestorNode
            : null;

        let objectIsInAssignment = false;

        if (objectAssignNode) {
          if ((objectAssignNode as any).left === node) {
            objectIsInAssignment = true;
          } else if (node.parent.kind === SyntaxKind.CallExpression) {
            objectIsInAssignment = false;
          } else {
            objectIsInAssignment =
              nodeUtils.findChildOfKind(
                (objectAssignNode as any).left,
                SyntaxKind.ObjectLiteralExpression,
                ast
              ) === node;
          }
        }

        // TypeScript uses ObjectLiteralExpression in destructuring assignment, too
        if (objectIsInAssignment) {
          const result: es.ObjectPattern = {
            type: AST_NODE_TYPES.ObjectPattern,
            properties: node.properties.map(convertChild)
          };
          return result;
        } else {
          const result: es.ObjectExpression = {
            type: AST_NODE_TYPES.ObjectExpression,
            properties: node.properties.map(convertChild)
          };
          return result;
        }
      }

      case SyntaxKind.PropertyAssignment: {
        const result: es.Property = {
          type: AST_NODE_TYPES.Property,
          key: convertChild(node.name),
          value: convertChild(node.initializer),
          computed: nodeUtils.isComputedProperty(node.name),
          method: false,
          shorthand: false,
          kind: 'init'
        };
        return result;
      }

      case SyntaxKind.ShorthandPropertyAssignment: {
        if (node.objectAssignmentInitializer) {
          const result: es.Property = {
            type: AST_NODE_TYPES.Property,
            key: convertChild(node.name),
            value: {
              type: AST_NODE_TYPES.AssignmentPattern,
              left: convertChild(node.name),
              right: convertChild(node.objectAssignmentInitializer),
              loc: result.loc,
              range: result.range
            },
            computed: false,
            method: false,
            shorthand: true,
            kind: 'init'
          };
          return result;
        } else {
          // TODO: this node has no initializer field
          const result: es.Property = {
            type: AST_NODE_TYPES.Property,
            key: convertChild<es.Expression>(node.name),
            value: convertChild<es.Expression | es.Pattern>(
              (node as any).initializer || node.name
            ),
            computed: false,
            method: false,
            shorthand: true,
            kind: 'init'
          };
          return result;
        }
      }

      case SyntaxKind.ComputedPropertyName: {
        if (parent!.kind === SyntaxKind.ObjectLiteralExpression) {
          // TODO: ComputedPropertyName has no name field
          const result: es.Property = {
            type: AST_NODE_TYPES.Property,
            key: convertChild<es.Expression>((node as any).name),
            value: convertChild<es.Expression | es.Pattern>((node as any).name),
            computed: false,
            method: false,
            shorthand: true,
            kind: 'init'
          };
          return result;
        } else {
          return convertChild(node.expression);
        }
      }

      case SyntaxKind.PropertyDeclaration: {
        const isAbstract = nodeUtils.hasModifier(
          SyntaxKind.AbstractKeyword,
          node
        );
        const result: es.BaseClassProperty = {
          type: isAbstract
            ? AST_NODE_TYPES.TSAbstractClassProperty
            : AST_NODE_TYPES.ClassProperty,
          key: convertChild(node.name),
          value: convertChild(node.initializer),
          computed: nodeUtils.isComputedProperty(node.name),
          static: nodeUtils.hasStaticModifierFlag(node),
          readonly:
            nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined
        };

        if (node.type) {
          result.typeAnnotation = convertTypeAnnotation(node.type);
        }

        if (node.decorators) {
          result.decorators = convertDecorators(node.decorators);
        }

        const accessibility = nodeUtils.getTSNodeAccessibility(node);
        if (accessibility) {
          result.accessibility = accessibility;
        }

        if (node.name.kind === SyntaxKind.Identifier && node.questionToken) {
          result.optional = true;
        }

        if (node.exclamationToken) {
          result.definite = true;
        }

        if (result.key.type === AST_NODE_TYPES.Literal && node.questionToken) {
          result.optional = true;
        }
        return result;
      }

      case SyntaxKind.GetAccessor:
      case SyntaxKind.SetAccessor:
      case SyntaxKind.MethodDeclaration: {
        const openingParen = nodeUtils.findFirstMatchingToken(
          node.name,
          ast,
          (token: any) => {
            if (!token || !token.kind) {
              return false;
            }
            return nodeUtils.getTextForTokenKind(token.kind) === '(';
          },
          ast
        );

        const methodLoc = ast.getLineAndCharacterOfPosition(
            (openingParen as any).getStart(ast)
          ),
          nodeIsMethod = node.kind === SyntaxKind.MethodDeclaration,
          method = {
            type: AST_NODE_TYPES.FunctionExpression,
            id: null,
            generator: !!node.asteriskToken,
            expression: false,
            async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
            body: convertChild(node.body),
            range: [node.parameters.pos - 1, result.range[1]],
            loc: {
              start: {
                line: methodLoc.line + 1,
                column: methodLoc.character
              },
              end: result.loc.end
            }
          };

        if (node.type) {
          (method as any).returnType = convertTypeAnnotation(node.type);
        }

        if (parent!.kind === SyntaxKind.ObjectLiteralExpression) {
          (method as any).params = node.parameters.map(convertChild);

          Object.assign(result, {
            type: AST_NODE_TYPES.Property,
            key: convertChild(node.name),
            value: method,
            computed: nodeUtils.isComputedProperty(node.name),
            method: nodeIsMethod,
            shorthand: false,
            kind: 'init'
          });
        } else {
          // class

          /**
           * Unlike in object literal methods, class method params can have decorators
           */
          (method as any).params = convertParameters(node.parameters);

          /**
           * TypeScript class methods can be defined as "abstract"
           */
          const methodDefinitionType = nodeUtils.hasModifier(
            SyntaxKind.AbstractKeyword,
            node
          )
            ? AST_NODE_TYPES.TSAbstractMethodDefinition
            : AST_NODE_TYPES.MethodDefinition;

          Object.assign(result, {
            type: methodDefinitionType,
            key: convertChild(node.name),
            value: method,
            computed: nodeUtils.isComputedProperty(node.name),
            static: nodeUtils.hasStaticModifierFlag(node),
            kind: 'method'
          });

          if (node.decorators) {
            result.decorators = convertDecorators(node.decorators);
          }

          const accessibility = nodeUtils.getTSNodeAccessibility(node);
          if (accessibility) {
            result.accessibility = accessibility;
          }
        }

        if (
          result.key.type === AST_NODE_TYPES.Identifier &&
          node.questionToken
        ) {
          result.key.optional = true;
        }

        if (node.kind === SyntaxKind.GetAccessor) {
          result.kind = 'get';
        } else if (node.kind === SyntaxKind.SetAccessor) {
          result.kind = 'set';
        } else if (
          !result.static &&
          node.name.kind === SyntaxKind.StringLiteral &&
          node.name.text === 'constructor'
        ) {
          result.kind = 'constructor';
        }

        // Process typeParameters
        if (node.typeParameters && node.typeParameters.length) {
          (method as any).typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        break;
      }

      // TypeScript uses this even for static methods named "constructor"
      case SyntaxKind.Constructor: {
        const constructorIsStatic = nodeUtils.hasStaticModifierFlag(node),
          constructorIsAbstract = nodeUtils.hasModifier(
            SyntaxKind.AbstractKeyword,
            node
          ),
          firstConstructorToken = constructorIsStatic
            ? nodeUtils.findNextToken(node.getFirstToken()!, ast, ast)
            : node.getFirstToken(),
          constructorLoc = ast.getLineAndCharacterOfPosition(
            node.parameters.pos - 1
          ),
          constructor = {
            type: AST_NODE_TYPES.FunctionExpression,
            id: null,
            params: convertParameters(node.parameters),
            generator: false,
            expression: false,
            async: false,
            body: convertChild(node.body),
            range: [node.parameters.pos - 1, result.range[1]],
            loc: {
              start: {
                line: constructorLoc.line + 1,
                column: constructorLoc.character
              },
              end: result.loc.end
            }
          };

        const constructorIdentifierLocStart = ast.getLineAndCharacterOfPosition(
            (firstConstructorToken as any).getStart(ast)
          ),
          constructorIdentifierLocEnd = ast.getLineAndCharacterOfPosition(
            (firstConstructorToken as any).getEnd(ast)
          ),
          constructorIsComputed =
            !!node.name && nodeUtils.isComputedProperty(node.name);

        let constructorKey;

        if (constructorIsComputed) {
          constructorKey = {
            type: AST_NODE_TYPES.Literal,
            value: 'constructor',
            raw: node.name!.getText(),
            range: [
              (firstConstructorToken as any).getStart(ast),
              (firstConstructorToken as any).end
            ],
            loc: {
              start: {
                line: constructorIdentifierLocStart.line + 1,
                column: constructorIdentifierLocStart.character
              },
              end: {
                line: constructorIdentifierLocEnd.line + 1,
                column: constructorIdentifierLocEnd.character
              }
            }
          };
        } else {
          constructorKey = {
            type: AST_NODE_TYPES.Identifier,
            name: 'constructor',
            range: [
              (firstConstructorToken as any).getStart(ast),
              (firstConstructorToken as any).end
            ],
            loc: {
              start: {
                line: constructorIdentifierLocStart.line + 1,
                column: constructorIdentifierLocStart.character
              },
              end: {
                line: constructorIdentifierLocEnd.line + 1,
                column: constructorIdentifierLocEnd.character
              }
            }
          };
        }

        Object.assign(result, {
          type: constructorIsAbstract
            ? AST_NODE_TYPES.TSAbstractMethodDefinition
            : AST_NODE_TYPES.MethodDefinition,
          key: constructorKey,
          value: constructor,
          computed: constructorIsComputed,
          static: constructorIsStatic,
          kind:
            constructorIsStatic || constructorIsComputed
              ? 'method'
              : 'constructor'
        });

        const accessibility = nodeUtils.getTSNodeAccessibility(node);
        if (accessibility) {
          result.accessibility = accessibility;
        }

        break;
      }

      case SyntaxKind.FunctionExpression: {
        const result: es.FunctionExpression = {
          type: AST_NODE_TYPES.FunctionExpression,
          id: convertChild(node.name),
          generator: !!node.asteriskToken,
          params: convertParameters(node.parameters),
          body: convertChild(node.body),
          async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
          expression: false
        };

        // Process returnType
        if (node.type) {
          result.returnType = convertTypeAnnotation(node.type);
        }

        // Process typeParameters
        if (node.typeParameters && node.typeParameters.length) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }
        return result;
      }

      case SyntaxKind.SuperKeyword: {
        const result: es.Super = {
          type: AST_NODE_TYPES.Super
        };
        return result;
      }

      case SyntaxKind.ArrayBindingPattern: {
        const result: es.ArrayPattern = {
          type: AST_NODE_TYPES.ArrayPattern,
          elements: node.elements.map(convertChild)
        };
        return result;
      }

      // occurs with missing array elements like [,]
      case SyntaxKind.OmittedExpression:
        return null; // TODO: throw error

      case SyntaxKind.ObjectBindingPattern: {
        const result: es.ObjectPattern = {
          type: AST_NODE_TYPES.ObjectPattern,
          properties: node.elements.map(convertChild)
        };
        return result;
      }

      case SyntaxKind.BindingElement: {
        if (parent!.kind === SyntaxKind.ArrayBindingPattern) {
          const arrayItem = convert({
            node: node.name,
            parent,
            ast,
            additionalOptions
          });

          if (node.initializer) {
            const result: es.AssignmentPattern = {
              type: AST_NODE_TYPES.AssignmentPattern,
              left: arrayItem,
              right: convertChild(node.initializer)
            };
            return result;
          } else if (node.dotDotDotToken) {
            const result: es.RestElement = {
              type: AST_NODE_TYPES.RestElement,
              argument: arrayItem
            };
            return result;
          } else {
            return arrayItem;
          }
        } else if (parent!.kind === SyntaxKind.ObjectBindingPattern) {
          if (node.dotDotDotToken) {
            Object.assign(result, {
              type: AST_NODE_TYPES.RestElement,
              argument: convertChild(node.propertyName || node.name)
            });
          } else {
            Object.assign(result, {
              type: AST_NODE_TYPES.Property,
              key: convertChild(node.propertyName || node.name),
              value: convertChild(node.name),
              computed: Boolean(
                node.propertyName &&
                  node.propertyName.kind === SyntaxKind.ComputedPropertyName
              ),
              method: false,
              shorthand: !node.propertyName,
              kind: 'init'
            });
          }

          if (node.initializer) {
            result.value = {
              type: AST_NODE_TYPES.AssignmentPattern,
              left: convertChild(node.name),
              right: convertChild(node.initializer),
              range: [node.name.getStart(ast), node.initializer.end],
              loc: nodeUtils.getLocFor(
                node.name.getStart(ast),
                node.initializer.end,
                ast
              )
            };
          }
        }
        break;
      }

      case SyntaxKind.ArrowFunction: {
        const result: es.ArrowFunctionExpression = {
          type: AST_NODE_TYPES.ArrowFunctionExpression,
          generator: false,
          params: convertParameters(node.parameters),
          body: convertChild(node.body),
          async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
          expression: node.body.kind !== SyntaxKind.Block
        };

        // Process returnType
        if (node.type) {
          result.returnType = convertTypeAnnotation(node.type);
        }

        // Process typeParameters
        if (node.typeParameters && node.typeParameters.length) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }
        return result;
      }

      case SyntaxKind.YieldExpression: {
        const result: es.YieldExpression = {
          type: AST_NODE_TYPES.YieldExpression,
          delegate: !!node.asteriskToken,
          argument: convertChild(node.expression)
        };
        return result;
      }

      case SyntaxKind.AwaitExpression: {
        const result: es.AwaitExpression = {
          type: AST_NODE_TYPES.AwaitExpression,
          argument: convertChild(node.expression)
        };
        return result;
      }

      // Template Literals

      case SyntaxKind.NoSubstitutionTemplateLiteral: {
        const result: es.TemplateLiteral = {
          type: AST_NODE_TYPES.TemplateLiteral,
          quasis: [
            {
              type: AST_NODE_TYPES.TemplateElement,
              value: {
                raw: ast.text.slice(node.getStart(ast) + 1, node.end - 1),
                cooked: node.text
              },
              tail: true,
              range: result.range,
              loc: result.loc
            }
          ],
          expressions: []
        };
        return result;
      }

      case SyntaxKind.TemplateExpression: {
        const result: es.TemplateLiteral = {
          type: AST_NODE_TYPES.TemplateLiteral,
          quasis: [convertChild(node.head)],
          expressions: []
        };

        node.templateSpans.forEach((templateSpan: any) => {
          result.expressions.push(convertChild(templateSpan.expression));
          result.quasis.push(convertChild(templateSpan.literal));
        });
        break;
      }

      case SyntaxKind.TaggedTemplateExpression: {
        const result: es.TaggedTemplateExpression = {
          type: AST_NODE_TYPES.TaggedTemplateExpression,
          typeParameters: node.typeArguments
            ? convertTypeArgumentsToTypeParameters(node.typeArguments)
            : undefined,
          tag: convertChild(node.tag),
          quasi: convertChild(node.template)
        };
        return result;
      }

      case SyntaxKind.TemplateHead:
      case SyntaxKind.TemplateMiddle:
      case SyntaxKind.TemplateTail: {
        const tail = node.kind === SyntaxKind.TemplateTail;
        const result: es.TemplateElement = {
          type: AST_NODE_TYPES.TemplateElement,
          value: {
            raw: ast.text.slice(
              node.getStart(ast) + 1,
              node.end - (tail ? 1 : 2)
            ),
            cooked: node.text
          },
          tail
        };
        return result;
      }

      // Patterns

      case SyntaxKind.SpreadElement: {
        let type = AST_NODE_TYPES.SpreadElement;

        if (
          node.parent &&
          node.parent.parent &&
          node.parent.parent.kind === SyntaxKind.BinaryExpression
        ) {
          if (
            (node.parent.parent as ts.BinaryExpression).left === node.parent
          ) {
            type = AST_NODE_TYPES.RestElement;
          } else if (
            (node.parent.parent as ts.BinaryExpression).right === node.parent
          ) {
            type = AST_NODE_TYPES.SpreadElement;
          }
        }

        Object.assign(result, {
          type,
          argument: convertChild(node.expression)
        });
        break;
      }
      case SyntaxKind.SpreadAssignment: {
        let type = AST_NODE_TYPES.SpreadElement;

        if (
          node.parent &&
          node.parent.parent &&
          node.parent.parent.kind === SyntaxKind.BinaryExpression
        ) {
          if (
            (node.parent.parent as ts.BinaryExpression).right === node.parent
          ) {
            type = AST_NODE_TYPES.SpreadElement;
          } else if (
            (node.parent.parent as ts.BinaryExpression).left === node.parent
          ) {
            type = AST_NODE_TYPES.RestElement;
          }
        }

        Object.assign(result, {
          type,
          argument: convertChild(node.expression)
        });
        break;
      }

      case SyntaxKind.Parameter: {
        let parameter;

        if (node.dotDotDotToken) {
          parameter = convertChild(node.name);
          const result: es.RestElement = {
            type: AST_NODE_TYPES.RestElement,
            argument: parameter
          };
        } else if (node.initializer) {
          parameter = convertChild(node.name);
          const result: es.AssignmentPattern = {
            type: AST_NODE_TYPES.AssignmentPattern,
            left: parameter,
            right: convertChild(node.initializer)
          };
        } else {
          parameter = convert({
            node: node.name,
            parent,
            ast,
            additionalOptions
          });
          result = parameter;
        }

        if (node.type) {
          (parameter as any).typeAnnotation = convertTypeAnnotation(node.type);
          fixTypeAnnotationParentLocation(parameter as any);
        }

        if (node.questionToken) {
          (parameter as any).optional = true;
        }

        if (node.modifiers) {
          const result: es.TSParameterProperty = {
            type: AST_NODE_TYPES.TSParameterProperty,
            range: [node.getStart(ast), node.end],
            loc: nodeUtils.getLoc(node, ast),
            accessibility: nodeUtils.getTSNodeAccessibility(node) || undefined,
            readonly:
              nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) ||
              undefined,
            static:
              nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node) ||
              undefined,
            export:
              nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) ||
              undefined,
            parameter: result
          };
          return result;
        }

        break;
      }

      // Classes

      case SyntaxKind.ClassDeclaration:
      case SyntaxKind.ClassExpression: {
        const heritageClauses = node.heritageClauses || [];

        let classNodeType = SyntaxKind[node.kind];
        let lastClassToken: any = heritageClauses.length
          ? heritageClauses[heritageClauses.length - 1]
          : node.name;

        if (node.typeParameters && node.typeParameters.length) {
          const lastTypeParameter =
            node.typeParameters[node.typeParameters.length - 1];

          if (!lastClassToken || lastTypeParameter.pos > lastClassToken.pos) {
            lastClassToken = nodeUtils.findNextToken(
              lastTypeParameter,
              ast,
              ast
            );
          }
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        if (node.modifiers && node.modifiers.length) {
          /**
           * TypeScript class declarations can be defined as "abstract"
           */
          if (node.kind === SyntaxKind.ClassDeclaration) {
            if (nodeUtils.hasModifier(SyntaxKind.AbstractKeyword, node)) {
              classNodeType = `TSAbstract${classNodeType}`;
            }
          }

          /**
           * We need check for modifiers, and use the last one, as there
           * could be multiple before the open brace
           */
          const lastModifier = node.modifiers![node.modifiers!.length - 1];

          if (!lastClassToken || lastModifier.pos > lastClassToken.pos) {
            lastClassToken = nodeUtils.findNextToken(lastModifier, ast, ast);
          }
        } else if (!lastClassToken) {
          // no name
          lastClassToken = node.getFirstToken();
        }

        const openBrace = nodeUtils.findNextToken(lastClassToken, ast, ast)!;
        const superClass = heritageClauses.find(
          (clause: any) => clause.token === SyntaxKind.ExtendsKeyword
        );

        if (superClass) {
          if (superClass.types.length > 1) {
            throw nodeUtils.createError(
              ast,
              superClass.types[1].pos,
              'Classes can only extend a single class.'
            );
          }

          if (superClass.types[0] && superClass.types[0].typeArguments) {
            result.superTypeParameters = convertTypeArgumentsToTypeParameters(
              superClass.types[0].typeArguments
            );
          }
        }

        const implementsClause = heritageClauses.find(
          (clause: any) => clause.token === SyntaxKind.ImplementsKeyword
        );

        Object.assign(result, {
          type: classNodeType,
          id: convertChild(node.name),
          body: {
            type: AST_NODE_TYPES.ClassBody,
            body: [],

            // TODO: Fix location info
            range: [openBrace.getStart(ast), result.range[1]],
            loc: nodeUtils.getLocFor(openBrace.getStart(ast), node.end, ast)
          },
          superClass:
            superClass && superClass.types[0]
              ? convertChild(superClass.types[0].expression)
              : null
        });

        if (implementsClause) {
          result.implements = implementsClause.types.map(
            convertClassImplements
          );
        }

        if (node.decorators) {
          result.decorators = convertDecorators(node.decorators);
        }

        const filteredMembers = node.members.filter(
          nodeUtils.isESTreeClassMember
        );

        if (filteredMembers.length) {
          result.body.body = filteredMembers.map(convertChild);
        }

        // check for exports
        result = nodeUtils.fixExports(node, result as any, ast);

        break;
      }

      // Modules
      case SyntaxKind.ModuleBlock: {
        const result: es.TSModuleBlock = {
          type: AST_NODE_TYPES.TSModuleBlock,
          body: node.statements.map(convertChild)
        };
        return result;
      }

      case SyntaxKind.ImportDeclaration:
        const result: es.ImportDeclaration = {
          type: AST_NODE_TYPES.ImportDeclaration,
          source: convertChild(node.moduleSpecifier),
          specifiers: []
        };

        if (node.importClause) {
          if (node.importClause.name) {
            result.specifiers.push(convertChild(node.importClause));
          }

          if (node.importClause.namedBindings) {
            if (
              node.importClause.namedBindings.kind ===
              SyntaxKind.NamespaceImport
            ) {
              result.specifiers.push(
                convertChild(node.importClause.namedBindings)
              );
            } else {
              result.specifiers = result.specifiers.concat(
                node.importClause.namedBindings.elements.map(convertChild)
              );
            }
          }
        }

        break;

      case SyntaxKind.NamespaceImport: {
        const result: es.ImportNamespaceSpecifier = {
          type: AST_NODE_TYPES.ImportNamespaceSpecifier,
          local: convertChild(node.name)
        };
        return result;
      }

      case SyntaxKind.ImportSpecifier: {
        const result: es.ImportSpecifier = {
          type: AST_NODE_TYPES.ImportSpecifier,
          local: convertChild(node.name),
          imported: convertChild(node.propertyName || node.name)
        };
        return result;
      }

      case SyntaxKind.ImportClause: {
        const result: es.ImportDefaultSpecifier = {
          type: AST_NODE_TYPES.ImportDefaultSpecifier,
          local: convertChild(node.name)
        };

        // have to adjust location information due to tree differences
        result.range[1] = node.name!.end;
        result.loc = nodeUtils.getLocFor(result.range[0], result.range[1], ast);
        return result;
      }

      case SyntaxKind.NamedImports: {
        // TODO: node has no name field
        const result: es.ImportDefaultSpecifier = {
          type: AST_NODE_TYPES.ImportDefaultSpecifier,
          local: convertChild((node as any).name)
        };
        return result;
      }

      case SyntaxKind.ExportDeclaration: {
        if (node.exportClause) {
          const result: es.ExportNamedDeclaration = {
            type: AST_NODE_TYPES.ExportNamedDeclaration,
            source: convertChild(node.moduleSpecifier),
            specifiers: node.exportClause.elements.map(convertChild),
            declaration: null
          };
          return result;
        } else {
          const result: es.ExportAllDeclaration = {
            type: AST_NODE_TYPES.ExportAllDeclaration,
            source: convertChild<es.Literal>(node.moduleSpecifier)!
          };
          return result;
        }
      }

      case SyntaxKind.ExportSpecifier: {
        const result: es.ExportSpecifier = {
          type: AST_NODE_TYPES.ExportSpecifier,
          local: convertChild(node.propertyName || node.name),
          exported: convertChild(node.name)
        };
        return result;
      }

      case SyntaxKind.ExportAssignment: {
        if (node.isExportEquals) {
          const result: es.TSExportAssignment = {
            type: AST_NODE_TYPES.TSExportAssignment,
            expression: convertChild(node.expression)
          };
          return result;
        } else {
          const result: es.ExportDefaultDeclaration = {
            type: AST_NODE_TYPES.ExportDefaultDeclaration,
            declaration: convertChild(node.expression)
          };
          return result;
        }
      }

      // Unary Operations

      case SyntaxKind.PrefixUnaryExpression:
      case SyntaxKind.PostfixUnaryExpression: {
        const operator = nodeUtils.getTextForTokenKind(node.operator);
        const result: es.UpdateExpression | es.UnaryExpression = {
          /**
           * ESTree uses UpdateExpression for ++/--
           */
          type: /^(?:\+\+|--)$/.test(operator)
            ? AST_NODE_TYPES.UpdateExpression
            : AST_NODE_TYPES.UnaryExpression,
          operator,
          prefix: node.kind === SyntaxKind.PrefixUnaryExpression,
          argument: convertChild<es.Expression>(node.operand)
        };
        return result;
      }

      case SyntaxKind.DeleteExpression: {
        const result: es.UnaryExpression = {
          type: AST_NODE_TYPES.UnaryExpression,
          operator: 'delete',
          prefix: true,
          argument: convertChild<es.Expression>(node.expression)
        };
        return result;
      }

      case SyntaxKind.VoidExpression: {
        const result: es.UnaryExpression = {
          type: AST_NODE_TYPES.UnaryExpression,
          operator: 'void',
          prefix: true,
          argument: convertChild<es.Expression>(node.expression)
        };
        return result;
      }

      case SyntaxKind.TypeOfExpression: {
        const result: es.UnaryExpression = {
          type: AST_NODE_TYPES.UnaryExpression,
          operator: 'typeof',
          prefix: true,
          argument: convertChild<es.Expression>(node.expression)
        };
        return result;
      }

      case SyntaxKind.TypeOperator: {
        const result: es.TSTypeOperator = {
          type: AST_NODE_TYPES.TSTypeOperator,
          operator: nodeUtils.getTextForTokenKind(node.operator),
          typeAnnotation: convertChild(node.type)
        };
        return result;
      }

      // Binary Operations

      case SyntaxKind.BinaryExpression:
        // TypeScript uses BinaryExpression for sequences as well
        if (nodeUtils.isComma(node.operatorToken)) {
          const result: es.SequenceExpression = {
            type: AST_NODE_TYPES.SequenceExpression,
            expressions: []
          };

          const left = convertChild(node.left),
            right = convertChild(node.right);

          if ((left as any).type === AST_NODE_TYPES.SequenceExpression) {
            result.expressions = result.expressions.concat(
              (left as any).expressions
            );
          } else {
            result.expressions.push(left);
          }

          if ((right as any).type === AST_NODE_TYPES.SequenceExpression) {
            result.expressions = result.expressions.concat(
              (right as any).expressions
            );
          } else {
            result.expressions.push(right);
          }
        } else if (
          node.operatorToken &&
          node.operatorToken.kind === SyntaxKind.AsteriskAsteriskEqualsToken
        ) {
          const result: es.AssignmentExpression = {
            type: AST_NODE_TYPES.AssignmentExpression,
            operator: nodeUtils.getTextForTokenKind(node.operatorToken.kind),
            left: convertChild(node.left),
            right: convertChild(node.right)
          };
        } else {
          Object.assign(result, {
            type: nodeUtils.getBinaryExpressionType(node.operatorToken),
            operator: nodeUtils.getTextForTokenKind(node.operatorToken.kind),
            left: convertChild(node.left),
            right: convertChild(node.right)
          });

          // if the binary expression is in a destructured array, switch it
          if (result.type === AST_NODE_TYPES.AssignmentExpression) {
            const upperArrayNode = nodeUtils.findAncestorOfKind(
                node,
                SyntaxKind.ArrayLiteralExpression
              ),
              upperArrayAssignNode =
                upperArrayNode &&
                nodeUtils.findAncestorOfKind(
                  upperArrayNode,
                  SyntaxKind.BinaryExpression
                );

            let upperArrayIsInAssignment;

            if (upperArrayAssignNode) {
              if ((upperArrayAssignNode as any).left === upperArrayNode) {
                upperArrayIsInAssignment = true;
              } else {
                upperArrayIsInAssignment =
                  nodeUtils.findChildOfKind(
                    (upperArrayAssignNode as any).left,
                    SyntaxKind.ArrayLiteralExpression,
                    ast
                  ) === upperArrayNode;
              }
            }

            if (upperArrayIsInAssignment) {
              delete result.operator;
              result.type = AST_NODE_TYPES.AssignmentPattern;
            }
          }
        }
        break;

      case SyntaxKind.PropertyAccessExpression:
        if (nodeUtils.isJSXToken(parent!)) {
          const jsxMemberExpression = {
            type: AST_NODE_TYPES.MemberExpression,
            object: convertChild(node.expression),
            property: convertChild(node.name)
          };
          const isNestedMemberExpression =
            node.expression.kind === SyntaxKind.PropertyAccessExpression;
          if (node.expression.kind === SyntaxKind.ThisKeyword) {
            (jsxMemberExpression as any).object.name = 'this';
          }

          (jsxMemberExpression as any).object.type = isNestedMemberExpression
            ? AST_NODE_TYPES.MemberExpression
            : AST_NODE_TYPES.JSXIdentifier;
          (jsxMemberExpression as any).property.type =
            AST_NODE_TYPES.JSXIdentifier;
          Object.assign(result, jsxMemberExpression);
        } else {
          const result: es.MemberExpression = {
            type: AST_NODE_TYPES.MemberExpression,
            object: convertChild(node.expression),
            property: convertChild(node.name),
            computed: false
          };
          return result;
        }
        break;

      case SyntaxKind.ElementAccessExpression: {
        const result: es.MemberExpression = {
          type: AST_NODE_TYPES.MemberExpression,
          object: convertChild(node.expression),
          property: convertChild(node.argumentExpression),
          computed: true
        };
        return result;
      }

      case SyntaxKind.ConditionalExpression: {
        const result: es.ConditionalExpression = {
          type: AST_NODE_TYPES.ConditionalExpression,
          test: convertChild(node.condition),
          consequent: convertChild(node.whenTrue),
          alternate: convertChild(node.whenFalse)
        };
        return result;
      }

      case SyntaxKind.CallExpression: {
        const result: es.SimpleCallExpression = {
          type: AST_NODE_TYPES.CallExpression,
          callee: convertChild(node.expression),
          arguments: node.arguments.map(convertChild)
        };

        if (node.typeArguments && node.typeArguments.length) {
          result.typeParameters = convertTypeArgumentsToTypeParameters(
            node.typeArguments
          );
        }
        return result;
      }

      case SyntaxKind.NewExpression: {
        const result: es.NewExpression = {
          type: AST_NODE_TYPES.NewExpression,
          callee: convertChild(node.expression),
          arguments: node.arguments ? node.arguments.map(convertChild) : []
        };

        if (node.typeArguments && node.typeArguments.length) {
          result.typeParameters = convertTypeArgumentsToTypeParameters(
            node.typeArguments
          );
        }
        return result;
      }

      case SyntaxKind.MetaProperty: {
        const newToken = nodeUtils.convertToken(node.getFirstToken()!, ast);
        const result: es.MetaProperty = {
          type: AST_NODE_TYPES.MetaProperty,
          meta: {
            type: AST_NODE_TYPES.Identifier,
            range: newToken.range,
            loc: newToken.loc,
            name: nodeUtils.getTextForTokenKind(node.keywordToken)
          },
          property: convertChild(node.name)
        };
        return result;
      }

      // Literals

      case SyntaxKind.StringLiteral: {
        const result: es.Literal = {
          type: AST_NODE_TYPES.Literal,
          raw: ast.text.slice(result.range[0], result.range[1])
        };

        if ((parent as any).name && (parent as any).name === node) {
          result.value = node.text;
        } else {
          result.value = nodeUtils.unescapeStringLiteralText(node.text);
        }
        return result;
      }

      case SyntaxKind.NumericLiteral: {
        const result: es.Literal = {
          type: AST_NODE_TYPES.Literal,
          value: Number(node.text),
          raw: ast.text.slice(result.range[0], result.range[1])
        };
        return result;
      }

      case SyntaxKind.BigIntLiteral: {
        const raw = ast.text.slice(result.range[0], result.range[1]);
        const value = raw.slice(0, -1); // remove suffix `n`
        const result: es.BigIntLiteral = {
          type: AST_NODE_TYPES.BigIntLiteral,
          raw,
          value
        };
        return result;
      }

      case SyntaxKind.RegularExpressionLiteral: {
        const pattern = node.text.slice(1, node.text.lastIndexOf('/'));
        const flags = node.text.slice(node.text.lastIndexOf('/') + 1);

        let regex = null;
        try {
          regex = new RegExp(pattern, flags);
        } catch (exception) {
          regex = null;
        }

        const result: es.Literal = {
          type: AST_NODE_TYPES.Literal,
          value: regex,
          raw: node.text,
          regex: {
            pattern,
            flags
          }
        };
        return result;
      }

      case SyntaxKind.TrueKeyword: {
        const result: es.Literal = {
          type: AST_NODE_TYPES.Literal,
          value: true,
          raw: 'true'
        };
        return result;
      }

      case SyntaxKind.FalseKeyword: {
        const result: es.Literal = {
          type: AST_NODE_TYPES.Literal,
          value: false,
          raw: 'false'
        };
        return result;
      }

      case SyntaxKind.NullKeyword: {
        if (nodeUtils.isWithinTypeAnnotation(node)) {
          const result: es.TSNullKeyword = {
            type: AST_NODE_TYPES.TSNullKeyword
          };
          return result;
        } else {
          const result: es.Literal = {
            type: AST_NODE_TYPES.Literal,
            value: null,
            raw: 'null'
          };
          return result;
        }
      }

      case SyntaxKind.ImportKeyword: {
        const result: es.Import = {
          type: AST_NODE_TYPES.Import
        };
        return result;
      }

      case SyntaxKind.EmptyStatement:
      case SyntaxKind.DebuggerStatement:
        return simplyCopy();

      // JSX

      case SyntaxKind.JsxElement: {
        const result: es.JSXElement = {
          type: AST_NODE_TYPES.JSXElement,
          openingElement: convertChild(node.openingElement),
          closingElement: convertChild(node.closingElement),
          children: node.children.map(convertChild)
        };

        return result;
      }

      case SyntaxKind.JsxFragment: {
        const result: es.JSXFragment = {
          type: AST_NODE_TYPES.JSXFragment,
          openingFragment: convertChild(
            (node as ts.JsxFragment).openingFragment
          ),
          closingFragment: convertChild(
            (node as ts.JsxFragment).closingFragment
          ),
          children: node.children.map(convertChild)
        };
        return result;
      }

      case SyntaxKind.JsxSelfClosingElement: {
        /**
         * Convert SyntaxKind.JsxSelfClosingElement to SyntaxKind.JsxOpeningElement,
         * TypeScript does not seem to have the idea of openingElement when tag is self-closing
         */
        (node as any).kind = SyntaxKind.JsxOpeningElement;

        const openingElement = convertChild(node);
        (openingElement as any).selfClosing = true;

        const result: es.JSXElement = {
          type: AST_NODE_TYPES.JSXElement,
          openingElement,
          closingElement: null,
          children: []
        };

        return result;
      }

      case SyntaxKind.JsxOpeningElement: {
        const result: es.JSXOpeningElement = {
          type: AST_NODE_TYPES.JSXOpeningElement,
          typeParameters: node.typeArguments
            ? convertTypeArgumentsToTypeParameters(node.typeArguments)
            : undefined,
          selfClosing: false,
          name: convertTypeScriptJSXTagNameToESTreeName(node.tagName),
          attributes: node.attributes.properties.map(convertChild)
        };
        return result;
      }

      case SyntaxKind.JsxClosingElement: {
        const result: es.JSXClosingElement = {
          type: AST_NODE_TYPES.JSXClosingElement,
          name: convertTypeScriptJSXTagNameToESTreeName(node.tagName)
        };
        return result;
      }

      case SyntaxKind.JsxOpeningFragment: {
        const result: es.JSXOpeningFragment = {
          type: AST_NODE_TYPES.JSXOpeningFragment
        };
        return result;
      }

      case SyntaxKind.JsxClosingFragment: {
        const result: es.JSXClosingFragment = {
          type: AST_NODE_TYPES.JSXClosingFragment
        };
        return result;
      }

      case SyntaxKind.JsxExpression: {
        const eloc = ast.getLineAndCharacterOfPosition(result.range[0] + 1);
        const expression = node.expression
          ? convertChild(node.expression)
          : {
              type: AST_NODE_TYPES.JSXEmptyExpression,
              loc: {
                start: {
                  line: eloc.line + 1,
                  column: eloc.character
                },
                end: {
                  line: result.loc.end.line,
                  column: result.loc.end.column - 1
                }
              },
              range: [result.range[0] + 1, result.range[1] - 1]
            };

        Object.assign(result, {
          type: node.dotDotDotToken
            ? AST_NODE_TYPES.JSXSpreadChild
            : AST_NODE_TYPES.JSXExpressionContainer,
          expression
        });

        break;
      }

      case SyntaxKind.JsxAttribute: {
        const attributeName = nodeUtils.convertToken(node.name, ast);
        attributeName.type = AST_NODE_TYPES.JSXIdentifier;
        attributeName.name = attributeName.value;
        delete attributeName.value;

        const result: es.JSXAttribute = {
          type: AST_NODE_TYPES.JSXAttribute,
          name: attributeName,
          value: convertChild(node.initializer)
        };

        return result;
      }

      /**
       * The JSX AST changed the node type for string literals
       * inside a JSX Element from `Literal` to `JSXText`. We
       * provide a flag to support both types until `Literal`
       * node type is deprecated in ESLint v5.
       */
      case SyntaxKind.JsxText: {
        const start = node.getFullStart();
        const end = node.getEnd();

        const type = additionalOptions.useJSXTextNode
          ? AST_NODE_TYPES.JSXText
          : AST_NODE_TYPES.Literal;

        const result: es.JSXText | es.Literal = {
          type,
          value: ast.text.slice(start, end),
          raw: ast.text.slice(start, end)
        };

        result.loc = nodeUtils.getLocFor(start, end, ast);
        result.range = [start, end];

        return result;
      }

      case SyntaxKind.JsxSpreadAttribute: {
        const result: es.JSXSpreadAttribute = {
          type: AST_NODE_TYPES.JSXSpreadAttribute,
          argument: convertChild(node.expression)
        };
        return result;
      }

      case SyntaxKind.FirstNode: {
        const result: es.TSQualifiedName = {
          type: AST_NODE_TYPES.TSQualifiedName,
          left: convertChild(node.left),
          right: convertChild(node.right)
        };
        return result;
      }

      // TypeScript specific

      case SyntaxKind.ParenthesizedExpression:
        return convert({
          node: node.expression,
          parent,
          ast,
          additionalOptions
        });

      case SyntaxKind.TypeAliasDeclaration: {
        const result: es.TSTypeAliasDeclaration = {
          type: AST_NODE_TYPES.TSTypeAliasDeclaration,
          id: convertChild((node as any).name),
          typeAnnotation: convertChild((node as any).type)
        };

        if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
          result.declare = true;
        }

        // Process typeParameters
        if (node.typeParameters && node.typeParameters.length) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        // check for exports
        return nodeUtils.fixExports(node, result as any, ast);
      }

      case SyntaxKind.MethodSignature: {
        const result: es.TSMethodSignature = {
          type: AST_NODE_TYPES.TSMethodSignature,
          optional: nodeUtils.isOptional(node),
          computed: nodeUtils.isComputedProperty(node.name),
          key: convertChild(node.name),
          params: convertParameters(node.parameters),
          typeAnnotation: node.type ? convertTypeAnnotation(node.type) : null,
          readonly:
            nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) ||
            undefined,
          static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
          export:
            nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
        };

        const accessibility = nodeUtils.getTSNodeAccessibility(node);
        if (accessibility) {
          result.accessibility = accessibility;
        }

        if (node.typeParameters) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        break;
      }

      case SyntaxKind.PropertySignature: {
        const result: es.TSPropertySignature = {
          type: AST_NODE_TYPES.TSPropertySignature,
          optional: nodeUtils.isOptional(node) || undefined,
          computed: nodeUtils.isComputedProperty(node.name),
          key: convertChild(node.name),
          typeAnnotation: node.type
            ? convertTypeAnnotation(node.type)
            : undefined,
          initializer: convertChild(node.initializer) || undefined,
          readonly:
            nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) ||
            undefined,
          static:
            nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node) || undefined,
          export:
            nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
        };

        const accessibility = nodeUtils.getTSNodeAccessibility(node);
        if (accessibility) {
          result.accessibility = accessibility;
        }

        break;
      }

      case SyntaxKind.IndexSignature: {
        const result: es.TSIndexSignature = {
          type: AST_NODE_TYPES.TSIndexSignature,
          index: convertChild(node.parameters[0]),
          typeAnnotation: node.type ? convertTypeAnnotation(node.type) : null,
          readonly:
            nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) ||
            undefined,
          static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
          export:
            nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
        };

        const accessibility = nodeUtils.getTSNodeAccessibility(node);
        if (accessibility) {
          result.accessibility = accessibility;
        }

        break;
      }

      case SyntaxKind.ConstructSignature: {
        const result: es.TSConstructSignature = {
          type: AST_NODE_TYPES.TSConstructSignature,
          params: convertParameters(node.parameters),
          typeAnnotation: node.type ? convertTypeAnnotation(node.type) : null
        };

        if (node.typeParameters) {
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        break;
      }

      case SyntaxKind.InterfaceDeclaration: {
        const interfaceHeritageClauses = node.heritageClauses || [];

        let interfaceLastClassToken = interfaceHeritageClauses.length
          ? interfaceHeritageClauses[interfaceHeritageClauses.length - 1]
          : node.name;

        if (node.typeParameters && node.typeParameters.length) {
          const interfaceLastTypeParameter =
            node.typeParameters[node.typeParameters.length - 1];

          if (
            !interfaceLastClassToken ||
            interfaceLastTypeParameter.pos > interfaceLastClassToken.pos
          ) {
            interfaceLastClassToken = nodeUtils.findNextToken(
              interfaceLastTypeParameter,
              ast,
              ast
            ) as any;
          }
          result.typeParameters = convertTSTypeParametersToTypeParametersDeclaration(
            node.typeParameters
          );
        }

        const hasImplementsClause = interfaceHeritageClauses.length > 0;
        const hasAbstractKeyword = nodeUtils.hasModifier(
          SyntaxKind.AbstractKeyword,
          node
        );
        const interfaceOpenBrace = nodeUtils.findNextToken(
          interfaceLastClassToken,
          ast,
          ast
        )!;

        const interfaceBody = {
          type: AST_NODE_TYPES.TSInterfaceBody,
          body: node.members.map((member: any) => convertChild(member)),
          range: [interfaceOpenBrace.getStart(ast), result.range[1]],
          loc: nodeUtils.getLocFor(
            interfaceOpenBrace.getStart(ast),
            node.end,
            ast
          )
        };

        Object.assign(result, {
          abstract: hasAbstractKeyword,
          type: AST_NODE_TYPES.TSInterfaceDeclaration,
          body: interfaceBody,
          id: convertChild(node.name),
          heritage: hasImplementsClause
            ? interfaceHeritageClauses[0].types.map(
                convertInterfaceHeritageClause
              )
            : []
        });
        /**
         * Semantically, decorators are not allowed on interface declarations,
         * but the TypeScript compiler will parse them and produce a valid AST,
         * so we handle them here too.
         */
        if (node.decorators) {
          result.decorators = convertDecorators(node.decorators);
        }
        // check for exports
        result = nodeUtils.fixExports(node, result as any, ast);

        break;
      }

      case SyntaxKind.FirstTypeNode: {
        const result: es.TSTypePredicate = {
          type: AST_NODE_TYPES.TSTypePredicate,
          parameterName: convertChild(node.parameterName),
          typeAnnotation: convertTypeAnnotation(node.type)
        };

        /**
         * Specific fix for type-guard location data
         */
        result.typeAnnotation.loc = result.typeAnnotation.typeAnnotation.loc;
        result.typeAnnotation.range =
          result.typeAnnotation.typeAnnotation.range;
        break;
      }

      case SyntaxKind.ImportType: {
        const result: es.TSImportType = {
          type: AST_NODE_TYPES.TSImportType,
          isTypeOf: !!node.isTypeOf,
          parameter: convertChild(node.argument),
          qualifier: tryConvertChild(node.qualifier),
          typeParameters: node.typeArguments
            ? convertTypeArgumentsToTypeParameters(node.typeArguments)
            : undefined
        };
        return result;
      }

      case SyntaxKind.EnumDeclaration: {
        let result: es.TSEnumDeclaration = {
          type: AST_NODE_TYPES.TSEnumDeclaration,
          id: convertChild(node.name),
          members: node.members.map(convertChild)
        };

        // apply modifiers first...
        applyModifiersToResult(node.modifiers);
        // ...then check for exports
        result = nodeUtils.fixExports(node, result, ast);
        /**
         * Semantically, decorators are not allowed on enum declarations,
         * but the TypeScript compiler will parse them and produce a valid AST,
         * so we handle them here too.
         */
        if (node.decorators) {
          result.decorators = convertDecorators(node.decorators);
        }
        return result;
      }

      case SyntaxKind.EnumMember: {
        const result: es.TSEnumMember = {
          type: AST_NODE_TYPES.TSEnumMember,
          id: convertChild(node.name)
        };

        if (node.initializer) {
          result.initializer = convertChild(node.initializer);
        }
        return result;
      }

      case SyntaxKind.AbstractKeyword: {
        const result: es.TSAbstractKeyword = {
          type: AST_NODE_TYPES.TSAbstractKeyword
        };
        return result;
      }

      case SyntaxKind.ModuleDeclaration: {
        const result: es.TSModuleDeclaration = {
          type: AST_NODE_TYPES.TSModuleDeclaration,
          id: convertChild(node.name)
        };

        if (node.body) {
          result.body = convertChild(node.body);
        }
        // apply modifiers first...
        applyModifiersToResult(node.modifiers);
        if (node.flags & ts.NodeFlags.GlobalAugmentation) {
          result.global = true;
        }
        // ...then check for exports
        return nodeUtils.fixExports(node, result, ast);
      }

      default:
        deeplyCopy();
    }
  }

  /**
   * Create a new ESTree node
   */
  const result = buildEsNode(node, parent);
  result.range = [node.getStart(ast), node.end];
  result.loc = nodeUtils.getLoc(node, ast);

  if (additionalOptions.shouldProvideParserServices) {
    tsNodeToESTreeNodeMap.set(node, result);
    esTreeNodeToTSNodeMap.set(result, node);
  }

  return result as any;
}
