import { defineHastPlugin } from 'satteri';

/** Rewrites relative documentation source links to their public clean URLs. */
export const documentationLinks = () =>
	defineHastPlugin({
		name: 'ambiente-documentation-links',
		element: {
			filter: ['a'],
			visit(node, context) {
				const href = node.properties.href;
				if (typeof href !== 'string' || !context.fileURL || href.startsWith('#') || /^[a-z]+:/i.test(href)) {
					return;
				}

				const target = new URL(href, context.fileURL);
				const marker = '/content/docs/';
				const markerIndex = target.pathname.indexOf(marker);
				if (markerIndex === -1 || !/\.mdx?$/.test(target.pathname)) {
					return;
				}

				const contentPath = target.pathname
					.slice(markerIndex + marker.length)
					.replace(/\.mdx?$/, '')
					.replace(/\/index$/, '');
				context.setProperty(node, 'href', `/docs/${contentPath}${target.hash}`);
			}
		}
	});
