import 'estree';
import { AST_NODE_TYPES } from '../ast-node-types';

declare module 'estree' {
  export interface BaseTypeAnnotationNode extends BaseNode {
    typeAnnotation?: TSTypeAnnotation;
  }

  export interface BaseTypeParametersNode extends BaseNode {
    typeParameters?: TSTypeParameterDeclaration;
  }

  export interface BaseReturnTypeNode extends BaseNode {
    returnType?: TSTypeParameterDeclaration;
  }

  export interface BaseDecoratedNode extends BaseNode {
    decorators?: Decorator[];
  }

  export interface BaseClassProperty
    extends BaseNode,
      BaseTypeAnnotationNode,
      BaseDecoratedNode {
    type: AST_NODE_TYPES.ClassProperty | AST_NODE_TYPES.TSAbstractClassProperty;
    key: Identifier | Literal; // TODO:??
    value: Expression;
    computed: boolean;
    static: boolean;
    readonly?: boolean;
    optional?: boolean;
    definite?: boolean;
    accessibility?: 'public' | 'protected' | 'private';
  }

  // overrides
  export interface ForOfStatement {
    await?: boolean;
  }

  export interface VariableDeclarator {
    definite?: true;
  }

  export interface Identifier
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface ObjectPattern
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface ArrayPattern
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface RestElement
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface AssignmentPattern
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface MemberExpression
    extends BaseTypeAnnotationNode,
      BaseDecoratedNode {}

  export interface ArrowFunctionExpression extends BaseTypeParametersNode {
    returnType?: TSTypeParameterDeclaration;
  }

  export interface SimpleCallExpression extends BaseTypeParametersNode {}

  export interface NewExpression extends BaseTypeParametersNode {}

  export interface FunctionExpression
    extends BaseTypeParametersNode,
      BaseReturnTypeNode {
    expression: boolean;
  }

  export interface FunctionDeclaration extends BaseReturnTypeNode {
    expression: boolean;
  }

  export interface DeclareFunction  // TSDeclareFunction
    extends BaseFunction,
      BaseReturnTypeNode,
      BaseDeclaration {
    type: AST_NODE_TYPES.DeclareFunction;
    id: Identifier | null;
    expression: boolean;
  }

  export interface ClassImplements extends BaseNode, BaseTypeParametersNode {
    type: AST_NODE_TYPES.ClassImplements;
    id: Identifier;
  }

  /**
   * Any type annotation.
   */
  export interface TSTypeAnnotation extends BaseNode {
    type: AST_NODE_TYPES.TSTypeAnnotation;
    typeAnnotation: TSTypeAnnotation;
  }

  /**
   * @see https://github.com/estree/estree/blob/master/experimental/decorators.md
   */
  export interface Decorator extends BaseNode {
    type: AST_NODE_TYPES.Decorator;
    expression: Expression;
  }

  export interface ClassProperty extends BaseClassProperty {
    type: AST_NODE_TYPES.ClassProperty;
  }

  export interface TSAbstractClassProperty extends BaseClassProperty {
    type: AST_NODE_TYPES.TSAbstractClassProperty;
  }

  export interface TSTypeParameter extends BaseNode {
    type: AST_NODE_TYPES.TSTypeParameter;
    name: string;
    constraint?: any; // TODO
    default?: any; // TODO
  }

  export interface TSTypeParameterDeclaration extends BaseNode {
    type: AST_NODE_TYPES.TSTypeParameterDeclaration;
    params: TSTypeParameter[];
  }

  export interface TSAbstractKeyword extends BaseNode {
    type: AST_NODE_TYPES.TSAbstractKeyword;
  }

  export interface TSModuleDeclaration extends BaseModuleDeclaration {
    type: AST_NODE_TYPES.TSModuleDeclaration;
    id: Identifier | Literal;
    body?: any; // TODO
    global?: boolean;
  }

  export interface TSExportAssignment extends BaseNode {
    type: AST_NODE_TYPES.TSExportAssignment;
    expression: Expression;
  }

  export interface TSEnumMember extends BaseNode {
    type: AST_NODE_TYPES.TSEnumMember;
    id: Identifier | Literal | Property;
    initializer?: Expression;
  }

  export interface TSEnumDeclaration extends BaseNode {
    type: AST_NODE_TYPES.TSEnumDeclaration;
    id: Identifier;
    members: TSEnumMember[];
    decorators?: Decorator[];
  }

  export interface TSTypePredicate extends BaseNode {
    type: AST_NODE_TYPES.TSTypePredicate;
    parameterName: TSTypeParameterDeclaration;
    typeAnnotation: TSTypeAnnotation;
  }

  export interface TSInterfaceHeritage
    extends BaseNode,
      BaseTypeParametersNode {
    type: AST_NODE_TYPES.TSInterfaceHeritage;
    id: Identifier | null;
  }

  export interface TSQualifiedName extends BaseNode {
    type: AST_NODE_TYPES.TSQualifiedName;
    left: Identifier | TSQualifiedName;
    right: Identifier;
  }

  export interface TSImportType extends BaseNode, BaseTypeParametersNode {
    type: AST_NODE_TYPES.TSImportType;
    isTypeOf: boolean;
    parameter: any; // TODO
    qualifier?: Identifier | TSQualifiedName;
  }

  export interface TSNullKeyword extends BaseNode {
    type: AST_NODE_TYPES.TSNullKeyword;
  }

  export interface ImportKeyword extends BaseNode {
    type: AST_NODE_TYPES.Import;
  }
}
