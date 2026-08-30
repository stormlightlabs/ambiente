import type { PageContext } from 'vike/types';

export function route(pageContext: PageContext) {
	if (!pageContext.urlPathname.startsWith('/studio')) {
		return false;
	}

	return { routeParams: { studioPath: pageContext.urlPathname.slice(7) || '/' } };
}
