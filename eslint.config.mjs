// @ts-check
import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import solid from 'eslint-plugin-solid/configs/typescript';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @typedef {import('eslint').Linter.Config} FlatConfig */
const solidConfig = /** @type {FlatConfig} */ (/** @type {unknown} */ (solid));
const unicornConfig = /** @type {FlatConfig} */ (/** @type {unknown} */ (unicorn.configs['flat/recommended']));

export default defineConfig(
	{ ignores: ['**/dist/**', '**/generated/**', '**/node_modules/**', '**/target/**', '**/public/pagefind/**'] },
	eslint.configs.recommended,
	tseslint.configs.recommended,
	unicornConfig,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: { parser: tsParser, parserOptions: { projectService: true }, globals: globals.browser },
		rules: { 'no-undef': 'off' }
	},
	{
		files: ['**/*.{config,conf}.{js,mjs,cjs,ts}', '**/scripts/**/*.{js,mjs,cjs,ts}'],
		languageOptions: { globals: globals.node }
	},
	{ files: ['**/*.tsx'], plugins: { react }, rules: { 'react/jsx-max-depth': ['error', { max: 5 }] } },
	{ files: ['**/*.tsx'], ...solidConfig, rules: { 'solid/no-innerhtml': 'off' } },
	{
		rules: {
			'unicorn/catch-error-name': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/import-style': 'off',
			'unicorn/name-replacements': 'off',
			'unicorn/no-array-sort': 'off',
			'unicorn/no-negated-condition': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-top-level-assignment-in-function': 'off',
			'unicorn/prefer-query-selector': 'off',
			'unicorn/prefer-string-replace-all': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/prefer-ternary': 'off',
			'unicorn/single-line-block-comment-style': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
		}
	}
);
