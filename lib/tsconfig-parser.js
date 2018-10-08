'use strict';

const path = require('path');
const fs = require('fs');
const ts = require('typescript');

//------------------------------------------------------------------------------
// Environment calculation
//------------------------------------------------------------------------------

/**
 * Create object representation of TypeScript configuration
 * @param {string} tsconfigPath Full path to tsconfig.json
 * @returns {{options: Object, fileNames: string[]}|null} Representation of parsed tsconfig.json
 */
function parseTSConfig(tsconfigPath) {
  // if no tsconfig in cwd, return
  if (!fs.existsSync(tsconfigPath)) {
    return null;
  }

  // Parse tsconfig and create program
  let tsconfigContents = '';
  try {
    tsconfigContents = fs.readFileSync(tsconfigPath, 'utf8');
  } catch (e) {
    // if can't read file, return
    return null;
  }

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
    if (!path.isAbsolute(tsconfigPath)) {
      tsconfigPath = path.join(cwd, tsconfigPath);
    }

    const parsedCommandLine = parseTSConfig(tsconfigPath);

    if (parsedCommandLine === null) {
      continue;
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

    results.push(
      ts.createProgram(
        parsedCommandLine.fileNames,
        parsedCommandLine.options,
        compilerHost
      )
    );
  }

  return results;
};
