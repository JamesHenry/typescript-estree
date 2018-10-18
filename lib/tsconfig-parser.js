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
 * Maps file paths to their set of corresponding watch callbacks
 * There may be more than one per file if a file is shared between projects
 * @type {Map<string, ts.FileWatcherCallback>}
 */
const watchCallbackTrackingMap = new Map();

/**
 * Holds information about the file currently being linted
 * @type {{code: string, filePath: string}}
 */
const currentLintOperationState = {
  code: '',
  filePath: ''
};

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

  // preserve reference to code and file being linted
  currentLintOperationState.code = code;
  currentLintOperationState.filePath = options.filePath;

  // Update file version if necessary
  // TODO: only update when necessary, currently marks as changed on every lint
  const watchCallback = watchCallbackTrackingMap.get(options.filePath);
  if (typeof watchCallback !== 'undefined') {
    watchCallback(options.filePath, ts.FileWatcherEventKind.Changed);
  }

  for (let tsconfigPath of extra.project) {
    // if absolute paths aren't provided, make relative to cwd
    if (!path.isAbsolute(tsconfigPath)) {
      tsconfigPath = path.join(cwd, tsconfigPath);
    }

    const existingWatch = knownWatchProgramMap.get(tsconfigPath);

    if (typeof existingWatch !== 'undefined') {
      // get new program (updated if necessary)
      results.push(existingWatch.getProgram().getProgram());
      continue;
    }

    // create compiler host
    const watchCompilerHost = ts.createWatchCompilerHost(
      tsconfigPath,
      /*optionsToExtend*/ undefined,
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      diagnosticReporter,
      /*reportWatchStatus*/ () => {}
    );

    // ensure readFile reads the code being linted instead of the copy on disk
    const oldReadFile = watchCompilerHost.readFile;
    watchCompilerHost.readFile = (filePath, encoding) =>
      path.normalize(filePath) ===
      path.normalize(currentLintOperationState.filePath)
        ? currentLintOperationState.code
        : oldReadFile(filePath, encoding);

    // ensure process reports error on failure instead of exiting process immediately
    watchCompilerHost.onUnRecoverableConfigFileDiagnostic = diagnosticReporter;

    // ensure process doesn't emit programs
    watchCompilerHost.afterProgramCreate = undefined;

    // register callbacks to trigger program updates without using fileWatchers
    watchCompilerHost.watchFile = (fileName, callback) => {
      const normalizedFileName = path.normalize(fileName);
      watchCallbackTrackingMap.set(normalizedFileName, callback);
      return {
        close: () => {
          watchCallbackTrackingMap.delete(normalizedFileName);
        }
      };
    };

    // ensure fileWatchers aren't created for directories
    watchCompilerHost.watchDirectory = () => noopFileWatcher;

    // create program
    const programWatch = ts.createWatchProgram(watchCompilerHost);
    const program = programWatch.getProgram().getProgram();

    // report error if there are any errors in the config file
    const configFileDiagnostics = program.getConfigFileParsingDiagnostics();
    if (configFileDiagnostics.length > 0) {
      diagnosticReporter(configFileDiagnostics[0]);
    }

    // cache watch program and return current program
    knownWatchProgramMap.set(tsconfigPath, programWatch);
    results.push(program);
  }

  return results;
};
