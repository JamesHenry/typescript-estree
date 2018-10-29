"use strict";

const path = require("path");
const fs = require("fs");
const ts = require("typescript");

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
        return undefined;
    }

    // Parse tsconfig and create program
    let tsconfigContents;
    try {
        tsconfigContents = fs.readFileSync(tsconfigPath, "utf8");
    } catch (e) {
        // if can't read file, return
        return undefined;
    }

    const tsconfigParseResult = ts.parseJsonText(
        tsconfigPath,
        tsconfigContents
    );

    return ts.parseJsonConfigFileContent(
        tsconfigParseResult,
        ts.sys,
        path.dirname(tsconfigPath),
        /* existingOptions */ {},
        tsconfigPath
    );
}

/**
 * Calculate project environment using options provided by eslint
 * @param {Object} options Options provided by ESLint core
 * @param {string} options.cwd The current working directory for the eslint process
 * @returns {ts.Program|undefined} The program defined by the tsconfig.json in the cwd, or null if something went wrong
 */
module.exports = function calculateProjectParserOptions(options) {
    // if no cwd passed, return
    const cwd = options.cwd || process.cwd();

    const tsconfigPath = path.join(cwd, "tsconfig.json");
    const parsedCommandLine = parseTSConfig(tsconfigPath);

    if (parsedCommandLine === null) {
        return undefined;
    }

    return ts.createProgram(
        parsedCommandLine.fileNames,
        parsedCommandLine.options,
        ts.createCompilerHost(parsedCommandLine.options, /* setParentNodes */ true)
    );
};
