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
import { ESTreeNode } from './temp-types-based-on-js-source';

const SyntaxKind = ts.SyntaxKind;

export interface ConvertAdditionalOptions {
  errorOnUnknownASTType: boolean;
  useJSXTextNode: boolean;
  shouldProvideParserServices: boolean;
}

export abstract class AbstractConverter {
  protected ast: ts.SourceFile;
  protected additionalOptions: ConvertAdditionalOptions;
  public esTreeNodeToTSNodeMap = new WeakMap();
  public tsNodeToESTreeNodeMap = new WeakMap();

  [key: number]: (
    node: any,
    parent: ts.Node,
    inTypeMode?: boolean
  ) => ESTreeNode | null;

  constructor(ast: ts.SourceFile, additionalOptions: ConvertAdditionalOptions) {
    this.ast = ast;
    this.additionalOptions = additionalOptions;
  }

  public convertAll(node: ts.SourceFile) {
    return this.convert(node);
  }

  public getASTMaps() {
    return {
      esTreeNodeToTSNodeMap: this.esTreeNodeToTSNodeMap,
      tsNodeToESTreeNodeMap: this.tsNodeToESTreeNodeMap
    };
  }

  /**
   * Converts a TypeScript node into an ESTree node.
   * @param {ts.Node} node the child ts.Node
   * @param {ts.Node} parent parentNode
   * @returns {ESTreeNode|null} the converted ESTree node
   */
  protected convertChildType(node?: ts.Node): ESTreeNode | null {
    return this.convert(node, undefined, true);
  }

  /**
   * Converts a TypeScript node into an ESTree node.
   * @param {ts.Node} node the child ts.Node
   * @param {ts.Node} parent parentNode
   * @returns {ESTreeNode|null} the converted ESTree node
   */
  protected convertChild(node?: ts.Node): ESTreeNode | null {
    return this.convert(node, undefined, false);
  }

  protected convert(
    node?: ts.Node,
    parent?: ts.Node,
    inTypeMode?: boolean
  ): ESTreeNode | null {
    if (!node) {
      return null;
    }

    let result: ESTreeNode | null = null;

    if (node.kind in this) {
      result = this[node.kind].call(
        this,
        node,
        parent || node.parent,
        inTypeMode
      );
    } else {
      result = this.deeplyCopy(node);
    }

    if (result && this.additionalOptions.shouldProvideParserServices) {
      this.tsNodeToESTreeNodeMap.set(node, result);
      this.esTreeNodeToTSNodeMap.set(result, node);
    }
    return result;
  }

  getRange(node: ts.Node): [number, number] {
    return [node.getStart(this.ast), node.getEnd()];
  }

  createNode(node: ts.Node, data: any): ESTreeNode {
    const result: ESTreeNode = data;
    if (!result.range) {
      result.range = this.getRange(node);
    }
    if (!result.loc) {
      result.loc = nodeUtils.getLoc(node, this.ast);
    }

    return result;
  }

