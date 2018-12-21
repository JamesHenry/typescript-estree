import fs from 'fs';
import { fixturesToTest } from './fixtures-to-test';
import { parse } from './parse';
import * as parseUtils from './utils';

fixturesToTest.forEach(fixture => {
  const filename = fixture.filename;
  const source = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');

  const config = fixture.config || {};
  config.typeScriptESTreeOptions = config.typeScriptESTreeOptions || {};
  config.babelParserOptions = config.babelParserOptions || {};

  /**
   * Parse with typescript-estree
   */
  const typeScriptESTreeResult = parse(source, {
    parser: 'typescript-estree',
    typeScriptESTreeOptions: config.typeScriptESTreeOptions
  });

  /**
   * Parse the source with babylon typescript-plugin
   */
  const babelParserResult = parse(source, {
    parser: '@babel/parser',
    babelParserOptions: config.babelParserOptions
  });

  /**
   * If babylon fails to parse the source, ensure that typescript-estree has the same fundamental issue
   */
  if (babelParserResult.parseError) {
    /**
     * FAIL: babylon errored but typescript-estree did not
     */
    if (!typeScriptESTreeResult.parseError) {
      it(`TEST FAIL [BABYLON ERRORED, BUT TSEP DID NOT] - ${filename}`, () => {
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
   * FAIL: typescript-estree errored but babylon did not
   */
  if (typeScriptESTreeResult.parseError) {
    it(`TEST FAIL [TSEP ERRORED, BUT BABYLON DID NOT] - ${filename}`, () => {
      expect(babelParserResult.parseError).toEqual(
        typeScriptESTreeResult.parseError
      );
    });
    return;
  }

  /**
   * No errors, assert the two ASTs match
   */
  it(`${filename}`, () => {
    expect(babelParserResult.ast).toBeTruthy();
    expect(typeScriptESTreeResult.ast).toBeTruthy();
    /**
     * Perform some extra formatting steps on the babylon AST before comparing
     */
    expect(
      parseUtils.removeLocationDataFromProgramNode(
        parseUtils.preprocessBabylonAST(babelParserResult.ast)
      )
    ).toEqual(
      parseUtils.removeLocationDataFromProgramNode(typeScriptESTreeResult.ast)
    );
  });
});
