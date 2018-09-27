<h1 align="center">TypeScript ESTree</h1>

<p align="center">A parser that converts TypeScript source code into an ESTree-compatible form: https://github.com/estree/estree</p>

<p align="center">
    <a href="https://travis-ci.org/JamesHenry/typescript-estree"><img src="https://img.shields.io/travis/JamesHenry/typescript-estree.svg?style=flat-square" alt="Travis"/></a>
    <a href="https://github.com/JamesHenry/typescript-estree/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/typescript-estree.svg?style=flat-square" alt="GitHub license" /></a>
    <a href="https://www.npmjs.com/package/typescript-estree"><img src="https://img.shields.io/npm/v/typescript-estree.svg?style=flat-square" alt="NPM Version" /></a>
    <a href="https://www.npmjs.com/package/typescript-estree"><img src="https://img.shields.io/npm/dt/typescript-estree.svg?style=flat-square" alt="NPM Downloads" /></a>
    <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen friendly" /></a>
    <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square" alt="semantic-release" /></a>
</p>

<br>

## Usage

This parser is somewhat generic and robust, it could be used to power any use-case which requires taking TypeScript source code and producing an ESTree-compatiable AST.

In fact, it is already used within these hyper-popular open-source projects to power their TypeScript support:

- [ESLint](https://eslint.org), the pluggable linting utility for JavaScript and JSX
  - See [typescript-eslint-parser](https://github.com/eslint/typescript-eslint-parser) for more details
- [Prettier](https://prettier.io), an opinionated code formatter

## Supported TypeScript Version

We will always endeavor to support the latest stable version of TypeScript.

The version of TypeScript currently supported by this parser is `~3.0.1`. This is reflected in the `devDependency` requirement within the package.json file, and it is what the tests will be run against. We have an open `peerDependency` requirement in order to allow for experimentation on newer/beta versions of TypeScript.

If you use a non-supported version of TypeScript, the parser will log a warning to the console.

**Please ensure that you are using a supported version before submitting any issues/bug reports.**

## Reporting Issues

Please check the current list of open and known issues and ensure the issue has not been reported before. When creating a new issue provide as much information about your environment as possible. This includes:

- TypeScript version
- The `typescript-estree` version

## AST Alignment Tests

A couple of years after work on this parser began, the TypeScript Team at Microsoft began [officially supporting TypeScript parsing via Babel](https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/).

I work closely with TypeScript Team and we are gradually aliging the AST of this project with the one produced by Babel's parser. To that end, I have created a full test harness to compare the ASTs of the two projects which runs on every PR, please see the code for more details.

## Build/Test Commands

- `npm test` - run all tests
- `npm run unit-tests` - run only unit tests
- `npm run ast-alignment-tests` - run only Babylon AST alignment tests

## License

TypeScript ESTree inherits from the the original TypeScript ESLint Parser license, as the majority of the work began there. It is licensed under a permissive BSD 2-clause license.
