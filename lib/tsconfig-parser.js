'use strict';

const path = require('path');
const fs = require('fs');
const ts = require('typescript');

//------------------------------------------------------------------------------
// Environment calculation
//------------------------------------------------------------------------------

/**
 * Maps tsconfig paths to their corresponding file contents and resulting programs
 * TODO: Have some sort of cache eviction system to prevent unbounded cache size
 * @type {Map<string, {text: string, program: ts.Program}>}
 */
const programCache = new Map();

/**
 * Create object representation of TypeScript configuration
 * @param {string} tsconfigPath Full path to tsconfig.json
 * @returns {string|null} Representation of parsed tsconfig.json
 */
function readTSConfigText(tsconfigPath) {
  // if no tsconfig in cwd, return
  if (!fs.existsSync(tsconfigPath)) {
    return null;
  }

  try {
    return fs.readFileSync(tsconfigPath, 'utf8');
  } catch (e) {
    // if can't read file, return
    return null;
  }
}

/**
 * Parses contents of tsconfig.json to a set of compiler options
 * @param {string} tsconfigPath Full path to tsconfig.json
 * @param {string} tsconfigContents Contents of tsconfig.json
 * @returns {ts.ParsedCommandLine} TS compiler options
 */
function parseTSCommandLine(tsconfigPath, tsconfigContents) {
  const tsconfigParseResult = ts.parseJsonText(tsconfigPath, tsconfigContents);

  return ts.parseJsonConfigFileContent(
    tsconfigParseResult,
    ts.sys,
    path.dirname(tsconfigPath),
    /* existingOptions */ {},
    tsconfigPath
  );
}

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
    let oldProgram = undefined;

    if (!path.isAbsolute(tsconfigPath)) {
      tsconfigPath = path.join(cwd, tsconfigPath);
    }

    const tsconfigContents = readTSConfigText(tsconfigPath);

    if (tsconfigContents === null) {
      throw new Error(`Could not read provided tsconfig.json: ${tsconfigPath}`);
    }
    const cachedProgramAndText = programCache.get(tsconfigPath);

    if (cachedProgramAndText) {
      if (cachedProgramAndText.text === tsconfigContents) {
        results.push(cachedProgramAndText.program);
        continue;
      }
      oldProgram = cachedProgramAndText.program;
    }
    const parsedCommandLine = parseTSCommandLine(
      tsconfigPath,
      tsconfigContents
    );

    if (parsedCommandLine.errors.length > 0) {
      throw new Error(`Parsing ${tsconfigPath} resulted in errors.`);
    }

    const compilerHost = ts.createCompilerHost(
      parsedCommandLine.options,
      /* setParentNodes */ true
    );
    const oldGetSourceFile = compilerHost.getSourceFile;
    compilerHost.getSourceFile = (
      filename,
      languageVersion,
      onError,
      shouldCreateNewFile
    ) =>
      path.normalize(filename) === path.normalize(options.filePath)
        ? ts.createSourceFile(filename, code, languageVersion, true)
        : oldGetSourceFile(
            filename,
            languageVersion,
            onError,
            shouldCreateNewFile
          );

    const program = ts.createProgram(
      parsedCommandLine.fileNames,
      parsedCommandLine.options,
      compilerHost,
      oldProgram
    );

    results.push(program);
    programCache.set(tsconfigPath, { text: tsconfigContents, program });
  }

  return results;
};
