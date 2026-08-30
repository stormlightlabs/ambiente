/// <reference types="vite/client" />

declare module '*?raw' {
	const content: string;
	export default content;
}

declare module '*.md' {
	const html: string;
	const frontmatter: Record<string, unknown>;
	export { frontmatter, html };
	export default html;
}

declare module '*.mdx' {
	import type { Component } from 'solid-js';

	const MDXContent: Component<Record<string, unknown>>;
	const frontmatter: Record<string, unknown>;
	const headings: import('./content/heading-anchors').ContentHeading[];
	export { frontmatter, headings };
	export default MDXContent;
}
