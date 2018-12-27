import ts from 'typescript';

export function getFirstSemanticOrSyntacticError(
  program: ts.Program,
  ast: ts.SourceFile
): ts.Diagnostic | undefined {
  const supportedSyntacticDiagnostics = whitelistSupportedErrors(
    program.getSyntacticDiagnostics(ast)
  );
  if (supportedSyntacticDiagnostics.length) {
    return supportedSyntacticDiagnostics[0];
  }
  const supportedSemanticDiagnostics = whitelistSupportedErrors(
    program.getSemanticDiagnostics(ast)
  );
  if (supportedSemanticDiagnostics.length) {
    return supportedSemanticDiagnostics[0];
  }
  return undefined;
}

function whitelistSupportedErrors(
  diagnostics: ReadonlyArray<ts.DiagnosticWithLocation | ts.Diagnostic>
): ReadonlyArray<ts.DiagnosticWithLocation | ts.Diagnostic> {
  return diagnostics.filter(() => false);
}
