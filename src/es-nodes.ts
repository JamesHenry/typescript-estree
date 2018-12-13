import * as es from 'estree';

export type ESNode =  // Eslint
  | es.Node
  | es.Function
  | es.Statement
  | es.Declaration
  | es.Expression
  | es.Pattern
  | es.ModuleDeclaration
  | es.ModuleSpecifier
  // Es
  | es.ClassProperty
  | es.Decorator
  // Custom
  | es.DeclareFunction // TSDeclareFunction
  | es.TSTypeParameter
  | es.TSTypeParameterDeclaration
  | es.TSAbstractKeyword
  | es.TSModuleDeclaration
  | es.TSExportAssignment
  | es.TSEnumMember
  | es.TSEnumDeclaration
  | es.TSInterfaceHeritage
  | es.TSTypePredicate
  | es.TSQualifiedName
  | es.TSImportType
  | es.TSNullKeyword
  | es.ImportKeyword
  | es.TSAbstractClassProperty;
