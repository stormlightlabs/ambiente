import { defineHastPlugin, defineMdastPlugin } from 'satteri';

/** A heading exposed to the documentation page navigation. */
export type ContentHeading = { depth: number; id: string; text: string };

/** Converts heading text to a stable, URL-safe fragment. */
export function slugifyHeading(text: string): string {
	return (
		text
			.normalize('NFKD')
			.toLowerCase()
			.replace(/[’']/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'section'
	);
}

function uniqueSlug(text: string, seen: Map<string, number>): string {
	const base = slugifyHeading(text);
	const count = seen.get(base) ?? 0;
	seen.set(base, count + 1);
	return count === 0 ? base : `${base}-${count + 1}`;
}

/** Adds stable IDs to rendered Markdown and MDX headings. */
export const headingAnchors = () => {
	const seen = new Map<string, number>();

	return defineHastPlugin({
		name: 'ambiente-heading-anchors',
		element: {
			filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
			visit(node, context) {
				context.setProperty(node, 'id', uniqueSlug(context.textContent(node), seen));
			}
		}
	});
};

/** Exports the headings collected while Sätteri compiles an MDX document. */
export const collectMdxHeadings = () => {
	const headings: ContentHeading[] = [];
	const seen = new Map<string, number>();

	return defineMdastPlugin({
		name: 'ambiente-mdx-headings',
		heading(node, context) {
			const text = context.textContent(node);
			const id = uniqueSlug(text, seen);
			headings.push({ depth: node.depth, id, text });
		},
		after(root, context) {
			if (context.sourceFormat === 'mdx') {
				context.appendChild(root, { type: 'mdxjsEsm', value: `export const headings = ${JSON.stringify(headings)};` });
			}
		}
	});
};
