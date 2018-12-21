/**
 * @fileoverview Tests for TypeScript-specific constructs
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */
import path from 'path';
import shelljs from 'shelljs';
import * as parser from '../../src/parser';
// import { ParserOptions } from '../../src/temp-types-based-on-js-source';
// import { createSnapshotTestBlock } from '../../tools/test-utils';

//------------------------------------------------------------------------------
// Setup
//------------------------------------------------------------------------------

/**
 * Process all fixtures, we will only snapshot the ones that have semantic errors
 * which are ignored by default parsing logic.
 */
const FIXTURES_DIR = './tests/fixtures/';

const testFiles = shelljs
  .find(FIXTURES_DIR)
  .filter(filename => filename.includes('.src.'))
  .map(filename => filename.substring(FIXTURES_DIR.length - 2));

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe('Parse all fixtures with "errorOnTypeScriptSyntaticAndSemanticIssues" enabled', () => {
  testFiles.forEach(filename => {
    const code = shelljs.cat(`${path.resolve(FIXTURES_DIR, filename)}`);
    const config = {
      loc: true,
      range: true,
      tokens: true,
      errorOnUnknownASTType: true,
      errorOnTypeScriptSyntaticAndSemanticIssues: false
    };
    it(`fixtures/${filename}.src`, () => {
      expect.assertions(1);
      try {
        parser.parseAndGenerateServices(code, config);
        expect(
          'TEST OUTPUT: No semantic or syntactic issues found'
        ).toMatchSnapshot();
      } catch (err) {
        expect(err).toMatchSnapshot();
      }
    });
  });
});
