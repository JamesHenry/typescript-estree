'use strict';

const path = require('path');
const fs = require('fs');
const ts = require('typescript');

//------------------------------------------------------------------------------
// Environment calculation
//------------------------------------------------------------------------------

/**
 * Maps tsconfig paths to their corresponding file contents and resulting watches
 * @type {Map<string, ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>>}
 */
const knownWatchProgramMap = new Map();

/**
 * Appropriately report issues found when reading a config file
 * @param {ts.Diagnostic} diagnostic The diagnostic raised when creating a program
 * @returns {void}
 */
function diagnosticReporter(diagnostic) {
  throw new Error(
    ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine)
  );
}

const noopFileWatcher = { close: () => {} };

/**
 * Calculate project environments using options provided by eslint and paths from config
 * @param {string} code The code being linted
 * @param {Object} options Options provided by ESLint core
 * @param {string} options.cwd The current working directory for the eslint process
 * @param {string} options.filePath The path of the file being parsed
 * @param {Object} extra Validated parser options
 * @param {string[]} extra.project Provided tsconfig paths
 * @returns {ts.Program[]} The programs corresponding to the supplied tsconfig paths
 */
module.exports = function calculateProjectParserOptions(code, options, extra) {
  const results = [];
  const cwd = options.cwd || process.cwd();

  for (let tsconfigPath of extra.project) {
    if (!path.isAbsolute(tsconfigPath)) {
      tsconfigPath = path.join(cwd, tsconfigPath);
    }

    const existingWatch = knownWatchProgramMap.get(tsconfigPath);

    if (typeof existingWatch !== 'undefined') {
      results.push(existingWatch.getProgram().getProgram());
      continue;
    }

    const watchCompilerHost = ts.createWatchCompilerHost(
      tsconfigPath,
      /*optionsToExtend*/ undefined,
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      diagnosticReporter,
      /*reportWatchStatus*/ () => {}
    );
    const oldReadFile = watchCompilerHost.readFile;
    watchCompilerHost.readFile = (filePath, encoding) =>
      path.normalize(filePath) === path.normalize(options.filePath)
        ? code
        : oldReadFile(filePath, encoding);
    watchCompilerHost.onUnRecoverableConfigFileDiagnostic = diagnosticReporter;
    watchCompilerHost.afterProgramCreate = undefined;
    watchCompilerHost.watchFile = () => noopFileWatcher;
    watchCompilerHost.watchDirectory = () => noopFileWatcher;

    const programWatch = ts.createWatchProgram(watchCompilerHost);
    const program = programWatch.getProgram().getProgram();

    const configFileDiagnostics = program.getConfigFileParsingDiagnostics();
    if (configFileDiagnostics.length > 0) {
      diagnosticReporter(configFileDiagnostics[0]);
    }

    knownWatchProgramMap.set(tsconfigPath, programWatch);
    results.push(program);
  }

  return results;
};
