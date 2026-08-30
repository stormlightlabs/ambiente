import { documentation } from '../../../src/content/docs';

export function onBeforePrerenderStart() {
	return documentation.map((entry) => entry.path);
}
