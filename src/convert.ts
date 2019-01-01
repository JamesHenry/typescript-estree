/**
 * @fileoverview Converts TypeScript AST into ESTree format.
 * @author Nicholas C. Zakas
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */
import ts from 'typescript';
import nodeUtils from './node-utils';
import { AST_NODE_TYPES } from './ast-node-types';
import { AbstractConverter } from './convert-base';
import { ESTreeNode } from './temp-types-based-on-js-source';

const SyntaxKind = ts.SyntaxKind;

/**
 * Extends and formats a given error object
 * @param  {Object} error the error object
 * @returns {Object}       converted error object
 */
export function convertError(error: any) {
  return nodeUtils.createError(
    error.file,
    error.start,
    error.message || error.messageText
  );
}

export default class Converter extends AbstractConverter {
  [SyntaxKind.SourceFile](node: ts.SourceFile): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.Program,
      body: [],
      // externalModuleIndicator is internal field in TSC
      sourceType: (node as any).externalModuleIndicator ? 'module' : 'script'
    });

    // filter out unknown nodes for now
    node.statements.forEach(statement => {
      const convertedStatement = this.convert(statement);
      if (convertedStatement) {
        result.body.push(convertedStatement);
      }
    });

    result.body = this.convertBodyExpressionsToDirectives(node, result.body);

    result.range[1] = node.endOfFileToken.end;
    result.loc = nodeUtils.getLocFor(
      node.getStart(this.ast),
      result.range[1],
      this.ast
    );
    return result;
  }

  [SyntaxKind.Block](node: ts.Block): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.BlockStatement,
      body: node.statements.map(el => this.convert(el))
    });

    result.body = this.convertBodyExpressionsToDirectives(node, result.body);
    return result;
  }

  [SyntaxKind.Identifier](node: ts.Identifier): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Identifier,
      name: node.text
    });
  }

  [SyntaxKind.WithStatement](node: ts.WithStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.WithStatement,
      object: this.convert(node.expression),
      body: this.convert(node.statement)
    });
  }

  // Control Flow

  [SyntaxKind.ReturnStatement](node: ts.ReturnStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ReturnStatement,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.LabeledStatement](node: ts.LabeledStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.LabeledStatement,
      label: this.convert(node.label),
      body: this.convert(node.statement)
    });
  }

  [SyntaxKind.BreakStatement](node: ts.BreakStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.BreakStatement,
      label: this.convert(node.label)
    });
  }

  [SyntaxKind.ContinueStatement](node: ts.ContinueStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ContinueStatement,
      label: this.convert(node.label)
    });
  }

  // Choice

  [SyntaxKind.IfStatement](node: ts.IfStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.IfStatement,
      test: this.convert(node.expression),
      consequent: this.convert(node.thenStatement),
      alternate: this.convert(node.elseStatement)
    });
  }

  [SyntaxKind.SwitchStatement](node: ts.SwitchStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.SwitchStatement,
      discriminant: this.convert(node.expression),
      cases: node.caseBlock.clauses.map(el => this.convert(el))
    });
  }

  [SyntaxKind.CaseClause](node: ts.CaseClause): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.SwitchCase,
      // expression is present in case only
      test: this.convert(node.expression),
      consequent: node.statements.map(el => this.convert(el))
    });
  }

  [SyntaxKind.DefaultClause](node: ts.DefaultClause): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.SwitchCase,
      // expression is present in case only
      test: null,
      consequent: node.statements.map(el => this.convert(el))
    });
  }

  // Exceptions

  [SyntaxKind.ThrowStatement](node: ts.ThrowStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ThrowStatement,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.TryStatement](node: ts.TryStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TryStatement,
      block: this.convert(node.tryBlock),
      handler: this.convert(node.catchClause),
      finalizer: this.convert(node.finallyBlock)
    });
  }

  [SyntaxKind.CatchClause](node: ts.CatchClause): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.CatchClause,
      param: node.variableDeclaration
        ? this.convert(node.variableDeclaration.name)
        : null,
      body: this.convert(node.block)
    });
  }

  // Loops

  [SyntaxKind.WhileStatement](node: ts.WhileStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.WhileStatement,
      test: this.convert(node.expression),
      body: this.convert(node.statement)
    });
  }

  /**
   * Unlike other parsers, TypeScript calls a "DoWhileStatement"
   * a "DoStatement"
   */
  [SyntaxKind.DoStatement](node: ts.DoStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.DoWhileStatement,
      test: this.convert(node.expression),
      body: this.convert(node.statement)
    });
  }

  [SyntaxKind.ForStatement](node: ts.ForStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ForStatement,
      init: this.convert(node.initializer),
      test: this.convert(node.condition),
      update: this.convert(node.incrementor),
      body: this.convert(node.statement)
    });
  }

  [SyntaxKind.ForInStatement](node: ts.ForInStatement): ESTreeNode {
    return this.createNode(node, {
      type: SyntaxKind[node.kind],
      left: this.convert(node.initializer),
      right: this.convert(node.expression),
      body: this.convert(node.statement)
    });
  }

  [SyntaxKind.ForOfStatement](node: ts.ForOfStatement): ESTreeNode {
    return this.createNode(node, {
      type: SyntaxKind[node.kind],
      left: this.convert(node.initializer),
      right: this.convert(node.expression),
      body: this.convert(node.statement),
      // await is only available in for of statement
      await: Boolean(
        node.awaitModifier &&
          node.awaitModifier.kind === SyntaxKind.AwaitKeyword
      )
    });
  }

  // Declarations

  [SyntaxKind.FunctionDeclaration](node: ts.FunctionDeclaration): ESTreeNode {
    let functionDeclarationType = AST_NODE_TYPES.FunctionDeclaration;
    if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
      functionDeclarationType = AST_NODE_TYPES.TSDeclareFunction;
    }

    const result = this.createNode(node, {
      type: functionDeclarationType,
      id: this.convert(node.name),
      generator: !!node.asteriskToken,
      expression: false,
      async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
      params: this.convertParameters(node.parameters),
      body: this.convert(node.body) || undefined
    });

    // Process returnType
    if (node.type) {
      (result as any).returnType = this.convertTypeAnnotation(node.type);
    }

    if (functionDeclarationType === AST_NODE_TYPES.TSDeclareFunction) {
      result.declare = true;
    }

    // Process typeParameters
    if (node.typeParameters && node.typeParameters.length) {
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }

    // check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  [SyntaxKind.VariableDeclaration](node: ts.VariableDeclaration): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.VariableDeclarator,
      id: this.convert(node.name),
      init: this.convert(node.initializer)
    });

    if (node.exclamationToken) {
      (result as any).definite = true;
    }

    if (node.type) {
      (result as any).id.typeAnnotation = this.convertTypeAnnotation(node.type);
      this.fixTypeAnnotationParentLocation(node, (result as any).id);
    }
    return result;
  }

  [SyntaxKind.VariableStatement](node: ts.VariableStatement): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.VariableDeclaration,
      declarations: node.declarationList.declarations.map(el =>
        this.convert(el)
      ),
      kind: nodeUtils.getDeclarationKind(node.declarationList)
    });

    if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
      result.declare = true;
    }

    // check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  // mostly for for-of, for-in
  [SyntaxKind.VariableDeclarationList](
    node: ts.VariableDeclarationList
  ): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.VariableDeclaration,
      declarations: node.declarations.map(el => this.convert(el)),
      kind: nodeUtils.getDeclarationKind(node)
    });
  }

  // Expressions

  [SyntaxKind.ExpressionStatement](node: ts.ExpressionStatement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ExpressionStatement,
      expression: this.convert(node.expression)
    });
  }

  [SyntaxKind.ThisKeyword](node: ts.ThisExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ThisExpression
    });
  }

  [SyntaxKind.ArrayLiteralExpression](
    node: ts.ArrayLiteralExpression
  ): ESTreeNode {
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
      if (node.parent.kind === SyntaxKind.ShorthandPropertyAssignment) {
        arrayIsInAssignment = false;
      } else if (node.parent.kind === SyntaxKind.CallExpression) {
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
            this.ast
          ) === node || (arrayAssignNode as any).left === node;
      } else {
        arrayIsInAssignment = false;
      }
    }

    // TypeScript uses ArrayLiteralExpression in destructuring assignment, too
    if (arrayIsInAssignment || arrayIsInForOf || arrayIsInForIn) {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ArrayPattern,
        elements: node.elements.map(el => this.convert(el))
      });
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ArrayExpression,
        elements: node.elements.map(el => this.convert(el))
      });
    }
  }

  [SyntaxKind.ObjectLiteralExpression](
    node: ts.ObjectLiteralExpression
  ): ESTreeNode {
    const ancestorNode = nodeUtils.findFirstMatchingAncestor(
      node,
      parentNode =>
        parentNode.kind === SyntaxKind.BinaryExpression ||
        parentNode.kind === SyntaxKind.ArrowFunction
    );
    const objectAssignNode =
      ancestorNode &&
      ancestorNode.kind === SyntaxKind.BinaryExpression &&
      (ancestorNode as any).operatorToken.kind === SyntaxKind.FirstAssignment
        ? ancestorNode
        : null;

    let objectIsInAssignment = false;

    if (objectAssignNode) {
      if (node.parent.kind === SyntaxKind.ShorthandPropertyAssignment) {
        objectIsInAssignment = false;
      } else if ((objectAssignNode as any).left === node) {
        objectIsInAssignment = true;
      } else if (node.parent.kind === SyntaxKind.CallExpression) {
        objectIsInAssignment = false;
      } else {
        objectIsInAssignment =
          nodeUtils.findChildOfKind(
            (objectAssignNode as any).left,
            SyntaxKind.ObjectLiteralExpression,
            this.ast
          ) === node;
      }
    }

    // TypeScript uses ObjectLiteralExpression in destructuring assignment, too
    if (objectIsInAssignment) {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ObjectPattern,
        properties: node.properties.map(el => this.convert(el))
      });
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ObjectExpression,
        properties: node.properties.map(el => this.convert(el))
      });
    }
  }

  [SyntaxKind.PropertyAssignment](node: ts.PropertyAssignment): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Property,
      key: this.convert(node.name),
      value: this.convert(node.initializer),
      computed: nodeUtils.isComputedProperty(node.name),
      method: false,
      shorthand: false,
      kind: 'init'
    });
  }

  [SyntaxKind.ShorthandPropertyAssignment](
    node: ts.ShorthandPropertyAssignment
  ) {
    if (node.objectAssignmentInitializer) {
      const result = this.createNode(node, {
        type: AST_NODE_TYPES.Property,
        key: this.convert(node.name),
        computed: false,
        method: false,
        shorthand: true,
        kind: 'init'
      });
      (result as any).value = {
        type: AST_NODE_TYPES.AssignmentPattern,
        left: this.convert(node.name),
        right: this.convert(node.objectAssignmentInitializer),
        loc: result.loc,
        range: result.range
      };
      return result;
    } else {
      // TODO: this node has no initializer field
      return this.createNode(node, {
        type: AST_NODE_TYPES.Property,
        key: this.convert(node.name),
        value: this.convert((node as any).initializer || node.name),
        computed: false,
        method: false,
        shorthand: true,
        kind: 'init'
      });
    }
  }

  [SyntaxKind.ComputedPropertyName](
    node: ts.ComputedPropertyName,
    parent: ts.Node
  ): ESTreeNode | null {
    if (parent.kind === SyntaxKind.ObjectLiteralExpression) {
      // TODO: ComputedPropertyName has no name field
      return this.createNode(node, {
        type: AST_NODE_TYPES.Property,
        key: this.convert((node as any).name),
        value: this.convert((node as any).name),
        computed: false,
        method: false,
        shorthand: true,
        kind: 'init'
      });
    } else {
      return this.convert(node.expression);
    }
  }

  [SyntaxKind.PropertyDeclaration](node: ts.PropertyDeclaration): ESTreeNode {
    const isAbstract = nodeUtils.hasModifier(SyntaxKind.AbstractKeyword, node);
    const result = this.createNode(node, {
      type: isAbstract
        ? AST_NODE_TYPES.TSAbstractClassProperty
        : AST_NODE_TYPES.ClassProperty,
      key: this.convert(node.name),
      value: this.convert(node.initializer),
      computed: nodeUtils.isComputedProperty(node.name),
      static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
      readonly:
        nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined
    });

    if (node.type) {
      result.typeAnnotation = this.convertTypeAnnotation(node.type);
    }

    if (node.decorators) {
      result.decorators = this.convertDecorators(node.decorators);
    }

    const accessibility = nodeUtils.getTSNodeAccessibility(node);
    if (accessibility) {
      (result as any).accessibility = accessibility;
    }

    if (node.name.kind === SyntaxKind.Identifier && node.questionToken) {
      (result as any).optional = true;
    }

    if (node.exclamationToken) {
      (result as any).definite = true;
    }

    if (
      (result as any).key.type === AST_NODE_TYPES.Literal &&
      node.questionToken
    ) {
      (result as any).optional = true;
    }
    return result;
  }

  convertMethodDeclaration(
    node:
      | ts.MethodDeclaration
      | ts.SetAccessorDeclaration
      | ts.GetAccessorDeclaration,
    parent: ts.Node
  ): ESTreeNode {
    const result = this.createNode(node, {});

    const openingParen = nodeUtils.findFirstMatchingToken(
      node.name,
      this.ast,
      (token: any) => {
        if (!token || !token.kind) {
          return false;
        }
        return nodeUtils.getTextForTokenKind(token.kind) === '(';
      },
      this.ast
    );

    const methodLoc = this.ast.getLineAndCharacterOfPosition(
        (openingParen as any).getStart(this.ast)
      ),
      nodeIsMethod = node.kind === SyntaxKind.MethodDeclaration,
      method = {
        type: AST_NODE_TYPES.FunctionExpression,
        id: null,
        generator: !!node.asteriskToken,
        expression: false,
        async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
        body: this.convert(node.body),
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
      (method as any).returnType = this.convertTypeAnnotation(node.type);
    }

    if (parent.kind === SyntaxKind.ObjectLiteralExpression) {
      (method as any).params = node.parameters.map(el => this.convert(el));

      // TODO: refactor me
      Object.assign(result, {
        type: AST_NODE_TYPES.Property,
        key: this.convert(node.name),
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
      (method as any).params = this.convertParameters(node.parameters);

      /**
       * TypeScript class methods can be defined as "abstract"
       */
      const methodDefinitionType = nodeUtils.hasModifier(
        SyntaxKind.AbstractKeyword,
        node
      )
        ? AST_NODE_TYPES.TSAbstractMethodDefinition
        : AST_NODE_TYPES.MethodDefinition;

      // TODO: refactor me
      Object.assign(result, {
        type: methodDefinitionType,
        key: this.convert(node.name),
        value: method,
        computed: nodeUtils.isComputedProperty(node.name),
        static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
        kind: 'method'
      });

      if (node.decorators) {
        result.decorators = this.convertDecorators(node.decorators);
      }

      const accessibility = nodeUtils.getTSNodeAccessibility(node);
      if (accessibility) {
        (result as any).accessibility = accessibility;
      }
    }

    if (
      (result as any).key.type === AST_NODE_TYPES.Identifier &&
      node.questionToken
    ) {
      (result as any).key.optional = true;
    }

    if (node.kind === SyntaxKind.GetAccessor) {
      (result as any).kind = 'get';
    } else if (node.kind === SyntaxKind.SetAccessor) {
      (result as any).kind = 'set';
    } else if (
      !(result as any).static &&
      node.name.kind === SyntaxKind.StringLiteral &&
      node.name.text === 'constructor'
    ) {
      (result as any).kind = 'constructor';
    }

    // Process typeParameters
    if (node.typeParameters && node.typeParameters.length) {
      (method as any).typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }
    return result;
  }

  [SyntaxKind.GetAccessor](
    node: ts.GetAccessorDeclaration,
    parent: ts.Node
  ): ESTreeNode {
    return this.convertMethodDeclaration(node, parent);
  }

  [SyntaxKind.SetAccessor](
    node: ts.SetAccessorDeclaration,
    parent: ts.Node
  ): ESTreeNode {
    return this.convertMethodDeclaration(node, parent);
  }

  [SyntaxKind.MethodDeclaration](
    node: ts.MethodDeclaration,
    parent: ts.Node
  ): ESTreeNode {
    return this.convertMethodDeclaration(node, parent);
  }

  // TypeScript uses this even for static methods named "constructor"
  [SyntaxKind.Constructor](node: ts.ConstructorDeclaration): ESTreeNode {
    const result = this.createNode(node, {});

    const constructorIsStatic = nodeUtils.hasModifier(
        SyntaxKind.StaticKeyword,
        node
      ),
      constructorIsAbstract = nodeUtils.hasModifier(
        SyntaxKind.AbstractKeyword,
        node
      ),
      firstConstructorToken = constructorIsStatic
        ? nodeUtils.findNextToken(node.getFirstToken()!, this.ast, this.ast)
        : node.getFirstToken(),
      constructorLoc = this.ast.getLineAndCharacterOfPosition(
        node.parameters.pos - 1
      ),
      constructor = {
        type: AST_NODE_TYPES.FunctionExpression,
        id: null,
        params: this.convertParameters(node.parameters),
        generator: false,
        expression: false,
        async: false,
        body: this.convert(node.body),
        range: [node.parameters.pos - 1, result.range[1]],
        loc: {
          start: {
            line: constructorLoc.line + 1,
            column: constructorLoc.character
          },
          end: result.loc.end
        }
      };

    const constructorIdentifierLocStart = this.ast.getLineAndCharacterOfPosition(
        (firstConstructorToken as any).getStart(this.ast)
      ),
      constructorIdentifierLocEnd = this.ast.getLineAndCharacterOfPosition(
        (firstConstructorToken as any).getEnd(this.ast)
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
          (firstConstructorToken as any).getStart(this.ast),
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
          (firstConstructorToken as any).getStart(this.ast),
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

    // TODO: refactor me
    Object.assign(result, {
      type: constructorIsAbstract
        ? AST_NODE_TYPES.TSAbstractMethodDefinition
        : AST_NODE_TYPES.MethodDefinition,
      key: constructorKey,
      value: constructor,
      computed: constructorIsComputed,
      static: constructorIsStatic,
      kind:
        constructorIsStatic || constructorIsComputed ? 'method' : 'constructor'
    });

    const accessibility = nodeUtils.getTSNodeAccessibility(node);
    if (accessibility) {
      (result as any).accessibility = accessibility;
    }
    return result;
  }

  [SyntaxKind.FunctionExpression](node: ts.FunctionExpression): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.FunctionExpression,
      id: this.convert(node.name),
      generator: !!node.asteriskToken,
      params: this.convertParameters(node.parameters),
      body: this.convert(node.body),
      async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
      expression: false
    });

    // Process returnType
    if (node.type) {
      (result as any).returnType = this.convertTypeAnnotation(node.type);
    }

    // Process typeParameters
    if (node.typeParameters && node.typeParameters.length) {
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }
    return result;
  }

  [SyntaxKind.SuperKeyword](node: ts.SuperExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Super
    });
  }

  [SyntaxKind.ArrayBindingPattern](node: ts.ArrayBindingPattern): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ArrayPattern,
      elements: node.elements.map(el => this.convert(el))
    });
  }

  // occurs with missing array elements like [,]
  [SyntaxKind.OmittedExpression](node: ts.OmittedExpression): null {
    return null;
  }

  [SyntaxKind.ObjectBindingPattern](node: ts.ObjectBindingPattern): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ObjectPattern,
      properties: node.elements.map(el => this.convert(el))
    });
  }

  [SyntaxKind.BindingElement](
    node: ts.BindingElement,
    parent: ts.Node
  ): ESTreeNode | null {
    if (parent.kind === SyntaxKind.ArrayBindingPattern) {
      const arrayItem = this.convert(node.name, parent);

      if (node.initializer) {
        return this.createNode(node, {
          type: AST_NODE_TYPES.AssignmentPattern,
          left: arrayItem,
          right: this.convert(node.initializer)
        });
      } else if (node.dotDotDotToken) {
        return this.createNode(node, {
          type: AST_NODE_TYPES.RestElement,
          argument: arrayItem
        });
      } else {
        return arrayItem;
      }
    } else if (parent.kind === SyntaxKind.ObjectBindingPattern) {
      let result: ESTreeNode;

      if (node.dotDotDotToken) {
        result = this.createNode(node, {
          type: AST_NODE_TYPES.RestElement,
          argument: this.convert(node.propertyName || node.name)
        });
      } else {
        result = this.createNode(node, {
          type: AST_NODE_TYPES.Property,
          key: this.convert(node.propertyName || node.name),
          value: this.convert(node.name),
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
        (result as any).value = {
          type: AST_NODE_TYPES.AssignmentPattern,
          left: this.convert(node.name),
          right: this.convert(node.initializer),
          range: [node.name.getStart(this.ast), node.initializer.end],
          loc: nodeUtils.getLocFor(
            node.name.getStart(this.ast),
            node.initializer.end,
            this.ast
          )
        };
      }
      return result;
    }
    return null;
  }

  [SyntaxKind.ArrowFunction](node: ts.ArrowFunction): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.ArrowFunctionExpression,
      generator: false,
      id: null,
      params: this.convertParameters(node.parameters),
      body: this.convert(node.body),
      async: nodeUtils.hasModifier(SyntaxKind.AsyncKeyword, node),
      expression: node.body.kind !== SyntaxKind.Block
    });

    // Process returnType
    if (node.type) {
      (result as any).returnType = this.convertTypeAnnotation(node.type);
    }

    // Process typeParameters
    if (node.typeParameters && node.typeParameters.length) {
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }
    return result;
  }

  [SyntaxKind.YieldExpression](node: ts.YieldExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.YieldExpression,
      delegate: !!node.asteriskToken,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.AwaitExpression](node: ts.AwaitExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.AwaitExpression,
      argument: this.convert(node.expression)
    });
  }

  // Template Literals

  [SyntaxKind.NoSubstitutionTemplateLiteral](
    node: ts.NoSubstitutionTemplateLiteral
  ) {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TemplateLiteral,
      quasis: [],
      expressions: []
    });

    (result as any).quasis.push({
      type: AST_NODE_TYPES.TemplateElement,
      value: {
        raw: this.ast.text.slice(node.getStart(this.ast) + 1, node.end - 1),
        cooked: node.text
      },
      tail: true,
      range: result.range,
      loc: result.loc
    });
    return result;
  }

  [SyntaxKind.TemplateExpression](node: ts.TemplateExpression): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TemplateLiteral,
      quasis: [this.convert(node.head)],
      expressions: []
    });

    node.templateSpans.forEach(templateSpan => {
      (result as any).expressions.push(this.convert(templateSpan.expression));
      (result as any).quasis.push(this.convert(templateSpan.literal));
    });
    return result;
  }

  [SyntaxKind.TaggedTemplateExpression](
    node: ts.TaggedTemplateExpression
  ): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TaggedTemplateExpression,
      typeParameters: node.typeArguments
        ? this.convertTypeArgumentsToTypeParameters(node.typeArguments)
        : undefined,
      tag: this.convert(node.tag),
      quasi: this.convert(node.template)
    });
  }

  convertTemplateParts(
    node: ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail
  ): ESTreeNode {
    const tail = node.kind === SyntaxKind.TemplateTail;
    return this.createNode(node, {
      type: AST_NODE_TYPES.TemplateElement,
      value: {
        raw: this.ast.text.slice(
          node.getStart(this.ast) + 1,
          node.end - (tail ? 1 : 2)
        ),
        cooked: node.text
      },
      tail
    });
  }

  [SyntaxKind.TemplateHead](node: ts.TemplateHead): ESTreeNode {
    return this.convertTemplateParts(node);
  }

  [SyntaxKind.TemplateMiddle](node: ts.TemplateMiddle): ESTreeNode {
    return this.convertTemplateParts(node);
  }

  [SyntaxKind.TemplateTail](node: ts.TemplateTail): ESTreeNode {
    return this.convertTemplateParts(node);
  }

  // Patterns

  [SyntaxKind.SpreadElement](node: ts.SpreadElement): ESTreeNode {
    let type = AST_NODE_TYPES.SpreadElement;

    if (
      node.parent &&
      node.parent.parent &&
      node.parent.parent.kind === SyntaxKind.BinaryExpression
    ) {
      if ((node.parent.parent as ts.BinaryExpression).left === node.parent) {
        type = AST_NODE_TYPES.RestElement;
      } else if (
        (node.parent.parent as ts.BinaryExpression).right === node.parent
      ) {
        type = AST_NODE_TYPES.SpreadElement;
      }
    }

    return this.createNode(node, {
      type,
      argument: this.convert(node.expression)
    });
  }
  [SyntaxKind.SpreadAssignment](node: ts.SpreadAssignment): ESTreeNode {
    let type = AST_NODE_TYPES.SpreadElement;

    if (
      node.parent &&
      node.parent.parent &&
      node.parent.parent.kind === SyntaxKind.BinaryExpression
    ) {
      if ((node.parent.parent as ts.BinaryExpression).right === node.parent) {
        type = AST_NODE_TYPES.SpreadElement;
      } else if (
        (node.parent.parent as ts.BinaryExpression).left === node.parent
      ) {
        type = AST_NODE_TYPES.RestElement;
      }
    }

    return this.createNode(node, {
      type,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.Parameter](
    node: ts.ParameterDeclaration,
    parent: ts.Node
  ): ESTreeNode | null {
    let parameter;
    let result: ESTreeNode | null;

    if (node.dotDotDotToken) {
      parameter = this.convert(node.name);
      result = this.createNode(node, {
        type: AST_NODE_TYPES.RestElement,
        argument: parameter
      });
    } else if (node.initializer) {
      parameter = this.convert(node.name);
      result = this.createNode(node, {
        type: AST_NODE_TYPES.AssignmentPattern,
        left: parameter,
        right: this.convert(node.initializer)
      });
    } else {
      parameter = this.convert(node.name, parent);
      result = parameter;
    }

    if (node.type) {
      (parameter as any).typeAnnotation = this.convertTypeAnnotation(node.type);
      this.fixTypeAnnotationParentLocation(node, parameter!);
    }

    if (node.questionToken) {
      (parameter as any).optional = true;
    }

    if (node.modifiers) {
      return {
        type: AST_NODE_TYPES.TSParameterProperty,
        range: [node.getStart(this.ast), node.end],
        loc: nodeUtils.getLoc(node, this.ast),
        accessibility: nodeUtils.getTSNodeAccessibility(node) || undefined,
        readonly:
          nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined,
        static:
          nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node) || undefined,
        export:
          nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined,
        parameter: result
      };
    }
    return result;
  }

  // Classes
  convertClassLike(node: ts.ClassExpression | ts.ClassDeclaration): ESTreeNode {
    const result = this.createNode(node, {});

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
          this.ast,
          this.ast
        );
      }
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
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
        lastClassToken = nodeUtils.findNextToken(
          lastModifier,
          this.ast,
          this.ast
        );
      }
    } else if (!lastClassToken) {
      // no name
      lastClassToken = node.getFirstToken();
    }

    const openBrace = nodeUtils.findNextToken(
      lastClassToken,
      this.ast,
      this.ast
    )!;
    const superClass = heritageClauses.find(
      clause => clause.token === SyntaxKind.ExtendsKeyword
    );

    if (superClass) {
      if (superClass.types.length > 1) {
        throw nodeUtils.createError(
          this.ast,
          superClass.types[1].pos,
          'Classes can only extend a single class.'
        );
      }

      if (superClass.types[0] && superClass.types[0].typeArguments) {
        (result as any).superTypeParameters = this.convertTypeArgumentsToTypeParameters(
          superClass.types[0].typeArguments
        );
      }
    }

    const implementsClause = heritageClauses.find(
      clause => clause.token === SyntaxKind.ImplementsKeyword
    );

    Object.assign(result, {
      type: classNodeType,
      id: this.convert(node.name),
      body: {
        type: AST_NODE_TYPES.ClassBody,
        body: [],

        // TODO: Fix location info
        range: [openBrace.getStart(this.ast), result.range[1]],
        loc: nodeUtils.getLocFor(
          openBrace.getStart(this.ast),
          node.end,
          this.ast
        )
      },
      superClass:
        superClass && superClass.types[0]
          ? this.convert(superClass.types[0].expression)
          : null
    });

    if (implementsClause) {
      (result as any).implements = implementsClause.types.map(el =>
        this.convertClassImplements(el)
      );
    }

    if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
      result.declare = true;
    }

    if (node.decorators) {
      result.decorators = this.convertDecorators(node.decorators);
    }

    const filteredMembers = node.members.filter(nodeUtils.isESTreeClassMember);

    if (filteredMembers.length) {
      result.body.body = filteredMembers.map(el => this.convert(el));
    }

    // check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  [SyntaxKind.ClassDeclaration](node: ts.ClassDeclaration): ESTreeNode {
    return this.convertClassLike(node);
  }

  [SyntaxKind.ClassExpression](node: ts.ClassExpression): ESTreeNode {
    return this.convertClassLike(node);
  }

  // Modules
  [SyntaxKind.ModuleBlock](node: ts.ModuleBlock): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSModuleBlock,
      body: node.statements.map(el => this.convert(el))
    });

    result.body = this.convertBodyExpressionsToDirectives(node, result.body);
    return result;
  }

  [SyntaxKind.ImportDeclaration](node: ts.ImportDeclaration): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.ImportDeclaration,
      source: this.convert(node.moduleSpecifier),
      specifiers: []
    });

    if (node.importClause) {
      if (node.importClause.name) {
        result.specifiers!.push(this.convert(node.importClause));
      }

      if (node.importClause.namedBindings) {
        if (
          node.importClause.namedBindings.kind === SyntaxKind.NamespaceImport
        ) {
          result.specifiers!.push(
            this.convert(node.importClause.namedBindings)
          );
        } else {
          result.specifiers = result.specifiers!.concat(
            node.importClause.namedBindings.elements.map(el => this.convert(el))
          );
        }
      }
    }
    return result;
  }

  [SyntaxKind.NamespaceImport](node: ts.NamespaceImport): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ImportNamespaceSpecifier,
      local: this.convert(node.name)
    });
  }

  [SyntaxKind.ImportSpecifier](node: ts.ImportSpecifier): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ImportSpecifier,
      local: this.convert(node.name),
      imported: this.convert(node.propertyName || node.name)
    });
  }

  [SyntaxKind.ImportClause](node: ts.ImportClause): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.ImportDefaultSpecifier,
      local: this.convert(node.name)
    });

    // have to adjust location information due to tree differences
    result.range[1] = node.name!.end;
    result.loc = nodeUtils.getLocFor(
      result.range[0],
      result.range[1],
      this.ast
    );
    return result;
  }

  [SyntaxKind.NamedImports](node: ts.NamedImports): ESTreeNode {
    // TODO: node has no name field
    return this.createNode(node, {
      type: AST_NODE_TYPES.ImportDefaultSpecifier,
      local: this.convert((node as any).name)
    });
  }

  [SyntaxKind.ExportDeclaration](node: ts.ExportDeclaration): ESTreeNode {
    if (node.exportClause) {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ExportNamedDeclaration,
        source: this.convert(node.moduleSpecifier),
        specifiers: node.exportClause.elements.map(el => this.convert(el)),
        declaration: null
      });
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ExportAllDeclaration,
        source: this.convert(node.moduleSpecifier)
      });
    }
  }

  [SyntaxKind.ExportSpecifier](node: ts.ExportSpecifier): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ExportSpecifier,
      local: this.convert(node.propertyName || node.name),
      exported: this.convert(node.name)
    });
  }

  [SyntaxKind.ExportAssignment](node: ts.ExportAssignment): ESTreeNode {
    if (node.isExportEquals) {
      return this.createNode(node, {
        type: AST_NODE_TYPES.TSExportAssignment,
        expression: this.convert(node.expression)
      });
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.ExportDefaultDeclaration,
        declaration: this.convert(node.expression)
      });
    }
  }

  // Unary Operations
  convertUnaryExpression(
    node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression
  ): ESTreeNode {
    const operator = nodeUtils.getTextForTokenKind(node.operator) || '';
    return this.createNode(node, {
      /**
       * ESTree uses UpdateExpression for ++/--
       */
      type: /^(?:\+\+|--)$/.test(operator)
        ? AST_NODE_TYPES.UpdateExpression
        : AST_NODE_TYPES.UnaryExpression,
      operator,
      prefix: node.kind === SyntaxKind.PrefixUnaryExpression,
      argument: this.convert(node.operand)
    });
  }

  [SyntaxKind.PrefixUnaryExpression](
    node: ts.PrefixUnaryExpression
  ): ESTreeNode {
    return this.convertUnaryExpression(node);
  }

  [SyntaxKind.PostfixUnaryExpression](
    node: ts.PostfixUnaryExpression
  ): ESTreeNode {
    return this.convertUnaryExpression(node);
  }

  [SyntaxKind.DeleteExpression](node: ts.DeleteExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.UnaryExpression,
      operator: 'delete',
      prefix: true,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.VoidExpression](node: ts.VoidExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.UnaryExpression,
      operator: 'void',
      prefix: true,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.TypeOfExpression](node: ts.TypeOfExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.UnaryExpression,
      operator: 'typeof',
      prefix: true,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.TypeOperator](node: ts.TypeOperatorNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeOperator,
      operator: nodeUtils.getTextForTokenKind(node.operator),
      typeAnnotation: this.convert(node.type)
    });
  }

  // Binary Operations

  [SyntaxKind.BinaryExpression](node: ts.BinaryExpression): ESTreeNode {
    // TypeScript uses BinaryExpression for sequences as well
    if (nodeUtils.isComma(node.operatorToken)) {
      const result = this.createNode(node, {
        type: AST_NODE_TYPES.SequenceExpression,
        expressions: []
      });

      const left = this.convert(node.left),
        right = this.convert(node.right);

      if ((left as any).type === AST_NODE_TYPES.SequenceExpression) {
        (result as any).expressions = (result as any).expressions.concat(
          (left as any).expressions
        );
      } else {
        (result as any).expressions.push(left);
      }

      if ((right as any).type === AST_NODE_TYPES.SequenceExpression) {
        (result as any).expressions = (result as any).expressions.concat(
          (right as any).expressions
        );
      } else {
        (result as any).expressions.push(right);
      }
      return result;
    } else {
      const result = this.createNode(node, {
        type: nodeUtils.getBinaryExpressionType(node.operatorToken),
        operator: nodeUtils.getTextForTokenKind(node.operatorToken.kind),
        left: this.convert(node.left),
        right: this.convert(node.right)
      });

      // if the binary expression is in a destructured array, switch it
      if (result.type === AST_NODE_TYPES.AssignmentExpression) {
        const upperArrayNode = nodeUtils.findFirstMatchingAncestor(
          node,
          parent =>
            parent.kind === SyntaxKind.ArrayLiteralExpression ||
            parent.kind === SyntaxKind.ObjectLiteralExpression
        );
        const upperArrayAssignNode =
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
                this.ast
              ) === upperArrayNode;
          }
        }

        if (upperArrayIsInAssignment) {
          delete (result as any).operator;
          result.type = AST_NODE_TYPES.AssignmentPattern;
        }
      }
      return result;
    }
  }

  [SyntaxKind.PropertyAccessExpression](
    node: ts.PropertyAccessExpression,
    parent: ts.Node
  ): ESTreeNode {
    if (nodeUtils.isJSXToken(parent)) {
      const result = this.createNode(node, {
        type: AST_NODE_TYPES.MemberExpression,
        object: this.convert(node.expression, parent),
        property: this.convert(node.name, parent)
      });
      const isNestedMemberExpression =
        node.expression.kind === SyntaxKind.PropertyAccessExpression;
      if (node.expression.kind === SyntaxKind.ThisKeyword) {
        (result as any).object.name = 'this';
      }

      (result as any).object.type = isNestedMemberExpression
        ? AST_NODE_TYPES.MemberExpression
        : AST_NODE_TYPES.JSXIdentifier;
      (result as any).property.type = AST_NODE_TYPES.JSXIdentifier;
      return result;
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.MemberExpression,
        object: this.convert(node.expression),
        property: this.convert(node.name),
        computed: false
      });
    }
  }

  [SyntaxKind.ElementAccessExpression](
    node: ts.ElementAccessExpression
  ): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.MemberExpression,
      object: this.convert(node.expression),
      property: this.convert(node.argumentExpression),
      computed: true
    });
  }

  [SyntaxKind.ConditionalExpression](
    node: ts.ConditionalExpression
  ): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.ConditionalExpression,
      test: this.convert(node.condition),
      consequent: this.convert(node.whenTrue),
      alternate: this.convert(node.whenFalse)
    });
  }

  [SyntaxKind.CallExpression](node: ts.CallExpression): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.CallExpression,
      callee: this.convert(node.expression),
      arguments: node.arguments.map(el => this.convert(el))
    });
    if (node.typeArguments && node.typeArguments.length) {
      result.typeParameters = this.convertTypeArgumentsToTypeParameters(
        node.typeArguments
      );
    }
    return result;
  }

  [SyntaxKind.NewExpression](node: ts.NewExpression): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.NewExpression,
      callee: this.convert(node.expression),
      arguments: node.arguments
        ? node.arguments.map(el => this.convert(el))
        : []
    });
    if (node.typeArguments && node.typeArguments.length) {
      result.typeParameters = this.convertTypeArgumentsToTypeParameters(
        node.typeArguments
      );
    }
    return result;
  }

  [SyntaxKind.MetaProperty](node: ts.MetaProperty): ESTreeNode {
    const newToken = nodeUtils.convertToken(node.getFirstToken()!, this.ast);
    return this.createNode(node, {
      type: AST_NODE_TYPES.MetaProperty,
      meta: {
        type: AST_NODE_TYPES.Identifier,
        range: newToken.range,
        loc: newToken.loc,
        name: nodeUtils.getTextForTokenKind(node.keywordToken)
      },
      property: this.convert(node.name)
    });
  }

  // Literals

  [SyntaxKind.StringLiteral](
    node: ts.StringLiteral,
    parent: ts.Node
  ): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.Literal
    });

    (result as any).raw = this.ast.text.slice(result.range[0], result.range[1]);

    if ((parent as any).name && (parent as any).name === node) {
      (result as any).value = node.text;
    } else {
      (result as any).value = nodeUtils.unescapeStringLiteralText(node.text);
    }
    return result;
  }

  [SyntaxKind.NumericLiteral](node: ts.NumericLiteral): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.Literal,
      value: Number(node.text)
    });

    (result as any).raw = this.ast.text.slice(result.range[0], result.range[1]);
    return result;
  }

  [SyntaxKind.BigIntLiteral](node: ts.BigIntLiteral): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.BigIntLiteral
    });

    (result as any).raw = this.ast.text.slice(result.range[0], result.range[1]);
    (result as any).value = (result as any).raw.slice(0, -1); // remove suffix `n`

    return result;
  }

  [SyntaxKind.RegularExpressionLiteral](
    node: ts.RegularExpressionLiteral
  ): ESTreeNode {
    const pattern = node.text.slice(1, node.text.lastIndexOf('/'));
    const flags = node.text.slice(node.text.lastIndexOf('/') + 1);

    let regex = null;
    try {
      regex = new RegExp(pattern, flags);
    } catch (exception) {
      regex = null;
    }

    return this.createNode(node, {
      type: AST_NODE_TYPES.Literal,
      value: regex,
      raw: node.text,
      regex: {
        pattern,
        flags
      }
    });
  }

  [SyntaxKind.TrueKeyword](node: ts.BooleanLiteral): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Literal,
      value: true,
      raw: 'true'
    });
  }

  [SyntaxKind.FalseKeyword](node: ts.BooleanLiteral): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Literal,
      value: false,
      raw: 'false'
    });
  }

  [SyntaxKind.NullKeyword](
    node: ts.NullLiteral,
    parent: ts.Node,
    type?: boolean
  ): ESTreeNode {
    if (type) {
      return this.createNode(node, {
        type: AST_NODE_TYPES.TSNullKeyword
      });
    } else {
      return this.createNode(node, {
        type: AST_NODE_TYPES.Literal,
        value: null,
        raw: 'null'
      });
    }
  }

  [SyntaxKind.ImportKeyword](node: ts.ImportExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.Import
    });
  }

  [SyntaxKind.EmptyStatement](node: ts.EmptyStatement): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.EmptyStatement);
  }

  [SyntaxKind.DebuggerStatement](node: ts.DebuggerStatement): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.DebuggerStatement);
  }

  // JSX

  [SyntaxKind.JsxElement](node: ts.JsxElement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXElement,
      openingElement: this.convert(node.openingElement),
      closingElement: this.convert(node.closingElement),
      children: node.children.map(el => this.convert(el))
    });
  }

  [SyntaxKind.JsxFragment](node: ts.JsxFragment): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXFragment,
      openingFragment: this.convert(node.openingFragment),
      closingFragment: this.convert(node.closingFragment),
      children: node.children.map(el => this.convert(el))
    });
  }

  [SyntaxKind.JsxSelfClosingElement](
    node: ts.JsxSelfClosingElement
  ): ESTreeNode {
    /**
     * Convert SyntaxKind.JsxSelfClosingElement to SyntaxKind.JsxOpeningElement,
     * TypeScript does not seem to have the idea of openingElement when tag is self-closing
     */
    (node as any).kind = SyntaxKind.JsxOpeningElement;

    const openingElement = this.convert(node);
    (openingElement as any).selfClosing = true;

    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXElement,
      openingElement,
      closingElement: null,
      children: []
    });
  }

  [SyntaxKind.JsxOpeningElement](node: ts.JsxOpeningElement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXOpeningElement,
      typeParameters: node.typeArguments
        ? this.convertTypeArgumentsToTypeParameters(node.typeArguments)
        : undefined,
      selfClosing: false,
      name: this.convertTypeScriptJSXTagNameToESTreeName(node, node.tagName),
      attributes: node.attributes.properties.map(el => this.convert(el))
    });
  }

  [SyntaxKind.JsxClosingElement](node: ts.JsxClosingElement): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXClosingElement,
      name: this.convertTypeScriptJSXTagNameToESTreeName(node, node.tagName)
    });
  }

  [SyntaxKind.JsxOpeningFragment](node: ts.JsxOpeningFragment): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXOpeningFragment
    });
  }
  [SyntaxKind.JsxClosingFragment](node: ts.JsxClosingFragment): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXClosingFragment
    });
  }

  [SyntaxKind.JsxExpression](node: ts.JsxExpression): ESTreeNode {
    const result = this.createNode(node, {
      type: node.dotDotDotToken
        ? AST_NODE_TYPES.JSXSpreadChild
        : AST_NODE_TYPES.JSXExpressionContainer
    });

    if (node.expression) {
      result.expression = this.convert(node.expression);
    } else {
      const eloc = this.ast.getLineAndCharacterOfPosition(result.range[0] + 1);
      result.expression = {
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
    }

    return result;
  }

  [SyntaxKind.JsxAttribute](node: ts.JsxAttribute): ESTreeNode {
    const attributeName = nodeUtils.convertToken(node.name, this.ast);
    attributeName.type = AST_NODE_TYPES.JSXIdentifier;
    attributeName.name = attributeName.value;
    delete attributeName.value;

    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXAttribute,
      name: attributeName,
      value: this.convert(node.initializer)
    });
  }

  /**
   * The JSX AST changed the node type for string literals
   * inside a JSX Element from `Literal` to `JSXText`. We
   * provide a flag to support both types until `Literal`
   * node type is deprecated in ESLint v5.
   */
  [SyntaxKind.JsxText](node: ts.JsxText): ESTreeNode {
    const start = node.getFullStart();
    const end = node.getEnd();

    const type = this.additionalOptions.useJSXTextNode
      ? AST_NODE_TYPES.JSXText
      : AST_NODE_TYPES.Literal;

    const result = this.createNode(node, {
      type,
      value: this.ast.text.slice(start, end),
      raw: this.ast.text.slice(start, end)
    });

    result.loc = nodeUtils.getLocFor(start, end, this.ast);
    result.range = [start, end];
    return result;
  }

  [SyntaxKind.JsxSpreadAttribute](node: ts.JsxSpreadAttribute): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.JSXSpreadAttribute,
      argument: this.convert(node.expression)
    });
  }

  [SyntaxKind.QualifiedName](node: ts.QualifiedName): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSQualifiedName,
      left: this.convert(node.left),
      right: this.convert(node.right)
    });
  }

  // TypeScript specific

  [SyntaxKind.TypeReference](node: ts.TypeReferenceNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeReference,
      typeName: this.convertType(node.typeName),
      typeParameters: node.typeArguments
        ? this.convertTypeArgumentsToTypeParameters(node.typeArguments)
        : undefined
    });
  }

  [SyntaxKind.TypeParameter](node: ts.TypeParameterDeclaration): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeParameter,
      name: node.name.text,
      constraint: node.constraint
        ? this.convertType(node.constraint)
        : undefined,
      default: node.default ? this.convertType(node.default) : undefined
    });
  }

  [SyntaxKind.AnyKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSAnyKeyword);
  }
  [SyntaxKind.BigIntKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSBigIntKeyword);
  }
  [SyntaxKind.BooleanKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSBooleanKeyword);
  }
  [SyntaxKind.NeverKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSNeverKeyword);
  }
  [SyntaxKind.NumberKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSNumberKeyword);
  }
  [SyntaxKind.ObjectKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSObjectKeyword);
  }
  [SyntaxKind.StringKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSStringKeyword);
  }
  [SyntaxKind.SymbolKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSSymbolKeyword);
  }
  [SyntaxKind.UnknownKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSUnknownKeyword);
  }
  [SyntaxKind.VoidKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSVoidKeyword);
  }
  [SyntaxKind.UndefinedKeyword](node: ts.KeywordTypeNode): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSUndefinedKeyword);
  }

  [SyntaxKind.NonNullExpression](node: ts.NonNullExpression): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSNonNullExpression,
      expression: this.convert(node.expression)
    });
  }

  [SyntaxKind.TypeLiteral](node: ts.TypeLiteralNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeLiteral,
      members: node.members.map(el => this.convert(el))
    });
  }

  [SyntaxKind.ArrayType](node: ts.ArrayTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSArrayType,
      elementType: this.convertType(node.elementType)
    });
  }

  [SyntaxKind.IndexedAccessType](node: ts.IndexedAccessTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSIndexedAccessType,
      objectType: this.convertType(node.objectType),
      indexType: this.convertType(node.indexType)
    });
  }

  [SyntaxKind.ConditionalType](node: ts.ConditionalTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSConditionalType,
      checkType: this.convertType(node.checkType),
      extendsType: this.convertType(node.extendsType),
      trueType: this.convertType(node.trueType),
      falseType: this.convertType(node.falseType)
    });
  }

  [SyntaxKind.TypeQuery](node: ts.TypeQueryNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeQuery,
      exprName: this.convertType(node.exprName)
    });
  }

  [SyntaxKind.MappedType](node: ts.MappedTypeNode): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSMappedType,
      typeParameter: this.convertType(node.typeParameter)
    });

    if (node.readonlyToken) {
      if (node.readonlyToken.kind === SyntaxKind.ReadonlyKeyword) {
        (result as any).readonly = true;
      } else {
        (result as any).readonly = nodeUtils.getTextForTokenKind(
          node.readonlyToken.kind
        );
      }
    }

    if (node.questionToken) {
      if (node.questionToken.kind === SyntaxKind.QuestionToken) {
        (result as any).optional = true;
      } else {
        (result as any).optional = nodeUtils.getTextForTokenKind(
          node.questionToken.kind
        );
      }
    }

    if (node.type) {
      result.typeAnnotation = this.convertType(node.type);
    }
    return result;
  }

  [SyntaxKind.ParenthesizedExpression](
    node: ts.ParenthesizedExpression,
    parent: ts.Node
  ): ESTreeNode | null {
    return this.convert(node.expression, parent);
  }

  [SyntaxKind.TypeAliasDeclaration](node: ts.TypeAliasDeclaration): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSTypeAliasDeclaration,
      id: this.convert(node.name),
      typeAnnotation: this.convertType(node.type)
    });

    if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
      result.declare = true;
    }

    // Process typeParameters
    if (node.typeParameters && node.typeParameters.length) {
      (result as any).typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }

    // check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  [SyntaxKind.MethodSignature](node: ts.MethodSignature): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSMethodSignature,
      optional: nodeUtils.isOptional(node),
      computed: nodeUtils.isComputedProperty(node.name),
      key: this.convert(node.name),
      params: this.convertParameters(node.parameters),
      typeAnnotation: node.type ? this.convertTypeAnnotation(node.type) : null,
      readonly:
        nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined,
      static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
      export: nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
    });

    const accessibility = nodeUtils.getTSNodeAccessibility(node);
    if (accessibility) {
      (result as any).accessibility = accessibility;
    }

    if (node.typeParameters) {
      (result as any).typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }
    return result;
  }

  [SyntaxKind.PropertySignature](node: ts.PropertySignature): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSPropertySignature,
      optional: nodeUtils.isOptional(node) || undefined,
      computed: nodeUtils.isComputedProperty(node.name),
      key: this.convert(node.name),
      typeAnnotation: node.type
        ? this.convertTypeAnnotation(node.type)
        : undefined,
      initializer: this.convert(node.initializer) || undefined,
      readonly:
        nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined,
      static:
        nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node) || undefined,
      export: nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
    });

    const accessibility = nodeUtils.getTSNodeAccessibility(node);
    if (accessibility) {
      (result as any).accessibility = accessibility;
    }
    return result;
  }

  [SyntaxKind.IndexSignature](node: ts.IndexSignatureDeclaration): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSIndexSignature,
      index: this.convert(node.parameters[0]),
      typeAnnotation: node.type ? this.convertTypeAnnotation(node.type) : null,
      readonly:
        nodeUtils.hasModifier(SyntaxKind.ReadonlyKeyword, node) || undefined,
      static: nodeUtils.hasModifier(SyntaxKind.StaticKeyword, node),
      export: nodeUtils.hasModifier(SyntaxKind.ExportKeyword, node) || undefined
    });

    const accessibility = nodeUtils.getTSNodeAccessibility(node);
    if (accessibility) {
      (result as any).accessibility = accessibility;
    }
    return result;
  }

  [SyntaxKind.ConstructSignature](
    node: ts.ConstructSignatureDeclaration
  ): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSConstructSignature,
      params: this.convertParameters(node.parameters),
      typeAnnotation: node.type ? this.convertTypeAnnotation(node.type) : null
    });

    if (node.typeParameters) {
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }
    return result;
  }

  [SyntaxKind.InterfaceDeclaration](node: ts.InterfaceDeclaration): ESTreeNode {
    const result = this.createNode(node, {});

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
          this.ast,
          this.ast
        ) as any;
      }
      result.typeParameters = this.convertTSTypeParametersToTypeParametersDeclaration(
        node.typeParameters
      );
    }

    const hasImplementsClause = interfaceHeritageClauses.length > 0;
    const interfaceOpenBrace = nodeUtils.findNextToken(
      interfaceLastClassToken,
      this.ast,
      this.ast
    )!;

    const interfaceBody = {
      type: AST_NODE_TYPES.TSInterfaceBody,
      body: node.members.map((member: any) => this.convert(member)),
      range: [interfaceOpenBrace.getStart(this.ast), result.range[1]],
      loc: nodeUtils.getLocFor(
        interfaceOpenBrace.getStart(this.ast),
        node.end,
        this.ast
      )
    };

    Object.assign(result, {
      type: AST_NODE_TYPES.TSInterfaceDeclaration,
      body: interfaceBody,
      id: this.convert(node.name),
      heritage: hasImplementsClause
        ? interfaceHeritageClauses[0].types.map(el =>
            this.convertInterfaceHeritageClause(el)
          )
        : []
    });
    /**
     * Semantically, decorators are not allowed on interface declarations,
     * but the TypeScript compiler will parse them and produce a valid AST,
     * so we handle them here too.
     */
    if (node.decorators) {
      result.decorators = this.convertDecorators(node.decorators);
    }
    if (nodeUtils.hasModifier(SyntaxKind.AbstractKeyword, node)) {
      result.abstract = true;
    }
    if (nodeUtils.hasModifier(SyntaxKind.DeclareKeyword, node)) {
      result.declare = true;
    }
    // check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  [SyntaxKind.TypePredicate](node: ts.TypePredicateNode): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSTypePredicate,
      parameterName: this.convert(node.parameterName),
      typeAnnotation: this.convertTypeAnnotation(node.type)
    });
    /**
     * Specific fix for type-guard location data
     */
    (result as any).typeAnnotation.loc = (result as any).typeAnnotation.typeAnnotation.loc;
    (result as any).typeAnnotation.range = (result as any).typeAnnotation.typeAnnotation.range;
    return result;
  }

  [SyntaxKind.ImportType](node: ts.ImportTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSImportType,
      isTypeOf: !!node.isTypeOf,
      parameter: this.convert(node.argument),
      qualifier: this.convert(node.qualifier),
      typeParameters: node.typeArguments
        ? this.convertTypeArgumentsToTypeParameters(node.typeArguments)
        : null
    });
  }

  [SyntaxKind.EnumDeclaration](node: ts.EnumDeclaration): ESTreeNode {
    let result = this.createNode(node, {
      type: AST_NODE_TYPES.TSEnumDeclaration,
      id: this.convert(node.name),
      members: node.members.map(el => this.convert(el))
    });
    // apply modifiers first...
    this.applyModifiersToResult(result, node.modifiers);
    // ...then check for exports
    result = nodeUtils.fixExports(node, result, this.ast);
    /**
     * Semantically, decorators are not allowed on enum declarations,
     * but the TypeScript compiler will parse them and produce a valid AST,
     * so we handle them here too.
     */
    if (node.decorators) {
      result.decorators = this.convertDecorators(node.decorators);
    }
    return result;
  }

  [SyntaxKind.EnumMember](node: ts.EnumMember): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSEnumMember,
      id: this.convert(node.name)
    });
    if (node.initializer) {
      (result as any).initializer = this.convert(node.initializer);
    }
    return result;
  }

  [SyntaxKind.AbstractKeyword](
    node: ts.Token<ts.SyntaxKind.AbstractKeyword>
  ): ESTreeNode {
    return this.createSimpleNode(node, AST_NODE_TYPES.TSAbstractKeyword);
  }

  [SyntaxKind.ModuleDeclaration](node: ts.ModuleDeclaration): ESTreeNode {
    const result = this.createNode(node, {
      type: AST_NODE_TYPES.TSModuleDeclaration,
      id: this.convert(node.name)
    });
    if (node.body) {
      result.body = this.convert(node.body);
    }
    // apply modifiers first...
    this.applyModifiersToResult(result, node.modifiers);
    if (node.flags & ts.NodeFlags.GlobalAugmentation) {
      result.global = true;
    }
    // ...then check for exports
    return nodeUtils.fixExports(node, result, this.ast);
  }

  // TypeScript specific types
  [SyntaxKind.OptionalType](node: ts.OptionalTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSOptionalType,
      typeAnnotation: this.convertType(node.type)
    });
  }

  [SyntaxKind.ParenthesizedType](node: ts.ParenthesizedTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSParenthesizedType,
      typeAnnotation: this.convertType(node.type)
    });
  }

  [SyntaxKind.TupleType](node: ts.TupleTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSTupleType,
      elementTypes: node.elementTypes.map(type => this.convertType(type))
    });
  }

  [SyntaxKind.UnionType](node: ts.UnionTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSUnionType,
      types: node.types.map(type => this.convertType(type))
    });
  }

  [SyntaxKind.IntersectionType](node: ts.IntersectionTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSIntersectionType,
      types: node.types.map(type => this.convertType(type))
    });
  }

  [SyntaxKind.RestType](node: ts.RestTypeNode): ESTreeNode {
    return this.createNode(node, {
      type: AST_NODE_TYPES.TSRestType,
      typeAnnotation: this.convertType(node.type)
    });
  }
}
