import storybook from 'eslint-plugin-storybook';
import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  { ignores: ['eslint.config.js'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  storybook.configs['flat/recommended'],
  prettier // keep last so it can switch off conflicting rules
);