  /**
   * Converts a ts.Node's typeArguments ts.NodeArray to a flow-like typeParameters node
   * @param {ts.NodeArray<any>} typeArguments ts.Node typeArguments
   * @returns {ESTreeNode} TypeParameterInstantiation node
   */
  convertTypeArgumentsToTypeParameters(
    typeArguments: ts.NodeArray<any>
  ): ESTreeNode {
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
          this.ast,
          this.ast
        );
        end = greaterThanToken!.end;
      }
    }
    return {
      type: AST_NODE_TYPES.TSTypeParameterInstantiation,
      range: [start, end],
      loc: nodeUtils.getLocFor(start, end, this.ast),
      params: typeArguments.map(typeArgument =>
        this.convertChildType(typeArgument)
      )
    };
  }

  createSimpleNode(node: ts.Node, tsPrefix: boolean): ESTreeNode {
    if (tsPrefix) {
      return this.createNode(node, {
        type: AST_NODE_TYPES[`TS${SyntaxKind[node.kind]}`]
      });
    }

    return this.createNode(node, {
      type: AST_NODE_TYPES[`${SyntaxKind[node.kind]}`]
    });
  }

  /**
   * Converts a ts.Node's typeParameters ts.ts.NodeArray to a flow-like TypeParameterDeclaration node
   * @param {ts.NodeArray} typeParameters ts.Node typeParameters
   * @returns {ESTreeNode} TypeParameterDeclaration node
   */
  convertTSTypeParametersToTypeParametersDeclaration(
    typeParameters: ts.NodeArray<any>
  ): ESTreeNode {
    const firstTypeParameter = typeParameters[0];
    const lastTypeParameter = typeParameters[typeParameters.length - 1];

    const greaterThanToken = nodeUtils.findNextToken(
      lastTypeParameter,
      this.ast,
      this.ast
    );

    return {
      type: AST_NODE_TYPES.TSTypeParameterDeclaration,
      range: [firstTypeParameter.pos - 1, greaterThanToken!.end],
      loc: nodeUtils.getLocFor(
        firstTypeParameter.pos - 1,
        greaterThanToken!.end,
        this.ast
      ),
      params: typeParameters.map(typeParameter =>
        this.convertChildType(typeParameter)
      )
    };
  }

  /**
   * Coverts body ExpressionStatements to directives
   */
  convertBodyExpressionsToDirectives(
    node: ts.Node,
    body: (ESTreeNode | null)[]
  ) {
    if (body && nodeUtils.canContainDirective(node)) {
      const unique: string[] = [];

      // directives has to be unique, if directive is registered twice pick only first one
      body
        .filter(
          child =>
            child &&
            child.type === AST_NODE_TYPES.ExpressionStatement &&
            child.expression &&
            child.expression.type === AST_NODE_TYPES.Literal &&
            (child.expression as any).value &&
            typeof (child.expression as any).value === 'string'
        )
        .forEach(child => {
          if (!unique.includes((child!.expression as any).raw)) {
            child!.directive = (child!.expression as any).raw.slice(1, -1);
            unique.push((child!.expression as any).raw);
          }
        });
    }
    return body;
  }

  /**
   * Converts a child into a type annotation. This creates an intermediary
   * TypeAnnotation node to match what Flow does.
   * @param {ts.TypeNode} child The TypeScript AST node to convert.
   * @returns {ESTreeNode} The type annotation node.
   */
  convertTypeAnnotation(child: ts.TypeNode): ESTreeNode {
    const annotationStartCol = child.getFullStart() - 1;
    return {
      type: AST_NODE_TYPES.TSTypeAnnotation,
      loc: nodeUtils.getLocFor(annotationStartCol, child.end, this.ast),
      range: [annotationStartCol, child.end],
      typeAnnotation: this.convertChildType(child as any)
    };
  }

  /**
   * Converts an array of ts.Node parameters into an array of ESTreeNode params
   * @param  {ts.NodeArray<ts.Node>} parameters An array of ts.Node params to be converted
   * @returns {ESTreeNode[]}       an array of converted ESTreeNode params
   */
  convertParameters(parameters: ts.NodeArray<ts.Node>): ESTreeNode[] {
    if (!parameters || !parameters.length) {
      return [];
    }
    return parameters.map(param => {
      const convertedParam = this.convertChild(param) as ESTreeNode;
      if (!param.decorators || !param.decorators.length) {
        return convertedParam;
      }
      return Object.assign(convertedParam, {
        decorators: this.convertDecorators(param.decorators)
      });
    });
  }

  /**
   * Converts a ts.NodeArray of ts.Decorators into an array of ESTreeNode decorators
   * @param  {ts.NodeArray<ts.Decorator>} decorators A ts.NodeArray of ts.Decorators to be converted
   * @returns {ESTreeNode[]}       an array of converted ESTreeNode decorators
   */
  convertDecorators(decorators: ts.NodeArray<ts.Decorator>): ESTreeNode[] {
    if (!decorators || !decorators.length) {
      return [];
    }
    return decorators.map(decorator => {
      return this.createNode(decorator, {
        type: AST_NODE_TYPES.Decorator,
        expression: this.convertChild(decorator.expression)
      });
    });
  }

  /**
   * Converts a child into a interface heritage node.
   * @param {ts.ExpressionWithTypeArguments} child The TypeScript AST node to convert.
   * @returns {ESTreeNode} The type annotation node.
   */
  convertInterfaceHeritageClause(
    child: ts.ExpressionWithTypeArguments
  ): ESTreeNode {
    const id = this.convertChild(child.expression) as ESTreeNode;
    const classImplementsNode: ESTreeNode = {
      type: AST_NODE_TYPES.TSInterfaceHeritage,
      loc: id.loc,
      range: id.range,
      id
    };

    if (child.typeArguments && child.typeArguments.length) {
      classImplementsNode.typeParameters = this.convertTypeArgumentsToTypeParameters(
        child.typeArguments
      );
    }
    return classImplementsNode;
  }

  /**
   * Uses the current TSNode's end location for its `type` to adjust the location data of the given
   * ESTreeNode, which should be the parent of the final typeAnnotation node
   * @param {ts.Node} node Node to be fixed
   * @param {ESTreeNode} typeAnnotationParent The node that will have its location data mutated
   * @returns {void}
   */
  fixTypeAnnotationParentLocation(
    node: ts.Node,
    typeAnnotationParent: ESTreeNode
  ): void {
    typeAnnotationParent.range[1] = (node as any).type.getEnd();
    typeAnnotationParent.loc = nodeUtils.getLocFor(
      typeAnnotationParent.range[0],
      typeAnnotationParent.range[1],
      this.ast
    );
  }

  /**
   * Converts a TypeScript JSX node.tagName into an ESTree node.name
   * @param {ts.Node} node Node to be processed
   * @param {ts.JsxTagNameExpression} tagName  the tagName object from a JSX ts.Node
   * @returns {Object}    the converted ESTree name object
   */
  convertTypeScriptJSXTagNameToESTreeName(
    node: ts.Node,
    tagName: ts.JsxTagNameExpression
  ): ESTreeNode {
    const tagNameToken = nodeUtils.convertToken(tagName, this.ast);

    if (tagNameToken.type === AST_NODE_TYPES.JSXMemberExpression) {
      const isNestedMemberExpression =
        (node as any).tagName.expression.kind ===
        SyntaxKind.PropertyAccessExpression;

      // Convert TSNode left and right objects into ESTreeNode object
      // and property objects
      tagNameToken.object = this.convert(
        (node as any).tagName.expression,
        node
      );
      tagNameToken.property = this.convert((node as any).tagName.name, node);

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
   * @returns {void} the current result object will be mutated
   * @deprecated
   */
  applyModifiersToResult(
    result: ESTreeNode,
    modifiers?: ts.ModifiersArray
  ): void {
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
    result.modifiers = remainingModifiers.map(el => this.convertChild(el));
  }

  /**
   * Converts a child into a class implements node. This creates an intermediary
   * ClassImplements node to match what Flow does.
   * @param {ts.ExpressionWithTypeArguments} child The TypeScript AST node to convert.
   * @returns {ESTreeNode} The type annotation node.
   */
  convertClassImplements(child: ts.ExpressionWithTypeArguments): ESTreeNode {
    const id = this.convertChild(child.expression) as ESTreeNode;
    const classImplementsNode: ESTreeNode = {
      type: AST_NODE_TYPES.ClassImplements,
      loc: id.loc,
      range: id.range,
      id
    };
    if (child.typeArguments && child.typeArguments.length) {
      classImplementsNode.typeParameters = this.convertTypeArgumentsToTypeParameters(
        child.typeArguments
      );
    }
    return classImplementsNode;
  }

  /**
   * For nodes that are copied directly from the TypeScript AST into
   * ESTree mostly as-is. The only difference is the addition of a type
   * property instead of a kind property. Recursively copies all children.
   * @returns {void}
   * @deprecated
   */
  deeplyCopy(node: ts.Node): ESTreeNode {
    const customType = `TS${SyntaxKind[node.kind]}`;
    /**
     * If the "errorOnUnknownASTType" option is set to true, throw an error,
     * otherwise fallback to just including the unknown type as-is.
     */
    if (
      this.additionalOptions.errorOnUnknownASTType &&
      !AST_NODE_TYPES[customType]
    ) {
      throw new Error(`Unknown AST_NODE_TYPE: "${customType}"`);
    }
    const result = this.createNode(node, {
      type: customType
    });

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
            ? this.convertTypeAnnotation((node as any).type)
            : null;
        } else if (key === 'typeArguments') {
          result.typeParameters = (node as any).typeArguments
            ? this.convertTypeArgumentsToTypeParameters(
                (node as any).typeArguments
              )
            : null;
        } else if (key === 'typeParameters') {
          result.typeParameters = (node as any).typeParameters
            ? this.convertTSTypeParametersToTypeParametersDeclaration(
                (node as any).typeParameters
              )
            : null;
        } else if (key === 'decorators') {
          const decorators = this.convertDecorators((node as any).decorators);
          if (decorators && decorators.length) {
            result.decorators = decorators;
          }
        } else {
          if (Array.isArray((node as any)[key])) {
            (result as any)[key] = (node as any)[key].map((el: any) =>
              this.convertChild(el)
            );
          } else if (
            (node as any)[key] &&
            typeof (node as any)[key] === 'object' &&
            (node as any)[key].kind
          ) {
            // need to check node[key].kind to ensure we don't try to convert a symbol
            (result as any)[key] = this.convertChild((node as any)[key]);
          } else {
            (result as any)[key] = (node as any)[key];
          }
        }
      });
    return result;
  }
}
