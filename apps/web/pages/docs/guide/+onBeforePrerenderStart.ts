import { documentation } from '../../../content/docs';

export function onBeforePrerenderStart() {
	return documentation.map((entry) => entry.path);
}
