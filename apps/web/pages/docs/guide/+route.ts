import type { PageContext } from 'vike/types';

export function route(pageContext: PageContext) {
	const prefix = '/docs/';
	if (!pageContext.urlPathname.startsWith(prefix)) {
		return false;
	}

	const slug = pageContext.urlPathname.slice(prefix.length).replace(/\/$/, '');
	return slug ? { routeParams: { slug } } : false;
}
