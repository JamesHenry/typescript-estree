import glob from 'glob';
import fs from 'fs';
import path from 'path';

export interface CreateFixturePatternConfig {
  ignoreBabel?: string[];
  ignoreEspree?: string[];
  fileType?: string;
  ignoreSourceType?: string[];
}

export interface Fixture {
  filename: string;
  ignoreSourceType: boolean;
}

export interface FixturePatternConfig {
  pattern: string;
  ignoreSourceType: boolean;
}

const fixturesDirPath = path.join(__dirname, '../fixtures');

export class FixturesTester {
  protected babelFixtures: FixturePatternConfig[] = [];
  protected espreeFixtures: FixturePatternConfig[] = [];

  constructor() {}

  public registerTest(
    fixturesSubPath: string,
    config: CreateFixturePatternConfig = {}
  ) {
    if (!fs.existsSync(path.join(fixturesDirPath, fixturesSubPath))) {
      throw new Error(
        `Registered path '${path.join(
          __dirname,
          fixturesSubPath
        )}' was not found`
      );
    }

    const ignoreBabel = config.ignoreBabel || [];
    const ignoreEspree = config.ignoreEspree || [];
    const fileType = config.fileType || 'js';
    const ignoreSourceType = config.ignoreSourceType || [];

    if (fileType === 'js' || fileType === 'jsx') {
      this.espreeFixtures.push({
        pattern: `${fixturesSubPath}/!(${ignoreEspree.join(
          '|'
        )}).src.${fileType}`,
        ignoreSourceType: false
      });
    }

    /**
     * https://github.com/babel/babel/issues/9213
     */
    if (ignoreSourceType.length) {
      ignoreBabel.push(...ignoreSourceType);
      for (const fixture of ignoreSourceType) {
        this.babelFixtures.push({
          // It needs to be the full path from within fixtures/ for the pattern
          pattern: `${fixturesSubPath}/${fixture}.src.${config.fileType}`,
          ignoreSourceType: true
        });
      }
    }

    this.babelFixtures.push({
      pattern: `${fixturesSubPath}/!(${ignoreBabel.join('|')}).src.${fileType}`,
      ignoreSourceType: false
    });
  }

  protected processFixtures(fixtures: FixturePatternConfig[]): Fixture[] {
    return fixtures
      .map(fixtures => {
        return glob
          .sync(`${fixturesDirPath}/${fixtures.pattern}`, {})
          .map(filename => {
            return {
              filename,
              ignoreSourceType: fixtures.ignoreSourceType
            };
          });
      })
      .reduce((acc, x) => acc.concat(x), []);
  }

  public getForBabel(): Fixture[] {
    return this.processFixtures(this.babelFixtures);
  }

  public getForEspree(): Fixture[] {
    return this.processFixtures(this.espreeFixtures);
  }
}
