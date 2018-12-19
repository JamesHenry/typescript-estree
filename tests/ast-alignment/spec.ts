import fs from 'fs';
import { tester } from './fixtures-to-test';
import { parse } from './parse';
import * as parseUtils from './utils';

describe('Babel', () => {
  tester.getForBabel().forEach(fixture => {
    const filename = fixture.filename;
    const source = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');

    /**
     * Parse with typescript-estree
     */
    const typeScriptESTreeResult = parse(source, {
      parser: 'typescript-estree'
    });

    /**
     * Parse the source with @babel/parser typescript-plugin
     */
    const babelParserResult = parse(source, {
      parser: '@babel/parser'
    });

    /**
     * If babel fails to parse the source, ensure that typescript-estree has the same fundamental issue
     */
    if (babelParserResult.parseError) {
      /**
       * FAIL: babel errored but typescript-estree did not
       */
      if (!typeScriptESTreeResult.parseError) {
        it(`TEST FAIL [BABEL ERRORED, BUT TSEP DID NOT] - ${filename}`, () => {
          expect(typeScriptESTreeResult.parseError).toEqual(
            babelParserResult.parseError
          );
        });
        return;
      }
      /**
       * Both parsers errored - this is OK as long as the errors are of the same "type"
       */
      it(`[Both parsers error as expected] - ${filename}`, () => {
        expect(babelParserResult.parseError.name).toEqual(
          typeScriptESTreeResult.parseError.name
        );
      });
      return;
    }

    /**
     * FAIL: typescript-estree errored but babel did not
     */
    if (typeScriptESTreeResult.parseError) {
      it(`TEST FAIL [TSEP ERRORED, BUT BABEL DID NOT] - ${filename}`, () => {
        expect(babelParserResult.parseError).toEqual(
          typeScriptESTreeResult.parseError
        );
      });
      return;
    }

    /**
     * No errors, assert the two ASTs match
     */
    it(`Babel: ${filename}`, () => {
      expect(babelParserResult.ast).toBeTruthy();
      expect(typeScriptESTreeResult.ast).toBeTruthy();

      /**
       * Perform some extra formatting steps on the babel AST before comparing
       */
      expect(
        parseUtils.removeLocationDataAndSourceTypeFromProgramNode(
          parseUtils.preprocessBabylonAST(babelParserResult.ast),
          fixture.ignoreSourceType
        )
      ).toEqual(
        parseUtils.removeLocationDataAndSourceTypeFromProgramNode(
          typeScriptESTreeResult.ast,
          fixture.ignoreSourceType
        )
      );
    });
  });
});

describe('Espree', () => {
  tester.getForEspree().forEach(fixture => {
    const filename = fixture.filename;
    const source = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');

    /**
     * Parse with typescript-estree
     */
    const typeScriptESTreeResult = parse(source, {
      parser: 'typescript-estree'
    });

    /**
     * Parse the source with espree
     */
    const espreeParserResult = parse(source, {
      parser: 'espree'
    });

    /**
     * If espree fails to parse the source, ensure that typescript-estree has the same fundamental issue
     */
    if (espreeParserResult.parseError) {
      /**
       * FAIL: espree errored but typescript-estree did not
       */
      if (!typeScriptESTreeResult.parseError) {
        return;
      }
      /**
       * Both parsers errored - this is OK as long as the errors are of the same "type"
       */
      it(`[Both parsers error as expected] - ${filename}`, () => {
        expect(espreeParserResult.parseError.name).toEqual(
          typeScriptESTreeResult.parseError.name
        );
      });
      return;
    }

    /**
     * FAIL: typescript-estree errored but espree did not
     */
    if (typeScriptESTreeResult.parseError) {
      it(`TEST FAIL [TSEP ERRORED, BUT ESPREE DID NOT] - ${filename}`, () => {
        expect(espreeParserResult.parseError).toEqual(
          typeScriptESTreeResult.parseError
        );
      });
      return;
    }

    /**
     * No errors, assert the two ASTs match
     */
    it(`${filename}`, () => {
      expect(espreeParserResult.ast).toBeTruthy();
      expect(typeScriptESTreeResult.ast).toBeTruthy();

      /**
       * Perform some extra formatting steps on the espree AST before comparing
       */
      expect(
        parseUtils.removeLocationDataAndSourceTypeFromProgramNode(
          parseUtils.preprocessEspreeAST(espreeParserResult.ast),
          fixture.ignoreSourceType
        )
      ).toEqual(
        parseUtils.removeLocationDataAndSourceTypeFromProgramNode(
          typeScriptESTreeResult.ast,
          fixture.ignoreSourceType
        )
      );
    });
  });
});
