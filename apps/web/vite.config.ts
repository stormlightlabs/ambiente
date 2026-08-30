import expressiveCode from 'satteri-expressive-code';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import satteri from 'vite-plugin-satteri';
import solid from 'vite-plugin-solid';
import vike from 'vike/plugin';
import vikeSolid from 'vike-solid/vite';

import { collectMdxHeadings, headingAnchors } from './src/content/heading-anchors';
import { documentationLinks } from './src/content/documentation-links';

export default defineConfig({
	plugins: [
		UnoCSS(),
		satteri({
			features: { frontmatter: true, gfm: true },
			hastPlugins: [headingAnchors, documentationLinks, expressiveCode()],
			mdastPlugins: [collectMdxHeadings],
			mdx: { jsx: true, jsxImportSource: 'solid-js/h' }
		}),
		solid({ extensions: ['.mdx'], include: [/\.mdx$/] }),
		vike(),
		vikeSolid()
	]
});
